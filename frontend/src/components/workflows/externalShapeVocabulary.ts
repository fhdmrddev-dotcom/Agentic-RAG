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
 * ⚠ 211-04 (SC#3 / CONN-05 / SEED-207) — THE THREE SHAPE-CONTROL STRINGS ARE DELETED,
 * BECAUSE THE CONTROL THEY NAMED IS DELETED. They were, verbatim, the AXIS stated in words —
 * the group's accessible name asked *"How this step reaches outside"*, its first segment read
 * *"One of these three actions"* and its second *"A tool on an MCP server"*.
 *
 * ⚠ THE THREE IDENTIFIERS ARE NOT SPELLED HERE, and that is mechanical rather than coy: this
 * plan's acceptance sweep greps all of `src` for them and a docblock naming them would count
 * itself — the 187-24 trap. The VALUES are quoted instead, which is the part a reader needs.
 *
 * SC#3's wording is *"a user browsing or picking a connection is never offered Message /
 * Ticket / Email as a category"*, and a segmented control whose first position reads *"One of
 * these three actions"* is precisely that offer — made before the author has been shown a
 * single connection.
 *
 * ⚠ WHAT DID **NOT** CHANGE, AND MUST NOT BE READ AS HAVING CHANGED. §(a) above is about the
 * capability set being CLOSED, in four independent places, one of them the database. That
 * argument stands untouched: this phase demotes the verb from an ORGANISING AXIS to an
 * ATTRIBUTE, and *optional* / *closed* are independent properties. Nothing here opens the set.
 *
 * The TYPE survives because the two shapes still exist — the executor branches on them, and
 * `ExternalActionSection` still READS a step's stored config to say which one it is. What
 * ended is asking a person to answer it first.
 * ───────────────────────────────────────────────────────────────────────────────────── */
