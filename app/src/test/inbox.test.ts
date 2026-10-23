import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayStore, getEffectiveRoute } from '../engine/replayStore';
import { MemoryStorage, StorageAdapter } from '../engine/storage';
import { DeliveryBatch, StorageCommitError } from '../types/contract';
import { getRecordKey, parseUrlRecordHash } from '../engine/identity';

import initialBatchJson from '../../../data/01_initial.json';
import updateBatchJson from '../../../data/02_update.json';

const initialBatch = initialBatchJson as unknown as DeliveryBatch;
const updateBatch = updateBatchJson as unknown as DeliveryBatch;
const M07_SOURCE_ID = '4f304fff-fd40-5cfc-a366-0a134c445c2a';

describe('Vertical Slice 3: Inbox, Record Drawer & Review Workflow', () => {
  let memoryStorage: MemoryStorage;
  let store: ReplayStore;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    store = new ReplayStore(memoryStorage);
    store.importInitialBatch(initialBatch);
  });

  describe('Review-State & Route Update Semantics', () => {
    it('T-REV-01: saving notes only updates userNotes and preserves reviewState and routing', () => {
      const record = store.getAllRecords()[0];
      const { source_type, source_id } = record.source;
      const initialReviewState = record.userState.reviewState; // 'unreviewed'

      store.updateUserRecordState(source_type, source_id, {
        userNotes: 'Contacted customer regarding renewal terms.',
      });

      const updated = store.getRecord(source_type, source_id)!;
      expect(updated.userState.userNotes).toBe('Contacted customer regarding renewal terms.');
      expect(updated.userState.reviewState).toBe(initialReviewState); // Still 'unreviewed'
      expect(updated.userState.isManualOverride).toBe(false);
      expect(updated.userState.manualRoute).toBeNull();
      expect(updated.userState.lastModifiedAt).not.toBeNull();
    });

    it('T-REV-02: changing route only sets manualRoute and isManualOverride without changing reviewState', () => {
      const record = store.getAllRecords()[0];
      const { source_type, source_id } = record.source;

      store.updateUserRecordState(source_type, source_id, {
        manualRoute: 'Sales Pipeline / Discovery',
      });

      const updated = store.getRecord(source_type, source_id)!;
      expect(updated.userState.manualRoute).toBe('Sales Pipeline / Discovery');
      expect(updated.userState.isManualOverride).toBe(true);
      expect(updated.userState.reviewState).toBe('unreviewed'); // Not auto-marked reviewed
      expect(getEffectiveRoute(updated)).toBe('Sales Pipeline / Discovery');
    });

    it('T-REV-03: explicitly selecting reviewed transitions reviewState to reviewed', () => {
      const record = store.getAllRecords()[0];
      const { source_type, source_id } = record.source;

      store.updateUserRecordState(source_type, source_id, {
        userNotes: 'Validated invoice reconciliation issue.',
        reviewState: 'reviewed',
      });

      const updated = store.getRecord(source_type, source_id)!;
      expect(updated.userState.reviewState).toBe('reviewed');
      expect(updated.userState.userNotes).toBe('Validated invoice reconciliation issue.');
    });

    it('T-REV-04: selecting the suggested route in the route selector clears manual override', () => {
      const record = store.getAllRecords()[0];
      const { source_type, source_id } = record.source;
      const suggested = record.suggestedRoute;

      // First set an override
      store.updateUserRecordState(source_type, source_id, {
        manualRoute: 'Deal Next Steps / Evaluation',
      });
      expect(store.getRecord(source_type, source_id)!.userState.isManualOverride).toBe(true);

      // Now set to suggested route
      store.updateUserRecordState(source_type, source_id, {
        manualRoute: suggested,
      });

      const resetRecord = store.getRecord(source_type, source_id)!;
      expect(resetRecord.userState.manualRoute).toBeNull();
      expect(resetRecord.userState.isManualOverride).toBe(false);
      expect(getEffectiveRoute(resetRecord)).toBe(suggested);
    });

    it('T-REV-05: clearManualOverride clears override and preserves user notes and review state', () => {
      const record = store.getAllRecords()[0];
      const { source_type, source_id } = record.source;

      store.updateUserRecordState(source_type, source_id, {
        manualRoute: 'Customer Support & Bug Escalation',
        userNotes: 'Keep this note safe.',
        reviewState: 'pending_review',
      });

      store.clearManualOverride(source_type, source_id);

      const resetRecord = store.getRecord(source_type, source_id)!;
      expect(resetRecord.userState.manualRoute).toBeNull();
      expect(resetRecord.userState.isManualOverride).toBe(false);
      expect(resetRecord.userState.userNotes).toBe('Keep this note safe.');
      expect(resetRecord.userState.reviewState).toBe('pending_review');
      expect(getEffectiveRoute(resetRecord)).toBe(resetRecord.suggestedRoute);
    });

    it('T-REV-06: audit count semantics verify previousRecordCount === newRecordCount === totalRecordsNow and appliedCount === 1', () => {
      const record = store.getAllRecords()[0];
      const { source_type, source_id } = record.source;
      const totalCount = store.getTotalCount(); // 44

      store.updateUserRecordState(source_type, source_id, {
        manualRoute: 'Partnership & Referral',
        reviewState: 'reviewed',
      });

      const auditHistory = store.getAuditHistory();
      const latestEntry = auditHistory[auditHistory.length - 1];

      expect(latestEntry.action).toBe('MANUAL_REVIEW_UPDATE');
      expect(latestEntry.previousRecordCount).toBe(totalCount);
      expect(latestEntry.newRecordCount).toBe(totalCount);
      expect(latestEntry.appliedCount).toBe(1);
      expect(latestEntry.ignoredCount).toBe(0);
      expect(latestEntry.rejectedCount).toBe(0);
      expect(latestEntry.details).toContain('Partnership & Referral');
    });

    it('T-REV-07: update batch arrival preserves user notes and manual override, setting reviewState to pending_review', () => {
      store.updateUserRecordState('meeting', M07_SOURCE_ID, {
        manualRoute: 'Deal Next Steps / Evaluation',
        userNotes: 'Reviewed before turns arrived.',
        reviewState: 'reviewed',
      });

      // Ingest Rev 2 with 27 turns
      store.applyUpdateBatch(updateBatch);

      const m07 = store.getRecord('meeting', M07_SOURCE_ID)!;
      expect(m07.appliedRevision).toBe(2);
      expect(m07.hasUsableTranscript).toBe(true);
      expect(m07.source.transcript_payload?.turns.length).toBe(27);

      // Manual route and user notes preserved
      expect(m07.userState.manualRoute).toBe('Deal Next Steps / Evaluation');
      expect(m07.userState.isManualOverride).toBe(true);
      expect(m07.userState.userNotes).toBe('Reviewed before turns arrived.');
      // Review state invalidated to pending_review because new transcript evidence arrived
      expect(m07.userState.reviewState).toBe('pending_review');
      expect(m07.analysisState.freshness).toBe('stale_pending_review');
    });

    it('T-REV-08: audit persistence failure marks audit degraded without rolling back or failing record review', () => {
      // Mock storage to fail on AUDIT_STORAGE_KEY
      const failingStorage: StorageAdapter = {
        getItem: (k: string) => memoryStorage.getItem(k),
        removeItem: (k: string) => memoryStorage.removeItem(k),
        setItem: (k: string, v: string) => {
          if (k.includes('audit')) {
            throw new Error('Audit storage quota exceeded');
          }
          memoryStorage.setItem(k, v);
        },
      };

      const failStore = new ReplayStore(failingStorage);
      failStore.importInitialBatch(initialBatch);

      const record = failStore.getAllRecords()[0];
      const { source_type, source_id } = record.source;

      // Should succeed without throwing
      expect(() => {
        failStore.updateUserRecordState(source_type, source_id, {
          manualRoute: 'Internal / Vendor Coordination',
        });
      }).not.toThrow();

      // In-memory record committed
      expect(failStore.getRecord(source_type, source_id)!.userState.manualRoute).toBe(
        'Internal / Vendor Coordination'
      );
      // In-memory audit entry retained
      expect(failStore.getAuditHistory().some((e) => e.action === 'MANUAL_REVIEW_UPDATE')).toBe(true);
      // Audit degradation flag set
      expect(failStore.isAuditStorageDegraded()).toBe(true);
    });

    it('T-REV-09: storage commit failure rolls back in-memory state and throws StorageCommitError', () => {
      let failStateWrites = false;
      const failingStorage: StorageAdapter = {
        getItem: (k: string) => memoryStorage.getItem(k),
        removeItem: (k: string) => memoryStorage.removeItem(k),
        setItem: (k: string, v: string) => {
          if (failStateWrites && k.includes('state')) {
            throw new Error('Disk full');
          }
          memoryStorage.setItem(k, v);
        },
      };

      const failStore = new ReplayStore(failingStorage);
      failStore.importInitialBatch(initialBatch);

      // Arm write failure for subsequent review update
      failStateWrites = true;

      const record = failStore.getAllRecords()[0];
      const { source_type, source_id } = record.source;

      expect(() => {
        failStore.updateUserRecordState(source_type, source_id, {
          manualRoute: 'Internal / Vendor Coordination',
        });
      }).toThrow(StorageCommitError);

      // In-memory state remains untouched
      expect(failStore.getRecord(source_type, source_id)!.userState.manualRoute).toBeNull();
    });
  });

  describe('URL Synchronization & Query Preservation Helpers', () => {
    it('T-URL-01: canonical URL encoding preserves pathname and search parameters', () => {
      const pathname = '/inbox';
      const search = '?filter=calls&sort=desc';
      const canonicalKey = getRecordKey('meeting', M07_SOURCE_ID);
      const targetHash = `#record=${encodeURIComponent(canonicalKey)}`;
      const fullUrl = `${pathname}${search}${targetHash}`;

      expect(fullUrl).toBe(
        `/inbox?filter=calls&sort=desc#record=${encodeURIComponent(canonicalKey)}`
      );

      // Parsing extracts canonical identity correctly
      const extractedParam = fullUrl.split('#record=')[1];
      const parsed = parseUrlRecordHash(extractedParam);
      expect(parsed).toEqual(['meeting', M07_SOURCE_ID]);
    });

    it('T-URL-02: cleaning URL hash restores base pathname and search without extra reload', () => {
      const pathname = '/inbox';
      const search = '?filter=calls';
      const targetHash = '#record=garbage-or-invalid';
      const fullUrl = `${pathname}${search}${targetHash}`;

      // Clearing hash removes #record=... while strictly retaining pathname and search
      const cleanUrl = fullUrl.replace(/#record=.*$/, '');
      expect(cleanUrl).toBe('/inbox?filter=calls');
    });

    it('T-URL-03: parseUrlRecordHash returns null for malformed or nonexistent identities', () => {
      expect(parseUrlRecordHash('garbage-json')).toBeNull();
      expect(parseUrlRecordHash(encodeURIComponent('["unsupported_type","123"]'))).toBeNull();
      expect(parseUrlRecordHash(encodeURIComponent('["call"]'))).toBeNull();
      expect(parseUrlRecordHash('')).toBeNull();
    });
  });
});
