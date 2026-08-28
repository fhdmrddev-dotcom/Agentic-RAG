/**
 * Phase 189-14 Task 1 — the external step section's proofs.
 *
 * A NET-NEW suite, mirroring `GovernanceSection.test.tsx`'s shape and for its stated
 * reason: the section is a LEAF with a flat, total prop contract, so driving it directly
 * means a red says which of the two surfaces moved. The panel's own obligation — that the
 * mount is gated on `phase_type` and reaches nothing else — is asserted in
 * `PhaseFormPanel.rails.test.tsx`, where the D-189-DEF-02 boundary guard already lives.
 *
 * ⚠ THE FILE IS REGISTERED WITH `scripts/vitest-count-gate.cjs` IN THE COMMIT THAT
 * CREATES IT. `src/components/workflows` is already a TARGETS directory entry, so this
 * suite RUNS the moment it exists; the `BASELINE` pin is what makes it GUARDED rather
 * than merely executed (188-12's correction of the "leave a growing file unpinned"
 * exemption — an unpinned file is not lightly guarded, it is unguarded).
 *
 * THREE THINGS THIS SUITE EXISTS TO CATCH, each a named threat:
 *  - T-189-11 the client mirror drifting from the backend `Literal` — the cross-language
 *    fence at the bottom, OBSERVED RED against a planted mismatch before it was trusted.
 *  - T-189-39 a fabricated reading for a capability the client does not know.
 *  - T-189-43 the component authoring a sentence, which makes drift untestable.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠ 211-04 (SC#3 / CONN-05) — WHAT THIS SUITE LOST, AND WHY IT IS *OBSOLETE BY DESIGN*.
 *
 * The section used to open with TWO radiogroups — a two-segment SHAPE control and three
 * capability rows. Both are deleted, so every case that DROVE them is asserting a control
 * that no longer exists. That includes the FIVE `=== 3` pins the shipped docblock singled
 * out (*"five shipped assertions pin the capability group's children at exactly three, and a
 * 'hide the capability rows' draft turns all five RED"*). Each of the five, and each deleted
 * behaviour case, is named INDIVIDUALLY in `211-04-SUMMARY.md` beside the assertion that
 * replaced it.
 *
 * ⚠ WHAT IS **KEPT**, AND WHY KEEPING IT IS THE POINT: the D-23 cross-language mirror fence
 * (§6) is UNTOUCHED, and the client mirror it fences is still declared in the component.
 * Retiring a guard while "demoting" the thing it guards is this phase's named anti-pattern —
 * *optional* and *closed* are independent properties, and this phase touches neither.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// ⚠ ADDED BY 211-04, AND THE BUDGET IS SPENT IN THE SAME COMMIT AS THE IMPORT THAT MAKES IT
// LIVE (196-08's lesson: an inert factory fails at MOUNT, loudly). The section now always
// mounts `ConnectionPicker`, which imports `@/lib/api`. Every case here renders the section
// STANDALONE — no store, no slug provider — so the picker takes its disconnected branch and
// OPENS NO REQUEST; the fake exists so an accidental one would be visible rather than real.
const { listMock } = vi.hoisted(() => ({ listMock: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/api", () => ({
  listConnectorConnections: listMock,
  discoverConnectorTools: vi.fn().mockResolvedValue([]),
  updateConnectorGrants: vi.fn().mockResolvedValue({}),
}))

import externalActionSectionSource from "./ExternalActionSection?raw"
// The CROSS-LANGUAGE half of D-23, read through the same `?raw` loader
// `definitionOps.test.ts:29` uses. ⚠ The obvious `node:fs` spelling is wrong here:
// `tsconfig.app.json` sets `types: ["vite/client"]` and nothing else, so a `node:*`
// import would add NEW errors to the tsc baseline every plan in this phase measures.
import harnessModelsSource from "../../../../backend/app/models/harness.py?raw"
import { ExternalActionSection, type ExternalActionSectionProps } from "./ExternalActionSection"
import {
  EXTERNAL_ACTION_HEADING,
  EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE,
} from "./definitionOps"
import { EXTERNAL_CAPABILITY_SENTENCES } from "./phaseVocabulary"

/**
 * The CLIENT MIRROR, read from its ONE home rather than from the component.
 *
 * ⚠ `ExternalActionSection.tsx` cannot EXPORT its derived tuple — a runtime export beside
 * a component is a `react-refresh/only-export-components` lint error (measured; the
 * analog `GovernanceSection.tsx` exports two components and two TYPES and no const). It
 * reads exactly this object, and the source fence below proves it: the mirror is
 * `Object.keys(EXTERNAL_CAPABILITY_SENTENCES)` in both places, so nothing is re-typed and
 * nothing here is a second copy.
 */
