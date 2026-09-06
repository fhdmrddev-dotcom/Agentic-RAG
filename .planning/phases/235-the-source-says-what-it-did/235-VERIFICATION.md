---
phase: 235-the-source-says-what-it-did
verified: 2026-09-06T00:00:00Z
status: gaps_found
score: 1/4 success criteria fully verified · 3/4 partial
verifier: Claude (gsd-verifier) — goal-backward, adversarial
merge_base: ef18e8552
head: d9c15a77e
overrides_applied: 0

gates_rerun:
  vitest_count_gate:
    command: "GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs (repo root)"
    verdict_verbatim: "count gate OK — 237/237 pinned files present, no per-file decrease, 0 failing."
    totals_verbatim: "total 7715  ·  failed 0  ·  pinned total 6985"
    exit: 0
  backend_unit:
    command: "cd backend && ./venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors"
    verdict_verbatim: "71 failed, 3888 passed, 2 xfailed, 2 xpassed, 44 warnings in 267.31s (0:02:16)"
    collection_errors: 0
    assessment: "AT CLAUDE.md's ceiling of 71, and ONE BELOW the phase's own measured merge-base baseline of 72. No new failure. Nothing re-pinned."
  claude_md_size:
    verdict_verbatim: "claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars."
    measured: "CLAUDE.md 117742 chars · 78.5% of limit · headroom 32258 [OK]"
    exit: 0
  composition_fence:
    command: "cd frontend && npx vitest run src/components/sources/sourceComposition.test.tsx"
    verdict_verbatim: "Tests  16 failed | 33 passed (49)"
    note: "In NEITHER gate knob by decision — so the green gate above says nothing about these 16."

measured_flags:
  # D-235-21 — measured in the operator's own backend/.env, never assumed from a default.
  WATCH_PROCESS_ENABLED: "true"
  SCHEDULER_PROCESS_ENABLED: "true"
  SCHEDULER_POLL_INTERVAL_SECONDS: "60"
  watch_run_history_retention: 200
  watch_poll_interval_seconds: 60

