/**
 * Phase 235 plan 02 (LIB-10 · D-235-09 / D-235-10 / D-235-11) —
 * WHAT THE LIBRARY SAYS WHEN A WATCHED SOURCE STOPS READING.
 *
 * ── ⭐ THE DEFECT THIS EXISTS TO CLOSE ────────────────────────────────────────────────
 *
 * `WatchedFoldersSection.tsx:373` rendered `watch.last_error` VERBATIM, under the words
 * "Last check error:". That column is written from `str(exc)` at `watch_service.py:196`, so a
 * revoked Google token printed a provider dict, a URL carrying a token fragment and an
 * exception class to a person whose only question was *"why did my folder stop?"*. That is not
 * a sentence; it is an internal object with a person standing in front of it — the same defect
 * `ingestionErrorVocabulary.ts` closed one directory over, and this is its sibling.
 *
 * ⚠ REUSING THAT MODULE DIRECTLY WAS REJECTED (D-235-09). Its table is written for upload and
 * extraction failures — NUL bytes, duplicate hashes, an OOXML container that is not one. Every
 * SOURCE failure (token revoked, folder unshared, rate limited) would hit its fallback:
 * correct, and useless. Different facts need different sentences.
 *
 * ── THE FIVE BINDING RULES (Shared Pattern E) ─────────────────────────────────────────
 *
 *   1. A sentence is PRESENTATION, never a rule. Nothing branches on the text below.
 *   2. NO SEVERITY WORD. The row is already under a heading that says something is wrong;
 *      spending a second word on alarm buys nothing and costs trust.
 *   3. NO EXCLAMATION.
 *   4. NO MECHANISM. It names what is TRUE OF THE SOURCE and what to DO — never what the code
 *      experienced. No status code, no exception class, no env var.
 *   5. The dash is an EM DASH (U+2014), asserted by codepoint over the whole table at runtime.
 *
 * ── ⚠ RULE 4 HAS EXACTLY ONE DELIBERATE EXCEPTION, AND IT IS MARKED ───────────────────
 *
 * `COPY.readerOffOperator` is the literal `WATCH_PROCESS_ENABLED` (BUILD-CONTRACT §4). That is
 * not the mechanism leaking: for an OPERATOR the setting name IS the action, and a sentence
 * that made them guess which switch would be a worse kind of vague. `COPY.readerOffMember`
 * names no mechanism at all. Two audiences, two sentences, ONE condition (D-235-12) — and the
 * suite carves the operator half out BY NAME rather than loosening rule 4 for everything.
 *
 * ── ⚠ THE DEFAULT ARM NEVER INVENTS A CAUSE ───────────────────────────────────────────
 *
 * An unrecognised message resolves to `UNKNOWN_SOURCE_FAILURE_SENTENCE` — byte-identical to
 * `ingestionErrorVocabulary.ts:70`, because it is the same promise made about a different
 * object. Guessing a cause we did not recognise would be printing the exception one step
 * politer: a confident sentence that is not known to be true.
 *
 * The pass-through for the backend's OWN authored prose is gated on POSITIVE PROOF OF
 * PLAINNESS (`looksHumanWritten`), never on absence of a match. Deny by default.
 *
 * ── ⭐ THE CAUSE TO CONTROL MAP IS DATA (D-235-11) ────────────────────────────────────
 *
 * A new cause adds a ROW, never an `if`. "Always Reconnect" was rejected — an OAuth dance
 * cannot fix an unshared folder. "Always Retry" was rejected — SC#2's word is *fixes*, and
 * Retry does not fix a revoked token. `sourceHealthVocabulary.test.ts` PROVES the absence of a
 * per-cause branch by reading this file's own source, rather than asserting it in prose.
 *
 * ── ⛔ ZERO IMPORTS ───────────────────────────────────────────────────────────────────
 *
 * A strict leaf: a fence can read it, and a cycle through it is impossible by construction.
 * ⚠ The cause union here is kept in step with `backend/app/services/sources/failure_cause.py`
 * by a `?raw` binding in the suite — not by anybody remembering.
 */

// ── THE CAUSES ────────────────────────────────────────────────────────────────────────

