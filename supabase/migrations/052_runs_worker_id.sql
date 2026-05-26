-- Migration 052: Add spawned_by_worker column to runs table
-- Phase 079 (D-PRD-12): Records which OS process (PID) spawned each run.
-- Nullable TEXT — NULL for all historical rows; populated at INSERT time for new runs.
-- Zero performance cost (no index, no constraint, NULL default).

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS spawned_by_worker TEXT;

COMMENT ON COLUMN public.runs.spawned_by_worker IS
  'OS PID of the uvicorn worker that INSERTed this run. Populated at INSERT time (Phase 079). NULL for pre-079 runs.';
