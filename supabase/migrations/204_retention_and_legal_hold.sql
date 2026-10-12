-- 204 — Phase 275 (RET-01..04; D-05, D-08, D-12..D-17, D-19, D-20, D-22, D-27, D-28, D-35)
-- Retention policies, legal holds, the disposition queue, receipts, and the hold refusal IN THE DATABASE.
--
-- WHAT. An org admin says how long a document class or a folder is kept and what happens after
-- (archive / delete / review). A named legal hold stops it. A nightly sweep archives on its own and
-- QUEUES deletes for a person to confirm (D-08: there is no automatic delete anywhere — no column,
-- flag or CHECK value below can produce one). Every action writes a receipt that outlives both the
-- document and the approver (D-13).
--
-- WHY THE HOLD LIVES HERE, NOT IN PYTHON (D-14, RESEARCH M-3, measured on the local DB):
--   * deleting an auth.users row fires a documents BEFORE DELETE row trigger through
--     documents_user_id_fkey ON DELETE CASCADE (depth 2) — a path no Python code ever sees;
--   * folders_parent_id_fkey ON DELETE CASCADE fires the CHILD folder's BEFORE DELETE trigger;
--   * documents_folder_id_fkey ON DELETE SET NULL fires BEFORE UPDATE (not DELETE) on documents;
--   * authenticated, anon and service_role all held TRUNCATE on documents, and TRUNCATE skips row
--     triggers.
-- So: BEFORE DELETE row triggers on documents and folders, a BEFORE TRUNCATE statement guard on
-- both, REVOKE TRUNCATE from the JWT roles, and sticky coverage when a held item moves out of a held
-- folder (so a move never loses the hold — D-16: a hold stops DELETION only).
--
-- ONE PREDICATE, TWO CALLERS. public.retention_held_documents(uuid[]) is the only definition of
-- "held". The triggers call it, and backend/app/services/retention/hold_guard.py calls it through the
-- service role to explain a refusal before anything is touched. A document is held when an ACTIVE
-- (released_at IS NULL) hold of the SAME org covers it:
--   (a) directly — any member of its version family (org_id, user_id, filename: the widest key the
--       code uses, so coverage errs toward holding, D-16) is in legal_hold_documents; or
--   (b) by folder — its folder or any ancestor is in legal_hold_folders. Coverage is evaluated at
--       CHECK time and never materialised, so a document added to a held folder later is held (D-05).
-- public.retention_held_folders(uuid[]) is its folder twin (revision B-1, D-15): every requested
-- folder covered (itself or an ancestor) or directly containing a held document — a held EMPTY folder
-- and a folder holding another owner's held document included. It returns ids only, never a name.
-- Both functions are SECURITY DEFINER, owned by postgres, and EXECUTE is granted to service_role
-- ONLY (revision W-5b). The trigger functions are SECURITY DEFINER too, so they call the predicates
-- AS THE OWNER — revoking authenticated never breaks a trigger.
--
-- EVERY FOLDER WALK IS CYCLE-BOUNDED. folder_is_org_shared's walk has no bound (T-275-10); the one
-- walk here (retention_folder_ancestors) carries a CYCLE clause, so a corrupt parent_id loop ends.
--
-- NO MATTER NAME LEAVES THE DATABASE IN AN ERROR (D-17). Every refusal names an id only; PostgREST
-- returns error text to members verbatim. ERRCODE 'PT409' makes PostgREST answer HTTP 409.
--
-- WHO MAY WRITE WHAT (D-28; revisions W-2, W-2b).
--   * Every new table: RLS on; SELECT for `authenticated` only through
--     current_user_has_permission(org_id,'org:manage') — a member's direct read returns zero rows.
--   * retention_policies: authenticated holds SELECT ONLY. A policy is written by the API's service
--     pool after its preview gate (D-02). The INSERT/UPDATE policies below are inert without a grant;
--     they exist so a restored grant still meets the org:manage wall.
--   * legal_holds: authenticated SELECT + INSERT (hold create), NO UPDATE/DELETE (release goes through
--     the service pool). legal_hold_documents / legal_hold_folders: SELECT + INSERT (extend a hold).
--   * A BEFORE INSERT OR UPDATE trigger makes retention_policies.revision / previewed_revision and
--     legal_holds.released_* writable by the service role only — the backstop if a grant is restored.
--   * documents.archived_at / archived_policy_id / archived_policy_name: the owner UPDATE policy would
--     otherwise let any owner un-archive through PostgREST (D-19); a trigger refuses JWT changes.
--   * Receipts: INSERT/SELECT only, for every role. A receipt is immutable.
--   * Holds are RELEASED, never deleted — no DELETE grant or policy anywhere.
--   * D-35: coverage may only reference a document/folder of the hold's own org (trigger, every role).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION (D-29): apply 204 then 205 BEFORE the backend that reads these tables deploys, then
--   run get_advisors(security) — a deploy-parity item. The sweep ships disabled
--   (RETENTION_SWEEP_ENABLED=false) and is not enabled until the operator has read a dry run.
-- ============================================================================