/**
 * The failure shapes a watched source can be in. Each is a DIFFERENT FACT ABOUT THE SOURCE,
 * so each gets its own sentence AND its own one control.
 *
 *   • `token_revoked` — the connection's authorisation was withdrawn or expired. HARD: the
 *                       next tick cannot recover from it, so the source stops on failure 1.
 *   • `folder_gone`   — the watched folder is no longer shared, moved or deleted. HARD.
 *   • `unreachable`   — a timeout, a rate limit, a 5xx. SOFT: it may recover, so the source
 *                       stops only after `SOFT_FAILURE_THRESHOLD` consecutive failures.
 *   • `unknown`       — the honest fallback. Never a guess.
 */
export type SourceFailureCause = "token_revoked" | "folder_gone" | "unreachable" | "unknown"

/** The per-FILE failure reasons, for a file inside an otherwise healthy source. */
export type SourceFileFailureKind = "password" | "too_big" | "unknown"

/**
 * The shipped fallback, WORD FOR WORD. ⭐ Byte-identical to `ingestionErrorVocabulary.ts:70`
 * and to the sketch's `cause.unknown.says` — deliberately, because the promise is the same
 * promise. Do not reword one without the other.
 */
export const UNKNOWN_SOURCE_FAILURE_SENTENCE = "It stopped, and no reason was recorded."

/**
 * When the caller has no connection name to give us. ⚠ "Reconnect " with nothing after it is
 * a wrong instruction, and a wrong instruction is worse than a general one
 * (`notAZipSentence`'s recorded rule).
 */
const UNNAMED_CONNECTION = "the connection"

/** The connection name, or an honest generic stand-in. Never an empty gap on the screen. */
function named(connectionName: string): string {
  const trimmed = (connectionName ?? "").trim()
  return trimmed.length > 0 ? trimmed : UNNAMED_CONNECTION
}

/**
 * ⭐ The table. `cause → sentence`, keyed by the union so a new cause cannot be added without
 * one. Every entry is a FUNCTION of the connection name — the sketch baked its own fixture's
 * connection name into the token_revoked sentence, and porting that as a constant would put a
 * fake customer's name into a real product. Same shape as `notAZipSentence(filename)`.
 *
 * ⚠ The fixture name itself is deliberately NOT spelled anywhere in this file, not even in a
 * comment: the suite's fence reads this source as text, and a literal inside a docblock is
 * still a literal (Pitfall 8 — the same trap the em dash falls into one file over).
 */
export const SENTENCE_FOR_CAUSE: Record<
  SourceFailureCause,
  (connectionName: string) => string
> = {
  token_revoked: (connectionName) =>
    `Access to ${named(connectionName)} was withdrawn — the connection needs to be authorised again.`,
  folder_gone: () => "The watched folder is no longer shared with this connection.",
  // ⚠ "the last three checks" is a claim about SOFT_FAILURE_THRESHOLD, which lives in
  //   `failure_cause.py`. The suite pins that constant at 3 so this sentence cannot quietly
  //   become a lie if the threshold moves.
  unreachable: () => "The server did not answer the last three checks.",
  unknown: () => UNKNOWN_SOURCE_FAILURE_SENTENCE,
}

/**
 * ⭐ D-235-11 — `cause → the ONE control`. DATA, never branches in the card.
 *
 * `action` is what the card wires; `label` is what it prints. They are separate because the
 * label is copy (it may be reworded) and the action is behaviour (it may not).
 */
export const CONTROL_FOR_CAUSE: Record<
  SourceFailureCause,
  { label: (connectionName: string) => string; action: "reconnect" | "repick_folder" | "retry" }
> = {
  token_revoked: {
    label: (connectionName) => `Reconnect ${named(connectionName)}`,
    action: "reconnect",
  },
  folder_gone: { label: () => "Pick a different folder", action: "repick_folder" },
  unreachable: { label: () => "Retry now", action: "retry" },
  unknown: { label: () => "Retry now", action: "retry" },
}

/**
 * Per-FILE failure reasons. Same five rules; names the FILE's state, not the extractor's
 * experience.
 *
 * ⚠ MEASURED AND STATED RATHER THAN SHIPPED SILENTLY (235-RESEARCH §3.5): the
 * `connector_watch_items.state` values `skipped_size` and `skipped_type` are written by
 * NOTHING today, so `too_big` has no producer yet. The sentence is ported because the
 * BUILD-CONTRACT pins it; the row that would show it does not exist. That is a gap in the
 * writer, not in this table.
 */
