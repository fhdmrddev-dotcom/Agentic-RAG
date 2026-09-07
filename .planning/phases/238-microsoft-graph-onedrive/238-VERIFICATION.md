# Phase 238 — Verification

**Date:** 2026-09-07 · **Verified by:** Claude — ⛔ **who also BUILT this phase.**

> ⚠ **READ THIS FIRST.** AGENTS.md §6.3: *whoever REVIEWS a phase must not have shaped the
> build.* I shaped all of it. **This document is a self-verification and every verdict in it
> should be read at that discount.** An independent review is posted `--to operator` as owed.
> Nothing below is recorded as "verified" where it was only "claimed".

---

## Success criteria

### SC#1 — a person connects a Microsoft account, browses OneDrive, picks a folder, previews it in the same four buckets

**Structural: PASS. Behavioural: ⛔ OWED — not driven.**

| Half | Evidence | Verdict |
|---|---|---|
| The connect path | Already shipped before this phase: `servicesCatalog.ts`'s **Microsoft 365** entry (`shape: "oauth"`, `oauthProvider: "microsoft"`), `OAuthProvider` includes `"microsoft"`, `oauth_service.py:104-116` carries the `/common` provider block with `Files.Read.All`. **Nothing in this phase touched OAuth.** | ✅ read at file:line |
| Browse | `MicrosoftGraphSourceAdapter.browse` — driven over a fake egress in 4 cases including virtual root, folder-facet filtering, and `@odata.nextLink` re-issue | ✅ unit |
| The connection is OFFERED at all | `GET /connectors/source-families` publishes `microsoft`; `isSourceCapable` admits it. 5 route cases + 6 predicate cases | ✅ unit |
| Preview in four buckets | `preview_service` is provider-agnostic and consumes `FilePage`/`SourceFile` only; the Graph adapter passes the same conformance suite Drive does | ✅ by construction |
| **A real Microsoft account, browsed in a browser** | — | ⛔ **OWED (see Blocked rows)** |

⛔ **The SharePoint document-library half of this row is DEFERRED to `SEED-256`** — *no
work/school tenant; a personal Microsoft account has no `/sites/` to address.* Recorded blocked,
with its blocking id. Never passed, never omitted.

### SC#2 — files are read and appear in the Library on the schedule, including files large enough to need the two-step download

**Structural: PASS. Behavioural: ⛔ OWED.**

- The two-step is driven at unit level and is the phase's most-asserted behaviour: exactly two
  calls, `["graph_read", "graph_download"]` in that order, the `$select` carrying
  `@microsoft.graph.downloadUrl`, **no `Authorization` header on the download**, and a
  `/content` fence asserting the redirect path is never taken.
- ⚠ **"Large enough to need the two-step" is a misreading the code makes impossible and this
  row should say so:** on Graph the two-step is not a large-file path, it is **the only
  download path**. Every file, at any size, goes through it, because `/content` answers a
  redirect for all of them. The 25 MB `max_bytes` ceiling is unchanged from `google_drive.py`.
- ⛔ Bytes actually landing in the Library from a real OneDrive: **OWED**.

### SC#3 — everything Phase 234 promised behaves identically for a Graph source

**PASS by construction, and the construction is the point.**

`watch_service` resolves its adapter through `SourceRegistry.get_adapter(conn)` and then never
asks what family it got. Deletion-does-not-delete, disconnect-freezes, connection-scoped
visibility and `SourceListing.complete`'s fail-closed rule are all implemented above the
adapter, so a Graph source inherits them by being an adapter.

⭐ **And this phase made that MORE true rather than less:** `watch_service`'s
`get_adapter("google")` fallback is gone, so a Graph connection can no longer be silently read
by the Drive adapter — which was the one way "a person cannot tell which family they are
watching" could have been true for the wrong reason.

