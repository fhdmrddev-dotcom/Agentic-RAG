// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §4, D-10) — the schema-missing copy-guide.
//
// Rendered inside ConnectionBindStep when Postgres CONNECTS but the sentinel table
// is absent — a reachable-but-empty database. This is GUIDANCE, not an error, so it
// wears the AMBER tone (the LifecycleStepper `overrideReceipt` amber, NOT the
// destructive/red of a failed connection).
//
// The MUST (D-10): the exact `docs/OPERATOR.md` Step-3 sequence — full-schema.sql,
// then the 9 ordered seed migrations by filename, then the `('global')` row — in a
// copy-to-clipboard mono block. Paste it into the Supabase SQL editor, run it, Test
// again.
//
// The SHOULD (D-10 / D-18): if the server-side DDL runner is wired (158-06
// schema-bootstrap), a single "Set up the database for me" button calls
// `postSchemaBootstrap` and, on the `{fallback:"guide"}` privilege response, falls
// back to the copy-guide above — the copy-guide is always the fallback that MUST work.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, Loader2, Database } from "lucide-react"
import { postSchemaBootstrap, SetupApiError, type BindBody } from "@/lib/setupApi"
import { cn } from "@/lib/utils"

// The exact OPERATOR.md Step-3 sequence: full-schema.sql → the 9 ordered seed
// migrations by filename → the ('global') row. Copied verbatim into the SQL editor.
const SETUP_SQL = `-- 1. Run the schema (choose "Run without RLS" — the file enables RLS itself):
--    supabase/full-schema.sql

-- 2. Apply the 9 seed migrations in THIS order, by exact filename:
--    supabase/migrations/010_app_settings.sql
--    supabase/migrations/018_skill_creator_seed.sql
--    supabase/migrations/053_settings_unification.sql
--    supabase/migrations/056_workflow_definitions.sql
--    supabase/migrations/061_harness_seed_templates.sql
--    supabase/migrations/066_eval_coverage_seed.sql
--    supabase/migrations/087_skill_creator_reborn.sql               -- trio: FIRST
--    supabase/migrations/088_skill_creator_eval_step_sequencing.sql  -- trio: SECOND
--    supabase/migrations/089_skill_creator_file_attach_honesty.sql   -- trio: THIRD

-- 3. Insert the global settings row (without it, Settings saves silently no-op):
INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;`

interface SchemaGuidancePanelProps {
  /** The setup token — enables the SHOULD server-side "run it for me". Omit to render
   *  the copy-guide only (the MUST). */
  token?: string
  /** The submitted infra the auto-runner would target. */
  bind?: BindBody
  /** Called after a successful auto-bootstrap so the parent re-tests the connection. */
  onBootstrapped?: () => void
}

export function SchemaGuidancePanel({ token, bind, onBootstrapped }: SchemaGuidancePanelProps) {
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ tone: "ok" | "guide"; message: string } | null>(null)

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SETUP_SQL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the SQL is visible in the block below regardless */
    }
  }

  async function runForMe() {
    if (!token || running) return
    setRunning(true)
    setRunResult(null)
    try {
      const res = await postSchemaBootstrap(token, bind ?? {})
      if (res.fallback === "guide") {
        // No privilege / not runnable here → the copy-guide stays the path.
        setRunResult({
          tone: "guide",
          message: res.reason ?? "Automatic setup isn't available here — paste the SQL above instead.",
        })
      } else if (res.bootstrapped || res.schema_present) {
        setRunResult({ tone: "ok", message: "Database set up. Re-testing…" })
        onBootstrapped?.()
      } else {
        setRunResult({
          tone: "guide",
          message: res.reason ?? "Paste the SQL above and run it, then Test again.",
        })
      }
    } catch (err) {
      setRunResult({
        tone: "guide",
        message:
          err instanceof SetupApiError
            ? err.message
            : "Couldn't set up automatically — paste the SQL above instead.",
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      role="status"
      className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-600 dark:text-amber-400"
    >
      <div className="flex items-start gap-2">
        <Database className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-sm font-semibold">Your database is reachable but empty</p>
            <p className="mt-0.5 text-[12px] leading-snug text-amber-700/90 dark:text-amber-300/90">
              Paste this setup SQL into the Supabase SQL editor, run it, then Test again.
            </p>
          </div>

          <div className="relative">
            <pre className="max-h-52 overflow-auto rounded-md border border-amber-500/20 bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
              {SETUP_SQL}
            </pre>
            <button
              type="button"
              onClick={copySql}
              aria-label="Copy the setup SQL sequence"
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-success" aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden="true" /> Copy
                </>
              )}
            </button>
          </div>

          {/* SHOULD (D-10): the server-side "run it for me" — falls back to the
              copy-guide above on a privilege/fallback response. The copy-guide is
              the MUST that always works. */}
          {token && (
            <div className="space-y-1.5">
              <Button type="button" size="sm" onClick={runForMe} disabled={running} className="w-full sm:w-auto">
                {running ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Setting up…
                  </>
                ) : (
                  "Set up the database for me"
                )}
              </Button>
              {runResult && (
                <p
                  role="status"
                  className={cn(
                    "text-[12px]",
                    runResult.tone === "ok" ? "text-success" : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {runResult.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
