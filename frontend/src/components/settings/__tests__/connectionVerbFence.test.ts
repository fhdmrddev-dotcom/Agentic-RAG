/**
 * Phase 211-05 Task 1(a) — SC#3 · THE NEGATIVE VERB FENCE.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT SC#3 ACTUALLY SAYS, AND WHY THIS IS A SOURCE FENCE RATHER THAN A RENDER TEST
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * *"Browsing, filtering and picking never offer Message / Ticket / Email as a CATEGORY."*
 *
 * That is an ABSENCE, over TWO WHOLE SURFACE TREES — `src/components/settings/**` and
 * `src/components/workflows/**`. A render test proves an absence only on the surfaces it
 * happens to mount, and the failure mode SC#3 guards against is a chooser reappearing on a
 * surface nobody thought to mount. So this file walks the SOURCE of both trees at once, in
 * the `?raw`-swept house idiom `ExternalActionSection.test.tsx` §5 records, and it is
 * modelled on that file's discipline rather than on an invented one.
 *
 * ⚠ THE VERB SURVIVES AS AN ATTRIBUTE, AND THE FENCE MUST NOT FLAG THAT. This phase's whole
 * thesis (SEED-207 / CONN-04) is that a connection's verb stops being an AXIS and stays an
 * ATTRIBUTE — so `destinationFactsOf`'s per-row prose, `CONNECTION_CAPABILITY_WORDS`'s three
 * lowercase nouns, `EXTERNAL_CAPABILITY_SENTENCES`'s node-face readings and the connections
 * refusal copy all legitimately contain these words and MUST stay green. **A fence that
 * flags ordinary English produces noise, and noise is how a fence gets deleted** (T-211-24).
 * The matcher is therefore POSITIONAL, never lexical: it looks only where a *category* can
 * be offered, and it is falsified on synthetic MUST-FIRE and MUST-NOT-FIRE controls in §1
 * BEFORE it is pointed at the tree in §3.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE THREE POSITIONS THE MATCHER READS — the mechanical definition of "as a category"
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *  A · NAMED SET     — a string literal on a `label` / `title` / `chip` / `tab` / `option` /
 *                      `name` key inside a top-level declaration whose IDENTIFIER declares it
 *                      to be a set of selectable things (`…OPTIONS`, `…CHOICES`, `…TABS`,
 *                      `…CHIPS`, `…FILTERS`, `…SEGMENTS`, `…CATEGORIES`).
 *  A2 · STRUCTURAL   — the same, in a top-level declaration that carries TWO OR MORE labelled
 *                      entries regardless of what it is called. ⚠ This leg exists because leg
 *                      A alone is evadable by renaming, and a fence a rename defeats is a
 *                      fence that reads as coverage. It is what makes the ONE exemption in §2
 *                      visible rather than accidental.
 *  B · ARIA ROLE     — the text child of an element carrying `role="radio"`, `role="tab"` or
 *                      `role="option"` — the two radiogroups this phase deleted.
 *  C · NATIVE OPTION — the literal text child of an `<option>` element — the `<select>` the
 *                      create flow used to open with.
 *
 * Offenders are reported as `file:line: the line`, so a RED is a WORK ITEM rather than a
 * boolean.
 *
 * ⚠ WHICH HALF OF THE PHASE THIS FILE COVERS. It proves an ABSENCE in source across both
 * trees. It proves nothing about what RENDERS — that is
 * `src/components/workflows/__tests__/connectionCardReachability.test.tsx` (the render gate)
 * and `backend/tests/integration/test_211_service_shape_seam.py` (the stored shape). Three
 * files, three different properties; none of them is the whole.
 *
 * ⚠ THE RETIRED-CONSTANT GREP TRAP (its FIFTH firing in this phase). The constant this phase
 * deleted is deliberately NOT SPELLED anywhere in this file — not in prose and not in a
 * needle — because the acceptance check for its absence is a `grep -r` over `frontend/src`,
 * and a fence that quotes its own needle makes that count lie. Note that leg A's identifier
 * pattern below contains one FRAGMENT of that name and never the name; that is deliberate,
 * and it is `ownProperty.ts`'s recorded discipline applied to a deletion.
 */
import { describe, expect, it } from "vitest"

