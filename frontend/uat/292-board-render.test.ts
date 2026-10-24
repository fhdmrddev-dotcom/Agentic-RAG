// @vitest-environment node
/**
 * Phase 292 (292-03, D-26) — verdict V2's FRONTEND half for the SC#10 board.
 *
 * Reads every `*.json` the board script (`scripts/run-292-board.py --run` / `--long`) wrote into the
 * directory named by `ARTIFACT_BOARD_EVIDENCE_292`, and runs the SHIPPED frontend guard
 * `parseArtifactRecord` over each item of its `reload_artifacts` array — the records
 * GET /threads/{id}/messages returned as the dev user after the run. One `it` per evidence file, so a
 * failing file fails only that provider row.
 *
 * It also reads the sibling `../crafted/crafted-bad-row.json` (`--craft-bad-row`), when present, and
 * asserts the guard REFUSES that stored diagram with `broken-link` (G4-4's non-browser half).
 *
 * Non-vacuity: when the env var is set, zero files or zero records is a FAILURE, never a pass.
 * When it is unset the whole describe is skipped, so a plain `npx vitest run` is unaffected.
 *
 * BY DECISION this lives under `frontend/uat/`, outside every count-gate TARGETS entry: it reads phase
 * EVIDENCE, not source, and its case count is the number of board runs — a number no plan controls.
 *
 * Run:
 *   cd frontend && ARTIFACT_BOARD_EVIDENCE_292="../.planning/phases/292-more-ways-to-show-it/evidence/board" \
 *     GSD_VITEST_MAX_WORKERS=2 npx vitest run uat/292-board-render.test.ts
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseArtifactRecord } from "../src/components/chat/artifacts/artifactSpec"

const DIR = process.env.ARTIFACT_BOARD_EVIDENCE_292
const NEW_TYPES = new Set(["diagram", "comparison", "timeline"])

function evidenceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
}

function itemsOf(file: string): unknown[] {
  const doc = JSON.parse(fs.readFileSync(file, "utf-8")) as { reload_artifacts?: unknown }
  return Array.isArray(doc.reload_artifacts) ? doc.reload_artifacts : []
}

function componentOf(item: unknown): string | null {
  return item && typeof item === "object" && typeof (item as { component?: unknown }).component === "string"
    ? (item as { component: string }).component
    : null
}

describe.skipIf(!DIR)("292 board — every reloaded artifact passes the frontend guard (verdict V2, guard half)", () => {
  const dir = path.resolve(DIR ?? ".")
  const files = DIR && fs.existsSync(dir) ? evidenceFiles(dir) : []

  it("reads at least one evidence file and at least one new-type record (non-vacuity)", () => {
    expect(fs.existsSync(dir), `evidence directory not found: ${dir}`).toBe(true)
    expect(files.length, `no *.json evidence in ${dir}`).toBeGreaterThan(0)
    const all = files.flatMap((f) => itemsOf(path.join(dir, f)))
    expect(all.length, `zero reload_artifacts records across ${files.length} file(s)`).toBeGreaterThan(0)
    expect(all.filter((x) => NEW_TYPES.has(componentOf(x) ?? "")).length, "zero diagram/comparison/timeline records").toBeGreaterThan(0)
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
          bad.push(`${f} · record ${id} (${componentOf(item) ?? "?"}) · ${res.reason}`)
        }
      }
      expect(bad, bad.join("\n")).toEqual([])
    })
  }

  const crafted = path.resolve(dir, "..", "crafted", "crafted-bad-row.json")
  it.skipIf(!fs.existsSync(crafted))("the crafted bad stored diagram is REFUSED with broken-link (G4-4)", () => {
    const items = itemsOf(crafted)
    expect(items.length).toBe(1)
    const res = parseArtifactRecord(items[0])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("broken-link")
  })
})
