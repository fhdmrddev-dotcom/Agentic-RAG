# Phase 249 — Discussion Log

**Date:** 2026-09-15
**Mode:** ⚠ **AUTONOMOUS — no question was put to a person.**

## The instruction

Operator, verbatim, at `/gsd:discuss-phase 249`:

> *"249 I want you to execute this phase in to end yourself without gemini please proceed
> autonomously use the tools you have I want to come tomorrow to see it complete"*

So: no `AskUserQuestion`, no Gemini, discuss → plan → execute → verify in one unattended run.
**Every decision in `249-CONTEXT.md` is Claude's call and is labelled as such.** A later phase may
not cite `D-249-NN` as an operator ruling.

## What replaced the questions: measurement

The phase's gray areas were resolved by driving the tree and the running app rather than by asking.
Five measurements changed the phase before a single plan was written:

| # | Measured | Result | Effect on the phase |
|---|---|---|---|
| 1 | `POST /evals/engine-sweep` → `GET /evals/engine-health`, live, signed-in, local | **8/8 healthy, 0 `provider_error`** (and the stale 2026-08-27 board's one failure named its cause verbatim) | **`MODEL-09` collapsed from a build to a written closure** — the ROADMAP's own conditional |
| 2 | `broadcast_settings_change` / `broadcast_model_overrides_change` / `SettingsCacheSubscriber` | All three present and wired at every write seam | **`MODEL-06` is already shipped** — prove it, do not rebuild it |
| 3 | `_PROVIDER_BASE_URLS` (11) vs `PROVIDER_ENDPOINTS` (8) vs `ADD_PROVIDER_ROSTER` (8) | The gap is exactly `ollama` / `lmstudio` / `custom` | `MODEL-04` is a **two-language roster widening**, and the SSRF fence is untouched |
| 4 | `MessageInput.tsx` model dropdown | Renders `deprecated` and `active`; **no unverified marker at all** | `MODEL-05` is a **move**, not a build — the chip exists on the wrong surface |
| 5 | `ModelRegistryTab.tsx` | THREE hide-ish controls now (`deprecated` / `enabled` / `Remove`); the bug predates `Remove` | `MODEL-07` is **legibility at the control**, not a new control |

⭐ **Two of six requirements were already satisfied in code before the phase opened.** That is the
second consecutive phase where this happened (248's `CRED-02` was fixed at `e615c0dad`). It is now
a pattern, and the method that caught it both times is the same: **measure the tree before planning
the fix.**

## Areas that would have been questions, and how they were ruled

| Gray area | Options considered | Ruled | Why |
|---|---|---|---|
| `MODEL-09` scope | (a) build error-honesty, (b) written closure, (c) defer | **(b)** | The ROADMAP pre-authorised (b) on a healthy sweep. Building a fix for a defect that does not reproduce is the failure mode the precondition existed to prevent. |
| How to widen the add-model roster | (a) new `GET /providers` endpoint, (b) widen both lists + a `?raw` fence | **(b)** | G-8. A new API surface buys nothing the fence does not guarantee. |
| `MODEL-05` strength | (a) chip only, (b) chip + consequence sentence, (c) block the pick | **(b)** | (c) contradicts `D-122-05` (default-SAFE is correct). (a) repeats 2026-08-18's `safe_defaults_applied=True` — a word that reads benign over a model that cannot call tools. |
| `MODEL-07` shape | (a) rename `deprecated`, (b) new affordance, (c) words on the existing controls | **(c)** | (a) breaks shipped `D-149-04`. (b) is what already failed — the `Users see` column *was* the affordance and was still lost. |
| `MODEL-08` mechanism | (a) change the return type, (b) typed exception on the refusal family only | **(b)** | (a) touches six call sites' contracts at once. (b) is additive and auditable, and every call site is still read in the same plan. |
| Plan count | 4 / 6 / one-per-requirement | **4** | G-8 governs this milestone; two requirements are verification, not build. |

## Scope creep redirected

Four ideas surfaced and were pushed to `<deferred>` rather than absorbed: the `MODEL_CAPABILITIES`
extraction seam (48 phases — a roster widening is the wrong vehicle), `SEED-088` dynamic discovery
for self-hosted endpoints (a new outbound surface pointed at an operator-supplied URL — the exact
SSRF question this phase refuses to open), `SEED-135`'s per-role fitness half, and the
`ComposerChipsRow` seam.

## What this log cannot claim

⛔ The `MODEL-09` measurement is **local**, at `develop` HEAD. `BUG-260809-01` was measured on
**cloud production, 2026-08-09**. The closure proves the application does not manufacture an opaque
cause; it does not prove cloud is healthy today.

⛔ This phase's builder and reviewer are the same agent, by instruction. It closes
`verification_mode: self-verified`, `independent_review: owed`, and adds a **fourth** owed row to
`DEBT-06` beside 238 / 240 / 241.

---

*Phase 249 · discussion log · 2026-09-15*
