---
id: BUG-260809-01
title: Cloud skill-eval engine is 0/8 healthy — sweep fails on every provider, and 6 of 8 report an opaque `provider_error`
reported: 2026-08-09
surface: Agentic-RAG
severity: major
status: open
h1_refuted: 2026-08-09    # cloud provider keys are ALL present (has_key=true ×8) — not config drift
affected_areas: [skills/eval-engine, settings/engine-health, cloud-config, observability/error-honesty]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-040]
re_open_trigger: "Reviewed at /gsd:discuss-phase 196 (2026-08-17) — left OPEN, NOT folded
  (196-CONTEXT.md D-19), while its two model-control siblings BUG-260731-01 and BUG-260718-04 WERE
  folded into that phase. The distinction is not arbitrary: 196 fixes model CONTROLS that lie about
  what will run; this is the eval ENGINE plus cloud configuration, and it belongs to the app-wide
  SEED-040 / SEED-088 model-registry sweep that both the ROADMAP and REQUIREMENTS.md:110 fence out of
  v3.7. ⚠ Note the partial overlap that does NOT amount to a fold: 196's D-17 makes the judge knob
  actually reach the judge, so if any of the 8 provider failures here turn out to be 'the judge ran the
  hardcoded claude-opus-4-8 on a provider with no key', 196 may change this report's symptoms without
  claiming it. RE-CHECK after 196 ships, and route to the SEED-040/088 milestone otherwise."
reproduces_on:
  branch: production
  commit: 4c9b487a
  date: 2026-08-09
---

# BUG-260809-01: Cloud skill-eval engine is 0/8 healthy — every provider fails, and 6 of 8 hide why

## What we observed

Operator report, 2026-08-09, on the **live cloud app** (`https://superrag.cloud`).

Running a skill eval fails with an error. Settings → **Eval engine health** shows
**`0/8 engines healthy`**, last swept **6 days ago**. Clicking **Run sweep** fails for all eight
configured engines:

| # | Provider | Model | Reported result |
|---|---|---|---|
| 1 | GLM (Zhipu) | `glm-5.2` | `provider_error` |
| 2 | MiniMax | `MiniMax-M2` | `provider_error` |
| 3 | Moonshot | `kimi-k2.6` | `provider_error` |
| 4 | DeepSeek | `deepseek-v4-flash` | `provider_error` |
| 5 | OpenRouter | `nvidia/nemotron-3-ultra-550b-a55b` | `NotFoundError: Error code: 404 - {'error': {'message': 'No endpoints found that can handle the requested parameters. To learn more about provider routing, visit: https://openrouter.ai/docs/guides/rout` *(truncated in the UI)* |
| 6 | Google | `gemini-3.5-flash` | `provider_error` |
| 7 | Anthropic | `claude-opus-4-6` | `BadRequestError: Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to` *(truncated in the UI)* |
| 8 | OpenAI | `gpt-4.1` | `provider_error` |

The surface's own copy is worth recording, because it is accurate and the failure is not a
misreading of it: *"Checks the skill-eval engine runs end-to-end on every configured provider —
global, not scoped to any single skill"*, *"ENGINE health ≠ model quality — a model may honestly
fail the smoke case and still be a healthy engine"*, *"The sweep is ≈24 LLM calls over a hidden
built-in smoke case — no user data."*

**Not yet checked** (should be, before acting): whether the same sweep passes **locally** at
`develop` HEAD. That single comparison splits this report in two — see below.

## Why it matters

**Severity `major`, not `blocking`:** skill evaluation is a whole product surface (Skill Studio →
Evals, matrix runs, the publish gate that depends on eval verdicts) and it is **entirely unusable
in cloud**. It does not stop chat, ingestion, or workflows, so the app is not down — but every
eval-gated capability silently has no engine behind it.

Two distinct problems are stacked here, and they should not be conflated:

1. **The engines are failing** — most likely cloud provider configuration, not application logic.
2. **Six of eight failures are unreadable.** `provider_error` with no message is not a diagnosis.
   The two engines that *did* surface their real error are the only two anyone can act on — and
   both turned out to be trivially fixable once visible (a billing balance; a model id). The other
   six could be missing keys, wrong base URLs, dead model ids, or network egress, and the surface
   cannot tell them apart. **This is the more durable defect**: an honest-error surface that
   swallows the error for 75% of its rows teaches the operator to distrust it.

## Hypothesized cause

