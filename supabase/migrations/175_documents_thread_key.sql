-- Migration 175 — Phase 240 (SRC-05 / D-3 / D-240-06)
-- documents.thread_key: the retrieval-grouping column for mail conversations.
--
-- WHY IT IS NULLABLE, AND WHY THAT IS NOT LAZINESS.
--   Most documents are not mail, and a mail message whose client wrote no Message-ID has no
--   usable key either. Those are DIFFERENT FACTS and a rule must not be able to match the
--   difference away. A sentinel ('' or 'unknown') would fuse them — the exact mistake
--   metadata.source.path already paid for at D-238-07.4, where a fabricated '/<filename>' made
--   "we do not know this file's folder" indistinguishable from "this file is at the root".
--
-- WHY user_id LEADS THE INDEX.
--   A thread_key is derived from a Message-ID, which is chosen by whoever SENT the mail — so two
--   unrelated users can be made to share one (TM-240-06). Every read is user-scoped and rides
--   RLS; leading the index with user_id makes the scoped read the fast path and makes an
--   unscoped read visibly wrong rather than merely slow. thread_key is never a join key alone.
--
-- WHY THERE IS NO BACKFILL HERE.
--   A schema change must not do data work. Mail already in the Library keeps thread_key NULL and
--   reads as a thread of one; an opt-in re-derive is a separate, revertible task.
--
-- NOTE: no COMMIT inside a PROCEDURE/DO block — migrations 105 and 107 could not be pasted into
-- the Supabase SQL editor for exactly that reason.

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS thread_key text;

COMMENT ON COLUMN public.documents.thread_key IS
    'Phase 240 (D-3): the conversation a mail document belongs to, derived from its own RFC 5322 '
    'headers (References[0] -> In-Reply-To -> Message-ID), normalised and capped at 512 chars. '
    'NULL means "not mail" or "mail with no usable headers" — deliberately not distinguished by a '
    'sentinel. Never derived from Subject.';

CREATE INDEX IF NOT EXISTS documents_thread_key_idx
    ON public.documents (user_id, thread_key)
    WHERE thread_key IS NOT NULL;
