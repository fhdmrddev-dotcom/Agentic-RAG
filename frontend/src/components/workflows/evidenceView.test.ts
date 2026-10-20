/**
 * Phase 289-04 Task 1 (D-03 / D-04 / R-01..R-04) — the ONE view-model behind the evidence
 * report. Every string the report shows is decided here, and the report test checks the DOM
 * against `sectionStrings` of this same view, so these exact-string pins are what the page
 * and its export are measured against.
 */
import { describe, expect, it } from "vitest"
import { exportPayload, sectionStrings, toEvidenceView } from "./evidenceView"
import {
  OWNER_EMAIL,
  changedPayload,
  colleaguePayload,
  failedPayload,
  ownerPayload,
  predatesPayload,
} from "./evidenceFixtures.testutil"

describe("toEvidenceView: the facts strip", () => {
  it("reads Result, Version run, Checks and Deliverable for a completed owner run", () => {
    const v = toEvidenceView(ownerPayload())
    expect(v.facts.map((f) => [f.label, f.value])).toEqual([
      ["Result", "✓ Completed"],
      ["Version run", "v7"],
      ["Checks", "1 of 2 passed"],
      ["Deliverable", "◆ committee_brief.docx"],
    ])
  })

  it("words a failed run, a run with no checks and no deliverable", () => {
    const v = toEvidenceView(failedPayload())
    expect(v.facts.map((f) => f.value)).toEqual(["✕ Failed", "v7", "No checks ran", "None"])
  })

  it("words a cancelled run and a written-answer deliverable", () => {
    const p = ownerPayload()
    p.run.status = "cancelled"
    p.deliverable = { kind: "text", name: null, file_id: null }
    const v = toEvidenceView(p)
    expect(v.facts[0].value).toBe("Cancelled")
    expect(v.facts[3].value).toBe("Written answer")
  })

  it("says the version was not recorded when the snapshot carries none", () => {
    const p = predatesPayload()
    p.definition.version = null
    expect(toEvidenceView(p).facts[1].value).toBe("Not recorded")
  })

  it("289-REVIEW WR-03: counts a step's final attempt, not every retry, as its check", () => {
    // A step whose gate failed on attempt 0 and passed on attempt 1 ended passing.
    const p = ownerPayload()
    p.verdicts = [
      { step_n: 2, phase_slug: "research", kind: "gate_failed", result: "failed",
        checked: ["min_sources"], at: "2026-10-19T09:10:00Z" },
      { step_n: 2, phase_slug: "research", kind: "gate_passed", result: "passed",
        checked: ["min_sources"], at: "2026-10-19T09:11:00Z" },
    ]
    const fact = toEvidenceView(p).facts[2]
    expect(fact.value).toBe("1 of 1 passed")
    expect(fact.tone).toBe("success")
    // section 3 still records every attempt
    expect(toEvidenceView(p).verdicts).toHaveLength(2)
  })

  it("289-REVIEW WR-03: a step that timed out before its checks ran says so, and is not a check", () => {
    const p = ownerPayload()
    p.verdicts = [
      { step_n: 2, phase_slug: "research", kind: "gate_timed_out", result: "recorded",
        checked: [], at: "2026-10-19T09:10:00Z" },
    ]
    const v = toEvidenceView(p)
    expect(v.verdicts[0].sentence).toBe("The step timed out before its checks ran")
    expect(v.facts[2].value).toBe("No checks ran")
  })

  it("counts only passed and failed verdicts as checks (recorded decisions are not checks)", () => {
    const p = ownerPayload()
    p.verdicts = [p.verdicts[2]]
    expect(toEvidenceView(p).facts[2].value).toBe("No checks ran")
  })
})

describe("toEvidenceView: the version banners (D-04)", () => {
  it("names both versions when the workflow changed since the run", () => {
    const v = toEvidenceView(changedPayload())
    expect(v.changedBanner).toEqual({
      head: "This workflow has changed since this run.",
      body: "The page shows version 7, exactly as it ran. The current version is 9.",
    })
    expect(v.predatesBanner).toBeNull()
  })

  it("shows no changed banner when the definition is unchanged", () => {
    expect(toEvidenceView(ownerPayload()).changedBanner).toBeNull()
  })

  it("says a run with no recorded snapshot predates version recording", () => {
    const v = toEvidenceView(predatesPayload())
    expect(v.predatesBanner).toBe(
      "This run predates version recording, so the definition below is the workflow as it is stored now, not a copy taken when it ran.",
    )
  })
})

