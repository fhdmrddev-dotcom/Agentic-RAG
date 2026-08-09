# Phase 176: Chat Render Correctness + Exec Reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 176-chat-render-correctness-exec-reliability
**Areas discussed:** EXEC-01 reliability, RENDER-01 dedup identity, RENDER-03 send-drop bar, RENDER-02 unfold + sketch (RENDER-04 taken on recommended path, not deep-dived)

**Area selection (multiSelect):** operator selected all four offered gray areas — EXEC-01 reliability (major), RENDER-01 dedup identity, RENDER-03 send-drop bar, RENDER-02 unfold + sketch.

---

## EXEC-01 — Reliability scope

| Option | Description | Selected |
|--------|-------------|----------|
| Declared + auto-heal | Harden declared `libraries` install (retry once, honest) PLUS ModuleNotFound auto-install + re-run once. Kills both the flaky declared install AND the undeclared-import case. | ✓ |
| Declared libraries only | Fix the `libraries` param only; defer ModuleNotFound auto-heal to SEED-043. | |
| Full SEED-043 half-b | Complete package-management hardening (declared + auto-heal + preinstalled awareness + cross-provider matrix). | |

**User's choice:** Declared + auto-heal (Recommended).
**Notes:** Grounded in the live scout — `session.install` IS called every turn (`tool_dispatcher.py:1642`) but its failure is silently swallowed at `:1653`, so the code runs into a raw ModuleNotFoundError. Most real failures are undeclared imports, so the bounded auto-heal is the high-value half.

## EXEC-01 — Failure contract

| Option | Description | Selected |
|--------|-------------|----------|
| Honest error, 1 heal cycle | Retry declared install once; on ModuleNotFound auto-install + re-run once; if still failing, honest tool result ('Could not install X: <reason>'). Bounded to 1 heal cycle per module = no loops. | ✓ |
| Run-anyway with a prepended note | Keep running even if install failed; prepend a '⚠ install failed' line. Never blocks; raw traceback still appears. | |
| Let Claude decide at plan time | Capture intent (honest + bounded), let researcher/planner pick the exact contract. | |

**User's choice:** Honest error, 1 heal cycle (Recommended).
**Notes:** No silent swallow anywhere on the path; the honest message lets the model pivot to a preinstalled lib rather than blindly retrying.

---

## RENDER-01 — Dedup identity

| Option | Description | Selected |
|--------|-------------|----------|
| No-migration reconcile fix | Re-key the temp to the persisted user-row id from postMessage, OR drop an untyped temp when the snapshot holds an identical-content user row newer than the temp. Researcher picks cleanest. Preserve the 075.7 guard. | ✓ |
| Durable client_msg_id + schema | Generate a client_msg_id, persist it (migration), exact id match. Bulletproof but adds a column. | |

**User's choice:** No-migration reconcile fix (Recommended).
**Notes:** Proportionate to a minor cosmetic bug + the ROADMAP no-migration preference. Must not weaken the 075.7 blank-thread preserve-guard — dedup against the snapshot, never stop preserving temps.

---

## RENDER-03 — Send-drop acceptance bar

| Option | Description | Selected |
|--------|-------------|----------|
| Race-fix + honesty guarantee | Tighten fresh-thread ordering (reduce frequency) AND make honesty load-bearing: preserve the draft until dispatch confirmed, quiet honest hint on any drop via the failedSendDrafts/reconcileErrors seam. | ✓ |
| Honesty guarantee only | Accept the race may fire; focus purely on never-silent. Simpler; leaves the race in place. | |
| Verify-and-close mechanism #1 | Treat as mostly-done (per-thread send already fixed). Risky — mechanism #2 still drops. | |

**User's choice:** Race-fix + honesty guarantee (Recommended).
**Notes:** Mechanism #1 (global mutex) already root-fixed via per-thread sends. Root of invisibility = MessageInput clears text synchronously (`MessageInput.tsx:126-127`) before dispatch confirmed. Honesty is the load-bearing guarantee since a timing race is hard to prove gone.

---

## RENDER-02 — Un-fold reconcile reach

| Option | Description | Selected |
|--------|-------------|----------|
| Extend to nav/mount path | Keep the send-path fix AND extend the content-reconcile to the mount/nav-watched terminal (the SC#10 parallel-thread case). SEED-094 out of scope. | ✓ |
| Verify-only, defer nav path | Live-verify the send-path fix and close; leave nav-watched on reload (defer to Phase 178). | |

**User's choice:** Extend to nav/mount path (Recommended).
**Notes:** The nav-watched path is exactly what the SC#10 parallel-thread axis exercises, so it has to be proven live regardless — fix it rather than leave a reload dependency. SEED-094 (backend stray-last-line) is a separate backend emit bug.

## RENDER-02 — G-2 sketch call

| Option | Description | Selected |
|--------|-------------|----------|
| No fresh sketch | Reconcile-logic honesty, no net-new visual chrome. Target defined by the applied fix + sketch 014 (unified card frame) + existing StreamingNarration design. Record G-2 audit satisfied-by-existing-sketches. | ✓ |
| Quick sketch the unfold moment | Sketch the fold→clean-answer transition first. Adds a /gsd:sketch step. | |

**User's choice:** No fresh sketch (Recommended).
**Notes:** G-2 satisfied by existing sketches; acceptance bar = intended behavior actually happens, verified live.

---

## Claude's Discretion

- **RENDER-04** (stale version pointer) — operator left to the recommended path: targeted `skill_versions` query refetch/invalidate after `approveDescriptionProposal` in `handleApproveDescription`, mirroring WR-05's `loadSkills()`. No migration, no realtime.
- **RENDER-01 exact mechanism** — researcher picks between re-key-on-postMessage-id vs content-newer-heuristic (whichever is cleaner in the current code).
- **EXEC-01 root-cause probe** — researcher determines why `llm_sandbox`'s `session.install` intermittently no-ops in ~68ms on a warm session.

## Deferred Ideas

- **SEED-094** — backend stray-last-line final-answer emit (RENDER-02 residual, separate backend run-end-honesty bug).
- **SEED-043 full half-b remainder** — preinstalled-set-aware planning, cross-provider install-verification matrix, permanent `libraries` reshaping.
- **BUG-260609-02 / BUG-260609-04** — panel-side run-honesty (SUB-RESULTS desc-loss, phase-0 slug clobber); routed to STRETCH Phase 178 by Phase 174 — kept deferred, not folded (chat-render ≠ panel taxonomy).
- **RENDER-01 durable client_msg_id + column** — rejected as over-scoped; re-open only if the no-migration reconcile proves flaky under UAT.
