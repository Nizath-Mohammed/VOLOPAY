# Revenue Intelligence Inbox

A client-side workspace for sales managers to inspect conversation records, review transcripts, apply routing decisions, and generate evidence-backed analysis. Built for the Volopay assessment challenge.

**Key Capabilities:**
- Dashboard with activity metrics, timeline visualization, and transcript coverage tracking
- Filterable inbox with 44 call and meeting records from August 21, 2026
- Evidence-backed analysis with exact transcript citations (meeting turn numbers or call quotes)
- Manual route corrections preserved through source updates and browser refreshes
- Three export formats: JSON manifest, CSV manifest, and complete bundle

---

## Quick Start

```bash
cd candidate/app
npm install
npm run dev
```

Open http://localhost:5173/, click **"Load Initial Batch"**, then explore the dashboard and inbox. See [Data Replay Verification](#data-replay-verification) for the complete test sequence.

---

## Problem & Solution

### The Problem
Sales managers receive fragmented conversation records with inconsistent transcripts, late arrivals, and unreliable automated classifications. Transcripts may arrive after initial metadata, stored labels don't always match actual conversation content, and manual corrections risk being overwritten by system updates.

### The Solution
An interactive workspace that:
- Preserves manual routing decisions through source updates and restarts
- Generates deterministic, evidence-backed analysis citing exact transcript passages
- Distinguishes source-reported classifications from transcript-verified conclusions
- Handles late-arriving transcripts without creating duplicate records
- Exports organized outputs with complete context and revision tracking

### Key Workflows
1. **Overview → Filter → Review**: Dashboard shows metrics and timeline → Filter inbox by review state or transcript availability → Open drawer to inspect conversation
2. **Generate Analysis → Apply Route → Save**: Click "Generate Analysis" to create evidence-backed summary → Change route if needed → Save with manual override preserved
3. **Verify Updates**: Import update batch → Confirm revised transcript appears → Verify manual corrections persist

---

## Technology Stack

- **React** 18.3.1
- **TypeScript** 5.6.3
- **Vite** 5.4.9 (build tool & dev server)
- **Vitest** 2.1.3 (testing framework)
- **Vanilla CSS** (no framework, Linear/Vercel-inspired dark theme)
- **localStorage** (persistence with MemoryStorage fallback, key: `revenue_intelligence_inbox_state_v1`)

**No backend service required.** All state management, analysis generation, and persistence run client-side.

---

## Setup & Startup

### Prerequisites
- **Node.js** with npm (tested with modern Node.js versions supporting ES2020+)
- **Modern browser** with localStorage support

### Installation

```bash
cd candidate/app
npm install
```

### Development Server

```bash
npm run dev
```

Access the application at **http://localhost:5173/**

### Production Build

```bash
npm run build
```

Output written to `candidate/app/dist/`

### Run Tests

```bash
npm test
```

Expected: 90/90 tests passing across 5 test files

---

## Data Replay Verification

Follow these steps to verify the required replay behavior specified in `DATA_CONTRACT.md`.

### Step 1: Load Initial Dataset

1. Open **http://localhost:5173/**
2. Click **"Load Initial Batch"** button in the toolbar
3. Verify toast message: `Initial batch loaded: 44 records committed (17 usable transcripts).`
4. Confirm dashboard shows:
   - **Total Records**: 44
   - **Usable Transcripts**: 17
   - **Coverage**: 38.6%

### Step 2: Verify Idempotence (Repeat Import)

1. Click **"Reimport Shuffled"** button
2. Verify toast: `Idempotence verified: 0 applied, 44 ignored. Total records strictly remain 44.`
3. Confirm counts remain unchanged: **44 records**, **17 usable transcripts**

### Step 3: Apply Manual Correction

1. Scroll to the inbox table
2. Click on meeting **M07** (or any record with a usable transcript)
3. In the drawer that opens, change the route dropdown to **"Sales Pipeline / Discovery"**
4. Click **"Save"** button
5. Verify **"Effective Route"** field shows "Sales Pipeline / Discovery"
6. Note **"Manual Override: Yes"** indicator appears
7. Close the drawer

### Step 4: Apply Update Batch

1. Click **"Apply Update Batch"** button
2. Verify toast: `Update batch applied (Rev 2): Meeting M07 updated with 27 turns. Total usable transcripts increased to 18.`
3. Confirm dashboard now shows:
   - **Total Records**: 44 (unchanged)
   - **Usable Transcripts**: 18 (increased by 1)

### Step 5: Verify Manual Correction Persists After Update