export const SENTENCE_FOR_FILE_FAILURE: Record<SourceFileFailureKind, string> = {
  password:
    "The file is password-protected — remove the password and it will be read on the next check.",
  too_big:
    "The file is larger than this library accepts — split it, or raise the limit in Settings.",
  unknown: UNKNOWN_SOURCE_FAILURE_SENTENCE,
}

// ── RECOGNITION ───────────────────────────────────────────────────────────────────────

/**
 * ⚠ Each matcher is deliberately BROAD ON THE FACT and NARROW ON THE WORDING, and the ORDER
 * is the resolution order — first match wins. The provider's prose is not ours and can be
 * reworded by a dependency upgrade, so each cause is reachable by more than one tell.
 *
 * ⚠ Authorisation is asked FIRST: "not found" appears inside some permission messages, and a
 * revoked token is both the more consequential verdict and the one whose control (Reconnect)
 * the other arm cannot reach.
 *
 * ⚠ This is the CLIENT half. `failure_cause.py` is the server half and is the one that decides
 * what gets STORED; this one exists for a `last_error` string that was written before the
 * classifier landed, and for a surface that has a message but no cause column to read.
 */
const MATCHERS: ReadonlyArray<{
  cause: Exclude<SourceFailureCause, "unknown">
  test: RegExp
}> = [
  {
    cause: "token_revoked",
    test: /invalid_grant|token (?:has been )?(?:expired|revoked)|(?:expired|revoked) (?:credentials|token)|unauthoriz|unauthoris|\b401\b|\b403\b|permission|insufficient (?:authentication )?scopes|access denied|forbidden/i,
  },
  {
    cause: "folder_gone",
    test: /not ?found|no longer shared|unshared|\b404\b|does not exist|has been (?:deleted|removed|trashed)/i,
  },
  {
    cause: "unreachable",
    test: /tim(?:ed|e) ?out|timeout|connection (?:reset|refused|aborted|error)|\b429\b|rate ?limit|quota exceeded|\b5\d\d\b|temporarily unavailable|service unavailable|backend ?error|try again later/i,
  },
]

/**
 * ⚠ THE TELLS OF MACHINE TEXT. Any hit means the string is NOT safe to show a person, whatever
 * else is true of it. Deny-by-default: the pass-through below requires ALL of these to miss.
 * (T-235-06 — provider internals, tokens, URLs and stack frames must never reach the screen.)
 */
