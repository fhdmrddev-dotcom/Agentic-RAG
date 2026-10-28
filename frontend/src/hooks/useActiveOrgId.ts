/**
 * Phase 298 (D-08 / D-09) — the one active-org key every list hook reads.
 *
 * Returns the provider's `activeOrgId`, or `null` outside an `OrgProvider` (tests, storybook,
 * leaf mounts) — the non-throwing `useOrgOptional` read, never the throwing `useOrg`.
 *
 * ⚠ THIS IS THE RE-FETCH KEY, NOT THE ANSWER'S TAG. A list hook keys its effect on this value so
 * an org switch re-asks, but it tags each answer with `getActiveOrgId()` read at SEND time — the
 * header the request actually carried. Tagging with this React state instead would paint a slow
 * old-org answer under the new org's name (RESEARCH Pitfall 6a). `OrgProvider` syncs the header
 * before every state flip (switchOrg D-166-08, the WR-01 self-heal D-36), so the two agree by the
 * time a child effect runs.
 */
import { useOrgOptional } from "@/providers/OrgProvider"

export function useActiveOrgId(): string | null {
  return useOrgOptional()?.activeOrgId ?? null
}
