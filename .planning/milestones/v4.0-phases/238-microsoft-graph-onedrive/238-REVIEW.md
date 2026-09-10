---
phase: 238-microsoft-graph-onedrive
reviewed: 2026-09-10T12:04:02Z
review_type: independent
reviewer: Claude (gsd-code-reviewer) — did NOT build this phase
depth: standard
range: 409af705fda07866c399ea58e296dda11d715a76^..25c650231bb9f88539cfb504f3b65cba1a787fbe
files_reviewed: 20
files_reviewed_list:
  - backend/app/api/connectors.py
  - backend/app/security/egress.py
  - backend/app/services/ingest_enrich.py
  - backend/app/services/sources/__init__.py
  - backend/app/services/sources/adapters/microsoft_graph.py
  - backend/app/services/sources/adapters/mock_source.py
  - backend/app/services/sources/base.py
  - backend/app/services/sources/import_service.py
  - backend/app/services/sources/preview_service.py
  - backend/app/services/watch_service.py
  - backend/tests/unit/services/sources/test_238_disabled_connection_refuses.py
  - backend/tests/unit/services/sources/test_238_microsoft_graph_adapter.py
  - backend/tests/unit/services/sources/test_238_source_path_honesty.py
  - backend/tests/unit/services/sources/test_boundary_fence.py
  - backend/tests/unit/services/sources/test_source_adapter_conformance.py
  - backend/tests/unit/test_238_source_families_route.py
  - frontend/src/components/sources/ConnectedSourceSection.tsx
  - frontend/src/components/sources/CreateWatchModal.tsx
  - frontend/src/components/sources/sourceCapability.ts
  - frontend/src/lib/api/connectors.ts
findings:
  critical: 1
  blocker: 1
  warning: 8
  info: 8
  total: 17
status: issues_found
---

# Phase 238: Independent Code Review (AGENTS.md §6.3)

**Reviewed:** 2026-09-10T12:04:02Z
**Depth:** standard
**Range:** `409af705f^..25c650231`
**Status:** issues_found — **1 BLOCKER, 8 WARNING, 8 INFO**

## Summary

The adapter itself is the best part of this phase and its central claim survives scrutiny:
`sources/base.py`'s DTOs are byte-unchanged for the adapter (`SourceFile.path` and
`next_page_token` both pre-existed), the 302 two-step is genuinely sealed inside
`microsoft_graph.py`, the download call genuinely carries no `Authorization` header, the two new
egress keys are correctly wired into all three tables, and the display-name leak
(`import_service.fetch_cloud_file`) is genuinely deleted. The egress module's own host matching
is label-boundary (`h == suffix or h.endswith("." + suffix)`), so the three new `graph_download`
suffixes cannot be widened by an `evilsharepoint.com`, and a server-supplied `downloadUrl`
re-enters full `validate_destination` (scheme, host, DNS pin, redirect refusal, size cap). **No
SSRF was found via `@microsoft.graph.downloadUrl`, `@odata.nextLink` or `webUrl`.**

The defects are not in the adapter. They are in the **shared plumbing this phase edited around
it**, and the biggest one is that the phase's headline fix — SEED-253, *"a path is real or it is
absent, never fabricated"* — is **reopened by code added in the same commit**, on the door the
phase's own VERIFICATION calls *"the door most people actually use"*. Three of the phase's own
fences would not catch it, one of them because it asserts key presence and cannot see value
drift — this project's own recorded lesson, in the fence written to close a miss of exactly that
shape.

Every finding below was reproduced against the code rather than reasoned about; the probe output
is quoted where it is load-bearing.

---

## BLOCKER

### CR-01 / BL-01: `confirm_preview` feeds a fabricated — and partly caller-controlled — path into `metadata.source.path`, where it reaches a classification rule

**Files:**
`backend/app/services/sources/preview_service.py:334`, `:592`, `:620`, `:728` ·
`backend/app/services/sources/import_service.py:233` ·
`backend/app/services/ingest_enrich.py:568`

**Issue.** This phase removed the `/<filename>` fabrication at `ingest_enrich.py:568` and wrote
the reason in place: *"a fabricated value reached a **rule**"*. In the same commit it added
`source_path=item.path` at `preview_service.py:728`, and `item.path` is the fabricated value.
The chain is complete and every link is in this diff:

