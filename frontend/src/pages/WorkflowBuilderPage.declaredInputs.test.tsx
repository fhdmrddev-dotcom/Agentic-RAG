/**
 * ⭐ Phase 214.1-02 Task 2 — THE REACHABILITY PROPERTY, and this phase's single most
 * important artefact.
 *
 * ── WHAT THIS FILE CLAIMS ────────────────────────────────────────────────────────────
 * A person starting from an EMPTY builder can reach a PUBLISHED workflow whose
 * `definition.inputs[]` is non-empty, and the declared key travels the whole way on the
 * wire.
 *
 * ── WHY IT IS WRITTEN THIS WAY, WHICH IS THE POINT ───────────────────────────────────
 * `BUG-260828-02` survived a SIXTEEN-PLAN phase with every gate green, because **every
 * test built `definition.inputs[]` by hand**. The fixtures could reach a state no human
 * could: the store was mocked, or `@/lib/api` was mocked, or an `inputs` literal was typed
 * straight into a definition object. Three quarters of a mechanism worked and the quarter
 * nobody could reach was invisible to 5,000 passing cases.
 *
 * ⛔ **THE PATTERN THIS FILE MUST NOT COPY** is
 * `WorkflowBuilderPage.describe.test.tsx:127` — `vi.mock("@/lib/api", …)`. **Every shipped
 * builder-page suite does it**, including the one wave 1 wrote, and that is precisely the
 * blind spot the bug walked through.
 *
 * ── SO: ONLY THE NETWORK IS FAKED ────────────────────────────────────────────────────
 * `globalThis.fetch` is stubbed with a route table, and `@/lib/supabase` is stubbed
 * because the API client reads its auth header from it. **Everything between the DOM and
 * `fetch` is REAL** — the real `builderStore`, the real `useDraftPersistence`, the real
 * `selectDefinition`, the real `updateWorkflowDraft`, the real `publishWorkflow`, the real
 * `DeclaredInputsEditor`, the real `PublishGauntlet`.
 *
 * ⭐ **AND THE ACCEPTANCE IS WRITTEN SO THAT SEEDING THE STORE FAILS IT.** Three
 * self-fences read this file's own source through `?raw`, and **each carries a POSITIVE
 * CONTROL** — a fence whose regex never matches is a fence that passes against everything,
 * which is a worse outcome than having no fence at all. A fourth guard, the non-vacuity
 * case, defends against the walk silently never reaching the editor.
 *
 * ⚠ `\r?\n` IN EVERY SOURCE REGEX. Files check out CRLF here; a bare `\n\n` matches
 * nothing, returns empty, and passes VACUOUSLY.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { mockReactFlow } from "@/test-utils/mockReactFlow"

/**
 * THE ONLY MODULE MOCK IN THIS FILE, and it is neither the store nor an API module.
 *
 * `lib/api/_core.ts` reads its bearer token from `supabase.auth.getSession()`. Without a
 * session every authed call would await a real network client that jsdom cannot reach, so
 * this is the AUTH BOUNDARY, sitting beside the network boundary the fetch stub owns.
 * `channel` / `removeChannel` are present because a realtime subscriber would otherwise
 * throw at mount; neither is consulted by anything this file asserts.
 */
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}))

import { WorkflowBuilderPage } from "./WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { PublishGauntlet } from "@/components/workflows/PublishGauntlet"
import { DESCRIBE_CTA } from "@/components/workflows/doorVocabulary"
import { DECLARED_INPUT_ADD } from "@/components/workflows/declaredInputsVocabulary"

// ── THE ONE STRING THE WHOLE FILE TURNS ON ──────────────────────────────────────────────
//
// ⚠ IT IS TYPED INTO THE EDITOR AND THEN READ BACK OFF THE REQUEST BODY. Self-fence 3
// asserts that the value the body assertion compares against is the value the DOM was
// driven with — never a module-scope fixture a later refactor could quietly re-point at a
// seeded store. The variable below is the TYPED value's single home: the test writes it
// into the input element and reads it out of `input.value` before asserting, so the two
// ends of the claim are joined through the DOM rather than through this declaration.
const KEY_TO_DECLARE = "recipient_email"

