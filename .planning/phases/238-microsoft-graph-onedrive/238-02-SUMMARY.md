# 238-02 — The contract leaks SC#4 found, and a fence that could actually fire

**Commit:** `c74883928` · **Executed:** 2026-09-07 · **Executor:** Claude, inline

⚠ **Written retrospectively at the phase close, not by a `gsd-executor` at the time** — see the
note in `238-01-SUMMARY.md`. Every figure is checkable against `c74883928`.

## The finding this plan exists to record

Phase 232's boundary fence refused the literals `onedrive | sharepoint | dropbox | box` inside
`sources/base.py` and **explicitly permitted `google`** — so it would have flagged the *second*
vendor to leak while the *first* sat **three lines away in the same file**.

Four provider branches were already above `adapters/`:

| # | Where | What it did |
|---|---|---|
| 1 | `base.py::_ensure_registered` | Lazily imported an adapter chosen by `"google" in service_id` — provider branching **inside the contract module**, and redundant: `sources/__init__.py` already imports every adapter eagerly. Adding Graph would have meant a third `elif`. |
| 2 | `base.py::get_adapter` / `is_source_supported` | Substring alias fallbacks, where the adapter already carries `@SourceRegistry.register("google_workspace")`. |
| 3 | `watch_service.py` | On an unresolved adapter, fell back to `get_adapter("google")` — a Graph connection whose adapter failed to register would have been **silently read by the Drive adapter**. |
| 4 | `import_service.fetch_cloud_file` | ⭐ **Found by the rewritten fence on its FIRST run — nobody had spotted it.** Same fallback, keyed on `service_name` — the connection's **DISPLAY NAME**. A Microsoft connection someone had typed *"Google migration"* into would have been read by the Drive adapter holding a Microsoft token. |

**The finding, in SC#4's own terms:** the contract expressed the **adapter** and did not express
**resolution**. It could not say *"there is no adapter for this connection"*, so three call sites
each invented an answer.

## The fence, rewritten and DRIVEN RED

Replaced a deny-list of vendor names with the actual rule: **no provider identity decides control
flow above `adapters/`**. Scans `base.py`, `preview_service.py`, `import_service.py` and
`watch_service.py` with `ast`, refusing any provider literal in a `Compare`.

⚠ **Exemptions are named and reasoned, not omitted** — `application/vnd.google-apps.*` are MIME
constants (deleting them breaks Docs export), and `"drive"` is a `SourceNode.kind` value. A
future exemption is a visible edit rather than a silent gap.

**Driven RED, and recorded:**

```
1. planted `if "google" in service_id` in sources/base.py
2. fence FAILED by name:  "app/services/sources/base.py … line 201: 'google' (matches 'google')"
3. restored — md5 186c606c5cf3cb02ed42d2f34990248d, verified identical on both sides
4. re-run — green
```

The suite also carries its own **positive control** and a completeness check that a new module
dropped into `services/sources/` cannot be silently unfenced.

## SEED-253, the half addressed here

- `ingest_enrich.py` no longer substitutes `/<filename>`. An unknown path stays absent, so a
  folder-shaped rule **declines** instead of matching a fabricated filename.
- `watch_service.py` writes the real `path` into `metadata.source` — the key was **absent**,
  which is why the fabrication was reached at all.

⚠ **A correction to the seed, measured rather than inherited.** SEED-253 says production *always*
substitutes `/<filename>`. True of the watch→ingest path, **false of the preview path**:
`preview_service._walk_folder:333-334` builds a real breadcrumb before any fallback runs. So the
fix landed where a fabricated value reached a **rule**, and deliberately not where it reaches a
preview row a person is looking at.

## Verification

```
tests/unit/services/sources                110 passed
tests/unit/services                        228 passed
full backend gate                          71 failed / 4010 passed — failing NAME SET identical
```

## ⚠ What this plan got WRONG, found later

It fixed **one** of the two `metadata.source` writers. `import_single_file` — the door a person
actually clicks — kept writing no `path`, so hand-imported documents had no folder fact while
watched ones did. Found by two OneDrive files landing four minutes apart through different doors;
fixed in `52f2655f8`.

⭐ **Fixing one writer of a fact reads exactly like fixing the fact**, and every per-writer test
passed throughout. The replacement fence asserts over the **set** of writers.