BEGIN;

-- ── 1. retention_policies (D-20, D-22, D-23) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.retention_policies (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid NOT NULL,
    name                text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    scope_kind          text NOT NULL CHECK (scope_kind IN ('folder', 'class')),
    folder_id           uuid REFERENCES public.folders(id) ON DELETE CASCADE,
    include_subfolders  boolean NOT NULL DEFAULT true,
    document_type_norm  text,
    clock               text NOT NULL CHECK (clock IN ('document_date', 'date_added')),
    stage1_value        integer NOT NULL CHECK (stage1_value > 0),
    stage1_unit         text NOT NULL CHECK (stage1_unit IN ('days', 'months', 'years')),
    stage1_action       text NOT NULL CHECK (stage1_action IN ('archive', 'delete', 'review')),
    stage2_value        integer CHECK (stage2_value > 0),
    stage2_unit         text CHECK (stage2_unit IN ('days', 'months', 'years')),
    stage2_action       text CHECK (stage2_action IN ('delete')),
    revision            integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
    previewed_revision  integer,
    created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name     text,
    updated_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by_name     text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    -- D-20: an optional second stage, all-or-nothing, and only after an archive. stage2 only ever
    -- QUEUES a delete (D-08); there is no auto-delete value.
    CONSTRAINT retention_policies_stage2_shape CHECK (
        (stage2_value IS NULL AND stage2_unit IS NULL AND stage2_action IS NULL)
        OR (stage2_value IS NOT NULL AND stage2_unit IS NOT NULL AND stage2_action IS NOT NULL
            AND stage1_action = 'archive')
    ),
    CONSTRAINT retention_policies_scope_shape CHECK (
        (scope_kind = 'folder' AND folder_id IS NOT NULL AND document_type_norm IS NULL)
        OR (scope_kind = 'class' AND folder_id IS NULL AND document_type_norm IS NOT NULL)
    )
);

-- One policy per folder and one per class in an org: a same-scope disagreement cannot exist, so only
-- folder-vs-class collisions remain (D-24, shown in Preview, fail closed).
CREATE UNIQUE INDEX IF NOT EXISTS retention_policies_org_folder_uniq
    ON public.retention_policies (org_id, folder_id) WHERE scope_kind = 'folder';
CREATE UNIQUE INDEX IF NOT EXISTS retention_policies_org_class_uniq
    ON public.retention_policies (org_id, document_type_norm) WHERE scope_kind = 'class';
CREATE INDEX IF NOT EXISTS retention_policies_org_idx ON public.retention_policies (org_id);

-- ── 2. retention_previews — the server-side preview record (D-02, planning flag 5) ──
-- The API refuses a Save without a fresh preview whose draft_hash matches the submitted body.
-- No HMAC and no new secret: the record is the proof.
CREATE TABLE IF NOT EXISTS public.retention_previews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      uuid NOT NULL,
    policy_id   uuid REFERENCES public.retention_policies(id) ON DELETE CASCADE,
    draft_hash  text NOT NULL,
    created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    counts      jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS retention_previews_lookup_idx
    ON public.retention_previews (org_id, draft_hash, created_at);

-- ── 3. legal holds: the matter + two coverage tables (D-05, D-17) ───────────
CREATE TABLE IF NOT EXISTS public.legal_holds (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            uuid NOT NULL,
    name              text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    reason            text,
    created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name   text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    released_at       timestamptz,
    released_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    released_by_name  text,
    release_note      text
);
CREATE INDEX IF NOT EXISTS legal_holds_active_org_idx
    ON public.legal_holds (org_id) WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS public.legal_hold_documents (
    hold_id      uuid NOT NULL REFERENCES public.legal_holds(id) ON DELETE CASCADE,
    document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    org_id       uuid NOT NULL,
    added_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (hold_id, document_id)
);
CREATE INDEX IF NOT EXISTS legal_hold_documents_document_idx ON public.legal_hold_documents (document_id);

CREATE TABLE IF NOT EXISTS public.legal_hold_folders (
    hold_id    uuid NOT NULL REFERENCES public.legal_holds(id) ON DELETE CASCADE,
    folder_id  uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
    org_id     uuid NOT NULL,
    added_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (hold_id, folder_id)
);
CREATE INDEX IF NOT EXISTS legal_hold_folders_folder_idx ON public.legal_hold_folders (folder_id);

