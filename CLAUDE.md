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
- Ingestion is manual file upload only — no connectors or automated pipelines. **Dated, not permanent:** the operator's 2026-08-08 direction is that a connected drive (OneDrive/SharePoint/Google Drive) should auto-ingest — see `SEED-142`. Whoever ships the first sync connector changes this rule in the same commit; until then it holds.
- Schema changes ship as numbered SQL migrations under `supabase/migrations/` at the repo root (the legacy `backend/supabase/migrations.archive/` is dead — see its README). Filenames must match `<digits>_name.sql` (e.g., `035_my_change.sql`); letter suffixes like `007b` are silently skipped by the Supabase CLI. **Apply each new migration to the live local DB by pasting it into the Supabase SQL editor — never `supabase db push`/`db reset`** (preserves dev data). Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh` — by default this dumps the live DB schema with no reset, rebuilding `supabase/full-schema.sql` (single-file deploy artifact for greenfield envs). Pass `--reset` only when you explicitly want to verify the migration sequence from a clean slate (CI / release verification — destructive: wipes local DB). Never hand-edit `full-schema.sql`. Full setup story: `supabase/SETUP.md`.
- Supabase Realtime is a best-effort hint, **not** a source of truth — always reconcile via fetch on (re)connect (see decision D-v2.5-03)
- Do not run blocking I/O (e.g. `supabase-py` calls) directly inside async handlers — wrap with `run_in_threadpool` (decision D-v2.5-01)
- Multi-worker uvicorn is the default (`WORKER_COUNT=2`); see D-PRD-12 in `.planning/prd-reset/DECISIONS.md` for the singleton audit checklist and scaling guidance
- Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only
- External integrations / connectors follow the recorded MCP-first verdict — `docs/CONNECTOR-ARCHITECTURE.md` (MCP-first, first-party-thin, broad catalog sequenced with Open Platform; dated re-open trigger inside; pointer entry `D-v3.6-01`). No MCP client exists in the backend today; live outbound egress is Phase 190 (STRETCH).
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
| **G-5 Refactor between feature waves** | ≥ 3 prior phases on the same hot file (see ledger below) | Insert a dedicated refactor phase BEFORE the next feature phase on that file. Audit during discuss-phase. |
| **G-6 Failure criteria upfront** | Writing SPEC.md or scoping a phase | Include `## How we'd know this failed` section with concrete observable conditions. If failure modes can't be enumerated, scope is not ready to plan. |
| **G-7 Gap-closure round cap** | Verification returns `gaps_found` on a phase that has already run **2** gap-closure rounds | Do NOT route to `/gsd:plan-phase --gaps`. Triage every remaining finding as **fast-fix / defer-to-next-phase / accept** — unless a ROADMAP **success criterion** is actually unmet, which is the only thing that justifies a further round. A closure round may NEVER introduce a new user-facing capability: that is a phase, not a gap. |

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

**Hot-file ledger (update as phases ship).** Each row's narrative — the measured reasons, the corrections recorded beside their originals, the RED-driven plants, the invariants each file carries and the named seam the next refactor should take — lives in **`docs/HOT-FILE-LEDGER.md`**, one section per file. **This table is the AUDIT SCAN LIST and is deliberately complete:** every hot file appears here with its measured triple and its verdict, because a hot file missing from this table is permanently invisible to its own guardrail. ⚠ **A ROW CARRIES ITS VERDICT AND NOTHING ELSE — enforced, not merely asked:** the disposition cell is capped at 200 chars by `scripts/check-claude-md-size.cjs`, because this column reaching **60,558 chars (45% of this file)** is what forced the 2026-08-25 split. **Every reason, invariant, correction and named seam belongs in the detail file** — which is where the 115 cells that used to sit here now are, verbatim. ⚠ **SAME-COMMIT SYNC RULE** (the `docs/SANDBOX-PACKAGES.md` pattern): a row here and its section there are updated in the **same commit**; a row without a section, or a section without a row, is drift.

**Triples are `commits / phases / lines`, RE-DERIVED FROM GIT ON 2026-08-17** — not copied forward, because this ledger's own repeated finding is that a figure written at a phase's close goes stale on the next commit that touches the file, sometimes the same afternoon. Re-derive with:

```bash
git log --oneline -- <file> | wc -l                                    # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l  # phases
wc -l <file>                                                           # lines
```

⚠ **Six-digit buckets (`260814`, `260809`, `260529`) are DATED QUICK TASKS, not phases — subtract them.** The recipe prints them and only the phase count feeds G-5. Non-numeric buckets (`quick`, `chat`, `streaming`, untagged subjects) are likewise not phases.

