---
id: BUG-260907-03
title: Disabling a connection stops the scheduled watch and NOTHING else — browse, preview and import still make credentialed live calls to the provider
reported: 2026-09-07
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/api/connectors, backend/services/sources, connections, sources, security, egress]
folded_into: null
verified_closed_by: "238"  # fixed and driven the same day, both directions
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 4496bd055
  date: 2026-09-07
---

# BUG-260907-03: "Disable" does not stop a connection from reading

## What we observed

Driving Phase 238's **M-8** row (*disconnect freezes, nothing is deleted*), the operator disabled
the Microsoft 365 connection in Settings → Connections and reported that the source picker **still
listed their OneDrive folders**.

Confirmed in the database and then driven directly:

```
connector_connections:  service_id=microsoft  status=active  is_enabled=False

>>> adapter.browse(conn, folder_id="onedrive")
LIVE browse on a DISABLED connection returned 6 folders:
    ['Apps', 'Attachments', 'Desktop', 'Dokument', 'Pictures', 'Videos']
```

⚠ **This is not a stale cache.** `_get_auth_token` ran, `get_fresh_access_token` minted a token
from the stored refresh token, and a real HTTPS call went to `graph.microsoft.com` — for a
connection the operator had switched off.

The guard exists in exactly one place:

```
backend/app/services/watch_service.py:205   if not conn.get("is_enabled", True):   ← the loop checks
backend/app/api/connectors.py               grep is_enabled -> 0 checks
backend/app/services/sources/*              grep is_enabled -> 0 checks
```

`connector_service.get_connection` filters by **id and org only** — it returns disabled rows
unchanged — and `browse_connection_hierarchy` goes straight from that row to
`SourceRegistry.get_adapter(conn)` with nothing in between.

⛔ **This is NOT Graph-specific.** The unguarded code is the shared source path. **Google Drive
has the identical hole**, and has had it since Phase 232; Phase 238 only surfaced it because M-8
was driven for the first time.

## Why it matters

**Major.** *Disable* is the control a person reaches for when they want a connection to stop
touching their data — after a scare, before an offboarding, or while deciding whether to remove
it. Today it stops the **background loop** and leaves every **interactive** path fully live:
browsing, previewing and importing all continue to authenticate as that user against the provider.

Three consequences, in order of seriousness:

1. **A withdrawn permission is not withdrawn.** The stored refresh token keeps minting access
   tokens and reaching the provider after the person said stop.
2. **The control lies.** Nothing in the UI suggests "disabled" means "scheduled syncing only".
3. **New documents can still enter the Library through a disabled connection**, because
   `import_single_file` is on the same unguarded path — so "disabled" does not even mean
   "read-only".

⚠ **It also partially refutes a claim Phase 238's own verification made.** `238-VERIFICATION.md`
recorded SC#3's *"disconnect freezes"* as **PASS by construction**, reasoning that
`watch_service` resolves its adapter through the registry and never asks which family it got.
That reasoning is sound *and only covers the loop*. The interactive half was asserted, not
checked. ⭐ **The SC#3 criterion as written still holds** — it asks that Graph behave *identically*
to Drive, and it does, because both are unguarded — which is exactly how a real defect can hide
behind a satisfied criterion.

## Hypothesized cause