gaps:
  - truth: "SC#1 — a person opens a source and sees, for every run, how many files were added, skipped and failed, and the reason for each failure in plain language they can act on"
    status: partial
    severity: BLOCKER
    reason: >
      The run history renders ONE AGGREGATE — `Checked {ago} · {N} files`, where N is the sum of all
      six counts — and a TICK-level failure sentence. The approved sketch (variant B, the binding
      BUILD-CONTRACT) renders a BREAKDOWN per run (`3 added · 1 updated · 2 missing at source ·
      1 could not be read`) and a `fail-reason` that names the FILE and its per-file reason. The six
      counts are stored and are on the wire; they are simply never rendered separately. This realises
      ROADMAP failure mode #3 verbatim — "the run history shows counts but not the reason a file
      failed, so the one action that fixes it cannot be chosen."
    artifacts:
      - path: "frontend/src/components/sources/RunHistoryList.tsx:73-81,131,146-152"
        issue: "`filesTouched()` sums all six counts into one number; `fail-reason` renders `sourceFailureSentence(run.last_error, connectionName)` — the whole tick's cause, with no filename and no per-file kind."
      - path: "frontend/src/components/sources/sourceHealthVocabulary.ts:152-158"
        issue: "`SENTENCE_FOR_FILE_FAILURE` (password / too_big / unknown) is ORPHANED — grep over `frontend/src` finds it in the vocabulary leaf and its own test file ONLY. No production surface consumes it."
      - path: ".planning/sketches/233-the-source-says-what-it-did/index.html:478-490"
        issue: "The design's own `renderRun` emits the per-category bits AND `<div data-block=\"fail-reason\"><b>{failName}</b> — {COPY.fileFail[failKind]}</div>`. The build emits neither."
      - path: "backend/app/api/sources.py:245-263"
        issue: "`connector_watch_items` (which DOES carry per-file `state` + `last_error`) is returned only by `GET /sources/watches/{id}`, and no frontend module calls it — grep for `listWatchItems` / `/items` in `frontend/src` returns nothing."
    missing:
      - "Render the six counts as the sketch's per-category bits instead of one summed `N files`."
      - "Render a per-FILE fail-reason (filename + `SENTENCE_FOR_FILE_FAILURE[kind]`), which needs the run row or the items route to carry which file failed and why."
      - "⚠ The composition fence could NOT catch this: it asserts block PRESENCE by testid, and both `sources-run` and `sources-fail-reason` are present. Content drift is invisible to it."

  - truth: "SC#2 — a stopped source says WHEN it last succeeded"
    status: partial
    severity: WARNING
    reason: >
      `/sources/health` computes `last_good_at` over a FIVE-row window
      (`_HEALTH_RUN_WINDOW = max(5, SOFT_FAILURE_THRESHOLD + 1)`). A source that has failed more
      ticks than that window is deep reports `None`. ⭐ THE OVERCLAIM RISK IS CORRECTLY CLOSED —
      the card renders `COPY.neverRead` only when `provenNeverRead` is true (the UNBOUNDED run list
      has been fetched and holds no success), so a long-dead source is never libelled as
      "never read". But the consequence is SILENCE: at rest the card and the Health row render
      NEITHER "last read successfully on X" NOR anything else, and SC#2's sentence is "says when it
      last succeeded". The answer is one click away (History), not on the screen.
    artifacts:
      - path: "frontend/src/components/sources/WatchedFoldersSection.tsx:872-876"
        issue: "`lastGoodBand !== null ? lastGood : provenNeverRead ? neverRead : null` — the third arm renders nothing."
      - path: "frontend/src/components/library/SourcesAttentionSection.tsx:110,134"
        issue: "A null `last_good_at` renders no last-good line at all on the Health row."
    missing:
      - "Either widen the verdict window, or have the card fetch the unbounded history when a stopped verdict arrives, so the last-good instant is on screen rather than behind an expansion."

  - truth: "SC#2 — the ONE control offered actually fixes that source's cause"
    status: partial
    severity: WARNING
    reason: >
      The cause→control map IS data (`CONTROL_FOR_CAUSE`), consumed with no per-cause branch —
      D-235-11 verified. BUT a DISABLED CONNECTION is not in the cause table. `health_verdict.py`
      treats every non-`success` status as part of the failure streak, and that deliberately includes
      `paused` (the connection-disabled arm, `watch_service.py` seam 2, which writes
      `status="paused", failure_cause=None`). After 3 paused ticks the source is promoted to
      `stopped` with `cause = "unknown"`, so the surface says "It stopped, and no reason was
      recorded." and offers "Retry now" — a control that cannot fix a disabled connection, on a
      state a person or operator chose deliberately.
    artifacts:
      - path: "backend/app/services/sources/health_verdict.py:61-66,111-140"
        issue: "`SUCCESS_STATUS = \"success\"` is the only streak terminator; `paused` counts toward it and resolves to `UNNAMED_CAUSE`."
      - path: "backend/app/services/watch_service.py (seam 2, connection-disabled arm)"
        issue: "Writes `status=\"paused\", failure_cause=None` every tick while the connection is disabled."
      - path: "frontend/src/components/sources/WatchedFoldersSection.tsx:218-220"
        issue: "`classifyWatch` consults the server's `stopped[]` BEFORE `!watch.is_active`, and `is_active` is the WATCH's flag, not the CONNECTION's `is_enabled` — so the paused-connection case lands in `stopped`, not `paused`."
    missing:
      - "Either exclude `paused` from the failure streak, or add a `connection_disabled` cause with its own sentence and its own control."

  - truth: "SC#3 — the signal reaches a person where they already are, on any surface"
    status: partial
    severity: WARNING
    reason: >
      ⭐ THE HEADLINE SUSPICION IS HALF-REFUTED AND HALF-CONFIRMED. A mobile home WAS built and is
      real in the shipped code — the drawer's Library nav button carries `drawer-attention-badge`
      and the drawer-opening hamburger carries `drawer-trigger-dot`, both fed from ChatLayout's
      single read. So SURF-03 is NOT closed against a desktop-only surface. BUT the only control
      that OPENS the drawer lives inside `ChatArea`, i.e. inside the chat view. `NavPanel` is
      `hidden md:flex`, and every non-chat view mounts in ChatLayout's bare `<main>` branch with no
      drawer trigger. So at mobile width a person on Library, Workflows, Skills, Connections,
      Settings or the run surface sees NO signal (and in fact no navigation control at all). The
      phase MEASURED this and recorded it as `SEED-253` rather than claiming coverage.
    artifacts:
      - path: "frontend/src/components/layout/ChatLayout.tsx (the `onOpenDrawer` prop)"
        issue: "`onOpenDrawer={() => setDrawerOpen(true)}` is passed to `<ChatArea>` and to nothing else."
      - path: "frontend/src/components/chat/ChatArea.tsx:455-470,486,560"
        issue: "Both drawer triggers (`md:hidden`) are inside the chat view; `attentionDot` rides on them."
      - path: ".planning/seeds/SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md"
        issue: "The gap is recorded with a two-part trigger. Pre-existing, not created by 235 — but it caps SURF-03's mobile reach at the chat view."
    missing:
      - "Nothing in this phase — the fix is a navigation change with its own sketch (SEED-253's own argument, and G-7's own rule). Recorded as OWED, with the trigger already written."

  - truth: "D-235-05 — ONE reader of the source verdict per render tree"
    status: failed
    severity: WARNING
    reason: >
      `attentionConditions.ts`'s own docblock states "⛔ A second `useSourceAttention()` call
      anywhere in the same tree means two polls and, eventually, two disagreeing answers." The
      shipped tree has TWO. `ChatLayout` calls the registry, and `LibraryPage`'s active tab body
      calls the hook again — `IngestionTab.tsx:167` on the Ingestion tab, `SourcesAttentionSection`
      on the Health tab. Radix unmounts inactive `TabsContent` (no `forceMount`), so the count is
      two, not four. Practical impact is a doubled poll rate, not divergence (both read the same
      server verdict), but the in-code invariant is contradicted by the shipped code and
      `ChatLayout.badge.test.tsx`'s `toHaveBeenCalledTimes(1)` cannot see it because it does not
      mount the Library.
    artifacts:
      - path: "frontend/src/components/layout/attentionConditions.ts (⚠ ONE READER PER RENDER TREE block)"
        issue: "States an invariant the tree violates whenever the Library is open."
      - path: "frontend/src/components/library/IngestionTab.tsx:167"
        issue: "Second `useSourceAttention()` in the same tree as ChatLayout's."
      - path: "frontend/src/components/library/SourcesAttentionSection.tsx:161"
        issue: "Third call site (mutually exclusive with the one above, by tab)."
    missing:
      - "Either thread the verdict down from ChatLayout, or amend the docblock to state the real rule (one reader per MOUNTED SUBTREE) so a future author is not misled."

  - truth: "The Library returns to its own default tab on every entry that did not ask for Health"
    status: failed
    severity: WARNING
    reason: >
      `App.tsx` sets `libraryTab = \"health\"` in `handleOpenLibraryHealth` and NEVER resets it —
      `grep setLibraryTab frontend/src/App.tsx` returns exactly one write. `ChatLayout` renders
      `<LibraryPage>` inside a ternary, so the page UNMOUNTS on navigation away and re-seeds its
      reducer from `initialTab` on every return. After one badge-popover click, every subsequent
      entry into the Library opens on Health instead of `initialLibraryState`'s `documents`. This
      directly contradicts the claim in `App.tsx`'s own comment: "`undefined` means 'the page
      decides', so the Library keeps its own default on every other entry into it."
    artifacts:
      - path: "frontend/src/App.tsx:176-180"
        issue: "`setLibraryTab(\"health\")` with no reset; `onNavigate` is the raw `setActiveView`."
      - path: "frontend/src/pages/LibraryPage.tsx (the lazy reducer initializer)"
        issue: "`initialTab` seeds on every mount, and the page remounts on every re-entry."
      - path: "frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx"
        issue: "Its 'not stuck on a tab' case covers WITHIN-mount transitions only, so it cannot fire on this."
    missing:
      - "Clear `libraryTab` back to `undefined` after the Library has consumed it (or on the next `onNavigate` away)."

