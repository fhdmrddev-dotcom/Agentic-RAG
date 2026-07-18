# Stack Research — v3.3 Operator UX

**Domain:** Self-hosted B2B agentic-RAG platform (React/Vite + FastAPI + Supabase + Redis) — adding an operator/admin tier, dynamic model+secrets management, workflow file inputs, and a plain-language/a11y UX layer to a shipped app.
**Researched:** 2026-07-10
**Confidence:** HIGH (existing-stack facts verified against live code + migrations; external facts verified against official Supabase/PyPI/npm sources; versions checked 2026-07)

---

## Headline finding: v3.3 is a near-zero-new-runtime-dependency milestone

The biggest surprise from reading the live codebase is how much of the v3.3 substrate **already exists** and how little genuinely new library surface is required. Concretely:

| The stale PRD assumed… | Reality in the live code | Impact on v3.3 stack |
|---|---|---|
| "API keys persisted to disk as plain text in `settings_override.json`" | `settings_override.json` was **deleted in Phase 081.1 / migration 053**. Settings (incl. provider API keys) now live as columns in the `app_settings` DB row, read via asyncpg with a 30s TTL cache (`backend/app/models/user_settings.py`). | The secrets task is **at-rest column encryption**, not "move off disk." Smaller, cleaner scope. |
| Encrypt secrets "via `pgsodium`" | pgsodium is **pending deprecation** at Supabase (verified below). | pgsodium is now a **do-not-add**. Use app-layer `cryptography` (already installed) or Supabase Vault. |
| Build a `model_capabilities_overrides` editor from scratch | The **table + hot-path read already ship** (migration 053; `_load_model_overrides()` with 30s TTL cache). | Only the **discovery service + write UI** are missing. |
| Discovery is greenfield | `scripts/curate_models.py` **already implements live `/models` discovery for all 8 providers** with per-provider auth + response-shape parsing. | Lift the offline script into a backend service on `httpx` (already a dep). No new lib. |
| Needs `pgsodium`/PyJWT/magic libs added | `cryptography 46.0.7`, `filetype 1.2.0`, `defusedxml 0.7.1`, `pyjwt 2.12.1` are **already installed transitively** in `backend/venv`. | Secrets encryption, content-sniffing file validation, and impersonation JWTs need **0 new runtime installs** — just pin them in `requirements.txt`. |
| Admin surface is greenfield | An `admin.router` + `GET /admin/backpressure` JSON + `test_backpressure.py` already exist (v2.6 WORKER-LIFT-04). | The `/admin` frontend + operator RBAC gate sit on an existing backend seam. |

**Net:** the only truly-new packages worth adding are two dev-only frontend a11y tools and one optional/gated backend malware scanner. Everything else is "declare what's already resolved + write code."

---

## Recommended Stack

### Core additions (backend — mostly declare-what's-already-installed)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `cryptography` (Fernet / `AESGCM`) | already installed **46.0.7** (latest 49.0.0) | App-layer envelope encryption of provider API keys + secrets in `app_settings` | DB-portable (works identically on local Supabase, cloud Supabase, any Postgres — matches the project's local↔cloud env-var switch); sidesteps pgsodium's deprecation; integrates cleanly with the existing asyncpg-direct-read + sync TTL cache (Supabase Vault's decrypt-via-SQL-view fights that path). Master key from env matches CLAUDE.md "env only for secrets/infra." |
| `filetype` | already installed **1.2.0** | Magic-byte content sniffing for the new template/skill upload surfaces | **Pure-Python, zero system deps** — critical vs `python-magic`, which needs the `libmagic` C library on the host + Docker image (awkward on the Windows dev box). Covers all the app's binary formats (PDF/DOCX/PPTX/XLSX/EPUB→zip). |
| `defusedxml` | already installed **0.7.1** | XXE-safe parsing of uploaded OOXML/XML (template threat model) | Drop-in hardening for any XML read of an uploaded `.docx`/`.xlsx`. The real template threat is XXE + zip-bomb + Jinja SSTI, not classic AV. |
| `pyjwt` | already installed **2.12.1** | Mint/introspect short-lived impersonation JWTs ("Sign in as user") | Already present. Prefer the Supabase Auth Admin API (service-role) for session generation where possible; use PyJWT only if hand-signing against the Supabase JWT secret is unavoidable. |
| `httpx` | already a dep **>=0.28** | Live `/models` discovery HTTP client (lift `curate_models.py`) | Already the app's async HTTP client. **Do not** re-introduce `requests` (the offline script's dep) into the service path. |

