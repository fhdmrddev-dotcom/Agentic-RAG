/**
 * Phase 235 plan 02 (LIB-10 · D-235-09 / D-235-10 / D-235-11 · V-07 / V-08 / V-09) — the
 * WHOLE-TABLE property suite over `sourceHealthVocabulary.ts`, plus the LIVE binding to the
 * backend classifier it must keep step with.
 *
 * ⭐ THREE THINGS THIS FENCE PROVES, none of which a reading of the file would establish:
 *
 *   V-08  the five binding rules hold over EVERY sentence the surface can print, with the
 *         non-vacuity case asserted FIRST so an emptied table cannot pass vacuously;
 *   V-09  every cause `failure_cause.py` can EMIT has a sentence here — bound to that file's
 *         live source via `?raw`, never to a copy of its table, so a fifth cause added on the
 *         backend reds this suite instead of shipping a source that says nothing;
 *   V-07  the cause to control map is DATA. Proved by reading this leaf's OWN source and
 *         asserting it contains no per-cause branch, not by asserting that it is data.
 *
 * ⚠ THE EM-DASH CHECK IS ASSEMBLED AT RUNTIME (Pitfall 8). A counted literal spelled inside a
 * docblock comment is itself a string the fence would match, so the codepoint is computed and
 * this docblock avoids the character itself.
 *
 * ⚠ RULE 5 IS ABOUT PUNCTUATION DASHES, NOT COMPOUND WORDS. The BUILD-CONTRACT's own
 * `fileFail.password` sentence contains the compound "password-protected", whose hyphen is a
 * hyphen and must stay one. So the rule is asserted over dashes that stand ALONE as
 * punctuation, and an intra-word hyphen is carved out explicitly rather than by loosening the
 * check to nothing. A non-vacuity case pins that at least one real dash was actually examined.
 */
import { describe, it, expect } from "vitest"

import {
  classifySourceFailure,
  sourceFailureSentence,
  CONTROL_FOR_CAUSE,
  COPY,
  SENTENCE_FOR_CAUSE,
  SENTENCE_FOR_FILE_FAILURE,
  UNKNOWN_SOURCE_FAILURE_SENTENCE,
  type SourceFailureCause,
  type SourceFileFailureKind,
} from "./sourceHealthVocabulary"

// ⭐ THE LIVE SOURCE THIS SUITE IS BOUND TO. `failure_cause.py` decides which causes exist;
//    this file decides what each one says. Binding to the module rather than to a copy of its
//    table is what makes a drift impossible to ship. Four `../` from
//    `frontend/src/components/sources/` reaches the repo root.
import failureCausePySource from "../../../../backend/app/services/sources/failure_cause.py?raw"

// ⭐ AND THIS LEAF'S OWN SOURCE, read to prove the map is data (V-07).
import vocabularySource from "./sourceHealthVocabulary.ts?raw"

// ── THE EM DASH, computed (Pitfall 8) ─────────────────────────────────────────────────

const EM_DASH = String.fromCharCode(0x2014)

/** Every dash-like codepoint. A hyphen-minus, the unicode hyphen, the three dashes, the minus. */
const DASH_CLASS = /[-‐‑‒–—―−]/g

/** A neutral sample connection name. ⛔ Deliberately NOT the sketch's "Legal SharePoint". */
const SAMPLE_CONNECTION = "Marketing Drive"

// Every sentence the surface can print, rendered. Explicit rather than reflective: the args
// differ per key, and an explicit list is the one a reviewer can check against the contract.
const renderedCauseSentences = (Object.keys(SENTENCE_FOR_CAUSE) as SourceFailureCause[]).map(
  (c) => SENTENCE_FOR_CAUSE[c](SAMPLE_CONNECTION),
)
const renderedControlLabels = (Object.keys(CONTROL_FOR_CAUSE) as SourceFailureCause[]).map(
  (c) => CONTROL_FOR_CAUSE[c].label(SAMPLE_CONNECTION),
)
const renderedFileSentences = (
  Object.keys(SENTENCE_FOR_FILE_FAILURE) as SourceFileFailureKind[]
).map((k) => SENTENCE_FOR_FILE_FAILURE[k])

