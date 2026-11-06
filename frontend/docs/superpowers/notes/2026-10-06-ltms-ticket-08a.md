# Ticket 08A — Account

Plan: `docs/superpowers/plans/2026-10-05-ltms-minimal-street.md`, exact Task `8A`.
Base: `14591823a2864fb66ff795c38ae5381568f50d3a`, branch `ltms-ticket-08a`.

## Execution ledger

- Read AGENTS, CLAUDE, approved spec, Task 8A brief, handoff and ticket. Applying executing-plans, its TDD subskill, Impeccable Operate/polish/craft floor and ponytail. No delegation.
- Pre-flight: Task 1 shared appearance is the consumed interface. 8B has no shared page/style interface; shared kit/tokens stay frozen.
- `npm ci` completed; dependencies/configuration unchanged. Baseline focused suite: **2 files / 16 tests passed**.
- Ruling: evidence/ledger stays in the owned note and `ticket-08a/`; do not write shared plan/index or out-of-frontend scratch. Exact `8A` brief extracted using task-start.
- Ruling: existing Profile editing is avatar upload/removal only. There is no general profile editor or dialog in this snapshot; registry identity stays read-only. Preserve the existing `{ avatarUrl: objectKey }` / `{ avatarUrl: null }` payloads, source errors and upload recovery. Do not invent an identity update contract.
- Ruling: schema and API upload error strings are immutable and remain verbatim (including Thai). Page-owned labels and generic recovery copy use concise English; validation rules are unchanged.
- Ruling: user explicitly requires direct Standards/Spec review, preserved evidence/worktree and completion commit. These override skill defaults for independent reviewer, scratch cleanup and finishing-branch integration choices.

## Delivered

- Login has a clear Sign in heading, visible English labels, browser autofill semantics, field-linked errors, readable pending feedback and original Guest/demo actions. Both staff/student destinations and the original short-password login rule are preserved.
- Register groups Account details and Student details, retains the faculty/department selection effect, shows full selected reference names below native selects, and offers source-specific loading/error/retry/empty feedback. Rejection keeps the draft; the original eight-field payload and `/login` success route are unchanged.
- Profile retains real/mock source boundaries, identity, statistics, history and registry-owned values. Long names and email wrap; tables scroll in named keyboard-focusable regions with readable column widths. Avatar fallback/upload/remove/object-key handling is retained; successful saves/removals are announced and stale receipts clear before retry. Removal has its own pending wording.
- `account-workspace.css` is imported only by the three owned pages. All selectors are scoped to Account roots. A palette, Barlow principal headings, Geist working text, 2px corners, 20px panels and 24px major gaps are retained. Native date/select/file controls remain native.

## Tests and source checks

- Baseline focused: **2 files / 16 tests passed** before edits.
- Final focused: `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run src/features/auth src/features/profile src/components/layout/Shell.profile.test.tsx` — **3 files / 25 tests passed** ([log](ticket-08a/focused.log)).
- Full real-mode: `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run` — **94 files / 638 tests passed** ([log](ticket-08a/full-suite.log)). Existing jsdom `scrollTo` notice is non-blocking.
- `npx tsc --noEmit -p tsconfig.app.json` — exit 0 ([log](ticket-08a/typescript.log)); `npm run lint` — exit 0 ([log](ticket-08a/lint.log)); `npm run build` — exit 0 ([log](ticket-08a/build.log)). Existing large-chunk advisory remains.
- All **49/49 frozen SHA-256 hashes match** ([comparison](ticket-08a/frozen-hashes.txt)); `git diff --check` passes. No shared kit/shell/styles, schema, dependency, configuration or contract changes.
- Nine additional consumer cases cover original auth payload/redirect, legacy login passwords, field associations, rejected draft/reference selections, source retry, real-mode demo boundaries, validation blocking, avatar receipt recovery and removal progress. Five cases failed on missing feedback/accessibility before implementation ([red run](ticket-08a/red.log)); the additional removal-progress case failed before its correction ([red run](ticket-08a/removal-red.log)). Original behavior cases passed before edits and remain regression coverage; these are not claimed as new red/green fixes.

