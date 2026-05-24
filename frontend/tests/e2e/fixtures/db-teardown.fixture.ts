// Phase 075.4 Plan 05 Task 2 — DB teardown + orphan-run assertion (Wave 0 bootstrap).
//
// CRITICAL Threat T-075.4-EXTRA mitigation: HARD-GATE on SUPABASE_URL
// containing "localhost" or "127.0.0.1". If pointed at prod, this would
// catastrophically wipe a real user's runs/messages/threads.
//
// Scope: deletes (in FK-safe order: runs -> messages -> threads) all
// rows owned by the test user (looked up via supabase.auth.admin.listUsers).
// Called between Playwright scenarios so each test starts on a clean slate.
//
// `assertNoOrphanedStreamingRuns` is the safety-net check used by Plan 06
// scenarios to confirm the streaming lifecycle (Phase 067.5 reconcile +
// 075.4 per-thread state) cleans up properly — any leftover row with
// status='streaming' for the test user is a bug.

import { createClient, SupabaseClient } from "@supabase/supabase-js"

const LOCALHOST_RE = /(localhost|127\.0\.0\.1)/

function assertLocalhostOnly(): void {
  const url = process.env.SUPABASE_URL || ""
  if (!LOCALHOST_RE.test(url)) {
    throw new Error(
      "db-teardown refusing to run: SUPABASE_URL must contain 'localhost' or '127.0.0.1'. " +
        `Got: ${url ? url.slice(0, 40) + "..." : "(unset)"}. ` +
        "This guard prevents accidental TRUNCATE against a production database.",
    )
  }
}

function makeAdminClient(): SupabaseClient {
  // Re-assert localhost on every call — defense-in-depth in case a fixture
  // accidentally swaps env mid-run.
  assertLocalhostOnly()
  const url = process.env.SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      "db-teardown requires SUPABASE_SERVICE_ROLE_KEY in env (localhost service role key only).",
    )
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function findUserIdByEmail(client: SupabaseClient, email: string): Promise<string | null> {
  // supabase.auth.admin.listUsers paginates; the dev test user lives on
  // the first page, so we don't worry about full pagination here.
  // @ts-expect-error — admin namespace is only available on the service-role client.
  const { data, error } = await client.auth.admin.listUsers()
  if (error) throw error
  const u = data.users.find((row: { email?: string }) => row.email === email)
  return u ? (u.id as string) : null
}

export async function teardownTestUserData(email: string): Promise<void> {
  // HARD-GATE: refuse to operate against anything that doesn't look local.
  assertLocalhostOnly()

  const client = makeAdminClient()
  const userId = await findUserIdByEmail(client, email)
  if (!userId) return // nothing to clean up

  // FK-safe deletion order: runs -> messages -> threads. Same order as
  // backend/tests/conftest.py::fk_aware_runs_factory teardown (Task 4).
  // `delete` returns immediately for the local Supabase dev instance.
  await client.from("runs").delete().eq("user_id", userId)
  await client.from("messages").delete().eq("user_id", userId)
  await client.from("threads").delete().eq("user_id", userId)
}

export async function assertNoOrphanedStreamingRuns(email: string): Promise<void> {
  // localhost guard again — invariant for every DB-touching helper.
  assertLocalhostOnly()

  const client = makeAdminClient()
  const userId = await findUserIdByEmail(client, email)
  if (!userId) return // no user, no orphans

  // Schema: runs primary key is `run_id`, not `id` (see migration 035 +
  // supabase/full-schema.sql `runs_pkey PRIMARY KEY (run_id)`).
  const { data, error } = await client
    .from("runs")
    .select("run_id, status, thread_id")
    .eq("user_id", userId)
    .eq("status", "streaming")

  if (error) throw error
  if (data && data.length > 0) {
    throw new Error(
      `assertNoOrphanedStreamingRuns: found ${data.length} streaming run(s) ` +
        `for user ${email}. IDs: ${data.map((r) => r.run_id).join(", ")}. ` +
        "The streaming lifecycle (Phase 067.5 reconcile + 075.4 per-thread state) " +
        "did not flip terminal state. Inspect runs.status / Redis streams for the leak.",
    )
  }
}
