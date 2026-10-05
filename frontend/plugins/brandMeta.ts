// frontend/plugins/brandMeta.ts — Phase 276-07 (D-27).
//
// Link-preview crawlers (Slack, LinkedIn, X, iMessage) need an ABSOLUTE og:image URL. The source
// html keeps every brand tag relative and same-origin (brandAssets.test.ts fences that), and this
// plugin makes og:image / twitter:image absolute at BUILD time from the app's already-configured
// origin, VITE_APP_URL (deploy/onebox.env.example; docs/OPERATOR.md sets it in production).
//
// No new env var: VITE_APP_URL already exists. Only an http(s) value counts, and only its ORIGIN is
// used (T-276-45) — anything else (unset, empty, a bare host, javascript:) leaves the html exactly
// as written, which is correct for onebox where the app and its images share one origin. While it
// is unset in a deploy, link previews carry a relative image path and most crawlers show none.
import type { Plugin } from "vite"

const IMAGE_TAG = /<meta\s+(property="og:image"|name="twitter:image")\s+content="(\/[^"]*)"/g

/** The origin of an http(s) URL, or null for anything else. */
function httpOrigin(appUrl?: string): string | null {
  if (!appUrl) return null
  let url: URL
  try {
    url = new URL(appUrl.trim())
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  return url.origin
}

/** Pure: rewrite relative og:image / twitter:image contents to `<origin><path>`. */
export function absolutizeBrandMeta(html: string, appUrl?: string): string {
  const origin = httpOrigin(appUrl)
  if (!origin) return html
  return html.replace(IMAGE_TAG, (_m, which: string, rel: string) => `<meta ${which} content="${origin}${rel}"`)
}

/** Vite plugin applying absolutizeBrandMeta to every html entry (landing, app, docs). */
export function brandMeta(appUrl?: string): Plugin {
  return {
    name: "syrel-brand-meta",
    transformIndexHtml(html) {
      return absolutizeBrandMeta(html, appUrl)
    },
  }
}
