---
seed_id: SEED-258
title: THE CONFIGURATION SURFACE — every value that changes behaviour should be reachable, bounded and explained, wherever its control belongs; measured today as 16 invisible settings fields and 58 hardcoded constants behaving as policy
created: 2026-09-08
planted_during: Phase 239 gap closure — the operator raised MAX_MCP_BODY_BYTES and immediately asked why a tunable operational limit is a constant at all
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - Phase 239 (SRC-04) — where the disagreement was found and the constant raised (`526759c58`)
  - CLAUDE.md — "Settings live in user_settings / app_settings and the Settings UI; env vars are for secrets and infra only"
  - `backend/app/services/mcp_client.py` — `MAX_MCP_BODY_BYTES`, a DoS guard on an untrusted server
  - `backend/app/services/sources/adapters/{mcp_source,google_drive,microsoft_graph}.py` — `MAX_FILE_BYTES` ×3
  - `backend/app/models/user_settings.py:198` — `multimodal_max_b64_bytes_kb`, the EXISTING precedent for a numeric byte knob
  - SEED-257 — the other Phase 239 seed; both are about MCP limits nobody can see
trigger_when: >
  ANY of: (a) a person reports that a file they consider normal "won't import" from any connected
  source — this is the user-visible symptom and it will arrive before anyone goes looking; (b) a
  FIFTH size constant is added, or a fourth source family lands and copies `MAX_FILE_BYTES` a third
  time; (c) any Settings phase touches `app_settings` and could carry this cheaply; (d) a deployment
  needs a different ceiling from local — a cloud tenant with larger documents is the obvious case,
  and today that requires a code change and a redeploy.
---

# SEED-258 — a ceiling nobody can see, set by a number nobody can change

## What happened, and why a constant was the wrong home

Phase 239 shipped MCP as a source family. Two constants governed how large a file could be:

| Constant | Value | Governs |
|---|---|---|
| `mcp_source.MAX_FILE_BYTES` | 25 MB | the decoded file — deliberately equal to `google_drive.py` and `microsoft_graph.py` (TM-239-03) |
| `mcp_client.MAX_MCP_BODY_BYTES` | **2 MB** | the whole JSON-RPC response |

MCP carries file content **inside** the envelope, base64-inflated 4/3. So the real ceiling was
**~1.5 MB**, the 25 MB one **could never fire**, and a 3 MB PDF failed with a transport error naming
a byte cap rather than a plain "this file is too large". Raised to 34 MB at `526759c58`.

⚠ **The interesting part is not the bug, it is why it was invisible.** Both numbers were
*individually defensible* — 2 MB is a sane DoS guard against an untrusted remote server, 25 MB is the
app's own upload ceiling. **Nothing was wrong with either constant. What was wrong was the relation
between them, and a relation has no home in a file of constants.** Phase 239 closed that specific gap
with a test pinning the two IN RELATION. This seed is about the general case.

## Why Settings, in the project's own words

CLAUDE.md: *"Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for
secrets and infra only."* A size ceiling is neither a secret nor infra — it is an operational limit an
operator should be able to see and tune. **Today changing it requires a code edit and a redeploy**,
which also means local and cloud cannot differ without a branch.

⚠ **And the thing an operator most needs is not the number — it is the REASON.** The current values
are explicable only by reading two Python files and knowing that base64 inflates 4/3. That is the
actual failure: not that the value was low, but that **nobody could see what it was or why**.

## The design, so this is ready to build rather than re-derived

**Precedent to follow, not invent:** `user_settings.py:198` already carries
`multimodal_max_b64_bytes_kb: int = 4096`, read through `_val(row, key, None, default)`. Same shape.

- **Home:** `app_settings` (a global singleton, RLS disabled — `backend/app/api/settings.py:25`), not
  `user_settings`. ⛔ **This must NOT be per-user.** A DoS guard a user can raise for themselves is not
  a guard.