describe("toEvidenceView: the title block and owner-only fields (D-05)", () => {
  it("gives the owner the (you) mark, the email and both owner links", () => {
    const v = toEvidenceView(ownerPayload())
    expect(v.title).toBe("Vendor-risk portfolio review")
    expect(v.outcome).toBe("Completed in 3m 58s")
    expect(v.startedBy).toMatch(/^started .+ by Dana Whitfield \(you\)$/)
    expect(v.email).toBe(OWNER_EMAIL)
    expect(v.org).toBe("Northwind Procurement")
    expect(v.ownerLinks).toEqual({
      threadId: "thread-9",
      deliverable: { fileId: "file-1", name: "committee_brief.docx" },
    })
  })

  it("gives a colleague the display name only: no (you), no email, no owner link", () => {
    const v = toEvidenceView(colleaguePayload())
    expect(v.startedBy).toMatch(/ by Dana Whitfield$/)
    expect(v.startedBy).not.toContain("(you)")
    expect(v.email).toBeNull()
    expect(v.ownerLinks).toBeNull()
    expect(JSON.stringify(sectionStrings(v))).not.toContain(OWNER_EMAIL)
  })

  it("never shows the email or links when the payload says the viewer is not the owner, even if a field leaked", () => {
    const p = colleaguePayload()
    p.run.started_by.email = OWNER_EMAIL
    p.run.thread_id = "thread-9"
    const v = toEvidenceView(p)
    expect(v.email).toBeNull()
    expect(v.ownerLinks).toBeNull()
  })

  it("words a failed run's outcome with its span", () => {
    expect(toEvidenceView(failedPayload()).outcome).toBe("Failed after 1m 06s")
  })
})

describe("toEvidenceView: section 1, what it ran", () => {
  it("lists the version, the steps in order and the full definition", () => {
    const v = toEvidenceView(ownerPayload())
    expect(v.definition.heading).toBe("Version 7 · 4 steps")
    expect(v.definition.steps).toEqual([
      { title: "Load the vendor list", type: "Server step" },
      { title: "Research each vendor's breach history", type: "AI agent step" },
      { title: "Confirm escalations", type: "Needs you" },
      { title: "Save the brief", type: "Deliverable" },
    ])
    expect(v.definition.fullJson).toBe(JSON.stringify(ownerPayload().definition.full, null, 2))
  })

  it("says so when the full definition was not recorded", () => {
    const p = ownerPayload()
    p.definition.full = null
    expect(toEvidenceView(p).definition.fullJson).toBeNull()
  })
})

describe("toEvidenceView: section 2, step by step", () => {
  it("carries title, type line, output, count, status and time, and passes confidence through untouched", () => {
    const p = ownerPayload()
    const v = toEvidenceView(p)
    expect(v.steps).toHaveLength(4)
    const kb = v.steps[1]
    expect(kb.n).toBe(2)
    expect(kb.title).toBe("Research each vendor's breach history")
    expect(kb.typeLine).toBe("AI agent step · research")
    expect(kb.output).toBe("Findings for 14 vendors")
    expect(kb.count).toBe("9 sources")
    expect(kb.statusWord).toBe("✓ Done")
    expect(kb.time).toBe("1m 02s")
    // Untouched: the SAME wire object the StepEvidenceLine leaf renders on the live spine.
    expect(kb.confidence).toBe(p.phase_log[1].confidence)
    expect(v.steps[0].confidence).toBeNull()
  })

  it("shows the owner the question, the quoted answer and who answered", () => {
    const row = toEvidenceView(ownerPayload()).steps[2]
    expect(row.output).toBeNull()
    expect(row.humanInput).toEqual([
      "Helix Cloud and Orbit Data both breach the 90-day threshold. Escalate both?",
      "“Escalate both”",
      "— Dana Whitfield",
    ])
  })

  it("R-04: a colleague sees only that the step waited and whether it was answered", () => {
    const row = toEvidenceView(colleaguePayload()).steps[2]
    expect(row.humanInput).toEqual(["Waited for an answer · answered"])
    expect(row.output).toBeNull()
    const p = colleaguePayload()
    p.phase_log[2].human_input = { answered: false, question: null, answer: null, answered_by: null }
    expect(toEvidenceView(p).steps[2].humanInput).toEqual(["Waited for an answer · not answered"])
  })

  it("words a failed step's reason and the steps the run never reached", () => {
    const v = toEvidenceView(failedPayload())
    expect(v.steps[1].statusWord).toBe("✕ Failed")
    expect(v.steps[1].failure).toBe("Why it stopped: The knowledge base did not answer in time.")
    expect(v.steps[1].time).toBe("stopped after 1m 02s")
    expect(v.steps[2].statusWord).toBe("Not reached")
    expect(v.steps[2].humanInput).toEqual(["Not answered"])
    expect(v.steps[2].time).toBe("")
    expect(v.steps[3].statusWord).toBe("Skipped")
  })
})

