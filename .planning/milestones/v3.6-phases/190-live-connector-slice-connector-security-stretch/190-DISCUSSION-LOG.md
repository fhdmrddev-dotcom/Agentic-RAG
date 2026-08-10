# Phase 190: Live Connector Slice + Connector Security — STRETCH - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 190-live-connector-slice-connector-security-stretch
**Areas discussed:** Transport & substrate, Egress guard, Credentials & org scoping, Executor seam & run semantics, Migrations & audit receipt, Author-facing surface, Verification & UAT

**Mode:** autonomous. The operator delegated the session verbatim — *"I will leave you
unattended so please proceed autonomously, take the best decisions, learn from your lessons
and proceed to planning the execution, and in case you need a research or whatever action
please decide yourself"* — so all gray areas were auto-selected and each option was chosen
with its rationale recorded rather than put to a prompt.

---

## 1. Transport & substrate — how "MCP-first" becomes real code

| Option | Description | Selected |
|--------|-------------|----------|
| A — First-party adapters behind an MCP-shaped seam | Three adapters (SMTP / Jira REST / Slack Web API) whose sockets we own, routed through one guarded egress module. `ConnectorAdapter` protocol deliberately MCP-shaped so a future MCP client registers through it. | ✓ |
| B — Consume remote third-party MCP servers | The literal reading of ROADMAP SC#1's "(MCP-backed action nodes)". | |
| C — Run MCP servers locally over stdio | Full MCP fidelity, subprocess-supervised. | |

**Choice:** A. **Notes — this is a ROADMAP amendment (D-01) and the reasoning is
structural, not preferential:**

- Under **B**, the outbound call happens inside someone else's process. Our egress guard
  would cover the hop to the MCP server and **not** the hop to Slack/Jira/the SMTP host, so
  CONN-03 SC#2 ("*every* connector outbound passes an unconditional SSRF guard") becomes
  unprovable. Credentials would also live in the MCP server's config, so CONN-03 SC#4
  (org-scoped, Fernet, resolved server-side by reference) would be satisfied for a
  credential that is not the one sending.
- Under **C**, we acquire a **second runtime**, which red line **D-14** forbids in as many
  words.
- The verdict in `docs/CONNECTOR-ARCHITECTURE.md` is untouched in substance: MCP-first
  remains the substrate direction and the "be callable BY the tools users run" bet;
  first-party-thin *is* exactly this three-capability slice; breadth still defers to Open
  Platform. Only the clause implying an MCP client on day one moves — and that doc already
  records, measured, that **zero MCP code exists in `backend/app`**, so nothing is being
  retreated from.
- Rejected shapes are preserved with a trigger (Open Platform gaining a phase number), and
  the amendment ships as a dated section + a superseding `D-v3.6-02` register entry, never
  as an in-place edit — the doc's own rule.

**Also decided here:** static tokens only (no OAuth authorization-code flow — four net-new
surfaces inside a `threats_open: 0` phase); no 4th capability; Slack's host is a **code
constant**, which makes one of the three destinations unforgeable by construction and gives
the guard suite a real negative control.

---

## 2. The egress guard

| Option | Description | Selected |
|--------|-------------|----------|
| A — One `security/egress.py` owning every connector socket, source-fenced | Mirrors `secret_cipher.py`'s shipped "no `Fernet` is constructed anywhere else" shape. | ✓ |
| B — A guard helper each adapter calls | Simpler, but the guarantee becomes "every adapter remembered to call it". | |
| C — Network-layer egress policy (container/firewall) | Real defence, but invisible to the test suite and absent in local dev. | |

**Choice:** A. **Notes:** the property CONN-03 asks for is *unconditional*, and only a
single-owner module can be **fenced by source** — a test that walks the connector package
for `httpx.` / `smtplib.` / `urllib.request` / `socket.` and requires zero, with a positive
control, in the same shape `test_189_no_egress.py` already uses. B degrades into a
convention. C is complementary, not a substitute, and is out of this phase's reach.

**The ordering decision that matters most:** the guard runs **before** credential
resolution, and a test drives a send with **no credential bound** asserting the failure is
the egress refusal rather than a missing-credential error. That inversion is the entire n8n
CVE class ("guarded only when a credential is attached"), and it is bypassable the day
someone reorders two lines unless it is asserted directly.

