/**
 * Phase 217.1-14 — the unreachable-view fallback.
 *
 * Three falsifiable properties:
 * 1. Renders something (no empty fragment).
 * 2. Names the offending `activeView` value.
 * 3. Unreachable in a correct build via the caller's `satisfies never`
 *    compile-time assertion (TS2322 if a member of ActiveView lacks a branch).
 *
 * A runtime arm catches a mis-route from a stale persisted value; the type arm
 * catches a developer error at `tsc`.
 */

export function UnknownViewFallback({ view }: { view: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <p className="text-muted-foreground text-sm">
        This view has no screen: <code className="text-foreground font-mono text-xs">{view}</code>
      </p>
    </div>
  )
}