deferred:
  - truth: "SC#1's per-file failure reason needs a per-file writer"
    addressed_in: "not scheduled — no later phase in this milestone claims it"
    evidence: "Phases 236 (corpus attack), 237 (rule engine) and beyond do not name source run history. This is a REAL gap, not a deferred one — recorded here so it is not read as scheduled."

human_verification:
  - test: "Break a real watch (revoke the Google Drive grant), then sit on the CHAT page and wait one poll interval. Observe the rail badge appear, open the popover, read the source name and the cause sentence, click through to Library Health, then Go to source, then press the one control."
    expected: "Badge appears on a page that is not the Library; the popover names the source; the control matches the cause (Reconnect for a revoked token) and fixes it."
    why_human: "G-4 M-1. 'Reaches a person' is a felt judgement no wire format settles, and the whole revoked-token path has only ever been driven against stubs. This is the single highest-value row."
  - test: "Interrupt the network for ONE tick, restore it, and confirm nothing fires. Then interrupt for three consecutive ticks and confirm it does."
    expected: "No badge after one recovered failure; badge on the third."
    why_human: "G-4 M-2. Cry-wolf is only observable over time. The algorithm is proven by 108 green backend tests; the LIVE behaviour is unexercised."
  - test: "Press Sync now on a healthy watch and watch the three states in order."
    expected: "'Asked · next check within 60 seconds' → then the real outcome 'Checked N minutes ago · …'. Never the word 'scheduled', and never a state that self-expires on a timer."
    why_human: "G-4 M-3. D-235-16's clear-on-`last_run_at`-advance is a live timing behaviour."
  - test: "Set WATCH_PROCESS_ENABLED=false, restart the backend, open the Library Ingestion tab."
    expected: "The instance statement appears EXACTLY ONCE above the sub-tabs; every card reads 'Waiting — the reader is off'; NO card is marked individually broken and the rail badge stays at zero."
    why_human: "G-4 M-4. The 'once, not per row' property is visual. ⚠ The operator's env currently holds true, so this state has not been seen since the change."
  - test: "UPDATE connector_connections SET config = '\"broken\"'::jsonb WHERE id = <one id>, then reload the Ingestion tab."
    expected: "That ONE row renders as a named degraded row ('This source could not be read here — the others are unaffected.'); every other source still renders; the list is not a 500 and nothing silently vanishes."
    why_human: "G-4 M-5 / SEED-239. The blast radius is the point, and the boundary has only been driven against a stubbed pool."
  - test: "At mobile width (< 768px), with a stopped source, navigate to Library and look for any signal or navigation control."
    expected: "Currently: NOTHING. Confirm the operator accepts SEED-253's deferral rather than treating SURF-03 as fully closed."
    why_human: "Breakpoint behaviour and the operator's own judgement on whether chat-only mobile reach satisfies SURF-03."
---

# Phase 235: The Source Says What It Did — Verification Report

**Phase Goal:** A watch that has stopped reading tells somebody who is not already looking at it, says when it stopped, and offers the one action that fixes it — and a person can always see what the last sync actually did rather than inferring it from what appeared.

**Verified:** 2026-09-06 · merge base `ef18e8552` → HEAD `d9c15a77e`
**Status:** `gaps_found`
**Re-verification:** No — initial verification.

---

## ⭐ The single most important finding

**The phase's own largest self-declared OWED item is DISCHARGED — by measurement, not by argument.**

`deferred-items.md` closes with *"`release_watch` swallows its INSERT — nothing yet proves a run row was STORED"*, and both plans 01 and 05 record the same doubt. I queried the operator's live local Postgres:

```
connector_sync_runs table: connector_sync_runs
row count: 9
  {'started_at': 2026-09-06 06:35:48Z, 'finished_at': 06:35:50Z, 'status': 'success',
   'failure_cause': None, 'listing_complete': True, 'count_new': 0, ...}
  … 8 more, one every 30 minutes, matching connector_watches.interval_minutes = 30
rls enabled: True
policies: connector_sync_runs_select / _insert / _update / _delete
watch: 2ea283d3-… is_active=True last_run_at=06:35:48Z last_status='success' next_run_at=07:05:48Z
```

