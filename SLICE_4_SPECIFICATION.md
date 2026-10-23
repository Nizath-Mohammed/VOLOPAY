# Vertical Slice 4: Specification
## Evidence-Backed Analysis & Stale/Fresh State Management

**Operating Mode: SPECIFICATION ONLY — NO APPLICATION CODE OR TESTS MODIFIED.**  
**Status: Awaiting User Review & Approval.**

---

## 1. Inspection of Existing Architecture and Integration Points

We inspected the actual implementation across the project:
- **Authoritative Data & Contract Files**:
  - `candidate/DATA_CONTRACT.md` (envelope schema, revision replacement, evidence reference rules).
  - `candidate/DATA_DICTIONARY.md` (glossary, payload types, safe calculations).
  - `candidate/data/01_initial.json` (44 records, 17 usable transcripts, revision 1).
  - `candidate/data/02_update.json` (Meeting M07, 27 turns, revision 2).
- **Core Types Contract (`candidate/app/src/types/contract.ts`)**:
  - `AppRecord`: binds `source`, `appliedRevision`, `hasUsableTranscript`, `suggestedRoute`, `userState`, and `analysisState`.
  - `AnalysisRecordState`: defines `analysis: RecordAnalysisPayload | null`, `freshness: AnalysisFreshness`, and `generatedForRevision: number | null`.
- **Replay State Machine (`candidate/app/src/engine/replayStore.ts`)**:
  - Handles revision ingestion. In Slice 4, when a higher revision arrives, any existing analysis payload is preserved rather than discarded, revision tracking is maintained, and freshness transitions deterministically across all four lifecycle states.

---

## 2. The Four Freshness States & Lifecycle Rules

The `AnalysisFreshness` type in `src/types/contract.ts` is formally defined with four mutually exclusive states:

```typescript
export type AnalysisFreshness =
  | 'not_applicable'
  | 'uncomputed'
  | 'current'
  | 'stale_pending_review';

export interface AnalysisRecordState {
  analysis: RecordAnalysisPayload | null;
  freshness: AnalysisFreshness;
  generatedForRevision: number | null;
}
```

### 2.1. State Definitions and Invariants

| State | Condition | `analysis` Payload | UI Representation |
| :--- | :--- | :--- | :--- |
| **`not_applicable`** | Current record has no usable transcript (`hasUsableTranscript === false`). | Either `null`, or holds a preserved historical analysis from a prior revision (`generatedForRevision < record.appliedRevision`). | **Current Revision:** Gray badge `[No Usable Audio / Transcript Unavailable]`. Message: *"Analysis unavailable because usable evidence is missing in Revision {currentRev}."*<br><br>**Historical Analysis (if present):** Optional, explicitly labelled view `[▶ View Historical Analysis from Revision {generatedForRevision}]` with prominent warning that it belongs to an older revision and does not describe the current record. If no prior analysis exists, show only the unavailable state; do not fabricate a historical result. |
| **`uncomputed`** | Current record has usable transcript (`hasUsableTranscript === true`), but no analysis has been generated yet for this record. | `null`. | Blue/cyan badge: `[Analysis Ready]`. Button: `[Generate Analysis for Revision {currentRev}]`. |
| **`current`** | Analysis exists AND `analysis.generatedForRevision === record.appliedRevision`. | Active `RecordAnalysisPayload`. | Green badge: `[Fresh • Revision N]`. Full display of evidence-grounded cards and interactive citation links. |
| **`stale_pending_review`** | Analysis exists AND `record.appliedRevision > analysis.generatedForRevision` AND `hasUsableTranscript === true`. | Preserved prior `RecordAnalysisPayload`. | Amber alert banner: `[⚠️ Stale Analysis • Generated for Rev {generatedRev} • Current Record is Rev {appliedRev}]`. Button: `[Regenerate Analysis for Revision {appliedRev}]`. Old analysis viewable with stale watermark; never presented as current. |

---

## 3. Revision Handling & Historical Analysis Preservation

### 3.1. Exact State Transition Matrix in `ReplayStore.executeBatchImport()`

