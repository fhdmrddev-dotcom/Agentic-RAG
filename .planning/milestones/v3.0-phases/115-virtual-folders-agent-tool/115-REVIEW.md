---
phase: 115-virtual-folders-agent-tool
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/api/document_views.py
  - backend/app/services/document_view_resolver.py
  - backend/app/services/document_view_service.py
  - backend/app/services/openai_service.py
  - backend/app/services/tool_dispatcher.py
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 115: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 115 adds one agent tool, `query_documents_by_view`, that lets the chat agent
query documents through the same "virtual folder" views built in Phases 113/114. I
reviewed all five listed source files at standard depth, plus the supporting compiler
(`view_filter_compiler.py`), the AST models (`document_view.py`), the metadata-field
key constraints, and the agent-loop dispatch site, to trace the leak-safety and
error-propagation invariants end to end.

**The central security design holds.** The resolver was genuinely extracted into a
single `resolve_filter` core (no fork), and every documents query leg is scoped from
the CALLER (`.eq("user_id", caller)` + `get_globally_visible_folder_ids(supabase,
caller)`) — never from `view["user_id"]`. The saved-view-by-name path
(`get_view_by_name`) is itself caller-scoped (own-or-global), and a global view's
`folder_scope` is intersected with the caller's visible folders before any narrowing.
I could not construct a cross-user leak. The dual-wiring (SC#1) is real — the tool is
in both `_TOOL_REGISTRY` (`tool_dispatcher.py:2584`) and `get_tools()`
(`openai_service.py:970`) — and the schema is the cross-provider-safe flat
`view`/`filter`/`limit` shape with no `anyOf`/`oneOf`. The phase whitelist guard
(SC#2) is honored through the shared `dispatch_tool` path with no special-casing. The
resolver does not import FastAPI and raises a plain `ResolveError`; routes re-wrap and
the handler maps to a calm `ToolResult`. No f-string SQL: filter literals stay bound
PostgREST params, and the one `.or_()` interpolation (`is_empty`) only ever embeds a
whitelisted field key constrained to `^[a-z][a-z0-9_]*$`.

No BLOCKERs. The findings below are robustness/honesty gaps: an un-guarded `int()`
that escapes the handler's own "errors never raise" contract (caught only by the
agent-loop catch-all), the inherited PostgREST 1000-row ceiling that contradicts the
tool's "TRUE total is always reported" promise, and an unhandled-exception gap in
catalog mode. Plus minor info items.

## Warnings

### WR-01: `int(args.get("limit"))` can raise into the agent loop, bypassing the handler's "calm tool-result" contract

**File:** `backend/app/services/tool_dispatcher.py:394`
**Issue:** The handler's docstring promises (T-115-02-05): "Errors NEVER escape into
the agent loop... a `ResolveError`... or a Pydantic `ValidationError`... becomes a
calm `ToolResult` JSON string." But the `limit` is coerced *outside* any try/except:

```python
limit = max(1, min(int(args.get("limit") or 20), 50))
```

A weak/non-native model can emit `{"limit": "twenty"}` (or `{"limit": "20 docs"}`,
`{"limit": []}`, etc.). `int("twenty")` raises `ValueError` / `int([])` raises
`TypeError`, which propagates out of the handler. It is ultimately caught by the
agent-loop catch-all (`agent_loop.py:2097-2102`), so the run does not crash — but the
user/model gets a generic `"Tool error: invalid literal for int()..."` instead of the
designed catalog-pointing recovery string. This silently breaks the handler's own
stated contract and degrades the experience for exactly the weak-model class the
codebase already defends elsewhere (`_normalize_optional_int`, lines 1191-1205, exists
for precisely this reason).
**Fix:** Reuse the existing defensive coercion instead of a bare `int()`:
```python
_lim = _normalize_optional_int(args.get("limit"))
limit = max(1, min(_lim if _lim is not None else 20, 50))
```
(`_normalize_optional_int` already returns `None` for un-coercible values and is the
established pattern in this module.)

### WR-02: "TRUE total is always reported" is violated for views matching >1000 documents (inherited PostgREST row ceiling)

**File:** `backend/app/services/document_view_resolver.py:296-312` (count path),
`backend/app/services/openai_service.py:183` and `tool_dispatcher.py:319-320,439-442`
(the honesty claim)
**Issue:** The tool schema advertises *"The TRUE total is always reported"*
(`openai_service.py:183`) and the handler computes `total` from
`resolve_filter(count_only=True)`. But the count path selects rows
(`.select("id")...execute()`) with no `count=` aggregate, no `.range()`, and no
`.limit()` override:

```python
own_ids = { d["id"] for d in (await aexec(_apply(
    supabase.table("documents").select("id")
    .eq("user_id", caller).eq("is_latest", True)
))).data or [] }
```

PostgREST caps a non-counted select at its `db-max-rows` default (1000; no override
found in `supabase/config.toml`). So for any caller with >1000 latest documents
matching a view, both the count union and the full listing silently cap at ≤1000 each,
and `total` is undercounted. The comment at line 297 claims selecting ids "avoids the
silent >1000 undercount" — that is only true relative to `select("*")`, not relative
to the row ceiling itself; the ceiling still applies to an id-only select. This is
*inherited verbatim* from the 113/114 resolver (so it is not net-new to this code),
but Phase 115 is the surface that newly makes the explicit "always reported" promise
to the model, which an agent will faithfully relay to the user as fact.
**Fix:** Use a true server-side count for the total instead of materializing+counting
id rows, e.g. select with `count="exact"` and read `result.count` per leg — but note
the two legs can double-count a doc in a globally-visible folder, so an exact distinct
union still requires either a single combined query or an explicit
`.range(0, N)`/pagination with a documented ceiling. At minimum, soften the schema
wording to "the reported total is exact up to N matches" and add a `count_capped: true`
flag when a leg returns exactly the ceiling, so the agent does not assert a wrong total
as certain.

### WR-03: Catalog mode (`_catalog`) has no error guard, so a transient DB error in `list_views`/`_build_field_meta` leaks a raw exception

**File:** `backend/app/services/tool_dispatcher.py:344-356, 358-359, 367`
**Issue:** The handler wraps the *resolve* legs in `try/except ResolveError`
(lines 396-410) and the inline/saved parse in `try/except (ValidationError, ValueError)`,
honoring the "no raise into the loop" contract for those paths. But `_catalog()` —
which is the default entry (no args), the unknown-view fallthrough (line 367), and the
no-args discovery call — runs `document_view_service.list_views(...)` and
`_build_field_meta(...)` with no guard. A transient DB/network error (or a
`_build_field_meta` failure) raises straight out of the handler. Like WR-01 it is
caught by the agent-loop catch-all so it will not crash the run, but it again diverges
from the handler's documented "every failure becomes a calm catalog-pointing string"
contract — and the catalog path is the one the model is explicitly told to call first,
so it is a likely-hit path.
**Fix:** Wrap the catalog body (or the whole handler body after `_ensure_resolver()`)
in a `try/except Exception` that returns the same calm
`{"status": ..., "hint": "call with no arguments..."}` envelope, so the contract holds
uniformly rather than relying on the outer loop's generic handler.

## Info

### IN-01: Supplying both `view` and `filter` silently discards `filter` with no signal

**File:** `backend/app/services/tool_dispatcher.py:362-392`
**Issue:** The schema prose says "Never provide both," but if a model violates that,
`if view_name:` wins and the `filter` is silently dropped. This is a safe, leak-free
disambiguation (no security impact), but the model gets no feedback that its filter was
ignored, which can mask a mis-formed call.
**Fix:** Optional — when both are present, return a one-line `status: "ambiguous"`
note telling the model to pass exactly one, rather than silently preferring `view`.

### IN-02: Schema advertises `values` as string-only, but the model + compiler accept numbers

**File:** `backend/app/services/openai_service.py:164-167` vs.
`backend/app/models/document_view.py:63`
**Issue:** The tool schema declares `values: {"items": {"type": "string"}}`, but
`ViewCondition.values` is `list[str | int | float] | None`. The advertised schema is
*more* restrictive than what is accepted, so a numeric `one_of` membership (e.g.
`page_count one_of [2, 4]`) is reachable via the AST but the model is told it cannot
send it. Not a bug (over-restriction is safe), just a capability the model is
needlessly denied.
**Fix:** Optional — widen the advertised `values.items` to
`{"type": ["string", "number"]}` to match the model, or document the string-only
constraint intentionally.

### IN-03: Two full resolves where a count + bounded fetch would do

**File:** `backend/app/services/tool_dispatcher.py:396-412`
**Issue:** The handler runs `resolve_filter(count_only=True)` AND
`resolve_filter(count_only=False)` (which materializes ALL matching rows), then slices
to `limit`. This is two DB round-trips and an unbounded full-row fetch the handler then
throws most of away. Performance is out of v1 review scope, so this is informational —
but it interacts with WR-02 (the full fetch is also row-capped), so the two are worth
fixing together if WR-02 is addressed.
**Fix:** Optional / deferred — fetch only `limit` rows for display and derive `total`
from a true count, rather than materializing the entire match set.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