Nine rows, written by the **live watch loop** against a **real Google Drive connection**, at the real cadence, with `WATCH_PROCESS_ENABLED=true` measured in `backend/.env`. Migration 172 is applied, RLS is on, four policies exist, both indexes exist. **SC#1's foundation is not an unverified write — it is observed fact.** The quiet-run rows (`count_new: 0`) also prove D-235-07 live: every tick gets a row, which is what makes *"when did it last successfully READ"* answerable.

**And the finding that costs the phase its pass sits one layer above that solid foundation: the run row is stored honestly and rendered dishonestly-by-omission.** The six counts reach the browser and are collapsed into a single `N files`; the sketch's per-file `fail-reason` — filename plus `COPY.fileFail[kind]` — was ported into the vocabulary as `SENTENCE_FOR_FILE_FAILURE` and then **consumed by nothing**. That is ROADMAP failure mode #3 realised inside the phase written to prevent it.

---

## Goal Achievement — the four ROADMAP Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A person opens a source and sees **every run it has made** — when it ran, counts added/skipped/failed, and the reason for **each failure** in plain language they can act on (SURF-02) | ⚠ **PARTIAL** (blocking) | Every run + when it ran: **VERIFIED LIVE** (9 stored rows; `GET /sources/watches/{id}/runs` registered and 403-gated; `RunHistoryList` mounts on expansion at `WatchedFoldersSection.tsx:921`). Counts breakdown: **NOT MET** — `filesTouched()` sums all six into one number. Per-file reason: **NOT MET** — `SENTENCE_FOR_FILE_FAILURE` orphaned; `fail-reason` renders the tick-level cause. |
| 2 | A stopped source **says it stopped**, says **when it last succeeded**, offers **ONE control that fixes it**, never silently quiet (LIB-10) | ⚠ **PARTIAL** | Says it stopped: **VERIFIED** (`WatchedFoldersSection.tsx:865-878`). One control: **VERIFIED as DATA** — `CONTROL_FOR_CAUSE[cause]` at `:637`, zero per-cause branches. Never silently quiet: **VERIFIED** (degraded row named, never dropped). When it last succeeded: **PARTIAL** — 5-row window; a longer-dead source renders nothing at rest (correctly refusing to overclaim, but also not answering). Plus: a **disabled connection** resolves to cause `unknown` → "Retry now", a control that cannot fix it. |
| 3 | A person who has **not** opened the sources screen finds out a watch is broken — the signal reaches them where they already are (SURF-03) | ⚠ **PARTIAL** | Desktop: **VERIFIED structurally** — `NavPanel` is app-shell and mounts on every view; badge + `AttentionPopover` on the Library `RailItem`; full chain `App → ChatLayout → NavPanel → popover → onOpenLibraryHealth → LibraryPage(initialTab) → HealthTab → SourcesAttentionSection → onGoToSource → scroll to `watch-card-{id}`` traced end-to-end in code. Mobile: **PARTIAL** — the drawer badge and hamburger dot ARE built, but the only drawer trigger lives in `ChatArea`, so non-chat mobile views carry no signal (`SEED-253`). Live behaviour: **unexercised** → G-4 M-1. |
| 4 | That signal does **not** fire for a healthy source, nor for a single transient failure the next check recovered from (SURF-03, LIB-10) | ✓ **VERIFIED** (algorithm) · ⚠ one warning | `health_verdict.verdict_for_runs`: streak counts only LEADING non-successes and resets on any success; hard cause stops on 1, soft needs `SOFT_FAILURE_THRESHOLD = 3`; zero rows → `never_read`, explicitly not stopped. Client derives **nothing** — `useSourceAttention` passes `stopped[]` through untouched. 108 backend tests green across the five phase suites. ⚠ WARNING: `paused` counts toward the streak, so a deliberately disabled connection fires the badge after 3 ticks. Live: **unexercised** → G-4 M-2. |

**Score:** 1/4 fully verified · 3/4 partial · 0/4 outright failed.

---

## The six "How we'd know this failed" modes

| # | Failure mode | Prevented? | Evidence |
|---|---|---|---|
| 1 | A watch dead for a week, discoverable only by opening its page | ⚠ **partly** | Desktop: prevented (shell badge on every view, polled). Mobile outside chat: **not prevented** — no trigger, no rail, no signal (`SEED-253`). |
| 2 | The signal fires on every transient blip until people stop reading it | ✓ **prevented** | Server-only debounce, threshold 3 for soft causes, streak resets on success, no client re-derivation. One exception: `paused`. |
| 3 | Run history shows counts but not the reason a file failed, so the one action cannot be chosen | ⛔ **NOT PREVENTED** | One aggregate count; tick-level reason only; `SENTENCE_FOR_FILE_FAILURE` orphaned; `connector_watch_items` (which holds the per-file reason) has no frontend consumer at all. **This is the phase's headline gap.** |
| 4 | `SURF-03` closed against the Health tab — the surface the requirement says is not enough | ✓ **prevented** | The shell signal is BUILT and WIRED (`attentionConditions.ts` registry, `AttentionPopover`, rail badge, drawer badge, hamburger dot). Health is the second half, per D-235-01, not the whole answer. |
| 5 | One broken connection makes every source's history unreadable (`SEED-239`) | ✓ **prevented** | `_enrich_watch_rows` wraps EVERY row in its own `try/except` and returns `_degraded_watch_record` — never dropped, never a 500; `degraded_reason` is a token + exception CLASS name, never `str(exc)`. `/sources/health` has the same per-row boundary. `test_sources_degraded_row.py` green. |
| 6 | The run list driven purely off Realtime, going stale on reconnect with no fetch reconcile | ✓ **prevented** | No Supabase Realtime anywhere in this phase. `useSourceAttention` POLLS on the server-named cadence with abort-on-newest; the run list is fetched on expansion. ⚠ Minor: `openHistory()` caches `runs` for the mount's lifetime and never re-fetches, so an open history goes stale within a session. |

