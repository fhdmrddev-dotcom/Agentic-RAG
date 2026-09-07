# Phase 238 — Microsoft Graph, OneDrive: execution summary

**Built:** 2026-09-07 · **Builder:** Claude (unattended, on the operator's instruction)
**Reviewer:** ⛔ **OWED — see "What is not done" below.** AGENTS.md §6.3 forbids the builder
verifying its own phase. Everything here is a self-verification and is labelled as one.

**Commits:** `409af705f` (238-01) · `c74883928` (238-02) · 238-03 below.
**Plans:** 3 (G-8 target is 3-5).

---

## The answer to SC#4, first, because it is the phase

> *"If this phase was **not small**, that is recorded as a finding against Phase 232's
> contract — naming the specific thing the contract could not express — rather than absorbed
> quietly into the adapter."*

**The contract held for the adapter, and did not hold for the registry around it.** Both halves
are measured, not felt.

### What held — the adapter cost nothing structural

| Measure | Value |
|---|---|
| `sources/base.py` diff for the adapter | **0 lines** (`git diff --stat` empty at 238-01) |
| `microsoft_graph.py` | **352 L** vs `google_drive.py`'s **399 L** |
| New contract parameters | **0** |
| Conformance-suite invariants changed | **0** — a third fixture, same assertions |
| Migrations | **0**, as the ROADMAP predicted |

Two provider differences that *looked* like they would force a contract change did not:

1. **The 302.** Graph `/content` answers `302` to a different host and `send_pinned_http` refuses
   redirects by design. Resolved with Microsoft's own documented two-step, wholly inside
   `read_file`: `$select=…,@microsoft.graph.downloadUrl` under `graph_read`, then that
   preauthenticated URL under `graph_download` **with no `Authorization` header**. The shared
   contract never learns the word "redirect".
2. **The cursor shape.** Drive returns an opaque `nextPageToken`; Graph returns
   `@odata.nextLink`, a **full URL**. `next_page_token: str | None` swallowed it whole — the
   adapter re-issues the URL verbatim and `graph_read`'s suffix pin validates the host on the
   way out. **This is the single strongest piece of evidence that Phase 232 designed the
   cursor correctly**: an absolute URL and an opaque token are the two shapes a paging API
   comes in, and one field held both.

### What did NOT hold — four provider branches were already above `adapters/`

⚠ **The contract's fence had been written so that it could not find them.**
`test_boundary_fence.py` refused the literals `onedrive | sharepoint | dropbox | box` inside
`base.py` and **explicitly permitted `google`** — so it would have flagged the *second* vendor
to leak while the *first* sat three lines away in the module the fence exists to protect.

| # | Where | What it did |
|---|---|---|
| 1 | `sources/base.py::SourceRegistry._ensure_registered` | Lazily imported an adapter chosen by `"google" in service_id` / `"mock" in service_id` — **provider branching inside the contract module**, and redundant besides (`sources/__init__.py` imports every adapter eagerly). Adding Graph would have meant adding a third `elif`. |
| 2 | `sources/base.py::get_adapter` / `is_source_supported` | Substring alias fallbacks for `google` / `workspace`, where the adapter already carries `@SourceRegistry.register("google_workspace")`. |
| 3 | `watch_service.py:238-243` | On an unresolved adapter, fell back to `SourceRegistry.get_adapter("google")`. **A Graph connection whose adapter had failed to register would have been silently read by the Drive adapter.** |
| 4 | `sources/import_service.py:269` | ⭐ **Found by the rewritten fence on its first run — nobody had spotted it.** Same Drive fallback, but keyed on `service_name`, the connection's **DISPLAY NAME**. A Microsoft connection a person had typed *"Google migration"* into would have been read by the Google Drive adapter, holding a Microsoft OAuth token. |

Plus a fifth, cosmetic: `api/connectors.py:679`,
`host="googleapis.com" if service_id == "google" else ""`, which left every non-Google OAuth
connection with a blank *"reached ___"* line. Now a dict.

**The finding, stated the way SC#4 asks for it:** the contract expressed the *adapter* perfectly
and expressed *resolution* not at all. `SourceAdapter` is a clean protocol; `SourceRegistry` was
a lookup with a provider-shaped escape hatch at every miss, and three separate call sites had
each written their own version of the same fallback. **The thing the contract could not express
is "there is no adapter for this connection".** Every one of those four leaks is a caller
inventing an answer to that question rather than propagating "no".

---

## What shipped

**238-01 — the adapter and its two egress keys** (`409af705f`)
- `backend/app/services/sources/adapters/microsoft_graph.py` (352 L), registered under
  `microsoft` / `microsoft_graph`.
- `graph_read` (`graph.microsoft.com`) and `graph_download` (`1drv.com`, `sharepoint.com`)
  wired into all three egress tables. Neither joins `EXTERNAL_ACTION_CAPABILITIES` — the
  ROADMAP's standing *"do not add a fifth verb"* holds; `drive_read` set the service-key
  precedent in Phase 232.
- 15 driven cases including the `/content` fence, the two-step ordering, the absent
  `Authorization` header, and a refusal on an unexpected download host.
- The Graph adapter joined the conformance suite as a third fixture. **104 → 118 passing** in
  `tests/unit/services/sources`.

**238-02 — the leaks and the fence** (`c74883928`)
- All four leaks above removed; the cosmetic fifth deferred into 238-03's commit because it
  lives in the same file as that plan's route (recorded here rather than left as a silent
  plan-boundary drift).