```
walk_source_files:334   f.path = f"{current_path}/{f.name}" if current_path else f"/{f.name}"
build_preview:592       file_path = getattr(f, "path", None) or f"/{f.name}"
build_preview:620       PreviewItem(..., path=file_path)
confirm_preview:728     import_single_file(..., source_path=item.path)      # NEW in 238
import_single_file:233  metadata["source"]["path"] = source_path            # NEW in 238
ingest_enrich:568       src_path = source_info.get("path")
ingest_enrich:569-571   eval_facts["path"] = src_path  →  classification rule matching
```

Reproduced (`walk_source_files` against a stub adapter that supplies no `path`, `folder_name=None`):

```
walk path -> ['/Q3 Rates.pdf']
```

That is character-for-character the value `test_the_fabricated_path_was_the_thing_that_lied`
(`test_238_source_path_honesty.py:60`) names as *"the whole bug"*, and the value
`TestSourceFilePathIsNeverFabricated` (conformance suite) declares invalid at the contract level.

**Two distinct failures, both user-visible:**

1. **Google Drive, hand-imported.** Drive supplies no `path`. Import a folder through
   *Library → Add files* → the document is persisted with `metadata.source.path = "/Q3 Rates.pdf"`.
   A rule `path contains '/Finance/'` is False for a file that IS in Finance; a rule
   `path contains 'Rates'` is True because it matched the filename. **The dead rule looks alive
   again.** The same file arriving through the watch loop gets `path = None` and behaves
   correctly — so the two writers now disagree, which is the exact asymmetry
   `test_EVERY_writer_of_metadata_source_carries_the_path_key` was written to prevent.
2. **A caller-controlled fact.** `SourcePreviewRequest.folder_name` is
   `str | None = None` with no validation (`models/connector.py:717`), and
   `walk_source_files` seeds the breadcrumb from it verbatim
   (`init_path = f"/{folder_name.strip('/')}"`). A client that POSTs
   `{"folder_name": "Finance"}` causes every imported document to be persisted with
   `path = "/Finance/<name>"` **regardless of where the files actually are**, and a
   `path contains '/Finance/'` auto-classification rule then fires on all of them. A request
   body is deciding a stored provenance fact that governs automated filing suggestions.

**Why the phase's fences miss it.** `test_EVERY_writer_of_metadata_source_carries_the_path_key`
greps for the literal `'"path": source_path,'` — key presence, not value honesty (see WR-08).
`test_ingest_enrich_no_longer_fabricates_a_path` asserts the removed expression at *one* site.
The conformance suite asserts the invariant per-adapter, where it holds, and never at
`PreviewItem`, where it does not.

**Fix.** Keep the display fallback; stop routing it into a stored fact. Carry the honest value
separately from the rendered one:

```python
# preview_service.py — in build_preview
adapter_path = getattr(f, "path", None)          # None means "unknown", and stays None
file_path = adapter_path or f"/{f.name}"         # DISPLAY only

items.append(PreviewItem(
    ...,
    path=file_path,              # what the row shows
    source_path=adapter_path,    # what may be persisted — None when unknown
))

# confirm_preview
source_path=item.source_path,    # never item.path
```

Then extend the writer-set fence to assert the *value*, e.g. a case that drives
`confirm_preview` with an adapter returning `path=None` and asserts the minted
`metadata.source.path` is `None` — not merely that the key exists.

---

## Warnings

### WR-01: the OneDrive search query is interpolated into the URL **path**, escaping only `'`

**File:** `backend/app/services/sources/adapters/microsoft_graph.py:237-238`

```python
safe = query.replace("'", "''")
url = f"{GRAPH_API_BASE}/me/drive/root/search(q='{safe}')"
```

`query` is end-user input reaching this from `GET /connectors/connections/{id}/files?query=…`.
Only the OData string delimiter is escaped; **URL syntax is not**. Reproduced with
`query="a')?$expand=children&x=('"`:

```
SEARCH URL   : https://graph.microsoft.com/v1.0/me/drive/root/search(q='a'')?$expand=children&x=(''')
SEARCH PARAMS: {'$select': 'id,name,...', '$top': '30'}
```