| File | commits / phases / lines | G-5 | Disposition |
|---|---|---|---|
| [`frontend/src/components/chat/ToolCallPanel.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschattoolcallpaneltsx) | 51 / 23 / 351 | **FIRES** | ✅ **G-5 DISCHARGED (227-02)** — extracted ToolCallDetails, StepRow, toolStepDerivation (1019 → 351 lines) |
| [`frontend/src/components/chat/MessageItem.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatmessageitemtsx) | 62 / 33 / 702 | **FIRES** | ✅ **G-5 DISCHARGED (227-03)** — extracted UserMessageBubble, messageText, delegated RunTerminalStatus (823 → 702 lines) |
| [`backend/app/api/threads.py`](docs/HOT-FILE-LEDGER.md#backendappapithreadspy) | 243 / 80 / 1590 | **FIRES** | extraction TAKEN 2026-08-17 · honoured by construction (**214**) — one launch-inputs field on a request model it already owns |
| [`frontend/src/providers/StreamsProvider.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcprovidersstreamsprovidertsx) | 85 / 34 / 4144 | **FIRES** | honoured by construction (194.1 / **214**) — one run field added to the wire type |
| [`frontend/src/hooks/useMessages.ts`](docs/HOT-FILE-LEDGER.md#frontendsrchooksusemessagests) | 74 / 27 / 127 | ⚠ **FIRES** | extraction due |
| [`backend/app/services/anthropic_service.py`](docs/HOT-FILE-LEDGER.md#backendappservicesanthropic_servicepy) | 11 / 10 / 354 | ⚠ **FIRES** | adapter-pattern audit due |
| [`frontend/src/components/workflows/WorkflowCanvas.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsworkflowcanvastsx) | 31 / 9 / 1708 | **FIRES** | honoured by construction (199 / 200 / **214**) — 214-04 widened the panel and touched no node logic |
| [`frontend/src/components/workflows/FlowEdge.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsflowedgetsx) | 3 / 3 / 462 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | honoured by construction (200) — ⚠ absent, and it crossed the threshold in the commit that added its row |
| [`frontend/src/components/workflows/PhaseNodeCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsphasenodecardtsx) | 17 / 8 / 489 | **FIRES** | honoured by construction (199) — ⚠ the 200 canvas port is REVERTED here (2026-08-20) |
| [`backend/app/services/harness/phase_types.py`](docs/HOT-FILE-LEDGER.md#backendappservicesharnessphase_typespy) | 51 / 24 / 2925 | **FIRES** | extraction TAKEN (200-03) · honoured by construction (211 / 214 / **214.1**) — ⚠ the G-5 obligation stays **OWED** |
| [`frontend/src/pages/WorkflowsPage.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcpagesworkflowspagetsx) | 43 / 17 / 1415 | **FIRES** | the 192 / 192.1 extraction is TAKEN — ⚠ **not a standing `satisfied`**; and `onOpenSettings` is UNWIRED here (`SEED-218`) |
| [`frontend/src/components/workflows/library/WorkflowCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibraryworkflowcardtsx) | 19 / 6 / 1616 | **FIRES** | ✅ **G-5 DISCHARGED (192.2-02)** |
| [`frontend/src/components/workflows/library/libraryVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibrarylibraryvocabularyts) | 10 / 4 / 727 | ⚠ **FIRES** | no seam proposed |
| [`frontend/src/components/workflows/library/libraryFilter.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibrarylibraryfilterts) | 6 / 4 / 435 | ⚠ **FIRES** | ⚠ absent at 4 phases and NO PLAN NAMED IT (192.2) |
| [`frontend/src/components/workflows/library/libraryRow.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibrarylibraryrowts) | 4 / 3 / 201 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent, on the boundary (added 192.2) |
| [`frontend/src/components/workflows/WorkflowDoorSwitch.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsworkflowdoorswitchtsx) | 18 / 12 / 1075 | **FIRES** | honoured by construction (193 / 193.1 / 199 / **214**) — 214-13 added the service picker and its refusal as CHILDREN |
| [`frontend/src/pages/WorkflowBuilderPage.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcpagesworkflowbuilderpagetsx) | 56 / 21 / 2977 | **FIRES** | honoured by construction ×6 (193.1 / 193.2 / 197 / 200.3 / 214 / **214.1**) — 214.1 added one import + one gated node, zero `useState` |
| [`backend/app/api/workflows.py`](docs/HOT-FILE-LEDGER.md#backendappapiworkflowspy) | 41 / 22 / 2254 | **FIRES** | ⚠ **extraction still OWED** — declined again at BUG-260828-09 (one response model added); the named seam is unchanged |
| [`backend/app/api/workflow_runs.py`](docs/HOT-FILE-LEDGER.md#backendappapiworkflow_runspy) | 11 / 8 / 1003 | **FIRES** | honoured by construction (200 / 200.1 / **214**) — no longer *at threshold*: it measures **8** phases |
| [`backend/app/models/thread.py`](docs/HOT-FILE-LEDGER.md#backendappmodelsthreadpy) | 16 / 10 / 438 | ⚠ **FIRES** | honoured by construction (200.1 / **214**) |
| [`frontend/src/components/workflows/canvasModel.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowscanvasmodelts) | 13 / 6 / 752 | ⚠ **FIRES** | ⚠ absent from BOTH at 6 phases (added 200) |
| [`frontend/src/components/layout/ChatLayout.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentslayoutchatlayouttsx) | 46 / 24 / 921 | ⚠ **FIRES** | honoured by construction (**214**) — the launch form is a CHILD component, not a branch. ⚠ absent from BOTH until 200, at 21 phases |
| [`backend/app/services/harness/grounding.py`](docs/HOT-FILE-LEDGER.md#backendappservicesharnessgroundingpy) | 21 / 8 / 1414 | **FIRES** | honoured by construction (193.1 / 211 / **214**) — ⚠ **extraction still OWED**; 214 changed no capability set |
| [`frontend/src/components/workflows/PhaseFormPanel.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsphaseformpaneltsx) | 30 / 14 / 1566 | **FIRES** | honoured by construction ×6 (185 / 193 / 193.1 / 199 / 200 / **214**) |
| [`backend/app/db/workflows.py`](docs/HOT-FILE-LEDGER.md#backendappdbworkflowspy) | 48 / 25 / 2585 | **FIRES** | honoured by construction (193.2 / 194 / 192.2 / 200.1 / **214**) |
| [`backend/app/services/harness/publish_service.py`](docs/HOT-FILE-LEDGER.md#backendappservicesharnesspublish_servicepy) | 25 / 11 / 1810 | **FIRES** | honoured by construction (193.2 / 214 / **BUG-260828-09**) — the harvest loop EXTRACTED to a pure helper; three helpers added beside `_structural_failures` |
| [`backend/app/services/workflow_authoring.py`](docs/HOT-FILE-LEDGER.md#backendappservicesworkflow_authoringpy) | 15 / 9 / 989 | **FIRES** | honoured by construction (193.2 / 197 / 214 / **214.1**) — ⚠ the extraction it may be owed is neither taken nor obstructed |
| [`backend/app/models/harness.py`](docs/HOT-FILE-LEDGER.md#backendappmodelsharnesspy) | 20 / 19 / 766 | **FIRES** | honoured by construction (193.2 / **214**) |
| [`frontend/src/components/workflows/builderStore.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsbuilderstorets) | 14 / 8 / 968 | **FIRES** | honoured by construction (193.2 / 197 / **214.1**) — `setDeclaredInputs` is the sixth `meta` writer, the shape the five before it take |
| [`frontend/src/components/panel/WorkspacePanel.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelworkspacepaneltsx) | 16 / 10 / 646 | **FIRES** | honoured by construction (194 / 194.1) |
| [`backend/app/services/run_lifecycle.py`](docs/HOT-FILE-LEDGER.md#backendappservicesrun_lifecyclepy) | 6 / 3 / 459 | **FIRES** | honoured by construction (194) — at threshold |
| [`backend/app/api/runs.py`](docs/HOT-FILE-LEDGER.md#backendappapirunspy) | 35 / 16 / 1430 | **FIRES** | honoured by construction (194) |
| [`backend/app/services/harness_engine.py`](docs/HOT-FILE-LEDGER.md#backendappservicesharness_enginepy) | 54 / 20 / 3135 | **FIRES** | honoured by construction (194 / **214**) — 214-06 resolved the pause's service at ONE call site |
| [`frontend/src/components/chat/RunCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatruncardtsx) | 26 / 12 / 728 | **FIRES** | honoured by construction (194 / 214 / **227**) — gained RunTerminalStatus |
| [`frontend/src/components/chat/MessageInput.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatmessageinputtsx) | 29 / 14 / 643 | **FIRES** | honoured by construction (194.1) |
| [`frontend/src/components/chat/MessageList.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatmessagelisttsx) | 19 / 8 / 267 | **FIRES** | honoured by construction (194.1) |
| [`frontend/src/components/chat/ChatArea.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatchatareatsx) | 67 / 32 / 595 | **FIRES** | honoured by construction (194.1) |
| [`frontend/src/components/panel/PendingAskCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelpendingaskcardtsx) | 13 / 7 / 736 | **FIRES** | honoured by construction (194.1 / **214**) — ⚠ it still renders `Needs you`; `stepIdentityVocabulary`'s six PAUSE sentences reach it from nothing (`SEED-219`) |
| [`frontend/src/pages/WorkflowRunPage.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcpagesworkflowrunpagetsx) | 28 / 9 / 1670 | **FIRES** | honoured by construction (200 / 200.1 / 200.2 / **214**) — it resolves the step identity ONCE and its children render it |
| [`frontend/src/components/chat/OutputFileCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatoutputfilecardtsx) | 8 / 7 / 219 | **FIRES** | honoured by construction (195) |
| [`frontend/src/components/panel/FilesSection.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelfilessectiontsx) | 8 / 5 / 334 | **FIRES** | honoured by construction (195) |
| [`frontend/src/lib/api.ts`](docs/HOT-FILE-LEDGER.md#frontendsrclibapits) | 187 / 110 / 422 | ⚠ **FIRES** | ✅ **SPLIT TAKEN (207)** — this path is the re-export BARREL. ⚠ **its 12 domain MODULES had no rows of their own until 214** |
| [`frontend/src/types/index.ts`](docs/HOT-FILE-LEDGER.md#frontendsrctypesindexts) | 78 / 60 / 1331 | ⚠ **FIRES** | no seam proposed — a barrel of wire types; ⚠ absent until 196, at 56 phases (214) |
| [`backend/app/main.py`](docs/HOT-FILE-LEDGER.md#backendappmainpy) | 74 / 54 / 835 | ⚠ **FIRES** | honoured by construction (204) |
| [`backend/app/config.py`](docs/HOT-FILE-LEDGER.md#backendappconfigpy) | 73 / 43 / 1331 | ⚠ **FIRES** | honoured by construction (204) — seam named: `MODEL_CAPABILITIES` + its readers out |
| [`backend/app/api/admin.py`](docs/HOT-FILE-LEDGER.md#backendappapiadminpy) | 32 / 12 / 1733 | ⚠ **FIRES** | ⚠ absent at 12 phases (added 196) |
| [`backend/app/api/settings.py`](docs/HOT-FILE-LEDGER.md#backendappapisettingspy) | 30 / 16 / 639 | ⚠ **FIRES** | honoured by construction (**SEED-227**) — one knob added at the four seams `rerank_enabled` already uses; ⚠ absent at 16 phases (added 196) |
| [`backend/app/services/multimodal_service.py`](docs/HOT-FILE-LEDGER.md#backendappservicesmultimodal_servicepy) | 14 / 7 / 984 | ⚠ **FIRES** | ⚠ absent from BOTH for its ENTIRE LIFE at **7 phases** — row added SEED-227, which is also where its silent truncation was found |
| [`backend/app/api/documents.py`](docs/HOT-FILE-LEDGER.md#backendappapidocumentspy) | 72 / 30 / 2535 | ⚠ **FIRES** | ⚠ absent for its ENTIRE LIFE — row added 217.1-08, which wrote `embedded_at` at its main-ingest chunk INSERT (`:2296`) — one of the FOUR write sites |
| [`scripts/vitest-count-gate.cjs`](docs/HOT-FILE-LEDGER.md#scriptsvitest-count-gatecjs) | 141 / 28 / 4514 | ⚠ **FIRES** | honoured by construction (214-15 / 214.1-02 / **SEED-227**) — BASELINE pins + one TARGETS line, NO logic/threshold/check change; ⚠ absent until 196, at 16 phases |
| [`backend/app/services/eval_runner_service.py`](docs/HOT-FILE-LEDGER.md#backendappserviceseval_runner_servicepy) | 12 / 7 / 959 | ⚠ **FIRES** | ⚠ absent at 7 phases (added 196) |
| [`frontend/src/components/panel/PhaseCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelphasecardtsx) | 16 / 10 / 755 | ⚠ **FIRES** | honoured by construction (200 / **214**) — the failure sentinel NARROWED to both-sources-empty |
| [`frontend/src/components/panel/PhaseTimeline.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelphasetimelinetsx) | 9 / 7 / 385 | ⚠ **FIRES** | honoured by construction (**214**) — it mounts the shared identity; ⚠ absent from BOTH until 200 |
| [`frontend/src/components/panel/phaseStatusMeta.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelphasestatusmetats) | 3 / 3 / 236 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent; crossed the threshold in the commit that added its row (200) |
| [`backend/app/services/harness/validator_kinds.py`](docs/HOT-FILE-LEDGER.md#backendappservicesharnessvalidator_kindspy) | 12 / 5 / 749 | ⚠ **FIRES** | ⚠ absent at 5 phases (added 196) |
| [`frontend/src/components/admin/ModelRegistryTab.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsadminmodelregistrytabtsx) | 10 / 4 / 1191 | ⚠ **FIRES** | ⚠ absent at 4 phases (added 196) |
| [`frontend/src/components/workflows/soulData.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowssouldatats) | 12 / 10 / 499 | ⚠ **FIRES** | honoured by construction (214 / **214.1**); ⚠ absent until 197, at 7 phases |
| [`frontend/src/components/workflows/PublishGauntlet.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowspublishgauntlettsx) | 17 / 9 / 1289 | ⚠ **FIRES** | honoured by construction (214 / **BUG-260828-09**) — one child card mounted in the slot `PublishRefusalList` already owns; ⚠ absent until 199 |
| [`frontend/src/components/workflows/PhaseSpineGraph.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsphasespinegraphtsx) | 5 / 5 / 473 | ⚠ **FIRES** | honoured by construction (200) |
| [`frontend/src/components/workflows/phaseDuration.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsphasedurationts) | 5 / 1 / 525 | no (1 phase) | young (200) |
| [`frontend/src/components/workflows/receiptVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsreceiptvocabularyts) | 3 / 1 / 303 | no (1 phase) | young (200) |
| [`frontend/src/components/workflows/RunReceipt.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsrunreceipttsx) | 3 / 1 / 241 | no (1 phase) | young (200) |
| [`frontend/src/components/workflows/doorVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdoorvocabularyts) | 6 / 4 / 540 | ⚠ **FIRES** | no seam proposed — a vocabulary doing one thing many times is the right shape (214); ⚠ absent until 199, and it is no longer at threshold |
| [`frontend/src/components/workflows/StepTypePicker.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowssteptypepickertsx) | 7 / 3 / 522 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | honoured by construction (199) — ⚠ absent, on the boundary |
| [`frontend/src/components/workflows/library/RunModal.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibraryrunmodaltsx) | 8 / 5 / 713 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ✅ **deferred extraction DISCHARGED (214-12)** — one declared-input renderer, shared with chat and the schedule door |
| [`frontend/src/components/panel/PanelEmpty.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelpanelemptytsx) | 4 / 4 / 52 | ⚠ **FIRES** | ⚠ absent at 4 phases — invisible to G-5 for its entire life (199) |
| [`frontend/src/components/chat/StopControl.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatstopcontroltsx) | 3 / 1 / 315 | no (1 phase) | young — owes a detail section at its 3rd phase |
| [`frontend/src/components/chat/ThreadRunLine.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatthreadrunlinetsx) | 1 / 1 / 357 | no (1 phase) | young — owes a detail section at its 3rd phase |
| [`frontend/src/components/chat/ActiveRunsTray.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentschatactiverunstraytsx) | 2 / 1 / 164 | no (1 phase) | young — owes a detail section at its 3rd phase |
| [`frontend/src/components/files/FileRow.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsfilesfilerowtsx) | 1 / 1 / 275 | no (1 phase) | young (195) |
| [`frontend/src/components/files/fileRowUtils.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsfilesfilerowutilsts) | 1 / 1 / 133 | no (1 phase) | young (195) |
| [`frontend/src/lib/fileIcon.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrclibfileicontsx) | 2 / 2 / 254 | no (2 phases) | young (095, 195) |
| [`frontend/src/lib/fileTypeMark.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrclibfiletypemarktsx) | 1 / 1 / 196 | no (1 phase) | young (260825) |
| [`frontend/src/lib/fileIcons.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrclibfileiconstsx) | 2 / 2 / 31 | no (2 phases) | ⚠ absent from BOTH for its entire life while serving FOUR surfaces (260825) |
| [`backend/app/services/run_transport.py`](docs/HOT-FILE-LEDGER.md#backendappservicesrun_transportpy) | 1 / 0 / 116 | no (0 phases) | young — the SSE transport leaf cut out of `threads.py` |
| [`backend/app/services/model_registry.py`](docs/HOT-FILE-LEDGER.md#backendappservicesmodel_registrypy) | 3 / 1 / 368 | no (1 phase) | young (196) |
| [`backend/app/api/model_registry.py`](docs/HOT-FILE-LEDGER.md#backendappapimodel_registrypy) | 1 / 1 / 155 | no (1 phase) | young (196) |
| [`frontend/src/components/workflows/ModelField.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsmodelfieldtsx) | 3 / 2 / 370 | no (2 phases) | young (196, 199) |
| [`frontend/src/components/workflows/modelFitness.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsmodelfitnessts) | 1 / 1 / 130 | no (1 phase) | young (196) |
| [`frontend/src/hooks/useComposerModel.ts`](docs/HOT-FILE-LEDGER.md#frontendsrchooksusecomposermodelts) | 2 / 1 / 367 | no (1 phase) | young (196) |
| [`frontend/src/hooks/useModelRegistry.ts`](docs/HOT-FILE-LEDGER.md#frontendsrchooksusemodelregistryts) | 1 / 1 / 109 | no (1 phase) | young (196) |
| [`frontend/src/components/workflows/decisionsVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdecisionsvocabularyts) | 1 / 1 / 226 | no (1 phase) | young (197) |
| [`frontend/src/components/workflows/DecisionsList.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdecisionslisttsx) | 4 / 2 / 413 | no (2 phases) | young (197, 199) |
| [`frontend/src/components/workflows/DraftArrivalCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdraftarrivalcardtsx) | 1 / 1 / 338 | no (1 phase) | young (197) |
| [`frontend/src/components/workflows/useTemplateFirstDraft.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsusetemplatefirstdraftts) | 6 / 3 / 673 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | honoured by construction (**214**) — ⚠ its detail-file ANCHOR did not resolve until this commit |
| [`frontend/src/components/workflows/toolNames.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowstoolnamests) | 1 / 1 / 128 | no (1 phase) | young (200) |
| [`frontend/src/components/workflows/StepCardSection.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsstepcardsectiontsx--stepcardsectioncontextts) | 1 / 1 / 95 | no (1 phase) | young (200) |
| [`frontend/src/providers/ThemeProvider.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcprovidersthemeprovidertsx) | 1 / 1 / 149 | no (1 phase) | young (200) |
| [`frontend/src/components/workflows/RunSpine.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsrunspinetsx) | 5 / 3 / 426 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | honoured by construction (**214**) — it crossed the threshold IN THIS PHASE; renders the shared identity and resolves nothing |
| [`frontend/src/components/workflows/NodeIconWell.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsnodeiconwelltsx) | 4 / 2 / 190 | no (2 phases) | **DELETED AND RESTORED** |
| [`frontend/src/components/workflows/RunTranscript.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsruntranscripttsx) | 7 / 3 / 652 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ **FIRES on a component with NO MOUNT in the product** — 214-11 measured it; 214 does not modify it |
| [`frontend/src/components/workflows/RunHero.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsrunherotsx) | 1 / 1 / 242 | no (1 phase) | young (200.2) |
| [`frontend/src/components/workflows/RunStepList.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsrunsteplisttsx) | 2 / 2 / 339 | no (2 phases) | young (200.2, 214) — ⚠ its only suite `RunStepList.test.tsx` was UNPINNED until 214-15 |
| [`frontend/src/components/workflows/runColumnVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsruncolumnvocabularyts) | 1 / 1 / 70 | no (1 phase) | young (200.2) |
| [`frontend/src/components/workflows/transcriptVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowstranscriptvocabularyts) | 3 / 1 / 131 | no (1 phase) | young (200) |
| [`frontend/src/components/workflows/connectionState.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsconnectionstatets) | 1 / 1 / 114 | no (1 phase) | young (200) |
| [`frontend/src/components/workflows/FieldGuidance.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsfieldguidancetsx) | 1 / 1 / 118 | no (1 phase) | young (199) |
| [`frontend/src/components/workflows/library/LibraryToolbar.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibrarylibrarytoolbartsx) | 3 / 2 / 408 | no (2 phases) | young (192.1, 199) |
| [`frontend/src/components/workflows/BuilderHeaderBar.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsbuilderheaderbartsx) | 2 / 2 / 81 | no (2 phases) | young (197, 199) |
| [`frontend/src/components/workflows/library/cardFace.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibrarycardfacets) | 3 / 1 / 207 | no (1 phase) | young (192.2) |
| [`frontend/src/components/workflows/library/gutterTokens.fences.test.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibraryguttertokensfencestestts) | 2 / 1 / 663 | no (1 phase) | young (192.2 gap round 1) |
| [`frontend/src/components/workflows/library/runFacts.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibraryrunfactsts) | 4 / 1 / 260 | no (1 phase) | young (192.2) |
| [`frontend/src/components/workflows/library/relativeChanged.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslibraryrelativechangedts) | 2 / 2 / 137 | no (2 phases) | young (192.1, 192.2) |
| [`frontend/src/main.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcmaintsx) | 3 / 1 / 10 | no (1 phase) | young (192.2) |
| [`frontend/src/components/settings/ConnectionsTab.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsconnectionstabtsx) | 23 / 8 / 1578 | ⚠ **FIRES** | ⚠ the row was STALE at `17 / 7 / 1477`. honoured by construction (**221-02**) — one state map + one prop through three mount sites |
| [`frontend/src/components/settings/ConnectionFormPanel.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsconnectionformpaneltsx) | 17 / 7 / 2376 | ⚠ **FIRES** | ⚠ the row was STALE at `9 / 5 / 2009`. honoured by construction (212 / **221**) — 221-01 adds ONE prop at the one mount site |
| [`frontend/src/components/settings/ConnectionGrantsList.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsconnectiongrantslisttsx) | 5 / 2 / 259 | no (2 phases) | 344 → 222 (221-01) → **259**. The availability slot is a CHILD it forwards, not markup it owns |
| [`frontend/src/lib/api/org.ts`](docs/HOT-FILE-LEDGER.md#frontendsrclibapiorgts) | 6 / 4 / 562 | ⚠ **FIRES** | ⚠ absent for its ENTIRE LIFE at **4 phases** — row added 221. **NOT covered by `lib/api.ts`'s row: that row is the BARREL** |
| [`backend/app/services/connectors/service_tools.py`](docs/HOT-FILE-LEDGER.md#backendappservicesconnectorsservice_toolspy) | 11 / 1 / 2018 | no (0 phases) | ⚠ absent for its ENTIRE LIFE — row added 221. Its bucket list is ALL dated quick tasks, so it measures 0 phases at 1456 L |
| [`backend/app/services/connectors/grants.py`](docs/HOT-FILE-LEDGER.md#backendappservicesconnectorsgrantspy) | 1 / 1 / 92 | no (1 phase) | ⚠ absent — row added 221. It is THE grant-time gate: 92 L deciding every connector call |
| [`frontend/src/components/settings/connectionsCopy.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsconnectionscopyts) | 13 / 7 / 737 | ⚠ **FIRES** | no seam proposed — a vocabulary doing one thing many times is the right shape |
| [`frontend/src/components/settings/connectionFormCopy.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsconnectionformcopyts) | 7 / 5 / 968 | ⚠ **FIRES** | no seam proposed — the same verdict as its sibling |
| [`frontend/src/pages/SettingsPage.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcpagessettingspagetsx) | 38 / 21 / 1500 | ⚠ **FIRES** | ✅ **the 212-close re-open trigger has now FIRED** (SEED-227 names it) — honoured by construction: one SectionCard added beside Retrieval, no branch touched |
| [`frontend/src/components/settings/ModelPillRow.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsmodelpillrowtsx) | 4 / 3 / 141 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent for its entire life — row added 2026-08-27 at 212's close, same D-22 pair as `SettingsPage.tsx` |
| [`frontend/src/components/settings/servicesCatalog.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsservicescatalogts) | 2 / 1 / 211 | no (1 phase) | young (212) — the presentation lookup migration 127's `service_id` COMMENT names |
| [`frontend/src/components/settings/catalogCopy.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingscatalogcopyts) | 1 / 1 / 22 | no (1 phase) | young (212) |
| [`frontend/src/components/settings/connectionRefusalCopy.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsconnectionrefusalcopyts) | 1 / 1 / 567 | no (1 phase) | ⚠ absent for its entire life at 567 L — row added 2026-08-27 |
| [`frontend/src/components/workflows/phaseVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsphasevocabularyts) | 16 / 6 / 990 | **FIRES** | honoured by construction (206.2) |
| [`frontend/src/components/workflows/ConnectionPicker.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsconnectionpickertsx) | 7 / 5 / 888 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | honoured by construction (206.2 / **214**) — ⚠ its named seam is still **OWED**; 214-07 grew it by 186 L |
| [`frontend/src/components/workflows/ExternalActionSection.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsexternalactionsectiontsx) | 8 / 5 / 179 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | honoured by construction (206.2 / **214**) — ⚠ **net −319 L**: the JSON surface DELETED (214-07). Its named seam is still OWED |
| [`frontend/src/components/workflows/McpToolPicker.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsmcptoolpickertsx) | 5 / 5 / 601 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | honoured by construction (211 / **214**) — net **−44 L** |
| [`frontend/src/components/workflows/externalShapeVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsexternalshapevocabularyts) | 2 / 1 / 109 | no (1 phase) | young (206.2) |
| [`frontend/src/components/workflows/McpToolPicker.reachability.test.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsmcptoolpickerreachabilitytesttsx) | 1 / 1 / 316 | no (1 phase) | young (206.2) |
| [`backend/app/models/connector.py`](docs/HOT-FILE-LEDGER.md#backendappmodelsconnectorpy) | 12 / 6 / 471 | ⚠ **FIRES** | ⚠ the row was STALE at `6 / 3 / 468`. honoured by construction (**221-02**) — one response model added beside the one it extends |
| [`backend/app/services/mcp_client.py`](docs/HOT-FILE-LEDGER.md#backendappservicesmcp_clientpy) | 4 / 2 / 407 | no (2 phases) | young (211, 212) |
| [`backend/app/api/connectors.py`](docs/HOT-FILE-LEDGER.md#backendappapiconnectorspy) | 25 / 11 / 1678 | ⚠ **FIRES** | honoured by construction (225): dual-mode state resolution inside the two functions it already owns |
| [`backend/app/services/google/availability.py`](docs/HOT-FILE-LEDGER.md#backendappservicesgoogleavailabilitypy) | 0 / 0 / 277 | no (new) | young (221-02) — the per-application probe. ⚠ It imports `_http`'s parser and writes NO second one |
| [`backend/app/services/google/writes.py`](docs/HOT-FILE-LEDGER.md#backendappservicesgooglewritespy) | 2 / 1 / 625 | no (1 phase) | ⚠ absent for its entire life — row added 221-02, which found `create_event` REFUSING every naive local time |
| [`frontend/src/components/settings/applicationAvailability.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsapplicationavailabilityts) | 0 / 0 / 152 | no (new) | young (221-02) — server decides the STATE, this decides the WORDS. It classifies nothing |
| [`frontend/src/components/settings/AvailabilityLine.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsavailabilitylinetsx) | 0 / 0 / 74 | no (new) | young (221-02) — a `ready` application renders `null`, never an empty element |
| [`frontend/src/components/settings/grantsVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentssettingsgrantsvocabularyts) | 3 / 2 / 115 | no (2 phases) | ⚠ absent for its entire life — row added 221-02. There is deliberately NO `READY` string in it |
| [`backend/app/services/connector_service.py`](docs/HOT-FILE-LEDGER.md#backendappservicesconnector_servicepy) | 21 / 7 / 1601 | ⚠ **FIRES** | ⚠ the row was STALE at `7 / 3 / 1149` — +9 commits, +2 phases, +312 L unrecorded. honoured by construction (211 / **221**) |
| [`backend/app/models/message.py`](docs/HOT-FILE-LEDGER.md#backendappmodelsmessagepy) | 17 / 10 / 124 | ⚠ **FIRES** | ⚠ absent from BOTH for its ENTIRE LIFE at **8 phases** — row added 214; honoured by construction (214-16) |
| [`backend/app/models/user_settings.py`](docs/HOT-FILE-LEDGER.md#backendappmodelsuser_settingspy) | 46 / 30 / 1352 | ⚠ **FIRES** | ⚠ absent from BOTH for its ENTIRE LIFE at **30 phases** — row added 214; honoured by construction (214-14) |
| [`backend/app/services/connectors/args.py`](docs/HOT-FILE-LEDGER.md#backendappservicesconnectorsargspy) | 2 / 1 / 474 | no (1 phase) | young (214-01) — the shared argument leaf: resolution, satisfiability, and ONE schema accessor |
| [`backend/app/services/harness/reachability.py`](docs/HOT-FILE-LEDGER.md#backendappservicesharnessreachabilitypy) | 4 / 4 / 463 | ⚠ **FIRES** | ⚠ absent from BOTH for its ENTIRE LIFE at **4 phases** — row added 214; it is the home of this phase's safety-gate predicate |
| [`backend/app/services/workflow_kickoff.py`](docs/HOT-FILE-LEDGER.md#backendappservicesworkflow_kickoffpy) | 8 / 6 / 554 | ⚠ **FIRES** | ⚠ absent for its ENTIRE LIFE at **6 phases** — and 214-16 records that this invisibility is WHY the `ctx.inputs` mirror went unowned |
| [`frontend/src/components/layout/ChatLaunchForm.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentslayoutchatlaunchformtsx) | 1 / 1 / 157 | no (1 phase) | young (214-12) — chat collects declared inputs BEFORE it creates anything |
| [`frontend/src/components/workflows/ArgumentEditor.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsargumenteditortsx) | 1 / 1 / 226 | no (1 phase) | young (214-07) — the argument form; the raw-JSON surface it replaced was DELETED, not hidden |
| [`frontend/src/components/workflows/ArgumentRow.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsargumentrowtsx) | 1 / 1 / 362 | no (1 phase) | young (214-07) — one row, one three-arm source picker, one gutter that WIDENS rather than inserts |
| [`frontend/src/components/workflows/DescribeServicePicker.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdescribeservicepickertsx) | 2 / 1 / 464 | no (1 phase) | young (214-13) — the describe door at the GRANT grain |
| [`frontend/src/components/workflows/LaunchInputFields.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowslaunchinputfieldstsx) | 2 / 2 / 152 | no (2 phases) | young (214-09 / 214-12 / **214.1-01**) — **the ONE declared-input renderer three doors mount**; `required` is a MARK, never a block |
| [`frontend/src/components/workflows/declaredInputs.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdeclaredinputsts) | 1 / 1 / 174 | no (1 phase) | young (214.1-01) — **the ONE minting site for `definition.inputs[]`**; three refusals + the ask-key offer |
| [`frontend/src/components/workflows/declaredInputsVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdeclaredinputsvocabularyts) | 1 / 1 / 94 | no (1 phase) | young (214.1-01) — every word the declared-input door says |
| [`frontend/src/components/workflows/DeclaredInputsEditor.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdeclaredinputseditortsx) | 1 / 1 / 333 | no (1 phase) | young (214.1-01) — the authoring surface `BUG-260828-02` says did not exist. ⚠ G-2 OVERRIDDEN, not satisfied |
| [`frontend/src/components/workflows/PublishRefusalList.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowspublishrefusallisttsx) | 2 / 1 / 178 | no (1 phase) | young (214-10) — the refusal renders as a CAUSE, not a status |
| [`frontend/src/components/workflows/StepIdentity.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsstepidentitytsx) | 1 / 1 / 161 | no (1 phase) | young (214-08) — ONE element, four sizes, both names as props; it resolves nothing |
| [`frontend/src/components/workflows/WorkflowScheduleModal.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsworkflowschedulemodaltsx) | 3 / 3 / 601 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent for its entire life; it crossed the threshold in 214-09 on a LAUNCH-CRITICAL path — row and BASELINE pin both added at this close |
| [`frontend/src/components/workflows/argumentModel.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsargumentmodelts) | 1 / 1 / 313 | no (1 phase) | young (214-07) — the three argument sources as data |
| [`frontend/src/components/workflows/argumentVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsargumentvocabularyts) | 1 / 1 / 254 | no (1 phase) | young (214-07) — every sentence the argument form says |
| [`frontend/src/components/workflows/describeServiceMatch.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsdescribeservicematchts) | 1 / 1 / 188 | no (1 phase) | young (214-13) — the match rule the describe door refuses on |
| [`frontend/src/components/workflows/nodePresentation.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsnodepresentationts) | 8 / 7 / 221 | ⚠ **FIRES** | ⚠ absent from BOTH for its ENTIRE LIFE at **7 phases** — row added 214 |
| [`frontend/src/components/workflows/publishRefusalEntry.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowspublishrefusalentryts) | 1 / 1 / 87 | no (1 phase) | young (214-10) |
| [`frontend/src/components/workflows/publishRefusalVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowspublishrefusalvocabularyts) | 1 / 1 / 290 | no (1 phase) | young (214-10) — pinned at 41 |
| [`frontend/src/components/workflows/stepActionWords.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsstepactionwordsts) | 2 / 1 / 91 | no (1 phase) | young (214) — the action half of a step's identity |
| [`frontend/src/components/workflows/stepIdentityVocabulary.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsstepidentityvocabularyts) | 1 / 1 / 206 | no (1 phase) | young (214-11) — ⚠ its six PAUSE sentences are consumed by NOTHING (`SEED-219`) |
| [`frontend/src/lib/api/knowledge.ts`](docs/HOT-FILE-LEDGER.md#frontendsrclibapiknowledgets) | 2 / 2 / 803 | no (2 phases) | young (207 split, 214) — ⚠ **NOT covered by `lib/api.ts`'s row: that row is the BARREL** |
| [`frontend/src/lib/api/threads.ts`](docs/HOT-FILE-LEDGER.md#frontendsrclibapithreadsts) | 7 / 3 / 1683 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | young (207 split, 214) — ⚠ **NOT covered by `lib/api.ts`'s row: that row is the BARREL** |
| [`frontend/src/lib/api/workflows.ts`](docs/HOT-FILE-LEDGER.md#frontendsrclibapiworkflowsts) | 4 / 4 / 1081 | ⚠ **FIRES** | ⚠ absent until 214; the 207 split created it with NO row. **`lib/api.ts`'s row is the BARREL, not these modules.** 214.1: docblock only, zero behaviour |
| [`frontend/src/lib/connectionMark.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrclibconnectionmarktsx) | 7 / 4 / 313 | ⚠ **FIRES** | ✅ **the move IS the seam, and it was TAKEN (214-08)** — `settings/` → `lib/`; four run + canvas surfaces now import ONE map |
| [`frontend/src/components/ingestion/DocumentList.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsingestiondocumentlisttsx) | 24 / 13 / 294 | ⚠ **FIRES** | ✅ **seam TAKEN (217.1-05)** — `DocumentRow.tsx` extracted with the sketch's five affordances (−315 L). ⚠ 7-column order still load-bearing: `LibraryPage` sheds cols 3–5 by `nth-child` |
| [`frontend/src/pages/LibraryPage.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcpageslibrarypagetsx) | 35 / 11 / 814 | ⚠ **FIRES** | ✅ **seam TAKEN (217-09)** — one reducer, each tab body a CHILD; the **fifth Health tab** landed at 217.1-12. ⚠ re-derive with `git log --follow`, else it reads `1` |
| [`backend/app/services/retrieval_service.py`](docs/HOT-FILE-LEDGER.md#backendappservicesretrievalservicepy) | 17 / 9 / 362 | ⚠ **FIRES** | ⚠ absent for its ENTIRE LIFE at **9 phases**. ⚠ It computes a per-hit similarity and **drops it** — the one retrieval fact the Library cannot show (`SEED-224`) |
| [`frontend/src/components/metadata/DocumentDetailPanel.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsmetadatadocumentdetailpaneltsx) | 9 / 6 / 496 | ⚠ **FIRES** | ⚠ **the row was STALE at `6 / 5 / 405`.** honoured by construction (217-10 / 217-11) — five lazy sections as CHILDREN. ⚠ CROSS-SURFACE: 217 lands on CHAT too |
| [`frontend/src/hooks/useDocuments.ts`](docs/HOT-FILE-LEDGER.md#frontendsrchooksusedocumentsts) | 8 / 3 / 120 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent at 3 phases. Realtime is a hint, not truth — it reconciles by fetch (D-v2.5-03), and `table_count`/`image_count`/`chunk_count` are server-side |
| [`frontend/src/pages/KnowledgeHealthPage.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcpagesknowledgehealthpagetsx) | 12 / 6 / **DELETED** | ⚠ **FIRES** | **RETIRED (217.1-14)** — the Library's Health tab absorbed it; `ChatLayout`'s fallback replaced by `UnknownViewFallback` (`:871`). ⚠ absent for its ENTIRE LIFE |
| [`backend/app/api/knowledge_health.py`](docs/HOT-FILE-LEDGER.md#backendappapiknowledgehealthpy) | 11 / 6 / 737 | ⚠ **FIRES** | honoured by construction (**217.1-11**) — adds `could_not_search`; `retrieval_count` byte-unchanged. ⚠ absent at **6 phases**. Audit-analytics from `audit_log`. Service-role by exception |
| [`backend/app/services/agent_loop.py`](docs/HOT-FILE-LEDGER.md#backendappservicesagent_looppy) | 39 / 20 / 3154 | ⚠ **FIRES** | ⚠ absent from BOTH for its ENTIRE LIFE at **20 phases** — row added 2026-08-31. Honoured by construction: the `org_id = user_id` fallback DELETED, resolution moved to a leaf |
| [`backend/app/services/tool_dispatcher.py`](docs/HOT-FILE-LEDGER.md#backendappservicestool_dispatcherpy) | 77 / 32 / 4679 | ⚠ **FIRES** | honoured by construction (2026-08-31) — the org resolution EXTRACTED to `connectors/org_scope.py`; ⚠ the row was STALE at `67 / 28 / 4336` after ONE day |
| [`backend/app/api/document_governance.py`](docs/HOT-FILE-LEDGER.md#backendappapidocumentgovernancepy) | 5 / 3 / 416 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent at 3 phases. ⚠ Its low-confidence cutoff is the ConfidenceChip tier (**0.5**) — a DIFFERENT measure from `knowledge_health`'s **0.38** retrieval similarity |
| [`frontend/src/pages/GovernancePage.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrcpagesgovernancepagetsx) | 4 / 1 / 355 | no (1 phase) | young (119) — ⚠ row added because it is being MERGED into the Library (operator, 2026-08-28); it is feature-gated while Documents is not, so the gate must move with it |
| [`frontend/src/components/ingestion/DocumentUpload.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsingestiondocumentuploadtsx) | 10 / 1 / 144 | no (1 phase) | young (056) — ⚠ absent for its entire life. ⛔ It reports NO byte progress (`onUploadProgress` absent), so any upload percentage is unknowable |
| [`frontend/src/components/ingestion/ViewsGroup.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsingestionviewsgrouptsx) | 5 / 3 / 259 | ⚠ **FIRES** | ⚠ absent for its ENTIRE LIFE at **3 phases** — row added 217.1-07, which moved the tab-body mount OFF it onto `ViewCardGrid`. The lazy+cached count shape (`:63-95`) is now shared, not duplicated |
| [`frontend/src/components/ui/tabs.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsuitabstsx) | 3 / 3 / 78 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent for its ENTIRE LIFE — it crossed the threshold in 217-06's OWN commit. A SHARED primitive: Library, Settings and Library Health are its three mounts |
| [`frontend/src/components/panel/CsvTablePreview.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentspanelcsvtablepreviewtsx) | 3 / 3 / 134 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent for its ENTIRE LIFE — crossed the threshold in 217-11's own commit. ✅ `DataTableView` EXTRACTED out of it (−67 L) at an UNCHANGED suite count |
| [`frontend/src/components/workflows/verdictModel.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsverdictmodelts) | 6 / 3 / 355 | ⚠ **FIRES — EXACTLY AT THRESHOLD** | ⚠ absent for its ENTIRE LIFE — row added `BUG-260828-09`. ⭐ Its `structural_gate` docblock PREDICTED this bug and named the fix 11 days early; marked false, never overwritten |
| [`frontend/src/components/workflows/publishBlockedStep.ts`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowspublishblockedstepts) | 0 / 0 / 176 | no (new) | young (`BUG-260828-09`) — the step-face resolver. ⚠ It derives NO second name ladder: `nodeTitle` is called, and `name ?? slug` is the one forbidden edit |
| [`frontend/src/components/workflows/PublishBlockedStepCard.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowspublishblockedstepcardtsx) | 0 / 0 / 101 | no (new) | young (`BUG-260828-09`) — the card a failed publish leads with. ⚠ **G-2 OVERRIDDEN, not satisfied**; jsdom cannot prove what it is for |

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