const renderedCopy: string[] = [
  COPY.cadence(30),
  COPY.checkedAgo("4 minutes ago", 6),
  COPY.checkedNoChange("4 minutes ago"),
  COPY.asked("60 seconds"),
  COPY.stopped("3 days ago"),
  COPY.lastGood("2 September, 09:14"),
  COPY.neverRead,
  COPY.quietFold(14),
  COPY.showEvery,
  COPY.hideQuiet,
  COPY.degraded,
  COPY.degradedAction,
  COPY.readerOffMember,
  COPY.readerOffRow,
  COPY.badgeTitle(2),
  COPY.popTitle,
  COPY.popOpenHealth,
  COPY.goToSource,
  COPY.attentionTitle,
  COPY.attentionEmpty,
  COPY.roster(12, 2),
  COPY.syncNow,
  COPY.history,
  COPY.hideHistory,
  COPY.collapse,
]

// ⚠ `COPY.readerOffOperator` is DELIBERATELY ABSENT from `renderedCopy`. It is the MARKED
//   operator half of the reader-off statement and names `WATCH_PROCESS_ENABLED`, because for
//   an operator the setting name IS the action (BUILD-CONTRACT §4). It is carved out BY NAME
//   here and given its own assertions below, never by loosening rule 4 for everything else.

const allSentences: string[] = [
  ...renderedCauseSentences,
  ...renderedControlLabels,
  ...renderedFileSentences,
  ...renderedCopy,
]

// ══════════════════════════════════════════════════════════════════════════════════════
// ⚠ NON-VACUITY FIRST — asserted BEFORE anything loops over these tables
// ══════════════════════════════════════════════════════════════════════════════════════

