import { useState } from "react"
import type { MouseEvent } from "react"
import { cn } from "@/lib/utils"
import { FileRow } from "@/components/files/FileRow"
import { downloadSandboxOutput, DownloadError } from "@/lib/api"

/**
 * ── PHASE 195 PLAN 04 — THE INTERIOR MOVED HOUSE; NOTHING ELSE MOVED ────────
 *
 * This component's row markup is no longer written here. It comes from the ONE
 * shared row (`components/files/FileRow.tsx`, Phase 195 plan 03), which this
 * file drives with `asChild` — so the wrapper ELEMENT below is still supplied
 * by this component, and the a11y contract of a chat output file is still an
 * `<a href download target rel>` exactly as it has been since Phase 067.3.
 *
 * ⚠ WHAT DID **NOT** CHANGE, AND WHY EACH ONE IS LOAD-BEARING:
 *
 *  · **The public prop shape is byte-identical and the props interface stays
 *    UNEXPORTED.** Both call sites (`MessageItem.tsx:158` and
 *    `tool-bodies/ExecuteCodeBody.tsx:358`) pass only `file`, so widening the
 *    surface buys nothing — and it would open `MessageItem.tsx`, which measures
 *    29 phases with an UNDISCHARGED G-5 extraction obligation. D-14's decline is
 *    honoured STRUCTURALLY here (there is nothing new to call), not by
 *    discipline. Exporting the interface would itself be a public-surface
 *    change (D-195-02-B).
 *  · **D-13 holds: chat gained NO new affordance.** The presentation converted;
 *    the capability did not. There is no new control, no new prop, no new
 *    fetch, no new state. ⚠ These two are compatible and must not be conflated
 *    — D-07 requires all three surfaces to converge on one presentation, and
 *    D-13 forbids chat gaining a capability. This plan does the first only.
 *  · The download call, its status-specific copy and its 3 s auto-clear stay in
 *    THIS component. The shared row holds no business logic and is handed no
 *    thread id, no file id and no URL, so it cannot fetch anything.
 *
 * **What this plan DELETED:** the local byte formatter (the shared row formats
 * the size cell from `sizeBytes`, and `fileRowUtils` proved the hoist
 * byte-identical) and the hand-written interior spans, which are now the shared
 * row's children.
 *
 * ⚠ ONE MEASURED, DELIBERATE DIFFERENCE IN THE RENDERED BYTES, recorded rather
 * than glossed: in the DEAD branch the name span's class TOKENS are emitted in a
 * different ORDER (`font-mono truncate text-foreground/60` instead of
 * `font-mono text-foreground/60 truncate`), because the shared row composes the
 * dead skin as an override that `twMerge` resolves. Same token SET, same
 * rendering — attribute-order only. Everything else about both branches, in
 * every state exercised (live · size · size 0 · supersedes · both variants ·
 * dead · downloading · both error kinds), is byte-for-byte what it was.
 */

// D-067.2-03: API_BASE for prepending the host on relative re-sign URLs emitted
// by the backend's harvest_output_files (e.g. "/sandbox-outputs/{path}"). The
// `API_BASE` constant inside lib/api.ts is not exported, so we read the env
// var directly here. Lives alongside OutputFileCard because this is the only
// site that resolves OutputFile.url across the chat surface.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""

function resolveOutputUrl(url: string): string {
  // D-067.2-03: new sandbox outputs store relative URLs (`/sandbox-outputs/{path}`);
  // prepend API_BASE for those. Legacy outputs (already-stored long-form
  // signed URLs starting with "http") pass through unchanged — they decay
  // after 1h as before (legacy decay accepted per CONTEXT.md § Claude's
  // Discretion).
  if (url.startsWith("/")) return `${API_BASE}${url}`
  return url
}

// ⚠ The local byte formatter that used to live here is GONE (Phase 195 plan
// 04). The shared row renders the size cell from its `sizeBytes` prop using
// `components/files/fileRowUtils`, whose helper was proved byte-identical to
// this one's output before either surface adopted it (195-03, plants P2(d/e/f)
// red both a boundary case AND a `?raw` byte-identity case). No second copy of
// the KiB rounding survives in this file.

// Relaxed prop shape (D-075.2-05 / D-075.2-06 / RESEARCH §Q4): finalOutputFiles
// entries on the Message type carry `{ filename: string; url?: string }` with
// no `size` field, while per-cell outputFiles supply both. The canonical
// `OutputFile` type in `@/types` stays STRICT (`url: string`, `size: number`);
// only this component's prop shape relaxes both fields. The strict type is a
// structural subtype of this relaxed shape, so the existing per-cell call site
// in tool-bodies/ExecuteCodeBody (Phase 075.7 rename) keeps typechecking
// verbatim.
interface OutputFileCardProps {
  file: {
    filename: string
    url?: string
    size?: number
    /** Plan 075.4-04 D-075.4-D2 — populated by Plan 075.4-03's content-hash
     *  dedup in sandbox_service.harvest_output_files when iteration N produces
     *  a DIFFERENT SHA-256 for the SAME filename as iteration N-1 (the
     *  "iteratively-refining pptx" case). Renders a tiny "Replaces:" subline
     *  so the user can see which previous file the current output supersedes
     *  — closes BUG-260523-03's user-visible affordance side (backend dedup
     *  was Plan 03's deliverable; UI surfacing is this Plan 04 wave). */
    supersedes?: string
    /** Phase 095 Plan 05 (D-08) — additive hero flag, kept on the shape for
     *  back-compat with the persisted/emitted payload. Phase 095.1 D-095.1-06
     *  REMOVED the hero presentation, so this card NO LONGER reads `is_hero`
     *  (it stays written-but-unread, harmless and forward-compatible). */
    is_hero?: boolean
  }
  /** Phase 095.1 Plan 05 (D-095.1-06) — INERT layout flag. The hero/working
   *  visual split was reversed (operator-approved CONTEXT.md decision), so this
   *  prop no longer changes the rendered shape — every row renders the one quiet
   *  uniform style. Kept optional + accepted (default "working") purely for
   *  call-site back-compat so no other call site needs touching. */
  variant?: "hero" | "working"
}