## Rendered inspection and bounded correction

- Real preview on **5177 / strictPort**, never 5175. Chromium with synthetic HTTP fixtures; every API and storage mutation was intercepted. [Fixture script](ticket-08a/check-browser.cjs), [final records](ticket-08a/checks.json), [initial records](ticket-08a/initial-checks.json).
- Both **1280×800**, **1440×900** and **390×844**, dark/light: Login validation/pending/server errors; Register long reference choices/pending/rejection; Profile long identity, failed avatar storage/save, recovered save/removal and avatar fallback. Narrow-screen reference failure/retry and statistics failure retain the available identity and typed values.
- Initial batched inspection found squeezed Profile table columns, truncated native-select value display and dark date-control mismatch. One batched correction adds readable table widths with native scrolling, full selected reference values and scoped `color-scheme`. One final confirmation: **68 records / 62 final screenshots**, **42 intercepted writes**, no horizontal page overflow or runtime page errors. Root padding/corners/fonts, ≥44px fields, named scroll regions and keyboard ArrowRight scrolling were checked. Selected native inputs retain their platform behavior.
- Manual contrast check against the unchanged theme tokens: **16 Account text/control pairs meet 4.5:1**, minimum **5.15:1** ([ratios](ticket-08a/contrast.json)). This is token-level evidence, not a claim of complete WCAG conformance.
- Account pages have **no custom dialog** in this snapshot. Shared dialog containment/Escape behavior is outside this ticket; no dialog was introduced. Profile buttons retain native file-chooser handling. Headless automation cannot establish the OS chooser's visual layout or native Escape behavior.
- Browser-harness issues (hidden native options, Playwright label-text including option text, and a pre-document theme assignment) were corrected in the evidence scripts; they were not product defects. The final browser log contains only the successful confirmation.
- The confirmation's full-page Profile feedback images showed a sticky-shell capture artifact after keyboard focus scrolled the page. A targeted evidence repair resets page scroll before capturing the same failed-save/recovered-save states; it changes no product code and performs no further design correction. The feedback-only run passed **18 records**, records twelve repaired images separately in [feedback-checks.json](ticket-08a/feedback-checks.json), and again intercepts all 42 writes ([log](ticket-08a/feedback-browser.log)). No page overflow/runtime error; the failed-save text is readable in the repaired capture.
- Mock-mode confirmation on the same isolated 5177 preview: **6 records / 12 screenshots** using only the existing local demo dataset ([script](ticket-08a/check-mock-browser.cjs), [records](ticket-08a/mock-checks.json), [log](ticket-08a/mock-browser.log)). All five demo roles remain visible; all are disabled during pending sign-in, Player redirects to `/`, mock Profile retains its prototype-only sections, and keyboard Enter opens the native single-file chooser. Cancelling selection preserves the current state. No backend requests, page overflow or runtime errors were observed. The harness waits for the SPA route commit rather than a document load.

## Direct Standards / Spec review

Reviewed by the implementer; **no independent review or subagent**.

- Standards: inspected the complete owned source diff against AGENTS/CLAUDE and the immutable baseline. Handlers, route destinations, schemas, hooks, request keys, image accepts and mock-only boundaries remain intact. Presentation uses existing primitives/tokens and introduces no dependency or generic abstraction.
- Spec: checked all Task 8A outcomes against the source, consumer tests and both-theme desktop/mobile captures. Source failures remain distinct from empty data; reference and submission drafts survive recoverable errors. Registry identity remains read-only because the original source exposes only avatar editing. CSS remains page-scoped and no 8B file is changed.
- No blocking source finding remains. Live backend acceptance, other browser engines and native OS file-dialog visuals remain unverified. Only synthetic fixtures and the existing local mock dataset were used; no production data or live mutation was involved.

Task 8A verification is complete; the completion commit uses `feat(frontend): complete account workspace (ticket 08A)`. Completion time crossed midnight into 2026-10-07 (Asia/Bangkok); the evidence-note path retains the handoff's requested date. Source worktree, other tickets and shared plan/index are untouched. Integration remains for the user; no merge, rebase, cherry-pick, push, deployment or Ticket 09 was performed.
