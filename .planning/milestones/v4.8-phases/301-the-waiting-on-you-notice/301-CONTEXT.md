# Phase 301: The Waiting-on-You Notice - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning
**Mode:** `--auto` (operator: *"continue autonomously end to end"*) — every gray area resolved with the
recommended option, each logged in `301-DISCUSSION-LOG.md`. G-2 sketch winner is self-picked under the
same mandate (precedent: 298/300) and recorded in `STATE.md → Guardrail overrides`; the operator sees it at
G-4, so SC#4 ("matches the operator-approved sketch") stays owed to the operator.

<domain>
## Phase Boundary

Inside the app, a person sees every workflow run that is waiting on them — a question or an approval,
including scheduled and API-key runs — across every org they belong to, in one "waiting on you" list behind
one badge that is visible from every view. Each item names its org, how long it has waited and whether it
needs an answer or an approval, and opens the run (an item in another org goes through 299's "switch?"
prompt). The item leaves and the count drops once the question is answered or the run ends — here, in
another tab, by another person or by the engine — and stays right after a missed Realtime event, because the
client reconciles by fetch.

Requirements: NOTE-01, NOTE-05. Reads the `notifications` rows Phase 300 writes (migration 218 triggers).

Out of scope: email (300), marking a notice read / dismissing / snoozing it, push or desktop notifications,
digests, a notice for a chat `ask_user` or a tool-round-cap pause (excluded pause kinds, recorded by
REG-08 in 302), an owner-facing "your email failed" surface, any change to the run page or `PendingAskCard`.
</domain>

<decisions>
## Implementation Decisions

### Where the badge lives (auto — recommended)
- **D-01: One dedicated rail control, "Waiting on you", near the top of the 58px rail** (under New chat /
  Search, above the nav items) — present on every view `ChatLayout` mounts, collapsed or expanded rail.
  Not on the Library item (that badge stays the Library's), not inside the profile menu (hidden = the
  "nothing in the shell points at it" failure), not on the Workflows item (a scheduled run's owner may never
  open Workflows).
- **D-02: The control is always present; the count appears only when > 0.** Amber count (needs-you
  colour language) carried by the number, never colour alone; the control's accessible name carries the
  sentence ("2 workflow runs are waiting on you"). Zero → no badge, no reserved space; opening it shows
  "Nothing is waiting on you."
- **D-03: Mobile:** the drawer-opening hamburger dot lights for a waiting notice too (it already lights for
  any shell condition), and the drawer gets a "Waiting on you (N)" row that opens the same list.
- **D-04: Rail density (BUG-260923-01) is NOT folded** — it is an IA reorganisation owned by SEED-166 /
  SEED-196; this phase adds one control and records the count. Reviewed and left open (re-open trigger
  unchanged).

### The list (auto — recommended)
- **D-05: A popover anchored to the control, on the same shadcn `DropdownMenu` primitive as
  `AttentionPopover`/`ProfileMenu`** (no new package). Header "Waiting on you"; one row per open notice.
