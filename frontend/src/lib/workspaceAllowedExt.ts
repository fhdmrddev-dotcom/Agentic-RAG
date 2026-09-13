/**
 * Phase 244 (SHELL-04 / D-244-24) — THE SINGLE FRONTEND SOURCE OF THE ATTACHMENT ALLOW-LIST.
 *
 * The server's `validate_upload` (`backend/app/api/workspace.py`) is the REAL gate; everything
 * here is a UX hint that stops the OS file dialog offering a file the door will refuse.
 *
 * ⛔ WHY THIS FILE EXISTS. The list had THREE hand-typed copies — `workspace.py`'s four `_*_EXT`
 * set literals, `TemplateUpload.tsx`'s `accept=` attribute, and `COPY.engine.ALLOWED_EXT` in the
 * sketch — kept equal by two comments that pointed at each other and by nothing else. That held
 * only because nobody had changed the list since Phase 151. D-244-24 changes it (`.pdf`), which is
 * precisely the moment a comment-enforced invariant rots.
 *
 * ⭐ THE LOCKSTEP IS NOW A MECHANISM: `src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts`
 * imports `workspace.py` with `?raw`, parses its four category set literals, and asserts SET
 * EQUALITY against `WORKSPACE_ALLOWED_EXT` element for element. A member added on one side and
 * not the other goes red — a presence assertion could not have seen that.
 *
 * ⚠ IF THE FENCE DISAGREES WITH THE SERVER, THIS CONSTANT IS WRONG. Never widen it to make a
 * frontend test pass; widen `workspace.py` (with a validator for the new container) instead.
 */

/**
 * Every extension `POST /threads/{id}/workspace/files` accepts, sorted.
 *
 * Grouped by the server's own four validator categories, in the server's order, so a diff here
 * reads against `workspace.py` directly:
 *   OOXML (ZIP container + part-name marker) · text (utf-8-decodable, NUL-free) ·
 *   image (leading magic bytes) · pdf (`%PDF-`).
 */
export const WORKSPACE_ALLOWED_EXT: readonly string[] = [
  // _OOXML_EXT
  ".docx",
  ".pptx",
  ".xlsx",
  // _TEXT_EXT
  ".md",
  ".json",
  ".csv",
  ".txt",
  ".py",
  ".js",
  ".sh",
  // _IMAGE_EXT
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  // _PDF_EXT (Phase 244 / D-244-24)
  ".pdf",
] as const

/** The `accept=` attribute value for a file input pointed at the workspace door. */
export const WORKSPACE_ACCEPT_ATTR: string = WORKSPACE_ALLOWED_EXT.join(",")
