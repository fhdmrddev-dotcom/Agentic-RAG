// Phase 276-03 (T-276-11, UI-SPEC P2 body) — repo Markdown → the docs DOM.
//
// Safety: react-markdown + remark-gfm and NOTHING that re-enables raw HTML. Without that plugin a
// `<script>` or any inline HTML in a page stays TEXT; the default urlTransform drops javascript:
// (and other unsafe) URLs. Article.test.tsx pins both.
//
// Shape: H2 ids come from headingId() (identical to the build's, so TOC + search anchors land);
// tables scroll inside a focusable region; screenshots under /docs-assets/shots/ become figures
// with their real 1280x800 size; "> **Note:**" / "> **Warning:**" blockquotes become callouts; a
// bare `::video` paragraph is where the page's frontmatter video slot goes.
import type { ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { headingId } from "../headingId"
import { VideoSlot } from "../video/VideoSlot"
import { Callout } from "./Callout"

// The minimal hast shape we read (react-markdown passes the hast node as `node`).
interface HNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HNode[]
}

function textOf(node: HNode | undefined): string {
  if (!node) return ""
  if (node.type === "text") return node.value ?? ""
  return (node.children ?? []).map(textOf).join("")
}

function elementChildren(node: HNode | undefined): HNode[] {
  return (node?.children ?? []).filter((c) => c.type === "element" || (c.type === "text" && (c.value ?? "").trim() !== ""))
}

const VIDEO_DIRECTIVE = /^::video(?:\{slot="([a-z0-9.-]+)"\})?$/

/** True when the body has a bare `::video` paragraph (Article then skips the default placement). */
export function hasVideoDirective(md: string): boolean {
  return md.split("\n").some((l) => VIDEO_DIRECTIVE.test(l.trim()))
}

const SHOT_PREFIX = "/docs-assets/shots/"

function isExternal(href: string | undefined): boolean {
  return !!href && /^https?:\/\//i.test(href)
}

export function Markdown({ children, video }: { children: string; video?: string | null }) {
  const components: Components = {
    h2({ node, children: kids }) {
      const id = headingId(textOf(node as HNode))
      // The "#" link sits BESIDE the heading, not inside it, so the heading's accessible name
      // stays its own text (a screen-reader heading list reads "Stopping a run", not "Link to…").
      return (
        <div className="d-h2-wrap">
          <h2 id={id} tabIndex={-1} className="d-h2">
            {kids}
          </h2>
          <a href={`#${id}`} className="d-anchor" aria-label="Link to this section">
            #
          </a>
        </div>
      )
    },
    h3({ node: _node, children: kids }) {
      return <h3 className="d-h3">{kids}</h3>
    },
    p({ node, children: kids }) {
      const n = node as HNode
      const only = elementChildren(n)
      if (only.length === 1 && only[0].type === "text") {
        const m = VIDEO_DIRECTIVE.exec((only[0].value ?? "").trim())
        if (m) return <VideoSlot slot={m[1] ?? video ?? null} />
      }
      // A paragraph holding only an image renders the figure on its own (no <figure> inside <p>).
      if (only.length === 1 && only[0].tagName === "img") return <>{kids}</>
      return <p>{kids}</p>
    },
    a({ node: _node, href, children: kids, ...rest }) {
      if (isExternal(href)) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
            {kids}
          </a>
        )
      }
      return (
        <a href={href} {...rest}>
          {kids}
        </a>
      )
    },
    img({ node: _node, src, alt }) {
      const s = typeof src === "string" ? src : ""
      if (s.startsWith(SHOT_PREFIX)) {
        return (
          <figure className="d-shot">
            <img src={s} alt={alt ?? ""} width={1280} height={800} loading="lazy" decoding="async" />
            {alt && <figcaption>{alt}</figcaption>}
          </figure>
        )
      }
      return <img src={s} alt={alt ?? ""} loading="lazy" decoding="async" />
    },
    table({ node: _node, children: kids }) {
      return (
        <div className="d-table-wrap" role="region" aria-label="Table" tabIndex={0}>
          <table>{kids}</table>
        </div>
      )
    },
    pre({ node: _node, children: kids }) {
      return <pre className="d-pre">{kids}</pre>
    },
    blockquote({ node, children: kids }) {
      const first = elementChildren(node as HNode)[0]
      const lead = first?.tagName === "p" ? elementChildren(first)[0] : undefined
      const label = lead?.tagName === "strong" ? textOf(lead).trim() : ""
      if (label === "Note:") return <Callout kind="info">{kids as ReactNode}</Callout>
      if (label === "Warning:") return <Callout kind="warn">{kids as ReactNode}</Callout>
      return <blockquote>{kids}</blockquote>
    },
  }

  return (
    <div className="d-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