⚠ **CORRECTION — THE PARAGRAPH ABOVE IS HALF WRONG, AND THE ORIGINAL IS KEPT RATHER THAN
OVERWRITTEN BECAUSE THE WAY IT WAS WRONG IS THE FINDING.** *"PASS by construction"* was asserted
for **disconnect-freezes** on the reasoning that `watch_service` resolves its adapter through the
registry and never asks which family it got. That reasoning is correct **and covers only the
scheduled loop.** The interactive half was never checked.

Driven at M-8, on a connection with `is_enabled=False`: **`browse()` minted a fresh OAuth token
and returned 6 real OneDrive folders.** `grep is_enabled` finds **one** check in the entire
codebase — `watch_service.py:205` — and **zero** in `api/connectors.py` or anywhere under
`services/sources/`. Browse, preview and import all keep reading. Filed as `BUG-260907-03`.

⭐ **AND SC#3 AS WRITTEN STILL PASSES, WHICH IS THE UNCOMFORTABLE PART.** The criterion asks that
a Graph source behave *identically* to a Drive source. It does — **both are unguarded**, because
the hole is in the shared path and predates this phase. A satisfied criterion sat directly on top
of a real defect, and only driving the row separated them. *"Behaves identically"* is a claim
about parity, never about correctness.

⛔ **Still true, carried from Phase 235 item #1 (now HALF discharged): a stopped source had never
been observed in this product.** ⭐ **M-7 closed that half** — a deleted file produced
`source_state='missing_at_source'` on a surviving document, the first such observation for any
family. Disconnect behaviour is the half that remains, and it is now known to be wrong rather
than merely unobserved.

### SC#4 — if the phase was not small, that is a finding

**PASS — and it produced a finding, which is the outcome this criterion actually wants.**

Full derivation in `238-SUMMARY.md`. In one table:

| | |
|---|---|
| `base.py` lines changed for the adapter | **0** |
| Adapter size | **352 L** vs Drive's **399 L** |
| New contract parameters | **0** |
| Conformance invariants changed | **0** |
| Migrations | **0** |
| **Provider leaks already above `adapters/`** | **4** — and the fence meant to catch them exempted the one that existed |

**The finding, in the form SC#4 asks for:** the contract expressed the *adapter* and did not
express *resolution*. `SourceAdapter` is clean; `SourceRegistry` was an exact lookup with a
provider-shaped escape hatch at every miss, and three call sites had each invented their own.
**What the contract could not say is "there is no adapter for this connection."** All four
leaks are a caller answering that question with a guess.

⭐ The fourth leak was found **by the rewritten fence, on its first run, unprompted**:
`import_service.fetch_cloud_file` fell back to the Drive adapter on the connection's **display
name**, so a Microsoft connection named *"Google migration"* would have been read by the Drive
adapter under a Microsoft token.

---

## Gates

| Gate | Result |
|---|---|
| Backend `pytest tests/unit -q --continue-on-collection-errors` | **71 failed, 4015 passed, 2 xfailed, 2 xpassed, 0 collection errors** — at the CLAUDE.md ceiling. Diffed against the baseline's **full 71-name set** with `comm -13`: **zero new names**. `+44` newly passing. Re-run on the FINAL tree, after 238-03. |
| `tests/unit/services/sources` | **118 passed** (94 before the phase) |
| `tests/unit/test_190_egress.py` | **77 passed**, including the extra-key wiring assertion |
| `tsc -p tsconfig.app.json --noEmit` | **66** — exactly the 232 baseline |
| vitest count gate | **`count gate OK — 242/242 pinned files present, no per-file decrease, 0 failing`** · `total 7822 · failed 0 · pinned total 7026`. Baseline before the phase: `241/241 · 7816 · 7020`. **+6 = exactly `sourceCapability.test.ts`.** Verdict line read verbatim, from the repo root, `GSD_VITEST_MAX_WORKERS=2` |
| `check-hot-file-ledger.cjs 238` | **ledger gate OK** — 229 rows, every watched file has a row |
| `check-claude-md-size.cjs` | **OK** — 81,332 chars, 54.2% of limit |

