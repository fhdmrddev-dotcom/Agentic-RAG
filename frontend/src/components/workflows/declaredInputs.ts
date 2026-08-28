/**
 * Phase 214.1-01 Task 1 (STEP-02 · D-214.1-01 · D-214.1-02 · D-214.1-03) — THE
 * DECLARED-INPUT LEAF.
 *
 * Phase 214 shipped the publish gate that REFUSES an undeclared launch argument, the launch
 * forms that RENDER declared inputs, and the run wire that CARRIES them — and nothing in the
 * product could CREATE one. `BUG-260828-02`. This module is the missing quarter's pure half:
 * the stored shape, the three refusals, and the derivation that tells an author which keys
 * their own steps already ask for.
 *
 * ── PURE, AND THAT IS A FENCE ─────────────────────────────────────────────────────────
 *
 * No React, no store, no context, no fetch. Everything here is a function of its arguments,
 * so the editor, the describe door and any later surface can share one answer rather than
 * three that drift.
 *
 * ── ⚠ THE STORED SHAPE IS FOUR KEYS, AND THE FOURTH IS NOT NEGOTIABLE ─────────────────
 *
 * `InputFieldSpec` (`backend/app/models/harness.py`) is a `_StrictBase`, i.e.
 * `model_config = ConfigDict(extra="forbid")`. MEASURED AT HEAD on 2026-08-28:
 *
 *   key: str · label: str · type: Literal[...]  (NO DEFAULT) · required: bool = True
 *   source / enum_options / folder_scope — all defaulted, none written by this door.
 *
 * Two consequences this module exists to hold:
 *
 *  1. `type` HAS NO DEFAULT, so it must be written. It is the constant `"text"` and is NOT
 *     author-editable — which is exactly what D-214.1-02 means by "no type system": there is
 *     no type CHOICE, not that the field is absent. Attachments (`SEED-225`) are the first
 *     thing that will need a real one.
 *  2. THERE IS NO `description` FIELD, and adding one would not be a wasted key — it would be
 *     a 422. `selectDefinition` (`builderStore.ts`) is literally `{ ...meta, phases }` and
 *     `updateWorkflowDraft` sends `JSON.stringify(def)` with no whitelist, so ANYTHING put on
 *     an entry ships to a model that forbids extras and DESTROYS THE FIRST AUTOSAVE.
 *     D-214.1-02's wording included `description?`; this is that decision corrected by
 *     measurement rather than silently obeyed.
 *
 * `declaredInputFor` is the ONE minting site, so the four-key fence is one assertion rather
 * than a discipline every call site has to remember.
 *
 * ── THE RESERVED SET IS READ, NEVER RE-TYPED (D-214.1-03) ─────────────────────────────
 *
 * `RESERVED_LAUNCH_INPUT_KEYS` is imported from `soulData.ts`, which is itself the declared
 * client mirror of the backend frozenset `RESERVED_RUN_INPUT_KEYS`
 * (`backend/app/models/message.py`, line 27 at the time of writing — the PATH and the SYMBOL
 * are the durable anchor, a line number rots). Both kickoff merge sites STRIP those keys out
 * of a launcher's `inputs` dict, so an author who declared `kickoff_prompt` would get a field
 * whose value silently vanishes: plan `214-09` measured exactly that trap. Refusing at
 * authoring time with the reason on screen is the honest half; the server strip remains the
 * actual fence.
 *
 * ── ⚠ ONE ACCEPTED SECOND SPELLING, NAMED RATHER THAN HIDDEN (T-214.1-01-03) ──────────
 *
 * `undeclaredAskKeys` re-spells ONE server rule: `key = ask_key or name`. Its owner is
 * `backend/app/services/connectors/args.py` (`bind_arguments` and `unsatisfiable_arguments`
 * both compute it). D-182-06 normally forbids a second copy of a server predicate, and this
 * one is accepted for a stated reason: the derivation is an authoring CONVENIENCE and never
 * a gate. The server's `unsatisfiable_arguments` remains the only thing that decides whether
 * a workflow publishes, so a disagreement can only ever offer the author one key too few or
 * one too many. It can NEVER admit a publish the gate would refuse.
 */
import { RESERVED_LAUNCH_INPUT_KEYS } from "@/components/workflows/soulData"

/**
 * One declared workflow input, as this door writes it — `InputFieldSpec` narrowed to the
 * four keys the door owns. See the header for why there is no `description` and why `type`
 * is present but constant.
 */