const EXTERNAL_ACTION_CAPABILITIES: readonly string[] = Object.keys(EXTERNAL_CAPABILITY_SENTENCES)

function renderSection(over: Partial<ExternalActionSectionProps> = {}) {
  const props: ExternalActionSectionProps = {
    capability: "",
    toolName: "",
    ...over,
  }
  return render(<ExternalActionSection {...props} />)
}

const shapeOf = () => screen.getByTestId("external-action-section").getAttribute("data-shape")

// ── 1. ⭐ NO VERB IS OFFERED AS A CATEGORY, ANYWHERE (SC#3 / CONN-05) ─────────────────

describe("ExternalActionSection — the browse axis is gone", () => {
  it("⭐ NO `role=radio` carries any of the three category sentences, in ANY state", () => {
    // ⚠ THIS IS SC#3's WORDING, DRIVEN. *"A user browsing or picking a connection is never
    // offered Message / Ticket / Email as a category."* It is asserted over the ACCESSIBLE
    // NAME rather than over a test id, because a future control could reintroduce the offer
    // under any id at all; what must not come back is the QUESTION.
    for (const props of [
      { capability: "" },
      { capability: "send_email" },
      { capability: "post_message" },
      { capability: "not_a_capability" },
      { toolName: "ask_question" },
    ]) {
      const { unmount } = renderSection(props)
      const radios = screen.queryAllByRole("radio")
      for (const sentence of Object.values(EXTERNAL_CAPABILITY_SENTENCES)) {
        expect(
          radios.some((r) => (r.textContent ?? "").includes(sentence)),
          `${sentence} is offered as a category`,
        ).toBe(false)
        // …and the sentence does not reach the DOM at all on this surface.
        expect(screen.queryByText(sentence)).toBeNull()
      }
      unmount()
    }
  })

  it("⭐ NEITHER deleted radiogroup exists — not the shape axis, not the capability rows", () => {
    renderSection({ capability: "send_email" })
    expect(screen.queryAllByTestId("external-action-option")).toHaveLength(0)
    expect(screen.queryByTestId("external-action-options")).toBeNull()
    expect(screen.queryAllByTestId("external-action-shape-option")).toHaveLength(0)
    expect(screen.queryByTestId("external-action-shape-group")).toBeNull()
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0)
    // NON-VACUITY — the section DID render, so the absences above are a scope decision
    // rather than an empty component.
    expect(screen.getByTestId("external-action-section")).toBeInTheDocument()
    expect(screen.getByText(EXTERNAL_ACTION_HEADING)).toBeInTheDocument()
  })

  it("⭐ ONE QUESTION, THEN ONE QUESTION — the picker is the section's only control", () => {
    // ⚠ Mounted in EVERY state, never gated on a verb having been chosen first. That gate is
    // what the shipped `shape === "capability" && selected !== null` expression was, and it
    // is why an author had to classify their own intent before seeing a single connection.
    for (const props of [{}, { capability: "send_email" }, { toolName: "ask_question" }]) {
      const { unmount } = renderSection(props)
      expect(screen.getByTestId("connection-picker")).toBeInTheDocument()
      unmount()
    }
  })

  it("the picker opens NO request from a standalone render — two shipped suites depend on it", () => {
    listMock.mockClear()
    renderSection()
    expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "disconnected")
    expect(listMock).not.toHaveBeenCalled()
  })
})

