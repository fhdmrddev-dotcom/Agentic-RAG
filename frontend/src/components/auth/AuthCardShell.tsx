/**
 * Phase 177 Plan 05 Task 1 — AuthCardShell (the D-14 shared brand-card shell).
 *
 * ONE branded auth card shell for the pre-auth entry surfaces. AuthPage and
 * AcceptInvitePage both used to CLONE this markup verbatim (AuthPage.tsx:15-44 and
 * AcceptInvitePage.tsx:206-227 were byte-identical) — D-14 consolidates the drift so both
 * pages read as one product surface.
 *
 * The shell owns the full-screen centered container, the two org-indigo background orbs
 * (`bg-primary/10` + `bg-violet-500/10 blur-3xl` — the reserved operator-amber tint is never
 * used here), the `ghost-border bg-card/80 backdrop-blur-sm` Card, and the `gradient-primary`
 * Sparkles header tile. Each page supplies its own `title`, `subhead`, and body `children`.
 *
 * Pure presentational shell — no auth/route/accept logic (byte-frozen at the call sites, D-01).
 * Markup lifted verbatim from AuthPage (same tokens, same Sparkles glyph — zero visual change).
 */
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

export interface AuthCardShellProps {
  /** The card title (e.g. "Agentic RAG" / "You've been invited"). */
  title: ReactNode
  /** The state-specific sub-headline under the title. */
  subhead: ReactNode
  /** The card body (the form or the per-state notice). */
  children: ReactNode
}

export function AuthCardShell({ title, subhead, children }: AuthCardShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradient orbs (single-sourced here — D-14) */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md ghost-border bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 relative z-10">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-headline font-bold">{title}</CardTitle>
            <CardDescription className="mt-1.5">{subhead}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