// ═══════════════════════════════════════════════════════════════════════════════════════
// 0 · THE MATCHER. Pure functions over strings, so §1 can falsify every one of them on
//     synthetic input with no file system and no tree involved.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The three CATEGORY words, case-insensitively and with their plurals. Case-insensitive on
 *  purpose: a segment reading *"Creates a ticket"* is the same axis as one reading
 *  *"Ticket"*, and only the POSITION tells them apart from ordinary prose. */
const CATEGORY_WORD = /\b(messages?|tickets?|e-?mails?)\b/i

/** Leg A — an identifier that DECLARES itself to be a set of selectable things.
 *
 *  ⚠ `SERVICES` WAS ADDED 2026-08-27, AND ITS ABSENCE HAD JUST COST REAL COVERAGE. Phase 212
 *  made `SERVICE_SUGGESTIONS` derive its rows from `servicesCatalog.ts` instead of holding
 *  three literals, which moved the one label this fence exempts into a file whose declarations
 *  — `POPULAR_SERVICES`, `CATALOG_SERVICES` — matched NEITHER leg: not this name test, and not
 *  the structural test either, because the catalog keys its labels `name:` and the structural
 *  count reads only `label:`/`title:`. The result was silent: §3's absence still PASSED, over a
 *  file it could no longer see. The §2 non-vacuity control is the only thing that caught it.
 *
 *  ⚠ MEASURED BLAST RADIUS, not assumed — the anchored declaration grep over both trees returns
 *  exactly three names: `POPULAR_SERVICES`, `CATALOG_SERVICES`, and `SERVICES_BY_ID` (a `new
 *  Map(...)` whose body carries no string-literal label, so it contributes nothing). */
const SELECTABLE_SET_NAME = /(OPTIONS|CHOICES|TABS|CHIPS|FILTERS|SEGMENTS|CATEGORIES|SERVICES)/