```
Existing State                          Incoming Revision Ingestion                 Resulting Record State
--------------------------------------------------------------------------------------------------------------------------------------
hasUsableTranscript: false              Higher revision has NO usable transcript    hasUsableTranscript: false
analysis: null                                                                      analysis: null
freshness: 'not_applicable'                                                         freshness: 'not_applicable'
                                                                                    generatedForRevision: null
--------------------------------------------------------------------------------------------------------------------------------------
hasUsableTranscript: false              Higher revision HAS usable transcript       hasUsableTranscript: true
analysis: null                          (e.g., M07 Rev 2 without prior analysis)   analysis: null
freshness: 'not_applicable'                                                         freshness: 'uncomputed'
                                                                                    generatedForRevision: null
--------------------------------------------------------------------------------------------------------------------------------------
hasUsableTranscript: true               Higher revision HAS usable transcript       hasUsableTranscript: true
analysis: null                          (Updated turns, but never analyzed)        analysis: null
freshness: 'uncomputed'                                                             freshness: 'uncomputed'
                                                                                    generatedForRevision: null
--------------------------------------------------------------------------------------------------------------------------------------
hasUsableTranscript: true               Higher revision HAS usable transcript       hasUsableTranscript: true
analysis: Payload (Rev 1)               (e.g., M07 Rev 2 with prior Rev 1 analysis) analysis: Payload (Rev 1) [PRESERVED]
freshness: 'current'                                                                generatedForRevision: 1 [RETAINED]
                                                                                    freshness: 'stale_pending_review'
--------------------------------------------------------------------------------------------------------------------------------------
hasUsableTranscript: true               Higher revision has NO usable transcript    hasUsableTranscript: false
analysis: Payload (Rev 1)               (e.g., record became redacted/cancelled)    analysis: Payload (Rev 1) [PRESERVED AS HISTORICAL]
freshness: 'current'                                                                generatedForRevision: 1 [RETAINED]
                                                                                    freshness: 'not_applicable'
--------------------------------------------------------------------------------------------------------------------------------------
hasUsableTranscript: false              Subsequent revision HAS usable transcript   hasUsableTranscript: true
analysis: Payload (Rev 1)               (Record restores transcript evidence)       analysis: Payload (Rev 1) [PRESERVED]
freshness: 'not_applicable'                                                         generatedForRevision: 1 [RETAINED]
                                                                                    freshness: 'stale_pending_review'
--------------------------------------------------------------------------------------------------------------------------------------
hasUsableTranscript: false              Subsequent revision HAS usable transcript   hasUsableTranscript: true
analysis: null                          (Record gains transcript evidence,          analysis: null
freshness: 'not_applicable'              no prior analysis exists)                  generatedForRevision: null
                                                                                    freshness: 'uncomputed'
--------------------------------------------------------------------------------------------------------------------------------------
Any state with usable transcript        User clicks "Generate / Regenerate"         hasUsableTranscript: true
                                                                                    analysis: Payload (Current Rev)
                                                                                    generatedForRevision: Current Rev
                                                                                    freshness: 'current'
```

### 3.2. Historical Analysis UI Specification (When a Record Becomes Unusable)

When a record's current revision has `hasUsableTranscript === false`, the Derived Analysis tab strictly isolates current revision status from superseded historical data:

1. **Current Revision Status (Always Prominent)**:
   - Primary state banner:
     > **Analysis Unavailable for Current Revision**  
     > *This record has no usable audio or transcript evidence in Revision {currentRev}. Analysis cannot be performed.*
   - Freshness badge: `not_applicable` (`[Transcript Unavailable]`).
   - Regeneration is disabled/prohibited because no usable evidence exists for the current revision.
2. **Historical Analysis Reference View (Optional & Explicitly Labelled)**:
   - If an analysis payload exists from an earlier revision (`generatedForRevision < record.appliedRevision`), it is rendered in an optional, collapsed container:
     `[▶ View Historical Analysis from Revision {generatedForRevision}]`
   - When opened, the view is framed by an indelible warning banner:
     > ⚠️ **Historical Reference Only — Generated for Revision {generatedForRevision}**  
     > *This analysis reflects superseded evidence from Revision {generatedForRevision}. It does NOT describe current Revision {currentRev}, which has no usable transcript evidence.*
   - The original `generatedForRevision` is explicitly displayed on all historical summary cards and citations.
   - It is never presented as if it describes the current revision.
