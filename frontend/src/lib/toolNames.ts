/**
 * Phase 200-04 Task 1 (DES-02, `200-CHECKLIST.md` §1 `SP-MR-01` / `SP-MNR-01` / `SP-MNR-07`) —
 * THE ONE HOME FOR TOOL PHRASES.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────────────────
 *
 * `PhaseFormPanel` offers the author a set of tool ids and renders each one as a chip. The
 * ids are the SERVER'S — `rails.toolOptions` ← `GroundingBundle.tools` ← `sorted(schema_tool_names)`
 * ← `{t["function"]["name"] for t in get_tools(None)}` — so they are wire values, spelled the
 * way the schema spells them: `query_documents_by_view`, `workspace_write`, `write_todos`.
 * A person choosing what a step may do should not be reading a schema.
 *
 * The panel already had a five-entry map for this and it is the ledger row `SP-1`'s whole
 * complaint: *"MEASURED live. The inconsistency reads worse than the noise."* Three named
 * phrases beside twenty-five raw ids looks half-finished in a way twenty-eight raw ids does
 * not. This module names all of them, in ONE place, so the next id the server adds fails a
 * test instead of silently appearing as a schema token on a business user's screen.
 *
 * ── ⚠ WHY `own()` AND NOT A COALESCED BRACKET READ — A MEASURED DEFECT, NOT A STYLE RULE ─
 *
 * ⚠ THE FORBIDDEN FORM IS DESCRIBED HERE AND DELIBERATELY NEVER SPELLED: a bracket index
 * into the table, coalesced against the id. This plan's acceptance grep counts that shape in
 * THIS file, so prose that quotes the needle makes its own guard lie — the 187-24 trap, which
 * this docblock hit on its first draft and which has now caught four authors in this tree.
 *
 * The shipped reader was exactly that shape, and this is the EIGHTH live instance of the WR-04
 * prototype-key sink in this tree (`BUG-260807-01`, `BUG-260808-01`, `runVocabulary.ts`,
 * `modelFitness.ts`, `editAffordance.ts`, `WorkflowCanvas.tsx` ×3 … the repo has now fixed
 * this shape seven times before this one). A plain object literal INHERITS `constructor`,
 * `toString`, `valueOf` and `__proto__`, so `map["constructor"]` resolves the inherited
 * `Object.prototype.constructor` — **a function, which is never nullish** — and the `??`
 * therefore never fires.
 *
 * ⚠ THE OBSERVED RED WAS WORSE THAN THE PREDICTION, so it is recorded here rather than
 * paraphrased. Driven against the shipped panel with `available_tools: ["constructor"]`,
 * React did not render `[Function Object]`; it REFUSED the child outright —
 *
 *     Functions are not valid as a React child. ... <span>{Object}</span>
 *     RENDERED CHIP TEXT >>> "ⓘ"
 *
 * — so the chip's label rendered as **nothing at all**. A tool the step really names
 * disappeared from the list of what the step can do, which is a governance surface. The
 * author reaches the map through the non-rails variant's FREE-TEXT COMMA FIELD
 * (`PhaseFormPanel.rails.test.tsx:90`), so an arbitrary string genuinely does reach this
 * lookup — this is a live path, not a theoretical one.
 *
 * `own()` returns `undefined` for an inherited key, so the honest fallback fires and the id
 * is printed unchanged. ⚠ NEVER re-spell this as a coalesced bracket read; that IS the defect.
 *
 * ── ⚠ THE TWO DEAD ENTRIES ARE DELETED, AND WHICH IS SAID RATHER THAN LEFT TO A COUNT ────
 *
 * `200-CHECKLIST.md` §0 X-13 measured the shipped map by EXECUTION, not by reading it: five
 * entries, of which only THREE name an id the server ever offers. **`fetch_url` and
 * `list_folders` are not in `get_tools(None)` and can never fire.** Both are DELETED here
 * (`SP-MNR-07`), not re-pointed: a phrase for an id nothing offers is invisible until
 * somebody counts, which is the same failure mode as a hot-file row that is present and
 * wrong. Their nearest live relatives are `web_search` and `query_documents_by_view`, and
 * both of those are named below on their own terms.
 *
 * ⚠ THE INHERITED FIGURE `3 of 27` IS STALE AND MAY NOT BE QUOTED. The measured pair is
 * **5 map entries / 28 offered ids, of which 3 could ever fire** (X-13).
 *
 * ── THE PHRASES ARE OURS, THE IDS ARE THE SERVER'S ──────────────────────────────────────
 *
 * Twelve of the phrases below are the sketch's own wording (`screens/step-panel.html`,
 * recorded as N-10). The other sixteen are authored here, in the same register, because the
 * sketch drew twelve and the server offers twenty-eight — the sketch's twelve do not map
 * 1:1 onto them and N-10 says so in as many words.
 *
 * ⚠ THIS IS A DISPLAY MAP, NEVER AN OPTIONS SOURCE. The set an author may choose FROM is
 * `rails.toolOptions` and nothing else; a client-assembled whitelist would let knowledge-base
 * content whitelist itself, which is the elevation of privilege the server-owned registry
 * exists to prevent (`PhaseFormPanel.tsx`'s own docblock says so). An id present here and
 * absent from `toolOptions` is not offerable, and an id offered but absent here still renders
 * — as itself.
 */
import { own } from "@/components/workflows/ownProperty"

/**
 * Every tool id the schema can offer, mapped to the phrase a person reads.
 *
 * Ordered as `200-CHECKLIST.md` §0 publishes the offered set — alphabetically, which is the
 * server's own `sorted(schema_tool_names)` order — so a diff against the published list is a
 * line-by-line read rather than a search.
 */
export const TOOL_PHRASES: Record<string, string> = {
  analyze_document: "Analyze a document",
  ask_user: "Ask a person",
  attach_skill_file: "Attach a skill file",
  execute_code: "Run code",
  fetch_document_file: "Open a document's file",
  get_related_documents: "Read related documents",
  glob: "Find files by name",
  grep: "Search inside files",
  load_skill: "Load a skill",
  ls: "List a folder's files",
  query_documents: "Filter documents by their details",
  query_documents_by_view: "Search a saved view",
  query_tables: "Query tables",
  read_document: "Read a document",
  read_skill_file: "Read a skill's file",
  recall: "Recall something remembered",
  remember: "Remember something",
  save_skill: "Save a skill",
  search_documents: "Search documents",
  task: "Hand off to a helper",
  tree: "See the folder tree",
  web_search: "Browse the web",
  workspace_delete: "Delete a file",
  workspace_diff: "Compare a file's changes",
  workspace_list: "List its files",
  workspace_read: "Read a file",
  workspace_write: "Write a file",
  write_todos: "Track its to-dos",
}

/**
 * The tool id a person reads, or the id itself when nothing named it.
 *
 * ⚠ THE FALLBACK IS DELIBERATE AND STAYS. An id we have no phrase for prints as itself,
 * which is honest and fixable; substituting a prettified derivation (title-casing the id,
 * say) would invent a phrase the product never authored and make the gap invisible — the
 * fabricated-copy failure class this phase exists to avoid. The coverage case in
 * `toolNames.test.ts` is what keeps the fallback from quietly becoming the normal path.
 */
export function toolName(id: string): string {
  return own(TOOL_PHRASES, id) ?? id
}
