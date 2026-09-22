-- 193 — make migration 188's seed rows portable across databases.
--
-- 188 seeded the Financial Analyzer's folder, document, chunks and skill with org_id
-- hardcoded to '430bffc6-…' — the LOCAL dev database's "seed@system.local's Organization".
-- In any other database (production included) that id names no organization, and nothing
-- foreign-keys org_id, so the rows would land orphaned and silently invisible.
--
-- This re-points exactly those five seeded rows (by their fixed ids) to the seed user's
-- (…0001) own organization, looked up — never assumed. Locally that org IS 430bffc6, so this
-- is a no-op there. Idempotent; a database without the seed user changes nothing.
-- It does NOT make the knowledge reachable from other orgs — that is SEED-304 (PACK-05).

DO $$
DECLARE
    seed_org uuid;
BEGIN
    SELECT m.org_id INTO seed_org
    FROM public.org_members m
    WHERE m.user_id = '00000000-0000-0000-0000-000000000001'::uuid
    ORDER BY m.created_at NULLS LAST
    LIMIT 1;

    IF seed_org IS NULL THEN
        RAISE NOTICE '193: seed user has no org here; nothing re-pointed';
        RETURN;
    END IF;

    UPDATE public.folders
       SET org_id = seed_org
     WHERE id = '00000000-0000-0000-0000-000000000260'::uuid AND org_id IS DISTINCT FROM seed_org;

    UPDATE public.documents
       SET org_id = seed_org
     WHERE id = '00000000-0000-0000-0000-000000000261'::uuid AND org_id IS DISTINCT FROM seed_org;

    UPDATE public.document_chunks
       SET org_id = seed_org
     WHERE document_id = '00000000-0000-0000-0000-000000000261'::uuid AND org_id IS DISTINCT FROM seed_org;

    UPDATE public.skills
       SET org_id = seed_org
     WHERE id = '00000000-0000-0000-0000-000000000264'::uuid AND org_id IS DISTINCT FROM seed_org;
END $$;