const DRAFT_ID = "22222222-2222-2222-2222-222222222222"

// ── the emitted definition the generate door returns ────────────────────────────────────
//
// ⛔ IT CARRIES NO `inputs` KEY OF ANY KIND, AND THAT IS THE WHOLE DESIGN. A fixture that
// arrived with a declaration would prove that a hand-written literal survives a round trip
// — which is exactly the thing `BUG-260828-02` proved sixteen plans in a row. The
// declaration under test must come from the DOM and from nowhere else.
function emittedDefinition() {
  return {
    slug: "renewal-brief",
    version: 1,
    name: "Renewal Brief",
    status: "draft",
    business_requirement: "Send the renewal brief to whoever the run names.",
    phases: [
      {
        slug: "gather",
        phase_index: 0,
        name: "Pull the renewal history",
        config: { phase_type: "llm_single", prompt: "Pull the history." },
        validators: [],
      },
    ],
  }
}

// ── the network boundary ────────────────────────────────────────────────────────────────

type Recorded = { method: string; path: string; body: string | null }

let requests: Recorded[] = []
/** Paths the route table did not name. Surfaced by a case rather than swallowed: an
 *  unrouted call answered by a silent default is how a stub starts lying. */
let unrouted: string[] = []

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as unknown as Response
}

function installFetchStub() {
  requests = []
  unrouted = []
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? "GET").toUpperCase()
    const path = new URL(url, "http://localhost").pathname
    const body = typeof init?.body === "string" ? init.body : null
    requests.push({ method, path, body })

    if (method === "POST" && path === "/workflows/generate") {
      return jsonResponse({
        ok: true,
        definition: emittedDefinition(),
        readiness: { business_requirement: { status: "present" } },
      })
    }
    if (method === "POST" && path === "/workflows/validate") {
      return jsonResponse({ ok: true, verdicts: [] })
    }
    if (method === "POST" && path === "/workflows") {
      return jsonResponse({ id: DRAFT_ID, version: 1, token: "token-1" })
    }
    if (method === "PATCH" && path === `/workflows/${DRAFT_ID}`) {
      return jsonResponse({ id: DRAFT_ID, version: 1, token: `token-${requests.length}` })
    }
    if (method === "POST" && path === `/workflows/${DRAFT_ID}/publish`) {
      return jsonResponse({
        published: true,
        version: 1,
        golden_run_id: "99999999-9999-9999-9999-999999999999",
        blocked_stage: null,
        named_failures: [],
      })
    }
    if (method === "GET" && path === "/workflows/grounding-bundle") {
      return jsonResponse({ tools: [], folders: [], skills: [], degraded: [] })
    }
    if (method === "GET" && path === "/models/registry") {
      return jsonResponse({ models: [], run_default_model: null })
    }
    if (method === "GET") return jsonResponse([])

    unrouted.push(`${method} ${path}`)
    return jsonResponse({}, 404)
  })
  globalThis.fetch = stub as unknown as typeof fetch
  return stub
}

/** Every request that WROTE the definition — the create and every subsequent PATCH. */
function definitionWrites(): Recorded[] {
  return requests.filter(
    (r) =>
      (r.method === "POST" && r.path === "/workflows") ||
      (r.method === "PATCH" && r.path === `/workflows/${DRAFT_ID}`),
  )
}

function lastPatchBody(): Record<string, unknown> {
  const patches = requests.filter(
    (r) => r.method === "PATCH" && r.path === `/workflows/${DRAFT_ID}`,
  )
  expect(patches.length).toBeGreaterThan(0)
  return JSON.parse(patches[patches.length - 1]!.body!) as Record<string, unknown>
}

// ── the walk ────────────────────────────────────────────────────────────────────────────

