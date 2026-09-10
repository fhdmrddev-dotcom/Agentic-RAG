# Product Packaging — selling a core plus plugins, and where the DMS capabilities stand

**Written:** 2026-09-06 · **Status:** analysis, not a plan. Nothing here is built yet.
**Why it exists:** the operator asked two questions — *"every feature should be a plugin so I can
sell a core and sell the rest as tiers, how is that achieved?"* and *"assess this DMS capability
list against what we have"*. Both answers below are measured against the code, not aspirational.

---

## Part 1 — Can this be sold as a core plus plugins?

### 1.1 What already exists, and it is more than you would expect

The codebase already has **two independent feature-gating mechanisms**:

| Mechanism | Where | Shape |
|---|---|---|
| Boolean flags | `app_settings` columns — `workflows_enabled`, `sandbox_enabled`, `document_management_enabled`, `self_improve_enabled` | on/off, global |
| Visibility map | `app_settings.feature_visibility` (JSONB) | per-feature **audience**: `everyone` / `operators` / `role` (+ role & group green-lists) / `off` |

The visibility map is the better foundation, and it is genuinely well built:

- **Fail-closed by construction.** `resolve_feature_access` (`models/user_settings.py:1284`) returns
  `False` for unknown, malformed or missing records, and never raises. A user must never see a
  feature they are not green-listed for.
- **Atomic per-key writes.** `set_feature_visibility` merges with JSONB `||` so a concurrent toggle
  of a *different* feature cannot clobber it — a lost-update a whole-column `SET` would cause.
- **Allowlisted.** `_VISIBILITY_FEATURES` (`api/admin.py:103`) is a closed set; a free-text feature
  name cannot reach the codec.

Six features are registered today: `skill_studio`, `model_management`, `workflow_authoring`,
`governance_health`, `visual_workflow_canvas`, and the live-connector kill-switch.

### 1.2 ⛔ The gap that decides everything — the gate is advisory, not enforced

**`resolve_feature_access` is never called by any feature's own routes.** Measured: outside
`admin.py` (which writes it) and `api/features.py` (which reports it to the client), there are
**zero** call sites. `api/workflows.py` contains **no** reference to it or to `workflows_enabled`.

This was a deliberate, recorded decision, not an oversight —
`api/document_governance.py:40` states it plainly:

> *"Phases 111/112/113/116/118 all chose not to gate at the API. Gating Governance alone would
> make it the lone inconsistent surface."*

That is a perfectly reasonable call for **visibility**. It is fatal for **licensing**:

> ⚠ **Today the feature map tells the UI what to draw. It does not stop anybody from calling the
> endpoint.** A customer on a cheap tier who opens the network tab keeps every feature they paid
> to not have. Any tiering built on the current mechanism is a suggestion, not a boundary.

### 1.3 What "plugin" can realistically mean here, in three honest levels

The architecture is a **modular monolith** — one FastAPI app, one React bundle. That constrains
which meaning of "plugin" is reachable, and the levels differ enormously in cost.

**Level 1 — Entitlement gating (weeks, and the only one worth doing first).**
One dependency, applied at every route of a sellable capability:

```python
@router.post("/workflows", dependencies=[Depends(require_feature("workflow_authoring"))])
```

`require_feature` resolves the caller's entitlements and returns **402/403**, not 404-by-omission.
Same code ships to everyone; what differs is a row. This is what nearly every SaaS actually means
by "tiers", and the existing `feature_visibility` record is already the right shape to carry it —
it needs an `entitlement` source beside `audience`, so an operator's *visibility* choice and a
customer's *licence* stay separable. **Conflating them would be the mistake**: an operator hiding
a feature they paid for, and a tier that never included it, are different facts and must fail with
different messages.

**Level 2 — Build-time editions (months).** Frontend bundles per tier, backend routers registered
from a manifest. Reduces attack surface and bundle size, but multiplies the build and test matrix
by the number of tiers — and this repo's test gates are already the slowest part of the loop.

**Level 3 — True runtime plugins (a product in itself).** Third-party packages discovered at
startup, with a manifest, a stable internal API, sandboxing and a compatibility policy. **Do not
start here.** It requires freezing internal interfaces that are still moving weekly, and the
project already has a documented MCP-first verdict (`docs/CONNECTOR-ARCHITECTURE.md`) for
third-party extension — MCP *is* the plugin story for integrations, and it already exists.

### 1.4 The recommendation

Do **Level 1**, and do it as one phase that touches every sellable surface at once, precisely
because `document_governance.py` is right: a gate on one surface and not its neighbours is worse
than no gate. The work is:

1. A `require_feature(name)` dependency — fail-closed, distinguishing *not licensed* from *hidden*.
2. An entitlement source (`app_settings.entitlements`, or per-org once orgs are real — see §2.8).
3. Apply it to every route of each sellable capability, with a fence test asserting **no route of
   a gated router is reachable without it** — the same shape as the existing count/fence gates.
4. Keep the frontend map as-is; it stays the UX layer over the same truth.

⚠ **One structural prerequisite is easy to miss:** entitlements belong to an **organisation**, and
today an "org" is effectively one person (flat orgs, `dept_id` present but inert — 46 tables carry
`org_id`, one carries `dept_id` with zero rows). Per-seat or per-org pricing needs that model to
be real first, or the entitlement has nowhere honest to live.