3. **Absence of Historical Analysis**:
   - If no prior analysis exists (`analysis === null`), only the unavailable state is shown. No synthetic or placeholder historical result is ever fabricated.
4. **Restoration of Usable Evidence in Later Revisions**:
   - If a subsequent revision restores a usable transcript (`hasUsableTranscript === true`):
     - If prior analysis was preserved: transitions to `stale_pending_review` with an option to `[Regenerate Analysis for Revision {currentRev}]`.
     - If no prior analysis existed: transitions to `uncomputed` with an option to `[Generate Analysis for Revision {currentRev}]`.
     - Analysis generation remains strictly on-demand.

---

## 4. Proposed Data Model (`src/types/analysis.ts`)

```typescript
export type EvidenceSourceType = 'meeting_turn' | 'call_excerpt';

export interface MeetingEvidenceRef {
  type: 'meeting_turn';
  sourceId: string;
  recordRef: string;
  sourceRevision: number; // Delivery revision that supplied this turn at generation time
  turnNumber: number;     // Exact 1-based index in source transcript_payload.turns
  speaker: string;        // Verbatim speaker string from turn (e.g., "Team member A")
  timecode: string;       // Display timecode from turn (e.g., "00:11:16")
  quoteText: string;      // Verbatim turn sentence or phrase
}

export interface CallEvidenceRef {
  type: 'call_excerpt';
  sourceId: string;
  recordRef: string;
  sourceRevision: number; // Delivery revision that supplied this transcript at generation time
  quoteText: string;      // Exact verbatim substring match from CallPayload.transcript
}

export type EvidenceRef = MeetingEvidenceRef | CallEvidenceRef;

// Evidence sufficiency for generated analyses:
// 'sufficient': substantive factual assertions grounded in transcript
// 'insufficient': usable transcript lacks substantive assertions to ground claims
export type EvidenceSufficiency = 'sufficient' | 'insufficient';

export interface EvidenceBackedStatement {
  statement: string;      // Factual occurrence grounded in transcript
  evidence: EvidenceRef;  // Direct citation supporting the statement
}

export interface ExtractedTopic {
  topic: string;          // Business taxonomy category (e.g., 'Vendor Payments & Invoicing')
  evidence: EvidenceRef;  // Grounding citation demonstrating topic discussion
}

export interface ExtractedQuestion {
  askingSpeaker: string;  // Verbatim speaker name from source
  questionText: string;   // Verbatim question sentence
  evidence: EvidenceRef;  // Grounding citation
}

export interface ExtractedObjection {
  category: 'existing_system' | 'pricing_budget' | 'compliance_process' | 'missing_feature' | 'contact_timing';
  statement: string;      // Verbatim excerpt containing the objection/constraint
  evidence: EvidenceRef;  // Grounding citation
}

export interface ExtractedNextStep {
  actionType: 'reschedule_call' | 'email_proposal' | 'internal_consultation' | 'explicit_no_follow_up';
  description: string;    // Verbatim excerpt or factual description strictly limited to agreed action
  evidence: EvidenceRef[]; // Proposal turn citation + Confirming acceptance turn citation
}

export interface RecordAnalysisPayload {
  recordRef: string;
  sourceType: 'call' | 'meeting';
  sourceId: string;
  generatedForRevision: number; // Revision for which this analysis and its citations were generated
  generatedAt: string;          // ISO timestamp

  summaryPoints: EvidenceBackedStatement[]; // Empty array if no factual assertions can be grounded
  topics: ExtractedTopic[];
  keyQuestions: ExtractedQuestion[];
  statedObjections: ExtractedObjection[];
  statedNextSteps: ExtractedNextStep[];     // Confirmed next steps only; empty array if none agreed

  evidenceSufficiency: EvidenceSufficiency;
  unusableReason: string | null;            // Preserved context or null for computed analyses
}
```

