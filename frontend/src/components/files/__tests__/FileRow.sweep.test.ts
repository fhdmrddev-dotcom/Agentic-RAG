/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PHASE 195 PLAN 07 — THE SC#2 SOURCE SWEEP.
 *
 * **SC#2 is: *no second file UI*.** Concretely — after Phase 195 there is exactly
 * ONE byte formatter, exactly ONE per-extension icon path and exactly ONE row
 * markup in this tree, and the three shipped surfaces (the workflow run page, the
 * workspace panel's file list and chat's output-file card) all render through
 * them rather than through copies of them.
 *
 * ⚠ **THIS FILE IS THE ONLY ARTEFACT THAT CHECKS THAT.** Before Phase 195, THREE
 *   of the four sources it reads were swept by NOTHING:
 *
 *     `frontend/src/pages/WorkflowRunPage.tsx`          — had a source fence
 *     `frontend/src/components/panel/FilesSection.tsx`  — ⚠ swept by nothing
 *     `frontend/src/components/chat/OutputFileCard.tsx` — ⚠ swept by nothing
 *     `frontend/src/lib/fileIcon.tsx`                   — ⚠ swept by nothing
 *
 *   Plans 195-04/05/06 converted all three surfaces onto `components/files/FileRow`.
 *   Their suites prove each surface still RENDERS correctly; not one of them proves
 *   a SECOND formatter, glyph map or row root has not been re-introduced beside the
 *   shared one. Without this file, SC#2 is believed rather than measured.
 *
 * ── ⚠ WHY THE GUARDS BELOW ARE NOT CEREMONY ──────────────────────────────────
 *
 * Every SC#2 arm here is an ABSENCE assertion, and an absence assertion run over
 * an empty string passes. Phase 192.1 shipped exactly that: `librarySubtree.fences`
 * swept a renamed module against `""` — one sweep at a time, silently, green
 * (`librarySubtree.fences.test.ts:164-184` records it in its own words; the audit
 * found three fences defending nothing, one of them sweeping the empty string).
 *
 * So this file guards itself THREE ways, and each is provable-by-plant:
 *   1. **length** — every `?raw` import asserts a non-trivial character count;
 *   2. **identity** — and a symbol that ONLY that file contains, because a
 *      non-empty sweep of the WRONG file is the same bug
 *      (`StopControl.baseline.test.tsx:575-582`);
 *   3. **a stripper non-vacuity pair per file** — a token that exists only in that
 *      file's PROSE, asserted present in `source` and absent from `code`. A
 *      `codeOf` that returned `""` would make every arm below pass; this pair is
 *      the one thing that reds when it does. (`195-PATTERNS.md` proposed this as a
 *      27th plant; it is ADOPTED here and driven in 195-07 task 2.)
 *
 * ── ⚠ WHY THE ARMS READ `codeOf(source)` AND NEVER THE RAW BYTES ─────────────
 *
 * The 187-24 trap, hit six times in this repository: a module that DOCUMENTS why a
 * symbol is absent reds a raw grep for that symbol. It is not hypothetical here —
 * measured on this exact corpus:
 *
 *   · `FilesSection.tsx` names `@/lib/fileIcon`, `FileSpreadsheet`, `FileCode` and
 *     `FileImage` in its CORRECTION-2 docblock, and imports none of them;
 *   · `WorkflowRunPage.tsx` contains the literal `1024` — inside the prose
 *     `types/index.ts:1024`, not in any byte arithmetic;
 *   · `fileIcon.tsx` names `codeExts` and `iconFor` in prose while declaring
 *     neither.
 *
 * A raw sweep would red on all three, i.e. on the explanations rather than on a
 * defect — and the only way to make it green would be to delete the explanations.
 *
 * ── ⚠ THE STRIPPER: USE THE LINE-ANCHORED FORM ───────────────────────────────
 *
 * Two incompatible `codeOf` implementations ship in this tree. The one used here is
 * `WorkflowRunPage.test.tsx:1337` / `WorkspacePanel.test.tsx`, whose line-comment
 * arm is anchored to the start of a line. The `ChatLayout.launch.test.tsx:458`
 * variant is NOT anchored, so it eats from any `//` to end-of-line — including the
 * `//` inside a string literal. That matters concretely and was checked, not
 * assumed: `OutputFileCard.tsx` carries `url.startsWith("/")` plus
 * `"/sandbox-outputs/…"`-shaped strings, and `fileIcon.tsx` carries mime literals.
 * The unanchored form would silently eat live code and turn every `not.toContain`
 * below into a pass.
 *
 * ── THE RECORDED BOUNDARY — the two presentations this sweep DELIBERATELY skips ─
 *
 * Stated here so a future SC#2 dispute ("you left a fifth one") is a recorded
 * decision rather than an omission:
 *
 *   · `frontend/src/lib/fileIcons.tsx` (plural) — the DOCUMENTS/governance
 *     `getFileIcon`. Out of scope: it serves the document-library surfaces, not the
 *     produced-file presentation RUN-03 names, and no Phase-195 plan touches it.
 *     SC#2's subject is "the file a run produced", and that module never renders one.
 *   · `frontend/src/components/panel/SeamCard.tsx` — ⚠ **the FIFTH presentation,
 *     which 195-CONTEXT.md does not name.** Its `workspace_write` arm renders a file
 *     chip from a hardcoded `FileText` glyph, and its own docblock at `:10` claims it
 *     *"reuses OutputFileCard's chip shape"* — while importing neither `fileIcon` nor
 *     `formatBytes` nor `FileRow` (measured: `grep -c` → 0 for all three). The claim
 *     is therefore FALSE TODAY. It is excluded because converting it is new surface,
 *     not a Phase-195 gap: no plan in this phase reads it, so a sweep arm over it
 *     would red on code nobody in this phase was asked to change. **Recorded, not
 *     waved through** — whoever converts it owns adding the fifth arm here.
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { describe, expect, it } from "vitest"

