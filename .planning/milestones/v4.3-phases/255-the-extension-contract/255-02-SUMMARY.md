# Phase 255 Plan 02 Summary: The Mechanical Guard (EXT-02)

**Completed:** 2026-09-18
**Plan:** 255-02 (Wave 2)
**Requirements Delivered:** EXT-02

⚠ **BUILT BY TWO AGENTS, AND THE SEAM IS RECORDED RATHER THAN SMOOTHED.** Gemini authored the guard,
the hook, the pytest unit and the wiring, then was stopped by the operator mid-plan. Claude — which
had been the **reviewer** for this phase — finished it on operator instruction. See
*Role change* below; it has a verification consequence.

## What shipped

| Artefact | Lines | Role |
|---|---|---|
| `scripts/check-extension-contract.cjs` | 198 | the scanner; audits all six `SEED-291` `trigger_paths` |
| `.claude/hooks/extension-contract-guard.js` | 65 | PostToolUse wiring on `Write\|Edit\|MultiEdit` |
| `backend/tests/unit/test_255_extension_contract_guard.py` | 145 | registry-closure assertions |
| `frontend/package.json` | +1 | `npm run check:extension-contract` |
| `.claude/settings.json` | +10 | hook registration |

**What the guard refuses:** `importlib`, `eval(`, `exec(`, `__import__(`, dynamic `getattr(...)()`
invocation, `def register_(custom_|external_|dynamic_|plugin_|executor|tool|validator)`, and direct
assignment into `_TOOL_REGISTRY`, `PHASE_TYPE_REGISTRY[_ENTRIES]`, `PROGRAMMATIC_PHASE_REGISTRY`,
`EMITTER_REGISTRY`, `VALIDATOR_REGISTRY` — with an allow-list for the canonical internal decorator
assignments so the shipped registrations do not trip it.

## ⭐ The RED drive — all six paths, in isolation

**The must_have was "every one of the six trigger paths is driven RED in isolation … and the failure
output captured and verified before restoring clean state."** At handover only ONE path
(`emitters.py`) had been driven. All six were then driven, one at a time.

Evidence: **`255-RED-DRIVE-evidence.txt`**, beside this file. Method — md5 before → plant one
violation → run guard → `git checkout -- <file>` → md5 after. A drive counts only if the guard exits
**1** with the plant, **0** without, and the file comes back identical.

**Result: 6 / 6 fired RED and returned GREEN.**

⚠ **5 / 6 restored md5-identical. `phase_types.py` restored CONTENT-identical only**, and the
weaker claim is stated as the weaker claim rather than rounded up: `git checkout --` rewrote its line
endings under autocrlf (now 2937 CRLF, 0 lone LF). `git status` reads clean and
`git diff --ignore-all-space` is empty, so the content is right and the bytes moved.
⛔ This is the hazard already on this project's record — *"`git checkout -- <dir>` is NOT a restore
here; autocrlf moved 224 body digests while `git status` read clean."*

⚠ **A planted violation was live in the working tree for a period during Gemini's own drive** —
`EMITTER_REGISTRY["dynamic_custom_emitter"] = eval("None")` at `emitters.py:189`. It was removed
before any commit; `emitters.py` is byte-unchanged at the close. Recorded because an `eval()` in the
closed core is precisely what `EXT-01` forbids, and it came within one `git add` of being committed.
A watcher was armed over it rather than trusting timing.

## Verification

| Check | Result |
|---|---|
| `node scripts/check-extension-contract.cjs` (clean tree) | **exit 0** — 6 files, 0 violations |
| `pytest tests/unit/test_255_extension_contract_guard.py` | **6 passed** |
| Backend suite vs `255-BASELINE-backend-failing-set.txt` | see plan 03 summary — diffed as a SET |
| Guard wired where it executes | `.claude/settings.json` **34 → 36** `"command"` entries, purely additive; nothing dropped |

⚠ **`EXIT=0` was reported once for a run that had actually exited 1** — `$?` after a pipe to `tail`
reports `tail`. Re-measured with a redirect. Recorded because it is the same class as the count/set
defect and it nearly certified a failing guard as passing.

## Deviations from the plan as written

- **`files_modified` said `package.json`; the change landed in `frontend/package.json`.** Left as
  built. ⚠ It is an odd home for a backend-facing guard — the script lives at the repo root and is
  invoked as `node ../scripts/...`. Worth revisiting if a root `package.json` ever appears.
- **`exports` contract said `["checkExtensionContract", "main"]`; the module exports
  `{ checkFile, TRIGGER_PATHS, main }`.** Left as built — the pytest unit and the hook both consume
  it successfully — but the plan's artifact contract and the file disagree, which is drift.

## ⛔ Known limit, stated rather than discovered later

The guard is **line-based pattern matching, not an AST parse.** It strips `#` comments and skips
blank lines, but a violation split across two physical lines, or assembled from a variable, would not
match. It is a **tripwire against the plausible-looking exception**, which is what `SEED-291` asked
for — not a proof of absence. Anyone reading it as the latter is reading it wrong.