### Core additions (frontend — dev-only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@axe-core/playwright` | **4.12.1** | Milestone-close a11y gate — axe scan of every `/admin/*` route + install wizard in the existing Playwright suite | Standard WCAG A/AA automation; `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`. Needs `@playwright/test` (have 1.60.0). Caveat: the E2E suite is rotted (SEED-049) — reviving it is a prerequisite for this gate. |
| `eslint-plugin-jsx-a11y` | **6.10.2** | Shift-left a11y linting during the WCAG AA pass | Cheapest, highest-leverage a11y win; plugs into the existing ESLint 9 flat config (`eslint 9.39.4`). Catches missing labels/roles before compile. |

### Optional / gated (do not put in CORE)

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `clamd` (+ `clamav/clamav` Docker container) | **1.0.2** | Malware scanning of user-uploaded templates/skill files | Gate behind a `MALWARE_SCAN_ENABLED` flag / Enterprise deployment preset. Uploaded files are NOT host-executed (they go to Storage + the Docker sandbox, or trusted-path docxtpl render), so AV is defense-in-depth for the "one user uploads, another downloads" case — real, but STRETCH, not a v3.3 CORE blocker. Self-hosting ClamAV is genuine work (no REST API, raw socket, signature-DB updates, a daemon to run). |
| `unist-util-visit` | latest (tiny) | Clean remark/rehype plugin for inline-citation AST transforms | Optional — you can override react-markdown component renderers without it. Add only if you write a dedicated remark plugin. |

### Reused as-is (no addition — already in the stack)

| Existing capability | Serves v3.3 feature |
|---|---|
| `app_settings` DB row + 30s TTL cache + `invalidate_settings_cache()` (`user_settings.py`) | **Feature flags / kill-switch / maintenance mode** substrate (see §e) |
| `model_capabilities_overrides` table + `_load_model_overrides()` hot read (mig 053) | **Dynamic model registry** write target (see §c) |
| `scripts/curate_models.py` per-provider `/models` logic | **Live model discovery** service source (see §c) |
| `admin.router` + `GET /admin/backpressure` + `test_backpressure.py` (v2.6) | **Admin shell** backend seam |
| `dompurify 3.3.3` + `react-markdown 10.1.0` + `remark-gfm 4.0.1` | **Inline citation** rendering + XSS sanitization (see §f) |
| `@radix-ui/react-alert-dialog` (present) | WCAG 2.4.3 focus-trap confirmation modals (typed "APPLY", "kill run") — accessible by default |
| `vitest-axe 0.1.0` (present) | Component-level a11y assertions |
| Redis single-flight lock pattern (`run_claim`, `setup:lock`) | Single-worker-safe audit pruner (see "do not add APScheduler") |
| Supabase Auth + Postgres RLS | **Operator role tier** (see §b) — no RBAC library needed |

---

## The seven questions, answered

### (a) Secrets management — recommend app-layer `cryptography`, NOT pgsodium