The caller's `?` terminated the path and opened a query string; `$expand=children` is now a real
OData parameter on the request, sitting beside the `params` httpx merges in. A `/` plus
`../` segments is normalised by `httpx.URL`, so the caller also controls which Graph *endpoint*
is hit under the connection's OAuth token.

**This is a regression against the sibling adapter, not parity with it.** `google_drive.py:254-266`
puts the identical user string into a `params` **value**, where the transport percent-encodes it
and the URL structure is untouchable. `send_pinned_http`'s own docstring states the rule
(*"Query parameters, encoded by the transport rather than by the caller"*) and this call site
opts out of it.

**Not SSRF:** the host is pinned to `graph.microsoft.com` and the token scope is the caller's own
(`Files.Read.All` delegated), so there is no cross-tenant escalation. It is an
arbitrary-Graph-GET primitive plus a 400-on-a-paren robustness bug.

**Fix.** Move the term out of the path:

```python
url = f"{GRAPH_API_BASE}/me/drive/root/search(q='{{q}}')"   # no — templating a path is the same bug
```

Use the parameter form Graph supports and let the transport encode it:

```python
url = f"{GRAPH_API_BASE}/me/drive/root/search"
params_extra = {"q": query}      # threaded into _get_page's params dict
```

If the function-call form must stay, percent-encode with `urllib.parse.quote(safe, safe="")`
before interpolation and add a driven case for `?`, `#`, `)` and `/`.

---

### WR-02: a `next_page_token` that is not literally prefixed `https://graph.microsoft.com/v1.0/` is **silently ignored**, and page 1 is refetched

**File:** `backend/app/services/sources/adapters/microsoft_graph.py:161-165`

```python
if page_token and page_token.startswith(f"{GRAPH_API_BASE}/"):
    url = page_token
else:
    params = {"$select": ..., "$top": ...}      # ← silently starts over
```

There is no `else: raise`. Any cursor that does not match the prefix byte-for-byte — a
differently-cased host, a `v1.0` vs `beta` base, a future `nextLink` shape — restarts the
listing with no error anywhere. Reproduced with an uppercase host, which is a legal URI
variation:

```
page_token   : https://GRAPH.microsoft.com/v1.0/me/drive/root/children?$skiptoken=Z
CURSOR URL   : https://graph.microsoft.com/v1.0/me/drive/items/F1/children   ← page 1 again
```

**Consequences, both silent:**
- `preview_service.walk_source_files` re-reads page 1 up to `MAX_PAGES_PER_FOLDER` and then
  reports `truncated=True, stopped_by="pages"` — a folder-is-too-big message for a folder that
  is not.
- `watch_service` (`:251-261`) hits its `seen_tokens` cycle detector, logs a WARNING and sets
  `listing.complete = False`. That fails **closed** for deletions (good), but the run reports
  `success` while only ever syncing the first page. A watched OneDrive folder larger than one
  page would silently stop importing at file 200 forever.

The suffix pin on `graph_read` already validates the host on the way out, so re-issuing an
unrecognised cursor is safe; guessing is not.

**Fix.**

```python
if page_token:
    if not page_token.lower().startswith(f"{GRAPH_API_BASE.lower()}/"):
        raise ValueError(
            f"Graph returned a cursor this adapter will not re-issue: {page_token[:40]!r}. "
            "Refusing rather than silently restarting the listing."
        )
    url = page_token
else:
    params = {...}
```

Add a driven case: a mismatched cursor raises, and the same cursor with the expected prefix is
re-issued verbatim.

---

### WR-03: `SourceFile.path` mixes percent-encoded folder segments with a raw filename, and passes drive-internal ids through as folder paths

**File:** `backend/app/services/sources/adapters/microsoft_graph.py:100-112`, `:266`

`_folder_path` strips the `root:` prefix and returns the remainder **verbatim**, then
`list_files:266` concatenates the **decoded** `name`:

```
_folder_path({"parentReference": {"path": "/drive/root:/Team%20Docs/Q3%20Plans"}})
  -> '/Team%20Docs/Q3%20Plans'
composed path -> '/Team%20Docs/Q3%20Plans/Q3 Plans.pdf'
```