> **Note on Silent / Unusable Records**:  
> For records without a usable transcript (`hasUsableTranscript === false`), no `RecordAnalysisPayload` is generated (`analysisState.analysis === null`). The lack of evidence is represented cleanly at the record envelope level by `hasUsableTranscript: false` and `freshness: 'not_applicable'`. No synthetic payload or fabricated `evidenceSufficiency` value is introduced.

---

## 5. Evidence-to-Claim Validation & Anti-Fabrication Rules

### 5.1. Claim Validation & Historical Evidence Invariants

To guarantee data integrity while allowing historical analysis from prior revisions to be inspected without contradiction:

1. **Generation-Time Invariant**:
   - When analysis is generated for an active record:
     - `citation.sourceId === record.source.source_id`
     - `citation.sourceRevision === record.appliedRevision`
     - `payload.generatedForRevision === record.appliedRevision`
   - Meeting Grounding:
     - `citation.turnNumber` must be a valid 1-based index ($1 \le \text{turnNumber} \le \text{turns.length}$).
     - `citation.speaker` must strictly equal `turns[turnNumber - 1].speaker`.
     - `citation.timecode` must strictly equal `turns[turnNumber - 1].timecode`.
     - `turns[turnNumber - 1].text` must contain `citation.quoteText`.
   - Call Grounding:
     - `record.source.payload.transcript` must be a non-null string containing `citation.quoteText` as an exact substring.
     - Zero speaker timecodes or talk ratios are permitted for calls.
   - Verified Fixture Example on M07 Revision 2 (`candidate/data/02_update.json`):
     - `Turn #3` (00:11:16): Speaker is **`"Team member A"`** (NOT Customer A). Text: *"The field still shows the earlier wording. So the change is not appearing after you save, is that right?"* $\rightarrow$ Valid grounding for question asked by rep.

2. **Historical / Preserved Analysis Invariant**:
   - Every citation within an existing `RecordAnalysisPayload` is validated against the revision for which the analysis was generated:
     $$\text{citation.sourceRevision} === \text{payload.generatedForRevision}$$
   - When a newer source revision is ingested (`record.appliedRevision > payload.generatedForRevision`), the stored analysis remains valid for its originating revision. It is **NOT** re-validated against the newer `record.appliedRevision`.

3. **Historical Citations UI Presentation**:
   - Historical and stale citations must **never** be presented as evidence from the current revision.
   - Each citation pill explicitly displays its originating revision (e.g., `[Rev {citation.sourceRevision} • Turn #{turnNumber}]` or `[Rev {citation.sourceRevision} • Call Excerpt]`).
   - The citation's verbatim quote (`citation.quoteText`) is fully self-contained within `EvidenceRef`, ensuring evidence is always readable in place even if the original transcript is no longer active in the transcript viewer.

4. **Citation Navigation Behavior When Transcripts Differ**:
   - **Case A: Current revision has no usable transcript (`freshness: 'not_applicable'`)**:
     - The current drawer's "Evidence & Transcript" tab contains no turns.
     - Clicking a historical citation does **not** switch tabs or attempt to jump to non-existent turns.
     - Instead, clicking expands the citation's self-contained quote card in-place with an informative badge:  
       *“Original transcript belongs to Revision {citation.sourceRevision}; current Revision {currentRev} contains no usable transcript.”*
   - **Case B: Current revision has a newer transcript (`freshness: 'stale_pending_review'`)**:
     - The transcript viewer displays Revision {appliedRev} turns (where turn numbers, timestamps, or text may have changed).
     - Clicking a stale citation switches to the transcript tab with a disclaimer banner:  
       *“Displaying current Revision {currentRev} transcript. Note: Citation was generated from Revision {citation.sourceRevision}; turn numbers or text may differ in this revision.”*
     - If the turn exists identically in the current transcript, it is temporarily highlighted; otherwise, the user is prompted to click `[Regenerate Analysis for Revision {appliedRev}]` to inspect fresh citations.

