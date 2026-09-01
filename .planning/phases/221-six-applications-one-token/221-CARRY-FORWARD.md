# Phase 221 — carry-forward: everything NOT done

**Written at the phase close, 2026-09-01, at the operator's instruction: *"make sure you
capture everything that we did not do so we can keep it not lose it in the next phases."***

⚠ Every row below carries a RE-OPEN TRIGGER. A deferral with no trigger is a deletion wearing
a decision's clothes — this repo has measured that twice, and `.planning/seeds/` is swept by
nothing but the two touchpoints CLAUDE.md added on 2026-08-19.

---

## A · BLOCKED ON THE OPERATOR — nothing moves without these

| # | What | Why it is not done | Re-open trigger |
|---|---|---|---|
| A1 | ⛔ **510 commits are NOT PUSHED** | `e5977a244` is in the range, is **not yet on GitHub**, and carries two LIVE keys in plaintext in `LLM_SWITCHING_GUIDE.md`: Zhipu/GLM `93c4627a…YZL9cUMnVZGPvfxV` and Moonshot/Kimi `sk-ork6n2eE…D06S9tsb`. BUS-040 called them "published"; that was the LOCAL commit. **The window to avoid real publication is still open and a push closes it.** | Any `git push origin develop`. Resolve first: revoke both keys, or strip that file from history, or push knowingly. |
| A2 | ⛔ **`api_off` end-to-end UAT** | Needs an API switched OFF in Google Cloud project `877112366454` — the operator's console, an outward-facing change. Covered by unit tests against their own recorded 2026-08-31 bodies and RED-driven, which is a **different claim** from passed. | One step: disable Sheets, press Check, confirm ONLY Sheets says `api_off` with a working link, re-enable, press Check, confirm the line disappears. |
| A3 | ⛔ **One Gmail draft not deleted** | `r807530666500982642`, *"AGENTIC-RAG UAT 221 — draft 2026-09-01 09:10"*. `drafts.delete` permanently removes a message with no trash behind it. The other 11 artefacts were removed into 30-day bins. | Operator bins it manually — ten seconds, it is named and unsent. |
| A4 | ⚠ **Google consent screen is in TESTING mode** | Refresh tokens die every 7 days; the live one was minted 2026-08-31 21:46, so it lapses around **2026-09-07**. Publishing needs Google verification + an annual paid CASA assessment (restricted scopes). | The connection breaks, or a B2B launch date is set. Whichever is first. |
| A5 | ⚠ **`gh` active account was switched** | Set to `fhdmrddev-dotcom` to reach the repo; `fhdmrd` was active and 404'd (the recorded account trap, not a deleted repo). | Operator switches back if they care: `gh auth switch --user fhdmrd`. |

---

## B · DECISIONS PUT TO THE OPERATOR, NOT TAKEN BY ME

| # | Decision | Seed |
|---|---|---|
| B1 | **"Always allow" grants ONE ACTION.** Moving it to the app rung would NOT fix a chain of writes — D-221-06 caps an app allow at `ask` on every write. Three options costed; none implemented, because it is a change to a security boundary. | **SEED-236** |
| B2 | **An RLS policy on `connector_tokens`.** The workaround ships; the fix is a migration, and a policy on a credential table is the operator's call. | **SEED-233** |
| B3 | **A receipt per approval decision.** A message carries ONE `toolApproval` slot, so a second approval replaces the first card's receipt. The RunCard's tool list still shows both calls, so the fact is not lost — but a receipt per decision is a design change, not a bug fix. | — (recorded in BUS-042) |
| B4 | **Google Contacts still draws the generic G.** Re-measured: `logos`, `vscode-icons`, `lobehub` and `simple-icons` ALL lack `googlecontacts`. Sheets and Docs were fixed from simple-icons' official paths. Full multi-colour tiles for all six would mean hand-authored SVGs, which the icon convention forbids — a convention change, so the operator's call. | trigger in `connectionMark.tsx`, narrowed from three marks to one |

---

## C · DEFECTS FOUND AND DELIBERATELY NOT FIXED