// ── 2. THE DERIVED READING (what replaces the five `=== 3` pins) ─────────────────────

describe("ExternalActionSection — the shape is a READING, never an answer", () => {
  it("⚠ UNSET derives nothing and says so — a default is not a way through a gate", () => {
    renderSection({ capability: "", toolName: "" })
    expect(shapeOf()).toBe("unset")
    expect(screen.getByText(EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE)).toBeInTheDocument()
  })

  it("a recognised stored capability derives the capability shape", () => {
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      const { unmount } = renderSection({ capability: name })
      expect(shapeOf()).toBe("capability")
      expect(screen.queryByTestId("external-action-nothing-chosen")).toBeNull()
      unmount()
    }
  })

  it("an UNRECOGNISED stored value derives NOTHING and fabricates nothing (T-189-39)", () => {
    // It must never guess. `send_carrier_pigeon` is not a fourth member and not a near miss.
    renderSection({ capability: "send_carrier_pigeon" })
    expect(shapeOf()).toBe("unset")
    expect(screen.queryByText(/pigeon/i)).toBeNull()
    expect(screen.getByText(EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE)).toBeInTheDocument()
  })

  it("an INHERITED key derives nothing either — `constructor` is not a capability", () => {
    // The membership test is `Array.prototype.includes`, never a bare object lookup, so an
    // inherited name can never resolve. A table MISS behaved correctly and always did; only
    // an inherited key distinguishes the guard from its absence.
    for (const inherited of ["constructor", "toString", "__proto__"]) {
      const { unmount } = renderSection({ capability: inherited })
      expect(shapeOf(), inherited).toBe("unset")
      unmount()
    }
  })

  it("a non-empty tool_name derives mcp and OUTRANKS a stored capability", () => {
    // The executor branches on `tool_name` first, so a step carrying both really runs as
    // MCP. The surface must say what the run will do, not what the config wishes.
    renderSection({ capability: "send_email", toolName: "ask_question" })
    expect(shapeOf()).toBe("mcp")
  })

  it("a WHITESPACE-ONLY tool_name is not an answer", () => {
    renderSection({ capability: "", toolName: "   " })
    expect(shapeOf()).toBe("unset")
  })

  it("the section RENDERS in every state it can reach — never an empty branch", () => {
    // A state that renders nothing reads as a build that forgot its control (the
    // D-185-16 rule, copied).
    for (const capability of ["", ...EXTERNAL_ACTION_CAPABILITIES, "not_a_capability"]) {
      const { unmount } = renderSection({ capability })
      expect(screen.getByTestId("external-action-section")).toBeInTheDocument()
      expect(screen.getByText(EXTERNAL_ACTION_HEADING)).toBeInTheDocument()
      expect(screen.getByTestId("connection-picker")).toBeInTheDocument()
      unmount()
    }
  })
})

// ── 3. THIS SECTION WRITES NOTHING (what replaces the write-seam cases) ──────────────

