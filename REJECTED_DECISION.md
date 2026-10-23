# Rejected Decision: Automatic Analysis Generation on Import

## The User Problem

Sales managers receive conversation records where transcripts may arrive separately from metadata or be updated to newer revisions. When a transcript becomes available, managers need evidence-backed analysis to understand conversation content, identify coaching opportunities, and determine appropriate follow-up actions. The system must decide when to generate this analysis: automatically upon transcript availability, or on-demand when the manager requests it.

---

## The Rejected Alternative: Auto-Generate Analysis During Import

### What It Would Have Been

Automatically invoke the analysis engine for every record with a usable transcript whenever it is imported or updated to a higher revision.

### How It Would Work

When `executeBatchImport()` processes a record and determines `hasUsableTranscript: true`, the system would immediately call `generateRecordAnalysis()` before completing the import operation. Results:

- Initial batch import (17 usable transcripts) would generate 17 analyses automatically
- M07 revision 2 update would auto-generate analysis when the 27-turn transcript arrives
- Every conversation with a transcript would have analysis available immediately without manager action
- Manager opens drawer and analysis is already present

---

## The Chosen Approach: On-Demand Analysis Generation

### What Was Built

Analysis is generated only when the manager explicitly clicks the "Generate Analysis" button in the record drawer.

### Verified Implementation

**Import behavior** (verified in `app/src/engine/replayStore.ts`, `executeBatchImport()` method, lines 104-261):
- New records with usable transcripts: `analysisState.freshness` set to `'uncomputed'`, `analysisState.analysis` set to `null`
- Updated records gaining transcripts: `freshness` set to `'stale_pending_review'` (if prior analysis exists) or `'uncomputed'` (if no prior analysis)
- No automatic call to `generateRecordAnalysis()` during import — confirmed via code inspection and grep search

**Analysis generation trigger** (verified in `app/src/App.tsx`, `handleGenerateAnalysis()`, and `app/src/features/analysis/AnalysisViewer.tsx`):
- Manager clicks "Generate Analysis" button in `AnalysisViewer` component
- UI calls `store.generateRecordAnalysis(sourceType, sourceId)`
- Public method explicitly invoked only through user action
- No automatic invocation in any import or update codepath

**State transitions**:
- New transcript arrives → `freshness: 'uncomputed'`, `analysis: null`
- Manager clicks button → Analysis engine runs, `freshness: 'current'`, `analysis: RecordAnalysisPayload`
- Transcript updated to newer revision → `freshness: 'stale_pending_review'` (if analysis exists), manager must regenerate

---

## Why On-Demand Was Chosen Over Automatic

### Preserves Manager Control

Managers decide which conversations warrant detailed analysis rather than the system deciding for them. Some conversations may not need analysis:
- Brief courtesy calls with no substantive discussion
- Vendor coordination or internal meetings
- Records managers will manually route based on metadata without needing detailed analysis

### Avoids Upfront Processing Cost

With 17 usable transcripts in the initial batch (18 after M07 update), auto-generation would process every transcript during import. The on-demand approach defers this work until (and only if) the manager requests it, allowing managers to prioritize conversations selectively.

### Separates Import Integrity from Analysis

Import operations should succeed or fail based on data validation and storage integrity, not analysis computation. If analysis generation encounters an edge case or unexpected transcript structure, it should not block successful record import. This separation of concerns improves system reliability.

### Respects Uncertain Value Signal

Not every transcript represents an important conversation. The `'uncomputed'` freshness state provides useful information: manager can see which records have transcripts available but haven't been analyzed yet, allowing prioritization based on other metadata (source-reported flags, rep identity, meeting title, review state, manual override indicators).

### Supports Iterative Review Workflow

Manager can filter inbox by review state or other criteria, open promising conversations, generate analysis for specific records, and skip analysis for lower-priority conversations. This workflow pattern aligns with triage-style conversation review where managers focus attention selectively.

---

## Trade-Offs and Limitations Accepted

### Manager Must Take Explicit Action

Every record requiring analysis needs a button click. This is an additional step compared to analysis being pre-generated and immediately available upon opening the drawer.

### No Analysis Preview in List View

The inbox table shows only metadata (source type, review state, routes, transcript availability). Manager must open the drawer and generate analysis before seeing topics, key questions, objections, or next steps. This limits the manager's ability to scan multiple conversations quickly.

### Delayed Insight for Urgent Conversations

If a high-priority conversation arrives (e.g., customer escalation, competitive threat), the manager must open the drawer and click "Generate Analysis" before seeing evidence-backed recommendations. Auto-generation would surface these insights immediately.

### Uncomputed State Requires Understanding

Manager must understand that `'uncomputed'` means "transcript available but analysis not yet generated" rather than "analysis failed" or "transcript unusable." The UI mitigates this with a clear "Generate Analysis" button and explanatory text, but it adds conceptual overhead.

### No Batch Analysis Operation

Manager cannot select multiple records and generate analysis for all at once. Each record requires individual drawer open + button click. This limitation exists regardless of the auto-vs-manual decision, but auto-generation would eliminate the need for a batch operation entirely.

---

## Impact on Manager Workflow

### Workflow Steps

