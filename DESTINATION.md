# DESTINATION.md — Intended Product State & Milestones

## Product Purpose

Revenue Intelligence Inbox: a clickable workspace where a sales manager inspects incoming call and meeting records, reviews transcripts, applies routing decisions, and generates deterministic, evidence-backed conversation analysis. Designed for a 44-record dataset of sales activity anchored to 21 August 2026 (Asia/Kolkata).

## Target Users

Sales operations managers who need to understand what happened in conversations, find what needs attention, and decide what to do next.

## Approved Architecture & Design Constraints

- Client-side reactive store; no backend service required (D-004).
- React 18 + TypeScript + Vite. Vanilla CSS with Linear/Vercel-inspired dark theme. No Tailwind.
- Persistence via localStorage with MemoryStorage fallback (key: `revenue_intelligence_inbox_state_v1`).
- Vertical slice delivery: working, reviewable, end-to-end slices (never broad unverified scaffolding).

## Approved Functional Requirements

### Data Integrity & Source Identity
- Identity is `(source_type, source_id)`. Never key by `record_ref`, phone, company, or array index.
- Higher revision replaces the entire source payload and transcript. No partial merges.
- Manual user state (routes, tags, notes, review status) survives source updates and browser reloads.
- Zero hallucination: silent calls or missing transcripts never receive phantom coaching or synthetic turns.

### Evidence Citation & Validation
- Meeting citations cite exact turn number (1-based), speaker, timecode, and quoteText.
- Call citations cite exact verbatim substring from `CallPayload.transcript`.
- No fabricated timestamps, talk ratios, dates, or advice.
- Historical citations display their originating revision and are never presented as current evidence.

### Revision Handling & Freshness
- Four-state freshness lifecycle: `not_applicable`, `uncomputed`, `current`, `stale_pending_review` (D-017).
- On-demand analysis generation; analysis is never auto-generated on import.
- Historical analysis preserved when a record becomes unusable; never presented as current.
- Stale analysis shows amber warning and regenerate button; old analysis viewable with stale watermark.

## Milestone Status

| Slice | Scope | Status | Acceptance Criteria Source |
|-------|-------|--------|---------------------------|
| 1 | Core Ingestion Engine & Replay Store | **Completed** | `MASTER_SOURCE_OF_TRUTH.md` D-006 |
| 2 | Replay Toolbar & Overview Dashboard | **Completed** | `MASTER_SOURCE_OF_TRUTH.md` D-010 |
| 3 | Inbox, Record Drawer & Review Workflow | **Completed** | `MASTER_SOURCE_OF_TRUTH.md` D-016 |
| 4 | Evidence-Backed Analysis & Stale/Fresh State | **Completed** | `SLICE_4_SPECIFICATION.md` Section 10 |
| 5 | Export Manifest & Offline Pack | **Pending** | Assignment requirements in `ASSIGNMENT.md` |
| 6 | Final Polish, README & Submission Deliverables | **Pending** | `SUBMISSION_CHECKLIST.md` |

### Slice 5 — Export Manifest & Offline Pack

Status: **Not started.** No approved slice specification exists. The assignment brief (`ASSIGNMENT.md` Section 3) describes the requirement: a downloadable archive or local output folder with a JSON/CSV manifest identifying source record, route(s), output path(s), processing/review state, and manual-override flag. This is an approved assignment requirement but not yet specified or implemented.

### Slice 6 — Final Polish, README & Submission Deliverables

Status: **Not started.** No approved slice specification exists. Required deliverables per `SUBMISSION_CHECKLIST.md`: working app, editable source, generated export, five slides, short README, three-minute screen recording with narration, three key findings, one rejected decision. These are approved submission requirements but not yet produced.

## Known Limitations

- No export manifest or downloadable archive implemented (Slice 5).
- No README, presentation slides, or screen recording produced (Slice 6).
- CSS gaps in `dashboard.css` identified but not yet fixed (awaiting approval).
- No Git repository initialized; no version control history.

## Future Opportunities (Proposals — Not Approved Scope)

These are explicitly marked as proposals, not approved requirements:

- Semantic search across transcripts (requires separate approval; explicitly excluded from current scope per project constraints).
- LLM-powered analysis (requires separate approval; explicitly excluded; current engine is deterministic and offline).
- Live CRM integration (out of scope per `ASSIGNMENT.md`).
- Production deployment and authentication (out of scope per `ASSIGNMENT.md`).

## Authoritative References

- `MASTER_SOURCE_OF_TRUTH.md` — consolidated requirements, constraints, decision log
- `DATA_CONTRACT.md` — envelope schema, import rules, revision handling, evidence reference rules
- `DATA_DICTIONARY.md` — glossary, payload field definitions, safe calculations
- `SLICE_4_SPECIFICATION.md` — Slice 4 detailed specification and acceptance criteria
- `ASSIGNMENT.md` — original product challenge and assessment brief from recruiter
- `SUBMISSION_CHECKLIST.md` — required submission deliverables
