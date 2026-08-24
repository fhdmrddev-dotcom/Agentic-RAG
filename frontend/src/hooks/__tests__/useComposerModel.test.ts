/**
 * Phase 196 Plan 07 Task 3 (D-18 / BUG-260718-04) — the per-thread model restore.
 *
 * Shape: the co-located hook test with a module-stubbed api client, whose stub SPREADS the
 * real module and overrides exactly one export — so completeness is automatic rather than
 * an enumeration somebody has to remember to extend. Same shape as `useModelRegistry.test.ts`
 * one directory over.
 *
 * ⚠ WHAT THIS SUITE CAN AND CANNOT PROVE. It proves the DERIVATION — which model a thread
 * resolves to, from which messages, under which disabled set, applied in which order. It
 * CANNOT prove *"a thread restores its model across a page REFRESH"*, because jsdom has no
 * page reload: a hook test exercises a derivation, never a lifecycle. That claim is G-4 row
 * U-C1 in `196-VALIDATION.md`, driven by Chrome MCP at phase verification, and a green run
 * here must not be read as discharging it.
 *
 * ⚠ THE ORDERING CASE IS ASSERTED AS AN ORDER, NOT AS AN END STATE. React batches the two
 * setState calls, so an end-state assertion would pass equally well against a reversed
 * implementation right up until `handleProviderChange` ran in production. The order is
 * therefore pinned on the exported pure function that the hook itself calls, where the
 * sequence is observable — a real guard rather than a hopeful one.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

import { getProviders } from "@/lib/api"

import {
  useComposerModel,
  deriveLastUsedModel,
  resolveRestoreTarget,
  applyRestoreInOrder,
  type ComposerProvider,
  type ComposerRestoreMessage,
} from "../useComposerModel"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, getProviders: vi.fn() }
})

const mockedGetProviders = vi.mocked(getProviders)

// ── fixtures ──────────────────────────────────────────────────────────────────

const OPENAI: ComposerProvider = {
  id: "openai",
  name: "OpenAI",
  models: ["gpt-5.4", "gpt-5.5"],
  is_active: true,
}
const ANTHROPIC: ComposerProvider = {
  id: "anthropic",
  name: "Anthropic",
  models: ["claude-5-sonnet", "claude-5-haiku"],
  is_active: false,
}

const PROVIDERS = [OPENAI, ANTHROPIC]

/** The global default seed — the rung the restore PREPENDS to, never replaces. */
const GLOBAL_DEFAULT = "gpt-5.4"

function payload(over: Partial<Awaited<ReturnType<typeof getProviders>>> = {}) {
  return {
    active: "openai",
    active_model: GLOBAL_DEFAULT,
    providers: PROVIDERS,
    deprecated_models: [],
    disabled_models: [],
    ...over,
  }
}

/** A user-role message: it has no run row, so it carries NO model. */
const USER_MSG: ComposerRestoreMessage = {}

function assistantMsg(model: string | undefined, provider?: string): ComposerRestoreMessage {
  return { model, provider }
}

function renderComposer(
  threadId: string | null,
  messages: ComposerRestoreMessage[],
) {
  return renderHook(
    ({ t, m }: { t: string | null; m: ComposerRestoreMessage[] }) => useComposerModel(t, m),
    { initialProps: { t: threadId, m: messages } },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetProviders.mockResolvedValue(payload())
})

// ── the pure derivation ───────────────────────────────────────────────────────

describe("deriveLastUsedModel — which message the thread's model comes from", () => {
  it("takes the LAST run-backed message, not the first", () => {
    const derived = deriveLastUsedModel([
      assistantMsg("gpt-5.4", "openai"),
      assistantMsg("gpt-5.5", "openai"),
    ])
    expect(derived).toEqual({ model: "gpt-5.5", provider: "openai" })
  })

  it("skips messages whose model is undefined — user-role rows carry no run", () => {
    // ⚠ NON-VACUITY: the undefined rows are AFTER the run-backed one, so a derivation that
    // simply took the last element would return null and fail here.
    const derived = deriveLastUsedModel([
      assistantMsg("gpt-5.5", "openai"),
      USER_MSG,
      USER_MSG,
    ])
    expect(derived).toEqual({ model: "gpt-5.5", provider: "openai" })
  })

  it("skips the literal \"unknown\" — 121 live runs rows carry it", () => {
    const derived = deriveLastUsedModel([
      assistantMsg("gpt-5.5", "openai"),
      assistantMsg("unknown", "openai"),
    ])
    expect(derived).toEqual({ model: "gpt-5.5", provider: "openai" })
  })

  it("resolves to null when NOTHING in the thread is run-backed", () => {
    expect(deriveLastUsedModel([USER_MSG, assistantMsg("unknown"), USER_MSG])).toBeNull()
    expect(deriveLastUsedModel([])).toBeNull()
  })
})

describe("resolveRestoreTarget — the enabled rung and the offered rung", () => {
  const base = { providers: PROVIDERS, disabledModels: new Set<string>() }

  it("resolves a run-backed, offered, enabled model to its provider and model", () => {
    expect(
      resolveRestoreTarget({ ...base, messages: [assistantMsg("gpt-5.5", "openai")] }),
    ).toEqual({ provider: "openai", model: "gpt-5.5" })
  })

  it("REFUSES a model in disabledModels — D-07's rule, not a second one", () => {
    expect(
      resolveRestoreTarget({
        ...base,
        disabledModels: new Set(["gpt-5.5"]),
        messages: [assistantMsg("gpt-5.5", "openai")],
      }),
    ).toBeNull()
  })

  it("recovers the provider when the message carries a model but no provider", () => {
    expect(
      resolveRestoreTarget({ ...base, messages: [assistantMsg("claude-5-haiku", undefined)] }),
    ).toEqual({ provider: "anthropic", model: "claude-5-haiku" })
  })

  it("REFUSES a model no configured provider offers — the picker could not display it", () => {
    expect(
      resolveRestoreTarget({ ...base, messages: [assistantMsg("retired-model", "openai")] }),
    ).toBeNull()
  })
})

