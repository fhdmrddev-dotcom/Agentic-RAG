# Reconciliation — outside platform architecture read, 2026-09-18

**Reviewed document:** [`2026-09-18-outside-platform-architecture-read.md`](2026-09-18-outside-platform-architecture-read.md)
**Reconciled by:** Claude Code, in-tree, 2026-09-18
**Verdict:** ⚠ **Read it with this note open. The document is ONE FULL MILESTONE STALE and four of
its nine "challenges" were already closed when it was written.** Its commercial framing survived
reconciliation. Its engineering assessment largely did not.

---

## ⛔ The stale premise, stated first because everything else inherits it

The document reads the repository at **v4.1** and says *"phases resume at 247"*.

**v4.2 (phases 247-254, tag `v4.2`) shipped on 2026-09-18 — the same day the document was
written.** Phases resume at **255**. The reviewer had no working tree, and by its own §0 did not
read `ROADMAP.md`, `MILESTONES.md` or `PROJECT.md`.

---

## What was ALREADY CLOSED when the document was written

| Its claim | Measured on 2026-09-18 |
|---|---|
| **C1** — `production` is 287 commits behind; v4.1 is undeployed | **v4.1 IS deployed.** `origin/production` tip is the v4.1 deploy merge (`eebc4c42f`, 2026-09-13); migrations 179 and 180 are applied and verified in cloud. ⚠ The *conclusion* survives for a different reason: v4.2's own output was then 244 commits undeployed, and migration **181 was already applied in cloud** — the schema was AHEAD of the code |
| **C4** — 8 duplicate seed IDs; register integrity | **Closed by Phase 251.** `node scripts/check-seeds-register.cjs` reads `301/301 parsed · 0 duplicate ids`, with a `TEMPLATE.md` contract and an executable sweep wired at both GSD touchpoints |
| **C9** — `SEED-172`, local models must be added by hand | **Closed by Phase 249.** Local and self-hosted models register from the Model Registry UI with no code edit and no deploy. ⭐ That phase also measured 13 of the operator's configured models silently losing tool calling, and made the composer say so at pick time |
| **5.1** — "group the action-grant surface by application; 27 Google plus 40 Notion tools in a flat list is unusable" | **Shipped in Phase 221 (v3.9).** `ConnectionGrantsList.tsx` groups by application, carries a search box, hides a group matching nothing, and renders an explicit zero-result state reading *"No action matches that."* |

## What was REFUTED by measurement

**C8's headline defect — *"27 tools discovered against a token that was never persisted"* — is
false.** It is an artifact of reading one column without the tree.

Measured directly against production on 2026-09-18:

- `connector_connections.secret_ciphertext` is `NULL` on the Google row — **correct by design.**
  `static_key` connections store their secret there; `oauth_byo` connections do not.
- The OAuth tokens live in **`connector_tokens`**, and that row exists: `access_token_ciphertext`
  and `refresh_token_ciphertext` are **both present**.

⚠ **One C8 sub-claim is UNRESOLVED, not refuted:** an input in the connection panel allegedly
serving as both an identity display and a filter over the action list. That cannot be settled
from the database and needs a live drive before it is believed or dismissed.

## What was OVERSTATED

| Its claim | Correction |
|---|---|
| **C2** — "org multi-tenancy dormant"; you cannot run a hosted offering | **v3.4 shipped the one-way RLS door** — orgs, membership RLS, SAML SSO, migrations 104-113. `SEED-004`'s live residue is the **DEPARTMENT / role axis**, not org isolation. Of its "four discoveries of one shape", `SEED-124` is **folded** and `SEED-125` is **closed**; only `SEED-129` and `SEED-091` remain |
| **C6** — the monoliths, naming `retrieval_service.py` | The three sizes are **accurate** (measured: `tool_dispatcher.py` 261 KB / 5,048 L · `agent_loop.py` 203 KB / 3,441 L · `harness_engine.py` 183 KB / 3,135 L). But `retrieval_service.py` is **456 lines / 22 KB** — an extraction debt under G-5, not a monolith. Two different problems were merged |
| **§11 M-A** — the milestone shape | Half of it was already done: the 287-commit promotion and the duplicate seed IDs both |

## What was ALREADY PLANNED, and who owns it

The document proposed these as new. Each already has a seed, most of them older than the read.

| Its item | Owner |
|---|---|
| **P1** vertical pack format — "the SKU everything hangs from" | **`SEED-198`** (Experts / domain bundles) — planted, **priority high**, trigger already fired at the Connections milestone |
| **P14** attachments on outbound payloads | **`SEED-225`** — planted, operator-raised during Phase 214. ⭐ **Confirmed real:** `smtp_adapter.py:289` — *"No CC, no BCC, no attachment, no HTML part"* (D-32) |
| Period / version filtering discipline | **`SEED-153`** |
| **P6** privacy and redaction | `SEED-079` |
| **P9** sovereign deployment | `SEED-003`, `SEED-075` |
| Metering and entitlement | `SEED-073`, `SEED-074`, `SEED-080`, `SEED-083`, `SEED-120` |
| **P11 / P12** partner MCP directory, connector SDK | `SEED-013`, `SEED-146` — the one unbuilt slot left in `PRDs/SEQUENCE.md` |

## ⭐ What was GENUINELY NEW — the reason this document is archived rather than discarded

Four things, each now planted as a seed:

| New finding | Planted as |
|---|---|
| The extension contract — *a plugin is data, an external process, or sandboxed code; never engine code*, and "closed core, open edges" as a stated position | **`SEED-291`** |
| **Assurance export** — ~106 KB of eval machinery produces no artifact a buyer can file. ⭐ Its best original idea; measured and confirmed real | **`SEED-292`** |
| **Airia** — zero hits anywhere in `.planning/` or `docs/`. The v3.6 crawl declared the governance position unoccupied and missed the company occupying it | **`SEED-293`** |
| The commercial umbrella — packs as SKUs, marketing, sponsorship, and the **two operator blockers** (no legal entity; unsettled employment / IP) | **`SEED-294`** |

## What to ignore in it

- **§11's milestone shapes wholesale.** Written blind to `ROADMAP.md` by the author's own
  admission, and partly already shipped.
- **§9.1-9.3 market figures.** Unverified web-sourced, and the document says so.
- **§6's licensing table.** Rests entirely on metering that does not exist.
- **The trade-show question.** Operator territory, and time-expired.
- **C7 recall.** Settled by query plan in Phase 246; re-open only via `SEED-273`, and only by
  inspecting a plan rather than a recall number.

---

## The method note, which is the durable lesson

**A review is a CLAIM about code, not the code.** This document was careful, well-structured, and
marked its own confidence honestly — and it was still wrong about the deployment state, wrong
about the credential store, and a milestone behind, because it could not run anything. Its
`[VERIFIED]` markers meant *"I read a directory listing"*, not *"I measured it"*.

⛔ **Do not quote any figure from it without re-deriving that figure.** Its value is in the four
seeds above and in the framing; not in a single number it states.
