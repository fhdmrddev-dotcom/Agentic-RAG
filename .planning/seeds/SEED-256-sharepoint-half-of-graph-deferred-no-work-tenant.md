---
seed_id: SEED-256
title: SharePoint document libraries — the deferred half of Phase 238, blocked on having no Microsoft 365 work/school tenant (NOT on code)
created: 2026-09-07
planted_during: Phase 238 scoping — operator split (OneDrive ships, SharePoint defers)
status: deferred
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: deferred   # ⛔ RETIRED IN WRITING at Phase 245 (D-07, 2026-09-13) — 238's S-1/S-2 moved from ⛔ BLOCKED to ⛔ RETIRED on this seed's ground, in ONE commit across three registers: 238-VERIFICATION.md's table, REQUIREMENTS.md DEBT-01, and this line. ⚠ The four trigger_when arms below are UNCHANGED and are the re-open path; a retirement held only by a seed is held by nothing (the seeds register is swept by nothing), which is why it has three homes.

  The prose that followed the token, byte-for-byte:
  # ⛔ RETIRED IN WRITING at Phase 245 (D-07, 2026-09-13) — 238's S-1/S-2 moved from ⛔ BLOCKED to ⛔ RETIRED on this seed's ground, in ONE commit across three registers: 238-VERIFICATION.md's table, REQUIREMENTS.md DEBT-01, and this line. ⚠ The four trigger_when arms below are UNCHANGED and are the re-open path; a retirement held only by a seed is held by nothing (the seeds register is swept by nothing), which is why it has three homes.

  Mapped `deferred` -> `deferred`. Reason: clean 1:1.
priority: medium
surface: Agentic-RAG
relates_to:
  - Phase 238 (SRC-03) — ships the OneDrive half; this is the row it records ⛔
  - SEED-282 — its `path` forcing function was Phase 238; ⚠ that trigger was WIDENED to OneDrive
    when this split landed, or it would have waited for a phase that already passed
  - Phase 232 — the source contract this was meant to test twice
trigger_when: >
  A Microsoft 365 work/school tenant becomes available. Concretely, ANY of: (a) a free Microsoft
  365 Developer tenant is obtained; (b) the product acquires a customer or pilot org on M365 —
  ⭐ **this is the real one, because it arrives WITH the admin-consent question attached**;
  (c) any paid M365 Business/Enterprise subscription; (d) a phase proposes SharePoint as a source.
---

## What is deferred, and what is emphatically NOT

⛔ **Deferred: the SharePoint half of Phase 238's SC#1** — browsing a SharePoint document library,
picking a folder, previewing it in the four buckets.

✅ **NOT deferred: the adapter.** SharePoint and OneDrive are the **same Microsoft Graph API and the
same adapter code** — both are drives (`/me/drive` vs `/sites/{id}/drive`), with identical listing,
paging, and the same 302 `@microsoft.graph.downloadUrl` two-step download. Phase 238's adapter is
the one SharePoint needs, pointed at a different drive id. **This seed is a DRIVE-IT row, not a
build-it row**, and whoever revives it should expect to write far less code than the phase did.

## Why it is blocked — an account boundary, not a permission

SharePoint sites exist **only inside a Microsoft 365 work/school tenant**. The operator has a
**personal Microsoft account**, which has no `/sites/` to address at all. No scope unlocks this:
`Sites.Read.All` on a personal account has nothing to point at. Verified against the shipped config
— `oauth_service.py` uses the `/common` authority, which accepts both account kinds, and
`Files.Read.All` self-consents fine on a personal account, which is exactly why the OneDrive half
was drivable and this half was not.

⛔ **A SharePoint success criterion could therefore only have been CLAIMED, never driven.** That is
the whole reason for the split: this project records a row as **⛔ blocked with its reason and its
blocking id**, never as silently passed and never omitted.

## ⚠ The unresolved risk that travels WITH this row

Phase 238's Flags carried a **MEDIUM-confidence, undriven** research finding:

> *whether `Files.Read.All` / `Sites.Read.All` self-consent works in a typical enterprise tenant or
> requires **admin approval** — the second can block the whole phase and should be driven BEFORE
> planning.*

**The split did not answer this. It deferred it.** `Files.Read.All` self-consenting on a *personal*
account says nothing about `Sites.Read.All` in an *enterprise* tenant, where admin consent is a real
possibility and would block a customer's rollout, not just a test.

⭐ **This is the FIRST thing to drive when the trigger fires** — before any SharePoint UAT row, and
before promising a customer the capability. If admin consent is required, that is a product fact
with a sales consequence, not an implementation detail.

Second, smaller, also undriven: which `driveItem.file.hashes` members are actually populated
(`quickXorHash` is the only guaranteed one; `sha256Hash` is documented unsupported; hashes populate
**after** download).

## How to close it

1. Obtain a tenant (a free M365 Developer tenant is the cheapest path).
2. **Drive the admin-consent question first** and record the answer as a product fact.
3. Drive Phase 238's SC#1 SharePoint half, plus SC#3's identical-behaviour checks against a site drive.
4. If the adapter needed **any** change beyond a drive id, that is a **finding against Phase 232's
   contract** under Phase 238's SC#4 — record it as such rather than absorbing it quietly. The
   contract claim was that a source family is an adapter; SharePoint is the cheapest remaining test
   of it.
