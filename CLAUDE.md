# CLAUDE.md

Agentic RAG platform — AI agent that knows your knowledge base, runs code in a
sandbox, and can be taught new skills that persist. Chat is the default
interface; document ingestion is a manual file-upload flow.

## Claude is the only agent on this repo (since 2026-09-29)

⛔ **Gemini is OUT and the agent bus is RETIRED** — operator decision, 2026-09-29. Claude does all
build AND review work. Do not open bus items, do not hand work to Gemini, do not wait on it, and
do not tell the operator anything is "waiting on Gemini". Every item was closed and archived to
`.agent-bus/archive/CLOSED.md` (history only); the SessionStart bus hook is removed. `AGENTS.md` and
`scripts/agent-bus.sh` are historical. Reviews run as a fresh-context subagent
(`/gsd:code-review`), and a phase record says `independent_review: self` rather than `owed`.

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
  ⚠ **CORRECTED 2026-09-07 — that sentence was FALSE for thirteen days, and the original is struck through rather than deleted.** Measured: **`backend/app/services/mcp_client.py` is 480 lines across 5 phases**, added at `a1aa25c48` (**Phase 206, 2026-08-25** — *"MCP connector client — workflow-scoped, driven against a real server"*), so it also **FIRES G-5** while ROADMAP Phase 239 still describes it as *"4/2/407 — young, no row owed yet"*. Live outbound egress ships too, guarded by `app.security.egress.validate_mcp_destination` plus per-tool grant enforcement. ⭐ **The retirement itself was done RIGHT and that is the point** — `backend/tests/unit/test_189_no_egress.py`'s Case A source fence was **consciously retired under `D-206-07`**, with the reason written into the test body, exactly as `SEED-177` demanded (*"retire the fence DELIBERATELY, never trip it by surprise"*). **What rotted was the PROSE, not the guard** — the fence, the seed and this bullet are three registers and only one of them was updated. ⚠ ~~`SEED-177` still reads `status: planted`.~~ **CORRECTED 2026-09-13 (Phase 245, D-15) — REFUTED, and the original is struck through rather than deleted, because the sentence before it just fired on itself.** Measured directly: the seed reads **`status: partially-answered`**, and its own frontmatter already records trigger #2 as *"ANSWERED by Phase 206 (2026-08-25)"*. **Both halves were wrong — the status, and the implication that a fired trigger went unhandled.** ⭐ **What rotted was the PROSE in two registers — this bullet and ROADMAP Phase 245's Flags — not the seed**, which is left byte-unchanged. Its remaining arms (#1, #4) are a capability decision, not bookkeeping; trigger: `SEED-013` / Open Platform getting a phase number.
- **Provider-docs-first (evidence-based):** whenever work touches a specific provider (prompting, orchestration, context management, skill use, tool calls/tool use, streaming, structured output), research that provider's OWN official documentation first, then cross-check against our app's actual behavior with comparative analysis and real evidence (Supabase/DB, backend logs, LangSmith, live cross-provider UAT). Conventions do NOT transfer 1:1 between providers; keep provider-specific handling at the service boundary, never break the shared path. See `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md`.
- **A model's capabilities are DATA, not code (Phase 262 / migration 190).** `MODEL_CAPABILITIES` in `config.py` is a *seed*, never the only home. **12 of `ModelCapability`'s 15 fields are settable per-model from the Model Registry**, including `api_surface`, `reasoning_first`, `reasoning_off`, `uses_max_completion_tokens`, `supports_parallel_tools` and `max_tools`. ⛔ **Adding a model, or a model QUIRK, must never need a commit.** A new *protocol* still needs an adapter — data selects from behaviours the code knows, it cannot invent one — and that path is the four-part contract in `provider_gateway/dispatcher.py`'s `_SURFACE_ADAPTERS`: adapter + map entry + `config.API_SURFACES` value + migration CHECK literal, **all four or none**, pinned by `test_262_capability_column_pin.py`. ⚠ Provider inference for an id matching none of the ten naming patterns reads the **provider block the operator configured it under**; before 262 it fell to `ollama`, silently disabling tool calling for every id a vendor had not shipped yet.
- **The Extension Contract (Phase 255 / SEED-291):** *A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code.* The workflow core (executors, emitters, validators, programmatic functions, tools) is strictly closed and never dynamically registered. Ecosystem extensions ship as skills/workflows (data), MCP servers (external process), or sandbox compute (Docker). Complete contract + worked examples: `docs/EXTENSION-CONTRACT.md`.

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

⚠ **CORRECTED 2026-10-12 (Phase 277):** the CLAUDE.md FIRING-table cell cap is now **80**; the docs scan list keeps **200**. Until today the gate never parsed this table at all.

⚠ **THIRD SPLIT 2026-10-12 (Phase 277): `121,650` → `89,171`**, plus the FIRING-table cap bound at 80 (it had bound nothing since 2026-09-06). Topic files: `docs/VITEST-COUNT-GATE.md`.

- **Hard limit 150,000 · warn band 120,000.** At the warn band the split is *scheduled*, not scrambled.
- **Split by FUNCTION, never by deletion.** CLAUDE.md keeps the verdict / index / audit-scan-list; the narrative moves to `docs/<TOPIC>.md` under a **same-commit sync rule**. Precedents: `docs/HOT-FILE-LEDGER.md`, `docs/SANDBOX-PACKAGES.md`. ⚠ A hot file missing from a scan list is permanently invisible to its own guardrail — so the *table* stays complete and only the *prose* leaves. ⚠ **AND THE PROSE MUST STAY OUT:** a ledger disposition cell is capped at **200 characters** and the gate FAILS above it. Put the verdict in the cell and the reasons in that file's own section in `docs/HOT-FILE-LEDGER.md`, **in the same commit**.
  ⚠ **CORRECTED 2026-10-12 (Phase 277):** the CLAUDE.md FIRING-table cell cap is now **80**; the docs scan list keeps **200**. Until today the gate never parsed this table at all.
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

2. **Cap vitest workers in every run: `GSD_VITEST_MAX_WORKERS=2`.** Keep concurrent test-running agents at **≤ 2**.
   - **Re-derive, never quote.** Run `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the **repo root** and read the verdict line; never trust a quoted number, including one written here.
   - **The contract** is *no per-file DECREASE* and *0 failing*, never a fixed grand total. A growing total is the gate WORKING.
   - **If a run reds, do NOT reach for the cap.** Capture the failing filenames from the gate's **own persisted JSON report** BEFORE re-running anything, and check each against `git diff --numstat <base> HEAD` and `git status --short`. A byte-unchanged SEED-171 suite is an observation: say "provably unmodified", never "fine" — one green sample of a flaky suite is not proof of innocence. ⛔ Establish inherited-vs-new by checking out the base and re-running, never by comparing against a written number.
   - ⚠ **The frontend typecheck is VACUOUS as usually run:** `npx tsc --noEmit` checks ZERO files (solution-style `tsconfig.json`). Use `npx tsc -p tsconfig.app.json --noEmit` and a **set diff** against base.
   - ⚠ **Planning consequence:** `count gate OK` is not reachable on demand, so pair it with the per-file deltas and the explicitly-run in-scope suites, which are deterministic.
   - Full measured history (every dated correction, the trajectory tables, the SEED-171 causal refutation, the standing `sourceComposition` red): [`docs/VITEST-COUNT-GATE.md`](docs/VITEST-COUNT-GATE.md).

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

⚠ **CORRECTED 2026-09-16 (Phase 251) — THE RULE BELOW DESCRIBED A FILTER THAT COULD NOT SEE HALF ITS OWN REGISTER, and the original is struck through rather than deleted, because the failure is the finding.** The instruction was: ~~*"List `.planning/seeds/*.md` with `status: planted` (or `dormant`) AND `surface: Agentic-RAG`"*~~. Measured before the fix: **`surface:` was present on 128 of 283 files**, so the rule was blind to **55%** of the register; **5 seeds carried no frontmatter block at all**, so no status scan could see them at any count; and `status` was spelled **25 different ways** across 278 files, including `DONE`, `done`, `promoted`, `routed`, `queued` and `partial-consumed` — none of which any `status: planted` grep matches. ⭐ **The cause was not carelessness: `.planning/seeds/TEMPLATE.md` did not exist and never had.** Phase 251 wrote the contract, backfilled all 284 files (bodies proven md5-identical), and replaced the grep with a gate.

**Sweep the register with the SCRIPT, at two touchpoints:**

| Touchpoint | What to run |
|---|---|
| `/gsd:new-milestone` | `node scripts/check-seeds-register.cjs` — it derives its own scan set (`readdirSync`, never a constant) and refuses to pass over a collapsed one. Read each surfaced `trigger_when`; propose the ones whose trigger is ALREADY TRUE or fires within the proposed milestone as candidate REQ-IDs. Seeds gated on another seed are sequenced, never listed flat. |
| `/gsd:discuss-phase NNN` | `node scripts/check-seeds-register.cjs --phase NNN` — matches the phase's `files_modified` against each seed's `trigger_paths` and prints the matched token. Fold / defer / leave, and write the routing back into the seed's frontmatter, exactly as reported-bugs require. |

⚠ **Read the gate's TWO unswept figures and never sum them** — `N carry no trigger_when at all` and `M carry prose but no structured trigger`. A structured backfill is mechanical only, so most of the register is still unswept; reporting the smaller number alone is the comfortable lie this rule exists to end. **The contract's home is `.planning/seeds/TEMPLATE.md`**, and its `status` enum is synced with the gate and with `plant-seed.md` in the SAME commit.

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

⚠ **THE MECHANICAL GUARDRAILS LIVE IN A VENDORED FRAMEWORK, AND A FRAMEWORK UPDATE CAN CLOBBER THEM SILENTLY.** `.claude/get-shit-done/` is vendored at **v1.42.3**, tracked in git, with a SessionStart update checker — so a future `chore(gsd): apply the pending GSD framework update` can revert any of these edits and nothing would say so. **They are listed here by path so they can be RE-APPLIED as a set** rather than rediscovered one at a time, months apart:

| Wiring | Files edited in the vendored framework | Landed |
|---|---|---|
| **G-7** gap-closure round cap | `workflows/execute-phase.md` · `workflows/verify-work.md` · `workflows/plan-phase.md` (§2.4) | `9d3d887de` |
| **REG-02** seeds sweep | `workflows/discuss-phase.md` (`<step name="cross_reference_seeds">`) · `workflows/new-milestone.md` (§2.5) · `workflows/plant-seed.md` (the `max(id)+1` allocator + the frontmatter-contract block) | Phase 251 |

⛔ **The call must land in `workflows/`, never in `.claude/commands/gsd/`.** Measured at Phase 251: the two command files are **76- and 45-line ROUTERS with no steps in them**, and **no file under `.claude/commands/gsd/` invokes any `node scripts/…` at all** — a gate added there lands where nothing executes it in order, which is this file's own recurring *"a rule that exists and is not applied is the same as no rule."*
⚠ **Precedent, not guarantee:** the G-7 wiring survived one framework update (`dec2577ae` touched none of its three files). One survival is one data point.
⛔ **And `grep` cannot audit this.** A step that merely *names* a script satisfies `grep -rn "check-seeds-register"` and fires nothing. Phase 251 drove that counterfactual: with the executable fence replaced by a prose mention, the grep still hit while **zero runnable calls** remained. **Audit by extracting the fenced command and RUNNING it**, never by matching the name.

**Hot-file ledger (update as phases ship).** Each row's narrative — the measured reasons, the corrections recorded beside their originals, the RED-driven plants, the invariants each file carries and the named seam the next refactor should take — lives in **`docs/HOT-FILE-LEDGER.md`**, one section per file. **This table is the AUDIT SCAN LIST and is deliberately complete:** every hot file appears here with its measured triple and its verdict, because a hot file missing from this table is permanently invisible to its own guardrail. ⚠ **A ROW CARRIES ITS VERDICT AND NOTHING ELSE — enforced, not merely asked:** the disposition cell is capped at 200 chars by `scripts/check-claude-md-size.cjs`, because this column reaching **60,558 chars (45% of this file)** is what forced the 2026-08-25 split. **Every reason, invariant, correction and named seam belongs in the detail file** — which is where the 115 cells that used to sit here now are, verbatim. ⚠ **SAME-COMMIT SYNC RULE** (the `docs/SANDBOX-PACKAGES.md` pattern): a row here and its section there are updated in the **same commit**; a row without a section, or a section without a row, is drift.

⚠ **CORRECTED 2026-10-12 (Phase 277):** the CLAUDE.md FIRING-table cell cap is now **80**; the docs scan list keeps **200**. Until today the gate never parsed this table at all.

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
⚠ **RE-DERIVED 2026-10-12 (Phase 277) — the figure above (113 / 224) is stale:** this table carries **202 rows** (172 at >= 3 phases by their own triple, 30 below); the scan list carries **516** (505 plus the 11 rows 277 added for paths it lacked).
**Reading a cell (261012-x1l / WR-08):** every verdict 277 abbreviated keeps its full text, verbatim, under `CLAUDE.md verdict cell as of 2026-10-12 (moved by 277)` in that file's section of `docs/HOT-FILE-LEDGER.md`. A trailing `· ⛔` means that text carries a hard constraint, so read it before touching the file. An unmarked cell is short, not complete.

| Hot file (FIRING) | commits / phases / lines | Verdict (abridged) |
|---|---|---|
| `frontend/src/components/chat/ToolCallPanel.tsx` | 51 / 23 / 351 | ✅ **G-5 DISCHARGED (227-02)** |
| `frontend/src/components/chat/MessageItem.tsx` | 84 / 39 / 1059 (was `83 / 42 / 1050`) | 292.1 UAT: Deep Continue re-attaches the run's stream (+1 else-if) · ⛔ |
| `frontend/src/components/chat/CitationList.tsx` | 5 / 5 / 91 | 294-05: ONE CitationCheckAction beside the trigger · extraction FIRST |
| `backend/app/api/threads.py` | 285 / 97 / 2756 (was `284 / 96 / 2752`) | 299-01: send_message one refuse_if_other_org call (D-18) · ⛔ |
| `frontend/src/providers/StreamsProvider.tsx` | 120 / 45 / 5250 (was `119 / 45 / 5234`) | 296 G-4 row 12: kickoff terminal reconciles; kickoff clears old steps · ⛔ |
| `frontend/src/hooks/useMessages.ts` | 74 / 27 / 127 | extraction due |
| `backend/app/services/anthropic_service.py` | 12 / 11 / 373 (was `11 / 10 / 354`) | honoured by construction (282-01: constructor kwargs) · adapter audit due |
| `backend/app/services/embedding_service.py` | 9 / 5 / 354 | ⚠ absent for its entire life at 5 phases — row added 236 (SC#2) |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 33 / 11 / 1757 (was `32 / 10 / 1744`) | 296-07: D-09 one controlled view pair; extraction FIRST next · ⛔ |
| `frontend/src/components/workflows/FlowEdge.tsx` | 3 / 3 / 462 | honoured by construction (200) |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | 18 / 9 / 490 (was `17 / 8 / 489`) | 290: forecast unused — chips went on the library card, not here |
| `backend/app/services/harness/phase_types.py` | 67 / 34 / 3147 (was `66 / 33 / 3135`) | 300-03: send_email receipt names the recipient (D-23) · G-5 OWED |
| `backend/app/services/tools/render_template.py` | 6 / 3 / 1163 (was `3 / 2 / 1094`) | 296-03: button /V written as a name, read back typed · now FIRES · ⛔ |
| `frontend/src/pages/WorkflowsPage.tsx` | 56 / 23 / 1403 (was `55 / 23 / 1403`) | 299-REVIEW WR-05: link hook gets visibleRows + clearAllFilters |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | 27 / 12 / 1374 (was `26 / 11 / 1373`) | 299-02: one data-row-id |
| `frontend/src/components/workflows/library/WorkflowCardMenu.tsx` | 5 / 4 / 510 (was `4 / 4 / 506`) | 299-04: link sub first + Saves in on the fork line (D-20, UI-D11) |
| `frontend/src/components/workflows/library/libraryVocabulary.ts` | 15 / 8 / 820 (was `14 / 7 / 819`) | 296-07: STEP_LINE_UNTYPED re-exports the one home (data) |
| `frontend/src/components/workflows/library/libraryFilter.ts` | 6 / 4 / 435 | ⚠ absent at 4 phases and NO PLAN NAMED IT (192.2) |
| `frontend/src/components/workflows/library/libraryRow.ts` | 4 / 3 / 201 | ⚠ absent, on the boundary (added 192.2) |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | 20 / 13 / 1104 (was `18 / 12 / 1075`) | 291-04: one hook, one mount, one handoff spread (+33 −4) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 66 / 28 / 2942 (was `65 / 27 / 2940`) | 298-04: name maps get {meta, phases}; one optionLabel(...) option |
| `frontend/src/components/workflows/DraftArrivalCard.tsx` | 5 / 4 / 688 (was `4 / 3 / 625`) | 291-05: two optional props + one fold boolean; rows in a leaf · ⛔ |
| `frontend/src/components/workflows/DecisionsList.tsx` | 5 / 3 / 429 | ⚠ now FIRES (291) · 291-05: one optional prop, one template-row sub-line |
| `frontend/src/components/workflows/decisionsVocabulary.ts` | 6 / 4 / 344 (was `4 / 3 / 327`) | 291-05: one glyph + one formatter, still a zero-import leaf · ⛔ |
| `backend/app/api/workflows.py` | 54 / 28 / 1722 (was `53 / 27 / 1712`) | 299-01: create_draft from_definition_id + one tweak guard · split OWED |
| `backend/app/api/workflow_wire.py` | 4 / 4 / 532 (was `3 / 3 / 517`) | 296-06: AutoAnsweredNote + unplaced_sentences, additive |
| `backend/app/api/workflow_authoring_doors.py` | 5 / 3 / 797 (was `4 / 2 / 793`) | ⚠ now FIRES (296) · 296-06: bind returns unplaced_sentences |
| `backend/app/api/workflow_runs.py` | 23 / 17 / 1453 (was `22 / 16 / 1449`) | 299-01: D-10 one field (org_id), no branch · extraction FIRST |
| `backend/app/api/workflow_run_evidence.py` | 6 / 4 / 405 (was `5 / 4 / 408`) | 296-06: RunEvidenceConfidence re-exported (move only) |
| `backend/app/services/run_evidence.py` | 6 / 4 / 555 | ⚠ FIRES, absent here — row added 296-01 · D-05 withheld cascade · ⛔ |
| `frontend/src/lib/api/runEvidence.ts` | 3 / 3 / 137 | ⚠ now FIRES (293) — row added 293-03 · one optional field |
| `frontend/src/components/workflows/evidenceView.ts` | 4 / 3 / 387 | ⚠ now FIRES (293) — row added 293-03 · origin passed through |
| `frontend/src/components/workflows/RunEvidenceReport.tsx` | 8 / 6 / 497 (was `7 / 5 / 492`) | 299-04: one ShareLinkMenu in the actions row (finished run, D-34) |
| `frontend/src/components/workflows/evidenceVocabulary.ts` | 5 / 3 / 261 | ⚠ now FIRES (296) · 296-04: neutral NO_MATCH/UNSOURCED + DOWNLOAD_UNAVAILABLE |
| `backend/app/models/thread.py` | 25 / 17 / 550 (was `24 / 16 / 545`) | 293-03: ONE field (origin) |
| `frontend/src/components/workflows/canvasModel.ts` | 16 / 8 / 836 (was `15 / 8 / 831`) | 296-07: comparePhaseOrder, engineArmed; isGrounded drops escalated |
| `frontend/src/components/layout/ChatLayout.tsx` | 73 / 36 / 934 (was `72 / 36 / 933`) | 299-03: history column live behind the card; threadsPending prop |
| `frontend/src/components/layout/ChatLaunchForm.tsx` | 6 / 4 / 191 (was `5 / 4 / 183`) | 296 G-4 row 11: refused Run scrolls the refusal into view |
| `frontend/src/components/workflows/LaunchInputFields.tsx` | 3 / 3 / 145 | 287-01: leaf stays non-blocking; docblock only · 214.1-01 trigger TAKEN |
| `frontend/src/components/layout/ChatHistoryColumn.tsx` | 9 / 3 / 524 (was `8 / 3 / 522`) | 298-05: one ElsewhereLine mount atop hc-list (+ its import) |
| `frontend/src/hooks/useThreads.ts` | 9 / 5 / 128 (was `8 / 4 / 121`) | 299-05: pending flag (one const + one key) · ⛔ |
| `backend/app/services/harness/grounding.py` | 23 / 10 / 1437 (was `21 / 8 / 1414`) | 295-03: ONE pure predicate (is_engine_citation_gate) |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 30 / 14 / 1566 | honoured by construction ×6 (185 / 193 / 193.1 / 199 / 200 / **214**) |
| `backend/app/db/workflows.py` | 64 / 32 / 2874 (was `63 / 31 / 2862`) | 298-01: keyword-only org_id AND-append on published + drafts feeds |
| `backend/app/services/harness/publish_service.py` | 36 / 16 / 2061 (was `35 / 16 / 2057`) | 296-06: golden kickoff via launch_kickoff (S6-F8), one statement |
| `backend/app/services/workflow_authoring.py` | 23 / 13 / 1269 (was `18 / 12 / 1120`) | 296-03: unticked told; provider_error; file-free requirement · seam OWED |
| `backend/app/models/harness.py` | 22 / 20 / 776 (was `20 / 19 / 766`) | 291-02: InputFieldSpec origin + note, omitted when absent |
| `frontend/src/components/workflows/builderStore.ts` | 16 / 9 / 1039 (was `14 / 8 / 968`) | 291: two actions (refs, input source), no state field |
| `frontend/src/components/panel/WorkspacePanel.tsx` | 17 / 11 / 646 (was `16 / 10 / 646`) | honoured by construction (194 / 194.1 / 282-02: one prop) |
| `backend/app/services/run_lifecycle.py` | 11 / 7 / 827 (was `10 / 6 / 776`) | 296-02: Stop on a live producer carries who (sibling key, one read) |
| `backend/app/db/runs.py` | 12 / 9 / 345 (was `11 / 9 / 289`) | 292.1-REVIEW CR-01: run_is_cap_paused, the ONE pause predicate (+56) |
| `frontend/src/pages/admin/AdminSpendPage.tsx` | 9 / 3 / 974 | ⚠ NOW FIRES (crossed in 268) · extraction FIRST next · ⛔ |
| `backend/app/services/run_producer.py` | 26 / 14 / 1220 (was `25 / 13 / 1212`) | 296-02: F2 cancelled escape records the stopper (one read, one call) |
| `backend/app/services/task_service.py` | 28 / 15 / 1038 (was `27 / 14 / 1023`) | 292.1-REVIEW WR-02: provider-blind strip_markup on phase output (+15) |
| `backend/app/services/sub_agent_models.py` | 5 / 3 / 263 (was absent) | ⚠ absent its ENTIRE LIFE — row added 296-06; not touched |
| `backend/app/services/run_reconciler.py` | 7 / 4 / 419 (was `6 / 4 / 415`) | 296 review BE-WR-04: skipped counts as finished (one column) |
| `backend/app/services/circuit_breaker.py` | 1 / 1 / 331 | ⚠ absent its ENTIRE LIFE — row added 256-02 · ⛔ |
| `backend/app/api/runs.py` | 55 / 24 / 2054 (was `54 / 23 / 2050`) | 299-01: ask answer insert carries the run's org_id (D-18) · ⛔ |
| `backend/app/api/panel.py` | 6 / 5 / 285 | 295-03: ONE engine_pause key on /pending · honoured by construction |
| `backend/app/utils/folder_utils.py` | 9 / 5 / 302 | ⚠ absent its ENTIRE LIFE — row added 295-10 · ⛔ |
| `backend/app/services/harness/human_input.py` | 7 / 4 / 376 (was `6 / 3 / 375`) | 296-02: one stale comment corrected (the boot sweep now sets the flag) · ⛔ |
| `backend/app/middleware/canvas_gate.py` | 9 / 6 / 396 (was `8 / 5 / 391`) | 289-03: ONE gated path (…/evidence) · ⛔ test_182 never imports it |
| `backend/app/services/harness_engine.py` | 70 / 27 / 2999 (was `69 / 27 / 2992`) | 296 review CR-01: resume settings switch to the run's provider (one If) · ⛔ |
| `frontend/src/components/chat/ThinkingBlock.tsx` | 6 / 2 / 320 | ⚠ row STALE; does NOT fire yet · ⛔ |
| `frontend/src/components/chat/RunCard.tsx` | 31 / 16 / 729 | last touch 276-06 (D-27) · ⛔ |
| `frontend/src/components/chat/MessageInput.tsx` | 41 / 20 / 1007 | ⚠ STALE · last touch 268-03 · ⛔ |
| `frontend/src/components/chat/ActiveConnectorChips.tsx` | 2 / 2 / 82 | ⚠ absent its ENTIRE LIFE — row added 244-05 |
| `frontend/src/components/chat/MessageList.tsx` | 24 / 11 / 376 | ⚠ STALE · last touch 267-04 |
| `frontend/src/components/chat/ChatArea.tsx` | 96 / 45 / 1192 (was `95 / 44 / 1189`) | honoured by construction (299-04: ONE ShareLinkMenu mount, 0 hooks) · ⛔ |
| `frontend/src/stores/streamsStore.ts` | 28 / 19 / 662 (was `27 / 18 / 660`) | 296-04: initializer typed StreamsState (TS2345 gone) · ⛔ |
| `frontend/src/components/chat/ThreadWorkflowPicker.tsx` | 4 / 3 / 144 (was `3 / 2 / 144`) | ⚠ now FIRES (298) · 298-02: no Retry for a folder refusal · ⛔ |
| `frontend/src/components/chat/useStartWorkflowInThread.ts` | 4 / 3 / 186 (was `3 / 2 / 174`) | ⚠ now FIRES (298) · 298-02: kind folder shows the server sentence · ⛔ |
| `frontend/src/lib/toolMeta.ts` | 10 / 6 / 218 | ⚠ absent its ENTIRE LIFE — row added 244-13 · ⛔ |
| `frontend/src/components/panel/PendingAskCard.tsx` | 25 / 12 / 1132 (was `24 / 11 / 1103`) | 296-04: one ask per live workflow run; passed clock waits |
| `frontend/src/pages/WorkflowRunPage.tsx` | 37 / 17 / 1610 (was `36 / 16 / 1605`) | 299-04: one ShareLinkMenu after the v-chip, before Stop (D-20) · ⛔ |
| `frontend/src/components/workflows/WaitingOnLine.tsx` | 1 / 1 / 26 | young (created 288-03) · leaf, no hook · ⛔ |
| `frontend/src/components/chat/OutputFileCard.tsx` | 8 / 7 / 219 | honoured by construction (195) |
| `frontend/src/components/panel/FilesSection.tsx` | 12 / 8 / 354 (was `10 / 6 / 363`) | ⚠ STALE · last touch 274-04 |
| `frontend/src/lib/api.ts` | 215 / 128 / 556 (was `214 / 127 / 552`) | 299-03: one links export block |
| `frontend/src/types/index.ts` | 103 / 82 / 1688 (was `102 / 81 / 1685`) | 299-04: ExpertBundle.org_id (the wire already sent it) · seam OWED |
| `backend/app/main.py` | 98 / 72 / 1020 (was `97 / 71 / 993`) | 300-04: drainer start/stop under the boot-sweep gate (D-20) · ⛔ |
| `backend/app/config.py` | 96 / 55 / 1831 (was `93 / 54 / 1809`) | 300-03: SMTP_* fields (D-28) · seam OWED · ⛔ |
| `backend/app/api/admin.py` | 44 / 17 / 2054 (was `43 / 17 / 2051`) | quick-261024: discover summary gains a `returned` count (+3) · ⛔ |
| `backend/app/api/settings.py` | 48 / 26 / 1398 (was `47 / 25 / 1301`) | 300-05: four email knobs + read-only provider (D-07/D-08) |
| `backend/app/services/multimodal_service.py` | 14 / 7 / 984 | ⚠ absent from BOTH for its ENTIRE LIFE at **7 phases** |
| `backend/app/api/documents.py` | 101 / 40 / 2709 (was `99 / 39 / 2698`) | 298-01: one by_org in build() + one root_upload_org kwarg · ⛔ |
| `backend/app/api/library.py` | 3 / 3 / 304 (was `2 / 2 / 299`) | ⚠ now FIRES (298) · 298-01: summary shares the lists' org predicate ($1) |
| `scripts/vitest-count-gate.cjs` | 397 / 83 / 6873 (was `396 / 83 / 6868`) | 300-05: 2 pins added (EmailSettings 28, EmailNotificationPreference 17) |
| `scripts/check-deploy-drift.sh` | 6 / 5 / 271 (was `5 / 4 / 267`) | 300-03: SMTP_* parity |
| `scripts/build-public-openapi.cjs` | 11 / 5 / 472 (was `7 / 3 / 468`) | 298-01: org-items tag (Account & org) + /org-items/ FLAGGED (2 lines) |
| `scripts/check-seeds-register.cjs` | 7 / 3 / 1132 | ⚠ FIRES, absent here — row added 296-05 · `\d{3,}` ids · ⛔ |
| `backend/app/services/eval_runner_service.py` | 14 / 9 / 1056 (was `13 / 8 / 1040`) | 296-06: eval arm on a fixed EVAL_MAX_TOOL_ROUNDS (copy of settings) |
| `backend/app/services/scheduler_service.py` | 15 / 9 / 372 (was `14 / 9 / 352`) | 300-01: blank-input block + waiting outcome (D-14, D-26) |
| `backend/app/services/unattended_launch.py` | 7 / 3 / 379 (was `6 / 2 / 361`) | ⚠ now FIRES (300) · 300-01: records the owner's model + provider (D-33) |
| `backend/app/services/run_model_resolution.py` | 4 / 3 / 344 (was `3 / 2 / 308`) | ⚠ now FIRES (300) · 300-01: resolve_owner_run_model (D-33) |
| `backend/app/api/schedules.py` | 6 / 6 / 341 (was `5 / 5 / 303`) | 300-01: create/patch/resume 422 by label (D-14) |
| `backend/app/services/inbound_inputs.py` | 9 / 3 / 352 (was `8 / 2 / 312`) | ⚠ now FIRES (300) · 300-01: labels + sentence beside the one predicate |
| `backend/app/api/inbound.py` | 10 / 3 / 719 (was `9 / 2 / 711`) | ⚠ now FIRES (298) · 298-02: one foreign_folder _refused (plain 422) · ⛔ |
| `frontend/src/components/settings/apiKeys/apiKeysCopy.ts` | 5 / 3 / 283 (was `4 / 2 / 281`) | ⚠ now FIRES (298) · 298-02: one string (calls.foreignFolder) · ⛔ |
| `frontend/src/components/settings/apiKeys/apiKeyFacts.ts` | 4 / 3 / 310 (was `3 / 2 / 308`) | ⚠ now FIRES (298) · 298-02: one case, foreign_folder call words · ⛔ |
| `backend/app/models/schedule.py` | 3 / 3 / 231 | ⚠ FIRES, absent here — row added 296-02 · one additive field (outcome) |
| `frontend/src/components/panel/PhaseCard.tsx` | 22 / 14 / 821 (was `21 / 14 / 817`) | 296 review FE-WR-01: paused step drops running instruments |
| `frontend/src/components/panel/PhaseTimeline.tsx` | 11 / 9 / 408 (was `10 / 8 / 404`) | 296-04: derives runPaused from its frame, passes it |
| `frontend/src/components/panel/phaseStatusMeta.ts` | 5 / 5 / 308 (was `4 / 4 / 291`) | 296-04: derived Waiting row (not a wire status) |
| `backend/app/services/harness/validator_kinds.py` | 19 / 9 / 918 (was `18 / 8 / 899`) | 296-02: design note only when recording was by design (D-07) |
| `backend/app/services/harness/programmatic.py` | 4 / 4 / 142 (was `3 / 3 / 137`) | 293-REVIEW WR-03: split_topic splits envelope values; still pure · ⛔ |
| `backend/app/services/harness/emitters.py` | 4 / 2 / 188 | ⚠ absent its ENTIRE LIFE — row added 255 · ⛔ |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | 19 / 7 / 1705 (was `17 / 7 / 1679`) | honoured by construction (282-04: Add-form Timeout) · AddModelForm seam OWED · ⛔ |
| `frontend/src/components/workflows/soulData.ts` | 15 / 13 / 556 (was `14 / 12 / 554`) | 296-07: blank label falls back to the key (287-IN-02) |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | 22 / 12 / 1390 (was `21 / 11 / 1385`) | 296-07: onPublished carries the auto_answered notes (one arg) |
| `frontend/src/landing/facts.ts` | 8 / 4 / 546 (was `6 / 3 / 546`) | 293-04: API keys in SURFACE_TABS.settings + .orgAdmin (data only) |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | 8 / 6 / 723 (was `5 / 5 / 473`) | 290: forecast unused — chips went on the library card, not here |
| `frontend/src/components/workflows/doorVocabulary.ts` | 6 / 4 / 540 | no seam proposed |
| `frontend/src/components/workflows/StepTypePicker.tsx` | 7 / 3 / 522 | honoured by construction (199) |
| `frontend/src/components/workflows/library/RunModal.tsx` | 14 / 9 / 752 (was `13 / 8 / 748`) | 299-04: one SavesInOrg under the Run row (UI-D11) |
| `frontend/src/components/panel/PanelEmpty.tsx` | 4 / 4 / 52 | ⚠ absent at 4 phases |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | 14 / 6 / 1160 (was `13 / 6 / 1092`) | 296-07: lock + bind snapshot + every failure; extraction FIRST next |
| `frontend/src/components/workflows/RunSpine.tsx` | 7 / 5 / 441 (was `6 / 4 / 433`) | 295-05: ONE prop (unsourced) |
| `frontend/src/components/workflows/RunTranscript.tsx` | 7 / 3 / 652 | ⚠ **FIRES on a component with NO MOUNT in the product** |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 26 / 10 / 1634 (was `25 / 9 / 1635`) | 297-02: dead #chat hash write deleted (D-37) · item inert → SEED-392 |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | 28 / 10 / 2477 | ⭐ NAMED SEAM TAKEN (239-08) · wider seam OWED · ⛔ |
| `frontend/src/lib/api/org.ts` | 11 / 8 / 629 | ⚠ absent its ENTIRE LIFE · THIRD wire-type drift (239) |
| `frontend/src/components/settings/connectionsCopy.ts` | 16 / 9 / 804 | ⚠ row STALE · honoured by construction (BUG-260912-01) |
| `frontend/src/components/settings/connectionFormCopy.ts` | 19 / 8 / 1631 | seam named (239-05), RODE it (239-07) · ⛔ |
| `frontend/src/pages/SettingsPage.tsx` | 63 / 31 / 1698 (was `62 / 30 / 1690`) | 300-05: one EmailSettings ref/spread/adopt/mount · ⛔ |
| `frontend/src/pages/settingsSearchPayload.ts` | 2 / 2 / 116 | young (created 242) |
| `frontend/src/components/settings/ModelPillRow.tsx` | 5 / 4 / 151 | ⚠ FIRES · honoured by construction (249-02) · ⛔ |
| `frontend/src/components/workflows/phaseVocabulary.ts` | 18 / 8 / 1102 (was `16 / 6 / 990`) | 296-07: own() lookups, STEP_UNTYPED, comparePhaseOrder, engineArmed |
| `frontend/src/components/workflows/ConnectionPicker.tsx` | 7 / 5 / 888 | honoured by construction (206.2 / **214**) |
| `frontend/src/components/workflows/ExternalActionSection.tsx` | 8 / 5 / 179 | honoured by construction (206.2 / **214**) |
| `frontend/src/components/workflows/McpToolPicker.tsx` | 5 / 5 / 601 | honoured by construction (211 / **214**) |
| `backend/app/models/connector.py` | 26 / 14 / 835 | ⚠ row STALE · honoured by construction (244-07) |
| `backend/app/api/connectors.py` | 46 / 22 / 2166 | ⚠ STALE · last touch 276-07 · extraction OWED · ⛔ |
| `backend/app/services/sources/preview_service.py` | 8 / 4 / 826 | ⚠ row STALE TWICE · last touch 238-04 |
| `backend/app/security/secret_cipher.py` | 4 / 2 / 256 | ⚠ absent its ENTIRE LIFE — row added mig 180 · ⛔ |
| `backend/app/security/egress.py` | 13 / 5 / 982 | honoured by construction (232): Google Drive read/export pins; docstri |
| `backend/app/services/connector_service.py` | 28 / 11 / 1858 | ⚠ row STALE · honoured by construction (239-06) |
| `backend/app/services/sources/base.py` | 9 / 5 / 336 | ⚠ absent while FIRING · honoured by construction (239) |
| `backend/app/services/sources/__init__.py` | 5 / 3 / 40 | ⚠ absent while FIRING — row added 239-03 |
| `backend/app/services/mcp_client.py` | 9 / 6 / 526 | ⚠ row STALE TWICE (SEED-258) |
| `backend/app/models/message.py` | 25 / 17 / 292 (was `24 / 16 / 287`) | 293-03: ONE field (run_origin, a dict: a harness import is circular) |
| `backend/app/models/user_settings.py` | 62 / 38 / 1788 (was `61 / 37 / 1776`) | 300-03: four email knobs + _val lines · ⛔ |
| `backend/app/services/harness/reachability.py` | 5 / 5 / 498 (was `4 / 4 / 463`) | 295-02: one pure lint check (no_template_bound) |
| `backend/app/services/workflow_kickoff.py` | 15 / 12 / 608 (was `14 / 11 / 605`) | 299-01: one refuse_if_other_org beside raise_if_foreign (D-18) |
| `frontend/src/components/workflows/WorkflowScheduleModal.tsx` | 6 / 5 / 812 (was `5 / 4 / 723`) | 300-01: outcome words + per-row Run now (D-15/D-16) |
| `frontend/src/lib/api/schedules.ts` | 3 / 3 / 166 (was `2 / 2 / 129`) | ⚠ now FIRES (300) · 300-01: ScheduleRefusalError for the 422 (D-14) |
| `frontend/src/components/workflows/nodePresentation.ts` | 8 / 7 / 221 | ⚠ absent from BOTH for its ENTIRE LIFE at **7 phases** |
| `frontend/src/lib/api/threads.ts` | 25 / 15 / 2006 (was `24 / 14 / 1994`) | 298-02: postMessage reads detail.message + code (object detail) · ⛔ |
| `frontend/src/lib/api/connectors.ts` | 17 / 11 / 740 | honoured by construction (244-06) · ⛔ |
| `frontend/src/lib/api/workflows.ts` | 17 / 16 / 1395 (was `16 / 16 / 1364`) | 299-04: run org_id; ?from_definition_id=; WorkflowOrgRefusedError on the 409 |
| `frontend/src/lib/connectionMark.tsx` | 7 / 4 / 313 | ✅ **the move IS the seam, and it was TAKEN (214-08)** |
| `frontend/src/components/ingestion/DocumentList.tsx` | 31 / 15 / 372 (was `31 / 16 / 372`) | last touch 275-02/04 |
| `frontend/src/pages/LibraryPage.tsx` | 70 / 21 / 1347 (was `69 / 21 / 1346`) | 298-review WR-01: one listReset property on useLibraryOrgSwitch · ⛔ |
| `backend/app/services/retrieval_service.py` | 25 / 14 / 181 (was `24 / 13 / 176`) | ✅ DISCHARGED 272-01 · 294-01: instruction kwarg + redacted trace (+6 −1) |
| `backend/app/services/retrieval_scope.py` | 7 / 5 / 503 (was `6 / 4 / 463`) | 284-04: `_fetch_all` moved in verbatim · extraction FIRST next · ⛔ |
| `backend/app/services/document_search_service.py` | 8 / 4 / 505 (was `5 / 3 / 584`) | 284-04: one view read; two-legs invariant RETIRED deliberately · ⛔ |
| `backend/app/services/view_filter_compiler.py` | 7 / 6 / 302 (was `6 / 5 / 300`) | ⚠ FIRES, absent here — row added 278-04 · 278-02 vocabulary import |
| `backend/app/services/recall_eval.py` | 4 / 3 / 1070 | ⚠ FIRES (3 phases) · safe as-is (D-246-12) |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | 17 / 12 / 668 (was `16 / 11 / 666`) | 298-05: one MoveToOrgButton mount in the Download row (onMoved=onClose) |
| `frontend/src/hooks/useDocuments.ts` | 10 / 5 / 164 (was `8 / 3 / 120`) | 284-03: no list of its own; Realtime only asks for a refetch · ⛔ |
| `frontend/src/pages/KnowledgeHealthPage.tsx` | 12 / 6 / **DELETED** | **RETIRED (217.1-14)** |
| `backend/app/api/knowledge_health.py` | 11 / 6 / 737 | honoured by construction (**217.1-11**) |
| `backend/app/services/agent_loop.py` | 78 / 36 / 3782 (was `78 / 35 / 3776`) | 296-06: save-point log w/o preview; substituted notice streamed · ⛔ |
| `backend/app/services/tool_dispatcher.py` | 99 / 44 / 274 (was `98 / 43 / 5068`) | ✅ G-5 DISCHARGED (278-03): registry only; handlers in services/tools/ · ⛔ |
| `backend/app/services/search_documents_tool.py` | 11 / 3 / 1544 | ⚠ now FIRES (294) · 294-01: instruction clamp (+25 −3) · extraction FIRST |
| `backend/app/api/document_governance.py` | 5 / 3 / 416 | ⚠ absent at 3 phases. ⚠ Its low-confidence cutoff is the ConfidenceChi |
| `frontend/src/components/ingestion/ViewsGroup.tsx` | 5 / 3 / 259 | ⚠ absent for its ENTIRE LIFE at **3 phases** |
| `frontend/src/components/ui/tabs.tsx` | 3 / 3 / 78 | ⚠ absent for its ENTIRE LIFE |
| `frontend/src/components/panel/CsvTablePreview.tsx` | 3 / 3 / 134 | ⚠ absent for its ENTIRE LIFE |
| `frontend/src/components/workflows/verdictModel.ts` | 8 / 4 / 363 (was `6 / 3 / 355`) | 295-02: one Record entry (BLOCKED_SENTENCE.lint) |
| `frontend/src/components/library/IngestionTab.tsx` | 20 / 7 / 706 (was `17 / 6 / 512`) | 284-03: summary + three paged status lists; layout unchanged · ⛔ |
| `frontend/src/components/ingestion/__tests__/IngestionStrip.test.tsx` | 3 / 3 / 516 | ⚠ absent; row added 233, which repaired the INHERITED red `229-03` cau |
| `frontend/src/components/layout/NavPanel.tsx` | 26 / 14 / 420 (was `25 / 14 / 416`) | last touch 276-01 / 276-06 (D-27) |
| `frontend/src/App.tsx` | 44 / 30 / 350 (was `43 / 30 / 349`) | 299-02: one prop (entityLink) |
| `frontend/src/main.tsx` | 5 / 3 / 32 (was `3 / 1 / 10`) | ⚠ now FIRES (297) · one '*' route, no children, no key · ⛔ |
| `frontend/src/index.css` | 35 / 19 / 1239 (was `34 / 18 / 1196`) | 294-05: ONE verdict block keyed on citation-marker--v-* (+43) |
| `frontend/src/components/library/LibraryCloudImport.tsx` | 1 / 1 / 194 | young (created 244-06) · ⛔ |
| `frontend/src/components/library/LibraryHeaderBar.tsx` | 5 / 4 / 262 (was `4 / 3 / 249`) | 284-03: optional `totalState`; never 0 before an answer |
| `frontend/src/lib/nav-items.ts` | 13 / 9 / 173 (was `12 / 8 / 153`) | last touch 283-02: Settings door ungoverned (FIX-01) |
| `backend/app/api/classification_rules.py` | 3 / 3 / 226 | row added 237 at threshold |
| `frontend/src/components/classification/RuleBuilderPanel.tsx` | 6 / 5 / 501 (was `4 / 3 / 502`) | ⚠ STALE · last touch 271-02 · ⛔ |
| `backend/app/api/workspace.py` | 16 / 8 / 848 (was `13 / 7 / 757`) | ⚠ STALE · last touch 274-01 · ⛔ |
| `frontend/src/components/panel/TemplateUpload.tsx` | 2 / 2 / 91 | ⚠ absent its entire life — row added 244-02 |
| `frontend/src/lib/stripComments.testutil.ts` | 1 / 1 / 28 | young (created 244-14 / IN-02) · ⛔ |
| `frontend/src/lib/workspaceAllowedExt.ts` | 1 / 1 / 54 | young (created 244-02) |
| `frontend/src/components/chat/ChatAttachmentChip.tsx` | 1 / 1 / 144 | young (created 244-05) |
| `frontend/src/components/chat/composerCopy.ts` | 5 / 3 / 122 (was `2 / 1 / 103`) | ⚠ now FIRES (296) · 296-04: three start-failure sentences · ⛔ |
| `frontend/src/components/chat/ConnectedFilePickerModal.tsx` | 3 / 2 / 336 | ⚠ absent its ENTIRE LIFE — row added 244-06 |
| `frontend/src/components/chat/useComposerAttachments.ts` | 1 / 1 / 158 | young (created 244-06) · the seam 244-05 named |
| `backend/app/services/oauth_refresh_service.py` | 5 / 3 / 362 | ⚠ absent its ENTIRE LIFE — row added BUG-260912-01 |
| `frontend/src/components/sources/SourceFolderPicker.tsx` | 2 / 2 / 375 | ⚠ absent its entire life — row added BUG-260912-01 · ⛔ |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | 8 / 4 / 645 | ⛔ row STALE · G-5 fires (252-03) · Seam OWED |
| `backend/app/services/sources/failure_cause.py` | 3 / 2 / 227 | ⚠ absent its entire life — row added BUG-260912-01 · ⛔ |
| `scripts/full-schema-supplement.sql` | 25 / 17 / 863 (was `23 / 15 / 848`) | 296-01: mig 216 handle_new_user copy, one expression (no-email name) · ⛔ |
| `.claude/settings.json` | 14 / 6 / 214 | ⚠ STALE · last touch 276 · ⛔ |
| `backend/app/services/forced_emit.py` | 15 / 9 / 749 (was `13 / 8 / 724`) | 296 (293-F-4): cross-provider copy names the target provider · ⛔ |
| `backend/app/services/template_asset_service.py` | 5 / 4 / 379 (was `4 / 3 / 344`) | 295-02: has_staged_template (Branch-2 WHERE shared) |
| `backend/app/db/entitlements.py` | 2 / 1 / 169 | young (created 258) |
| `backend/app/services/entitlement_service.py` | 2 / 1 / 130 | young (created 258) |
| `backend/app/db/experts.py` | 5 / 4 / 749 | ⚠ row STALE · last touch 266-01 · ⛔ |
| `backend/app/models/expert.py` | 6 / 4 / 131 | ⚠ STALE · last touch 267-01 |
| `frontend/src/lib/api/experts.ts` | 13 / 7 / 424 (was `12 / 6 / 422`) | 299-REVIEW WR-03: thrown Error carries res.status (one expression) |
| `backend/app/services/expert_service.py` | 11 / 7 / 619 | ⚠ STALE · last touch 267-01 · ⛔ |
| `backend/app/services/expert_authoring.py` | 7 / 3 / 393 | ⚠ now FIRES (`5/2/393`). **267-01**: one prompt line (tool floor has no effect) |
| `frontend/src/components/experts/ExpertAuthoringStudio.tsx` | 6 / 3 / 1550 | ⚠ now FIRES · last touch 267-03 · Extraction OWED |
| `backend/app/api/experts.py` | 16 / 7 / 833 (was `14 / 6 / 822`) | honoured by construction (279-02: ONE expression) · Extraction OWED |
| `backend/app/dependencies.py` | 24 / 12 / 1147 | ⚠ absent here at 12 phases — row added 267-05 |
| `backend/app/utils/skill_visibility.py` | 3 / 2 / 209 | ⚠ row STALE · last touch 264-02/04 · ⛔ |
| `frontend/src/components/chat/ActiveExpertChip.tsx` | 2 / 2 / 53 | ⚠ row read 0/0/0 · last touch 268-03 |
| `frontend/src/components/chat/ExpertSpotlightCard.tsx` | 5 / 4 / 269 (was `2 / 2 / 205`) | ⚠ now FIRES · honoured by construction (279-03) · extraction FIRST · ⛔ |
| `frontend/src/components/chat/InviteExpertDialog.tsx` | 10 / 5 / 648 (was `4 / 4 / 614`) | honoured by construction (279-03: ONE field + prop) · seam TAKEN |
| `frontend/src/components/skills/SkillFormDialog.tsx` | 13 / 9 / 657 | ⚠ row STALE · honoured by construction (263-04) · ⛔ |
| `backend/app/api/skills.py` | 20 / 10 / 859 (was `19 / 10 / 858`) | ⛔ FIRES · last touch 280-01 (6 maybe_row guards) |
| `frontend/src/lib/api/skills.ts` | 10 / 7 / 779 (was `9 / 6 / 767`) | 300-05: four optional email fields + provider |
| `frontend/src/lib/api/settings.ts` | 11 / 5 / 529 | ⚠ FIRES, absent here — row added 300-05 · switch's own PUT (D-09) · ⛔ |
| `backend/app/services/openai_service.py` | 84 / 42 / 2731 (was `81 / 41 / 2623`) | 292: SHOW_ARTIFACT_TOOL schema + description only (30 tools) · ⛔ |
| `backend/app/services/provider_gateway/openai_compat.py` | 10 / 7 / 468 (was `9 / 6 / 466`) | 296-06: one moonshot_tools conditional keyed on the endpoint provider |
| `backend/app/services/provider_gateway/dispatcher.py` | 10 / 4 / 260 (was `6 / 2 / 153`) | ⚠ FIRES (row was stale) · 282-01: off-loop open, shared deadline · ⛔ |
| `backend/app/services/provider_gateway/openai_responses.py` | 4 / 3 / 570 (was `2 / 2 / 573`) | ⚠ now FIRES · 292.1-REVIEW IN-03: dead dsml_leaked flag deleted · ⛔ |
| `frontend/src/lib/api/admin.ts` | 10 / 5 / 1125 (was `9 / 5 / 1122`) | ⚠ FIRES · quick-261024: optional `returned` on discovery outcome · ⛔ |
| `frontend/src/components/admin/CapabilityGrid.tsx` | 3 / 3 / 264 | ⚠ FIRES at 3 phases · row added 263-REVIEW WR-07 · ⛔ |
| `frontend/src/components/admin/ModelAdvancedCapabilities.tsx` | 0 / 0 / 290 | young (created 262) · ⛔ |
| `frontend/src/lib/activeViewReachability.ts` | 2 / 2 / 205 (was `1 / 1 / 159`) | 297-02: route leg added (D-25) · AST; throws on a vacuous parse · ⛔ |
| `frontend/src/components/experts/expertIcon.tsx` | 1 / 1 / 72 | ⚠ 0/0/0 AT PLANNING · measured 1/1/72 at 262-02 · ⛔ |
| `frontend/src/components/experts/catalog/expertCatalog.ts` | 15 / 5 / 508 (was `13 / 4 / 489`) | honoured by construction (279-03: ONE `onThread` option) |
| `frontend/src/components/experts/catalog/ExpertCard.tsx` | 5 / 4 / 296 | ⚠ STALE (`3/3/295`). **276-07**: category text via `decodeEntities` |
| `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx` | 12 / 7 / 394 (was `11 / 7 / 376`) | 299-REVIEW WR-03: refused link → CantBeOpened over catalog (+1 prop) |
| `frontend/src/components/experts/catalog/ExpertDetailModal.tsx` | 9 / 6 / 540 (was `8 / 6 / 536`) | 299-04: link in the header + Saves in beside Start a chat (D-20) |
| `frontend/src/components/experts/catalog/startScopedChat.ts` | 1 / 1 / 70 | ⚠ 0/0/0 AT PLANNING · measured at 262-04 · ⛔ |
| `backend/app/services/ingest_splice.py` | 22 / 8 / 1043 (was `19 / 7 / 930`) | honoured by construction (280: minter-only hunks) · ⛔ |
| `frontend/src/components/ingestion/FolderTree.tsx` | 16 / 10 / 225 (was `15 / 10 / 221`) | 298-05: one ElsewhereLine mount above Root (+ its import) |
| `frontend/src/components/ingestion/FolderNode.tsx` | 16 / 9 / 319 (was `15 / 8 / 316`) | 298-05: one MoveToOrgMenuItem mount; menu widens by CSS has-[] only |
| `frontend/src/components/ingestion/NavRow.tsx` | 6 / 4 / 269 | ⚠ absent its ENTIRE LIFE — row added 266-05 · ⛔ |
| `backend/app/models/document.py` | 14 / 11 / 275 (was `13 / 10 / 221`) | 284-02: five paged envelopes, additive · ⛔ |
| `frontend/src/components/ingestion/DocumentRow.tsx` | 11 / 6 / 591 (was `10 / 5 / 583`) | 284-03: one versions page, N of M; still seven `<td>` |
| `frontend/src/components/org/OrgAdminShell.tsx` | 10 / 6 / 416 (was `7 / 5 / 454`) | ✅ seam TAKEN 293-04 (orgAdminTabs.ts, move-only) · +1 render branch · ⛔ |
| `frontend/src/components/admin/AuditTab.tsx` | 8 / 5 / 771 (was `7 / 4 / 770`) | 298-review WR-07: one map entry (org.item.move), data only |
| `frontend/src/components/org/OrgAuditTab.tsx` | 5 / 4 / 416 (was `4 / 3 / 415`) | 298-review WR-07: one map entry (org.item.move) · shared vocab OWED |
| `frontend/src/lib/api/documents.ts` | 11 / 10 / 599 (was `10 / 9 / 595`) | 298-01: uploadDocument sends X-Org-Id read at send time (D-29) · ⛔ |
| `frontend/src/providers/OrgProvider.tsx` | 4 / 3 / 222 (was `3 / 2 / 217`) | ⚠ now FIRES (298) · 298-01: self-heal syncs the header first (D-36) · ⛔ |
| `backend/app/api/folders.py` | 17 / 11 / 298 (was `16 / 10 / 288`) | 298-01: one org_lists.folder_kw keyword ×2 list routes (narrows only) |
| `backend/app/api/kb.py` | 14 / 9 / 515 (was `13 / 8 / 504`) | last touch 275-02 · ⛔ |
| `backend/app/services/audit_service.py` | 10 / 10 / 100 (was `9 / 9 / 98`) | 298-03: one lockstep literal (org.item.move, mig 217) · ⛔ |
| `backend/app/services/expert_scope.py` | 8 / 4 / 159 (was `6 / 3 / 632`) | ✅ G-5 DISCHARGED (279-01): pure / statement / events |
| `backend/app/services/document_relationship_service.py` | 6 / 4 / 465 (was `5 / 3 / 457`) | honoured by construction |
| `backend/app/api/sources.py` | 11 / 5 / 713 (was `10 / 4 / 698`) | honoured by construction (285-02: purge scope via db helper) · ⛔ |
| `backend/app/models/document_search.py` | 3 / 3 / 174 (was `2 / 2 / 171`) | ⚠ now FIRES · last touch 275-03 · ⛔ |
| `backend/app/services/document_view_resolver.py` | 6 / 6 / 486 (was `5 / 5 / 412`) | 284-04: two read strategies, ONE fragment walk · ⛔ |
| `backend/app/services/retrieval_documents.py` | 3 / 3 / 206 (was `1 / 1 / 174`) | ⚠ now FIRES · last touch 275-02 |
| `frontend/src/pages/findState.ts` | 3 / 3 / 374 (was `2 / 2 / 361`) | ⚠ now FIRES · last touch 275-02 · STRICT LEAF · ⛔ |
| `frontend/src/components/chat/expertEventCopy.ts` | 5 / 3 / 315 | ⚠ now FIRES (279) — row added 279-04 · extraction FIRST · ⛔ |
| `frontend/src/components/experts/ScopeLedger.tsx` | 6 / 3 / 126 | ⚠ now FIRES (279) — row added 279-04 · extraction FIRST · ⛔ |
| `backend/app/services/sources/adapters/microsoft_graph.py` | 8 / 5 / 507 (was `3 / 2 / 376`) | ⚠ now FIRES (5 phases) — row added 280-04 · honoured by construction |
| `frontend/src/components/workflows/runVocabulary.ts` | 10 / 5 / 662 | ⚠ FIRES, absent here — row added 281-04 · honoured by construction |
| `frontend/src/components/workflows/definitionOps.ts` | 16 / 5 / 1140 (was `15 / 5 / 1129`) | ⚠ added 296-07 (D-26) · receipt saved + escalated no-check words |
| `frontend/src/components/workflows/templateFirstVocabulary.ts` | 4 / 3 / 453 | ⚠ now FIRES (296) · 296-07: three describe-door strings (data) |
| `frontend/src/components/workflows/declaredInputsVocabulary.ts` | 4 / 3 / 172 | ⚠ now FIRES (296) · 296-07: look-up not wired (words); blank options |
| `frontend/src/components/workflows/describeRefusalVocabulary.ts` | 5 / 3 / 203 | ⚠ now FIRES (296) · 296-07: one refusal row (provider_error) |
| `frontend/src/components/workflows/DescribeTemplateRow.tsx` | 3 / 3 / 581 | ⚠ now FIRES (296) · 296-07: disabled prop + UnplacedSentencesNote |
| `frontend/src/components/workflows/TemplateAttachSection.tsx` | 6 / 3 / 450 (was `5 / 3 / 411`) | ⚠ now FIRES (296) · 296-07: labels, PDF Replace, bind split |
| `frontend/src/components/workflows/GovernanceSection.tsx` | 6 / 3 / 455 | ⚠ absent its entire life — row added 296-07 (D-26) · seal detected-only |
| `frontend/src/components/workflows/NodeCornerMarks.tsx` | 5 / 3 / 305 | ⚠ absent its entire life — row added 296-07 (D-26) · unmodified |
| `frontend/src/lib/api/knowledge.ts` | 10 / 8 / 915 (was `8 / 7 / 910`) | 296-07: covered_by may be null (types only) · ⛔ |
| `backend/app/services/google_service.py` | 12 / 8 / 661 | ⚠ absent its ENTIRE LIFE — row added 282 · 282-01: ONE builder · ⛔ |
| `backend/app/services/provider_gateway/anthropic.py` | 5 / 5 / 125 | ⚠ absent its ENTIRE LIFE — row added 282 · 282-01: ONE kwarg · ⛔ |
| `backend/app/services/provider_gateway/google.py` | 4 / 4 / 107 | ⚠ absent its ENTIRE LIFE — row added 282 · 282-01: ONE kwarg · ⛔ |
| `backend/app/api/document_views.py` | 13 / 6 / 323 | ⚠ FIRES, absent here — row added 284-05 · honoured by construction · ⛔ |
| `backend/app/models/document_view.py` | 6 / 4 / 119 | ⚠ FIRES, absent here — row added 284-05 · additive fields (284-04) |
| `frontend/src/components/ingestion/FolderDetail.tsx` | 4 / 3 / 83 | ⚠ now FIRES (284) — row added 284-05 · number props (284-01) |
| `frontend/src/components/library/DocumentsPager.tsx` | 4 / 3 / 101 | ⚠ now FIRES (284) — row added 284-05 · ROW_CAP arm deleted · ⛔ |
| `frontend/src/components/library/find/FindQuickAdd.tsx` | 5 / 3 / 394 | ⚠ now FIRES (284) — row added 284-05 · `documents` prop deleted |
| `frontend/src/components/library/find/StructurePopovers.tsx` | 5 / 3 / 746 | ⚠ now FIRES (284) — row added 284-05 · server-mode picker · ⛔ |
| `frontend/src/components/metadata/DocumentChunksSection.tsx` | 4 / 3 / 265 | ⚠ now FIRES (284) — row added 284-05 · sentinel paging · ⛔ |
| `frontend/src/components/relationships/CreateLinkDialog.tsx` | 5 / 3 / 267 | ⚠ now FIRES (284) — row added 284-05 · server type-ahead · ⛔ |
| `backend/app/services/watch_service.py` | 8 / 6 / 769 | ⚠ FIRES, absent here — row added 285-03 · honoured by construction (285-01) |
| `backend/app/db/watches.py` | 6 / 4 / 828 | ⚠ FIRES, absent here — row added 285-03 · honoured by construction (285-02) |
| `frontend/src/components/sources/RunHistoryList.tsx` | 5 / 3 / 275 | ⚠ now FIRES (285) — row added 285-03 · comment-only change (285-01) |
| `frontend/nginx.conf` | 3 / 3 / 76 | ⚠ now FIRES — row added 293-REVIEW WR-01 · one proxy header · ⛔ |
| `frontend/src/hooks/useFolders.ts` | 5 / 4 / 200 (was `4 / 4 / 197`) | 298-05: useOrgItemsVersion() in the load deps (a move refetches) |
| `frontend/src/hooks/useAuth.ts` | 6 / 5 / 128 (was `5 / 4 / 100`) | ⚠ absent while FIRING — row added 299-05 · redirect + .catch · ⛔ |
| `frontend/src/pages/AuthPage.tsx` | 5 / 3 / 32 (was `4 / 2 / 26`) | ⚠ now FIRES (299) · 299-05: one quiet S5 line (kind only) |
| `backend/app/api/org.py` | 12 / 4 / 1068 (was `11 / 3 / 1024`) | 300-03: invite email_delivery stored + returned (D-11) |
| `backend/app/services/email_provider.py` | 6 / 3 / 362 (was `5 / 3 / 374`) | ⚠ now FIRES (300) · 300-03: one mailer seam (D-21) · ⛔ |
| `frontend/src/components/admin/HealthSignals.tsx` | 6 / 5 / 407 (was `5 / 4 / 316`) | 300-04: one Email tile (D-12, UI-D13); Off / Held back never red |


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
