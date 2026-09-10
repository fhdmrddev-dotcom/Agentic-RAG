# Phase 238: Microsoft Graph — OneDrive (SharePoint deferred, SEED-256) - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Role:** ⚠ **Builder: Claude. Reviewer: OWED — see D-238-10.** The operator directed an
unattended end-to-end run. AGENTS.md §6.3 says whoever built a phase must not verify it, so this
phase ships with a **self-verification, explicitly labelled as such**, and an independent review
is posted `--to operator` as owed rather than quietly skipped.

<domain>
## Phase Boundary

Phase 238 delivers **a Microsoft Graph source adapter for OneDrive** (`SRC-03`) — a person
connects a Microsoft account, browses OneDrive, picks a folder, previews it in the same four
buckets they saw for Drive, and watches it on the same schedule with the same Phase 234
behaviours (deletion does not delete, disconnect freezes, visibility is the connection's, an
incomplete listing marks nothing missing).

⭐ **AND IT IS A MEASUREMENT.** The milestone's binding constraint is *a watched source must be
DATA, not code*. Phase 232 claimed a contract that every later family implements as a thin
adapter. **This phase is the first independent test of that claim, and SC#4 requires the answer
to be recorded either way** — if the phase was not small, that is a finding against Phase 232's
contract naming the specific thing the contract could not express, never something absorbed
quietly into the adapter.

### In scope
1. `backend/app/services/sources/adapters/microsoft_graph.py` — `browse` / `list_files` /
   `read_file` / `check` against Microsoft Graph v1.0, registered under `service_id="microsoft"`.
2. Two new egress capability keys (`graph_read`, `graph_download`) — the **302 dance sealed
   inside the adapter**, never as a contract parameter.
3. The Graph adapter joins the existing parametrized conformance suite (`SRC-01`).
4. **The contract leaks the measurement found** — de-branching `sources/base.py`,
   `watch_service.py` and `api/connectors.py`, and strengthening the boundary fence that could
   not have caught them.
5. **SEED-253 (`SourceFile.path`) — folded, PARTIALLY, by its own widened trigger.**
6. Frontend: the source-capable predicate stops guessing and reads a server-published list.
7. The SC#4 finding, written down.

### Out of scope
- ⛔ **SharePoint** — deferred to `SEED-256` with its reason (*no work/school tenant; a personal
  Microsoft account has no `/sites/` to address*). Recorded ⛔ in the UAT table, never omitted,
  never passed.
- ⛔ **The `Sites.Read.All` admin-consent question** — deferred WITH the SharePoint row. The
  split did not answer it.
- ⛔ **Populating `path` for Google Drive** — Drive gives no path in `files.list`; it needs a
  parent walk. Out of scope, and SEED-253 stays open with a narrowed trigger (D-238-07).
- ⛔ **The chat-side cloud file picker** (`MessageInput.tsx:306`,
  `ConnectedFilePickerModal.tsx:48`) — the same `includes("google")` predicate lives there, and
  `BUG-260905-01` already proposes moving that surface out of chat entirely. Widening a surface
  that is being retired is work with a negative half-life (D-238-08).
- ⛔ Any new migration. **Zero migrations expected**, per the ROADMAP row.

</domain>

<decisions>
## Implementation Decisions

### The 302 dance (the phase's named trap)