### 5.2. Evidence-Based Summaries (No Arbitrary Word Count)
- Every statement in `summaryPoints` must cite a supporting `EvidenceRef`.
- Dialogue length alone does not dictate extraction: even short conversations are evaluated on factual content.
- If dialogue lacks substantive factual assertions, `evidenceSufficiency` is set to `'insufficient'` and `summaryPoints` returns `[]`. The UI displays: *"Transcript contains insufficient factual assertions to synthesize summary points."*
- Zero synthetic placeholder sentences are inserted into data.

### 5.3. Distinguishing Proposals From Confirmed Next Steps

The engine must not classify every mention of a future action, date, or tentative suggestion as an agreed next step:

1. **A Proposal Alone is NOT a Confirmed Next Step**:
   - A question, suggestion, or tentative proposal alone (e.g. *"Could we speak Monday?"*, *"Should I send over the documentation?"*) represents an inquiry or offer, NOT an agreed commitment.
   - Proposing an action without evidence of affirmative agreement must never be classified as a confirmed next step.
2. **Confirmation & Acceptance Requirement**:
   - A proposed action can be extracted as a next step **only** when the surrounding transcript provides explicit evidence of acceptance or mutual agreement by the participants.
   - **Canonical Short-Transcript Example**:
     > Turn 1 (Speaker A): *“Could we speak Monday?”* (Proposal)  
     > Turn 2 (Speaker B): *“Yes, that works.”* (Explicit Acceptance)  
   - Extracted Next Step:
     - `actionType: 'reschedule_call'`
     - `description: "Speak on Monday"` (Limited strictly to what was agreed)
     - `evidence`: Both Turn 1 (proposal) and Turn 2 (acceptance) citations are preserved in `evidence: EvidenceRef[]`.
3. **Strict Scope Limitation — Anti-Hallucination**:
   - The next-step claim must remain strictly limited to what the speakers actually agreed to in dialogue.
   - The engine must **never** invent or hallucinate:
     - Calendar dates (e.g., calculating "2026-08-24" from "Monday").
     - Specific meeting times or time zones (unless explicitly uttered).
     - Calendar invitations, platforms (e.g., Zoom/Meet), owners, or attendees not in the transcript.
     - Unstated follow-on commitments or agendas.
4. **Ambiguous, Deferred, or Unanswered Proposals**:
   - If a proposal receives **no response** (e.g., the other participant shifts topic, ignores the question, or the conversation ends without an answer), or if acceptance is ambiguous/deferred (e.g., *"Maybe"*, *"Let me check my calendar"*, *"I'll have to see"*):
     - The action is **NOT** reported as a confirmed next step.
     - The proposal is **omitted** from `statedNextSteps`.
     - It is **never** treated as a confirmed commitment.
     - If the proposal was phrased as a question, it is captured under `keyQuestions` (with its turn citation), but `statedNextSteps` remains empty (`[]`).
5. **Explicit Closure / Negative Decision**:
   - If a participant explicitly declines or rejects follow-up (e.g., C10: *"No. I said I will contact you if there is anything to discuss."*), it is categorized as `actionType: 'explicit_no_follow_up'` with that turn's citation.
6. **No Inferred "No Follow-Up"**:
   - When no agreed commitment or explicit negative closure is found, `statedNextSteps` is an empty array `[]`.
   - The UI displays: *"No explicit next step detected in the transcript."*
   - Absence of an agreement is never conflated with an affirmative closure (`explicit_no_follow_up`).
7. **Independent Semantic Evidence Grounding**:
   - All claims must be independently evidence-backed.
   - Merely matching isolated keywords (e.g., *"Monday"*, *"call"*, *"next"*, *"speak"*) in a quote is **not** sufficient proof of a next step; the surrounding dialogue must semantically support both the proposed action and its mutual acceptance.

---

## 6. Execution Model: Why On-Demand Generation is Safest