-- ── 4. the queue, the skip markers, the receipts, the sweep claim rows ───────
-- A queue row is a PROPOSAL waiting for a person (D-08, D-10). Nothing here deletes.
CREATE TABLE IF NOT EXISTS public.retention_queue (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid NOT NULL,
    policy_id           uuid NOT NULL REFERENCES public.retention_policies(id) ON DELETE CASCADE,
    family_key          text NOT NULL,
    latest_document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    kind                text NOT NULL CHECK (kind IN ('delete', 'review')),
    policy_revision     integer NOT NULL,
    fingerprint         text NOT NULL,
    found_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT retention_queue_once UNIQUE (policy_id, family_key, kind)
);
CREATE INDEX IF NOT EXISTS retention_queue_org_idx ON public.retention_queue (org_id);

-- D-11 / D-19: a kept or un-archived family is skipped until the policy or the document changes.
CREATE TABLE IF NOT EXISTS public.retention_skips (
    org_id           uuid NOT NULL,
    policy_id        uuid NOT NULL REFERENCES public.retention_policies(id) ON DELETE CASCADE,
    family_key       text NOT NULL,
    reason           text NOT NULL CHECK (reason IN ('kept', 'unarchived')),
    policy_revision  integer NOT NULL,
    fingerprint      text NOT NULL,
    actor_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name       text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (policy_id, family_key)
);
CREATE INDEX IF NOT EXISTS retention_skips_org_idx ON public.retention_skips (org_id);

-- D-12 / D-13: the receipt outlives the document (document_id carries NO foreign key) and the
-- approver (actor_id SET NULL + an actor_name snapshot). audit_log cannot hold these: its user_id is
-- NOT NULL ON DELETE CASCADE.
CREATE TABLE IF NOT EXISTS public.retention_receipts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         uuid NOT NULL,
    action         text NOT NULL CHECK (action IN (
                       'archived', 'unarchived', 'queued_delete', 'queued_review', 'kept',
                       'deleted', 'did_not_delete', 'delete_refused', 'hold_placed', 'hold_extended',
                       'hold_released', 'policy_saved', 'policy_deleted', 'dry_run', 'sweep_incomplete')),
    document_id    uuid,
    document_name  text,
    policy_id      uuid REFERENCES public.retention_policies(id) ON DELETE SET NULL,
    policy_name    text,
    hold_id        uuid REFERENCES public.legal_holds(id) ON DELETE SET NULL,
    hold_name      text,
    actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name     text,
    detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now(),
    -- W-4 / SC#3: a disposition record can never omit the policy that caused it.
    CONSTRAINT retention_receipts_disposition_names_policy CHECK (
        action NOT IN ('archived', 'queued_delete', 'queued_review', 'deleted', 'did_not_delete', 'kept', 'unarchived')
        OR policy_name IS NOT NULL
    )
);
CREATE INDEX IF NOT EXISTS retention_receipts_org_created_idx
    ON public.retention_receipts (org_id, created_at DESC);

-- One row per org; claimed with FOR UPDATE SKIP LOCKED + a lease (the watch pattern, D-31).
CREATE TABLE IF NOT EXISTS public.retention_sweeps (
    org_id        uuid PRIMARY KEY,
    next_run_at   timestamptz NOT NULL DEFAULT now(),
    leased_until  timestamptz,
    last_run_at   timestamptz,
    last_status   text CHECK (last_status IN ('ok', 'incomplete', 'failed', 'running')),
    last_error    text,
    last_counts   jsonb
);
CREATE INDEX IF NOT EXISTS retention_sweeps_due_idx ON public.retention_sweeps (next_run_at);

-- ── 5. archive state on documents (D-19; revision B-NEW-1) ──────────────────
-- archived_policy_name is a snapshot: an archived document still names its policy after a policy
-- removal sets archived_policy_id NULL.
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS archived_policy_id uuid REFERENCES public.retention_policies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS archived_policy_name text;
CREATE INDEX IF NOT EXISTS documents_archived_policy_idx
    ON public.documents (archived_policy_id) WHERE archived_policy_id IS NOT NULL;

-- ⛔ Measured (RESEARCH M-1, Pitfall 1): a new column without statistics flipped the vector arm from
-- an HNSW index scan to a seq scan + sort of 93,139 rows (25 ms → 943 ms per call).
ANALYZE public.documents;

