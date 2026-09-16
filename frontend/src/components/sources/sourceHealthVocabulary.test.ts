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
  CHECKED_PREFIX,
  CONNECTION_PILL_FOR_CAUSE,
  CONTROL_FOR_CAUSE,
  COPY,
  COUNT_ORDER,
  FILE_FAILURE_HEADING,
  FILE_FAILURE_MORE,
  FILE_FAILURE_SCOPE_NOTE,
  fileFailureKind,
  instantPhrase,
  SENTENCE_FOR_CAUSE,
  SENTENCE_FOR_FILE_FAILURE,
  UNKNOWN_SOURCE_FAILURE_SENTENCE,
  WORD_FOR_COUNT,
  type CountKey,
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

// The words plan 13 added, rendered. ⭐ Folded into `allSentences` below so the five binding
// rules loop over them too — a new export that skipped this list would be an unchecked string.
const renderedCountWords: string[] = (Object.keys(WORD_FOR_COUNT) as CountKey[]).map(
  (k) => WORD_FOR_COUNT[k],
)

const renderedNewCopy: string[] = [
  CHECKED_PREFIX("4 minutes ago"),
  FILE_FAILURE_HEADING,
  FILE_FAILURE_SCOPE_NOTE,
  // ⭐ Plan 17's one new string, folded in here rather than asserted alone, so the five
  //   binding rules loop over it too. A new export that skipped this list would be a string
  //   nobody checked — which is the failure mode this array exists to prevent.
  FILE_FAILURE_MORE(3),
]

const allSentences: string[] = [
  ...renderedCauseSentences,
  ...renderedControlLabels,
  ...renderedFileSentences,
  ...renderedCopy,
  ...renderedCountWords,
  ...renderedNewCopy,
]

// ══════════════════════════════════════════════════════════════════════════════════════
// ⚠ NON-VACUITY FIRST — asserted BEFORE anything loops over these tables
// ══════════════════════════════════════════════════════════════════════════════════════

