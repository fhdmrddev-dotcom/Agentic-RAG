/**
 * Phase 293-03 (START-04 / D-22, D-23) — how a run started, in words. THE ONLY HOME of the six
 * origin sentences (293-UI-SPEC Surface 4): the run page header, the evidence report, the run
 * log row and the chat run line all call `originSentence`, so one run reads one sentence
 * everywhere.
 *
 * A LEAF apart from one type import. The origin is what `create_workflow_run` RECORDED at
 * start; nothing here infers one. An absent origin (every run that was never backfilled) and
 * a kind outside the three both return `null`, and the caller then renders NOTHING: no
 * default kind word, no placeholder, no separator (D-23).
 */
import type { RunOrigin } from "@/types"

function nonblank(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function originSentence(origin: RunOrigin | null | undefined): string | null {
  if (!origin) return null
  const label = nonblank(origin.label)
  switch (origin.kind) {
    case "app": {
      const name = nonblank(origin.actor_name)
      return name ? `Started in the app by ${name}` : "Started in the app"
    }
    case "schedule":
      return label ? `Started by schedule ${label}` : "Started by a schedule"
    case "key":
      return label ? `Started by key ${label}` : "Started by an API key"
    default:
      return null
  }
}
