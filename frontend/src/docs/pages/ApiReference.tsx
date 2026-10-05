// Phase 276-03 (UI-SPEC P6, DOCS-03, D-16, T-276-13) — the public API reference.
//
// Scalar is loaded ONLY here, through a dynamic import (DocsApp also lazy-loads this whole page),
// so it is never in the docs first-paint payload. It reads the static, pre-filtered
// openapi.public.json and is configured to send nothing anywhere: telemetry off, the AI agent
// disabled, the test-request / API-client buttons hidden, no default (CDN) fonts. The page never
// calls a live backend — the only request it makes itself is a HEAD check that the spec exists, so
// a missing file (dev answers 404) shows the error state instead of an empty reference.
import { useEffect, useState, type ComponentType } from "react"
import { Breadcrumbs } from "../components/Breadcrumbs"
import { Callout } from "../components/Callout"

export const PUBLIC_SPEC_URL = "/docs-assets/openapi.public.json"

type ScalarProps = { configuration: Record<string, unknown> }
type ScalarModule = { ApiReferenceReact: ComponentType<ScalarProps> }

// 276-REVIEW B-CR-01: @scalar/api-reference-react does NOT inject its own CSS — the host must
// import `style.css`, and nothing did, so the reference shipped as an unstyled Vue tree. The
// stylesheet rides the SAME dynamic import (lazy, never in first paint). It holds only `data:`
// URLs, so it adds no third-party request.
const defaultLoad = (): Promise<ScalarModule> =>
  Promise.all([
    import("@scalar/api-reference-react"),
    import("@scalar/api-reference-react/style.css"),
  ]).then(([mod]) => mod as unknown as ScalarModule)

/** Deep Midnight tokens mapped onto Scalar's CSS variables (UI-SPEC P6). */
const DEEP_MIDNIGHT_CSS = `
.dark-mode {
  --scalar-background-1: #06090F;
  --scalar-background-2: #0C1017;
  --scalar-background-3: #121721;
  --scalar-background-accent: hsl(239 100% 82% / .10);
  --scalar-border-color: #212631;
  --scalar-color-1: #F2F4FE;
  --scalar-color-2: #97A1B4;
  --scalar-color-3: #97A1B4;
  --scalar-color-accent: #A3A5FF;
  --scalar-sidebar-background-1: #0C1017;
  --scalar-sidebar-border-color: #212631;
  --scalar-sidebar-color-1: #F2F4FE;
  --scalar-sidebar-color-2: #97A1B4;
  --scalar-sidebar-color-active: #A3A5FF;
  --scalar-sidebar-item-active-background: hsl(239 100% 82% / .10);
  --scalar-font: "Inter", ui-sans-serif, system-ui, sans-serif;
  --scalar-font-code: "JetBrains Mono", ui-monospace, monospace;
}
`

/** The Scalar configuration contract. Every key was checked against @scalar/types 0.9.77's schema. */
export const SCALAR_CONFIGURATION: Record<string, unknown> = {
  url: PUBLIC_SPEC_URL,
  telemetry: false,
  agent: { disabled: true },
  mcp: { disabled: true },
  withDefaultFonts: false,
  hideClientButton: true,
  hideTestRequestButton: true,
  showDeveloperTools: "never",
  darkMode: true,
  forceDarkModeState: "dark",
  hideDarkModeToggle: true,
  documentDownloadType: "json",
  customCss: DEEP_MIDNIGHT_CSS,
}

type State = { kind: "loading" } | { kind: "ready"; Scalar: ComponentType<ScalarProps> } | { kind: "error" }

export function ApiReference({ load = defaultLoad }: { load?: () => Promise<ScalarModule> }) {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let live = true
    Promise.all([
      load(),
      fetch(PUBLIC_SPEC_URL, { method: "HEAD" }).then((res) => {
        if (!res.ok) throw new Error(`openapi.public.json: HTTP ${res.status}`)
      }),
    ]).then(
      ([mod]) => live && setState({ kind: "ready", Scalar: mod.ApiReferenceReact }),
      () => live && setState({ kind: "error" }),
    )
    return () => {
      live = false
    }
  }, [load])

  return (
    <div className="d-api">
      <div className="wrap">
        <div className="d-api-intro">
          <Breadcrumbs
            items={[
              { label: "Docs", href: "/docs" },
              { label: "API", href: "/docs/api" },
              { label: "Reference", href: "/docs/api/reference" },
            ]}
          />
          <h1 tabIndex={-1} className="d-h1">
            Syrel API
          </h1>
          <p className="d-lead">
            Every action in the Syrel app goes through this API. This reference lists the public endpoints.
          </p>
          <Callout kind="info">
            <p>
              <strong>No API keys today.</strong> Syrel has no API keys, personal access tokens or service accounts. A
              script signs in as a user and sends that user's token with each request. API keys, webhooks and rate
              limits are not available today — <a href="/docs/api/roadmap-open-platform">see what's planned</a>. Read{" "}
              <a href="/docs/api/concepts/authentication">Authentication</a> first.
            </p>
          </Callout>
          <p className="d-api-links">
            <a href={PUBLIC_SPEC_URL} download="openapi.public.json">
              Download the OpenAPI file
            </a>
            <span aria-hidden="true"> · </span>
            <a href="/docs/api/reference/operator">Operator API</a>
          </p>
        </div>
      </div>
      <div className="d-api-ref">
        {state.kind === "loading" && (
          <p className="d-api-state d-muted" role="status">
            Loading the API reference…
          </p>
        )}
        {state.kind === "error" && (
          <p className="d-api-state" role="alert">
            The API reference couldn't load. Refresh the page, or{" "}
            <a href={PUBLIC_SPEC_URL} download="openapi.public.json">
              download the OpenAPI file
            </a>
            .
          </p>
        )}
        {state.kind === "ready" && <state.Scalar configuration={SCALAR_CONFIGURATION} />}
      </div>
    </div>
  )
}
