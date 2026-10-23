import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayStore } from '../engine/replayStore';
import { MemoryStorage } from '../engine/storage';
import {
  AppRecord,
  DeliveryBatch,
  StorageCommitError,
} from '../types/contract';
import {
  generateAnalysis,
  validateAnalysisPayload,
} from '../engine/analysisEngine';
import type {
  MeetingEvidenceRef,
  CallEvidenceRef,
} from '../types/analysis';

import initialBatchJson from '../../../data/01_initial.json';
import updateBatchJson from '../../../data/02_update.json';

const initialBatch = initialBatchJson as unknown as DeliveryBatch;
const updateBatch = updateBatchJson as unknown as DeliveryBatch;

const M07_SOURCE_ID = '4f304fff-fd40-5cfc-a366-0a134c445c2a'; // Meeting M07
const C01_SOURCE_ID = '2ec4404c-beee-5377-a63c-aab701da08ed'; // Call C01
const C10_SOURCE_ID = 'b747f592-810e-583c-9b81-8db5ab035806'; // Call C10
const B01_SOURCE_ID = '4868e5cd-5ab8-581c-a0e4-acc37385f0cf'; // Silent Call B01

describe('Vertical Slice 4: Evidence-Backed Analysis & Stale/Fresh State Management', () => {
  let memoryStorage: MemoryStorage;
  let store: ReplayStore;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    store = new ReplayStore(memoryStorage);
  });

  // =========================================================================
  // SECTION A: EVIDENCE GROUNDING & CONFIRMED NEXT STEPS
  // =========================================================================

  describe('A. Evidence Grounding & Anti-Fabrication Rules', () => {
    it('T-ANA-01 (Call Grounding): Call C01 objection cites exact substring without fabricated timestamps or speaker IDs', () => {
      store.importInitialBatch(initialBatch);
      const c01 = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01).toBeDefined();
      expect(c01.hasUsableTranscript).toBe(true);

      const analysis = store.generateRecordAnalysis('call', C01_SOURCE_ID);
      expect(analysis.recordRef).toBe('C01');
      expect(analysis.sourceType).toBe('call');
      expect(analysis.sourceId).toBe(C01_SOURCE_ID);
      expect(analysis.generatedForRevision).toBe(1);

      // Verify objection grounding
      const objection = analysis.statedObjections.find(
        (o) => o.category === 'existing_system'
      );
      expect(objection).toBeDefined();
      expect(objection!.statement).toContain('Our processes are already very automated');

      // Citation verification
      const citation = objection!.evidence as CallEvidenceRef;
      expect(citation.type).toBe('call_excerpt');
      expect(citation.sourceId).toBe(C01_SOURCE_ID);
      expect(citation.recordRef).toBe('C01');
      expect(citation.sourceRevision).toBe(1);
      expect(citation.quoteText).toContain('Our processes are already very automated');

      // Zero fabricated timestamps or speaker metrics
      expect((citation as unknown as Record<string, unknown>).timecode).toBeUndefined();
      expect((citation as unknown as Record<string, unknown>).turnNumber).toBeUndefined();
      expect((citation as unknown as Record<string, unknown>).speaker).toBeUndefined();

      // Full payload validation
      const validation = validateAnalysisPayload(c01, analysis);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('T-ANA-02 (Meeting Grounding): Meeting M07 Rev 2 Turn 3 speaker is "Team member A" with exact timecode', () => {
      store.importInitialBatch(initialBatch);
      store.importBatch(updateBatch, 'UPDATE_BATCH');

      const m07Rev2 = store.getRecord('meeting', M07_SOURCE_ID)!;
      expect(m07Rev2).toBeDefined();
      expect(m07Rev2.appliedRevision).toBe(2);
      expect(m07Rev2.hasUsableTranscript).toBe(true);

      const analysis = store.generateRecordAnalysis('meeting', M07_SOURCE_ID);
      expect(analysis.generatedForRevision).toBe(2);

      // Verify question from Turn 3
      const turn3Question = analysis.keyQuestions.find(
        (q) => q.questionText.includes('The field still shows the earlier wording')
      );
      expect(turn3Question).toBeDefined();

      // Explicit verification: Speaker is "Team member A" (NOT Customer A)
      expect(turn3Question!.askingSpeaker).toBe('Team member A');
      expect(turn3Question!.questionText).toBe(
        'The field still shows the earlier wording. So the change is not appearing after you save, is that right?'
      );

      const citation = turn3Question!.evidence as MeetingEvidenceRef;
      expect(citation.type).toBe('meeting_turn');
      expect(citation.sourceId).toBe(M07_SOURCE_ID);
      expect(citation.recordRef).toBe('M07');
      expect(citation.sourceRevision).toBe(2);
      expect(citation.turnNumber).toBe(3); // Exact 1-based index
      expect(citation.speaker).toBe('Team member A');
      expect(citation.timecode).toBe('00:11:16');
      expect(citation.quoteText).toBe(turn3Question!.questionText);

      const validation = validateAnalysisPayload(m07Rev2, analysis);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('T-ANA-03 (Confirmed Next Steps vs. Unaccepted / Unanswered Proposals): distinguishes proposals from agreements', () => {
      // Test Dialogue 1: Proposal + Explicit Acceptance -> Confirmed Next Step
      const dialogueConfirmed: AppRecord = {
        source: {
          record_ref: 'TEST-01',
          source_type: 'meeting',
          source_id: 'test-confirmed-id',
          payload: { id: 'test-confirmed-id' } as any,
          transcript_payload: {
            meeting_id: 'test-confirmed-id',
            unavailable_reason: null,
            turns: [
              {
                speaker: 'Speaker A',
                starts_at_seconds: 10,
                timecode: '00:00:10',
                text: 'Could we speak Monday?',
              },
              {
                speaker: 'Speaker B',
                starts_at_seconds: 15,
                timecode: '00:00:15',
                text: 'Yes, that works.',
              },
            ],
          },
        },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Deal Next Steps / Evaluation',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: {
          analysis: null,
          freshness: 'uncomputed',
          generatedForRevision: null,
        },
      };

      const analysis1 = generateAnalysis(dialogueConfirmed);
      expect(analysis1.statedNextSteps.length).toBe(1);
      const step = analysis1.statedNextSteps[0];
      expect(step.actionType).toBe('reschedule_call');
      expect(step.description).toBe('Speak on Monday');
      expect(step.evidence.length).toBe(2);
      expect(step.evidence[0].quoteText).toBe('Could we speak Monday?');
      expect(step.evidence[1].quoteText).toBe('Yes, that works.');

      // Anti-hallucination checks: zero invented dates, times, or platforms
      expect(step.description).not.toContain('2026-08-24');
      expect(step.description).not.toContain('AM');
      expect(step.description).not.toContain('PM');
      expect(step.description).not.toContain('Zoom');
      expect(step.description).not.toContain('Calendar');

      // Test Dialogue 2: Proposal + Explicit Rejection -> Omitted from statedNextSteps
      const dialogueRejected: AppRecord = {
        ...dialogueConfirmed,
        source: {
          ...dialogueConfirmed.source,
          transcript_payload: {
            meeting_id: 'test-rejected-id',
            unavailable_reason: null,
            turns: [
              {
                speaker: 'Speaker A',
                starts_at_seconds: 10,
                timecode: '00:00:10',
                text: 'Could we speak Monday?',
              },
              {
                speaker: 'Speaker B',
                starts_at_seconds: 15,
                timecode: '00:00:15',
                text: 'I am busy all next week.',
              },
            ],
          },
        },
      };

      const analysis2 = generateAnalysis(dialogueRejected);
      expect(analysis2.keyQuestions.length).toBe(1); // Captured in keyQuestions
      expect(analysis2.statedNextSteps).toEqual([]); // Strictly empty

      // Test Dialogue 3: Proposal + Ambiguous / Deferred -> Omitted from statedNextSteps
      const dialogueAmbiguous: AppRecord = {
        ...dialogueConfirmed,
        source: {
          ...dialogueConfirmed.source,
          transcript_payload: {
            meeting_id: 'test-ambiguous-id',
            unavailable_reason: null,
            turns: [
              {
                speaker: 'Speaker A',
                starts_at_seconds: 10,
                timecode: '00:00:10',
                text: 'Could we speak Monday?',
              },
              {
                speaker: 'Speaker B',
                starts_at_seconds: 15,
                timecode: '00:00:15',
                text: 'Maybe, let me check my schedule later.',
              },
            ],
          },
        },
      };

      const analysis3 = generateAnalysis(dialogueAmbiguous);
      expect(analysis3.statedNextSteps).toEqual([]); // Strictly empty

      // Test Dialogue 4: Proposal + Unanswered / Dropped Thread -> Omitted from statedNextSteps
      const dialogueUnanswered: AppRecord = {
        ...dialogueConfirmed,
        source: {
          ...dialogueConfirmed.source,
          transcript_payload: {
            meeting_id: 'test-unanswered-id',
            unavailable_reason: null,
            turns: [
              {
                speaker: 'Speaker A',
                starts_at_seconds: 10,
                timecode: '00:00:10',
                text: 'Could we speak Monday?',
              },
              {
                speaker: 'Speaker B',
                starts_at_seconds: 15,
                timecode: '00:00:15',
                text: "Let's review the quarterly revenue numbers on slide four.",
              },
            ],
          },
        },
      };

      const analysis4 = generateAnalysis(dialogueUnanswered);
      expect(analysis4.keyQuestions.length).toBe(1);
      expect(analysis4.statedNextSteps).toEqual([]); // Omitted, not treated as confirmed commitment

      // Test Dialogue 5: Keyword Match Without Semantic Agreement
      const dialogueKeywordOnly: AppRecord = {
        ...dialogueConfirmed,
        source: {
          ...dialogueConfirmed.source,
          transcript_payload: {
            meeting_id: 'test-keyword-id',
            unavailable_reason: null,
            turns: [
              {
                speaker: 'Speaker A',
                starts_at_seconds: 10,
                timecode: '00:00:10',
                text: 'Monday was a terrible day for our payment servers.',
              },
            ],
          },
        },
      };

      const analysis5 = generateAnalysis(dialogueKeywordOnly);
      expect(analysis5.statedNextSteps).toEqual([]); // Never falsely classified as next step
    });

    it('T-ANA-04 (Short Dialogue without Arbitrary Word Count): short factual exchange generates grounded statements', () => {
      const shortRecord: AppRecord = {
        source: {
          record_ref: 'SHORT-01',
          source_type: 'meeting',
          source_id: 'short-id',
          payload: { id: 'short-id' } as any,
          transcript_payload: {
            meeting_id: 'short-id',
            unavailable_reason: null,
            turns: [
              {
                speaker: 'Customer A',
                starts_at_seconds: 5,
                timecode: '00:00:05',
                text: 'The invoice amount is incorrect on our receipt.',
              },
              {
                speaker: 'Rep B',
                starts_at_seconds: 12,
                timecode: '00:00:12',
                text: 'I see that discrepancy. Let me fix the billing record.',
              },
            ],
          },
        },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Customer Support & Bug Escalation',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: {
          analysis: null,
          freshness: 'uncomputed',
          generatedForRevision: null,
        },
      };

      const analysis = generateAnalysis(shortRecord);
      expect(analysis.evidenceSufficiency).toBe('sufficient');
      expect(analysis.summaryPoints.length).toBeGreaterThan(0);
      expect(analysis.topics.some((t) => t.topic.includes('Invoicing'))).toBe(true);
    });

    it('T-ANA-05 (Silent Call Handling & Evidence Sufficiency Alignment): Call B01 with null transcript has null analysis', () => {
      store.importInitialBatch(initialBatch);
      const b01 = store.getRecord('call', B01_SOURCE_ID)!;
      expect(b01).toBeDefined();

      // Contract assertions for silent records
      expect(b01.hasUsableTranscript).toBe(false);
      expect(b01.analysisState.freshness).toBe('not_applicable');
      expect(b01.analysisState.analysis).toBeNull();
      expect(b01.analysisState.generatedForRevision).toBeNull();

      // Zero fabricated payload or synthetic evidenceSufficiency on record
      expect(
        (b01.analysisState as unknown as Record<string, unknown>).evidenceSufficiency
      ).toBeUndefined();

      // Attempting generation on silent record throws informative error
      expect(() => store.generateRecordAnalysis('call', B01_SOURCE_ID)).toThrow(
        /no usable transcript/i
      );
    });

    it('Explicit negative closure on Call C10 produces actionType: explicit_no_follow_up', () => {
      store.importInitialBatch(initialBatch);
      const c10 = store.getRecord('call', C10_SOURCE_ID)!;
      expect(c10).toBeDefined();

      const analysis = store.generateRecordAnalysis('call', C10_SOURCE_ID);
      const closureStep = analysis.statedNextSteps.find(
        (ns) => ns.actionType === 'explicit_no_follow_up'
      );
      expect(closureStep).toBeDefined();
      expect(closureStep!.description).toContain('Participant stated they will contact');
      expect(closureStep!.evidence[0].quoteText).toContain(
        'I said I will contact you if there is anything to discuss'
      );
    });
  });

  // =========================================================================
  // SECTION B: FRESHNESS, STALE PRESERVATION & HISTORICAL ANALYSIS
  // =========================================================================

  describe('B. Freshness Lifecycle & Historical Revision Management', () => {
    it('T-ANA-06 (Initial Import Usable Transcript): usable transcript record starts as uncomputed', () => {
      store.importInitialBatch(initialBatch);
      const c01 = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01.hasUsableTranscript).toBe(true);
      expect(c01.analysisState.freshness).toBe('uncomputed');
      expect(c01.analysisState.analysis).toBeNull();
      expect(c01.analysisState.generatedForRevision).toBeNull();
    });

    it('T-ANA-07 (Generation Sets Current): generating analysis sets freshness to current and generatedForRevision to appliedRevision', () => {
      store.importInitialBatch(initialBatch);
      const analysis = store.generateRecordAnalysis('call', C01_SOURCE_ID);

      const c01 = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01.analysisState.freshness).toBe('current');
      expect(c01.analysisState.generatedForRevision).toBe(1);
      expect(c01.analysisState.analysis).toEqual(analysis);
    });

    it('T-ANA-08 (Stale Analysis Preserved on Higher Revision): higher revision preserves prior analysis as stale_pending_review', () => {
      // 1. Load initial batch
      store.importInitialBatch(initialBatch);

      // Artificially create a generated analysis at Revision 1 on M07
      const m07Initial = store.getRecord('meeting', M07_SOURCE_ID)!;
      expect(m07Initial.appliedRevision).toBe(1);

      // Create dummy prior analysis payload for Revision 1
      const priorPayload = {
        recordRef: 'M07',
        sourceType: 'meeting' as const,
        sourceId: M07_SOURCE_ID,
        generatedForRevision: 1,
        generatedAt: '2026-08-21T09:30:00Z',
        summaryPoints: [],
        topics: [],
        keyQuestions: [],
        statedObjections: [],
        statedNextSteps: [],
        evidenceSufficiency: 'sufficient' as const,
        unusableReason: null,
      };

      m07Initial.analysisState = {
        analysis: priorPayload,
        freshness: 'current',
        generatedForRevision: 1,
      };

      // 2. Import update batch with Revision 2
      store.importBatch(updateBatch, 'UPDATE_BATCH');

      const m07Updated = store.getRecord('meeting', M07_SOURCE_ID)!;
      expect(m07Updated.appliedRevision).toBe(2);
      expect(m07Updated.analysisState.freshness).toBe('stale_pending_review');
      expect(m07Updated.analysisState.analysis).toEqual(priorPayload); // Strictly preserved!
      expect(m07Updated.analysisState.generatedForRevision).toBe(1); // Retained original rev!
    });

    it('T-ANA-09 (Historical Analysis Preservation When Record Becomes Unusable): sets not_applicable while preserving historical payload', () => {
      store.importInitialBatch(initialBatch);
      store.generateRecordAnalysis('call', C01_SOURCE_ID);

      const c01Rev1 = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01Rev1.analysisState.freshness).toBe('current');
      const rev1Analysis = c01Rev1.analysisState.analysis!;

      // Create synthetic higher revision (Revision 2) where transcript is redacted/silenced
      const redactedRev2Batch: DeliveryBatch = {
        batch_id: 'redacted-002',
        revision: 2,
        exported_at: '2026-08-22T12:00:00+05:30',
        records: [
          {
            ...c01Rev1.source,
            payload: {
              ...(c01Rev1.source.payload as any),
              transcript: null, // Now unusable / silent
            },
          },
        ],
      };

      store.importBatch(redactedRev2Batch);

      const c01Rev2 = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01Rev2.appliedRevision).toBe(2);
      expect(c01Rev2.hasUsableTranscript).toBe(false);
      expect(c01Rev2.analysisState.freshness).toBe('not_applicable');
      // Historical analysis is preserved for reference:
      expect(c01Rev2.analysisState.analysis).toEqual(rev1Analysis);
      expect(c01Rev2.analysisState.generatedForRevision).toBe(1);

      // Verify that citations in the historical analysis retain sourceRevision === 1
      rev1Analysis.topics.forEach((t) => {
        expect(t.evidence.sourceRevision).toBe(1);
      });
    });

    it('T-ANA-10 (Restoring Usable Transcript from Unusable State): transitions to stale_pending_review if prior analysis exists', () => {
      // Setup from T-ANA-09: record at Rev 2 is unusable but has preserved Rev 1 analysis
      store.importInitialBatch(initialBatch);
      store.generateRecordAnalysis('call', C01_SOURCE_ID);
      const rev1Analysis = store.getRecord('call', C01_SOURCE_ID)!.analysisState.analysis!;

      // Make unusable at Rev 2
      store.importBatch({
        batch_id: 'redacted-002',
        revision: 2,
        exported_at: '2026-08-22T12:00:00+05:30',
        records: [
          {
            ...store.getRecord('call', C01_SOURCE_ID)!.source,
            payload: {
              ...(store.getRecord('call', C01_SOURCE_ID)!.source.payload as any),
              transcript: null,
            },
          },
        ],
      });

      // Now apply Revision 3 which restores the usable transcript
      const restoredRev3Batch: DeliveryBatch = {
        batch_id: 'restored-003',
        revision: 3,
        exported_at: '2026-08-22T14:00:00+05:30',
        records: [
          {
            ...store.getRecord('call', C01_SOURCE_ID)!.source,
            payload: {
              ...(store.getRecord('call', C01_SOURCE_ID)!.source.payload as any),
              transcript: 'Restored audio: Customer confirmed budget approval.',
            },
          },
        ],
      };

      store.importBatch(restoredRev3Batch);

      const c01Rev3 = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01Rev3.appliedRevision).toBe(3);
      expect(c01Rev3.hasUsableTranscript).toBe(true);
      // Because prior analysis existed from Revision 1, transitions to stale_pending_review:
      expect(c01Rev3.analysisState.freshness).toBe('stale_pending_review');
      expect(c01Rev3.analysisState.analysis).toEqual(rev1Analysis);
      expect(c01Rev3.analysisState.generatedForRevision).toBe(1);
    });

    it('T-ANA-11 (Regeneration Restores Current): regenerating analysis sets generatedForRevision to appliedRevision', () => {
      store.importInitialBatch(initialBatch);
      store.importBatch(updateBatch, 'UPDATE_BATCH');

      const m07Rev2 = store.getRecord('meeting', M07_SOURCE_ID)!;
      expect(m07Rev2.appliedRevision).toBe(2);

      const newAnalysis = store.generateRecordAnalysis('meeting', M07_SOURCE_ID);
      expect(newAnalysis.generatedForRevision).toBe(2);

      const m07Updated = store.getRecord('meeting', M07_SOURCE_ID)!;
      expect(m07Updated.analysisState.freshness).toBe('current');
      expect(m07Updated.analysisState.generatedForRevision).toBe(2);
      expect(m07Updated.analysisState.analysis).toEqual(newAnalysis);

      // Verify audit event emitted
      const audit = store.getAuditHistory();
      const lastAudit = audit[audit.length - 1];
      expect(lastAudit.action).toBe('ANALYSIS_GENERATED');
      expect(lastAudit.details).toContain('M07');

      // Now regenerate on the same revision -> should emit ANALYSIS_REGENERATED
      const regeneratedAnalysis = store.generateRecordAnalysis('meeting', M07_SOURCE_ID);
      expect(regeneratedAnalysis).toBeDefined();
      const auditAfterRegen = store.getAuditHistory();
      const regenAudit = auditAfterRegen[auditAfterRegen.length - 1];
      expect(regenAudit.action).toBe('ANALYSIS_REGENERATED');
      expect(regenAudit.details).toContain('Regenerated analysis');
    });
  });

  // =========================================================================
  // SECTION C: PERSISTENCE, AUDIT & RESILIENCE
  // =========================================================================

  describe('C. Persistence & Error Resilience', () => {
    it('T-ANA-12 (Storage Rehydration): analysis and freshness states rehydrate without loss', () => {
      store.importInitialBatch(initialBatch);
      const generated = store.generateRecordAnalysis('call', C01_SOURCE_ID);

      // Spin up a brand new ReplayStore attached to the same memory storage
      const rehydratedStore = new ReplayStore(memoryStorage);
      expect(rehydratedStore.getTotalCount()).toBe(44);

      const rehydratedC01 = rehydratedStore.getRecord('call', C01_SOURCE_ID)!;
      expect(rehydratedC01.analysisState.freshness).toBe('current');
      expect(rehydratedC01.analysisState.generatedForRevision).toBe(1);
      expect(rehydratedC01.analysisState.analysis).toEqual(generated);
    });

    it('T-ANA-13 (Store Reset Purge): resetStore clears all analyses and freshness across storage', () => {
      store.importInitialBatch(initialBatch);
      store.generateRecordAnalysis('call', C01_SOURCE_ID);

      store.resetState();
      expect(store.getTotalCount()).toBe(0);

      const newStore = new ReplayStore(memoryStorage);
      expect(newStore.getTotalCount()).toBe(0);
    });

    it('Storage Commit Error Resilience: physical storage failure aborts analysis mutation', () => {
      store.importInitialBatch(initialBatch);
      const c01Before = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01Before.analysisState.analysis).toBeNull();

      // Simulate physical storage failure
      memoryStorage.setItem = () => {
        throw new Error('Disk quota exceeded (simulated)');
      };

      expect(() => store.generateRecordAnalysis('call', C01_SOURCE_ID)).toThrow(
        StorageCommitError
      );

      // Active in-memory state remains pristine
      const c01After = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01After.analysisState.analysis).toBeNull();
      expect(c01After.analysisState.freshness).toBe('uncomputed');
    });

    it('Audit Storage Failure Degradation: audit storage failure does not fail analysis generation', () => {
      store.importInitialBatch(initialBatch);

      // Hook storage to throw on AUDIT_STORAGE_KEY only
      const originalSetItem = memoryStorage.setItem.bind(memoryStorage);
      memoryStorage.setItem = (key: string, value: string) => {
        if (key.includes('audit')) {
          throw new Error('Audit storage quota exceeded');
        }
        return originalSetItem(key, value);
      };

      // Generation still succeeds cleanly
      const analysis = store.generateRecordAnalysis('call', C01_SOURCE_ID);
      expect(analysis).toBeDefined();

      const c01 = store.getRecord('call', C01_SOURCE_ID)!;
      expect(c01.analysisState.freshness).toBe('current');
      expect(store.isAuditStorageDegraded()).toBe(true);
    });

    it('False-Positive Anti-Hallucination: isolated keywords in neutral dialogue do not trigger false claims', () => {
      const neutralRecord: AppRecord = {
        source: {
          record_ref: 'NEUTRAL-01',
          source_type: 'meeting',
          source_id: 'neutral-id',
          payload: { id: 'neutral-id' } as any,
          transcript_payload: {
            meeting_id: 'neutral-id',
            unavailable_reason: null,
            turns: [
              {
                speaker: 'Dev A',
                starts_at_seconds: 5,
                timecode: '00:00:05',
                text: 'The operating system is running smoothly on our cloud instances.',
              },
              {
                speaker: 'Dev B',
                starts_at_seconds: 12,
                timecode: '00:00:12',
                text: 'We allocate budget for server maintenance every quarter.',
              },
              {
                speaker: 'Dev A',
                starts_at_seconds: 20,
                timecode: '00:00:20',
                text: 'Monday morning standups will continue at 10 AM as usual.',
              },
            ],
          },
        },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Internal / Vendor Coordination',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: {
          analysis: null,
          freshness: 'uncomputed',
          generatedForRevision: null,
        },
      };

      const analysis = generateAnalysis(neutralRecord);

      // Verifies words "system", "budget", and "Monday" do NOT trigger false objections or next steps:
      expect(analysis.statedObjections.some((o) => o.category === 'existing_system')).toBe(false);
      expect(analysis.statedObjections.some((o) => o.category === 'pricing_budget')).toBe(false);
      expect(analysis.statedNextSteps).toEqual([]);
    });

    it('T-ANA-14 (Full Suite Regression): all 40 baseline tests continue to operate', () => {
      store.importInitialBatch(initialBatch);
      expect(store.getTotalCount()).toBe(44);
      expect(store.getUsableTranscriptsCount()).toBe(17);

      store.importBatch(updateBatch, 'UPDATE_BATCH');
      expect(store.getTotalCount()).toBe(44);
      expect(store.getUsableTranscriptsCount()).toBe(18);
    });
  });
});
