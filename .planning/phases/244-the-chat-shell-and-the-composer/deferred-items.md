# Phase 244 — deferred items (out-of-scope discoveries)

Opened by `244-03`. Append, never rewrite — a later plan's entry goes at the bottom.

---

## D-1 · `ChatHistoryColumn.rowIdentity.test.tsx` goes RED between 00:00 and ~02:00 local

**Found by:** `244-03`, running the wave's full count gate at 00:17 local on 2026-09-12.
**Owner:** `244-01` (it authored and pinned the suite).
**Status:** NOT fixed here — out of scope, and editing another plan's test file mid-wave
collides with the registry merge. The fix is one line and is written out below.

**Measured cause, not guessed.** The suite builds its fixtures relative to wall-clock now:

```ts
const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000
// …threads at iso(HOUR) and iso(2 * HOUR)
```

…and the case `FOLDER mode still groups an unscoped thread under an 'Unfiled' HEADER` asserts
`screen.getAllByText("Today").length > 0`.

Between local midnight and 02:00, `NOW - 1h` and `NOW - 2h` fall on the **previous calendar
day**, so the date grouper emits `Yesterday` and `Today` is never rendered. Confirmed at the
moment of the red run:

```
now      : Sat Sep 12 2026 00:19:37 GMT+0400
1h ago   : Fri Sep 11 2026 23:19:37 GMT+0400
same day?: false
```

⚠ **This is reproducible, not a flake.** It was green when `244-01` pinned it at 7 (it ran on
2026-09-11 well before midnight) and it will be green again after ~02:00 local. It re-breaks
**every night**, for two hours, on a shared gate — which is the worst shape for this class of
defect, because the next agent to meet it will read it as drift or as their own fault.

**The fix (one line).** Anchor the clock instead of reading it:

```ts
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-11T12:00:00Z")) })
afterEach(() => { vi.useRealTimers() })
```

…or build fixtures from a midday anchor (`new Date(); d.setHours(12,0,0,0)`) rather than from
`Date.now()`. Either removes the boundary entirely. ⛔ Do NOT "fix" it by deleting the `Today`
assertion — the grouping IS what that case guards.

**Sweep obligation:** any other suite deriving fixtures from `Date.now()` minus hours has the
same trap. Worth one `grep -rn "Date.now() -" frontend/src --include=*.test.tsx` at the phase
close.

---

## D-2 · `LibraryPage.initialTab.test.tsx` — 5000 ms timeouts, shifting failing set

**Found by:** `244-03`, same gate run.
**Owner:** nobody in Phase 244 — the file is untouched by the whole phase.
**Status:** NOT fixed here. Candidate **seventh entry for `SEED-171`**.

**Provably unmodified by `244-03`**, and stronger than that: `LibraryPage.tsx` has **no import
path** to either frontend file this plan changed (`grep -rn 'ChatArea\|MessageItem'
frontend/src/pages/LibraryPage.tsx` → no matches), and the plan's only other production change
is Python. The suite's behaviour at this HEAD is identical to base by construction.

**The failing SET is never the same twice** — SEED-171's defining signature:

| Run | Failing |
|---|---|
| inside the full gate | 2 (`lands on Documents…` STACK_TRACE_ERROR; `lands on Health…` *"Found multiple elements with the role `tab` and name `Health`"*) |
| with one sibling suite | 1 (`lands on Documents…`) |
| **alone, nothing else on the box** | **6**, every one a flat 5000 ms timeout (one at 36 718 ms) |

⛔ **The cap was NOT touched at any point** — `GSD_VITEST_MAX_WORKERS=2` throughout, per the
standing rule that adjusting the cap is measured NOT to fix these. ⚠ *"Failing worse ALONE than
under load"* is the observation that rules oversubscription out here, the same way SEED-171's
"one suite flakes in isolation" did.

⚠ **One green sample would prove nothing and there wasn't one** — this suite was red on all
three invocations. It is named rather than left unlooked-for.
