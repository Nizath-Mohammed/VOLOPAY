# AGENT.md — Permanent Instructions for AI Agents

## Startup Protocol

1. Read this file first.
2. Read `MASTER_SOURCE_OF_TRUTH.md` for authoritative requirements, constraints, and decision log.
3. Read `DATA_CONTRACT.md` and `DATA_DICTIONARY.md` for data schema and field definitions.
4. Read relevant approved slice specifications (e.g. `SLICE_4_SPECIFICATION.md`).
5. Read `JOURNEY.md` for current project status and recent work.
6. Read `DECISIONS.md` for decision history and approval status.
7. Read `DESTINATION.md` for intended product state and milestone plan.
8. Inspect actual source code and tests before trusting any historical status report.
9. Identify the current task, approved scope, and any unresolved issues.

## Mandatory Approval-First Workflow

- Inspect before proposing changes. Never begin implementation without a prior inspection.
- Write or revise a specification when a new feature requires one.
- Present proposed changes and wait for explicit user approval before implementation.
- Never interpret a request to inspect, analyze, review, or propose as implementation approval.
- Never begin unapproved work. Never silently expand the task scope.

## Engineering Rules

- Preserve existing working functionality. Do not rebuild the application unnecessarily.
- Do not weaken or delete tests to make them pass.
- Do not introduce unnecessary dependencies.
- Respect existing architecture, data contracts, revision handling, and evidence-integrity rules defined in `MASTER_SOURCE_OF_TRUTH.md` and `DATA_CONTRACT.md`.
- Run relevant tests (`npm test`) and the production build (`npm run build`) after implementation.
- Report actual results without inventing successful checks. If the environment cannot run a check, say so.

## Documentation Maintenance

- After meaningful work, update the appropriate handoff files:
  - `JOURNEY.md`: Record verified results, failures, unresolved questions, and the next action.
  - `DECISIONS.md`: Record newly approved, rejected, or superseded decisions.
  - `DESTINATION.md`: Update milestones or acceptance criteria only when an approved change justifies it.
- Update authoritative requirements (`MASTER_SOURCE_OF_TRUTH.md`) only through an approved change process. Do not rewrite it during ordinary progress tracking.
- Do not mark work complete before its acceptance criteria have been verified.

## Shutdown and Handoff Protocol

Before ending a task or switching IDEs:
1. Summarize what changed.
2. Record actual verification results (test counts, build status).
3. Update the relevant handoff files.
4. Identify incomplete work and the exact next action.
5. Confirm which files were actually saved.
6. Leave the repository in a state another agent can understand.

## Key Repository Paths

- Repository root: `candidate/`
- Application code: `candidate/app/src/`
- Data files: `candidate/data/`
- Tests: `candidate/app/src/test/`
- CSS: `candidate/app/src/features/styles/dashboard.css`

## Build and Test Commands

Run from `candidate/app/`:
- Tests: `npm test` (or `npx vitest run`)
- Build: `npm run build` (runs `tsc && vite build`)
- Dev server: `npm run dev` (run manually, do not block execution)