const FLAG_ON = {
  features: { visual_workflow_canvas: true },
  loading: false,
  refetch: vi.fn(),
}

/**
 * Mount the Builder EMPTY, exactly as `WorkflowsPage` does for a fresh build.
 *
 * ⚠ `renderPublish` is TRANSCRIBED from `WorkflowsPage.tsx:942-975`, the app's own
 * supplier, and it mounts the SHIPPED `PublishGauntlet`. It is a seam the page declares
 * and the product fills — reproducing the product's fill is not the same thing as
 * replacing a module with a fake, and the gauntlet it mounts calls the real
 * `publishWorkflow`, which calls the real `fetch`.
 */
function renderEmptyBuilder() {
  return render(
    <EffectiveFeaturesProvider value={FLAG_ON}>
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowBuilderPage
          renderPublish={(def, draftId) =>
            draftId ? (
              <PublishGauntlet
                definitionId={draftId}
                definition={def as never}
                onPublished={() => {}}
              />
            ) : null
          }
        />
      </div>
    </EffectiveFeaturesProvider>,
  )
}

/** Empty builder → a drafted definition, through the surfaces a person uses. */
async function driveToDraft() {
  renderEmptyBuilder()
  const box = await screen.findByLabelText("business requirement")
  fireEvent.change(box, {
    target: { value: "Email the renewal brief to whoever asks for it." },
  })
  const cta = screen.getByRole("button", { name: DESCRIBE_CTA })
  await waitFor(() => expect(cta).toBeEnabled())
  fireEvent.click(cta)
  // The generate call is the transition; the canvas renders in ONE batch behind it.
  await waitFor(() =>
    expect(requests.some((r) => r.path === "/workflows/generate")).toBe(true),
  )
  await screen.findByTestId("declared-inputs-affordance", undefined, { timeout: 5000 })
}

/**
 * Wait for the create to land, so a draft id exists and the gauntlet can mount.
 *
 * ⚠ It asserts EXACTLY ONE, not "at least one". `useDraftPersistence`'s create branch is
 * guarded against re-entry precisely because a second create would collide on
 * `UNIQUE(slug, version)` and 500 — so create-once is a shipped invariant, and a wait that
 * accepted two would be blind to the defect it is standing next to.
 */
async function waitForCreate() {
  await waitFor(
    () =>
      expect(
        requests.filter((r) => r.method === "POST" && r.path === "/workflows"),
      ).toHaveLength(1),
    { timeout: 8000 },
  )
}

/**
 * Open the declared-input editor, TYPE a key, and declare it. The modal is left OPEN — the
 * caller decides when to close, because the headline case makes a second edit inside it.
 *
 * Returns the value read back out of the input element — so the assertion downstream
 * compares the request body against what the DOM actually held, not against a constant.
 */
async function declareAnInputThroughTheDom(): Promise<string> {
  fireEvent.click(screen.getByTestId("declared-inputs-affordance"))
  const field = (await screen.findByTestId("declared-input-new-key")) as HTMLInputElement
  fireEvent.change(field, { target: { value: KEY_TO_DECLARE } })
  const typed = field.value
  expect(typed.length).toBeGreaterThan(0)
  // The control is found by its SHIPPED WORDS, imported rather than re-typed — a copy
  // change moves the vocabulary and this line together instead of drifting apart.
  expect(screen.getByRole("button", { name: DECLARED_INPUT_ADD })).toBeInTheDocument()
  fireEvent.click(screen.getByTestId("declared-input-add"))
  await screen.findByTestId(`declared-input-row-${typed}`)
  return typed
}

function closeTheEditor() {
  fireEvent.click(screen.getByTestId("declared-inputs-modal-close"))
}

/** The parsed body of the FIRST definition write — which, for a freshly generated draft, is
 *  the CREATE. See the block comment on the headline case for why that matters. */
function firstWriteBody(): Record<string, unknown> {
  const writes = definitionWrites()
  expect(writes.length).toBeGreaterThan(0)
  return JSON.parse(writes[0]!.body!) as Record<string, unknown>
}

