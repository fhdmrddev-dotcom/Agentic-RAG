/**
 * Phase 206.2-02 (D-206.2-01 / D-206.2-08, UI-SPEC § Surface 1) — externalShapeVocabulary.
 *
 * ONE CONTRACT: how an `external_action` step reaches outside. There are two answers, and
 * they are two DIFFERENT QUESTIONS rather than four options on one list — which is the whole
 * reason this module exists.
 *
 * ── (a) WHY A NEW TYPE, AND NOT A FOURTH KEY IN THE SHIPPED CAPABILITY TABLE ──
 * The capability set is CLOSED, and it is closed in four independent places that all agree
 * with each other on purpose. Measured at this plan's base:
 *   1. a server-side `Literal` of exactly three members — `backend/app/models/connector.py:96`;
 *   2. a `CHECK (capability IN (…))` constraint — `supabase/migrations/116_connector_connections.sql:71`;
 *   3. a MODULE-SCOPE `assert` at `models/connector.py:101` comparing that `Literal` against
 *      `EXTERNAL_ACTION_CAPABILITIES` — it fails at IMPORT, so a fourth member takes the whole
 *      backend process down at start-up rather than at the first request;
 *   4. a second module-scope `assert` at `:169` pinning the per-capability config-model
 *      registry to the same set.
 * So a fourth key here would not be one fence to update. It would be four separate failures,
 * three of them in another language and one of them in the database. An MCP step is not a
 * fourth capability — its `capability` column is null and its destination is its own URL —
 * and modelling it as one would be a lie the schema itself refuses to hold.
 *
 * ── (b) THIS MODULE IS A TRUE LEAF: IT IMPORTS NOTHING ──
 * The `doorVocabulary.ts` / `receiptVocabulary.ts` / `ownProperty.ts` house rule, and its
 * stated reason: a leaf with no edges is un-cyclable BY CONSTRUCTION. `grep -Ec "^import"`
 * over this file is **0**, and one import falsifies that sentence. It is consumed by
 * `ConnectionPicker.tsx` (this plan) and by `ExternalActionSection.tsx` (206.2-03) — the two
 * files that must agree about the answer, which is precisely why the answer lives in neither.
 *
 * ── (c) DECLARATION ORDER IS LOAD-BEARING FOR WHAT 206.2-03 ADDS HERE ──
 * The string constants for the shape control land in this module next wave. Every scalar is
 * declared ABOVE any array or object literal that reads it. 206.1 MEASURED a temporal-dead-zone
 * `ReferenceError` at module load from getting that order wrong — an error which no type
 * checker reports, because `const` hoisting is a runtime rule and not a typing one.
 *
 * ── (d) THIS MODULE EXPORTS NO COMPONENT, AND THAT IS A LINT CONTRACT ──
 * A runtime constant exported from a file that also exports a component is a
 * `react-refresh/only-export-components` error. That is the recorded reason
 * `EXTERNAL_ACTION_CAPABILITIES` is not exported from `ExternalActionSection.tsx`, and it is
 * why the shape's words get a module of their own rather than a home beside the control that
 * renders them.
 */

/**
 * How an `external_action` step reaches outside.
 *
 * `"capability"` — one of the closed set of first-party actions, bound to a connection that
 * carries that capability. `"mcp"` — a named tool on a remote MCP server, bound to a
 * connection that carries a server URL and no capability at all.
 *
 * ⚠ THE TWO QUESTIONS ARE ORDERED. The shape is answered first; only then is there a second
 * question, and which second question it is depends on this answer. A surface that asked both
 * at once would be asking an author to choose between four things that are not comparable.
 */
export type ExternalActionShape = "capability" | "mcp"

/* ─────────────────────────────────────────────────────────────────────────────────────
 * 206.2-03 — THE SHAPE CONTROL'S THREE STRINGS.
 *
 * They land BELOW the type and ABOVE nothing, which satisfies §(c)'s declaration-order
 * rule trivially: this module still declares no array and no object literal, so no scalar
 * can be read before it is initialised. The rule is restated rather than assumed, because
 * the temporal-dead-zone error 206.1 measured is invisible to the type checker.
 *
 * ⚠ THIS MODULE STILL SPELLS NO CAPABILITY ID and still imports nothing. Both are
 * asserted, not intended.
 * ───────────────────────────────────────────────────────────────────────────────────── */

/**
 * The accessible name of the shape radiogroup.
 *
 * ⚠ IT MUST NOT EQUAL THE SECTION HEADING, and that is a mechanical constraint rather than
 * an editorial preference. `ExternalActionSection.test.tsx:171` resolves the shipped
 * capability group with `getByRole("radiogroup", { name: <the section heading> })` — an
 * EXACT accessible-name match. A second radiogroup carrying a DIFFERENT name leaves that
 * query unambiguous and the pin green; a second radiogroup carrying the SAME name makes it
 * match two elements and the shipped assertion throws.
 *
 * It also asks a different question from the heading, which is why two names are honest
 * rather than merely convenient: the heading says what the step does, this says how it
 * gets there.
 */
export const EXTERNAL_SHAPE_GROUP_LABEL = "How this step reaches outside"

/**
 * Segment A — the closed first-party set.
 *
 * It names the SCOPE, not an act. The three acts are the rows immediately below it, so a
 * label that re-stated a verb would be a fourth copy of sentences that already have exactly
 * one home. ⚠ It names no capability id, which a shipped fence sweeps the whole step
 * panel's HTML for.
 *
 * The word *three* cannot drift: the set is CHECK-constrained in the database, mirrored by
 * a module-scope assertion that fails at IMPORT, and pinned by assertions on both sides of
 * the language boundary. If it ever became four, this string is the least of what breaks.
 */
export const EXTERNAL_SHAPE_CAPABILITY_LABEL = "One of these three actions"

/**
 * Segment B — a named tool on a remote MCP server.
 *
 * A parallel NOUN PHRASE, so the two segments answer one question in one grammar.
 *
 * ⚠ IT DELIBERATELY DOES NOT SAY WHAT THE TOOL DOES. The wire carries no read/write hint —
 * measured: the live `tools/list` payload cached in the database has no `annotations` key at
 * all — so any verb here would be fabricated. Re-open trigger: *the wire gaining that hint*,
 * which is the only thing that would make a stronger sentence true rather than generic.
 */
export const EXTERNAL_SHAPE_MCP_LABEL = "A tool on an MCP server"