import heroSource from "@/components/workflows/RunHero.tsx?raw"
import panelSource from "@/components/panel/FilesSection.tsx?raw"
import chatSource from "@/components/chat/OutputFileCard.tsx?raw"
import iconSource from "@/lib/fileIcon.tsx?raw"

/**
 * The LINE-ANCHORED comment stripper (`WorkflowRunPage.test.tsx:1337`).
 *
 * ⚠ The `^\s*` on the second replace is the load-bearing character sequence. See the
 * docblock above for the variant that must NOT be copied and why.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const heroCode = codeOf(heroSource)
const panelCode = codeOf(panelSource)
const chatCode = codeOf(chatSource)
const iconCode = codeOf(iconSource)

/**
 * The four in-scope sources, each with the identity symbol that proves the RIGHT file
 * loaded and the prose token that proves the stripper actually stripped.
 *
 * The `minSource` / `minCode` floors sit well below the measured sizes (64150 / 13522 /
 * 12082 / 13392 source chars and 19167 / 6445 / 2742 / 4364 code chars at authoring
 * time) so a normal edit cannot red them, while `""` — the 192.1 failure — cannot pass.
 */
const SWEPT = [
  {
    key: "run hero",
    path: "frontend/src/components/workflows/RunHero.tsx",
    source: heroSource,
    code: heroCode,
    minSource: 5000,
    minCode: 2000,
    /** The hero deliverable landmark — unique to RunHero. */
    identity: "HERO_LANDMARK",
    /** Prose only: the D-03 note. */
    proseToken: "D-03",
  },
  {
    key: "panel file list",
    path: "frontend/src/components/panel/FilesSection.tsx",
    source: panelSource,
    code: panelCode,
    minSource: 6000,
    minCode: 3000,
    /** The listbox's accessible name — unique to this section. */
    identity: "Workspace files",
    /** Prose only: the CORRECTION-2 docblock heading at `:34`. */
    proseToken: "CORRECTION 2",
  },
  {
    key: "chat output card",
    path: "frontend/src/components/chat/OutputFileCard.tsx",
    source: chatSource,
    code: chatCode,
    minSource: 5000,
    minCode: 1200,
    /** The API_BASE resolver — unique to this card (D-067.2-03). */
    identity: "resolveOutputUrl",
    /** Prose only: the D-195-02-B citation at `:25`. */
    proseToken: "D-195-02-B",
  },
  {
    key: "icon module",
    path: "frontend/src/lib/fileIcon.tsx",
    source: iconSource,
    code: iconCode,
    minSource: 6000,
    minCode: 2000,
    /** The canonical ext→(colour, glyph) map — unique to this module. */
    identity: "EXT_MAP",
    /** Prose only: the own-property-guard threat id at `:184`. */
    proseToken: "T-195-03-03",
  },
] as const