describe("sourceHealthVocabulary — non-vacuity", () => {
  it("the cause table has exactly the six causes", () => {
    // ⚠ RE-BASELINED 4 → 5 (plan 13, gap-closure round 1), deliberately and in the SAME plan
    //   that widened `failure_cause.py`. Widening one side alone leaves the tree red between
    //   waves, which is the whole reason both halves of this wire live in one plan.
    // ⚠ RE-BASELINED 5 → 6 (BUG-260912-01, 2026-09-12) under the same discipline and in the
    //   same commit as the backend union. The sixth is the deployment's OWN credentials being
    //   rejected — previously narrated as `token_revoked` and offered **Reconnect**, which
    //   cannot work because the code exchange presents the same secret. The number moves
    //   because the union genuinely gained a member, never to make an assertion pass; the new
    //   member's own properties are driven in `bug260912AppCredentials.test.ts`.
    const causes = Object.keys(SENTENCE_FOR_CAUSE)
    expect(causes).toHaveLength(6)
    expect(causes).toContain("token_revoked")
    expect(causes).toContain("folder_gone")
    expect(causes).toContain("unreachable")
    expect(causes).toContain("connection_disabled")
    expect(causes).toContain("app_credentials_invalid")
    expect(causes).toContain("unknown")
  })

  it("the control table covers the same six causes", () => {
    expect(Object.keys(CONTROL_FOR_CAUSE).sort()).toEqual(Object.keys(SENTENCE_FOR_CAUSE).sort())
  })

  it("the file-failure table has its three kinds", () => {
    // ⚠ UNCHANGED at 3 by plan 13 — it adds no per-file kind, only the heading and the scope
    //   note the wave-2 card needs to render the three that already exist.
    expect(Object.keys(SENTENCE_FOR_FILE_FAILURE)).toHaveLength(3)
  })

  it("the count-word table has exactly the six stored counts, and COUNT_ORDER lists each once", () => {
    // ⚠ SIX, because `runHistoryFold.ts:63-81` stores six. The sketch's fixture exercised only
    //   four of them, so two of these words are new — see the leaf's comment.
    expect(Object.keys(WORD_FOR_COUNT)).toHaveLength(6)
    expect(COUNT_ORDER).toHaveLength(6)
    expect(new Set(COUNT_ORDER).size).toBe(6)
    expect([...COUNT_ORDER].sort()).toEqual(Object.keys(WORD_FOR_COUNT).sort())
  })

  it("the two per-file headings are non-empty", () => {
    expect(FILE_FAILURE_HEADING.trim().length).toBeGreaterThan(0)
    expect(FILE_FAILURE_SCOPE_NOTE.trim().length).toBeGreaterThan(0)
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
    // ⚠ RE-BASELINED in Phase 252 (W-3 / D-30): the label gained `in Settings ↗`. What this
    //   case asserts is UNCHANGED — the name is interpolated, never baked — and the pin still
    //   reds on a baked fixture name.
    expect(CONTROL_FOR_CAUSE.token_revoked.label("Acme Drive")).toBe(
      "Reconnect Acme Drive in Settings ↗",
    )
  })

  it("an empty or blank connection name degrades rather than printing a gap", () => {
    // `notAZipSentence`'s final rule: fall back rather than guess. A wrong instruction is
    // worse than a general one, and "Reconnect " with nothing after it is a wrong one.
    // ⚠ RE-BASELINED in Phase 252 (W-3 / D-30) — the DEGRADATION is what this case is about
    //   and it is unchanged: the fallback still names "the connection" rather than leaving a
    //   gap after the verb.
    expect(CONTROL_FOR_CAUSE.token_revoked.label("")).toBe(
      "Reconnect the connection in Settings ↗",
    )
    expect(CONTROL_FOR_CAUSE.token_revoked.label("   ")).toBe(
      "Reconnect the connection in Settings ↗",
    )
    expect(SENTENCE_FOR_CAUSE.token_revoked("").length).toBeGreaterThan(20)
    expect(SENTENCE_FOR_CAUSE.token_revoked("")).toContain("the connection")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// V-07 · CAUSE → ONE CONTROL, AND THE MAP IS **DATA**
// ══════════════════════════════════════════════════════════════════════════════════════

describe("V-07 — each cause maps to exactly ONE named control", () => {
  it("the three shipped labels are exactly what the BUILD-CONTRACT names", () => {
    // ⚠ RE-BASELINED in Phase 252 (W-3 / D-30). ⭐ The VERB is deliberately still `Reconnect`,
    //   unlike its two Settings-door siblings: for a revoked token reconnecting genuinely IS
    //   the fix, and only the location was missing. `runFix` merely navigates for this action,
    //   which is what the added words now admit.
    expect(CONTROL_FOR_CAUSE.token_revoked.label("Legal Drive")).toBe(
      "Reconnect Legal Drive in Settings ↗",
    )
    expect(CONTROL_FOR_CAUSE.folder_gone.label("Legal Drive")).toBe("Pick a different folder")
    expect(CONTROL_FOR_CAUSE.unreachable.label("Legal Drive")).toBe("Retry now")
    expect(CONTROL_FOR_CAUSE.unknown.label("Legal Drive")).toBe("Retry now")
  })

  it("⭐ G3 — a switched-off connection is NOT offered Retry now", () => {
    // THE GAP THIS PLAN CLOSES. Before it, a disabled connection resolved to `unknown` after
    // three paused ticks: "It stopped, and no reason was recorded." plus a Retry button that
    // provably cannot change a state somebody chose deliberately. SC#2's word is *fixes*.
    const label = CONTROL_FOR_CAUSE.connection_disabled.label("Marketing Drive")
    expect(label).not.toBe("Retry now")
    expect(label).not.toContain("Reconnect")
    expect(label).toContain("Marketing Drive")
    expect(label).toBe("Open Marketing Drive in Settings ↗")
    expect(SENTENCE_FOR_CAUSE.connection_disabled("Marketing Drive")).not.toBe(
      UNKNOWN_SOURCE_FAILURE_SENTENCE,
    )
  })

  it("the connection_disabled sentence names the connection and says how reading resumes", () => {
    const s = SENTENCE_FOR_CAUSE.connection_disabled("Marketing Drive")
    expect(s).toContain("Marketing Drive")
    expect(s).toContain("switched off")
    expect(s).toContain("switched back on")
  })

  it("an empty connection name degrades on the new cause too, rather than printing a gap", () => {
    expect(CONTROL_FOR_CAUSE.connection_disabled.label("")).toBe("Open Connection Settings ↗")
    expect(CONTROL_FOR_CAUSE.connection_disabled.label("   ")).toBe("Open Connection Settings ↗")
    expect(SENTENCE_FOR_CAUSE.connection_disabled("")).toContain("the connection")
  })

  it("⭐ the new cause REUSES the reconnect door — no fourth action was invented", () => {
    // The Connections surface is where a connection is switched back on, and it is already the
    // `reconnect` action's destination. Reusing it keeps the "three named actions" pin below
    // green BY CONSTRUCTION rather than by loosening it.
    expect(CONTROL_FOR_CAUSE.connection_disabled.action).toBe("reconnect")
    const actions = new Set(
      (Object.keys(CONTROL_FOR_CAUSE) as SourceFailureCause[]).map(
        (c) => CONTROL_FOR_CAUSE[c].action,
      ),
    )
    expect([...actions].sort()).toEqual(["reconnect", "repick_folder", "retry"])
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
    expect(vocabularySource).not.toMatch(
      /case\s+["'](?:token_revoked|folder_gone|unreachable|connection_disabled)["']/,
    )
  })

  it("⭐ D-235-11 PROVED ON THE FIFTH CAUSE — it appears in exactly four places, all of them tables", () => {
    // A new cause must need a ROW, never a branch. Counted over the shipped source: the union,
    // the sentence table, the control table — and now the connection-pill table. An occurrence
    // beyond the tables would mean somebody reached for special-casing, and this reds rather
    // than waiting for a reviewer to notice.
    //
    // ⚠ RE-BASELINED 3 → 4 in Phase 252 (W-1 / D-29), in the SAME commit that added the fourth
    //   TABLE — the discipline this file already applied twice to the backend-cause pin
    //   (4 → 5, then 5 → 6). **The invariant is unchanged and still holds: "all of them
    //   tables".** Only the count of tables moved.
    // ⛔ THIS IS A RE-BASELINE, NOT A LOOSENING. It is still an exact equality — never
    //   `toBeGreaterThan`, which would make a pin that cannot fail. And the companion case
    //   above still proves the absence of a `cause`-equality branch independently, so a
    //   special-case smuggled in as a fourth occurrence would still red there.
    // ⚠ MEASURED: the identifier is spelled in the four table positions and NOWHERE in the
    //   prose, because a literal inside a comment is still a literal — the drive of this very
    //   change reddened this case at 7 before the new docblock stopped quoting it.
    const occurrences = vocabularySource.split("connection_disabled").length - 1
    expect(occurrences).toBe(4)
  })

  // ══════════════════════════════════════════════════════════════════════════════════════
  // W-1 (Phase 252 / D-29) · CAUSE → WHAT THE CONNECTION PILL SAYS
  // ══════════════════════════════════════════════════════════════════════════════════════

  it("⛔ W-1 — the two AUTHORISATION causes do not claim the connection is fine", () => {
    // The shipped card rendered `● Connected` for both of these, because its binary asked about
    // one cause only. A revoked token reading "Connected" is a misattribution of a
    // security-relevant failure, not a wording slip.
    expect(CONNECTION_PILL_FOR_CAUSE.token_revoked.label).not.toMatch(/connected/i)
    expect(CONNECTION_PILL_FOR_CAUSE.app_credentials_invalid.label).not.toMatch(/connected/i)
    expect(CONNECTION_PILL_FOR_CAUSE.token_revoked.tone).toBe("attention")
    expect(CONNECTION_PILL_FOR_CAUSE.app_credentials_invalid.tone).toBe("attention")
  })

  it("⭐ W-1 CONTROL — a failure that is NOT connection-level still reads Connected", () => {
    // ⚠ The other half of D-29, and it carries as much weight: flipping every cause to a
    //   warning would make this pill a restatement of the run pill beside it. An unshared
    //   folder and a server timeout say nothing about the authorisation.
    expect(CONNECTION_PILL_FOR_CAUSE.folder_gone.label).toBe("Connected")
    expect(CONNECTION_PILL_FOR_CAUSE.unreachable.label).toBe("Connected")
    // ⭐ And the ordinary case: a healthy watch has no `last_error`, so the classifier returns
    //   `unknown` and the card reads THIS row. If it said anything else, every healthy source
    //   in the library would carry a warning.
    expect(CONNECTION_PILL_FOR_CAUSE.unknown.label).toBe("Connected")
    expect(CONNECTION_PILL_FOR_CAUSE.unknown.tone).toBe("connected")
  })

  it("W-1 — the shipped switched-off reading is preserved word for word", () => {
    // The one reading that was already correct. It is the label the two-tier badge suite pins
    // and the only one a person has actually seen; a re-word here would be gratuitous churn.
    expect(CONNECTION_PILL_FOR_CAUSE.connection_disabled.label).toBe("Connection Off")
  })

  it("W-1 — every cause has a pill, so a new cause cannot render an empty one", () => {
    expect(Object.keys(CONNECTION_PILL_FOR_CAUSE).sort()).toEqual(
      Object.keys(SENTENCE_FOR_CAUSE).sort(),
    )
    for (const cause of Object.keys(CONNECTION_PILL_FOR_CAUSE) as SourceFailureCause[]) {
      const row = CONNECTION_PILL_FOR_CAUSE[cause]
      expect(row.label.trim().length, `"${cause}" has an empty pill label`).toBeGreaterThan(0)
      expect(row.glyph.trim().length, `"${cause}" has an empty pill glyph`).toBeGreaterThan(0)
      expect(["connected", "attention"]).toContain(row.tone)
    }
  })

  it("⛔ W-2 — no cause in the taxonomy means RATE LIMITED, so none may be read as one", () => {
    // ⭐ THE MEASUREMENT BEHIND D-28, PINNED SO IT CANNOT ROT INTO AN ASSUMPTION.
    //   `failure_cause.py`'s status table maps 429 to `unreachable`, and the client matcher
    //   below puts the rate-limit tells in the SAME alternation as timeouts and 5xx. A 429 is
    //   therefore INDISTINGUISHABLE from a 503 after classification — which is why the card's
    //   `Run failed (429)` reading was deleted outright rather than re-keyed onto a cause.
    // ⛔ If this case ever reds because a genuine rate-limit cause was added, the reading may
    //   come back — as a ROW, never as a guard in a component.
    expect(classifySourceFailure("429 Too Many Requests: rate limit exceeded")).toBe("unreachable")
    expect(classifySourceFailure("503 Service Unavailable")).toBe("unreachable")
    expect(classifySourceFailure("Connection timed out")).toBe("unreachable")
    // ⚠ NON-VACUITY — the union genuinely carries no rate-limit member, rather than the three
    //   above merely agreeing by accident.
    expect(Object.keys(SENTENCE_FOR_CAUSE).join(",")).not.toMatch(/rate|limit|throttl|quota/i)
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

  it("⚠ NON-VACUITY — the extraction actually found the six cause literals", () => {
    // A regex that matched nothing yields [], and [] would satisfy every "for each" below
    // vacuously while looking green. This is the assertion that reds on a rename.
    // ⚠ RE-BASELINED 4 → 5 in the SAME plan that widened the backend union (plan 13).
    // ⚠ RE-BASELINED 5 → 6 in the SAME commit that widened it again (BUG-260912-01).
    expect(backendCauses()).toHaveLength(6)
    expect(backendCauses()).toContain("connection_disabled")
    expect(backendCauses()).toContain("app_credentials_invalid")
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

  it("⛔ the fifth cause is WRITTEN, never inferred — the client half guesses it from nothing", () => {
    // The MIRROR of `test_failure_cause.py::test_connection_disabled_is_never_inferred_from_a_message`.
    // Only the seam that read `is_enabled` off the connection row knows this fact; a provider
    // saying "disabled" about a file, an API, a scope or an account is not evidence about the
    // connection. Inferring it would offer "turn it back on" for a connection already on.
    for (const tempting of [
      "connection is disabled",
      "disabled",
      "Connection is disabled",
      "switched off",
      "connection disabled",
      "The connection has been disabled by an administrator.",
      "this source is turned off",
    ]) {
      expect(classifySourceFailure(tempting)).not.toBe("connection_disabled")
    }
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
      "Last read successfully 2 September, 09:14",
    )
    expect(COPY.lastGood("8m ago")).toBe("Last read successfully 8m ago")
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

// ══════════════════════════════════════════════════════════════════════════════════════
// PLAN 13 · THE WORDS WAVE 2 RENDERS — per-category counts, the per-file heading, the instant
// ══════════════════════════════════════════════════════════════════════════════════════

describe("WORD_FOR_COUNT — the six stored counts, in words", () => {
  it("the four the sketch drew are byte-identical to the design", () => {
    // `index.html:478-481` — `renderRun`'s own bits. These four are the contract; a reworded
    // one is a drift from the approved sketch, not a copy improvement.
    expect(WORD_FOR_COUNT.new).toBe("added")
    expect(WORD_FOR_COUNT.modified).toBe("updated")
    expect(WORD_FOR_COUNT.missing).toBe("missing at source")
    expect(WORD_FOR_COUNT.errors).toBe("could not be read")
  })

  it("the two the sketch never drew are lowercase fragments in the same register", () => {
    // ⚠ STATED, not slipped in: the store carries SIX counts (`runHistoryFold.ts:63-81`) and
    //   the sketch's fixture exercised four. `renamed` and `restored` are ours.
    expect(WORD_FOR_COUNT.renamed).toBe("renamed")
    expect(WORD_FOR_COUNT.restored).toBe("restored")
    for (const w of Object.values(WORD_FOR_COUNT)) {
      expect(w).toBe(w.toLowerCase())
      expect(w).not.toMatch(/[.?]$/)
    }
  })

  it("COUNT_ORDER is the sketch's reading order", () => {
    expect([...COUNT_ORDER]).toEqual([
      "new",
      "modified",
      "renamed",
      "restored",
      "missing",
      "errors",
    ])
  })

  it("every COUNT_ORDER key has a word — the render cannot reach an undefined", () => {
    for (const key of COUNT_ORDER) {
      expect(typeof WORD_FOR_COUNT[key]).toBe("string")
      expect(WORD_FOR_COUNT[key].length).toBeGreaterThan(0)
    }
  })
})

describe("CHECKED_PREFIX — the prefix COPY.checkedAgo bakes a summed count into", () => {
  it("says what happened and when, and nothing about how many", () => {
    expect(CHECKED_PREFIX("4 minutes ago")).toBe("Checked 4 minutes ago")
    expect(CHECKED_PREFIX("3 days ago")).toBe("Checked 3 days ago")
  })

  it("⛔ COPY.checkedAgo is NOT deleted and NOT reworded — the source CARD still renders it", () => {
    // The one-line summary is right for a card. The per-category breakdown is right for the
    // run history. Both exist; neither replaces the other, and the 26-key pin is undisturbed.
    expect(COPY.checkedAgo("4 minutes ago", 6)).toBe("Checked 4 minutes ago · 6 files")
    expect(Object.keys(COPY)).toHaveLength(26)
  })
})

describe("FILE_FAILURE_HEADING / FILE_FAILURE_SCOPE_NOTE — the list is a STATE, not a run", () => {
  it("⭐ the scope note says the list is how the files stand NOW, not what one check did", () => {
    // THE WHOLE REASON the wave-2 card may render per-file reasons at all. `connector_watch_items`
    // carries the file's CURRENT state; it is not a per-run attribution, and claiming it were
    // would be exactly the overclaim this phase exists to stop making.
    expect(FILE_FAILURE_SCOPE_NOTE.toLowerCase()).toContain("now")
    expect(FILE_FAILURE_SCOPE_NOTE.toLowerCase()).not.toContain("this check")
    expect(FILE_FAILURE_HEADING.toLowerCase()).toContain("could not be read")
  })
})

describe("instantPhrase — the BUILD-CONTRACT's absolute instant", () => {
  it("renders the shape COPY.lastGood is pinned against", () => {
    // ⚠ Constructed with local-time components so no assertion depends on the runner's zone.
    const d = new Date(2026, 8, 2, 9, 14) // 2 September 2026, 09:14 local
    expect(instantPhrase(d.toISOString())).toBe("2 September, 09:14")
    expect(COPY.lastGood(instantPhrase(d.toISOString()) as string)).toBe(
      "Last read successfully 2 September, 09:14",
    )
  })

  it("pads the hour and the minute, and never pads the day", () => {
    const d = new Date(2026, 11, 25, 7, 5)
    expect(instantPhrase(d.toISOString())).toBe("25 December, 07:05")
    const early = new Date(2026, 0, 1, 0, 0)
    expect(instantPhrase(early.toISOString())).toBe("1 January, 00:00")
  })

  it("silence beats an invented instant — null, undefined and unparseable all return null", () => {
    // `relativeBand`'s own recorded rule. A date we cannot read is not a date we may guess.
    expect(instantPhrase(null)).toBeNull()
    expect(instantPhrase(undefined)).toBeNull()
    expect(instantPhrase("")).toBeNull()
    expect(instantPhrase("   ")).toBeNull()
    expect(instantPhrase("not a date at all")).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// ⭐ PLAN 17 (gap-closure round 1) · fileFailureKind — DENY BY DEFAULT
//
// `SENTENCE_FOR_FILE_FAILURE` had been written, pinned and consumed by NOTHING. Mounting it
// needs one thing this leaf did not have: a rule for WHICH of its three kinds a stored item
// state means. That rule is the risk — a broad matcher prints a confident sentence about a
// file whose reason nobody knows, which is the politer version of printing the exception.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("fileFailureKind — the per-file classifier", () => {
  it("a size skip is the too_big kind", () => {
    expect(fileFailureKind("skipped_size")).toBe("too_big")
    expect(fileFailureKind("skipped_size", "anything at all")).toBe("too_big")
  })

  it("a failed item whose message names a password is the password kind", () => {
    expect(fileFailureKind("failed", "This PDF is password-protected.")).toBe("password")
    expect(fileFailureKind("failed", "the document is protected with a password")).toBe("password")
    expect(fileFailureKind("failed", "A password is required to open this file")).toBe("password")
  })

  it("⛔ DENY BY DEFAULT — an unrecognised message is `unknown`, never a guess", () => {
    // The honest fallback. A cause we did not recognise must not be narrated as one we did.
    expect(fileFailureKind("failed", "Errno 13 while opening the stream")).toBe("unknown")
    expect(fileFailureKind("failed", "")).toBe("unknown")
    expect(fileFailureKind("failed", null)).toBe("unknown")
    expect(fileFailureKind("failed")).toBe("unknown")
  })

  it("⛔ a type skip is `unknown` — the table has no sentence that fits it", () => {
    // `SENTENCE_FOR_FILE_FAILURE` carries password / too_big / unknown. There is deliberately
    // no "wrong type" sentence, so a type skip resolves honestly rather than borrowing one.
    expect(fileFailureKind("skipped_type")).toBe("unknown")
    expect(fileFailureKind("skipped_type", "unsupported mime type")).toBe("unknown")
  })

  it("⛔ a state this build has never heard of resolves to `unknown` rather than throwing", () => {
    expect(fileFailureKind("present")).toBe("unknown")
    expect(fileFailureKind("missing")).toBe("unknown")
    expect(fileFailureKind("unauthorized")).toBe("unknown")
    expect(fileFailureKind("")).toBe("unknown")
    expect(fileFailureKind("a state from a later migration")).toBe("unknown")
  })

  it("⛔ the password tell is NOT reachable from a state other than `failed`", () => {
    // The password arm reads a message; every other arm must ignore one entirely, so a
    // provider string can never steer a kind the state does not support.
    expect(fileFailureKind("present", "this file is password-protected")).toBe("unknown")
    expect(fileFailureKind("missing", "this file is password-protected")).toBe("unknown")
    expect(fileFailureKind("skipped_size", "this file is password-protected")).toBe("too_big")
  })

  it("⛔ every kind it can return has a sentence — the output is a KEY, never text", () => {
    const kinds: SourceFileFailureKind[] = ["password", "too_big", "unknown"]
    for (const k of kinds) expect(SENTENCE_FOR_FILE_FAILURE[k].trim().length).toBeGreaterThan(0)
    // ⛔ AND THE MESSAGE NEVER SURVIVES. A provider-shaped string in, a three-value key out.
    const leaky = 'a driver failure at https://drive.example/f?token=ya29.abc {"code": 403}'
    const kind = fileFailureKind("failed", leaky)
    expect(kinds).toContain(kind)
    expect(SENTENCE_FOR_FILE_FAILURE[kind]).not.toContain("https://")
    expect(SENTENCE_FOR_FILE_FAILURE[kind]).not.toContain("ya29")
  })
})

describe("FILE_FAILURE_MORE — the remainder, counted and nothing more", () => {
  it("states the count", () => {
    expect(FILE_FAILURE_MORE(3)).toBe("and 3 more")
    expect(FILE_FAILURE_MORE(1)).toBe("and 1 more")
  })

  it("⛔ makes NO claim about why the remainder failed", () => {
    // Naming a reason for files nobody looked at is the overclaim this vocabulary refuses.
    const s = FILE_FAILURE_MORE(9)
    for (const kind of ["password", "too_big", "unknown"] as SourceFileFailureKind[]) {
      expect(s).not.toContain(SENTENCE_FOR_FILE_FAILURE[kind])
    }
    expect(s.toLowerCase()).not.toContain("password")
    expect(s.toLowerCase()).not.toContain("larger")
  })
})