/** A top-level declaration head, anchored at column 0 (module scope, never a nested one). */
const TOP_LEVEL_DECL =
  /^(?:export\s+)?(?:const|let|var|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/gm

/** A labelled entry: one of the six label-ish keys carrying a plain string literal. */
const LABELLED_ENTRY =
  /\b(label|title|chip|tab|option|name)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g

/** Leg B — an element carrying a selectable ARIA role, and its immediate text child. */
const ARIA_SELECTABLE =
  /<[A-Za-z][^>]*\brole=["'](?:radio|tab|option)["'][^>]*>([^<{][^<]*)</g

/** Leg C — a native `<option>` whose child is literal text rather than an expression. */
const NATIVE_OPTION = /<option\b[^>]*>([^<{][^<]*)<\/option>/g

export interface Offender {
  /** `file:line` — a work item, never a boolean. */
  where: string
  /** The leg that fired, so a RED says which rule was broken. */
  via: "named-set" | "structural-set" | "aria-role" | "native-option"
  /** The offending text, verbatim. */
  text: string
}

/** ⚠ THE ONE EXEMPTION, AND IT IS NAMED RATHER THAN SILENT.
 *
 *  `SERVICE_SUGGESTIONS` (`settings/connectionFormCopy.ts`, plan 211-03) carries
 *  `{ service_id: "smtp", label: "Email over SMTP" }`. Leg A2 fires on it, correctly by its
 *  own rule — and the row is NOT what SC#3 forbids. It is a SERVICE IDENTITY in a
 *  `<datalist>` of service identities beside Slack and Jira: it names a PROTOCOL a person
 *  types, not a category they are made to choose between before they may see a connection.
 *  211-03's own record is explicit that these entries are DATA and that nothing reads them to
 *  decide behaviour.
 *
 *  ⚠ §2 asserts this exemption is LOAD-BEARING — i.e. that the entry really would fire
 *  without it. An exemption whose target no longer fires is a hole with a comment over it.
 *
 *  RE-OPEN TRIGGER: *a second entry ever being added to this list, or the list growing a
 *  reader that branches on its labels.* Either turns a suggestion into a taxonomy. */
const EXEMPT_DECLARATIONS: ReadonlyArray<{ file: RegExp; declaration: string }> = [
  // ⚠ THE EXEMPTION FOLLOWED ITS TARGET. Until 2026-08-27 this read
  // `{ connectionFormCopy.ts, SERVICE_SUGGESTIONS }`, because that list held the literal
  // `{ service_id: "smtp", label: "Email over SMTP" }`. Phase 212 made the list DERIVE its rows
  // from the catalog — one name per service, which is what the catalog is for — so the label
  // now lives in `servicesCatalog.ts` as `name: "Email (SMTP)"` and the old entry exempted a
  // declaration that no longer offends. An exemption whose target has moved is exactly the
  // "hole with a comment over it" this block's own §2 control exists to refuse.
  //
  // The REASONING is unchanged and still correct: this is a SERVICE IDENTITY in a catalog of
  // service identities beside Slack, Jira and GitHub — it names a PROTOCOL a person recognises,
  // not a verb category they are made to choose between before they may see a connection.
  //
  // RE-OPEN TRIGGER: *the catalog growing a reader that branches on these names*, or a name
  // being added that is a verb rather than a product. Either turns a catalog into a taxonomy.
  //
  // ⚠ ONE ENTRY, AND `CATALOG_SERVICES` DELIBERATELY IS NOT A SECOND. It is declared as
  // `[...POPULAR_SERVICES, {...}]`, so the SMTP string literal lives in exactly ONE block body
  // and only that block ever offends — the first draft of this move exempted both and the §2
  // control failed at `toHaveLength(2)`, which is the control doing its job on the exemption
  // list itself. An exemption for a declaration that does not offend is the same hole in the
  // other direction.
  { file: /servicesCatalog\.ts$/, declaration: "POPULAR_SERVICES" },
]

function isExempt(file: string, declaration: string): boolean {
  return EXEMPT_DECLARATIONS.some(
    (entry) => entry.file.test(file) && entry.declaration === declaration,
  )
}

/** 1-based line number of `index` inside `source`. */
function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

interface Block {
  name: string
  start: number
  body: string
}

/** Every top-level declaration block: from its own head to the next one (or EOF). */
export function topLevelBlocks(source: string): Block[] {
  TOP_LEVEL_DECL.lastIndex = 0
  const heads: Array<{ name: string; start: number }> = []
  let match: RegExpExecArray | null
  while ((match = TOP_LEVEL_DECL.exec(source)) !== null) {
    heads.push({ name: match[1], start: match.index })
  }
  return heads.map((head, i) => ({
    name: head.name,
    start: head.start,
    body: source.slice(head.start, i + 1 < heads.length ? heads[i + 1].start : source.length),
  }))
}

/** Which top-level declarations this file offers as sets of selectable things. */
export function selectableDeclarations(file: string, source: string): string[] {
  const found: string[] = []
  for (const block of topLevelBlocks(source)) {
    LABELLED_ENTRY.lastIndex = 0
    let labelled = 0
    let entry: RegExpExecArray | null
    while ((entry = LABELLED_ENTRY.exec(block.body)) !== null) {
      if (entry[1] === "label" || entry[1] === "title") labelled += 1
    }
    const named = SELECTABLE_SET_NAME.test(block.name)
    const structural = labelled >= 2
    if ((named || structural) && !isExempt(file, block.name)) found.push(block.name)
  }
  return found
}

/** THE MATCHER. Every offending category word, in every position, with its line. */
export function categoryOffenders(file: string, source: string): Offender[] {
  const offenders: Offender[] = []

  // ── legs A and A2 ──
  for (const block of topLevelBlocks(source)) {
    LABELLED_ENTRY.lastIndex = 0
    const entries: Array<{ key: string; value: string; index: number }> = []
    let entry: RegExpExecArray | null
    while ((entry = LABELLED_ENTRY.exec(block.body)) !== null) {
      entries.push({ key: entry[1], value: entry[2].slice(1, -1), index: entry.index })
    }
    const named = SELECTABLE_SET_NAME.test(block.name)
    const structural =
      entries.filter((e) => e.key === "label" || e.key === "title").length >= 2
    if (!named && !structural) continue
    if (isExempt(file, block.name)) continue
    for (const found of entries) {
      if (!CATEGORY_WORD.test(found.value)) continue
      offenders.push({
        where: `${file}:${lineAt(source, block.start + found.index)}`,
        via: named ? "named-set" : "structural-set",
        text: `${block.name} · ${found.key}: ${JSON.stringify(found.value)}`,
      })
    }
  }

  // ── leg B ──
  ARIA_SELECTABLE.lastIndex = 0
  let aria: RegExpExecArray | null
  while ((aria = ARIA_SELECTABLE.exec(source)) !== null) {
    const text = aria[1].trim()
    if (!CATEGORY_WORD.test(text)) continue
    offenders.push({
      where: `${file}:${lineAt(source, aria.index)}`,
      via: "aria-role",
      text,
    })
  }

  // ── leg C ──
  NATIVE_OPTION.lastIndex = 0
  let option: RegExpExecArray | null
  while ((option = NATIVE_OPTION.exec(source)) !== null) {
    const text = option[1].trim()
    if (!CATEGORY_WORD.test(text)) continue
    offenders.push({
      where: `${file}:${lineAt(source, option.index)}`,
      via: "native-option",
      text,
    })
  }

  return offenders
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · FALSIFY THE MATCHER FIRST. ⚠ Every case below runs on SYNTHETIC input; not one of
//     them reads the tree. A matcher trusted before it was falsified is a matcher that can
//     be green because it matches nothing.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** ⚠ These are the SHAPES OF THE DELETED CONTROLS, written out so the fence can be proved
 *  to catch them. They live in a test file, which the walk in §3 excludes — so the fence
 *  cannot count its own controls (the `?raw` self-sweep trap, recorded fifteen times). */
const MUST_FIRE: ReadonlyArray<{ why: string; file: string; source: string }> = [
  {
    why: "a three-verb chooser, declared as a set of choices",
    file: "synthetic/chooser.ts",
    source: [
      "export const CONNECTION_KIND_CHOICES = [",
      '  { value: "send_email", label: "Send an email" },',
      '  { value: "create_ticket", label: "Create a ticket" },',
      '  { value: "post_message", label: "Post a message" },',
      "]",
    ].join("\n"),
  },
  {
    why: "the same set, RENAMED so leg A cannot see it — leg A2 must",
    file: "synthetic/renamed.ts",
    source: [
      "export const CONNECTION_KIND_LADDER = [",
      '  { value: "send_email", label: "Send an email" },',
      '  { value: "create_ticket", label: "Create a ticket" },',
      "]",
    ].join("\n"),
  },
  {
    why: "a radio segment, as the deleted radiogroups rendered",
    file: "synthetic/segment.tsx",
    source: '<button role="radio" aria-checked={false}>Creates a ticket</button>',
  },
  {
    why: "a tab, which is the same axis wearing a different role",
    file: "synthetic/tab.tsx",
    source: '<div role="tab">Email</div>',
  },
  {
    why: "a native <select> option, as the create flow used to open",
    file: "synthetic/select.tsx",
    source: "<select><option value=\"post_message\">Message</option></select>",
  },
]

/** ⚠ THE PROSE THIS TREE LEGITIMATELY SHIPS. Each entry is a REAL shape from a real module
 *  (quoted, not paraphrased) that contains one of the three words as an ATTRIBUTE. Every one
 *  MUST stay green, because this is the half of the fence that decides whether it survives. */
const MUST_NOT_FIRE: ReadonlyArray<{
  why: string
  file: string
  source: string
  /** ⚠ Does this control actually CONTAIN a category word? Almost every one does — that is
   *  what makes it a real test of the matcher's restraint rather than a free pass. The ONE
   *  that does not is marked, because a blanket "every control carries the word" assertion
   *  would either be false or would push a word into a control that has no business holding
   *  one. Its job is different: it proves a REAL selectable set is inspected and silent. */
  carriesWord?: false
}> = [
  {
    why: "`connectionsCopy.ts` — the OFF-switch banner names all three as consequences",
    file: "settings/connectionsCopy.ts",
    source:
      'export const CONNECTIONS_READ_ONLY_BANNER =\n' +
      '  "Connections below are read-only until an operator turns it on — nothing here can ' +
      'be added or changed, and no message, ticket or email will leave."',
  },
  {
    why: "`CHECK_NEGATION_BY_CAPABILITY` — the CLOSED negation table, mirrored from the server",
    file: "settings/connectionRefusalCopy.ts",
    source: [
      "export const CHECK_NEGATION_BY_CAPABILITY = {",
      '  send_email: "No email was sent.",',
      '  create_ticket: "No ticket was created.",',
      '  post_message: "No message was posted.",',
      "}",
    ].join("\n"),
  },
  {
    why: "`capabilityWordOf` — §4c's substitution set, per-row ATTRIBUTE prose in a branch",
    file: "settings/connectionRefusalCopy.ts",
    source: [
      "export function capabilityWordOf(capability) {",
      '  if (capability === "send_email") return "email"',
      '  if (capability === "create_ticket") return "ticket"',
      '  if (capability === "post_message") return "message"',
      '  return "connection"',
      "}",
    ].join("\n"),
  },
  {
    why: "`CONNECTION_CAPABILITY_WORDS` — the three per-row nouns the picker's absence sentence reads",
    file: "workflows/ConnectionPicker.ts",
    source: [
      "export const CONNECTION_CAPABILITY_WORDS = {",
      '  send_email: "email",',
      '  create_ticket: "ticket",',
      '  post_message: "message",',
      "}",
    ].join("\n"),
  },
  {
    why: "`EXTERNAL_CAPABILITY_SENTENCES` — node-face vocabulary, a reading of a step",
    file: "workflows/phaseVocabulary.ts",
    source: [
      "export const EXTERNAL_CAPABILITY_SENTENCES = {",
      '  send_email: "Sends an email",',
      '  create_ticket: "Creates a ticket",',
      '  post_message: "Posts a message",',
      "}",
    ].join("\n"),
  },
  {
    why: "the shipped state filter chips — a REAL selectable set, correctly silent",
    carriesWord: false,
    file: "settings/connectionsCopy.ts",
    source: [
      "export const CONNECTIONS_FILTER_CHIPS = [",
      '  { state: null, label: "All" },',
      '  { state: "ready", label: "Connected" },',
      '  { state: "not_connected", label: "Not connected" },',
      "]",
    ].join("\n"),
  },
  {
    why: "a live region that happens to name a consequence — not a selectable position",
    file: "settings/ConnectionsTab.tsx",
    source: '<p role="status">No email will leave while this is off.</p>',
  },
]

describe("211-05 · the verb fence is FALSIFIED before it is trusted (T-211-24)", () => {
  it.each(MUST_FIRE.map((c) => [c.why, c] as const))(
    "MUST FIRE — %s",
    (_why, control) => {
      const offenders = categoryOffenders(control.file, control.source)
      expect(offenders.length).toBeGreaterThan(0)
      // …and it reports a WORK ITEM, not a boolean: `file:line` plus the offending text.
      expect(offenders[0].where).toMatch(/^synthetic\/[a-z]+\.tsx?:\d+$/)
      expect(offenders[0].text.length).toBeGreaterThan(0)
    },
  )

  it.each(MUST_NOT_FIRE.map((c) => [c.why, c] as const))(
    "MUST NOT FIRE — %s",
    (_why, control) => {
      expect(categoryOffenders(control.file, control.source)).toEqual([])
    },
  )

  it("⚠ the MUST-NOT-FIRE set is not passing by matching NOTHING — the words really are there", () => {
    // Without this, a matcher that had silently stopped working would make every case above
    // green forever. Each control must actually CONTAIN a category word.
    for (const control of MUST_NOT_FIRE) {
      if (control.carriesWord === false) continue
      expect(CATEGORY_WORD.test(control.source), control.why).toBe(true)
    }
    // …and the ONE exception is exactly one, so the escape hatch cannot quietly widen.
    expect(MUST_NOT_FIRE.filter((c) => c.carriesWord === false)).toHaveLength(1)
    for (const control of MUST_FIRE) {
      expect(CATEGORY_WORD.test(control.source), control.why).toBe(true)
    }
  })

  it("the two set-detectors are independently falsifiable", () => {
    // Leg A: name alone, with ONE labelled entry (structural cannot fire).
    expect(selectableDeclarations("x.ts", 'const A_OPTIONS = [{ label: "One" }]')).toEqual([
      "A_OPTIONS",
    ])
    // Leg A2: two labelled entries, name says nothing.
    expect(
      selectableDeclarations("x.ts", 'const ladder = [{ label: "One" }, { label: "Two" }]'),
    ).toEqual(["ladder"])
    // Neither: a lone constant is not a set.
    expect(selectableDeclarations("x.ts", 'const HEADING = "One"')).toEqual([])
    // ⚠ A NESTED declaration is never reported AS ITSELF — the anchor is column 0 — but its
    // CONTENT is still read, attributed to its top-level enclosure. That is the property that
    // matters: a chooser hidden inside a component function is still swept.
    expect(
      selectableDeclarations(
        "x.ts",
        'function Panel() {\n  const B_OPTIONS = [{ label: "One" }, { label: "Two" }]\n}',
      ),
    ).toEqual(["Panel"])
  })

  it("the exemption list is CLOSED and each entry is spelled, never a pattern over labels", () => {
    // A blanket "ignore anything containing SMTP" would be a hole. There is exactly one
    // exemption, it names one declaration in one file, and §2 proves it is load-bearing.
    expect(EXEMPT_DECLARATIONS).toHaveLength(1)
    // ⚠ IT MOVED, IT DID NOT MULTIPLY. Phase 212 derived `SERVICE_SUGGESTIONS` from the
    // catalog, taking the one offending literal with it — so the exemption names the catalog's
    // `POPULAR_SERVICES` now and the list is still exactly one row wide.
    expect(EXEMPT_DECLARATIONS[0].declaration).toBe("POPULAR_SERVICES")
    expect(EXEMPT_DECLARATIONS[0].file.test("/src/components/settings/servicesCatalog.ts")).toBe(
      true,
    )
    // …and it is not a blanket over the file: a sibling declaration in the same file is NOT
    // exempt, which is what stops "one row wide" from quietly becoming "one file wide".
    expect(EXEMPT_DECLARATIONS[0].declaration).not.toBe("CATALOG_SERVICES")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · THE WALK. Both trees, non-test source only.
// ═══════════════════════════════════════════════════════════════════════════════════════

const settingsSources = import.meta.glob("/src/components/settings/**/*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const workflowsSources = import.meta.glob("/src/components/workflows/**/*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** The surface tree, minus its own tests. A test file is not a surface, and sweeping one
 *  would make this fence count the synthetic controls in §1. */
const SURFACE: Record<string, string> = Object.fromEntries(
  Object.entries({ ...settingsSources, ...workflowsSources }).filter(
    ([path]) => !path.includes("/__tests__/") && !path.includes(".test."),
  ),
)

/** The four files SC#3 is really about — every one of them must have been READ. */
const MUST_HAVE_VISITED = [
  "/src/components/settings/ConnectionFormPanel.tsx",
  "/src/components/settings/connectionFormCopy.ts",
  "/src/components/settings/connectionsCopy.ts",
  "/src/components/workflows/ConnectionPicker.tsx",
  "/src/components/workflows/ExternalActionSection.tsx",
  "/src/components/workflows/McpToolPicker.tsx",
] as const

describe("211-05 · the walk is NON-VACUOUS on two independent floors", () => {
  it("floor 1 — a minimum file count across BOTH trees", () => {
    // Measured at this plan's base: 117 non-test source files. Pinned well below, because a
    // FLOOR is the property (an empty glob makes every absence in §3 free), not a census.
    expect(Object.keys(SURFACE).length).toBeGreaterThan(90)
    // …and both trees really are in it, which one combined count cannot show.
    const settings = Object.keys(SURFACE).filter((p) => p.includes("/settings/"))
    const workflows = Object.keys(SURFACE).filter((p) => p.includes("/workflows/"))
    expect(settings.length).toBeGreaterThan(8)
    expect(workflows.length).toBeGreaterThan(60)
  })

  it("floor 2 — the named files SC#3 is about were each READ, with real content", () => {
    for (const path of MUST_HAVE_VISITED) {
      expect(typeof SURFACE[path], path).toBe("string")
      expect(SURFACE[path].length, path).toBeGreaterThan(500)
    }
  })

  it("floor 3 — the matcher really REACHED selectable sets, including the settings filter rail", () => {
    const inspected = Object.entries(SURFACE).flatMap(([path, source]) =>
      selectableDeclarations(path, source).map((name) => `${path} · ${name}`),
    )
    // An absence proved over ZERO selectable sets is an absence proved over nothing.
    expect(inspected.length).toBeGreaterThan(8)
    // ⭐ SC#3 names FILTERING explicitly, and this is the Settings → Connections chip rail.
    expect(inspected).toContain(
      "/src/components/settings/connectionsCopy.ts · CONNECTIONS_FILTER_CHIPS",
    )
  })

  it("⚠ the exemptions are LOAD-BEARING — the catalog entry really would fire without them", () => {
    // An exemption whose target no longer fires is a hole with a comment over it. Re-derive
    // it here rather than trusting the comment: strip the exemption and the offender appears.
    //
    // ⚠ THIS CONTROL IS THE ONLY THING THAT CAUGHT THE 2026-08-27 COVERAGE LOSS. Phase 212
    // moved the exempted label from `connectionFormCopy.ts` into `servicesCatalog.ts`, and §3's
    // absence assertion went on passing over a file the matcher could no longer reach. A fence
    // that cannot fail is not a fence — which is precisely what this case is for.
    const path = "/src/components/settings/servicesCatalog.ts"
    const source = SURFACE[path]
    expect(typeof source).toBe("string")
    // Same file, a name the exemption does not match → the exemption cannot apply.
    const unexempt = categoryOffenders("not-the-exempt-file.ts", source)
    const texts = unexempt.map((o) => o.text)
    expect(texts).toContain('POPULAR_SERVICES · name: "Email (SMTP)"')
    // ⚠ AND THE SMTP ROW IS THE ONLY OFFENDER IN THE CATALOG. If a future catalog row adds a
    // second, this number moves and the addition is READ rather than absorbed: that is the
    // difference between an exemption and a blanket.
    expect(unexempt).toHaveLength(1)
  })

  it("⚠ and with the exemptions APPLIED the catalog contributes nothing — the exemption is a row, not a blanket", () => {
    // The other half of the pair. Without this, an exemption that swallowed the whole file
    // would satisfy the case above just as well as one that swallows a single row.
    const path = "/src/components/settings/servicesCatalog.ts"
    expect(categoryOffenders(path, SURFACE[path])).toHaveLength(0)
    // ⭐ And the catalog really WAS reached — the declarations resolve as selectable sets, which
    // is the property that silently stopped holding when the label moved here.
    expect(selectableDeclarations("not-the-exempt-file.ts", SURFACE[path])).toContain(
      "CATALOG_SERVICES",
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ SC#3 — THE ABSENCE ITSELF, over both trees at once.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("211-05 · SC#3 — no verb CATEGORY is offered anywhere (CONN-04 / CONN-05 / SEED-207)", () => {
  it("⭐ neither Message nor Ticket nor Email appears as an option, chip, tab or filter label", () => {
    const offenders = Object.entries(SURFACE).flatMap(([path, source]) =>
      categoryOffenders(path, source),
    )
    // Reported as work items — `file:line`, the leg that fired, and the text — because a
    // RED here names something a person has to go and change.
    expect(
      offenders.map((o) => `${o.where} [${o.via}] ${o.text}`),
      "a verb CATEGORY is being offered on a browse / filter / pick surface (SC#3)",
    ).toEqual([])
  })

  it("no element on either surface carries a selectable ARIA role at all — the radiogroups are GONE", () => {
    // Stronger than SC#3 needs, and measured rather than assumed: after 211-03 and 211-04
    // there is no `role="radio" | "tab" | "option"` anywhere in either non-test tree. Stated
    // as its own case so that a NEW radiogroup shows up here as a decision to review, rather
    // than passing silently the moment its labels avoid three words.
    const carriers = Object.entries(SURFACE).filter(([, source]) =>
      /\brole=["'](?:radio|tab|option)["']/.test(source),
    )
    expect(carriers.map(([path]) => path)).toEqual([])
    // POSITIVE CONTROL — the pattern really matches.
    expect(/\brole=["'](?:radio|tab|option)["']/.test('<div role="radio">x</div>')).toBe(true)
  })
})
