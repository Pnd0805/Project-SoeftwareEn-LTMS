### Task 8B: Search and Inbox

**Files:**
- Adapt: `src/features/search/SearchPage.tsx`; `src/features/inbox/InboxPage.tsx`, `BackendInbox.tsx`.
- Create: `src/features/search/search-inbox-workspace.css`; import from the owned pages and scope rules to Search/Inbox roots, retaining current shared tokens.
- Reuse: `src/features/search/SearchPage.test.tsx`; `src/features/inbox/InboxPage.test.tsx`, `InboxPage.real.test.tsx`, `BackendInbox.test.tsx`.

**Interfaces:**
- Consumes: Task 1 presentation, current Search queries and existing mock/real notification behavior and action capabilities.
- Produces: unchanged Search/Inbox routes and supported handlers with consistent lists, source states and retained action feedback. Independent of 8A.

- [ ] **Step 1: Inspect Search and both Inbox modes.** Trace results, empty/failed sources, recovery, denied content, permitted action destinations and a row-changing action. Preserve source and permission distinctions.
- [ ] **Step 2: Apply Search/Inbox presentation.** Use readable result/notification rows, contextual concise actions, visible labels and stable pending/outcome feedback. Scope layout changes to Search/Inbox roots; leave Account and shared tokens intact.
- [ ] **Step 3: Verify.** Run `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run src/features/search src/features/inbox`, TypeScript, lint and build; compare frozen hashes. Expected: exit 0 and no changed frozen file. For any uncovered affected row-changing action, assert its original destination/payload and visible result after row removal; source failure must not appear as an empty result.
- [ ] **Step 4: Record rendered cases and direct review.** Check long Search results, empty/failed Search, long notifications, mock/real Inbox and action feedback after row change in both desktop sizes/themes and at 390px. Record keyboard access and no page overflow in `docs/superpowers/notes/2026-10-06-ltms-ticket-08b.md`.
