/**
 * Phase 297 plan 03 (LINK-07 / D-21, D-30, D-32, D-42) — the leave-guard registry.
 *
 * ONE app-level `useBlocker` lives in `hooks/useAppNavigation.ts` and asks this registry whether
 * the person may leave the address on screen. An editor with unsaved work registers a predicate
 * here (`useLeaveGuard`) and answers at leave time. The Workflow Builder is the only tenant today
 * (D-30): `WorkflowsPage` forwards the Builder's own predicate, which itself shows
 * `window.confirm(UNSAVED_LEAVE_PROMPT)` (wiring A, D-31) — so `canLeaveAll()` returning `false`
 * means "the person pressed Cancel".
 *
 * ⚠ THE DEFAULT CONTEXT VALUE IS A NO-OP REGISTRY, not `null`. Outside a provider a tenant
 * registers into nothing and every leave is allowed, so pages and their suites need no provider
 * and no router (D-08). The `fieldGuidanceContext.ts` idiom: the absence of a provider has a
 * correct answer, so the hook never throws.
 *
 * ⚠ THE LATCH IS ONE-SHOT (D-32, D-42). An in-page caller that has already asked (the connect
 * control, the golden-run link), Test Run, and the forced 403 bounce set it immediately before a
 * navigation that changes the pathname. The blocker's first evaluation consumes it; the hook also
 * clears it on every committed location change, and Test Run clears it in a `finally`, so a latch
 * can never sit armed and silently skip a later prompt.
 *
 * This module declares no component (a `.ts` file), so react-refresh's only-export-components
 * rule holds; App uses `LeaveGuardContext.Provider` directly. It imports only from `react`.
 */
import { createContext, useContext, useEffect } from "react"

export interface LeaveGuardRegistry {
  /** Add a tenant's predicate; returns its own unregister. */
  register(predicate: () => boolean): () => void
  /** Is any tenant registered? */
  hasTenants(): boolean
  /** May the person leave? A set latch is consumed and answers `true` without asking anyone;
   *  otherwise every predicate is asked in order, stopping at the first `false`. */
  canLeaveAll(): boolean
  /** Arm the one-shot latch: the next evaluation allows the leave without asking. */
  approveNextLeave(): void
  /** Disarm the latch. */
  clearLeaveApproval(): void
}

export function createLeaveGuardRegistry(): LeaveGuardRegistry {
  // Entries, not the predicates themselves: the same function registered twice is two tenants,
  // and each unregister removes only its own.
  const tenants = new Set<{ predicate: () => boolean }>()
  let approved = false
  return {
    register(predicate) {
      const entry = { predicate }
      tenants.add(entry)
      return () => {
        tenants.delete(entry)
      }
    },
    hasTenants: () => tenants.size > 0,
    canLeaveAll() {
      if (approved) {
        approved = false
        return true
      }
      for (const entry of tenants) {
        if (!entry.predicate()) return false
      }
      return true
    },
    approveNextLeave() {
      approved = true
    },
    clearLeaveApproval() {
      approved = false
    },
  }
}

const NO_OP_REGISTRY: LeaveGuardRegistry = Object.freeze({
  register: () => () => {},
  hasTenants: () => false,
  canLeaveAll: () => true,
  approveNextLeave: () => {},
  clearLeaveApproval: () => {},
})

export const LeaveGuardContext = createContext<LeaveGuardRegistry>(NO_OP_REGISTRY)

/** The registry in scope — the no-op default outside a provider. Never throws. */
export function useLeaveGuardRegistry(): LeaveGuardRegistry {
  return useContext(LeaveGuardContext)
}

/**
 * Register `predicate` as a leave-guard tenant while the caller is mounted. The predicate is
 * read at leave time, so it may close over refs; pass a stable function (or accept a
 * re-register when it changes — the registry is a Set, so that is cheap and order-only).
 */
export function useLeaveGuard(predicate: () => boolean): void {
  const registry = useLeaveGuardRegistry()
  useEffect(() => registry.register(predicate), [registry, predicate])
}
