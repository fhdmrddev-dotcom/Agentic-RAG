/**
 * Phase 214-11 Task 2 (STEP-04 · D-214-16 / D-214-14 · sketch 216 invariant #4) — THE ONE
 * PLACE A CAPABILITY BECOMES A WORD A PERSON READS.
 *
 * ── WHY IT IS A MODULE AND NOT THREE LOCAL HELPERS ────────────────────────────────────
 *
 * Five surfaces render the step identity, and four of them must resolve the ACTION before
 * they can. The first draft of this plan wrote the resolution inline in `PhaseCard`, then
 * again in `PendingAskStack`, and the second copy was already subtly different — it reached
 * the table through a bracket index where the first used `own()`. That is D-214-16's own
 * sentence arriving as a defect rather than as a principle: *"coverage should be a
 * consequence of one component existing, not a list kept in sync."* The element was made
 * shared for exactly this reason; so is this.
 *
 * ── ⚠ THE WIRE `tool_name` IS AN ID AND NEVER LEAVES THIS MODULE ──────────────────────
 *
 * Sketch 216 invariant #4 forbids the five wire ids on any run surface, and a native step's
 * `tool_name` IS one of those spellings. So the CAPABILITY is translated through
 * `phaseVocabulary`'s shipped sentence map, and anything the map does not own resolves to
 * `null` rather than to the id.
 *
 * ⚠ **`null` IS THE ANSWER FOR AN MCP STEP, AND THAT IS A DECISION.** An MCP row carries
 * `capability = null` and a server-defined `tool_name` (`read_wiki_structure`,
 * `ask_question`) for which this product has authored no phrase. PATTERNS §4d's floor is
 * *"a name is NEVER fabricated … an id-shaped face is worse than a generic one"*, and
 * title-casing a server's tool id would invent copy we never wrote. The BACKEND composes a
 * human sentence for the approval pause (`214-06`), because it can read the MCP server's own
 * tool titles; the client cannot, and must not pretend otherwise. ⭐ The consequence is
 * stated rather than hidden: **an MCP step renders no identity on the four wire-fed run
 * surfaces**, and closing that needs a tool-title on the wire, not a client-side guess.
 *
 * ── ⚠ `own()` RATHER THAN A BRACKET READ — WR-04, THE TREE'S NINTH SINK ────────────────
 *
 * `capability` is author-supplied JSONB that travels the wire unvalidated. A plain object
 * literal inherits `constructor`, `toString` and `__proto__`, so a bracket index returns a
 * FUNCTION for those keys — never nullish, so a `??` fallback provably never fires — and
 * React refuses a function child outright, rendering the action as NOTHING AT ALL. This tree
 * has now fixed that shape nine times; the forbidden form is deliberately not spelled here,
 * because a comment quoting it makes the grep that forbids it lie (the 187-24 trap).
 *
 * ── A LEAF ────────────────────────────────────────────────────────────────────────────
 *
 * Two imports, both to leaves of their own, no component export, no store, no fetch. It can
 * therefore be read by a panel module, a chat module and a page without closing a cycle, and
 * `react-refresh/only-export-components` has nothing to complain about.
 */
import { EXTERNAL_CAPABILITY_SENTENCES } from "@/components/workflows/phaseVocabulary"
import { own } from "@/components/workflows/ownProperty"

/**
 * The action a person reads for a step's capability, or `null` when we have no honest word.
 *
 * TOTAL over any input — `null`, `undefined`, whitespace, an unmapped id and a prototype key
 * all return `null` rather than throwing or returning something id-shaped.
 */
export function stepActionWords(capability: string | null | undefined): string | null {
  if (typeof capability !== "string") return null
  const key = capability.trim()
  if (key.length === 0) return null
  return own(EXTERNAL_CAPABILITY_SENTENCES, key) ?? null
}

/**
 * The MARK's structural input for a step, from the two wire facts that describe it.
 *
 * ⚠ **A CAPABILITY AND A `tool_name` ARE NEVER PASSED TOGETHER, AND THIS WAS MEASURED RED
 * RATHER THAN REASONED.** `connectionMark`'s ladder tests `tool_name` BEFORE `capability`, so
 * a shape carrying both resolves to the MCP mark — and `214-02` sets `tool_name` from
 * `config.tool_name` on NATIVE steps too. Passing the row through verbatim therefore drew the
 * **MCP logo on every Slack, Jira and SMTP step**: the vendor marks were correct and
 * unreachable, which is byte-for-byte the defect the mark module's own arm-0 comment records
 * from the operator's *"GitHub is still showing MCP logo"* report. It was caught by the
 * positive control in `StepIdentity.coverage.test.tsx` — *a KNOWN vendor really does draw its
 * own brand fills* — and by nothing else; every absence assertion beside it passed happily
 * against the wrong mark.
 *
 * The rule this encodes is the mark module's own: **a capability is the ADAPTER fact, and the
 * adapter decides the wire.** A native step names its capability and nothing else; an MCP step
 * carries no capability and is identified by its tool. A step with neither takes the named
 * neutral, which is the honest answer rather than a fallback.
 */
export function stepMarkShape(
  capability: string | null | undefined,
  toolName: string | null | undefined,
): { capability?: string | null; tool_name?: string | null } {
  const cap = typeof capability === "string" ? capability.trim() : ""
  if (cap.length > 0) return { capability: cap }
  const tool = typeof toolName === "string" ? toolName.trim() : ""
  if (tool.length > 0) return { tool_name: tool }
  return {}
}