**With on-demand generation** (actual implementation):
1. Manager opens inbox and filters/sorts records
2. Manager clicks on record to open drawer
3. Manager reviews transcript in "Transcript" tab
4. Manager switches to "Analysis" tab
5. Manager clicks "Generate Analysis" button
6. Manager reviews generated analysis (topics, questions, objections, next steps)
7. Manager applies routing decision and saves

**With auto-generation** (rejected alternative):
1. Manager opens inbox and filters/sorts records
2. Manager clicks on record to open drawer
3. Manager switches to "Analysis" tab (analysis already present)
4. Manager reviews generated analysis
5. Manager applies routing decision and saves

### Comparison

**On-demand requires**:
- One additional explicit action (button click) per analyzed conversation
- Manager must understand when analysis is available vs. needs generation
- Manager may review transcript before deciding to generate analysis

**On-demand avoids**:
- Generating analysis for conversations manager never reviews
- Processing cost for low-priority or routine conversations
- Risk of import delays from batch analysis generation

---

## System Behavior Consequences

### Import Operations

**New records with transcripts**:
- `hasUsableTranscript: true`
- `analysisState.freshness: 'uncomputed'`
- `analysisState.analysis: null`
- Suggested route: "Needs Triage"

**M07 revision 2 update** (transcript arrives for previously silent meeting):
- `hasUsableTranscript: true` (changed from `false`)
- `analysisState.freshness: 'stale_pending_review'` (if prior analysis exists) or `'uncomputed'` (if no prior analysis)
- No automatic regeneration occurs; manager must explicitly regenerate

### Storage and Performance

**Storage footprint**:
- Initial state uses minimal space (no analysis payloads stored)
- Analysis payloads added incrementally as manager generates them
- localStorage quota consumed only for conversations actually analyzed

**Expected performance characteristics**:
- Import operations complete quickly regardless of transcript count (no analysis processing during import)
- Analysis generation happens during manager review when brief processing pause is expected
- Application startup does not require batch analysis recomputation

### Audit Trail

**Audit events**:
- `ANALYSIS_GENERATED` emitted when manager first generates analysis for a record
- `ANALYSIS_REGENERATED` emitted when manager regenerates for same record
- Clear audit trail of which records received manager attention
- No automatic generation events during import

---

## Documentation Status

### Explicitly Documented

**README.md "Analysis Generation" section**:
- "**On-demand**: Only generated when user clicks 'Generate Analysis' button"
- "**No pre-generated analysis**: No analysis included in initial state"
- "**No external AI API**: Purely algorithmic extraction from transcript evidence"

### Implicitly Reflected In Implementation

**Four-state freshness lifecycle**:
- Includes `'uncomputed'` state (would not be needed with auto-generation)
- Test suite verifies `freshness: 'uncomputed'` for new records with transcripts

**UI design**:
- `AnalysisViewer.tsx` component contains explicit "Generate Analysis" button
- Button would not exist with auto-generation approach

**Code structure**:
- `generateRecordAnalysis()` is a public method, not private
- No automatic invocation in import codepaths

### Not Formally Documented as a Decision

**MASTER_SOURCE_OF_TRUTH.md Decision Log**: No explicit D-### entry documenting this choice or comparing alternatives

**JOURNEY.md**: Mentions analysis generation capability but not the on-demand vs. automatic decision rationale

**No specification document**: No prior document proposing both alternatives and explaining the selection criteria

---

## Retrospective Explanation

**Important**: This document is a **retrospective explanation** of an implementation choice that was made during development but not formally documented as an explicit decision at the time.

**What this means**:
- The on-demand approach is visible in the code, README, and UI design
- The automatic alternative was not experimentally tested or formally proposed
- No historical project records document the consideration of automatic generation
- This explanation reconstructs the rationale based on the implemented behavior and reasonable design considerations

**Status**: The trade-offs and benefits described here represent logical implications of the chosen design, not decisions made through formal evaluation of measured alternatives. The on-demand approach was implemented from the start; no switch from automatic to on-demand occurred during development.

---

## Summary

| Aspect | Chosen Approach | Rejected Alternative |
|--------|----------------|---------------------|
| **Trigger** | Manager clicks "Generate Analysis" button | Automatic during import/update |
| **Manager control** | Explicit — manager chooses which to analyze | Implicit — system analyzes all transcripts |
| **Processing cost** | Deferred and selective | Upfront for every transcript |
| **Workflow steps** | Drawer → Analysis tab → Generate button → Review | Drawer → Analysis tab → Review |
| **Import performance** | No analysis processing during import | All transcripts analyzed during import |
| **Insights availability** | Delayed until manager requests | Immediate upon opening drawer |
| **Storage footprint** | Incremental (only analyzed conversations) | Full (all transcripts analyzed) |

**Core trade-off**: On-demand analysis offers manager control and avoids computing every analysis upfront, but requires additional user actions and may delay access to insights for urgent conversations.

**Chosen approach**: Generate analysis on-demand when manager explicitly requests it  
**Rejected alternative**: Automatically generate analysis for every usable transcript during import

**Rationale**: Manager control, separation of concerns, and selective processing outweighed the convenience of immediate availability for all conversations.

---

**Document Purpose**: This rejected decision is submitted as part of the Volopay Revenue Intelligence Inbox assignment to demonstrate design trade-off analysis and explanation of architectural choices.
