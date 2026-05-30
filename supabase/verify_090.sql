-- =============================================================================
-- verify_090.sql  —  Phase 090 live-DB verification gate
-- =============================================================================
-- Phase: 090-harness-schema-rls-config-models
-- Run:   Plan 03 (autonomous: false) — pasted into the Supabase SQL editor
--        against the LIVE LOCAL Supabase AFTER migrations 056–059 are applied.
--
-- Why a SQL script (not pytest): backend/tests/conftest.py builds a fully
-- MOCKED Supabase client (RESEARCH §Pitfall 1) — RLS, the immutable-on-publish
-- trigger, DELETE RESTRICT, and INSERT-only audit CANNOT be verified in pytest.
-- This script is the only path. Each block states its SC / requirement, the
-- action, and the EXPECTED result so the operator confirms pass/fail by reading
-- the output. Error-code references: 23514 = check_violation (trigger raise),
-- 23503 = foreign_key_violation, 23505 = unique_violation.
--
-- HOW TO RUN: execute block-by-block. Blocks A–C and E run inside a transaction
-- you roll back at the end (no committed test data). Block D needs two distinct
-- seeded user UUIDs (see its header). Blocks D/E/F are read-mostly introspection.
-- Substitute the two :user_a / :user_b UUIDs in Block D with real auth.users ids.
-- =============================================================================


-- =============================================================================
-- BLOCK A — HARNESS-02: published-immutability trigger refuses post-publish UPDATE
-- =============================================================================
-- SC/req:  HARNESS-02 (published workflow definitions are immutable)
-- Action:  insert a draft definition; UPDATE draft→published (MUST succeed —
--          the trigger keys on OLD.status, so the publish transition is allowed,
--          RESEARCH §Pattern 3 / Pitfall 3); then attempt a SECOND UPDATE on the
--          now-published row.
-- EXPECT:  the draft→published UPDATE SUCCEEDS; the post-publish UPDATE RAISES
--          SQLSTATE 23514 (check_violation) from the block-published trigger.
-- -----------------------------------------------------------------------------
BEGIN;

INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
VALUES ('verify-a', 1, 'Verify A', 'draft',
        '00000000-0000-0000-0000-000000000001',
        '{"slug":"verify-a","version":1,"name":"Verify A","status":"draft","phases":[]}'::jsonb);

-- EXPECT: SUCCEEDS (OLD.status = 'draft' → publish transition allowed)
UPDATE public.workflow_definitions
   SET status = 'published'
 WHERE slug = 'verify-a' AND version = 1;

-- EXPECT: RAISES SQLSTATE 23514 (check_violation) — row is now published, immutable.
-- Run this statement on its own and confirm the error code is 23514:
UPDATE public.workflow_definitions
   SET name = 'tampered'
 WHERE slug = 'verify-a' AND version = 1;

ROLLBACK;  -- discard Block A test rows


-- =============================================================================
-- BLOCK B — HARNESS-02 / SC#2: DELETE RESTRICT on a referenced definition
-- =============================================================================
-- SC/req:  SC#2 — a definition referenced by a run cannot be deleted.
-- Action:  insert a definition + a workflow_runs row referencing it, then DELETE
--          the definition.
-- EXPECT:  the DELETE RAISES SQLSTATE 23503 (foreign_key_violation) because
--          workflow_runs.definition_id is REFERENCES ... ON DELETE RESTRICT (D-06).
-- Note:    thread_id must reference an existing threads row owned by the test
--          user; substitute :thread_id with a real threads.id you own.
-- -----------------------------------------------------------------------------
BEGIN;

INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
VALUES ('verify-b', 1, 'Verify B', 'draft',
        '00000000-0000-0000-0000-000000000001',
        '{}'::jsonb)
RETURNING id AS def_id \gset

INSERT INTO public.workflow_runs (definition_id, thread_id, status)
VALUES (:'def_id', :'thread_id', 'active');  -- 'active' ∈ workflow_runs status CHECK set

-- EXPECT: RAISES SQLSTATE 23503 (foreign_key_violation) — RESTRICT blocks the delete.
DELETE FROM public.workflow_definitions WHERE id = :'def_id';

ROLLBACK;  -- discard Block B test rows


-- =============================================================================
-- BLOCK C — UNIQUE(slug, version) collision
-- =============================================================================
-- SC/req:  HARNESS-02 (D-05) — (slug, version) is unique.
-- Action:  insert two definitions with the same (slug, version).
-- EXPECT:  the SECOND insert RAISES SQLSTATE 23505 (unique_violation).
-- -----------------------------------------------------------------------------
BEGIN;

INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
VALUES ('verify-c', 1, 'Verify C', 'draft',
        '00000000-0000-0000-0000-000000000001', '{}'::jsonb);

-- EXPECT: RAISES SQLSTATE 23505 (unique_violation) on (slug, version).
INSERT INTO public.workflow_definitions (slug, version, name, status, created_by, definition)
VALUES ('verify-c', 1, 'Verify C dup', 'draft',
        '00000000-0000-0000-0000-000000000001', '{}'::jsonb);

