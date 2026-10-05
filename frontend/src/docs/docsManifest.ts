// Phase 276-03 — the ONE place the docs entry touches virtual:docs-manifest (served by
// frontend/plugins/docsContent.ts). Everything else reads the manifest through useDocs(); keeping
// the virtual import in this one module lets a test replace it with vi.mock("../docsManifest").
import { changelog, chapters, loadPage, pages, sections } from "virtual:docs-manifest"
import type { DocsData } from "./docsData"

export const DOCS_DATA: DocsData = { sections, pages, changelog, chapters, loadPage }