export interface DeclaredInput {
  key: string
  label: string
  /** ALWAYS the literal `"text"`. The field is required by the model; the CHOICE is not offered. */
  type: "text"
  required: boolean
}

/** Why a typed key cannot become a declared input. `null` means it can. */
export type DeclaredInputRefusal = "reserved" | "duplicate" | "empty"

/**
 * Mint the entry for `key` — the ONE place a `DeclaredInput` is constructed.
 *
 * ⚠ `label` IS THE KEY ITSELF, deliberately. `InputFieldSpec.label` is a required `str`, and
 * inventing a friendly name ("Recipient email address") would be fabricating words no author
 * wrote — the exact thing `LaunchInputFields`'s two-arm rule refuses. `soulData.entryInputFields`
 * treats a label equal to its key as an ABSENCE, so the launcher renders the key in the mono
 * face rather than pretending a human phrased it. An author who wants prose types it into the
 * label field and the first arm takes over.
 */
export function declaredInputFor(key: string): DeclaredInput {
  return { key: key.trim(), label: key.trim(), type: "text", required: true }
}

/**
 * Refuse a key the author typed, with the reason — or `null` when it is acceptable.
 *
 * Never throws; the caller renders the reason. The order is emptiness → reserved → duplicate,
 * which is the order a person meets them in.
 *
 * ⚠ NO FORMAT RULE BEYOND EMPTINESS. `InputFieldSpec.key` is an unconstrained `str` and no
 * server-side identifier predicate exists, so a client-side regex here would be a second copy
 * of a rule that has no original (D-182-06). Whatever the server accepts, this door accepts.
 */
export function refuseDeclaredInputKey(
  key: string,
  existing: readonly DeclaredInput[],
): DeclaredInputRefusal | null {
  const trimmed = typeof key === "string" ? key.trim() : ""
  if (trimmed.length === 0) return "empty"
  if (RESERVED_LAUNCH_INPUT_KEYS.has(trimmed)) return "reserved"
  if (existing.some((e) => e.key === trimmed)) return "duplicate"
  return null
}

/** A defensive object narrowing — server JSONB arrives as `unknown` and may be anything. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * The ask keys THIS definition's own steps already name and that nothing declares yet.
 *
 * ⭐ THIS IS THE EXIT FROM `BUG-260828-02`'S LOOP. An author who chose *"Asked when this
 * runs"* on an argument row has already typed the key once; asking them to type it again in
 * a second place, and to guess the same spelling, is how `to` in one place and `recipient` in
 * the other produce a publish refusal nobody can read. Offering the keys the steps name makes
 * the two agree by construction.
 *
 * Defensive throughout: `phases`, `config` and `arg_sources` all arrive from server JSONB, so
 * a non-array, a non-object or a null degrades to "contributes nothing" rather than throwing.
 * Reserved keys are never offered — declaring one would be refused anyway.
 *
 * Order is phase order, then property order; the result is de-duplicated.
 */
export function undeclaredAskKeys(def: { inputs?: unknown; phases?: unknown }): string[] {
  const declared = new Set<string>()
  const rawInputs = def?.inputs
  if (Array.isArray(rawInputs)) {
    for (const entry of rawInputs) {
      const rec = asRecord(entry)
      const key = rec?.key
      if (typeof key === "string" && key.length > 0) declared.add(key)
    }
  }

  const out: string[] = []
  const seen = new Set<string>()
  const phases = def?.phases
  if (!Array.isArray(phases)) return out

  for (const phase of phases) {
    const config = asRecord(asRecord(phase)?.config)
    const argSources = asRecord(config?.arg_sources)
    if (argSources === null) continue

    for (const [name, rawSource] of Object.entries(argSources)) {
      const source = asRecord(rawSource)
      if (source === null || source.source !== "ask") continue

      // `key = ask_key or name` — the server's rule, re-spelled under the accepted-cost
      // note in this module's header. `args.py` owns it.
      const askKey = source.ask_key
      const key = typeof askKey === "string" && askKey.trim().length > 0 ? askKey.trim() : name
      if (key.length === 0) continue
      if (declared.has(key) || RESERVED_LAUNCH_INPUT_KEYS.has(key) || seen.has(key)) continue

      seen.add(key)
      out.push(key)
    }
  }

  return out
}
