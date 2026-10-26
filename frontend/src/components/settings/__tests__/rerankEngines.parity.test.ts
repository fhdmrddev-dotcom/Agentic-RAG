/**
 * Phase 294-04 (DEC-01) — the engine-card table and the backend engine registry are ONE list.
 *
 * `backend/app/services/rerank_engines/registry.py` declares `EngineId = Literal[...]` on one line
 * (its own docblock says this file reads it). It is read here from SOURCE (`?raw`), never retyped,
 * so adding an engine on one side alone fails this file instead of shipping a card the server
 * cannot run, or an engine the operator cannot pick.
 */
import { describe, expect, it } from "vitest"
import registrySource from "../../../../../backend/app/services/rerank_engines/registry.py?raw"
import { RERANK_ENGINES, engineFor } from "../rerankEngines"

function literalValues(source: string, name: string): string[] {
  const m = new RegExp(`^${name}\\s*=\\s*Literal\\[([^\\]]*)\\]`, "m").exec(source)
  if (!m) return []
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

describe("rerankEngines.ts == registry.py EngineId", () => {
  it("NON-VACUITY — the EngineId Literal was found in the backend source", () => {
    expect(literalValues(registrySource, "EngineId").length).toBeGreaterThanOrEqual(4)
  })

  it("the card ids equal the EngineId values (as sets)", () => {
    expect(RERANK_ENGINES.map((e) => e.id).sort()).toEqual(literalValues(registrySource, "EngineId").sort())
  })

  it("every card's default model is the registry's default model", () => {
    for (const e of RERANK_ENGINES) {
      expect(registrySource, `${e.id}: ${e.defaultModel}`).toContain(`default_model="${e.defaultModel}"`)
    }
  })

  it("only the probabilistic engines say they cut, steer and check citations", () => {
    for (const e of RERANK_ENGINES) {
      const spec = new RegExp(`"${e.id}": EngineSpec\\(([\\s\\S]*?)\\r?\\n    \\),`).exec(registrySource)
      expect(spec, `registry row for ${e.id}`).not.toBeNull()
      const body = spec![1]
      expect(body).toContain(`probabilistic=${e.cuts ? "True" : "False"}`)
      expect(body).toContain(`steering=${e.steering ? "True" : "False"}`)
      expect(body).toContain(`citation_check=${e.citationCheck ? "True" : "False"}`)
      expect(body).toContain(`hosted=${e.where === "hosted" ? "True" : "False"}`)
    }
  })
})

describe("engineFor", () => {
  // 296-04 (294-IN-05) REWRITTEN IN PLACE. It asserted every unknown id read as Cohere:
  //     expect(engineFor("nope").id).toBe("cohere")   (and undefined, null, "constructor")
  // That selected the Cohere card for an engine the server ignores. Only the legacy "api" id
  // means Cohere; anything else is no engine, so no card is selected.
  it("resolves only the legacy 'api' id to Cohere; any other unknown id is no engine", () => {
    expect(engineFor("api")?.id).toBe("cohere")
    expect(engineFor("frobnicate")).toBeNull()
    expect(engineFor("nope")).toBeNull()
    expect(engineFor(undefined)).toBeNull()
    expect(engineFor(null)).toBeNull()
    expect(engineFor("constructor")).toBeNull()
  })

  it("296-04 (294-LOCAL): the local row carries the latency note, naming the 30-second timeout", () => {
    const local = RERANK_ENGINES.find((e) => e.id === "local")!
    expect(local.latencyNote).toBe(
      "Slow on a CPU: about 18 seconds per search in our test. A search that runs past 30 seconds keeps today's order.",
    )
    for (const e of RERANK_ENGINES.filter((x) => x.id !== "local")) expect(e.latencyNote).toBeNull()
  })

  it("resolves each known id to its own row", () => {
    expect(engineFor("jev").name).toBe("Jev via OpenRouter")
    expect(engineFor("openai_decisions").name).toBe("OpenAI Decisions")
    expect(engineFor("local").name).toBe("On this server")
    expect(engineFor("cohere").name).toBe("Cohere")
  })

  it("keeps sketch 294 B's card order", () => {
    expect(RERANK_ENGINES.map((e) => e.name)).toEqual([
      "On this server",
      "Jev via OpenRouter",
      "OpenAI Decisions",
      "Cohere",
    ])
  })
})
