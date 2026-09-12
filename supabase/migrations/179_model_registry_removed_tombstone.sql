-- 179_model_registry_removed_tombstone.sql
--
-- Make EVERY model in the registry removable, including the ones declared in code.
--
-- THE PROBLEM THIS SOLVES. The registry a user sees is a UNION: the built-in
-- ``MODEL_CAPABILITIES`` dict in ``backend/app/config.py`` (61 ids at the time of writing)
-- ∪ the rows in this table. ``DELETE /admin/models/{id}`` could only ever delete a ROW, so
-- for the 61 code-declared ids a delete cleared the operator's stored values and the model
-- reappeared on the very next read. Those ids were hardcoded during development as a
-- convenience, not as a contract — an operator who wants a clean list must be able to remove
-- any of them, and add them back later, without a code change and without a deploy.
--
-- THE MECHANISM: A TOMBSTONE, NOT A DELETE. A code-declared model cannot be deleted from the
-- DB because it does not live there. So removal is recorded as a row that says "this id is
-- removed": ``removed = true``. The registry union skips any built-in carrying one.
--
-- ⚠ WHY A COLUMN ON THIS TABLE AND NOT A SEPARATE ``model_registry_removals`` TABLE.
-- ``model_id`` is already this table's PRIMARY KEY, so a tombstone and a capability row are
-- the same row and can never disagree about one model — a second table would let a model be
-- simultaneously removed and configured, and every reader would have to join to find out. It
-- also means the existing UPSERT paths clear a tombstone naturally: re-adding a model writes
-- the row it already has.
--
-- ⚠ THE COLUMN IS NOT NULL DEFAULT false, WHICH IS WHAT MAKES THIS SAFE TO APPLY LIVE.
-- Every existing row becomes ``removed = false`` — explicitly present, not a NULL that each
-- reader has to interpret. There is no window in which an existing model reads as removed.
--
-- ⚠ AND THE READS ARE FILTERED AT THE SOURCE, IN ONE PLACE. Both cache loaders in
-- ``backend/app/models/user_settings.py`` (``_load_model_overrides``, the enabled-only hot
-- path, and ``load_all_model_overrides``, the operator/registry read) gain
-- ``removed = false``. Every other consumer in the backend reads through one of those two
-- caches, so a removed model disappears from the picker, the capability resolver, the
-- provider builder and the registry together — rather than from whichever call sites someone
-- remembered to audit. ``load_removed_model_ids`` is the single deliberate exception: the
-- union needs the tombstoned ids in order to skip the matching built-ins.
--
-- RLS: unchanged. Migration 053 grants ``FOR SELECT TO authenticated USING (true)``
-- (read-all) on this table and every write goes through the service role behind the
-- operator-gated ``/admin`` router. Adding a column changes neither.

-- ── The tombstone column ──────────────────────────────────────────────────────
ALTER TABLE public.model_capabilities_overrides
    ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.model_capabilities_overrides.removed IS
    'Tombstone. TRUE means this model_id is removed from the registry — including a model '
    'declared in the built-in MODEL_CAPABILITIES dict, which cannot be deleted from the DB '
    'because it does not live there. Both override caches filter removed = false, so a '
    'tombstoned model is invisible to the picker, the capability resolver and the provider '
    'builder; build_model_registry_rows additionally skips the matching built-in. Re-adding '
    'the model clears the tombstone. A DB-only model is hard-DELETEd instead and never '
    'carries one.';

-- ── The partial index the union's tombstone lookup reads ──────────────────────
-- Tombstones are the rare case (an operator prunes a handful of models, if any), so a partial
-- index keeps ``load_removed_model_ids`` proportional to the number of REMOVED models rather
-- than to the size of the table.
CREATE INDEX IF NOT EXISTS model_capabilities_overrides_removed_idx
    ON public.model_capabilities_overrides (model_id)
    WHERE removed = true;