- **D-06: A row says:** workflow name (title) · the org (298's `OrgAvatar` + org name) · the kind word
  ("needs your answer" / "needs your approval", from `notifications.kind` only) · how long it has waited
  ("waiting 3 min", from `created_at`, re-rendered each minute). No question text, no document content.
  Every row names its org, including rows in the active org (one shape, never a conditional label).
- **D-07: Order = waited longest first.** One flat list, not grouped by org (the org is on every row).
- **D-08: The whole row is one button** (keyboard + touch reachable, one tab stop per row) that closes the
  popover and calls `openRun(run_id)` → `/app/runs/<id>`. ⛔ It never calls `switchOrg` itself: 299's
  `LinkGate` resolves the run and shows `SwitchOrgPrompt` when the run's org differs (Stay / Switch).
  Research confirms the run route goes through the gate when opened by push, not only on cold load.
- **D-09: No mark-read, no dismiss, no snooze.** A notice is a fact about a run that is waiting; it leaves
  only when the wait ends. A dismissed waiting run is exactly the silent stop `SEED-281` is about.
  (Deferred, see below.)
- **D-10: No cap in the UI below the server's bound:** the route returns at most 50 open notices
  (oldest-waiting first); above that the list ends with "and N more" as plain text (count from the route).

### The registry: second tenant (from ROADMAP flags — locked; shape auto — recommended)
- **D-11: The waiting notice is the second tenant of `ATTENTION_PRODUCERS`** (key `waiting-runs`). The
  `length === 1` pins in `NavPanel.badge.test.tsx` and `attentionTab.test.ts` are **re-baselined to 2 with
  the second key asserted, in the same commit** — never deleted. The D-235-03 docblock is amended *beside*
  its original sentence (struck through, not overwritten), naming this phase as the deliberate override and
  correcting the seed id (`SEED-231` in the docblock is superseded; the register id is `SEED-281`).
- **D-12: Each condition says which shell mark it belongs to** (a new field set by its producer, e.g.
  `mark: "library" | "waiting"`); the Library rail badge and its popover count only `library` conditions,
  the new control only `waiting` ones; the mobile hamburger dot lights for any. Waiting conditions carry no
  `tab`, so `attentionCountByTab` and the Library tab strip are unchanged by construction (the "breaks the
  Library's tab badge" failure). The Library popover keeps its one footer action.
- **D-13: The producer hook signature widens to a context object** (`use({ openLibraryHealth, openRun })`)
  so each tenant takes the door it needs; `ChatLayout` keeps its ONE `ATTENTION_PRODUCERS.flatMap` read
  (the `ChatLayout.badge.test.tsx` count fence stays at 1). Research names the exact pins this touches.
- **D-14: One reader.** The waiting data hook is called once, through the registry in `ChatLayout`; nothing
  else calls it (an inventory fence like the `useSourceAttention(` one pins the call-site count).

### Freshness: server is truth, Realtime is a hint (D-v2.5-03 — locked; mechanics auto — recommended)
- **D-15: `GET /notifications`** in a **new module** (`backend/app/api/notifications.py` + a small db/service
  helper), `main.py` gains one `include_router` (honoured by construction). Returns the caller's OPEN
  notices (`closed_at IS NULL`) **across every org they currently belong to** (joined through
  `org_members` — a notice for an org they have left is not listed), each
  `{id, run_id, org_id, org_name, workflow_name, kind, created_at}` plus a total count. Reads through
  `run_in_threadpool` (D-v2.5-01). Recipient filter in the same statement; anon-role test; a test that one
  user never sees another's notices.
- **D-16: Migration `219`** adds `public.notifications` to the `supabase_realtime` publication (precedent:
  migrations 002/014/032) — nothing else. RLS's owner-only SELECT policy (218) governs what Realtime
  delivers. Local apply via SQL editor, then `bash scripts/regenerate-full-schema.sh` (no `--reset`); cloud
  paste + `get_advisors(security)` only at deploy, per-action approval. Research checks whether publication
  membership survives the schema dump or needs `scripts/full-schema-supplement.sql`.
- **D-17: The client reconciles by fetch on:** first mount, any Realtime event on its own notices (INSERT
  or UPDATE → refetch, never patch local state from the payload), Realtime (re)subscribe, window focus /
  tab visible, an active-org switch, and a fallback poll (60 s) — so a missed event can only delay, never
  strand, the count. A failed fetch keeps the last known list (never shows an empty all-clear it did not
  receive; same `verdictKnown` rule as `useSourceAttention`).
- **D-18: The subscription is user-scoped, not org-scoped** (`recipient_id = eq.<uid>`), so an org switch
  never drops cross-org notices, and it lives outside `StreamsProvider` (no edit to that file; no effect on
  any live stream subscription).

### Exclusions held by construction
- **D-19: A chat `ask_user` never produces a notice** — 218's trigger writes only for asks on a workflow
  run in `active`/`paused` status. A DB-backed test drives a chat-thread ask and asserts zero rows (the
  "a chat ask_user shows up as a notice" failure).
- **D-20: Scheduled and API-key runs** appear because their owner is the recipient (218 triggers); one G-4
  row uses a schedule's Run now.

### Guardrails and plan shape
- **D-21: G-2** — sketch FIRST (badge placement, the row naming its org, mark-read). Variants: (A) dedicated
  rail control [recommended], (B) mark on the identity/avatar footer, (C) mark on the Workflows rail item;
  row anatomy and the empty state drawn in each. Winner self-picked under the autonomous mandate, recorded
  in STATE.md → Guardrail overrides; operator approval owed at G-4 (SC#4).
- **D-22: G-5** — `ChatLayout.tsx` (FIRING): one hunk (pass `openRun` into the producer context), honoured by
  construction. `NavPanel.tsx` (FIRING): one mount of the new control + the D-12 count filter, honoured by
  construction; new UI lives in new files (control + popover + vocabulary leaf). `attentionConditions.ts`
  reaches 3 phases → ledger row + `docs/HOT-FILE-LEDGER.md` section in the same commit as its first touch.
  `PendingAskCard.tsx`, `StreamsProvider.tsx`, the run page: not touched. `main.py`: one line. Planner runs
  `node scripts/check-hot-file-ledger.cjs`.
- **D-23: G-8** — 3 plans: (1) backend route + migration 219 + tests (anon, cross-user, left-org, chat-ask
  exclusion); (2) the data hook + second registry tenant + pin re-baselines + D-12 partition; (3) the rail
  control, popover, mobile row, vocabulary leaf. Targeted suites per task, full gates once per wave; backend
  unit baseline ceiling (71 failed) holds; vitest count gate per-file no-decrease.
- **D-24: G-4 scenarios, set now at scope time** (Claude drives in Chrome as the two-org dev account,
  proving the active org first):
  1. Start a workflow with a question step in the active org, move to Library: the badge shows 1 without a
     reload; the row names the org, the workflow, "needs your answer"; clicking opens the run.
  2. A run waiting in the OTHER org: its row names that org; clicking shows "This is in <org> — switch?";
     Stay leaves the active org unchanged; Switch opens the run.
  3. Answer the question in a second tab: the first tab's badge drops without a reload. Then block the
     Realtime websocket, answer another, restore: on focus/reconnect the count is right.
  4. With a stopped source present, the Library badge and its tab mark show only the source; the waiting
     count is separate; the mobile hamburger dot lights.
  5. A Deep-chat `ask_user` produces no notice; a notice arriving while another thread streams leaves the
     stream intact (parallel-thread axis); a schedule's Run now that pauses appears too.
- **D-25: Four-axis UAT** (UI state): cross-provider = the run-pauses→notice-appears row across the full
  native roster + OpenRouter (derive the roster from `MODEL_CAPABILITIES`; blocked rows ⛔ with reason —
  Moonshot balance, OpenRouter 402 known); multi-tool = a workflow step using 2+ tools before its question;
  parallel-thread = D-24 row 5; long-message = the list with ≥ 10 waiting notices across two orgs. Rows
  authored in VALIDATION.md, not PLAN.md.

### Folded after discuss (2026-10-29)
- **D-26: BUG-261029-01 folded** — the Library popover's "Open Library health" control becomes a `DropdownMenuItem`
  (`onSelect`), so it is reachable by arrow keys + Enter like 301's own rows (UI-SPEC UI-D1). Its test moves to
  `getByRole("menuitem")`; the D-235-04 "no repair control" negative assertion stays. One small hunk in
  `AttentionPopover.tsx`; drive it with the keyboard in Chrome at G-4 (row 4).

### Amendments from research (2026-10-30, `--auto`, recommended option each time; 301-RESEARCH.md F1-F12)
- **D-27 (amends D-15, Q2/F6):** the route reads through the shared asyncpg pool with the caller bound as `$1` (the
  299 `link_resolver.py` pattern), NOT the per-user connection (run visibility requires owning the run's thread, so
  it would silently hide notices) and NOT `run_in_threadpool` (asyncpg is already async). It also filters
  `workflow_runs.status IN ('active','paused')`, so a missed close (218's triggers swallow errors) can never list a
  finished run.
- **D-28 (amends D-06 / UI-SPEC UI-D5, F7):** the wire carries `origin` (`workflow_runs.origin_kind`); the row adds
  "· scheduled" for `schedule` and "· started by an API key" for `key` (vocabulary leaf), as the sketch drew it.
  This overrides UI-SPEC UI-D5.
- **D-29 (amends D-08, F2):** rows are `DropdownMenuItem`s with `onSelect` → `openRun` (Radix blocks Tab inside menus):
  one ARROW-key stop per row, Enter opens, tests query `menuitem` (= UI-SPEC UI-D1).
- **D-30 (amends D-03, F3):** the hamburger dot exists only in `ChatArea.tsx:923`; the mobile bar of every other
  view (`AppViewSwitch.tsx:325-333`) gains the same dot. `AppViewSwitch.tsx` reaches 3 phases → ledger row in the
  same commit. ChatLayout's drawer hunks are several small ones, still honoured by construction (new UI in new files).
- **D-31 (amends D-12, F4/F8):** `AttentionCondition` becomes a discriminated union on a REQUIRED `mark`:
  library `{mark: "library"; tab?}` / waiting `{mark: "waiting"; runId; orgId; orgName; since; kind; origin?; total}`.
  The badge reads the server `total` (never `conditions.length`); "and N more" = total − rows. Every typechecked
  fixture that builds a condition is updated in the same commit (research §pin table, F5).
- **D-32 (F1):** the new route ships with the OpenAPI snapshot regenerated (`backend/venv/Scripts/python
  scripts/export-openapi.py`) and `scripts/build-public-openapi.cjs` gaining the `notifications` tag in
  "Account & org" + `/notifications` in `FLAGGED_EXACT`, in the SAME commit (else
  `test_276_openapi_snapshot_fresh.py` breaks the zero-headroom backend gate).
- **D-33 (F7 Realtime):** migration 219 also adds its publication line to `scripts/full-schema-supplement.sql` §4
  (the schema dump omits publication membership). The hook wraps channel creation in try/catch and falls back to
  poll + focus refetch; `ChatLayout.badge.test.tsx`'s Supabase mock gains a working `channel()` (F8 there).
- **D-34 (UAT prep):** G-4 rows 1-2 use the published system-global "Doc Q&A" workflow (question step, runs from either
  org). Row 1 asserts the count goes UP BY ONE (the dev account already has open notices), never "shows 1". The
  approval kind is proven at unit/DB level; a small approval-checkpoint workflow is authored for G-4 only if cheap.
- **D-35:** `bash scripts/regenerate-full-schema.sh` uses `docker exec`, which is denied in agent shells — the executor attempts it;
  if denied, the regeneration is handed to the operator as a named step (never skipped silently).

### Claude's Discretion
- Exact words of the empty state, kind words, the "and N more" line, the control's tooltip — words-first,
  no raw status values, in a vocabulary leaf.
- Icon for the control (from the existing icon set; distinct from the Library and Workflows icons).
- Poll interval within 30-120 s; minute-tick mechanics; db helper module names.
- Whether the route also exposes a count-only mode (not required).

### Folded seeds and bugs
- **SEED-281** (nobody is told an approval is waiting) — in-app half folded here; 300 shipped the email
  half. Flip to answered when 301 ships (routing written back into the seed at close).
- **BUG-261029-01** (Library popover action unreachable by keyboard) → D-26.
- Seeds sweep: `0 seeds matched` (no plans yet; no structured trigger). Reported bugs: none folded —
  `BUG-260923-01` reviewed and left open (D-04).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §"Phase 301: The Waiting-on-You Notice" — goal, 4 SCs, failure list, flags
- `.planning/REQUIREMENTS.md` — NOTE-01, NOTE-05 (and NOTE-02..06 for the 300 boundary)
- `.planning/seeds/SEED-281-nobody-is-told-an-approval-is-waiting.md`

### What 301 reads (Phase 300)
- `supabase/migrations/218_run_waiting_notifications.sql` — `notifications` table, one-open partial unique
  index, owner-only SELECT policy, `notify_on_ask_row` / `notify_on_run_status` triggers, `kind`, `closed_reason`
- `.planning/phases/300-told-when-a-run-waits-backend-and-mailer/300-CONTEXT.md` — D-18, D-19, D-29 (301 owns
  `GET /notifications`)
- `scripts/full-schema-supplement.sql` §"migration 218" — the privilege block

### Prior phases this builds on
- `.planning/phases/299-links-to-the-thing-itself/299-CONTEXT.md` — `/app/runs/<id>`, `LinkGate`,
  `SwitchOrgPrompt` (D-16/D-17), resolver, `OrgAvatar` (D-39)
- `.planning/phases/298-lists-follow-the-active-org/298-CONTEXT.md` — org vocabulary, active-org switch
- `.planning/phases/297-every-view-has-an-address/297-CONTEXT.md` — route table, `useAppNavigation` is the
  only router-hook caller

### Shell attention code
- `frontend/src/components/layout/attentionConditions.ts` — the registry, D-235-03, re-open triggers
- `frontend/src/components/layout/AttentionPopover.tsx` — the popover primitive and contract
- `frontend/src/components/layout/NavPanel.tsx`, `ChatLayout.tsx:594-640` — the one read and its renderers
- `frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx`, `attentionTab.test.ts`,
  `ChatLayout.badge.test.tsx`, `frontend/src/pages/__tests__/LibraryPage.tabAttention.test.tsx` — the pins
- `frontend/src/hooks/useSourceAttention.ts` — fetch/poll/`verdictKnown` pattern to mirror
- `frontend/src/hooks/useAppNavigation.ts` — `openRun`
- `frontend/src/components/layout/LinkGate.tsx`, `SwitchOrgPrompt.tsx`

### Design
- `Skill("sketch-findings-agentic-rag")` — `references/chat-history-and-nav.md` (58px rail), 
  `references/org-admin-and-identity.md` (rail footer, org switcher), `references/pending-question.md`
  (amber = needs-you)
- `.planning/sketches/301-*` (written before planning) + `.planning/sketches/MANIFEST.md` §"Sketch 301"

### Project rules
- `CLAUDE.md` — Realtime is a hint (D-v2.5-03); `run_in_threadpool`; migrations via SQL editor +
  `regenerate-full-schema.sh`; Supabase MCP writes approval-gated; UAT scoreboard (four-axis, full roster);
  G-2/G-4/G-5/G-8
- `docs/HOT-FILE-LEDGER.md` — sections for `ChatLayout.tsx`, `NavPanel.tsx`, `main.py`, and new rows
- `docs/PLANNING-PROPORTION.md` — G-8
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ATTENTION_PRODUCERS` registry (frozen, one tenant `stopped-sources`); `AttentionCondition` already has
  per-condition `onOpen` and optional `tab` — designed for this second tenant.
- `AttentionPopover` — the `DropdownMenu`-based rail popover; the waiting list is a sibling component, not a
  branch inside it.
- `useSourceAttention` — fetch + abort + interval + keep-last-verdict pattern.
- `useAppNavigation.openRun(id)` → `/app/runs/<id>`; 299's `LinkGate` + `SwitchOrgPrompt` handle other-org runs.
- `OrgAvatar` (298) for the org mark; `useFolders.ts` / `useDocuments.ts` — existing `postgres_changes` usage.

### Established Patterns
- Realtime is a hint; reconcile by fetch on (re)connect (D-v2.5-03).
- One reader per subtree for shell attention; conditions travel down as data.
- Words-first vocabulary leaves; no raw status words on screen.
- Absences tested negatively and by name (no repair/dismiss control).

### Integration Points
- `ChatLayout.tsx` — the registry read (pass `openRun`).
- `NavPanel.tsx` — mount the control; partition the Library badge count (D-12).
- `backend/app/main.py` — one `include_router`.
- `supabase_realtime` publication — add `notifications` (mig 219).
</code_context>

<specifics>
## Specific Ideas
- Row, in spirit: **Compliance Gap Report** / ▣ Acme Legal · needs your approval · waiting 3 min
- Control name: "Waiting on you"; tooltip/aria: "2 workflow runs are waiting on you".
</specifics>

<deferred>
## Deferred Ideas
- Mark-read / dismiss / snooze a notice (D-09) — a new capability; revisit only if a list grows noisy.
- Browser push / desktop notifications, sound.
- An owner-facing "your email failed" line in the list (300 deferred it here; not in NOTE-01/05 — left).
- Rail density IA reorganisation (BUG-260923-01 → SEED-166 / SEED-196).
- Hoisting attention readers into a context provider (attentionConditions.ts re-open trigger) — not fired:
  still one reader per tenant.
</deferred>

---

*Phase: 301-the-waiting-on-you-notice*
*Context gathered: 2026-10-29*
