# Volopay Revenue Intelligence Inbox — Master Source of Truth (SSOT)

> **Document Version**: 1.1.0  
> **Last Updated**: 2026-10-23  
> **Status**: Active Living Document  
> **Governing Rule**: This document is the single handoff source of truth across all sessions, conversations, and agent runs. Chat history alone is ephemeral and non-authoritative. Every architectural decision, schema contract, and vertical slice transition must be logged here before execution.

---

## 1. Operating Rules & Constraints

1. **Specification-First**: No code, refactoring, or file modifications occur without prior written specification and explicit user sign-off.
2. **Vertical Slice Execution**: Deliver working, reviewable, end-to-end vertical slices. Never build broad unverified scaffolding across all features simultaneously.
3. **Data Integrity & Non-Destructive Ingestion**:
   - Source data must never be mutated or partially merged. Higher revisions replace the entire source payload.
   - Manual user state (routes, tags, notes, review status) must survive source updates and browser reloads.
   - Zero hallucination / zero fabrication: Silent calls or missing transcripts must never receive phantom coaching or synthetic turns.
4. **Preserve Existing Green Tests**: Every new slice must keep all prior tests passing. All baseline tests must continue to pass before and after changes.

---

## 2. Project Setup & Stack Reference

| Dimension | Specification | Notes |
| :--- | :--- | :--- |
| **Application Directory** | `candidate/app` | All application source code lives here. |
| **Runtime Stack** | React 18 + TypeScript + Vite | Clean, fast modular frontend. No heavy frameworks needed. |
| **Styling** | Vanilla CSS / CSS Modules | Highly responsive, premium design tokens, dark/light contrast, no Tailwind. |
| **Testing** | Vitest (`npm test` / `npx vitest run`) | In-memory unit and integration tests (58 passing tests). |
| **Production Build** | `npm run build` (`tsc && vite build`) | Zero TS errors, verified production bundle. |
| **Persistence** | `localStorage` with `MemoryStorage` fallback | Keys under `revenue_intelligence_inbox_state_v1`. |
| **Timezone Anchor** | `Asia/Kolkata` (UTC+05:30) | Source activity anchored to **21 August 2026**. Delivery exported 22 August 2026. |
| **Source Data Files** | `candidate/data/01_initial.json`<br>`candidate/data/02_update.json` | 44 initial records (17 usable transcripts); 1 update record (M07 rev 2 with 27 turns -> 18 usable). |

---

## 3. Decision Log (Living Register)

