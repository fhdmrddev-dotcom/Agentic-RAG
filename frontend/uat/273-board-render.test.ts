// @vitest-environment node
/**
 * Phase 273 (273-06, D-21) — verdict 2's FRONTEND half for the SC#10 board.
 *
 * Reads every `*.json` the board script (`scripts/run-273-board.py --run`) wrote into the directory
 * named by `ARTIFACT_BOARD_EVIDENCE`, and runs the SHIPPED frontend guard `parseArtifactRecord` over
 * each item of its `reload_artifacts` array — the records GET /threads/{id}/messages returned as the
 * dev user after the run. One `it` per evidence file, so a failing file fails only that provider row.
 *
 * Non-vacuity: when the env var is set, zero files or zero records is a FAILURE, never a pass.
 * When it is unset the whole describe is skipped, so a plain `npx vitest run` is unaffected.
 *
 * BY DECISION this lives under `frontend/uat/`, outside every count-gate TARGETS entry: it reads phase
 * EVIDENCE, not source, and its case count is the number of board runs — a number no plan controls.
 *
 * Run:
 *   cd frontend && ARTIFACT_BOARD_EVIDENCE="../.planning/phases/273-agent-authored-artifacts/evidence/board" \
 *     GSD_VITEST_MAX_WORKERS=2 npx vitest run uat/273-board-render.test.ts
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseArtifactRecord } from "../src/components/chat/artifacts/artifactSpec"

const DIR = process.env.ARTIFACT_BOARD_EVIDENCE

function evidenceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "board-summary.json")
    .sort()
}

function itemsOf(file: string): unknown[] {
  const doc = JSON.parse(fs.readFileSync(file, "utf-8")) as { reload_artifacts?: unknown }
  return Array.isArray(doc.reload_artifacts) ? doc.reload_artifacts : []
}

describe.skipIf(!DIR)("273 board — every reloaded artifact passes the frontend guard (verdict 2)", () => {
  const dir = path.resolve(DIR ?? ".")
  const files = DIR && fs.existsSync(dir) ? evidenceFiles(dir) : []

  it("reads at least one evidence file and at least one record (non-vacuity)", () => {
    expect(fs.existsSync(dir), `evidence directory not found: ${dir}`).toBe(true)
    expect(files.length, `no *.json evidence in ${dir}`).toBeGreaterThan(0)
    const total = files.reduce((n, f) => n + itemsOf(path.join(dir, f)).length, 0)
    expect(total, `zero reload_artifacts records across ${files.length} file(s)`).toBeGreaterThan(0)
  })

  for (const f of files) {
    it(`${f}: every reload_artifacts item parses ok`, () => {
      const bad: string[] = []
      for (const item of itemsOf(path.join(dir, f))) {
        const res = parseArtifactRecord(item)
        if (!res.ok) {
          const id =
            item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
              ? (item as { id: string }).id
              : "(no id)"
          bad.push(`${f} · record ${id} · ${res.reason}`)
        }
      }
      expect(bad, bad.join("\n")).toEqual([])
    })
  }
})