- **One knob, not two.** Expose the **file ceiling** — the number a person thinks in ("how big a file
  can I import"). ⛔ **The envelope cap is DERIVED from it**, server-side, as `ceiling × 4/3 +
  headroom. Never a second field.** Exposing both re-creates exactly the disagreement this seed exists
  because of.
- **Bounds enforced SERVER-SIDE, not in the form.** A floor (a ceiling of 0 disables ingestion), and a
  hard maximum the setting cannot exceed no matter what is posted. ⚠ The form is a convenience; the
  API is the boundary. A `PATCH` with `999999999` must be refused by the backend.
- **The three adapters read the setting** rather than each holding their own copy. ⚠ `MAX_FILE_BYTES`
  is currently duplicated across three files and was correct in all three **by coincidence of careful
  authorship** — the fourth family is where that luck runs out.
- **On-screen copy — the whole point of the seed.** State the current value, that it applies to every
  connected source, and **what raising it costs**: more memory buffered per in-flight request from a
  server we do not control. A recommendation ("25 MB suits most document workloads") next to a plain
  statement of the tradeoff. ⛔ **Not a bare number field.**

## How we would know this was answered badly

- Two fields appear (file size **and** envelope size) — the original defect, now user-operable.
- The knob lands in `user_settings`, so a user can raise a DoS guard for themselves.
- Bounds are enforced only in the React form.
- The setting ships with no explanation of the cost, which leaves the operator exactly as blind as the
  constant did — **the problem was never the number**.
- A fourth source family adds a fourth hardcoded `MAX_FILE_BYTES`.

## Explicitly NOT done in Phase 239

⛔ **G-7:** *"a closure round may NEVER introduce a new user-facing capability: that is a phase, not a
gap."* A Settings knob with bounds, derived values, migration and copy is a phase. Phase 239 raised
the constant and pinned the relation; that is the gap-sized part, and it is done.

---

# ⭐ WIDENED 2026-09-08 — operator: this is a CLASS, not a knob

**Operator's words:** *"what I meant by settings is every configuration — this includes also the
Control Room … let's not lose anything dynamic, and also the possibility to extend the knobs for the
things that we can control."*

**So the scope is not "add a field to the Settings page".** It is:

> **Every value that changes how this product behaves should be reachable by the person responsible
> for it, bounded so it cannot be set to something harmful, and accompanied by what it costs.**

⛔ **"Settings" here means the CONFIGURATION SURFACE, not the Settings page.** A knob's home is decided
per knob at implementation time — the Settings page, the **Control Room**, a connection panel, an
admin-only surface, or **deliberately nowhere**. ⚠ *"Deliberately nowhere"* is a legitimate answer and
must be RECORDED as one; what is not legitimate is the present state, where nobody can tell a hidden
knob from a forgotten one.

## Inventory A — settings fields that exist and are UNREACHABLE (measured 2026-09-08)

`backend/app/models/user_settings.py` declares **39** settings fields. **16 are referenced nowhere in
`frontend/src`, in snake_case OR camelCase** — settable only by an API call or a direct DB write.

**⭐ The extraction engine bank — 8 fields, and the highest-leverage group in the product:**
`extraction_text_engine_pdf` · `extraction_table_engine_pdf` · `extraction_image_engine_pdf` ·
`extraction_text_engine_docx` · `extraction_image_engine_docx` · `extraction_equation_engine` ·
`extraction_per_call_hints_enabled` · `extraction_window_cap`.
**These decide how well every ingested document is read** — which engine parses PDFs, whether tables
and equations survive. Answer quality depends on them and no one can see them.

**Caps a person FEELS but cannot find — 4:** `multimodal_max_b64_bytes_kb` (*"it didn't read my
image"*) · `skill_catalog_max_tokens` (*"my skill isn't offered"*) · `template_ttl_hours` ·
`metadata_enrichment_mode`.

**Plausibly internal — 4, and each needs a RECORDED verdict rather than silence:** `db_model_lists` ·
`chat_tool_args_progress_emit_boundary_bytes` · `feature_visibility` · `document_management_enabled`.
⚠ The last two are server-enforced and probably should NOT be a text box — that is a decision to
write down, not an omission to leave.

⚠ **The grep cannot see a knob surfaced under a different SHAPE** (e.g. via a Control Room API rather
than a settings field). Treat 16 as a floor, and re-derive:

```bash
# fields declared, then those absent from the frontend in both conventions
grep -oE '^    [a-z][a-z0-9_]{3,}:' backend/app/models/user_settings.py
```

## Inventory B — the EXTENSION axis: hardcoded constants that behave like policy

**58 measured 2026-09-08** across `backend/app`: module-level `UPPER_CASE` constants whose names say
`MAX|MIN|LIMIT|CAP|TIMEOUT|SECONDS|BYTES|SIZE|THRESHOLD|RETRY|INTERVAL|TTL|BUDGET|WINDOW|ENABLED`.

⭐ **This is the "possibility to extend the knobs" the operator asked for, and it is not hypothetical —
`MAX_MCP_BODY_BYTES` was one of these until 2026-09-08, and it silently capped every MCP import at
~1.5 MB.** Representative, with the pattern visible:

| Constant | Value | Home |
|---|---|---|
| `LOW_CONF_THRESHOLD` / `HIGH_CONF_THRESHOLD` | `0.38` / `0.54` | `api/knowledge_health.py` — ⚠ decides what a person is TOLD is low-confidence |
| `MAX_ATTACHMENT_BYTES` / `MAX_ATTACHMENTS_PER_EMAIL` | 25 MB / 50 | `email_extraction_service.py` — the email twin of this seed's own defect |
| `MAX_PAGES_HARD_CAP` / `MAX_IMAGE_EDGE_PX` | 50 / 2000 | `extractors/aspects/vision_text.py` — a 60-page PDF is silently half-read |
| `EMBED_MAX_TOKENS_PER_BATCH` | 200,000 | `openai_service.py` |
| `TABLE_CHUNK_MAX_ROWS` | 25 | `multimodal_service.py` |
| `MAX_TOKENS_CEILING` / `MAX_DURATION_CEILING_SECONDS` | 2,000,000 / 24 h | `models/schedule.py` |
| `DEFAULT_MCP_TIMEOUT` / `DEFAULT_DISCOVERY_TIMEOUT` | 30 s / 15 s | `mcp_client.py` |
| `*_TIMEOUT_SECONDS` / `*_MAX_RESPONSE_BYTES` | 30 s / 256 KB | jira · slack · smtp adapters — **three copies of one policy** |

⛔ **NOT a mandate to expose all 58.** Most should stay constants. The deliverable is a **verdict per
constant** — *promote to a knob* · *stays fixed, and why* — so the set is triaged once instead of
rediscovered one production surprise at a time.

## What "don't lose anything dynamic" requires

1. **A register that is COMPLETE and re-derivable**, not a hand-kept list — this project's own
   repeated finding is that a figure written at a close is stale by the next commit. Both inventories
   above ship with their commands for that reason.
2. **A knob's HOME is recorded**, including *"deliberately not exposed"*.
3. **Bounds live server-side.** ⚠ The form is a convenience; **the API is the boundary**. A knob that
   is a DoS guard (`MAX_*_BYTES`, `*_TIMEOUT_*`) must have a hard maximum the setting cannot exceed.
4. **The COST is on screen next to the value**, not only the value. ⭐ **The operator's original point
   was never that a number was wrong — it was that nobody could see what it was or why.**
5. **It must be extensible by construction** — promoting constant #59 should be a row, not a
   re-architecture.

## How we would know this was answered badly

- A Settings page grows 58 text boxes. **The ask was reachability and legibility, not exposure.**
- A knob is exposed with no statement of what raising it costs — the original defect, now clickable.
- Bounds are enforced only in the React form.
- The extraction-engine bank stays invisible while cosmetic knobs get surfaced first.
- A constant is promoted with no verdict recorded for its 57 siblings, so the next one is rediscovered
  by a production surprise.
- The inventories are copied forward instead of re-derived, and rot — **the exact failure this
  project has recorded six times against the count gate.**
