/**
 * Phase 214-07 Task 2 — sketch 214's FIFTEEN INVARIANTS, reproduced as assertions.
 *
 * The generated `BUILD-CONTRACT.generated.md` §2 wrote each one as a "React equivalent"
 * recipe; this file is that column, executed. Three needed care and each carries the reason
 * in place:
 *
 *  #1 the escape-hatch fence — needles ASSEMBLED AT RUNTIME (the 187-24 trap, which fired
 *     four times in this phase's first wave), with a positive control asserted FIRST.
 *  #5 the gutter — read as GEOMETRY (track count, child index, the template string the
 *     component actually applies), never as a class name, because a class-name assertion
 *     would pass whether the lane was widened or inserted.
 *  #8 driven from the REAL `inputSchema`, extracted from the adapter's own source, so a row
 *     for an undeclared key cannot be invented by the fixture.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

// ⚠ ONLY the API module is faked, and only for the reachability block at the bottom. No
// provider is mocked, NO COMPONENT IS STUBBED, and no `ArgumentEditor` prop is constructed
// there — that is the whole point of the leg. The three names are exactly the ones
// `McpToolPicker` and `ConnectionPicker` import from this module; a factory missing one
// throws AT MOUNT, which is what Phase 196 measured as `failed 249`.
const { listMock, discoverMock, grantsMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  discoverMock: vi.fn().mockResolvedValue([]),
  grantsMock: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/api", () => ({
  listConnectorConnections: listMock,
  discoverConnectorTools: discoverMock,
  updateConnectorGrants: grantsMock,
}))

import { PhaseFormPanel } from "./PhaseFormPanel"
import { BuilderStoreProvider } from "./BuilderStoreProvider"
import { SelectedPhaseSlugProvider } from "./SelectedPhaseSlugContext"
import { createBuilderStore } from "./builderStore"
import type { PhaseSpecJSON } from "./phaseVocabulary"

import { ArgumentEditor } from "./ArgumentEditor"
import type { UpstreamPhase } from "./argumentModel"
import {
  ARG_LEFTOVER,
  ARG_LEFTOVER_NEXT,
  ARG_NO_SOURCE,
  ARG_OPTIONAL_MARK,
  ARG_PRESET_NOTE,
  ARG_REQUIRED_MARK,
  ARG_SCHEMA_UNKNOWN,
  ARG_SCHEMA_UNKNOWN_NEXT,
  ARG_SECTION_HEADING,
  ARG_SOURCE_ASK,
  ARG_SOURCE_FIXED,
  ARG_SOURCE_GROUP_LABEL,
  ARG_SOURCE_UPSTREAM,
  ARG_UPSTREAM_EMPTY,
} from "./argumentVocabulary"

import editorSource from "./ArgumentEditor?raw"
import rowSource from "./ArgumentRow?raw"
import modelSource from "./argumentModel.ts?raw"
import smtpAdapterSource from "../../../../backend/app/services/connectors/smtp_adapter.py?raw"

// ── THE FIXTURE IS READ FROM THE ADAPTER, NOT TYPED (invariant #8) ────────────────────
// ⚠ CRLF-TOLERANT. These files check out with Windows line endings; a `\n`-anchored
// terminator would silently never match and yield an empty set that passes vacuously.

function declaredProperties(): string[] {
  const block = /"properties":\s*MappingProxyType\(\{([\s\S]*?)\r?\n {8}\}\),/.exec(
    smtpAdapterSource,
  )
  if (block === null) return []
  return [...block[1].matchAll(/^\s{12}"([A-Za-z0-9_]+)":\s*MappingProxyType/gm)].map((m) => m[1])
}

function declaredRequired(): string[] {
  const m = /"required":\s*\[([\s\S]*?)\]/.exec(smtpAdapterSource)
  return m === null ? [] : [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

function smtpSchema(): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  for (const name of declaredProperties()) {
    properties[name] = { type: "string", description: `the ${name} value` }
  }
  return { type: "object", additionalProperties: false, required: declaredRequired(), properties }
}

/** ⚠ A NAME THAT IS NOT ITS SLUG — invariant #7 is unfalsifiable against a phase whose
 *  author-given name happens to equal its slug. */