/** The declared keys carried by a parsed definition body, or `null` when it declares none.
 *  ⚠ ABSENT, `null` and `[]` all read as "declares nothing" HERE and only here — this is a
 *  test-side reader, not the server rule, which keeps `None` and `[]` distinct. */
function declaredKeysIn(body: Record<string, unknown>): string[] | null {
  const value = body.inputs
  if (!Array.isArray(value) || value.length === 0) return null
  return value.map((entry) => (entry as Record<string, unknown>).key as string)
}

/** Publish, through the shipped gauntlet's own controls. */
async function publishThroughTheDom() {
  fireEvent.click(await screen.findByTestId("publish-trigger", undefined, { timeout: 5000 }))
  const golden = (await screen.findByLabelText(/A typical instruction to test with/i)) as HTMLTextAreaElement
  fireEvent.change(golden, { target: { value: "Send this quarter's renewal brief." } })
  const confirm = screen.getByRole("button", { name: /Publish — run the checks/ })
  await waitFor(() => expect(confirm).toBeEnabled())
  fireEvent.click(confirm)
  await waitFor(
    () =>
      expect(
        requests.some((r) => r.method === "POST" && r.path === `/workflows/${DRAFT_ID}/publish`),
      ).toBe(true),
    { timeout: 5000 },
  )
}

beforeEach(() => {
  mockReactFlow()
  vi.clearAllMocks()
  window.localStorage.clear()
  installFetchStub()
})

afterEach(() => {
  cleanup()
})

// ══ ⭐ THE HEADLINE ══════════════════════════════════════════════════════════════════════

