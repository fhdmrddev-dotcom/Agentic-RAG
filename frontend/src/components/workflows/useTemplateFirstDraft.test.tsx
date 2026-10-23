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

import {
  useReferenceReads,
  useTemplateFirstDraft,
  useTemplateRead,
  type TemplateFirstDefinition,
} from "./useTemplateFirstDraft"
// The hook SOURCE via Vite's `?raw` loader — the shipped house idiom for a machine-checkable
// scope fence (`canvasModel.purity.test.ts:14-17`, `DoorHeaderStrip.test.tsx:250-256`).
import templateFirstDraftSource from "./useTemplateFirstDraft?raw"
import { createBuilderStore, type BuilderPhase, type BuilderStore } from "./builderStore"
import { REQUEST_FAILED_KEY, refusalKey } from "./describeRefusalVocabulary"
// 281-REVIEW WR-03 — the typed entitlement signal and its client-only key.
import { ENTITLEMENT_REFUSED_KEY } from "./describeRefusalVocabulary"
// 291-06 (CR-02) — the client-only key for a form the drafter cannot be sent.
import { FORM_NOT_SENDABLE_KEY, describeRefusal } from "./describeRefusalVocabulary"
import { EntitlementRefusalError } from "@/lib/api/_core"
import {
  generateWorkflow,
  readDescribeFile,
  uploadWorkflowReference,
  uploadWorkflowTemplate,
  WorkflowTemplateUploadError,
  type DescribeField,
  type DescribeReadResult,
  type GenerateReadiness,
  type GenerateResult,
  type ReferenceAssetDescriptor,
  type WorkflowTemplateAsset,
} from "@/lib/api"
// 291-04 — the REAL client functions, reached by their domain path (which this file does not
// mock), so the request shape itself can be asserted against a stubbed `fetch`.
import {
  readDescribeFile as realReadDescribeFile,
  uploadWorkflowTemplate as realUploadWorkflowTemplate,
  uploadWorkflowReference as realUploadWorkflowReference,
} from "@/lib/api/workflows"

// The real client reads the session token; keep it off a real Supabase client.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    generateWorkflow: vi.fn(),
    // 291-04: the describe door's read and its two binds. The READ is the pre-draft state
    // machine's only network call; the UPLOADS are D-06 / D-07's bind. All are mocked here
    // rather than at a `fetch` level so a test can drive a REJECTION, an ABORT and a slow
    // answer separately.
    readDescribeFile: vi.fn(),
    uploadWorkflowTemplate: vi.fn(),
    uploadWorkflowReference: vi.fn(),
  }
})

const mockedGenerate = vi.mocked(generateWorkflow)
const mockedRead = vi.mocked(readDescribeFile)
const mockedUpload = vi.mocked(uploadWorkflowTemplate)
const mockedUploadRef = vi.mocked(uploadWorkflowReference)

/** One field the read door returns, with every optional member at its absent value. */
function fieldOf(key: string, over: Partial<DescribeField> = {}): DescribeField {
  return {
    key,
    label: key,
    type: "text",
    enum_options: [],
    origin: "exact",
    line_before: null,
    line_after: null,
    anchor_kind: null,
    anchor_label: null,
    ...over,
  }
}

/** A read answer in the shape `POST /workflows/describe/read` returns. */
function readOf(over: Partial<DescribeReadResult> = {}): DescribeReadResult {
  return {
    role: "form",
    arm: "template_fields",
    suggested_from: null,
    filename: "status.docx",
    fields: [],
    unplaced: [],
    text: "",
    cut_short: null,
    refused: null,
    ...over,
  }
}

/** Today's `.docx` template answer: `{{ }}` tokens, read exactly. */
function templateFieldsOf(keys: string[], filename = "status.docx"): DescribeReadResult {
  return readOf({ arm: "template_fields", filename, fields: keys.map((k) => fieldOf(k)), text: "body" })
}

/** A reference read: the file's text, nothing else. */
function referenceOf(filename: string, text = `text of ${filename}`): DescribeReadResult {
  return readOf({ role: "reference", arm: "reference", filename, text })
}

/** The read door's refusal: a 422 carrying a server sentence. */
function refusal(sentence = "The document could not be read.") {
  return new WorkflowTemplateUploadError(422, sentence)
}

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
  // 197-06 (D-13): `drafted` records the VALUE of argument one and is structurally blind to
  // argument two — including to whether argument two was passed AT ALL. A `vi.fn` is added
  // BESIDE it (never instead of it, so the shipped cases keep their spelling) because
  // `mock.calls[i]` is the REAL arguments array: it is the only instrument in this file that
  // can tell a one-argument call from a two-argument one carrying `undefined`, which is
  // precisely the distinction D-13 turns on.
  const onDraftedSpy = vi.fn(
    (
      def: TemplateFirstDefinition,
      _readiness: GenerateReadiness | undefined,
      _extras: { removed?: unknown; fields?: unknown },
    ) => {
      drafted.push(def)
    },
  )
  // 193.1-07 (D-06): the descriptors the bind handed back. On the real page this callback IS
  // the shipped `onTemplateAttached`, so recording it here records exactly what reaches the
  // store's single writer.
  const bound: WorkflowTemplateAsset[] = []
  // 291-04 (D-07): the reference descriptors the bind handed back, one batch per bind.
  const referencesBound: ReferenceAssetDescriptor[][] = []
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
        onDrafted: onDraftedSpy,
        onTemplateBound: (asset) => bound.push(asset),
        onReferencesBound: (assets) => referencesBound.push(assets),
        ...args,
      }),
    { initialProps },
  )
  return { view, store, started, drafted, bound, referencesBound, onDraftedSpy }
}

