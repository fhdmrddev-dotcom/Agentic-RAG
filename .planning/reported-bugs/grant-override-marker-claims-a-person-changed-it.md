---
id: BUG-260828-02
title: "\"You changed this\" appears on grants written by migration 128's backfill, which no person can have set"
reported: 2026-08-28
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/settings, connections, migrations]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 5bbfa24aa
  date: 2026-08-28
---

# BUG-260828-02: The override marker claims authorship the app cannot know

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
