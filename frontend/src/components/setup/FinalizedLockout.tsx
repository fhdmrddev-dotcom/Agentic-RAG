// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §9, D-14 / SC#2) — the finalized lock-out.
//
// The "already configured" surface, shown after finalize AND on any later `/setup`
// visit (SC#2). A centered success card (the PublishGauntlet publish-success tone)
// with NO config fields and NO re-entry — re-configuration is an Admin action
// (D-14), never the public pre-auth wizard. A single primary CTA routes to the
// normal auth/app surface.
//
// The D-07 login-fallback note rides as a QUIET secondary line (not an alarm): the
// browser's Supabase address is baked at build time, so a wizard-entered URL may
// need a restart / rebuild to take effect — the honest restart-to-apply reality.
//
// SECURITY (T-158-02): this is the ONLY surface after finalize; it never collects
// or writes config, so a re-visit cannot re-open the setup write path. There is no
// raw-HTML sink (every line is plain React text).
// ─────────────────────────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowRight, RefreshCw } from "lucide-react"

interface FinalizedLockoutProps {
  /** Route to the normal auth/app surface (the host clears the `/setup` branch). */
  onGoToApp: () => void
}

export function FinalizedLockout({ onGoToApp }: FinalizedLockoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background gradient orbs — the shared entry-shell language. */}
      <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-success/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

      <div
        role="status"
        className="relative z-10 w-full max-w-md space-y-5 rounded-[10px] border border-success/40 bg-card/80 p-8 text-center shadow-xl shadow-black/5 backdrop-blur-sm"
      >
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="font-headline text-xl font-semibold text-foreground">
            Setup is already complete.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This workspace is configured. Head to the app to log in — to change settings, use the Admin
            area.
          </p>
        </div>

        <Button onClick={onGoToApp} className="w-full">
          Go to the app
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* The D-07 login-fallback note — quiet, secondary, not an alarm. */}
        <p className="flex items-start gap-1.5 text-left text-[12px] leading-relaxed text-muted-foreground">
          <RefreshCw className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span>
            If login doesn't work right away, your server may need a quick restart to pick up the new
            address. Your operator can run{" "}
            <code className="font-mono text-foreground">docker compose restart</code> (or rebuild the
            frontend).
          </span>
        </p>
      </div>
    </div>
  )
}