Graph documents `parentReference.path` as a *navigable* (URL-encoded) path. The two halves of
one string are therefore in different encodings regardless of what Graph does — and a person
writing `path contains '/Team Docs/'` gets **no match**, which is SEED-253's exact user-visible
failure arriving through a new mechanism. Every folder with a space or a non-ASCII character is
affected. The live UAT could not see it: the only driven folder was `/Attachments` and the only
driven file was `Practical_Project_Management_Guide_Recreated.docx`.

Second arm: when the path carries no `root:` marker, the regex does not match and the raw value
is returned as a folder path:

```
_folder_path({"parentReference": {"path": "/drives/b!abc/items/01XYZ"}})
  -> '/drives/b!abc/items/01XYZ'
```

An opaque drive/item id is then presented as a location a person is invited to write a rule
against.

**Fix.**

```python
from urllib.parse import unquote

stripped = _PATH_PREFIX.sub("", raw)
if stripped is raw or not raw.startswith("/drive"):   # no root: marker → we do not know the path
    return None
return unquote(stripped).rstrip("/")
```

Drive the case with a folder containing a space against a real OneDrive before closing SEED-253's
Graph half — this is the one property the doubles cannot check, and it is the same class of miss
as the `$select` suppression the phase already paid for once.

---

### WR-04: the two new egress keys have **no test that drives the real allow-list**

**Files:** `backend/app/security/egress.py:289-328` ·
`backend/tests/unit/services/sources/test_238_microsoft_graph_adapter.py:292-306`

`graph_read` and `graph_download` are the phase's only new security surface, and
`graph_download`'s destination is **server-supplied** — the module's own comment says the suffix
pin *"is its only fence"*. Nothing in the repository exercises that fence:

```
$ grep -rn "graph_download\|1drv\|microsoftpersonalcontent" backend/tests/
  (only test_238_microsoft_graph_adapter.py and test_source_adapter_conformance.py — both fakes)
```

`test_a_download_url_on_an_unexpected_host_is_refused_not_swallowed` **manufactures**
`EgressRefused` inside its own stub. It asserts the adapter propagates a refusal; it would pass
identically if `ALLOWED_HOST_SUFFIXES["graph_download"]` were `("com",)`.
`test_190_egress.py::test_the_capability_keys_agree_with_the_shipped_closed_set` only checks
table *membership* (the `KeyError`-at-the-socket property) — never host behaviour.

**Fix.** Three cases in `test_190_egress.py`, against `validate_destination` with a stub
resolver:

```python
@pytest.mark.parametrize("host", [
    "b0mpua-by3301.files.1drv.com", "contoso.sharepoint.com",
    "my.microsoftpersonalcontent.com",
])
def test_graph_download_admits_the_three_microsoft_suffixes(host): ...

@pytest.mark.parametrize("host", [
    "evil1drv.com", "notsharepoint.com", "microsoftpersonalcontent.com.evil.net",
    "graph.microsoft.com.evil.net",
])
def test_graph_download_refuses_a_label_boundary_near_miss(host): ...

def test_graph_read_is_pinned_to_graph_microsoft_com_alone(): ...
def test_graph_download_refuses_http(): ...
```

---

### WR-05: the disabled-connection guard is claimed to cover every caller and does not — and the test written to prove it cannot see either gap

**Files:** `backend/app/services/sources/base.py:143-152`, `:210-212` ·
`backend/tests/unit/services/sources/test_238_disabled_connection_refuses.py:121-135` ·
`backend/app/services/connectors/service_tools.py:1685-1692` ·
`backend/app/services/sources/adapters/google_drive.py:405-413`

`SourceConnectionDisabled`'s docstring asserts: *"Every source operation already funnels through
`SourceRegistry.get_adapter(connection)`."* Two paths do not.

1. **The string arm is a documented bypass.** `get_adapter("microsoft")` skips the check
   entirely, and `test_a_bare_service_id_string_still_resolves` pins that as intended. A route
   written tomorrow as `get_adapter(conn.service_id)` — the obvious spelling — silently loses the
   guard, and `test_every_production_caller_goes_through_the_choke_point` will not notice,
   because it only greps four hardcoded files for `_adapters[` / `_adapters.get(`.
