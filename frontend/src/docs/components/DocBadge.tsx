// Phase 276-03 (D-04, UI-SPEC §Honesty badges) — the ONE honesty badge. The WORDS carry the
// meaning; colour only reinforces it (never colour alone).
import type { Audience } from "../types"

export type BadgeKind = "unreleased" | "coming" | "internal" | "updated" | "audience"

const AUDIENCE_TEXT: Record<Exclude<Audience, "user">, string> = {
  admin: "For admins",
  operator: "For operators",
  developer: "For developers",
}

export function badgeText(kind: BadgeKind, opts: { version?: string | null; audience?: Audience } = {}): string | null {
  switch (kind) {
    case "unreleased":
      return "Not yet released"
    case "coming":
      return "Full guide coming"
    case "internal":
      return "UI-internal: may change"
    case "updated":
      return opts.version ? `Updated in ${opts.version}` : null
    case "audience":
      return opts.audience && opts.audience !== "user" ? AUDIENCE_TEXT[opts.audience] : null
  }
}

export function DocBadge({ kind, version, audience }: { kind: BadgeKind; version?: string | null; audience?: Audience }) {
  const text = badgeText(kind, { version, audience })
  if (!text) return null
  return <span className={`d-badge d-badge-${kind}`}>{text}</span>
}
