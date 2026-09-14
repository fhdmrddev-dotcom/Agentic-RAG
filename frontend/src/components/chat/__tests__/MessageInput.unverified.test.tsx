/**
 * Phase 249 Plan 02 (MODEL-05 / SEED-135) — the unverified warning AT PICK TIME.
 *
 * ── THE DEFECT WAS A LOCATION, NOT A MISSING FEATURE ────────────────────────────────
 *
 * The amber `unverified` chip has existed since Phase 075.3 — in `ModelPillRow`, on the SETTINGS
 * page. The chat composer's model dropdown, which is where a model is actually CHOSEN, rendered
 * `deprecated` and `active` and had no such marker at all. So the warning lived on the screen
 * where you configure and was absent on the screen where you pick.
 *
 * ── WHY THE WORDS MATTER AS MUCH AS THE CHIP ────────────────────────────────────────
 *
 * An unregistered id resolves `capability_source="inferred"`. If its inferred provider is outside
 * `_NATIVE_TOOL_PROVIDERS`, the model runs in STRUCTURED mode: the `tools` param is never sent,
 * every tool is unavailable, and any tool call the model attempts arrives as prose the parser
 * cannot read — the loop then breaks after one iteration with no error anywhere.
 *
 * ⭐ `config.py` learned to SAY that, out loud, on 2026-08-18 — after that exact failure stayed
 * invisible for a day behind a log line reading `safe_defaults_applied=True`. A chip that says
 * only "unverified" repeats that mistake one surface up, so case 3 pins the consequence text.
 *
 * ── ⛔ AND ONE CASE PINS THAT THIS IS NOT A REFUSAL ─────────────────────────────────
 *
 * `D-122-05` makes a registry miss degrade to `coerce` BY DESIGN and that default is correct.
 * `SEED-135`: *"That default is CORRECT and must not change; what is missing is that the
 * degradation is invisible to the person who caused it."* The pick still works.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { MessageInput } from "../MessageInput"

afterEach(cleanup)

const MODELS = ["gpt-4o", "my-db-only-model", "llama-4-scout-local"]

/** Render the composer with a model picker wired, then OPEN the dropdown — a person has to open
 *  it to pick, so a fence that asserts against the closed trigger asserts against nothing. */
async function openPicker(props: Record<string, unknown> = {}) {
  const onModelChange = vi.fn()
  render(
    <MessageInput
      onSend={vi.fn()}
      disabled={false}
      providers={[{ id: "openai", name: "OpenAI", models: MODELS, is_active: true }]}
      selectedProvider="openai"
      models={MODELS}
      selectedModel="gpt-4o"
      onModelChange={onModelChange}
      onProviderChange={vi.fn()}
      {...props}
    />,
  )
  const trigger = screen.getByText("gpt-4o", { selector: "span" })
  await userEvent.click(trigger)
  await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy())
  return { onModelChange }
}

/** The row for one model inside the open dropdown. */
function rowFor(model: string): HTMLElement {
  const items = screen.getAllByRole("menuitem")
  const hit = items.find((el) => el.textContent?.includes(model))
  if (!hit) throw new Error(`no dropdown row for "${model}"`)
  return hit
}

const VERIFIED = new Set(["gpt-4o", "my-db-only-model"])
const INFERRED = { "llama-4-scout-local": "ollama" }
const TOOLS_LOST = new Set(["llama-4-scout-local"])

describe("MODEL-05 — the model picker warns about an unregistered model", () => {
  it("renders the unverified chip on a model absent from the verified set", async () => {
    await openPicker({
      verifiedModels: VERIFIED,
      inferredProviderFor: INFERRED,
      toolsLostModels: TOOLS_LOST,
    })

    expect(rowFor("llama-4-scout-local").textContent).toContain("unverified")
  })

  it("⛔ renders NO chip on a registered model", async () => {
    // The negative arm. Without it the fence would pass against a chip rendered on every row.
    await openPicker({
      verifiedModels: VERIFIED,
      inferredProviderFor: INFERRED,
      toolsLostModels: TOOLS_LOST,
    })

    expect(rowFor("gpt-4o").textContent).not.toContain("unverified")
  })

  it("⭐ renders NO chip on a model the OPERATOR added through the registry", async () => {
    // The MODEL-04 ↔ MODEL-05 interaction, fenced. `my-db-only-model` has no built-in capability
    // row — it exists only as an override the operator typed — and the backend's verified set is
    // a UNION for exactly this reason. Fixing MODEL-04 must not light MODEL-05's warning.
    await openPicker({
      verifiedModels: VERIFIED,
      inferredProviderFor: INFERRED,
      toolsLostModels: TOOLS_LOST,
    })

    expect(rowFor("my-db-only-model").textContent).not.toContain("unverified")
  })

  it("⭐ the chip states the CONSEQUENCE when tool calling will be lost", async () => {
    await openPicker({
      verifiedModels: VERIFIED,
      inferredProviderFor: INFERRED,
      toolsLostModels: TOOLS_LOST,
    })

    const chip = rowFor("llama-4-scout-local").querySelector("[title]")
    const text = `${chip?.getAttribute("title") ?? ""} ${chip?.getAttribute("aria-label") ?? ""}`
    expect(text).toMatch(/tool calling is DISABLED/i)
    expect(text).toMatch(/structured mode/i)
    // …and it says what to DO, not only what is wrong.
    expect(text).toMatch(/Model Registry/i)
  })

  it("does NOT claim tool loss for an unverified model whose provider supports tools", async () => {
    // Same chip, different sentence. Claiming a consequence the server did not report would be
    // the mirror of the defect — a warning that is wrong is worse than one that is absent.
    await openPicker({
      verifiedModels: new Set(["gpt-4o"]),
      inferredProviderFor: { "llama-4-scout-local": "openai" },
      toolsLostModels: new Set<string>(),
    })

    const chip = rowFor("llama-4-scout-local").querySelector("[title]")
    expect(chip?.getAttribute("title")).not.toMatch(/tool calling is DISABLED/i)
  })

  it("⛔ the unverified model is STILL SELECTABLE — a warning, never a refusal", async () => {
    const { onModelChange } = await openPicker({
      verifiedModels: VERIFIED,
      inferredProviderFor: INFERRED,
      toolsLostModels: TOOLS_LOST,
    })

    await userEvent.click(rowFor("llama-4-scout-local"))
    expect(onModelChange).toHaveBeenCalledWith("llama-4-scout-local")
  })

  it("an older backend that sends no verified set marks NOTHING", async () => {
    // ⚠ Silence must degrade to NO CLAIM, never to a false one. An empty/absent verified set
    // means "we were not told", and treating that as "nothing is registered" would flag every
    // model in the product — a warning on everything is a warning on nothing.
    await openPicker({})

    for (const m of MODELS) {
      expect(rowFor(m).textContent).not.toContain("unverified")
    }
  })
})