- `test_boundary_fence.py` rewritten: refuses **any** provider identity in a `Compare` across
  `sources/base.py`, `sources/preview_service.py`, `sources/import_service.py` and
  `watch_service.py`, with an explicit reasoned allow-list (the `application/vnd.google-apps.*`
  MIME constants, and `"drive"` as a `SourceNode.kind` value). It carries its own positive
  control and a completeness check that a new module in `services/sources/` cannot be silently
  unfenced.
- **Driven RED:** a planted `if "google" in service_id` in `base.py` failed by name at line 201;
  the file was restored **md5-identical** (`186c606c5cf3cb02ed42d2f34990248d`, verified both
  sides).

**238-03 — the registry published, the guess retired**
- `GET /connectors/source-families` publishes `SourceRegistry.list_supported_services()`.
- `frontend/src/components/sources/sourceCapability.ts` — one predicate, fed by that list,
  **failing closed on `null`**.
- Both copies of `id.includes("google") || includes("workspace") || includes("drive")` deleted
  from `ConnectedSourceSection.tsx` and `CreateWatchModal.tsx`.
- ⭐ The route's own test registers a throwaway adapter at runtime and asserts it appears —
  *"rows, not code"* made executable rather than asserted in prose. Phase 239's second MCP file
  server will need **no frontend change**.

---

## Corrections recorded, not inherited

**1. The two ROADMAP research flags were retired rather than answered.**

- *`driveItem.file.hashes` member availability* — **irrelevant to this design.** Nothing in this
  product reads a file hash. `source_version` is `modified_at` at every comparison site
  (`preview_service.py:36,715`; `watch_service.py:321,350,371,386,400,438,455,483`), and Graph
  returns `lastModifiedDateTime`. The flag was raised against a design the contract does not use.
- *`Files.Read.All` self-consent* — already shipped and already correct.
  `oauth_service.py:104-116` uses the `/common` authority with
  `["openid","offline_access","User.Read","Files.Read.All"]`, and Microsoft's own permission
  tables list `Files.Read.All` as delegated-personal-MSA for both APIs used here. ⛔ **This says
  nothing about `Sites.Read.All` in an enterprise tenant**, which travels with `SEED-256`
  un-softened. No OAuth code changed in this phase.

**2. SEED-253 overstates its own defect, and the narrower version is what got fixed.**
The seed says production *always* substitutes `/<filename>`. Measured: that is true of the
**watch → ingest** path and **false of the preview path** —
`preview_service._walk_folder:333-334` builds a real breadcrumb from the traversal before any
fallback runs. So the fix landed at `ingest_enrich.py`, where a fabricated value reached a
**rule**, and deliberately *not* at `preview_service.py:584`, where it reaches a row a person is
looking at and a blank column would be the less honest signal. Both sites now say so in place.

**3. D-232-03's mock-source gate does not exist.** Phase 232 recorded a
`VITE_ENABLE_MOCK_SOURCES` / dev-mode gate for the mock adapter;
`grep -rn "mock_source" frontend/src` finds it in **tests only**. It never mattered while the
client's own predicate was `includes("google")` — the mock was excluded **by accident**.
Publishing the registry removes that accident, so the exclusion is now explicit and
server-side, where a UI edit cannot widen it.