**Verified, not hypothesised.** There is no shared choke point where a source operation resolves
a connection. Every route repeats `get_connection(...)` → `SourceRegistry.get_adapter(conn)`, and
the `is_enabled` check lives in `watch_service` because that is the one place someone thought to
put it (Phase 235's `failure_cause.py:42` even documents it as *"the only code that KNOWS the
connection is off"* — accurate, and the problem).

## Suggested fix

⭐ **Put the check where the adapter is resolved, not in each route.** Every source operation
already funnels through `SourceRegistry.get_adapter(connection)`; a disabled connection should
fail there, once, for browse / list / read / check and every future caller — rather than through
five separate route edits that the sixth route will forget.

- Refuse with a named, machine-readable reason (`connection_disabled` already exists in
  `services/sources/failure_cause.py` — reuse it rather than inventing a second vocabulary).
- ⚠ `watch_service`'s existing check must keep its own behaviour: it **pauses** and records a
  cause, and must not start raising.
- ⚠ Drive the fix RED first — disable a connection, assert browse/preview/import all refuse —
  because a guard nobody has seen fire is not a guard.
- Decide deliberately whether `check()` (the credential probe) is exempt: a person may want to
  verify a disabled connection before re-enabling it. State the answer either way.

## Surface classification

`Agentic-RAG` — our routes, our source contract, our control.

## ✅ RESOLVED 2026-09-07, the same day, and DRIVEN BOTH DIRECTIONS

Fixed at the choke point rather than in the routes, exactly as suggested above.

**`SourceRegistry.get_adapter(connection)` now raises `SourceConnectionDisabled`** when the
connection it is handed carries `is_enabled is False`. That one site covers browse, list, read,
check — and every caller nobody has written yet, which is the whole reason it is not five route
edits.

**Live proof, on the same connection row, both directions:**

```
is_enabled = False  ->  REFUSED · reason_code=connection_disabled · no network call made
is_enabled = True   ->  browse returned 6 folders
                        ['Apps','Attachments','Desktop','Dokument','Pictures','Videos']
```

The second line is the half that matters as much as the first: the guard stops the read
**without** breaking the working case.

### The decisions taken, stated rather than left implicit

- **Absent `is_enabled` means ENABLED.** Every existing caller and fixture omits the key, so
  defaulting to refused would have turned a security fix into an outage. This is the same
  reading `watch_service.py` already used; it is now stated once in the registry instead of
  once per caller.
- **The watch loop keeps PAUSING, not raising.** It checks `is_enabled` *before* resolving an
  adapter, so it never reaches the refusal — and a test now pins that ordering, because
  reversing it would convert a legible "this source is paused because you disabled it" into an
  exception, which is the opposite of what Phase 235 exists for.
- **HTTP 409 Conflict**, chosen and written down: the request is well-formed and the caller is
  entitled to it, but the resource is in a state that forbids it and the person can fix that
  themselves. Not 404 (the connection exists; hiding it would be a lie), not 403 (this is not
  about permission), not 503 (nothing is broken).
- **The refusal is raised OUTSIDE each route's broad `except Exception`**, which turns anything
  it catches into *"the provider returned an error"*. A control that failed to stop something
  must not read as Microsoft's fault.
- **`check()` — the credential probe — is deliberately NOT blocked.** It does not go through
  `SourceRegistry`; it uses the OAuth refresh path. Someone should be able to verify a disabled
  connection before deciding to re-enable it.

### Tests

`backend/tests/unit/services/sources/test_238_disabled_connection_refuses.py` — 10 cases,
written RED before the fix, including a **positive control** (the guard fires on the exact input
it exists for), the three non-regressions (enabled / key-absent / bare-string), and a structural
check that no production caller bypasses the choke point by reaching into `_adapters` directly.

## Suggested routing

- **Fixed directly, 2026-09-07** — see above. No phase needed.
- ⚠ **The UI half is NOT fixed and is not this bug.** The Connections page still labels a
  source-only connection *"Not usable"* (`BUG-260907-01`), and nothing yet tells a person that
  a disabled connection will refuse a browse — they will now see a 409 where they used to see
  folders. Wording that refusal on the surface belongs with `BUG-260907-01` at Phase 239.

## Workarounds

~~To genuinely stop a connection reading, **delete it** rather than disabling it.~~ **No longer
needed — Disable now genuinely stops reads.** Kept struck through rather than removed, because
anyone who followed this advice between the report and the fix deleted connections they could
have kept.

## Reference / evidence links

- `backend/app/services/watch_service.py:205` — the only `is_enabled` check in the codebase
- `backend/app/api/connectors.py` → `browse_connection_hierarchy` — resolves and browses with no
  check
- `backend/app/services/connector_service.py` → `get_connection` — filters by id + org only
- `backend/app/services/sources/failure_cause.py:42` — documents `watch_service` as the only code
  that knows a connection is off
- `.planning/phases/238-microsoft-graph-onedrive/238-VERIFICATION.md` — SC#3 and the M-8 row
- Live proof: `browse()` returning 6 real OneDrive folders at `is_enabled=False`, 2026-09-07
