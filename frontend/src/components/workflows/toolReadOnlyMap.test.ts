/**
 * Phase 209 (Item 2 · SC#2) — the mapping that decides whether a step may EVER say `ONLY READS`.
 *
 * ⚠ THE LAST TEST IN THIS FILE IS THE POINT. The unit cases below prove the rule; the source
 * assertion proves the Builder page actually CALLS it and threads the result into `nameContext`.
 * Without that, this suite is exactly the failure this phase already shipped once: a green half
 * whose join to the running app is dead, with a fixture supplying what the pipeline never does.
 */
import { describe, it, expect } from "vitest"

import pageSource from "@/pages/WorkflowBuilderPage?raw"
import { buildToolReadOnlyMap } from "./toolReadOnlyMap"
import type { ConnectorConnection } from "@/lib/api"

const conn = (over: Partial<ConnectorConnection>): ConnectorConnection =>
  ({ id: "c1", org_id: "o", name: "n", is_enabled: true, ...over }) as ConnectorConnection

describe("buildToolReadOnlyMap", () => {
  it("records an explicit true and an explicit false", () => {
    const map = buildToolReadOnlyMap([
      conn({
        id: "c1",
        discovered_tools: [
          { name: "read_wiki_structure", annotations: { readOnlyHint: true } },
          { name: "create_issue", annotations: { readOnlyHint: false } },
        ],
      }),
    ])
    expect(map).toEqual({ c1: { read_wiki_structure: true, create_issue: false } })
  })

  it("⚠ a tool with NO annotations contributes NO KEY — never a fabricated false", () => {
    // The DeepWiki shape, measured live 2026-08-25: read-verb names, zero annotations.
    const map = buildToolReadOnlyMap([
      conn({
        id: "c1",
        discovered_tools: [
          { name: "read_wiki_structure" },
          { name: "read_wiki_contents", annotations: {} },
          { name: "ask_question", annotations: { title: "Ask" } },
        ],
      }),
    ])
    // Not `{c1: {...: false}}` — ABSENT. `false` would claim the server said "this writes".
    expect(map).toEqual({})
  })

  it("⚠ never inspects the tool NAME — the exploit the first draft admitted", () => {
    const map = buildToolReadOnlyMap([
      conn({ id: "c1", discovered_tools: [{ name: "get_user_and_purge_records" }] }),
    ])
    expect(map).toEqual({})
  })

  it("a non-boolean hint is ignored", () => {
    const map = buildToolReadOnlyMap([
      conn({
        id: "c1",
        discovered_tools: [
          { name: "a", annotations: { readOnlyHint: "true" as unknown as boolean } },
          { name: "b", annotations: { readOnlyHint: 1 as unknown as boolean } },
        ],
      }),
    ])
    expect(map).toEqual({})
  })

  it("is TOTAL over malformed input", () => {
    expect(buildToolReadOnlyMap(undefined)).toEqual({})
    expect(buildToolReadOnlyMap(null)).toEqual({})
    expect(buildToolReadOnlyMap([])).toEqual({})
    expect(buildToolReadOnlyMap("nope" as unknown as ConnectorConnection[])).toEqual({})
    expect(buildToolReadOnlyMap([conn({ id: "" })])).toEqual({})
    expect(
      buildToolReadOnlyMap([
        conn({ id: "c1", discovered_tools: "x" as unknown as ConnectorConnection["discovered_tools"] }),
      ]),
    ).toEqual({})
    expect(
      buildToolReadOnlyMap([conn({ id: "c1", discovered_tools: [{ name: "  " }] })]),
    ).toEqual({})
  })

  it("keeps connections apart and trims ids and names", () => {
    const map = buildToolReadOnlyMap([
      conn({ id: " c1 ", discovered_tools: [{ name: " t ", annotations: { readOnlyHint: true } }] }),
      conn({ id: "c2", discovered_tools: [{ name: "t", annotations: { readOnlyHint: false } }] }),
    ])
    expect(map).toEqual({ c1: { t: true }, c2: { t: false } })
  })

  it("⚠ THE JOIN: WorkflowBuilderPage calls it and threads it into nameContext", () => {
    // A source assertion, the `canvasModel.purity.test.ts` idiom, because the alternative is
    // mounting the whole page behind a 30-symbol api factory. What this pins is precisely the
    // seam that failed twice in this phase: a resolver that works and a caller that never
    // feeds it. If the page stops importing, calling, or threading it, this goes red.
    expect(pageSource).toMatch(/import \{ buildToolReadOnlyMap \}/)
    expect(pageSource).toMatch(/setToolReadOnly\(buildToolReadOnlyMap\(connections\)\)/)
    // …and that the state actually reaches the context the canvas reads.
    expect(pageSource).toMatch(/^\s+toolReadOnly,$/m)
  })
})