beforeEach(() => {
  mockedGenerate.mockReset()
  mockedRead.mockReset()
  mockedUpload.mockReset()
  mockedUploadRef.mockReset()
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
// 3b — 197-06 (D-13): THE SERVER'S READINESS VERDICT SURVIVES THE HOOK BOUNDARY
//
// ⚠ THIS IS THE ONLY HOP IN D-13's FIVE-HOP CHAIN THAT COULD DROP THE VERDICT. The route
// passes the dict through untouched, the client casts the body, the page state is two lines
// — everything not carried past `onDraftedRef.current(…)` is lost, silently and with a green
// typecheck on both sides of it. So the cases below assert the ARITY and the IDENTITY of the
// second argument, not merely that a draft arrived.
//
// ⚠ AND THE LOAD-BEARING CASE IS THE ABSENT ONE. A response with no `readiness` key must
// hand out `undefined` — never `{}`, never a synthesised passing status. That is the
// difference between "the server said nothing" and "the server said it is fine", and it is
// the whole reason the type has three representable states instead of two.
// ══════════════════════════════════════════════════════════════════════════════════════

/** A verdict in the shape the widened route answers with, GREEN arm. */
function readinessPresent(): GenerateReadiness {
  return { business_requirement: { status: "present" } }
}

/** …and the MISSING arm, carrying the gate's own sentence verbatim (D-12). */
function readinessMissing(message: string): GenerateReadiness {
  return { business_requirement: { status: "missing", message } }
}

describe("useTemplateFirstDraft — the readiness verdict at the hook's output boundary", () => {
  it("raises `onDrafted` with THREE arguments — the arity is the contract, not a convenience (291-04 added the extras)", async () => {
    mockedGenerate.mockResolvedValue({
      ok: true,
      definition: definitionOf(),
      readiness: readinessPresent(),
    } as GenerateResult)
    const { view, onDraftedSpy } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(onDraftedSpy).toHaveBeenCalledTimes(1)
    // ⚠ THE RECORDED ARGUMENTS ARRAY, not the callback's declared parameter list. A one-
    // argument call would still typecheck at every site and would read as `undefined` at
    // the consumer — indistinguishable from an honestly-absent verdict.
    // 291-04: the third argument (the generate result's extras) joined it, so the arity is 3.
    expect(onDraftedSpy.mock.calls[0]).toHaveLength(3)
  })

  it("hands out the EXACT object the response carried — the client invents nothing", async () => {
    const verdict = readinessMissing("This workflow has no business requirement.")
    mockedGenerate.mockResolvedValue({
      ok: true,
      definition: definitionOf(),
      readiness: verdict,
    } as GenerateResult)
    const { view, onDraftedSpy } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    // IDENTITY, not deep equality: `toBe` proves nothing was rebuilt, re-keyed or normalised
    // on the way through. A copy would pass `toEqual` while having been through a hand that
    // could have changed it.
    expect(onDraftedSpy.mock.calls[0][1]).toBe(verdict)
    // …and the value itself reached the consumer intact, arm and sentence.
    expect(onDraftedSpy.mock.calls[0][1]?.business_requirement).toEqual({
      status: "missing",
      message: "This workflow has no business requirement.",
    })
  })

  it("carries the GREEN arm through unchanged too — `present` is a verdict, not an absence", async () => {
    mockedGenerate.mockResolvedValue({
      ok: true,
      definition: definitionOf(),
      readiness: readinessPresent(),
    } as GenerateResult)
    const { view, onDraftedSpy } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(onDraftedSpy.mock.calls[0][1]?.business_requirement.status).toBe("present")
  })

  it("⚠ THE ABSENT-FIELD RULE — a response with NO `readiness` key hands out `undefined`, never `{}` and never a synthesised pass", async () => {
    // The shipped response shape, byte for byte: `{ok, definition}` and nothing else. This is
    // what EVERY generation answers with until the server half lands, and what a stale deploy
    // answers with forever after.
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const { view, onDraftedSpy } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    const handed = onDraftedSpy.mock.calls[0][1]
    expect(handed).toBeUndefined()
    // ⚠ THE THREE THINGS IT MUST NOT BE, spelled out rather than implied by the line above —
    // each is a real defaulting mistake this hop could make and each reads as a pass at the
    // consumer. `{}` is the `?? {}` default; the third is the synthesised green.
    expect(handed).not.toEqual({})
    expect(handed).not.toEqual(readinessPresent())
    // …and the arity is STILL the full list (three since 291-04), so "absent" is a value that
    // travelled rather than an argument that was never passed. The two are indistinguishable at
    // the consumer and only this assertion separates them at the producer.
    expect(onDraftedSpy.mock.calls[0]).toHaveLength(3)
  })

  it("POSITIVE CONTROL — the absent-field assertion really would fire on a synthesised pass", () => {
    // Non-vacuity for the case above: if this hop DID default the verdict, `toBeUndefined`
    // would red. Proved here against a concrete stand-in rather than trusted.
    const defaulted: GenerateReadiness | undefined = readinessPresent()
    expect(() => expect(defaulted).toBeUndefined()).toThrow()
    expect(() => expect({} as unknown).not.toEqual({})).toThrow()
  })

  it("raises NOTHING on an `ok:false` response, so no verdict can be read off a failure", async () => {
    // The failure arm carries no `readiness` member on the type at all (T-197-07). This is the
    // RUNTIME half of that fence: the callback is not reached, so there is no argument to read.
    // Phase 281 (D-11/D-12, SEED-221): the refusal now renders through describeRefusalVocabulary;
    // re-captured on purpose — the mock is a REAL server code rather than free text.
    mockedGenerate.mockResolvedValue({
      ok: false,
      error: "could_not_generate",
    } as GenerateResult)
    const { view, onDraftedSpy } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(onDraftedSpy).not.toHaveBeenCalled()
    expect(onDraftedSpy.mock.calls).toHaveLength(0)
  })

  it("the AUTO-DRAFT path carries the verdict too — one funnel, not two", async () => {
    // `autoDraft` funnels through the SAME single transition (D-187-14), so a verdict that
    // survived the manual path but not this one would be a silent asymmetry between the two
    // authoring entrances. Asserted rather than assumed.
    const verdict = readinessMissing("This workflow has no business requirement.")
    mockedGenerate.mockResolvedValue({
      ok: true,
      definition: definitionOf(),
      readiness: verdict,
    } as GenerateResult)
    const { onDraftedSpy } = mountHook({
      autoDraft: true,
      initialDescribe: "a weekly status report",
    })
    await waitFor(() => expect(onDraftedSpy).toHaveBeenCalledTimes(1))
    expect(onDraftedSpy.mock.calls[0][1]).toBe(verdict)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 4 — the FAILURE paths: honest, and they raise NOTHING
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — an honest failure", () => {
  it("on {ok:false} sets the store's error state and raises `onDrafted` ZERO times", async () => {
    // Phase 281 (D-11/D-12, SEED-221): the refusal now renders through describeRefusalVocabulary;
    // re-captured on purpose. The mock was free text standing in for a code; it is now a REAL
    // server code, and the store holds the table KEY that `refusalKey` builds from it.
    mockedGenerate.mockResolvedValue({
      ok: false,
      error: "could_not_generate",
      detail: "a detail line",
    } as GenerateResult)
    const { view, store, drafted } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted).toHaveLength(0)
    expect(store.getState().builderPhase).toBe("error")
    expect(store.getState().errorMessage).toBe(refusalKey("could_not_generate"))
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
    // Phase 281 (D-11/D-12, SEED-221): the refusal now renders through describeRefusalVocabulary;
    // re-captured on purpose — the catch arm stores the client-only REQUEST_FAILED_KEY.
    expect(store.getState().errorMessage).toBe(REQUEST_FAILED_KEY)
    expect(store.getState().errorDetail).toBe("Failed to generate workflow (status 502)")
  })

  it("281 (D-13): an {ok:false} with a reason_code stores the code JOINED to its sub-reason", async () => {
    mockedGenerate.mockResolvedValue({
      ok: false,
      error: "connection_not_allowed",
      reason_code: "no_service_chosen",
      detail: "phase 'tell-the-team' acts outside the app",
    } as GenerateResult)
    const { view, store, drafted } = mountHook()
    act(() => view.result.current.setDescribe("tell the team every Monday"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(drafted).toHaveLength(0)
    expect(store.getState().errorMessage).toBe(refusalKey("connection_not_allowed", "no_service_chosen"))
    expect(store.getState().errorDetail).toBe("phase 'tell-the-team' acts outside the app")
  })

  it("281 (D-24): a THROWN server sentence is kept whole as the detail of REQUEST_FAILED_KEY", async () => {
    mockedGenerate.mockRejectedValue(new Error("Your plan doesn't include workflows."))
    const { view, store } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(store.getState().errorMessage).toBe(REQUEST_FAILED_KEY)
    expect(store.getState().errorDetail).toBe("Your plan doesn't include workflows.")
  })

  it("281-REVIEW WR-03: a TYPED entitlement refusal is stored under ENTITLEMENT_REFUSED_KEY", async () => {
    mockedGenerate.mockRejectedValue(new EntitlementRefusalError("Your plan doesn't include workflows."))
    const { view, store } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(store.getState().errorMessage).toBe(ENTITLEMENT_REFUSED_KEY)
    expect(store.getState().errorDetail).toBe("Your plan doesn't include workflows.")
  })

  it("281-REVIEW WR-03: a network TypeError stays on REQUEST_FAILED_KEY (never trusted as words)", async () => {
    mockedGenerate.mockRejectedValue(new TypeError("Failed to fetch"))
    const { view, store } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(store.getState().errorMessage).toBe(REQUEST_FAILED_KEY)
    expect(store.getState().errorDetail).toBe("Failed to fetch")
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
        // 193.1-07: REQUIRED, so the typechecker enumerated this second call site rather
        // than a default hiding it — which is exactly why it is required.
        onTemplateBound: () => {},
        // 291-04: REQUIRED for the same reason, so this site was enumerated too.
        onReferencesBound: () => {},
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
    // 197-06 (D-13): the declaration WIDENED to two parameters and became multi-line, so this
    // fence is re-spelled over the new shape rather than dropped. ⚠ IT STILL PINS BOTH ENDS —
    // the definition parameter AND the readiness parameter — because the property it defends is
    // "the whole surface is this args interface", and a fence loosened to `/onDrafted:/` would
    // pass against a callback that had quietly grown a store setter.
    // 291-04: widened once more, to the result's extras — re-spelled again, pinning all THREE.
    expect(templateFirstDraftSource).toMatch(
      /onDrafted: \(\s*definition: TemplateFirstDefinition,\s*readiness: GenerateReadiness \| undefined,\s*extras: DraftedExtras,\s*\) => void/,
    )
    // POSITIVE CONTROL — the re-spelled matcher DISCRIMINATES. Against the shipped
    // single-parameter spelling it must NOT match, or "the verdict crosses this boundary"
    // would be a claim this fence passes without checking. A matcher that matches everything
    // it is pointed at reads exactly like a fence that holds (this suite's own header rule).
    expect("  onDrafted: (definition: TemplateFirstDefinition) => void").not.toMatch(
      /onDrafted: \(\s*definition: TemplateFirstDefinition,\s*readiness: GenerateReadiness \| undefined,\s*extras: DraftedExtras,\s*\) => void/,
    )
    expect(
      ["  onDrafted: (", "definition: TemplateFirstDefinition,", "readiness: GenerateReadiness | undefined,", ") => void"].join(" "),
    ).not.toMatch(
      /onDrafted: \(\s*definition: TemplateFirstDefinition,\s*readiness: GenerateReadiness \| undefined,\s*extras: DraftedExtras,\s*\) => void/,
    )
    // POSITIVE CONTROL for the shape of what would be wrong.
    expect("  setDraftId: (id: string | null) => void").toMatch(/setDraftId/)
    expect(templateFirstDraftSource).not.toMatch(/setDraftId/)
    expect(templateFirstDraftSource).not.toMatch(/setSelectedSlug/)
    expect(templateFirstDraftSource).not.toMatch(/setShowReceipt/)
    expect(templateFirstDraftSource).not.toMatch(/setReceiptPhases/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 8 — 193.1-07 Task 1: THE PRE-DRAFT READ. Keyed on the held `File` OBJECT.
//
// ⚠ THE SUBJECT IS OBJECT IDENTITY, NOT `file.name`, and no shipped hook proves it — the
// analog (`useTemplatePlaceholders.ts:145-147`) keys on an `assetId` STRING, where identity
// and equality coincide. Two different documents can carry one name, so the same-name case
// below is the whole reason this section exists rather than being inherited.
//
// 291-04 RE-POINTED every case here from the shipped `{{ }}`-only read to the describe door's
// read (`readDescribeFile`). The reading is now ONE of four kinds — idle · loading · read (the
// server's whole answer, arm included) · unavailable — and the server's ARM replaces the old
// `fields` / `none` split. No case was deleted; each keeps its claim against the new shape.
// ══════════════════════════════════════════════════════════════════════════════════════

/** A read that never settles — the in-flight arm, held open for as long as a test needs. */
function pendingRead() {
  return new Promise<never>(() => {})
}

describe("useTemplateFirstDraft — the pre-draft read, every reading", () => {
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
    // …and the slot reads in the FORM role — never as a reference.
    expect(mockedRead.mock.calls[0][1]).toBe("form")
  })

  it("a template answer ⇒ `read`, carrying the server's fields IN THE SERVER'S ORDER", async () => {
    const answer = templateFieldsOf(["project_name", "risks_blockers"])
    mockedRead.mockResolvedValue(answer)
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead).toEqual({ kind: "read", result: answer }))
    const state = view.result.current.templateRead
    expect(state.kind === "read" ? state.result.fields.map((f) => f.key) : []).toEqual([
      "project_name",
      "risks_blockers",
    ])
  })

  it("an answer with NO fields keeps the server's arm (`none`) — never a field list with []", async () => {
    mockedRead.mockResolvedValue(readOf({ arm: "none", fields: [] }))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
    const state = view.result.current.templateRead
    expect(state.kind === "read" && state.result.arm).toBe("none")
  })

  it("a deck answers `not_word` FROM THE SERVER, and the held name is still exposed beside it", async () => {
    // ⚠ 193.1-07 recorded that the row derived `notWord` itself, from an empty read plus the
    // name. Since 291-01 the SERVER names the arm, so the derivation has one home: the answer.
    mockedRead.mockResolvedValue(readOf({ arm: "not_word", filename: "deck.pptx" }))
    const { view } = mountHook()
    const deck = fileNamed("deck.pptx")
    await act(async () => {
      view.result.current.onPickTemplateFile(deck)
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
    const state = view.result.current.templateRead
    expect(state.kind === "read" && state.result.arm).toBe("not_word")
    expect(view.result.current.templateFile).toBe(deck)
    expect(view.result.current.templateFile?.name).toBe("deck.pptx")
  })

  it("a 422 ⇒ `unavailable{unreadable}` CARRYING THE SERVER'S SENTENCE — the read door refused it", async () => {
    mockedRead.mockRejectedValue(refusal("The document could not be read."))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("locked.docx"))
    })
    await waitFor(() =>
      expect(view.result.current.templateRead).toEqual({
        kind: "unavailable",
        reason: "unreadable",
        detail: "The document could not be read.",
      }),
    )
  })

  it("a REJECTED read ⇒ `unavailable{unreachable}` with NO detail — no answer at all is its own fact", async () => {
    mockedRead.mockRejectedValue(new Error("boom"))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() =>
      expect(view.result.current.templateRead).toEqual({
        kind: "unavailable",
        reason: "unreachable",
        detail: null,
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
        detail: null,
      }),
    )
  })

  it("REPLACING the held file while A's answer is outstanding reads `loading`, never A's answer", async () => {
    const a = fileNamed("first.docx")
    const b = fileNamed("second.docx")
    let resolveA: (v: DescribeReadResult) => void = () => {}
    mockedRead
      .mockImplementationOnce(() => new Promise((res) => (resolveA = res)))
      .mockImplementationOnce(() => pendingRead())

    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(a)
    })
    // The replaced request is ABORTED, not merely ignored.
    const firstSignal = mockedRead.mock.calls[0][2] as AbortSignal
    await act(async () => {
      view.result.current.onPickTemplateFile(b)
    })
    expect(firstSignal.aborted).toBe(true)
    // A's answer arrives AFTER the replacement. It answered for a different subject.
    await act(async () => {
      resolveA(templateFieldsOf(["from_the_first_document"]))
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

    const answerA = templateFieldsOf(["from_document_a"])
    mockedRead.mockResolvedValueOnce(answerA).mockImplementationOnce(() => pendingRead())

    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(a)
    })
    await waitFor(() => expect(view.result.current.templateRead).toEqual({ kind: "read", result: answerA }))

    await act(async () => {
      view.result.current.onPickTemplateFile(b)
    })
    // A SECOND request was issued, and A's answer does NOT satisfy B.
    expect(mockedRead).toHaveBeenCalledTimes(2)
    expect(view.result.current.templateRead).toEqual({ kind: "loading" })
  })

  it("CLEARING the held file returns the reading to `idle` and holds no stale answer", async () => {
    mockedRead.mockResolvedValue(templateFieldsOf(["project_name"]))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
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
    const answer = templateFieldsOf(["project_name", "risks_blockers"])
    const { view } = mountHook({
      initialTemplateFile: seeded,
      initialTemplateRead: { file: seeded, state: { kind: "read", result: answer }, unticked: [] },
    })
    expect(view.result.current.templateRead).toEqual({ kind: "read", result: answer })
    await act(async () => {})
    expect(mockedRead).not.toHaveBeenCalled()
  })

  it("a seed for a DIFFERENT file does not answer the held one — the subject rule survives seeding", async () => {
    mockedRead.mockImplementation(() => pendingRead())
    const held = fileNamed("status.docx")
    const other = fileNamed("status.docx")
    const { view } = mountHook({
      initialTemplateFile: held,
      initialTemplateRead: {
        file: other,
        state: { kind: "read", result: templateFieldsOf(["stale"]) },
        unticked: [],
      },
    })
    await act(async () => {})
    expect(view.result.current.templateRead).toEqual({ kind: "loading" })
    expect(mockedRead).toHaveBeenCalledTimes(1)
  })

  it("READ_IDLE / READ_LOADING are MODULE-FROZEN — the same object on every render", async () => {
    // `onDraft` depends on the reading and the one-shot depends on `onDraft`; a fresh
    // waiting object per render would re-create the callback and re-run that effect.
    mockedRead.mockImplementation(() => pendingRead())
    const { view } = mountHook()
    const idleA = view.result.current.templateRead
    act(() => view.result.current.setDescribe("x"))
    expect(view.result.current.templateRead).toBe(idleA)
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    const loadingA = view.result.current.templateRead
    act(() => view.result.current.setDescribe("xy"))
    expect(view.result.current.templateRead).toBe(loadingA)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 8b — 291-04: the LEAF itself, `useTemplateRead(file, role)`, driven directly
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateRead — the per-file read leaf (291-04)", () => {
  it("loading, then `read` with the whole server answer, for a 200", async () => {
    const answer = readOf({ arm: "form_fields", filename: "w9.pdf", fields: [fieldOf("name")] })
    let resolve: (v: DescribeReadResult) => void = () => {}
    mockedRead.mockImplementation(() => new Promise((res) => (resolve = res)))
    const file = fileNamed("w9.pdf")
    const view = renderHook(() => useTemplateRead(file, "form"))
    expect(view.result.current.state).toEqual({ kind: "loading" })
    await act(async () => resolve(answer))
    expect(view.result.current.state).toEqual({ kind: "read", result: answer })
    expect(mockedRead.mock.calls[0][0]).toBe(file)
    expect(mockedRead.mock.calls[0][1]).toBe("form")
  })

  it("a 422 ⇒ unavailable/unreadable with the server sentence; a network failure ⇒ unreachable, null", async () => {
    mockedRead.mockRejectedValueOnce(refusal("That file is not a PDF."))
    const bad = fileNamed("bad.pdf")
    const a = renderHook(() => useTemplateRead(bad, "form"))
    await waitFor(() =>
      expect(a.result.current.state).toEqual({
        kind: "unavailable",
        reason: "unreadable",
        detail: "That file is not a PDF.",
      }),
    )
    mockedRead.mockRejectedValueOnce(new WorkflowTemplateUploadError("network", null))
    const ok = fileNamed("ok.pdf")
    const b = renderHook(() => useTemplateRead(ok, "form"))
    await waitFor(() =>
      expect(b.result.current.state).toEqual({ kind: "unavailable", reason: "unreachable", detail: null }),
    )
  })

  it("the role is FORWARDED — a reference read asks the door as a reference", async () => {
    mockedRead.mockResolvedValue(referenceOf("terms.md"))
    const terms = fileNamed("terms.md")
    renderHook(() => useTemplateRead(terms, "reference"))
    await waitFor(() => expect(mockedRead).toHaveBeenCalledTimes(1))
    expect(mockedRead.mock.calls[0][1]).toBe("reference")
  })

  it("replacing the file ABORTS the old request", async () => {
    mockedRead.mockImplementation(() => pendingRead())
    const first = fileNamed("a.pdf")
    const view = renderHook((props: { file: File }) => useTemplateRead(props.file, "form"), {
      initialProps: { file: first },
    })
    const signal = mockedRead.mock.calls[0][2] as AbortSignal
    expect(signal.aborted).toBe(false)
    view.rerender({ file: fileNamed("b.pdf") })
    expect(signal.aborted).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 8c — 291-04 (D-27): the Word blanks' ticks. Unticking never removes the question.
// ══════════════════════════════════════════════════════════════════════════════════════

function blanksOf(): DescribeReadResult {
  return readOf({
    arm: "blanks",
    filename: "supplier.docx",
    fields: [
      fieldOf("supplier_name", {
        label: "Supplier name",
        origin: "ai_proposed",
        line_before: "Supplier name: ",
        line_after: "",
        anchor_kind: "line",
        anchor_label: "Supplier name",
      }),
      fieldOf("vat_number", {
        label: "VAT number",
        origin: "ai_proposed",
        line_before: "VAT number: ",
        line_after: "",
        anchor_kind: "line",
        anchor_label: "VAT number",
      }),
      fieldOf("country", {
        label: "Country",
        origin: "ai_proposed",
        anchor_kind: "cell",
        anchor_label: "Country",
      }),
    ],
    unplaced: [{ label: "Signature", sentence: "Couldn't place “Signature”: that label appears twice in the document. It stays blank in the filled copy." }],
    text: "Supplier name: ___ VAT number: ___",
  })
}

describe("useTemplateFirstDraft — the blanks' ticks (D-27)", () => {
  async function mountWithBlanks() {
    mockedRead.mockResolvedValue(blanksOf())
    const mounted = mountHook()
    await act(async () => {
      mounted.view.result.current.onPickTemplateFile(fileNamed("supplier.docx"))
    })
    await waitFor(() => expect(mounted.view.result.current.templateRead.kind).toBe("read"))
    return mounted
  }

  it("every placed blank starts TICKED — nothing is unticked until the author says so", async () => {
    const { view } = await mountWithBlanks()
    expect(view.result.current.untickedKeys).toEqual([])
  })

  it("toggling a blank unticks it, toggling again re-ticks it — and the reading is untouched", async () => {
    const { view } = await mountWithBlanks()
    const before = view.result.current.templateRead
    act(() => view.result.current.onToggleBlank("vat_number"))
    expect(view.result.current.untickedKeys).toEqual(["vat_number"])
    // The question is still in the reading the row renders from.
    expect(view.result.current.templateRead).toBe(before)
    act(() => view.result.current.onToggleBlank("vat_number"))
    expect(view.result.current.untickedKeys).toEqual([])
  })

  it("a NEW file starts with every blank ticked again — ticks belong to the file they were made on", async () => {
    const { view } = await mountWithBlanks()
    act(() => view.result.current.onToggleBlank("vat_number"))
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("supplier.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
    expect(view.result.current.untickedKeys).toEqual([])
  })

  it("the generate body carries ONLY the ticked placed fields, and the unticked one is gone from it", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const { view } = await mountWithBlanks()
    act(() => {
      view.result.current.setDescribe("vet a supplier")
      view.result.current.onToggleBlank("vat_number")
    })
    await act(async () => {
      await view.result.current.onDraft()
    })
    const body = mockedGenerate.mock.calls[0][0]
    expect(body.form?.arm).toBe("blanks")
    expect(body.form?.fields.map((f) => f.key)).toEqual(["supplier_name", "country"])
    expect(body).not.toHaveProperty("template_placeholders")
  })

  it("the bind sends the ticked anchors ONLY, as the template door's anchors part", async () => {
    mockedUpload.mockResolvedValue(descriptorFor("supplier.docx"))
    const { view, bound } = await mountWithBlanks()
    act(() => view.result.current.onToggleBlank("supplier_name"))
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUpload).toHaveBeenCalledTimes(1)
    expect(mockedUpload.mock.calls[0][2]).toEqual([
      { key: "vat_number", anchor_kind: "line", anchor_label: "VAT number" },
      { key: "country", anchor_kind: "cell", anchor_label: "Country" },
    ])
    expect(bound).toEqual([descriptorFor("supplier.docx")])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 9 — 193.1-07 Task 1: D-07 / D-08, the CTA gate. It is unreachable when no file is held —
//     so there is no second conditional to get wrong. 291-04 widened it to the references.
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
    expect(view.result.current.anyReading).toBe(true)
  })

  it("RE-ENABLES the moment the read resolves — the gate is a wait, not a refusal", async () => {
    mockedRead.mockResolvedValue(templateFieldsOf(["project_name"]))
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.canDraft).toBe(true))
    expect(view.result.current.anyReading).toBe(false)
  })

  it("D-08 — with NO file held the gate is UNREACHABLE, on every arm of the shipped rule", () => {
    const { view } = mountHook()
    expect(view.result.current.canDraft).toBe(false)
    act(() => view.result.current.setDescribe("a weekly status report"))
    expect(view.result.current.canDraft).toBe(true)
    // …and the reading that could disable it is not merely false, it is not the state at all.
    expect(view.result.current.templateRead.kind).toBe("idle")
    expect(view.result.current.anyReading).toBe(false)
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

  it("is FALSE while ANY reference is reading, and onDraft is a no-op until it settles", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    let resolveRef: (v: DescribeReadResult) => void = () => {}
    mockedRead.mockImplementation(() => new Promise((res) => (resolveRef = res)))
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      view.result.current.onAddReferenceFiles([fileNamed("terms.md")])
    })
    expect(view.result.current.anyReading).toBe(true)
    expect(view.result.current.canDraft).toBe(false)
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(mockedGenerate).not.toHaveBeenCalled()
    await act(async () => resolveRef(referenceOf("terms.md")))
    expect(view.result.current.anyReading).toBe(false)
    expect(view.result.current.canDraft).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 10 — THE WIRE. Sorted key-set deep-equality, never `toMatchObject` — a loose matcher is
// satisfied by a body carrying EXTRA keys, and both the arrival of a key AND its absence are
// the claims under test.
//
// 291-04: the slot's read now travels as `form` (the read result, never re-read bytes —
// Pitfall 11). `template_placeholders` is sent only on the one branch where a form cannot be.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — the wire", () => {
  async function draftWithRead(answer: DescribeReadResult | Error, filename = "status.docx") {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    if (answer instanceof Error) mockedRead.mockRejectedValue(answer)
    else mockedRead.mockResolvedValue(answer)
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

  it("a template read ⇒ the key set is EXACTLY ['describe','form'], with the read's own fields", async () => {
    const body = await draftWithRead(templateFieldsOf(["project_name", "risks_blockers"]))
    expect(Object.keys(body).sort()).toEqual(["describe", "form"])
    // …and the VALUES are the read's own, in the server's order — not a re-derivation.
    expect(body.form).toEqual({
      filename: "status.docx",
      arm: "template_fields",
      fields: [
        { key: "project_name", label: "project_name", type: "text", enum_options: [], origin: "exact" },
        { key: "risks_blockers", label: "risks_blockers", type: "text", enum_options: [], origin: "exact" },
      ],
      text: "body",
    })
  })

  it("`none` travels as a form with its arm and NO fields — and still no template_placeholders", async () => {
    const body = await draftWithRead(readOf({ arm: "none", fields: [], text: "plain text" }))
    expect(Object.keys(body).sort()).toEqual(["describe", "form"])
    expect(body.form?.arm).toBe("none")
    expect(body.form?.fields).toEqual([])
  })

  it("sends NO file key on `unavailable` — a failed read may never read as a read document", async () => {
    const body = await draftWithRead(refusal())
    expect(Object.keys(body).sort()).toEqual(["describe"])
  })

  it("a NON-WORD document travels with the server's `not_word` arm", async () => {
    const body = await draftWithRead(readOf({ arm: "not_word", filename: "deck.pptx" }), "deck.pptx")
    expect(Object.keys(body).sort()).toEqual(["describe", "form"])
    expect(body.form?.arm).toBe("not_word")
  })

  it("carries the knowledge base AND the form together — three keys, no interaction", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    mockedRead.mockResolvedValue(templateFieldsOf(["project_name"]))
    const { view } = mountHook()
    act(() => {
      view.result.current.setDescribe("a weekly status report")
      view.result.current.setProjectFolderId("folder-1")
    })
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("status.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(Object.keys(mockedGenerate.mock.calls[0][0]).sort()).toEqual([
      "describe",
      "form",
      "project_folder_id",
    ])
  })

  it("the AUTO-DRAFT one-shot refuses to fire while the read is in flight (D-07, the fast path)", async () => {
    // The fast door's handoff auto-fires exactly once. Without this term the one-shot would
    // race the read it was just handed and send the blind body the phase exists to remove.
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    let resolveRead: (v: DescribeReadResult) => void = () => {}
    mockedRead.mockImplementation(() => new Promise((res) => (resolveRead = res)))
    const held = fileNamed("status.docx")
    mountHook({
      autoDraft: true,
      initialDescribe: "seeded from the fast door",
      initialTemplateFile: held,
    })
    await act(async () => {})
    expect(mockedGenerate).not.toHaveBeenCalled()

    await act(async () => {
      resolveRead(templateFieldsOf(["project_name"]))
    })
    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1))
    expect(Object.keys(mockedGenerate.mock.calls[0][0]).sort()).toEqual(["describe", "form"])
    // …and STILL exactly once, which is the one-shot's own contract.
    await act(async () => {})
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
  })

  it("1 form + 2 references ⇒ `form` AND `references` in pick order, and NO template_placeholders", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const formAnswer = readOf({
      arm: "form_fields",
      filename: "w9.pdf",
      fields: [fieldOf("name", { label: "Name" }), fieldOf("tin", { label: "TIN", type: "number" })],
      text: "W-9 text",
    })
    mockedRead.mockImplementation((file: File) =>
      Promise.resolve(file.name === "w9.pdf" ? formAnswer : referenceOf(file.name)),
    )
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("fill a W-9 for each vendor"))
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("w9.pdf"))
      view.result.current.onAddReferenceFiles([fileNamed("terms.md"), fileNamed("policy.txt")])
    })
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    await act(async () => {
      await view.result.current.onDraft()
    })
    const body = mockedGenerate.mock.calls[0][0]
    expect(Object.keys(body).sort()).toEqual(["describe", "form", "references"])
    expect(body.form).toEqual({
      filename: "w9.pdf",
      arm: "form_fields",
      fields: [
        { key: "name", label: "Name", type: "text", enum_options: [], origin: "exact" },
        { key: "tin", label: "TIN", type: "number", enum_options: [], origin: "exact" },
      ],
      text: "W-9 text",
    })
    expect(body.references).toEqual([
      { filename: "terms.md", text: "text of terms.md" },
      { filename: "policy.txt", text: "text of policy.txt" },
    ])
  })

  it("WITH NO FILES the body is byte-identical to today's — snapshot of the request body", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(JSON.stringify(mockedGenerate.mock.calls[0][0])).toBe('{"describe":"a weekly status report"}')
  })

  it("a reference whose read FAILED is not sent, and an empty list is never sent to mean absent", async () => {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    mockedRead.mockRejectedValue(new Error("offline"))
    const { view } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      view.result.current.onAddReferenceFiles([fileNamed("terms.md")])
    })
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(Object.keys(mockedGenerate.mock.calls[0][0]).sort()).toEqual(["describe"])
  })

  it("a form the generate body would REFUSE (over 1000 fields) falls back to today's template_placeholders", async () => {
    // The one branch `template_placeholders` still has: a template whose read the server's
    // `form` cap cannot carry still drafts to its fields, the shipped way.
    // 291-06 raised FORM_FIELDS_MAX to 1000, so the case that trips the cap is now 1001.
    const keys = Array.from({ length: 1001 }, (_, i) => `field_${i}`)
    const body = await draftWithRead(templateFieldsOf(keys))
    expect(Object.keys(body).sort()).toEqual(["describe", "template_placeholders"])
    expect(body.template_placeholders).toEqual(keys)
  })

  it("onDrafted receives the extras UNTOUCHED — `removed` and `fields` by identity, absent stays absent", async () => {
    const removed = [{ lead: "Removed: send email.", reason: "Only your description can add actions, not w9.pdf." }]
    const fields = [{ key: "name", label: "Name", type: "text", enum_options: [], covered_by: "input" as const }]
    mockedGenerate.mockResolvedValueOnce({
      ok: true,
      definition: definitionOf(),
      removed,
      fields,
    } as GenerateResult)
    const { view, onDraftedSpy } = mountHook()
    act(() => view.result.current.setDescribe("a weekly status report"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    const extras = onDraftedSpy.mock.calls[0][2]
    expect(extras.removed).toBe(removed)
    expect(extras.fields).toBe(fields)

    // ABSENT stays ABSENT — no `?? []`, no synthesised empty list.
    mockedGenerate.mockResolvedValueOnce({ ok: true, definition: definitionOf() } as GenerateResult)
    await act(async () => {
      await view.result.current.onDraft()
    })
    const bare = onDraftedSpy.mock.calls[1][2]
    expect(bare.removed).toBeUndefined()
    expect(bare.fields).toBeUndefined()
    expect(bare.removed).not.toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 291-06 (CR-02) — a real fillable PDF is SENT, and a form that cannot be sent is REFUSED IN
// WORDS. Before 291-06 a 250-field / 195-option / "Rate %" PDF was dropped from the body
// without a word, and the draft was written blind.
// ══════════════════════════════════════════════════════════════════════════════════════

const COUNTRIES = Array.from({ length: 195 }, (_, i) => `Country ${i}`)

function pdfFormOf(fields: DescribeField[]): DescribeReadResult {
  return readOf({ arm: "form_fields", filename: "vendor.pdf", fields, text: "PDF text" })
}

function linesOf(n: number): DescribeField[] {
  return Array.from({ length: n }, (_, i) => fieldOf(`line_${i}`))
}

describe("useTemplateFirstDraft — a real fillable PDF (291-06, CR-02)", () => {
  async function draftPdf(answer: DescribeReadResult) {
    mockedGenerate.mockResolvedValue({ ok: true, definition: definitionOf() } as GenerateResult)
    mockedRead.mockResolvedValue(answer)
    const mounted = mountHook()
    const { view } = mounted
    act(() => view.result.current.setDescribe("onboard a vendor from their form"))
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("vendor.pdf"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
    await act(async () => {
      await view.result.current.onDraft()
    })
    return mounted
  }

  it("250 fields, a 195-option dropdown and 'Rate %' travel WHOLE as the form", async () => {
    const fields = [
      fieldOf("Country", { type: "enum", enum_options: COUNTRIES }),
      fieldOf("Rate %"),
      ...linesOf(248),
    ]
    await draftPdf(pdfFormOf(fields))
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    const body = mockedGenerate.mock.calls[0][0]
    expect(Object.keys(body).sort()).toEqual(["describe", "form"])
    expect(body.form?.fields).toHaveLength(250)
    expect(body.form?.fields[0].enum_options).toEqual(COUNTRIES)
    expect(body.form?.fields[1].key).toBe("Rate %")
  })

  it("1001 fields: generate is NEVER called, and the author reads why — in words", async () => {
    const { store, onDraftedSpy } = await draftPdf(pdfFormOf(linesOf(1001)))
    expect(mockedGenerate).not.toHaveBeenCalled()
    const s = store.getState()
    expect(s.builderPhase).toBe("error")
    expect(s.errorMessage).toBe(FORM_NOT_SENDABLE_KEY)
    const r = describeRefusal(s.errorMessage, s.errorDetail)
    expect(r.sentence).toBe("This form can't be sent to the drafter as it is, so no draft was made.")
    expect(r.next).toBe(
      "Remove the form to draft from your description alone, or attach a different copy of the form.",
    )
    expect(s.errorDetail).toContain("1001")
    expect(s.errorDetail).toContain("1000")
    expect(r.technicalDetail).toBe(s.errorDetail)
    expect(onDraftedSpy).toHaveBeenCalledTimes(0)
  })

  it.each([
    {
      name: "an option of 201 characters",
      fields: [fieldOf("Pick", { type: "enum", enum_options: ["x".repeat(201)] })],
      names: ["option", "200 characters"],
    },
    {
      name: "a PDF field named 'Total {net}' (braces stay refused on every arm)",
      fields: [fieldOf("Total {net}")],
      names: ["{ } < >"],
    },
    {
      name: "a field with 501 options",
      fields: [fieldOf("Pick", { type: "enum", enum_options: Array.from({ length: 501 }, (_, i) => `o${i}`) })],
      names: ["501", "500"],
    },
  ])("$name is refused in words, and errorDetail names its own cap", async ({ fields, names }) => {
    const { store, onDraftedSpy } = await draftPdf(pdfFormOf(fields))
    expect(mockedGenerate).not.toHaveBeenCalled()
    const s = store.getState()
    expect(s.errorMessage).toBe(FORM_NOT_SENDABLE_KEY)
    expect(describeRefusal(s.errorMessage, s.errorDetail).sentence).toBe(
      "This form can't be sent to the drafter as it is, so no draft was made.",
    )
    for (const n of names) expect(s.errorDetail).toContain(n)
    expect(onDraftedSpy).toHaveBeenCalledTimes(0)
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
    mockedRead.mockResolvedValue(templateFieldsOf(["project_name"]))
    const { view, bound } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUpload).toHaveBeenCalledTimes(1)
    expect(mockedUpload.mock.calls[0][0]).toBe("draft-1")
    expect(mockedUpload.mock.calls[0][1]).toBe(held)
    // A template binds the shipped way — no anchors argument at all.
    expect(mockedUpload.mock.calls[0]).toHaveLength(2)
    expect(bound).toEqual([descriptorFor("status.docx")])
    expect(view.result.current.bindFailed).toBeNull()
  })

  it("does NOTHING and reports NOTHING when no file is held — SC#4 stays true by construction", async () => {
    const { view, bound, referencesBound } = mountHook()
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUpload).not.toHaveBeenCalled()
    expect(mockedUploadRef).not.toHaveBeenCalled()
    expect(bound).toEqual([])
    expect(referencesBound).toEqual([])
    expect(view.result.current.bindFailed).toBeNull()
  })

  it("NEVER REJECTS — a synchronously-throwing upload resolves, which is what makes `void` safe", async () => {
    const held = fileNamed("status.docx")
    mockedUpload.mockImplementation(() => {
      throw new Error("synchronous boom")
    })
    mockedRead.mockResolvedValue(templateFieldsOf(["project_name"]))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
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
    mockedRead.mockResolvedValue(templateFieldsOf(["project_name"]))
    const { view, bound } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
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
    mockedRead.mockResolvedValue(templateFieldsOf(["project_name"]))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.onPickTemplateFile(held)
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
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

// ══════════════════════════════════════════════════════════════════════════════════════
// 11b — 291-04 (D-07): WHICH door each slot reading binds through, and the references
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useTemplateFirstDraft — the bind per reading (291-04)", () => {
  async function bindAfter(answer: DescribeReadResult, filename: string) {
    mockedRead.mockResolvedValue(answer)
    mockedUpload.mockResolvedValue(descriptorFor(filename))
    mockedUploadRef.mockResolvedValue({ kind: "reference", asset_id: `refs/${filename}`, filename, mime: "x" })
    const mounted = mountHook()
    const held = fileNamed(filename)
    await act(async () => {
      mounted.view.result.current.onPickTemplateFile(held)
    })
    await waitFor(() => expect(mounted.view.result.current.templateRead.kind).not.toBe("loading"))
    await act(async () => {
      await mounted.view.result.current.bindHeldTemplate("draft-1")
    })
    return { ...mounted, held }
  }

  it("a fillable PDF form binds through the TEMPLATE door, with no anchors", async () => {
    const { held, bound } = await bindAfter(readOf({ arm: "form_fields", filename: "w9.pdf", fields: [fieldOf("name")] }), "w9.pdf")
    expect(mockedUpload).toHaveBeenCalledTimes(1)
    expect(mockedUpload.mock.calls[0]).toEqual(["draft-1", held])
    expect(mockedUploadRef).not.toHaveBeenCalled()
    expect(bound).toHaveLength(1)
  })

  it.each([
    ["none", "notes.docx"],
    ["suggested_fields", "flat.pdf"],
    ["scan_unreadable", "scan.pdf"],
    ["copy_refused", "marks.docx"],
  ] as const)("a `%s` reading keeps the file as a REFERENCE, through the reference door", async (arm, filename) => {
    const { held, bound, referencesBound } = await bindAfter(readOf({ arm, filename }), filename)
    expect(mockedUpload).not.toHaveBeenCalled()
    expect(mockedUploadRef).toHaveBeenCalledTimes(1)
    expect(mockedUploadRef.mock.calls[0]).toEqual(["draft-1", held])
    expect(bound).toEqual([])
    expect(referencesBound).toEqual([[{ kind: "reference", asset_id: `refs/${filename}`, filename, mime: "x" }]])
  })

  it("a deck (`not_word`) still binds as a TEMPLATE — the reference door does not take decks", async () => {
    const { held } = await bindAfter(readOf({ arm: "not_word", filename: "deck.pptx" }), "deck.pptx")
    expect(mockedUpload.mock.calls[0]).toEqual(["draft-1", held])
    expect(mockedUploadRef).not.toHaveBeenCalled()
  })

  it("every held reference is bound through the reference door, handed over in ONE batch", async () => {
    mockedRead.mockImplementation((file: File) => Promise.resolve(referenceOf(file.name)))
    mockedUploadRef.mockImplementation((_id: string, file: File) =>
      Promise.resolve({ kind: "reference" as const, asset_id: `refs/${file.name}`, filename: file.name, mime: "text/plain" }),
    )
    const { view, referencesBound } = mountHook()
    const a = fileNamed("terms.md")
    const b = fileNamed("policy.txt")
    await act(async () => {
      view.result.current.onAddReferenceFiles([a, b])
    })
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUploadRef.mock.calls.map((c) => c[1])).toEqual([a, b])
    expect(referencesBound).toEqual([
      [
        { kind: "reference", asset_id: "refs/terms.md", filename: "terms.md", mime: "text/plain" },
        { kind: "reference", asset_id: "refs/policy.txt", filename: "policy.txt", mime: "text/plain" },
      ],
    ])
  })

  it("a failed reference upload names THAT file, never throws, and the others still bind", async () => {
    mockedRead.mockImplementation((file: File) => Promise.resolve(referenceOf(file.name)))
    mockedUploadRef.mockImplementation((_id: string, file: File) =>
      file.name === "terms.md"
        ? Promise.reject(new Error("502"))
        : Promise.resolve({ kind: "reference" as const, asset_id: `refs/${file.name}`, filename: file.name, mime: "x" }),
    )
    const { view, referencesBound } = mountHook()
    await act(async () => {
      view.result.current.onAddReferenceFiles([fileNamed("terms.md"), fileNamed("policy.txt")])
    })
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    let settled: "resolved" | "rejected" = "rejected"
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1").then(
        () => (settled = "resolved"),
        () => (settled = "rejected"),
      )
    })
    expect(settled).toBe("resolved")
    expect(view.result.current.bindFailed).toEqual({ filename: "terms.md" })
    expect(referencesBound).toEqual([[{ kind: "reference", asset_id: "refs/policy.txt", filename: "policy.txt", mime: "x" }]])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 12 — 291-04 (D-03): the references' reads. Five fixed slots on ONE read routine.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("useReferenceReads — up to five references (D-03)", () => {
  beforeEach(() => {
    mockedRead.mockImplementation((file: File) => Promise.resolve(referenceOf(file.name)))
  })

  it("adding 7 keeps the FIRST 5, and the overflow notice names the other 2", async () => {
    const view = renderHook(() => useReferenceReads())
    const files = ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "g.md"].map(fileNamed)
    await act(async () => view.result.current.addFiles(files))
    expect(view.result.current.references.map((r) => r.file.name)).toEqual(["a.md", "b.md", "c.md", "d.md", "e.md"])
    expect(view.result.current.notice?.kind).toBe("overflow")
    expect(view.result.current.notice?.text).toContain("f.md")
    expect(view.result.current.notice?.text).toContain("g.md")
  })

  it("a DUPLICATE (same name and size) is not added and says so", async () => {
    const view = renderHook(() => useReferenceReads())
    await act(async () => view.result.current.addFiles([fileNamed("terms.md")]))
    await act(async () => view.result.current.addFiles([fileNamed("terms.md")]))
    expect(view.result.current.references).toHaveLength(1)
    expect(view.result.current.notice?.kind).toBe("duplicate")
    expect(view.result.current.notice?.text).toContain("terms.md")
  })

  it("a 422 REMOVES the file and the refused notice carries the server's sentence", async () => {
    mockedRead.mockRejectedValue(refusal("A reference must be a .pdf, .docx, .txt or .md document."))
    const view = renderHook(() => useReferenceReads())
    await act(async () => view.result.current.addFiles([fileNamed("bad.md")]))
    await waitFor(() => expect(view.result.current.references).toHaveLength(0))
    expect(view.result.current.notice?.kind).toBe("refused")
    expect(view.result.current.notice?.text).toContain("bad.md")
    expect(view.result.current.notice?.text).toContain("A reference must be a .pdf, .docx, .txt or .md document.")
  })

  it("a NETWORK failure keeps the file, reading `unreachable` (the row says send failed)", async () => {
    mockedRead.mockRejectedValue(new WorkflowTemplateUploadError("network", null))
    const view = renderHook(() => useReferenceReads())
    await act(async () => view.result.current.addFiles([fileNamed("terms.md")]))
    await waitFor(() => expect(view.result.current.references[0]?.state.kind).toBe("unavailable"))
    expect(view.result.current.references[0].state).toEqual({ kind: "unavailable", reason: "unreachable", detail: null })
    expect(view.result.current.notice).toBeNull()
  })

  it("removing a file FREES its slot — a sixth fits once one is gone, and nothing is re-read", async () => {
    const view = renderHook(() => useReferenceReads())
    await act(async () => view.result.current.addFiles(["a.md", "b.md", "c.md", "d.md", "e.md"].map(fileNamed)))
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    expect(mockedRead).toHaveBeenCalledTimes(5)
    await act(async () => view.result.current.removeAt(1))
    expect(view.result.current.references.map((r) => r.file.name)).toEqual(["a.md", "c.md", "d.md", "e.md"])
    // The survivors kept their answers: removing one re-read none of the others.
    expect(mockedRead).toHaveBeenCalledTimes(5)
    await act(async () => view.result.current.addFiles([fileNamed("f.md")]))
    expect(view.result.current.references.map((r) => r.file.name)).toEqual(["a.md", "c.md", "d.md", "e.md", "f.md"])
  })

  it("anyReading is TRUE while one is in flight and false once all have settled", async () => {
    let resolve: (v: DescribeReadResult) => void = () => {}
    mockedRead.mockImplementation(() => new Promise((res) => (resolve = res)))
    const view = renderHook(() => useReferenceReads())
    expect(view.result.current.anyReading).toBe(false)
    await act(async () => view.result.current.addFiles([fileNamed("terms.md")]))
    expect(view.result.current.anyReading).toBe(true)
    await act(async () => resolve(referenceOf("terms.md")))
    expect(view.result.current.anyReading).toBe(false)
  })

  it("SEEDED references answer immediately and issue ZERO requests (the fast door's handoff)", async () => {
    const file = fileNamed("terms.md")
    const result = referenceOf("terms.md")
    const view = renderHook(() =>
      useReferenceReads([{ file, state: { kind: "read", result }, unticked: [] }]),
    )
    expect(view.result.current.references).toEqual([{ file, state: { kind: "read", result } }])
    await act(async () => {})
    expect(mockedRead).not.toHaveBeenCalled()
  })

  it("SOURCE FENCE — the five slots are five calls of the SAME per-file read, never a second machine", () => {
    const body = templateFirstDraftSource.slice(templateFirstDraftSource.indexOf("export function useReferenceReads"))
    expect(body).not.toMatch(/readDescribeFile\(/)
    expect(templateFirstDraftSource.match(/readDescribeFile\(/g)).toHaveLength(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 13 — 291-04: the CLIENT FUNCTIONS' request shapes, against a stubbed `fetch`
// ══════════════════════════════════════════════════════════════════════════════════════

describe("the describe door's client calls (291-04)", () => {
  function okJson(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))
  }

  it("readDescribeFile posts parts `file` and `role`, a Bearer header, and NO Content-Type", async () => {
    const fetchMock = vi.fn(() => okJson(referenceOf("terms.md")))
    vi.stubGlobal("fetch", fetchMock)
    try {
      const file = fileNamed("terms.md")
      const res = await realReadDescribeFile(file, "reference")
      expect(res.arm).toBe("reference")
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toMatch(/\/workflows\/describe\/read$/)
      expect(init.method).toBe("POST")
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe("Bearer token")
      expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("content-type")
      const form = init.body as FormData
      expect(form.get("file")).toBe(file)
      expect(form.get("role")).toBe("reference")
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("readDescribeFile: a 422 rejects WITH the server's detail; a network failure rejects as 'network'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => okJson({ detail: "File too large. Maximum size is 10 MB." }, 422)))
    try {
      const err = await realReadDescribeFile(fileNamed("big.pdf"), "form").catch((e: unknown) => e)
      expect(err).toBeInstanceOf(WorkflowTemplateUploadError)
      expect((err as WorkflowTemplateUploadError).status).toBe(422)
      expect((err as WorkflowTemplateUploadError).detail).toBe("File too large. Maximum size is 10 MB.")
    } finally {
      vi.unstubAllGlobals()
    }
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))))
    try {
      const err = await realReadDescribeFile(fileNamed("x.pdf"), "form").catch((e: unknown) => e)
      expect((err as WorkflowTemplateUploadError).status).toBe("network")
      expect((err as WorkflowTemplateUploadError).detail).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("uploadWorkflowTemplate WITHOUT anchors sends exactly one part, as today", async () => {
    const fetchMock = vi.fn(() => okJson(descriptorFor("status.docx")))
    vi.stubGlobal("fetch", fetchMock)
    try {
      await realUploadWorkflowTemplate("draft-1", fileNamed("status.docx"))
      const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
      expect([...form.keys()]).toEqual(["file"])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("uploadWorkflowTemplate WITH anchors appends one `anchors` JSON part", async () => {
    const fetchMock = vi.fn(() => okJson(descriptorFor("supplier.docx")))
    vi.stubGlobal("fetch", fetchMock)
    try {
      const anchors = [{ key: "vat_number", anchor_kind: "line" as const, anchor_label: "VAT number" }]
      await realUploadWorkflowTemplate("draft-1", fileNamed("supplier.docx"), anchors)
      const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
      expect([...form.keys()]).toEqual(["file", "anchors"])
      expect(JSON.parse(String(form.get("anchors")))).toEqual(anchors)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("uploadWorkflowReference posts the file to the definition's reference door", async () => {
    const fetchMock = vi.fn(() => okJson({ kind: "reference", asset_id: "a", filename: "terms.md", mime: "text/markdown" }))
    vi.stubGlobal("fetch", fetchMock)
    try {
      const out = await realUploadWorkflowReference("draft-1", fileNamed("terms.md"))
      expect(out.kind).toBe("reference")
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toMatch(/\/workflows\/draft-1\/reference$/)
      expect([...(init.body as FormData).keys()]).toEqual(["file"])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
