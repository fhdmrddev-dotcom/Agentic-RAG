/**
 * Phase 193.1-05 Task 2 (AUTH-03 — D-01 / D-24(b), threats T-193.1-05-01 / T-193.1-05-02) —
 * THE EXTRACTED PRE-DRAFT CONCERN, TESTED IN ITS OWN MODULE.
 *
 * Two things live here and they are different kinds of claim:
 *
 *  1. **The BEHAVIOUR of the moved code**, asserted THROUGH THE HOOK rather than through a
 *     mounted page. `193.1-01` already pins the same `/generate` key set at the page level;
 *     this file guards the moved code directly, so a future edit that breaks it reds here
 *     first — at the module that owns it — instead of only in a page suite that mounts it.
 *
 *  2. **The ESM-CYCLE FENCE (D-24(b))**, which is the reason an extraction needs a fence at
 *     all. The host page imports this hook's VALUE at module scope, so the subtree carries a
 *     live value-level edge. An import back would typecheck clean, lint clean, and fail only
 *     at RUNTIME as a TDZ `ReferenceError` in whichever module a caller reached first — under
 *     Vitest, whichever suite happens to import first. Nothing in the build can see that, so
 *     the constraint is spelled as an assertion over the module's own source.
 *
 * ⚠ **TWO HOSTS, NOT ONE.** `DoorHeaderStrip.test.tsx`'s shipped fence guards ONE subject. This
 * hook has two live back-edges rather than one: the Builder page imports it today, and D-24
 * puts the same row on the LOOSE door's describe screen — so a later plan mounts it from the
 * door shell too. Fencing only the page would leave the second edge open at exactly the moment
 * it is created. Both subjects are therefore swept, in every import form, in both suffix
 * spellings.
 *
 * ⚠ `(\.[jt]sx?)?` IS LOAD-BEARING and is inherited rather than rediscovered:
 * `frontend/tsconfig.app.json:13-14` sets `"moduleResolution": "bundler"` WITH
 * `"allowImportingTsExtensions": true`, so `from "./X.tsx"` compiles, resolves, and would build
 * a real TDZ cycle under a fence anchored to close immediately after the module name.
 *
 * ⚠ The EXACT-EQUALITY specifier form (`DoorHeaderStrip.test.tsx:311-347`) does NOT transfer
 * here and that is stated rather than silently dropped: this hook legitimately imports `react`,
 * `@/lib/api` and `./builderStore`, so "imports exactly one module" is false by design. The
 * NEGATIVE-regex form plus a non-vacuity floor is what binds instead — together with the raw
 * `grep -c` property the module's own header records, which is the same claim checkable by the
 * crudest possible tool.
 *
 * ORDER IS NOT OPTIONAL, and it is the 192.1 E-2 lesson: **non-vacuity first** (the `?raw`
 * import really loaded), **then the positive controls** (each forbidden shape proved to be
 * CAUGHT), **then the negative `?raw` controls** (proved to stay MISSING), **then** the
 * assertion over the real source. A matcher that cannot match passes vacuously and looks
 * exactly like a fence that holds.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

import { useTemplateFirstDraft, type TemplateFirstDefinition } from "./useTemplateFirstDraft"
// The hook SOURCE via Vite's `?raw` loader — the shipped house idiom for a machine-checkable
// scope fence (`canvasModel.purity.test.ts:14-17`, `DoorHeaderStrip.test.tsx:250-256`).
import templateFirstDraftSource from "./useTemplateFirstDraft?raw"
import { createBuilderStore, type BuilderPhase, type BuilderStore } from "./builderStore"
import {
  generateWorkflow,
  readTemplatePlaceholdersFromFile,
  uploadWorkflowTemplate,
  type GenerateResult,
  type WorkflowTemplateAsset,
} from "@/lib/api"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    generateWorkflow: vi.fn(),
    // 193.1-07: the two seams this plan adds. The READ is the pre-draft state machine's
    // only network call; the UPLOAD is D-06's bind. Both are mocked here rather than at a
    // `fetch` level so a test can drive a REJECTION, an ABORT and a slow answer separately
    // — the three shapes the five arms and the fire-and-forget guard are made of.
    readTemplatePlaceholdersFromFile: vi.fn(),
    uploadWorkflowTemplate: vi.fn(),
  }
})

const mockedGenerate = vi.mocked(generateWorkflow)
const mockedRead = vi.mocked(readTemplatePlaceholdersFromFile)
const mockedUpload = vi.mocked(uploadWorkflowTemplate)

/** A real `File`. The subject of the read is the OBJECT, never its name — see §8. */
function fileNamed(name: string): File {
  return new File(["irrelevant bytes"], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

/** A descriptor in the shape `POST /workflows/{id}/template` returns. */
function descriptorFor(filename: string): WorkflowTemplateAsset {
  return { kind: "template", asset_id: `assets/${filename}`, filename, mime: "application/docx" }
}

/** A minimal but REAL definition, in the shape `setDrafted` accepts. */
function definitionOf(over: Record<string, unknown> = {}): TemplateFirstDefinition {
  return {
    slug: "a-workflow",
    version: 1,
    phases: [{ slug: "retrieve", type: "retrieval", config: {} }],
    ...over,
  } as unknown as TemplateFirstDefinition
}

/**
 * The hook under a real store, with both page callbacks recorded.
 *
 * ⚠ THE STORE IS THE REAL `createBuilderStore`, not a stub. The moved code's whole success
 * path is three store ACTIONS, and a stubbed store would let a transition that no longer
 * reaches the document pass green.
 */
function mountHook(
  args: Partial<Parameters<typeof useTemplateFirstDraft>[0]> = {},
  store: BuilderStore = createBuilderStore(null),
) {
  const started: number[] = []
  const drafted: TemplateFirstDefinition[] = []
  // 193.1-07 (D-06): the descriptors the bind handed back. On the real page this callback IS
  // the shipped `onTemplateAttached`, so recording it here records exactly what reaches the
  // store's single writer.
  const bound: WorkflowTemplateAsset[] = []
  // ⚠ The prop type is spelled ONCE and WIDE. `{ builderPhase: "empty" as const }` would
  // narrow `initialProps` to the literal `"empty"`, and every `rerender` into another arm
  // would then be a TYPE error rather than the thing under test.
  const initialProps: { builderPhase: BuilderPhase } = { builderPhase: "empty" }
  const view = renderHook(
    (props: { builderPhase: BuilderPhase }) =>
      useTemplateFirstDraft({
        store,
        builderPhase: props.builderPhase,
        onDraftStarted: () => started.push(1),
        onDrafted: (def) => drafted.push(def),
        onTemplateBound: (asset) => bound.push(asset),
        ...args,
      }),
    { initialProps },
  )
  return { view, store, started, drafted, bound }
}

beforeEach(() => {
  mockedGenerate.mockReset()
  mockedRead.mockReset()
  mockedUpload.mockReset()
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 1 — `canDraft`: the CTA's enablement rule, all three arms it has today
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — canDraft", () => {
  it("is FALSE with empty text", () => {
    const { view } = mountHook()
    expect(view.result.current.canDraft).toBe(false)
  })

  it("is FALSE with whitespace-only text — `.trim()` is the rule, not `.length`", () => {
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("   \n  "))
    expect(view.result.current.canDraft).toBe(false)
  })

  it("is TRUE with text", () => {
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    expect(view.result.current.canDraft).toBe(true)
  })

  it("is FALSE while composing, even with text — the second half of the rule", () => {
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    expect(view.result.current.canDraft).toBe(true)
    view.rerender({ builderPhase: "composing" })
    expect(view.result.current.canDraft).toBe(false)
  })

  it("seeds `describe` from `initialDescribe`, so the loose door's text survives the handoff", () => {
    const { view } = mountHook({ initialDescribe: "seeded from the fast door" })
    expect(view.result.current.describe).toBe("seeded from the fast door")
    expect(view.result.current.canDraft).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 2 — the WIRE: the `/generate` body as a sorted KEY SET, in two folder states
//
// ⚠ A KEY SET, deep-equal, never `toMatchObject` or `expect.objectContaining`. A partial
// matcher cannot see an EXTRA key, and "what this request carries" is exactly the property
// this phase is about to change — `template_placeholders` joins the body in a later wave, and
// these two literals are the mechanical evidence that it did.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — the /generate request body", () => {
  it("carries exactly ['describe'] when no knowledge base is picked", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("  a weekly status report  "))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    const body = mockedGenerate.mock.calls[0][0]
    expect(Object.keys(body).sort()).toEqual(["describe"])
    // …and the text is TRIMMED on the way out, which the key set alone cannot see.
    expect(body.describe).toBe("a weekly status report")
  })

  it("carries exactly ['describe','project_folder_id'] when one is picked", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const { view } = mountHook()
    act(() => {
      view.result.current.setDescribe("a weekly status report")
      view.result.current.setProjectFolderId("folder-1")
    })
    await act(async () => {
      await view.result.current.onDraft()
    })
    const body = mockedGenerate.mock.calls[0][0]
    expect(Object.keys(body).sort()).toEqual(["describe", "project_folder_id"])
    expect(body.project_folder_id).toBe("folder-1")
  })

  it("POSITIVE CONTROL — the key-set assertion really would fire on an extra key", () => {
    // Without this, both assertions above are satisfied by an assertion that cannot fail.
    expect(Object.keys({ describe: "x", template_placeholders: [] }).sort()).not.toEqual([
      "describe",
    ])
  })

  it("makes NO call at all on empty text — the CTA's guard is in the callback too", async () => {
    const { view } = mountHook()
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(mockedGenerate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 3 — the SUCCESS path: one transition, one raise, and the stamp
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — a successful generation", () => {
  it("raises `onDrafted` EXACTLY ONCE with the definition, and enters the drafted view", async () => {
    const def = definitionOf()
    mockedGenerate.mockResolvedValue({ ok: true, definition: def } as GenerateResult)
    const { view, store, started, drafted } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted).toHaveLength(1)
    expect(drafted[0].slug).toBe("a-workflow")
    expect(store.getState().builderPhase).toBe("drafted")
    // …and the page's pre-flight reset fired exactly once, before the await.
    expect(started).toHaveLength(1)
  })

  it("STAMPS the picked folder onto a definition the generator did not bind", async () => {
    mockedGenerate.mockResolvedValue({
      ok: true,
      definition: definitionOf(),
    } as GenerateResult)
    const { view, drafted } = mountHook()
    act(() => {
      view.result.current.setDescribe("a weekly status report")
      view.result.current.setProjectFolderId("folder-1")
    })
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted[0].project_folder_id).toBe("folder-1")
  })

  it("does NOT overwrite a binding the generator already made", async () => {
    mockedGenerate.mockResolvedValue({
      ok: true,
      definition: definitionOf({ project_folder_id: "generator-chose-this" }),
    } as GenerateResult)
    const { view, drafted } = mountHook()
    act(() => {
      view.result.current.setDescribe("a weekly status report")
      view.result.current.setProjectFolderId("folder-1")
    })
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted[0].project_folder_id).toBe("generator-chose-this")
  })

  it("stamps NOTHING when no folder is picked — an absent binding stays absent", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const { view, drafted } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted[0].project_folder_id).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 4 — the FAILURE paths: honest, and they raise NOTHING
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — an honest failure", () => {
  it("on {ok:false} sets the store's error state and raises `onDrafted` ZERO times", async () => {
    mockedGenerate.mockResolvedValue({
      ok: false,
      error: "Couldn't generate — the model refused.",
      detail: "a detail line",
    } as GenerateResult)
    const { view, store, drafted } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted).toHaveLength(0)
    expect(store.getState().builderPhase).toBe("error")
    expect(store.getState().errorMessage).toBe("Couldn't generate — the model refused.")
    expect(store.getState().errorDetail).toBe("a detail line")
    // …and NO phases were rendered — never a renderable broken draft (T-103-04-01).
    expect(store.getState().phases).toEqual([])
  })

  it("on a THROWN error reports the message and still raises `onDrafted` zero times", async () => {
    mockedGenerate.mockRejectedValue(new Error("Failed to generate workflow (status 502)"))
    const { view, store, drafted } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted).toHaveLength(0)
    expect(store.getState().builderPhase).toBe("error")
    expect(store.getState().errorDetail).toBe("Failed to generate workflow (status 502)")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 5 — the 124 CR-01 ONE-SHOT auto-draft
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — the loose door's one-shot auto-draft", () => {
  it("fires EXACTLY ONCE, and not again on a re-render", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const { view } = mountHook({ autoDraft: true, initialDescribe: "seeded from the fast door" })
    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1))
    view.rerender({ builderPhase: "empty" })
    view.rerender({ builderPhase: "empty" })
    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1))
  })

  it("does NOT fire without `autoDraft` — SC#4's fast door stays untouched by construction", async () => {
    mountHook({ initialDescribe: "seeded from the fast door" })
    await waitFor(() => expect(mockedGenerate).not.toHaveBeenCalled())
  })

  it("does NOT fire on an EMPTY seed, even with `autoDraft`", async () => {
    mountHook({ autoDraft: true, initialDescribe: "   " })
    await waitFor(() => expect(mockedGenerate).not.toHaveBeenCalled())
  })

  it("does NOT fire outside the fresh-build 'empty' arm", async () => {
    const { view } = mountHook({ autoDraft: true, initialDescribe: "seeded" })
    view.rerender({ builderPhase: "drafted" })
    // The mount itself is "empty", so re-render to "drafted" only proves the guard once the
    // hook has already fired. Mount a SECOND hook that starts drafted, which is the real arm.
    mockedGenerate.mockReset()
    const store = createBuilderStore(definitionOf())
    renderHook(() =>
      useTemplateFirstDraft({
        store,
        builderPhase: "drafted",
        autoDraft: true,
        initialDescribe: "seeded",
        onDraftStarted: () => {},
        onDrafted: () => {},
      }),
    )
    await waitFor(() => expect(mockedGenerate).not.toHaveBeenCalled())
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 6 — the pre-draft KB seed, in its two sources and their precedence
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — the pre-draft knowledge-base seed", () => {
  it("defaults to '' — no binding is the honest empty reading, never a placeholder id", () => {
    const { view } = mountHook()
    expect(view.result.current.projectFolderId).toBe("")
  })

  it("takes the loose door's choice when the Builder booted on nothing (187-26 GAP A)", () => {
    const { view } = mountHook({ initialProjectFolderId: "from-the-loose-door" })
    expect(view.result.current.projectFolderId).toBe("from-the-loose-door")
  })

  it("PREFERS the opened definition's own binding — the OPEN/TWEAK reading wins", () => {
    const { view } = mountHook({
      initialProjectFolderId: "from-the-loose-door",
      initialDefinitionFolderId: "the-definitions-own",
    })
    expect(view.result.current.projectFolderId).toBe("the-definitions-own")
  })

  it("falls through a NULL definition binding — `typeof === 'string'` is the narrowing", () => {
    const { view } = mountHook({
      initialProjectFolderId: "from-the-loose-door",
      initialDefinitionFolderId: null,
    })
    expect(view.result.current.projectFolderId).toBe("from-the-loose-door")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 7 — D-24(b): THE ESM-CYCLE FENCE
// ══════════════════════════════════════════════════════════════════════════════════════

// The forbidden shape is stated ONCE per host and covers every import form deliberately: a
// static import, a re-export and `import type` all end in `from "<specifier>"`, and a
// type-only import back is forbidden too even though it is erased at build —
// `verbatimModuleSyntax` makes the value/type distinction easy to get wrong under a later
// edit, and a fence that permits the cheap mistake is not worth the line it costs. Dynamic
// `import()` is its own regex because it has no `from`.
//
// ⚠ THE TWO SUBJECT NAMES ARE ASSEMBLED FROM PARTS, this project's shipped idiom for a guard
// that must not satisfy itself: the module's own header records `grep -c <host>` → 0 as a
// checkable property, and a fence file spelling the host name whole would make a subtree-wide
// grep read a hit that is the GUARD rather than a violation.
const PAGE_HOST = ["Workflow", "BuilderPage"].join("")
const DOOR_HOST = ["Workflow", "DoorSwitch"].join("")
const importFrom = (host: string) => new RegExp(`from\\s+["'][^"']*${host}(\\.[jt]sx?)?["']`)
const dynamicImport = (host: string) =>
  new RegExp(`import\\s*\\(\\s*["'][^"']*${host}(\\.[jt]sx?)?["']\\s*\\)`)

const IMPORT_FROM_PAGE = importFrom(PAGE_HOST)
const DYNAMIC_IMPORT_PAGE = dynamicImport(PAGE_HOST)
const IMPORT_FROM_DOOR = importFrom(DOOR_HOST)
const DYNAMIC_IMPORT_DOOR = dynamicImport(DOOR_HOST)

describe("useTemplateFirstDraft D-24(b) — the extracted module cannot import either host back", () => {
  it("NON-VACUITY — the ?raw source really loaded, and it is the module it claims to be", () => {
    // FIRST, BEFORE ANY NEGATIVE. A `?raw` import of a moved or renamed module yields the
    // EMPTY STRING in some resolvers rather than throwing, and every negative below would
    // then pass while defending nothing — the exact defect `/gsd:secure-phase 192.1` found.
    expect(templateFirstDraftSource.length).toBeGreaterThan(500)
    expect(templateFirstDraftSource).toMatch(/export function useTemplateFirstDraft\(/)
    expect(templateFirstDraftSource).toMatch(/export interface TemplateFirstDraftArgs/)
    expect(templateFirstDraftSource).toMatch(/export interface TemplateFirstDraft /)
  })

  it("POSITIVE CONTROLS — every forbidden import form IS caught, in BOTH suffix spellings", () => {
    for (const [host, from, dyn] of [
      [PAGE_HOST, IMPORT_FROM_PAGE, DYNAMIC_IMPORT_PAGE],
      [DOOR_HOST, IMPORT_FROM_DOOR, DYNAMIC_IMPORT_DOOR],
    ] as const) {
      // bare · type-only · re-export · dynamic — the four forms.
      expect(`import { X } from "./${host}"`).toMatch(from)
      expect(`import type { X } from "@/pages/${host}"`).toMatch(from)
      expect(`export { X } from "./${host}"`).toMatch(from)
      expect(`const m = await import("@/components/workflows/${host}")`).toMatch(dyn)
      // …and each again with the suffix, legal under `allowImportingTsExtensions: true`. One
      // per form: an optional group is only proven by exercising the branch that takes it.
      expect(`import { X } from "./${host}.tsx"`).toMatch(from)
      expect(`import type { X } from "./${host}.tsx"`).toMatch(from)
      expect(`export { X } from "./${host}.tsx"`).toMatch(from)
      expect(`const m = await import("./${host}.tsx")`).toMatch(dyn)
    }
  })

  it("NEGATIVE CONTROLS — a `?raw` import of either host stays MISSING under both branches", () => {
    // `?raw` is how a SUITE legitimately reads a host's source, so the fence must not forbid
    // it; this proves the optional suffix group does not swallow the query string.
    for (const [host, from, dyn] of [
      [PAGE_HOST, IMPORT_FROM_PAGE, DYNAMIC_IMPORT_PAGE],
      [DOOR_HOST, IMPORT_FROM_DOOR, DYNAMIC_IMPORT_DOOR],
    ] as const) {
      for (const legal of [
        `import src from "./${host}?raw"`,
        `import src from "./${host}.tsx?raw"`,
      ]) {
        expect(legal).not.toMatch(from)
        expect(legal).not.toMatch(dyn)
      }
    }
    // …and an unrelated import is clean, so the matchers are not simply always-true.
    expect('import { useState } from "react"').not.toMatch(IMPORT_FROM_PAGE)
    expect('import { useState } from "react"').not.toMatch(IMPORT_FROM_DOOR)
  })

  it("THE REAL SOURCE names NEITHER host in ANY import form", () => {
    expect(templateFirstDraftSource).not.toMatch(IMPORT_FROM_PAGE)
    expect(templateFirstDraftSource).not.toMatch(DYNAMIC_IMPORT_PAGE)
    expect(templateFirstDraftSource).not.toMatch(IMPORT_FROM_DOOR)
    expect(templateFirstDraftSource).not.toMatch(DYNAMIC_IMPORT_DOOR)
  })

  it("…and names neither host AT ALL — the raw `grep -c` property the header records", () => {
    // STRONGER THAN THE REGEXES ABOVE, and cheap. The header block claims `grep -c <host>` is
    // 0 so the constraint stays checkable by the crudest possible tool; a claim in a docblock
    // that nothing asserts is exactly the class of thing this project has been bitten by.
    expect(templateFirstDraftSource).not.toContain(PAGE_HOST)
    expect(templateFirstDraftSource).not.toContain(DOOR_HOST)
    // POSITIVE CONTROL — `toContain` really would fire on a mention anywhere, prose included.
    expect(`// see ${PAGE_HOST}.tsx:478 for the shape`).toContain(PAGE_HOST)
  })

  it("the module reaches for NO page state — every host concern arrives as a callback", () => {
    // The other half of "the cut has one direction": no import back AND no reaching in. The
    // args interface is the whole surface, so a setter smuggled in would show up here.
    expect(templateFirstDraftSource).toMatch(/onDraftStarted: \(\) => void/)
    expect(templateFirstDraftSource).toMatch(/onDrafted: \(definition: TemplateFirstDefinition\) => void/)
    // POSITIVE CONTROL for the shape of what would be wrong.
    expect("  setDraftId: (id: string | null) => void").toMatch(/setDraftId/)
    expect(templateFirstDraftSource).not.toMatch(/setDraftId/)
    expect(templateFirstDraftSource).not.toMatch(/setSelectedSlug/)
    expect(templateFirstDraftSource).not.toMatch(/setShowReceipt/)
    expect(templateFirstDraftSource).not.toMatch(/setReceiptPhases/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 8 — 193.1-07 Task 1: THE PRE-DRAFT READ. Five arms, keyed on the held `File` OBJECT.
//
// ⚠ THE SUBJECT IS OBJECT IDENTITY, NOT `file.name`, and no shipped hook proves it — the
// analog (`useTemplatePlaceholders.ts:145-147`) keys on an `assetId` STRING, where identity
// and equality coincide. Two different documents can carry one name, so the same-name case
// below is the whole reason this section exists rather than being inherited.
// ══════════════════════════════════════════════════════════════════════════════════════

/** A read that never settles — the in-flight arm, held open for as long as a test needs. */
function pendingRead() {
  return new Promise<never>(() => {})
}

describe("useTemplateFirstDraft — the pre-draft read, all five arms", () => {
  it("NO FILE HELD ⇒ `idle`, and NEVER `loading` — D-08's entire mechanism", () => {
    const { view } = mountHook()
    expect(view.result.current.templateRead).toEqual({ kind: "idle" })
    expect(mockedRead).not.toHaveBeenCalled()
  })

  it("a file just picked, answer outstanding ⇒ `loading` — DERIVED, never stored", async () => {
    mockedRead.mockImplementation(() => pendingRead())
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    expect(view.result.current.templateRead).toEqual({ kind: "loading" })
    expect(mockedRead).toHaveBeenCalledTimes(1)
  })

  it("{read:'ok', placeholders:[…]} ⇒ `fields`, IN THE SERVER'S ORDER", async () => {
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name", "risks_blockers"] })
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() =>
      expect(view.result.current.templateRead).toEqual({
        kind: "fields",
        fields: ["project_name", "risks_blockers"],
      }),
    )
  })

  it("{read:'ok', placeholders:[]} ⇒ `none` — NON-EMPTY BY CONTRACT, never `fields` with []", async () => {
    mockedRead.mockResolvedValue({ read: "ok", placeholders: [] })
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead).toEqual({ kind: "none" }))
  })

  it("an EMPTY ok read on a .pptx is ALSO `none`, and the held name is what separates them", async () => {
    // ⚠ THIS CASE RECORDS A MEASURED CORRECTION TO THIS PLAN, stated rather than smoothed.
    // The plan's Task 1 asks for a SIXTH arm, `notWord`, derived in this module "so the row
    // stays purely presentational". Measured at HEAD, the row is NOT purely presentational
    // and cannot be made so by this plan: `DescribeTemplateRow.tsx:153` derives `notWord`
    // ITSELF from `state.kind === "none"` plus the filename, its `state` prop is typed on the
    // SHARED five-arm union imported from the rail's hook, and its own docblock requires
    // exactly that ("imported rather than re-declared: one wire shape for both doors means
    // the two surfaces cannot derive different arms from the same server answer").
    // `DescribeTemplateRow.tsx` is NOT in this plan's `files_modified`, and Plan 08 feeds it
    // `state` + `filename` straight from this hook — so a sixth arm here would be a value the
    // shipped component cannot accept. The union therefore stays FIVE, the derivation keeps
    // its single home in the row, and this hook supplies the row's other input instead.
    mockedRead.mockResolvedValue({ read: "ok", placeholders: [] })
    const { view } = mountHook()
    const deck = fileNamed("deck.pptx")
    await act(async () => {
      view.result.current.onPickTemplateFile(deck)
    })
    await waitFor(() => expect(view.result.current.templateRead).toEqual({ kind: "none" }))
    // The input the row's own predicate needs, exposed rather than duplicated here.
    expect(view.result.current.templateFile).toBe(deck)
    expect(view.result.current.templateFile?.name).toBe("deck.pptx")
  })

  it("{read:'unreadable'} ⇒ `unavailable{unreadable}` — a 200 that admits the read failed", async () => {
    mockedRead.mockResolvedValue({ read: "unreadable", placeholders: [] })
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("locked.docx"))
    })
    await waitFor(() =>
      expect(view.result.current.templateRead).toEqual({
        kind: "unavailable",
        reason: "unreadable",
      }),
    )
  })

  it("a REJECTED read ⇒ `unavailable{unreachable}` — no answer at all is its own fact", async () => {
    mockedRead.mockRejectedValue(new Error("boom"))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() =>
      expect(view.result.current.templateRead).toEqual({
        kind: "unavailable",
        reason: "unreachable",
      }),
    )
  })

  it("an AbortError is SILENT — neither arm, and the reading stays in flight", async () => {
    const aborted = new Error("aborted")
    aborted.name = "AbortError"
    mockedRead.mockRejectedValue(aborted)
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await act(async () => {})
    expect(view.result.current.templateRead).toEqual({ kind: "loading" })
  })

  it("POSITIVE CONTROL — a rejection that is NOT an abort really does reach the failed arm", async () => {
    // Without this, the silence above is satisfiable by a hook that swallows every rejection.
    const notAbort = new Error("aborted")
    notAbort.name = "TypeError"
    mockedRead.mockRejectedValue(notAbort)
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() =>
      expect(view.result.current.templateRead).toEqual({
        kind: "unavailable",
        reason: "unreachable",
      }),
    )
  })

  it("REPLACING the held file while A's answer is outstanding reads `loading`, never A's answer", async () => {
    const a = fileNamed("first.docx")
    const b = fileNamed("second.docx")
    let resolveA: (v: { read: "ok"; placeholders: string[] }) => void = () => {}
    mockedRead
      .mockImplementationOnce(() => new Promise((res) => (resolveA = res)))
      .mockImplementationOnce(() => pendingRead())

    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(a)
    })
    await act(async () => {
      view.result.current.onPickTemplateFile(b)
    })
    // A's answer arrives AFTER the replacement. It answered for a different subject.
    await act(async () => {
      resolveA({ read: "ok", placeholders: ["from_the_first_document"] })
    })
    expect(view.result.current.templateRead).toEqual({ kind: "loading" })
    expect(JSON.stringify(view.result.current.templateRead)).not.toContain(
      "from_the_first_document",
    )
  })

  it("TWO `File` OBJECTS WITH THE SAME NAME ARE DIFFERENT SUBJECTS — the identity rule", async () => {
    // The case no shipped hook proves. A name-keyed hook passes every test above and fails
    // this one: it would treat B as already answered and show A's fields under B's document.
    const a = fileNamed("status.docx")
    const b = fileNamed("status.docx")
    expect(a).not.toBe(b)
    expect(a.name).toBe(b.name)

    mockedRead
      .mockResolvedValueOnce({ read: "ok", placeholders: ["from_document_a"] })
      .mockImplementationOnce(() => pendingRead())

    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(a)
    })
    await waitFor(() =>
      expect(view.result.current.templateRead).toEqual({ kind: "fields", fields: ["from_document_a"] }),
    )

    await act(async () => {
      view.result.current.onPickTemplateFile(b)
    })
    // A SECOND request was issued, and A's answer does NOT satisfy B.
    expect(mockedRead).toHaveBeenCalledTimes(2)
    expect(view.result.current.templateRead).toEqual({ kind: "loading" })
  })

  it("CLEARING the held file returns the reading to `idle` and holds no stale answer", async () => {
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("fields"))
    await act(async () => {
      view.result.current.onClearTemplateFile()
    })
    expect(view.result.current.templateRead).toEqual({ kind: "idle" })
    expect(view.result.current.templateFile).toBeNull()
  })

  it("A SEEDED ANSWER resolves IMMEDIATELY and issues ZERO requests — the handoff mechanism", async () => {
    // This is what carries the fast door's already-completed read across to the Builder
    // (Plan 08). A re-read would return the reading to `loading` at the exact instant the
    // auto-draft one-shot fires, which is the blind-draft race D-07 exists to make impossible.
    const seeded = fileNamed("status.docx")
    const { view } = mountHook({
      initialTemplateFile: seeded,
      initialTemplateRead: {
        file: seeded,
        state: { kind: "fields", fields: ["project_name", "risks_blockers"] },
      },
    })
    expect(view.result.current.templateRead).toEqual({
      kind: "fields",
      fields: ["project_name", "risks_blockers"],
    })
    await act(async () => {})
    expect(mockedRead).not.toHaveBeenCalled()
  })

  it("a seed for a DIFFERENT file does not answer the held one — the subject rule survives seeding", async () => {
    mockedRead.mockImplementation(() => pendingRead())
    const held = fileNamed("status.docx")
    const other = fileNamed("status.docx")
    const { view } = mountHook({
      initialTemplateFile: held,
      initialTemplateRead: { file: other, state: { kind: "fields", fields: ["stale"] } },
    })
    await act(async () => {})
    expect(view.result.current.templateRead).toEqual({ kind: "loading" })
    expect(mockedRead).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 9 — 193.1-07 Task 1: D-07 / D-08, the CTA gate. ONE `&&` term, and it is unreachable
//     when no file is held — so there is no second conditional to get wrong.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — the D-07 gate", () => {
  it("is FALSE while the read is in flight, even with text — the blind draft is IMPOSSIBLE", async () => {
    mockedRead.mockImplementation(() => pendingRead())
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    expect(view.result.current.canDraft).toBe(true)
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    expect(view.result.current.templateRead.kind).toBe("loading")
    expect(view.result.current.canDraft).toBe(false)
  })

  it("RE-ENABLES the moment the read resolves — the gate is a wait, not a refusal", async () => {
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.canDraft).toBe(true))
  })

  it("D-08 — with NO file held the gate is UNREACHABLE, on every arm of the shipped rule", () => {
    const { view } = mountHook()
    expect(view.result.current.canDraft).toBe(false)
    act(() => view.result.current.setDescribe("a weekly status report"))
    expect(view.result.current.canDraft).toBe(true)
    // …and the reading that could disable it is not merely false, it is not the state at all.
    expect(view.result.current.templateRead.kind).toBe("idle")
  })

  it("SOURCE FENCE — the gate is ONE term against `loading`, never a 'has a template' test", () => {
    // D-08's whole claim is that the absence of a read IS the absence of a gate. A second
    // conditional — `templateFile !== null && …` — would be one that can be got wrong, and
    // it would read green against every behaviour above. So the SHAPE is asserted, not only
    // the outcome.
    const gate = templateFirstDraftSource.match(/const canDraft =[^\n]*(\n[^\n]*)?/)?.[0] ?? ""
    expect(gate).toContain("describe.trim().length > 0")
    expect(gate).toContain('builderPhase !== "composing"')
    expect(gate).toMatch(/!==\s*"loading"/)
    expect(gate).not.toMatch(/templateFile\s*(!==|===)/)
    // POSITIVE CONTROL — the forbidden shape really is caught by the matcher above.
    expect('const canDraft = templateFile !== null && x').toMatch(/templateFile\s*(!==|===)/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 10 — 193.1-07 Task 2: THE WIRE. `template_placeholders` on the real `/generate` call.
//
// ⚠ SORTED KEY-SET DEEP-EQUALITY, never `toMatchObject` — the 193.1-01 rule, inherited: the
// three loose matchers are all satisfied by a body carrying EXTRA keys, and both the arrival
// of this key AND its ABSENCE on the other four arms are the claims under test.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — the wire", () => {
  async function draftWithRead(
    answer: Awaited<ReturnType<typeof readTemplatePlaceholdersFromFile>>,
    filename = "status.docx",
  ) {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    mockedRead.mockResolvedValue(answer)
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed(filename))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).not.toBe("loading"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    return mockedGenerate.mock.calls[0][0]
  }

  it("a resolved `fields` read ⇒ the key set is EXACTLY ['describe','template_placeholders']", async () => {
    const body = await draftWithRead({ read: "ok", placeholders: ["project_name", "risks_blockers"] })
    expect(Object.keys(body).sort()).toEqual(["describe", "template_placeholders"])
    // …and the VALUES are the read's own names, in the server's order — not a re-derivation.
    expect(body.template_placeholders).toEqual(["project_name", "risks_blockers"])
  })

  it("sends NO key at all on `none` — `(none)` and `[]` are different facts to the prompt", async () => {
    const body = await draftWithRead({ read: "ok", placeholders: [] })
    expect(Object.keys(body).sort()).toEqual(["describe"])
  })

  it("sends NO key on `unavailable` — a failed read may never read as a field-less document", async () => {
    const body = await draftWithRead({ read: "unreadable", placeholders: [] })
    expect(Object.keys(body).sort()).toEqual(["describe"])
  })

  it("sends NO key when a NON-WORD document yields nothing", async () => {
    const body = await draftWithRead({ read: "ok", placeholders: [] }, "deck.pptx")
    expect(Object.keys(body).sort()).toEqual(["describe"])
  })

  it("carries the knowledge base AND the fields together — three keys, no interaction", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    const { view } = mountHook()
    act(() => {
      view.result.current.setDescribe("a weekly status report")
      view.result.current.setProjectFolderId("folder-1")
    })
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("fields"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(Object.keys(mockedGenerate.mock.calls[0][0]).sort()).toEqual([
      "describe",
      "project_folder_id",
      "template_placeholders",
    ])
  })

  it("the AUTO-DRAFT one-shot refuses to fire while the read is in flight (D-07, the fast path)", async () => {
    // The fast door's handoff auto-fires exactly once. Without this term the one-shot would
    // race the read it was just handed and send the blind body the phase exists to remove.
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    let resolveRead: (v: { read: "ok"; placeholders: string[] }) => void = () => {}
    mockedRead.mockImplementation(() => new Promise((res) => (resolveRead = res)))
    const held = fileNamed("status.docx")
    const { view } = mountHook({
      autoDraft: true,
      initialDescribe: "seeded from the fast door",
      initialTemplateFile: held,
    })
    await act(async () => {})
    expect(mockedGenerate).not.toHaveBeenCalled()

    await act(async () => {
      resolveRead({ read: "ok", placeholders: ["project_name"] })
    })
    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1))
    expect(Object.keys(mockedGenerate.mock.calls[0][0]).sort()).toEqual([
      "describe",
      "template_placeholders",
    ])
    // …and STILL exactly once, which is the one-shot's own contract.
    await act(async () => {})
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 11 — 193.1-07 Task 2: THE BIND. D-06, and the two rules that make it safe.
//
// ⚠ RULE 1 — a throwing bind can NEVER produce a save-error state and can NEVER trip
//    `haltedRef`. The bind is called from INSIDE the write's `try` (`:645`), so this is not
//    natural in the current code: it is bought by the bind being an `async` function that
//    catches everything internally, `void`-ed at the call site.
// ⚠ RULE 2 — the failure has its OWN honest line, never the save's.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — D-06's bind", () => {
  it("uploads the held file EXACTLY ONCE and hands the descriptor to the page's writer", async () => {
    const held = fileNamed("status.docx")
    mockedUpload.mockResolvedValue(descriptorFor("status.docx"))
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    const { view, bound } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUpload).toHaveBeenCalledTimes(1)
    expect(mockedUpload.mock.calls[0][0]).toBe("draft-1")
    expect(mockedUpload.mock.calls[0][1]).toBe(held)
    expect(bound).toEqual([descriptorFor("status.docx")])
    expect(view.result.current.bindFailed).toBeNull()
  })

  it("does NOTHING and reports NOTHING when no file is held — SC#4 stays true by construction", async () => {
    const { view, bound } = mountHook()
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUpload).not.toHaveBeenCalled()
    expect(bound).toEqual([])
    expect(view.result.current.bindFailed).toBeNull()
  })

  it("NEVER REJECTS — a synchronously-throwing upload resolves, which is what makes `void` safe", async () => {
    const held = fileNamed("status.docx")
    mockedUpload.mockImplementation(() => {
      throw new Error("synchronous boom")
    })
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    // The claim is the RETURNED PROMISE, not merely the state: a `void`-ed call that rejects
    // is an unhandled rejection, and the page has nowhere to catch it.
    let settled: "resolved" | "rejected" = "rejected"
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1").then(
        () => (settled = "resolved"),
        () => (settled = "rejected"),
      )
    })
    expect(settled).toBe("resolved")
    expect(view.result.current.bindFailed).toEqual({ filename: "status.docx" })
  })

  it("NEVER REJECTS on an ASYNC rejection either, and names the file in its own state", async () => {
    const held = fileNamed("status.docx")
    mockedUpload.mockRejectedValue(new Error("502 from storage"))
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    const { view, bound } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    let settled: "resolved" | "rejected" = "rejected"
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1").then(
        () => (settled = "resolved"),
        () => (settled = "rejected"),
      )
    })
    expect(settled).toBe("resolved")
    expect(view.result.current.bindFailed).toEqual({ filename: "status.docx" })
    // The page's single writer is NEVER reached on a failure — no half-attached descriptor.
    expect(bound).toEqual([])
  })

  it("THE FAILURE STATE CANNOT CARRY SERVER PROSE, A STATUS CODE OR AN ID", async () => {
    // The `useWorkflowFork.ts:205` posture. The shape is the disclosure guard, not a habit of
    // being careful at the call site — so the assertion is over what the state CAN hold.
    const held = fileNamed("status.docx")
    mockedUpload.mockRejectedValue(
      Object.assign(new Error("row 41 of table secrets is not permitted for user 9e3f"), {
        status: 403,
        detail: "row 41 of table secrets is not permitted for user 9e3f",
      }),
    )
    mockedRead.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    const failed = view.result.current.bindFailed
    expect(Object.keys(failed ?? {})).toEqual(["filename"])
    expect(JSON.stringify(failed)).not.toContain("secrets")
    expect(JSON.stringify(failed)).not.toContain("403")
    expect(JSON.stringify(failed)).not.toContain("9e3f")
  })
})
