/**
 * Phase 284 (FIX-11, D-16 / T-284-31) — no product code may ask for the whole library.
 *
 * Before 284 the Library, every picker and the detail panel's lists called whole-list clients
 * (`listDocuments()`, `listDocumentChunks(id)`, …) that downloaded every row the server would
 * send — and the server silently stopped at PostgREST's 1,000 rows (BUG-261014-07). 284-01..04
 * moved every caller onto a paged client or `POST /document-search`; 284-05 deletes the five
 * whole-list clients. This fence keeps them gone: over every product `.ts` / `.tsx` file under
 * `src/` (tests, `__tests__/`, `*.testutil.ts` and `test-utils/` excluded), comments stripped
 * with the SHARED stripper, it fails on
 *
 *   - a CALL of any retired name — `listDocuments(`, `listDocumentChunks(`, `listDocumentTables(`,
 *     `listDocumentImages(`, `fetchDocumentVersions(` (a definition is a call to this regex too,
 *     which is the point: the function may not exist);
 *   - an IMPORT or RE-EXPORT of one of those names (`import { listDocuments } …`, a barrel line);
 *   - an unparameterised list fetch — `` fetch(`${API_BASE}/documents` `` whose template closes
 *     right after `/documents` (no `?offset=…&limit=…`, no `/<id>`).
 *
 * The paged clients (`listDocumentsPage`, `listDocumentChunksPage`, …) are not matched: every
 * pattern needs the bare name followed by `(` or a list delimiter. The one-release legacy-ARRAY
 * tolerance inside the paged clients is not a whole-list call and is not forbidden here.
 *
 * ⛔ The planted-source case is PERMANENT (the throwaway-router idea from 284-04's route
 * inventory): it runs the detector over an in-memory source and asserts it is named, so a
 * detector that silently stopped matching reds here instead of passing over everything.
 */
import { describe, expect, it } from "vitest"

import { stripComments } from "@/lib/stripComments.testutil"

const RAW = import.meta.glob("../../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/** `src/`-relative path for a glob key (Vite normalises keys to different depths). */
const HERE = "src/lib/__tests__"
const rel = (key: string): string => {
  const out = HERE.split("/")
  for (const seg of key.replace(/\\/g, "/").split("/")) {
    if (seg === "..") out.pop()
    else if (seg !== "." && seg !== "") out.push(seg)
  }
  return out.join("/").replace(/^src\//, "")
}

const isProductFile = (path: string): boolean => {
  if (/\.test\.tsx?$/.test(path)) return false
  if (path.includes("__tests__/")) return false
  if (/\.testutil\.tsx?$/.test(path)) return false
  if (path.startsWith("test-utils/") || path.includes("/test-utils/")) return false
  if (path === "setupTests.ts") return false
  return true
}

/** The five whole-list clients 284-05 deleted (D-16). */
const RETIRED = [
  "listDocuments",
  "listDocumentChunks",
  "listDocumentTables",
  "listDocumentImages",
  "fetchDocumentVersions",
] as const

const CALL = new RegExp(`\\b(${RETIRED.join("|")})\\s*\\(`, "g")
const NAMED_LIST = /\b(?:import|export)\s+(?:type\s+)?\{([^}]*)\}/g
const UNPARAMETERISED_LIST = /fetch\(\s*`\$\{API_BASE\}\/documents`/g

/** Every whole-list finding in one source text, named so a failure says what and where. */
function wholeListFindings(path: string, source: string): string[] {
  const code = stripComments(source)
  const out: string[] = []
  for (const m of code.matchAll(CALL)) out.push(`${path}: calls ${m[1]}(`)
  for (const m of code.matchAll(NAMED_LIST)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "").trim()
      if ((RETIRED as readonly string[]).includes(name)) out.push(`${path}: imports or re-exports ${name}`)
    }
  }
  for (const _m of code.matchAll(UNPARAMETERISED_LIST)) out.push(`${path}: unparameterised fetch of /documents`)
  return out
}

const PRODUCT = Object.entries(RAW)
  .map(([key, src]) => [rel(key), src] as const)
  .filter(([path]) => isProductFile(path))

describe("D-16 — no product code asks for the whole library", () => {
  it("self-guard: the sweep loaded the tree and the stripper strips", () => {
    expect(Object.keys(RAW).length).toBeGreaterThan(200)
    expect(PRODUCT.length).toBeGreaterThan(200)
    const paths = PRODUCT.map(([p]) => p)
    expect(paths).toContain("lib/api/documents.ts")
    expect(paths).toContain("lib/api.ts")
    expect(paths).toContain("components/relationships/CreateLinkDialog.tsx")
    expect(paths.some((p) => p.includes("__tests__/") || /\.test\./.test(p))).toBe(false)
    expect(stripComments("// listDocuments()\n/* listDocuments() */ok")).not.toContain("listDocuments")
  })

  it("⛔ planted source: the detector names a whole-list import, call and fetch (permanent self-test)", () => {
    const planted = [
      `import { listDocuments } from "@/lib/api"`,
      `export function Picker() { return listDocuments() }`,
      "const r = fetch(`${API_BASE}/documents`, { headers })",
      "const ok = fetch(`${API_BASE}/documents?offset=0&limit=25`)",
      `// listDocumentChunks(id) — a comment is not a call`,
      `listDocumentsPage({ offset: 0, limit: 25 })`,
    ].join("\n")
    expect(wholeListFindings("components/planted/Picker.tsx", planted)).toEqual([
      "components/planted/Picker.tsx: calls listDocuments(",
      "components/planted/Picker.tsx: imports or re-exports listDocuments",
      "components/planted/Picker.tsx: unparameterised fetch of /documents",
    ])
  })

  it("no product file calls, imports or defines a whole-list client", () => {
    const findings = PRODUCT.flatMap(([path, src]) => wholeListFindings(path, src)).sort()
    expect(findings).toEqual([])
  })
})