describe("ExternalActionSection — the write moved, and this leaf makes none", () => {
  it("⭐ NEITHER `capability` NOR `tool_name` is written by this component, in any state", () => {
    // ⚠ REPLACES the shipped `writes the capability NAME (never the sentence) and commits
    // it`, and its arrow-key siblings. The write did not disappear — it moved to
    // `ConnectionPicker`, the only child on this surface holding a store reference, where
    // it is asserted directly.
    //
    // ⚠ 214-07 — THE SPY HALF OF THIS CASE IS GONE BECAUSE THE PROPS ARE, and the assertion
    // it made is now stronger rather than weaker: the seams cannot be called because they no
    // longer exist. Rendering every state and finding no write is the residual obligation,
    // and it is what the states below still prove.
    for (const props of [
      { capability: "" },
      { capability: "send_email" },
      { toolName: "ask_question" },
    ]) {
      const { container, unmount } = renderSection(props)
      // NON-VACUITY: each state really rendered the section.
      expect(container.querySelector('[data-testid="external-action-section"]')).not.toBeNull()
      unmount()
    }
  })

  it("⭐ the three dead write props are GONE, on their OWN recorded re-open trigger", () => {
    // ⚠ THIS CASE IS THE INVERSE OF THE ONE IT REPLACES, WHICH READ *"the props are still
    // ACCEPTED — the panel's call site is untouched by this plan"*. 211-04 kept them and
    // wrote down the exact condition for removing them: *the first phase whose
    // `files_modified` names `PhaseFormPanel.tsx`*. 214-07 is that phase, so the debt is
    // paid rather than re-dated — and a removed assertion and a removed feature look
    // identical in a count, which is why this replaces it instead of deleting it.
    //
    // Needles assembled at runtime: this file's own prose names all three above, and a fence
    // that spells its needle counts itself (the 187-24 trap).
    for (const prop of ["on" + "Change?", "on" + "ChangeShape?", "on" + "Persist?"]) {
      expect(externalActionSectionSource, prop).not.toContain(prop)
    }
    // POSITIVE CONTROL — the matcher really matches an optional-prop declaration.
    expect("  onChange" + "?: (v: string) => void").toContain("on" + "Change?")
    // …and the source really is the section's, so the absence is not an empty read.
    expect(externalActionSectionSource).toContain("export function ExternalActionSection")
    // The prop contract that REMAINS is exactly the two facts the section renders from.
    expect(externalActionSectionSource).toContain("capability: string")
    expect(externalActionSectionSource).toContain("toolName: string")
  })
})

// ── 4. THE RAW ID NEVER REACHES THE DOM (the D-20 boundary, restated) ────────────────

describe("ExternalActionSection — the author reads sentences, never wire values", () => {
  it("no capability id appears in the rendered HTML, in ANY state", () => {
    for (const capability of ["", ...EXTERNAL_ACTION_CAPABILITIES, "nonsense"]) {
      const { container, unmount } = renderSection({ capability })
      for (const name of EXTERNAL_ACTION_CAPABILITIES) {
        expect(container.innerHTML, name).not.toContain(name)
      }
      // NON-VACUITY: the section DID render its heading, so the absence above is a scope
      // decision rather than an empty component.
      expect(container.innerHTML).toContain(EXTERNAL_ACTION_HEADING)
      unmount()
    }
  })

  it("nothing is struck through — a required value is not an author-fixable error", () => {
    // `ToolOptionSet` paints an unregistered name struck through and still pressable,
    // which is right for a tool the author chose by mistake and WRONG for a value the
    // author may not author at all. D-189-DEF-02 in one assertion.
    const { container } = renderSection({ capability: "send_email" })
    expect(container.innerHTML).not.toContain("line-through")
  })
})

// ── 5. THE COPY LOCK — it authors NO sentence (T-189-43) ─────────────────────────────