/** The three surfaces Phase 195 CONVERTED (the icon module is the thing they converge on). */
const CONVERTED = SWEPT.filter((f) => f.key !== "icon module")

// ── needles, with the declaration shapes spelled out so a positive control can
//    exercise BOTH alternatives of each. A needle that cannot match anything is the
//    other way an absence assertion passes for free.
const DECL_FORMAT_BYTES = /function formatBytes|const formatBytes\s*=/
const DECL_BASE_NAME = /function baseName|const baseName\s*=/
const DECL_ICON_FOR = /function iconFor|const iconFor\s*=/
/** What a byte formatter is MADE of: a comparison against, or a division by, 1024. */
const KIB_ARITHMETIC = /<\s*1024|\/\s*1024|1024\s*\*\s*1024/

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK A — the machinery. If any case here fails, every arm below is meaningless.
// ═══════════════════════════════════════════════════════════════════════════════

describe("the sweep's own machinery — it cannot pass on an empty string", () => {
  it("the comment stripper actually strips, and it is the LINE-ANCHORED form", () => {
    const sample = [
      "/** function formatBytes( in a block comment */",
      "// function formatBytes( in a line comment",
      '  // function formatBytes( in an INDENTED line comment',
      'const keep = "https://example.test/a"  ',
      "const alsoKeep = 1",
      "",
    ].join("\n")
    const stripped = codeOf(sample)

    // The prose copies are gone…
    expect(stripped).not.toMatch(/function formatBytes\(/)
    // …the real code survives…
    expect(stripped).toMatch(/const alsoKeep = 1/)
    // …AND the anchoring is proved, not assumed: an unanchored line-comment strip
    // would eat from the `//` inside this URL to end of line and destroy the literal.
    // This is the single property that separates the two shipped `codeOf`s.
    expect(stripped).toContain('const keep = "https://example.test/a"')
    // The sample really did carry the token, so the first assertion is not vacuous.
    expect(sample).toMatch(/function formatBytes\(/)
  })

  it.each(SWEPT.map((f) => [f.key, f] as const))(
    "non-vacuity — %s really loaded, is the RIGHT file, and its prose really strips",
    (_key, f) => {
      // 1. LENGTH — the 192.1 empty-string failure cannot reach the arms below.
      expect(f.source.length).toBeGreaterThan(f.minSource)
      expect(f.code.length).toBeGreaterThan(f.minCode)
      // 2. IDENTITY — a non-empty sweep of the WRONG file is the same bug.
      expect(f.source).toContain(f.identity)
      expect(f.code).toContain(f.identity)
      // 3. THE STRIPPER PAIR — the token is in this file's prose and NOT in its code.
      //    Without this, a `codeOf` returning "" makes every SC#2 arm pass green.
      expect(f.source).toContain(f.proseToken)
      expect(f.code).not.toContain(f.proseToken)
    },
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK B — SC#2, first third: exactly ONE byte formatter.
// The one home is `components/files/fileRowUtils.ts` (`formatBytes`), pinned by
// `fileRowUtils.test.ts`. Nothing else may declare or re-derive it.
// ═══════════════════════════════════════════════════════════════════════════════

describe("SC#2 — exactly ONE byte formatter in the tree", () => {
  it("the needles can actually match (positive controls, both declaration shapes)", () => {
    expect("function formatBytes(bytes: number): string {").toMatch(DECL_FORMAT_BYTES)
    expect("const formatBytes = (bytes: number) => `${bytes} B`").toMatch(DECL_FORMAT_BYTES)
    expect("function baseName(p: string): string {").toMatch(DECL_BASE_NAME)
    expect("const baseName = (p: string) => p").toMatch(DECL_BASE_NAME)
    expect("if (bytes < 1024) return `${bytes} B`").toMatch(KIB_ARITHMETIC)
    expect("return `${(bytes / 1024).toFixed(1)} KB`").toMatch(KIB_ARITHMETIC)
    expect("if (bytes < 1024 * 1024) return x").toMatch(KIB_ARITHMETIC)
  })

  it("ARM 1 — the run hero declares no formatBytes, no baseName and no iconFor", () => {
    // It IMPORTS all three from the shared module (`RunHero.tsx`); what it
    // must never do again is declare its own.
    expect(heroCode).not.toMatch(DECL_FORMAT_BYTES)
    expect(heroCode).not.toMatch(DECL_BASE_NAME)
    expect(heroCode).not.toMatch(DECL_ICON_FOR)
    // …and the import edge is still there, so "no declaration" is not "no size cell".
    expect(heroCode).toMatch(/from "@\/components\/files\/fileRowUtils"/)
  })

  it("ARM 2 — the panel file list declares no formatBytes and no iconFor", () => {
    expect(panelCode).not.toMatch(DECL_FORMAT_BYTES)
    expect(panelCode).not.toMatch(DECL_ICON_FOR)
    // The panel hands the row raw bytes and lets the shared row format them.
    expect(panelCode).toMatch(/sizeBytes=\{file\.size_bytes\}/)
  })

  it("ARM 3a — chat's output card declares no formatBytes", () => {
    expect(chatCode).not.toMatch(DECL_FORMAT_BYTES)
    expect(chatCode).toMatch(/sizeBytes=\{file\.size\}/)
  })

  it("the KiB arithmetic itself lives in NONE of the four swept files", () => {
    for (const f of SWEPT) expect(f.code).not.toMatch(KIB_ARITHMETIC)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK C — SC#2, second third: exactly ONE row markup.
// ═══════════════════════════════════════════════════════════════════════════════

describe("SC#2 — exactly ONE row markup in the tree", () => {
  it("ARM 3b — chat renders exactly TWO shared rows and no hand-written row root", () => {
    expect(chatCode.match(/<FileRow/g) ?? []).toHaveLength(2)
    // POSITIVE CONTROL — the needle really counts what it claims to count.
    expect(('<FileRow asChild/><FileRow/>'.match(/<FileRow/g) ?? []).length).toBe(2)
    // The complement: the chat density's layout signature is not re-declared here.
    expect(chatCode).not.toContain("flex items-center gap-2.5")
    // …and it really is a findable string (it lives in this file's PROSE at `:181`).
    expect(chatSource).toContain("flex items-center gap-2.5")
  })

  it("the panel and the run hero delegate too — no surface hand-rolls a row", () => {
    expect(panelCode.match(/<FileRow/g) ?? []).toHaveLength(1)
    expect(heroCode.match(/<FileRow/g) ?? []).toHaveLength(4)
    // The panel's density signature is likewise not re-declared (prose only, `:232`).
    expect(panelCode).not.toContain("flex items-center gap-2")
    expect(panelSource).toContain("flex items-center gap-2")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK D — SC#2, final third: exactly ONE icon path.
// ═══════════════════════════════════════════════════════════════════════════════

describe("SC#2 — exactly ONE per-extension icon path", () => {
  it("ARM 4a — `lib/fileIcon.tsx` IS that one path", () => {
    expect(iconCode).toContain("const EXT_MAP")
    expect(iconCode).toContain("export function fileIcon")
    expect(iconCode).toContain("MIME_OOXML_DOCX")
  })

  it("ARM 4b — no OTHER in-scope file declares an extension-to-glyph map", () => {
    /**
     * ⚠ EVERY NEEDLE BELOW IS PRESENT IN PROSE SOMEWHERE IN THIS CORPUS, WHICH IS THE
     * WHOLE POINT: `FilesSection.tsx:40-43` names `FileSpreadsheet`, `FileCode` and
     * `FileImage` while importing none of them, and `fileIcon.tsx:110-117` names
     * `codeExts`. Run raw, this arm reds on two docblocks that exist to explain a
     * deliberate glyph change. Run over `codeOf`, it reds only on a real second map.
     */
    for (const f of CONVERTED) {
      expect(f.code).not.toContain("EXT_MAP")
      expect(f.code).not.toContain("OOXML_DOCX")
      expect(f.code).not.toContain("codeExts")
      expect(f.code).not.toContain("FileSpreadsheet")
      expect(f.code).not.toContain("FileCode")
      expect(f.code).not.toContain("FileImage")
    }
    // POSITIVE CONTROLS — each needle can be found in a string that contains it.
    expect("const EXT_MAP: Record<string, IconSpec> = {}").toContain("EXT_MAP")
    expect('const MIME_OOXML_DOCX = "application/vnd…"').toContain("OOXML_DOCX")
    expect('const codeExts = ["ts", "py"]').toContain("codeExts")
    expect("import { FileSpreadsheet } from 'lucide-react'").toContain("FileSpreadsheet")
    // …and the prose really is there, so the stripped/raw distinction is measured.
    expect(panelSource).toContain("FileSpreadsheet")
    expect(iconSource).toContain("codeExts")
  })

  it("ARM 4c — exactly ONE import edge: no converted surface imports the icon module", () => {
    // All three reach the glyph THROUGH the shared row (`FileRow.tsx:5` is the tree's
    // only `@/lib/fileIcon` importer). That is what makes "one icon path" a structural
    // property rather than a convention three files happen to share.
    for (const f of CONVERTED) {
      expect(f.code).not.toContain("lib/fileIcon")
      expect(f.code).toContain('from "@/components/files/FileRow"')
    }
    // ⚠ `FilesSection.tsx:36` names `@/lib/fileIcon` in its docblock — raw would red.
    expect(panelSource).toContain("lib/fileIcon")
    // POSITIVE CONTROL for the import needle.
    expect('import { fileIcon } from "@/lib/fileIcon"').toContain("lib/fileIcon")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK E — P7(b): chat's PUBLIC CAPABILITY is pinned (D-13).
// Selectable with `-t "chat capability"`.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The declared prop block, comments removed.
 *
 * ⚠ THIS IS A **SOURCE** ASSERTION AND MUST STAY ONE. `OutputFileCardProps` is NOT
 * exported (`OutputFileCard.tsx:82`), so there is no type to import — and exporting it
 * in order to test it would BE the public-surface change this fence exists to forbid
 * (D-195-02-B).
 */
const PROPS_BLOCK = codeOf(chatSource.match(/interface OutputFileCardProps \{[\s\S]*?\r?\n\}/)?.[0] ?? "")
const PROPS_KEYS = [...PROPS_BLOCK.matchAll(/^\s*([A-Za-z_]\w*)\??:/gm)].map((m) => m[1]).sort()

describe("chat capability — the output card's public surface has not widened (D-13, P7b)", () => {
  it("chat capability — the props block really was extracted (non-vacuity)", () => {
    // Without this, a regex that stopped matching would leave `PROPS_KEYS` empty and the
    // exactness assertion below would compare [] to [] and pass while measuring nothing.
    expect(PROPS_BLOCK.length).toBeGreaterThan(80)
    expect(PROPS_BLOCK).toContain("interface OutputFileCardProps")
    expect(PROPS_KEYS.length).toBeGreaterThan(0)
  })

  it("chat capability — the prop set is EXACTLY the six declared keys, with no seventh", () => {
    // `file` is the container; the six the plan names are its five members plus the
    // sibling `variant`. Exactness pins BOTH directions: an added prop reds, and a
    // silently REMOVED one reds too.
    expect(PROPS_KEYS).toEqual([
      "file",
      "filename",
      "is_hero",
      "size",
      "supersedes",
      "url",
      "variant",
    ])
    // Named individually as well, so a failure message says WHICH key moved.
    for (const k of ["filename", "url", "size", "supersedes", "is_hero", "variant"]) {
      expect(PROPS_KEYS).toContain(k)
    }
    // POSITIVE CONTROL — the key extractor really finds a seventh when one exists.
    const planted = "interface X {\n  file: {\n    filename: string\n  }\n  onPreview?: () => void\n}"
    expect([...planted.matchAll(/^\s*([A-Za-z_]\w*)\??:/gm)].map((m) => m[1])).toContain("onPreview")
  })

  it("chat capability — the props interface is still NOT exported", () => {
    expect(chatCode).toContain("interface OutputFileCardProps")
    expect(chatCode).not.toMatch(/export\s+(?:interface|type)\s+OutputFileCardProps/)
    expect(chatCode).not.toMatch(/export\s*\{[^}]*OutputFileCardProps/)
    // POSITIVE CONTROLS for both export shapes.
    expect("export interface OutputFileCardProps {").toMatch(
      /export\s+(?:interface|type)\s+OutputFileCardProps/,
    )
    expect("export { OutputFileCard, type OutputFileCardProps }").toMatch(
      /export\s*\{[^}]*OutputFileCardProps/,
    )
  })

  it("chat capability — no swept file renders raw markup", () => {
    // Both `filename` and `supersedes` are model/sandbox-derived and reach JSX in every
    // one of these files. They must stay React TEXT children (T-195-04-01).
    for (const f of SWEPT) expect(f.code).not.toContain("dangerouslySetInnerHTML")
    // POSITIVE CONTROL.
    expect("<div dangerouslySetInnerHTML={{ __html: name }} />").toContain(
      "dangerouslySetInnerHTML",
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK F — the boundary, recorded in code so it cannot read as an oversight.
// ═══════════════════════════════════════════════════════════════════════════════

describe("the recorded boundary — what this sweep deliberately does NOT read", () => {
  it("sweeps exactly the four in-scope sources, and names the two it excludes", () => {
    expect(SWEPT.map((f) => f.path)).toEqual([
      "frontend/src/components/workflows/RunHero.tsx",
      "frontend/src/components/panel/FilesSection.tsx",
      "frontend/src/components/chat/OutputFileCard.tsx",
      "frontend/src/lib/fileIcon.tsx",
    ])
    // The exclusions are ASSERTED as strings, never imported — reading them would be the
    // sweep this case exists to say was not done. The reasons live in the docblock above.
    const EXCLUDED_WITH_REASON = {
      "frontend/src/lib/fileIcons.tsx":
        "the documents/governance getFileIcon — serves the document library, not the produced-file presentation RUN-03 names",
      "frontend/src/components/panel/SeamCard.tsx":
        "the FIFTH presentation, unnamed by 195-CONTEXT — a workspace_write chip with a hardcoded glyph whose docblock claim to reuse OutputFileCard's chip shape is FALSE; converting it is new surface, not a Phase-195 gap",
    }
    expect(Object.keys(EXCLUDED_WITH_REASON)).toHaveLength(2)
    for (const reason of Object.values(EXCLUDED_WITH_REASON)) {
      expect(reason.length).toBeGreaterThan(40)
    }
    expect(SWEPT.map((f) => f.path)).not.toContain("frontend/src/components/panel/SeamCard.tsx")
    expect(SWEPT.map((f) => f.path)).not.toContain("frontend/src/lib/fileIcons.tsx")
  })
})
