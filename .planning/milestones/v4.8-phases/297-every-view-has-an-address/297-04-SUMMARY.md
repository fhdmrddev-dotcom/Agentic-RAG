---
phase: 297-every-view-has-an-address
plan: 04
subsystem: frontend-routing
tags: [frontend, routing, vercel, nginx, parity, uat]

requires:
  - phase: 297-02
    provides: "frontend/src/lib/appRoutes.ts: VIEW_PATHS (Record<ActiveView,string>) and formatAppRoute, the route table the parity inputs are generated from"
provides:
  - "frontend/src/__tests__/routing/appRouteParity.test.ts: the LINK-08 three-layer parity suite (78 cases), inputs generated from the route table"
  - "frontend/src/__tests__/routing/routingLayers.testutil.ts: resolveVercel (moved from docsVercelRouting, D-41), followVercelRedirect, resolveNginx, middlewareRewritesAppHost"
  - "evidence/297-04-planted-red.txt: the suite reds against a planted mismatch in nginx.conf, vercel.json and devRouting.ts, each restored byte-identical"
  - "297-VALIDATION.md: the owed UAT scaffold (D-27 four-axis board, G-4 rows 1-5), all unchecked"
affects: [297 verify-work (runs the VALIDATION rows), 299 (tab and entity addresses join the same table and so the same parity suite), 302 REG-08 (previews, out of scope here)]

tech-stack:
  added: []
  patterns:
    - "Parity inputs come from formatAppRoute over Object.keys(VIEW_PATHS): a new view becomes a new parity row with no test edit"
    - "Each layer assertion takes the layer as an argument, so the same helper backs the positive rows and the permanent negative controls"
    - "Config files read as ?raw (vite/client types), never node:fs, so the app typecheck set does not grow"

key-files:
  created:
    - frontend/src/__tests__/routing/appRouteParity.test.ts
    - frontend/src/__tests__/routing/routingLayers.testutil.ts
    - .planning/phases/297-every-view-has-an-address/evidence/297-04-planted-red.txt
    - .planning/phases/297-every-view-has-an-address/297-VALIDATION.md
  modified:
    - frontend/src/docs/__tests__/docsVercelRouting.test.ts
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "resolveNginx evaluates try_files against the same FILESYSTEM set as the Vercel evaluator rather than always returning the last argument; for every app address (never a file) that reduces to the plan's 'last argument' rule, and it keeps /docs (try_files /docs.html =404) correct for any future caller"
  - "resolveNginx THROWS on a regex (~ / ~*) location instead of ignoring it, so a future regex location reds the parity suite instead of being mis-evaluated"
  - "The VALIDATION roster is derived from the MODEL_CAPABILITIES seed with the derive_roster version rule; the file says the runner must re-derive with the DB overlay, because 293's run-time roster differed for 5 of 8 providers"
  - "Last-known provider blockers (Anthropic billing, Moonshot balance, OpenRouter 402) are recorded as 'not re-probed' notes, not as ⛔ verdicts, because this executor probed nothing"

requirements-completed: [LINK-08]

duration: ~35 min (plus two ~10 min full count-gate runs)
completed: 2026-10-28
---

# Phase 297 Plan 04: Routing Parity Suite + VALIDATION Seed Summary

**One vitest suite now checks every address the route table writes, plus the legacy and pre-auth addresses, against all three routing layers: Vite dev (`rewriteDevUrl`), Vercel (the `app.` host, and the apex through its substituted redirect) and the one-box nginx. Each layer must answer `app.html`. A planted mismatch in each config file turned it red, and all four config files ship byte-identical to base.**

## Performance

- **Started:** 2026-10-27T19:50Z (approx.)
- **Completed:** 2026-10-27T20:45Z (approx.)
- **Tasks:** 3 / 3
- **Files:** 4 created, 2 modified

## Accomplishments