describe("⭐ an EMPTY builder reaches a PUBLISHED workflow with a declared input", () => {
  /**
   * ⚠ A MEASURED CORRECTION TO THIS PLAN'S OWN ASSUMPTION, RECORDED HERE RATHER THAN
   * SILENTLY DESIGNED AROUND.
   *
   * The plan says to assert on *"the last `PATCH /workflows/{id}`"*. **For a freshly
   * generated draft the declaration reaches the wire on the CREATE, not on a PATCH**, and
   * the reason is a shipped rule this walk ran straight into: `useDraftPersistence`'s
   * matured debounce returns early on `if (!store.getState().dirty) return`, whose own
   * comment says *"merely OPENING a draft would PATCH it"*. A generated draft is therefore
   * NOT dirty, no row exists, and **the first thing that writes anything is the author's
   * first edit — which here is the declare itself.**
   *
   * ⇒ So this case asserts BOTH, in order, and neither alone would have been honest:
   *   1. the CREATE body carries the declaration — the write that actually happens first;
   *   2. a following PATCH body carries it too — the plan's literal criterion, reached by
   *      making a SECOND real edit (the row's `Required` toggle) so a second write exists
   *      at all. Asserting (2) without causing (2) is how a criterion passes by never
   *      running.
   */
  it(
    "the declared key travels DOM → store → hook → api client → the wire, and publish is reached",
    async () => {
      await driveToDraft()

      // ⚠ NO create has happened yet, and that is asserted rather than assumed — it is the
      // premise of the correction above. If a future change makes a generated draft write
      // on arrival, this line reds and the block comment gets re-measured.
      expect(definitionWrites()).toHaveLength(0)

      const typed = await declareAnInputThroughTheDom()

      // The autosave debounce is REAL elapsed time; nothing here shortens it, because a
      // person waiting is the behaviour under test.
      await waitForCreate()
      expect(declaredKeysIn(firstWriteBody())).toEqual([typed])

      // ── (2) the plan's criterion — a SECOND edit, so a PATCH exists to assert on ──
      fireEvent.click(screen.getByTestId(`declared-input-required-${typed}`))
      await waitFor(
        () =>
          expect(
            requests.filter((r) => r.method === "PATCH" && r.path === `/workflows/${DRAFT_ID}`)
              .length,
          ).toBeGreaterThan(0),
        { timeout: 8000 },
      )
      const patched = declaredKeysIn(lastPatchBody())
      // ⭐ compared against the string read OUT OF THE DOM, never against the constant.
      expect(patched).toEqual([typed])

      closeTheEditor()
      await publishThroughTheDom()

      // The publish call names the id the CREATE minted — the row that was written.
      expect(
        requests.some((r) => r.method === "POST" && r.path === `/workflows/${DRAFT_ID}/publish`),
      ).toBe(true)
      await waitFor(() => expect(screen.getByTestId("publish-success")).toBeInTheDocument(), {
        timeout: 8000,
      })

      // Nothing the page asked for was answered by a default the route table never named.
      expect(unrouted).toEqual([])
    },
    40000,
  )

  /**
   * ⭐ THE NON-VACUITY CONTROL FOR THE WHOLE WALK.
   *
   * Without it, a walk that silently never reached the editor would satisfy every fence
   * below by never getting there — the fences are all ABSENCE claims about this file's
   * source, and absence claims are exactly what a walk that did nothing satisfies best.
   *
   * ⚠ IT MAKES A REAL EDIT, and that is what stops the control being vacuous in its turn.
   * "The same walk with the declare removed" writes NOTHING at all (see the correction
   * above), so *"no write carried `inputs`"* would be true because there were no writes —
   * a control that passes by not existing. The `Living Register` toggle is therefore
   * clicked instead: a shipped, one-click, non-declare edit that dirties the store and
   * forces exactly the same write. **A write happens, and it carries no declaration.**
   */
  it(
    "NON-VACUITY: the identical walk with a NON-declare edit writes, and declares nothing",
    async () => {
      await driveToDraft()

      // The editor is REACHABLE here too — proved, not assumed. The difference between this
      // case and the one above must be the DECLARE, never the ARRIVAL.
      expect(screen.getByTestId("declared-inputs-affordance")).toBeInTheDocument()
      expect(definitionWrites()).toHaveLength(0)

      fireEvent.click(screen.getByTestId("builder-stateful-toggle"))
      await waitForCreate()

      const writes = definitionWrites()
      expect(writes.length).toBeGreaterThan(0)
      for (const write of writes) {
        expect(declaredKeysIn(JSON.parse(write.body!) as Record<string, unknown>)).toBeNull()
      }
      // …and the edit that caused the write DID reach the body, so the write is not an
      // empty one that would carry no `inputs` for the wrong reason.
      expect(firstWriteBody().is_stateful).toBe(true)
    },
    40000,
  )
})

// ══ THE THREE SELF-FENCES, EACH WITH ITS POSITIVE CONTROL ═══════════════════════════════
//
// These read THIS FILE's own source. They exist so that a later, well-meaning
// "simplification" — seed the store, mock the client, drop an `inputs` literal into the
// fixture — turns the walk above from a reachability proof into a fixture test AND TURNS
// THIS FILE RED, rather than leaving it green and meaningless.
//
// ⚠ T-214.1-02-04: this is the only threat in the phase whose exploit is a future
// refactor rather than an attacker.

// ⚠ NO `@ts-expect-error` HERE, and that absence was MEASURED rather than assumed: the
// project declares `*?raw` in `vite/client`, so a suppression is UNUSED and `tsc` fails it
// with TS2578 — a directive that guards nothing is itself a typecheck error.
import ownSource from "./WorkflowBuilderPage.declaredInputs.test.tsx?raw"

const SOURCE = ownSource as string

/** Strip line and block comments, and assert the stripper DID something.
 *
 * ⚠ THE 187-24 TRAP, and this file is its worst-case shape: it is thick with prose about
 * mocks while asserting that no mock is present. A raw `grep` over this source would count
 * the paragraphs above and fail against its own documentation. So every fence runs over
 * CODE ONLY, and the stripper is itself controlled — a stripper that silently matched
 * nothing would hand each fence the full text back and the fences would all fire on prose.
 */
