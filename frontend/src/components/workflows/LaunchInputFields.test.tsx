/**
 * Phase 214-12 Task 1 (STEP-02 / D-214-04) — the ONE declared-input field renderer.
 *
 * Authored fresh (MEMORY project_frontend_vitest_rot) — nothing imported from a sibling suite.
 *
 * What this fences, and why each half needs fencing:
 *
 *  1. TWO ARMS, NEVER THREE. An authored label renders as prose in the body face; a key with no
 *     label renders THE KEY in the mono face. The negative control matters more than the
 *     positive one: the failure mode this rule exists to stop is a FABRICATED friendly name, and
 *     a suite that only asserted "something rendered" would pass while a third arm invented one.
 *  2. THE EMPTY ARM IS THE COMPONENT'S. `fields: []` renders NOTHING — not an empty region, not
 *     a heading, not a container. That is what makes *"a definition declaring no inputs launches
 *     exactly as today, with no new screen"* one fact in one place instead of a discipline each
 *     of the three launchers has to remember separately.
 *  3. `onChange` REPORTS THE KEY. The three callers keep their own state; this leaf must name
 *     which key moved, or a two-field form would write both values into one slot.
 *  4. NOTHING PRE-FILLS. A rendered value comes from `values` and from nowhere else — not from
 *     the field's own `label`, not from its key, not from a default. This is the leaf-side half
 *     of D-214-04's rejected arm: a value a person did not type must not appear in a box they
 *     are about to confirm.
 *  5. IT IS A LEAF, fenced against the STRIPPED source. It reaches for no shared state and no
 *     client module, so the same component can hang inside a library modal, a schedule form and
 *     a chat sheet without any of them being wrong.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LaunchInputFields } from "./LaunchInputFields"
import launchInputFieldsSource from "./LaunchInputFields?raw"
import { launchInputFields } from "./soulData"

const noop = () => {}

describe("LaunchInputFields — two arms, never three", () => {
  it("renders an AUTHORED label as prose, in the body face", () => {
    render(
      <LaunchInputFields
        fields={[{ key: "to", label: "Recipient address" }]}
        values={{}}
        onChange={noop}
      />,
    )
    const input = screen.getByTestId("run-input-to")
    const label = input.parentElement?.querySelector("span")
    expect(label).not.toBeNull()
    expect(label).toHaveTextContent("Recipient address")
    // The body face, NOT the mono face — the two arms differ typographically on purpose.
    expect(label?.className).not.toMatch(/font-mono/)
  })

  it("renders THE KEY in the mono face when the author wrote no label", () => {
    render(<LaunchInputFields fields={[{ key: "to" }]} values={{}} onChange={noop} />)
    const input = screen.getByTestId("run-input-to")
    const label = input.parentElement?.querySelector("span")
    expect(label).toHaveTextContent("to")
    expect(label?.className).toMatch(/font-mono/)
  })

  it("NEGATIVE CONTROL — absence never fabricates a friendly name", () => {
    // The failure this rule exists to stop is a THIRD arm that title-cases, humanises or
    // otherwise invents an author's word. The raw key is the only true thing there is to print.
    render(<LaunchInputFields fields={[{ key: "recipient_email" }]} values={{}} onChange={noop} />)
    const label = screen.getByTestId("run-input-recipient_email").parentElement
    expect(label).toHaveTextContent("recipient_email")
    for (const invented of ["Recipient Email", "Recipient email", "Recipient"]) {
      expect(label).not.toHaveTextContent(invented)
    }
  })

  it("keeps the two arms apart in ONE render, so neither leaks into the other", () => {
    render(
      <LaunchInputFields
        fields={[
          { key: "to", label: "Recipient address" },
          { key: "cc" },
        ]}
        values={{}}
        onChange={noop}
      />,
    )
    const labelled = screen.getByTestId("run-input-to").parentElement?.querySelector("span")
    const bare = screen.getByTestId("run-input-cc").parentElement?.querySelector("span")
    expect(labelled?.className).not.toMatch(/font-mono/)
    expect(bare?.className).toMatch(/font-mono/)
    expect(bare).toHaveTextContent("cc")
  })
})

describe("LaunchInputFields — the empty arm is the COMPONENT's property", () => {
  it("renders null for an empty fields array — no region, not an empty one", () => {
    const { container } = render(<LaunchInputFields fields={[]} values={{}} onChange={noop} />)
    expect(container.innerHTML).toBe("")
    expect(screen.queryByTestId("run-inputs")).not.toBeInTheDocument()
  })

  it("POSITIVE CONTROL — one field DOES render the region, so the empty case is a measurement", () => {
    render(<LaunchInputFields fields={[{ key: "to" }]} values={{}} onChange={noop} />)
    expect(screen.getByTestId("run-inputs")).toBeInTheDocument()
  })

  it("a definition that declares nothing yields NO fields through the real resolver", () => {
    // The end-to-end form of the rule: `launchInputFields` is what the three callers hand in,
    // and its answer for a bare definition is the empty array this component renders as null.
    // ⚠ `entryInputFields` would have answered `[{ key: "kickoff_prompt" }]` here — a RESERVED
    // key the server strips — which is why the callers must not use it.
    const fields = launchInputFields({ phases: [] })
    expect(fields).toEqual([])
    const { container } = render(
      <LaunchInputFields fields={fields} values={{}} onChange={noop} />,
    )
    expect(container.innerHTML).toBe("")
  })
})

describe("LaunchInputFields — it reports what changed, and seeds nothing", () => {
  it("onChange fires with the KEY that moved and the new value", () => {
    const onChange = vi.fn()
    render(
      <LaunchInputFields
        fields={[{ key: "to" }, { key: "subject" }]}
        values={{}}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByTestId("run-input-subject"), { target: { value: "Q3" } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("subject", "Q3")
    // The OTHER key was never named — a two-field form cannot write both into one slot.
    expect(onChange).not.toHaveBeenCalledWith("to", "Q3")
  })

  it("renders ONLY what `values` holds — never the key, never the label, never a default", () => {
    render(
      <LaunchInputFields
        fields={[
          { key: "to", label: "Recipient address" },
          { key: "subject" },
        ]}
        values={{ to: "a@example.test" }}
        onChange={noop}
      />,
    )
    // Supplied → shown.
    expect(screen.getByTestId("run-input-to")).toHaveValue("a@example.test")
    // Not supplied → EMPTY, though both a key and (for the sibling) a label were available to
    // seed from. This is the leaf half of D-214-04: nothing a person did not type appears here.
    expect(screen.getByTestId("run-input-subject")).toHaveValue("")
  })

  it("is CONTROLLED — typing does not change the value unless the caller hands a new one", () => {
    render(<LaunchInputFields fields={[{ key: "to" }]} values={{ to: "held" }} onChange={noop} />)
    const input = screen.getByTestId("run-input-to")
    fireEvent.change(input, { target: { value: "typed" } })
    // The caller owns the state; a leaf that quietly kept its own would desync from the dict
    // the launcher actually sends.
    expect(input).toHaveValue("held")
  })
})

// ── The leaf fence, read against STRIPPED source ──────────────────────────────
//
// ⚠ THE STRIPPER IS LOAD-BEARING AND IS TESTED FIRST (the 187-24 lesson). This component's
// docblock legitimately DISCUSSES what it must not reach for; a raw-text scan would count that
// prose and read the fence as broken — or, worse, a future edit could satisfy the fence by
// deleting a paragraph. The assertions below index code only.
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}

const CODE = codeOf(launchInputFieldsSource)

describe("LaunchInputFields — source fence: it is a leaf", () => {
  it("the stripper works, with a positive control on both comment forms", () => {
    const sample = codeOf(`const keep = 1 // drop-me-line\r\n/* drop-me-block */\r\nconst also = 2`)
    expect(sample).not.toMatch(/drop-me-line/)
    expect(sample).not.toMatch(/drop-me-block/)
    expect(sample).toMatch(/const keep = 1/)
    expect(sample).toMatch(/const also = 2/)
    // And it really removed something from THIS file — a no-op stripper would pass every
    // absence assertion below for free.
    expect(CODE.length).toBeLessThan(launchInputFieldsSource.length)
  })

  it("imports no shared state, no provider read and no client module", () => {
    // Needles assembled from parts so this suite's own source can never satisfy a wider grep
    // over the file set (the 187-24 lesson).
    const STATE_HOOK = ["use", "Store"].join("")
    const CTX_HOOK = ["use", "Context"].join("")
    const API_MODULE = ["@/lib", "/api"].join("")
    for (const needle of [STATE_HOOK, CTX_HOOK, API_MODULE]) {
      expect(CODE).not.toContain(needle)
    }
    // POSITIVE CONTROL — the assembled needles really do match the shapes they forbid.
    expect(`const x = ${STATE_HOOK}()`).toContain(STATE_HOOK)
    expect(`import { postMessage } from "${API_MODULE}"`).toContain(API_MODULE)
    expect(`const c = ${CTX_HOOK}(X)`).toContain(CTX_HOOK)
  })

  it("holds no state and runs no effect of its own", () => {
    for (const hook of ["useState", "useEffect", "useRef", "useReducer"]) {
      expect(CODE).not.toContain(hook)
    }
    // POSITIVE CONTROL for the same probe shape.
    expect(codeOf(`const [a, b] = useState(1)`)).toContain("useState")
  })

  it("has exactly ONE import, and it is a TYPE", () => {
    // ⚠ `\r?\n` — this repo's sources are CRLF and a bare `\n` terminator matches nothing,
    // which would make the assertion pass vacuously.
    const imports = CODE.match(/^import .*?$/gm) ?? []
    expect(imports).toHaveLength(1)
    expect(imports[0]).toMatch(/^import type \{ EntryInputField \}/)
    expect(CODE).toMatch(/import type \{ EntryInputField \} from "@\/components\/workflows\/soulData"\r?\n/)
  })

  it("carries no runtime `export const` beside the component (react-refresh)", () => {
    // A runtime export beside a component is a measured lint ERROR on this directory
    // (ExternalActionSection.tsx records the same finding). One export, and it is the function.
    const exports = CODE.match(/^export .*?$/gm) ?? []
    expect(exports).toHaveLength(1)
    expect(exports[0]).toMatch(/^export function LaunchInputFields\(/)
  })
})