2. **A production caller constructs an adapter directly.** `service_tools.py:1689` (the agent's
   `search_files` tool) calls `google_drive._list_google_drive_files`, which does
   `adapter = GoogleDriveSourceAdapter()` and synthesises `{"id": …, "service_id": "google"}` —
   **no `is_enabled` key, no registry, no guard**. The registry-grep fence cannot see a direct
   class instantiation.

**Not a live hole today:** `agent_loop.py:1534` filters `c.is_enabled` before offering the tool,
so a disabled connection is not reachable from chat. The defect is the **false completeness
claim** plus a fence that certifies it. `BUG-260907-03` is recorded as closed on the strength of
that claim.

**Fix.** Either narrow the claim in the docstring and in `238-VERIFICATION.md` to *"every route
that resolves a connection object"*, or close the gaps: have `_list_google_drive_files` resolve
through `SourceRegistry.get_adapter(conn)` with a real connection row, and strengthen the fence
to also flag `SourceAdapter` subclass instantiation outside `adapters/`:

```python
BANNED = ("_adapters[", "_adapters.get(", "SourceAdapter()", "SourceAdapter(")
# plus an AST pass for `ast.Call` on any name ending in "SourceAdapter"
```

---

### WR-06: two rewired frontend components ship with **no mount-level test**, and a single failure of the new route makes both surfaces silently empty

**Files:** `frontend/src/components/sources/ConnectedSourceSection.tsx:59-75` ·
`frontend/src/components/sources/CreateWatchModal.tsx:64-82`

Both components gained a **blocking** dependency on `GET /connectors/source-families` via
`Promise.all`. At the range tip neither file has a test suite:

```
$ git ls-tree -r --name-only 25c65023 -- frontend/src/components/sources/
  ConnectedSourceSection.tsx      ← no ConnectedSourceSection.test.tsx
  CreateWatchModal.tsx            ← no CreateWatchModal.test.tsx
  __tests__/sourceCapability.test.ts   ← the only new suite: a pure function
```

`src/components/sources` is not a TARGETS **directory** entry (the phase's own gate comment says
so), so the green `242/242` verdict covers the new pure function and nothing that mounts.

**Concrete failure.** If `/connectors/source-families` 404s, 401s or times out — including the
normal case of the Vercel frontend deploying ahead of the Coolify backend, which this repo does
as two separate operations — `Promise.all` rejects and:

* `ConnectedSourceSection` runs `setConnections([])` and, per its own new comment, *"Renders
  nothing at all"*. **No error is shown.** A connection list that fetched successfully is
  discarded because a sibling call failed.
* `CreateWatchModal` shows *"Could not load connected services."* and no connection can be
  watched.

Failing closed is the right direction for the *predicate*; discarding a successful response and
rendering nothing is not the right shape for the *surface*.

**Fix.** Decouple the two fetches and render the failure:

```tsx
const [rows, families] = await Promise.all([
  listConnectorConnections(),
  listSourceFamilies().catch(() => null),   // null = "not told yet" → isSourceCapable fails closed
])
setConnections(rows.filter((c) => isSourceCapable(c, families)))
if (families === null) setNotice("Could not check which sources can be browsed. Try again.")
```

Add mount tests for both components (they must be named individually in TARGETS **and** BASELINE)
covering: families resolve → capable connection listed; families reject → nothing offered **and a
notice rendered**; a `service_id` in the list that the old string guess would have rejected.

---

### WR-07: the boundary fence sees only `ast.Compare`, and does not scan the file that carried leak #5

**File:** `backend/tests/unit/services/sources/test_boundary_fence.py:86-103`, `:32-37`

The fence is a genuine improvement over the Phase 232 version and its positive control is real.
Its stated rule, however, is broader than its implementation: *"no provider identity decides
control flow above `adapters/`"*. It walks `ast.Compare` **only**. All of these pass:

```python
if service_id.startswith("google"): ...       # ast.Call — invisible
if service_id.endswith("_workspace"): ...     # ast.Call — invisible
match service_id:
    case "google": ...                        # ast.Match — invisible
if _PROVIDER_HANDLERS[service_id](): ...      # dict used as control flow — invisible
```

`startswith` is the most natural alternative spelling of the exact leak that was found
(`"google" in service_id`), and the positive control drives only `in` and `==`.