- `appRouteParity.test.ts` (78 cases, `// @vitest-environment node`). It takes 17 addresses (12 from `formatAppRoute` over every `ActiveView`, 3 legacy, 2 pre-auth) through 4 layers, which makes 68 cases. On top of those: input/shape rules (2), the middleware matcher plus the app-host root (2), the D-13 known-fact row (1) and 5 permanent negative controls.
- Moved the Vercel evaluator from `docsVercelRouting.test.ts` into `routingLayers.testutil.ts` unchanged except that the config is now a parameter (D-41). The docs suite still runs its 8 cases through it, and `grep -c "function resolve("` on that file returns 0.
- Green on the first run with **zero config edits**, as RESEARCH predicted. `git diff 34b51fcce HEAD --stat -- frontend/vercel.json frontend/nginx.conf frontend/middleware.ts frontend/devRouting.ts` is empty.
- The suite was driven RED in each layer: nginx 12 cases red, vercel 8, dev 18. Every restore was proven with matching md5 and `git diff --quiet` exit 0.
- Seeded `297-VALIDATION.md` with 16 owed rows: 8 provider rows, 3 axis rows, and G-4 rows G1-G5.

## Task Commits

1. **Task 1 RED:** `e138da0da` test(297-04): three-layer routing parity over the route table. The suite failed on the missing `./routingLayers.testutil` module. Both count-gate knobs were added in the same commit.
2. **Task 1 GREEN:** `c5a59105b` feat(297-04): shared routing-layer evaluators; parity green with zero config edits (D-26, D-41)
3. **Task 2:** `58aba72a1` docs(297-04): planted-RED evidence for the parity suite
4. **Task 3:** `eea79a356` docs(297-04): seed 297-VALIDATION.md with the owed UAT rows (D-27, D-28, D-44)

## Planted-RED (D-26) — `evidence/297-04-planted-red.txt`

| Layer | Plant | md5 before = after | Red cases | `git diff --quiet` |
|---|---|---|---|---|
| `frontend/nginx.conf` | deleted `location /app/ { … }` | `30ec4dbda1988cf788510110d76557e3` | 12: all 11 `/app/*` nginx rows + the nginx negative control | exit 0 |
| `frontend/vercel.json` | deleted the app-host catch-all rewrite | `f1fb6545332adb0711fcbb6694a4f59d` | 8: app host and apex for `/admin/spend`, `/setup`, `/invite`; the known-fact row; the Vercel negative control | exit 0 |
| `frontend/devRouting.ts` | final return → `"/index.html"` | `0725e26cc8cae56dc207a789093a0f62` | 18: all 17 dev rows + the known-fact row | exit 0 |

How to read the vercel row: when the catch-all is gone, the canonical `/app/*` rows correctly stay green. The `/app` and `/app/(.*)` rewrites carry no host condition, so they still serve `app.html` on every host. The catch-all on its own is what serves `/setup`, `/invite`, `/admin/spend` and bare paths on the app host, so those are the rows that turn red. Each layer reds where the planted config actually changes the answer.

## Gates (this branch, before merge)

- Targeted suites: `appRouteParity` + `docsVercelRouting` + `devRouting` + `vercelRouting`: 4 files, **101 passed** (78 + 8 + 7 + 8). Re-run after every restore, still 101.
- Frontend typecheck `npx tsc -p tsconfig.app.json --noEmit`: 62 error lines at base, 62 after. The set diff shows **0 new and 0 gone**. The new files sit under `src`, so the check does cover them.
- Full count gate on this branch, run once from the repo root with `GSD_VITEST_MAX_WORKERS=2` (cwd verified as this worktree):
  `count gate OK — 529/529 pinned files present, no per-file decrease, 0 failing.` (total 12484 · failed 0 · pinned total 11311)
  Per-file: `appRouteParity.test.ts 78 → 78 (0)`, `docsVercelRouting.test.ts 8 → 8`, `vercelRouting.test.ts 8 → 8`, `devRouting.test.ts 7 → 7`.

## Post-merge wave-3 count gate

**RUN 2026-10-28 by the orchestrator on develop after merge `9245f31ae` (297-03 merged at `d7701a606` first; the count-gate conflict was resolved as a pure union, +4 lines, 0 removed).** Verdict as printed:

```
count gate OK — 531/531 pinned files present, no per-file decrease, 0 failing.
total 12519  ·  failed 0  ·  pinned total 11346
```

Per-file deltas for the wave-3 suites (pinned → measured → delta):

| Suite | Pinned | Measured | Delta |
|---|---|---|---|
| `appRouteParity.test.ts` (297-04) | 78 | 78 | 0 |
| `useAppNavigation.leaveGuard.test.tsx` (297-03) | 23 | 23 | 0 |
| `WorkflowsPage.leaveGuard.test.tsx` (297-03) | 12 | 12 | 0 |

