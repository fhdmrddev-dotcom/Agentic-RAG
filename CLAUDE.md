# CLAUDE.md

Agentic RAG platform — AI agent that knows your knowledge base, runs code in a
sandbox, and can be taught new skills that persist. Chat is the default
interface; document ingestion is a manual file-upload flow.

## More than one agent works this repo

Gemini (Antigravity) and Claude (terminal) both work here, from processes that cannot call each
other. Coordination is a durable mailbox: **`.agent-bus/OPEN.md`**, driven by
`scripts/agent-bus.sh` (`list` / `open` / `answer` / `close`). Protocol + roles: **`AGENTS.md`**.

A SessionStart hook (`.claude/hooks/agent-bus-check.sh`) prints every open `to:claude` item at
every session and subagent start — silent when empty, loud at 3+ days. ⚠ **Whoever REVIEWS a
phase must not have shaped the build**; design direction across the bus makes the review
self-assessment. Decisions go `--to operator`, never settled agent-to-agent.

## Stack
- Frontend: React + Vite + Tailwind + shadcn/ui (Aether Intelligence design system, Deep Midnight theme)
- Backend: Python + FastAPI
- Database: Supabase (Postgres, pgvector, Auth, Storage, Realtime)
- LLM providers: OpenAI, OpenRouter, Anthropic (native SDK), Google — routed via MODEL_CAPABILITIES registry
- Code execution: Docker (`llm-sandbox`), gated by `SANDBOX_ENABLED`
- Observability: LangSmith

## Rules
- Python backend must use a `venv` virtual environment
- **Backend unit testing baseline gate (MANDATORY):** The canonical backend unit test command is `pytest tests/unit -q --continue-on-collection-errors` (or `node scripts/check-backend-unit-baseline.cjs`), run in `backend/` with the virtualenv. Milestone v4.0 locks the baseline at **71 failed, 3497 passed, 2 xfailed, 2 xpassed (0 collection errors)**. Any new failure above 71 breaks the gate (zero headroom). Never weaken this ceiling without explicit operator authorisation.
- No LangChain, no LangGraph — raw SDK calls only
- Use Pydantic for structured LLM outputs
- All tables need Row-Level Security — users only see their own data (global folders/skills are the only shared scope)
- Stream chat responses via SSE
- Stateless chat completions — store and send chat history yourself, no provider-side thread state
- **Automated scheduled watch loops & manual upload (Phase 234 / SEED-142):** External cloud folders (Google Drive) sync automatically into Library folders via `connector_watches` and `WatchService` with connection-scoped visibility (`ingest_visibility`), fail-closed structural completeness deletion guards (`H-5` / `SourceListing.complete`), and anti-injection trifecta controls (`TRUST-03`). Manual upload remains fully supported alongside automated watching.
- Schema changes ship as numbered SQL migrations under `supabase/migrations/` at the repo root (the legacy `backend/supabase/migrations.archive/` is dead — see its README). Filenames must match `<digits>_name.sql` (e.g., `035_my_change.sql`); letter suffixes like `007b` are silently skipped by the Supabase CLI. **Apply each new migration to the live local DB by pasting it into the Supabase SQL editor — never `supabase db push`/`db reset`** (preserves dev data). Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh` — by default this dumps the live DB schema with no reset, rebuilding `supabase/full-schema.sql` (single-file deploy artifact for greenfield envs). Pass `--reset` only when you explicitly want to verify the migration sequence from a clean slate (CI / release verification — destructive: wipes local DB). Never hand-edit `full-schema.sql`. Full setup story: `supabase/SETUP.md`.
- Supabase Realtime is a best-effort hint, **not** a source of truth — always reconcile via fetch on (re)connect (see decision D-v2.5-03)
- Do not run blocking I/O (e.g. `supabase-py` calls) directly inside async handlers — wrap with `run_in_threadpool` (decision D-v2.5-01)
- Multi-worker uvicorn is the default (`WORKER_COUNT=2`); see D-PRD-12 in `.planning/prd-reset/DECISIONS.md` for the singleton audit checklist and scaling guidance
- Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only
- External integrations / connectors follow the recorded MCP-first verdict — `docs/CONNECTOR-ARCHITECTURE.md` (MCP-first, first-party-thin, broad catalog sequenced with Open Platform; dated re-open trigger inside; pointer entry `D-v3.6-01`). ~~No MCP client exists in the backend today; live outbound egress is Phase 190 (STRETCH).~~
  ⚠ **CORRECTED 2026-09-07 — that sentence was FALSE for thirteen days, and the original is struck through rather than deleted.** Measured: **`backend/app/services/mcp_client.py` is 480 lines across 5 phases**, added at `a1aa25c48` (**Phase 206, 2026-08-25** — *"MCP connector client — workflow-scoped, driven against a real server"*), so it also **FIRES G-5** while ROADMAP Phase 239 still describes it as *"4/2/407 — young, no row owed yet"*. Live outbound egress ships too, guarded by `app.security.egress.validate_mcp_destination` plus per-tool grant enforcement. ⭐ **The retirement itself was done RIGHT and that is the point** — `backend/tests/unit/test_189_no_egress.py`'s Case A source fence was **consciously retired under `D-206-07`**, with the reason written into the test body, exactly as `SEED-177` demanded (*"retire the fence DELIBERATELY, never trip it by surprise"*). **What rotted was the PROSE, not the guard** — the fence, the seed and this bullet are three registers and only one of them was updated. ⚠ `SEED-177` still reads `status: planted`.
- **Provider-docs-first (evidence-based):** whenever work touches a specific provider (prompting, orchestration, context management, skill use, tool calls/tool use, streaming, structured output), research that provider's OWN official documentation first, then cross-check against our app's actual behavior with comparative analysis and real evidence (Supabase/DB, backend logs, LangSmith, live cross-provider UAT). Conventions do NOT transfer 1:1 between providers; keep provider-specific handling at the service boundary, never break the shared path. See `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md`.

## CLAUDE.md context budget (MANDATORY)

This file is loaded verbatim into the system prompt of **every session and every subagent**, and Claude Code **refuses to load it over 150,000 characters** — at which point every instruction here silently stops applying, to every agent, everywhere. Characters, not bytes: `wc -c` reads 197,197 for the file the harness called `194.9k` (the gap is multi-byte `—` `⚠` `✅`). Measure with the gate, never with `wc`.

```bash
node scripts/check-claude-md-size.cjs             # exit 0 clear · 1 over · 2 harness error
node scripts/check-claude-md-size.cjs --history   # re-derive the growth curve from git
```

⚠ **It has already tripped once, and it was over for three commits before anyone noticed.** Measured (`--history` reproduces it): `43,269` (2026-08-12) → crossed 150k at `77f7fc16` (`153,108`) → `96d37730` (`155,132`) → `7b39dd5f` (**`194,908`**, `+39,776` in one commit) → split at `a882777b` back to `51,171`. Three single commits added `+21,450`, `+32,414` and `+39,776`. **The split bought headroom; it changed nothing structural**, so the trip recurs unmeasured.

⚠ **AND IT RECURRED, EXACTLY AS THAT SENTENCE PREDICTED — the original is kept above rather than
overwritten, because the prediction being RIGHT is the finding.** The 2026-08-17 split left `51,171`
chars; by **2026-08-25 the file measured `135,662`** — `+84,491` in eight days, a faster climb than the
one that tripped the limit. **Phase 208 is the second split**, and it measured the mechanism instead of
assuming it: **the hot-file ledger's DISPOSITION column alone was `60,558` chars — 45% of the entire
file**, across 115 rows whose cells had become paragraphs. Split result: **`135,662` → `80,874`**.

⚠ **THIS TIME THE STRUCTURAL HALF WAS DONE TOO, because "it changed nothing structural" is the whole
reason there was a second trip.** `scripts/check-claude-md-size.cjs` now caps the ledger's disposition
cell at **200 chars** (`[disposition-too-long]`) and also fails a `[duplicate-row]` or a
`[malformed-row]`. It runs in the PostToolUse hook, so it fires in the turn the prose is authored — not
eight days later. All three findings were **driven RED against planted defects and the file restored
md5-identical**; a guard nobody has seen fire is not a guard.

- **Hard limit 150,000 · warn band 120,000.** At the warn band the split is *scheduled*, not scrambled.
- **Split by FUNCTION, never by deletion.** CLAUDE.md keeps the verdict / index / audit-scan-list; the narrative moves to `docs/<TOPIC>.md` under a **same-commit sync rule**. Precedents: `docs/HOT-FILE-LEDGER.md`, `docs/SANDBOX-PACKAGES.md`. ⚠ A hot file missing from a scan list is permanently invisible to its own guardrail — so the *table* stays complete and only the *prose* leaves. ⚠ **AND THE PROSE MUST STAY OUT:** a ledger disposition cell is capped at **200 characters** and the gate FAILS above it. Put the verdict in the cell and the reasons in that file's own section in `docs/HOT-FILE-LEDGER.md`, **in the same commit**.
- **Two guards, and the local one is primary.** `.claude/hooks/claude-md-size-guard.js` (PostToolUse on `Write|Edit`) fires in the turn that authors the content; `.github/workflows/claude-md-size.yml` is the backstop. ⚠ CI alone is not enough here — `develop` ran **634 commits over 8 days without a push** while this file grew 43k → 195k, so an `on: push` gate could not have fired once in that window.

## Local dev infrastructure

- **Supabase**: managed by Supabase CLI. `supabase start` boots Postgres + Auth + Storage + Realtime on Docker; configured to auto-start on Docker Desktop boot. ✅ **This auto-start claim was AUDITED and is TRUE** (2026-08-15): all twelve `supabase_*` containers carry `restart: unless-stopped`, measured with `docker inspect -f "{{.HostConfig.RestartPolicy.Name}}"`. It is recorded here because a session spent six wrong turns doubting it — the containers were coming back correctly the whole time and the fault was elsewhere (see the port-reservation trap below). One exception found by the audit: `supabase_edge_runtime_*` read `no` and was pinned; re-audit after any `supabase stop` + `supabase start`, since a recreated container can come back without a policy.
- ⚠ **THE WINDOWS PORT-RESERVATION TRAP — the #1 cause of "local Supabase is broken", and it is NOT a Docker, Supabase or restart-policy problem.** Windows (WinNAT / Hyper-V, which WSL2 and Docker Desktop both sit on) auto-reserves **blocks of TCP ports** for dynamic allocation, and **those blocks are re-rolled on every reboot**. When a block lands on the Supabase range, Docker starts the containers fine and is then refused permission to publish their ports:
  ```
  bind: An attempt was made to access a socket in a way forbidden by its access permissions.   (WSAEACCES)
  ```
  **The symptom is a container reporting `Up (healthy)` whose port accepts nothing**, and a CLI printing a connection string that cannot connect. Measured 2026-08-15: the auto-reserved block `54258-54357` swallowed **54321, 54322, 54323, 54324 and 54327 at once**, while Redis on 6379 was untouched — which is exactly what makes it look like a Supabase-specific fault. Downstream, `uvicorn` dies in its lifespan at `assert_action_types_synced(await get_pg_pool())` with `ConnectionRefusedError: [Errno 10061] ('127.0.0.1', 54322)`.
  - **Diagnose in ONE step** (no admin): `netsh int ipv4 show excludedportrange protocol=tcp` — look for a range straddling 54322. ⚠ **The trailing `*` is load-bearing: it marks an ADMINISTERED exclusion, which is one we claimed deliberately and which explicit binds still succeed into. An UNMARKED range is an automatic reservation and IS the fault.** A check that ignores the asterisk fires on our own remedy.
  - **Fix permanently, once, in an ADMINISTRATOR PowerShell** (quit Docker Desktop first):
    ```powershell
    net stop winnat
    netsh int ipv4 add excludedportrange protocol=tcp startport=54320 numberofports=16 store=persistent
    net start winnat
    ```
    `store=persistent` is what survives reboots. The block `54320-54335` covers every Supabase default: 54320 shadow db, 54321 API, 54322 db, 54323 Studio, 54324 Mailpit, 54327 analytics, 54329 pooler. Verify with the `show` command above — **the new row must carry the `*`**; no asterisk means it did not apply. Applied on this box 2026-08-15.
  - ⚠ **Things that CANNOT fix this, all four measured that day rather than reasoned about:** a restart policy (the containers were already restarting correctly); `docker restart <container>` (port bindings are baked in at container *creation*, so a restart re-publishes nothing); `supabase start` when the stack is partially up (it prints `already running` and short-circuits without repairing anything); and any startup script (Docker is being *refused* the bind, not failing to ask for it). `HostConfig.PortBindings` stays perfectly correct throughout — it is `NetworkSettings.Ports` that comes back empty, so **`docker inspect` on the config looks healthy and only `docker ps` shows the missing `->` mapping**.
- **Bring local infra up + verify it in one command**: `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`. Idempotent, safe to re-run any time. It waits for the Docker daemon, runs `supabase start` and `docker compose up -d`, audits/pins restart policies, and **verifies 54322 / 6379 / 54321 accept a real TCP connection** — because "container running" is not the property the backend needs. On failure it prints a diagnosis naming the container status, configured-vs-live port bindings, and whether Windows has auto-reserved the port (both arms driven against real `netsh` output). Optional logon task: `scripts/register-infra-task.ps1` (needs an admin shell **once** to register; the task itself runs unelevated as the user, since Docker Desktop is per-user). Log: `scripts/start-local-infra.log` (gitignored by `*.log`).
- ⚠ **`supabase stop` REMOVES the containers** (it preserves data volumes — only `--no-backup` destroys them). A restart policy cannot restart a container that no longer exists, so after any `supabase stop` the stack comes back only via `supabase start` or the script above. This is the one gap `restart: unless-stopped` structurally cannot cover.
- **Known-benign local noise:** `supabase_vector` crash-looping plus `WARNING: Analytics on Windows requires Docker daemon exposed on tcp://localhost:2375`. `vector` ships container logs to `analytics` (Logflare) and cannot reach the daemon's log stream on Windows without that setting. It affects local log analytics **only** — not Postgres, Auth, Storage, Realtime or the app. Leave it: exposing 2375 opens an unauthenticated Docker daemon socket, which is a bad trade for local log plumbing. `supabase_imgproxy` / `supabase_pooler` idling as `Stopped services:` is likewise normal here.
- **Redis** (v2.5+): runs via `docker-compose.dev.yml` at repo root. Start once with `docker compose -f docker-compose.dev.yml up -d`; auto-restarts on Docker Desktop boot. Optional Redis Insight web UI on port 5540: `docker compose -f docker-compose.dev.yml --profile insight up -d`. No migrations — Redis has no schema; streams/keys are created on first write.
- **Sandbox image** (v2.6+ / Phase 075.1): the agent's `execute_code` tool runs in a Docker container managed by `llm_sandbox`. By default it uses `llm_sandbox`'s bare-Python image, which forces the agent to `pip install matplotlib`/`pandas`/etc. on every new chat (~10-15s warm-up). The project ships a pre-built image at `backend/Dockerfile.sandbox` with the Claude.ai-analysis-tool package set (matplotlib + numpy + pandas + python-pptx + openpyxl + python-docx + pypdf + **reportlab** + seaborn + scipy + scikit-learn + plotly + **docxtpl**; reportlab added 2026-05-31 — pypdf only READS pdfs, reportlab WRITES them; docxtpl added in Phase 101 — the trusted-path template-fill Jinja render engine) — build once with `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/`, then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env`. **The `-t` tag and `SANDBOX_IMAGE` MUST be identical** — the tag after the colon is just a label (free text, not a version requirement); its only rules are (1) build-tag == `SANDBOX_IMAGE`, and (2) pick a NEW label whenever `Dockerfile.sandbox`'s package set changes, then rebuild + update `SANDBOX_IMAGE`, so old cached containers don't shadow the new image. (Tag history: `075.1` at Phase 075.1 → `075.1.1` when reportlab landed 2026-05-31 → `101.1` when docxtpl landed in Phase 101 — the current tag.) When `SANDBOX_IMAGE` is unset, `SandboxSessionManager.get_or_create` (`backend/app/services/sandbox_service.py:25`) falls back to the bare image. Sandbox sessions are cached per `thread_id` until idle eviction (default 30 min), so env-var changes only affect NEW chats — existing chats keep their original container until eviction. Full var reference: `backend/.env.example`. **Canonical package list + add-a-package / size-perf rules: `docs/SANDBOX-PACKAGES.md`** (keep it in sync with `Dockerfile.sandbox` in the same commit; skills/skill-creator must author against the installed set — mig 093).
- **Local-vs-cloud switch**: env vars only. `SUPABASE_URL` + `REDIS_URL` in `backend/.env` point at local containers by default; switch to cloud (Supabase project URL, Upstash `rediss://...`) without code changes. See `backend/.env.example` for the full var list.
- **Run-buffer key conventions** (Phase 061+): `run:{run_id}` (Redis Stream — per-run event buffer), `runs_by_thread:{thread_id}` (sorted set — active runs per thread), `runs:active` (sorted set — all currently-streaming run_ids for global cleanup). Defined in code, not in any migration script.
- **Setup guides**: `supabase/SETUP.md` for Supabase (local + cloud + migrations), `REDIS-SETUP.md` for Redis (local + cloud + key conventions). Read these when connecting a new environment or onboarding a contributor.