| # | Defect | Seed |
|---|---|---|
| C1 | `connector_tokens` has **RLS enabled with ZERO policies** — every user-JWT read returns empty, and `GET /connections/{id}/oauth/token` **404s on rows that exist**. A shipped endpoint with a client function that has probably never worked. | **SEED-233** |
| C2 | `create_file` **already mints a native Google Sheet**, so the recorded "no `create_spreadsheet`" gap is DISCOVERABILITY, not capability. Plus: three Sheets tools refuse an `.xlsx` with a bare `FAILED_PRECONDITION` (SEED-228's defect on three more tools), and `search_files` cannot filter by type at all — so a model asked to "put this in a spreadsheet" will pick the wrong file and hit it. | **SEED-234** |
| C3 | With a connector not enabled for the chat, the model answers *"I can't create a literal Google Doc (no Google Docs API access)"* and silently writes a `.docx` instead. That is BUS-040's fix working correctly (absent and empty both mean none) — but the SENTENCE is a claim about the PRODUCT'S capability when the truth is *"you did not enable this connection for this chat"*. **A refusal naming the wrong cause, one layer up from the ones this phase closed.** | ⚠ **no seed yet — capture it if it is not fixed in the next connector phase** |
| C4 | **Microsoft 365**: OAuth completes and yields ZERO tools. **MCP**: still authenticates with a pasted token; the PKCE machinery exists and the MCP client never calls it. | **SEED-237** |

---

## D · ENVIRONMENT TRAPS THAT COST TIME — do not rediscover

| # | Trap |
|---|---|
| D1 | ⚠ **`uvicorn --reload` HANGS on this backend.** WatchFiles logs *"Reloading..."* and no *"Started server process"* follows; the pre-edit worker keeps serving. **Three live checks looked like code failures before this was understood.** Every verification in this session used a hard restart (`taskkill /T /F` on the port holder, then relaunch). A reload that silently does nothing is worse than one that fails. |
| D2 | ⚠ **Backend and frontend files are a MIX of LF and CRLF.** Detect per file before editing; an anchor written with `\n` silently matches zero times in a CRLF file, and a script that asserts a match count catches it while one that does not will half-apply. |
| D3 | ⚠ **My own RED harness was BLIND once.** The first frontend plant run reported *five for five, zero failing assertions* — because `--reporter=basic` does not exist in vitest 4 and every run died before executing. A **positive control** (an unmutated run must read 28 passed) caught it, then caught a second bug in the summary parser. **A harness that cannot see a clean run cannot see a dirty one.** |
| D4 | ⚠ **A plant that does not fire may mean the TEST is decorative, not that the code is safe.** One guard survived its mutation because `_time_field` decides the all-day arm first, on length, so the offset logic is never reached for a bare date. The test could not fail. It was replaced with the invariant that actually holds. |
| D5 | ⚠ **Five duplicate SEED ids**: `SEED-022`, `SEED-092`, `SEED-228`, `SEED-229`, `SEED-231` each name two different files. `status:` frontmatter IS the index, so one of each pair will be answered and the other will silently inherit the resolution. |

---

## E · TEST-GATE DEBT

| # | Item |
|---|---|
| E1 | **Six suites remain unpinned** and the gate prints them as `new` every run: `PromptVariableChips` (3), `RunHero` (18), `automationFacts` (11), `nodeEffectBanner` (8), `toolReadOnlyMap` (7). **SEED-229** proposes the gate self-check that would end this class. |
| E2 | ⚠ **The gate caught a hand-split pin this session** (18/10 pinned as 20/8). Pins are read from the gate's own printed column, never counted by hand — the rule fired, as designed. |

---

## F · WHAT THE ROADMAP PAGE SAYS, AND THAT IT IS NOT SCHEDULED

The integration roadmap was delivered as a published page
(`https://claude.ai/code/artifact/43b90ad1-ec5e-47cb-a24c-e63b5b01004a`) and its sequence —
discover what is configured → give the MCP door a real front step → open the catalog → finish
Microsoft → reads into retrieval → be connected as well as connecting — **has no phase numbers
on `.planning/ROADMAP.md`.** SEED-177's own re-open trigger #3 is *"Open Platform slips past
the point where breadth is commercially needed"*, measured 0 hits on the roadmap on 2026-08-18
and still 0 today.

**Re-open trigger:** the next milestone scoping conversation, or any customer conversation
where connector breadth is the answer.