**Checks locked:** https-only (SMTP TLS-only) · registrable-domain allow-list · post-DNS IP
validation rejecting private/loopback/link-local/**169.254.169.254**/CGNAT/multicast and
their IPv6 and IPv4-mapped forms · **redirects OFF** · connect to the *validated* IP
(closing the DNS-rebinding TOCTOU window) · timeouts + response-size caps. Where IP pinning
proves impractical for SMTP, it is recorded as a **named residual risk with a trigger** in
SECURITY.md rather than dropped.

**Carried from Phase 185's security lesson:** a deny-list cannot be made fail-closed by
extension — verify the *property* (nothing reaches a non-public IP), not the *patch*, and
observe every falsification RED first.

---

## 3. Expression / template evaluation (CONN-03 SC#3)

| Option | Description | Selected |
|--------|-------------|----------|
| A — Add no evaluator; reuse the shipped sandboxed Jinja where composition is needed | SC#3 becomes a fence over an existing property. | ✓ |
| B — A small purpose-built expression language for field mapping | Author power; a new evaluator inside a `threats_open: 0` phase. | |

**Choice:** A. **Notes:** the app already has exactly one Jinja path and it is
`SandboxedEnvironment(autoescape=True)` in two places. `_exec_external_action` performs no
template evaluation at all today — inputs come from the run bag plus the latest upstream
phase text, with `kickoff_prompt` excluded **by name** (review finding WR-02). Keeping that
resolution means SC#3 is proved rather than built, and the plan must **say so** instead of
claiming to have shipped something. A new expression surface on a business canvas is the
same supply-chain-shaped affordance `docs/CONNECTOR-ARCHITECTURE.md` rules out *"ever"*.

---

## 4. Credentials & org scoping

| Option | Description | Selected |
|--------|-------------|----------|
| A — New org-scoped `connector_connections` table (mig 116); phase config stores an opaque `connection_id` | Mirrors the mig-109/112 membership-RLS shape. | ✓ |
| B — Reuse `app_settings` secret columns | Instance-wide, not org-scoped — fails CONN-03 outright. | |
| C — Credentials in `user_settings` | Per-user, so no colleague can run a colleague's workflow. | |

**Choice:** A. **Notes:**

- `connection_id` is an **opaque reference** in the definition JSONB — additive-optional,
  **zero migration**, exactly how the 6th and 7th `PhaseConfig` members arrived. No secret,
  host or token ever enters the JSONB or the client.
- **RLS carries no `is_system` global-escape branch, and that absence is the decision** —
  it is the precise branch SEED-125 had to close for skill files.