---

## Part 2 — The DMS capability list, assessed against the code

Legend: ✅ shipped · ⚠ partial · ⛔ absent

| # | Capability | Status | What is actually there |
|---|---|---|---|
| 1 | **Centralized enterprise repository** | ✅ | `documents` + `folders` + Supabase Storage; RLS on every table; `org_id` on 46 tables; dedup by SHA-256; canonical storage keys |
| 2 | **Structured classification & metadata** | ✅ | LLM metadata extraction with **per-field confidence**, operator-defined custom fields (`metadata-fields`), rule-based classification that **suggests and never moves** (Phase 118) |
| 3 | **Advanced search & OCR retrieval** | ✅ | Hybrid vector + keyword with RRF, optional rerank, tunable thresholds. **OCR caveat below** |
| 4 | **Version control & document history** | ⚠ | `version_number` / `is_latest` retire prior versions on re-upload; `audit_log` records actions. **No diff, no restore-to-version, no side-by-side** |
| 5 | **Enterprise system integration** | ⚠ | Google Drive browse/preview/import; MCP client for third-party tools; email ingest. Read-side is good; **write-back is thin and deliberately gated** |
| 6 | **Retention & archival management** | ⛔ | **Nothing.** No retention policy, no legal hold, no scheduled disposition, no archive tier. Measured: zero retention/archival code in `backend/app` |
| 7 | **Workflow automation** | ✅ | The strongest area — harness engine, publish gauntlet, scheduler, approvals/pauses, run history |
| 8 | **RBAC & audit** | ⚠ | RLS everywhere, roles + groups, `audit_log` with a constrained action-type vocabulary. **But only two real access levels exist — mine and whole-org.** Departments are inert |
| 9 | **Security & compliance** | ⚠ | RLS, egress allowlist, encrypted connector secrets, fail-closed gates, prompt-injection fence at the tool boundary. **No DLP, no legal hold, no compliance reporting, no data-residency story** |
| 10 | **Migration from shared folders** | ✅ | Drive folder browse → preview → confirm → import, with a watch loop for ongoing sync (Phase 234). This is the newest and most complete path |
| 11 | **Scalability & future expansion** | ⚠ | Durable queue with database-level claims and lease recovery; multi-worker safe. **But ingestion runs inside the API process by default and is CPU-bound — see `docs/OPERATOR.md`** |

### ⚠ Two honest caveats on things that look green

**"OCR" here is a vision LLM, not an OCR engine.** There is no tesseract/paddle/easyOCR anywhere in
this repo. Images and scanned PDFs are transcribed by sending pixels to a vision model. That is
often *better* than classic OCR on layout-heavy pages — but it is billed per page, non-deterministic,
and requires a vision-capable model to be configured. It should be sold as "AI transcription", never
as "OCR", or the first air-gapped customer will be very unhappy.

**Images *inside* documents are captioned, not transcribed.** `describe_image` asks for a 1–2
sentence caption, so a chart inside a PDF yields *"a bar chart showing quarterly revenue"* and not
the numbers. The transcription prompts already exist in `vision_text` — routing embedded images
through them is a scoped phase with a re-embedding cost, not a switch.

### The three gaps that matter most for an enterprise DMS sale

1. **Retention & archival (#6) — total absence, and the most commonly mandated capability in this
   list.** Regulated buyers ask for it in the first meeting. It is also *architecturally cheap*
   relative to its sales value: a policy table, a scheduled sweep on the existing scheduler, a
   `legal_hold` flag that blocks deletion, and disposition rows in `audit_log`. The scheduler and
   the audit vocabulary already exist.
2. **Access granularity (#8) — "mine" or "the whole org" is not enough** for a department-scoped
   enterprise repository. The column exists and is unused; making it real is a prerequisite for
   both RBAC claims and per-org entitlements.
3. **Ingestion isolation (#11)** — documented today in `docs/OPERATOR.md`; a one-line config split,
   not a code change. Should be done before any multi-user pilot.

---

## Part 3 — On "threads are slow to load"

Two causes were found and fixed on 2026-09-05/06, and a third is documented but **not** applied:

- **Fixed** — 11 blocking `supabase-py` calls ran on the event loop inside `splice_document`, one
  of them per chunk batch (`BUG-260905-14`). Every unrelated request queued behind them.
- **Fixed** — an unconditional 4-second poll of `/settings/reembed-progress` from the Library page
  that never stopped, even when idle (`BUG-260905-15`).
- **NOT applied** — ingestion is CPU-bound and still runs inside the API processes by default. The
  GIL means it does not run in parallel with request handling. `INGEST_WORKER_ENABLED=false` on the
  API plus one dedicated worker process is the remedy; see `docs/OPERATOR.md`.

⚠ Some of the slowdown is **new correct work, not a regression**: metadata enrichment used to throw
instantly inside a running event loop and degrade to `metadata=None`. It now actually runs, and
costs an LLM call per document. And camelot parses every page of every PDF looking for tables.

**A loader does not fix slowness, and is still required** — see `SEED-248`. On a fetching surface,
*populated*, *empty*, *loading* and *error* must be four visibly different things. Today the
Library cannot express "loading" at all: `useDocuments` exposes no such flag.
