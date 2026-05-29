/**
 * Phase 087 Plan 04 Task 3 — VersionDiff (PANEL-07, D-04 / sketch 005 winner A).
 *
 * The Versions section body: fetch the file's version list, default-compare the
 * latest two (Compare v{n-1} ↔ v{n}), fetch + parse the unified-diff string
 * client-side (parseUnifiedDiff — no diff lib, Pattern 2), and render the
 * in-column +/− diff via the shared <DiffLines> (fixed 16px sign gutter,
 * scroll-x). Red-base / green-target version pills (text + aria, NOT color-only)
 * let the user pick any two endpoints; a +N/−M summary sits above the diff; the
 * backend's truncated flag is surfaced honestly; the ⤢ button opens
 * <DiffExpandOverlay> with the SAME parsed payload (no second fetch — D4).
 *
 * Data: getWorkspaceFileVersions + getWorkspaceFileDiff (Plan 01 client fns).
 * Stale fetches are aborted on version/file/thread change (T-087-09 — keyed by
 * threadId + AbortController, no cross-thread diff bleed).
 *
 * SECURITY (T-087-08): diff text is rendered as React text children inside
 * <DiffLines> — never dangerouslySetInnerHTML.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getWorkspaceFileVersions, getWorkspaceFileDiff } from "@/lib/api"
import type { WorkspaceFile, WorkspaceVersion, WorkspaceDiff } from "@/types"
import { parseUnifiedDiff } from "@/lib/diffParse"
import { DiffLines } from "./DiffLines"
import { DiffExpandOverlay } from "./DiffExpandOverlay"

export interface VersionDiffProps {
  threadId: string
  file: WorkspaceFile
}

export function VersionDiff({ threadId, file }: VersionDiffProps) {
  const fileId = file.id ?? ""

  const [versions, setVersions] = useState<WorkspaceVersion[]>([])
  // [base(before), target(after)] — base < target by convention (D5).
  const [pair, setPair] = useState<{ from: number; to: number } | null>(null)
  const [diff, setDiff] = useState<WorkspaceDiff | null>(null)
  const [error, setError] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)

  // ── Load the version list; default-select the latest two (Compare v{n-1}↔v{n}). ──
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(false)
    getWorkspaceFileVersions(threadId, fileId, controller.signal)
      .then((vs) => {
        if (!active) return
        setVersions(vs)
        if (vs.length >= 2) {
          // versions arrive DESC; the latest two are vs[0] (target) and vs[1] (base).
          setPair({ from: vs[1].version, to: vs[0].version })
        } else if (vs.length === 1) {
          setPair({ from: vs[0].version, to: vs[0].version })
        } else {
          setPair(null)
        }
      })
      .catch((err: unknown) => {
        if (active && (err as { name?: string })?.name !== "AbortError") {
          setError(true)
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [threadId, fileId])

  // ── Fetch the diff for the selected pair (abort stale fetches — T-087-09). ──
  useEffect(() => {
    if (!pair || pair.from === pair.to) {
      setDiff(null)
      return
    }
    const controller = new AbortController()
    let active = true
    setError(false)
    setDiff(null)
    getWorkspaceFileDiff(threadId, fileId, pair.from, pair.to, controller.signal)
      .then((d) => {
        if (active) setDiff(d)
      })
      .catch((err: unknown) => {
        if (active && (err as { name?: string })?.name !== "AbortError") {
          setError(true)
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [threadId, fileId, pair])

  // Parse ONCE; both the in-column diff and the ⤢ overlay reuse this (no re-parse,
  // no re-fetch — D4).
  const lines = useMemo(
    () => (diff ? parseUnifiedDiff(diff.delta.diff) : []),
    [diff],
  )

  // ── Pill selection: clicking a version sets base/target so base <= target. ──
  const lastClicked = useRef<number | null>(null)
  const pickVersion = (v: number) => {
    if (!pair) {
      setPair({ from: v, to: v })
      lastClicked.current = v
      return
    }
    // Two-click endpoint pick: first click sets base, second sets the other end.
    if (lastClicked.current == null) {
      lastClicked.current = v
      return
    }
    const a = lastClicked.current
    const lo = Math.min(a, v)
    const hi = Math.max(a, v)
    setPair({ from: lo, to: hi })
    lastClicked.current = null
  }

  if (error) {
    return (
      <p className="px-3 py-4 text-[13px] text-muted-foreground">
        Could not load versions.
      </p>
    )
  }

  if (versions.length === 0) {
    return (
      <p className="px-3 py-4 text-[13px] text-muted-foreground">
        No versions yet.
      </p>
    )
  }

  if (versions.length === 1) {
    return (
      <p className="px-3 py-4 text-[13px] text-muted-foreground">
        Only one version — nothing to compare yet.
      </p>
    )
  }

  const label = pair ? `Diff v${pair.from} to v${pair.to}` : "Diff"
  const stats = diff?.delta.stats ?? diff?.stats

  return (
    <div className="flex flex-col">
      {/* Version-pill strip (D5): red base / green target, text + aria. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-3 py-2">
        <span className="mr-0.5 text-[11px] text-muted-foreground">Compare</span>
        {versions.map((v) => {
          const isBase = pair?.from === v.version
          const isTarget = pair?.to === v.version && pair.from !== pair.to
          const roleLabel = isBase
            ? `base version ${v.version}`
            : isTarget
              ? `target version ${v.version}`
              : `version ${v.version}`
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => pickVersion(v.version)}
              aria-label={roleLabel}
              aria-pressed={isBase || isTarget}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                "border-border bg-surface text-muted-foreground hover:bg-accent",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isBase &&
                  "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]",
                isTarget &&
                  "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
              )}
            >
              <span aria-hidden="true">v{v.version}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          aria-label="Expand diff to a wide view"
          disabled={lines.length === 0}
          className="ml-auto inline-flex items-center rounded-md px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* +N / −M summary (D3). */}
      {stats && (
        <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-1.5 font-mono text-[11px]">
          <span className="text-[hsl(var(--success))]">+{stats.additions}</span>
          <span className="text-[hsl(var(--destructive))]">−{stats.deletions}</span>
        </div>
      )}

      {/* In-column unified diff (D3) — shared renderer, same payload as the ⤢ overlay. */}
      {diff ? (
        <div role="region" aria-label={label}>
          <DiffLines lines={lines} truncated={diff.delta.truncated} />
        </div>
      ) : (
        pair &&
        pair.from !== pair.to && (
          <p className="px-3 py-4 text-[13px] text-muted-foreground">
            Loading diff…
          </p>
        )
      )}

      {/* Opt-in wide overlay — SAME parsed lines, no second fetch (D4). */}
      <DiffExpandOverlay
        open={overlayOpen}
        onOpenChange={setOverlayOpen}
        lines={lines}
        truncated={diff?.delta.truncated ?? false}
        label={label}
      />
    </div>
  )
}

export default VersionDiff
