/**
 * Phase 299-03 (D-21 / UI-D7) — the one clipboard leaf: the can't-be-opened card's "Copy address"
 * and 299-04's link surface share it.
 *
 * Extracted from FilePreview's `CopyContentButton` idiom. ⚠ THE FAILURE ARM IS NOT OPTIONAL:
 * `navigator.clipboard` is undefined outside a secure context, and its write REJECTS when the
 * document is not focused or permission is refused. A control that silently no-ops then is worse
 * than none — the person walks away believing they hold the text. So `copyText` answers "copied"
 * or "refused" and never throws, and the caller's fallback is to SELECT the text and name the
 * keyboard shortcut (`selectAllIn` + `copyShortcutWord`).
 *
 * ⛔ A leaf: no React, no app imports. ⛔ Never reports a refused copy as copied.
 */

/** Write `text` to the clipboard. "copied" only when the browser says the write happened. */
export async function copyText(text: string): Promise<"copied" | "refused"> {
  try {
    const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard
    if (!clip?.writeText) return "refused"
    await clip.writeText(text)
    return "copied"
  } catch {
    return "refused"
  }
}

/** Select all of `el`'s text (the fallback when a copy is refused), so Ctrl/⌘+C copies it. */
export function selectAllIn(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined") return
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.selectAllChildren(el)
}

/** The fallback label: the platform's copy shortcut, in words. */
export function copyShortcutWord(): "Press Ctrl+C to copy" | "Press ⌘C to copy" {
  const platform = typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent || ""
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "Press ⌘C to copy" : "Press Ctrl+C to copy"
}