---

## Baselines, captured BEFORE the first edit and re-measured after

| Gate | Before | After | Verdict |
|---|---|---|---|
| Backend `tests/unit` | `71 failed, 3971 passed, 2 xfailed, 2 xpassed, 0 collection errors` | `71 failed, 4015 passed, 2 xfailed, 2 xpassed` | **HOLDS.** The full 71-name failing SET was captured and diffed with `comm -13`: **identical**, zero new names. `+44` newly passing. ⚠ Re-run on the FINAL tree (after 238-03), not only after 238-02 — an intermediate figure in a close doc is the rot this project keeps recording. |
| `tsc -p tsconfig.app.json --noEmit` | 66 | **66** | at baseline |
| vitest count gate | `count gate OK — 241/241 · total 7816 · failed 0 · pinned 7020` | `count gate OK — 242/242 · total 7822 · failed 0 · pinned 7026` | **+6, exactly the new suite.** No per-file decrease, 0 failing |

⚠ The backend ceiling was diffed by **name set, not by count** — the standing lesson that a
count hides a swap. The one apparent difference in the diff output was a `RuntimeWarning`
string concatenated onto an identical test id in one run, not a different test.

⚠ **`src/components/sources/sourceComposition.test.tsx` closes at `16 failed | 33 passed`,
INHERITED from Phase 235 and in neither gate knob by decision.** It is red before this phase and
red after; no assertion in it concerns anything 238 touched.

⚠ **The vitest count-gate figures in CLAUDE.md are stale again — the sixth rot.** Its last
correction (2026-08-28, Phase 214) records `6355 / 5266 / 120`. Measured here on a quiet tree:
**`7816 / 7020 / 241`** — `+1461` cases and `+121` pinned files in ten days. Recorded beside the
old figures, never over them; **a growing number is the gate working.**

---

## What is NOT done, named rather than omitted

1. ⚠ **SUPERSEDED THE SAME DAY — THE LIVE ROWS WERE DRIVEN, AND THEY FOUND TWO DEFECTS.**
   The operator completed the Azure app registration hours after this was written, so **M-1,
   M-3 and M-5 PASS live against a real personal OneDrive**. Driving them exposed two defects
   that **all 15 unit cases missed, and both contradict Microsoft's own documentation**:
   (a) any `$select` silently suppresses `@microsoft.graph.downloadUrl`, including the docs'
   own example — so **every** download failed; (b) the real download host is
   `my.microsoftpersonalcontent.com`, not the `files.1drv.com` the reference prints, and the
   `graph_download` allow-list refused it. Both fixed. Corrected UAT table and full evidence in
   `238-VERIFICATION.md`.
   ⭐ **Why the unit suite could not see either is the durable lesson: the fakes were mine, so
   they agreed with my implementation rather than with Graph.** The test that asserted
   `$select` *contained* the annotation has been inverted to pin its ABSENCE.
   ⭐ **And the egress fence is vindicated rather than embarrassed** — it fail-closed on an
   unexpected server-supplied host and NAMED it, turning a would-be silent empty download into
   a one-line diagnosis.
   The original claim is kept below rather than overwritten: it was true when written, and the
   correction is the finding.
   ~~⛔ **Every live UAT row is OWED.**~~ `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET`
   need an Azure app registration, which is an operator action I cannot perform and the
   operator was away. **SC#1 and SC#2 are proven only at unit level.** The rows are enumerated
   in `238-VERIFICATION.md`; none is claimed.
2. ⛔ **SharePoint** — deferred to `SEED-256` with its reason (no work/school tenant), recorded
   ⛔ in the UAT table, never omitted and never passed.
3. ⛔ **An independent review.** I built this phase; AGENTS.md §6.3 says I must not be the one
   who verifies it. Posted `--to operator` rather than self-certified.
4. ⚠ **SEED-253 stays open, narrowed.** Drive still has no `path` — `files.list` does not return
   one and getting it needs a parent walk. Its trigger becomes *"a Drive path becomes available,
   or a recursive subfolder watch ships"*.
5. ⚠ **A plan-boundary deviation:** `api/connectors.py` carries both 238-02's de-branching and
   238-03's new route, so the cosmetic host fix landed in the 238-03 commit rather than 238-02's.
   Recorded because a plan boundary that silently moved is indistinguishable from one that was
   never honoured.