**Verified status:** Supabase **does not recommend any new pgsodium usage**; the extension is entering a deprecation cycle ([Supabase pgsodium docs](https://supabase.com/docs/guides/database/extensions/pgsodium)). Supabase **Vault** remains the recommended DB-native option and its API is stable even as its internals migrate off pgsodium ([Vault docs](https://supabase.com/docs/guides/database/vault)); Vault is available self-hosted but requires a `VAULT_ENC_KEY` in the Docker env and exposes decryption through the `vault.decrypted_secrets` SQL view.

**Recommendation: application-layer envelope encryption with `cryptography` (Fernet, or `AESGCM` for AAD).** Encrypt provider keys/secrets on write in `save_app_settings`, decrypt on read in `_build_providers`; master key from a new env var (e.g. `SECRETS_ENCRYPTION_KEY`), versioned ciphertext prefix for rotation. Rationale:
1. **DB-portability is a first-class project value** — the app is a pure env-var switch between local Supabase, cloud Supabase, and (in principle) any Postgres. Vault's key management + decrypt-view differ per environment; app-layer crypto is identical everywhere.
2. **It fits the existing read path.** Settings are read via asyncpg-direct SQL into a *sync* 30s TTL cache. Vault's `decrypted_secrets` view + wrapper-function-for-authz model fights that; app-layer decrypt is a function call on the cached value.
3. **pgsodium deprecation signals Supabase is moving away from DB-layer crypto primitives** — building on Vault's pgsodium internals is a (small) forward risk; app-layer crypto has none.
4. **`cryptography` is already installed** (46.0.7, transitively). Master-key-in-env matches CLAUDE.md's secrets rule.

Keep a thin `SecretsBackend` interface (as the stale PRD proposed) so a Vault or HashiCorp-Vault adapter can land later for Enterprise, but ship **app-layer as the default**. **Supabase Vault is the legitimate alternative** — choose it if you want DB-native encryption, are willing to route reads through `vault.decrypted_secrets`, and accept Supabase coupling.

Integration points: `backend/app/models/user_settings.py` (`save_app_settings` write, `_build_providers` read), `backend/app/dependencies.py` (secrets-backend singleton), a new secrets-column encryption helper. No new migration strictly required if you encrypt the existing `*_api_key` columns in place (store ciphertext as text).

### (b) Operator role tier — dedicated `operator_users` table + RLS, NOT JWT claims (yet)

**Verified:** Supabase's documented RBAC path is a **Custom Access Token Auth Hook** that injects a `user_role` claim into the JWT, read in RLS via `auth.jwt()` ([Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)).

**Recommendation: a dedicated `operator_users` table (system-level `super_admin`/`operator`), enforced by a FastAPI `get_current_operator` dependency for `/admin/*` routes + a `SECURITY DEFINER` `is_operator(uid)` helper for RLS.** Do **not** put the system role in `auth.users.user_metadata`/`app_metadata` or bake it into the JWT via the token hook **right now**. Rationale:
- **v3.4 multi-tenancy owns the RLS rewrite and will need the JWT-claim + token-hook mechanism for per-org RBAC.** If v3.3 consumes that mechanism for *system* roles, the two layers collide. A separate table keeps system-level roles **orthogonal** to org-level RBAC — the exact "nothing in v3.3 may make the RLS rewrite harder" constraint from PROJECT.md.
- System operator roles are **low-cardinality and global** — a table lookup (O(1), TTL-cacheable) is fine; JWT claims buy nothing here and add a token-refresh coupling.
- Bootstrap via `BOOTSTRAP_SUPER_ADMIN_EMAIL` env var on first run (idempotent).

**Critical security note:** admin endpoints will use the **service-role client, which bypasses RLS**. The operator-tier check MUST run in the FastAPI dependency *before* any service-role call; non-operators get **404 (non-discoverable)**, not 403. This is a no-new-library answer: Supabase Auth + Postgres RLS + one table + FastAPI deps. Also ship nullable `org_id` stub columns where cheap so v3.4's RLS shift is a policy change, not a column add.

Do NOT add a policy-engine library (Casbin / oso / Permit.io) — it would duplicate and fight the Supabase RLS model the whole app is built on.

### (c) Live `/models` discovery — lift the existing script; only 2 of 8 providers return capability metadata

`scripts/curate_models.py` already solves the hard part (per-provider auth + response shapes). Lift it into a `model_discovery_service.py` on `httpx`; write results into the existing `model_capabilities_overrides` table (which the hot path already reads). Per-provider reality:

| Provider | Endpoint | Auth | Metadata returned | Usable? |
|---|---|---|---|---|
| OpenAI | `/v1/models` | Bearer | `{id, created, owned_by}` — **IDs + created epoch only** | Yes (list only) |
| Anthropic | `/v1/models` | `x-api-key` + `anthropic-version` | `{id, display_name, created_at}`, paginated (`has_more`/`last_id`) | Yes (list + display name) |
| Google Gemini | `/v1beta/models` | `?key=` query | `{name, displayName, inputTokenLimit, outputTokenLimit, supportedGenerationMethods}` — **richest** | Yes (list + token limits) |
| DeepSeek | `/models` | Bearer | OpenAI-compat `{id}` — IDs only | Yes (list only) |
| Moonshot (Kimi) | `/v1/models` | Bearer | OpenAI-compat — IDs only | Yes (list only) |
| Zhipu/GLM | `/api/paas/v4/models` | Bearer | OpenAI-compat — IDs only | Yes (list only) |
| MiniMax | `/v1/models` | Bearer | shape varies; needs defensive probing | **Best-effort** (may not expose reliably) |
| OpenRouter | `/api/v1/models` | public | `{id, name, context_length, pricing, architecture}` — **rich**, hundreds of models | Yes, but **best-effort/experimental** per project posture |

**Key framing for the roadmap:** live discovery gives you the **model list**; only Google + OpenRouter return capability fields (token limits). `max_output_tokens`, `native_tools`, `context_window`, `default_temperature` for the other six must be **human-curated** into `model_capabilities_overrides` — which is exactly what that table + the new write UI are for. So: **discovery = list refresh + newest-first sort; overrides table = the curated capability layer.** MiniMax + OpenRouter must degrade gracefully (never block the other providers — the script already does `CURATE_SKIP <provider> <reason>` per-provider). Ollama (local) uses a different endpoint (`/api/tags`) if you want local-model discovery.

### (d) File-upload validation — content-sniff (`filetype`) + XXE guard (`defusedxml`); AV is gated

Current state (`backend/app/api/documents.py`): validates via **client-supplied `content_type` + extension override + 50 MB cap** — **no magic-byte check**. For the new template (SEED-110) and skill-file (FILE-01) surfaces with a threat model, add content-based validation:

1. **`filetype.guess()` on the first ~2048 bytes** → cross-check the sniffed MIME against the declared `content_type` + allowlist → reject **415** on mismatch (the "declared vs sniffed" best practice; client `Content-Type` is spoofable). `filetype` is pure-Python (no libmagic) — already installed.
2. **OOXML nuance:** `.docx/.xlsx/.pptx/.epub` sniff as `application/zip` — verify internal structure (the app already does extension normalization for these). For docxtpl templates, additionally validate well-formed OOXML.
3. **`defusedxml`** for any XML parse of an uploaded OOXML (XXE safety) — already installed.
4. **Zip-bomb guard:** cap decompressed size when opening OOXML/zip containers.
5. **Jinja SSTI:** docxtpl renders via Jinja2 — keep the render on the **trusted/whitelist-gated path** the app already uses (per memory `reference_render_template_workflow_only`); never render attacker-controlled template *logic*.
6. **Per-surface size caps** (templates are small; make the 50 MB constant configurable).
7. **Malware (ClamAV/`clamd`)** — gate behind a flag / Enterprise preset (see optional table). Not a CORE blocker.

### (e) Feature-flag / kill-switch — build on `app_settings`, do NOT add a library

The app already has the substrate: the `app_settings` DB row, a 30s TTL cache with cross-worker `invalidate_settings_cache()`, and a proven single-boolean-gate pattern (`document_management_enabled()`, `sandbox_enabled`).

**Recommendation: build on `app_settings`; do NOT add Unleash / Flagsmith / LaunchDarkly / GrowthBook.** Rationale:
- Flags here are **low-cardinality, global** booleans (maintenance mode, runs-paused kill-switch, role-gated feature visibility) — not per-user %-rollouts or A/B experiments.
- The 30s TTL cache already gives near-real-time cross-worker propagation.
- A flag SaaS/service = a whole new service + DB + SDK for a handful of booleans — violates the app's "don't add infra when `app_settings` suffices" ethos.

Shape: a `feature_flags jsonb` column (or a small `feature_flags` table if you want per-flag audit metadata) on the settings substrate; the admin shell writes flags + an `operator_audit_log` row. **Maintenance mode** = a global flag checked in FastAPI middleware returning 503 for non-operators. **Run kill-switch** = the existing `cancel_run` + a `runs_paused` flag gating new run creation. Revisit a library only if per-org gradual rollout is needed (v3.4+).

### (f) Inline citation rendering — no new library

The pieces already exist: citation cards (v2.2 F-01), `react-markdown 10` + `remark-gfm`, `dompurify 3.3.3` (XSS), and the v3.0 document detail panel to link into.

**Recommendation: 0 required new deps.** Inline citations are a rendering + data-contract problem:
- **Backend:** ensure the agent emits stable inline markers (e.g. `[^doc:uuid]` / `[n]`) tied to retrieved chunk IDs (the system prompt already guides structured citations — v2.1 Phase 23; retrieval already returns citation data).
- **Frontend:** a custom `react-markdown` component override (or a small remark/rehype plugin) maps markers → an interactive `<CitationChip>` superscript that opens the existing citation card / document detail panel. Reuse the `ConfidenceChip` visual pattern from v3.0.
- `dompurify` already sanitizes. Optionally add `unist-util-visit` only if writing a dedicated remark plugin.

This is a **G-2 sketch-first** surface (live chat UI, "feels like").

### (g) a11y tooling — add 2 dev tools; lean on Radix

- **`@axe-core/playwright 4.12.1`** (dev) — the milestone-close automated gate (scan `/admin/*` + wizard). Rides on E2E-suite revival (SEED-049).
- **`eslint-plugin-jsx-a11y 6.10.2`** (dev) — shift-left linting on the existing ESLint 9 config.
- **Keep `vitest-axe 0.1.0`** (present) for component tests.
- **Lean on Radix primitives** (already deps) — they ship accessible focus traps / ARIA / keyboard nav. Build the admin shell's dialogs/menus/confirmations on `@radix-ui/react-alert-dialog` etc. rather than hand-rolling; this satisfies WCAG 2.4.3 (focus trap + Esc) for the typed-confirmation modals for free.
- **Reality check:** axe automates only ~50% of WCAG A/AA — the manual keyboard-only walkthrough (CLAUDE.md lived-experience UAT) is still required.

---

## Installation

```bash
# Backend — pin what's already resolved in the venv (no new install for these 4):
#   cryptography, filetype, defusedxml, pyjwt
# Add to backend/requirements.txt:
#   cryptography>=44,<50      # already 46.0.7
#   filetype>=1.2,<2          # already 1.2.0
#   defusedxml>=0.7           # already 0.7.1
#   pyjwt>=2.10,<3            # already 2.12.1
# Optional / gated (only if malware scanning is enabled):
#   clamd>=1.0.2              # + a clamav/clamav Docker service behind MALWARE_SCAN_ENABLED

# Frontend — genuinely new (dev-only):
npm install -D @axe-core/playwright@4.12.1 eslint-plugin-jsx-a11y@6.10.2
# Optional, only if writing a remark citation plugin:
# npm install unist-util-visit
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| App-layer `cryptography` (Fernet/AESGCM) for secrets | **Supabase Vault** (`vault.create_secret` + `decrypted_secrets` view) | You want DB-native encryption, are Supabase-hosted-only, and will route reads through the SQL view. Still needs `VAULT_ENC_KEY` self-hosted. |
| App-layer `cryptography` | **pgcrypto** | You want in-DB encrypt/decrypt functions and accept keys passing through SQL. Weaker than app-layer key isolation. |
| `operator_users` table + FastAPI dep | **Custom Access Token Hook + JWT `user_role` claim** | The *right* tool for v3.4 per-org RBAC — reserve it for then, not v3.3 system roles. |
| `filetype` (pure-Python) | **python-magic** (libmagic) | You need libmagic's much larger signature set AND can install the C lib on host + Docker (Linux-only deployments). Overkill for the app's known format set. |
| Build flags on `app_settings` | **Unleash / Flagsmith (self-host) / GrowthBook** | You need per-user/per-org %-rollouts, A/B experiments, or targeting rules — a v3.4+ multi-tenancy concern, not v3.3. |
| In-process asyncio pruner + Redis lock | **APScheduler** | You need cron-expression scheduling with persistence — deferred to the v3.4 real scheduler; don't pull it in for one daily DELETE. |
| Reuse `react-markdown` for citations | A dedicated citation/annotation lib | Never for this app — you'd fragment the single markdown-render path. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **pgsodium** (directly) | Pending deprecation at Supabase; no new usage recommended | App-layer `cryptography` (default) or Supabase Vault (stable API) |
| **HashiCorp Vault / Doppler / 1Password Connect / Infisical** | Real infra for a handful of secrets; over-scoped for v3.3 | App-layer `cryptography` now; keep a `SecretsBackend` interface so an Enterprise adapter lands later without churn |
| **JWT `user_role` claim / token hook for system operator roles** | Collides with v3.4 org-RBAC, which owns the claim+hook mechanism | `operator_users` table + FastAPI dependency + RLS helper |
| **Casbin / oso / Permit.io (policy engine)** | Duplicates + fights the Supabase RLS model the whole app is built on; complicates the v3.4 RLS rewrite | Postgres RLS + `is_operator()` + FastAPI deps |
| **python-magic (libmagic)** | Needs a C system library on host + Docker image (Windows-dev-hostile) | `filetype` (pure-Python, already installed) |
| **Feature-flag SaaS/services** (Unleash/Flagsmith/LaunchDarkly/GrowthBook) | New service + DB + SDK for global booleans the `app_settings` cache already handles | `app_settings` `feature_flags` column/table + 30s TTL cache |
| **APScheduler** (as a new heavy dep for the audit pruner) | The app has no scheduler; v3.4 owns the real one — don't add a dep for one daily job | In-process asyncio task in lifespan + existing Redis single-flight lock |
| **`requests`** in the discovery service path | The offline `curate_models.py` uses it, but the app standard is async `httpx` | `httpx` (already a dep) |
| **ClamAV as a CORE/hard dependency** | Self-hosting is genuine ops work; uploaded files aren't host-executed | Gate `clamd` behind `MALWARE_SCAN_ENABLED` / Enterprise preset (STRETCH) |
| **A new markdown/citation renderer** | Fragments the single sanitized render path | Custom `react-markdown` component override + existing `dompurify` |
| **LangChain / LangGraph** (for any admin/agent tooling temptation) | Project red-line rule — raw SDKs only | Raw provider SDKs (already the pattern) |
| **k8s/Helm deps (`pyhelm3`, etc.) in CORE** | Enterprise presets are the "biggest lift / natural STRETCH-defer" per PROJECT.md | Keep k8s tooling out of the CORE dependency set; ship compose first |
| **`prometheus_client` (speculative)** | Only if the `/metrics` endpoint is actually scoped this milestone | Add only when the observability-endpoint requirement is confirmed CORE |

---

## Stack Patterns by Variant

**If the operator picks Supabase Vault over app-layer crypto:**
- Route secret reads through a `SECURITY DEFINER` wrapper over `vault.decrypted_secrets` (never call `vault.create_secret`/decrypt directly from user-scoped paths).
- Provision `VAULT_ENC_KEY` in the self-hosted Docker env, stored separately from DB backups.
- Accept that the 30s TTL sync cache path needs a decrypt-at-read adapter.

**If malware scanning is enabled (Enterprise preset):**
- Run `clamav/clamav` as a compose service alongside Redis; point `clamd` at its socket/TCP.
- Scan template/skill uploads *before* Storage write; fail closed on scanner-unreachable only if `MALWARE_SCAN_REQUIRED=true`, else warn-and-pass.

**If per-org/gradual feature rollout is ever needed (v3.4+):**
- Revisit a self-hosted flag service (Flagsmith/Unleash) — but only once org-level targeting is a real requirement, not before.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `cryptography` 46.0.7 (installed; latest 49.0.0) | Python 3.11+, existing supabase/httpx/pyjwt stack | Already resolved transitively — pinning is a formality; ships as wheels. |
| `filetype` 1.2.0 | Any Python 3; no deps | Pure-Python; no libmagic. |
| `defusedxml` 0.7.1 | Any Python 3; stdlib xml | Already installed. |
| `pyjwt` 2.12.1 | Supabase JWT secret (HS256) | Prefer Supabase Admin API for session generation; PyJWT only if hand-signing. |
| `@axe-core/playwright` 4.12.1 | `@playwright/test` 1.60.0 (present) | Uses `AxeBuilder`; needs E2E suite revival (SEED-049). |
| `eslint-plugin-jsx-a11y` 6.10.2 | ESLint 9.39.4 flat config (present) | Add to the flat-config plugins array. |
| `clamd` 1.0.2 | A running `clamd` daemon (Docker) | No daemon → import is inert; gate on env flag. |

---

## Sources

- [Supabase — pgsodium (pending deprecation) docs](https://supabase.com/docs/guides/database/extensions/pgsodium) — HIGH: confirms pgsodium deprecation + "no new usage recommended," Vault as successor.
- [Supabase — Vault docs](https://supabase.com/docs/guides/database/vault) — HIGH: Vault API stable through pgsodium migration; `decrypted_secrets` view.
- [Supabase — Self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker) + [self-hosted Vault guide](https://www.supascale.app/blog/secrets-management-for-selfhosted-supabase-a-complete-vault-) — MEDIUM: `VAULT_ENC_KEY` requirement, key-separation guidance.
- [Supabase — Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) + [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — HIGH: the JWT-claim RBAC path (reserved for v3.4).
- [cryptography — Fernet docs](https://cryptography.io/en/latest/fernet/) — HIGH: app-layer symmetric encryption.
- [Playwright — Accessibility testing](https://playwright.dev/docs/accessibility-testing) — HIGH: `@axe-core/playwright` + `withTags` for WCAG A/AA.
- File-validation best practices (magic bytes vs Content-Type; `filetype` vs `python-magic`) — MEDIUM (multiple corroborating sources): [MIME/magic-bytes guide](https://zerotool.dev/blog/mime-type-lookup-guide/), [python-magic](https://codecut.ai/python-magic-file-type-detection/).
- ClamAV self-hosting tradeoffs — MEDIUM: [ClamAV docs](https://docs.clamav.net/), [antivirus-API comparison](https://www.attachmentscanner.com/blog/best_antivirus_api_malware_scanning_comparison).
- Live-code verification (HIGH): `backend/app/models/user_settings.py` (settings/secrets read path, `_load_model_overrides`), `supabase/migrations/053_settings_unification.sql` (`model_capabilities_overrides` table), `scripts/curate_models.py` (8-provider `/models` discovery), `backend/app/api/documents.py` (current upload validation), `backend/venv/Lib/site-packages` (cryptography 46.0.7 / filetype 1.2.0 / defusedxml 0.7.1 / pyjwt 2.12.1 already installed), `frontend/package.json` (vitest-axe present; dompurify/react-markdown present).
- Package versions verified 2026-07-10 via npm registry + PyPI JSON API.

---
*Stack research for: v3.3 Operator UX (admin shell, dynamic model/secrets management, workflow file inputs, plain-language/a11y UX)*
*Researched: 2026-07-10*
