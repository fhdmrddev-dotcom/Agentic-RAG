/**
 * fileRowUtils — the ONE byte formatter, the ONE basename, D-05's discriminated
 * file source, and D-12's two-regime newest-first comparator (Phase 195, RUN-03).
 *
 * PURE. No React import, no hook, no fetch. Everything here is a total function
 * of its arguments, which is why it can be shared by the chat output card, the
 * panel file list and the run page's deliverable list without any of them
 * learning anything about the others.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `formatBytes` shipped THREE TIMES — `OutputFileCard.tsx:25-29`,
 * `FilesSection.tsx:38-42` and `WorkflowRunPage.tsx:152-157` — and two of those
 * copies carry a comment apologising for themselves ("Copied verbatim from
 * OutputFileCard.tsx:24-28 … Keep byte-for-byte identical"). A comment is not a
 * mechanism. This module is the mechanism; plans 05 and 06 delete the copies.
 *
 * ── ⚠ A RECORDED DEVIATION: THERE IS NO SHARED `downloadFrom()` HERE ────────
 * `195-RESEARCH.md` sketched a shared `downloadFrom(src, filename)` dispatcher
 * alongside these helpers. This module does NOT create one, and the reason is
 * measured rather than stylistic:
 *
 *   `WorkflowRunPage.test.tsx:1450-1455` pins `downloadWorkspaceFile(` at
 *   EXACTLY ONE occurrence in the page's raw source, AND pins the call as
 *   `downloadWorkspaceFile(runThreadId…`. That second pin is a TENANCY
 *   property, not a style rule: the run page must download from the RUN's
 *   thread and never from the currently-viewed one. Routing the call through a
 *   util would drop the first grep to ZERO and force inverting a fence that
 *   guards a real security property.
 *
 * So `FileSource` below is the shared VOCABULARY each surface maps to its own
 * live-vs-dead presentation, and the two shipped download calls stay exactly
 * where they are — along with their two deliberately different error
 * placements (chat in-row, auto-clearing after 3 s; the run page section-level
 * with `data-testid="run-download-error"` and no auto-clear). RUN-03 asks for
 * one PRESENTATION, and that is what Phase 195 ships.
 */

/**
 * Bytes → a short human label.
 *
 * ⚠ HOISTED CHARACTER-FOR-CHARACTER from `OutputFileCard.tsx:25-29` at
 * `BASE_SHA = f2eef045…`. This is a HOIST, never a re-derivation: all three
 * shipped copies were already byte-identical, which is exactly why one of them
 * carries the "Keep byte-for-byte identical" plea. The three branches below are
 * the original's three branches, in the original's order, with the original's
 * `toFixed(1)` precision — `fileRowUtils.test.ts` compares this function's
 * source text against the pre-change original via a `?raw` import so a future
 * "tidy-up" cannot silently change what a user reads on a row.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The last path segment — the NAME. Hoisted from `WorkflowRunPage.tsx:160-162`,
 * INCLUDING the `|| "download"` fallback (which is load-bearing: `"".split("/")`
 * yields `[""]`, and an empty filename on a download attribute is worse than a
 * generic one).
 *
 * The row shows the name; the full path belongs in `title=`. ⚠ The panel row
 * deliberately shows the FULL PATH instead (`FilesSection.tsx:239`), so plan 05
 * must NOT route the panel through this helper — the caller derives its own
 * label, which is why `FileRow` takes `name` as a plain string.
 */
export function baseName(path: string): string {
  return path.split("/").pop() || "download"
}

/**
 * D-05's discriminated file source — the shared vocabulary for "where does this
 * row's bytes come from", used by each surface to choose its live-vs-dead
 * presentation.
 *
 * The third arm is EXPLICIT. `195-CONTEXT.md`'s two-arm wording omits it, but
 * both live surfaces already have it: chat renders the dead affordance when
 * `url` is absent (`OutputFileCard.tsx:91`), and the run page renders a
 * non-interactive row when `id` is absent (`WorkflowRunPage.tsx:1066-1081`). A
 * union that cannot express a state the UI already renders is not a model of
 * the UI.
 */
export type FileSource =
  | { kind: "sandbox"; url: string }
  | { kind: "workspace"; threadId: string; fileId: string }
  | { kind: "unavailable" }

/**
 * D-12's newest-first comparator — and ⚠ NEW GROUND: no comparator in this
 * repository sorts a MISSING key FIRST.
 *
 * ── THE TWO DATA REGIMES (195-RESEARCH.md § F7) ─────────────────────────────
 *
 *  1. RECONCILED (the GET). `backend/app/api/workspace.py:326-330` orders by
 *     `path` and supplies `created_at` on every row. Both keys present.
 *
 *  2. LIVE (the SSE). `frontend/src/lib/api.ts:845-851` builds a workspace file
 *     from `id / path / version / size_bytes / mime_type` ONLY — there is NO
 *     `created_at` on that payload — and `StreamsProvider.tsx:2947-2954`
 *     APPENDS it (`[...prev, merged]`).
 *
 * ⚠ REGIME 2 IS THE ONE THE DELIVERABLE ARRIVES IN. The just-produced file —
 * the entire point of "show the deliverable" — is precisely the row with no
 * `created_at`. So an ABSENT key means "arrived during this session, after
 * everything the GET returned", i.e. NEWEST, and it must sort FIRST.
 *
 * ⚠ THE SHAPE IS `PendingAskCard.tsx:608-614`'s GUARD, BUT NOT ITS RESOLUTION.
 * That comparator returns `0` when a key is missing, which yields insertion
 * order and therefore places the just-appended live file LAST — the exact
 * INVERSE of what D-12 wants here. The `0` is right for its own surface (asks
 * arrive in order) and wrong for this one; copying it wholesale is the failure
 * this comment exists to prevent.
 *
 * Contract:
 *   both present  → `b.created_at.localeCompare(a.created_at)` (the house DESC
 *                   idiom, three shipped call sites)
 *   `a` missing   → `a` first  (-1)
 *   `b` missing   → `b` first  (+1)
 *   both missing  → `0` — stable, insertion order preserved
 *
 * ⚠ CALL IT ON A COPY: `[...list].sort(byNewestFirst)`. `Array.prototype.sort`
 * mutates in place, and a store array sorted in place is a render-loop bug
 * (`canvasModel.ts:368` is the shipped precedent for this rule).
 */
export function byNewestFirst(
  a: { created_at?: string },
  b: { created_at?: string },
): number {
  if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at)
  if (!a.created_at && b.created_at) return -1
  if (a.created_at && !b.created_at) return 1
  return 0
}
