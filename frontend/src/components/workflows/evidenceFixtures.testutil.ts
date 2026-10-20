/**
 * Phase 289-04 — evidence payload fixtures, shared by `evidenceView.test.ts` and
 * `RunEvidenceReport.test.tsx` (test-only; the `stripComments.testutil.ts` precedent).
 *
 * Built against the `RunEvidence` contract in `289-03-PLAN.md` <interfaces>, field for field.
 * The scenario is sketch 289-run-evidence-page variant B's: a vendor-risk review with a KB
 * step, a person-answered step and a file deliverable.
 */
import type { RunEvidence } from "@/lib/api/runEvidence"

export const RUN_ID = "4f1c9a2e-1111-4222-8333-444455556666"
export const OWNER_EMAIL = "dana.whitfield@northwind.example"

export function ownerPayload(): RunEvidence {
  return {
    run: {
      id: RUN_ID,
      status: "completed",
      workflow_name: "Vendor-risk portfolio review",
      started_at: "2026-10-19T09:12:03Z",
      completed_at: "2026-10-19T09:16:01Z",
      started_by: { name: "Dana Whitfield", email: OWNER_EMAIL, is_you: true },
      org_name: "Northwind Procurement",
      model: "gpt-5.6-sol",
      viewer_is_owner: true,
      thread_id: "thread-9",
    },
    definition: {
      recorded: true,
      version: 7,
      phases: [
        { n: 1, slug: "load_vendors", name: "Load the vendor list", phase_type: "programmatic" },
        { n: 2, slug: "research", name: "Research each vendor's breach history", phase_type: "llm_agent" },
        { n: 3, slug: "confirm", name: "Confirm escalations", phase_type: "llm_human_input" },
        { n: 4, slug: "emit", name: "Save the brief", phase_type: "llm_emit" },
      ],
      full: { slug: "vendor-risk", version: 7, phases: [{ slug: "load_vendors" }, { slug: "research" }] },
    },
    definition_changed: { changed: false, current_version: 7 },
    kb_label: "Procurement KB",
    deliverable: { kind: "file", name: "committee_brief.docx", file_id: "file-1" },
    phase_log: [
      {
        n: 1,
        slug: "load_vendors",
        name: "Load the vendor list",
        phase_type: "programmatic",
        status: "completed",
        started_at: "2026-10-19T09:12:03Z",
        completed_at: "2026-10-19T09:12:07Z",
        step_count: null,
        step_noun: null,
        output_text: "14 vendors read from vendor_list.xlsx",
        failure_reason: null,
        confidence: null,
        human_input: null,
      },
      {
        n: 2,
        slug: "research",
        name: "Research each vendor's breach history",
        phase_type: "llm_agent",
        status: "completed",
        started_at: "2026-10-19T09:12:07Z",
        completed_at: "2026-10-19T09:13:09Z",
        step_count: 9,
        step_noun: "sources",
        output_text: "Findings for 14 vendors",
        failure_reason: null,
        confidence: {
          level: "medium",
          avg_similarity: 0.47,
          disclaimer: null,
          passages: 9,
          kb_label: "Procurement KB",
        },
        human_input: null,
      },
      {
        n: 3,
        slug: "confirm",
        name: "Confirm escalations",
        phase_type: "llm_human_input",
        status: "completed",
        started_at: "2026-10-19T09:13:09Z",
        completed_at: "2026-10-19T09:15:19Z",
        step_count: null,
        step_noun: null,
        output_text: "Helix Cloud and Orbit Data both breach the 90-day threshold. Escalate both?",
        failure_reason: null,
        confidence: null,
        human_input: {
          answered: true,
          question: "Helix Cloud and Orbit Data both breach the 90-day threshold. Escalate both?",
          answer: "Escalate both",
          answered_by: "Dana Whitfield",
        },
      },
      {
        n: 4,
        slug: "emit",
        name: "Save the brief",
        phase_type: "llm_emit",
        status: "completed",
        started_at: "2026-10-19T09:15:19Z",
        completed_at: "2026-10-19T09:16:01Z",
        step_count: null,
        step_noun: null,
        output_text: "committee_brief.docx saved to Files",
        failure_reason: null,
        confidence: null,
        human_input: null,
      },
    ],
    verdicts: [
      {
        step_n: 4,
        phase_slug: "emit",
        kind: "emit_validated",
        result: "passed",
        checked: ["citations_present"],
        at: "2026-10-19T09:16:00Z",
      },
      {
        step_n: 2,
        phase_slug: "research",
        kind: "gate_failed",
        result: "failed",
        checked: ["min_sources"],
        at: "2026-10-19T09:13:08Z",
      },
      { step_n: null, phase_slug: null, kind: "policy_applied", result: "recorded", checked: [], at: null },
    ],
    sources: [
      {
        masked: false,
        document_id: "doc-1",
        filename: "SOC-2 Report — Helix Cloud (2026).pdf",
        locations: [2, 7],
        cited_by: [2, 4],
      },
      {
        masked: false,
        document_id: "doc-2",
        filename: "Procurement Policy v4.docx",
        locations: [0],
        cited_by: [2],
      },
    ],
  }
}

/** The same run read by a same-org colleague: the server already withheld the owner-only
 *  fields (plan 03), and one cited document is outside the colleague's reach (R-01). */
export function colleaguePayload(): RunEvidence {
  const p = ownerPayload()
  p.run.started_by = { name: "Dana Whitfield", email: null, is_you: false }
  p.run.viewer_is_owner = false
  p.run.thread_id = null
  p.deliverable = { kind: "file", name: "committee_brief.docx", file_id: null }
  p.phase_log[2] = {
    ...p.phase_log[2],
    output_text: null,
    human_input: { answered: true, question: null, answer: null, answered_by: null },
  }
  p.sources[1] = { masked: true, document_id: null, filename: null, locations: [], cited_by: [4] }
  return p
}

export function changedPayload(): RunEvidence {
  const p = ownerPayload()
  p.definition_changed = { changed: true, current_version: 9 }
  return p
}

export function predatesPayload(): RunEvidence {
  const p = ownerPayload()
  p.definition = { ...p.definition, recorded: false, version: 3 }
  return p
}

export function failedPayload(): RunEvidence {
  const p = ownerPayload()
  p.run.status = "failed"
  p.run.completed_at = "2026-10-19T09:13:09Z"
  p.deliverable = { kind: "none", name: null, file_id: null }
  p.phase_log[1] = {
    ...p.phase_log[1],
    status: "failed",
    confidence: null,
    step_count: null,
    step_noun: null,
    output_text: null,
    failure_reason: "The knowledge base did not answer in time.",
  }
  p.phase_log[2] = {
    ...p.phase_log[2],
    status: "pending",
    started_at: null,
    completed_at: null,
    output_text: null,
    human_input: { answered: false, question: null, answer: null, answered_by: null },
  }
  p.phase_log[3] = { ...p.phase_log[3], status: "skipped", started_at: null, completed_at: null, output_text: null }
  p.verdicts = []
  p.sources = []
  return p
}