We recommend **On-Demand Generation** (when the user opens the `Derived Analysis` tab or clicks `[Generate Analysis]`), with an explicit `[Regenerate]` button when stale:
1. **Decoupling**: Complete isolation between the data replay engine and the analytical layer. A malformed transcript or unexpected text pattern can never crash, corrupt, or roll back a batch import.
2. **Replay Performance**: Initial batch (44 records) and shuffled re-imports remain instantaneous (<10ms).
3. **Deterministic Persistence**: Once generated, the analysis payload is committed to `RECORDS_STORAGE_KEY` and active memory. Subsequent opens load instantly from storage.
4. **Stale Inspection Integrity**: When Revision 2 arrives during replay, `executeBatchImport()` marks the existing analysis `stale_pending_review` in-place. The user can open the drawer, inspect the preserved Revision 1 analysis with its stale warning, and click `"Regenerate Analysis for Revision 2"`.

---

## 7. UI & Integration Specification

### 7.1. Segmented Navigation (`RecordDrawer.tsx`)
```
[ 1. Evidence & Transcript ]    [ 2. Derived Analysis ]    [ 3. Manager Review ]
```

### 7.2. Derived Analysis Tab (`AnalysisViewer.tsx`)
1. **Freshness Header**:
   - `current`: Green badge `[Fresh • Revision N]` with generation timestamp.
   - `stale_pending_review`: Amber warning banner: `[⚠️ Stale Analysis • Generated for Revision {generatedForRevision}]` with action button: `[Regenerate Analysis for Revision {currentRev}]`.
   - `uncomputed`: Clean state with primary action: `[Generate Analysis for Revision {currentRev}]`.
   - `not_applicable`: Informative badge: `[No Usable Audio / Transcript Unavailable]`.
2. **Historical Analysis Display (When Record Becomes Unusable)**:
   - If `freshness === 'not_applicable'` and a prior analysis exists:
     - Primary section displays: *"Analysis Unavailable for Current Revision: Usable evidence missing in Revision {currentRev}."*
     - Collapsible section: `[▶ View Historical Analysis from Revision {generatedForRevision}]`.
     - When expanded, shows a prominent warning: *"Historical Reference Only — Generated for Revision {generatedForRevision}. This analysis belongs to an older revision and does not describe Revision {currentRev}."*
     - If no prior analysis exists, show only the unavailable state; no historical result is fabricated.
3. **Interactive Citation Links & Cross-Revision Navigation**:
   - Current Citations (`analysis.generatedForRevision === record.appliedRevision`): Clicking any citation switches the drawer to `Evidence & Transcript`, scrolls to the turn, and highlights it.
   - Historical / Stale Citations (`analysis.generatedForRevision < record.appliedRevision`):
     - Displays originating revision badge on each citation pill.
     - When `freshness === 'not_applicable'`, tab jumping is prevented and the verbatim quote is expanded in-place with an explanatory note.
     - When `freshness === 'stale_pending_review'`, tab switching warns that the transcript reflects current Revision {currentRev} and prompts regeneration if citations differ.

---

## 8. Audit Logging & Resilience

When analysis is generated or regenerated, `ReplayStore` logs an audit event:
- `action: 'ANALYSIS_GENERATED'` or `'ANALYSIS_REGENERATED'`.
- `previousRecordCount === newRecordCount === store.getTotalCount()`.
- `appliedCount: 1`.
- `details: Generated analysis for meeting M07 (Revision 2): 2 topics, 3 questions, 1 objection.`

**Resilience Guarantees**:
- Pre-commits analysis to `RECORDS_STORAGE_KEY` before active memory is mutated.
- If storage quota is exhausted, `StorageCommitError` is thrown, active state remains untouched, and an error toast is displayed.
- If writing to `AUDIT_STORAGE_KEY` fails, the in-memory audit ledger is appended, `store.isAuditStorageDegraded()` is set to `true`, and analysis generation succeeds.

---

## 9. Proposed Files to Create or Modify

### New Files:
1. `src/types/analysis.ts`:
   - Data contracts for `EvidenceRef`, `MeetingEvidenceRef`, `CallEvidenceRef`, `RecordAnalysisPayload`, `EvidenceBackedStatement`, `ExtractedTopic`, `ExtractedQuestion`, `ExtractedObjection`, `ExtractedNextStep`, and `EvidenceSufficiency`.