describe("ExternalActionSection — every sentence is an imported identifier", () => {
  it("names the imported identifiers in source and declares no sentence of its own", () => {
    expect(externalActionSectionSource).toMatch(/EXTERNAL_ACTION_HEADING/)
    expect(externalActionSectionSource).toMatch(/EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE/)
    expect(externalActionSectionSource).toMatch(/EXTERNAL_CAPABILITY_SENTENCES/)
    // The three sentences themselves are NOWHERE in this component's source — a copy is
    // exactly the drift the one-constant-read-twice rule exists to prevent.
    for (const sentence of Object.values(EXTERNAL_CAPABILITY_SENTENCES)) {
      expect(externalActionSectionSource).not.toContain(sentence)
    }
    expect(externalActionSectionSource).not.toContain(EXTERNAL_ACTION_HEADING)
    expect(externalActionSectionSource).not.toContain(EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE)
  })

  it("does not re-type the capability ids — the mirror is DERIVED from the one map", () => {
    // `Object.keys(EXTERNAL_CAPABILITY_SENTENCES)`, not a second tuple. A hand-typed
    // triple is a fourth-entry-on-one-side-only waiting to happen.
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      expect(externalActionSectionSource).not.toContain(`"${name}"`)
    }
    expect(externalActionSectionSource).toMatch(
      /Object\.keys\(\s*EXTERNAL_CAPABILITY_SENTENCES,?\s*\)/,
    )
  })

  it("the sentence map is declared in exactly ONE place outside tests", () => {
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>

    const declarations = Object.entries(modules)
      .filter(([path]) => !path.includes(".test."))
      .filter(([, source]) => /const\s+EXTERNAL_CAPABILITY_SENTENCES\s*[:=]/.test(source))
      .map(([path]) => path)

    expect(declarations).toEqual(["/src/components/workflows/phaseVocabulary.ts"])
    // POSITIVE CONTROL — the glob is not empty and the matcher really matches.
    expect(Object.keys(modules).length).toBeGreaterThan(50)
    expect(/const\s+EXTERNAL_CAPABILITY_SENTENCES\s*[:=]/.test(
      "export const EXTERNAL_CAPABILITY_SENTENCES: Record<string, string> = {",
    )).toBe(true)
  })

  it("⚠ THE AXIS VOCABULARY IS DELETED, AND ITS ABSENCE IS SWEPT ACROSS ALL OF `src`", () => {
    // ⚠ The deleted segment constant was the axis stated in words — *"One of these three
    // actions"* — and its two siblings named the question and the other segment. A grep in a
    // summary is a claim; this is the check. ⚠ THE THREE IDENTIFIERS ARE ASSEMBLED AT
    // RUNTIME below and are spelled nowhere in this file, because a `?raw`-swept tree makes
    // a docblock naming them count itself (the 187-24 trap, which fired here).
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>
    // NON-VACUITY FIRST — an empty glob makes every absence below free.
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    const needles = [
      "EXTERNAL_SHAPE_" + "CAPABILITY_LABEL",
      "EXTERNAL_SHAPE_" + "GROUP_LABEL",
      "EXTERNAL_SHAPE_" + "MCP_LABEL",
    ]
    for (const [path, source] of Object.entries(modules)) {
      // ⚠ THE VOCABULARY MODULE ITSELF IS EXEMPT — it QUOTES the three deleted names inside
      // a docblock on purpose, so a reader can see what the surface stopped asking. A fence
      // that swept it would forbid the record of its own change.
      if (path.endsWith("externalShapeVocabulary.ts")) continue
      if (path.endsWith("ExternalActionSection.test.tsx")) continue
      for (const needle of needles) expect(source, `${path} · ${needle}`).not.toContain(needle)
    }
    // POSITIVE CONTROL — the needles really can match.
    expect("export const " + needles[2] + " = 'x'").toContain(needles[2])
  })
})

// ── 6. THE SOURCE FENCE (the shipped `?raw` house idiom) ─────────────────────────────