⚠ **Baselines were captured BEFORE the first edit**, on a quiet tree, and the backend one was
captured as a **NAME SET** rather than a count — the standing lesson that a count hides a swap.

⚠ **`sourceComposition.test.tsx` is red at `16 failed | 33 passed`, INHERITED from Phase 235**
and in neither gate knob by decision. Red before this phase, red after; nothing in it asserts
anything 238 touched.

---

## ⭐ LIVE DRIVE, 2026-09-07 — and it found TWO defects the whole unit suite could not

**The operator completed the Azure app registration, so the rows below stopped being owed and
were DRIVEN against a real personal OneDrive.** Everything here is a real Microsoft response,
not a test double.

⭐ **Both defects contradict Microsoft's own documentation, and both were invisible to 15 unit
cases** — because the fakes were mine, so they agreed with my implementation rather than with
Graph. This is SEED-171's lesson in a third register: *a test double that mirrors the code
proves the code is self-consistent, never that the provider agrees.*

### Defect 1 — `$select` silently suppresses `@microsoft.graph.downloadUrl`

`read_file` raised *"Graph returned no @microsoft.graph.downloadUrl for this item"* for
**every** file. Four variants driven against the same real item:

| Request form | annotation returned |
|---|---|
| `$select=<all fields>,@microsoft.graph.downloadUrl` (shipped code) | ❌ |
| `$select=id,name,size,file,@microsoft.graph.downloadUrl` | ❌ |
| `?select=id,@microsoft.graph.downloadUrl` — **Microsoft's own documented example** | ❌ |
| **no `$select` at all** | ✅ |

**Any projection suppresses the instance annotation**, including the exact snippet
`learn.microsoft.com/graph/api/driveitem-get-content` gives for this scenario. Fixed by
removing `$select` from the metadata call. The unit test that asserted `$select` *contained*
the annotation has been **inverted** to pin its ABSENCE — the only half of this a double can
check — and the conformance fake now matches on `"$select" not in params`, so a fake that
accepted either form cannot hide it again.

### Defect 2 — the download host is not the one the docs print

```
EgressRefused: graph_download: refused 'my.microsoftpersonalcontent.com' — host_not_allowed
```

`graph_download` shipped allowing `1drv.com` + `sharepoint.com`, taken from Microsoft's
reference (`Location: https://b0mpua-by3301.files.1drv.com/...`). A real personal OneDrive
serves from **`my.microsoftpersonalcontent.com`**. Added as a third suffix; the other two are
kept, not replaced.

⭐ **The egress fence behaved exactly as designed and that is the finding, not the bug.** It
fail-closed on an unexpected server-supplied host and NAMED it, so a wrong-host download was a
one-line diagnosis instead of a silent empty file. An over-broad allow-list would have swallowed
this; a too-narrow one costs a clear error naming what to add.

### Defect 3 — only ONE of the two `metadata.source` writers got the `path` key

Found by two OneDrive files landing in the same Library four minutes apart through **different
doors**, and only one carrying a folder path:

```
17:46  BAckend - Unicorn commands README.pdf        path = None                       <- manual import
17:50  Practical_Project_Management_Guide.docx      path = /Attachments/Practical…    <- watch loop
```

`metadata.source` has **two** writers: `watch_service` (the scheduled loop) and
`import_service.import_single_file` (the door a person clicks in *Library → Add files*). Phase
238's D-238-07.4 added `path` to the first and **missed the second**, so every hand-imported
document had no folder fact and a folder-shaped rule silently never matched it — SEED-253's
original defect, alive on the path most people actually use.

⭐ **The shape of the miss is the lesson, not the miss:** fixing one writer of a fact reads
exactly like fixing the fact. Every per-writer test passed, because each writer did what its own
test asked. The new fence therefore asserts over the **set** of writers
(`test_EVERY_writer_of_metadata_source_carries_the_path_key`), so a third writer added without
the key fails rather than passing quietly.