`FENCED_MODULES` also omits `app/api/connectors.py` — **the file that carried leak #5**
(`host="googleapis.com" if service_id == "google" else ""`) — and `app/services/ingest_enrich.py`.
The completeness test only globs the top level of `services/sources/`, so a regression in
`connectors.py` is invisible to the guard written after finding one there.

**Fix.** Extend `_scan` to `ast.Call` on `.startswith` / `.endswith` / `.find` / `.count` with a
constant argument, and to `ast.Match` case patterns; add `app/api/connectors.py` to
`FENCED_MODULES` (the new `_CHECK_HOST_BY_SERVICE` dict is data and passes). Extend the positive
control to drive each new shape — a fence extension nobody has seen fire is not an extension.

---

### WR-08: the writer-set fence asserts key **presence** and cannot see value drift

**File:** `backend/tests/unit/services/sources/test_238_source_path_honesty.py:80-103`

```python
writers = {
    "app/services/watch_service.py": '"path": item.path,',
    "app/services/sources/import_service.py": '"path": source_path,',
}
```

This is a whole-file substring grep. It is satisfied the moment the literal appears anywhere in
the file, and it says nothing about what `source_path` contains — which is precisely how CR-01
ships green. It is also formatting-brittle: reflowing the dict, or writing
`"path": source_path or None,`, breaks it for no behavioural reason. `test_ingest_enrich_no_
longer_fabricates_a_path:75` has the same shape (`'f"/{filename}" if filename else None' not in
src`) — switching the f-string to single quotes defeats it.

This is the project's own recorded lesson (*"presence assertions cannot see content drift"*)
landing inside the fence written to close a miss of exactly that shape.

**Fix.** Drive the behaviour instead of grepping for it: call `confirm_preview` (or
`import_single_file` directly) with an adapter that returns `path=None`, and assert the minted
`metadata["source"]["path"] is None`; then with an adapter returning `/Documents/Finance/x.pdf`
and assert it survives verbatim. Keep the source grep only as a completeness check over the
*set* of writers, and say in the message that it proves membership and not honesty.

---

## Info

### IN-01: a test that cannot fail
`test_238_source_path_honesty.py:122-127` —
`test_a_bare_filename_is_not_a_path_the_contract_would_accept` asserts only over its own
parametrized literals (`"/Q3 Rates.pdf".count("/") == 1`). It imports no product code and its
outcome is independent of the entire implementation. Either delete it or point it at
`SourceFile`/`PreviewItem` values produced by a real adapter.

### IN-02: a "positive control" that is a duplicate, not a control
`test_238_disabled_connection_refuses.py:138-150` — `test_the_guard_can_actually_fire` is
labelled *"THE POSITIVE CONTROL"* but performs the same call and the same assertion as
`test_a_disabled_connection_is_refused_at_the_choke_point:49`, wrapped in a manual try/except.
No defect is planted and nothing is proven that the first test did not already prove. The
boundary fence's control (`_scan` over planted source) is the shape this one should copy.

### IN-03: the contract module still documents the behaviour this phase removed
`backend/app/services/sources/base.py:42-44` still reads *"Stand-in path: no adapter currently
populates it (production falls back to '/&lt;filename&gt;')"*. Two adapters now populate it and the
fallback is gone from `ingest_enrich`. The sibling comments at `preview_service.py:583` and
`ingest_enrich.py:537` were corrected in this commit; the contract's own was not — so the
authoritative file carries the stale statement.

### IN-04: a comment that is not true of the code
`backend/app/services/sources/base.py:210-212` — *"This arm is used by `watch_service`"*.
`watch_service.py:243` passes `conn`, a dict. No production caller uses the bare-string arm
(verified by grep); it is exercised only by tests. Correct the comment, since it currently reads
as a justification for the bypass described in WR-05.

### IN-05: dead code left by the de-branching
* `SourceRegistry.is_source_supported` (`base.py:352`) has **no production caller** after the
  alias fallback was removed — it is now an exact dict lookup nobody performs.
* `_folder_path`'s `return stripped or ""` (`microsoft_graph.py:112`) — `stripped` is already
  `""` when empty; the `or` is a no-op.
