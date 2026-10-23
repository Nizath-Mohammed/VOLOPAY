import type {
  AnalysisFreshness,
  AppRecord,
  AuditActionType,
  AuditEntry,
  DeliveryBatch,
  ImportSummary,
  ReviewState,
  SourceType,
} from '../types/contract';
import type { RecordAnalysisPayload } from '../types/analysis';
import {
  StorageCommitError,
  StorageResetError,
} from '../types/contract';
import { getRecordKey } from './identity';
import { hasUsableTranscript } from './transcript';
import { generateAnalysis } from './analysisEngine';
import {
  AUDIT_STORAGE_KEY,
  deserializeAuditHistory,
  deserializeRecords,
  getEffectiveStorage,
  RECORDS_STORAGE_KEY,
  serializeAuditHistory,
  serializeRecords,
  StorageAdapter,
} from './storage';
import { validateAndPlanBatch } from './validation';

export interface UserRecordUpdates {
  manualRoute?: string | null;
  reviewState?: ReviewState;
  userNotes?: string;
  secondaryTags?: string[];
}

export function getEffectiveRoute(record: AppRecord): string {
  if (record.userState.isManualOverride && record.userState.manualRoute) {
    return record.userState.manualRoute;
  }
  return record.suggestedRoute;
}

export class ReplayStore {
  private records = new Map<string, AppRecord>();
  private auditHistory: AuditEntry[] = [];
  private auditPersistenceDegraded = false;
  private storage: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storage = getEffectiveStorage(storageAdapter);
    this.loadFromStorage();
  }

  /**
   * Explicit action: Ingests the initial delivery batch (Revision 1).
   */
  public importInitialBatch(batch: DeliveryBatch): ImportSummary {
    return this.executeBatchImport(batch, 'INITIAL_LOAD');
  }

  /**
   * Explicit action: Re-imports the initial delivery batch in shuffled order to verify idempotence.
   */
  public reimportShuffledBatch(batch: DeliveryBatch): ImportSummary {
    return this.executeBatchImport(batch, 'SHUFFLED_RELOAD');
  }

  /**
   * Explicit action: Applies a higher revision update batch (e.g. M07 Revision 2).
   */
  public applyUpdateBatch(batch: DeliveryBatch): ImportSummary {
    return this.executeBatchImport(batch, 'UPDATE_BATCH');
  }

  /**
   * Explicit action: Ingests a user-supplied custom JSON batch with schema validation.
   */
  public importCustomBatch(batch: DeliveryBatch): ImportSummary {
    return this.executeBatchImport(batch, 'CUSTOM_IMPORT');
  }

  /**
   * General batch import method. Maintained for Slice 1 backward compatibility.
   */
  public importBatch(
    batch: DeliveryBatch,
    actionType: AuditActionType = 'CUSTOM_IMPORT'
  ): ImportSummary {
    return this.executeBatchImport(batch, actionType);
  }

  /**
   * Core two-phase pre-commit batch import pipeline:
   * 1. Schema and envelope validation + intra-batch duplicate resolution.
   * 2. Staging in candidate records map (in-memory store is untouched).
   * 3. Revision checks & full payload replacement on higher revisions.
   * 4. User state preservation & analysis invalidation on transcript arrival.
   * 5. Pre-commit write to physical storage. Throws StorageCommitError on failure.
   * 6. In-memory commit to active records map.
   * 7. Fail-safe audit logging.
   */
  private executeBatchImport(
    batch: DeliveryBatch,
    actionType: AuditActionType
  ): ImportSummary {
    // Phase 1: Validate envelope and plan intra-batch records
    const plan = validateAndPlanBatch(batch);
    const previousRecordCount = this.records.size;

    // Phase 2: Clone active records into staging candidate map
    const candidateRecords = new Map<string, AppRecord>(this.records);

    let appliedCount = 0;
    let ignoredCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;

    for (const incomingRecord of plan.validRecords) {
      const key = getRecordKey(incomingRecord.source_type, incomingRecord.source_id);
      const existing = candidateRecords.get(key);

      if (existing) {
        // Revision check: same or older revision must be completely ignored
        if (batch.revision <= existing.appliedRevision) {
          ignoredCount++;
          continue;
        }

        // Higher revision: Full replacement of source payload and transcript_payload
        const previousHadTranscript = existing.hasUsableTranscript;
        const newHasTranscript = hasUsableTranscript(incomingRecord);
        const transcriptChanged = !previousHadTranscript && newHasTranscript;

        // Freshness determination for higher revision:
        let nextFreshness: AnalysisFreshness;
        const preservedAnalysis = existing.analysisState.analysis;
        let preservedGeneratedForRevision = existing.analysisState.generatedForRevision;

        if (!newHasTranscript) {
          // Current revision has no usable transcript
          nextFreshness = 'not_applicable';
          // Previous analysis and its generatedForRevision are preserved as historical reference
        } else {
          // Current revision has a usable transcript
          if (preservedAnalysis || transcriptChanged) {
            nextFreshness = 'stale_pending_review';
          } else {
            nextFreshness = 'uncomputed';
            preservedGeneratedForRevision = null;
          }
        }

        const updatedRecord: AppRecord = {
          source: incomingRecord, // Full replacement, no partial merge
          appliedRevision: batch.revision,
          hasUsableTranscript: newHasTranscript,
          suggestedRoute: newHasTranscript ? 'Needs Triage' : 'Unusable / Missing Audio',
          // Explicitly preserve user judgments and manual overrides
          userState: {
            ...existing.userState,
            // If new transcript evidence arrived, mark for review while preserving manualRoute
            reviewState: transcriptChanged ? 'pending_review' : existing.userState.reviewState,
          },
          // Preserve analysis and update freshness lifecycle
          analysisState: {
            analysis: preservedAnalysis,
            freshness: nextFreshness,
            generatedForRevision: preservedGeneratedForRevision,
          },
        };

        candidateRecords.set(key, updatedRecord);
        appliedCount++;
        updatedCount++;
      } else {
        // New record insertion
        const usable = hasUsableTranscript(incomingRecord);
        const newRecord: AppRecord = {
          source: incomingRecord,
          appliedRevision: batch.revision,
          hasUsableTranscript: usable,
          suggestedRoute: usable ? 'Needs Triage' : 'Unusable / Missing Audio',
          userState: {
            manualRoute: null,
            secondaryTags: [],
            isManualOverride: false,
            reviewState: 'unreviewed', // Refined: Always starts as unreviewed
            userNotes: '',
            lastModifiedAt: null,
          },
          analysisState: {
            analysis: null,
            freshness: usable ? 'uncomputed' : 'not_applicable',
            generatedForRevision: null,
          },
        };

        candidateRecords.set(key, newRecord);
        appliedCount++;
        insertedCount++;
      }
    }

    // Phase 3: PRE-COMMIT: Write to physical storage BEFORE modifying in-memory state
    try {
      const serialized = serializeRecords(candidateRecords);
      this.storage.setItem(RECORDS_STORAGE_KEY, serialized);
    } catch (storageErr) {
      // Storage write failed: abort immediately without mutating active in-memory store
      throw new StorageCommitError(
        `Atomic storage commit failed: ${
          storageErr instanceof Error ? storageErr.message : 'Storage unavailable'
        }. In-memory state preserved.`,
        { cause: storageErr }
      );
    }

    // Phase 4: Storage succeeded; commit in-memory state
    this.records = candidateRecords;

    // Phase 5: Fail-safe audit logging
    const details = `Imported batch "${batch.batch_id}" (rev ${batch.revision}) via ${actionType}. Applied: ${appliedCount}, Ignored: ${ignoredCount}, Collapsed: ${plan.collapsedCount}, Rejected: ${plan.rejectedCount}.`;
    this.recordAuditEvent({
      action: actionType,
      batchId: batch.batch_id,
      revision: batch.revision,
      previousRecordCount,
      newRecordCount: this.records.size,
      appliedCount,
      ignoredCount,
      rejectedCount: plan.rejectedCount,
      details,
    });

    return {
      batchId: batch.batch_id,
      batchRevision: batch.revision,
      recordsInBatch: batch.records.length,
      appliedCount,
      ignoredCount,
      updatedCount,
      insertedCount,
      collapsedCount: plan.collapsedCount,
      rejectedCount: plan.rejectedCount,
      totalRecordsNow: this.records.size,
      usableTranscriptsNow: this.getUsableTranscriptsCount(),
      diagnostics: plan.diagnostics,
    };
  }

  /**
   * Updates user-modifiable fields on a single record with two-phase atomic persistence.
   * Preserves reviewState, manualRoute, and userNotes when omitted from updates.
   * Emits a MANUAL_REVIEW_UPDATE audit event upon success.
   */
  public updateUserRecordState(
    sourceType: SourceType,
    sourceId: string,
    updates: UserRecordUpdates,
    actor = 'Operations Manager'
  ): void {
    const key = getRecordKey(sourceType, sourceId);
    const current = this.records.get(key);
    if (!current) {
      throw new Error(`Cannot update record: ${key} not found.`);
    }

    // 1. Resolve manualRoute and isManualOverride without side effects on reviewState
    let newManualRoute = current.userState.manualRoute;
    let newIsManualOverride = current.userState.isManualOverride;

    if (updates.manualRoute !== undefined) {
      if (updates.manualRoute === null || updates.manualRoute === current.suggestedRoute) {
        newManualRoute = null;
        newIsManualOverride = false;
      } else {
        newManualRoute = updates.manualRoute;
        newIsManualOverride = true;
      }
    }

    // 2. Stage updated record — reviewState only updates if explicitly passed in updates
    const stagedRecord: AppRecord = {
      ...current,
      userState: {
        manualRoute: newManualRoute,
        isManualOverride: newIsManualOverride,
        reviewState: updates.reviewState !== undefined ? updates.reviewState : current.userState.reviewState,
        userNotes: updates.userNotes !== undefined ? updates.userNotes : current.userState.userNotes,
        secondaryTags: updates.secondaryTags !== undefined ? [...updates.secondaryTags] : current.userState.secondaryTags,
        lastModifiedAt: new Date().toISOString(),
      },
    };

    // 3. Phase 1: Pre-commit write to physical records storage
    const candidateRecords = new Map(this.records);
    candidateRecords.set(key, stagedRecord);

    try {
      const serialized = serializeRecords(candidateRecords);
      this.storage.setItem(RECORDS_STORAGE_KEY, serialized);
    } catch (storageErr) {
      // If physical records write fails (e.g. quota exceeded), abort immediately.
      // In-memory state remains 100% untouched.
      throw new StorageCommitError(
        `Failed to save record review to persistent storage: ${
          storageErr instanceof Error ? storageErr.message : 'Storage unavailable'
        }. In-memory state preserved.`,
        { cause: storageErr }
      );
    }

    // 4. Phase 2: Records storage succeeded; commit to active in-memory state
    const storeSize = this.records.size;
    this.records = candidateRecords;

    // 5. Phase 3: Fail-safe audit logging using existing recordAuditEvent mechanism
    const effectiveRoute = stagedRecord.userState.isManualOverride
      ? stagedRecord.userState.manualRoute
      : stagedRecord.suggestedRoute;

    this.recordAuditEvent({
      action: 'MANUAL_REVIEW_UPDATE',
      previousRecordCount: storeSize,
      newRecordCount: storeSize,
      appliedCount: 1,
      ignoredCount: 0,
      rejectedCount: 0,
      details: `${actor} updated ${sourceType} ${sourceId} (${current.source.record_ref}): Route="${effectiveRoute}", State="${stagedRecord.userState.reviewState}", Override=${stagedRecord.userState.isManualOverride}.`,
    });
  }

  /**
   * Clears manual route override, restoring the default suggestedRoute.
   * Preserves userNotes, secondaryTags, and reviewState.
   */
  public clearManualOverride(sourceType: SourceType, sourceId: string, actor = 'Operations Manager'): void {
    this.updateUserRecordState(sourceType, sourceId, { manualRoute: null }, actor);
  }

  /**
   * Applies a manual route correction to a record.
   * Legacy helper: sets reviewState to 'reviewed' for Slice 1/2 backward compatibility.
   */
  public setManualRoute(
    sourceType: SourceType,
    sourceId: string,
    route: string,
    secondaryTags: string[] = []
  ): void {
    this.updateUserRecordState(sourceType, sourceId, {
      manualRoute: route,
      secondaryTags,
      reviewState: 'reviewed',
    });
  }

  /**
   * Sets manual review state directly.
   * Legacy helper: updates reviewState preserving routes and notes.
   */
  public setReviewState(sourceType: SourceType, sourceId: string, state: ReviewState): void {
    this.updateUserRecordState(sourceType, sourceId, { reviewState: state });
  }

  /**
   * Generates or regenerates offline, evidence-backed analysis for a record on demand.
   * Atomic storage pre-commit: in-memory state is only mutated after persistent storage succeeds.
   * Emits ANALYSIS_GENERATED or ANALYSIS_REGENERATED audit event.
   */
  public generateRecordAnalysis(sourceType: SourceType, sourceId: string): RecordAnalysisPayload {
    const key = getRecordKey(sourceType, sourceId);
    const current = this.records.get(key);
    if (!current) {
      throw new Error(`Cannot generate analysis: record ${key} not found.`);
    }
    if (!current.hasUsableTranscript) {
      throw new Error(`Cannot generate analysis for ${key}: record has no usable transcript in Revision ${current.appliedRevision}.`);
    }

    const isRegeneration = current.analysisState.analysis !== null;
    const analysis = generateAnalysis(current);

    const updatedRecord: AppRecord = {
      ...current,
      analysisState: {
        analysis,
        freshness: 'current',
        generatedForRevision: current.appliedRevision,
      },
    };

    const candidateRecords = new Map(this.records);
    candidateRecords.set(key, updatedRecord);

    // Phase 1: Storage pre-commit
    try {
      const serialized = serializeRecords(candidateRecords);
      this.storage.setItem(RECORDS_STORAGE_KEY, serialized);
    } catch (storageErr) {
      throw new StorageCommitError(
        `Failed to persist generated analysis: ${
          storageErr instanceof Error ? storageErr.message : 'Storage unavailable'
        }. In-memory state preserved.`,
        { cause: storageErr }
      );
    }

    // Phase 2: Commit to active in-memory state
    const storeSize = this.records.size;
    this.records = candidateRecords;

    // Phase 3: Fail-safe audit logging
    const action: AuditActionType = isRegeneration ? 'ANALYSIS_REGENERATED' : 'ANALYSIS_GENERATED';
    this.recordAuditEvent({
      action,
      revision: current.appliedRevision,
      previousRecordCount: storeSize,
      newRecordCount: storeSize,
      appliedCount: 1,
      ignoredCount: 0,
      rejectedCount: 0,
      details: `${isRegeneration ? 'Regenerated' : 'Generated'} analysis for ${sourceType} ${sourceId} (${current.source.record_ref}) at revision ${current.appliedRevision}: ${analysis.topics.length} topics, ${analysis.keyQuestions.length} questions, ${analysis.statedObjections.length} objections.`,
    });

    return analysis;
  }

  /**
   * Safe storage-first store reset:
   * 1. Attempts removal of RECORDS_STORAGE_KEY first.
   * 2. If storage removal fails, in-memory state is NOT cleared, STORE_RESET_FAILED is logged, and StorageResetError is thrown.
   * 3. Only when storage removal succeeds, in-memory records are cleared and STORE_RESET is logged.
   */
  public resetState(): void {
    const previousRecordCount = this.records.size;

    // Step 1: Pre-commit physical storage removal
    try {
      this.storage.removeItem(RECORDS_STORAGE_KEY);
    } catch (storageErr) {
      // In-memory records remain 100% UNTOUCHED
      this.recordAuditEvent({
        action: 'STORE_RESET_FAILED',
        previousRecordCount,
        newRecordCount: previousRecordCount,
        appliedCount: 0,
        ignoredCount: 0,
        rejectedCount: 0,
        details: `Store reset failed during storage removal: ${
          storageErr instanceof Error ? storageErr.message : 'Storage removal error'
        }. In-memory state preserved.`,
      });

      throw new StorageResetError(
        `Failed to clear persistent storage: ${
          storageErr instanceof Error ? storageErr.message : 'Storage error'
        }. In-memory state preserved.`,
        { cause: storageErr }
      );
    }

    // Step 2: Storage removal succeeded. Now safely clear in-memory records.
    this.records.clear();

    // Step 3: Record successful STORE_RESET audit event
    this.recordAuditEvent({
      action: 'STORE_RESET',
      previousRecordCount,
      newRecordCount: 0,
      appliedCount: 0,
      ignoredCount: 0,
      rejectedCount: 0,
      details: `Store reset confirmed: ${previousRecordCount} records cleared from persistent storage and memory.`,
    });
  }

  /**
   * Internal fail-safe audit recorder. Never throws outward to callers.
   */
  private recordAuditEvent(entryData: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entryData,
    };

    // Rule 1: In-memory append ALWAYS occurs first
    this.auditHistory.push(entry);

    // Rule 2: Attempt persistence; swallow errors internally to never mask caller errors
    try {
      this.persistAuditHistory();
    } catch {
      this.auditPersistenceDegraded = true;
    }

    return entry;
  }

  /**
   * Persists audit history to storage with dual-tier compaction fallback.
   */
  private persistAuditHistory(): void {
    try {
      // Try full serialization
      const serialized = serializeAuditHistory(this.auditHistory, false);
      this.storage.setItem(AUDIT_STORAGE_KEY, serialized);
      this.auditPersistenceDegraded = false;
    } catch {
      // If full write throws (e.g. QuotaExceededError), try compacted serialization
      const compacted = serializeAuditHistory(this.auditHistory, true);
      this.storage.setItem(AUDIT_STORAGE_KEY, compacted);
      this.auditPersistenceDegraded = false;
    }
  }

  /**
   * Returns a copy of the in-memory audit history.
   */
  public getAuditHistory(): AuditEntry[] {
    return [...this.auditHistory];
  }

  /**
   * Clears audit history from memory and storage.
   */
  public clearAuditHistory(): void {
    this.auditHistory = [];
    try {
      this.storage.removeItem(AUDIT_STORAGE_KEY);
      this.auditPersistenceDegraded = false;
    } catch {
      this.auditPersistenceDegraded = true;
    }
  }

  /**
   * Returns true if audit persistence has encountered an error in storage.
   */
  public isAuditStorageDegraded(): boolean {
    return this.auditPersistenceDegraded;
  }

  /**
   * Gets a single record by identity.
   */
  public getRecord(sourceType: SourceType, sourceId: string): AppRecord | undefined {
    return this.records.get(getRecordKey(sourceType, sourceId));
  }

  /**
   * Returns all stored records as an array.
   */
  public getAllRecords(): AppRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Count of total records.
   */
  public getTotalCount(): number {
    return this.records.size;
  }

  /**
   * Count of records with usable supplied transcript.
   */
  public getUsableTranscriptsCount(): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.hasUsableTranscript) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns comprehensive summary metrics conforming to DATA_DICTIONARY.md.
   */
  public getSummaryMetrics() {
    let callsCount = 0;
    let meetingsCount = 0;
    let callTranscriptsCount = 0;
    let meetingTranscriptsCount = 0;
    let manualOverridesCount = 0;
    let pendingReviewCount = 0;
    let unreviewedCount = 0;
    let reviewedCount = 0;

    // Source-reported call connection counters
    let sourceReportedConnectedCount = 0;
    let sourceReportedNonConnectedCount = 0;
    let sourceReportedUnknownCount = 0;

    for (const record of this.records.values()) {
      if (record.source.source_type === 'call') {
        callsCount++;
        if (record.hasUsableTranscript) callTranscriptsCount++;

        const isConn = (record.source.payload as { is_connected?: boolean | null }).is_connected;
        if (isConn === true) {
          sourceReportedConnectedCount++;
        } else if (isConn === false) {
          sourceReportedNonConnectedCount++;
        } else {
          sourceReportedUnknownCount++;
        }
      } else if (record.source.source_type === 'meeting') {
        meetingsCount++;
        if (record.hasUsableTranscript) meetingTranscriptsCount++;
      }

      if (record.userState.isManualOverride) {
        manualOverridesCount++;
      }

      if (record.userState.reviewState === 'pending_review') {
        pendingReviewCount++;
      } else if (record.userState.reviewState === 'reviewed') {
        reviewedCount++;
      } else {
        unreviewedCount++;
      }
    }

    const totalRecords = this.records.size;
    const usableTranscriptsCount = callTranscriptsCount + meetingTranscriptsCount;
    const coverageRate = totalRecords > 0 ? (usableTranscriptsCount / totalRecords) * 100 : 0;
    const callCoverageRate = callsCount > 0 ? (callTranscriptsCount / callsCount) * 100 : 0;
    const meetingCoverageRate = meetingsCount > 0 ? (meetingTranscriptsCount / meetingsCount) * 100 : 0;

    const sourceKnownConnectedTotal = sourceReportedConnectedCount + sourceReportedNonConnectedCount;
    const sourceReportedConnectionRate =
      sourceKnownConnectedTotal > 0
        ? (sourceReportedConnectedCount / sourceKnownConnectedTotal) * 100
        : 0;

    return {
      totalRecords,
      callsCount,
      meetingsCount,
      usableTranscriptsCount,
      callTranscriptsCount,
      meetingTranscriptsCount,
      coverageRate,
      callCoverageRate,
      meetingCoverageRate,
      sourceReportedConnectedCount,
      sourceReportedNonConnectedCount,
      sourceReportedUnknownCount,
      sourceKnownConnectedTotal,
      sourceReportedConnectionRate,
      manualOverridesCount,
      pendingReviewCount,
      unreviewedCount,
      reviewedCount,
    };
  }

  /**
   * Aggregates activity into hourly buckets for 2026-08-21 in Asia/Kolkata (IST: UTC+05:30).
   */
  public getHourlyTimeline() {
    const buckets: Array<{
      hour: number;
      hourLabel: string;
      callCount: number;
      meetingCount: number;
      total: number;
    }> = [];

    for (let h = 0; h < 24; h++) {
      const pad = h.toString().padStart(2, '0');
      buckets.push({
        hour: h,
        hourLabel: `${pad}:00`,
        callCount: 0,
        meetingCount: 0,
        total: 0,
      });
    }

    for (const record of this.records.values()) {
      let isoTimestamp: string;
      if (record.source.source_type === 'call') {
        isoTimestamp = (record.source.payload as { started_at: string }).started_at;
      } else {
        isoTimestamp = (record.source.payload as { starts_at: string }).starts_at;
      }

      if (!isoTimestamp) continue;

      const dateUtc = new Date(isoTimestamp);
      // Convert to Asia/Kolkata (+05:30)
      const istMillis = dateUtc.getTime() + 5.5 * 60 * 60 * 1000;
      const istDate = new Date(istMillis);
      const hour = istDate.getUTCHours();

      if (hour >= 0 && hour < 24) {
        if (record.source.source_type === 'call') {
          buckets[hour].callCount++;
        } else {
          buckets[hour].meetingCount++;
        }
        buckets[hour].total++;
      }
    }

    return buckets;
  }

  /**
   * Persists current in-memory store to storage adapter.
   */
  public saveToStorage(): void {
    const serialized = serializeRecords(this.records);
    this.storage.setItem(RECORDS_STORAGE_KEY, serialized);
  }

  /**
   * Rehydrates store and audit history from storage adapter.
   */
  public loadFromStorage(): boolean {
    const rawRecords = this.storage.getItem(RECORDS_STORAGE_KEY);
    const rawAudit = this.storage.getItem(AUDIT_STORAGE_KEY);

    let loaded = false;
    if (rawRecords) {
      try {
        this.records = deserializeRecords(rawRecords);
        loaded = true;
      } catch {
        // Corrupted records storage left untouched
      }
    }

    if (rawAudit) {
      try {
        this.auditHistory = deserializeAuditHistory(rawAudit);
      } catch {
        // Non-fatal
      }
    }

    return loaded;
  }
}
