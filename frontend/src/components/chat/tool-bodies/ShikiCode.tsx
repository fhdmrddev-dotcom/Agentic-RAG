/**
 * Phase 075.8 Task 7 — Shiki syntax-highlighting wrapper.
 *
 * Sketch source: sources/002-tool-call-panel/ D1 — "Tool call = editor inset;
 *   code is the focus" (gutter + syntax + lang chip). Spec at
 *   `.claude/skills/sketch-findings-agentic-rag/references/tool-call-panel.md#d1`.
 *
 * Why Shiki (vs highlight.js / Prism):
 * - VSCode-quality tokens via Oniguruma WASM — matches the GitHub-dark token
 *   palette already specified in tool-call-panel.md CSS (lines 147-152).
 * - Async-loaded (singleton cache via Shiki's createHighlighter) — keeps
 *   initial bundle clean.
 * - Per Shiki 4 docs: createHighlighter loads themes/languages lazily; first
 *   call kicks WASM, subsequent calls reuse the same highlighter.
 *
 * Lifecycle:
 *   1. First mount: imports shiki dynamically + initializes highlighter
 *      (cached at module scope so the per-mount cost is ~0 after the first).
 *   2. While loading: renders the raw code in a plain mono pre — looks
 *      acceptable; no layout shift when the highlighted HTML lands.
 *   3. On unmount mid-load: setMounted flag guards against the no-op
 *      setState-after-unmount warning.
 */
import { useEffect, useState } from "react"

// Module-scope highlighter singleton — Shiki recommends caching the
// highlighter across the app rather than re-creating per component.
// Promise so concurrent mounts share the same WASM init.
let highlighterPromise: Promise<{
  codeToHtml: (code: string, opts: { lang: string; theme: string }) => string
}> | null = null

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const shiki = await import("shiki")
      const hl = await shiki.createHighlighter({
        themes: ["github-dark"],
        langs: ["python"],
      })
      return {
        codeToHtml: (code: string, opts: { lang: string; theme: string }) =>
          hl.codeToHtml(code, opts),
      }
    })()
  }
  return highlighterPromise
}

export interface ShikiCodeProps {
  code: string
  language?: string  // default "python"
  theme?: string     // default "github-dark"
}

export function ShikiCode({ code, language = "python", theme = "github-dark" }: ShikiCodeProps) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getHighlighter()
      .then(hl => {
        if (!mounted) return
        try {
          setHtml(hl.codeToHtml(code, { lang: language, theme }))
        } catch {
          // If the language isn't loaded (e.g. exotic lang), fall back to
          // raw text — never crash the chat UI on a syntax-highlighter miss.
          setHtml(null)
        }
      })
      .catch(() => {
        // Shiki WASM init failed (offline, ad-blocker, etc.) — fall back to
        // the plain-pre render path.
        if (mounted) setHtml(null)
      })
    return () => {
      mounted = false
    }
  }, [code, language, theme])

  // While loading or on highlight failure, render the raw code in a plain
  // pre — Shiki's eventual highlighted HTML uses identical text positions, so
  // there's no visible layout shift when it lands.
  if (!html) {
    return (
      <pre
        data-testid="shiki-code-fallback"
        className="m-0 px-3 py-2 font-mono text-[11px] leading-[1.7] text-[#c9d1d9] whitespace-pre overflow-x-auto"
      >
        {code}
      </pre>
    )
  }

  // Shiki injects its own <pre> with inline-styled tokens. Override the
  // background so the surrounding .tc-editor frame's #0d1117 carries through;
  // Shiki's default github-dark bg matches but the inline-style would mask
  // the parent gradient if any. Padding + line-height + font-size mirror the
  // fallback so swapping in highlighted HTML doesn't shift the row metrics.
  return (
    <div
      data-testid="shiki-code"
      className="shiki-host overflow-x-auto text-[11px] leading-[1.7] [&_pre]:!m-0 [&_pre]:!px-3 [&_pre]:!py-2 [&_pre]:!bg-transparent [&_pre]:font-mono [&_pre]:whitespace-pre"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
