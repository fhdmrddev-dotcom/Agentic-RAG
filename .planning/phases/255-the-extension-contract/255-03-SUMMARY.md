# Phase 255 Plan 03 Summary: Registers, Ledger & Seed Closure

**Completed:** 2026-09-18
**Plan:** 255-03 (Wave 3)
**Requirements touched:** EXT-01, EXT-02, EXT-03 (register-side closure)

Built by Claude after the operator stopped Gemini mid-phase. Plan 03 had not been started.

## Hot-file ledger — both registers, same commit

**Three rows re-derived** (the triples in `CLAUDE.md` were measured wrong in the `255-PREFLIGHT.md`
scan and are now corrected):

| File | Row said | Measured 2026-09-18 |
|---|---|---|
| `harness/phase_types.py` | `51 / 24 / 2925` | **53 / 26 / 2937** |
| `harness/validator_kinds.py` | `12 / 5 / 749` | **14 / 6 / 762** |
| `services/agent_loop.py` | `44 / 21 / 3326` | **48 / 22 / 3441** |
| `services/tool_dispatcher.py` | `85 / 35 / 5048` | **accurate — left alone** |

**Two rows ADDED, both absent from BOTH registers for their entire lives:**

- **`harness/programmatic.py` — `3 / 3 / 137`. It FIRES** (3 phases is the threshold) and has been
  over the line and invisible the whole time.
- **`harness/emitters.py` — `4 / 2 / 188`. It does NOT fire yet**, and the row is added anyway, one
  phase early, deliberately. This ledger's own repeated finding is that an absent row is invisible
  *at any count* — `App.tsx` went 23 phases, `NavPanel.tsx` 11, `config.py` its entire life.

Matching narrative sections added to `docs/HOT-FILE-LEDGER.md` in the **same commit** (the sync
rule), each carrying the file's binding invariant and a **named seam** for the next phase:
`programmatic.py`'s purity/idempotency contract is prose in a module header with **nothing executable
checking it**; `emitters.py`'s `citation_policy` / `integrity_policy` sit on the *phase* config, so
every emitter inherits them silently.

⛔ **NO GATE COULD HAVE DEMANDED EITHER ROW, and that is the finding.**
`node scripts/check-hot-file-ledger.cjs 255` exits **0** — but it reports **`watched: 0`**. It only
fails on a file a phase *modifies*, and Phase 255 **reads** these six rather than modifying them
(every RED-drive plant was reverted). **The gate passed vacuously.** The rows exist because the
preflight re-derived the triples by hand, not because anything fired. ⚠ A phase that had trusted the
green gate would have shipped with two firing files still invisible.

## `SEED-291` — answered on ONE axis, and only one

`status: planted` → **`status: partially-answered`**, `partial: true`, `folded_into: 255`.

⛔ **Deliberately NOT `answered`, which is what plan 03 as written asked for.** The seed's own scope
line is *"Small as a decision, Large as a programme."* Phase 255 closed the **decision**; the
programme it unblocks — `SEED-198` packs, `SEED-080`/`083` entitlement, `SEED-013` Open Platform — is
untouched. Marking it `answered` would retire a seed whose largest half has not started.

The original planting note is **preserved verbatim inside** the merged `status_note` rather than
overwritten.

⚠ **A defect I introduced and caught:** the first edit left **duplicate `partial:` and `status_note:`
keys** in the frontmatter. YAML last-wins, so the original `partial: false` was silently overriding
the new `partial: true` — and **the seeds gate passed anyway**, since it checks the enum and the
required keys, not duplicate keys. Merged into single keys and re-validated with `yaml.safe_load`.
⛔ That is a real gap in `check-seeds-register.cjs`: it cannot see a duplicate key.

## Gates at close

| Gate | Result |
|---|---|
| `check-seeds-register.cjs` | **exit 0** — 303/303 parsed, 0 duplicate ids |
| `check-claude-md-size.cjs` | **exit 0** — 105,907 chars, 70.6% of limit, 44,093 headroom |
| `check-hot-file-ledger.cjs 255` | **exit 0** — ⚠ `watched: 0`, see above |
| `check-extension-contract.cjs` | **exit 0** — 6 files, 0 violations |
| `check-gap-closure-rounds.cjs 255` | **exit 0** — G-7 clear, no closure rounds |
| Backend unit vs baseline | diffed as a **SET** against `255-BASELINE-backend-failing-set.txt` |

## Open, and carried out of this phase rather than closed inside it

- ⛔ **Operator decision #2 — Open Platform (`SEED-013`) sequencing — IS NOT SETTLED.** A builder
  recorded it as an operator ruling; the operator confirmed they had not ruled, and it was reverted
  (`BUS-262`). `255-CONTEXT.md` carries it as *"Rulings Needed"* + a Recommendation.
- ⛔ **Operator decision #6 — `OV-248-01`** — same. `STATE.md` marker restored to `live`.
- **`SEED-295`** (named outcomes / forward-only edges) stays `planted` and **UNJUSTIFIED**, pending
  one real workflow authored and recorded as blocked.