describe("toEvidenceView: section 3, checks and verdicts", () => {
  it("gives one row per verdict with a sentence, the step and the checked kinds", () => {
    const v = toEvidenceView(ownerPayload())
    expect(v.verdicts).toEqual([
      {
        result: "passed",
        sentence: "The deliverable matched its required shape",
        meta: "Check · step 4 · checked: citations_present",
        resultWord: "Passed",
      },
      {
        result: "failed",
        sentence: "The step's checks did not pass",
        meta: "Check · step 2 · checked: min_sources",
        resultWord: "Failed",
      },
      {
        result: "recorded",
        sentence: "A governance policy was applied",
        meta: "Recorded decision",
        resultWord: "Recorded",
      },
    ])
    expect(v.noVerdicts).toBeNull()
  })

  it("says no checks were recorded when there are none", () => {
    const v = toEvidenceView(failedPayload())
    expect(v.verdicts).toEqual([])
    expect(v.noVerdicts).toBe("No checks were recorded for this run.")
  })

  it("words an unknown kind without inventing a result", () => {
    const p = ownerPayload()
    p.verdicts = [{ step_n: 1, phase_slug: "load_vendors", kind: "constructor", result: "passed", checked: [], at: null }]
    expect(toEvidenceView(p).verdicts[0].sentence).toBe("A check was recorded")
  })
})

describe("toEvidenceView: section 4, sources", () => {
  it("names each document with its passages and the steps that cited it", () => {
    const v = toEvidenceView(ownerPayload())
    expect(v.sources).toEqual([
      {
        masked: false,
        title: "SOC-2 Report — Helix Cloud (2026).pdf",
        where: "passage 3, passage 8",
        citedBy: "cited by step 2, step 4",
      },
      { masked: false, title: "Procurement Policy v4.docx", where: "passage 1", citedBy: "cited by step 2" },
    ])
  })

  it("R-01: a masked source reads as a document you cannot see, with only its cited-by", () => {
    const v = toEvidenceView(colleaguePayload())
    expect(v.sources[1]).toEqual({
      masked: true,
      title: "A document you don't have access to",
      where: null,
      citedBy: "cited by step 4",
    })
  })

  it("says no documents were cited when there are none", () => {
    expect(toEvidenceView(failedPayload()).noSources).toBe("No documents were cited in this run.")
  })
})

describe("sectionStrings and exportPayload (D-03)", () => {
  it("returns, per section, every string the DOM must contain", () => {
    const v = toEvidenceView(ownerPayload())
    const s = sectionStrings(v)
    expect(s[1]).toEqual(
      expect.arrayContaining(["Version 7 · 4 steps", "Load the vendor list", "Server step", v.definition.fullJson]),
    )
    expect(s[2]).toEqual(
      expect.arrayContaining(["AI agent step · research", "9 sources", "“Escalate both”", "✓ Done", "1m 02s"]),
    )
    expect(s[3]).toEqual(
      expect.arrayContaining(["The deliverable matched its required shape", "Check · step 4 · checked: citations_present"]),
    )
    expect(s[4]).toEqual(expect.arrayContaining(["passage 3, passage 8", "cited by step 2, step 4"]))
    for (const n of [1, 2, 3, 4] as const) {
      for (const str of s[n]) expect(str.length).toBeGreaterThan(0)
    }
  })

  it("carries the empty-section sentences when a section has no rows", () => {
    const s = sectionStrings(toEvidenceView(failedPayload()))
    expect(s[3]).toEqual(["No checks were recorded for this run."])
    expect(s[4]).toEqual(["No documents were cited in this run."])
  })

  it("exports the fetched payload itself, never a reshaped copy", () => {
    const p = ownerPayload()
    expect(exportPayload(p)).toBe(p)
  })

  it("passes a hostile string through as data", () => {
    const p = ownerPayload()
    const hostile = '<img src=x onerror="alert(1)">'
    p.run.workflow_name = hostile
    p.sources[0].filename = hostile
    p.phase_log[0].output_text = hostile
    const v = toEvidenceView(p)
    expect(v.title).toBe(hostile)
    expect(v.sources[0].title).toBe(hostile)
    expect(v.steps[0].output).toBe(hostile)
  })

  it("falls back to words when the workflow name is missing", () => {
    const p = ownerPayload()
    p.run.workflow_name = null
    expect(toEvidenceView(p).title).toBe("Untitled workflow")
  })
})
