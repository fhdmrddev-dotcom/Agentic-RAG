/**
 * ⭐ THE GOVERNED VOCABULARY — sketch 214, Phase 214 (STEP-01 / STEP-02).
 *
 * ⚠ THIS TABLE IS THE ARTIFACT THAT PORTS. It becomes
 * `frontend/src/components/workflows/argumentVocabulary.ts`, beside the shipped
 * `phaseVocabulary.ts` / `externalShapeVocabulary.ts` / `doorVocabulary.ts` whose shape it
 * mirrors — a governed id, character-asserted by its own suite, NEVER a sentence living
 * inside a component. `ExternalActionSection.tsx`'s own docblock states the rule verbatim:
 * *"a sentence that lives inside a component is a sentence nobody can test for drift."*
 *
 * `drive.cjs` asserts COPY -> HTML in that direction only: it proves the sketch invented no
 * sentence the build cannot import. The reverse would only prove the table is big enough.
 *
 * ── ⚠ EVERY DASH BELOW IS AN EM DASH (U+2014) ──
 * `doorVocabulary.test.ts` asserts the codepoint over its whole table. Same rule here.
 */

const COPY = {
  // ── §1 · THE THREE SOURCE ARMS ────────────────────────────────────────────────────────
  //
  // ⚠ TWO OF THE THREE ARE REWORDED FROM D-214-01, AND BOTH ORIGINALS ARE KEPT IN THE
  // README SO THE CHANGE IS AUDITABLE RATHER THAN SILENT. The third is kept verbatim
  // because it was already the person's words.
  ARG_SOURCE_FIXED: "Set here",
  ARG_SOURCE_ASK: "Asked when this runs",
  ARG_SOURCE_UPSTREAM: "From an earlier step",

  /** The group label above the three arms. Names the QUESTION, not the mechanism. */
  ARG_SOURCE_GROUP_LABEL: "Where this comes from",

  // ── §2 · WHAT EACH ARM SAYS ABOUT ITSELF, ONCE CHOSEN ─────────────────────────────────
  //
  // ⚠ These are the SOURCE GUTTER's readings — the thing Stitch's `03` found and this
  // sketch keeps. One short phrase per row, read down the column.
  ARG_READING_FIXED: "You set this",
  /** Composed: the key a launcher will render a field for. */
  ARG_READING_ASK: (key) => `Asked for as “${key}”`,
  /** Composed: the upstream step, in the AUTHOR'S OWN NAME for it — never a slug. */
  ARG_READING_UPSTREAM: (phaseName) => `Whatever “${phaseName}” produced`,

  // ── §3 · THE UNSATISFIED ROW ──────────────────────────────────────────────────────────
  //
  // ⚠ Replaces Stitch's `REQ` marker, which is a wire abbreviation. The row does not label
  // itself "required" and leave the reader to infer the problem — it NAMES the problem.
  ARG_NO_SOURCE: "Nothing supplies this yet",
  ARG_REQUIRED_MARK: "Required",
  ARG_OPTIONAL_MARK: "Optional",

  // ── §4 · D-214-03 · THE SILENT AUTO-FILL BECOMES A VISIBLE DEFAULT ────────────────────
  //
  // ⚠ `_BODY_ARG_FOR_CAPABILITY` fills `body` from the previous phase today and says
  // nothing (`phase_types.py:2151`). The behaviour is unchanged; the SILENCE is what ends.
  ARG_PRESET_NOTE: "Set for you — change it if that is not what you meant.",

  // ── §5 · D-214-06 · AN ARGUMENT WE CANNOT DRAW A FIELD FOR ────────────────────────────
  //
  // ⚠ NO JSON ESCAPE HATCH — NOT ANYWHERE. It names itself and says what it is; if it is
  // required the step is unsatisfiable and publish refuses it. A textarea "for the hard
  // cases" is `Tool Arguments (JSON)` under a new name.
  ARG_UNRENDERABLE: (name) => `“${name}” is a list of items — this form cannot fill it in.`,
  ARG_UNRENDERABLE_REQUIRED: "This action cannot be used here yet.",
  ARG_UNRENDERABLE_OPTIONAL: "This step can still run — it will be left out.",

  // ── §6 · D-214-07 · A TOOL WHOSE SCHEMA WE DO NOT HAVE ────────────────────────────────
  //
  // ⚠ "Unknown" and "satisfied" must not look the same. No fields are invented and no
  // key/value rows appear. The control below is the SHIPPED `MCP_DISCOVER_BUTTON_LABEL`
  // (`McpToolPicker.tsx:58`), character for character — two doors onto one act must not
  // acquire two names.
  ARG_SCHEMA_UNKNOWN: "We do not know what this action needs.",
  ARG_SCHEMA_UNKNOWN_NEXT: "Refresh actions",

  // ── §7 · D-214-08 · A STORED KEY THE SCHEMA DOES NOT DECLARE ──────────────────────────
  //
  // ⚠ NEVER DROPPED SILENTLY. The adapter already fails closed on an undeclared key
  // (`smtp_adapter.py:337`, `jira_adapter.py:453`), so a silent drop would hide a step that
  // was ALREADY broken — a behaviour change the author cannot see, on an outbound path.
  ARG_LEFTOVER: (name) => `“${name}” is not something this action accepts.`,
  ARG_LEFTOVER_NEXT: "Remove it",

  // ── §8 · THE STEP HEADER ──────────────────────────────────────────────────────────────
  //
  // ⚠ THE SERVICE AND THE ACTION, BOTH, IN THE AUTHOR'S WORDS. SC#4's sentence one screen
  // earlier: the identity a person needs is *Slack*, never `post_message`.
  ARG_SECTION_HEADING: "What this step sends",
  /** Composed: the resolved service display name + the action's human name. */
  ARG_STEP_IDENTITY: (service, action) => `${action} · ${service}`,

  // ── §9 · THE UPSTREAM PICKER (D-214-02) ───────────────────────────────────────────────
  //
  // ⚠ A DROPDOWN OF UPSTREAM PHASES BY AUTHORED NAME. No dotted paths, no `{{ }}`, no
  // output-key sub-picker — it is STRUCTURALLY INCAPABLE of becoming an expression
  // language, which is what keeps D-09 intact.
  ARG_UPSTREAM_PICK_LABEL: "Which earlier step",
  ARG_UPSTREAM_NONE_OPTION: "— choose an earlier step —",
  ARG_UPSTREAM_EMPTY: "This is the first step — nothing runs before it.",

  // ── §10 · THE ASK-AT-LAUNCH DECLARATION (D-214-09) ────────────────────────────────────
  //
  // ⚠ `Ask at launch` WITH NO MATCHING `inputs[]` ENTRY IS `BUG-260826-01` AGAIN — a
  // declared intention no launcher can honour. The field is where the key gets declared,
  // so the gate has something real to check.
  ARG_ASK_KEY_LABEL: "Ask for it as",
  ARG_ASK_KEY_HINT: "This becomes a field on every way of starting this workflow.",
}

if (typeof module !== "undefined") module.exports = { COPY }
