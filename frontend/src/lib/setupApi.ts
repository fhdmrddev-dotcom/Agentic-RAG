/**
 * Phase 158 (DEPLOY-02 / D-15) — the UNAUTHENTICATED, token-gated first-run setup API client.
 *
 * The install wizard writes config BEFORE any Supabase session exists, so these calls MUST NOT
 * route through api.ts's authed header helper — it calls `supabase.auth.getSession()` and
 * throws "Not authenticated" pre-auth (RESEARCH Anti-Patterns; the DIVERGE-from analog). Instead
 * each
 * WRITE carries the first-boot setup token in the `X-Setup-Token` header (the operator reads it
 * from `docker compose logs backend`). That token + the finalize latch are the SOLE access
 * authority for `/setup/*`: the backend runs on the service-role key with NO RLS backstop (the
 * v3.3 red-line), so a missing token on any write is a full pre-auth config-write hole.
 *
 * URL note: the backend serves these routes UNPREFIXED (`/setup/validate`, …). In prod
 * `API_BASE` is `/api` and nginx strips the single `/api`; in local dev `API_BASE` is
 * `http://localhost:8000`. So `${API_BASE}/setup/<step>` is the correct browser URL in BOTH —
 * exactly like api.ts `${API_BASE}/threads` (never a hardcoded `/api` prefix, which would
 * double up to `/api/api/...` under nginx).
 *
 * Endpoint contract mirrors the 158-06 router exactly: detect · validate · schema-bootstrap ·
 * operator · provider-key · smoke · finalize.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

// ── Error ────────────────────────────────────────────────────────────────────────────────────

/** A setup write that came back non-2xx, carrying the server's plain-language detail so the
 *  wizard can render it verbatim — a GoTrue password-policy message (400), the finalize
 *  smoke-not-green block (409), an invalid/expired token (401), a rate-limit (429), or a
 *  save-through failure (500). Mirrors api.ts `ApiError` (status + name + a typed payload). */
export class SetupApiError extends Error {
  readonly status: number
  /** The raw FastAPI `detail` (a string, or a structured object like the finalize block). */
  readonly detail: unknown
  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = "SetupApiError"
    this.status = status
    this.detail = detail
  }
}

// ── Request / response shapes (mirror the 158-06 Pydantic bodies + 158-05 service returns) ────

/** The submitted infra tier the live bind/validate + schema-bootstrap probes run against. */
export interface BindBody {
  supabase_url?: string
  supabase_anon_key?: string
  supabase_service_role_key?: string
  supabase_publishable_key?: string
  supabase_secret_key?: string
  postgres_dsn?: string
  redis_url?: string
}

/** A sanitized probe outcome — `reason` is ONLY a bare exception class name (SSRF hygiene). */
export interface ProbeResult {
  state: "up" | "down"
  reason?: string | null
}

/** The Postgres probe additionally reports the `to_regclass` schema-presence sentinel. */
export interface PostgresProbeResult extends ProbeResult {
  schema_present?: boolean
}

export interface DetectResult {
  in_docker: boolean
  store_present: boolean
  db_reachable: boolean
  redis_reachable: boolean
}

export interface ValidateResult {
  supabase: ProbeResult
  postgres: PostgresProbeResult
  redis: ProbeResult
}

/** The schema-bootstrap SHOULD endpoint: a no-op skip, a real bootstrap, or a guide fallback. */
export interface SchemaBootstrapResult {
  ok: boolean
  skipped?: boolean
  schema_present?: boolean
  bootstrapped?: boolean
  reason?: string
  /** Present when the auto-runner can't/needn't run — the operator gets the copy-guide. */
  fallback?: "guide"
  seed_sequence?: string[]
}

export interface OperatorBody {
  email: string
  password: string
  supabase_url?: string
  supabase_service_role_key?: string
  postgres_dsn?: string
}

export interface OperatorResult {
  status: "created" | "already_exists"
  already_exists: boolean
  user_id: string | null
}

export interface ProviderKeyBody {
  provider: string
  api_key: string
  embedding_key?: string
}

export interface ProviderKeyResult {
  ok: boolean
}

/** The submitted config the 5-way smoke checklist probes server-side (the finalize gate). */
export interface SmokeBody {
  supabase_url?: string
  service_role_key?: string
  postgres_dsn?: string
  redis_url?: string
  provider?: string
  provider_key?: string
}