const MACHINE_TELLS: readonly RegExp[] = [
  /[{}]/, //                                      a dict / JSON repr
  /['"](?:message|code|hint|details|error)['"]\s*:/i, // ... its keys, even without braces
  /\b\w*(?:Error|Exception)\b/, //                a Python / JS exception class
  /Traceback|File "|site-packages|\.py\b/i, //    a stack or a source path
  /psycopg|postgrest|asyncpg|supabase|httpx|urllib3|googleapiclient/i, // a driver / client
  /https?:\/\//i, //                              a URL, which is where tokens ride
  /\bya29\.|\bBearer\b|access_token|refresh_token|client_secret/i, // a credential fragment
  /<class '|object at 0x/i, //                    a Python repr
  /\b\d{3}\s+(?:Client|Server)\s+Error\b/i, //    an HTTP status line
]

/**
 * Is this string PROVABLY prose written for a person?
 *
 * ⚠ The question is asked in the positive on purpose. "Does it look machine-y?" fails open — a
 * provider message with no tell would be shown verbatim. This asks for proof and refuses
 * without it, so the worst case of an unrecognised message is the honest fallback, never a leak.
 */
export function looksHumanWritten(message: string): boolean {
  const trimmed = message.trim()
  if (trimmed.length < 10 || trimmed.length > 300) return false
  if (!/[.?]$/.test(trimmed)) return false
  return !MACHINE_TELLS.some((tell) => tell.test(trimmed))
}

/**
 * The cause a raw `last_error` describes. Exported so a suite can prove the classification
 * separately from the sentence it produces.
 */
export function classifySourceFailure(
  message: string | null | undefined,
): SourceFailureCause {
  if (!message || !message.trim()) return "unknown"
  const found = MATCHERS.find((m) => m.test.test(message))
  return found ? found.cause : "unknown"
}

/**
 * ⭐ THE ONE ENTRY POINT. A raw `last_error` in; ONE sentence a person can read out.
 *
 * Resolution order, and it matters:
 *   1. a RECOGNISED cause   → its own sentence (a provider-shaped string never survives here)
 *   2. provably human prose → itself, unchanged (the backend's own authored sentences)
 *   3. anything else        → the shipped honest fallback, never a guess
 */
export function sourceFailureSentence(
  message: string | null | undefined,
  connectionName: string,
): string {
  const cause = classifySourceFailure(message)
  if (cause !== "unknown") return SENTENCE_FOR_CAUSE[cause](connectionName)
  const raw = (message ?? "").trim()
  if (raw && looksHumanWritten(raw)) return raw
  return UNKNOWN_SOURCE_FAILURE_SENTENCE
}

// ── THE REST OF WHAT THE SOURCE SURFACES SAY ──────────────────────────────────────────

/**
 * ⭐ Ported from the sketch's own `COPY` object (`index.html:309-390`), NOT from the emitted
 * §1 table, which lists 18 of its 28 top-level keys (235-RESEARCH C-11). Two of those 28
 * (`cause`, `fileFail`) are hoisted above so they can be keyed by the union, leaving 26 here.
 *
 * Every interpolated value is a FUNCTION argument. Nothing here is a fixture.
 */
export const COPY = {
  // ── cadence — PINNED BY PHASE 234 (SURF-01). Byte-identical to the sentence shipped at
  //    `WatchedFoldersSection.tsx:305`. Do not reword.
  cadence: (m: number) => `checked every ${m} minutes`,

  // ── the outcome line. Replaces the word "scheduled", which described the REQUEST rather
  //    than the outcome (BUG-260906-02).
  checkedAgo: (ago: string, files: number) => `Checked ${ago} · ${files} files`,
  checkedNoChange: (ago: string) => `Checked ${ago} · no changes`,

  // ── the pending state. It says what was ASKED, never that work is happening.
  asked: (within: string) => `Asked · next check within ${within}`,

  // ── stopped. Says THAT it stopped, and WHEN it last succeeded.
  stopped: (ago: string) => `Stopped reading ${ago}`,
  lastGood: (when: string) => `Last read successfully on ${when}`,
  neverRead: "It has not read successfully yet.",

  // ── quiet runs collapse. Density is RENDERING, never storage — every tick has a row
  //    (D-235-07); the surface is what folds them.
  quietFold: (n: number) => `checked ${n} times, no changes`,
  showEvery: "Show every check",
  hideQuiet: "Hide quiet checks",

  // ── SEED-239 — a per-row boundary and a NAMED degraded row. A source that vanishes from
  //    its own list is the silence LIB-10 forbids.
  degraded: "This source could not be read here — the others are unaffected.",
  degradedAction: "Report this source",

  // ── the instance-level condition (D-235-12). Said ONCE, never repeated per row. The banner
  //    owns platform-wide truth; the row owns only what is true of that row.
  readerOffMember:
    "Automatic reading is switched off on this server. Watches are saved, and they will resume when it is switched back on.",
  // ⚠ THE ONE MARKED EXCEPTION TO RULE 4. See the docblock. The suite carves this out by name.
  readerOffOperator: "WATCH_PROCESS_ENABLED",
  readerOffRow: "Waiting — the reader is off",

  // ── the signal
  badgeTitle: (n: number) => (n === 1 ? "1 source stopped reading" : `${n} sources stopped reading`),
  popTitle: "Needs attention",
  popOpenHealth: "Open Library health",
  attentionTitle: "Sources needing attention",
  attentionEmpty: "Every source is reading.",
  goToSource: "Go to source",
  roster: (total: number, need: number) => `${total} connected, ${need} need you`,

  // ── ordinary controls
  syncNow: "Sync now",
  history: "History",
  hideHistory: "Hide history",
  collapse: "Collapse",
}