// Phase 067.3 (D-067.3-R2-03/04): JS blob fetch+download click intercept.
// onClick prevents the default anchor navigation (which would hit 401 because
// browsers send only cookies, not Authorization: Bearer), runs the helper
// from lib/api.ts which injects the Bearer token via fetch, follows the
// 302 to Supabase CDN, and triggers a programmatic <a download> click.
// The static <a href> is preserved so right-click "Save link as" still
// has a real target — the resulting raw click will 401, which is an
// accepted UX trade-off (rare in chat-history context).
export function OutputFileCard({ file, variant = "working" }: OutputFileCardProps) {
  // Hooks declared unconditionally so rules-of-hooks is trivially satisfied
  // regardless of whether the url-optional branch returns early below.
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<{ status: number | "network"; message: string } | null>(null)

  // Phase 095.1 Plan 05 (D-095.1-06): the per-extension icon is a uniform 30 px
  // glyph on every row — the hero 48 px branch was removed with the hero split.
  // ⚠ PHASE 195 PLAN 04 — this component no longer calls the icon module at
  // all: `density="chat"` on the shared row IS that call, parameterised rather
  // than branched. Recorded beside the original note instead of over it, so the
  // ONE-icon-path claim (SC#2) reads as a structural property and not as a
  // convention two files happen to share.

  // Url-less dead state (D-07 / 095-VALIDATION.md D-07 dead-link row): a file
  // arriving without a `url` (older persisted entry, or a url-less emit) now
  // renders the download affordance CLEARLY DISABLED (the sketch's `dl-btn.dead`
  // state) rather than a silent plain filename with no affordance. This closes
  // RESEARCH dead-link root #1 — no silent dead anchor. The "Download
  // unavailable" copy + the disabled style make the missing link legible.
  if (!file.url) {
    return (
      // ⚠ `sizeBytes` is DELIBERATELY NOT PASSED. Today's dead branch renders no
      // size cell even when the payload carries a `size`, and that absence is
      // part of what D-08 asks to survive byte-identical. The affordance's
      // element, its `aria-disabled` and its exact title and copy now come from
      // the shared row's `dead` arm — which is a <span>, never a <button>, the
      // property `OutputFileCard.baseline.test.tsx` case (d) pins at its source
      // and `WorkflowRunPage.test.tsx:991` depends on downstream.
      <FileRow asChild density="chat" trailing="dead" name={file.filename} supersedes={file.supersedes}>
        <div
          className="rounded-md ghost-border text-xs px-3 py-2 bg-muted/30"
          data-variant={variant}
          data-dead="true"
        />
      </FileRow>
    )
  }

  const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (downloading) return
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadSandboxOutput(file.url!, file.filename)
    } catch (err) {
      // D-067.3-R2-04 status-specific copy; messages already set inside the helper.
      if (err instanceof DownloadError) {
        setDownloadError({ status: err.status, message: err.message })
      } else {
        setDownloadError({ status: "network", message: "Download failed — try again." })
      }
      // Auto-clear after 3s — non-blocking, lightweight feedback (no toast lib in repo).
      setTimeout(() => setDownloadError(null), 3000)
    } finally {
      setDownloading(false)
    }
  }

  return (
    // ⚠ THE ROW'S OWN CLASSES SPLIT IN TWO, AND THE SPLIT IS NOT ARBITRARY.
    // Radix `mergeProps` JOINS `className` — it does NOT `twMerge` it
    // (`react-slot`: `[slotProps, childProps].filter(Boolean).join(" ")`), so the
    // shared row deliberately owns LAYOUT ONLY (`flex items-center gap-2.5`) and
    // every other class this row has ever had — padding, radius, type scale,
    // transition, the ghost border, the hover/disabled pair and the error
    // border — stays HERE, on the anchor. Verified: no class left below competes
    // with one the density owns, so the joined attribute is byte-identical to
    // the single `cn(...)` this branch shipped before Phase 195.
    // Plan 075.4-04 D-075.4-D2 — the supersedes subline (BUG-260523-03's UI
    // side) and the in-row error line are now the shared row's `supersedes` and
    // `errorText`. React escapes text children in both homes; no markup sink was
    // introduced by the move (T-195-04-01).
    <FileRow
      asChild
      density="chat"
      name={file.filename}
      sizeBytes={file.size}
      supersedes={file.supersedes}
      errorText={downloadError?.message ?? null}
      trailing={downloading ? "spinner" : "download"}
    >
      <a
        href={resolveOutputUrl(file.url)} /* preserved so right-click 'Save link as' has a real target — accepted 401 trade-off (D-067.3-R2-03) */
        download={file.filename}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-disabled={downloading}
        data-variant={variant}
        className={cn(
          // Phase 095.1 Plan 05 (D-095.1-06): the ONE quiet uniform row — the hero
          // glow/gradient/large-icon/prominent-Download styling was removed with
          // the hero split. Every file renders this same calm ghost-border row.
          "px-3 py-2 rounded-md text-xs transition-colors group ghost-border",
          downloading ? "opacity-60 cursor-not-allowed" : "bg-muted/30 hover:bg-accent/40",
          downloadError ? "border border-red-500/40" : "",
        )}
      />
    </FileRow>
  )
}