2. `src/engine/analysisEngine.ts`:
   - Offline, deterministic extraction engine implementing lexical rule matching, question/objection parsing, proposal/confirmation detection, and citation grounding. Zero API keys, zero network dependencies.
3. `src/features/analysis/AnalysisViewer.tsx`:
   - UI component rendering analysis cards, freshness badges, stale alert banners, historical analysis view, and cross-revision citation navigation.
4. `src/test/analysis.test.ts`:
   - Test suite covering evidence grounding, quote verification, confirmed vs unconfirmed vs unanswered next steps, freshness lifecycles, and revision transitions.

### Existing Files Modified:
5. `src/types/contract.ts`:
   - Update `AnalysisFreshness` to `'not_applicable' | 'uncomputed' | 'current' | 'stale_pending_review'`.
   - Update `AnalysisRecordState.analysis` to `RecordAnalysisPayload | null`.
   - Add `'ANALYSIS_GENERATED'` and `'ANALYSIS_REGENERATED'` to `AuditActionType`.
6. `src/engine/replayStore.ts`:
   - Update `executeBatchImport()` to execute the 4-state freshness transition matrix and preserve prior analysis on higher revisions.
   - Add `generateRecordAnalysis(sourceType: SourceType, sourceId: string): void`.
7. `src/features/inbox/RecordDrawer.tsx`:
   - Add tab switcher (`Transcript`, `Analysis`, `Review Form`), integrate `AnalysisViewer`, and wire citation jump-to-turn highlighting.
8. `src/features/styles/dashboard.css`:
   - Add Linear/Vercel dark styling for tab switchers, analysis cards, stale banners, and citation pills.

---

## 10. Comprehensive Test Plan & Acceptance Criteria

### A. Evidence Grounding & Confirmed Next Steps
- **T-ANA-01 (Call Grounding)**:
  - Input: Call C01 (`candidate/data/01_initial.json`).
  - Verifies objection (*"Our processes are already very automated"*) cites exact substring matching `source_id === '2ec4404c-beee-5377-a63c-aab701da08ed'`. Zero fabricated timestamps.
- **T-ANA-02 (Meeting Grounding - Turn 3 Speaker & Timecode)**:
  - Input: Meeting M07 Revision 2 (`candidate/data/02_update.json`).
  - Verifies detected question (*"The field still shows the earlier wording. So the change is not appearing after you save, is that right?"*) cites exact 1-based `turnNumber === 3`, `speaker === 'Team member A'` (NOT Customer A), and `timecode === '00:11:16'`.
- **T-ANA-03 (Confirmed Next Step vs. Unaccepted / Unanswered Proposal)**:
  - **Test Dialogue 1 (Confirmed Commitment - Acceptance)**:
    - Turn 1: *"Could we speak Monday?"* (Proposal)
    - Turn 2: *"Yes, that works."* (Explicit Acceptance)
    - Assertion: `statedNextSteps` has length 1. `actionType === 'reschedule_call'`, `description === 'Speak on Monday'`. `evidence` contains exact citations for both Turn 1 and Turn 2.
    - Anti-Hallucination Assertion: Verifies no invented calendar date (e.g. 2026-08-24), time, attendee, platform, or owner is present.
  - **Test Dialogue 2 (Unaccepted Proposal - Explicit Rejection)**:
    - Turn 1: *"Could we speak Monday?"*
    - Turn 2: *"I am busy all next week."* (Rejection)
    - Assertion: Question is extracted into `keyQuestions`, but `statedNextSteps` is strictly empty `[]`.
  - **Test Dialogue 3 (Ambiguous / Deferred Proposal)**:
    - Turn 1: *"Could we speak Monday?"*
    - Turn 2: *"Maybe, let me check my schedule later."* (Ambiguous)
    - Assertion: `statedNextSteps` is strictly empty `[]`. Unconfirmed proposal is omitted.
  - **Test Dialogue 4 (Unanswered Proposal / Dropped Thread)**:
    - Turn 1: *"Could we speak Monday?"* (Proposal)
    - Turn 2: *"Let's review the quarterly revenue numbers on slide four."* (Ignored / Topic shifted without answering)
    - Assertion: The proposed action receives no answer or confirmation. It is omitted from `statedNextSteps` (`statedNextSteps` is strictly empty `[]`) and never treated as a confirmed commitment. Question is recorded in `keyQuestions`.
  - **Test Dialogue 5 (Keyword Match Without Semantic Support)**:
    - Turn 1: *"Monday was a terrible day for our servers."*
    - Assertion: Despite presence of keyword *"Monday"*, `statedNextSteps` is strictly empty `[]`.
