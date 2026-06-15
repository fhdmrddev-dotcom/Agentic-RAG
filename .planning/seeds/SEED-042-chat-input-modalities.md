---
id: SEED-042
status: dormant
planted: 2026-05-31
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 090 operator-testing-notes triage)
trigger_when: Operator wants to attach a non-KB file to a single chat/task (e.g. a skill template, a one-off doc) WITHOUT it landing in the knowledge base, OR wants to dictate a prompt by voice
scope: Medium
---

# SEED-042: Chat Input Modalities — Ephemeral File Attach + Voice/STT

## Why This Matters

Right now there is exactly **one** way for a user to get a file into the app: upload it to the **knowledge base** (the Documents UI → `POST /documents/upload` → `documents` table → the ingest/embedding pipeline). That's a permanent, indexed, searchable library entry. Great for "here are my company docs, search them" — but it's the *only* door.

The chat box itself has no file door and no microphone. The composer (`frontend/src/components/chat/MessageInput.tsx`) is just a text area plus the provider / model / agent-mode dropdowns — **no paperclip, no mic** (verified: no file-attach or mic code in that file). So two everyday things the operator can't do today:

- **(B) Attach a file to just this chat/task — not the whole KB.** Example the operator gave: while *creating a skill*, hand the agent a template file to work from. Or drop a one-off document the agent should use for *this task only*. Today the only way to do that is to permanently ingest it into the KB, which pollutes the searchable library with throwaway stuff. There's no "scratch file for this conversation" path.
- **(C) Talk instead of type.** Dictate a prompt by voice (speech-to-text). No code for this exists anywhere.

Why it matters in plain terms: the KB is the *long-term library*; a chat attachment is a *sticky note for one task*. Conflating them means every template, screenshot, or quick reference the operator wants the agent to glance at becomes permanent library clutter. And voice is just a faster, hands-free way to start a prompt.

**Important — this is a deliberate scope decision, not a quiet add.** CLAUDE.md states the rule: *"Ingestion is manual file upload only — no connectors or automated pipelines."* A chat-scoped attach path is an *expansion* of the input surface and must be agreed as such at milestone time, not slipped in.

### The key design fork (B) — where do the attached bytes live?

This is the question the planning phase has to answer first, because each option has very different plumbing:

1. **A new ephemeral, task-scoped store.** A fresh table (e.g. `chat_attachments` keyed by `thread_id`) + Storage bucket, with its own TTL/cleanup. Cleanest separation from the KB; most new surface area.
2. **Reuse `workspace_files`.** Today `workspace_files` is **agent-scratch only** — the agent writes to it; the user can't. `backend/app/api/workspace.py` exposes only **GET** endpoints (list `/files`, `/files/{id}/content`, `/files/{id}/versions`, `/files/{id}/diff` — lines 98, 124, 202, 238). To let a *user* attach a file here we'd need a **new user-write endpoint + RLS policy** allowing user-origin rows. Conceptually tidy (one workspace store) but flips the read-only-for-users contract — design carefully.
3. **Auto-route to KB `documents`.** Cheapest to build (the pipeline already exists) but it's exactly the pollution we're trying to avoid — would need a "scratch / don't-index" flag on `documents` to be acceptable. Probably the wrong default.

The seed does NOT pick a winner — that's the spec/discuss phase's job. It just flags that the fork exists and that option (ii) costs a new write endpoint + RLS.

### Voice / STT (C)

Voice input is already *acknowledged but unrouted* in the PRD audit: `.planning/prd-reset/SUMMARY.md:100` lists **"#20 Voice input (STT) — GAP, unrouted"**, and `SUMMARY.md:153` rates the cluster (#19 embed widget / #20 voice / #21 email-to-thread) **LOW — "Not enterprise blockers."** No code exists. This seed converts that loose audit-checklist row into a tracked item with a concrete trigger so it stops being an orphan line.

## When to Surface

**Trigger:** the operator wants to attach a non-KB file to a single chat/task (e.g. a skill template, a one-off doc) WITHOUT it landing in the knowledge base, OR wants to dictate a prompt by voice.

Present during `/gsd:new-milestone` when the milestone scope matches:
- **Skill Studio / skill-authoring work** — the operator's own example (attach a template while creating a skill) makes the file-attach half a natural fit here. Pairs with SEED-002 (v3.0 Skill Studio) and SEED-005's skill-file/template use cases.
- **A dedicated multimodal / chat-input-modalities phase** — if file-attach and STT are scoped together as a composer upgrade.
- **Any chat-composer or `MessageInput.tsx` UX milestone** — if the composer is being reworked, this is the moment to add the paperclip + mic affordances.
- Recurrence of "I just want the agent to look at *this one file* for *this task*, not add it to my library."

## Scope Estimate

**Medium** — but cleanly splittable into two halves at two priorities:

- **File-attach half (the meat):** new store decision (the fork above) + Storage bucket + RLS + a composer paperclip affordance + wiring the attached file into the agent's context for that thread. This is the part worth pairing with **v3.0 Skill Studio** (template-on-create is the operator's own driving example).
- **STT half (LOW priority, can ride the same seed):** mic affordance in the composer + a speech-to-text path (browser `SpeechRecognition`/`MediaRecorder` for a cheap first cut, or a provider STT call). Rated LOW per `SUMMARY.md:153`; ship it opportunistically alongside the attach work, not as a blocker.

## Breadcrumbs

- `frontend/src/components/chat/MessageInput.tsx` — the chat composer; today Textarea + provider/model/agent-mode selectors only, **no paperclip, no mic** (where both affordances would land).
- `backend/app/api/documents.py:338` — `POST /upload` (the *only* current user file path → `documents` table → KB ingest); `documents.py:477` insert. This is the KB door we're deliberately *not* reusing for ephemeral attach.
- `backend/app/api/workspace.py:98 / :124 / :202 / :238` — the GET-only workspace API (agent-scratch). Option (ii) of the fork needs a **new user-write endpoint + RLS** added here.
- `.planning/prd-reset/SUMMARY.md:100` — STT lineage ("#20 Voice input (STT) — GAP, unrouted"); `:153` — LOW / not-an-enterprise-blocker rating.
- Related seeds — **SEED-005** (KB document-management-as-a-product; this seed must NOT overlap that — KB lifecycle is a different problem from chat-scoped scratch); **SEED-002 / v3.0** (Skill Studio — skill-file/template use case, the natural home for the attach half); **SEED-037** (panel file VIEW/DOWNLOAD — that's *reading* agent-produced files, not *uploading* user files; different direction).

## Notes

- **Hard line vs SEED-005:** SEED-005 is about making the *knowledge base* a managed product (organize/curate/lifecycle the permanent library). This seed is the opposite end — *ephemeral, task-scoped* bytes that should NEVER enter the KB. If a future phase blurs these, that's a design smell; keep the stores distinct.
- **Hard line vs SEED-037:** SEED-037 is panel-side *viewing/downloading* of files the agent generated. SEED-042 is *user → agent* upload of files the user supplies. Same panel neighborhood, opposite data flow.
- The CLAUDE.md "manual file upload only — no connectors" rule is about *automated/connector ingestion pipelines*; a manual chat-attach is still manual, but it does expand the input surface beyond the KB, so treat it as an explicit milestone decision (capture in DECISIONS.md when planned).
- First cut for STT can be fully client-side (browser Web Speech API) — zero backend cost — before considering a provider STT call. Mention at surface time so it isn't over-scoped.