* `ALLOWED_EXACT_LITERALS = ("drive",)` (`test_boundary_fence.py:68`) is unreachable: no member
  of `PROVIDER_LITERALS` is a substring of `"drive"`, so a bare `"drive"` was never flagged. The
  exemption's reasoning is sound but the code does nothing.

### IN-06: `source_path` is silently dropped when `external_id` is absent
`import_service.py:213` — `metadata` is built only `if external_id:`. The Phase 216 single-file
attach door passes neither, so a future caller supplying `source_path` alone gets no error and no
stored path. Either raise, or build `metadata` whenever any of the four source facts is present.

### IN-07: an auth test satisfied by a crash
`test_238_source_families_route.py:88-100` — `assert res.status_code != 200` with
`raise_server_exceptions=False`. A 500 from an unconfigured dependency passes as *"the route must
not answer an unauthenticated caller"*. Assert `res.status_code in (401, 403)`.

### IN-08: two modules exempted from the fence with no reason recorded
`test_boundary_fence.py:161` excludes `failure_cause.py` and `health_verdict.py` from the
completeness check while the assertion message on the very next line demands *"or state here why
they carry no source routing"*. Both are clean today (verified: no provider literals), so this
costs nothing now — but an exemption whose reason lives nowhere is the shape the phase's own
narrative spends four paragraphs criticising.

---

## Checked and found sound — so the next reader need not re-derive it