`source_path` is now threaded `preview → import_single_file → metadata.source`.

---

---

## UAT — the G-4 table. DRIVEN LIVE unless marked otherwise.

| # | Row | Status |
|---|---|---|
| M-1 | Connect a Microsoft 365 account → OAuth round trip completes, connection is `active` | ✅ **PASS.** Verified in the DB, not on screen: `service_id=microsoft · status=active · is_enabled=True · last_check_verdict=ok`. Token refresh re-driven after a secret rotation → 1440-char access token. |
| M-2 | The Microsoft connection appears in the connected-source picker | ✅ **PASS, LIVE (operator).** ⭐ The row that validates 238-03: it appears because the server published `SourceRegistry`, not because a string was widened. The predicate never learned the word "microsoft" — so Phase 239's MCP family will appear with **no frontend change**. |
| M-3 | Browse OneDrive, drill into a folder | ✅ **PASS, LIVE.** `browse(None)` → one virtual root; `browse("onedrive")` → **6 real folders** (Apps, Attachments, Desktop, Dokument, Pictures, Videos). |
| M-4 | Preview a OneDrive folder → the same four buckets | ✅ **PASS, LIVE (operator).** Browsed and previewed through the product, then imported: `BAckend - Unicorn commands README.pdf` reached `status=completed`. ⚠ It is also the document that exposed **Defect 3** — it came through this door with `path=None`. |
| M-5 | Files are read through the two-step download | ✅ **PASS, LIVE — and it is the row that found both defects.** After fixing: `Antigravity.lnk`, **1395 bytes**, head `4c 00 00 00 01 14 02 00` (the Windows shell-link magic), **size matches the listing exactly**. Two calls, `graph_read` then `graph_download`, against the real CDN host. |
| M-6 | A watch runs on schedule and brings in a new file | ✅ **PASS, LIVE.** A real watch on OneDrive `/Attachments`, every 15 min, `is_active=True`. Two runs, both `status=success`, **`listing_complete=True`** (H-5's fail-closed flag genuinely true, not defaulted), `count_new=1`, `count_errors=0`. The document arrived at `status=completed` carrying `path=/Attachments/Practical_Project_Management_Guide_Recreated.docx`. |
| M-7 | Delete at source → the Library document is NOT deleted | ✅ **PASS, LIVE — and it closes a gap carried since Phase 235.** The operator deleted the watched file from OneDrive; the next run reported *"1 missing at source"* and the document **still exists**: `status=completed`, `source_state='missing_at_source'`, `path` intact. ⭐ Not a default: across the whole corpus the histogram is `None: 126` / `missing_at_source: 1` — exactly the file that was deleted. **Deletion at source does not delete; it records.** |
| M-8 | Disconnect → watching freezes, nothing is deleted | ⚠ **HALF PASS — and the failing half is a DEFECT, `BUG-260907-03`.** *Nothing is deleted*: ✅ all three documents survive, including the `missing_at_source` one. *Watching freezes*: ✅ for the scheduled loop (`watch_service.py:205`). ⛔ **But the connection does not stop READING.** Driven at `is_enabled=False`: `browse()` minted a fresh OAuth token and returned 6 real OneDrive folders from `graph.microsoft.com`. Browse, preview and import are all unguarded. **Not Graph-specific — Google Drive has the same hole since Phase 232.** |
| M-9 | A `path contains '/Finance/'` rule fires for a file that IS in that folder | ⚠ **HALF PASS, and stronger than before.** The fact is now real **in the database**, not only in the adapter: a watched document carries `metadata.source.path = /Attachments/Practical_Project_Management_Guide_Recreated.docx`. ⛔ The *rule* was still not created, so end-to-end matching remains owed — and it must be re-driven through the **manual import** door too, since that arm was broken until Defect 3 was fixed. |
| **S-1** | Browse a SharePoint document library | ⛔ **BLOCKED — `SEED-256`.** No M365 work/school tenant; a personal account has no `/sites/` to address. ⚠ The live drive CONFIRMS the account kind: `check()` returned `drive_type: personal`. |
| **S-2** | `Sites.Read.All` self-consent vs admin approval in an enterprise tenant | ⛔ **BLOCKED — `SEED-256`.** Unresolved and un-softened. |

**9 rows driven (7 full pass, 2 half) · 0 owed · 2 blocked (S-1, S-2) · 0 claimed.**

⭐ **EVERY DRIVEABLE ROW HAS NOW BEEN DRIVEN.** Only the two SharePoint rows remain, blocked on an
account boundary (`SEED-256`) rather than on effort.

⚠ **FOUR defects were found by driving and NONE by the unit suite** — the `$select` suppression,
the download host, the second `metadata.source` writer, and now the unguarded disable. Three of
the four contradict either Microsoft's documentation or this phase's own written verdict. **The
common cause is stated plainly because it is the argument for the review that is still owed: the
test doubles were mine, so they agreed with my implementation rather than with reality.**

⚠ **Dedup verified rather than assumed.** Two watch runs each reported `count_new=1`, which looks
like a re-import. It is not: the two documents carry **distinct `external_id`s**, a
`group by external_id having count(*) > 1` returns **no rows**, and both items sit `present` in
`connector_watch_items` with the correct `source_version`. ⚠ Recorded as an observation, not a
claim: the run-count bookkeeping is slightly odd (one document predates both runs), which matters
only if those counters are ever used for reporting.

⭐ **M-7 CLOSED A GAP THIS PROJECT HAS CARRIED SINCE PHASE 235** — *"no stopped source has ever
been observed in this product"* — and it closed it on the Graph family, one phase after the
family existed. **Only M-8 remains of that pair.**

⚠ **AN OBSERVATION FROM M-7, RECORDED BECAUSE IT CUTS AGAINST PHASE 235'S OWN GOAL.** Deleting the
watch **cascade-deleted its entire run history**: the `connector_sync_runs` rows that recorded the
missing-at-source detection, and every `connector_watch_items` row, are gone. The evidence for
M-7 survives only because `documents.source_state` lives on the DOCUMENT rather than on the watch.
Phase 235 exists to make a source *say what it did*; a watch removal currently erases what it
said. **Not filed as a defect — the cascade may well be intended** — but it is a decision someone
should take deliberately rather than inherit.

⚠ **`Files.Read.All` self-consented on a personal account with no admin prompt** — D-238-04's
prediction, now measured rather than inferred.

---

## Cross-checks

- **Reported bugs** (`status: open`, `surface: Agentic-RAG`): `BUG-260905-01`
  (*cloud import lives in chat and dumps into Library root*) overlaps on `connectors` /
  `ingestion` — **reviewed, NOT folded.** Its fix is *moving* the chat picker surface, not
  *widening* it; widening a surface that is being retired is work with a negative half-life.
  Left `open`. No other open report's `affected_areas` touches this phase's blast radius.
- **Seeds**: `SEED-253` folded and **narrowed, not closed** (Drive still has no path).
  `SEED-256` untouched and still `planted` — this phase is the reason it exists.
- **G-5 hot-file ledger**: 5 rows added (`sources/base.py`, `microsoft_graph.py`,
  `mock_source.py`, `sources/__init__.py`, `sourceCapability.ts`), 2 stale rows re-derived
  (`import_service.py` `2/2/172` → `3/3/277`; `preview_service.py` `1/1/549` → `5/3/772`).
  ⚠ Four of the five added rows were absent **for the file's entire life**.
- **G-8 plan-count**: 3 plans, inside the 3-5 target.
- **G-7 gap-closure rounds**: 0.
