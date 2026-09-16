---
id: BUG-260828-11
title: "\"You changed this\" appears on grants written by migration 128's backfill, which no person can have set"
reported: 2026-08-28
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [frontend/settings, connections, migrations]
folded_into: 248
verified_closed_by: 248
related_seeds: []
re_open_trigger: null
previous_id: BUG-260828-02
reproduces_on:
  branch: develop
  commit: 5bbfa24aa
  date: 2026-08-28
---

# BUG-260828-11: The override marker claims authorship the app cannot know

> ⚠ **THIS REPORT PREVIOUSLY CARRIED `BUG-260828-02`, AND SO DOES ANOTHER ONE.** Two different bugs
> shared the id. `248-CONTEXT.md:376` found the collision on 2026-09-14, routed it to Phase 251, and
> it was still unfixed at the v4.2 audit — so `REQUIREMENTS.md`'s `CRED-02` citation had to be
> rewritten to cite this file **by path** because the bare id resolved by filename to the wrong bug.
> Renamed here at Phase 252 Plan 01 (D-36).
>
> ⭐ **THE OTHER REPORT KEEPS `-02`**
> (`BUG-260828-02-no-authoring-surface-can-declare-a-workflow-input.md`) because it is the one that
> is CITED: `verified_closed_by: 214.1`, named in `v3.9-ROADMAP.md`, in three `214.1-*` planning
> artifacts and in eight source/test files. Renaming the cited one would have produced dangling
> citations in code; renaming this one produced none — measured, before and after.
>
> ⛔ `BUG-260828-01` … `-10` are all taken, so `-11` is the next free id on that date.

> ⭐ **CLOSED BY PHASE 248 (2026-09-16).** The headline defect — *"You changed this"* — was already
> gone: `GRANTS_COPY.OVERRIDDEN_LABEL` is `""` (`grantsVocabulary.ts`, deleted at `e615c0dad`). What
> this report also named, the **affordance** that framed a backfill as an undo of a human choice,
> is closed too: the reset now reads *"Follow the default instead"*, and
> `ConnectionGrantsList.test.tsx` asserts the **rendered DOM text** (9/9) rather than block
> presence — a presence assertion cannot see content drift. Evidence:
> `.planning/phases/248-the-credential-boundary/248-VERIFICATION.md` (`status: complete`,
> `verification_mode: peer-reviewed`), and `REQUIREMENTS.md` `CRED-02`.

## What we observed

Driven in the live app during Phase 213's driven check. Settings → Connections → **Slack-rag-test**
→ the single action row `post_message` renders:

```
post_message | … | Unknown | You changed this | Use the default | Allow | Ask first | Deny
```

with **Allow** pressed. **No person set that grant.** The tri-state control was structurally
unreachable for the capability shape until commit `09bfcb95f` (2026-08-27) — `handleSave` gated the
grants write on `capability === "mcp"` on both arms and `grantsArePersisted` mirrored it, and Phase
212's D-4b test asserted the control's *absence*. The `allow` on that row is what migration 128 §3
backfills: `tool_grants = jsonb_build_object(capability, 'allow')`.

The marker's semantics were confirmed the same session: clicking *"Use the default"* on
`GitHub / create_branch`, saving, and re-reading Postgres showed the key **removed** (44 → 43 keys)
and the marker gone. It tracks **key presence**, not authorship.

## Why it matters

Small, but it is an honesty defect in a permission surface — the one screen where "who decided this"
is the question. It also mis-teaches the reset affordance: *"Use the default"* offers to undo a
choice nobody made. The blast radius is every capability row on every install that ran migration 128,
plus every MCP grant the backfill mapped from `true → 'allow'`.

## Hypothesized cause

**Verified.** `resolveItemPosture` (`frontend/src/components/settings/ConnectionGrantsList.tsx:29`)
returns `isOverridden: true` for any explicit key, and the row renders `GRANTS_COPY.OVERRIDDEN_LABEL`
("You changed this") from it. The predicate is right for *inherit vs explicit*; the **copy** claims a
person, which the data cannot support.

Two honest repairs, both cheap: reword to what is known (an explicit value, not an author), or make
the marker mean *differs from the connection default* — note that under the second reading a row
explicitly set to the same value as the default would stop showing it, which is a behaviour change,
not just copy.

## Surface classification

`Agentic-RAG` — this app's Settings surface.

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 213 closed; recorded, not routed into a further round).
- **Defer to future phase / milestone:** the next phase whose `files_modified` names
  `ConnectionGrantsList.tsx` or `grantsVocabulary.ts`.
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds

None needed — the posture shown is correct; only the attribution is not.

## Reference / evidence links

- `.planning/phases/213-per-tool-grants-and-the-approval-moment/213-SUMMARY.md` §3, finding D-2
- `frontend/src/components/settings/ConnectionGrantsList.tsx:29-36`, `:241-249`
- `supabase/migrations/128_connector_connection_posture.sql` §3
- `09bfcb95f` — the commit that first made the control reachable for capability rows