-- ── 6. the folder walk + the two hold predicates ────────────────────────────
CREATE OR REPLACE FUNCTION public.retention_folder_ancestors(p_folder_id uuid)
RETURNS TABLE(folder_id uuid, depth integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH RECURSIVE walk(id, parent_id, depth) AS (
    SELECT f.id, f.parent_id, 0 FROM public.folders f WHERE f.id = p_folder_id
    UNION ALL
    SELECT f.id, f.parent_id, w.depth + 1
    FROM public.folders f
    JOIN walk w ON f.id = w.parent_id
  ) CYCLE id SET is_cycle USING path
  SELECT w.id, w.depth FROM walk w WHERE NOT w.is_cycle;
$$;

CREATE OR REPLACE FUNCTION public.retention_held_documents(p_document_ids uuid[])
RETURNS TABLE(document_id uuid, hold_id uuid, held_since timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT DISTINCT x.doc_id, x.hid, x.since
  FROM (
    -- (a) directly, by version family (D-16)
    SELECT t.id AS doc_id, h.id AS hid, h.created_at AS since
    FROM public.documents t
    JOIN public.documents fam
      ON fam.org_id = t.org_id AND fam.user_id = t.user_id AND fam.filename = t.filename
    JOIN public.legal_hold_documents lhd ON lhd.document_id = fam.id
    JOIN public.legal_holds h
      ON h.id = lhd.hold_id AND h.org_id = t.org_id AND h.released_at IS NULL
    WHERE t.id = ANY (p_document_ids)
    UNION ALL
    -- (b) by its folder or any ancestor, evaluated now (D-05)
    SELECT t.id, h.id, h.created_at
    FROM public.documents t
    CROSS JOIN LATERAL public.retention_folder_ancestors(t.folder_id) a
    JOIN public.legal_hold_folders lhf ON lhf.folder_id = a.folder_id
    JOIN public.legal_holds h
      ON h.id = lhf.hold_id AND h.org_id = t.org_id AND h.released_at IS NULL
    WHERE t.id = ANY (p_document_ids)
      AND t.folder_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.legal_holds ah WHERE ah.org_id = t.org_id AND ah.released_at IS NULL)
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.retention_held_folders(p_folder_ids uuid[])
RETURNS TABLE(folder_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT DISTINCT f.id
  FROM public.folders f
  WHERE f.id = ANY (p_folder_ids)
    AND EXISTS (SELECT 1 FROM public.legal_holds ah WHERE ah.org_id = f.org_id AND ah.released_at IS NULL)
    AND (
      EXISTS (
        SELECT 1
        FROM public.retention_folder_ancestors(f.id) a
        JOIN public.legal_hold_folders lhf ON lhf.folder_id = a.folder_id
        JOIN public.legal_holds h
          ON h.id = lhf.hold_id AND h.org_id = f.org_id AND h.released_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.retention_held_documents(
          ARRAY(SELECT d.id FROM public.documents d WHERE d.folder_id = f.id)
        )
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.retention_folder_ancestors(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_folder_ancestors(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retention_folder_ancestors(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.retention_folder_ancestors(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.retention_held_documents(uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.retention_held_folders(uuid[]) TO service_role;

-- ── 7. the hold triggers (D-14, D-15, D-16) ─────────────────────────────────
-- Positive form throughout: `IF <ok> THEN RETURN …; END IF; RAISE …` — a NULL falls to the refusal.
CREATE OR REPLACE FUNCTION public.documents_refuse_held_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- fast path: an org with no active hold pays one index probe per deleted row
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.org_id = OLD.org_id AND h.released_at IS NULL) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.retention_held_documents(ARRAY[OLD.id])) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'document % is on legal hold', OLD.id USING ERRCODE = 'PT409';
END;
$$;

DROP TRIGGER IF EXISTS documents_refuse_held_delete ON public.documents;
CREATE TRIGGER documents_refuse_held_delete BEFORE DELETE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.documents_refuse_held_delete();

-- Fires on the deleted folder AND on every child folder the parent_id cascade removes (M-3 #5), so
-- checking each row covers the whole subtree. It also stops the documents.folder_id SET NULL that
-- would strip other owners' held documents out of a held folder.
CREATE OR REPLACE FUNCTION public.folders_refuse_held_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.org_id = OLD.org_id AND h.released_at IS NULL) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.retention_held_folders(ARRAY[OLD.id])) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'folder % contains documents on legal hold', OLD.id USING ERRCODE = 'PT409';
END;
$$;

DROP TRIGGER IF EXISTS folders_refuse_held_delete ON public.folders;
CREATE TRIGGER folders_refuse_held_delete BEFORE DELETE ON public.folders
    FOR EACH ROW EXECUTE FUNCTION public.folders_refuse_held_delete();

-- Sticky coverage (RESEARCH Pattern 3 trigger 3): a document leaving the subtree of a folder hold
-- that covers it gets a DIRECT coverage row for that hold, so the move succeeds (D-16) and the
-- document stays held.
CREATE OR REPLACE FUNCTION public.documents_sticky_hold_on_move()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF OLD.folder_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.org_id = OLD.org_id AND h.released_at IS NULL) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id, added_at)
  SELECT DISTINCT lhf.hold_id, OLD.id, OLD.org_id, now()
  FROM public.retention_folder_ancestors(OLD.folder_id) a
  JOIN public.legal_hold_folders lhf ON lhf.folder_id = a.folder_id
  JOIN public.legal_holds h ON h.id = lhf.hold_id AND h.org_id = OLD.org_id AND h.released_at IS NULL
  WHERE NEW.folder_id IS NULL
     OR lhf.hold_id NOT IN (
          SELECT lhf2.hold_id
          FROM public.retention_folder_ancestors(NEW.folder_id) a2
          JOIN public.legal_hold_folders lhf2 ON lhf2.folder_id = a2.folder_id
        )
  ON CONFLICT (hold_id, document_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_sticky_hold_on_move ON public.documents;
CREATE TRIGGER documents_sticky_hold_on_move BEFORE UPDATE OF folder_id ON public.documents
    FOR EACH ROW WHEN (OLD.folder_id IS DISTINCT FROM NEW.folder_id)
    EXECUTE FUNCTION public.documents_sticky_hold_on_move();

CREATE OR REPLACE FUNCTION public.folders_sticky_hold_on_move()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF OLD.parent_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.org_id = OLD.org_id AND h.released_at IS NULL) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.legal_hold_folders (hold_id, folder_id, org_id, added_at)
  SELECT DISTINCT lhf.hold_id, OLD.id, OLD.org_id, now()
  FROM public.retention_folder_ancestors(OLD.parent_id) a
  JOIN public.legal_hold_folders lhf ON lhf.folder_id = a.folder_id
  JOIN public.legal_holds h ON h.id = lhf.hold_id AND h.org_id = OLD.org_id AND h.released_at IS NULL
  WHERE NEW.parent_id IS NULL
     OR lhf.hold_id NOT IN (
          SELECT lhf2.hold_id
          FROM public.retention_folder_ancestors(NEW.parent_id) a2
          JOIN public.legal_hold_folders lhf2 ON lhf2.folder_id = a2.folder_id
        )
  ON CONFLICT (hold_id, folder_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS folders_sticky_hold_on_move ON public.folders;
CREATE TRIGGER folders_sticky_hold_on_move BEFORE UPDATE OF parent_id ON public.folders
    FOR EACH ROW WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id)
    EXECUTE FUNCTION public.folders_sticky_hold_on_move();

-- TRUNCATE skips row triggers: refuse it outright while any hold is active.
CREATE OR REPLACE FUNCTION public.retention_refuse_truncate()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.released_at IS NULL) THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'documents and folders cannot be truncated while a legal hold is active' USING ERRCODE = 'PT409';
END;
$$;

DROP TRIGGER IF EXISTS documents_refuse_truncate ON public.documents;
CREATE TRIGGER documents_refuse_truncate BEFORE TRUNCATE ON public.documents
    FOR EACH STATEMENT EXECUTE FUNCTION public.retention_refuse_truncate();
DROP TRIGGER IF EXISTS folders_refuse_truncate ON public.folders;
CREATE TRIGGER folders_refuse_truncate BEFORE TRUNCATE ON public.folders
    FOR EACH STATEMENT EXECUTE FUNCTION public.retention_refuse_truncate();

REVOKE TRUNCATE ON public.documents, public.folders FROM authenticated, anon;

-- ── 8. column guards: archive state (D-19), protected columns (W-2), coverage org (D-35) ──
-- These are SECURITY INVOKER on purpose: inside a SECURITY DEFINER function current_user is the
-- owner, so the role check would always pass. Referential actions (the SET NULL from a policy delete)
-- run as the table owner, so they are not refused.
CREATE OR REPLACE FUNCTION public.documents_protect_archive_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.archived_at IS NOT DISTINCT FROM OLD.archived_at
     AND NEW.archived_policy_id IS NOT DISTINCT FROM OLD.archived_policy_id
     AND NEW.archived_policy_name IS NOT DISTINCT FROM OLD.archived_policy_name THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'archive state is changed by the service only' USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS documents_protect_archive_state ON public.documents;
CREATE TRIGGER documents_protect_archive_state
    BEFORE UPDATE OF archived_at, archived_policy_id, archived_policy_name ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.documents_protect_archive_state();

CREATE OR REPLACE FUNCTION public.retention_policies_protect_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.previewed_revision IS NULL AND NEW.revision = 1 THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.revision IS NOT DISTINCT FROM OLD.revision
        AND NEW.previewed_revision IS NOT DISTINCT FROM OLD.previewed_revision THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'policy revision columns are written by the service only' USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS retention_policies_protect_columns ON public.retention_policies;
CREATE TRIGGER retention_policies_protect_columns BEFORE INSERT OR UPDATE ON public.retention_policies
    FOR EACH ROW EXECUTE FUNCTION public.retention_policies_protect_columns();

CREATE OR REPLACE FUNCTION public.legal_holds_protect_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.released_at IS NULL AND NEW.released_by IS NULL
       AND NEW.released_by_name IS NULL AND NEW.release_note IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.released_at IS NOT DISTINCT FROM OLD.released_at
        AND NEW.released_by IS NOT DISTINCT FROM OLD.released_by
        AND NEW.released_by_name IS NOT DISTINCT FROM OLD.released_by_name
        AND NEW.release_note IS NOT DISTINCT FROM OLD.release_note THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a hold is released by the service only' USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS legal_holds_protect_columns ON public.legal_holds;
CREATE TRIGGER legal_holds_protect_columns BEFORE INSERT OR UPDATE ON public.legal_holds
    FOR EACH ROW EXECUTE FUNCTION public.legal_holds_protect_columns();

-- D-35: coverage stays inside the hold's org, for every role (the service pool included). A released
-- hold cannot be extended.
CREATE OR REPLACE FUNCTION public.legal_hold_coverage_same_org()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'legal_hold_documents' THEN
    IF EXISTS (SELECT 1 FROM public.legal_holds h
               WHERE h.id = NEW.hold_id AND h.org_id = NEW.org_id AND h.released_at IS NULL)
       AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = NEW.document_id AND d.org_id = NEW.org_id) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'legal_hold_folders' THEN
    IF EXISTS (SELECT 1 FROM public.legal_holds h
               WHERE h.id = NEW.hold_id AND h.org_id = NEW.org_id AND h.released_at IS NULL)
       AND EXISTS (SELECT 1 FROM public.folders f WHERE f.id = NEW.folder_id AND f.org_id = NEW.org_id) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'legal hold coverage must stay inside the organization of an active hold' USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS legal_hold_documents_same_org ON public.legal_hold_documents;
CREATE TRIGGER legal_hold_documents_same_org BEFORE INSERT OR UPDATE ON public.legal_hold_documents
    FOR EACH ROW EXECUTE FUNCTION public.legal_hold_coverage_same_org();
DROP TRIGGER IF EXISTS legal_hold_folders_same_org ON public.legal_hold_folders;
CREATE TRIGGER legal_hold_folders_same_org BEFORE INSERT OR UPDATE ON public.legal_hold_folders
    FOR EACH ROW EXECUTE FUNCTION public.legal_hold_coverage_same_org();

-- A trigger function is never called directly; take the default EXECUTE away (PUBLIC first — anon
-- inherits from PUBLIC). EXECUTE is checked at CREATE TRIGGER time, not when the trigger fires.
REVOKE EXECUTE ON FUNCTION public.documents_refuse_held_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.folders_refuse_held_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documents_sticky_hold_on_move() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.folders_sticky_hold_on_move() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retention_refuse_truncate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documents_protect_archive_state() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retention_policies_protect_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.legal_holds_protect_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.legal_hold_coverage_same_org() FROM PUBLIC, anon, authenticated;

-- ── 9. RLS + privileges ─────────────────────────────────────────────────────
-- Default privileges gave anon/authenticated/service_role ALL on every new public table, and a GRANT
-- never removes privileges — so revoke ALL from all four first (the 202 measurement), then grant back.
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_hold_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_hold_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_sweeps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.retention_policies FROM PUBLIC;
REVOKE ALL ON TABLE public.retention_policies FROM anon;
REVOKE ALL ON TABLE public.retention_policies FROM authenticated;
REVOKE ALL ON TABLE public.retention_policies FROM service_role;
GRANT SELECT ON TABLE public.retention_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.retention_policies TO service_role;

REVOKE ALL ON TABLE public.retention_previews FROM PUBLIC;
REVOKE ALL ON TABLE public.retention_previews FROM anon;
REVOKE ALL ON TABLE public.retention_previews FROM authenticated;
REVOKE ALL ON TABLE public.retention_previews FROM service_role;
GRANT SELECT ON TABLE public.retention_previews TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.retention_previews TO service_role;

REVOKE ALL ON TABLE public.legal_holds FROM PUBLIC;
REVOKE ALL ON TABLE public.legal_holds FROM anon;
REVOKE ALL ON TABLE public.legal_holds FROM authenticated;
REVOKE ALL ON TABLE public.legal_holds FROM service_role;
GRANT SELECT, INSERT ON TABLE public.legal_holds TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.legal_holds TO service_role;

REVOKE ALL ON TABLE public.legal_hold_documents FROM PUBLIC;
REVOKE ALL ON TABLE public.legal_hold_documents FROM anon;
REVOKE ALL ON TABLE public.legal_hold_documents FROM authenticated;
REVOKE ALL ON TABLE public.legal_hold_documents FROM service_role;
GRANT SELECT, INSERT ON TABLE public.legal_hold_documents TO authenticated;
GRANT SELECT, INSERT ON TABLE public.legal_hold_documents TO service_role;

REVOKE ALL ON TABLE public.legal_hold_folders FROM PUBLIC;
REVOKE ALL ON TABLE public.legal_hold_folders FROM anon;
REVOKE ALL ON TABLE public.legal_hold_folders FROM authenticated;
REVOKE ALL ON TABLE public.legal_hold_folders FROM service_role;
GRANT SELECT, INSERT ON TABLE public.legal_hold_folders TO authenticated;
GRANT SELECT, INSERT ON TABLE public.legal_hold_folders TO service_role;

REVOKE ALL ON TABLE public.retention_queue FROM PUBLIC;
REVOKE ALL ON TABLE public.retention_queue FROM anon;
REVOKE ALL ON TABLE public.retention_queue FROM authenticated;
REVOKE ALL ON TABLE public.retention_queue FROM service_role;
GRANT SELECT ON TABLE public.retention_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.retention_queue TO service_role;

REVOKE ALL ON TABLE public.retention_skips FROM PUBLIC;
REVOKE ALL ON TABLE public.retention_skips FROM anon;
REVOKE ALL ON TABLE public.retention_skips FROM authenticated;
REVOKE ALL ON TABLE public.retention_skips FROM service_role;
GRANT SELECT ON TABLE public.retention_skips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.retention_skips TO service_role;

REVOKE ALL ON TABLE public.retention_receipts FROM PUBLIC;
REVOKE ALL ON TABLE public.retention_receipts FROM anon;
REVOKE ALL ON TABLE public.retention_receipts FROM authenticated;
REVOKE ALL ON TABLE public.retention_receipts FROM service_role;
GRANT SELECT ON TABLE public.retention_receipts TO authenticated;
GRANT SELECT, INSERT ON TABLE public.retention_receipts TO service_role;

REVOKE ALL ON TABLE public.retention_sweeps FROM PUBLIC;
REVOKE ALL ON TABLE public.retention_sweeps FROM anon;
REVOKE ALL ON TABLE public.retention_sweeps FROM authenticated;
REVOKE ALL ON TABLE public.retention_sweeps FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.retention_sweeps TO service_role;

-- SELECT: org:manage only, on every table that carries a matter, a policy or a receipt (D-17).
DROP POLICY IF EXISTS retention_policies_select ON public.retention_policies;
CREATE POLICY retention_policies_select ON public.retention_policies FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));
DROP POLICY IF EXISTS retention_previews_select ON public.retention_previews;
CREATE POLICY retention_previews_select ON public.retention_previews FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));
DROP POLICY IF EXISTS legal_holds_select ON public.legal_holds;
CREATE POLICY legal_holds_select ON public.legal_holds FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));
DROP POLICY IF EXISTS legal_hold_documents_select ON public.legal_hold_documents;
CREATE POLICY legal_hold_documents_select ON public.legal_hold_documents FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));
DROP POLICY IF EXISTS legal_hold_folders_select ON public.legal_hold_folders;
CREATE POLICY legal_hold_folders_select ON public.legal_hold_folders FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));
DROP POLICY IF EXISTS retention_queue_select ON public.retention_queue;
CREATE POLICY retention_queue_select ON public.retention_queue FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));
DROP POLICY IF EXISTS retention_skips_select ON public.retention_skips;
CREATE POLICY retention_skips_select ON public.retention_skips FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));
DROP POLICY IF EXISTS retention_receipts_select ON public.retention_receipts;
CREATE POLICY retention_receipts_select ON public.retention_receipts FOR SELECT TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));

