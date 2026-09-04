# Walkthrough: Phase 213 (Per-Tool Grants and the Approval Moment)

Phase 213 has been planned, implemented, and verified across all 5 waves, meeting all 10 invariants from `BUILD-CONTRACT.generated.md`, SEC-1/SEC-2 security boundaries, and gate requirements.

---

## 1. Database & Schema
- **Migration `128_connector_connection_posture.sql`** applied to PostgreSQL:
  - Added `default_approval_posture` (`text CHECK in ('allow', 'ask', 'deny') DEFAULT 'ask'`).
  - Added `tool_grants` (`jsonb DEFAULT '{}'::jsonb`).
  - Column-level `GRANT SELECT` granted to `authenticated` and `service_role`.
- Updated schema snapshot `supabase/full-schema.sql`.

## 2. Backend Models, Leaf Service & API
- **Models (`backend/app/models/connector.py`)**:
  - `ToolGrantPosture = Literal["allow", "ask", "deny"]`.
  - Added `default_approval_posture` and `tool_grants` to create, update, and read models.
- **Grants Leaf Module (`backend/app/services/connectors/grants.py`)**:
  - Leaf module with **zero** imports of `phase_types` or `harness_engine`.
  - `resolve_effective_posture(connection, tool_name) -> ToolGrantPosture`: Returns explicitly configured grant or falls back to `default_approval_posture`.
  - `is_tool_allowed(connection, tool_name) -> bool`: Returns `True` iff posture is `"allow"`.
- **Connector Service (`backend/app/services/connector_service.py`)**:
  - Replaced boolean coercions with `_sanitize_tool_grants` checking against `_LEGAL_GRANT_VALUES = {"allow", "ask", "deny"}`.
  - Added `default_approval_posture` handling across queries and mutations.
- **API (`backend/app/api/connectors.py`)**:
  - Added `ValueError -> 422` handling on `PATCH /connections/{id}/grants`.

## 3. Harness Execution Engine (Gate 5.5 & Receipts)
- **Gate 5.5 in `backend/app/services/harness/phase_types.py`**:
  - Positioned between Gate 5 (scoped resolution) and Gate 6/7 shape fork (enforcing SEC-1 uniformly across MCP and native capability connections).
  - Evaluates `resolve_effective_posture`. If not `"allow"`, stops execution with honest copy and emits audit event `tool_refused`.
- **Audit Receipt (`_write_send_receipt`)**:
  - Emits `external_action_sent` carrying `metadata["tool_name"] = str(tool_name)` upon successful tool execution (MCP and Capability).

## 4. Frontend UI & Invariants
- **Vocabulary (`frontend/src/components/settings/grantsVocabulary.ts`)**:
  - Ported verbatim from `COPY.js`.
- **Grants List (`frontend/src/components/settings/ConnectionGrantsList.tsx`)**:
  - Implements all 10 invariants from `BUILD-CONTRACT.generated.md`:
    1. Primary override edge lane with zero state colors on edge.
    2. 2px transparent edge lane.
    3. 3-arm segmented control (`"allow" | "ask" | "deny"`) with exactly 1 pressed.
    4. Deny arm styled with destructive red token.
    5. Split layout panel width widened to `clamp(480px, 38%, 640px)`.
    6. Search filter with empty state `LIST_EMPTY`.
    7. Unknown direction handling and help copy.
    8. Zero `[title]` attribute rule (all text in DOM).
    9. Default posture segmented control.
    10. "You changed this" override indicator.
- **Form Panel (`ConnectionFormPanel.tsx`) & Tabs (`ConnectionsTab.tsx`)**:
  - Embedded `ConnectionGrantsList` with live state and save payload.

## 5. UI Width Standardization
All admin and org pages brought to `max-w-6xl w-full mx-auto` (1152 px) — matching Settings, Governance, Knowledge Health.

### Files updated
| File | Change |
|---|---|
| [`ControlRoomPage.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/admin/ControlRoomPage.tsx) | Tablist + all 3 tab bodies → `max-w-6xl` |
| [`OperatorBand.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/admin/OperatorBand.tsx) | Header inner container → `max-w-6xl` |
| [`AuditTab.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/admin/AuditTab.tsx) | Root container → `max-w-6xl` |
| [`OrgAdminShell.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/org/OrgAdminShell.tsx) | Tablist → `max-w-6xl` |
| [`OrgBand.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/org/OrgBand.tsx) | Header inner container → `max-w-6xl` |
| [`OrgMembersTab.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/org/OrgMembersTab.tsx) | Root `<section>` → `max-w-6xl` |
| [`InvitationsTab.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/org/InvitationsTab.tsx) | Root `<section>` → `max-w-6xl` |
| [`OrgSettingsTab.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/org/OrgSettingsTab.tsx) | Root `<div>` → `max-w-6xl` |
| [`SsoTab.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/org/SsoTab.tsx) | Root `<section>` → `max-w-6xl` |
| [`OrgAuditTab.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/org/OrgAuditTab.tsx) | Root `<div>` → `max-w-6xl` |

Tab buttons on both pages changed from `inline-flex` (shrink-to-content) to `flex flex-1 justify-center` — tabs now fill the full 1152 px strip evenly.

**Verified:** count gate ✅ 120/120 pinned files, 6195 tests, 0 failing.

---

## 6. LiteLLM Proxy Setup (Multi-Model Routing for Claude Code)

Config file: [`litellm-config.yaml`](file:///c:/Vibe%20Apps/Agentic%20RAG/litellm-config.yaml)

### Architecture
```
Claude Code  →  LiteLLM proxy :4000  →  qwen/qwen3.8-27b  [primary]
                                      →  qwen/qwen3.8-max   [fallback]
```

### Step 1 — Start the proxy (Terminal 1)
```powershell
litellm --config litellm-config.yaml --port 4000
```

### Step 2 — Start Claude Code (Terminal 2)
Set these env vars **before** launching `claude`. Order doesn't matter, just needs to be in the same terminal session.

```powershell
$env:ANTHROPIC_BASE_URL="http://localhost:4000"
$env:ANTHROPIC_API_KEY="sk-1234"
$env:ANTHROPIC_MODEL="claude-qwen-big"
$env:CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT="1"
claude
```

Or as a one-liner:
```powershell
$env:ANTHROPIC_BASE_URL="http://localhost:4000"; $env:ANTHROPIC_API_KEY="sk-1234"; $env:ANTHROPIC_MODEL="claude-qwen-big"; $env:CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT="1"; claude
```

### Switching models

| `ANTHROPIC_MODEL` value | Routes to |
|---|---|
| `claude-qwen-big` *(default)* | `qwen/qwen3.8-27b` — primary |
| `claude-qwen-max` | `qwen/qwen3.8-max` — fallback / alternative |

Just change `$env:ANTHROPIC_MODEL` and rerun `claude`. No proxy restart needed.

### Resume a session with a specific model
```powershell
$env:ANTHROPIC_MODEL="claude-qwen-max"
$env:CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT="1"
claude --resume <session-id>
```

### Notes
- The `␦ qwen3.8-27b (default)` line Claude Code prints is normal — it confirms which backend model the proxy resolved to.
- `CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT=1` suppresses the "not a recognized model" context window warning. Without it, auto-compact caps at 200k even if the model supports more.
- The proxy API key (`sk-1234`) is the `master_key` in the config — it is **not** your real OpenRouter key. The real OpenRouter key is stored inside `litellm-config.yaml`.

