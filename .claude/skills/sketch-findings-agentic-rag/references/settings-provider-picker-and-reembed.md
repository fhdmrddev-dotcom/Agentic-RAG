# Settings: Provider Picker & Re-embed Lifecycle (Phase 111.1)

## Design Decisions

**024 — Provider picker = preset `<select>` + an ALWAYS-ON 🔒 endpoint footer
(winner: Synthesis — A's calm preset select + C's footer).**
ONE reusable component for BOTH the embedding model and the extraction model (D-09).
Selecting a preset auto-fills base_url + a strong default model + dims + retrieval
threshold, and surfaces a **persistent footer** (endpoint · dims · threshold ·
cloud/local tag) visible WITHOUT opening Advanced. The always-visible endpoint is the
legible cure for BUG-260616-01 (slashed `org/model` id silently mis-routing to
OpenRouter cloud): **you can never pick a model without seeing where it runs.** Local
presets (Ollama `:11434`, LM Studio `:1234`) relax the API key to a dummy + show a
green "local" tag. Shipped as `ProviderPicker.tsx` — the pattern to reuse for ANY
Settings model knob (the 060 judge-model knob reuses it).

**025 — Re-embed confirm gate = weight, NOT friction (winner: Synthesis — C's
weight-frame + A's 4-fact grid).**
Changing the embedding model + Save fires a serious, attention-demanding modal —
danger rail, alert icon, a **4-fact grid** (chunks · ETA · target model ·
runs-in-background), a consequence list naming the recall dip + resumable +
non-destructive + reversible-only-by-switching-back — then a single deliberate
two-step Confirm. **No type-to-confirm**: that's for genuinely irreversible
destruction; this operation is rare/reversible/resumable, so typing is
severity-theatre that trains the gate as a chore. Honors the "modals reserved for
must-decide moments" rule. The acknowledge-checklist is the documented fallback if
the two-step Confirm reads as too click-through in build.

**026 — Re-embed progress = ONE rich home + a whisper where search happens
(winner: Synthesis — C status card + slim search pointer).**
A rich status card in Settings is the trustworthy home for the background job:
per-batch grid, re-embedded/total/ETA, an explicit **"search at reduced recall ·
nothing is lost · resumable"** note, running/partial-failed/complete states, a
"Re-embed now" re-kick + "Switch back". The recall dip is ALSO told where it's felt:
a single slim "search is catching up" pointer on the Documents page that deep-links
into the card and auto-hides on completion — never a full app-wide banner nagging
every page (D-04/D-05 graceful-dip honesty).

## Key Patterns

- Preset data lives in an exported table (`EMBEDDING_PRESETS` / `EXTRACTION_PRESETS`),
  never hardcoded in component logic; UNVERIFIED model ids ship as *editable defaults*,
  never silently authoritative (D-07).
- Footer anatomy: `🔒 endpoint · dims · threshold · [cloud|local]` — mono font,
  bg-elev1 strip, one line, always rendered.
- Modal fact-grid: 2×2 mono facts before the consequence prose — facts first, story
  second.

## What to Avoid

- A model picker whose routing (base_url) hides behind an "Advanced" disclosure — the
  exact shape that produced the silent cloud mis-route.
- Type-to-confirm on reversible operations (severity theatre).
- App-wide degradation banners for a background job one page feels — tell it richly
  once (Settings) + whisper where felt (Documents).
- A toast-weight confirm for an hours-long, search-degrading job.

## Origin

Synthesized from sketches: 024, 025, 026 (Phase 111.1, 2026-06-16).
Source files: sources/024-embedding-provider-picker/, sources/025-reembed-confirm-gate/,
sources/026-reembed-in-progress/