1. Open **M07** drawer again
2. Verify **"Effective Route"** still shows "Sales Pipeline / Discovery"
3. Verify **"Manual Override: Yes"** indicator still present
4. Note **"Applied Revision: 2"** shown in metadata
5. Observe new transcript with 27 turns is now visible

### Step 6: Verify Persistence After Browser Refresh

1. Refresh the browser (F5 or Ctrl+R)
2. Verify dashboard still shows **44 records**, **18 usable transcripts**
3. Open **M07** drawer again
4. Confirm manual route **"Sales Pipeline / Discovery"** persists
5. Confirm revision 2 transcript (27 turns) remains visible

### Expected Results Summary

| Check | Expected Behavior | Verified |
|-------|------------------|----------|
| Initial import | 44 records, 17 usable transcripts | ✅ |
| Repeated import | No duplicates, counts unchanged | ✅ |
| Manual correction | Route saved and visible | ✅ |
| Update applied | M07 updated to rev 2, transcript count 17→18, total records still 44 | ✅ |
| Manual route preserved | Survives update and browser refresh | ✅ |

---

## Metrics Definitions

All metrics are calculated from the in-memory record store after applying revision rules. Formulas verified from `app/src/engine/replayStore.ts`.

### Total Records
- **Formula**: `records.size`
- **Definition**: Count of unique (source_type, source_id) pairs after applying revisions
- **Expected Value**: **44** (30 calls + 14 meetings)
- **Denominator Note**: Same or older revisions are ignored; each logical source record appears exactly once

### Usable Transcripts
- **Formula**: `callTranscriptsCount + meetingTranscriptsCount`
- **Definition**: Records with nonblank call transcript string OR at least one meeting turn
- **Initial State**: **17** (10 calls + 7 meetings)
- **After Update**: **18** (10 calls + 8 meetings, M07 gains transcript)
- **Source**: `hasUsableTranscript()` function in `app/src/engine/transcript.ts`

### Transcript Coverage
- **Formula**: `(usableTranscriptsCount / totalRecords) × 100`
- **Initial Coverage**: 17/44 = **38.6%**
- **After Update Coverage**: 18/44 = **40.9%**
- **By Type**:
  - **Call Coverage**: `callTranscriptsCount / callsCount × 100` = 10/30 = **33.3%**
  - **Meeting Coverage**: `meetingTranscriptsCount / meetingsCount × 100` = 8/14 = **57.1%** (after update)
- **Denominator**: Total records in the same filter scope

### Review State Counts
- **Unreviewed**: `reviewState === 'unreviewed'` — No explicit manager action taken
- **Pending Review**: `reviewState === 'pending_review'` — Flagged for manager attention (e.g., new transcript arrived)
- **Reviewed**: `reviewState === 'reviewed'` — Manager explicitly saved review or applied manual route
- **Total**: Sum always equals total records (44)

### Manual Overrides
- **Formula**: Count of `record.userState.isManualOverride === true`
- **Definition**: Records where manager explicitly changed the route from suggested default
- **Increments**: When user selects a route different from automated suggestion and saves

### Source-Reported Connection Rate (Calls Only)
- **Formula**: `sourceReportedConnectedCount / (sourceReportedConnectedCount + sourceReportedNonConnectedCount) × 100`
- **Definition**: Percentage of calls with `is_connected === true` among calls with non-null connection status
- **Excludes**: Calls where `is_connected === null` (shown separately as "unknown")
- **Label**: Clearly marked as **"source-reported"** to distinguish from transcript-verified assessment
- **Source**: Upstream classification field from call payload

### Important Limitations

- **No pipeline value calculations**: No authoritative CRM opportunity data provided
- **No cross-meeting speaker identity**: Speaker labels (e.g., "Team member A") are local to each meeting
- **Historical flags scope**: Fields like `first_dial_ever`, `prior_connects_ever` may include activity outside this 44-record dataset
- **Selected sample**: This is a deliberately selected variety sample, not a complete team day or representative performance ranking

---

## Routing & Analysis

### Route Categories

Seven taxonomy routes defined in `app/src/types/contract.ts`:

1. **Sales Pipeline / Discovery**
2. **Deal Next Steps / Evaluation**
3. **Customer Support & Bug Escalation**
4. **Partnership & Referral**
5. **Internal / Vendor Coordination**
6. **Unusable / Missing Audio**
7. **Needs Triage**

### Suggested Route vs Effective Route