| ID | Topic | Decision | Status | Rationale & Impact |
| :--- | :--- | :--- | :--- | :--- |
| **D-001** | App Location | `candidate/app` | **Confirmed** | Established working directory. |
| **D-002** | Testing Standard | Critical behavior & acceptance tests over arbitrary line coverage | **Confirmed** | Prioritize core data invariants (idempotence, revision replacement, manual override survival, timezone). |
| **D-003** | Analysis Freshness | Source revision changes invalidate prior analysis to `stale_pending_review` | **Confirmed** | Prevents presenting outdated transcript analysis as current ground truth. |
| **D-004** | Architecture | Client-side reactive store; no backend service required | **Confirmed** | Assignment data (44 records) fits in client memory; instant replay and zero network latency. |
| **D-005** | Transcript vs Review State | Separate `hasUsableTranscript` (source fact) from `ReviewState` (`unreviewed`, `pending_review`, `reviewed`) | **Confirmed** | Removing `unusable_silent` from review states prevents conflating data presence with human workflow. Backward-compatible migration on storage rehydration guarantees zero data loss. |
| **D-006** | Slice 1 Verification | Slice 1 verified: 7/7 Vitest tests passing; production build passing | **Confirmed** | Core Ingestion Engine and ReplayStore verified in independent audit. |
| **D-010** | Slice 2 Verification | 18/18 tests passing, dynamic metrics/timeline, Linear/Vercel redesign | **Confirmed** | Verification completed with zero regressions. |
| **D-011** | Strict Identity Runtime Validation | `parseRecordKey()` enforces 2-element tuple, valid `source_type`, non-empty string ID | **Confirmed** | Rejects malformed JSON, numeric IDs, nulls, and wrong types with zero silent coercion. |
| **D-012** | URL Synchronization & Cleanup | URL hash `#record=` encodes canonical key; malformed/nonexistent hashes cleaned via `replaceState()` preserving pathname/search | **Confirmed** | Prevents sync loops, page reloads, and history clutter while guaranteeing instant UI response on clicks. |
| **D-013** | Verbatim Evidence Presentation | Call transcript and meeting turns rendered strictly verbatim in source order with zero data fabrication | **Confirmed** | Preserves exact speaker names, timecodes, and turn texts. Silent calls render explicit empty badge. |
| **D-014** | Intentional Review State Governance | Changing routes or notes does not automatically mark a record as `reviewed`; explicit review action required | **Confirmed** | Preserves user workflow states across partial updates, reset actions, and higher revision batch arrivals. |
| **D-015** | Two-Phase Persistence & Audit Integrity | Review updates pre-commit to records storage before in-memory commit; audit failures do not mask successful updates | **Confirmed** | Emits `MANUAL_REVIEW_UPDATE` audit events with exact store inventory counts and degrades gracefully on storage limits. |
| **D-016** | Slice 3 Verification | Slice 3 completed: 40/40 tests passing; production build clean; URL hash and review workflow verified | **Confirmed** | Full drawer review and routing workflow verified in browser and test suite. |
| **D-017** | Four-State Freshness Lifecycle | `AnalysisFreshness`: `'not_applicable' \| 'uncomputed' \| 'current' \| 'stale_pending_review'` | **Confirmed** | Comprehensive coverage of all lifecycle transitions with atomic persistence and audit events. |
| **D-018** | Evidence Grounding & Anti-Fabrication | Verbatim grounding: meeting turn citations cite exact turn number, speaker, timecode, and quoteText; call citations cite exact substring | **Confirmed** | M07 Rev 2 Turn 3 grounded to Rep "Team member A". Zero fabricated timestamps, talk ratios, dates, or advice. |
| **D-019** | Proposals vs Confirmed Next Steps | Proposal alone is not a next step; confirmed step requires explicit mutual acceptance citing proposal + response | **Confirmed** | Unanswered, deferred, or ambiguous proposals are omitted from `statedNextSteps`. Explicit negative closure captured as `explicit_no_follow_up`. |
| **D-020** | Historical Analysis on Unusable Records | When a newer revision lacks usable audio, prior analysis is preserved as historical reference with `freshness: not_applicable` | **Confirmed** | Rendered only in collapsible reference container with permanent disclaimer; never presented as current; restoring transcript transitions to `stale_pending_review`. |
| **D-021** | Slice 4 Verification | Slice 4 implemented: 58/58 Vitest tests passing; zero TypeScript errors; production build clean | **Confirmed** | Complete deterministic offline analysis engine, segmented drawer tabs, and interactive citation navigation. |


---