> ## ⚠ H1 WAS MEASURED AND IS **REFUTED** — 2026-08-09, against the live cloud API
>
> H1 (missing cloud provider keys) was the leading hypothesis and it is **wrong**. Measured by
> calling `GET /settings` on `https://api.superrag.cloud` from the operator's authenticated
> browser session. **Every one of the eight sweep providers reports `has_key=true`:**
>
> ```
> openai has_key=true      anthropic has_key=true    google has_key=true
> openrouter has_key=true  deepseek has_key=true     moonshot has_key=true
> minimax has_key=true     zhipu has_key=true
> (ollama has_key=false, lmstudio has_key=false — neither is in the sweep)
> ```
>
> `GET /health` → `{"status":"ok","redis":"ok","maintenance":false}`. The backend is up and the
> DB answers. **This is not cloud-config drift, and the pending deploy will not fix it.**
>
> **The sharper reading, which the refutation opens up.** `GET /settings` also shows
> `active_provider: "deepseek"`, `llm_model: "deepseek-v4-flash"` — **the same provider and the
> exact same model id that the sweep reports as `provider_error`** — and the operator has chat
> threads from the previous day, so that pairing demonstrably serves live traffic. A provider
> whose key works, whose model works for chat, and which still fails the sweep, indicts **the
> sweep's own request**, not the provider.
>
> **(H6 — now the leading hypothesis) The sweep sends a request shape providers reject.**
> OpenRouter's error is the tell, and it should be read literally: *"No endpoints found that can
> handle the requested **parameters**"* — that is OpenRouter's answer when no upstream endpoint
> supports the **parameters sent**, which is a different failure from an unknown model id. If the
> sweep attaches something like a structured-output/JSON-schema or tool configuration that most
> engines refuse, one cause explains six opaque failures *and* the OpenRouter message at once.
> Anthropic's billing error is then simply an independent second problem that happens to mask
> whether it would have failed the same way.
>
> **This makes the bug almost certainly reproducible LOCALLY**, which is now the cheapest next
> step — see Routing. Related: SEED-127 records that reasoning-first STRUCTURED routing does not
> cover the forced-emission path; worth checking whether the sweep rides that path.

*Original hypotheses, preserved. H1 is struck; H2/H3 stand as independent real issues.*

- ~~**(H1, most likely) Cloud provider-key drift.** Production is pinned at **v3.3 / commit
  `4c9b487a` (2026-07-18)** and has drifted from local for three milestones. The two engines with a
  real message prove their keys *exist and authenticate* (Anthropic reached billing; OpenRouter
  reached routing). The six opaque ones plausibly have **no key set in Coolify at all**, or a key
  that fails before any provider-specific error can be parsed. This is the exact failure class
  `DEPLOYMENT-WORKFLOW.md` §5 names — *"the cloud provider key must serve the chosen model … a
  model that works locally can 404 on cloud"*.~~ **REFUTED — all eight keys are present.**
- **(H2) Anthropic — out of credit.** Verified by its own error text. Not a code bug. Fix in the
  Anthropic console.
- **(H3) OpenRouter — the pinned model no longer routes.** `nvidia/nemotron-3-ultra-550b-a55b`
  returns *"No endpoints found that can handle the requested parameters"*, which is OpenRouter's
  answer when no upstream provider serves that model **with the parameters sent**. Could be a dead
  model id **or** a parameter the sweep sends that no endpoint accepts. Worth distinguishing —
  they have different fixes. Note the standing project position that OpenRouter is experimental.
- **(H4 — weakened by the H1 refutation) Stale model ids across the board.** Every model in the table is a *newest-generation* id.
  If cloud's registry rows or keys predate them, several engines would fail for the same reason
  OpenRouter does. **SEED-040 is directly implicated** — model capabilities still live hardcoded in
  `config.py`, the DB-override tier omits them, and the routing seams bypass the DB, so cloud has
  no self-service way to correct a model id without a code deploy.
- **(H5) The `provider_error` masking is its own bug**, independent of whichever of H1–H4 is true.
  The sweep evidently has a path that catches a provider exception and reports a bare enum instead
  of the message it already holds — while two other paths pass the message through. Same surface,
  two honesty standards.

## Surface classification

**`Agentic-RAG`** — this app. The eval-engine sweep, its health card, and its error reporting are
all ours. H2 (Anthropic billing) is an *external* account condition surfaced through our UI, and is
noted here only because our UI is where it appeared; it is not an app defect and needs no phase.

## Routing note

**Do not fold this into a phase before the local-vs-cloud comparison is run.** The single cheapest
next action is to run the same sweep on local `develop` HEAD:

- **If local also fails** → this is an application/registry defect that a deploy will carry live,
  and it wants a phase.
- **If local passes and only cloud fails** → problem (1) is pure cloud-config parity and belongs in
  the deploy checklist, not a phase.

**Either way, problem (2) — the opaque `provider_error` — is a real app defect and survives both
branches of that test.** It is small, self-contained, and a good `/gsd:fast` or `/gsd:quick`
candidate: pass the provider's actual message through the same way the Anthropic and OpenRouter
paths already do.

**Timing:** reported the same day v3.6 closed and a three-milestone production deploy was being
prepared (production is 1,563 commits and 15 migrations behind). The deploy will replace the live
eval engine wholesale with the v3.4/v3.5/v3.6 version, so **re-observe this after the deploy before
investing in a fix** — the shipped behaviour may differ. The provider keys, however, will NOT be
fixed by the deploy; they are Coolify config and must be set by hand.
