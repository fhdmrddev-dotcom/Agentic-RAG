/**
 * Phase 087 Wave 0 — VersionDiff contract (PANEL-07, D-04).
 *
 * GREEN-only scaffolding: VersionDiff is not built yet (Plan 04). The
 * `it.todo(...)` strings are the concrete assertions Plan 04 MUST flip to live
 * tests. Fixtures anchor the raw unified-diff string + both truncated and
 * non-truncated WorkspaceDiff payloads + the version list.
 *
 * 087-RESEARCH Open Question #1 (RESOLVED): the file→VersionDiff binding feeds
 * `getWorkspaceFileDiff(threadId, fileId, from, to)` and renders the parsed
 * `delta.diff` string client-side (no diff library).
 */
import { describe, it } from "vitest"
import {
  mockDiffString,
  mockDiffNonTruncated,
  mockDiffTruncated,
  mockVersions,
} from "./fixtures"

void mockDiffString
void mockDiffNonTruncated
void mockDiffTruncated
void mockVersions

describe("VersionDiff (PANEL-07) — client-side unified-diff parse + render", () => {
  it.todo("classifies '@@ …' lines as hunk headers (primary)")
  it.todo("classifies '+' (not '+++') lines as additions (green .dl.add, sign '+')")
  it.todo("classifies '-' (not '---') lines as deletions (red .dl.del, sign '−')")
  it.todo("classifies '--- vN' / '+++ vN' as file headers (meta, not add/del)")
  it.todo("classifies remaining lines as context (.dl.ctx)")
  it.todo("renders the fixed 16px sign gutter and scrolls-x rather than wrapping (diff illegibility guard)")
  it.todo("surfaces a 'diff truncated at 500 lines' notice when delta.truncated === true (Pitfall 4)")
  it.todo("renders the +N / −M summary from delta.stats")
  it.todo("renders version pills with red-base (.a) / green-target (.b) color coding (D5)")
  it.todo("defaults the comparison to the latest two versions (Compare v{n-1} ↔ v{n})")
  it.todo("the ⤢ overlay shows the SAME (still-truncated) payload — no second fetch (D4 / Pitfall 4)")
})
