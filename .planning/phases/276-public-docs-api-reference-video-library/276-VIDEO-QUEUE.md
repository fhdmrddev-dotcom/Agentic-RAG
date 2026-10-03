# Phase 276 — video queue (handoff)

Written 2026-10-04 so any session can finish pending video work. Notebook: **"Syrel — Knowledge & Videos"** `78d31d07-3e5a-4f6b-ab95-024b2fbbeef0` (account fhdmrd.automation@gmail.com, NotebookLM Pro).

## NotebookLM — status

| Artifact | Status | Note |
|---|---|---|
| Explainer: "Syrel: Workflows You Can Trust" `3d6fbe95-…` | ✅ done (9:16) | downloaded to `~/Downloads/gemini-notebook/Syrel/explainer-workflows-you-can-trust.mp4` |
| Documentary ep. 1 (cinematic) `9b0b14b0-…` | ⏳ queued at NotebookLM | download when `studio_status` says completed |
| Documentary eps. 2–5 (cinematic) | ⛔ NOT CREATED — rate-limited | retry after the rolling window resets (it reset at 2026-10-04 01:24 UTC); create ONE at a time, ~2 min apart |

Rate limit facts: ~2% of the weekly quota per video; the short rolling window throttles after ~3 videos ("Rate limited — code 8"). Check `usage_get` first.

## Eps. 2–5 — exact create calls (`studio_create`, artifact_type=video, video_format=cinematic, language=en, confirm=true)

Every call also includes the index source `fa8f1b50-c3c3-4847-9755-8e0e8015b65c`.

- **Ep. 2 — "An agent that keeps working" (v2.5–v2.8)** sources: `f879c366-5eef-46f0-98c4-b78dc59e6c5f`, `47beaf14-738f-4e60-95ac-cd8a74b518fe`, `362efdce-945d-4516-b0cd-c080fd036674`, `3fe8c992-b49b-4585-98aa-c3036288733c`. Focus: answers survive refresh/closed tab; multi-worker server; nine providers with live "show your work"; the agent's workspace (files, to-dos, helper agents, questions to the user); strict workflow mode (ordered, checked, audited). Tease Chapter 3.
- **Ep. 3 — "Workflows anyone can author" (v2.9–v3.3)** sources: `326ebf05-5cc5-4fa7-b696-0240a7e97fef`, `98df8fd4-2ba8-49be-818c-f17995bf266a`, `93355808-3112-4cc6-ae4e-bdaa9989e3b5`, `1d08ffce-cb04-47bc-a296-831a201abb57`, `78a83b46-9434-4c66-a29f-93c6b44e6292`. Focus: plain-English workflows → cited Word deliverable; publish gauntlet; managed library (metadata, views, links, suggested classification); skill eval studio; Control Room, model registry, encrypted keys, install wizard. Word/PDF are downloaded, not previewed in-app. Tease Chapter 4.
- **Ep. 4 — "Organisations and connections" (v3.4–v4.2)** sources: `f638a7c8-f0b5-420e-a21f-bfd8c51e9bf4`, `c1c073b8-27c1-4d45-90b2-cdfd8f21f8f5`, `cadd3de3-8305-4b4a-a966-a9b6ef64d7c7`, `f3ae0305-f487-4d50-a904-276a089196f5`, `106241b7-554b-4674-b719-ae5e48fd200f`, `0fc01b12-4ba7-4634-b045-4cc13291e41b`, `bebe812e-7c16-4cb4-8542-d3553f00de9c`, `734796ff-6c4a-48f4-801f-2cb9ae79e829`, `e163129d-f5c7-4b14-ba33-77e14db93609`. Focus: isolated orgs; drag-and-drop canvas; workflows end to end; tables + email, scheduled runs under a spend cap; connections with per-tool Allow/Ask/Deny and an audit receipt per call; watched sources (OFF by default — operator enables); credentials never at rest readable. Tease Chapter 5.
- **Ep. 5 — "A product you can sell" (v4.3–v4.5)** sources: `a0367ba4-1b38-4f05-832d-759f06d7c02d`, `174cb251-552f-48c0-a6a1-940ca46d1e82`, `e893f230-8e72-47ee-be1e-8a44a653ad85`. Focus: every token priced, tiers enforced; Experts as installable bundles copied into your org; Experts only add; spend per Expert; five starter Experts (Financial Analyzer, Contract Reviewer, HR Policy Advisor, Operations Analyst, Security & Compliance). v4.5 "Find It, Show It" is IN PROGRESS / NOT RELEASED — upcoming only. Close: "answers from your knowledge, with receipts."

Each focus prompt opens: `Documentary episode N of "Syrel: The Build Story" — Chapter N, "<title>" (releases …). The product is Syrel (formerly Agentic RAG). … Only state what the sources mark as shipped; note where later releases changed things.`

## After download

Wrap each in Remotion `BrandedEpisode` (`video/`, see `video/README.md` → Video library) and store raw downloads in `video/public/notebooklm/` (gitignored).