/** The five smoke rows keyed by id — a row is green (`state:"up"`) ONLY on server truth. */
export type SmokeCheckId =
  | "supabase_auth"
  | "postgres_schema"
  | "redis_ping"
  | "provider_key"
  | "operator_row"

export interface SmokeResult {
  checks: Record<SmokeCheckId, ProbeResult>
  all_green: boolean
}

/** The full config finalize commits: the infra tier (→ file marker) + operator_emails + the
 *  provider values the server RE-SMOKES (never trusting a client "all green"). */
export interface FinalizeBody {
  supabase_url?: string
  supabase_anon_key?: string
  supabase_service_role_key?: string
  supabase_publishable_key?: string
  supabase_secret_key?: string
  postgres_dsn?: string
  redis_url?: string
  secrets_encryption_key?: string
  operator_emails?: string
  provider?: string
  provider_key?: string
}

export interface FinalizeResult {
  finalized: boolean
  restart_required: boolean
  setup_complete_persisted: boolean
  message: string
}

// ── Transport ─────────────────────────────────────────────────────────────────────────────────

/** The token-carrying headers for every `/setup/*` WRITE. NEVER the authed api.ts header helper
 *  — a pre-auth write has no Supabase session (D-15). */
function setupHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", "X-Setup-Token": token }
}

/** POST `${API_BASE}/setup/<step>` with the token header; parse JSON; on a non-2xx surface the
 *  server's plain-language `detail` (verbatim string, or the structured block's `message`) as a
 *  `SetupApiError` the wizard can render. */
async function postSetup<T>(step: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/setup/${step}`, {
    method: "POST",
    headers: setupHeaders(token),
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    // FastAPI surfaces the actionable cause in `detail` — a string (GoTrue password policy,
    // invalid token), or a structured object (the finalize smoke-not-green block). Preserve it.
    const parsed = (await res.json().catch(() => null)) as { detail?: unknown } | null
    const detail = parsed?.detail ?? null
    const nested = (detail as { message?: unknown } | null)?.message
    const message =
      typeof detail === "string"
        ? detail
        : typeof nested === "string"
          ? nested
          : `Setup step "${step}" failed (status ${res.status}).`
    throw new SetupApiError(message, res.status, detail)
  }
  return (await res.json()) as T
}

// ── Token-gated step helpers (each sends X-Setup-Token) ────────────────────────────────────────

/** D-08: light env-detect — cheap booleans to pre-fill defaults, not auto-discovery. */
export function postDetect(token: string): Promise<DetectResult> {
  return postSetup<DetectResult>("detect", token)
}

/** D-10: validate the SUBMITTED infra via throwaway connections (sanitized pass/fail only). */
export function postValidate(token: string, body: BindBody): Promise<ValidateResult> {
  return postSetup<ValidateResult>("validate", token, body)
}

/** D-10 (SHOULD): schema-absent-gated auto-runner; a privilege error → `{fallback:"guide"}`. */
export function postSchemaBootstrap(
  token: string,
  body: BindBody,
): Promise<SchemaBootstrapResult> {
  return postSetup<SchemaBootstrapResult>("schema-bootstrap", token, body)
}

/** D-11: mint the first CONFIRMED operator. A duplicate → `{already_exists:true}` (200); a
 *  GoTrue password-policy rejection → a `SetupApiError` with the verbatim 400 message. */
export function postOperator(token: string, body: OperatorBody): Promise<OperatorResult> {
  return postSetup<OperatorResult>("operator", token, body)
}

/** D-12: persist the provider key through the encrypt-on-write seam; a save-False → 500. */
export function postProviderKey(
  token: string,
  body: ProviderKeyBody,
): Promise<ProviderKeyResult> {
  return postSetup<ProviderKeyResult>("provider-key", token, body)
}

/** D-13: run the 5-way green checklist server-side (the finalize gate). */
export function postSmoke(token: string, body: SmokeBody): Promise<SmokeResult> {
  return postSetup<SmokeResult>("smoke", token, body)
}

/** D-05: write the dual finalize marker + signal restart-to-apply. Re-smoked server-side —
 *  a non-green config is refused with a 409 `SetupApiError` carrying the failing rows. */
export function postFinalize(token: string, body: FinalizeBody): Promise<FinalizeResult> {
  return postSetup<FinalizeResult>("finalize", token, body)
}
