/**
 * Phase 289 (I1) — the RunEvidence TS type matches the shared wire-contract fixture.
 *
 * Plans 03 (backend) and 04 (frontend) built the evidence read in parallel against the
 * contract block in 289-03-PLAN.md. `backend/tests/unit/test_289_evidence_contract.py` pins
 * the Pydantic half against the SAME fixture file read here, so a field renamed on either
 * side fails one of the two.
 *
 * Two layers, both load-bearing:
 *   1. `SAMPLE` is declared with `satisfies RunEvidence`, fully populated (every nullable
 *      nested object present, one element in every array). `tsc -p tsconfig.app.json` (which
 *      includes `src`, tests too) rejects a missing or an extra field at compile time.
 *   2. At run time each object path's key set of `SAMPLE` must equal the fixture's list, so
 *      the TYPE and the CONTRACT are compared, not the type with itself.
 *
 * A failure means the frontend departed from the contract: fix the type, never the fixture.
 */
import { describe, expect, it } from "vitest"
import contractRaw from "../../../../../backend/tests/fixtures/phase289/run_evidence_contract.json?raw"
import type { RunEvidence } from "../runEvidence"

const contract = JSON.parse(contractRaw) as { paths: Record<string, string[]> }

const SAMPLE = {
  run: {
    id: "229f45ae-c85e-4707-a46c-bf4787541547",
    status: "completed",
    workflow_name: "Weekly summary",
    started_at: "2026-10-19T18:50:52Z",
    completed_at: "2026-10-19T18:53:36Z",
    started_by: { name: "Dana Whitfield", email: "dana@example.test", is_you: true },
    org_name: "Example Org",
    model: "deepseek-v4-flash",
    viewer_is_owner: true,
    thread_id: "bed19e8c-fc59-4598-ae05-2ec7604cf271",
    // 295-05 (D-22): why a failed or cancelled run stopped, server-resolved; null otherwise.
    end_reason: null,
    // 293-03 (D-22): how the run started, as recorded; null when it was not.
    origin: { kind: "key", label: "n8n-prod", actor_name: null },
  },
  definition: {
    recorded: true,
    version: 1,
    phases: [{ n: 1, slug: "research", name: "Find the evidence", phase_type: "llm_agent" }],
    full: { name: "Weekly summary" },
  },
  definition_changed: { changed: true, current_version: 2 },
  kb_label: "Weekly reports",
  deliverable: { kind: "file", name: "summary.docx", file_id: "f-1" },
  phase_log: [
    {
      n: 1,
      slug: "research",
      name: "Find the evidence",
      phase_type: "llm_agent",
      status: "completed",
      started_at: "2026-10-19T18:50:52Z",
      completed_at: "2026-10-19T18:51:09Z",
      step_count: 5,
      step_noun: "sources",
      output_text: "Three points.",
      failure_reason: null,
      confidence: {
        level: "medium",
        avg_similarity: 0.4951,
        disclaimer: null,
        passages: 5,
        kb_label: "Weekly reports",
      },
      human_input: { answered: true, question: "Approve?", answer: "Yes", answered_by: "Dana" },
      // 295-05 (D-04): the mark on a step kept without sources; the words are viewer-aware.
      unsourced: { continued_by: "Dana Whitfield (you)", at: "2026-10-19T18:51:09Z" },
    },
  ],
  verdicts: [
    {
      step_n: 1,
      phase_slug: "research",
      kind: "gate_passed",
      result: "passed",
      checked: ["citations_required"],
      at: "2026-10-19T18:51:09Z",
    },
  ],
  sources: [
    { masked: false, document_id: "d-1", filename: "kb_doc1.md", locations: [0, 1], cited_by: [1] },
  ],
} satisfies RunEvidence

/** Walk SAMPLE the way the backend test walks the Pydantic models: an object's keys at its
 *  path, an array's first element at `<path>[]`. */
function samplePaths(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      if (value.length > 0) walk(value[0], `${path}[]`)
      return
    }
    if (value === null || typeof value !== "object") return
    out[path] = Object.keys(value).sort()
    for (const [k, v] of Object.entries(value)) {
      // `definition.full` is an opaque dict on the wire, not a contract object.
      if (path === "definition" && k === "full") continue
      walk(v, path === "$" ? k : `${path}.${k}`)
    }
  }
  walk(SAMPLE, "$")
  return out
}

describe("289 I1 — RunEvidence matches the shared contract fixture", () => {
  it("the fixture names the fourteen object paths of the contract", () => {
    expect(Object.keys(contract.paths).sort()).toEqual(
      [
        "$",
        "run",
        "run.started_by",
        "run.origin",
        "definition",
        "definition.phases[]",
        "definition_changed",
        "deliverable",
        "phase_log[]",
        "phase_log[].confidence",
        "phase_log[].human_input",
        "phase_log[].unsourced",
        "verdicts[]",
        "sources[]",
      ].sort(),
    )
  })

  it("the fully populated `satisfies RunEvidence` sample has exactly the contract's keys, path by path", () => {
    const sample = samplePaths()
    expect(Object.keys(sample).sort()).toEqual(Object.keys(contract.paths).sort())
    for (const [path, names] of Object.entries(contract.paths)) {
      expect({ path, keys: sample[path] }).toEqual({ path, keys: [...names].sort() })
    }
  })

  it("non-vacuity: a renamed key would not match", () => {
    const renamed = { ...SAMPLE.sources[0], file_name: "x" } as Record<string, unknown>
    delete renamed.filename
    expect(Object.keys(renamed).sort()).not.toEqual([...contract.paths["sources[]"]].sort())
  })
})