const UPSTREAM: UpstreamPhase[] = [
  { slug: "gather-facts-a1", title: "Gather the facts" },
  { slug: "draft-the-note-b2", title: "Draft the note" },
]

const NOOP = () => {}

function renderEditor(props: Partial<Parameters<typeof ArgumentEditor>[0]> = {}) {
  return render(
    <ArgumentEditor
      schema={smtpSchema()}
      toolArgs={{}}
      argSources={{}}
      upstreamPhases={UPSTREAM}
      bodyArgKey="body"
      onChangeArgs={NOOP}
      onChangeSources={NOOP}
      {...props}
    />,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// #8 · EXACTLY THE ADAPTER'S OWN PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("ArgumentEditor — #8 the fields are the adapter's, and only the adapter's", () => {
  it("the extraction is non-vacuous before anything rests on it", () => {
    expect(declaredProperties()).toEqual(["to", "subject", "body"])
    expect(declaredRequired()).toEqual(["to", "subject", "body"])
  })

  it("⭐ renders one row per declared property — and NO field for an undeclared key", () => {
    renderEditor()
    expect(screen.getAllByTestId("argument-row")).toHaveLength(3)
    const undeclared = "c" + "c"
    expect(screen.queryByLabelText(new RegExp(`^${undeclared}`))).toBeNull()
    expect(screen.getByTestId("argument-editor").innerHTML).not.toContain(`>${undeclared}<`)
  })

  it("the section wears its own heading, from the vocabulary", () => {
    renderEditor()
    expect(screen.getByTestId("argument-editor-heading").textContent).toBe(ARG_SECTION_HEADING)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// #2 / #3 / #4 · THE SOURCE PICKER
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("ArgumentEditor — #2/#3/#4 three arms, one order, one name", () => {
  it("⭐ every group has EXACTLY three radios and AT MOST ONE checked, per row", () => {
    renderEditor({ argSources: { to: { source: "fixed" } }, toolArgs: { to: "a@b.test" } })
    const rows = screen.getAllByTestId("argument-row")
    expect(rows.length).toBeGreaterThanOrEqual(3)
    for (const row of rows) {
      const group = within(row).getByTestId("argument-row-sources")
      expect(within(group).getAllByRole("radio")).toHaveLength(3)
      expect(within(group).queryAllByRole("radio", { checked: true }).length).toBeLessThanOrEqual(1)
    }
  })

  it("#3 the three arms are in the SAME order in every group", () => {
    renderEditor()
    const expected = [ARG_SOURCE_FIXED, ARG_SOURCE_ASK, ARG_SOURCE_UPSTREAM]
    for (const row of screen.getAllByTestId("argument-row")) {
      const group = within(row).getByTestId("argument-row-sources")
      const names = within(group)
        .getAllByRole("radio")
        .map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent)
      expect(names).toEqual(expected)
    }
  })

  it("#4 every group's accessible name is the ONE vocabulary identifier", () => {
    renderEditor()
    const groups = screen.getAllByRole("radiogroup", { name: ARG_SOURCE_GROUP_LABEL })
    expect(groups).toHaveLength(3)
  })

  it("an unsourced row leaves EVERY arm unpressed — nothing is silently filled", () => {
    renderEditor()
    const first = screen.getAllByTestId("argument-row")[0]
    expect(within(first).queryAllByRole("radio", { checked: true })).toHaveLength(0)
    expect(within(first).getByTestId("argument-row-gutter").textContent).toBe(ARG_NO_SOURCE)
  })

  it("pressing an arm writes ONE source and clears the other two fields", () => {
    const onChangeSources = vi.fn()
    renderEditor({
      argSources: { to: { source: "ask", ask_key: "recipient" } },
      onChangeSources,
    })
    const toRow = screen.getAllByTestId("argument-row")[0]
    fireEvent.click(within(toRow).getByLabelText(ARG_SOURCE_UPSTREAM))
    expect(onChangeSources).toHaveBeenCalledTimes(1)
    const written = onChangeSources.mock.calls[0][0] as Record<string, Record<string, unknown>>
    expect(written.to.source).toBe("upstream")
    expect(written.to.ask_key).toBeNull()
    expect(written.to.upstream_slug).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// #5 · ⭐ THE GUTTER WIDENS — GEOMETRY, NEVER A CLASS NAME
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("ArgumentEditor — #5 the gutter is a column that widens", () => {
  const tracksOf = (row: HTMLElement): string[] =>
    (row.getAttribute("data-grid-columns") ?? "").split(" ").filter(Boolean)

  it("⭐ a SOURCED and an UNSOURCED row in one form have IDENTICAL label-column offsets", () => {
    renderEditor({ argSources: { to: { source: "ask", ask_key: "recipient" } } })
    const rows = screen.getAllByTestId("argument-row")
    const sourced = rows[0]
    const unsourced = rows[1]
    expect(sourced.getAttribute("data-arg-source")).toBe("ask")
    expect(unsourced.getAttribute("data-arg-source")).toBe("none")

    // (a) the template string is byte-identical — one string, computed once by the section.
    expect(sourced.getAttribute("data-grid-columns")).toBe(
      unsourced.getAttribute("data-grid-columns"),
    )
    // (b) the body cell is the SAME CHILD INDEX in both — a grid places children in order,
    //     so an inserted lane would move it. This is the offset, read structurally.
    expect(Array.from(sourced.children).indexOf(within(sourced).getByTestId("argument-row-body"))).toBe(1)
    expect(
      Array.from(unsourced.children).indexOf(within(unsourced).getByTestId("argument-row-body")),
    ).toBe(1)
  })

  it("⭐ the column is WIDENED, never INSERTED — two tracks in BOTH modes", () => {
    // ⚠ THE `off` STATE NEEDS `bodyArgKey: null`. With a body key and an upstream step the
    // D-214-03 pre-set already sources one row, so the default render is `on` — which is the
    // rule working, and a test that ignored it would have been asserting the wrong baseline.
    const { unmount } = renderEditor({ bodyArgKey: null })
    const off = screen.getAllByTestId("argument-row").map(tracksOf)
    const offGutter = screen.getByTestId("argument-editor").getAttribute("data-arg-gutter")
    unmount()

    renderEditor({ argSources: { to: { source: "fixed" } }, toolArgs: { to: "a@b.test" } })
    const on = screen.getAllByTestId("argument-row").map(tracksOf)
    const onGutter = screen.getByTestId("argument-editor").getAttribute("data-arg-gutter")

    expect(offGutter).toBe("off")
    expect(onGutter).toBe("on")
    // The TRACK COUNT never changes — this is the whole invariant.
    for (const tracks of [...off, ...on]) expect(tracks).toHaveLength(2)
    // The BODY track is identical in both modes; only the gutter track's width moves.
    expect(new Set([...off, ...on].map((t) => t[1])).size).toBe(1)
    expect(off[0][0]).not.toBe(on[0][0])
    // …and the element really applies it, not merely reports it.
    expect(screen.getAllByTestId("argument-row")[0].getAttribute("style")).toContain(on[0][1])
  })

  it("every row in one render receives the SAME template — no row computes its own", () => {
    renderEditor({ argSources: { subject: { source: "fixed" } }, toolArgs: { subject: "x" } })
    const templates = new Set(
      screen.getAllByTestId("argument-row").map((r) => r.getAttribute("data-grid-columns")),
    )
    expect(templates.size).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// #6 / #7 · THE UPSTREAM BINDING
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("ArgumentEditor — #6/#7 a bare slug, stored; a name, rendered", () => {
  it("⭐ the phase SLUG appears ZERO times in the DOM while its NAME appears", () => {
    const { container } = renderEditor({
      argSources: { subject: { source: "upstream", upstream_slug: "draft-the-note-b2" } },
    })
    for (const phase of UPSTREAM) {
      expect(container.innerHTML, phase.slug).not.toContain(phase.slug)
    }
    expect(container.innerHTML).toContain("Draft the note")
    // NON-VACUITY: the container really is the editor and really rendered rows.
    expect(screen.getAllByTestId("argument-row").length).toBe(3)
  })

  it("the option values are POSITIONAL, and choosing one stores a BARE slug", () => {
    const onChangeSources = vi.fn()
    renderEditor({
      argSources: { subject: { source: "upstream" } },
      onChangeSources,
    })
    // ⚠ SCOPED TO THE SUBJECT ROW. The body row carries its own upstream picker via the
    // D-214-03 pre-set, so an unscoped query finds two — which is the rule working.
    const subjectRow = screen.getAllByTestId("argument-row")[1]
    const select = within(subjectRow).getByTestId("argument-row-upstream") as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(["", "0", "1"])
    fireEvent.change(select, { target: { value: "1" } })
    const written = onChangeSources.mock.calls[0][0] as Record<string, Record<string, unknown>>
    expect(written.subject.upstream_slug).toBe("draft-the-note-b2")
    // ⛔ NO EXPRESSION LANGUAGE — the stored value is the slug and nothing else.
    expect(String(written.subject.upstream_slug)).not.toContain("{")
    expect(String(written.subject.upstream_slug)).not.toContain(".")
  })

  it("with no upstream steps the arm says so rather than offering an empty picker", () => {
    renderEditor({
      upstreamPhases: [],
      argSources: { subject: { source: "upstream" } },
    })
    expect(screen.getByTestId("argument-row-upstream-empty").textContent).toBe(ARG_UPSTREAM_EMPTY)
    expect(screen.queryByTestId("argument-row-upstream")).toBeNull()
  })

  it("an UNRESOLVABLE slug reads as *nothing supplies this yet* — it is never leaked", () => {
    const { container } = renderEditor({
      argSources: { subject: { source: "upstream", upstream_slug: "deleted-step-z9" } },
    })
    expect(container.innerHTML).not.toContain("deleted-step-z9")
    const subjectRow = screen.getAllByTestId("argument-row")[1]
    expect(within(subjectRow).getByTestId("argument-row-gutter").textContent).toBe(ARG_NO_SOURCE)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// #9 / #10 / #11 · LEFTOVERS, MARKS, THE PRE-SET
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("ArgumentEditor — #9 a leftover is shown and removable", () => {
  it("⭐ a stored undeclared key renders with a remove control and NO field", () => {
    const undeclared = "c" + "c"
    const onChangeArgs = vi.fn()
    renderEditor({ toolArgs: { [undeclared]: "x@y.test" }, onChangeArgs })
    const leftover = screen.getByTestId("argument-leftover")
    expect(leftover.textContent).toContain(ARG_LEFTOVER({ arg: undeclared }))
    expect(screen.getAllByTestId("argument-row")).toHaveLength(3)

    const remove = within(leftover).getByTestId("argument-leftover-remove")
    expect(remove.textContent).toBe(ARG_LEFTOVER_NEXT)
    fireEvent.click(remove)
    expect(onChangeArgs).toHaveBeenCalledWith({})
  })
})

describe("ArgumentEditor — #10 every row declares required and source", () => {
  it("both facts are derivable from the DOM for EVERY row", () => {
    renderEditor({ argSources: { to: { source: "ask", ask_key: "recipient" } } })
    const marks = [ARG_REQUIRED_MARK, ARG_OPTIONAL_MARK]
    for (const row of screen.getAllByTestId("argument-row")) {
      expect(marks).toContain(within(row).getByTestId("argument-row-mark").textContent)
      expect(row.getAttribute("data-arg-source")).toBeTruthy()
      expect(within(row).getByTestId("argument-row-gutter").textContent?.length).toBeGreaterThan(0)
    }
  })
})

describe("ArgumentEditor — #11 the body row is pre-set, says so, and stays changeable", () => {
  it("⭐ pre-set to the previous step, with the note, and the control ENABLED", () => {
    renderEditor()
    const bodyRow = screen.getAllByTestId("argument-row")[2]
    expect(bodyRow.getAttribute("data-arg-preset")).toBe("true")
    expect(bodyRow.getAttribute("data-arg-source")).toBe("upstream")
    expect(within(bodyRow).getByTestId("argument-row-preset-note").textContent).toBe(
      ARG_PRESET_NOTE,
    )
    const select = within(bodyRow).getByTestId("argument-row-upstream") as HTMLSelectElement
    expect(select.disabled).toBe(false)
    for (const radio of within(bodyRow).getAllByRole("radio")) {
      expect((radio as HTMLInputElement).disabled).toBe(false)
    }
  })

  it("only ONE row is pre-set, and only when nothing else says otherwise", () => {
    renderEditor()
    const preset = screen
      .getAllByTestId("argument-row")
      .filter((r) => r.getAttribute("data-arg-preset") === "true")
    expect(preset).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// D-214-07 · THE UNKNOWN SHAPE, AND THE UNRENDERABLE PROPERTY
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("ArgumentEditor — an unknown shape says so and invents nothing", () => {
  it("a null schema renders the sentence and the existing re-discovery action", () => {
    const onRediscover = vi.fn()
    renderEditor({ schema: null, toolArgs: { anything: 1 }, onRediscover })
    expect(screen.getByTestId("argument-editor").getAttribute("data-arg-state")).toBe(
      "unknown-shape",
    )
    expect(screen.getByTestId("argument-editor-unknown").textContent).toBe(ARG_SCHEMA_UNKNOWN)
    const next = screen.getByTestId("argument-editor-rediscover")
    expect(next.textContent).toBe(ARG_SCHEMA_UNKNOWN_NEXT)
    fireEvent.click(next)
    expect(onRediscover).toHaveBeenCalledTimes(1)
    // ⛔ IT INVENTS NO FIELDS — not even for the stored key it can see.
    expect(screen.queryAllByTestId("argument-row")).toHaveLength(0)
    expect(screen.queryAllByTestId("argument-leftover")).toHaveLength(0)
  })

  it("without a re-discovery route the action is not offered — no dead control", () => {
    renderEditor({ schema: null })
    expect(screen.queryByTestId("argument-editor-rediscover")).toBeNull()
  })

  it("an unrenderable property is NAMED, with no control of any kind", () => {
    renderEditor({
      schema: {
        type: "object",
        required: ["items"],
        properties: { items: { type: "array", items: { type: "string" } } },
      },
      bodyArgKey: null,
    })
    const row = screen.getByTestId("argument-row")
    expect(row.getAttribute("data-arg-renderable")).toBe("false")
    expect(within(row).getByTestId("argument-row-unrenderable-note").textContent).toBeTruthy()
    expect(within(row).queryByTestId("argument-row-value")).toBeNull()
    expect(within(row).queryAllByRole("radio")).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// #1 / #12 / #13 / #14 / #15 · THE ABSENCES
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("ArgumentEditor — #1 no escape hatch exists in any state", () => {
  const NEEDLES = [
    "<text" + "area",
    "js" + "on",
    "adv" + "anced",
    "key" + "-value",
    "key" + "/value",
    "tool arg" + "uments",
  ]

  it("⭐ the RENDERED DOM carries none of them, in every state this editor has", () => {
    // POSITIVE CONTROL FIRST — the matcher really matches, so an absence below is a fact.
    expect("a <text".concat("area/>").toLowerCase()).toContain(NEEDLES[0])

    const states: Partial<Parameters<typeof ArgumentEditor>[0]>[] = [
      {},
      { schema: null, onRediscover: NOOP },
      { argSources: { to: { source: "ask", ask_key: "r" } } },
      { argSources: { subject: { source: "upstream", upstream_slug: "draft-the-note-b2" } } },
      { toolArgs: { ["c" + "c"]: "x" } },
      {
        schema: { type: "object", required: ["items"], properties: { items: { type: "array" } } },
        bodyArgKey: null,
      },
    ]
    for (const [index, state] of states.entries()) {
      const { container, unmount } = renderEditor(state)
      const html = container.innerHTML.toLowerCase()
      // NON-VACUITY: this state really rendered the editor.
      expect(container.querySelector('[data-testid="argument-editor"]'), String(index)).not.toBeNull()
      for (const needle of NEEDLES) {
        expect(html.includes(needle), `state ${index} · ${needle}`).toBe(false)
      }
      unmount()
    }
  })

  it("⭐ the SOURCE of both new components names none of them either", () => {
    for (const [name, source] of [
      ["ArgumentEditor.tsx", editorSource],
      ["ArgumentRow.tsx", rowSource],
      ["argumentModel.ts", modelSource],
    ] as const) {
      // NON-VACUITY: the `?raw` import really resolved.
      expect(typeof source, name).toBe("string")
      expect(source.length, name).toBeGreaterThan(1000)
      const lowered = source.toLowerCase()
      for (const needle of ["text" + "area", "js" + "on", "adv" + "anced", "key" + "-value", "key" + "/value"]) {
        expect(lowered.includes(needle), `${name} · ${needle}`).toBe(false)
      }
    }
  })

  it("neither component consults a server or holds a store reference", () => {
    for (const source of [editorSource, rowSource]) {
      expect(source).not.toMatch(/from\s+["']@\/lib\/api["']/)
      expect(source).not.toMatch(/fetch\(/)
      expect(source).not.toMatch(/useContext|useStore|useEffect|useSyncExternalStore|zustand/)
    }
    // POSITIVE CONTROLS — each pattern really matches.
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect("const s = useStore(store)").toMatch(/useContext|useStore|useEffect|useSyncExternalStore|zustand/)
  })
})

describe("ArgumentEditor — #12/#13/#14/#15 the remaining absences", () => {
  it("#12 no `title` attribute anywhere — guidance may not regress into a tooltip", () => {
    const { container } = renderEditor({ argSources: { to: { source: "ask", ask_key: "r" } } })
    expect(container.querySelectorAll("[title]")).toHaveLength(0)
    expect(editorSource).not.toMatch(/title=/)
    expect(rowSource).not.toMatch(/title=/)
    expect('<span title="why">x</span>').toMatch(/title=/)
  })

  it("#13 NO capability id reaches the DOM", () => {
    const { container } = renderEditor({ argSources: { to: { source: "fixed" } } })
    const html = container.innerHTML
    for (const id of ["send_" + "email", "create_" + "ticket", "post_" + "message", "external_" + "action"]) {
      expect(html, id).not.toContain(id)
    }
    // NON-VACUITY + the matcher's own control.
    expect(html.length).toBeGreaterThan(500)
    expect('<div data-x="send_email">').toContain("send_" + "email")
  })

  it("#14 the form spends NO destructive colour", () => {
    const { container } = renderEditor({ argSources: { to: { source: "fixed" } } })
    expect(container.innerHTML).not.toContain("destructive")
    expect(editorSource).not.toContain("destructive")
    expect(rowSource).not.toContain("destructive")
    expect('class="text-destructive"').toContain("destructive")
  })

  it("#15 the phrase *external action* appears nowhere a person reads", () => {
    const { container } = renderEditor()
    expect(container.innerHTML.toLowerCase()).not.toContain("external " + "action")
    expect("an external ".concat("action step").toLowerCase()).toContain("external " + "action")
  })

  it("every sentence is an IMPORTED identifier — neither component authors its own", () => {
    // The vocabulary's values must not be re-typed inside the components; only their names.
    for (const sentence of [
      ARG_SECTION_HEADING,
      ARG_NO_SOURCE,
      ARG_PRESET_NOTE,
      ARG_SCHEMA_UNKNOWN,
      ARG_SOURCE_FIXED,
      ARG_SOURCE_ASK,
      ARG_SOURCE_UPSTREAM,
      ARG_SOURCE_GROUP_LABEL,
      ARG_UPSTREAM_EMPTY,
    ]) {
      expect(editorSource, sentence).not.toContain(sentence)
      expect(rowSource, sentence).not.toContain(sentence)
    }
    // …and they DO name the identifiers, so the absence above is a copy rule and not an
    // empty component.
    expect(editorSource).toMatch(/ARG_SECTION_HEADING/)
    expect(rowSource).toMatch(/ARG_SOURCE_GROUP_LABEL/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⭐ REACHABILITY — A DIFF SHAPE IS NOT A RENDER
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// ⚠ `git diff --numstat` and *"exactly one added JSX element"* prove the code was WRITTEN.
// They prove nothing at all about whether a person can reach it. **Phase 209's whole lesson
// is *"shipped nothing to anyone"*** — sixteen browser checks green against a hand-flipped
// flag, over a surface that rendered for no one. The repo's answer is the two-legged guard in
// `McpToolPicker.reachability.test.tsx` and `__tests__/connectionCardReachability.test.tsx`,
// and this block is that idiom copied rather than re-invented.
//
// THE TIER DISCIPLINE, restated because it is what makes this block worth its lines:
//   T1 — every case ABOVE builds `ArgumentEditor`'s props by hand. That is right for the
//        component's own contract and STRUCTURALLY UNABLE to see that nothing builds them.
//   T3 — this block. The PRODUCTION parent (`PhaseFormPanel`), a real store, only `@/lib/api`
//        faked, NOT ONE `ArgumentEditor` PROP CONSTRUCTED, and NOTHING between the panel and
//        the editor stubbed. The whole chain runs: PhaseFormPanel → ExternalActionSection →
//        ConnectionPicker → ArgumentEditor.
//
// ⚠ THE FEATURE FLAG, STATED HONESTLY RATHER THAN STUBBED INTO A CLAIM THIS CANNOT MAKE.
// `PhaseFormPanel` reads NO feature gate — `useCanvasGate` is defined in
// `pages/WorkflowBuilderPage.tsx` and consumed by `RunModal`/the door, never by this panel,
// whose own `rails` docblock records why: it is ONE instance serving BOTH the shipped Spine
// view and the flagged Canvas view. So this surface is flag-INDEPENDENT by construction and
// there is nothing here to stub. ⭐ The authoritative COLD-READ assertion is `214-14`'s
// `backend/tests/unit/test_214_flag_cold_default.py`, against `_GOVERNED_FEATURES` with no
// `app_settings` row — that is where Phase 209's failure is actually fenced, and this case
// must NOT be read as a substitute for it.

const REACH_SLUG = "notify-the-owner"

/** The WIRE shape of a first-party row, exactly as `GET /connectors/connections` returns it.
 *  ⚠ Its `discovered_tools` entry is the DESCRIPTOR migration 127 §2b writes — the action's
 *  name IS the capability, which is what lets one action list serve both shapes. */
const REACH_ROW: Record<string, unknown> = {
  id: "conn-slack",
  org_id: "org-1",
  service_id: "slack",
  capability: "post_message",
  name: "#ops-alerts",
  config: { default_channel: "ops-alerts" },
  is_enabled: true,
  last_check_verdict: "ok",
  tool_grants: {},
  discovered_tools: [
    {
      name: "post_message",
      title: "Post message",
      description: "Post one plain-text message to the channel configured on this connection.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string", description: "The message." } },
      },
    },
  ],
}

function reachPhases(phaseType: string): PhaseSpecJSON[] {
  return [
    {
      slug: "draft-the-note-b2",
      phase_index: 0,
      name: "Draft the note",
      config: { phase_type: "llm_single" },
    } as unknown as PhaseSpecJSON,
    {
      slug: REACH_SLUG,
      phase_index: 1,
      config: {
        phase_type: phaseType,
        // The two facts an author has already answered by this point, and nothing else. The
        // arguments themselves are EMPTY — the editor must appear from the SCHEMA, not from
        // stored values, or it would only ever show up for a step somebody already finished.
        connection_id: "conn-slack",
        capability: "post_message",
      },
    } as unknown as PhaseSpecJSON,
  ]
}

/** ⚠ NOTHING BELOW THE PANEL IS STUBBED. The only thing supplied is the WIRE RESPONSE. */
function renderPanel(phaseType: string) {
  const store = createBuilderStore({
    slug: "vendor-brief",
    version: 1,
    phases: reachPhases(phaseType),
  })
  listMock.mockResolvedValue([REACH_ROW])
  const phase = store.getState().phases[1]
  return render(
    <BuilderStoreProvider store={store}>
      <SelectedPhaseSlugProvider slug={REACH_SLUG}>
        <PhaseFormPanel
          phase={phase}
          open
          onChange={(patch) => store.getState().patchConfig(REACH_SLUG, patch)}
          onPersist={() => store.getState().flushHistory()}
          onClose={NOOP}
        />
      </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>,
  )
}

describe("⭐ REACHABILITY — the editor renders through the REAL mount chain", () => {
  beforeEach(() => {
    listMock.mockReset()
    discoverMock.mockClear()
  })

  it("⭐ PhaseFormPanel → ExternalActionSection → ConnectionPicker → ArgumentEditor", async () => {
    renderPanel("external_action")

    // The chain, link by link, so a break is diagnosable in one read rather than one bit.
    expect(await screen.findByTestId("external-action-section")).toBeTruthy()
    expect(await screen.findByTestId("connection-picker")).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeTruthy())

    // ⭐ THE EDITOR'S OWN MARKER NODE, reached without anyone constructing a prop for it.
    const editor = await screen.findByTestId("argument-editor")
    expect(editor.getAttribute("data-arg-state")).toBe("fields")

    // …AND AT LEAST ONE ARGUMENT ROW'S SOURCE CONTROL — the thing a person operates. A
    // marker node alone would pass against a section that rendered its heading and nothing.
    const groups = within(editor).getAllByRole("radiogroup", { name: ARG_SOURCE_GROUP_LABEL })
    expect(groups.length).toBeGreaterThanOrEqual(1)
    expect(within(groups[0]).getAllByRole("radio")).toHaveLength(3)

    // The field really came from the adapter's declared schema, not from a stored value.
    expect(within(editor).getAllByTestId("argument-row")).toHaveLength(1)
  })

  it("⭐ NEGATIVE CONTROL — an `llm_single` step renders NO editor at all", async () => {
    // Without this, the case above would pass against a panel that rendered the editor
    // unconditionally, which is a different feature and a worse one.
    renderPanel("llm_single")
    await waitFor(() => expect(screen.queryByTestId("external-action-section")).toBeNull())
    expect(screen.queryByTestId("argument-editor")).toBeNull()
    expect(screen.queryByTestId("connection-picker")).toBeNull()
  })

  it("⛔ and no free-form control appears anywhere on the panel for this step", async () => {
    // The tree-wide claim, made where a person actually stands. POSITIVE CONTROL first.
    expect("a <text".concat("area/>").toLowerCase()).toContain("<text" + "area")
    const { container } = renderPanel("external_action")
    await screen.findByTestId("argument-editor")
    const html = container.innerHTML.toLowerCase()
    for (const needle of ["js" + "on", "tool arg" + "uments", "key" + "-value"]) {
      expect(html.includes(needle), needle).toBe(false)
    }
    // NON-VACUITY: the panel really rendered a substantial surface.
    expect(html.length).toBeGreaterThan(2000)
  })
})
