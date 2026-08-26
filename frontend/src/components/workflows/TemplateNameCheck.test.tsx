/**
 * Phase 193.1-09 Task 2 (AUTH-03 / SC#3 — D-10 / D-11 / D-12 / D-14 / D-20) —
 * TemplateNameCheck: three buckets that never claim coverage.
 *
 * ORDER IS NOT OPTIONAL, and it is the 192.1 E-2 lesson restated one surface later:
 * **non-vacuity first** (the `?raw` sources really loaded and the detectors really fire),
 * **then the positive controls**, **then** the negatives that are the actual fences. A fence
 * asserted before it is shown capable of firing is a fence nobody knows is connected.
 *
 * THE HEADLINE CASE IS THE DEGENERATE ONE — all eight fields `nowhere` — because that is the
 * measured COMMON case (0 slug/placeholder overlap across all 74 template-binding rows, and
 * an empty run-input list on 6 of 6 post-fix generations). A suite whose first case is the
 * pretty three-bucket split would be measuring the rare shape.
 */
import { describe, it, expect } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

// The SOURCES via Vite's `?raw` loader — two independent source fences live below.
import nameCheckSource from "./TemplateNameCheck?raw"
import bucketsSource from "./templateNameBuckets?raw"
// 199-08: the api client's own SOURCE. The sheet's §6 needs a name-availability answer, and
// the strongest form of "we cannot express that" is that there is nothing anywhere to ask.
import { API_SOURCE as apiClientSource199 } from "@/lib/apiSource.testutil"

import { TemplateNameCheck, NAME_CHECK_CAP } from "./TemplateNameCheck"
import { classifyTemplateNames } from "./templateNameBuckets"
import {
  BUCKET_NAMED_NOWHERE,
  BUCKET_PRODUCED,
  BUCKET_RUN_INPUT,
  NAME_CHECK_DISCLAIM,
  NAME_CHECK_HEADING,
  nameCheckRunInputNote,
  showAllLabel,
} from "./templateFirstVocabulary"

// ══════════════════════════════════════════════════════════════════════════════════════
// Fixtures — the eight names sketch 167 PARSED out of a real .docx, and a REAL definition
// ══════════════════════════════════════════════════════════════════════════════════════

const EIGHT_REAL_PLACEHOLDERS = [
  "accomplishments",
  "milestones",
  "overall_rag_status",
  "planned_next",
  "project_name",
  "reporting_period",
  "risks_blockers",
  "summary",
] as const

/** ← live row `compliance-gap-report-dt5p8p`, trimmed. Verb slugs, real phase types, a null
 *  input list — the shape 220 of the 223 live rows carry. */