-- Writes (the 116 wall): an admin of org A can never write a row for org B.
DROP POLICY IF EXISTS retention_policies_insert ON public.retention_policies;
CREATE POLICY retention_policies_insert ON public.retention_policies FOR INSERT TO authenticated WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));
DROP POLICY IF EXISTS retention_policies_update ON public.retention_policies;
CREATE POLICY retention_policies_update ON public.retention_policies FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage')) WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));
DROP POLICY IF EXISTS legal_holds_insert ON public.legal_holds;
CREATE POLICY legal_holds_insert ON public.legal_holds FOR INSERT TO authenticated WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));
DROP POLICY IF EXISTS legal_holds_update ON public.legal_holds;
CREATE POLICY legal_holds_update ON public.legal_holds FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage')) WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));
DROP POLICY IF EXISTS legal_hold_documents_insert ON public.legal_hold_documents;
CREATE POLICY legal_hold_documents_insert ON public.legal_hold_documents FOR INSERT TO authenticated WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));
DROP POLICY IF EXISTS legal_hold_folders_insert ON public.legal_hold_folders;
CREATE POLICY legal_hold_folders_insert ON public.legal_hold_folders FOR INSERT TO authenticated WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));

-- No DELETE policy anywhere: holds are released, never deleted; receipts are immutable;
-- retention_sweeps carries no policy at all (service_role only).

