// ─────────────────────────────────────────────────────────────────────────────
// Phase 148 Plan 09 (VIS-01 / sketch 069-A) — the feature-visibility audience rows.
//
// HOME = the Users & Access tab, BELOW the roster (visibility governs WHO — the
// 065-A location-carries-meaning rule). It NEVER sits next to the kill-switches:
// the in-Controls placement (069-C) was sketched as a foil and REJECTED, because
// "OFF for everyone" (a kill-switch) and "Operators only" (visibility) must never
// be styling-only neighbours. So this surface is amber-warmed, NEVER kill-switch red.
//
// One card per advanced feature with a TWO-POSITION audience control:
//   Everyone | ⛨ Operators only
// THE EXTENSIBLE-AUDIENCE FORWARD-COMPAT CONTRACT (SEED-115, operator directive):
// the value the control reads/writes is an ENUM ("everyone" | "operators"), **NEVER
// a boolean** — it is the degenerate two-audience case of a value designed to grow
// into an audience picker (IdP groups / departments at v3.4). Modelling it as on/off
// would kill that path. The `FeatureAudience` type is the enum; there is no boolean here.
//
// Flipping to Operators-only reveals the concrete CONSEQUENCE line — the honest beat
// that this is API-enforced, not cosmetic: "End users no longer see X — and their API
// calls to it are refused server-side, not just hidden." — plus an expandable
// "what exactly this controls" (UI surface · refused API · who decides; the raw route
// prefixes sit behind the shared ⌥ Technical-names reveal).
//
// Every flip is DIRECT WITH A RECEIPT (the 066 graded-guard rule): it is reversible
// and has no victim, so no confirm sheet — just the `✎ visibility.set` receipt.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (ControlRoomPage) owns the
// audience map + the server write; this leaf renders the rows and reports the flip.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from "react"
import {
  Check,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import type { FeatureAudience, GovernedFeature, GreenlistRole } from "@/lib/api"
import { cn } from "@/lib/utils"

// Phase 167 (VIS-01 / D-167-06) — the third, extensible audience. The binary
// everyone|operators grows a `role` greenlist here; the SEED-115 forward-compat contract
// (an enum, never a boolean) is exactly what made this a drop-in, no design change.
type AudienceValue = FeatureAudience | "role"

// The 4-tier org roles a greenlist can name (lowest → highest privilege). The write is
// server allowlist-validated against the SAME set (400 on a bad role — T-167-10b); this
// control is render-only. Rich group management (IdP groups / departments) stays deferred.
const GREENLIST_ROLES: readonly { key: GreenlistRole; label: string }[] = [
  { key: "member", label: "Member" },
  { key: "dept-admin", label: "Dept admin" },
  { key: "org-admin", label: "Org admin" },
  { key: "super-admin", label: "Super admin" },
]

interface FeatureVisibilityProps {
  /** The current audience per governed feature (the shell's source of truth). An
   *  ENUM value, never a boolean — the SEED-115 forward-compat contract. Phase 167
   *  adds the `role` audience (a greenlist). */
  visibility: Record<GovernedFeature, AudienceValue>
  /** The greenlisted roles per feature (Phase 167 / VIS-01) — only consulted when a
   *  feature's audience is `role`. Optional (defaults to none) so the pure-leaf a11y
   *  callers can omit it. */
  greenlist?: Record<GovernedFeature, string[]>
  /** Flip a feature's audience → `PUT /admin/visibility` with the enum value (+ a `roles[]`
   *  greenlist for the `role` audience). Direct with a receipt (066 — reversible, no victim).
   *  Resolves on success, rejects on failure. */
  onSetVisibility: (
    feature: GovernedFeature,
    audience: AudienceValue,
    roles?: string[],
  ) => Promise<void>
  /** When true, reveal the raw route prefixes behind the ⌥ Technical-names toggle. */
  showTechnical: boolean
}

interface FeatureDef {
  key: GovernedFeature
  /** The plain, human name (the default audience). */
  name: string
  /** One-line plain description of what the feature is. */
  desc: string
  /** Where this feature lives in the app (the nav home). */
  livesOn: string
  /** The row glyph. */
  glyph: LucideIcon
  /** What UI surface an end user loses when this is Operators-only. */
  uiSurface: string
  /** What API is refused SERVER-SIDE (not just hidden) when Operators-only. */
  refusedApi: string
  /** The raw route prefixes the gate covers — shown behind ⌥ Technical names. */
  routePrefixes: string
}

// The 069-A day-one map (order matters). Skill Studio is ONE flag covering the eval
// studio + the trigger tuner (the tuner is a Studio tab). Workflow authoring is
// additive — RUNNING workflows stays open to everyone.
const FEATURES: readonly FeatureDef[] = [
  {
    key: "skill_studio",
    name: "Skill Studio",
    desc: "Build, test and tune agent skills — evals and the trigger tuner.",
    livesOn: "Skills",
    glyph: Sparkles,
    uiSurface: "The Skill Studio tabs (evals + trigger tuner) in the Skills area.",
    refusedApi: "Eval, trigger-tuner and test-case endpoints.",
    routePrefixes: "/evals · /skill-tuner · /skill-test-cases",
  },
  {
    key: "model_management",
    name: "Model management",
    desc: "Configure AI models, embeddings and engine health.",
    livesOn: "Settings",
    glyph: SlidersHorizontal,
    uiSurface: "The AI-model, embedding and engine-health sections of Settings.",
    refusedApi: "Reading/writing model settings and re-embedding (the chat model picker stays open).",
    routePrefixes: "/settings (model_management endpoints)",
  },
  {
    key: "workflow_authoring",
    name: "Workflow authoring & publishing",
    desc: "Create and publish workflows. Running workflows stays open to everyone.",
    livesOn: "Workflows",
    glyph: Workflow,
    uiSurface: "The workflow builder, drafts and publish controls.",
    refusedApi: "Creating, editing, publishing and generating workflows (launch + published stay open).",
    routePrefixes: "/workflows (authoring — not launch/published/starters)",
  },
  {
    key: "governance_health",
    name: "Governance health",
    desc: "Review document-governance signals and health.",
    livesOn: "Governance",
    glyph: ShieldCheck,
    uiSurface: "The governance-health page and its signals.",
    refusedApi: "Document-governance endpoints.",
    routePrefixes: "/document-governance",
  },
]

/** The 069-A audience rows: enum control, amber-never-red, consequence line + the
 *  expandable enforcement details, and a ✎ receipt per flip. Lives below the roster. */
export function FeatureVisibility({
  visibility,
  greenlist,
  onSetVisibility,
  showTechnical,
}: FeatureVisibilityProps) {
  return (
    <section aria-label="Feature visibility">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-headline text-base font-bold text-foreground">Feature visibility</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground/80">
        Choose who can see each advanced feature. Operators-only and role greenlists are
        API-enforced — end users are refused server-side, not just hidden. Every change is
        recorded with your name.
      </p>

      <div className="space-y-2.5">
        {FEATURES.map((def) => (
          <FeatureCard
            key={def.key}
            def={def}
            audience={visibility[def.key] ?? "operators"}
            roles={greenlist?.[def.key] ?? []}
            onSetVisibility={onSetVisibility}
            showTechnical={showTechnical}
          />
        ))}
      </div>
    </section>
  )
}

/** One 069-A feature card. Owns only its transient write state (busy/error) + the ✎
 *  receipt; the audience value itself is the shell's source of truth (no optimistic flip). */
function FeatureCard({
  def,
  audience,
  roles,
  onSetVisibility,
  showTechnical,
}: {
  def: FeatureDef
  audience: AudienceValue
  roles: string[]
  onSetVisibility: (
    feature: GovernedFeature,
    audience: AudienceValue,
    roles?: string[],
  ) => Promise<void>
  showTechnical: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

  const opOnly = audience === "operators"
  const isRole = audience === "role"
  const Glyph = def.glyph

  // The ONE write path (save-on-select): persist the audience (+ roles[] for the role
  // greenlist), stamp a ✎ receipt, and re-throw-as-failed on error. The shell owns the
  // source-of-truth map — this leaf never optimistically flips.
  async function write(next: AudienceValue, nextRoles: string[]) {
    setBusy(true)
    setFailed(false)
    try {
      await onSetVisibility(def.key, next, nextRoles)
      setReceipt(
        next === "operators"
          ? "Set to Operators only · recorded"
          : next === "role"
            ? "Set to selected roles · recorded"
            : "Set to Everyone · recorded",
      )
      window.setTimeout(() => setReceipt(null), 4000)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  async function flipTo(next: AudienceValue) {
    if (busy || next === audience) return
    // Switching TO role carries the currently-greenlisted roles (may be empty → the
    // resolver denies until at least one is picked — surfaced by the hint below).
    await write(next, next === "role" ? roles : [])
  }

  async function toggleRole(role: GreenlistRole) {
    if (busy) return
    const nextRoles = roles.includes(role)
      ? roles.filter((r) => r !== role)
      : [...roles, role]
    await write("role", nextRoles)
  }

  return (
    <div
      data-feature={def.key}
      data-audience={audience}
      className={cn(
        "rounded-[10px] border px-3.5 py-3 transition-colors",
        // Amber-warmed when Operators-only — NEVER kill-switch red. Role greenlists read
        // org-indigo (a targeted grant, not a lock-down); Everyone stays calm/neutral.
        opOnly
          ? "border-amber-500/30 bg-amber-500/[0.05]"
          : isRole
            ? "border-primary/30 bg-primary/[0.05]"
            : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 flex-none items-center justify-center rounded-lg",
              opOnly
                ? "bg-amber-500/15 text-amber-400"
                : isRole
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <Glyph className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{def.name}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {def.desc} · lives on {def.livesOn}
            </div>
          </div>
        </div>

        <div className="flex flex-none flex-col items-end gap-1">
          {receipt && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground"
              role="status"
            >
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />✎ {receipt}
            </span>
          )}
          <AudienceSegments audience={audience} busy={busy} onFlip={flipTo} />
        </div>
      </div>

      {/* Role greenlist chip picker — shown only for the `role` audience (minimal; rich
          group management deferred). Toggling a chip writes the updated roles[] through the
          SAME server-validated seam. An empty greenlist denies everyone but operators. */}
      {isRole && (
        <div className="mt-2.5">
          <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Visible to these roles
            {roles.length === 0 && (
              <span className="ml-1 text-amber-400">— pick at least one</span>
            )}
          </div>
          <div role="group" aria-label="Greenlisted roles" className="flex flex-wrap gap-1.5">
            {GREENLIST_ROLES.map(({ key, label }) => {
              const on = roles.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => void toggleRole(key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    on
                      ? "bg-primary/15 text-primary ghost-border"
                      : "border border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {on && <Check className="h-3 w-3" aria-hidden="true" />}
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Consequence line — the API-enforced beat, shown for Operators-only OR a role greenlist. */}
      {opOnly && (
        <div className="mt-2 text-[11px] font-medium leading-snug text-amber-400">
          End users no longer see {def.name} — and their API calls to it are refused server-side,
          not just hidden.
        </div>
      )}
      {isRole && (
        <div className="mt-2 text-[11px] font-medium leading-snug text-primary">
          Only the selected role{roles.length === 1 ? "" : "s"} see {def.name} — everyone else is
          refused server-side, not just hidden.
        </div>
      )}

      {failed && (
        <div className="mt-1.5 text-[11px] text-destructive" role="status">
          Couldn&rsquo;t update visibility — try again.
        </div>
      )}

      {/* Expandable enforcement grid — "what exactly this controls". */}
      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          <span className="underline decoration-dotted underline-offset-2">
            What exactly this controls
          </span>
        </summary>
        <dl className="mt-2 space-y-1.5 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px]">
          <div className="flex gap-2">
            <dt className="w-28 flex-none font-medium text-muted-foreground">UI surface</dt>
            <dd className="text-foreground/90">{def.uiSurface}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 flex-none font-medium text-muted-foreground">Refused API</dt>
            <dd className="text-foreground/90">{def.refusedApi}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 flex-none font-medium text-muted-foreground">Who can see it</dt>
            <dd className="text-foreground/90">
              {opOnly
                ? "Operators only."
                : isRole
                  ? `Roles: ${roles.join(", ") || "none selected"}.`
                  : "Everyone (all signed-in users)."}
            </dd>
          </div>
          {showTechnical && (
            <div className="flex gap-2">
              <dt className="w-28 flex-none font-medium text-muted-foreground">Routes</dt>
              <dd className="font-mono text-muted-foreground">{def.routePrefixes}</dd>
            </div>
          )}
        </dl>
      </details>
    </div>
  )
}

/** The audience segmented control — Everyone | ⛨ Operators only | 👥 By role. Reads +
 *  writes an ENUM (never a boolean); the SEED-115 forward-compat contract is what let the
 *  `role` greenlist drop in as a third position (Phase 167 / VIS-01). */
function AudienceSegments({
  audience,
  busy,
  onFlip,
}: {
  audience: AudienceValue
  busy: boolean
  onFlip: (next: AudienceValue) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Audience"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
    >
      <SegButton
        selected={audience === "everyone"}
        busy={busy}
        tone="everyone"
        onClick={() => onFlip("everyone")}
      >
        Everyone
      </SegButton>
      <SegButton
        selected={audience === "operators"}
        busy={busy}
        tone="operators"
        onClick={() => onFlip("operators")}
      >
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Operators only
      </SegButton>
      <SegButton
        selected={audience === "role"}
        busy={busy}
        tone="role"
        onClick={() => onFlip("role")}
      >
        <Users className="h-3 w-3" aria-hidden="true" />
        By role
      </SegButton>
    </div>
  )
}

/** One segment. Selected "everyone" reads success-tone; selected "operators" reads
 *  amber — NEVER kill-switch red; selected "role" reads org-indigo. Unselected is
 *  calm/muted. */
function SegButton({
  children,
  selected,
  busy,
  tone,
  onClick,
}: {
  children: ReactNode
  selected: boolean
  busy: boolean
  tone: "everyone" | "operators" | "role"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={busy}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        !selected && "text-muted-foreground hover:text-foreground",
        selected && tone === "everyone" && "bg-success/15 text-success",
        selected && tone === "operators" && "bg-amber-500/15 text-amber-400",
        selected && tone === "role" && "bg-primary/15 text-primary",
      )}
    >
      {children}
    </button>
  )
}