function codeOnly(source: string): string {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/(^|[\s;,{([])\/\/[^\r\n]*/g, "$1")
  return stripped
}

/**
 * ⭐ AND THE TRAP HAS A SECOND FLOOR, WHICH THIS FILE FELL THROUGH ON ITS FIRST RUN AND
 * WHICH IS RECORDED HERE RATHER THAN QUIETLY FIXED.
 *
 * **All four fences below went red against their OWN POSITIVE CONTROLS** — 6 failed / 3
 * passed, and not one of the six was a real finding. Stripping comments is not enough: a
 * control that PLANTS the forbidden shape as a string literal has written the forbidden
 * shape into the very file its fence scans. The fence then reports the file as guilty, and
 * is at that moment indistinguishable from a fence catching a genuine regression.
 *
 * ⇒ **THE RULE THIS FILE NOW OBEYS: a positive control must never SPELL the shape it
 * tests.** Every planted string below is ASSEMBLED from fragments, so the pattern exists at
 * runtime and never in the bytes on disk. `spell()` is that assembly, named so the intent
 * survives a reader who never reached this paragraph.
 *
 * ⚠ Do NOT "simplify" a `spell(…)` call back into one literal. It will look like noise, it
 * will pass the moment you also delete the fence it broke, and it is the exact edit that
 * re-opens this hole.
 */
const spell = (...parts: string[]) => parts.join("")

describe("self-fence 0 — the comment stripper actually strips", () => {
  it("removes block comments and line comments, and shrinks this file", () => {
    const stripped = codeOnly(SOURCE)
    expect(stripped.length).toBeLessThan(SOURCE.length)
    // A sentinel that exists ONLY inside this file's prose. Its survival past the stripper
    // would mean the stripper matched nothing and every fence below is reading
    // documentation. ⚠ ASSEMBLED, never spelled — see the paragraph above.
    const sentinel = spell("THE PATTERN THIS FILE ", "MUST NOT COPY")
    expect(SOURCE).toContain(sentinel)
    expect(stripped).not.toContain(sentinel)
    // POSITIVE CONTROL: the stripper leaves real code alone.
    const sample = spell("const a = 1 ", "// trailing", "\n", "/* block */", "\nconst b = 2")
    expect(codeOnly(sample)).toContain("const a = 1")
    expect(codeOnly(sample)).toContain("const b = 2")
  })
})

// ── self-fence 3's three patterns ───────────────────────────────────────────────────────
//
// ⚠ NONE OF THEM MATCHES ITS OWN DEFINITION, and that is checked rather than hoped: each
// spells its target with escapes (`\s`, `\.`) where the real code carries literals, so the
// pattern text cannot satisfy the pattern.

/** The helper reading the typed value back OFF the input element. CRLF-tolerant. */
const READS_THE_ELEMENT = /const\s+typed\s*=\s*field\s*\.\s*value/
/** A wire assertion comparing declared keys against that read-back value. */
const ASSERTS_AGAINST_TYPED = /toEqual\(\s*\[\s*typed\s*\]\s*\)/g
/** Every occurrence of the module-scope constant, anywhere in code. */
const CONSTANT_USES = /\bKEY_TO_DECLARE\b/g

/** `vi.mock("<specifier>")` occurrences in code, with their specifiers. */
const VI_MOCK = /vi\s*\.\s*mock\s*\(\s*["'`]([^"'`]+)["'`]/g

describe("self-fence 1 — NEITHER the builder store NOR any @/lib/api module is mocked", () => {
  it("no vi.mock specifier names the store or an api module", () => {
    const specifiers = [...codeOnly(SOURCE).matchAll(VI_MOCK)].map((m) => m[1]!)
    // ⭐ THE ENUMERATION ITSELF IS THE CLAIM: every module mock in this file is named here,
    // and there is exactly ONE.
    expect(specifiers).toEqual(["@/lib/supabase"])
    for (const spec of specifiers) {
      expect(spec).not.toMatch(/builderStore/)
      expect(spec).not.toMatch(/@\/lib\/api(\/|$)/)
    }
  })

  it("POSITIVE CONTROL — the same regex MATCHES a planted store mock and a planted api mock", () => {
    const planted = [
      spell("vi", '.mock("@/components/workflows/builderStore", () => ({}))'),
      spell("vi", '.mock("@/lib/api", () => ({}))'),
      spell("vi", '.mock("@/lib/api/workflows", () => ({}))'),
    ].join("\r\n")
    const found = [...planted.matchAll(VI_MOCK)].map((m) => m[1]!)
    expect(found).toHaveLength(3)
    expect(found.some((s) => /builderStore/.test(s))).toBe(true)
    expect(found.filter((s) => /@\/lib\/api(\/|$)/.test(s))).toHaveLength(2)
  })
})

/** An array literal assigned to an `inputs` key. ⚠ CRLF-tolerant by construction — `\s`
 *  covers `\r`, which a hand-written `\n\n` would not, and this repo checks out CRLF. */
const HAND_BUILT_INPUTS = /\binputs\s*:\s*\[/

describe("self-fence 2 — no hand-built inputs array exists anywhere in this file", () => {
  it("the source constructs no inputs array literal", () => {
    expect(HAND_BUILT_INPUTS.test(codeOnly(SOURCE))).toBe(false)
  })

  it("POSITIVE CONTROL — the same regex MATCHES a planted literal, across a CRLF break", () => {
    const planted = spell(
      'const def = {\r\n  slug: "x",\r\n  ',
      "inputs",
      ': [\r\n    { key: "recipient" },\r\n  ],\r\n}',
    )
    expect(HAND_BUILT_INPUTS.test(planted)).toBe(true)
    // …and over the compact spelling too, so the fence is not tied to one formatting.
    expect(HAND_BUILT_INPUTS.test(spell("{", "inputs", ':[{key:"a"}]}'))).toBe(true)
  })
})

describe("self-fence 3 — the asserted key is READ FROM THE DOM, not from a constant", () => {
  it("the constant reaches the DOM and NOTHING else; every wire assertion reads the DOM back", () => {
    const code = codeOnly(SOURCE)

    // (a) The helper reads the value back OFF THE ELEMENT after typing it.
    expect(code).toMatch(READS_THE_ELEMENT)

    // (b) Both wire assertions compare against that read-back value.
    expect([...code.matchAll(ASSERTS_AGAINST_TYPED)].length).toBeGreaterThanOrEqual(2)

    // (c) ⭐ THE STRONGEST HALF: the module-scope constant occurs in code EXACTLY TWICE —
    // its own declaration, and the single `fireEvent.change` that types it into the input.
    // It is therefore structurally impossible for any assertion to read it. A third
    // occurrence is either a new assertion (which this fence exists to refuse) or a second
    // way for the value to enter, and both deserve a red.
    expect([...code.matchAll(CONSTANT_USES)].length).toBe(2)
  })

  it("POSITIVE CONTROL — each half MATCHES a planted violation and MISSES a clean line", () => {
    // ⚠ The token is ASSEMBLED so this control does not become the third occurrence (c)
    // counts. That is not pedantry: spelling it here is precisely how this fence's earlier
    // draft went red against itself.
    const name = spell("KEY_TO", "_DECLARE")
    const plantedAssertion = `expect(declaredKeysIn(body)).toEqual([${name}])\r\n`

    expect([...plantedAssertion.matchAll(CONSTANT_USES)].length).toBe(1)
    expect(ASSERTS_AGAINST_TYPED.test(plantedAssertion)).toBe(false)
    // …and (a)'s regex does NOT match a source that dropped the read-back.
    expect(READS_THE_ELEMENT.test(`const typed = ${name}\r\n`)).toBe(false)
    // …while it DOES match the shipped shape, across a CRLF break.
    expect(READS_THE_ELEMENT.test("  const typed =\r\n    field.value\r\n")).toBe(true)
  })
})