describe("sourceHealthVocabulary — non-vacuity", () => {
  it("the cause table has exactly the four causes", () => {
    const causes = Object.keys(SENTENCE_FOR_CAUSE)
    expect(causes).toHaveLength(4)
    expect(causes).toContain("token_revoked")
    expect(causes).toContain("folder_gone")
    expect(causes).toContain("unreachable")
    expect(causes).toContain("unknown")
  })

  it("the control table covers the same four causes", () => {
    expect(Object.keys(CONTROL_FOR_CAUSE).sort()).toEqual(Object.keys(SENTENCE_FOR_CAUSE).sort())
  })

  it("the file-failure table has its three kinds", () => {
    expect(Object.keys(SENTENCE_FOR_FILE_FAILURE)).toHaveLength(3)
  })

  it("COPY carries every key the sketch's own COPY object carries, less the two hoisted tables", () => {
    // ⚠ MEASURED, and it corrects the plan's "27". The sketch's live `COPY`
    // (`index.html:309-390`) has 28 TOP-LEVEL keys. Two of them (`cause`, `fileFail`) are
    // nested tables, hoisted here to `SENTENCE_FOR_CAUSE` / `CONTROL_FOR_CAUSE` /
    // `SENTENCE_FOR_FILE_FAILURE` so they can be keyed by the union. 28 - 2 = 26.
    expect(Object.keys(COPY)).toHaveLength(26)
  })

  it("every rendered sentence is non-empty", () => {
    expect(allSentences.length).toBeGreaterThan(30)
    for (const s of allSentences) expect(s.trim().length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// V-08 · THE FIVE BINDING RULES, over EVERY sentence the surface can print
// ══════════════════════════════════════════════════════════════════════════════════════

describe("V-08 — the five binding rules hold over the whole table", () => {
  it("rule 2 — NO severity word in any sentence", () => {
    const forbidden = /\b(error|failed|failure|broken|fatal|critical)\b/i
    for (const s of allSentences) expect(s).not.toMatch(forbidden)
  })

  it("rule 3 — NO exclamation in any sentence", () => {
    for (const s of allSentences) expect(s).not.toMatch(/!/)
  })

  it("rule 4 — NO mechanism in any sentence (no status code, no exception class, no env var)", () => {
    const mechanism =
      /\b\d{2}[A-Z0-9]{3}\b|Error|Exception|Traceback|psycopg|postgrest|asyncpg|supabase|httpx|site-packages|<class '|object at 0x|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b(?:4\d\d|5\d\d)\b|OAuth|invalid_grant|HTTP/i
    for (const s of allSentences) expect(s).not.toMatch(mechanism)
  })

  it("rule 5 — a punctuation dash is an EM DASH (U+2014), never a hyphen-minus", () => {
    let examined = 0
    for (const s of allSentences) {
      for (const match of s.matchAll(DASH_CLASS)) {
        const i = match.index ?? 0
        const before = s[i - 1] ?? " "
        const after = s[i + 1] ?? " "
        // An intra-word hyphen ("password-protected") is a hyphen and stays one. Every dash
        // standing alone as punctuation must be the em dash.
        if (/\w/.test(before) && /\w/.test(after)) continue
        examined += 1
        expect(match[0]).toBe(EM_DASH)
      }
    }
    // ⚠ NON-VACUITY for this rule specifically: if no punctuation dash existed anywhere the
    //   loop above would pass over nothing while looking green.
    expect(examined).toBeGreaterThan(2)
  })

  it("rule 5 — at least one compound hyphen exists and was deliberately NOT rejected", () => {
    // The carve-out is only honest if it is exercised. `fileFail.password` is the case.
    expect(SENTENCE_FOR_FILE_FAILURE.password).toContain("password-protected")
  })
})

// ── THE ONE MARKED EXCEPTION, carved out BY NAME ──────────────────────────────────────

describe("BUILD-CONTRACT §4 — the marked operator half is the ONLY mechanism", () => {
  it("readerOffOperator names the setting, because for an operator the setting IS the action", () => {
    expect(COPY.readerOffOperator).toBe("WATCH_PROCESS_ENABLED")
  })

  it("the MEMBER half names no mechanism at all (T-235-07)", () => {
    expect(COPY.readerOffMember).not.toContain("WATCH_PROCESS_ENABLED")
    expect(COPY.readerOffMember).not.toMatch(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/)
    expect(COPY.readerOffMember).toContain("switched off on this server")
  })

  it("the operator string is the ONLY member of COPY that would fail rule 4", () => {
    const envShaped = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/
    const offenders = Object.entries(COPY)
      .filter(([, v]) => typeof v === "string")
      .filter(([, v]) => envShaped.test(v as string))
      .map(([k]) => k)
    expect(offenders).toEqual(["readerOffOperator"])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// ⛔ THE FIXTURE NAME MUST NOT SURVIVE INTO THE BUILD
// ══════════════════════════════════════════════════════════════════════════════════════

describe("the connection name is a runtime value, never a baked fixture", () => {
  it("no shipped string contains the sketch's fixture connection name", () => {
    expect(vocabularySource).not.toContain("Legal SharePoint")
    for (const s of allSentences) expect(s).not.toContain("Legal SharePoint")
  })

  it("the token_revoked sentence and control are FUNCTIONS of the connection name", () => {
    expect(SENTENCE_FOR_CAUSE.token_revoked("Acme Drive")).toContain("Acme Drive")
    expect(SENTENCE_FOR_CAUSE.token_revoked("Other Drive")).toContain("Other Drive")
    expect(CONTROL_FOR_CAUSE.token_revoked.label("Acme Drive")).toBe("Reconnect Acme Drive")
  })

  it("an empty or blank connection name degrades rather than printing a gap", () => {
    // `notAZipSentence`'s final rule: fall back rather than guess. A wrong instruction is
    // worse than a general one, and "Reconnect " with nothing after it is a wrong one.
    expect(CONTROL_FOR_CAUSE.token_revoked.label("")).toBe("Reconnect the connection")
    expect(CONTROL_FOR_CAUSE.token_revoked.label("   ")).toBe("Reconnect the connection")
    expect(SENTENCE_FOR_CAUSE.token_revoked("").length).toBeGreaterThan(20)
    expect(SENTENCE_FOR_CAUSE.token_revoked("")).toContain("the connection")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// V-07 · CAUSE → ONE CONTROL, AND THE MAP IS **DATA**
// ══════════════════════════════════════════════════════════════════════════════════════

describe("V-07 — each cause maps to exactly ONE named control", () => {
  it("the three shipped labels are exactly what the BUILD-CONTRACT names", () => {
    expect(CONTROL_FOR_CAUSE.token_revoked.label("Legal Drive")).toBe("Reconnect Legal Drive")
    expect(CONTROL_FOR_CAUSE.folder_gone.label("Legal Drive")).toBe("Pick a different folder")
    expect(CONTROL_FOR_CAUSE.unreachable.label("Legal Drive")).toBe("Retry now")
    expect(CONTROL_FOR_CAUSE.unknown.label("Legal Drive")).toBe("Retry now")
  })

  it("every cause carries exactly one action, drawn from the three named actions", () => {
    const actions = new Set(["reconnect", "repick_folder", "retry"])
    for (const cause of Object.keys(CONTROL_FOR_CAUSE) as SourceFailureCause[]) {
      const control = CONTROL_FOR_CAUSE[cause]
      expect(typeof control.label).toBe("function")
      expect(actions.has(control.action)).toBe(true)
    }
  })

  it("D-235-11 — Reconnect cannot fix an unshared folder, so the actions genuinely differ", () => {
    expect(CONTROL_FOR_CAUSE.token_revoked.action).toBe("reconnect")
    expect(CONTROL_FOR_CAUSE.folder_gone.action).toBe("repick_folder")
    expect(CONTROL_FOR_CAUSE.unreachable.action).toBe("retry")
    expect(CONTROL_FOR_CAUSE.unknown.action).toBe("retry")
  })

  it("⭐ PROVED, not asserted — the leaf's own source contains NO per-cause branch", () => {
    // A new cause must need a table ROW, never an `if` edit. This reads the shipped source
    // and reds if anyone ever reaches for a branch on the cause value.
    expect(vocabularySource.length).toBeGreaterThan(3000)
    expect(vocabularySource).not.toMatch(/switch\s*\(\s*cause/)
    expect(vocabularySource).not.toMatch(/cause\s*===\s*["']/)
    expect(vocabularySource).not.toMatch(/case\s+["'](?:token_revoked|folder_gone|unreachable)["']/)
  })

  it("⛔ ZERO IMPORTS — the leaf's own source has no import statement", () => {
    const importLines = vocabularySource
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l) || /^\s*export\s+.*\sfrom\s/.test(l))
    expect(importLines).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// V-09 · THE LIVE BINDING — every cause the backend can EMIT has a sentence here
// ══════════════════════════════════════════════════════════════════════════════════════

describe("V-09 — bound to failure_cause.py's LIVE source", () => {
  const backendCauses = (): string[] => {
    const m = failureCausePySource.match(/^Cause = Literal\[(.+)\]$/m)
    if (m === null) return []
    return Array.from(m[1].matchAll(/"([a-z_]+)"/g)).map((x) => x[1])
  }

  it("⚠ NON-VACUITY — the ?raw import carries the backend module", () => {
    expect(failureCausePySource.length).toBeGreaterThan(500)
    expect(failureCausePySource).toContain("Cause = Literal")
    expect(failureCausePySource).toContain("classify_failure_cause")
  })

  it("⚠ NON-VACUITY — the extraction actually found the four cause literals", () => {
    // A regex that matched nothing yields [], and [] would satisfy every "for each" below
    // vacuously while looking green. This is the assertion that reds on a rename.
    expect(backendCauses()).toHaveLength(4)
  })

  it("⭐ every cause the backend can emit HAS a sentence and a control", () => {
    for (const cause of backendCauses()) {
      expect(
        Object.prototype.hasOwnProperty.call(SENTENCE_FOR_CAUSE, cause),
        `failure_cause.py can emit "${cause}" but sourceHealthVocabulary.ts has no sentence for it`,
      ).toBe(true)
      expect(
        Object.prototype.hasOwnProperty.call(CONTROL_FOR_CAUSE, cause),
        `failure_cause.py can emit "${cause}" but sourceHealthVocabulary.ts has no control for it`,
      ).toBe(true)
    }
  })

  it("and the frontend invents no cause the backend cannot emit", () => {
    const backend = new Set(backendCauses())
    for (const cause of Object.keys(SENTENCE_FOR_CAUSE)) {
      expect(backend.has(cause), `"${cause}" has a sentence but no backend producer`).toBe(true)
    }
  })

  it("the HARD/soft split the sentences assume is the one the backend ships", () => {
    // `unreachable`'s sentence says "the last three checks" — a claim that is only true if
    // the backend's soft threshold is 3. A change there without a rewording here would make
    // the sentence a lie, so it is pinned to the live constant.
    expect(failureCausePySource).toMatch(/SOFT_FAILURE_THRESHOLD:\s*int\s*=\s*3/)
    expect(SENTENCE_FOR_CAUSE.unreachable(SAMPLE_CONNECTION)).toContain("three")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// THE CLASSIFIER AND THE ONE ENTRY POINT
// ══════════════════════════════════════════════════════════════════════════════════════

describe("classifySourceFailure — the same four causes, recognised on the client", () => {
  it("an authorisation message is token_revoked", () => {
    expect(classifySourceFailure("Source access unauthorized: 403 invalid_grant")).toBe(
      "token_revoked",
    )
  })

  it("a missing-folder message is folder_gone", () => {
    expect(classifySourceFailure("File not found: folder no longer shared")).toBe("folder_gone")
  })

  it("a transient message is unreachable", () => {
    expect(classifySourceFailure("HTTPSConnectionPool: Read timed out")).toBe("unreachable")
  })

  it("null, empty and unrecognised are unknown — it never guesses", () => {
    expect(classifySourceFailure(null)).toBe("unknown")
    expect(classifySourceFailure(undefined)).toBe("unknown")
    expect(classifySourceFailure("   ")).toBe("unknown")
    expect(classifySourceFailure("something nobody has seen before")).toBe("unknown")
  })
})

describe("sourceFailureSentence — the ONE entry point", () => {
  it("a recognised cause resolves to its own sentence", () => {
    expect(sourceFailureSentence("403 invalid_grant", "Acme Drive")).toBe(
      SENTENCE_FOR_CAUSE.token_revoked("Acme Drive"),
    )
  })

  it("the unknown arm is the shipped honest fallback, byte-identical to the library's", () => {
    expect(UNKNOWN_SOURCE_FAILURE_SENTENCE).toBe("It stopped, and no reason was recorded.")
    expect(sourceFailureSentence(null, "Acme Drive")).toBe(UNKNOWN_SOURCE_FAILURE_SENTENCE)
    expect(SENTENCE_FOR_CAUSE.unknown("Acme Drive")).toBe(UNKNOWN_SOURCE_FAILURE_SENTENCE)
    expect(SENTENCE_FOR_FILE_FAILURE.unknown).toBe(UNKNOWN_SOURCE_FAILURE_SENTENCE)
  })

  it("T-235-06 — a machine-shaped string NEVER reaches the screen", () => {
    const leaks = [
      `{"code": "401", "message": "invalid_grant", "hint": null}`,
      "Traceback (most recent call last): File \"/app/services/watch_service.py\", line 190",
      "httpx.HTTPStatusError: Client error for url https://www.googleapis.com/drive/v3/files?pageToken=ya29.SECRET",
      "<class 'google.auth.exceptions.RefreshError'> object at 0x7f3a",
    ]
    const ourOwnSentences = (Object.keys(SENTENCE_FOR_CAUSE) as SourceFailureCause[]).map((c) =>
      SENTENCE_FOR_CAUSE[c]("Acme Drive"),
    )
    for (const leak of leaks) {
      const shown = sourceFailureSentence(leak, "Acme Drive")
      // Whatever it resolved to, it is OURS — the raw string never survives.
      expect(ourOwnSentences).toContain(shown)
      expect(shown).not.toContain("ya29.")
      expect(shown).not.toContain("watch_service.py")
    }
  })

  it("a provably-plain backend sentence passes through unchanged", () => {
    const plain = "The connection was removed by the person who created it."
    expect(sourceFailureSentence(plain, "Acme Drive")).toBe(plain)
  })

  it("prose that is too short, unpunctuated, or too long fails the proof and falls back", () => {
    expect(sourceFailureSentence("nope", "Acme Drive")).toBe(UNKNOWN_SOURCE_FAILURE_SENTENCE)
    expect(sourceFailureSentence("no full stop here at all", "Acme Drive")).toBe(
      UNKNOWN_SOURCE_FAILURE_SENTENCE,
    )
    expect(sourceFailureSentence(`${"a".repeat(320)}.`, "Acme Drive")).toBe(
      UNKNOWN_SOURCE_FAILURE_SENTENCE,
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// THE PINNED COPY — byte-identical to the shipped surface and the BUILD-CONTRACT
// ══════════════════════════════════════════════════════════════════════════════════════

describe("COPY — the sentences the BUILD-CONTRACT pins", () => {
  it("SURF-01 — the cadence sentence is byte-identical to WatchedFoldersSection.tsx:305", () => {
    expect(COPY.cadence(30)).toBe("checked every 30 minutes")
  })

  it("the badge title agrees in number", () => {
    expect(COPY.badgeTitle(1)).toBe("1 source stopped reading")
    expect(COPY.badgeTitle(2)).toBe("2 sources stopped reading")
    expect(COPY.badgeTitle(0)).toBe("0 sources stopped reading")
  })

  it("the outcome lines say what HAPPENED, never that work is happening", () => {
    expect(COPY.checkedAgo("4 minutes ago", 6)).toBe("Checked 4 minutes ago · 6 files")
    expect(COPY.checkedNoChange("4 minutes ago")).toBe("Checked 4 minutes ago · no changes")
    expect(COPY.asked("60 seconds")).toBe("Asked · next check within 60 seconds")
  })

  it("the stopped pair says THAT it stopped and WHEN it last succeeded", () => {
    expect(COPY.stopped("3 days ago")).toBe("Stopped reading 3 days ago")
    expect(COPY.lastGood("2 September, 09:14")).toBe(
      "Last read successfully on 2 September, 09:14",
    )
    expect(COPY.neverRead).toBe("It has not read successfully yet.")
  })

  it("the quiet fold, the degraded row and the roster", () => {
    expect(COPY.quietFold(14)).toBe("checked 14 times, no changes")
    expect(COPY.showEvery).toBe("Show every check")
    expect(COPY.hideQuiet).toBe("Hide quiet checks")
    expect(COPY.degradedAction).toBe("Report this source")
    expect(COPY.roster(12, 2)).toBe("12 connected, 2 need you")
  })

  it("the nine keys the emitted §1 table omitted are all present (RESEARCH C-11)", () => {
    for (const key of [
      "degradedAction",
      "popTitle",
      "popOpenHealth",
      "goToSource",
      "roster",
      "syncNow",
      "history",
      "hideHistory",
      "collapse",
    ]) {
      expect(Object.prototype.hasOwnProperty.call(COPY, key)).toBe(true)
    }
  })

  it("BUILD-CONTRACT §4 — the forbidden words appear nowhere", () => {
    // "scheduled" described the request, not the outcome (BUG-260906-02). "instantly" and
    // "on change" would claim a webhook that does not exist (SURF-01, pinned by 234).
    for (const s of allSentences.concat([COPY.readerOffOperator])) {
      expect(s.toLowerCase()).not.toContain("scheduled")
      expect(s.toLowerCase()).not.toContain("instantly")
      expect(s.toLowerCase()).not.toContain("on change")
    }
  })
})
