/**
 * Phase 214-13 Task 2 (STEP-06 · D-214-21 · sketch 217 §4) — describeServiceMatch.
 *
 * FINDING A SERVICE NAME IN THE AUTHOR'S OWN FREE TEXT — which is a MATCH, and therefore a
 * thing that can be wrong.
 *
 * ── ⚠ THE FALLBACK IS THE DELIVERABLE, NOT THE MATCH ─────────────────────────────────────
 * Sketch 217 §4 states the rule this module exists to hold: *"mark only an exact,
 * case-insensitive WHOLE-WORD match against a name in the catalog, and fall back to the
 * unanchored refusal when there is no unambiguous single match. A plan choosing B must carry
 * that fallback, or it has shipped a guess wearing a mark."*
 *
 * **A MIS-ANCHOR IS WORSE THAN NO ANCHOR**, because it claims a precision the system does not
 * have. So `serviceAnchor` below returns `null` on every doubt — a substring inside a longer
 * word, two catalog names in one sentence, the same name written twice — and the door then
 * renders the refusal WITHOUT the marked span. Never a partial anchor. Never a best guess.
 * That is the same discipline `doorVocabulary.ts:250-255` records for `DESCRIBE_REFUSAL`:
 * never print a verdict nothing computes.
 *
 * ── ⚠ THE PREDICATE IS "NOT CONNECTED", NOT "NOT TICKED", AND THE GOVERNED SENTENCE IS WHY ─
 * `DOOR_REFUSAL` reads *"«service» is not connected — connect it in Settings, or describe this
 * step without it."* A service the author HAS connected but did not tick is a different fact,
 * and refusing it with those words would make a governed, character-asserted string say
 * something false. So this module is handed the CONNECTED service ids and refuses only what is
 * genuinely absent. The ticked set governs the GENERATOR's vocabulary (a separate mechanism,
 * enforced server-side); it does not govern this sentence. A ticked service is necessarily a
 * connected one, so *"a match already in the ticked set produces no refusal"* holds here by a
 * strictly safer predicate rather than by coincidence.
 *
 * ── A ZERO-IMPORT LEAF ───────────────────────────────────────────────────────────────────
 * Pure functions over strings. No React, no api client, no vocabulary import — the door
 * composes the sentence from `doorVocabulary.ts`; this module only decides WHICH service, and
 * WHETHER it can be pointed at.
 */

/** One known service the author could name. `id` is the free-text `service_id`. */
export interface ServiceCatalogEntry {
  readonly id: string
  readonly name: string
}

/** Where the service name sits in the author's own text, so the door can mark that span. */
export interface ServiceAnchor {
  /** The author's OWN characters, in their own casing — never the catalog's spelling. */
  readonly service: string
  readonly start: number
  readonly end: number
}

/**
 * The refusal, or `null` when there is nothing to refuse.
 *
 * `anchor === null` is the UNANCHORED arm — the refusal still renders and still names the
 * service, but the author's prose carries no mark. That is variant A, and it is where every
 * doubt lands.
 */
export interface ServiceRefusal {
  /** What the sentence names. */
  readonly service: string
  /** The catalog id behind it, for the connect action. */
  readonly serviceId: string
  readonly anchor: ServiceAnchor | null
}

/** Escape a catalog name for use inside a `RegExp`. Catalog names are authored, not user
 *  input — but a name containing `.` or `+` would otherwise match text that does not
 *  contain it, which is the mis-anchor this module refuses. */
function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Every whole-word occurrence of `name` in `text`, case-insensitively.
 *
 * ⚠ `\b` IS NOT USED, AND THAT IS DELIBERATE. A catalog name may end in a non-word character
 * (`Custom MCP` is fine, but a future `Node.js` is not), and `\b` after a `.` asserts the
 * opposite boundary — so the guard would silently invert for exactly the names most likely to
 * be got wrong. The boundary is asserted on the neighbouring characters instead, which is
 * indifferent to what the name itself ends with.
 */
