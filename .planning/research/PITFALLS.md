# Pitfalls Research

**Domain:** Adding an operator/admin tier + secrets/model-registry management + run-time file-input surfaces + plain-language/citation UX to a mature, single-service-role, multi-provider RAG platform (v3.3 Operator UX)
**Researched:** 2026-07-10
**Confidence:** HIGH (grounded in the live codebase — `dependencies.py:19` service-role client, `template_render_service.py` provenance boundary, `user_settings.py` secrets-in-DB, `config.py` model registry + `model_capabilities_overrides` read path — cross-checked against SEED-024/078/104/108 and the four project landmines in the milestone brief). MEDIUM on the generic file-security facts (SSTI / zip-bomb / path-traversal), which are well-established and verified against this codebase's own existing defenses.

> **Scope note.** These are pitfalls specific to ADDING these features to *this* system, not a generic security checklist. Every prevention names a real file/seam and an owning phase-track. Generic "admin panels are risky" advice is omitted. Where a defense already exists in the codebase, the pitfall is the *regression risk* of the new surface breaking it — not re-deriving the defense.

> **Phase-track legend (v3.3 roadmap isn't created yet — this research feeds it). The four milestone tracks map to these working labels:**
> - **P-ADMIN** — operator role tier + `/admin` shell + impersonation + role-gated visibility (Track 2; SEED-012/095/099). **Must land FIRST** — the `require_operator` boundary that every other write-UI sits behind.
> - **P-KILL** — kill-switch / maintenance-mode / feature-flag control plane (Track 2; SEED-078).
> - **P-REGISTRY** — dynamic model registry + live `/models` discovery (Track 3; SEED-088/040).
> - **P-SECRETS** — settings unification + secrets hardening (Track 3; SEED-024).
> - **P-FILE** — run-time template upload (SEED-110) + per-workflow KB folder-scope (SEED-112) + RAG→sandbox original-bytes bridge (SEED-108) (Track 1).
> - **P-ATTACH** — agent-driven skill file attachment, a WRITE-capable tool (Track 1; FILE-01 / SEED-104).
> - **P-INSTALL** — install wizard + Solo/Team/Enterprise presets (Track 3, STRETCH; SEED-003).
> - **P-UX** — plain-language relabel (SEED-085) + inline citation attribution (SEED-033) + a11y (SEED-092).

## Critical Pitfalls

### Pitfall 1: The service-role client is the ONLY isolation gate — `/admin` routes have no RLS backstop

**What goes wrong:**
A new `/admin` route (user list, audit browser, "view this user's threads") ships with a role decorator but a missing or wrong `.eq("user_id", …)` filter, and silently returns *every* user's data. Teams assume "RLS will catch a cross-user query." On this backend it will not.

**Why it happens:**
`get_supabase()` builds the client with `settings.supabase_service_role_key` (`backend/app/dependencies.py:19`). **The entire backend already bypasses Postgres RLS.** Per-user isolation today is enforced purely by explicit application-layer `WHERE user_id = current_user.id` filters in each route. RLS policies exist in the schema but only bite the frontend's anon-key path and Realtime — never the FastAPI service path. So an `/admin` route that *intends* to read across users has zero database-level backstop: the WHERE clause plus the role check ARE the entire boundary.

**How to avoid:**
Treat every `/admin` route as "one typo from a full-tenant leak." (1) A single `require_operator` FastAPI dependency, default-deny, applied at the router level — not per-handler. (2) Cross-user reads go through a *small, reviewed* set of operator query helpers, never ad-hoc `.select()` in the handler. (3) Add a test that hits every `/admin` route with a normal user's JWT and asserts 403. (4) Do NOT rely on adding real per-user Postgres RLS as the fix now — that's the v3.4 rewrite (Pitfall 3); in v3.3 the discipline is explicit, audited, reviewed WHERE clauses.

**Warning signs:**
An `/admin` handler with a raw `.select("*")` and no user scoping; an endpoint that returns data for a normal-user JWT; a code review that says "RLS protects this."

**Phase to address:** P-ADMIN (build the `require_operator` boundary before any operator query lands).

---

### Pitfall 2: Impersonation that mints a real victim session or drops the operator's identity from the audit trail

**What goes wrong:**
"View as user" is implemented by minting the target user's Supabase JWT (or by swapping `current_user.id` mid-request). Every downstream write — `audit_log`, `messages`, `documents`, settings — is then attributed to the *impersonated* user, not the operator. You permanently lose "operator X acted as user Y," which is exactly the record an insider-abuse or support investigation needs. Worse, a minted victim session over the service-role backend can do anything the victim can, with no dual-control.

**Why it happens:**
Supabase Auth makes it easy (`auth.admin.generateLink`, service-role token minting), and "just become the user" is the shortest path to a working demo. The audit gap is invisible until someone asks "who did this?"

**How to avoid:**
Impersonation is a **dual-identity, read-mostly** server context: the request carries `actor_id = operator` AND `subject_id = target_user`, and BOTH are stamped into `operator_audit_log` on every action. Never mint the target's real session. Default impersonation to read-only; any write-as-user requires a second explicit confirmation and is logged as `operator_acting_as`. Put a persistent, un-dismissable "You are viewing as <user>" banner in the UI so an operator can't forget they're impersonating.

**Warning signs:**
Audit rows during impersonation show only the victim's id; there's a code path that generates or returns a token for another user; impersonation grants write with no distinct log action.

**Phase to address:** P-ADMIN.

---

### Pitfall 3: Modeling the operator role in a shape that poisons the v3.4 multi-tenancy RLS rewrite (one-way door)

**What goes wrong:**
v3.3 adds the operator tier as an `is_admin` boolean on the user row, or as "a user who belongs to a special org." Then v3.4 — the multi-tenancy RLS rewrite across ~18 tables, the highest-risk apply the platform will ever do — has to special-case the operator inside every new org-scoped policy, or unwind the boolean. The role model chosen in v3.3 is a one-way door the milestone brief explicitly flags.

**Why it happens:**
The SYSTEM operator (super_admin / operator — governs the deployment) and the future ORG roles (owner/admin/member/viewer — govern a tenant's data) *feel* like the same "roles" feature, so they get one table/column. D-PRD-14 already distinguishes them; it's easy to collapse under time pressure.

**How to avoid:**
Model the SYSTEM operator as a **separate principal**, orthogonal to org membership — a distinct `operator_users` table keyed to the auth user, with deployment-global scope and no dependence on `org_id`. Ship cheap `org_id` stub columns where the brief calls for them, but the operator's *identity and authority must not be expressed through org shape*. Write down the invariant: "an operator is not a user-in-an-org; the v3.4 RLS policies will scope *users* by org and leave the operator principal untouched."

**Warning signs:**
An `is_admin`/`role` column on the `users`/`user_settings` table; operator permission checks that read org membership; any place the operator's authority is derived from what org they're in.

**Phase to address:** P-ADMIN (schema shape locked here; verified against the v3.4 RLS plan).

---

### Pitfall 4: A new run-time template-upload path that breaks the existing provenance→engine security boundary (SSTI)

**What goes wrong:**
SEED-110 turns template upload from v2.9's one-run ephemeral into a repeatable run-time input. A new upload handler infers the fill engine from file *content* or *extension*, or a "save this run's template to my library" feature promotes an uploaded file to a trusted `AssetRef` — and an untrusted upload reaches the Jinja/`docxtpl` engine. Now a user-supplied `{{ ''.__class__.__mro__[1].__subclasses__() }}` payload executes server-side template injection inside the render.

**Why it happens:**
The existing defense is *structural but invisible*: `select_engine()` in `backend/app/services/template_render_service.py:936` routes by **provenance, not content** — `kind='template_input'` (untrusted) → `run_replace` (non-Jinja, scalar-only), a library `AssetRef` (trusted) → `docxtpl`/Jinja, with a hard `assert engine != "docxtpl"` on the untrusted branch (D-02). A new code path that doesn't stamp `kind='template_input'`, or that promotes uploads into the library, silently defeats it. `SandboxedEnvironment(autoescape=True)` is defense-in-depth, not the primary control.

**How to avoid:**
Every run-time upload is stamped `kind='template_input'` at the ingress boundary and can *only* route to `run_replace`. Library promotion (upload → reusable trusted template) is NOT an implicit provenance carry — it must be an explicit author/review action that re-stamps provenance deliberately. Add a test that feeds a Jinja-payload upload and asserts it renders literally (never evaluates) and that `select_engine('template_input')` can never return `docxtpl`.

**Warning signs:**
Any engine selection keyed off extension/MIME/content; a "save to library" that copies the upload's provenance; a new render entry point that imports `docxtpl`/`jinja2` for an upload path.

**Phase to address:** P-FILE.

---

### Pitfall 5: File-upload surface trusts MIME/extension → zip bombs, decompression bombs, path traversal, oversized files

**What goes wrong:**
`.docx`/`.pptx`/`.xlsx` are ZIP containers. A malicious "template" is a renamed executable, a zip bomb (a few KB that decompresses to GB), or carries entries with `../../` paths. The template-variable parser opens `zipfile.ZipFile(io.BytesIO(data))` on the raw bytes (`template_render_service.py:381`), and the sandbox render unzips it again — a crafted archive OOMs the worker or (if any code extracts to a path derived from an entry name) writes outside the intended directory.

**Why it happens:**
Extension/MIME are attacker-controlled and easy to trust. `zipfile` will happily open a bomb; the decompression ratio isn't checked unless you check it. This isn't hypothetical here — the platform already hit real OOM on legitimate large files (the thesis-PDF `MemoryError` in the PyMuPDF subprocess, PROJECT.md Phase 071.2).

**How to avoid:**
At the upload boundary: (1) validate magic bytes, not extension; (2) hard-cap raw file size; (3) before extract, cap total *uncompressed* size and compression ratio (reject > ~100:1); (4) reject any zip entry whose normalized path is absolute or escapes the target dir; (5) cap member count. The existing parser already fails *safe* on a corrupt zip (returns `None`, never crashes) — extend that posture to *malicious* zips, not just malformed ones.

**Warning signs:**
`zipfile.ZipFile(untrusted_bytes)` with no prior size/ratio guard; extraction to `os.path.join(dir, entry.filename)` without path normalization; upload accepted purely on `content-type`.

**Phase to address:** P-FILE.

---

### Pitfall 6: The RAG→sandbox file bridge (SEED-108) as a cross-user exfiltration / RLS-scope hole

**What goes wrong:**
A `fetch_document_file` tool that copies a KB document's original bytes into the sandbox resolves `documents.file_path` and streams Storage bytes **without re-applying the owner/global scope that `read_document` uses** — so an agent (steered by prompt injection in a shared document) fetches another user's file by id. Or the materialized confidential file is written out to the `sandbox-outputs` bucket and surfaced as a downloadable output card, exfiltrating it. Or a large file streamed into the container OOMs it.

**Why it happens:**
The backend is service-role (Pitfall 1), so the Storage read has no DB-level owner check — the tool must re-implement the scope check that `_handle_read_document` already applies (`tool_dispatcher.py:237`). SEED-108 flags all three: RLS scope, size/streaming, and that the *write* direction (`copy_from_runtime`) already exists so the exfil path is one hop away. Sandbox sessions are cached per-thread (CLAUDE.md), so a mis-keyed cache could also leak a materialized file across threads.

**How to avoid:**
The bridge tool reuses the **same** owner/global resolver as `read_document` — centralize it so the two can't drift. Cap bytes and stream to disk (never into model context — SEED-108 already specifies this). Key the materialization path by `user_id` + `thread_id` so a cached sandbox session can't serve another owner's file. Treat "materialize KB file" as read-scoped exactly like `read_document`; never widen it to global. SC#10 applies (new tool on the agent loop) — prove all four providers call it correctly and none leak cross-user.

**Warning signs:**
The bridge resolves a doc by id without an owner/global check; bytes flow into the model context; a materialized file appears in `sandbox-outputs`; no size cap.

**Phase to address:** P-FILE (bridge tool; cross-links `sandbox_service.copy_from_runtime`).

---

### Pitfall 7: The agent-driven skill-attach tool is a WRITE-capable, cross-tenant surface shipped without its own threat model

**What goes wrong:**
`attach_skill_file` (FILE-01 / SEED-104) lets the agent write a file into a skill. If it can target a **global** skill, an agent driven by a poisoned document writes attacker-controlled content into a skill *other users load* → stored prompt-injection / supply-chain across tenants. Or it overwrites a built-in protected skill (skill-creator), or attaches to a skill the user doesn't own, because the *tool* path bypasses the permission checks that live only on the HTTP endpoint.

**Why it happens:**
The only skill-file write path today is `_upload_skill_files` in `backend/app/api/skills.py` — reachable only from an authenticated browser request. A new tool wired into `tool_dispatcher` is a *different* entry point that must re-assert every check the HTTP endpoint enforces. SEED-104 explicitly calls this out: "a new WRITE-capable tool is a real security-relevant surface" and defers it precisely so it gets its own discuss→plan→execute with a threat model.

**How to avoid:**
Owner-scoped only — the tool can never write to a global skill or a built-in protected skill (SEED-101). Reuse the existing `skill_files` table + `skill-files` bucket (don't invent a new store), and put the RLS/owner check *in the tool dispatcher*, not just the HTTP layer. Size/type caps; no silent overwrite (version or refuse). SC#10 cross-provider proof that all providers call it correctly (a mis-formatted tool call must fail closed, not write garbage).

**Warning signs:**
The tool can name a `skill_id` the caller doesn't own; global skills are writable via the tool; the tool path doesn't share the endpoint's validation; no cross-provider UAT on the new tool.

**Phase to address:** P-ATTACH.

---

### Pitfall 8: Planning secrets work against the STALE brief — re-solving a shipped problem while missing the real gap (plaintext keys in Postgres)

**What goes wrong:**
The v3.3 brief (authored 2026-05-10, flagged STALE in PROJECT.md) says "migrate secrets off a plain-text json file." But **Phase 081.1 already eliminated `settings_override.json`** (`user_settings.py` docstring: "Phase 081.1 Plan 03: file-based settings_override.json eliminated"). A team that plans against the brief writes a task to "delete the json file" that's already done, and *misses the actual remaining risk*: provider API keys now live as **plaintext columns in the `app_settings` DB row** (`openai_api_key`, `anthropic_api_key`, …) with no encryption-at-rest. A DB dump or service-role leak exposes every provider key.

**Why it happens:**
The brief is a year stale (PROJECT.md warns the internals must be "re-authored against the live codebase during requirements"). Planning from the brief instead of the code re-derives solved problems.

**How to avoid:**
Verify live state first: keys are already read from DB with an env fallback (`env_key = getattr(env_settings, key_field, "")`, `user_settings.py:397`), masked from the frontend ("real key — never sent to frontend"), and sentinel-guarded on write (`save_app_settings` rejects invalid/sentinel keys). The *real* v3.3 secrets work is: (1) encryption-at-rest or a secret-ref indirection for the DB columns; (2) extend the "never to frontend" invariant to **logs and audit rows**; (3) the settings *unification* + env-var live-vs-restart classification inventory (SEED-024 §strengthen). Do NOT remove the env fallback (Pitfall 9).

**Warning signs:**
A plan task named "delete settings_override.json"; scoping that assumes secrets are on disk; a readback path that returns the real key; a provider key appearing in a log line or `operator_audit_log`.

**Phase to address:** P-SECRETS.

---

### Pitfall 9: Secrets migration that breaks the local↔cloud env-var switch (local dev must keep working)

**What goes wrong:**
Hardening secrets, the team makes the DB the *only* source of provider keys and removes the env fallback. Local dev — which has no DB-stored key and relies on `backend/.env` — stops booting or silently loses provider access. This violates the CLAUDE.md red line: "local vs cloud is a pure env-var switch; no hardcoded URLs/paths/keys."

**Why it happens:**
"Secrets belong in the secret store, not env" is a good cloud instinct that forgets the local-first contract. The env→DB precedence (`_val(row, key_field, key_field, env_key)`) is load-bearing for local dev and must survive any hardening.

**How to avoid:**
Keep the precedence: DB value if present, else env fallback. Any encryption/secret-ref layer wraps the DB column only; env stays the plaintext local path. Add a boot test: with an empty `app_settings` and keys only in `.env`, the backend resolves providers. Never make a DB read *mandatory* for a secret that env can supply.

**Warning signs:**
Local backend fails to reach a provider after a secrets change; a code path that raises when the DB key is absent instead of falling back to env; SETUP.md needing new manual DB-seeding steps to run locally.

**Phase to address:** P-SECRETS.

---

### Pitfall 10: Settings/secrets save that swallows errors — the silent-failure trap, already hit once

**What goes wrong:**
The provider-key UI returns a success-looking response but persists nothing. The operator believes the key is set; provider calls fail with auth errors *later*, disconnected from the cause. This exact class already bit the project: "AI-Model save silently failed (no DB column, errors swallowed). Fixed mig 078" (memory).

**Why it happens:**
The write hits a validation reject (the sentinel guard `save_app_settings` *correctly* rejects an invalid/sentinel key) or a schema gap, and the error is caught-and-ignored so the UI shows 200. The guard doing the right thing at the DB layer is worthless if the UI doesn't surface the rejection.

**How to avoid:**
Never swallow a settings/secret write error — surface the sentinel-guard rejection to the UI verbatim. Round-trip verify: write → read back → confirm the masked key prefix changed. Show "saved" only after the readback confirms persistence. This is also the honest-save contract for every new admin knob, not just keys.

**Warning signs:**
A save returns 200 but readback shows the old/sentinel value; try/except around the write with a bare `pass`/log-only; the UI has no "saved & verified" state distinct from "request sent."

**Phase to address:** P-SECRETS (pattern reused by P-REGISTRY, P-ADMIN, P-KILL writes).

---

### Pitfall 11: Live `/models` discovery auto-enables models with GUESSED capabilities → silent loss of native tools

**What goes wrong:**
A discovery sweep pulls model IDs from each provider's `/models` and auto-enables them with default/inferred capabilities. But `/models` returns *IDs, not capabilities* — native-tool support, context window, forced-emit tier are not discoverable. If the guess is wrong, or the discovered `model_id`'s case/spelling doesn't exactly match a `MODEL_CAPABILITIES` key, the model silently degrades to no-tools: the agent makes zero tool calls with no error. This is the exact case-sensitivity trap that already happened ("zhipu/minimax lose native tools on case-sensitive MODEL_CAPABILITIES miss", memory).

**Why it happens:**
Discovery *looks* complete when the picker fills with models. The registry read path already merges `model_capabilities_overrides` (enabled rows) into `MODEL_CAPABILITIES` via `get_model_capability_async` (`config.py:669`), and `get_model_capability` falls back to *inferred* capabilities on a miss (`confidence="inferred"`) — a silent, tool-losing default. Provider drift compounds it: a model present this sweep vanishes next sweep, leaving enabled rows pointing at dead IDs.

**How to avoid:**
Discovery **proposes**, a human **confirms** capabilities before enable — the Phase 096 D-05 precedent (operator-approved diff, newest-first, `CURATE_STALE` accounting). Exact-match the registry key with case-normalization at the boundary (the documented sanitize point). Never auto-enable native-tool support — default `native_tools`/`forced_emission` to the SAFE (off) side and require explicit opt-in. Flag `confidence="inferred"` rows in the admin UI as "capabilities unverified."

**Warning signs:**
A known tool-capable model makes zero tool calls in a run; a production model served with `confidence="inferred"`; enabled registry rows for models the latest `/models` sweep didn't return.

**Phase to address:** P-REGISTRY.

---

### Pitfall 12: Kill-switch / maintenance mode wired to a restart-required knob, or failing OPEN

**What goes wrong:**
The operator flips "disable web_search" (or the panic switch) and nothing happens — because the flag was read at import/startup like `WORKER_COUNT`/`SANDBOX_ENABLED`, which genuinely can't hot-reload. Or the capability check FAILS OPEN: when the flag read errors, the capability runs anyway, so a melting-down provider stays live during the exact incident the switch exists for. SEED-078's rule: "a kill-switch that needs a restart is not a kill-switch."

**Why it happens:**
The hot-reload substrate exists (the `app_settings` row read through a ~30s TTL cache, `user_settings.py`), so it's tempting to add flags anywhere — including next to knobs that bind at worker boot. And "on error, allow" is the accidental default of most `try/except`-wrapped checks.

**How to avoid:**
Flags live in `app_settings.feature_flags` (JSONB), read through the TTL cache with targeted invalidation on write, so a flip propagates ≤30s with no restart. Capability-boundary checks FAIL CLOSED where disabling is the safe default (sandbox fleet, web_search, provider quarantine). Use the SEED-024 env-var classification inventory to mark each knob `live` vs `restart-required` at the point of edit — never wire a kill-switch to a `restart-required` value. Honest UX when a capability is off ("temporarily disabled by your operator"), not a cryptic error.

**Warning signs:**
A flag flip that "doesn't take effect"; a disabled capability that still runs when the flag read throws; a maintenance mode that either kills in-flight runs or fails to stop new ones.

**Phase to address:** P-KILL.

---

### Pitfall 13: Role-gated visibility retrofitted in the UI but not at the API boundary

**What goes wrong:**
The admin nav item / button is hidden in React for non-operators, but the FastAPI route is ungated — any authenticated user hits it directly (curl, devtools). Combined with the service-role backend (Pitfall 1), an ungated `/admin` endpoint returns cross-user data to any logged-in user. Retrofit gating also drifts: some surfaces gated, some not, because the check is duplicated per-component.

**Why it happens:**
Hiding UI is the visible, demoable half; the API check is the invisible, load-bearing half. Retrofitting onto an existing app means the check is added surface-by-surface instead of at a chokepoint.

**How to avoid:**
Gate at the API boundary FIRST with the single `require_operator` dependency (Pitfall 1); UI hiding is cosmetic-only and never the security control. One source of truth for "is operator." Default-deny for any new `/admin` route (router-level dependency, not opt-in per handler). Entitlement/feature gating (tier visibility) rides the same flag substrate as P-KILL (SEED-078/080) — one home, not a fourth ad-hoc boolean.

**Warning signs:**
An `/admin` route reachable with a normal JWT; a feature check that exists only in the frontend; per-component role logic that varies across surfaces.

**Phase to address:** P-ADMIN (boundary) + P-KILL (shared gating substrate).

---

### Pitfall 14: Inline citation attribution that fabricates provenance (post-hoc citation)

**What goes wrong:**
An inline source chip (SEED-033) is attached to a sentence the model didn't actually derive from that source, or cites a retrieved chunk that wasn't used — because attribution is generated by a *second* "which source fits?" LLM pass rather than from what was actually retrieved/used. The platform already saw this exact overclaim: DeepSeek/MiniMax said "converted your docx / real page layout" when they had *reconstructed from text* (SEED-108) — attribution dishonesty erodes the trust the whole RAG product sells.

**Why it happens:**
Post-hoc "cite this answer" is easy and looks authoritative. But an LLM asked to justify its own output will confidently attach a plausible-looking source it never used.

**How to avoid:**
Adopt the discipline the template-fill path already proved: `check_coverage()` in `template_render_service.py` marks a value CITED **only if its `source_chunk_id` was actually in the retrieved set** — an invented/absent citation counts as uncited. Inline chat citation must key attribution to the run's retrieval-set / tool-result provenance (a set-membership test), not a re-ask. When provenance is unknown, show "no source" — never a guessed one. Cross-provider honesty parity (the SRH-01 / emit-honesty precedent) so attribution behaves the same across all providers.

**Warning signs:**
A citation pointing at a chunk not in the run's `retrieved_ids`; identical answer text attributed to different sources across providers; a "cite" step that's a separate LLM call over the finished answer.

**Phase to address:** P-UX (attribution engine), cross-links P-FILE honesty (SEED-108).

---

### Pitfall 15: Plain-language relabeling that breaks muscle memory, API contracts, or audit history

**What goes wrong:**
The two-audience plain-language layer (SEED-085) renames a mode, button, or field. Users can't find a feature they knew. Worse, if the label doubles as an enum value, `operator_audit_log` action name, or API field, the rename breaks stored audit rows, integrations, and history queries. And a11y-blind renames leave stale `aria-label`s.

**Why it happens:**
"Just rename it to something friendlier" treats display strings as free text, but some of them are load-bearing keys. The Deep/Explorer/Harness pill history (v3.1 removed the Harness pill) shows mode renames need care.

**How to avoid:**
Relabel the **display layer only**; keep enum/action/DB/API values stable behind a display map. Provide a transition affordance ("formerly X"). Update `aria-label`s with the visible label. Critically, a UX relabel of the composer/mode must not touch Deep Mode's runtime — Deep Mode stays byte-identical (gated no-op; the milestone red line). Verify the blob-hash/no-op invariant after any composer relabel.

**Warning signs:**
A display string used as a dict key, audit action, or DB enum; a rename that changes a persisted value; an audit query that returns fewer rows after a relabel; Deep Mode behavior shifting after a "cosmetic" change.

**Phase to address:** P-UX (cross-links the Deep-byte-identical landmine).

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Operator as an `is_admin` boolean on the user row | 1-line role model | Poisons the v3.4 RLS rewrite (18 tables); can't separate SYSTEM vs ORG authority (Pitfall 3) | **Never** — use a separate `operator_users` principal |
| Auto-enable `/models`-discovered models with inferred capabilities | Zero-touch model list | Silent no-tools degradation + dead-model rows (Pitfall 11) | **Never** — discovery proposes, human confirms |
| Hide admin UI without gating the API | Fast demo | Ungated service-role route = full-tenant leak (Pitfall 13) | **Never** for `/admin` |
| Provider keys as plaintext `app_settings` columns (current state) | Works today; env fallback keeps local dev | No encryption-at-rest; DB dump = all keys leak (Pitfall 8) | OK for single-tenant self-host; **not** for the hosted multi-tenant SaaS line |
| Impersonation by minting the target's session | Reuses existing auth | Audit attributes actions to the victim; no dual-control (Pitfall 2) | **Never** — dual-identity context only |
| Promote an uploaded template to the library by carrying its provenance | Nice "reuse my template" UX | Reopens the SSTI door (Pitfall 4) | **Never** — explicit re-stamp on promotion |
| Kill-switch/flag stored next to import-bound env knobs | One flag namespace | A switch that needs a restart isn't a switch (Pitfall 12) | **Never** — live knobs only, classified via the env inventory |
| One big `app_settings` JSONB blob for all new admin knobs | Fast to add rows | No per-key audit/rollback; write contention; concurrent-write clobber | Only if each key still has `updated_by`/`updated_at` + targeted invalidation |

## Integration Gotchas

Common mistakes when connecting to the platform's own external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase (service-role client) | Assume RLS protects `/admin` cross-user queries | RLS is inert on the backend path (`dependencies.py:19`); enforce in app + `require_operator`, reviewed WHERE clauses |
| Supabase Auth (impersonation) | Mint the target user's JWT / session | Dual-identity server context (actor + subject), stamp both to audit, never a real victim session |
| Supabase Realtime | Push admin state (active runs, kill-switch, maintenance banner) and trust delivery | Best-effort hint only (D-v2.5-03) — reconcile via fetch on (re)connect; a kill-switch must NOT depend on Realtime delivery |
| `llm_sandbox` (per-thread cached) | Materialize a KB file into a shared/mis-keyed session; write it to `sandbox-outputs` | Scope by `user_id`+`thread_id`, size-cap, stream-to-disk, no exfil to output bucket (Pitfall 6) |
| Provider `/models` endpoints | Trust returned "capabilities"; loose ID matching | IDs only — author capabilities, exact-case key match, human-confirm before enable (Pitfall 11) |
| `app_settings` TTL cache | Expect an instant flag flip; hot-reload an import-bound knob | ≤30s propagation + targeted invalidation; env-bound knobs (`WORKER_COUNT`, `SANDBOX_ENABLED`) never hot-reload (Pitfall 12) |
| Supabase Storage (`documents.file_path`, `skill-files`) | Read/write by path without owner re-check (backend is service-role) | Re-apply the `read_document`/skill owner scope in the tool path, not just the HTTP endpoint |

## Performance Traps

Patterns that work at small scale but fail as usage grows. This product targets org-scale production (`project_target_scale`).

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Audit-log browser does a full-table scan | `/admin` audit page slow; timeouts | Index on `(created_at, actor_id, action)`; keyset pagination, not OFFSET | ~100k+ audit rows |
| Live `/models` called on every registry read | Slow settings page; provider rate-limit 429s | Cache discovery; scheduled sweep, not per-request; read from `model_capabilities_overrides` | N providers × frequent reads |
| Sandbox materialization of large KB files | Container OOM (echoes thesis-PDF `MemoryError`) | Size cap + stream-to-disk; never into model context | Files > ~100MB or many concurrent bridges |
| Zip decompression on upload without a guard | Memory spike / worker DoS from one request | Uncompressed-size + ratio cap before extract | A single crafted zip bomb |
| Feature-flag / entitlement check per request without cache | DB hammering under load | The existing ~30s TTL cache substrate | High RPS across workers |
| Operator "view all users' threads/runs" unpaginated | Memory blowup; slow render | Server-side pagination + scoping from day one | Thousands of users/runs |

## Security Mistakes

Domain-specific issues beyond OWASP basics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Ungated `/admin` route on a service-role backend | Any authenticated user reads ALL users' data | `require_operator` router dependency, default-deny, 403 test per route |
| Untrusted upload reaches the Jinja engine | Server-side template injection (RCE-in-sandbox) | Preserve provenance routing (`select_engine` → `run_replace` for uploads); library promotion re-stamps explicitly |
| Trusting MIME/extension on docx/pptx/xlsx uploads | Zip bomb DoS; path-traversal write; renamed executable | Magic-byte check + uncompressed-size/ratio caps + entry-path validation + file-size cap |
| Agent skill-attach tool can write a global skill | Cross-tenant stored prompt-injection / supply-chain | Owner-scoped only; no global/built-in write; RLS check in the tool dispatcher |
| RAG→sandbox bridge without owner re-check | Cross-user file read; exfil via output card | Reuse `read_document`'s owner/global resolver; no write to `sandbox-outputs` |
| Provider key in logs / audit rows / frontend readback | Full key leak | Extend "never to frontend" to logs + audit; mask everywhere; encrypt-at-rest the DB column |
| Impersonation without dual-identity audit | Insider abuse invisible; repudiation | Stamp actor + subject on every impersonated action |
| Citation attached to an unused/absent source | User trusts a fabricated source; RAG-trust collapse | Attribution from the run's retrieval-set only (set-membership, like `check_coverage`) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Relabel that breaks muscle memory | Users can't find known features | Display-layer rename only + "formerly X" transition tooltip |
| Kill-switch with no honest "disabled by operator" state | Users hit cryptic errors when a capability is off | Explicit disabled-state messaging (SEED-078) |
| Over-citation (a chip on every sentence) | Noise; paradoxically lowers trust | Cite where provenance is real; blank where unknown |
| a11y retrofit only on new `/admin` surfaces | Deep Midnight glass/gradient theme still fails WCAG AA | Audit contrast app-wide, not just new pages (SEED-092) |
| Maintenance/drain mode with no banner | Confusing rejected writes | Drain new runs, let in-flight finish, show a banner |
| Model picker floods with every discovered model | Choice overload; typo/dead models selectable | Curated + explicit "custom" badge for user-added mappings (SEED-024 §6) |
| Admin knobs with no live-vs-restart marker | Operator changes a value, nothing happens, guesses why | Per-row `live` / `restart required` marker at the point of edit (SEED-024 §strengthen) |

## "Looks Done But Isn't" Checklist

- [ ] **`/admin` routes:** often missing the API-boundary role check (only UI hidden) — verify a normal-user JWT gets **403 on every** `/admin` route.
- [ ] **Impersonation:** often missing dual-identity audit — verify `operator_audit_log` records **both** actor and subject on an impersonated action, and no victim session is minted.
- [ ] **Operator role model:** often missing v3.4-compatibility — verify the operator is a **separate principal**, not an `is_admin` flag or org member.
- [ ] **Secrets UI:** often missing round-trip verify + env fallback — verify save→read shows the masked prefix, sentinel rejects surface to the UI, AND local dev with keys only in `.env` still boots.
- [ ] **Template upload:** often missing provenance stamp + zip guard — verify an uploaded template routes to `run_replace` (never `docxtpl`) and a zip bomb / traversal entry is rejected.
- [ ] **Skill-attach tool:** often missing tool-dispatcher RLS check + SC#10 — verify all 4 providers call it, owner-scoped, no global/built-in write.
- [ ] **RAG→sandbox bridge:** often missing owner re-check + size cap — verify a cross-user doc id 404s and a huge file streams (not OOMs), and never lands in `sandbox-outputs`.
- [ ] **Model registry:** often missing capability confirmation — verify a discovered model isn't auto-enabled with inferred native tools; case-mismatch doesn't silently drop tools.
- [ ] **Kill-switch:** often missing fail-closed + hot-reload — verify a flip takes effect ≤30s with no restart, and a flag-read error **disables** (not enables) the capability.
- [ ] **Citation:** often missing provenance-set check — verify every cited chunk was actually in the run's `retrieved_ids`.
- [ ] **Deep Mode:** often missing byte-identical proof after a UX relabel — verify the gated no-op / blob hash is unchanged.
- [ ] **SC#10 cross-provider:** any new tool (bridge, attach) or agent-loop/UI-state change — verify the 4-axis UAT (4 providers × multi-tool × parallel-thread × long-message) is authored under VALIDATION.md.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-user leak via ungated `/admin` route | HIGH | Revoke route; audit access logs (hard to know what leaked); add `require_operator`; notify affected; add 403 regression test |
| SSTI via mis-provenanced upload | HIGH | Sandbox containment limits blast radius (network-less), but rotate any secret reachable in the render env; patch the provenance boundary; audit rendered outputs |
| Operator role shape poisons v3.4 RLS | HIGH | Schema unwind mid-rewrite (the highest-risk apply) — avoid by choosing the separate-principal model **now** |
| Plaintext provider-key DB leak | HIGH | Rotate ALL provider keys immediately; add encryption-at-rest; audit `operator_audit_log`/logs for prior exposure |
| Silent no-tools model degradation | LOW | Fix the registry key case-match; re-enable native tools; re-run the eval scoreboard |
| Fabricated inline citation shipped | MEDIUM | Switch attribution to retrieval-set membership; re-verify cross-provider; add a "cited chunk ∈ retrieved" assertion |
| Kill-switch that didn't fire (import-bound / fail-open) | MEDIUM | Move the flag to the `app_settings` live substrate; flip the check to fail-closed; reclassify the knob live-vs-restart |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Service-role is the only gate | P-ADMIN | 403 for normal JWT on every `/admin` route; reviewed operator query helpers |
| 2. Impersonation identity/audit | P-ADMIN | Dual-id (actor+subject) in `operator_audit_log`; no minted victim session |
| 3. Operator role poisons v3.4 RLS | P-ADMIN | Separate `operator_users` principal; org-agnostic authority; checked against v3.4 RLS plan |
| 4. Upload breaks provenance boundary | P-FILE | Jinja-payload upload renders literally; `select_engine('template_input')` can't return `docxtpl` |
| 5. MIME/zip-bomb/traversal | P-FILE | Magic-byte + ratio/size caps + entry-path validation on a crafted archive |
| 6. RAG→sandbox exfil/scope | P-FILE | Cross-user doc id 404s; size cap; no `sandbox-outputs` write; SC#10 4-axis |
| 7. Skill-attach WRITE tool | P-ATTACH | Owner-scoped, no global write, dispatcher-level RLS, SC#10 all providers |
| 8. Stale-brief / plaintext keys | P-SECRETS | Verify live state; encrypt-at-rest; keys absent from logs/audit/frontend |
| 9. Local↔cloud env switch | P-SECRETS | Backend boots with keys only in `.env`, empty `app_settings` |
| 10. Silent save failure | P-SECRETS | Save→readback verify; sentinel reject surfaced to UI |
| 11. Model discovery capability guessing | P-REGISTRY | Human-confirm before enable; exact-case match; inferred rows flagged |
| 12. Kill-switch restart/fail-open | P-KILL | ≤30s hot-reload, no restart; fail-closed on read error |
| 13. UI-only role gating | P-ADMIN + P-KILL | API-boundary gate; single source of truth; default-deny new routes |
| 14. Fabricated citation | P-UX | Cited chunk ∈ `retrieved_ids`; cross-provider parity |
| 15. Relabel breaks contracts | P-UX | Display-only rename; enum/audit/DB values stable; Deep Mode byte-identical |

## Sources

- **Live codebase (HIGH):** `backend/app/dependencies.py:19` (service-role client — RLS bypass), `backend/app/services/template_render_service.py` (`select_engine` provenance boundary :936, `check_coverage` citation-set membership :416, `SandboxedEnvironment(autoescape=True)` :657, `zipfile` on untrusted bytes :381), `backend/app/models/user_settings.py` (settings_override.json eliminated, plaintext key columns + env fallback :397, sentinel guard `save_app_settings`, `model_capabilities_overrides` read :316), `backend/app/config.py` (`get_model_capability`/`_async` :498/:669, `confidence="inferred"` fallback), `backend/app/services/tool_dispatcher.py` (`_handle_read_document` owner scope :237).
- **Seeds (HIGH):** SEED-108 (RAG→sandbox bridge — RLS/size/exfil), SEED-104 (agent skill-attach WRITE tool threat model), SEED-024 (settings unification, env live-vs-restart classification, model-picker surfacing), SEED-078 (kill-switch/maintenance/feature-flag substrate, fail-closed, D-PRD-14 SYSTEM-vs-ORG role split).
- **Project memory / decisions (HIGH):** service-role RLS bypass; case-sensitive `MODEL_CAPABILITIES` miss drops native tools; settings save silent-failure (mig 078); Deep-Mode byte-identical red line; SC#10 4-axis cross-provider mandate; Supabase Realtime best-effort (D-v2.5-03); thesis-PDF `MemoryError` (large-file OOM precedent).
- **Established security knowledge (MEDIUM, verified against this codebase's own defenses):** Jinja SSTI via `SandboxedEnvironment` escapes; OOXML/ZIP decompression bombs and path traversal in office-document uploads; post-hoc LLM citation fabrication.

---
*Pitfalls research for: v3.3 Operator UX — admin tier, secrets/model-registry management, run-time file inputs, plain-language/citation UX on a service-role multi-provider RAG platform*
*Researched: 2026-07-10*
