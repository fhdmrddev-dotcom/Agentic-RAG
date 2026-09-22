---
phase: 255
name: "The Extension Contract"
date: 2026-09-18
status: passed
score: "3 of 3 requirements satisfied"
verification_mode: self-verified
independent_review: owed
builder: "gemini (plans 01-02, partial) + claude (plans 02-03, on operator instruction)"
verifier: claude
requirements: [EXT-01, EXT-02, EXT-03]
---

# Phase 255 Verification — The Extension Contract

> ⛔ **READ THE MODE FIRST. THIS IS `self-verified`, AND THAT IS NOT A FORMALITY.**
> Gemini built plans 01-02 under the `/pair` protocol with Claude as the phase's **reviewer**. The
> operator stopped Gemini mid-phase and instructed Claude to finish. Claude therefore **built plans
> 02-03 and is now verifying its own work**. `AGENTS.md §6.3`: *"whoever built it does not verify
> it"* — there is no independent verifier left for this phase, and this file says so rather than
> letting a `passed` imply one. `independent_review: owed`, joining the `DEBT-06` set.

## Requirements

### ✅ EXT-01 — the contract is written down as binding project law

`docs/EXTENSION-CONTRACT.md` (119 L) states the rule — *a plugin is DATA, an EXTERNAL PROCESS, or
SANDBOXED CODE, and never engine code* — names the three permitted mechanisms, and explicitly names
all three refusals `SEED-291` demanded: third-party executors / emitters / validators, a generic HTTP
egress node, and branching-or-looping workflow graphs as a plugin concern. Cross-referenced from
`CLAUDE.md` (+1 line; size gate **exit 0**, 105,907 chars, 70.6% of limit).

### ✅ EXT-02 — a mechanical guard, driven RED

`scripts/check-extension-contract.cjs` (198 L) audits **all six** `SEED-291` `trigger_paths`.

**Wired where it executes in order**, not merely named:
`.claude/settings.json` PostToolUse on `Write|Edit|MultiEdit` (**34 → 36** `"command"` entries,
purely additive — nothing dropped); `frontend/package.json` → `npm run check:extension-contract`;
`backend/tests/unit/test_255_extension_contract_guard.py` (**6 passed**).

⭐ **6 / 6 trigger paths driven RED in isolation** — guard **exit 1** with a planted violation,
**exit 0** after restore. Full evidence: `255-RED-DRIVE-evidence.txt`.

⚠ **5/6 restored md5-identical; `phase_types.py` restored CONTENT-identical only.** `git checkout --`
rewrote its line endings under autocrlf. `git status` clean, `git diff --ignore-all-space` empty. The
weaker claim is recorded as the weaker claim.

### ✅ EXT-03 — a third party can follow each mechanism without seeing engine code

`docs/extensions/` — `README.md`, `skill-package-example/SKILL.md` (data),
`workflow-definition-example.json` (data), `mcp-server-example.md` (external process),
`sandbox-transform-example.py` (sandboxed code).

## Gates at close

| Gate | Result |
|---|---|
| `check-extension-contract.cjs` | **exit 0** — 6 files, 0 violations |
| `check-seeds-register.cjs` | **exit 0** — 303/303 parsed, 0 duplicate ids |
| `check-claude-md-size.cjs` | **exit 0** — 105,907 chars, 44,093 headroom |
| `check-hot-file-ledger.cjs 255` | **exit 0** — ⚠ **`watched: 0`, vacuous** (see below) |
| `check-gap-closure-rounds.cjs 255` | **exit 0** — G-7 clear, no closure rounds |
| `pytest test_255_extension_contract_guard.py` | **6 passed** |
| Backend unit vs baseline **SET** | ✅ **71 / 71, SETS IDENTICAL — zero new, zero fixed.** `4900 → 4906 passed` (+6 = the new guard test). ⛔ Diffed with `comm` against the committed 71-name set, never by comparing counts |
| Frontend count gate | ⚠ **inherited RED at base** — `WorkflowRunPage.test.tsx`, a `SEED-171` flaky suite. Not re-run; this phase touches no frontend source |

## ⛔ Three findings that outlive this phase

1. **The ledger gate passed vacuously.** `watched: 0` — it fails only on a file a phase **modifies**,
   and this phase **reads** its six. The two missing rows (`programmatic.py`, firing at 3 phases;
   `emitters.py`) were found by the preflight's hand re-derivation, **not by the gate**. A phase that
   trusted the green would have shipped with two firing files invisible to G-5.
2. **`check-seeds-register.cjs` cannot see a duplicate YAML key.** A duplicate `partial:` /
   `status_note:` pair introduced during this phase passed the gate while YAML last-wins silently
   overrode the new value. Caught by `yaml.safe_load`, not by the gate.
3. **A planted `eval("None")` sat live in `emitters.py` for a period** during the RED drive — the
   exact construct `EXT-01` forbids — and came within one `git add` of being committed. Removed
   before any commit; `emitters.py` byte-unchanged at close. A watcher was armed over it rather than
   trusting timing.

## ⛔ Carried out of the phase, NOT closed inside it

- **Operator decision #2 — Open Platform (`SEED-013`) sequencing: OPEN.**
- **Operator decision #6 — `OV-248-01`: OPEN.** Marker restored to `live` with its paragraph.
  Both were recorded by a builder as operator rulings; the operator confirmed neither was made, and
  both were reverted (`BUS-262`).
- **`SEED-291` → `partially-answered`, not `answered`** — decision axis closed, programme untouched.
- **`SEED-295`** stays `planted` and **UNJUSTIFIED**.

## Known limit of the guard, stated rather than discovered later

It is **line-based pattern matching, not an AST parse**. It strips `#` comments, but a violation
split across two physical lines or assembled from a variable would not match. It is a **tripwire
against the plausible-looking exception** — which is what `SEED-291` asked for — **not a proof of
absence.**