ROLLBACK;  -- discard Block C test rows


-- =============================================================================
-- BLOCK D — SC#3: cross-user RLS denial (two auth contexts)
-- =============================================================================
-- SC/req:  SC#3 — user B cannot read user A's runs / phases / audit rows.
-- Action:  simulate the "authenticated" role with user B's JWT sub, then SELECT
--          rows that belong to user A. RLS resolves auth.uid() from the JWT
--          claim, so the FK-chain RLS predicates deny the rows.
-- EXPECT:  EVERY SELECT below returns 0 ROWS for user B.
-- Setup:   requires two DISTINCT seeded user UUIDs and at least one workflow_runs
--          row owned by user A (its thread_id → threads.user_id = :user_a).
--          Substitute :user_a and :user_b with real auth.users ids.
-- -----------------------------------------------------------------------------
-- Run these SET LOCAL statements + SELECTs inside ONE transaction so the role /
-- claims override is scoped and auto-reverts on COMMIT/ROLLBACK.
BEGIN;

SET LOCAL ROLE authenticated;
-- Impersonate user B (the attacker context). auth.uid() reads request.jwt.claims->>'sub'.
SET LOCAL "request.jwt.claims" = '{"sub":":user_b","role":"authenticated"}';

-- EXPECT: 0 rows — user B cannot see user A's runs (1-hop RLS via threads.user_id).
SELECT count(*) AS visible_runs
  FROM public.workflow_runs wr
  JOIN public.threads t ON t.id = wr.thread_id
 WHERE t.user_id = ':user_a';

-- EXPECT: 0 rows — user B cannot see user A's phases (2-hop RLS via run→thread).
SELECT count(*) AS visible_phases
  FROM public.workflow_phases wp
  JOIN public.workflow_runs wr ON wr.id = wp.workflow_run_id
  JOIN public.threads t ON t.id = wr.thread_id
 WHERE t.user_id = ':user_a';

-- EXPECT: 0 rows — user B cannot see user A's harness_audit rows (SELECT-owner RLS).
SELECT count(*) AS visible_audit
  FROM public.harness_audit
 WHERE user_id = ':user_a';

ROLLBACK;  -- reverts the role / claims override


-- =============================================================================
-- BLOCK E — HARNESS-06: harness_audit is INSERT-only (no UPDATE/DELETE policy)
-- =============================================================================
-- SC/req:  HARNESS-06 — audit rows are append-only / tamper-proof.
-- Action 1 (policy introspection): list the RLS policies on harness_audit.
-- EXPECT:  exactly SELECT + INSERT policies present; NO UPDATE policy, NO DELETE
--          policy (INSERT-only enforced by the ABSENCE of mutation policies —
--          RESEARCH §Pattern 4). cmd column should show only 'SELECT' and 'INSERT'.
SELECT policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'harness_audit'
 ORDER BY cmd;
-- EXPECT (rows): one cmd='INSERT' policy + one cmd='SELECT' policy; NO 'UPDATE'/'DELETE'.

-- Action 2 (mutation denial): as an authenticated owner, attempt to UPDATE an
-- existing audit row. EXPECT: 0 rows affected (RLS denies — no UPDATE policy).
-- Substitute :audit_id with a real harness_audit.id and run as the owning user.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":":user_a","role":"authenticated"}';
-- EXPECT: UPDATE 0  (no row mutated — RLS denial, INSERT-only)
UPDATE public.harness_audit SET event_type = 'tampered' WHERE id = ':audit_id';
ROLLBACK;


-- =============================================================================
-- BLOCK F — SC#1 + SC#4: table / column presence + absence introspection
-- =============================================================================
-- SC/req:  SC#1 — all 4 harness tables exist; SC#4 / D-12 — threads gains ONLY
--          active_workflow_run_id (deep_mode_metadata must NOT exist); D-11 —
--          every new table carries a nullable org_id column.
-- -----------------------------------------------------------------------------

-- F1: all four tables exist.
-- EXPECT: 4 rows (workflow_definitions, workflow_runs, workflow_phases, harness_audit).
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('workflow_definitions','workflow_runs','workflow_phases','harness_audit')
 ORDER BY table_name;

-- F2: threads.active_workflow_run_id EXISTS.
-- EXPECT: 1 row, is_nullable = 'YES'.
SELECT column_name, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'threads'
   AND column_name = 'active_workflow_run_id';

-- F3: threads.deep_mode_metadata does NOT exist (D-12).
-- EXPECT: 0 rows.
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'threads'
   AND column_name = 'deep_mode_metadata';

-- F4: every new table has a nullable org_id column (D-11).
-- EXPECT: 4 rows, all is_nullable = 'YES'.
SELECT table_name, column_name, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND column_name = 'org_id'
   AND table_name IN ('workflow_definitions','workflow_runs','workflow_phases','harness_audit')
 ORDER BY table_name;

-- =============================================================================
-- END verify_090.sql — all six blocks A–F. Confirm each EXPECT line matches the
-- observed output / SQLSTATE before marking Phase 090 SC#1/#2/#3/#4 + HARNESS-06
-- as Validated.
-- =============================================================================