- **D-238-01 — Two egress keys, and the redirect NEVER reaches the contract.**
  `egress.send_pinned_http` sets `follow_redirects=False` **explicitly** and raises the
  `redirected` refusal code (`egress.py:746,765-783`). That is correct and stays. Graph
  `GET /drive/items/{id}/content` answers **`302 Found`** with a `Location` on a *different
  host* — confirmed against Microsoft's own reference
  (`learn.microsoft.com/graph/api/driveitem-get-content`, which prints
  `Location: https://b0mpua-by3301.files.1drv.com/...`).
  So the adapter **never calls `/content`**. It performs the documented two-step:
  1. `GET https://graph.microsoft.com/v1.0/me/drive/items/{id}` with
     `$select=id,name,size,file,parentReference,lastModifiedDateTime,@microsoft.graph.downloadUrl`
     under egress key **`graph_read`** (allow-list `graph.microsoft.com`).
  2. `GET <@microsoft.graph.downloadUrl>` under egress key **`graph_download`** — a *second
     pinned call to a different host with its own key*, **with no `Authorization` header**
     (Microsoft: *"You don't need to include an `Authorization` header when you access the
     download URL"*), under the same 25 MB `max_bytes` cap.
  ⛔ **The contract MUST NOT grow `follow_redirects`, a `site_id`, or a `hash_kind` enum.** If a
  plan finds itself adding one, that is SC#4's finding, not a design choice.

- **D-238-02 — `graph_download`'s allow-list is `1drv.com` + `sharepoint.com`, suffix-matched,
  https-only, and the reason is stated rather than assumed.** The download URL is
  **server-supplied by Graph**, so it is a semi-trusted destination and the suffix pin is its
  fence. Personal OneDrive serves from `*.files.1drv.com`; OneDrive **for Business** serves from
  `<tenant>.sharepoint.com`. Pinning to `1drv.com` alone would pass the operator's own personal
  account and break every business account — a fence that only holds where nobody tests it.
  Both suffixes are Microsoft-owned. Anything else is **refused by name**, and the refusal is
  observable rather than a hang.
  ⚠ Both keys must be wired into **all three** egress tables (`ALLOWED_HOST_SUFFIXES`,
  `_HOST_MATCH`, `_TLS_SCHEMES`) — `test_190_egress.py:577-580` asserts exactly this, because a
  key in one table and missing from another is a `KeyError` at the socket instead of a refusal,
  *"which fails OPEN in the sense that matters: no answer instead of a clear no."*
  ⚠ Neither key joins `EXTERNAL_ACTION_CAPABILITIES`. The ROADMAP's standing instruction is *do
  not add a fifth verb*; `drive_read` already established the service-key precedent.

### Two RESEARCH FLAGS from the ROADMAP — both resolved BEFORE planning, as instructed

- **D-238-03 — `driveItem.file.hashes` is IRRELEVANT to this design, which retires the flag
  rather than answering it.** The flag asked which hash members are populated. **Nothing in this
  product reads a hash.** The version key is `modified_at` at every site:
  `preview_service.py:36` (*"`source_version` is Drive's `modifiedTime`"*) and
  `preview_service.py:715`; `watch_service.py:321,350,371,386,400,438,455,483`. Graph returns
  `lastModifiedDateTime` on every `driveItem`, so the Graph adapter fills `SourceFile.modified_at`
  from it and the tier-1 `(source_system, external_id, source_version)` comparison works
  unchanged. ⭐ **Recorded as a finding in its own right: the flag was raised against a design
  the contract does not use.**

- **D-238-04 — `Files.Read.All` self-consent is a NON-ISSUE for the shipped scope, and the
  enterprise half stays deferred, un-softened.** `oauth_service.py:104-116` already ships the
  `microsoft` provider on the **`/common`** authority with
  `["openid","offline_access","User.Read","Files.Read.All"]`, PKCE on. Microsoft's permission
  table for both *"Download driveItem content"* and *"List the contents of a folder"* lists
  `Files.Read.All` as a **delegated (personal Microsoft account)** permission. ⛔ **This says
  NOTHING about `Sites.Read.All` in an enterprise tenant** — that question travels with
  `SEED-256` and is the first thing to drive when its trigger fires. **No code change to
  `oauth_service.py` is needed or wanted in this phase.**

### The adapter's shape

- **D-238-05 — Graph's URL-shaped cursor is absorbed by the existing opaque token, and that is
  a CONTRACT WIN worth recording.** Drive returns an opaque `nextPageToken`; Graph returns
  **`@odata.nextLink`, a full URL** (default page size 200; `$top` / `$select` / `$skipToken` /
  `$orderby` supported). The contract's `next_page_token: str | None` carries the whole
  `nextLink` verbatim; the adapter re-issues it directly, and `graph_read`'s suffix pin
  validates the host on the way out. **`base.py` does not change for this** — the strongest
  single piece of evidence for SC#4.
- **D-238-06 — Virtual roots mirror Drive's two-node shape, with one node.** `browse(None)`
  returns a single `SourceNode(id="onedrive", name="OneDrive", kind="folder")`. Folders are
  `driveItem`s with a `folder` facet; files have a `file` facet carrying `file.mimeType`.
  **No export step** — OneDrive Office files are already real `.docx`/`.xlsx`, unlike Google's
  native types. Error reporting mirrors `_google_error_reason`: **enum-only** (`error.code` and
  `error.innerError.code`), never the raw body, because the body echoes user-supplied text.

### SEED-253 — `SourceFile.path`, folded PARTIALLY and said so

- **D-238-07 — The synthetic `/<filename>` substitution is REMOVED; Graph populates `path`
  truly; Drive's stays `None` and the seed stays open with a narrowed trigger.**
  SEED-253's trigger was **widened to any Graph adapter on 2026-09-07** and this phase fires it.
  Today `f.path` is always `None` and two sites fabricate a value — `preview_service.py`
  (`getattr(f,"path",None) or f"/{f.name}"`) and `ingest_enrich.py` — so
  `path contains '/Finance/'` is **False for a file that IS in Finance** while
  `path contains 'Rates'` is **True because it matched the filename**. A person writes a
  folder-shaped rule, gets a 200, and gets silence forever.
  Four changes, and no more:
  1. Graph adapter sets `path` from `parentReference.path` (Graph returns it free, in the same
     payload — this is why OneDrive alone fires the trigger).
  2. `MockSourceAdapter` sets a real `path`, so the conformance suite can assert it.
  3. **Both fabrication sites stop substituting.** An unknown path stays `None` and a
     folder-shaped rule **does not match** — strictly better than matching a fabricated
     filename, which is what makes a dead rule look live.
  4. `watch_service.py` writes `path` into `metadata.source` (it writes `system` /
     `external_id` / `version` and no `path` today, so the ingest-side arm is dead).
  ⚠ **Drive still has no path** and the seed is therefore **partially discharged**: flip it to
  `status: partial` with the trigger narrowed to *"a Drive path becomes available or a recursive
  subfolder watch ships"*. ⛔ Do NOT close it.

### The frontend predicate

- **D-238-08 — The client stops guessing; the server publishes its registry.**
  `ConnectedSourceSection.tsx:46` and `CreateWatchModal.tsx:43` each carry the identical
  `id.includes("google") || includes("workspace") || includes("drive")`. `ConnectedSourceSection`'s
  own docblock names the problem: *"The server's `SourceRegistry` is the authority and there is
  no endpoint that publishes its list… when a second family lands (Microsoft Graph, Phase 238),
  this predicate is the thing to widen, and widening it by guess is how a dead option appears in
  a dropdown."* **So do not widen it by guess.** Publish
  `SourceRegistry.list_supported_services()` (it already exists, `base.py`) from the backend, and
  have both surfaces share one predicate fed by that list. ⭐ **This is what makes "rows, not
  code" true on the frontend too** — Phase 239's second MCP file server then needs no frontend
  change at all.
  ⛔ The chat picker is **left alone** — see Out of scope.

### SC#4 — the measurement, and what it already found

- **D-238-09 — Three provider leaks are ALREADY IN THE TREE, and the fence written to catch
  them exempts the one that exists.** These are the phase's finding and they are fixed here:
  1. `sources/base.py::SourceRegistry._ensure_registered` branches on
     `"google" in service_id` / `"mock" in service_id` **inside the contract module** — and
     `sources/__init__.py` already imports both adapters eagerly, so the method is **dead weight
     that only exists to be branched**. Registration is data (the `@SourceRegistry.register`
     decorator); delete the branching, keep the eager import.
  2. `watch_service.py:238-243` — when no adapter resolves, it falls back to
     `SourceRegistry.get_adapter("google")`. **A Graph connection whose adapter failed to
     register would silently be read by the Drive adapter.** Delete the fallback; the
     `NotImplementedError` two lines below is the honest answer.
  3. `api/connectors.py:679` — `host="googleapis.com" if service_id == "google" else ""`, a
     cosmetic display field carrying a provider literal above `adapters/`.
- **D-238-10 — The boundary fence is STRENGTHENED and DRIVEN RED, because the shipped one could
  not have fired.** `test_boundary_fence.py` refuses the literals
  `onedrive|sharepoint|dropbox|box` in `base.py` **and explicitly permits `google`** — so it
  would have caught the *second* offender while the *first* sat three lines away in the same
  file. Replace it with a check that refuses **any** provider literal above `adapters/`,
  scanning `sources/base.py`, `sources/preview_service.py`, `sources/import_service.py` and
  `watch_service.py`.
  ⭐ **Drive it RED against a planted `"google"` branch and restore the file byte-identical**
  before trusting it — Phase 235's lesson, and Phase 236's SC#2 stated as a requirement:
  *a suite that cannot fail proves nothing.*

### Claude's Discretion
- Plan decomposition, file layout, and test placement, subject to G-8 (target 3-5 plans).
- The exact wire shape of the published source-family list (a field on the connections
  response vs. a small dedicated route) — whichever adds fewer round trips.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The contract this phase measures
- `.planning/phases/232-the-source-contract-google-drive/232-CONTEXT.md` — D-232-04 (the
  `browse`/`list_files`/`read_file`/`check` signatures), D-232-07 (conformance suite + boundary
  fence).
- `backend/app/services/sources/base.py` — the contract, the DTOs, `SourceRegistry`, and the
  `_ensure_registered` leak (D-238-09.1).
- `backend/app/services/sources/adapters/google_drive.py` — the shape to mirror;
  `_google_error_reason` is the enum-only error pattern to copy.
- `backend/app/services/sources/adapters/mock_source.py` — the fake that must keep conforming.
- `backend/tests/unit/services/sources/test_source_adapter_conformance.py` — the parametrized
  suite the Graph adapter joins.
- `backend/tests/unit/services/sources/test_boundary_fence.py` — the fence to strengthen (D-238-10).

### The loop it plugs into
- `backend/app/services/watch_service.py` §237-250 (the google fallback, D-238-09.2),
  §318-325 (`metadata.source`, D-238-07.4), §386-455 (the `modified_at` version comparison,
  D-238-03).
- `backend/app/services/sources/preview_service.py` — the four buckets, `_known_source_files`,
  the `path` fabrication site (D-238-07.3).
- `backend/app/services/sources/import_service.py` — single-file import through the registry.

### Egress
- `backend/app/security/egress.py` §228-330 — the three tables both new keys must appear in.
- `backend/tests/unit/test_190_egress.py:550-585` —
  `test_the_capability_keys_agree_with_the_shipped_closed_set`, which states the extra-key rule
  verbatim.

### OAuth (read-only — no change expected)
- `backend/app/services/oauth_service.py:104-116` — the shipped `microsoft` provider block.
- `backend/app/models/connector.py:223` — `OAuthProvider` already includes `"microsoft"`.
- `frontend/src/components/settings/servicesCatalog.ts` — the **Microsoft 365** catalog entry
  already ships (`shape: "oauth"`, `oauthProvider: "microsoft"`, `markKey: "microsoft"`).

### Frontend
- `frontend/src/components/sources/ConnectedSourceSection.tsx` — the docblock that specifies
  D-238-08 in its own words.
- `frontend/src/components/sources/CreateWatchModal.tsx:43` — the duplicated predicate.

### Registers
- `.planning/seeds/SEED-256-sharepoint-half-of-graph-deferred-no-work-tenant.md` — the deferred
  half and the admin-consent risk that travels with it.
- `.planning/seeds/SEED-253-source-file-path-is-synthetic-no-adapter-populates-it.md` — the
  folded seed; its trigger names this phase.
- `.planning/ROADMAP.md` §"Phase 238" — the operator's split note, SC#1-#4, and *How we'd know
  this failed*.

### Provider documentation (provider-docs-first — read, not remembered)
- `https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0` —
  the 302, the `1drv.com` Location, the `@microsoft.graph.downloadUrl` two-step, *"You don't
  need to include an `Authorization` header"*, *"valid for a limited time… might expire within
  minutes"*.
- `https://learn.microsoft.com/en-us/graph/api/driveitem-list-children?view=graph-rest-1.0` —
  `/me/drive/root/children`, `@odata.nextLink`, default page size 200, the `folder`/`file`
  facets, delegated personal-MSA permissions.

### Project rules that bind this phase
- `CLAUDE.md` — G-5 (hot-file ledger), G-8 (3-5 plans), the backend baseline gate, the vitest
  cap `GSD_VITEST_MAX_WORKERS=2`, worktree rules 1-4.
- `docs/HOT-FILE-LEDGER.md` — `connectors.py` (**extraction still OWED**),
  `connector_service.py`, `egress.py`.
- `AGENTS.md` §6.3 — the builder/reviewer separation this phase cannot satisfy alone.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SourceAdapter` + `SourceRegistry`** (`sources/base.py`) — the Graph adapter is a decorated
  class and one import line. Registration is already data.
- **`send_pinned_http`** (`security/egress.py:642`) — DNS pin, scheme check, host allow-list,
  redirect refusal, size cap. The adapter opens **no** socket of its own.
- **`get_fresh_access_token(conn_id)`** (`oauth_refresh_service`) — provider-agnostic; the Graph
  adapter's `_get_auth_token` is a copy of Drive's four lines.
- **`GoogleDriveSourceAdapter`** — 399 lines including its legacy shims. **The Graph adapter
  should land in roughly the same size or less** (no export step, no shared-drives second root).
  ⭐ That number is SC#4's yardstick: measure against it, do not go by feel.
- **The parametrized conformance suite** — adding a third `params` entry is the whole test wiring.
- **`servicesCatalog.ts`'s Microsoft 365 entry, `OAuthProvider`, `oauth_service`'s microsoft
  block, `connectionMark`'s microsoft mark** — the entire connect-a-Microsoft-account path
  already ships. **Nothing in this phase touches OAuth.**

### Established Patterns
- **Enum-only provider error reporting** (`_google_error_reason`) — never reflect a raw error
  body; it echoes user-supplied query text.
- **`SourceListing.complete` fails closed** — `True` only when the loop drains with
  `next_page_token is None` and zero errors (H-5). The Graph adapter's paging must not
  short-circuit that.
- **Egress keys are per-service, not per-verb** — `drive_read` set the precedent in Phase 232,
  and the closed capability set deliberately does not grow.
- **`modified_at` is the version** everywhere; no hash, no etag.

### Integration Points
- `SourceRegistry.get_adapter(conn)` — `watch_service.py:238`, `import_service.py:32`,
  `api/connectors.py:1911`. **All three become Graph-capable with zero changes** once the adapter
  registers — which is the contract working.
- `preview_service.build_preview` — provider-agnostic; consumes `FilePage`/`SourceFile` only.
- The frontend source surfaces via the new published family list (D-238-08).

</code_context>

<specifics>
## Specific Ideas

- ⭐ **SC#4 must produce a written verdict, in `238-VERIFICATION.md`, either way.** Not "the
  phase went fine". The concrete shape: *adapter line count vs `google_drive.py`'s 399*; *lines
  changed in `base.py` for the adapter itself* (target: **zero**); *whether any contract
  parameter was added*; and the three pre-existing leaks (D-238-09) recorded as **what the
  contract could not express** — because a registry that branches on provider names is exactly
  the thing SC#4 asks about.
- ⚠ **The UAT table records the SharePoint row ⛔ with `SEED-256` as its blocking id** — present
  and blocked, never absent.
- ⚠ **`MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` are an OPERATOR
  prerequisite** (an Azure app registration with the `/common` authority and a redirect URI
  matching `oauth_service`'s exactly). I cannot create one, and the operator is away. **Every
  live row therefore closes OWED, listed by name, never claimed.** The offline half — the
  conformance suite, the fence driven RED, the egress table wiring, the unit-level 302 two-step —
  is fully drivable and is what this phase proves before the operator returns.
- Same-commit rules that apply here: `deploy/onebox.env.example` + `docs/OPERATOR.md` if any env
  var the app reads changes (it should not); `docs/HOT-FILE-LEDGER.md` section for every row
  touched.

### Baselines captured BEFORE any edit (2026-09-07, quiet tree)
- **Backend:** `71 failed, 3971 passed, 2 xfailed, 2 xpassed, 0 collection errors` — exactly at
  the CLAUDE.md ceiling, **zero headroom**. The full 71-name failing SET is captured (not a
  count) so a new failure is provable by `comm -13`, per the standing lesson that a count hides
  a swap.
- **Frontend count gate:** captured in the same session; the verdict line is read verbatim in
  VERIFICATION, never summarised.

</specifics>

<deferred>
## Deferred Ideas

- **SharePoint document libraries** → `SEED-256` (already planted; trigger = a work/school
  tenant). Includes the unresolved `Sites.Read.All` admin-consent question.
- **Google Drive `path` population** → `SEED-253`, narrowed (D-238-07). Needs a parent walk
  Drive's `files.list` will not give free.
- **The chat-side cloud file picker's `includes("google")` predicate** → reviewed, NOT folded.
  `BUG-260905-01` ("cloud import lives in chat and dumps into Library root") proposes retiring
  that surface; widening it now is work with a negative half-life (D-238-08).
- **Recursive / subfolder watches** → not in SRC-03; it is the other half of SEED-253's trigger.
- **A OneDrive delta-query (`/delta`) sync** — Graph offers change tracking that would beat
  full re-listing, but Phase 234's loop is listing-shaped and `SourceListing.complete`'s
  fail-closed guarantee is defined on a full listing. A cheaper sync is a phase, not an adapter
  detail.

### Reviewed Todos (not folded)
- `BUG-260905-01-cloud-import-lives-in-chat-and-dumps-into-library-root` — adjacent (connectors,
  ingestion, library) but its fix is *moving* a surface, not *widening* one. Left open.

</deferred>

---

*Phase: 238-microsoft-graph-onedrive*
*Context gathered: 2026-09-07*
