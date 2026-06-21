-- 076_messages_origin.sql — Phase 120 (CTX-01 / D-120-06).
-- Record WHICH mode wrote each message row so a Deep turn never replays a
-- workflow's rows and a workflow phase never replays Deep rows (go-forward
-- context isolation). Adds the ADDITIVE `origin` column to `public.messages`:
-- `'deep'` (free-form Deep/Explorer chat) vs `'harness'` (a locked workflow run).
--
-- LOAD-BEARING `NOT NULL DEFAULT 'deep'`: the DEFAULT FILLS every existing row
-- with `'deep'` (zero NULLs) so the Deep-side `neq('origin','harness')` history
-- filter correctly replays legacy rows (a NULL would be silently dropped by the
-- three-valued-logic trap — Pitfall 1). The CHECK pins the column to the two-value
-- enum (`origin` is server-set only, never user input).
--
-- ADDITIVE ONLY: this ADDs ONE column on the already-live `public.messages` table.
-- It adds NO new RLS policy — `origin` inherits the existing thread-owner RLS
-- policy on `messages` (precedent migration 050, which added `reasoning_content`
-- the same way). `IF NOT EXISTS` on the column + `DROP CONSTRAINT IF EXISTS`
-- before the re-add make a re-apply a no-op (idempotent).
--
-- Apply by pasting this whole file into the Supabase SQL editor (or psycopg2 to
-- local :54322 per the 100/099/101.1/102/110/111/114/116 precedent) — NEVER
-- `supabase db push` / `db reset` (preserves dev data); then
-- `bash scripts/regenerate-full-schema.sh` (no --reset), commit migration +
-- regenerated full-schema.sql together.
-- Plan 03 (operator, autonomous:false / BLOCKING) applies it + regenerates
-- full-schema.sql. This plan (120-02) ONLY AUTHORS the file — it is NOT applied
-- here, and supabase/full-schema.sql is NOT touched here (Plan 03 regenerates it).

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'deep';

ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_origin_check;

ALTER TABLE public.messages
    ADD CONSTRAINT messages_origin_check CHECK (origin IN ('deep', 'harness'));