**Egress / SSRF (the review's primary focus).**
* `_host_is_allowed` (`egress.py:386-404`) is **label-boundary**: `h == suffix or
  h.endswith("." + suffix)`. `evil1drv.com`, `notsharepoint.com` and `evilgraph.microsoft.com`
  are all refused. The three new `graph_download` suffixes cannot be widened by a hostile host
  name. (Untested — see WR-04 — but correct.)
* The server-supplied `@microsoft.graph.downloadUrl` re-enters `send_pinned_http`, which runs the
  full `validate_destination` (capability → scheme → host → **every** resolved address), rewrites
  the URL to the validated IP literal, restores SNI by name, sets `trust_env=False` and
  `follow_redirects=False`, and caps the decompressed body. **A hostile `downloadUrl` cannot
  reach an internal address, an unlisted host, a non-TLS scheme, or a redirect.**
* `validate_destination` drops query and fragment before host matching, so a `downloadUrl`'s
  preauth query string cannot influence the pin. `_refuse` logs capability/host/reason only —
  never the URL, never a credential.
* `@odata.nextLink` is re-issued under `graph_read`, which is pinned to `graph.microsoft.com`
  alone. The prefix check at `:162` is a correctness bug (WR-02), **not** a security control —
  the pin is.
* `webUrl` is stored in `SourceFile.web_view_url` and never fetched.
* Neither new key joins `EXTERNAL_ACTION_CAPABILITIES`; both are present in all three tables
  (`ALLOWED_HOST_SUFFIXES`, `_HOST_MATCH`, `_TLS_SCHEMES`), which
  `test_190_egress.py:551-583` mechanically enforces. **No fifth verb was added.**

**Token handling.**
* `_get_auth_token` fails **closed**: no id → `ValueError`; no token → `ValueError`. It never
  returns `""`.
* The download call carries `{"Accept": "*/*"}` and **no `Authorization`**, asserted case-
  insensitively at `test_238_microsoft_graph_adapter.py:288`. Verified by reading — the token is
  genuinely absent on the only call whose host is merely suffix-pinned.
* No token, refresh token, header or URL reaches a log line. `logger.error` at
  `microsoft_graph.py:178` carries only the operation name, the status code and an enum code.
* `_graph_error_reason` is enum-only, gated by `^[A-Za-z][A-Za-z0-9_]{0,63}$`, and excludes
  `error.message` — driven with a secret-bearing message at `:321-334`. It mirrors
  `_google_error_reason` rather than inventing a second convention, as the phase claims.
* No OAuth code changed. `oauth_service`'s `microsoft` block and the `Files.Read.All` scope set
  predate this phase (verified against the range).

**The display-name leak (the brief asked me to find it).**
Genuinely fixed. `import_service.fetch_cloud_file` no longer reads `service_name`; the
`NotImplementedError` is now the only answer to an unresolvable connection. `watch_service`'s
`get_adapter("google")` fallback is likewise deleted. Both deletions are pinned by
`test_no_source_module_falls_back_to_the_drive_adapter`. **The phase's account of leaks #1-#4 is
accurate.** Leak #5 is now a dict (`_CHECK_HOST_BY_SERVICE`), correctly lower-cased and
`.get(..., "")`-defaulted, and it is display-only.

**Connection-scoped visibility (`ingest_visibility`).**
`import_single_file:205-209` reads `default_ingest_visibility` **exclusively from the connection
record** and passes it to `async_mint_document_row` with an explicit `org_id=str(active_org)` —
TM-232-05 / TM-232-06 intact. `watch_service:235` does the same. Neither takes it from a request
body. `get_connection` is org-scoped (`.eq("org_id", …)`) and projects
`_SELECTABLE_COLUMNS`, never `*`. **No path was found by which a synced document lands visible to
an org that should not see it.**

**The disabled-connection guard, where it does apply.**
`is_enabled` is `boolean NOT NULL DEFAULT true` (migration 116), so the `enabled is False`
identity check cannot be defeated by a NULL, and the absent-key default (`True`) is only
reachable for synthesised dicts and fixtures. `ConnectorConnectionResponse.is_enabled` is a real
field and is in `_SELECTABLE_COLUMNS`, so the guard **does** fire on the object routes — it is not
inert. All five source routes catch `SourceConnectionDisabled` **before** their broad
`except Exception` (verified line by line), so a disabled connection returns `409
connection_disabled` and not a 502 blaming the provider. `watch_service` checks `is_enabled`
before resolving, so its legible `paused` outcome is preserved, and the ordering is pinned. The
`check_connection` route was separately verified to refuse via
`connector_service.resolve_connection` → `ConnectorDisabled`, so it does **not** mint a token for
a disabled connection. Caveat: WR-05.

**The registry de-branching.**
Removing the `"google" in service_id` alias fallback is safe for shipped data: the catalog's
`serviceId` is `"google"` and the adapter registers both `google` and `google_workspace`.
`service_id` is normalised (stripped) on write and lower-cased on lookup, so a `"Google"` row
still resolves. `_ensure_registered`'s deletion is safe — `sources/__init__.py` imports every
adapter eagerly and is the single registration site.

**The published-registry route.**
`GET /connectors/source-families` is behind `get_current_user`, returns a capability list with no
org-scoped data, sorts its output, and excludes `mock_source` **server-side** where a UI edit
cannot widen it. `test_a_newly_registered_family_appears_with_no_route_change` is a real property
test — it registers a throwaway adapter at runtime and cleans up in a `finally`. The frontend
predicate fails closed on `null` and is case-insensitive. **The "rows, not code" claim is true of
this code.**

**SC#4's central measurement.**
Verified independently: `SourceFile.path`, `FilePage.next_page_token` and the four contract
methods all pre-date this phase, so `microsoft_graph.py` genuinely cost `base.py` **zero DTO or
signature lines** — the 110 lines that did change are the de-branching and the new exception,
which is a different claim and is stated as one. The conformance suite gained a fixture and no
invariant. `352` vs `399` lines confirmed. **The phase's headline finding stands.**

**Gates.** `pytest backend/tests/unit/services/sources -q` → **322 passed** on the current tree.
No test was modified by this review; no source file was modified by this review.

---

## What is still owed after this review

1. **CR-01 must be fixed before this ships further.** It is a data-integrity defect on a persisted
   fact that drives automated classification, and part of it is caller-controlled.
2. **WR-01 and WR-02** are both one-function fixes in the adapter, each needing one driven case.
3. **WR-04's four egress cases** are the cheapest high-value work here — the phase's only new
   security surface currently has zero real coverage.
4. **M-9 remains half-owed** (per `238-VERIFICATION.md`) and must now be re-driven through the
   **manual import** door specifically, because CR-01 means that arm is still wrong.
5. **SEED-253's Graph half should not be marked discharged** until WR-03 is driven against a
   OneDrive folder whose name contains a space.

---

_Reviewed: 2026-09-10T12:04:02Z_
_Reviewer: Claude (gsd-code-reviewer) — independent; did not build, plan or verify Phase 238_
_Depth: standard · Range: `409af705f^..25c650231`_