const REAL_DEGENERATE_DEFINITION = {
  inputs: null,
  phases: [
    { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit", emitter: "render_template" } },
  ],
}

const DEGENERATE = classifyTemplateNames(EIGHT_REAL_PLACEHOLDERS, REAL_DEGENERATE_DEFINITION)

/** The rare-but-real three-bucket split, so the false-alarm guard is exercised with data. */
const THREE_BUCKET = classifyTemplateNames(
  ["retrieve", "emit", "topic", "kickoff_prompt", "summary", "project_name"],
  REAL_DEGENERATE_DEFINITION,
)

/** ⚠ ONE SHARED EXPECTED VALUE FOR EVERY EMPTY ARM (D-20, and 193's D-15 one surface later).
 *  An empty *produced* bucket and an empty *run-input* bucket must be indistinguishable BY
 *  CONSTRUCTION, so neither can quietly become a claim — an empty produced bucket must never
 *  read as "no step produces anything". Both are compared against THIS value, never against
 *  two separately-written ones that could drift apart into two different silences. */
const SILENT = { present: false, text: "", rows: [] as string[] }

/** Read one bucket's whole rendered contribution, in the shape `SILENT` describes. */
function readBucket(bucket: "produced" | "run-input" | "nowhere") {
  const node = screen.queryByTestId(`name-check-bucket-${bucket}`)
  if (node === null) return SILENT
  return {
    present: true,
    text: node.textContent ?? "",
    rows: within(node)
      .queryAllByTestId(`name-check-row-${bucket}`)
      .map((li) => li.textContent ?? ""),
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 1 — THE DEGENERATE RENDER: the realistic FIRST render
// ══════════════════════════════════════════════════════════════════════════════════════

describe("TemplateNameCheck — the degenerate render is the common one (D-20)", () => {
  it("renders the heading, the one non-empty bucket and the disclaimer", () => {
    render(<TemplateNameCheck classification={DEGENERATE} />)
    expect(screen.getByTestId("name-check-heading")).toHaveTextContent(NAME_CHECK_HEADING)
    expect(screen.getByTestId("name-check-disclaim")).toHaveTextContent(NAME_CHECK_DISCLAIM)
    expect(screen.getByTestId("name-check-bucket-nowhere")).toHaveTextContent(BUCKET_NAMED_NOWHERE)
  })

  it("⚠ NO ALARM WORD APPEARS ANYWHERE IN THE DEGENERATE RENDER", () => {
    // The measured author experience is "8 named nowhere" on essentially every real template.
    // D-10 calls being told twice that a correct workflow is broken a red line; this is eight
    // times out of eight, so not one word on the surface may read as an alarm.
    const { container } = render(<TemplateNameCheck classification={DEGENERATE} />)
    expect(container.textContent ?? "").not.toMatch(/gap|missing|uncovered|incomplete|broken|error|problem/i)
  })

  it("…and the sweep is not vacuous — the same matcher catches a planted alarm word", () => {
    expect("nothing is missing here").toMatch(/gap|missing|uncovered|incomplete|broken|error|problem/i)
    expect(DEGENERATE.nowhere).toHaveLength(8)
  })

  it("BOTH empty arms render NOTHING, against ONE SHARED expected value", () => {
    render(<TemplateNameCheck classification={DEGENERATE} />)
    // An empty produced bucket and an empty run-input bucket produce the SAME absence. If a
    // future edit gave either one a "0" or a sentence, exactly one of these two would move —
    // which is the whole point of comparing them to one value.
    expect(readBucket("produced")).toEqual(SILENT)
    expect(readBucket("run-input")).toEqual(SILENT)
  })

  it("…and the shared value is not vacuous — a NON-empty bucket does not equal it", () => {
    render(<TemplateNameCheck classification={DEGENERATE} />)
    expect(readBucket("nowhere")).not.toEqual(SILENT)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 2 — THREE BUCKETS, NEVER TWO (D-10's red line)
// ══════════════════════════════════════════════════════════════════════════════════════

describe("TemplateNameCheck — three buckets, and the false-alarm guard", () => {
  it("each non-empty bucket renders with its own label and its own names", () => {
    render(<TemplateNameCheck classification={THREE_BUCKET} />)
    expect(screen.getByTestId("name-check-bucket-produced")).toHaveTextContent(BUCKET_PRODUCED)
    expect(screen.getByTestId("name-check-bucket-run-input")).toHaveTextContent(BUCKET_RUN_INPUT)
    expect(screen.getByTestId("name-check-bucket-nowhere")).toHaveTextContent(BUCKET_NAMED_NOWHERE)
    expect(readBucket("produced").rows).toEqual(["retrieve", "emit"])
    expect(readBucket("run-input").rows).toEqual(["topic", "kickoff_prompt"])
    expect(readBucket("nowhere").rows).toEqual(["summary", "project_name"])
  })

  it("THE FALSE-ALARM GUARD — the run-input note renders beside a non-empty run-input bucket", () => {
    render(<TemplateNameCheck classification={THREE_BUCKET} />)
    expect(screen.getByTestId("name-check-run-input-note")).toHaveTextContent(
      nameCheckRunInputNote(THREE_BUCKET.runInput.length),
    )
  })

  it("…and it is ABSENT when the run-input bucket is empty — a note about nothing is a claim", () => {
    render(<TemplateNameCheck classification={DEGENERATE} />)
    expect(screen.queryByTestId("name-check-run-input-note")).toBeNull()
  })

  it("the disclaimer renders on EVERY non-empty check, without exception", () => {
    for (const classification of [DEGENERATE, THREE_BUCKET]) {
      const { unmount } = render(<TemplateNameCheck classification={classification} />)
      expect(screen.getByTestId("name-check-disclaim")).toHaveTextContent(NAME_CHECK_DISCLAIM)
      unmount()
    }
  })

  it("an ENTIRELY empty classification renders nothing at all", () => {
    const { container } = render(
      <TemplateNameCheck classification={{ produced: [], runInput: [], nowhere: [] }} />,
    )
    expect(container.textContent).toBe("")
    expect(screen.queryByTestId("name-check")).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 3 — D-11: CAPPED, AND EXPANDING IN PLACE
// ══════════════════════════════════════════════════════════════════════════════════════

describe("TemplateNameCheck — D-11: one home for one list", () => {
  it("the cap is a real number and the degenerate case exceeds it", () => {
    // Recorded rather than implied: D-20 measured this cap will fire on essentially every
    // real template, so it is a primary path, not an edge.
    expect(NAME_CHECK_CAP).toBe(3)
    expect(DEGENERATE.nowhere.length).toBeGreaterThan(NAME_CHECK_CAP)
  })

  it("a bucket over the cap renders the cap plus a `show all` control naming the FULL count", () => {
    render(<TemplateNameCheck classification={DEGENERATE} />)
    expect(readBucket("nowhere").rows).toEqual(EIGHT_REAL_PLACEHOLDERS.slice(0, NAME_CHECK_CAP))
    expect(screen.getByTestId("name-check-show-all-nowhere")).toHaveTextContent(showAllLabel(8))
  })

  it("activating it expands IN PLACE — same node, no dialog, no navigation", () => {
    render(<TemplateNameCheck classification={DEGENERATE} />)
    const bucketBefore = screen.getByTestId("name-check-bucket-nowhere")
    fireEvent.click(screen.getByTestId("name-check-show-all-nowhere"))
    const bucketAfter = screen.getByTestId("name-check-bucket-nowhere")
    // THE SAME DOM NODE, not a re-mounted one somewhere else — this is what "in place" means
    // mechanically, and it is the two-homes-drift argument that decided sketch 165.
    expect(bucketAfter).toBe(bucketBefore)
    expect(readBucket("nowhere").rows).toEqual([...EIGHT_REAL_PLACEHOLDERS])
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByTestId("name-check-show-all-nowhere")).toBeNull()
  })

  it("a bucket AT OR UNDER the cap renders no control at all", () => {
    render(<TemplateNameCheck classification={THREE_BUCKET} />)
    for (const bucket of ["produced", "run-input", "nowhere"] as const) {
      expect(screen.queryByTestId(`name-check-show-all-${bucket}`)).toBeNull()
    }
  })

  it("each bucket expands INDEPENDENTLY — one control does not open the others", () => {
    const many = classifyTemplateNames(
      ["retrieve", "emit", "a", "b", "c", "d", "e"],
      { phases: [{ slug: "retrieve" }, { slug: "emit" }] },
    )
    render(<TemplateNameCheck classification={many} />)
    expect(readBucket("nowhere").rows).toHaveLength(NAME_CHECK_CAP)
    fireEvent.click(screen.getByTestId("name-check-show-all-nowhere"))
    expect(readBucket("nowhere").rows).toHaveLength(5)
    expect(readBucket("produced").rows).toEqual(["retrieve", "emit"])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 4 — T-193.1-09-02: a name is TEXT, never markup
// ══════════════════════════════════════════════════════════════════════════════════════

describe("TemplateNameCheck — a placeholder name parsed from an uploaded document is TEXT", () => {
  it("HTML in a field name renders as visible text and creates no element", () => {
    const payload = '<img src=x onerror="alert(1)">'
    const { container } = render(
      <TemplateNameCheck classification={{ produced: [], runInput: [], nowhere: [payload] }} />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByTestId("name-check-bucket-nowhere")).toHaveTextContent(payload)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 5 — D-12: THE CHECK STRUCTURALLY CANNOT WRITE
// ══════════════════════════════════════════════════════════════════════════════════════

// A reconcile that wrote the definition JSONB would be a SECOND WRITER, racing the `If-Match`
// token Phase 186's save loop exists to protect. The guarantee is by CONSTRUCTION — the props
// declare no mutating callback — and this sweep is what keeps it true under a later edit.
const WRITE_CALLBACKS = ["onChange", "onPersist", "onAttached", "saveNow", "setTemplateAsset", "patchConfig"]

describe("TemplateNameCheck — D-12: no write callback exists to be called", () => {
  it("NON-VACUITY — the ?raw source really loaded and is the module it claims to be", () => {
    expect(nameCheckSource.length).toBeGreaterThan(1000)
    expect(nameCheckSource).toMatch(/export function TemplateNameCheck\(/)
    expect(nameCheckSource).toMatch(/export const NAME_CHECK_CAP/)
  })

  it("POSITIVE CONTROL — the sweep catches each callback name in a synthetic source", () => {
    for (const name of WRITE_CALLBACKS) {
      expect(`  ${name}?: () => void`).toContain(name)
    }
    expect("  classification: TemplateNameClassification").not.toContain("onChange")
  })

  it("THE REAL SOURCE names none of them", () => {
    const hits = WRITE_CALLBACKS.filter((name) => nameCheckSource.includes(name))
    expect(hits).toEqual([])
  })

  it("…and it reaches no network client and no store", () => {
    expect(nameCheckSource).not.toMatch(/from\s+["'][^"']*@\/lib\/api["']/)
    expect(nameCheckSource).not.toMatch(/useStore|BuilderStore|fetch\(/)
  })

  it("T-193.1-09-02 — `dangerouslySetInnerHTML` occurs zero times", () => {
    expect(nameCheckSource).not.toContain("dangerouslySetInnerHTML")
  })

  it("D-22 — it imports NO panel symbol, in either direction", () => {
    expect(nameCheckSource).not.toContain(["Phase", "FormPanel"].join(""))
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 6 — D-14: THE FENCE-SCOPE GUARD (plan-checker warning 1)
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ WHY THIS EXISTS, AND WHY IT IS A GUARD RATHER THAN A SENTENCE.
 *
 * `TemplateNameCheck.tsx` and `templateNameBuckets.ts` are deliberately NOT in the D-24(a)
 * copy fence's swept-source list (which stands at six). They live on the STEP-RAIL surface,
 * not on the describe-door CTA surface that fence targets, and they consume none of the
 * governed door strings.
 *
 * But WR-01's whole lesson is that **a fence which cannot see a consumer is a fence that
 * cannot fire**: that list held two entries while a third file had quietly become a consumer,
 * and the phase's own headline defect could have recurred with every gate green. So the
 * exclusion may not rest on a claim in a docblock. It rests on this: both modules are read
 * back and asserted to name no `doorVocabulary` specifier, in the bare, `.ts`-suffixed and
 * dynamic `import()` spellings — the same three shapes the shipped ESM-cycle fence has to
 * handle, because `allowImportingTsExtensions` makes the suffixed form legal and a dynamic
 * import has no `from` at all.
 *
 * ⚠ IF THIS GUARD EVER GOES RED WITH A REAL CONSUMER PRESENT, THE ANSWER IS TO ADD THE MODULE
 * TO `SWEPT_SOURCES` — never to delete this guard or to relax its regexes.
 *
 * The subject name is ASSEMBLED FROM PARTS, this project's shipped idiom for a guard that must
 * not satisfy itself: a fence file spelling the module name whole would make a subtree-wide
 * grep read a hit that is the GUARD rather than a violation.
 */
const VOCAB_MODULE = ["door", "Vocabulary"].join("")
const IMPORT_FROM_VOCAB = new RegExp(`from\\s+["'][^"']*${VOCAB_MODULE}(\\.[jt]sx?)?["']`)
const DYNAMIC_IMPORT_VOCAB = new RegExp(`import\\s*\\(\\s*["'][^"']*${VOCAB_MODULE}(\\.[jt]sx?)?["']\\s*\\)`)

const FENCE_SCOPE_SUBJECTS: Array<[string, string]> = [
  ["./TemplateNameCheck.tsx", nameCheckSource],
  ["./templateNameBuckets.ts", bucketsSource],
]

describe("D-14 fence scope — the two excluded modules really are non-consumers", () => {
  it("NON-VACUITY — both ?raw sources really loaded", () => {
    // FIRST, BEFORE ANY NEGATIVE. A `?raw` import of a moved or renamed module yields the
    // EMPTY STRING in some resolvers rather than throwing, and every negative below would
    // then pass while defending nothing — the exact defect `/gsd:secure-phase 192.1` found.
    expect(FENCE_SCOPE_SUBJECTS).toHaveLength(2)
    for (const [path, source] of FENCE_SCOPE_SUBJECTS) {
      expect(source.length, `${path} did not load`).toBeGreaterThan(1000)
    }
  })

  it("POSITIVE CONTROLS — every forbidden import form IS caught, in BOTH suffix spellings", () => {
    // bare · type-only · re-export · dynamic, then each again with the extension.
    expect(`import { X } from "./${VOCAB_MODULE}"`).toMatch(IMPORT_FROM_VOCAB)
    expect(`import type { X } from "@/components/workflows/${VOCAB_MODULE}"`).toMatch(IMPORT_FROM_VOCAB)
    expect(`export { X } from "./${VOCAB_MODULE}"`).toMatch(IMPORT_FROM_VOCAB)
    expect(`const m = await import("./${VOCAB_MODULE}")`).toMatch(DYNAMIC_IMPORT_VOCAB)
    expect(`import { X } from "./${VOCAB_MODULE}.ts"`).toMatch(IMPORT_FROM_VOCAB)
    expect(`import type { X } from "./${VOCAB_MODULE}.ts"`).toMatch(IMPORT_FROM_VOCAB)
    expect(`export { X } from "./${VOCAB_MODULE}.ts"`).toMatch(IMPORT_FROM_VOCAB)
    expect(`const m = await import("./${VOCAB_MODULE}.ts")`).toMatch(DYNAMIC_IMPORT_VOCAB)
  })

  it("NEGATIVE CONTROLS — the matchers are not simply always-true", () => {
    // A `?raw` read is how a SUITE legitimately reads that module's source, so it must not be
    // caught; this also proves the optional suffix group does not swallow the query string.
    expect(`import src from "./${VOCAB_MODULE}?raw"`).not.toMatch(IMPORT_FROM_VOCAB)
    expect(`import src from "./${VOCAB_MODULE}.ts?raw"`).not.toMatch(IMPORT_FROM_VOCAB)
    expect('import { useState } from "react"').not.toMatch(IMPORT_FROM_VOCAB)
    expect('import { useState } from "react"').not.toMatch(DYNAMIC_IMPORT_VOCAB)
  })

  it.each(FENCE_SCOPE_SUBJECTS)("%s names no governed-copy specifier in ANY import form", (_path, source) => {
    expect(source).not.toMatch(IMPORT_FROM_VOCAB)
    expect(source).not.toMatch(DYNAMIC_IMPORT_VOCAB)
  })

  it.each(FENCE_SCOPE_SUBJECTS)("%s does not name that module AT ALL — the crudest check", (_path, source) => {
    // STRONGER than the regexes above and cheap: this is the property a plain `grep` would
    // report, so the exclusion stays checkable by the bluntest available tool.
    expect(source).not.toContain(VOCAB_MODULE)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-08 Task 3 (DES-01 · sheet `c9-doors-describe` §6) — THE NAME CHECK.
//
// APPENDED, never interleaved. Not one assertion above this line moves, and NO byte of
// `TemplateNameCheck.tsx` is modified by this plan.
//
// ⚠ **THE PLAN'S OWN CLAIM ABOUT THIS FILE IS MEASURED FALSE, AND THAT IS THE FINDING.**
// `199-08-PLAN.md` says: *"`TemplateNameCheck.tsx` already ships all three states; verify
// rather than rebuild."* Verified — and it is false of the tree. The plan matched on the
// component's NAME. The sheet's §6 and this file are two different checks that share a word:
//
//   | | sheet c9 §6 | `TemplateNameCheck.tsx` |
//   |---|---|---|
//   | subject | the WORKFLOW's own name / slug | the TEMPLATE DOCUMENT's field names |
//   | states | available · already taken · still checking | produced · run-input · named nowhere |
//   | nature | a UNIQUENESS VERDICT from the server | a local HEURISTIC over names |
//   | control | an editable text input | no input at all — it is read-only output |
//
// ⚠ **CANNOT-EXPRESS, in three parts:**
//   • **What the sheet asks for.** A name field that says, live, whether the name is free,
//     already taken, or still being checked.
//   • **What the component can do.** Nothing adjacent to it. And the shortfall is not this
//     component's: NO name-availability check exists anywhere in the client — no api symbol,
//     no route, no caller — which is asserted below rather than asserted in prose.
//   • **The gap.** Closing it needs a server endpoint that answers "is this name taken?",
//     which is a BACKEND CAPABILITY and outside a presentation-only phase's fence. The
//     honest third state ("still checking") is additionally unbuildable without it: a
//     spinner over a request nobody makes would be theatre.
//
// What IS pinned below is the property sheet c9 legitimately asks of any multi-state block,
// and which this component genuinely can satisfy: its three states are told apart by WORDS,
// not by colour.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("199-08 — sheet c9 §6: the THREE states are told apart WITHOUT colour", () => {
  it("each bucket is named in words, and the three names are mutually distinct", () => {
    render(<TemplateNameCheck classification={THREE_BUCKET} />)
    const labels = [BUCKET_PRODUCED, BUCKET_RUN_INPUT, BUCKET_NAMED_NOWHERE]
    // NON-VACUITY: all three buckets really rendered in this fixture, so the distinctness
    // claim below is about three surfaces rather than about one and two absences.
    for (const id of ["produced", "run-input", "nowhere"] as const) {
      expect(readBucket(id).present, `${id} did not render`).toBe(true)
    }
    for (const label of labels) expect(screen.getByText(label)).toBeInTheDocument()
    expect(new Set(labels).size).toBe(3)
  })

  it("⚠ NO STATE IS CARRIED BY COLOUR — strip every class and the three still read apart", () => {
    const { container } = render(<TemplateNameCheck classification={THREE_BUCKET} />)
    const texts = (["produced", "run-input", "nowhere"] as const).map((id) => {
      const node = screen.getByTestId(`name-check-bucket-${id}`)
      return (node.textContent ?? "").replace(/\s+/g, " ").trim()
    })
    for (const text of texts) expect(text.length).toBeGreaterThan(0)
    expect(new Set(texts).size).toBe(3)
    // …and no state word is spent on a colour utility anywhere in the rendered tree: the
    // classes present are layout and muted text, never a status tone. A `bg-warning`-style
    // silent no-op could not carry a meaning here even if someone added one.
    const classes = Array.from(container.querySelectorAll("*"))
      .flatMap((n) => (n.getAttribute("class") ?? "").split(" "))
      .filter(Boolean)
    expect(classes.length).toBeGreaterThan(0)
    expect(classes.filter((c) => /(destructive|success|warning|green|red|amber)/.test(c))).toEqual(
      [],
    )
  })

  it("⚠ THE PLAN'S CLAIM, REFUTED MECHANICALLY: these are BUCKETS, not availability verdicts", () => {
    render(<TemplateNameCheck classification={THREE_BUCKET} />)
    const rendered = (document.body.textContent ?? "").toLowerCase()
    // The sheet's three §6 verdicts appear NOWHERE on this surface, because this surface
    // makes no such judgement — it says where a name is mentioned, never whether it is free.
    for (const verdict of ["available", "already taken", "checking", "unavailable"]) {
      expect(rendered.includes(verdict), `this surface claims "${verdict}"`).toBe(false)
    }
    // POSITIVE CONTROL — the sweep really fires on the sheet's own captions.
    expect("State: Already taken".toLowerCase()).toContain("already taken")
  })

  it("⚠ NO NAME-AVAILABILITY SEAM EXISTS IN THE CLIENT AT ALL — the gap is a backend one", () => {
    // The strongest form of the CANNOT-EXPRESS above: this component is not merely missing
    // the states, there is nothing anywhere for it to ask. Swept over the api client itself.
    for (const needle of [
      "checkWorkflowName",
      "isNameAvailable",
      "nameAvailable",
      "checkSlugAvailable",
    ]) {
      expect(apiClientSource199.includes(needle), `${needle} exists after all`).toBe(false)
    }
    // NON-VACUITY: the api client really loaded, so the four negatives are not `"".includes`.
    expect(apiClientSource199.length).toBeGreaterThan(10000)
    expect(apiClientSource199).toContain("export async function")
  })

  it("199-08 modified NO byte of this component — the verdict is a report, not a rebuild", () => {
    expect(nameCheckSource).not.toContain("199-08")
    expect(nameCheckSource.length).toBeGreaterThan(1000)
    // …and it stays a leaf fed entirely from props: no api client, no fetch.
    expect(nameCheckSource).not.toContain("@/lib/api")
    expect(/\bfetch\s*\(/.test(nameCheckSource)).toBe(false)
  })
})