**Suggested Route** (Automated Default):
- Has usable transcript → **"Needs Triage"**
- No usable transcript → **"Unusable / Missing Audio"**
- Never changes once set during import
- Visible in drawer metadata section

**Effective Route** (Actual Route Used):
- If manual override active → uses `userState.manualRoute`
- Otherwise → uses `suggestedRoute`
- Determines export output path and analysis destination
- Used in all exports and routing displays

### Manual Overrides

**How to Apply**:
1. Open record drawer
2. Select different route from dropdown
3. Click "Save"

**Behavior**:
- Sets `isManualOverride: true`
- Sets `reviewState: 'reviewed'`
- Persists across source updates (revision changes don't erase manual decision)
- Persists across browser refreshes (stored in localStorage)
- Visible as **"Manual Override: Yes"** badge in drawer
- Can be cleared using "Clear Override" button to restore suggested route

### Analysis Generation

**Approach**: Deterministic offline rule-based engine

**Key Characteristics**:
- **On-demand**: Only generated when user clicks "Generate Analysis" button
- **No pre-generated analysis**: No analysis included in initial state
- **No external AI API**: Purely algorithmic extraction from transcript evidence
- **Deterministic**: Same transcript always produces identical analysis
- **Evidence-backed**: Every conclusion cites exact turn number (meetings) or quote substring (calls)

**What Analysis Includes**:
- Summary of conversation purpose and outcome
- Extracted topics with supporting evidence
- Key questions asked (with citations)
- Stated objections (with citations)
- Next steps with explicit ownership where stated

**Analysis Freshness States** (4-state lifecycle):
- **`not_applicable`**: Record has no usable transcript (cannot generate analysis)
- **`uncomputed`**: Has transcript but analysis not yet generated
- **`current`**: Analysis reflects current revision transcript (green indicator)
- **`stale_pending_review`**: Transcript updated to newer revision, analysis reflects older revision (amber warning + regenerate button)

**Evidence Citation Rules**:
- **Meeting passages**: Cite meeting ID (e.g., M07) + turn number (1-based) + speaker + quote
- **Call passages**: Cite call ID (e.g., C03) + exact verbatim substring from transcript
- No fabricated timestamps, talk ratios, dates, or advice
- Historical citations (from stale analysis) show originating revision and are never presented as current

### Source-Reported vs Transcript-Verified

**Source-Reported Information**:
- Fields like `is_connected`, `is_conversation`, `observed_outcome`, `classification_status`
- Comes from upstream system, not independently verified
- Clearly labeled in UI as "source-reported" or "upstream classification"
- May disagree with transcript evidence

**Transcript-Verified Information**:
- Analysis conclusions drawn from actual conversation text
- Evidence citations link to specific turn numbers or quotes
- Limited to records with usable transcripts (17 initially, 18 after update)
- Manager can inspect supporting passage by clicking citation

**Example Distinction**:
- Source-reported `is_connected: true` for a call with no transcript doesn't prove substantive conversation occurred
- Transcript-verified analysis requires actual words to support coaching or next-step recommendations

---

## Export System

### Three Export Formats

#### 1. JSON Manifest (`export-manifest-TIMESTAMP.json`)
- **Contents**: Metadata-only export with summary statistics and entry list
- **Structure**:
  ```json
  {
    "exported_at": "2026-12-19T10:30:45.123Z",
    "total_records": 44,
    "calls_count": 30,
    "meetings_count": 14,
    "usable_transcripts_count": 18,
    "manual_overrides_count": 2,
    "entries": [ ... array of 44 entry objects ... ]
  }
  ```
- **Entry Fields**: record_ref, source_type, source_id, applied_revision, suggested_route, effective_route, is_manual_override, review_state, has_usable_transcript, analysis_freshness, generated_for_revision, last_modified_at, output_path

#### 2. CSV Manifest (`export-manifest-TIMESTAMP.csv`)
- **Contents**: Tabular format for spreadsheet analysis
- **Same fields** as JSON manifest, one row per record
- **CSV Escaping**: Proper handling of commas, quotes, newlines, and array fields (joined with semicolons)
- **Use Case**: Import into Excel, Google Sheets, or data analysis tools

#### 3. Complete Bundle (`export-bundle-TIMESTAMP.json`)
- **Contents**: Full export with manifest + all record files
- **Structure**:
  ```json
  {
    "manifest": { ... same as JSON manifest ... },
    "files": {
      "needs-triage/call_C01.json": { ... full record context ... },
      "sales-pipeline-discovery/meeting_M07.json": { ... full record context ... },
      ...
    }
  }
  ```
- **File Contents**: Full source envelope, suggested/effective routes, user state (manual route, notes, tags), analysis state (freshness, analysis payload, generated_for_revision), last_modified_at
- **Path Structure**: `{route_slug}/{source_type}_{source_id}.json`
- **Route Slugification**: Lowercase, hyphen-separated (e.g., "Sales Pipeline / Discovery" → "sales-pipeline-discovery")

### How to Export

1. **Load Data**: Import initial batch and update batch (follow [Data Replay Verification](#data-replay-verification) steps)
2. **Scroll to Export Panel**: Located between Overview Dashboard and Revenue Intelligence Inbox table
3. **Click Desired Format Button**:
   - **📄 JSON Manifest** — Metadata-only export
   - **📊 CSV Manifest** — Spreadsheet-compatible format
   - **📦 Complete Bundle** — Full context export
4. **File Downloads**: Browser's native download mechanism triggers

### Export Location

- **Download Method**: Browser's native download API (Blob + anchor element)
- **Default Location**: User's default Downloads folder (browser-dependent)
- **Filenames**: Timestamped format prevents overwrites
  - `export-manifest-2026-12-19T10-30-45.json`
  - `export-manifest-2026-12-19T10-30-45.csv`
  - `export-bundle-2026-12-19T10-30-45.json`

### Export Verification Status

⚠️ **BROWSER VERIFICATION NOT YET COMPLETED**

- **Implementation Status**: Export engine fully implemented and tested
- **Automated Testing**: 32/32 export tests passing (CSV escaping, path integrity, idempotency, metadata accuracy)
- **Browser Testing Status**: **NOT PERFORMED**
  - Actual file downloads not manually verified
  - CSV formatting in Excel/Google Sheets not confirmed
  - JSON parsing and bundle structure not browser-tested
  - Download behavior across browsers (Chrome, Firefox, Safari, Edge) not verified

**What Has Been Verified**:
- ✅ Export functions generate correct data structures (unit tested)
- ✅ CSV escaping handles commas, quotes, newlines, arrays (unit tested)
- ✅ Path integrity: every manifest entry maps to bundle file (unit tested)
- ✅ Metadata calculations match actual record state (unit tested)
- ✅ Idempotency: repeated exports don't accumulate duplicates (unit tested)

**What Requires Manual Verification**:
- ❌ Files actually download with correct filenames
- ❌ JSON files parse correctly in browser/tools
- ❌ CSV files open correctly in Excel/Google Sheets
- ❌ Download works across different browsers
- ❌ Large bundle (331KB+ for 44 records) downloads without errors

---

## Testing

### Run Test Suite

```bash
cd candidate/app
npm test
```

### Verified Test Results (2026-12-19)

- **Total Tests**: 90/90 passing
- **Test Files**: 5
  - `analysis.test.ts`: 18 tests
  - `export.test.ts`: 32 tests
  - `identity.test.ts`: 10 tests
  - `inbox.test.ts`: 12 tests
  - `replay.test.ts`: 18 tests
- **Duration**: ~1.9 seconds
- **Status**: Zero failures

### Test Coverage Areas

- **Batch Import**: Initial load, shuffled reimport, update batch, custom JSON
- **Idempotence**: Repeated imports don't create duplicates or inflate counts
- **Revision Handling**: Same/older revisions ignored, higher revisions replace payload
- **Manual Overrides**: Persist through updates and storage roundtrips
- **Analysis Generation**: Deterministic output, freshness transitions, historical preservation
- **CSV Escaping**: Commas, quotes, newlines, arrays properly escaped
- **Export Integrity**: Path mapping, metadata accuracy, idempotency

### Production Build

```bash
cd candidate/app
npm run build
```

### Verified Build Results (2026-12-19)

- **Status**: Clean (zero TypeScript errors)
- **Modules Transformed**: 54
- **Output Size**:
  - JavaScript bundle: ~331KB
  - CSS bundle: ~35KB
- **Build Time**: ~1.1 seconds
- **Output Directory**: `candidate/app/dist/`

---

## Known Limitations

### Architecture Constraints
- **Client-side only**: No backend service, all state in localStorage (10MB browser limit)
- **No live AI integration**: Deterministic offline rules only (no OpenAI, Claude, etc.)
- **No CRM integration**: No authoritative deal data, pipeline values, or opportunity tracking
- **No cross-meeting speaker identity**: Speaker labels are meeting-local (no unified speaker directory)
- **No semantic search**: No full-text search across transcripts
- **No historical trends**: Single-day activity snapshot only

### Data Constraints (per DATA_DICTIONARY.md)
- **44-record selected sample**: Not a complete team day or representative performance ranking
- **One-day activity**: 21 August 2026, Asia/Kolkata only
- **Source-reported flags**: Historical fields (first_dial_ever, prior_connects_ever) may include activity outside this 44-record dataset
- **No verified company joins**: No authoritative account-ID mapping or complete customer history

### Export System
- **Browser verification incomplete**: Download behavior not manually tested (see [Export Verification Status](#export-verification-status))
- **No ZIP archive**: Exports individual JSON/CSV files, not bundled ZIP
- **No incremental exports**: Always exports all current records (no filtering)
- **No export scheduling**: Manual download only

### Browser Compatibility
- **localStorage required**: MemoryStorage fallback available but doesn't persist across refreshes
- **Modern browser assumed**: ES2020+ features used (no IE11 support)
- **Download API**: Requires Blob and anchor download support
- **Tested browsers**: [NOT YET VERIFIED]

---

## Future Improvements

### High Priority
- Complete browser export verification and testing
- Add ZIP archive generation for bundle exports
- Implement semantic search across transcripts
- Add date range filtering for multi-day activity views

### Medium Priority
- CRM integration (read-only) for opportunity context
- Advanced inbox filtering (date ranges, rep performance comparisons)
- Bulk route assignment (apply route to multiple records)
- Export filtering (export subset based on route, review state, etc.)

### Low Priority
- Optional live AI model integration for enhanced analysis
- Real-time collaboration (multiple managers viewing same workspace)
- Mobile-responsive layout optimization
- Historical trend visualizations across multiple days

---

## Submission Contents Checklist

This submission includes:

- ✅ **Working application**: React + TypeScript app runs locally via `npm run dev`
- ✅ **Editable source code**: All source files in `candidate/app/src/` (excludes node_modules)
- ⚠️ **Generated export files**: Implementation complete, browser verification incomplete
- ✅ **README.md**: This file
- ❌ **Five presentation slides**: [Not yet created]
- ❌ **Screen recording with narration**: [Not yet created]
- ❌ **Three findings with evidence**: [Not yet documented]
- ❌ **One rejected decision**: [Not yet documented]
- ❌ **Time estimate**: [Awaiting user-provided estimate]

### Application Structure
```
candidate/
├── app/                          # Application root
│   ├── src/
│   │   ├── types/                # TypeScript contracts
│   │   │   ├── contract.ts       # Data envelopes, AppRecord, ReviewState
│   │   │   └── analysis.ts       # Analysis payload types
│   │   ├── engine/               # Core business logic
│   │   │   ├── replayStore.ts    # State machine & batch import
│   │   │   ├── analysisEngine.ts # Deterministic offline analysis
│   │   │   ├── identity.ts       # Canonical key generation
│   │   │   ├── transcript.ts     # Usable text detection
│   │   │   ├── storage.ts        # localStorage adapter
│   │   │   └── validation.ts     # Batch validation
│   │   ├── features/             # UI components
│   │   │   ├── dashboard/        # Metrics & timeline
│   │   │   ├── inbox/            # Record list & drawer
│   │   │   ├── analysis/         # Analysis viewer with citations
│   │   │   ├── export/           # Export panel & engine
│   │   │   ├── toolbar/          # Replay controls
│   │   │   └── styles/           # Vanilla CSS
│   │   ├── test/                 # Vitest test suite (90 tests)
│   │   ├── App.tsx               # Root component
│   │   └── main.tsx              # Entry point
│   ├── package.json              # Dependencies & scripts
│   ├── tsconfig.json             # TypeScript config
│   └── vite.config.ts            # Vite build config
├── data/
│   ├── 01_initial.json           # Initial batch (44 records, rev 1)
│   └── 02_update.json            # Update batch (M07 rev 2)
├── AGENT.md                      # AI agent handoff instructions
├── JOURNEY.md                    # Project progress & status
├── MASTER_SOURCE_OF_TRUTH.md     # Requirements & decision log
├── DATA_CONTRACT.md              # Import rules & evidence reference
├── DATA_DICTIONARY.md            # Field definitions & glossary
└── README.md                     # This file
```

### Reproducibility

All commands in this README have been verified from the documented working directory (`candidate/app/`). Metric definitions match the actual implementation in `app/src/engine/replayStore.ts`. Replay steps follow the exact sequence specified in `DATA_CONTRACT.md`.

---

**For questions or issues**: Refer to `AGENT.md` for project context and handoff protocol.
