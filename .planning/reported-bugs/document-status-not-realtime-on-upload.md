---
id: BUG-260516-01
title: Document status stays on "pending" after upload until manual refresh or route change
reported: 2026-05-16
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/documents-list, frontend/realtime, backend/realtime]
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: f2cff11
  date: 2026-05-16
---

# BUG-260516-01: Document status stays on "pending" after upload until manual refresh or route change

## What we observed

Operator uploaded a thesis PDF via the frontend (http://localhost:5173/) while testing
the new camelot table-engine path during Phase 071.3 Plan 03 pre-test. The document
appeared in the documents list with `status: pending`. Backend extraction completed
successfully and the row's status advanced through the normal `processing` → `completed`
lifecycle in Postgres. The UI did NOT reflect any of those transitions: the row stayed
on `pending` until the operator manually navigated away and back to the documents
page (or hit refresh).

Expected: status badge updates in real time without user action.
Actual: status badge frozen on the value present at first render.

## Why it matters

Minor severity — extraction is succeeding; the data is correct in the DB; users can
still see the final status with a refresh. But the perceived behavior is "upload
hangs / silently fails," which erodes trust in the upload UX during demos and
day-to-day use. The longer extraction takes (Docling-era 4-min stalls, camelot's
~30-60s on a thesis), the worse the perception. Most users will refresh repeatedly
out of anxiety rather than wait, defeating the point of having Realtime at all.

## Hypothesized cause

Per CLAUDE.md (D-v2.5-03): Supabase Realtime is documented as a best-effort hint
with mandatory fetch-on-(re)connect reconciliation. Three plausible causes:

1. **No subscription:** the documents-list page doesn't mount a Supabase Realtime
   channel on the `documents` table at all. The list is fetched once on mount and
   never re-fetched until a route change forces a remount.
2. **Subscription exists but reconcile-on-event isn't wired:** the page subscribes
   to UPDATE events but the event handler doesn't refetch or patch the local list
   state. Symptom matches: events fire silently, UI stays stale.
3. **Channel drops without reconnect:** the websocket disconnects (cold start,
   network blip, dev-server HMR), the page has no reconnect handler, no events
   are delivered. Symptom matches but only on long sessions.

(1) is the most likely candidate given that even short sessions exhibit the bug.

Verifying which would need a `grep` for `supabase.channel\|.on('postgres_changes'\|useRealtimeDocuments\|DocumentList` etc. in `frontend/src/` plus a quick Chrome DevTools network/websocket inspection.

## Surface classification

`Agentic-RAG` — this is a frontend bug in the Agentic RAG documents-list page. It
WILL be routed at the next `/gsd:discuss-phase` / `/gsd:new-milestone` touchpoint
per CLAUDE.md mandatory cross-check rule.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 071.3 just shipped; no decimal phase
  open for this bug.
- **Defer to future phase / milestone:** good candidate to fold into Phase 077
  (Multi-Worker Validation Harness) since that phase touches the streaming /
  realtime path, OR into Phase 082 (Cross-cutting Verification + Extraction
  Telemetry) since that phase verifies the end-to-end UX of the new default-set.
  Alternatively a small decimal phase (e.g. 071.4 or 072.1) if the operator
  wants this fixed before the next major surface.
- **Plant as seed:** not needed — it's a concrete, repro'd bug; seed is for
  forward-looking ideas.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- UI-side: hit browser refresh (Ctrl+R) after upload; status will reflect current
  DB state. Or click into another route and back.
- Code-side: a polling interval on the documents list (e.g., `setInterval(refetch,
  3000)` while any row is in `pending`/`processing`) is a low-risk shim until
  Realtime is properly wired. Two-line change in the documents-list hook.

## Reference / evidence links

- Observed during Phase 071.3 Plan 03 pre-test session (chat history: operator
  pre-tested camelot before applying migration 047; status indicator was the
  observability vehicle for confirming extraction had run).
- CLAUDE.md "Supabase Realtime is a best-effort hint, not source of truth" rule
  (D-v2.5-03 in PROJECT.md / v2.5 milestone notes).
- Frontend entry points to grep: `frontend/src/pages/documents/`,
  `frontend/src/hooks/use*Documents*`, `frontend/src/lib/supabase/`.
