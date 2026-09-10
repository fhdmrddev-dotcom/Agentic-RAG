# 238-03 — The server publishes its source registry; the client stops guessing

**Commit:** `71a19f683` · **Executed:** 2026-09-07 · **Executor:** Claude, inline

⚠ **Written retrospectively at the phase close, not by a `gsd-executor` at the time** — see the
note in `238-01-SUMMARY.md`. Every figure is checkable against `71a19f683`.

## The choice this plan is really about

`ConnectedSourceSection.tsx` and `CreateWatchModal.tsx` each carried the identical predicate:

```ts
id.includes("google") || id.includes("workspace") || id.includes("drive")
```

and the first file's own docblock had already named the trap, before Phase 238 existed:

> *"The server's `SourceRegistry` is the authority and there is no endpoint that publishes its
> list… When a second family lands (Microsoft Graph, Phase 238), this predicate is the thing to
> widen, **and widening it by guess is how a dead option appears in a dropdown**."*

⛔ **Appending `|| includes("microsoft")` would have satisfied SC#1 and falsified the milestone's
binding constraint in the same commit** — Phase 239's MCP family would have needed the identical
edit again. Two characters of "done" against *"adding a source is rows, not code"*.

## What shipped instead

- **`GET /connectors/source-families`** publishes `SourceRegistry.list_supported_services()`.
- **`frontend/src/components/sources/sourceCapability.ts`** — one predicate, fed by that list,
  **failing CLOSED on `null`**: a connection offered and then unable to browse is a dead control
  a person clicks and blames themselves for; "not told yet" is not permission.
- Both copies of the string test **deleted**; both docblocks rewritten to say what actually
  happened rather than to keep warning about it.
- `mock_source` excluded **server-side and deliberately**. ⚠ It had been excluded *by accident* —
  the old guess simply did not match it — and D-232-03's claimed `VITE_ENABLE_MOCK_SOURCES` dev
  gate **does not exist in the tree** (`grep -rn mock_source frontend/src` finds it in tests
  only). Publishing the registry removed the accident, so the exclusion had to become explicit
  where a UI edit cannot widen it.

## The test that makes the claim executable

⭐ `test_a_newly_registered_family_appears_with_no_route_change` **registers a throwaway adapter
at runtime and asserts it appears in the response**, then removes it. That is *"rows, not code"*
as a passing assertion rather than a sentence in a summary — and it is what reds if anyone later
reintroduces a hardcoded list of known families.

## Verification

```
tests/unit/test_238_source_families_route.py       5 passed
frontend src/components/sources                    my suites green
                                                   (16 inherited reds in sourceComposition.test.tsx — see BASELINE.md)
npx tsc -p tsconfig.app.json --noEmit              66   (exactly the Phase 232 baseline)
count gate                                         242/242 · total 7822 · failed 0 · pinned 7026
                                                   (+6 = exactly this plan's one new suite)
```

⚠ The new suite went into **both** count-gate knobs. Phase 214 measured that TARGETS decides what
**runs** and BASELINE decides what is **guarded**, and a suite can sit on the wrong side of
exactly one of them for a whole phase without anyone noticing.

⚠ `connectors.py` also carries 238-02's cosmetic host de-branching, because both changes land in
the same file. **Recorded as a plan-boundary deviation rather than left silent** — a boundary that
moved quietly is indistinguishable from one that was never honoured.

## Driven live, later the same day

✅ **M-2 PASSED** — the operator confirmed Microsoft 365 appears in the Library picker. It appears
**because the server said its family is registered**, not because a string was widened: the
predicate never learned the word "microsoft".

⭐ **The consequence worth carrying into Phase 239: its MCP file family should appear in that same
picker with no frontend change at all.** That is the claim 239 gets to test, and if it fails, this
plan moved the guess rather than removed it.
