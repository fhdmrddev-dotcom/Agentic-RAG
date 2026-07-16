/**
 * Phase 156 (POLISH-01) — ChatHistoryColumn contract (SC#2 inline + SC#3 + D-09).
 *
 * Wave-0 `it.todo` scaffold (Nyquist target). Waves 1-2 replace each todo with a
 * live render test once the column exists (the lifted NavPanel.renderThreadList
 * wrapped with the inline filter + date grouping). The todos enumerate the inline
 * search behaviors (SC#2), the date grouping (SC#3), and every preserved row
 * behavior the MOVE-not-rewrite must keep intact (D-09).
 *
 * Deliberately imports NOTHING from ../ChatHistoryColumn — the component does not
 * exist yet; `it.todo` takes only a string, so this file collects GREEN (pending).
 */
import { describe, it } from "vitest"

describe("ChatHistoryColumn — date grouping (SC#3)", () => {
  it.todo("renders threads grouped by date with a group header per bucket")
  it.todo("shows the per-group count in each group header")
})

describe("ChatHistoryColumn — inline filter (SC#2)", () => {
  it.todo('typing in the "Filter this list…" input narrows rows to title-substring matches')
  it.todo("wraps the matched substring in a <mark> (safe JSX highlight, no innerHTML)")
  it.todo("folds away groups whose rows no longer match")
  it.todo('shows the honest empty-state "No chats match your search." when nothing matches')
})

describe("ChatHistoryColumn — preserved row behaviors (D-09)", () => {
  it.todo('renders a folder chip (or "Unfiled") per row')
  it.todo("the per-row options menu opens Rename + Delete")
  it.todo('Delete opens the "Delete thread?" confirm dialog')
  it.todo("the SEED-064 running dot + Stop button appear for a streaming thread")
  it.todo("inline rename commits on Enter and cancels on Escape")
  it.todo("clicking a row calls onSelectThread for that thread")
})

// Wave 1/2 replaces each it.todo with a live render test importing the component.