---

## The five claims most likely to be false — tested individually

| Claim under test | Verdict | What I measured |
|---|---|---|
| ⛔ **`SURF-03` and the mobile home** — plan 09 claims it built one; `NavPanel` is `hidden md:flex` | **HALF-REFUTED / HALF-CONFIRMED** | The mobile home is REAL in shipped code: `ChatLayout.tsx` renders `drawer-attention-badge` on the drawer's `documents` nav button and passes `attentionCount` to `ChatArea`, which renders `drawer-trigger-dot` on both `md:hidden` triggers. So the suspicion that SURF-03 was closed desktop-only is **wrong**. But the drawer's only opener is inside `ChatArea` → the mobile signal reaches the chat view and nothing else. The phase measured this itself and planted `SEED-253` rather than overclaiming. |
| ⛔ **The run row is never proven STORED** | **REFUTED — decisively** | 9 real rows in `connector_sync_runs` on the live DB, one per 30-minute tick, written by the live loop. See the headline section. This discharges the phase's own largest OWED item. |
| ⛔ **The 16 fence reds — is any of them a MISSING SURFACE?** | **CONFIRMED as plan 12 stated — none is** | I re-ran the fence myself: `Tests 16 failed | 33 passed (49)`. Spot-checked three groups. (a) **rail ×5** — `mountScreen("rail")` at `sourceComposition.test.tsx:424-448` mounts `NavPanel` with **no** `attentionConditions` and **no** `onOpenLibraryHealth`; NavPanel's contract is silence for an unwired caller (`:161-163`), so this is a HARNESS defect. The badge and popover demonstrably exist. (b) **`sources-instance-statement` ×2** — `primeMocks` sets `reader_running: true` (`:405`) and `SourceReaderStatement` returns `null` when the reader runs (`WatchedFoldersSection.tsx:127`); FIXTURE defect. (c) **`sources-toggle-quiet`** — it is unconditionally rendered by `RunHistoryList`, which mounts only after `openHistory()`; BEHIND-A-CLICK defect. Plus **`sources-tab-*` ×2**, which genuinely need a `data-testid` on `LibraryPage`'s shipped `TabsTrigger`s — a test hook, not a surface. Plan 12's classification holds. |
| ⛔ **`last_good_at` window-limited to 5 — does any surface render null as "never"?** | **REFUTED — the overclaim is closed** | `WatchedFoldersSection.tsx:872-876` gates `COPY.neverRead` on `provenNeverRead = runs !== null && !runs.some(r => r.status === "success")` — i.e. only after the UNBOUNDED list has been fetched. `SourcesAttentionSection.tsx:134` renders nothing on null. **No overclaim.** The residual gap is silence, not a lie — recorded as a PARTIAL against SC#2, not as the failure suspected. |
| ⛔ **Cause→control (D-235-11) — is the map DATA and does the rendered control match the cause?** | **VERIFIED, with one uncovered cause** | `CONTROL_FOR_CAUSE` is a `Record` keyed by the union (`sourceHealthVocabulary.ts:129-140`); the card reads `CONTROL_FOR_CAUSE[cause]` once at `:637` and renders `control.label(connectionName)` with **zero** per-cause branches. token_revoked→Reconnect {name}, folder_gone→Pick a different folder, unreachable/unknown→Retry now — matching the BUILD-CONTRACT §1b table exactly. Reader-off is an operator SENTENCE, not a member button (`SourceReaderStatement`). ⚠ **A disabled connection has no cause of its own** and falls to `unknown`→Retry now. |
| ⛔ **D-235-12 — the instance statement said ONCE, not per card, and no watch marked individually broken** | **VERIFIED** | `SourceReaderStatement` is mounted exactly once, at `IngestionTab.tsx:180`, ABOVE the sub-tabs. `classifyWatch` returns `"waiting"` (not `"stopped"`) when the reader is off, with the row label `COPY.readerOffRow = "Waiting — the reader is off"`. The rail badge counts only the server's `stopped[]`, which is derived from run history and never from the reader flag — so a reader-off instance shows **zero** on the badge. |
| ⛔ **D-235-21 — the operator's ACTUAL flag values, measured** | **VERIFIED — MEASURED** | Read from `backend/.env`: **`WATCH_PROCESS_ENABLED=true`**, `SCHEDULER_PROCESS_ENABLED=true`, `SCHEDULER_POLL_INTERVAL_SECONDS=60`. Settings object confirms `watch_process_enabled=True`, `watch_run_history_retention=200`, `watch_poll_interval_seconds=60`. ⭐ This is the flag Phase 234 shipped OFF; it is now ON, and the 9 stored run rows are the proof it is genuinely running. The endpoint additionally refuses to trust it — `/sources/health` reads `app.state.watch_service is not None`, the LIVE object, not the setting. |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/172_connector_sync_runs.sql` | The run-history table | ✓ VERIFIED — **applied live** | Table exists in the local DB with all 17 columns, RLS enabled, 4 policies, both indexes. `supabase/full-schema.sql` regenerated (+155 L). |
| `backend/app/db/watches.py` | Writer + prune + two reads | ✓ VERIFIED | Insert+prune in ONE CTE statement, `retain` bound as `$15`, `GREATEST($15 - 1, 0)` correct. `list_sync_runs` and `recent_runs_by_watch` both carry `AND user_id = $2` in SQL (the pool is not RLS-gated). |
| `backend/app/services/watch_service.py` | All FOUR release seams write | ✓ VERIFIED | Seams 1 (tick crash), 2 (connection disabled), 3 (happy path), 4 (403/VIS-04) all pass counts + `listing_complete` + `failure_cause` + `started_at`. `started_at` captured at tick start, not read back from `last_run_at` (which the claim already set). `record_skipped_still_running` import DELETED, not wired — argued structurally. |
| `backend/app/services/sources/failure_cause.py` | Hard/soft as DATA | ✓ VERIFIED | `HARD_CAUSES` frozenset, `SOFT_FAILURE_THRESHOLD = 3`, `is_hard` reads the set with no branch, `Cause` is a one-line greppable `Literal` (bound by the frontend's `?raw` fence). Zero DB/service imports. |
| `backend/app/services/sources/health_verdict.py` | The ONE debounce decider | ✓ VERIFIED | Pure; no I/O; imports the threshold rather than re-declaring it. `never_read` separated from "zero failures". |
| `backend/app/api/sources.py` | 2 new reads + the honesty fix + the per-row boundary | ✓ VERIFIED — **routes live** | `/sources/health` and `/sources/watches/{id}/runs` both present in the running backend's OpenAPI and both return 403 unauthenticated. `/sync` refuses with `status="refused"` when the live reader is absent, and otherwise answers `status="asked"` + `next_check_within_seconds` — the word "scheduled" is gone. Ownership check precedes the refusal (so a refusal cannot confirm an id). |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | Zero-import vocabulary leaf | ⚠ **VERIFIED but partly orphaned** | Zero imports, 26 COPY keys, cause→sentence and cause→control both keyed by the union, `looksHumanWritten` positive-proof pass-through, honest fallback. **`SENTENCE_FOR_FILE_FAILURE` and `COPY.roster` are rendered by nothing.** |
| `frontend/src/components/sources/RunHistoryList.tsx` | The history a person reads | ⚠ **STUB-BY-OMISSION against the contract** | Quiet-fold, listing-incomplete note and per-tick fail-reason all render. The per-category breakdown and per-file fail-reason the BUILD-CONTRACT specifies do not. |
| `frontend/src/hooks/useSourceAttention.ts` | The one client reader | ✓ VERIFIED (⚠ not the ONLY one) | Polls on the server-named cadence, aborts the previous fetch, keeps the previous verdict on failure, exposes `loading` AND `verdictKnown` (SEED-248's three-state distinction). No Realtime. |
| `frontend/src/components/layout/attentionConditions.ts` | Registry with exactly ONE tenant | ✓ VERIFIED | `Object.freeze([...])`, length 1, hook order fixed by a module constant. |
| `frontend/src/components/layout/AttentionPopover.tsx` | A DOOR, no repair control | ✓ VERIFIED | Uses the shipped Radix dropdown (no new package); trigger is a SIBLING of the rail button, not nested; one action, a callback, no URL. |
| `frontend/src/components/library/SourcesAttentionSection.tsx` | Health = only what is wrong | ✓ VERIFIED | `RunHistoryList` and `CONTROL_FOR_CAUSE` both absent by design; three honest states; one control, `Go to source`. |
| `frontend/src/components/sources/sourceComposition.test.tsx` | The design fence, RED | ⚠ **exists, 16 red, in NEITHER gate knob** | By decision (correct, per G-7 and the "a gate with an allowance is a gate that cannot fail" rule). Excluded loudly in 4 places; two-part re-open trigger recorded. **But nothing currently guards the surfaces it names.** |

---

## Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `WatchService.sync_watch` (4 seams) | `connector_sync_runs` | `release_watch(..., counts=, listing_complete=, failure_cause=, started_at=)` | ✓ **WIRED — proven by 9 live rows** |
| `GET /sources/watches/{id}/runs` | `list_sync_runs` | owner predicate in both layers | ✓ WIRED (route live, 403-gated) |
| `GET /sources/health` | `verdict_for_runs` | `recent_runs_by_watch(per_watch=5)` | ✓ WIRED (route live) |
| `/sources/health` | live reader fact | `getattr(request.app.state, "watch_service", None)` | ✓ WIRED — reads the OBJECT, never the setting |
| `useSourceAttention` | `ChatLayout` | `ATTENTION_PRODUCERS.flatMap(p => p.use(openLibraryHealth))` | ✓ WIRED |
| `ChatLayout` | `NavPanel` rail badge | `attentionConditions` + `onOpenLibraryHealth` props | ✓ WIRED |
| `ChatLayout` | mobile drawer badge | `showAttention && view === "documents"` | ✓ WIRED |
| `ChatLayout` | `ChatArea` hamburger dot | `attentionCount` prop → `attentionDot` | ⚠ **PARTIAL — only reachable inside the chat view** |
| `AttentionPopover` | Library Health tab | `onOpenLibraryHealth` → `App.handleOpenLibraryHealth` → `libraryTab="health"` + `activeView="documents"` | ⚠ **WIRED but STICKY** — never reset |
| `LibraryPage` | `HealthTab` | `onGoToSource={handleGoToSource}` | ✓ WIRED |
| `SourcesAttentionSection` | the source card | `onGoToSource` → `SELECT_TAB ingestion` + `getElementById('watch-card-'+id)` | ✓ WIRED — the anchor id exists at `WatchedFoldersSection.tsx:700` |
| `RunHistoryList` | per-FILE failure reason | — | ⛔ **NOT WIRED** — `SENTENCE_FOR_FILE_FAILURE` has no consumer |
| `IngestionTab` | `SourceReaderStatement` | one mount, above the sub-tabs | ✓ WIRED |

---

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data? | Status |
|---|---|---|---|---|
| `RunHistoryList` | `runs` | `listSyncRuns(watch.id)` → `GET /sources/watches/{id}/runs` → `list_sync_runs` → **9 real rows** | ✓ | ✓ FLOWING |
| `NavPanel` badge | `attentionConditions` | `useSourceAttention` → `GET /sources/health` → `verdict_for_runs` over stored rows | ✓ (currently empty — the one live watch is healthy) | ✓ FLOWING |
| `SourceReaderStatement` | `readerRunning` | `app.state.watch_service is not None` | ✓ (`true` on this instance) | ✓ FLOWING |
| `SourcesAttentionSection` | `stopped` | same verdict, same hook | ✓ | ✓ FLOWING |
| `RunHistoryList` fail-reason | `run.last_error` | stored `last_error` on the run row | ✓ but TICK-scoped | ⚠ **HOLLOW against the contract** — the design's data point (which FILE, and why) is not carried |
| `COPY.roster` / `SENTENCE_FOR_FILE_FAILURE` | — | — | — | ⚠ ORPHANED (roster self-declared; file-failure table NOT self-declared) |

---

## Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Migration 172 applied and RLS on | asyncpg against `settings.postgres_dsn` | table present, 17 columns, RLS `True`, 4 policies | ✓ PASS |
| Run rows actually persisted | `select count(*) from connector_sync_runs` | **9**, one per 30-min tick | ✓ PASS |
| Both new routes registered on the live backend | `GET /openapi.json` | `/sources/health`, `/sources/watches/{watch_id}/runs` present | ✓ PASS |
| Routes are auth-gated | `curl` unauthenticated | `403` on both | ✓ PASS |
| Operator flag value (D-235-21) | read `backend/.env` | `WATCH_PROCESS_ENABLED=true` | ✓ PASS |
| Phase 235 backend suites | `pytest tests/unit/{api,services,db}/…6 files… -q` | **108 passed** | ✓ PASS |
| Composition fence | `npx vitest run src/components/sources/sourceComposition.test.tsx` | `16 failed | 33 passed (49)` | ⚠ as declared |
| No debt markers in phase source | grep `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` over 17 modified source files | **zero hits** | ✓ PASS |
| Ledger same-commit sync | every new file has a CLAUDE.md row AND a `docs/HOT-FILE-LEDGER.md` section | 28 rows added, all 9 new leaves have sections | ✓ PASS |

---

## Gates — re-run, verdicts verbatim

```
count gate OK — 237/237 pinned files present, no per-file decrease, 0 failing.
  total                                      6985    7715    +730
  total 7715  ·  failed 0  ·  pinned total 6985
```
Exit 0. ⚠ The composition fence is in **neither** knob, so this green says nothing about its 16 reds. Eleven of the phase's new suites ARE pinned in both knobs (verified per basename in `scripts/vitest-count-gate.cjs`).

```
71 failed, 3888 passed, 2 xfailed, 2 xpassed, 44 warnings in 267.31s (0:02:16)
```
0 collection errors. **This is AT CLAUDE.md's ceiling of 71 and ONE BELOW the phase's own measured merge-base baseline of 72** — so no new failure, and if anything one fewer than expected. Nothing was re-pinned. No failing test names any source/watch/health module (the only near-match, `test_phase56_iteration_start`, is a `threads.py` fence with no relation to this phase).

```
  CLAUDE.md                                  117742 chars   78.5% of limit  headroom   32258  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```
Exit 0.

---

## Decision coverage — spot-checked IN CODE, not in a `must_haves` list

| Decision | Honoured in code? | Evidence |
|---|---|---|
| D-235-01 B+A | ✓ | Shell signal built AND Health section built; Health alone was not used to close SURF-03. |
| D-235-02 email deferred | ✓ | Not built; trigger recorded on `SEED-231` (which the diff shows edited +42/-4). |
| D-235-03 registry, ONE tenant | ✓ | `ATTENTION_PRODUCERS` frozen, length 1. |
| D-235-04 rail badge + popover, `onNavigate` not URL | ✓ | `AttentionPopover` contains no `location`/hash; the action is a callback. Badge anchors on `RailItem`'s `relative`, working at both 40px and full-width. |
| D-235-05 server-computed verdict, one place | ⚠ **partial** | The THRESHOLD is server-only and the client derives nothing ✓. But "ONE reader per render tree" is violated — 2 concurrent pollers whenever the Library is open. |
| D-235-06 watch loop writes its own row | ✓ | Written in `release_watch`, not derived from `ingestion_jobs`. |
| D-235-07 every tick gets a row | ✓ **proven live** | 9 rows, all quiet, all stored. |
| D-235-08 prune-on-write, N a knob | ✓ | `settings.watch_run_history_retention = 200`, bound as `$15`, `retain - 1` arithmetic correct. Unexercised against live overflow. |
| D-235-09 new sibling vocabulary leaf | ✓ | Zero imports; five binding rules; honest fallback byte-identical to `ingestionErrorVocabulary.ts`. |
| D-235-10 cause-dependent promotion | ✓ | Hard on 1, soft at 3, as DATA. |
| D-235-11 cause→control table-driven | ✓ | One lookup, zero branches. ⚠ No cause covers a disabled connection. |
| D-235-12 instance statement ONCE | ✓ | One mount above the sub-tabs; rows read "waiting", never "stopped"; badge stays zero. |
| D-235-13 per-row boundary + degraded row | ✓ | `try/except` per row; `_degraded_watch_record`; `degraded_reason` is a token + class name, never `str(exc)`. |
| D-235-14 three-part Sync honesty | ✓ | Refuse / outcome / pending all present. |
| D-235-15 ⛔ do NOT sync inline | ✓ | The route still only sets `next_run_at = now()`. |
| D-235-16 "Asked · next check within N" | ✓ | Cleared only when `last_run_at` advances past the click, never on a timer. |
| D-235-17 Ingestion=all / Health=only-wrong | ✓ | `RunHistoryList` deliberately not imported by the Health section. |
| D-235-18 `BUG-260906-01` fixed pre-phase | ✓ | Shipped at `15abba50a` / `26a93b069` before the phase. |
| D-235-19 G-2 sketch honoured | ✓ | Sketch 233 exists with a generated BUILD-CONTRACT; ⚠ the build drifted from it on the run row (gap 1). |
| D-235-20 migration is 172 | ✓ | `172_connector_sync_runs.sql`; ROADMAP detail block corrected. |
| D-235-21 measured flag values | ✓ | Measured and recorded above. |

---

## Requirements Coverage

| Req | Description | Status | Evidence |
|---|---|---|---|
| **SURF-02** | A person can see what a sync actually did — per-source run history with counts and errors | ⚠ **PARTIAL** | History exists and is real; **counts are aggregated and per-file errors are absent**. |
| **LIB-10** | A stopped source says so, says when, offers the one action | ⚠ **PARTIAL** | Says so ✓; one action ✓ (as data); "when it last succeeded" silent past the 5-row window; disabled connection mis-narrated. |
| **SURF-03** | A broken watch reaches a person not already looking at the page | ⚠ **PARTIAL** | Desktop-any-view ✓ (structurally); mobile chat-view ✓; mobile non-chat ✗ (`SEED-253`); live behaviour **unexercised**. |

⚠ None of the three should be flipped to `Complete` in `REQUIREMENTS.md` on this verification.

---

## The three verdicts, separated

**FAILED — built and does not work / does not meet the criterion**
1. The run history's per-category counts and per-file failure reason (SC#1, ROADMAP failure mode #3). `SENTENCE_FOR_FILE_FAILURE` orphaned.
2. `libraryTab` is never reset — the Library sticks on Health after one popover click, contradicting the code's own comment.
3. D-235-05's "ONE reader per render tree" — two concurrent pollers whenever the Library is open.
4. A disabled connection is narrated as an unexplained stop with an unhelpful control.

**UNEXERCISED — built, plausibly correct, never driven against reality**
- The entire stopped-source path end to end: no watch on this instance has ever failed. The 9 stored rows are all `success`. → **G-4 M-1** (revoke a real Drive grant) settles it, and would also settle the cause classifier, the sentence, the control, the badge and the popover in one drive.
- SC#4's non-firing behaviour over time. → **G-4 M-2**.
- The Sync pending window's three states in order. → **G-4 M-3**.
- The reader-off surface: `WATCH_PROCESS_ENABLED` is `true`, so nobody has seen the instance statement since it was written. → **G-4 M-4**.
- `SEED-239`'s degraded row against a real malformed `config`. → **G-4 M-5**.
- The retention prune against live overflow (200 rows; current max is 9).

**OWED — deliberately deferred, with a trigger**
- The composition fence's 16 reds and both gate knobs — two-part trigger recorded in `deferred-items.md` and in `scripts/vitest-count-gate.cjs` twice.
- Migration 172's grant narrowing — waits on measuring the pool's DB role.
- Option C (email on permanent failure) — two-part trigger on `SEED-231`.
- `SEED-253` — the mobile drawer trigger outside chat.
- `COPY.roster` — a one-line render, owner named.
- The 26-key `COPY` pin blocking four plans' orphaned labels.
- `SettingsPage.a11y.test.tsx` ×4 — inherited, re-argued from the import graph at three separate plans, in neither gate knob.
- Five suites the gate runs but does not guard — named, not anonymous.

---

## Gaps Summary

Phase 235 built genuinely more than it claimed in one place and genuinely less in another, and both are measurable.

**More:** its own closing record says *"nothing yet proves a run row was STORED"*, and nine rows on the live database prove it does. The write path, the four release seams, the prune arithmetic, the owner predicates in both layers, the per-row `SEED-239` boundary, the server-only debounce, the reader-off-vs-per-row separation, and the full `App → shell → popover → Health → card` navigation chain are all real, wired, and green across 108 backend tests and a clean count gate.

**Less:** the surface a person actually reads shows a source's history as one summed number and one per-tick sentence, where the approved design shows a per-category breakdown and names the file that could not be read. The vocabulary for the missing half was written, tested, and never mounted — which is the tell. That is ROADMAP failure mode #3 stated word for word, and it is the reason this verification is `gaps_found` rather than `human_needed`.

Everything else is either a small wiring defect with a one-line fix (`libraryTab`, the second poller), a narration gap with no cause row (disabled connection), or an honest deferral the phase itself wrote down with a trigger.

⚠ **G-7 note for the orchestrator:** this is Phase 235's FIRST verification, so gap-closure round 0. The SC#1 gap is a genuine unmet success criterion (`SC#1` and named failure mode #3), which is exactly the condition that justifies a closure round. It is a rendering change inside two files this phase already owns — not a new capability.

---

_Verified: 2026-09-06_
_Verifier: Claude (gsd-verifier) — goal-backward, adversarial. Every table cell above is backed by a file:line, a command output, or a live database query. No SUMMARY.md claim was accepted as evidence._
