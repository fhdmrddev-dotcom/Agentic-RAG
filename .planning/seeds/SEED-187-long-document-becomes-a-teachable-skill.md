---
seed_id: SEED-187
title: Turning a document into a skill is HALF-BUILT and the half that exists is retrieval-shaped — the skill-creator grounds itself with search_documents chunks, has no whole-document read, and there is no entry point from a document at all (grep over the Documents surface returns zero)
created: 2026-08-19
planted_during: Phase 200 execution — operator asked what the GitHub community offers; the `book-to-skill` pattern (23k stars) prompted an audit that REFUTED the first version of this idea and produced a narrower, truer one
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - SEED-186 — *community skill repos unreachable by one predicate*. **Same seam, opposite
    direction.** 186 is skills arriving FROM outside; this is skills MANUFACTURED from the user's own
    material. Both produce a multi-file skill bundle, so both depend on the bundle shape being sound.
  - SEED-096 — *skill bundle file-tree fidelity*. ⚠ **A generated bundle hits the IDENTICAL
    flattening defect as an imported one.** If this ships before 096, a skill this app generated
    itself will lose its own reference tree on the way to the sandbox. That is a worse look than
    losing a third party's.
  - SEED-168 — *the class of work: knowledge-derived, human-accountable*. This is that class exactly:
    a house SOP or manual becomes an executable behavior, and someone must stay accountable for it.
  - SEED-161 (in-app document editing) — the other feature that treats a document as a working
    surface rather than a search corpus.
  - `supabase/migrations/087_skill_creator_reborn.sql` — the creator's shipped instruction body; the
    evidence for both what exists and what does not.
trigger_when: >
  NOT already true and NOT urgent — this is a capability, not a defect, and it should wait for a
  Skills-shaped milestone rather than be squeezed into a workflow phase. Fire it at whichever comes
  first:
    (a) `/gsd:new-milestone` where Skills are in scope — as a candidate REQ-ID, sequenced AFTER
        SEED-096 (bundle fidelity), because a generated bundle inherits every one of 096's defects;
    (b) the next phase whose `files_modified` names `supabase/migrations/*skill_creator*` or the
        Documents page — the entry-point half is cheap to add while that surface is already open;
    (c) any operator ask of the shape "can it learn our house process / this manual".

  ⚠ **Re-verify the two measurements below before planning — do NOT inherit them.** The creator's
  instruction body is a seeded DB row, so it can be edited in the live database without any commit,
  and this seed's central claim ("`search_documents` only, no whole-document read") would rot
  silently. Two commands:
    grep -n "search_documents\|read_document\|fetch_full_document" supabase/migrations/087_skill_creator_reborn.sql
    grep -rni "skill" frontend/src/components/documents/ frontend/src/pages/DocumentsPage.tsx
trigger_paths:
  - "frontend/src/components/documents/**"
  - "frontend/src/pages/DocumentsPage.tsx"
  - "supabase/migrations/*skill_creator*"
  - "supabase/migrations/087_skill_creator_reborn.sql"
trigger_surfaces:
  - "skills"
---

# The document→skill path exists, is retrieval-shaped, and starts in the wrong place

## ⚠ This seed's first draft was wrong, and the correction is the content

The idea arrived as *"we own documents and we own skills — nobody has connected them."* That is
**false**, and it took one grep to find out. `supabase/migrations/087_skill_creator_reborn.sql:92`
instructs the skill-creator, verbatim:

> "Before drafting, call `search_documents` to pull real context from the user's uploaded documents
> that should shape the skill — domain terms, house style, worked examples, constraints. Cite what
> you found and ask whether it should inform the instructions. **This grounds the skill in the
> user's actual material; a plain chatbot can't do this.**"

Someone already had this thought and already shipped it, and they were right that it is the
differentiating move. **What follows is only the part that is genuinely missing** — which is
narrower than the original idea and considerably more defensible.

## Gap 1 — the creator sees chunks, never a document

The creator's own honesty block (`087_skill_creator_reborn.sql:116`) enumerates its tools verbatim:

> "You CAN: read the user's documents (`search_documents`), save and update skills (`save_skill`),
> load skills (`load_skill`), read attached skill files (`read_skill_file`), and run Python in a
> sandbox (`execute_code`)."

`search_documents` is **semantic retrieval** — a handful of similarity-ranked passages.
`read_document` / `fetch_full_document` exist in the dispatcher
(`backend/app/services/tool_dispatcher.py:40`, and `:1045` even hints users toward them) and are
**not on that list**.

For "ground a skill in house style," chunks are the right shape. For **"turn this 200-page
operations manual into a skill,"** they are the wrong shape, because the thing that makes a manual
valuable is its *structure* — chapter order, procedure steps, decision tables, exception cases — and
similarity retrieval is precisely the operation that destroys structure. You cannot reconstruct a
procedure from five passages that each mention it.

## Gap 2 — no entry point from the document

Measured 2026-08-19:

```
grep -rni "skill" frontend/src/components/documents/ frontend/src/pages/DocumentsPage.tsx
→ zero hits
```

To turn a document into a skill today, a user must already know the skill-creator exists, leave the
Documents surface, open chat, and describe in words the document they are looking at. **The feature
is real and the road to it does not pass anywhere near the thing it operates on.** This half is
cheap — an action on the document that opens the creator with that document already in hand — and it
is worth shipping even if Gap 1 never is.

## What `book-to-skill` actually contributes

`virgiliojr94/book-to-skill` (23k stars) is not "read a PDF." Its shape is **long document → skill
bundle**: a `SKILL.md` that stays small, plus reference files the skill pulls in on demand. That is
progressive disclosure, and it maps exactly onto our `skill_files` table and the bundle tree SEED-096
is about. The design question it answers for us is *what does a good generated skill look like* —
not one enormous instruction body, but a thin instruction body over a structured reference set.

⚠ **Which is exactly why this must not ship before SEED-096.** Import flattens
`scripts/office/unpack.py` to `unpack.py`, and runtime injection writes to `/sandbox/{basename}`
while user code runs in `/sandbox/output`. A bundle **this app generated from the user's own manual**
would arrive at the sandbox with its structure destroyed by our own importer. Losing a third party's
tree is a compatibility bug; losing the tree of something we just built for the user is a broken
feature.

## Why it is worth doing anyway

It is the single most on-brand capability available to this product. `PROJECT.md` states the core
value as *"the agent knows your knowledge base, can run code, and can be taught new behaviors that
persist."* Document→skill is the sentence where the first and third clauses meet, and no competitor
in the ranked list (dify, FastGPT, LibreChat, khoj) owns both halves to join them.
