# 238-01 — The Graph adapter and its two egress keys

**Commit:** `409af705f` · **Executed:** 2026-09-07 · **Executor:** Claude, inline

⚠ **Written retrospectively at the phase close, not by a `gsd-executor` at the time.** All three
plans were executed inline rather than dispatched to executor agents, so no per-plan summary was
generated during the work and this file reconstructs it from the commit, the test output and the
measurements quoted in the commit message. **Stated because a summary written afterwards can be
back-fitted to the outcome** — every figure below is checkable against `409af705f`.

## What shipped

- **`backend/app/services/sources/adapters/microsoft_graph.py`** (352 L) — `browse` / `list_files`
  / `read_file` / `check` against Graph v1.0, registered under `microsoft` + `microsoft_graph`.
- **Two egress keys**, wired into all three tables (`ALLOWED_HOST_SUFFIXES`, `_HOST_MATCH`,
  `_TLS_SCHEMES`): `graph_read` → `graph.microsoft.com`; `graph_download` → `1drv.com`,
  `sharepoint.com`. Neither joins `EXTERNAL_ACTION_CAPABILITIES` — the ROADMAP's *"do not add a
  fifth verb"* holds, and `drive_read` set the service-key precedent in Phase 232.
- **`test_238_microsoft_graph_adapter.py`** — 15 cases, written RED first (confirmed: collection
  error before the adapter existed).
- **The conformance suite gained a third fixture**, passing every existing invariant unmodified.
- `mock_source.py` given real `path` values so the SEED-253 invariant could be asserted across
  families rather than for one.

## The 302 dance, which is the plan's reason to exist

Graph `/content` answers **302** to a different host; `send_pinned_http` refuses redirects **by
design**. The adapter therefore never calls `/content` — it does Microsoft's documented two-step:
`$select=…,@microsoft.graph.downloadUrl` under `graph_read`, then that preauthenticated URL under
`graph_download` **with no `Authorization` header**.

⛔ A `/content` fence in the suite asserts no requested URL ends in `/content` — so a future
"simplification" back to a single redirect-following request fails rather than silently working
in dev and breaking behind the egress binder.

## SC#4 evidence produced here

| Measure | Value |
|---|---|
| `sources/base.py` diff for the adapter | **0 lines** (`git diff --stat` empty) |
| Adapter size | **352 L** vs `google_drive.py`'s **399 L** |
| New contract parameters | **0** |
| Conformance invariants changed | **0** |
| Migrations | **0** |

⭐ **The cursor is the strongest single data point.** Drive returns an opaque `nextPageToken`;
Graph returns `@odata.nextLink`, a **full URL**. `next_page_token: str | None` carried both with
no contract change — an absolute URL and an opaque token are the two shapes a paging API comes
in, and one field held both.

## Two ROADMAP research flags, retired rather than answered

- **`driveItem.file.hashes`** — irrelevant. Nothing in this product reads a hash; `modified_at`
  is the version key at every comparison site and Graph returns `lastModifiedDateTime`. The flag
  was raised against a design the contract does not use.
- **`Files.Read.All` self-consent** — already shipped. `oauth_service.py:104-116` uses the
  `/common` authority with the scope already requested. ⛔ Says nothing about `Sites.Read.All` in
  an enterprise tenant, which travels with `SEED-256`.

## Verification

```
tests/unit/services/sources    104 passed   (94 before this plan)
tests/unit/test_190_egress.py   77 passed   incl. the extra-key wiring assertion
```

## ⚠ What this plan got WRONG, found later by driving

Two defects shipped here and were caught only when the operator's Azure registration allowed a
live drive (fixed in `7370fe543`):

1. **Every `$select` form suppresses `@microsoft.graph.downloadUrl`** — including Microsoft's own
   documented example. **Every download failed.** The 15 cases above could not see it: the fake
   returned the annotation unconditionally, so it agreed with my implementation rather than with
   Graph.
2. **`graph_download`'s allow-list was wrong** — real personal OneDrive serves from
   `my.microsoftpersonalcontent.com`, not the `files.1drv.com` the docs print.

⭐ Recorded here rather than only in the fix commit, because *"15 cases passed"* above is true and
was not sufficient, and a summary that omits that reads as stronger evidence than it is.