function wholeWordOccurrences(text: string, name: string): Array<{ start: number; end: number }> {
  const hits: Array<{ start: number; end: number }> = []
  const needle = escapeForRegExp(name)
  if (needle.length === 0) return hits
  const re = new RegExp(needle, "gi")
  const isWordChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_]/.test(ch)
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    // ⚠ THE SUBSTRING GUARD, ON BOTH SIDES. Without it `Notion` matches inside `Notionally`
    // and `Jira` inside `Jirafe` — a guess wearing a mark. Punctuation and whitespace are NOT
    // word characters, so `"…post to Slack."` and `"(Slack)"` still anchor.
    if (isWordChar(text[start - 1]) || isWordChar(text[end])) {
      // A zero-width advance is impossible here (`needle.length > 0`), so the loop terminates.
      continue
    }
    hits.push({ start, end })
  }
  return hits
}

/**
 * The catalog services the prose NAMES and the author has NOT connected, in order of first
 * mention.
 *
 * Order is by first mention rather than by catalog order so that, when the door must pick one
 * service to name in an unanchored refusal, it names the one the author wrote FIRST — a fact
 * about their own sentence rather than a fact about our table.
 */
export function unconnectedServicesNamed(
  text: string,
  catalog: readonly ServiceCatalogEntry[],
  connectedServiceIds: readonly string[],
): ServiceCatalogEntry[] {
  if (typeof text !== "string" || text.trim().length === 0) return []
  const connected = new Set(connectedServiceIds.map((id) => id.trim().toLowerCase()))
  const found: Array<{ entry: ServiceCatalogEntry; at: number }> = []
  const seen = new Set<string>()
  for (const entry of catalog) {
    const id = (entry?.id ?? "").trim().toLowerCase()
    const name = (entry?.name ?? "").trim()
    if (id.length === 0 || name.length === 0) continue
    if (connected.has(id)) continue
    // ⚠ ONE ENTRY PER SERVICE ID. A catalog carrying two rows for one service (an alias, a
    // rename) would otherwise register as an AMBIGUITY and suppress an anchor that is not
    // actually in doubt.
    if (seen.has(id)) continue
    const hits = wholeWordOccurrences(text, name)
    if (hits.length === 0) continue
    seen.add(id)
    found.push({ entry, at: hits[0].start })
  }
  found.sort((a, b) => a.at - b.at)
  return found.map((f) => f.entry)
}

/**
 * ⭐ THE ANCHOR — an unambiguous single whole-word match on an unconnected service, or `null`.
 *
 * `null` on every one of these, and each is a case the suite drives:
 *   · nothing named;
 *   · the named service IS connected (nothing to refuse);
 *   · a substring-only hit (`Notionally` is not `Notion`);
 *   · TWO different unconnected services named in one description;
 *   · the SAME service named twice — two candidate spans, and marking either would be a coin
 *     toss dressed as a measurement.
 */
export function serviceAnchor(
  text: string,
  catalog: readonly ServiceCatalogEntry[],
  connectedServiceIds: readonly string[],
): ServiceAnchor | null {
  const named = unconnectedServicesNamed(text, catalog, connectedServiceIds)
  if (named.length !== 1) return null
  const hits = wholeWordOccurrences(text, named[0].name)
  if (hits.length !== 1) return null
  const { start, end } = hits[0]
  // The author's OWN characters — `DOOR_REFUSAL`'s service name comes from what they wrote
  // (D-214-21), so a lower-cased `slack` stays lower-cased in their sentence and in ours.
  return { service: text.slice(start, end), start, end }
}

/**
 * The whole decision, in one call: what the door should refuse, and whether it may point.
 *
 * `null` means there is nothing to refuse — which is the resting case and, by sketch 217
 * invariant #1, must remain byte-identical to today's DOM.
 */
export function matchServiceRefusal(
  text: string,
  catalog: readonly ServiceCatalogEntry[],
  connectedServiceIds: readonly string[],
): ServiceRefusal | null {
  const named = unconnectedServicesNamed(text, catalog, connectedServiceIds)
  if (named.length === 0) return null
  const anchor = serviceAnchor(text, catalog, connectedServiceIds)
  // ⚠ THE UNANCHORED ARM STILL NAMES A SERVICE, AND THAT IS NOT A GUESS. Every entry in
  // `named` is genuinely named in the prose and genuinely not connected, so the SENTENCE is
  // true of any of them; what is in doubt is only WHERE to mark, and that is exactly what is
  // withheld. Naming the first-mentioned one keeps the refusal about the author's sentence
  // rather than about our table's order.
  return {
    service: anchor ? anchor.service : named[0].name,
    serviceId: named[0].id,
    anchor,
  }
}
