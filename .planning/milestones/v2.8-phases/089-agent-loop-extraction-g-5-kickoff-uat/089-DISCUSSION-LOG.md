# Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 089-agent-loop-extraction-g-5-kickoff-uat
**Areas discussed:** CF-01 sweep (driver + disposition), Extraction risk dial, Byte-identical proof bar, SEED-037 timing, Cross-provider matrix (operator-raised)

---

## CF-01 sweep — driver

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Claude drives browser-observable checks via Chrome MCP + authors eval runbook; operator runs backend eval script with keys, pastes results | ✓ |
| Operator-driven | Operator runs everything; Claude only authors runbook + reads back evidence | |
| Claude-driven (Chrome MCP) | Claude drives as much as possible via browser; backend-only eval still needs operator | |

**User's choice:** Hybrid (Recommended)
**Notes:** Eval script hits real provider APIs needing keys only in operator's `backend/.env`; title-gen + download are UI-observable; Google 404 is backend-log observable. Operator starts uvicorn themselves.

---

## CF-01 sweep — disposition if still broken

| Option | Description | Selected |
|--------|-------------|----------|
| Re-open + defer, keep 089 pure | Still-broken items re-opened with re_open_trigger, routed to named later slot; zero feature fixes in 089 | ✓ |
| Allow tiny provider-scoped fixes inline | 1-2 line provider-scoped evidence-backed fixes allowed; bigger ones deferred | |
| Fix everything found now | Close every broken item in 089 | |

**User's choice:** Re-open + defer, keep 089 pure (Recommended)
**Notes:** Preserves G-5 / extraction-purity discipline; avoids the "while-I'm-in-here" trap.

---

## Extraction risk dial — what moves into agent_loop.py

| Option | Description | Selected |
|--------|-------------|----------|
| Clean module | Move loop + tool-dispatch + provider chunk-handlers + _persist_assistant_message verbatim into run_agent_loop() | ✓ |
| Thin seam | Move only iteration control; chunk-handlers stay as threads.py callbacks | |
| Claude's discretion | Researcher/planner draws the seam, reports back | |

**User's choice:** Clean module (Recommended)
**Notes:** Best clean substrate for the harness (091); matches SC#1 "iteration loop + tool-dispatch block." threads.py keeps route + producer spawn + _emit/_spawn + _shielded_finalize.

---

## Extraction — captured-state passing mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Claude's discretion, report seam first | Likely a context dataclass; report exact boundary + signature before executing | ✓ |
| Prefer a context dataclass | Lock an AgentLoopContext/RunContext object now | |
| Prefer a flat parameter list | Explicit params (~15+ args) | |

**User's choice:** Claude's discretion, report seam first (Recommended)
**Notes:** Operator confirms the seam, does not design it.

---

## Byte-identical proof bar

| Option | Description | Selected |
|--------|-------------|----------|
| Both: SSE record-and-diff + eval/E2E GREEN | Capture per-provider SSE logs before/after (empty diff) AND 088 eval + Playwright E2E GREEN before+after | ✓ |
| Eval-harness + E2E only | Rely on scoreboard + Playwright passing identically | |
| SSE log diff only | Capture/diff raw SSE; skip full eval gate | |

**User's choice:** Both (Recommended)
**Notes:** SSE-diff = literal SC#3 "captured snapshot diff = empty" evidence; eval+E2E = cross-provider behavioral backstop. Representative run = Claude's discretion guided by SC#10 multi-tool axis.

---

## SEED-037 download /gsd:quick timing

| Option | Description | Selected |
|--------|-------------|----------|
| Decide after the CF-01 sweep | Run the quick only if download proves still-broken; else stays a separate later quick | ✓ |
| Bundle into kickoff now | Run the SEED-037 quick regardless | |
| Keep fully separate | Decoupled entirely | |

**User's choice:** Decide after the CF-01 sweep (Recommended)
**Notes:** Data-driven; download-link payload is also a CF-01 sweep item, so the sweep result decides.

---

## Cross-provider matrix (operator-raised mid-discussion)

**Operator challenge:** "why you only mention anthropic only? you still consider other providers correct? we should consider all providers including deepseek and moonshot in addition to the deferred ones (glm and minimax)."

**Claude clarification:** The "Anthropic-only" mention was confined to the reported-bugs routing table — those two specific *deferred* bug files are literally Anthropic-titled Phase-093 (PARITY-01) items. Phase 089 is cross-provider by design (SC#2/#3/#4). Verified `_PROVIDER_BASE_URLS` in config.py: GLM (zhipu) + MiniMax are already-wired native providers, NOT deferred. The ROADMAP's "all 6 native providers" undercounts (inherited from the 088 eval's 6).

### Eval matrix — when GLM + MiniMax join the automated gate

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the automated gate NOW in 089 | Add GLM + MiniMax to eval PROVIDERS + quick model-ID curation; all 7 native in the SSE-proof + eval gate from kickoff | ✓ |
| Manual UAT covers 7 now; automated eval → 096 | Manual sweep covers 7, automated eval extension defers to 096 | |
| Full curation for all 9 now | Curate every provider incl OpenRouter + Ollama | |

**User's choice:** Extend the automated gate to GLM + MiniMax NOW in 089 (Recommended)
**Notes:** Additive proof-harness work, not agent-loop edits → doesn't violate extraction-purity; gives 091+ a complete regression gate.

### Non-first-class providers (OpenRouter + Ollama)

| Option | Description | Selected |
|--------|-------------|----------|
| OpenRouter best-effort, Ollama optional | OR logged-not-blocking; Ollama opportunistic; native-7 are the hard bar | ✓ |
| OpenRouter as a hard gate too | Promote OR to first-class pass/fail | |
| Native-7 only; drop OR + Ollama | Tightest matrix | |

**User's choice:** OpenRouter best-effort, Ollama optional (Recommended)

---

## Claude's Discretion

- State-passing mechanism / context-object shape (report seam first).
- Exact "representative multi-tool run" prompt + tool selection.
- Atomic-commit vs reviewable-sequence for the lift (each intermediate keeps eval + E2E GREEN).

## Deferred Ideas

- Six Agentic-RAG bugs routed (none fold into 089): non-anthropic-generic + 2 deferred Anthropic agent-loop bugs → Phase 093; chat-tool-cards + step-count + timer-long-runs → Phase 095.
- SEED-037 download wire-up → standalone `/gsd:quick` (trigger: sweep proves download broken).
- Full per-provider model-ID curation → Phase 096 (EVAL-01).
- General/Explorer selector behavior during an active workflow → Phase 092.