- **One deliberate inversion of a shipped polarity:** `secret_cipher.get_cipher()` returns
  `None` when no key is configured (D-150-01's fail-OPEN plaintext path). Acceptable for a
  provider key in `app_settings`; **not** acceptable for a tenant credential — so 190
  **refuses to store** a connector secret with no cipher available. Recorded as a decision
  so it does not read as a bug later.
- **The headline security gate** is the cross-org leak test: a workflow in org A carrying a
  `connection_id` owned by org B. The resolver must scope by the **run's org**, never by the
  id alone. An id-only `SELECT` passes every ordinary test and leaks a tenant credential —
  and this milestone has that exact precedent twice (SEED-124/mig 110, SEED-125/mig 112).
  Must be observed RED against an id-only resolver first.

---

## 5. Executor seam & run semantics

| Option | Description | Selected |
|--------|-------------|----------|
| A — Gate the SEND on `ctx.is_golden_run` inside the executor | The send is skipped, the record is not, so one composer still owns the NOT-SENT body. | ✓ |
| B — Phase-type carve-out in the engine's golden-run branch | Requires synthesizing a `PhaseOutcome`, i.e. a second vocabulary for one state. | |

**Choice:** A. **Notes — mandatory and non-negotiable (D-16).** `D-189-DEF-04` is inert
today and stops being inert on this phase's own commit: without the gate, **publishing** a
workflow performs the external action, with nobody asked, once per publish attempt. The
review that found it proposed B; 189 declined B for the stated reason that it must
*fabricate* the recorded body to keep `test_publish_service.py`'s assertions true, and would
stop the golden run exercising the real executor. That reasoning still holds.

The trigger is already armed as a **check, not prose**:
`test_a_golden_run_of_an_external_action_performs_no_egress` goes RED on the commit that adds
a real send. The plan must drive it RED then green — never route around it. (Its recorded
Windows trap: build the loop *before* the sentinel arms; `asyncio.run`'s proactor self-pipe
is itself a `socket.connect`.)

**Terminal statuses — zero new ones, zero `workflow_phases` migration:** sent → `completed`;
send failed → `failed`; **no connection bound → `recorded_not_sent`**, keeping migration
115's word as the honest terminal rather than retiring it. **At-most-once**: no automatic
retry, because a double-sent email is worse than a missing one on the surface whose whole
discipline is not over-claiming.

---

## 6. Migrations & the audit receipt

| Option | Description | Selected |
|--------|-------------|----------|
| A — Two migrations: 116 (connections table) + 117 (one `event_type` literal) | Two requirements, two rollbacks. | ✓ |
| B — One combined migration | Fewer files; couples a table to a CHECK amendment. | |
| C — No audit receipt in 190 | Cheapest; leaves a real consequence unreceipted. | |

**Choice:** A. **Notes:** measured, not assumed —
`harness_audit.harness_audit_event_type_check` caps `event_type` at **23** literals
(`full-schema.sql:1124`), and the column is **`event_type`**, not `kind`. Phase 189's D-09
deferred the send receipt to 190 in as many words: *"where it would describe a real
consequence."* This phase creates the consequence, so C is declined. The exact slug is locked
at plan-phase against `test_audit_event_registration.py` — the suite 189 deliberately kept
passing **unchanged**, and which this phase deliberately does move.

Next free migration slot is **116** (re-derived: `ls supabase/migrations/ | tail -1` →
`115_…`). ⚠ The ROADMAP bullet that claimed the head was 113 with 114 free was **false in
both halves** and was corrected at 189-16; re-derive rather than inherit. Filenames must
match `<digits>_name.sql` — a letter suffix like `116b` is silently skipped by the CLI.
Apply discipline unchanged: SQL editor, then `regenerate-full-schema.sh` with no `--reset`.

---

## 7. Author-facing surface

| Option | Description | Selected |
|--------|-------------|----------|
| A — Picker inside the existing `ExternalActionSection`; connections managed in Settings; one operator kill-switch | Zero new lines in `PhaseFormPanel`; zero lines in the card subtree. | ✓ |
| B — A new panel section for connections | A second surface on a hot file. | |
| C — Connections managed in the Control Room (`/admin`) | Operator-owned, but org-tenant config is not an operator concern. | |

**Choice:** A. **Notes:**

- `PhaseFormPanel.tsx` is on the hot-file ledger and its row records the rule directly:
  *"the next surface that needs the panel gets its own component and one gated line."*
  189-14 already spent that line (11 insertions / 0 deletions, 3 JSX). **190's measured
  `git diff --numstat` on that file must be `0 0`.**
- **The `Not connected` badge retires by DATA, in one line.** `notConnectedOf` was written
  with its type test and state test on **separate lines** precisely so 190 edits only the
  second. `PhaseNode.tsx`, `PhaseNodeCard.tsx` and the six fenced card-subtree modules must
  have an **empty diff** — if any is opened, D-12/D-18's design intent was not honoured.
- Settings over Control Room follows the recorded settings↔control-room boundary: operator
  sets the allowed-set and the lock; the org admin sets the preference. The operator's half
  is **one code-constant kill-switch** (`live_connectors`, **off by default**) joining
  `admin.py`'s shipped allowlist — the exact one-entry / zero-new-endpoint path Phase 181
  used for `visual_workflow_canvas`. With it off, the step behaves exactly as it does today:
  records, does not send. That is an already-tested state, which is what makes the switch
  cheap rather than a second code path.

---

## 8. Verification & UAT

| Option | Description | Selected |
|--------|-------------|----------|
| A — Full 8-row roster derived from `MODEL_CAPABILITIES`; live-send rows ⛔ until the operator supplies destinations | Honest scoreboard; blocking dependency named now. | ✓ |
| B — Four-provider "cross-provider" set | The under-specification the roster rule was amended to kill. | |

**Choice:** A. **Notes:** the roster is **derived**, never re-typed — an id absent from
`MODEL_CAPABILITIES` resolves `capability_source=inferred` and silently loses `emit_tier`,
so a hand-typed row measures a weaker configuration than ships. ⚠ **The Phase-185 method
does not transfer unexamined:** it relies on per-request `model` + `provider` on
`POST /threads/{id}/messages`, and Phase 187 measured that `/generate` accepts none. Whether
the workflow-run endpoint accepts per-request routing must be **measured at plan-phase**; if
not, rows run serially and the cost is stated in VALIDATION.md rather than discovered
mid-UAT. Rows may be ⛔ with a named reason; they may never be silently omitted.

**Blocking operator dependency (named now, not at UAT):** one throwaway mailbox, Jira
project and Slack channel. Planning and implementation do not need them; **closing the phase
does.** Closing with those rows owed is legitimate — but only stated as a DECISION, never as
a claim that everything ran.

---

## Claude's Discretion

The operator delegated the whole session. Left to research and planning: the precise
`connector_connections` column and index list; whether an `httpx` transport hook or an
explicit resolve-then-connect wrapper implements the validated-IP connect; the Jira REST
payload shape (ADF vs plain text); the Settings → Connections route and its nav placement;
the wording of the egress refusal shown to an author; and the plan/wave decomposition.

**Explicitly NOT discretionary:** the golden-run send gate (D-16) and the cross-org leak test
(D-14). Both are latent defects this phase's own commit creates, and both belong in Wave 0,
RED, before any adapter exists.

---

## Guardrails

- **G-2 — FIRES, and is honoured rather than skipped.** Scope includes a live UI surface, so
  a sketch is recommended before planning. Narrowed to the **Settings → Connections page
  only** (~3 on-screen actions), because the picker reuses `ExternalActionSection`'s shipped
  shape and two close analogs are already sketched (the Phase 111.1 provider picker with its
  🔒 endpoint footer; the 146–148 graded action-guard vocabulary). If the operator overrides,
  it must be recorded under `STATE.md → Guardrail overrides`.
- **G-1** — not applicable; 190 is not a `<base>.N` insert.
- **G-5** — checked against the hot-file ledger. The two G-5-firing rows are
  `backend/app/api/threads.py` and `backend/app/services/anthropic_service.py`; **neither is
  in this phase's expected `files_modified`, and neither should be opened.**
  `PhaseFormPanel.tsx`, `WorkflowCanvas.tsx` and `PhaseNodeCard.tsx` are all *satisfied* rows
  and D-23/D-24 keep their diffs at or near zero. Noted for a future ledger review, not for
  this phase: `backend/app/services/harness/phase_types.py` is now 1904 lines.
- **G-6** — "How we'd know this failed" is enumerated in CONTEXT.md D-31.
- **G-7** — not yet applicable (no gap-closure rounds). The scope fence (D-32) is written now
  precisely so a later round cannot smuggle a capability in.

## Deferred Ideas

MCP client/server · OAuth authorization-code flow · idempotency keys + retry/queue · a 4th
capability and a public extension point · broad catalog / inbound webhooks / public API /
service accounts · a per-field mapping expression surface · contact-directory recipient
resolution. Each carries a concrete re-open trigger in CONTEXT.md `<deferred>`.

**Reported-bugs routing** (CLAUDE.md mandatory cross-check): **BUG-260808-02** (the approval
pause hands the user off to chat) is the highest-overlap open report and **190 raises its
stakes** — after this phase, the approval you must leave the run surface to give is the one
that actually sends. **Deferred, not folded**, on three grounds: the report calls itself a new
capability, the operator said not to fold it, and it belongs with SEED-139 + SEED-140 as one
coherent workflow-surface phase. Its frontmatter now carries that re-open trigger.
**BUG-260807-01** and **BUG-260808-01** (both the WR-04 prototype-pollution class) are left
open but should be swept by `/gsd:fast` **before** 190 executes, so `/gsd:secure-phase 190`
does not inherit findings this phase did not cause.

**Reviewed, not folded:** `spike-nl-workflow-authoring.md` (matched at 0.6 on the keywords
*template / run / first*) — its subject shipped as Phase 187; the match is keyword-driven and
semantically unrelated to connectors.