Typecheck set diff after the merge: 0 new versus the 62-line base. The one changed line is the inherited `ChatLayoutLaunch.test.tsx` TS2740, whose message now also lists `openRun`.

Original instruction, kept: The orchestrator runs this after BOTH 297-03 and 297-04 merge. 297-03 also appends to `scripts/vitest-count-gate.cjs`, so neither branch's green proves the merged file. Run once from the repo root: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`. Record the verdict line exactly as printed, plus the per-file deltas for every suite either plan added or grew. 297-04's suite is `appRouteParity.test.ts`, which must read 78. If the gate goes red, capture the failing filenames from the gate's own persisted JSON report BEFORE any re-run, then check each one against `git diff --numstat <wave-3 base> HEAD`. This plan is not complete until that section is filled in.

297-04's count-gate additions form one self-contained block in each knob. Keep both plans' lines when resolving the merge:
- BASELINE, right after the `"appRoutes.test.ts": 111` line: a dated `297-04` comment + `"appRouteParity.test.ts": 78`
- TARGETS, right after `"src/components/layout/__tests__/AppViewSwitch.addressStates.test.tsx"`: a FILE-LEVEL comment + `"src/__tests__/routing/appRouteParity.test.ts"`

## Deviations from Plan

**1. [Rule 3 - naming] `followVercelRedirect` added to the util.** The plan's behaviour block requires "feeding the substituted target back through resolveVercel". The moved `resolveVercel` returns the raw destination (`https://app.:host/app`), and docsVercelRouting's `toEqual` pins that exact shape, so its output could not change. The substitution (`$N` from the source groups, `:host` from the `has` named group) therefore lives in its own helper.

**2. [Rule 1 - correctness] `resolveNginx` checks `try_files` candidates against FILESYSTEM** instead of always returning the last argument. Every app address comes out the same either way. With the plan's literal rule, `/docs` would evaluate to `=404`, which is wrong. See key-decisions.

**3. `middlewareRewritesAppHost` returns `{ matcher, rewritesAppHost }`** rather than a bare boolean, so the "matcher is exactly `/`" and "rewrites on `app.`" facts are checked separately. Both have negative controls.

Otherwise the plan was executed as written. Nothing in vercel.json, nginx.conf, middleware.ts or devRouting.ts needed a change, so there is no layer decision for the operator.

## Issues Encountered

- **The scratchpad is shared with the parallel 297-03 executor.** My first full-gate run logged to `scratchpad/gate.txt`, and 297-03's run overwrote that same file (its log showed cwd `agent-a20be3dd7ad80e203`). My run exited 0, but I could not quote its log, so I re-ran it with a unique log name (`gate-297-04-a005dde.txt`). The verdict above is from that second run, with the cwd checked. Two test-running agents were active at once, which is within the ≤ 2 cap.

## Known Stubs

None. `297-VALIDATION.md` holds intentionally empty Verdict / Evidence cells. They are owed UAT rows, not stubs.

## Threat Flags

None. These are test-only files with no new product surface. T-297-16 is mitigated by the suite and its negative controls. T-297-17 is mitigated by one plant at a time, md5 and `git diff --quiet` per file, and committing only the evidence file. For T-297-18 (accepted), the apex rows assert the substituted redirect lands on `app.<same host>` and keeps the path.

## Next Phase Readiness

- The orchestrator merges 297-03 and 297-04, then runs the post-merge count gate above and appends its section here.
- `/gsd:verify-work 297` runs the 16 VALIDATION rows. Before it drives the provider rows, it re-derives the roster with the DB overlay (`run-273-board.py` `derive_roster`).

## Self-Check: PASSED

- FOUND: frontend/src/__tests__/routing/appRouteParity.test.ts
- FOUND: frontend/src/__tests__/routing/routingLayers.testutil.ts
- FOUND: .planning/phases/297-every-view-has-an-address/evidence/297-04-planted-red.txt
- FOUND: .planning/phases/297-every-view-has-an-address/297-VALIDATION.md
- FOUND commits: e138da0da, c5a59105b, 58aba72a1, eea79a356