- **T-ANA-04 (Short Dialogue without Arbitrary Word Count)**:
  - Short 8-word dialogue with a factual assertion and question produces valid grounded claims. `evidenceSufficiency` evaluates to `'sufficient'`.
- **T-ANA-05 (Silent Call Handling & Evidence Sufficiency Alignment)**:
  - Input: Call B01 with `transcript: null`.
  - Verifies: `hasUsableTranscript === false`, `freshness === 'not_applicable'`, `analysis === null`, and `generatedForRevision === null`.
  - State Model Alignment: Confirms that silent records do not contain a synthetic `RecordAnalysisPayload` or a fabricated `evidenceSufficiency` property.

### B. Freshness, Stale Preservation & Historical Analysis
- **T-ANA-06 (Initial Import Usable Transcript)**:
  - Ingest 01_initial.json. Record with usable transcript has `freshness === 'uncomputed'` and `analysis === null`.
- **T-ANA-07 (Generation Sets Current)**:
  - Generate analysis for record at Revision 1 $\rightarrow$ `freshness === 'current'`, `generatedForRevision === 1`.
- **T-ANA-08 (Stale Analysis Preserved on Higher Revision)**:
  - Ingest 01_initial.json, generate analysis for M07 at Revision 1.
  - Ingest 02_update.json (Revision 2 with 27 turns).
  - Verifies M07 `freshness` is `'stale_pending_review'`, prior analysis is **strictly preserved** (not null), and `generatedForRevision` remains `1` (less than applied revision `2`).
- **T-ANA-09 (Historical Analysis Preservation When Record Becomes Unusable)**:
  - Ingest record with usable transcript at Revision 1 and generate analysis (`generatedForRevision === 1`).
  - Apply higher revision (Revision 2) where `hasUsableTranscript` becomes `false`.
  - Verifies:
    1. `freshness` is `'not_applicable'`.
    2. Previous analysis payload is preserved for historical reference (`analysis !== null`).
    3. `generatedForRevision` remains `1`.
    4. Citations in historical analysis retain `citation.sourceRevision === 1` matching `generatedForRevision === 1` (NOT `record.appliedRevision === 2`).
    5. UI contract: Current revision displays unavailable state; historical analysis is accessible only via the labelled historical reference view and never presented as current evidence; transcript navigation on historical citations does not attempt to highlight non-existent turns in Revision 2.
- **T-ANA-10 (Restoring Usable Transcript from Unusable State)**:
  - Apply subsequent revision (Revision 3) that restores usable transcript to record from T-ANA-09.
  - Verifies `freshness` transitions to `'stale_pending_review'` because prior analysis exists from Revision 1.
  - If a record with no prior analysis restores a usable transcript, verifies freshness transitions to `'uncomputed'`.
- **T-ANA-11 (Regeneration Restores Current)**:
  - Regenerating analysis on M07 Revision 2 reflects 27 turns, sets `generatedForRevision === 2`, and restores `freshness === 'current'`.

### C. Persistence & Regression
- **T-ANA-12 (Storage Rehydration)**: Analysis payloads and all 4 freshness states persist to `RECORDS_STORAGE_KEY` and rehydrate without loss.
- **T-ANA-13 (Store Reset Purge)**: Resetting the store purges all analyses from storage and memory.
- **T-ANA-14 (Full Suite Regression)**: All 40 existing tests across Slices 1–3 continue to pass with zero failures.