## Parallel execution — worktrees are ENABLED (MANDATORY rules)

`workflow.use_worktrees` is **`true`** as of 2026-08-10. It was `false` for a year, and that made
every GSD phase fully serial: Phase 190 measured **10.8 h of execution for 19 plans**, against
**5.7 h** if its eight waves had run in parallel — roughly **five hours lost to serialisation on
one phase**. Sequential execution is not acceptable; treat parallelism as the default.

**The reason it used to be off was real, and it is now SOLVED rather than ignored.** `git worktree
add` checks out TRACKED files only, and four things verification depends on are gitignored, so a
fresh worktree false-failed every plan:

| Artifact | Size | Handling |
|---|---|---|
| `backend/venv` | **1.7 GB** | **junction** (copying is fatal) |
| `frontend/node_modules` | **541 MB** | **junction** |
| `backend/.env` | small | **copy** (a worktree must never mutate the operator's env) |
| `frontend/.env.local` | small | **copy** |

### The four rules

1. **Every worktree MUST be bootstrapped before any command runs in it.** The executor's FIRST
   action — before the HEAD assertion, before reading the plan — is:
   ```bash
   bash scripts/bootstrap-worktree.sh "$(pwd)"
   ```
   It is idempotent and fails loudly. A worktree that skipped it will report green typechecks and
   red tests for reasons that look like the plan's fault.

2. **Cap vitest workers in every run: `GSD_VITEST_MAX_WORKERS=2`.** ⚠ **This rule said `4` until
   2026-08-14, and the 4 was not wrong when written — it ROTTED, because the right cap is a
   function of how many test cases the gate executes, not a constant.** Both figures are kept so
   the drift is visible rather than overwritten.

   - **Why 4 was right at ~3400 gated cases:** two UNCAPPED concurrent vitest runs spawn ~16
     workers each on this 16-core box, and the oversubscription surfaces as bare timeouts in
     suites the plan never touched — `failed 6` and `failed 5` against a serial baseline of
     `failed 0`. Capped at 4 each, two concurrent runs agreed exactly (9 files / 23 tests
     failing, the known SEED-056 rot set, on both).
   - **Why 4 is wrong at 3600.** Phase 193 measured, on **one identical commit** (`STATE.md:136-140`):
     cap 4 → `failed` **17**, then **4**, then **3**; UNCAPPED → **11**; **cap 2 → 0 and 0.** Every
     failure was a `STACK_TRACE_ERROR` timeout in a file no plan had touched — the signature of
     oversubscription, never of a real defect. Confirmed independently by quick task `260814-q5r`:
     a single run at cap 2 → **exit 0, `failed 0`, total 3604**.
   - ⚠ **THE `3604` ABOVE IS STALE AND THE CORRECTED FIGURE IS RECORDED BESIDE IT, NEVER OVER IT —
     this constant has now rotted TWICE and the second rot took ONE DAY.** Measured at Phase 193.2's
     close (2026-08-15, quiet tree, main working tree, no sibling agent): **`count gate OK` · total
     3918 · failed 0 · pinned total 3868 · 75/75 pinned files present.** The intermediate readings
     are published too, because the *rate* is the point: **3604** (`260814-q5r`, 2026-08-14) →
     **3892** (`193.2-01`, 2026-08-15, `+288` in one day as Phase 193.1's eleven plans landed) →
     **3895** → **3899** → **3907** → **3911** → **3918** across Phase 193.2's own plans. **A growing
     number is the gate WORKING, not the gate breaking** — its contract is *no per-file DECREASE* and
     *zero failing*, never a fixed grand total, so a plan that sees a bigger figure than this
     paragraph quotes has seen the correct current one. Re-derive with
     `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` and read the verdict line, never a
     summary. ⚠ **Cap 2 held `failed 0` on the first run here, but it is NOT deterministic:**
     `193.2-03` measured `failed` **4, 11 and 6** on three consecutive runs of a tree whose frontend
     diff was **EMPTY**, while `193.2-04` and `193.2-06` each read `failed 0` first time with a
     sibling agent active. **Capture failing filenames BEFORE re-running anything** — `193.2-02`
     recorded itself breaking that rule and could not afterwards prove its three cases were innocent.

   **So: use 2, and RE-MEASURE when the gated total grows again** rather than trusting this number
   the way this rule asked you to trust the last one. `scripts/vitest-count-gate.cjs` reads the env
   var; absent, single-run behaviour is unchanged. The cap now matters on a SINGLE run too, not
   only on parallel ones — that is what changed. Also still true: at THREE concurrent test-running
   agents the gate goes non-deterministic regardless of cap, so keep it to ≤ 2.
   This is very likely what Phases 190-16/17/18 saw and misattributed to `userEvent` delay.

   ---

   ### ⚠ CORRECTION 2026-08-17 (Phase 195, plan `195-08`) — THE NUMBERS **AND** THE CAUSAL CLAIM. Both originals are preserved above, never overwritten.

   **(a) THE NUMBERS ARE STALE AGAIN — the third rot, and it took TWO DAYS.** Re-derived on the main
   working tree, quiet, no sibling agent, verdict line read verbatim rather than summarised:

   ```
     total                                      4096    4170     +74
     total 4170  ·  failed 0  ·  pinned total 4096
   count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing.
   ```

   | | this rule says above | **measured 2026-08-17** |
   |---|---|---|
   | grand total | 3918 | **4170** |
   | pinned total | 3868 | **4096** |
   | pinned files | 75/75 | **83/83** |

   Phase 195's own trajectory, published because the *rate* is the point and it has not slowed:
   `3972 / 3898 · 75/75` (wave 1 baseline) → `4044` (+5 suites adopted) → `4136 · 82/82` →
   `4147` → `4150` → **`4170 · 4096 · 83/83`**, identical on three separate runs.
   **A growing number is still the gate WORKING.** ⚠ **Eight of this phase's nine suites were
   UNGATED before it started** — `TARGETS` had no entry for `src/components/chat`, `src/lib` or
   `src/components/panel` at all, so a green gate said nothing about four fifths of the phase.
   **Adopting a suite raises the total; that is the desirable direction and must not be read as drift.**

   ---

   ### ⚠ CORRECTION 2026-08-19 (Phase 192.2, plan `192.2-06`) — THE FOURTH ROT, AND IT TOOK TWO DAYS. Both prior sets of figures are preserved above, never overwritten.

   Re-derived on the main working tree — quiet, no sibling agent, run from the **repo root**, verdict
   line read **verbatim** rather than summarised:

   ```
     total                                      4328    4594    +266
     total 4594  ·  failed 0  ·  pinned total 4328
   count gate OK — 92/92 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction (a) above said (2026-08-17) | **measured 2026-08-19** |
   |---|---|---|
   | grand total | 4170 | **4594** |
   | pinned total | 4096 | **4328** |
   | pinned files | 83/83 | **92/92** |

   ⚠ **READ THE DATES: `4170` was 2026-08-17 and this is 2026-08-19 — TWO DAYS, and `+424` cases.**
   The rot before this took ONE day; the one before that, two. **The rate has not slowed, which is
   exactly why this section publishes a trajectory rather than a number.** Phase 192.2's own arc, with
   every increment attributed so none can be quoted as another: `4455 · 4328 · 92/92` (wave-1 baseline
   — and note the **pinned** total was ALREADY 4328 there, so the `+139` that follows is entirely NEW
   TEST CASES, not newly-adopted pins) → `4506` (`+24` characterization pin, `+22` `cardFace`, `+5`
   fence sweeps) → `4574` (`+52` `runFacts`, `+11` `cardFace`, `+5` sweeps) → **`4594`** (`+15`
   `WorkflowCard.test.tsx`, `+5` the pin's re-baseline). **Each step closes with no residual**, and
   that arithmetic is what distinguishes GROWTH from DRIFT — an unexplained `+n` is the thing to
   worry about, never a bigger number.

   **A growing number is still the gate WORKING.** Its contract is *no per-file DECREASE* and *zero
   failing*, **never a fixed grand total** — so a plan that reads a bigger figure than this paragraph
   quotes has read the correct current one. Re-derive rather than doubt it:
   `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, **from the repo root**, and read the
   verdict line, never a summary.

   ⚠ **A DELIBERATE FILE DELETION IS THE ONE THING THAT CAN LEGITIMATELY DECREASE THE TOTAL — AND IT
   DID NOT HERE, WHICH IS ITSELF THE FINDING.** `192.2-06` deleted `frontend/src/dev/SketchLibraryCard.tsx`
   (244 L) and its route registration in `main.tsx`. **No pinned file decreased and 92/92 still resolve**,
   because **no gated suite ever covered `src/dev/` at all**. So the gate could never have told anyone
   that a dev-only surface had outlived its sketch — **the teardown obligation was carried by a note in
   a sketch README and by nothing executable.** A plan that deletes a source file must therefore say
   which side of the gate it was on; silence reads as *"unchanged"* and means *"unwatched"*.

   ⚠ **THE CAP WAS NEITHER ADJUSTED NOR NEEDED.** It held at `2` on every run across all six plans of
   the phase, and nothing red ever appeared — so SEED-171's triage procedure was never entered.
   **Recorded as an observation, not as proof of innocence:** two of SEED-171's five named flaky suites
   (`library/WorkflowCard.test.tsx`, `WorkflowsPage.test.tsx`) sat inside this phase's blast radius and
   were EDITED by it, and both were green on the first run of every invocation.

   ---

   ### ⚠ CORRECTION 2026-08-28 (Phase 214, plan `214-15`) — THE FIFTH ROT, AND IT TOOK NINE DAYS. Every prior set of figures is preserved above, never overwritten.

   Re-derived on the phase's merge base — quiet tree, **no sibling agent**, run from the **repo root**,
   verdict line read **verbatim** rather than summarised:

   ```
     total                                      5266    6355   +1089
     total 6355  ·  failed 0  ·  pinned total 5266
   count gate OK — 120/120 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction of 2026-08-19 said | **measured 2026-08-28** |
   |---|---|---|
   | grand total | 4594 | **6355** |
   | pinned total | 4328 | **5266** |
   | pinned files | 92/92 | **120/120** |

   ⚠ **READ THE DATES: `4594` was 2026-08-19 and this is 2026-08-28 — NINE DAYS, and `+1761` cases.**
   The four rots before this took one, two, two and two days; **the rate has not slowed, and the gap
   here is a gap in RE-DERIVATION, not in growth.** That is the point of publishing a trajectory rather
   than a number: **a plan that reads a bigger figure than this paragraph quotes has read the correct
   current one.** Re-derive rather than doubt it, always from the repo root.

   ⚠ **`+1089` OF THE GAP IS UNPINNED SUITES, NOT NEW CASES** — the grand total exceeds the pinned total
   by exactly the suites nobody has adopted. Phase 214's close pinned **twelve** of them from the gate's
   own printed `— N new` figures; **six more remain unpinned and are named in `SEED-222` rather than
   left silent.** ⚠ **`WorkflowScheduleModal.test.tsx` was believed to be in NEITHER knob and that was
   MEASURED FALSE at this close**: the `src/components/workflows` **directory** entry recurses into
   `__tests__/`, so the gate had been RUNNING it and GUARDING nothing. **TARGETS decides what runs;
   BASELINE decides what is guarded, and a suite can sit on the wrong side of exactly one of them.**

   ---

   ### ⚠ CORRECTION 2026-09-07 (Phase 238) — THE SIXTH ROT, AND IT TOOK TEN DAYS. Every prior set of figures is preserved above, never overwritten.

   Re-derived on a quiet tree with no sibling agent, from the **repo root**, verdict line read
   **verbatim**, before the phase's first edit:

   ```
     total 7816  ·  failed 0  ·  pinned total 7020
   count gate OK — 241/241 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction of 2026-08-28 said | **measured 2026-09-07** |
   |---|---|---|
   | grand total | 6355 | **7816** |
   | pinned total | 5266 | **7020** |
   | pinned files | 120/120 | **241/241** |

   ⚠ **The pinned-file count DOUBLED — `120` → `241` — and that is the most useful number here.**
   The five earlier rots were mostly new cases inside already-pinned files; this one is mostly
   **adoption**, which is the desirable direction and must not be read as drift. Phase 238's own
   close re-measured `7822 · 0 failed · 7026 · 242/242` — `+6`, exactly the one suite it added.

   **A growing number is still the gate WORKING.** Its contract is *no per-file DECREASE* and
   *zero failing*, never a fixed grand total. Re-derive rather than doubt it:
   `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the repo root.

   ⚠ **THE CAP WAS NEITHER ADJUSTED NOR NEEDED, for the third consecutive close** — `2`,
   `failed 0` on both invocations. ⚠ And a standing red that is NOT a cap problem and NOT this
   phase's: **`src/components/sources/sourceComposition.test.tsx` sits at ~~`16 failed | 33 passed`~~
   **`18 failed | 31 passed`** (re-measured 2026-09-08; the original is struck through, not
   deleted — a standing-red figure that ROTS is how an inherited red gets mistaken for a new one)
   in NEITHER knob, by a Phase 235 decision** — pinning a red suite turns the shared gate red,
   and pinning it with an allowance makes a gate that cannot fail. It is invisible to the verdict
   line above, which is exactly why it is named here.

   ---

   ⚠ **THE CAP WAS NEITHER ADJUSTED NOR NEEDED, for the second consecutive close.** It held at `2`,
   `failed 0` on every invocation, and **none of SEED-171's five cap-independent flaky suites went red
   — although three of them (`WorkflowsPage.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`,
   `WorkflowRunPage.test.tsx`) sat inside this phase's blast radius and were EDITED by it.** Recorded as
   an observation, never as proof of innocence: **one green sample of a flaky suite proves nothing.**

   ---

   **(b) ⚠ THE CAUSAL CLAIM ABOVE IS REFUTED, AND THIS IS THE CORRECTION THAT MATTERS —
   ADJUSTING THE CAP IS MEASURED NOT TO FIX THESE FAILURES.** The paragraphs above attribute every
   `STACK_TRACE_ERROR` to worker oversubscription and present the cap as the remedy. **Across ~15 gate
   runs in Phase 195 that model did not hold.** Full evidence: **`.planning/seeds/SEED-171-workflows-library-suites-flake-independent-of-cap.md`.**

   - **Cap 1 and cap 2 each produced clean runs AND red runs on byte-identical trees.** Plan `195-02`
     measured 8 runs and concluded cap 1 was clean; **that conclusion was luck** — two cap-1 runs at
     the wave close were red.
   - **One suite flakes in ISOLATION, with nothing else on the box.** Oversubscription cannot explain
     a single suite failing alone.
   - **The failing SET is never the same twice, so there is no number to pin** and no per-file
     baseline can absorb it.
   - ⚠ **NOT EVERY FAILURE IS A TIMEOUT.** One was a plain `AssertionError: expected 1 to be +0`,
     which breaks the "slow suite near a timeout boundary" hypothesis outright. **The
     `STACK_TRACE_ERROR` signature is therefore NOT a reliable tell for "not a real defect"** — that
     inference appears above and should not be relied on alone.
   - **THREE suites are involved**, and they are named so a red run can be triaged in one step:
     `src/pages/WorkflowsPage.test.tsx` · `src/components/workflows/library/WorkflowCard.test.tsx` ·
     `src/pages/WorkflowBuilderPage.session.test.tsx`.
     ⚠ **CORRECTED 2026-08-18 (Phase 196) — THE SET IS FIVE, NOT THREE, and the original three are kept
     above rather than overwritten.** SEED-171 gained a fourth at Phase 195's close
     (`src/pages/WorkflowRunPage.test.tsx`) and a **fifth** at `196-05`:
     **`src/pages/WorkflowBuilderPage.canvas.test.tsx`**, which failed a suite's own POSITIVE CONTROL with
     `AssertionError: expected 0 to be greater than 0` on a tree where the plan's whole diff was four
     newly-CREATED leaf files. ⚠ **THREE of the five now fail with `AssertionError`, not
     `STACK_TRACE_ERROR`** — so the signature above is confirmed NOT to be a reliable tell for *"not a real
     defect"*, on two independent data points rather than one.
     ⚠ **AND RED DOES NOT ALWAYS MEAN FLAKE.** `196-08` hit **`failed 249`** and every one was REAL: nine
     `WorkflowBuilderPage`-mounting suites threw at mount because their `@/lib/api` mock factories did not
     declare a newly-added export. **What separated the two cases was the PROCEDURE, not the colour** —
     filenames from the gate's own persisted JSON before any re-run, each checked against
     `git diff --numstat`, cap untouched.

   **⚠ KEEP THE CAP RULE — `GSD_VITEST_MAX_WORKERS=2` STANDS.** A cap still matters for two concurrent
   agents, and nothing here refutes that. **What is corrected is what the cap CLAIMS TO FIX.** So:

   > **If a gate run reds, do NOT reach for the cap.** Capture the failing filenames from the gate's
   > **own persisted JSON report** *before* re-running anything, check the named file against
   > `git diff --numstat <your base> HEAD` and `git status --short`, and if it is **byte-unchanged and
   > one of SEED-171's three**, record it as an observation and move on. ⚠ **One green sample of a
   > flaky suite is NOT proof of innocence** — say "provably unmodified", never "fine".

   ⚠ **THE FRONTEND TYPECHECK GATE IS VACUOUS AS USUALLY RUN — measured 2026-09-08 (Phase 239-08).**
`frontend/tsconfig.json` is `{"files": [], "references": [...]}`, a solution-style config, so
**`npx tsc --noEmit` type-checks ZERO files and exits 0 no matter what is broken.** It was quoted as
evidence repeatedly across Phase 239 and proved nothing; it reported green over a change carrying
**24 real `TS6133` errors**. ⛔ **Use `npx tsc -p tsconfig.app.json --noEmit`**, and measure a
**set diff** — the app config reports **67 errors at base**, so "zero errors" is not a reachable
criterion here and a plan that writes one has written a criterion that cannot pass.
⚠ This project already knew: the v3.3 close recorded *"`tsc -b` != `--noEmit`"*. **A fact in a
register nobody re-reads is the same as no fact** — which is this file's own recurring finding, now
paid for a second time.

⚠ **A CONSEQUENCE FOR PLANNING, not just for triage:** `count gate OK` is **not reliably reachable
   on demand**, so a plan whose acceptance criterion is *"the gate is green"* has written a criterion
   that can fail for reasons no plan controls. Pair it with the per-file deltas and the explicitly-run
   in-scope suites, which are deterministic.

3. **NEVER `rm -rf` a bootstrapped worktree, and never let git do it either.** A recursive delete
   FOLLOWS a junction and destroys the operator's real 1.7 GB `venv` — silently. `git worktree
   remove --force` does not fall into that trap but fails outright (`Invalid argument`) and leaves
   the directory behind. Always tear down with:
   ```bash
   bash scripts/teardown-worktree.sh <path>       # or --all-agents
   ```
   It detaches each junction as a reparse point first (`Directory.Delete(p, $false)` — the
   non-recursive flag is load-bearing), then removes, then **asserts the source venv and
   node_modules are still intact**.

4. **Serialize any plan whose tests MUTATE the local database.** Worktrees isolate files, not
   Postgres. Two plans writing the same local Supabase concurrently will interfere, and no
   `files_modified` check can see it. Read-only/stubbed suites are safe — two concurrent full
   `backend/tests/unit` runs were measured identical to serial (62 failed / 1986 passed on both).

### Measured constraints worth not rediscovering

- **Windows `MAX_PATH` binds.** `LongPathsEnabled` is **0** at the OS level here and
  `core.longpaths` is unset, so the ceiling is 260 chars. The longest tracked path in this repo is
  **138**, so a worktree root must stay under ~120 chars. Claude Code places worktrees at
  `<repo>/.claude/worktrees/agent-<id>` = **66 chars** → 204/260, **56 chars of headroom**: fine.
  A worktree under the scratchpad (123 chars) **fails** — `git worktree add` checks the files out,
  then dies with *"Could not reset index file to revision 'HEAD'"* and rolls the whole thing back.
  If a future base path is long, raising the OS registry flag needs admin **and a reboot** — an
  operator action, never a silent one.
- `.claude/worktrees/` is gitignored, so worktrees do not pollute `git status`.
- Junctions need **no elevation**; create them with PowerShell `New-Item -ItemType Junction`.
  `cmd //c mklink /J` has its `/J` switch mangled by MSYS path conversion under Git Bash.
- Dispatch worktree agents **one message at a time** (`run_in_background: true`), never several
  `Agent()` calls in one message — simultaneous `git worktree add` races on `.git/config.lock`.

## Supabase MCP — reads are free, WRITES ARE APPROVAL-GATED (MANDATORY)

`.mcp.json` configures the Supabase MCP against the **production** project. ⚠ **As of 2026-09-11 it
is NO LONGER pinned `read_only=true`** — the flag was removed to apply migration 177, and the
operator chose to govern access **by this rule rather than by the flag**.

- **READS need no approval and should be used freely.** ⭐ They are the cheapest production evidence
  this project has. `execute_sql` (SELECT), `get_advisors`, `list_*`, `query_logs`. Any claim of the
  form *"we cannot see cloud"* is now false — check before writing it down.
- ⛔ **EVERY WRITE NEEDS EXPLICIT PER-ACTION OPERATOR APPROVAL.** DDL, DML, `apply_migration`, a
  settings change — state exactly what will run, wait for a clear yes, then run it. **Approval for
  one write is never approval for the next.** This is the same standing rule as a production push.
- ⚠ **A rule is weaker than the flag it replaced, and that is the accepted trade.** `read_only=true`
  could not be forgotten; this can. **Restoring the flag is always the safer default** once a
  write-needing task is done — propose it rather than leaving standing write access open.

⭐ **What the read path found the day it was first used (BUG-260911-01):** `app_settings` and
`user_settings` had RLS **disabled** in production with `anon` holding all privileges, and
`resize_embedding_column` — which deletes every vector — was callable unauthenticated. **Every gate
in this project stayed green**, because every gate reads through the **service role** and *nothing in
the suite ever makes a request as `anon`*. Same blind spot migration 156 recorded on
`connector_connections`; third time this class has fired. ⛔ **Run
`get_advisors(security)` as part of the deploy parity checklist.**

⚠ **AND THE POSTGRES TRAP THAT MAKES A NAIVE FIX A NO-OP:** functions are granted `EXECUTE` to
**`PUBLIC`** by default, so `REVOKE … FROM anon` changes nothing while the PUBLIC grant stands —
measured, when 177's first version applied cleanly and verify still read `FAIL`. **Revoke from
`PUBLIC`, then grant back the roles that genuinely need it.** The 13 SECURITY DEFINER functions still
flagged by the advisor are all in this state; a role-by-role sweep of them would silently achieve
nothing.

## Deployment (cloud) — operator-gated

Live deploys are **always operator-triggered**. The branch + promotion model and the local↔cloud parity rules live in `docs/DEPLOYMENT-WORKFLOW.md`; recurring failure modes + their fixes live in `docs/DEPLOYMENT-LESSONS.md` (read both before any cloud-touching work). Architecture/accounts: `docs/DEPLOYMENT-PIPELINE.md`.

- **Branches:** `develop` (dev trunk — commit freely here) → `master` (staging / release-candidate) → `production` (LIVE — Vercel frontend + Coolify backend both auto-build from it).
- **NEVER push to `master` or `production` without an explicit operator "deploy" instruction.** When work is ready, *propose* the deploy and wait for a clear yes. Committing to `develop` during normal work is fine; promoting to a deploy branch is not, until asked.
- **Promote surgically** (see workflow doc): fast-forward `git push origin <sha>:production` when the fix's parent == production tip, else a throwaway-worktree cherry-pick — never drag unfinished `develop` work into live, never develop directly on `master`/`production`.
- **Code deploying ≠ cloud configured.** Every cloud-touching change has a non-code half — env vars (Coolify/Vercel), migrations (paste into cloud Supabase SQL editor), seed/settings rows (`app_settings`), provider keys/models. Apply the parity checklist in the workflow doc; cloud config drifts from local and is the #1 gotcha.
- **The local setup must never break** — local vs cloud is a pure env-var switch; no hardcoded URLs/paths/keys/models/ports.
- **Deployment-artifact parity (same-commit rule).** Any change to an env var the app reads, a seed-bearing migration, a bundled service, or the sandbox image tag MUST update the Phase-157 artifacts (`deploy/onebox.env.example`, `docs/OPERATOR.md` Step-3 seed list, `docker-compose.prod.yml`, and the `SANDBOX_IMAGE` tag) **in the same commit**. `scripts/check-deploy-drift.sh` enforces this in CI (the `deploy-artifacts` workflow); a new intentionally-omitted var is registered in the script's `OMITTED_FROM_ONEBOX` list, never left to drift silently. (Phase 158 / D-16 — the deploy-artifact analog of the `Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md` same-commit sync rule above.)

## Planning workflow
Planning is managed by **GSD** under `.planning/`, not ad-hoc plan files.

- `.planning/PROJECT.md` — current milestone, validated requirements, key decisions, constraints
- `.planning/MILESTONES.md` — shipped milestone history
- `.planning/ROADMAP.md` — phases for the active milestone
- `.planning/STATE.md` — current phase, position, next action
- `.planning/<NNN>-<phase-name>/` — one folder per phase with PLAN.md, RESEARCH.md, VERIFICATION.md, etc.

For new work use the GSD slash commands (`/gsd:discuss-phase`, `/gsd:plan-phase`,
`/gsd:execute-phase`, `/gsd:verify-work`) rather than writing free-form plan
files. Run `/gsd:progress` to see where things stand.

The legacy `.agent/plans/` folder and `PROGRESS.md` module tracker are historical
artifacts from the masterclass build (Modules 1–8, shipped as v1.0 base) — do not
add new content there.

## Reported bugs cross-check (MANDATORY)

User-observed bugs from manual testing live in `.planning/reported-bugs/`. Each report has structured frontmatter (`surface`, `severity`, `status`, `affected_areas`, `folded_into`, `re_open_trigger`). Use `.planning/reported-bugs/TEMPLATE.md` when creating new reports.

**Cross-check these reports at four GSD touchpoints:**

| Touchpoint | What to do |
|---|---|
| `/gsd:discuss-phase NNN` | After loading prior CONTEXT, list `.planning/reported-bugs/*.md` with `status: open` AND `surface: Agentic-RAG`. For each, check whether `affected_areas` overlaps the phase's domain. Surface relevant ones to the user as: fold into this phase / defer to a named future phase / leave open. Update each report's frontmatter (`status` + `folded_into` or `re_open_trigger`) to reflect the routing. Capture folded ones in CONTEXT.md `<decisions>`; deferred ones in `<deferred>`. |
| `/gsd:plan-phase NNN` | Verify every report with `folded_into: NNN` is actually addressed by at least one plan task. If a folded report isn't covered, either add a task or revert its status. |
| `/gsd:new-milestone` | Sweep all open `surface: Agentic-RAG` reports; surface unaddressed bugs as candidate REQ-IDs for the new milestone, or plant as SEED-NNN with concrete `re_open_trigger`. |
| `/gsd:complete-milestone` | Audit open reports whose `folded_into` matches a phase shipped in the closing milestone — flip status to `closed` only if the bug no longer reproduces. Reports still observable roll forward (status stays `open`, with a note in the milestone retrospective). |

**Filter rule:** ONLY `surface: Agentic-RAG` reports are routing candidates. External reports (`Claude.ai`, `Anthropic-API`, `OpenAI`, `OpenRouter`, `Other`) are observability/feedback notes — never auto-folded into app phases; mention them at touchpoints only if the user explicitly asks.

**Status lifecycle:** `open` → `folded` (when a phase claims it) → `closed` (when the shipped phase verifiably closes it). Reports can also be `deferred` (with `re_open_trigger`) or `external-noted` (won't ever fold).

## Seeds register cross-check (MANDATORY)

⚠ **MEASURED 2026-08-19: the seeds register is swept by NOTHING, and neither are the carry-forward files.** `.planning/seeds/` holds **188** deferred ideas, each with a `trigger_when` written precisely so it could be revived at the right moment — and `grep -rln "SEED" .claude/commands/gsd/` returns **`capture.md` only**, the command that *writes* seeds. `/gsd:new-milestone` greps for neither `SEED` nor `carry.?forward`. So `.planning/v3.6-STRETCH-CARRYFORWARD.md`'s own claim — *"At `/gsd:new-milestone` the STRETCH sweep surfaces this file"* — **is backed by nothing executable.** This is the `reported-bugs` failure mode one register over: a `trigger_when` nobody reads is a deferral with no re-open, which is a deletion that looks like a decision.

**Sweep the register at two touchpoints, the same way reported-bugs are swept:**

| Touchpoint | What to do |
|---|---|
| `/gsd:new-milestone` | List `.planning/seeds/*.md` with `status: planted` (or `dormant`) AND `surface: Agentic-RAG`. Read each `trigger_when`; surface the ones whose trigger is ALREADY TRUE or fires within the proposed milestone as candidate REQ-IDs. Seeds explicitly gated on another seed must be sequenced, never listed flat. |
| `/gsd:discuss-phase NNN` | Grep the register for seeds whose `relates_to` names a file in the phase's blast radius or whose `trigger_when` names this phase's surface. Fold / defer / leave — and write the routing back into the seed's frontmatter, exactly as reported-bugs require. |

**A seed is answered by editing the seed.** Flip `status` and record where it went; a seed that shipped but still reads `planted` will be re-proposed forever, and one that was consciously rejected must say so rather than staying silent. ⚠ **`status:` frontmatter IS the index — prose inside the body saying "still open" is invisible to the scan.**

## UAT scoreboard recipe (MANDATORY)

Phase 075.4 Plan 05 (D-075.4-H1 Wave 0) — closes the assumption-driven-UAT gap that cost insert-phases 067.5, 075.1, 075.2, 075.3, 075.4. ROADMAP SC#10 verbatim:

> Any phase touching streaming, agent loop, provider routing, or UI state MUST include UAT rows for cross-provider × multi-tool × parallel-thread × long-message scenarios.

**The 4-axis bandwidth:**

| Axis | Required coverage |
|------|-------------------|
| Cross-provider | **The FULL native roster + OpenRouter — 8 rows, not 4.** See the roster rule below. |
| Multi-tool | At least 1 row exercising 2+ tools in one prompt (e.g., `search_documents` + `execute_code`) |
| Parallel-thread | At least 1 row with Thread A streaming while Thread B accepts a new prompt |
| Long-message | At least 1 row with ≥ 50 prior messages OR a ≥ 5 KB user prompt |

**The cross-provider roster rule (amended 2026-07-31 — operator, during Phase 185 UAT).** This table
previously said *"OpenAI, Anthropic, Google, OpenRouter (4 providers)"*, and that under-specification
is why every scoreboard in this project has silently skipped half the product. The app ships **seven
native providers** plus OpenRouter; testing four and calling it "cross-provider" tests the four we
happen to think of first. The operator's standing direction is the **full native roster** — so the
required set is:

| | Provider | Note |
|---|---|---|
| 1 | OpenAI | |
| 2 | Anthropic | native SDK |
| 3 | Google | historically the highest-risk row for tool-call emission |
| 4 | DeepSeek | `strict_json_schema` is **inert** (DEMOTED — no `/beta` base_url, D-122-04) |
| 5 | Zhipu / GLM | |
| 6 | MiniMax | |
| 7 | Moonshot / Kimi | **the only `emit_tier: coerce` native rows** — the weakest emission guarantee in the registry |
| 8 | OpenRouter | every OpenRouter row is `native_tools: False` — it is the non-native tool path, not a fifth flavour of the native one |

**Derive the roster, never re-type it.** `MODEL_CAPABILITIES` is the source of truth — group by
`provider` and take one representative per group, rather than transcribing the list above (which will
rot the moment a provider is added). Prefer the **newest** model per provider, and prefer a
**registry-backed** id: an id absent from `MODEL_CAPABILITIES` resolves `capability_source=inferred`
and silently loses `emit_tier`, so the row would measure a weaker configuration than the one that
ships (see SEED-040 §2026-07-31, and SEED-135).

**Rows may be blocked, but never silently omitted.** A provider with no key configured, or one blocked
by a known defect, is recorded as ⛔ with the reason and the blocking issue id — never dropped from the
table. A scoreboard that lists only what passed is not a scoreboard.

**Cheapest honest method** (proven in Phase 185): drive each row as a real run with a **per-request**
`model` + `provider` on `POST /threads/{id}/messages`, and read verdicts from `workflow_runs` /
`workflow_phases` / `harness_audit`. That scores the whole board **without mutating any global
setting**, so the operator's environment is untouched and rows cannot contaminate each other.

UAT rows MUST be authored under VALIDATION.md, NOT in PLAN.md tasks. Phase verification only passes when all 4 axes are exercised — Plan 05 E2E backstop covers 1-3 automated; long-message stays manual per provider.

## Workflow guardrails (MANDATORY)

These rules exist because the v2.6 075.x cascade (8 phases on the same streaming/UI surface) showed that structural UAT misses lived-experience defects, and the full discuss→plan→execute ceremony is overkill for small work. At every phase-touching conversation, the orchestrator MUST apply these BEFORE proposing the next command.

| Rule | Trigger | Action |
|---|---|---|
| **G-1 Phase chain cap** | About to insert `<base>.N` where ≥ 2 prior `<base>.x` phases already exist on the same hot file(s) | Propose a refactor phase on those file(s) FIRST. Block another feature insert until refactor ships. |
| **G-2 Sketch before plan for UX** | Phase scope mentions live UI, panel render, badge, label, animation, "feels like", visual, or gold-standard comparison | Propose `/gsd:sketch` BEFORE `/gsd:spec-phase` or `/gsd:discuss-phase`. Operator-approved mockup is the acceptance bar. |
| **G-3 Lightweight commands for small work** | Task scope ≤ 1 file, ≤ 10 lines of source change, no schema/API surface | Propose `/gsd:fast` (inline, no agents) or `/gsd:quick` (commit + state, skip optional agents). NEVER full discuss→plan→execute for 5-line fixes. |
| **G-4 Lived-experience UAT gate** | Phase touches user-visible UI | Operator-defined "I'd recognize failure here" scenarios at scope-time (not post-hoc). Chrome MCP drives all 3 at phase verification — wire format + screenshot are insufficient. |
| **G-5 Refactor between feature waves** | ≥ 3 prior phases on the same hot file (see ledger below) | Insert a dedicated refactor phase BEFORE the next feature phase on that file. Audit during discuss-phase. ⭐ **ENFORCED, not asked:** `node scripts/check-hot-file-ledger.cjs <phase>` fails when a phase's `files_modified` names a source file with **no ledger row** — and `.claude/hooks/hot-file-ledger-guard.js` runs it in the turn a PLAN.md is written. ⚠ The old mechanism (read a 214-row table) was measured to fail with the table present: `App.tsx` **23 phases**, `NavPanel.tsx` **11**, `config.py` its ENTIRE life. |
| **G-6 Failure criteria upfront** | Writing SPEC.md or scoping a phase | Include `## How we'd know this failed` section with concrete observable conditions. If failure modes can't be enumerated, scope is not ready to plan. |
| **G-7 Gap-closure round cap** | Verification returns `gaps_found` on a phase that has already run **2** gap-closure rounds | Do NOT route to `/gsd:plan-phase --gaps`. Triage every remaining finding as **fast-fix / defer-to-next-phase / accept** — unless a ROADMAP **success criterion** is actually unmet, which is the only thing that justifies a further round. A closure round may NEVER introduce a new user-facing capability: that is a phase, not a gap. |
| **G-8 Plan-count proportion** | Planning a phase, or about to emit more than **5** PLAN.md files | A plan is a **wave-sized unit of work, not a task** — two plans in one wave touching adjacent files are ONE plan with two tasks. Target **3-5**; above 6, justify it in CONTEXT.md by naming what genuinely cannot share a worktree. ⚠ Overhead is PER PLAN (worktree + bootstrap + SUMMARY + merge + teardown) and dwarfs every agent toggle. ⛔ NEVER cut to save time: the **verifier**, **TDD RED drives**, **security_enforcement**/**code_review**, migration discipline. ⭐ The lever is NOT the agent roster: executors running FULL gates cost ~3.5 h — run TARGETED suites per task, FULL gates once per WAVE. Evidence: [`docs/PLANNING-PROPORTION.md`](docs/PLANNING-PROPORTION.md). |

**G-7 in detail (ratified 2026-08-04 — operator, at Phase 187 close).**

Phase 187 went from **15 plans on 2026-08-02 to 29 on 2026-08-04** across five gap-closure rounds. The tell at round 5: **both** remaining gaps lived in code round 5 had authored that same day (`DescribeKbPicker.tsx` created `f5a28e7e`; the count-gate pin block edited `51c44f37`) — a round 6 would have been 100% cleanup of round 5, while every ROADMAP success criterion was already verified. G-1 caps repeated phase INSERTS on a hot file; nothing capped repeated ROUNDS on a phase. This is that cap.

Three structural mechanisms drive the runaway — none is anyone's mistake, which is why a rule is needed rather than more care:

1. **The gate manufactures findings.** Every `execute-phase` ends with a standard-depth code review of code written that morning; such a review essentially always returns something → a must_have scores failed → `gaps_found` → straight back into `plan-phase --gaps`. Nothing in the loop asks *"is the phase GOAL met?"* as the terminating question — must_have bookkeeping outvotes it.
2. **Each round adds must_haves, which are themselves new failure surface.** Phase 187's plan `187-29` existed ONLY to pin round 5's guards; its own headline must_have then failed. A pure-bookkeeping plan manufactured a gap.
3. **Closure rounds smuggle in features.** "The loose door has no KB picker" is a MISSING CAPABILITY, not a defect in shipped code. Building it inside a closure round is both how 15 became 29 and why that round shipped a blocker — new surface, zero prior review cycles.

**The mechanical check (run it — do not eyeball the round count):**

```bash
node scripts/check-gap-closure-rounds.cjs <phase>
```

Exit `0` = G-7 clear · `1` = G-7 fires · `2` = harness error. It derives the round count from the repository itself — `gap_closure_round:` frontmatter where present, falling back to the number of distinct commits that ADDED gap-closure plan files (that fallback is load-bearing: Phase 186's twelve gap plans carry no round field at all, and it still reads 3 correctly) — and prints the derivation so the number is auditable rather than asserted. It also fails `[new-capability-in-closure]` when a gap-closure plan's `files_modified` contains a non-test source file that did not exist when that plan was written; run against Phase 187 it names `DescribeKbPicker.tsx` unprompted, which is precisely the file that shipped CR-R5-01.

Both failures have a WORDED escape hatch, never a boolean — `--unmet-criterion "SC#N: <what is not true>"` and `--capability-approved "<why this belongs here>"`. An override prints `G-7 passed WITH OVERRIDES` rather than `clear`, so a waved-through finding can never read as an absent one, and it must still be recorded under `STATE.md → Guardrail overrides` per the protocol below.

**Run it at three points:** when `verify-work`/`execute-phase` returns `gaps_found`; before emitting any `--gaps` routing; and at the top of `/gsd:plan-phase {X} --gaps`.

**Before emitting ANY `/gsd:plan-phase {X} --gaps` routing, the orchestrator MUST:**

- **Report success-criteria status first.** If every ROADMAP success criterion is verified, say so plainly and present *stopping* as a real option — never route to the next round as though it were the only door.
- **Date the offending code** (`git log --diff-filter=A -- <file>`). Gaps in the current round's own output are a signal to STOP, not to iterate.
- **Size each fix.** ≤ 1 file / ≤ 10 lines with no schema or API surface is `/gsd:fast` under G-3 — never a round.

**Closing a phase with owed manual UAT rows is legitimate**, and is often the right call — but state it as a DECISION, never as a claim that everything ran. Record the owed rows in the ROADMAP progress row and `STATE.md`, and name which row to run first.

**Orchestrator protocol when a guardrail fires:**

1. Surface the violation BEFORE running the requested command — name the rule, name the proposed alternative
2. If user overrides ("proceed anyway"), proceed but record the override under `STATE.md → Recent Completed Phases → Guardrail overrides` so it's auditable
3. Never silently apply OR silently skip — every fire is either honored or audited

⚠ **G-8 was ratified 2026-09-06 at Phase 235's stop, by the operator, on measured evidence.** That phase ran **17 plans for ~4-6 plans of substance**. `.planning/config.json` now carries the enforcement (`nyquist_validation`/`post_planning_gaps` **off** — ⚠ `pattern_mapper`/`plan_check` were cut too and **RESTORED the same day**: measured, they are **~3% of a run** and the executors are **80%**; `tdd_mode` **on**, `security_enforcement` **explicit**, `inline_plan_threshold: 4`); `docs/PLANNING-PROPORTION.md` carries the reason and the per-agent catch-rate table. ⚠ **`feedback_efficiency_calibration.md` already said this and was not applied** — a rule that exists and is not applied is the same as no rule. ⭐ And the finding that outlived the config change: **a green fence coexisted with the shipped defect**, because it asserted block PRESENCE by `data-testid` while the content drifted — **presence assertions cannot see content drift; assert the rendered CONTENT where the words are the deliverable.**

**Hot-file ledger (update as phases ship).** Each row's narrative — the measured reasons, the corrections recorded beside their originals, the RED-driven plants, the invariants each file carries and the named seam the next refactor should take — lives in **`docs/HOT-FILE-LEDGER.md`**, one section per file. **This table is the AUDIT SCAN LIST and is deliberately complete:** every hot file appears here with its measured triple and its verdict, because a hot file missing from this table is permanently invisible to its own guardrail. ⚠ **A ROW CARRIES ITS VERDICT AND NOTHING ELSE — enforced, not merely asked:** the disposition cell is capped at 200 chars by `scripts/check-claude-md-size.cjs`, because this column reaching **60,558 chars (45% of this file)** is what forced the 2026-08-25 split. **Every reason, invariant, correction and named seam belongs in the detail file** — which is where the 115 cells that used to sit here now are, verbatim. ⚠ **SAME-COMMIT SYNC RULE** (the `docs/SANDBOX-PACKAGES.md` pattern): a row here and its section there are updated in the **same commit**; a row without a section, or a section without a row, is drift.

**Triples are `commits / phases / lines`, RE-DERIVED FROM GIT ON 2026-08-17** — not copied forward, because this ledger's own repeated finding is that a figure written at a phase's close goes stale on the next commit that touches the file, sometimes the same afternoon. Re-derive with:

```bash
git log --oneline -- <file> | wc -l                                    # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l  # phases
wc -l <file>                                                           # lines
```

⚠ **Six-digit buckets (`260814`, `260809`, `260529`) are DATED QUICK TASKS, not phases — subtract them.** The recipe prints them and only the phase count feeds G-5. Non-numeric buckets (`quick`, `chat`, `streaming`, untagged subjects) are likewise not phases.

**The full 214-row scan list now lives in [`docs/HOT-FILE-LEDGER.md`](docs/HOT-FILE-LEDGER.md) — §"Scan list" — and it is ENFORCED BY A GATE rather than by an agent reading a long table.**

```bash
node scripts/check-hot-file-ledger.cjs <phase-dir>   # 0 clear · 1 missing rows · 2 harness error
```

⚠ **THE TABLE MOVED BECAUSE THE OLD MECHANISM WAS MEASURED TO FAIL.** It sat in this file, complete, for every agent to read — and `App.tsx` still had **no row for 23 phases**, `NavPanel.tsx` for 11, `config.py` for the project's entire life. **A 214-row table nobody reads end-to-end is not a scan list; it is a hope.** The gate above cannot not-notice: it fails when a phase's `files_modified` names a non-test source file with no ledger row. That is strictly stronger than the completeness rule it replaces, and it is why moving the table does not weaken G-5.

**G-5-FIRING files (113 of 224) — the rows a phase is most likely to collide with.** Verdicts abbreviated; the full cell, the narrative, the named seam and the binding invariants are in the detail file, which is where a phase must read before planning.

| Hot file (FIRING) | commits / phases / lines | Verdict (abridged) |
|---|---|---|
| `frontend/src/components/chat/ToolCallPanel.tsx` | 51 / 23 / 351 | ✅ **G-5 DISCHARGED (227-02)** |
| `frontend/src/components/chat/MessageItem.tsx` | 75 / 34 / 1004 | ⚠ row STALE a 5th time (`75/34/1000`). honoured by construction (**BUG-260912-01**): ONE prop added to the EXISTING fold mount — no new branch, the call site still decides nothing |
| `backend/app/api/threads.py` | 245 / 82 / 1617 | ⚠ row was STALE at `243 / 80 / 1590`. honoured by construction (**244-03**): one pure-read query loses a WHERE predicate, gains a Python guard. ⛔ no writer added |
| `frontend/src/providers/StreamsProvider.tsx` | 102 / 37 / 4880 | ⚠ row STALE again (`102/37/4847`). honoured by construction (**BUG-260912-01**): ONE callback, `onTurnBoundary`. ⛔ it FLUSHES before moving, or a turn's tail leaks into the next body |
| `frontend/src/hooks/useMessages.ts` | 74 / 27 / 127 | extraction due |
| `backend/app/services/anthropic_service.py` | 11 / 10 / 354 | adapter-pattern audit due |
| `backend/app/services/embedding_service.py` | 9 / 5 / 354 | ⚠ absent for its entire life at 5 phases — row added 236 (SC#2) |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 31 / 9 / 1708 | honoured by construction (199 / 200 / **214**) |
| `frontend/src/components/workflows/FlowEdge.tsx` | 3 / 3 / 462 | honoured by construction (200) |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | 17 / 8 / 489 | honoured by construction (199) |
| `backend/app/services/harness/phase_types.py` | 51 / 24 / 2925 | extraction TAKEN (200-03) · honoured by construction (211 / 214 / **21 |
| `frontend/src/pages/WorkflowsPage.tsx` | 43 / 17 / 1415 | the 192 / 192.1 extraction is TAKEN |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | 19 / 6 / 1616 | ✅ **G-5 DISCHARGED (192.2-02)** |
| `frontend/src/components/workflows/library/libraryVocabulary.ts` | 10 / 4 / 727 | no seam proposed |
| `frontend/src/components/workflows/library/libraryFilter.ts` | 6 / 4 / 435 | ⚠ absent at 4 phases and NO PLAN NAMED IT (192.2) |
| `frontend/src/components/workflows/library/libraryRow.ts` | 4 / 3 / 201 | ⚠ absent, on the boundary (added 192.2) |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | 18 / 12 / 1075 | honoured by construction (193 / 193.1 / 199 / **214**) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 56 / 21 / 2977 | honoured by construction ×6 (193.1 / 193.2 / 197 / 200.3 / 214 / **214 |
| `backend/app/api/workflows.py` | 41 / 22 / 2254 | ⚠ **extraction still OWED** |
| `backend/app/api/workflow_runs.py` | 11 / 8 / 1003 | honoured by construction (200 / 200.1 / **214**) |
| `backend/app/models/thread.py` | 16 / 10 / 438 | honoured by construction (200.1 / **214**) |
| `frontend/src/components/workflows/canvasModel.ts` | 13 / 6 / 752 | ⚠ absent from BOTH at 6 phases (added 200) |
| `frontend/src/components/layout/ChatLayout.tsx` | 51 / 26 / 1010 | ⚠ row was STALE at `46/24/921`. honoured by construction (**244-04**): ONE prop on an existing mount — a 4th renderer off the SAME one read; the registry is still resolved exactly once |
| `frontend/src/components/layout/ChatHistoryColumn.tsx` | 7 / 2 / 513 | ⚠ absent from BOTH for its ENTIRE LIFE — row added 244-01 at its SECOND phase (the `settingsSearchPayload.ts` precedent); D-244-20 claimed a row existed and the gate refuted it |
| `frontend/src/hooks/useThreads.ts` | 4 / 2 / 64 | ⚠ absent from BOTH for its ENTIRE LIFE — row added 244-01. The app's ONE thread-selection owner; `selectThread` is a bare `setState`, so BUG-260911-02 cannot originate here |
| `backend/app/services/harness/grounding.py` | 21 / 8 / 1414 | honoured by construction (193.1 / 211 / **214**) |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 30 / 14 / 1566 | honoured by construction ×6 (185 / 193 / 193.1 / 199 / 200 / **214**) |
| `backend/app/db/workflows.py` | 48 / 25 / 2585 | honoured by construction (193.2 / 194 / 192.2 / 200.1 / **214**) |
| `backend/app/services/harness/publish_service.py` | 25 / 11 / 1810 | honoured by construction (193.2 / 214 / **BUG-260828-09**) |
| `backend/app/services/workflow_authoring.py` | 15 / 9 / 989 | honoured by construction (193.2 / 197 / 214 / **214.1**) |
| `backend/app/models/harness.py` | 20 / 19 / 766 | honoured by construction (193.2 / **214**) |
| `frontend/src/components/workflows/builderStore.ts` | 14 / 8 / 968 | honoured by construction (193.2 / 197 / **214.1**) |
| `frontend/src/components/panel/WorkspacePanel.tsx` | 16 / 10 / 646 | honoured by construction (194 / 194.1) |
| `backend/app/services/run_lifecycle.py` | 6 / 3 / 459 | honoured by construction (194) |
| `backend/app/api/runs.py` | 35 / 16 / 1430 | honoured by construction (194) |
| `backend/app/services/harness_engine.py` | 54 / 20 / 3135 | honoured by construction (194 / **214**) |
| `frontend/src/components/chat/ThinkingBlock.tsx` | 4 / 1 / 313 | ⚠ absent for its ENTIRE LIFE — row added **BUG-260912-01**. ⛔ the ONE renderer of the model's process prose, now from TWO sources; §10c pins the exact call shape `toParagraphs(reasoningContent)` |
| `frontend/src/components/chat/RunCard.tsx` | 29 / 14 / 723 | ⭐ G-5 DISCHARGED (243-02). ⚠ row STALE at `28/14/710`. **BUG-260912-01**: its state-2 guard asked `!reasoningContent` ALONE and shipped a VISIBLE mid-stream double once the fold gained a 2nd input |
| `frontend/src/components/chat/MessageInput.tsx` | 31 / 15 / 821 | ⭐ **THE OWED SEAM WAS TAKEN (244-06)** — `useComposerAttachments`. It SHRANK `855 → 821` **while gaining the cloud door**; ⛔ the `ComposerChipsRow` half stays OWED |
| `frontend/src/components/chat/ActiveConnectorChips.tsx` | 2 / 2 / 82 | ⚠ absent for its ENTIRE LIFE — row added 244-05 at its SECOND phase. **244**: the row container HOISTED out; bare chips now, `null` on empty (D-244-26) |
| `frontend/src/components/chat/MessageList.tsx` | 23 / 10 / 366 | ⚠ row STALE a FOURTH time (`21/9/307`). **244-12**: its SECOND list-level mount — `PendingAskStack` beside `ThreadRunLine`, both above `bottomRef`. ⛔ unconditional, measured +4 fetches/thread-open |
| `frontend/src/components/chat/ChatArea.tsx` | 75 / 36 / 781 | ⚠ row STALE a THIRD time (`74/36/743`). honoured by construction (**244-13**): the SAME one boolean now tests the lock's MODE — WR-07 closed, no second branch, no new state |
| `frontend/src/stores/streamsStore.ts` | 21 / 13 / 546 | ⚠ row STALE at `20/13/525`, one plan after it was ADDED. honoured by construction (**244-15**): ONE action type + ONE bare no-op stub. ⛔ `void`, never `Promise<void>` — it fires from a click handler |
| `frontend/src/lib/toolMeta.ts` | 10 / 6 / 218 | ⚠ **absent for its ENTIRE LIFE at 6 phases — row added 244-13, which does NOT modify it.** ⛔ the ONE home of the harness activity string; a literal copied elsewhere makes its pin vacuous |
| `frontend/src/components/panel/PendingAskCard.tsx` | 15 / 8 / 836 | ⚠ row was STALE at `14/7/765`; G-5 FIRES at 8 phases. honoured by construction (**244-15**): ONE optional prop, ONE composed callback in the STACK, `useState` 9→9 — no new state on a 3-home shell |
| `frontend/src/pages/WorkflowRunPage.tsx` | 28 / 9 / 1670 | honoured by construction (200 / 200.1 / 200.2 / **214**) |
| `frontend/src/components/chat/OutputFileCard.tsx` | 8 / 7 / 219 | honoured by construction (195) |
| `frontend/src/components/panel/FilesSection.tsx` | 10 / 6 / 363 | ⚠ row was STALE at `8 / 5 / 334`. honoured by construction (**244-05**): TWO `export` keywords, zero body change — the chat chip IMPORTS `expiryCaption`, never re-derives its three readings |
| `frontend/src/lib/api.ts` | 187 / 110 / 422 | ✅ **SPLIT TAKEN (207)** |
| `frontend/src/types/index.ts` | 85 / 66 / 1398 | ⚠ row STALE again (`85/65/1380`). honoured by construction (**BUG-260912-01**): ONE optional client-only field, `narrationContent` — no column, because the loop discards this text by design. seam still OWED |
| `backend/app/main.py` | 82 / 59 / 950 | ⚠ row was STALE by **FOURTEEN PHASES**. honoured by construction (**BUG-260902-06**) |
| `backend/app/config.py` | 83 / 48 / 1572 | ⚠ STALE AGAIN at `83/48/1506` — the TWELFTH. honoured by construction (**mig 180**): `_SELF_HOSTED_PROVIDERS` is a TABLE replacing the `if provider == "ollama"` duplicated in 4 files. `MODEL_CAPABILITIES` seam still OWED |
| `backend/app/api/admin.py` | 33 / 13 / 1740 | ⚠ row was STALE. honoured by construction (**BUG-260902-06**): 2 write seams broadcast; the 2 WR-03 READ seams deliberately do not |
| `backend/app/api/settings.py` | 38 / 20 / 980 | ⚠ row was STALE at `38/20/972`. honoured by construction (**mig 180**): the base_url write arm is now ONE table lookup covering all 3 self-hosted providers. ⛔ no new route, no second branch |
| `backend/app/services/multimodal_service.py` | 14 / 7 / 984 | ⚠ absent from BOTH for its ENTIRE LIFE at **7 phases** |
| `backend/app/api/documents.py` | 85 / 33 / 2437 | ✅ **DISCHARGED (229)** |
| `scripts/vitest-count-gate.cjs` | 212 / 46 / 5649 | ⚠ row STALE a 4th time (`211/46/5618`). **BUG-260912-01** adopted TWO new suites into BOTH knobs — neither `src/components/chat` nor `src/__tests__` has a bare-directory entry |
| `backend/app/services/eval_runner_service.py` | 12 / 7 / 959 | ⚠ absent at 7 phases (added 196) |
| `frontend/src/components/panel/PhaseCard.tsx` | 16 / 10 / 755 | honoured by construction (200 / **214**) |
| `frontend/src/components/panel/PhaseTimeline.tsx` | 9 / 7 / 385 | honoured by construction (**214**) |
| `frontend/src/components/panel/phaseStatusMeta.ts` | 3 / 3 / 236 | ⚠ absent; crossed the threshold in the commit that added its row (200) |
| `backend/app/services/harness/validator_kinds.py` | 12 / 5 / 749 | ⚠ absent at 5 phases (added 196) |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | 10 / 4 / 1191 | ⚠ absent at 4 phases (added 196) |
| `frontend/src/components/workflows/soulData.ts` | 12 / 10 / 499 | honoured by construction (214 / **214.1**); ⚠ absent until 197, at 7 p |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | 17 / 9 / 1289 | honoured by construction (214 / **BUG-260828-09**) |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | 5 / 5 / 473 | honoured by construction (200) |
| `frontend/src/components/workflows/doorVocabulary.ts` | 6 / 4 / 540 | no seam proposed |
| `frontend/src/components/workflows/StepTypePicker.tsx` | 7 / 3 / 522 | honoured by construction (199) |
| `frontend/src/components/workflows/library/RunModal.tsx` | 8 / 5 / 713 | ✅ **deferred extraction DISCHARGED (214-12)** |
| `frontend/src/components/panel/PanelEmpty.tsx` | 4 / 4 / 52 | ⚠ absent at 4 phases |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | 6 / 3 / 673 | honoured by construction (**214**) |
| `frontend/src/components/workflows/RunSpine.tsx` | 5 / 3 / 426 | honoured by construction (**214**) |
| `frontend/src/components/workflows/RunTranscript.tsx` | 7 / 3 / 652 | ⚠ **FIRES on a component with NO MOUNT in the product** |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 25 / 9 / 1635 | ⚠ the row was STALE at `17 / 7 / 1477`. honoured by construction (**22 |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | 28 / 10 / 2477 | ⭐ **NAMED SEAM TAKEN (239-08)** — `SourceToolsCard.tsx` extracted, `2807 → 2477`, a pure move. ⛔ the WIDER `ConnectionShapeFields.tsx` seam stays OWED |
| `frontend/src/lib/api/org.ts` | 11 / 8 / 629 | ⚠ absent for its ENTIRE LIFE at 4 phases; row then STALE at `6 / 4 / 562`. ⚠ **THIRD wire-type drift in this ONE file** (239: `auth_type: "mcp"`) |
| `frontend/src/components/settings/connectionsCopy.ts` | 16 / 9 / 804 | ⚠ row was STALE at `15/8/784`. honoured by construction (**BUG-260912-01**): ONE arm MOVED above the oauth_byo block — `failed` was unreachable for the one shape OAuth breaks |
| `frontend/src/components/settings/connectionFormCopy.ts` | 19 / 8 / 1631 | ⛔ 239-05 named the seam: `configFromDraft`'s arm set. 239-07 RODE it — one serializer both arms call |
| `frontend/src/pages/SettingsPage.tsx` | 47 / 24 / 1814 | ⚠ row was STALE at `47/24/1773`. honoured by construction (**mig 180**): `isOllama` → `meta.selfHosted`; the card gained a 2nd FIELD, not a 2nd branch. tab seam still OWED |
| `frontend/src/pages/settingsSearchPayload.ts` | 1 / 1 / 116 | young (created 242). Row added AT CREATION, not at the third phase — an absent row is invisible to G-5 at any count |
| `frontend/src/components/settings/ModelPillRow.tsx` | 4 / 3 / 141 | ⚠ absent for its entire life |
| `frontend/src/components/workflows/phaseVocabulary.ts` | 16 / 6 / 990 | honoured by construction (206.2) |
| `frontend/src/components/workflows/ConnectionPicker.tsx` | 7 / 5 / 888 | honoured by construction (206.2 / **214**) |
| `frontend/src/components/workflows/ExternalActionSection.tsx` | 8 / 5 / 179 | honoured by construction (206.2 / **214**) |
| `frontend/src/components/workflows/McpToolPicker.tsx` | 5 / 5 / 601 | honoured by construction (211 / **214**) |
| `backend/app/models/connector.py` | 26 / 14 / 835 | ⚠ row STALE for the 2nd close at `25/14/800`, and its own cell repeated the CLAIM that was false. honoured by construction (**244-07**): `folder_id` typed, not branched |
| `backend/app/api/connectors.py` | 44 / 21 / 2140 | ⛔ **extraction OWED, SIXTH landing** (2051→2071→2091→2102→2113→2140). honoured by construction (**BUG-260912-01**): ONE `except` arm above the generic one, no new route, no new helper |
| `backend/app/services/sources/preview_service.py` | 8 / 4 / 826 | ⚠ row STALE TWICE; the 2nd read “238: comment-only” while 238 re-opened SEED-253 here. **238-04: display ≠ stored; the walk no longer mutates `SourceFile.path`** |
| `backend/app/security/secret_cipher.py` | 4 / 2 / 256 | ⚠ absent for its ENTIRE LIFE — row added at **mig 180**, its SECOND phase. ⛔ `SECRET_COLUMNS` is the ONE encrypt-on-write set: a provider key column absent from it is stored PLAINTEXT and nothing says so |
| `backend/app/security/egress.py` | 13 / 5 / 982 | honoured by construction (232): Google Drive read/export pins; docstri |
| `backend/app/services/connector_service.py` | 25 / 9 / 1772 | honoured by construction (**239-06**): the write boundary knows a mapping KEY from a tool name by ALLOW-LIST — an unknown key is still read as a tool name and still refused |
| `backend/app/services/sources/base.py` | 9 / 5 / 336 | ⚠ **absent while FIRING at 5 phases — row added 239-03.** honoured by construction (239): protocol resolution stayed DATA (two dicts), never a branch |
| `backend/app/services/sources/__init__.py` | 5 / 3 / 40 | ⚠ **absent while FIRING — row added 239-03.** The ONE eager-import site: an adapter missing from this list is unregistered, so the list is load-bearing |
| `backend/app/services/mcp_client.py` | 9 / 6 / 526 | ⚠ row STALE TWICE (`4/2/407` reading `no`, then `7/5/480`) — a row present and WRONG stops the audit. **SEED-258: the body cap is DERIVED; no envelope knob exists to disagree** |
| `backend/app/models/message.py` | 17 / 10 / 124 | ⚠ absent from BOTH for its ENTIRE LIFE at **8 phases** |
| `backend/app/models/user_settings.py` | 51 / 32 / 1648 | ⚠ STALE for the FIFTH close running at `50/32/1561`. honoured by construction (**mig 180**): `_build_providers`' ollama-only arm became one table lookup; the failed-write log now NAMES the columns |
| `backend/app/services/harness/reachability.py` | 4 / 4 / 463 | ⚠ absent from BOTH for its ENTIRE LIFE at **4 phases** |
| `backend/app/services/workflow_kickoff.py` | 8 / 6 / 554 | ⚠ absent for its ENTIRE LIFE at **6 phases** |
| `frontend/src/components/workflows/WorkflowScheduleModal.tsx` | 3 / 3 / 601 | ⚠ absent for its entire life; it crossed the threshold in 214-09 on a  |
| `frontend/src/components/workflows/nodePresentation.ts` | 8 / 7 / 221 | ⚠ absent from BOTH for its ENTIRE LIFE at **7 phases** |
| `frontend/src/lib/api/threads.ts` | 9 / 5 / 1715 | ⚠ row was STALE at `7/3/1683`. honoured by construction (**BUG-260912-01**): ONE optional callback + ONE dispatch arm; ⛔ `turn_boundary` carries NO payload — a second copy could disagree with the first |
| `frontend/src/lib/api/connectors.ts` | 17 / 11 / 740 | honoured by construction (**244-06**): `importCloudFile` gains a REQUIRED body declared BESIDE `SourcePreviewRequest` — ⛔ never inline in a component |
| `frontend/src/lib/api/workflows.ts` | 4 / 4 / 1081 | ⚠ absent until 214; the 207 split created it with NO row. **`lib/api.t |
| `frontend/src/lib/connectionMark.tsx` | 7 / 4 / 313 | ✅ **the move IS the seam, and it was TAKEN (214-08)** |
| `frontend/src/components/ingestion/DocumentList.tsx` | 24 / 13 / 294 | ✅ **seam TAKEN (217.1-05)** |
| `frontend/src/pages/LibraryPage.tsx` | 46 / 15 / 970 | ⚠ row STALE a FOURTH time, one plan later. honoured by construction (**244-06**): ONE mount + 3 EXISTING props; the door owns its own connections read, so the page gained no effect |
| `backend/app/services/retrieval_service.py` | 19 / 11 / 456 | ⛔ **extraction still OWED (SEED-224, since 231).** 241 is the SECOND landing, 11 lines; a THIRD must propose the extraction FIRST |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | 9 / 6 / 496 | ⚠ **the row was STALE at `6 / 5 / 405`.** honoured by construction (21 |
| `frontend/src/hooks/useDocuments.ts` | 8 / 3 / 120 | ⚠ absent at 3 phases. Realtime is a hint, not truth |
| `frontend/src/pages/KnowledgeHealthPage.tsx` | 12 / 6 / **DELETED** | **RETIRED (217.1-14)** |
| `backend/app/api/knowledge_health.py` | 11 / 6 / 737 | honoured by construction (**217.1-11**) |
| `backend/app/services/agent_loop.py` | 44 / 21 / 3326 | ⚠ row was STALE at `44/21/3303`. honoured by construction (**BUG-260912-01**): ONE guarded `_emit` beside the reset that already knew. ⛔ emit BEFORE the reset, never after |
| `backend/app/services/tool_dispatcher.py` | 85 / 35 / 5048 | ⚠ row STALE again (`84/35/4966`). honoured by construction (**244-14/WR-03**): `already` is written on SUCCESS or after a CAPPED give-up; the failure is named on EVERY attempt. Traversal fence byte-unchanged |
| `backend/app/api/document_governance.py` | 5 / 3 / 416 | ⚠ absent at 3 phases. ⚠ Its low-confidence cutoff is the ConfidenceChi |
| `frontend/src/components/ingestion/ViewsGroup.tsx` | 5 / 3 / 259 | ⚠ absent for its ENTIRE LIFE at **3 phases** |
| `frontend/src/components/ui/tabs.tsx` | 3 / 3 / 78 | ⚠ absent for its ENTIRE LIFE |
| `frontend/src/components/panel/CsvTablePreview.tsx` | 3 / 3 / 134 | ⚠ absent for its ENTIRE LIFE |
| `frontend/src/components/workflows/verdictModel.ts` | 6 / 3 / 355 | ⚠ absent for its ENTIRE LIFE |
| `frontend/src/components/library/IngestionTab.tsx` | 17 / 6 / 512 | ⚠ row was STALE at `13 / 4 / 456` |
| `frontend/src/components/ingestion/__tests__/IngestionStrip.test.tsx` | 3 / 3 / 516 | ⚠ absent; row added 233, which repaired the INHERITED red `229-03` cau |
| `frontend/src/components/layout/NavPanel.tsx` | 23 / 12 / 381 | ⚠ row STALE at `22/12/370`. **244-14**: WR-05 — the docblock stopped being false about itself (`min-h-0` read 2); IN-01 — `overflow-x-hidden`, since one axis makes the other compute to `auto` |
| `frontend/src/App.tsx` | 32 / 23 / 374 | ⚠ absent for its ENTIRE LIFE at **23 phases**; row then STALE at `31/23/351`. ⭐ **244-04 left it BYTE-UNCHANGED and FENCED it** — `setLibraryTab(` still 2, driven RED against a planted 3rd writer |
| `frontend/src/components/library/LibraryCloudImport.tsx` | 1 / 1 / 194 | young (created 244-06). Row added AT CREATION. The Library's single-file cloud door — ⛔ it renders a REASON in every unavailable state; a silent grey-out is the same failure as a silent root write |
| `frontend/src/components/library/LibraryHeaderBar.tsx` | 2 / 1 / 204 | ⚠ absent for its entire life — row added **244-04** at its SECOND touch. ⛔ the ONE set of tab triggers: a hidden duplicate broke 41 cases; `aria-hidden` on the count is load-bearing |
| `frontend/src/lib/nav-items.ts` | 8 / 6 / 95 | ⚠ absent at 6 phases |
| `backend/app/api/classification_rules.py` | 3 / 3 / 226 | row added 237 at threshold. Validates rule_scope and enforces WATCH_ALLOWED_FIELDS refusal (422) for arrival watch rules. |
| `frontend/src/components/classification/RuleBuilderPanel.tsx` | 4 / 3 / 502 | row added 237 at threshold. Adds scope selector segmented control; filters out-of-scope conditions on scope switch. |
| `backend/app/api/workspace.py` | 13 / 7 / 757 | ⚠ row was STALE at `11/6/654` ONE PLAN later — the fastest rot recorded here. honoured by construction (**244-06**): the persist tail EXTRACTED to ONE writer both doors call |
| `frontend/src/components/panel/TemplateUpload.tsx` | 2 / 2 / 91 | ⚠ absent for its entire life — row added 244-02 at the SECOND phase. **244**: the `accept=` literal is GONE; it reads the fenced constant |
| `frontend/src/lib/stripComments.testutil.ts` | 1 / 1 / 28 | young (created 244-14 / IN-02). Row added AT CREATION. ⛔ The ONE home of *a `?raw` fence cannot tell code from a comment*; 3 consumers. Never apply it to a class-list or string-CONTENT assertion |
| `frontend/src/lib/workspaceAllowedExt.ts` | 1 / 1 / 54 | young (created 244-02). Row added AT CREATION — an absent row is invisible to G-5 at any count |
| `frontend/src/components/chat/ChatAttachmentChip.tsx` | 1 / 1 / 144 | young (created 244-05). Row added AT CREATION. ONE chip, THREE states; `sent` carrying `this chat only` is D-244-22's build obligation, `expired` is D-244-25's |
| `frontend/src/components/chat/composerCopy.ts` | 2 / 1 / 103 | young (created 244-05). Row added AT CREATION. A PORT of sketch 236's `COPY.js`, `?raw`-fenced. ⛔ `COPY.b` NOT ported (D-244-23). **244-06**: `cloudSub` ported by SHAPE |
| `frontend/src/components/chat/ConnectedFilePickerModal.tsx` | 3 / 2 / 336 | ⚠ **absent for its ENTIRE LIFE — row added 244-06, and the ledger GATE is what found it (C-8's last `[no-row]`).** REBUILT: select-then-confirm; the commit is the PARENT's |
| `frontend/src/components/chat/useComposerAttachments.ts` | 1 / 1 / 158 | young (created 244-06). Row added AT CREATION. ⭐ THE SEAM `244-05` NAMED AND OWED — both attach doors' state + verbs; it CANNOT reach `setValue` |
| `backend/app/services/oauth_refresh_service.py` | 5 / 3 / 362 | ⚠ absent for its ENTIRE LIFE — row added **BUG-260912-01**. The ONE token-renewal seam; `invalid_client` now raises its own named error, NEVER a subclass of the revoked one |
| `frontend/src/components/sources/SourceFolderPicker.tsx` | 2 / 2 / 375 | ⚠ absent for its entire life — row added **BUG-260912-01** at its SECOND touch. ⛔ a failed child load renders a REASON; "No subfolders" is a claim about the drive and needs an answer to make it |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | 6 / 3 / 560 | ⚠ absent for its entire life — row added **BUG-260912-01** at its THIRD phase, so G-5 FIRES on the next touch. SIX causes now; the sixth is the deployment's own credentials |
| `backend/app/services/sources/failure_cause.py` | 3 / 2 / 227 | ⚠ absent for its entire life — row added **BUG-260912-01**. ⛔ its `Cause` union must stay ONE plain-text line: a frontend suite binds it by `?raw` and a computed union is invisible to that fence |

When a new phase enters discuss-phase, the orchestrator must scan PLAN.md `files_modified` against this ledger. Any match against a G-5-firing row means the discuss-phase produces a refactor recommendation as the first option, not the planned feature — and the phase reads that file's section in `docs/HOT-FILE-LEDGER.md` before planning, because that is where the named seam and the binding invariants live.

⚠ **FIVE ROWS WERE FOUND STALE WHEN THIS TABLE WAS RE-DERIVED ON 2026-08-17, AND THREE OF THEM READ `satisfied`** — the exact state `StreamsProvider.tsx`'s row was in when it turned out to be wrong by 28 phases. `ToolCallPanel.tsx` read `satisfied (075.7)` while measuring **19 phases**; `MessageItem.tsx` **29**; `useMessages.ts` **27**; `backend/app/api/threads.py` read `9+` while measuring **76 phases / 233 commits — ~~the hottest file in the repository~~**; `anthropic_service.py` read `4+` against **10**.

⚠ **CORRECTION 2026-08-18 (Phase 196, plan `196-09`) — THAT SUPERLATIVE IS REFUTED BY MEASUREMENT, and the original is struck through above rather than deleted.** `backend/app/api/threads.py` is **not** the hottest file in the repository. **`frontend/src/lib/api.ts` measures `170 commits / 97 phases / 6154 lines`** — 21 phases hotter and 4.8× the size — **and it had no row in this table at all.** The claim was wrong for a structural reason rather than a careless one: **the comparison set was this table, and the actual hottest file has never been in it**, which is the exact failure the table's completeness rule exists to prevent. ⚠ **The verdict does not depend on the counting convention:** `api.ts`'s bucket list carries sixteen ambiguous bare two-digit tokens and `threads.py`'s carries twenty, so on the strict accounting that discards all of them it is still **81 vs 56**. Full derivation, both accountings and the preserved original: `docs/HOT-FILE-LEDGER.md` → `backend/app/api/threads.py` → *"⚠ CORRECTION 2026-08-18"*. **Nothing about `threads.py`'s own SSE-transport discharge changes** — what is corrected is a superlative, and a superlative derived from an incomplete scan list is precisely what this ledger exists to stop being believed.

⚠ **ELEVEN MORE ROWS WERE ADDED ON 2026-08-18 BECAUSE THEY WERE ABSENT, NOT BECAUSE THEY WERE NEW** (Phase 196, discharging `196-CONTEXT.md` D-22 / D-23 for the files that phase actually modified). Phase 196 touched 23 non-test source files; **eleven had no row**, so G-5 could never have fired on any of them at any count. `frontend/src/lib/api.ts` at **97** phases, `frontend/src/types/index.ts` at **56**, `backend/app/main.py` at **53**, and **`backend/app/config.py` at 42 — invisible to its own guardrail for the project's entire life.** That is the identical failure `WorkflowsPage.tsx` suffered for ten phases, `WorkflowDoorSwitch.tsx` for six, `db/workflows.py` for seventeen and `ChatArea.tsx` for twenty-eight. ⚠ **Two files D-22 also named — `frontend/src/pages/SettingsPage.tsx` and `frontend/src/components/settings/ModelPillRow.tsx` — stay named-only BY DECISION**, because Phase 196 deliberately did not modify either (ROADMAP SC#3's scope fence, proven by a negative fence over the phase's real diff); the re-open trigger is *the next phase whose `files_modified` names either of them*. Their verbatim cells are preserved in the detail file under an explicit staleness marker. **A row that is present and WRONG answers the auditor with `satisfied` and stops the audit, which is worse than an absent row** — so re-derive with the recipe above rather than trusting a cell, even when the file IS listed.


## Project skills

- **Sketch findings for Agentic RAG** (design decisions, CSS patterns, visual direction for the live-execution UX — run-card frame, tool-call panel shape, long-run composition; the Phase 087 workspace panel — panel shell/collapse/mobile, file+diff viewer, ask_user interrupt, chat↔panel seam; the Phase 094 workflow-mode surfaces — harness phase timeline, unified Deep/Harness execution surface, run honesty, 2-pill composer + mode clarity, Workflows page, NL workflow builder; the Phase 095 chat tool-card unification — the unified status-node rail frame, the never-vanishes run-status strip + follow-but-release scroll, the output-files hero/working split + per-extension file icons, and the build-once component inventory; AND the Phase 103 Workflow Studio — the requirement-first workflow Builder/authoring + read-only vertical phase-spine graph + side-panel forms, the 8-stage publish gauntlet with the judge hard-wall, the built Workflows page library+launch, the workflow run surface where the panel owns the meaningful phase spine + chat carries a thin run receipt, and the three-homes app navigation/IA contract; AND the Phase 112 document detail panel — the right-side push/split document-detail shell (the shared shell that Phase 117 relationships + Phase 118 classification also inhabit), the per-field ConfidenceChip, and honest inline metadata editing; AND the Phase 114 virtual-folders surfaces — the no-DSL filter/view builder + relative-date control, the saved-Views sidebar group + shared Folders+Views NavRow / folder-tree polish, and the Documents-page composition/layout; AND the Phase 117 document relationships — the chip-led grouped-by-direction relationships accordion added to the existing detail panel (outgoing/incoming inverse labels, masked "no access" row, re-fetch-not-optimistic remove) + the type-first searchable-typeahead create-link picker on the MoveToFolderDialog shell; AND the Phase 127 energized Workflow Studio re-skin — the publish-gauntlet pip/energy-spine + worded verdict + raw-on-demand, the quiet-idle/alive-active live step-flow, and the cross-cutting ICON CONVENTION (provider/model icons = single-source @lobehub/icons everywhere; phase-type icons = the shared 3D PHASE_GLYPHS map); AND the Phase 111.1 Settings surfaces — the reusable provider picker with the always-on 🔒 endpoint footer, the weight-not-friction re-embed confirm, the re-embed progress card; AND the Phase 118 auto-classification — suggested-never-moved chips + the dedicated rules surface; AND the Phase 119 governance-health home — signal cards + inline verb fix-rows, page writes nothing; AND the Phase 123/123.1 Trigger Tuner — held-out picks, N-column-configured-targets scoreboards, never-block lint, the real-scale editor lesson; AND the Phase 124 workflow soul + strict/loose two doors; AND the Phase 128 cross-provider chat polish — single-source provider logos, two elapsed-status homes, the user-prompt clamp; AND the Phase 137 Skill Studio — the focused Evals·Triggering·Versions surface, the lifecycle stepper, the expandable honest run rows, the immutable version table + compare; AND the Phase 137.1 eval production-clean — the grouped matrix card with one gate-feeder + history aggregation + deterministic analyst notes, the thin determinate unit bar + inline advisory case feedback, and the Settings engine-health tile board + judge-model knob; AND the Phase 146–148 Operator Control Room — the operator band+tabs shell with honest locks + the ⌥ Technical-names two-audience reveal, the always-on audit-ledger receipt vocabulary (✎ writes, consequence ≠ receipt) + the graded action-guards rule (victim-naming sheet / arm-to-confirm / direct flip), the pinned-vitals Control Plane (dependency health, active-runs-with-Kill, kill-switch grid + spatially-separated maintenance), the two-ledger audit browser (chip filters + recorded CSV), the users roster (last-active honesty, victim-naming disable, flagged operator grant), and the API-enforced feature-visibility audience map with the extensible-audience forward-compat contract; AND the Phase 185 Graded Governance surfaces — the detected-and-one-way grounding dial (the switch that visibly refuses + the “you can only undo a lock you created” rule), the shape-only canvas seal whose CORNER MARK is load-bearing (top-right of the card is claimed; governance spends no colour and no third badge), the binding “must prove it” vocabulary, the armed-on-by-default action-risk checkpoint, the review moment where the document IS the surface with backing marked inside it, and the one-place canvas↔review↔canvas round trip; AND the Phase 187 node-vocabulary + AI-seed surfaces — the layered node-face ladder (author name → config-derived → type sentence, computed never stored), the ⌥ Technical-names reveal that swaps the SUBTITLE not the title, the single-shot AI-seed arrival + its seed receipt that makes auto-applied grounding legible, and the template door that seeds the describe box rather than opening a second forward path; PLUS the canvas glyph vocabulary in `references/icon-convention.md` §4 — read it before drawing any canvas mark) → `Skill("sketch-findings-agentic-rag")`. Auto-load when building or refactoring ToolCallPanel, RunCard, StreamsProvider, MessageItem, MessageList, OutputFileCard, useMessages, the workspace panel, the harness/workflow run UI or its phase timeline, the workflow Builder/authoring, the publish gauntlet (its energized pip-strip + worded verdict), the live phase spine (PhaseCard/PhaseTimeline), provider/model logos anywhere or the icon convention, the Workflows page, the workflow run surface + its meaningful steps, the app navigation/IA, the composer, the document detail panel / ConfidenceChip / inline metadata editing, the documents-page right-side panel, the metadata filter/view builder, the saved-Views sidebar + folder tree (FolderNode/FolderTree NavRow), the document relationships panel section + create-link typeahead picker, any Settings model picker / the engine-health card / the re-embed lifecycle, the classification suggestion or rules surfaces, the governance-health page, the Skill Studio (EvalsTab/TriggeringTab/VersionsTab, LifecycleStepper, RunBar, RunHistory, RunCaseDetail), the Trigger Tuner internals or any per-provider scoreboard, matrix runs / eval progress / judge case_feedback, any `/admin` Control-Room surface (OperatorBand, ControlRoomPage, HealthSignals, ActiveRunsSection, CapabilityGrid, MaintenancePanel, AuditTab, the users roster, the feature-visibility map) or any operator confirm-sheet / audit receipt / kill-switch / destructive-action guard, any per-node grounding/governance surface or refusal copy, any approval / human-review checkpoint or the artefact-preview matrix, the workflow run surface and how a run relates to chat, or any chat-surface component touching the agent's mid-execution moment.

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