describe("ExternalActionSection — source purity", () => {
  it("imports nothing from the API client and opens no request", () => {
    expect(externalActionSectionSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(externalActionSectionSource).not.toMatch(/fetch\(/)
    expect(externalActionSectionSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    // Nor any route string: the option set is a mirror, never a read.
    expect(externalActionSectionSource).not.toMatch(/["'`]\/(workflows|api)\//)
  })

  it("is a LEAF — no context, no store, no effect", () => {
    expect(externalActionSectionSource).not.toMatch(/useContext|useStore|useEffect|zustand/)
  })

  it("carries NO title attribute — guidance cannot regress into a tooltip", () => {
    expect(externalActionSectionSource).not.toMatch(/title=/)
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    expect('const r = get("/workflows/grounding-bundle")').toMatch(/["'`]\/(workflows|api)\//)
    expect("const s = useStore(store)").toMatch(/useContext|useStore|useEffect|zustand/)
    expect('<span title="why">x</span>').toMatch(/title=/)
    // …and the haystack really is this component's source.
    expect(externalActionSectionSource.length).toBeGreaterThan(1000)
    expect(externalActionSectionSource).toContain("export function ExternalActionSection")
  })

  it("no forbidden spacing value, weight or dead colour utility enters this file", () => {
    for (const needle of [
      "p-0.5",
      "gap-0.5",
      "py-2.5",
      "space-y-",
      "font-semibold",
      "font-bold",
      "text-panel-",
      "text-muted-foreground-dim",
    ]) {
      expect(externalActionSectionSource, needle).not.toContain(needle)
    }
    // POSITIVE CONTROL — a needle really can match.
    expect('class="p-0.5 font-semibold"').toContain("p-0.5")
  })

  it("the shape vocabulary is a TRUE LEAF and spells no capability id", () => {
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>
    const source = modules["/src/components/workflows/externalShapeVocabulary.ts"]
    expect(typeof source, "the glob really resolved this module").toBe("string")
    expect(source.length).toBeGreaterThan(500)
    expect(source).not.toMatch(/^import\s/m)
    for (const name of EXTERNAL_ACTION_CAPABILITIES) {
      expect(source, name).not.toContain(`"${name}"`)
    }
    // POSITIVE CONTROL — both patterns really match.
    expect('import { x } from "y"').toMatch(/^import\s/m)
    expect('const a = "send_email"').toContain('"send_email"')
  })
})

// ── 7. D-23 — THE CROSS-LANGUAGE MIRROR FENCE. ⚠ KEPT, NOT RETIRED ───────────────────
//
// The anti-drift guarantee must be MECHANICAL, NOT EDITORIAL. The block below reads the
// SERVER's own source and asserts the client mirror names the same three members, in the
// same order — so a capability renamed, reordered, added or dropped in `harness.py` is a
// RED TEST HERE rather than a 422 in the running app.
//
// ⚠ OBSERVED RED BEFORE IT WAS TRUSTED — a fourth member was planted into the client map
// and this block failed; the plant was removed and md5-verified. Recorded in
// `189-14-SUMMARY.md` with its output.
//
// ⚠ 211-04 — THIS BLOCK IS UNTOUCHED, AND THAT IS THE ASSERTION. The picker that consumed
// the mirror is deleted; the mirror and its fence are not. *Optional* and *closed* are
// independent properties, and retiring a guard while demoting the thing it guards is the
// anti-pattern this phase is named after.

describe("ExternalActionSection — the client mirror agrees with the backend Literal (D-23)", () => {
  /** The closed `capability` Literal `ExternalActionPhaseConfig` declares. */
  const backendCapabilities = (source: string): string[] => {
    const match = source.match(/^\s*capability:\s*Literal\[([^\]]*)\]/m)
    if (!match) return []
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  }

  it("reads the server source at all — the fence is not comparing two empty lists", () => {
    expect(typeof harnessModelsSource).toBe("string")
    expect(harnessModelsSource.length).toBeGreaterThan(1000)
    expect(harnessModelsSource).toContain("class ExternalActionPhaseConfig(_StrictBase):")
  })

  it("the reader is falsifiable — it returns nothing on a source without the Literal", () => {
    // Without this, a regex that stopped matching would make the case below green forever.
    expect(backendCapabilities("nothing to see here")).toEqual([])
    expect(backendCapabilities('    capability: Literal["a", "b"]')).toEqual(["a", "b"])
  })

  it("EXACTLY the same members, EXACTLY the same count, in the union's own order", () => {
    const backend = backendCapabilities(harnessModelsSource)

    expect(backend).toHaveLength(3) // D-15 — the set is exactly three
    expect([...EXTERNAL_ACTION_CAPABILITIES]).toEqual(backend)
    // Belt and braces on the two failure modes an `toEqual` on arrays already covers but
    // which a later refactor to a Set would silently drop: no extra, no missing.
    expect(EXTERNAL_ACTION_CAPABILITIES).toHaveLength(backend.length)
    for (const name of backend) expect(EXTERNAL_ACTION_CAPABILITIES).toContain(name)
    for (const name of EXTERNAL_ACTION_CAPABILITIES) expect(backend).toContain(name)
  })

  it("and every mirrored member has a sentence — the node face can label all of them", () => {
    for (const name of backendCapabilities(harnessModelsSource)) {
      expect(EXTERNAL_CAPABILITY_SENTENCES[name]).toBeTruthy()
    }
  })

  it("⚠ the mirror still has a LIVE consumer in the component — it is not a kept corpse", () => {
    // A fence over a constant nothing reads is a fence over nothing. `selected` is the
    // consumer: it is what makes an UNRECOGNISED stored capability derive nothing, which the
    // T-189-39 case above drives as behaviour.
    expect(externalActionSectionSource).toContain("EXTERNAL_ACTION_CAPABILITIES.includes(capability)")
  })
})

// ── 8. ⭐ 214-07 — THE SOURCE FENCES, EXTENDED TO THE TWO NEW COMPONENTS ─────────────
//
// ⚠ EXTENDED, NEVER RESTATED. This section's fences (§6) are the house rules for a LEAF on
// this surface, and `ArgumentEditor` / `ArgumentRow` are two more leaves under it. Writing
// them a second, private copy of the rules inside their own suite would create two homes for
// one property — which is the drift the one-constant-read-twice rule exists to prevent — so
// the rules are applied FROM HERE, over the same `?raw` loader, in one loop.

describe("214-07 · the argument leaves obey THIS section's fences", () => {
  const LEAVES = ["ArgumentEditor.tsx", "ArgumentRow.tsx", "argumentModel.ts"] as const

  const sourcesOf = (): Record<string, string> => {
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>
    // ⚠ NON-VACUITY FIRST — an empty glob makes every absence below FREE, and that failure is
    // invisible. Asserted before any claim rests on it.
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    const picked: Record<string, string> = {}
    for (const leaf of LEAVES) {
      const source = modules[`/src/components/workflows/${leaf}`]
      expect(typeof source, `${leaf} is not in the glob`).toBe("string")
      expect(source.length, leaf).toBeGreaterThan(1000)
      picked[leaf] = source
    }
    return picked
  }

  it("they import nothing from the API client and open no request", () => {
    for (const [leaf, source] of Object.entries(sourcesOf())) {
      expect(source, leaf).not.toMatch(/from\s+["']@\/lib\/api["']/)
      expect(source, leaf).not.toMatch(/fetch\(/)
      expect(source, leaf).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
      expect(source, leaf).not.toMatch(/["'`]\/(workflows|api)\//)
    }
  })

  it("they are LEAVES — no context, no store, no effect", () => {
    for (const [leaf, source] of Object.entries(sourcesOf())) {
      expect(source, leaf).not.toMatch(/useContext|useStore|useEffect|useSyncExternalStore|zustand/)
    }
  })

  it("they carry NO title attribute — guidance cannot regress into a tooltip", () => {
    for (const [leaf, source] of Object.entries(sourcesOf())) {
      expect(source, leaf).not.toMatch(/title=/)
    }
  })

  it("no forbidden spacing value, weight or dead colour utility enters them", () => {
    for (const [leaf, source] of Object.entries(sourcesOf())) {
      for (const needle of [
        "p-0.5",
        "gap-0.5",
        "py-2.5",
        "space-y-",
        "font-semibold",
        "font-bold",
        "text-panel-",
        "text-muted-foreground-dim",
      ]) {
        expect(source, `${leaf} · ${needle}`).not.toContain(needle)
      }
    }
  })

  it("⛔ NO CAPABILITY ID IS SPELLED IN EITHER COMPONENT — the shape stays in the caller", () => {
    // D-214-05's structural half: one renderer over one `inputSchema`, no capability branch.
    // The map that DOES name the three ids lives in `ConnectionPicker`, which is allowed to
    // know a connection's shape and is fenced against its own backend twin over there.
    for (const [leaf, source] of Object.entries(sourcesOf())) {
      for (const name of EXTERNAL_ACTION_CAPABILITIES) {
        expect(source, `${leaf} · ${name}`).not.toContain(`"${name}"`)
      }
    }
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    expect('const r = get("/workflows/x")').toMatch(/["'`]\/(workflows|api)\//)
    expect("const s = useStore(store)").toMatch(
      /useContext|useStore|useEffect|useSyncExternalStore|zustand/,
    )
    expect('<span title="why">x</span>').toMatch(/title=/)
    expect('class="p-0.5 font-semibold"').toContain("p-0.5")
    expect('const a = "send_email"').toContain('"send_email"')
  })
})