## 4. Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    Delivery Batches (JSON)                   │
│         (01_initial.json, 02_update.json, Custom JSON)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Validation & Guard Engine                  │
│  - Envelope validation (batch_id, revision, records)         │
│  - Identity validation: (source_type, source_id)             │
│  - Collision and malformed record detection                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  ReplayStore (State Engine)                  │
│  - Idempotent upsert & revision gating:                      │
│      * rev <= current: ignored                               │
│      * rev > current: full source payload replacement        │
│  - Transcript availability separation (hasUsableTranscript)   │
│  - User state isolation (manualRoute, tags, notes, review)   │
│  - Analysis freshness invalidation (stale_pending_review)    │
│  - Bi-directional sync with localStorage                     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐┌─────────────────────────────┐
│      Replay Toolbar UI       ││     Overview Dashboard       │
│  - Run step-by-step replay   ││  - 44 total records metric  │
│  - Upload custom batch       ││  - 17 -> 18 transcript count│
│  - Reset store state         ││  - Source vs Verified rates │
│  - Visual step feedback      ││  - 21 Aug 2026 IST timeline │
└──────────────────────────────┘└─────────────────────────────┘
```

### Module Boundaries
1. `src/types/contract.ts`: Typed delivery envelopes, source payloads (`CallPayload`, `MeetingPayload`), `AppRecord`, `UserRecordState`, `AnalysisRecordState`.
2. `src/engine/identity.ts`: Collision-free canonical key generation via `JSON.stringify([source_type, source_id])`.
3. `src/engine/transcript.ts`: Usable transcript detection (non-empty call transcript or >= 1 meeting turn).
4. `src/engine/storage.ts`: Persistence abstraction (`StorageAdapter`, `MemoryStorage`, `localStorage`) with automated schema migrations.
5. `src/engine/replayStore.ts`: Central state machine handling batch import, manual override preservation, analysis invalidation, and metrics.
6. `src/features/dashboard/`: Overview metrics, timeline aggregation (Asia/Kolkata), source-reported vs transcript-verified comparison tables.
7. `src/features/inbox/`: Interactive record list, drawer view, route picker, manual review toggles, user notes editor.
8. `src/features/analysis/`: Evidence quotes and turn citation viewer, freshness indicators (`current`, `stale_pending_review`).
9. `src/features/export/`: JSON and CSV manifest generator with export bundle builder.

---

## 5. Domain Ground Truth & Data Contract Reference

### 1. Identity & Revisions
- **Primary Key**: `(source_type, source_id)`. Never key records by `record_ref`, phone number, company title, or array index.
- **Revision Rule**: Initial revision is `1`. Update revision is `2`. Same or older revisions are ignored.
- **Replacement Rule**: Higher revision replaces the *entire* source payload and transcript payload. No partial field merges.
- **User State Preservation**: Manual route corrections, user notes, and manual override flags are stored separately and must never be erased by source updates.

### 2. Transcript Availability vs Review State (D-005)
- **Usable Transcript**: Nonblank call transcript string or at least one nonblank meeting turn (`turns.length > 0`).
- **Initial Batch**: 44 records (30 calls, 14 meetings), 17 with usable transcripts.
- **Update Batch**: Meeting `M07` (`4f304fff-fd40-5cfc-a366-0a134c445c2a`) updated from 0 turns to 27 turns. Total usable transcripts increases from 17 to 18. Total record count remains exactly 44.
- **Review State**: Pure human workflow state (`unreviewed`, `pending_review`, `reviewed`).
- **Storage Migration**: Any legacy stored record with `reviewState: 'unusable_silent'` is automatically mapped on load to `unreviewed` (or `reviewed` if manual override exists).

### 3. Dates and Timezone Anchoring
- **Delivery Date**: 22 August 2026 (`exported_at`).
- **Activity Horizon**: 21 August 2026 in `Asia/Kolkata` (UTC+05:30).
  - Example: `2026-08-21T18:29:29Z` equals `2026-08-21 23:59:29 IST`.
- **Source-Reported vs Transcript-Verified**: Upstream fields like `is_connected`, `is_conversation`, and `observed_outcome` are source-reported classifications, not verified ground truth. They must be clearly distinguished in the UI.

---

## 6. Implementation Status & Roadmap

```
[x] Slice 1: Core Ingestion Engine & Replay Store
    - Identity, ReplayStore, transcript availability, persistence adapter
    - 7/7 tests passing; build passing
[x] Slice 2: Replay Toolbar & Overview Dashboard (COMPLETED & VERIFIED)
    - Replay toolbar (Initial, Shuffled, Update, Reset, Custom JSON upload)
    - Overview metrics cards & Asia/Kolkata 21 Aug 2026 timeline
    - Source-reported vs transcript-verified comparison panel
    - Migration of legacy unusable_silent review state
    - Pre-commit atomic writes, safe storage-first reset, dual-tier audit compaction
    - 18/18 Vitest tests passing; production build clean
[ ] Slice 3: Inbox, Record Drawer & Review Workflow (APPROVED & IMPLEMENTING)
    - Filterable inbox list (source type, review state, audio usability, manual overrides)
    - Side drawer showing full metadata, verbatim turns/quotes, notes editor, route picker
    - Two-phase pre-commit review persistence & MANUAL_REVIEW_UPDATE audit trail
    - Immediate UI drawer responsiveness + path/query preserving URL hash sync & cleanup
[ ] Slice 4: Evidence-Backed Analysis & Stale/Fresh State
    - Turn citations (meeting turn # / call exact quote)
    - Freshness badge (current vs stale_pending_review)
[ ] Slice 5: Export Manifest & Offline Pack
    - JSON / CSV manifest generator with folder export
[ ] Slice 6: Final Polish, README & Submission Deliverables
    - 5 presentation slides, 3-minute video narration script
```

---

## 7. Protocol for Future Turns

When resuming or starting any slice:
1. **Read this document first**.
2. Run `npm test` and `npm run build` to confirm the green baseline.
3. Propose specifications and obtain confirmation before modifying files.
4. Record new decisions under Section 3 before writing code.
5. Update Section 6 as slices are completed.
