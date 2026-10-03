/**
 * Phase 273-02 (D-12 · T-273-12) — the per-artifact error boundary.
 *
 * ⭐ The FIRST React error boundary in `frontend/src` (273-PATTERNS: a grep for the boundary
 * lifecycle methods found zero). It exists so one artifact that throws while drawing cannot blank
 * the message: its slot becomes the notice and its siblings, and the rest of the answer, render.
 *
 * The fallback reason is `render-failed`, unless the thrown value is an `ArtifactNoticeError`, which
 * names its own catalogue reason (the chart chunk failing to load → `chart-unavailable`). The thrown
 * value's message is never rendered and nothing is logged for people to read; React's own dev log is
 * the only console noise.
 */
import { Component, type ReactNode } from "react"
import { ArtifactNotice } from "./ArtifactNotice"
import { ArtifactNoticeError, type NoticeReason } from "./artifactSpec"

interface Props {
  children: ReactNode
}

interface State {
  reason: NoticeReason | null
}

export class ArtifactErrorBoundary extends Component<Props, State> {
  state: State = { reason: null }

  static getDerivedStateFromError(error: unknown): State {
    return { reason: error instanceof ArtifactNoticeError ? error.reason : "render-failed" }
  }

  render() {
    if (this.state.reason) return <ArtifactNotice reason={this.state.reason} />
    return this.props.children
  }
}