-- ── 10. audit_log action types (D-27) — every existing literal kept (the 170 shape) ──
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- 11 legacy actions
    'document.upload', 'document.delete', 'search.query', 'code.execute', 'skill.load',
    'thread.create', 'thread.delete', 'settings.update', 'memory.remember', 'memory.recall', 'feedback.submit',
    -- 8 DM actions (Phase 110 / Migration 071)
    'view.create', 'view.delete', 'relationship.create', 'relationship.delete',
    'classification.apply', 'classification.rule.create', 'metadata.update', 'metadata.field.create',
    -- 2 Connector actions (Phase 223 / Migration 152)
    'connector.call', 'connector.grant',
    -- 3 Connector watch actions (Phase 234 / LIB-08)
    'connector.watch.create', 'connector.watch.delete', 'connector.watch.sync',
    -- 10 Retention + folder actions (Phase 275 / Migration 204)
    'retention.policy.create', 'retention.policy.update', 'retention.policy.delete',
    'retention.hold.create', 'retention.hold.update', 'retention.hold.release',
    'retention.disposition.confirm', 'retention.document.unarchive', 'retention.document.keep',
    'folder.delete'
  ]::text[]));

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with t(name) as (values ('retention_policies'), ('retention_previews'), ('legal_holds'),
--       ('legal_hold_documents'), ('legal_hold_folders'), ('retention_queue'), ('retention_skips'),
--       ('retention_receipts'), ('retention_sweeps')),
--   checks(what, ok) as (
--     select 'RLS enabled on every new table',
--       bool_and((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--                 where n.nspname = 'public' and c.relname = t.name)) from t
--     union all select 'anon holds no privilege on any new table',
--       not bool_or(has_table_privilege('anon', 'public.' || t.name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) from t
--     union all select 'authenticated cannot write retention_policies',
--       not has_table_privilege('authenticated', 'public.retention_policies', 'INSERT,UPDATE,DELETE')
--     union all select 'authenticated cannot UPDATE/DELETE legal_holds',
--       not has_table_privilege('authenticated', 'public.legal_holds', 'UPDATE,DELETE')
--     union all select 'no role can UPDATE/DELETE retention_receipts',
--       not has_table_privilege('authenticated', 'public.retention_receipts', 'UPDATE,DELETE')
--       and not has_table_privilege('service_role', 'public.retention_receipts', 'UPDATE,DELETE')
--     union all select 'authenticated lacks TRUNCATE on documents/folders',
--       not has_table_privilege('authenticated', 'public.documents', 'TRUNCATE')
--       and not has_table_privilege('authenticated', 'public.folders', 'TRUNCATE')
--       and not has_table_privilege('anon', 'public.documents', 'TRUNCATE')
--       and not has_table_privilege('anon', 'public.folders', 'TRUNCATE')
--     union all select 'every hold/guard trigger present',
--       (select count(*) = 11 from pg_trigger where not tgisinternal and tgname in (
--          'documents_refuse_held_delete', 'folders_refuse_held_delete', 'documents_sticky_hold_on_move',
--          'folders_sticky_hold_on_move', 'documents_refuse_truncate', 'folders_refuse_truncate',
--          'documents_protect_archive_state', 'retention_policies_protect_columns',
--          'legal_holds_protect_columns', 'legal_hold_documents_same_org', 'legal_hold_folders_same_org'))
--     union all select 'anon/authenticated cannot EXECUTE the hold predicates',
--       not has_function_privilege('anon', 'public.retention_held_documents(uuid[])', 'EXECUTE')
--       and not has_function_privilege('authenticated', 'public.retention_held_documents(uuid[])', 'EXECUTE')
--       and not has_function_privilege('anon', 'public.retention_held_folders(uuid[])', 'EXECUTE')
--       and not has_function_privilege('authenticated', 'public.retention_held_folders(uuid[])', 'EXECUTE')
--     union all select 'service_role can EXECUTE the hold predicates',
--       has_function_privilege('service_role', 'public.retention_held_documents(uuid[])', 'EXECUTE')
--       and has_function_privilege('service_role', 'public.retention_held_folders(uuid[])', 'EXECUTE')
--     union all select 'the audit CHECK carries folder.delete and the retention types',
--       (select pg_get_constraintdef(oid) like '%folder.delete%' and pg_get_constraintdef(oid) like '%retention.document.keep%'
--          from pg_constraint where conname = 'audit_log_action_type_check')
--     union all select 'the receipts policy_name CHECK exists',
--       exists (select 1 from pg_constraint where conname = 'retention_receipts_disposition_names_policy')
--     union all select 'documents carries the three archive columns',
--       (select count(*) = 3 from information_schema.columns where table_schema = 'public'
--          and table_name = 'documents' and column_name in ('archived_at', 'archived_policy_id', 'archived_policy_name'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
