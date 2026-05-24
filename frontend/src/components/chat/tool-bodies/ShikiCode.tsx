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
import { useEffect, useState, useDeferredValue } from "react"

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
  /**
   * SECURITY CONTRACT (Phase 075.9 T5 — WR-02): `code` is treated as
   * **untrusted plain text**. Shiki's tokenizer HTML-escapes every input
   * character before injecting it into the styled <span> tree, so untrusted
   * source text is safe to render. Pre-rendering `code` through markdown,
   * MDX, or any HTML pipeline before passing it here WOULD BYPASS Shiki's
   * escape pass and allow XSS. Callers MUST NOT pipe through marked / MDX /
   * Showdown / any HTML-emitting layer — pass raw source text only.
   */
  code: string
  language?: string  // default "python"
  theme?: string     // default "github-dark"
  /**
   * Phase 075.9 T4: hint to ShikiCode that the `code` prop is mid-stream
   * (cumulative bytes from tool_args_progress). When true, the component
   * defers re-tokenization via React 18's `useDeferredValue` so rapid
   * prop changes during the SSE stream don't re-run the WASM highlighter
   * on every chunk — the latest token render lands as soon as the
   * scheduler has bandwidth. No manual debounce loop / lodash needed.
   */
  streaming?: boolean
}

export function ShikiCode({ code, language = "python", theme = "github-dark", streaming = false }: ShikiCodeProps) {
  const [html, setHtml] = useState<string | null>(null)
  // Phase 075.9 T4: during streaming, defer `code` so React batches rapid
  // prop changes and the tokenizer runs at most once per scheduler slice.
  // When not streaming, useDeferredValue returns `code` immediately —
  // identical behavior to the pre-T4 path.
  const deferredCode = useDeferredValue(code)
  const effectiveCode = streaming ? deferredCode : code

  useEffect(() => {
    let mounted = true
    getHighlighter()
      .then(hl => {
        if (!mounted) return
        try {
          setHtml(hl.codeToHtml(effectiveCode, { lang: language, theme }))
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
  }, [effectiveCode, language, theme])

  // While loading or on highlight failure, render the raw code in a plain
  // pre — Shiki's eventual highlighted HTML uses identical text positions, so
  // there's no visible layout shift when it lands.
  if (!html) {
    return (
      <pre
        data-testid="shiki-code-fallback"
        className="m-0 px-3 py-2 font-mono text-[11px] leading-[1.7] text-[#c9d1d9] whitespace-pre overflow-x-auto"
      >
        {effectiveCode}
      </pre>
    )
  }

  /**
   * Shiki injects its own <pre> with inline-styled tokens. Override the
   * background so the surrounding .tc-editor frame's #0d1117 carries through;
   * Shiki's default github-dark bg matches but the inline-style would mask
   * the parent gradient if any. Padding + line-height + font-size mirror the
   * fallback so swapping in highlighted HTML doesn't shift the row metrics.
   *
   * SECURITY: `html` here originates EXCLUSIVELY from `hl.codeToHtml(...)`
   * (Shiki's tokenizer), which HTML-escapes its input string before emitting
   * the styled <span> tree. The escape pass is what makes this
   * `dangerouslySetInnerHTML` call safe even when `code` carries
   * model-generated source text. See the ShikiCodeProps.code JSDoc above
   * for the trust contract callers MUST honor (do NOT pre-render the input
   * string through markdown / HTML before passing it here).
   */
  return (
    <div
      data-testid="shiki-code"
      className="shiki-host overflow-x-auto text-[11px] leading-[1.7] [&_pre]:!m-0 [&_pre]:!px-3 [&_pre]:!py-2 [&_pre]:!bg-transparent [&_pre]:font-mono [&_pre]:whitespace-pre"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