describe("applyRestoreInOrder — provider BEFORE model", () => {
  it("calls setProvider FIRST and setModel SECOND, asserted as a SEQUENCE", () => {
    const order: string[] = []
    applyRestoreInOrder(
      { provider: "openai", model: "gpt-5.5" },
      {
        setProvider: (id) => order.push(`provider:${id}`),
        setModel: (m) => order.push(`model:${m}`),
      },
    )
    // ⚠ An end-state assertion would pass against a REVERSED implementation. This is the
    // guard that makes a future reversal fail here rather than in production, where
    // handleProviderChange would silently clobber the restored model back to models[0].
    expect(order).toEqual(["provider:openai", "model:gpt-5.5"])
  })
})

// ── the hook ──────────────────────────────────────────────────────────────────

describe("useComposerModel — the restore, end to end", () => {
  it("restores a thread's last-used model AND its provider", async () => {
    const { result } = renderComposer("t1", [
      USER_MSG,
      assistantMsg("claude-5-haiku", "anthropic"),
    ])

    await waitFor(() => expect(result.current.status).toBe("ready"))
    await waitFor(() => expect(result.current.selectedModel).toBe("claude-5-haiku"))
    expect(result.current.selectedProvider).toBe("anthropic")
    // The offered list must follow the provider, or the picker renders a selection that
    // has no matching option.
    expect(result.current.models).toEqual(ANTHROPIC.models)
  })

  it("walks backwards past undefined and \"unknown\" rows", async () => {
    const { result } = renderComposer("t1", [
      assistantMsg("gpt-5.5", "openai"),
      assistantMsg("unknown", "openai"),
      USER_MSG,
    ])

    await waitFor(() => expect(result.current.selectedModel).toBe("gpt-5.5"))
  })

  it("falls back when the last-used model is DISABLED — it never becomes the selection", async () => {
    mockedGetProviders.mockResolvedValue(payload({ disabled_models: ["gpt-5.5"] }))

    const { result } = renderComposer("t1", [assistantMsg("gpt-5.5", "openai")])

    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.disabledModels.has("gpt-5.5")).toBe(true)
    expect(result.current.selectedModel).toBe(GLOBAL_DEFAULT)
    expect(result.current.selectedModel).not.toBe("gpt-5.5")
  })

  it("a thread with NO run-backed message keeps the global default — a SUCCESS, not a failure", async () => {
    const { result } = renderComposer("t1", [USER_MSG, USER_MSG])

    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.selectedModel).toBe(GLOBAL_DEFAULT)
    expect(result.current.selectedProvider).toBe("openai")
  })

  it("a FAILED providers read resolves to a distinct reading, never an empty success", async () => {
    mockedGetProviders.mockRejectedValue(new Error("offline"))

    const { result } = renderComposer("t1", [assistantMsg("gpt-5.5", "openai")])

    await waitFor(() => expect(result.current.status).toBe("failed"))
    // ⚠ The point of the case: `models: []` with `status: "ready"` would be a calm, correct-
    // LOOKING composer offering nothing. `failed` is what makes the two distinguishable.
    expect(result.current.status).not.toBe("ready")
    expect(result.current.models).toEqual([])
  })

  it("switching provider AFTER a restore still clobbers to that provider's first model", async () => {
    const { result } = renderComposer("t1", [assistantMsg("gpt-5.5", "openai")])

    await waitFor(() => expect(result.current.selectedModel).toBe("gpt-5.5"))

    act(() => result.current.handleProviderChange("anthropic"))

    // Shipped behaviour, unchanged: a model id is not portable across providers, so the
    // model resets to that provider's FIRST — `claude-5-sonnet`, not the `claude-5-haiku`
    // used elsewhere in this file. Written out because an earlier draft of this case
    // asserted haiku and the implementation was right.
    expect(result.current.selectedProvider).toBe("anthropic")
    expect(result.current.selectedModel).toBe(ANTHROPIC.models[0])
    expect(result.current.selectedModel).toBe("claude-5-sonnet")
    expect(result.current.models).toEqual(ANTHROPIC.models)
  })

  it("does NOT re-clobber a deliberate user choice when a later message arrives", async () => {
    // The restore is a SEED, not a policy. A thread with nothing to restore from, where the
    // user picks a model, must not have that choice overwritten the moment the assistant's
    // reply lands carrying a different model.
    const { result, rerender } = renderComposer("t1", [USER_MSG])

    await waitFor(() => expect(result.current.status).toBe("ready"))
    act(() => result.current.setSelectedModel("gpt-5.5"))
    expect(result.current.selectedModel).toBe("gpt-5.5")

    rerender({ t: "t1", m: [USER_MSG, assistantMsg("gpt-5.4", "openai")] })

    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.selectedModel).toBe("gpt-5.5")
  })

  it("restores again for a DIFFERENT thread — the seed is per-thread, not per-mount", async () => {
    const { result, rerender } = renderComposer("t1", [assistantMsg("gpt-5.5", "openai")])

    await waitFor(() => expect(result.current.selectedModel).toBe("gpt-5.5"))

    rerender({ t: "t2", m: [assistantMsg("claude-5-haiku", "anthropic")] })

    await waitFor(() => expect(result.current.selectedModel).toBe("claude-5-haiku"))
    expect(result.current.selectedProvider).toBe("anthropic")
  })
})
