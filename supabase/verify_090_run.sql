-- =============================================================================
-- verify_090_run.sql — Phase 090 auto-reporting verification (single paste)
-- =============================================================================
-- Companion to verify_090.sql. Paste this ENTIRE file into the Supabase Studio
-- SQL editor (LOCAL project, http://localhost:54323) and run it ONCE.
--
-- It is fully self-contained: it creates its own test rows + a second test user,
-- exercises all six checks (A immutability, B DELETE RESTRICT, C UNIQUE,
-- D cross-user RLS, E INSERT-only audit, F presence/absence), writes a PASS/FAIL
-- row per block into a temp table, prints the report grid as the final result,
-- and ROLLBACKs — so NO test data persists.
--
-- ✅ Success = every row in the final grid shows PASS.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _v090 (ord int, block text, result text) ON COMMIT DROP;

-- Second test user (user B) for the cross-user RLS block. Idempotent.
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-0000-0000-0000000000b2', 'verify-b@system.local', '', now(), now(), now(),
        '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- BLOCK A — HARNESS-02: published-immutability trigger refuses post-publish UPDATE
DO $$
BEGIN
  INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
  VALUES ('verify-a', 1, 'A', 'draft', '00000000-0000-0000-0000-000000000001', '{}');
  UPDATE public.workflow_definitions SET status = 'published'
   WHERE slug = 'verify-a' AND version = 1;          -- draft->published MUST succeed
  BEGIN
    UPDATE public.workflow_definitions SET name = 'tampered'
     WHERE slug = 'verify-a' AND version = 1;          -- MUST raise
    INSERT INTO _v090 VALUES (1, 'A immutability (HARNESS-02)', 'FAIL — post-publish UPDATE was allowed');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO _v090 VALUES (1, 'A immutability (HARNESS-02)', 'PASS — post-publish UPDATE raised 23514');
  END;
END $$;

-- BLOCK C — UNIQUE(slug, version)
DO $$
BEGIN
  INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
  VALUES ('verify-c', 1, 'C', 'draft', '00000000-0000-0000-0000-000000000001', '{}');
  BEGIN
    INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
    VALUES ('verify-c', 1, 'C dup', 'draft', '00000000-0000-0000-0000-000000000001', '{}');
    INSERT INTO _v090 VALUES (3, 'C unique slug+version (HARNESS-02)', 'FAIL — duplicate allowed');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO _v090 VALUES (3, 'C unique slug+version (HARNESS-02)', 'PASS — duplicate raised 23505');
  END;
END $$;

-- BLOCKS B + D + E — shared data (definition owned by user A, with run/phase/audit)
DO $$
DECLARE
  v_a uuid := '00000000-0000-0000-0000-000000000001';
  v_b uuid := '00000000-0000-0000-0000-0000000000b2';
  v_thread uuid; v_def uuid; v_run uuid; v_audit uuid;
  c_runs int; c_phases int; c_audit int; c_self int; upd_count int;
  v_global_blocked boolean := false;
BEGIN
  INSERT INTO public.threads (user_id) VALUES (v_a) RETURNING id INTO v_thread;
  INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
    VALUES ('verify-bd', 1, 'BD', 'draft', v_a, '{}') RETURNING id INTO v_def;
  INSERT INTO public.workflow_runs (thread_id, definition_id, status)
    VALUES (v_thread, v_def, 'active') RETURNING id INTO v_run;
  INSERT INTO public.workflow_phases (workflow_run_id, phase_index, slug)
    VALUES (v_run, 0, 'p0');
  INSERT INTO public.harness_audit (user_id, run_id, event_type)
    VALUES (v_a, v_run, 'run_started') RETURNING id INTO v_audit;

  -- BLOCK B — DELETE RESTRICT on a referenced definition
  BEGIN
    DELETE FROM public.workflow_definitions WHERE id = v_def;
    INSERT INTO _v090 VALUES (2, 'B DELETE RESTRICT (HARNESS-02/SC#2)', 'FAIL — referenced def deletable');
  EXCEPTION WHEN foreign_key_violation THEN
    INSERT INTO _v090 VALUES (2, 'B DELETE RESTRICT (HARNESS-02/SC#2)', 'PASS — DELETE raised 23503');
  END;

  -- BLOCK D — cross-user RLS: impersonate user B, must see 0 of user A's rows.
  -- Query each target table DIRECTLY by its own PK / FK (NOT joining through threads),
  -- so a broken runs/phases/audit USING predicate cannot be masked by threads RLS (WR-02).
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO c_runs   FROM public.workflow_runs    WHERE id = v_run;
  SELECT count(*) INTO c_phases FROM public.workflow_phases  WHERE workflow_run_id = v_run;
  SELECT count(*) INTO c_audit  FROM public.harness_audit    WHERE id = v_audit;

  -- BLOCK E (mutation) — as the OWNER (user A): can read own audit, but UPDATE affects 0 rows
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO c_self FROM public.harness_audit WHERE user_id = v_a;
  UPDATE public.harness_audit SET event_type = 'tampered' WHERE id = v_audit;
  GET DIAGNOSTICS upd_count = ROW_COUNT;

  -- BLOCK G (WR-01 regression, migration 060) — owner CANNOT promote own draft to is_global=true.
  -- The UPDATE policy's WITH CHECK rejects the new row → SQLSTATE 42501 (insufficient_privilege).
  BEGIN
    UPDATE public.workflow_definitions SET is_global = true WHERE id = v_def;
    v_global_blocked := false;   -- no error == guard FAILED
  EXCEPTION WHEN insufficient_privilege THEN
    v_global_blocked := true;    -- WITH CHECK denied the promotion == guard works
  END;

  -- reset to superuser context before recording results / cleanup
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF c_runs = 0 AND c_phases = 0 AND c_audit = 0 THEN
    INSERT INTO _v090 VALUES (4, 'D cross-user RLS denial (SC#3)', 'PASS — user B sees 0 runs/0 phases/0 audit');
  ELSE
    INSERT INTO _v090 VALUES (4, 'D cross-user RLS denial (SC#3)',
      format('FAIL — user B saw runs=%s phases=%s audit=%s', c_runs, c_phases, c_audit));
  END IF;

  IF c_self >= 1 AND upd_count = 0 THEN
    INSERT INTO _v090 VALUES (5, 'E INSERT-only audit (HARNESS-06)',
      format('PASS — owner reads own audit (%s) but UPDATE affected 0 rows', c_self));
  ELSE
    INSERT INTO _v090 VALUES (5, 'E INSERT-only audit (HARNESS-06)',
      format('FAIL — owner_reads=%s update_rows=%s (want reads>=1, update=0)', c_self, upd_count));
  END IF;

  IF v_global_blocked THEN
    INSERT INTO _v090 VALUES (8, 'G is_global self-promotion guard (WR-01 / migration 060)',
      'PASS — owner cannot UPDATE own draft to is_global=true (WITH CHECK denied, 42501)');
  ELSE
    INSERT INTO _v090 VALUES (8, 'G is_global self-promotion guard (WR-01 / migration 060)',
      'FAIL — owner promoted own draft to is_global=true (UPDATE WITH CHECK missing — apply migration 060)');
  END IF;
END $$;

RESET ROLE;  -- defensive: ensure superuser context for the rest

-- BLOCK E (policy introspection) — harness_audit must have ONLY SELECT + INSERT policies
INSERT INTO _v090
SELECT 6, 'E audit policy set (HARNESS-06)',
       CASE WHEN string_agg(cmd, ',' ORDER BY cmd) = 'INSERT,SELECT'
            THEN 'PASS — only INSERT + SELECT policies (no UPDATE/DELETE)'
            ELSE 'FAIL — policies = ' || coalesce(string_agg(cmd, ',' ORDER BY cmd), '(none)') END
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'harness_audit';

-- BLOCK F — SC#1/SC#4/D-11/D-12 presence & absence introspection
DO $$
DECLARE t int; col_run int; col_dmm int; org int;
BEGIN
  SELECT count(*) INTO t FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('workflow_definitions','workflow_runs','workflow_phases','harness_audit');
  SELECT count(*) INTO col_run FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'threads' AND column_name = 'active_workflow_run_id';
  SELECT count(*) INTO col_dmm FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'threads' AND column_name = 'deep_mode_metadata';
  SELECT count(*) INTO org FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'org_id' AND is_nullable = 'YES'
     AND table_name IN ('workflow_definitions','workflow_runs','workflow_phases','harness_audit');
  IF t = 4 AND col_run = 1 AND col_dmm = 0 AND org = 4 THEN
    INSERT INTO _v090 VALUES (7, 'F presence/absence (SC#1/SC#4)',
      'PASS — 4 tables, active_workflow_run_id present, deep_mode_metadata absent, org_id nullable x4');
  ELSE
    INSERT INTO _v090 VALUES (7, 'F presence/absence (SC#1/SC#4)',
      format('FAIL — tables=%s awr=%s dmm=%s(want 0) org_nullable=%s', t, col_run, col_dmm, org));
  END IF;
END $$;

-- ===== RESULT GRID — every row should read PASS =====
SELECT block, result FROM _v090 ORDER BY ord;

ROLLBACK;  -- discard all test data — nothing persists
