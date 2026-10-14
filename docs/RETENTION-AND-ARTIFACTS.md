# Retention and chat artifacts

**Date:** 2026-10-14
**Decision (Phase 280, DEBT-08 / D-06): KEEP.** Retention disposal does not remove `message_artifacts`
rows. Retention deletes a source document, its chunks, tables and images, and its stored file. The
charts, tables and metrics the assistant showed in chat from that document stay in the conversation.

The internal record of the decision lives here. The public statement of the same decision is
[`docs/public/administer/org/retention.md`](public/administer/org/retention.md) → *What retention does
not remove*. Both were written in the same commit (D-07). If one changes, the other changes in the
same commit.

## Why KEEP (the four reasons, D-06)

1. **An artifact is a conversation record, governed by thread deletion.** `message_artifacts` rows
   cascade on `threads` and on `auth.users` (`supabase/migrations/202_message_artifacts.sql`,
   `thread_id … ON DELETE CASCADE`, `user_id … ON DELETE CASCADE`). The same rule already applies to
   the assistant's reply text that quotes the document, which retention also leaves in place. Deleting
   the chart but keeping the sentence that quotes the same figures would erase nothing meaningful.
2. **There is no reliable link to enforce anything else.** The only reference from an artifact to its
   source is a filename **string**, `caption.sources[].document`
   (`backend/app/services/show_artifact_tool.py::build_caption`). The table has no `document_id` and
   no foreign key to `documents`. Matching by filename is ambiguous across folders and versions, and
   old rows could never be matched at all.
3. **Artifacts are immutable by trigger (ART-03).** Each row is kept unchanged so that a follow-up
   turn can re-encode the chart from its own `spec.rows`. A disposal step would have to break that
   contract to reach them.
4. **The caption renders plain text, never a link**
   (`frontend/src/components/chat/artifacts/captionModel.ts`, `ArtifactFrame.tsx`). A chart whose source
   is gone still names the file as text, and nothing renders as a broken reference.

**No code change and no migration.** SC#5's arm *"if the decision requires enforcement"* is **not
applicable**: KEEP enforces nothing.

## The failure mode, pinned on rendered content

SC#5's failure mode is: *"says keep, and the artifact then renders a broken reference with no
explanation"*. It is pinned in
`frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx`
(`a chart whose source document was disposed …`). The test renders a table whose caption names
`contract.pdf`, a source that is understood to be disposed (nothing in the client can know that). It
asserts:

- the rendered `artifact-caption` **text** contains `contract.pdf`;
- the figure contains **no `<a>` element**.

The test asserts content, not presence, because a presence assertion cannot see content drift. It was
driven RED once against a planted `<a href="#">` around the caption source, then restored
sha256-identical (Phase 280 plan 04).

## Deferred, with a re-open trigger

**A `document_id` column on `message_artifacts`** would make it possible to erase artifacts together
with their source document. It is a new capability that D-06 does not need, and it would not reach
rows already written. **Re-open when** a customer request or a data-subject request (`SEED-072`) needs
artifacts erased with their source document. The work at that point is a migration (the column plus a
backfill policy for old rows), a write in `show_artifact_tool.build_caption`'s caller, and a disposal
step that runs inside the immutability contract's exception.
