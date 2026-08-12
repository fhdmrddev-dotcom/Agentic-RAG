/**
 * Phase 192.1-04 Task 3 (LIB-05 / SC#1 — D-25 / D-26 / D-30) — THE LIBRARY AT REAL SHAPE.
 *
 * ── WHY THIS EXISTS, AND WHY SIZE WAS NEVER THE PROBLEM ────────────────────────────────
 * Phase 192 tested this surface at 12 rows AND at 107 rows, passed every gate, and still
 * shipped a library the operator could not read. The ROADMAP's own words: **"volume was real,
 * shape was not."** Every fixture it used carried DISTINCT NAMES, so no assertion in it could
 * fail for the reason the surface fails in life — forty-three rows all called *Compliance Gap
 * Report*. That is the 045 real-scale lesson in a new costume, and it is now a standing
 * question for any list-rendering phase: **is the fixture's SHAPE realistic, not just its
 * SIZE?**
 *
 * ── THE DUPLICATES ARE NOT AUTHORED. THEY FALL OUT (D-25). ─────────────────────────────
 * This module does not type a list of repeated names. It applies the two fork rules the app
 * really implements, and the collisions are their CONSEQUENCE — which is the whole point,
 * because it is also how they arise in the product:
 *
 *   copyFork(source)     slug = `${source.slug}-${hash6}`   version = 1   (onUseStarter)
 *   versionFork(source)  slug = source.slug                 version = N+1 (onTweak)
 *
 * BOTH spread `...def` and COPY THE NAME VERBATIM; nothing in either path differentiates it.
 * 43 rows named *Compliance Gap Report* is not corrupt data — it is 42 correct forks of one
 * starter. The generator is ported from `.planning/sketches/themes/library-fixture-192-1.js`,
 * the same fixture the operator-approved sketches 160 / 161 / 162 / 163 argue over, so the
 * build and the acceptance bar reason about one dataset.
 *
 * ── THE SHAPE IS PINNED AND BOTH READINGS ARE CITED, NEVER READ LIVE ───────────────────
 * `canvasFixtures.ts:10-18`'s honesty clause applies verbatim here: two live reads of the
 * operator's database on the SAME DAY disagreed, so the artifact is pinned and both readings
 * are recorded rather than one being quietly preferred.
 *
 *   | Family                               | PINNED (D-30, re-measured 2026-08-12) | ROADMAP's earlier 2026-08-12 read |
 *   |--------------------------------------|---------------------------------------|-----------------------------------|
 *   | Compliance Gap Report                | 43 rows / 41 distinct slugs           | 43 / 41                           |
 *   | Risk Register                        | 11 / 10                               | 10 / 9                            |
 *   | Weekly Status Report                 |  9 / 6                                |  8 / 5                            |
 *   | Project Meridian Risk Summary (GOOD) |  8 / 4                                |  8 / 4                            |
 *   | duplicated names                     | 14                                    | 14                                |
 *   | merged rows                          | 106                                   | 107                               |
 *
 * The PINNED column is what this module produces. A fixture asserting numbers the database no
 * longer shows invites a future "correction" that silently weakens the shape, so the number
 * that is wrong is named here instead of being deleted.
 *
 * ── MEASURED FROM THIS MODULE'S OWN OUTPUT, NOT FROM THE TABLE ABOVE ───────────────────
 * A script over `makeLibraryFixture()` (192.1-04, 2026-08-12) — the distinction matters,
 * because a header that quotes its target rather than its result is a claim, not a check:
 *
 *     total rows 106 · distinct names 27 · duplicated names 14 · rows under a duplicated name 93
 *     43 / 41  Compliance Gap Report
 *     11 / 10  Risk Register
 *      9 /  6  Weekly Status Report
 *      8 /  4  Project Meridian Risk Summary (GOOD)
 *     orphan slugs 7 · provenance { starter 3, published 61, draft 42 }
 *     isMine { true 58, false 6, undefined 42 }   ← all three readings present, per D-04
 *     rows inside the sub-3-day bands 5           ← seedRecent's four, plus one natural
 *     two calls structurally equal, and NOT aliased at the array or the row
 *
 * ⚠ THE ORPHAN COUNT IS OVER SLUGS, NOT ROWS, and the distinction is worth keeping straight:
 * `compliance-gap-report` carries BOTH a v1 starter (which renders no lineage — it is the
 * orphan) and a v2 draft (which resolves as a VERSION fork against that v1, because the
 * version rule is checked before the copy-shape rule). One slug, two rows, two different
 * lineage answers — which is precisely the case D-13 exists to get right.
 *
 * ── ⚠ THE ORPHAN SHAPE, WHICH THE GENERATOR CANNOT PRODUCE (D-26) ──────────────────────
 * The sketch's `lineageOf` short-circuits on a fixture-only `parentSlug` field
 * (`library-fixture-192-1.js:335`), so every slug it mints has a parent by construction and
 * NO generated row is ever an orphan. Production has no such field — it derives lineage from
 * the slug alone — and that is exactly what admits slugs whose last segment merely HAPPENS to
 * be six base-36 characters. Measured on the live local DB 2026-08-12: **69 slugs match the
 * copy shape, 57 resolve, 12 are false positives.** D-13's third lineage state — SILENCE — is
 * untested without them.
 *
 * ⚠ AND THE IMPORTANT ORPHAN IS `compliance-gap-report` ITSELF (C-3 / D-30). The base slug of
 * the 43-row family matches `^(.*)-[a-z0-9]{6}$` — `report` is six legal lowercase
 * alphanumerics — and `compliance-gap` does not exist. **So the family's TRUE ORIGINAL renders
 * NO lineage segment while its 43 copies say *"Copy of Compliance Gap Report"*.** That is
 * CORRECT under D-13, and it WILL read as a bug at UAT unless it is written down. It is
 * written down here. Two more family bases fall the same way and are listed under
 * `INHERENT_ORPHANS` below; two REAL-WORLD orphan rows (`pm-weekly-status-report`,
 * `risk-register-fill-101uat`) are appended explicitly, because no generator would mint them.
 *
 * ── WHAT THIS MODULE IS NOT ────────────────────────────────────────────────────────────
 * NO NEW DEPENDENCY (the `shapeGenerator.ts:19-22` clause, and the same rule 192-15 applied
 * when it declined a toast library): no property-testing library, no generator library, no
 * date library, and **no `Math.random`** — `mkRng` is a seeded LCG and `hash6` draws from it,
 * so the same call produces the same library on every machine and a failure names one row.
 * FRESH OBJECTS PER CALL (`shapeGenerator.ts:24-27`): everything is built inside the factory,
 * so two callers can never alias one another's rows.
 * NO I/O of any kind, and no `window`.
 *
 * ⚠ VERIFY THOSE NEGATIVES OVER NON-COMMENT CODE LINES, NOT WITH A RAW GREP. This module
 * necessarily NAMES `Math.random` three times — twice to say it is not used, once to record
 * that `freshHash()` really is `Math.random().toString(36)`, which is WHY `report` is a legal
 * six-character hash and the D-13 orphans exist. A whole-file needle therefore reds on the
 * prose documenting the rule it enforces. Measured here: raw 3, **CODE 0**. That is the 187-24
 * trap, and this is its fifth recorded instance in this repository (F1 had to become
 * AST-parsed; the `HighlightTitle` fence was written raw and observed RED against a comment;
 * `libraryFilter.test.ts:461-468` scopes its `token` fence the same way; 192.1-03 hit it on
 * three acceptance greps at once).
 *
 * ⚠ PLACEMENT IS LOAD-BEARING. This file lives in `__fixtures__/`, a SUBDIRECTORY, and
 * `librarySubtree.fences.test.ts`'s corpus glob (`:96`) is `./*.{ts,tsx}` — **non-recursive**.
 * So the fixture is provably OUTSIDE the F1 / F4 / F5 sweep and must NOT be added to
 * `LIBRARY_SUBTREE_PATHS`: a listed path with no matching glob key contributes the empty
 * string forever, which reads as swept and is not. It is test-only, ships to no user and
 * renders nothing, so nothing the sweep protects applies to it. The shipped precedent for the
 * directory is `workflows/__fixtures__/shapeGenerator.ts:147`.
 *
 * ⚠ TWO SKETCH NUMBERS THAT ARE NOT WHAT THEY LOOK LIKE, recorded so they are not ported:
 * `BUILD-CONTRACT.generated.md` says `cards rendered: 108` — that is 107 plus the row the
 * 162-B drive really created, NOT the fixture size. And `lines carrying '1 of N': 94` was
 * measured at those 108 cards; re-derive it from THIS fixture rather than pinning 94.
 */
import type { DefShape } from "@/components/workflows/soulData"
import type { LibraryRow, Provenance } from "../libraryRow"

// ── the deterministic core, ported verbatim ──────────────────────────────────────────

/**
 * The sketch's seeded LCG (`library-fixture-192-1.js:60-66`). `s * 1664525` peaks at
 * ~7.15e15, inside `Number.MAX_SAFE_INTEGER` (~9.01e15), so the multiply is exact and the
 * sequence is reproducible rather than merely stable-looking.
 */
function mkRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** The seed the sketches use, so this fixture and the approved mockups agree row for row. */
const SEED = 19821

/** The sketch's fixed "today" — a fixture with a live clock is not a fixture. */
export const FIXTURE_NOW = Date.UTC(2026, 7, 12, 9, 30)

const DAY = 86_400_000

type TierName = "STRICT" | "MIDDLE" | "LOOSE"
type Deliverable = "file" | "answer"

/** The seven shipped phase types (`soulData.ts` PHASE_GLYPHS keys). */
type PhaseType =
  | "programmatic"
  | "llm_single"
  | "llm_agent"
  | "llm_batch_agents"
  | "llm_human_input"
  | "llm_emit"
  | "external_action"

/**
 * ⚠ THE TIER IS DERIVED, NOT DECLARED — SO THE FIXTURE MUST MAKE IT DERIVABLE.
 *
 * The sketch carries a free-standing `tierId` string on each row. The app has no such field:
 * `tierForDefinition` (`soulData.ts:111`) reads the STRICTEST `citation_policy` across the
 * definition's `llm_emit` phases and hands it to `deriveTier`. A fixture that set a label
 * would prove nothing about the *Strict* chip, so this table maps the intended tier onto the
 * emit phase's real policy and lets the shipped derivation answer.
 */
const POLICY_FOR: Record<TierName, string> = {
  STRICT: "strict",
  MIDDLE: "flag",
  LOOSE: "draft",
}

const PROJECTS: { id: string | null; name: string | null }[] = [
  { id: "p-legal", name: "Legal" },
  { id: "p-people", name: "People Ops" },
  { id: "p-fin", name: "Finance" },
  { id: "p-risk", name: "Risk & Compliance" },
  { id: "p-cs", name: "Customer Success" },
  { id: null, name: null },
]

// ── the working record: the generator's bookkeeping, NOT the exported shape ───────────

/**
 * ⚠ `parentSlug` AND `forkKind` LIVE HERE AND NOWHERE ELSE, AND THAT IS THE DECISION.
 *
 * They are fixture-only: `LibraryRow` has no equivalent and neither does the wire. Emitting
 * them would let a resolver's tests pass against data production never sees — the resolver
 * would read a field instead of deriving lineage from the slug, and the D-13 orphan case
 * (where the slug LIES about having a parent) could never arise. The generator uses them to
 * build a coherent library; `toLibraryRow` drops them on the way out.
 */
interface Seed {
  id: string
  slug: string
  name: string
  version: number
  provenance: Provenance
  /** Internal bookkeeping. The EXPORTED row follows `fromDraft`'s rule instead — see below. */
  mine: boolean
  projectId: string | null
  updatedAt: number
  purpose: string
  tier: TierName
  deliverable: Deliverable
  chain: PhaseType[]
  parentSlug: string | null
  forkKind: "copy" | "version" | null
}

interface FamilySpec {
  name: string
  slug: string
  starter?: boolean
  total: number
  versions: number
  tier: TierName
  deliverable: Deliverable
  chain: PhaseType[]
  purpose: string
}

/**
 * THE 14 DUPLICATED NAMES, at D-30's pinned multiplicities.
 *
 * `total` is the family's row count and `versions` how many of them are version forks; the
 * rest are copy forks, so `distinct slugs === total - versions`. The four named families
 * therefore land on 43/41 · 11/10 · 9/6 · 8/4 by arithmetic rather than by hope.
 */
const FAMILIES: FamilySpec[] = [
  {
    name: "Compliance Gap Report",
    slug: "compliance-gap-report",
    starter: true,
    total: 43,
    versions: 2,
    tier: "STRICT",
    deliverable: "file",
    chain: ["llm_agent", "llm_single", "llm_emit"],
    purpose: "Find where our controls fall short of the framework and write it up for the auditor.",
  },
  {
    name: "Risk Register",
    slug: "risk-register",
    total: 11,
    versions: 1,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["llm_agent", "programmatic", "llm_emit"],
    purpose: "Keep one ranked list of open risks with owners and review dates.",
  },
  {
    name: "Weekly Status Report",
    slug: "weekly-status-report",
    starter: true,
    total: 9,
    versions: 3,
    tier: "LOOSE",
    deliverable: "file",
    chain: ["llm_single", "llm_emit"],
    purpose: "Turn this week's activity into a short report the leadership team reads on Monday.",
  },
  {
    name: "Project Meridian Risk Summary (GOOD)",
    slug: "meridian-risk-summary-good",
    total: 8,
    versions: 4,
    tier: "STRICT",
    deliverable: "file",
    chain: ["llm_agent", "llm_human_input", "llm_emit"],
    purpose: "Summarise Meridian's open risks with a citation for every claim.",
  },
  {
    name: "Vendor Risk Review",
    slug: "vendor-risk-review",
    total: 3,
    versions: 1,
    tier: "STRICT",
    deliverable: "file",
    chain: ["llm_agent", "llm_single", "llm_emit"],
    purpose: "Assess a vendor against our security requirements before renewal.",
  },
  {
    name: "Quarterly Board Pack",
    slug: "quarterly-board-pack",
    total: 3,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["llm_batch_agents", "llm_single", "llm_emit"],
    purpose: "Assemble the board deck from the quarter's numbers and commentary.",
  },
  {
    name: "Incident Postmortem",
    slug: "incident-postmortem",
    total: 2,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["llm_agent", "llm_emit"],
    purpose: "Write the blameless postmortem from the incident timeline.",
  },
  {
    name: "Onboarding Checklist",
    slug: "onboarding-checklist",
    starter: true,
    total: 2,
    versions: 1,
    tier: "LOOSE",
    deliverable: "file",
    chain: ["llm_single", "llm_emit"],
    purpose: "Produce a first-week checklist for a new starter in this team.",
  },
  {
    name: "Contract Renewal Brief",
    slug: "contract-renewal-brief",
    total: 2,
    versions: 1,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["llm_agent", "llm_emit"],
    purpose: "Brief the owner on what changes if we renew this contract as written.",
  },
  {
    name: "SOC 2 Evidence Pull",
    slug: "soc2-evidence-pull",
    total: 2,
    versions: 0,
    tier: "STRICT",
    deliverable: "file",
    chain: ["programmatic", "llm_single", "llm_emit"],
    purpose: "Collect the evidence each SOC 2 control needs this cycle.",
  },
  {
    name: "Customer Health Summary",
    slug: "customer-health-summary",
    total: 2,
    versions: 0,
    tier: "LOOSE",
    deliverable: "answer",
    chain: ["llm_agent", "llm_single"],
    purpose: "Tell me how this account is really doing before the QBR.",
  },
  {
    name: "Data Retention Audit",
    slug: "data-retention-audit",
    total: 2,
    versions: 1,
    tier: "STRICT",
    deliverable: "file",
    chain: ["programmatic", "llm_agent", "llm_emit"],
    purpose: "Check what we are still storing past its retention window.",
  },
  {
    name: "Payroll Variance Note",
    slug: "payroll-variance-note",
    total: 2,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["programmatic", "llm_emit"],
    purpose: "Explain the month-on-month payroll movement in plain terms.",
  },
  {
    name: "Access Review Attestation",
    slug: "access-review-attestation",
    total: 2,
    versions: 1,
    tier: "STRICT",
    deliverable: "file",
    chain: ["llm_human_input", "llm_emit"],
    purpose: "Get each system owner to confirm who still needs access.",
  },
]

/**
 * THE SINGLETONS — names that appear exactly once. They are the CONTROL, and a corpus without
 * them proves nothing: *"a corpus where every row answers every predicate the same way makes
 * each assertion pass for the wrong reason"* (`libraryFilter.test.ts:34-38`). A design that
 * only works by shouting will make these noisy too, and that failure has to be visible.
 *
 * ⚠ MIDDLE-with-`answer` rows carry a `structure_check` VALIDATOR rather than a label: with no
 * emit phase the citation policy defaults to `draft`, and `deriveTier` lifts a draft policy to
 * MIDDLE only when a floor-raising structural gate is present. A **STRICT** row with no emit
 * phase is UNREACHABLE under the shipped derivation, so the sketch's STRICT *Offboarding Access
 * Sweep* is MIDDLE here — the fixture cannot carry a tier the product cannot produce.
 */
const SINGLETONS: FamilySpec[] = [
  {
    name: "Board Minutes Formatter",
    slug: "board-minutes-formatter",
    total: 1,
    versions: 0,
    tier: "LOOSE",
    deliverable: "file",
    chain: ["llm_single", "llm_emit"],
    purpose: "Turn raw meeting notes into minutes in our house format.",
  },
  {
    name: "Expense Policy Checker",
    slug: "expense-policy-checker",
    total: 1,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "answer",
    chain: ["llm_agent"],
    purpose: "Tell me whether this expense claim is inside policy, and which clause decides it.",
  },
  {
    name: "NDA Redline Assistant",
    slug: "nda-redline-assistant",
    total: 1,
    versions: 0,
    tier: "STRICT",
    deliverable: "file",
    chain: ["llm_agent", "llm_human_input", "llm_emit"],
    purpose: "Mark the clauses in this NDA that differ from our standard position.",
  },
  {
    name: "Churn Signal Digest",
    slug: "churn-signal-digest",
    total: 1,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "answer",
    chain: ["llm_agent", "llm_single"],
    purpose: "Surface the accounts showing early churn signals this week.",
  },
  {
    name: "Invoice Dispute Summary",
    slug: "invoice-dispute-summary",
    total: 1,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["llm_agent", "llm_emit"],
    purpose: "Lay out what each side claims on a disputed invoice.",
  },
  {
    name: "Security Questionnaire Reply",
    slug: "security-questionnaire-reply",
    total: 1,
    versions: 0,
    tier: "STRICT",
    deliverable: "file",
    chain: ["llm_agent", "llm_single", "llm_emit"],
    purpose: "Answer a customer's security questionnaire from our approved answer library.",
  },
  {
    name: "Headcount Plan Delta",
    slug: "headcount-plan-delta",
    total: 1,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["programmatic", "llm_emit"],
    purpose: "Show what changed between this headcount plan and the approved one.",
  },
  {
    name: "Renewal Risk Call Prep",
    slug: "renewal-risk-call-prep",
    total: 1,
    versions: 0,
    tier: "LOOSE",
    deliverable: "answer",
    chain: ["llm_agent"],
    purpose: "Prepare me for a renewal call with an account that has gone quiet.",
  },
  {
    name: "Audit Trail Extract",
    slug: "audit-trail-extract",
    total: 1,
    versions: 0,
    tier: "STRICT",
    deliverable: "file",
    chain: ["programmatic", "llm_emit"],
    purpose: "Pull the audit trail for a date range into the auditor's format.",
  },
  {
    name: "Supplier Diversity Report",
    slug: "supplier-diversity-report",
    total: 1,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["programmatic", "llm_single", "llm_emit"],
    purpose: "Report our spend split across supplier categories for the quarter.",
  },
  {
    name: "Offboarding Access Sweep",
    slug: "offboarding-access-sweep",
    total: 1,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "answer",
    chain: ["programmatic", "llm_agent"],
    purpose: "List everything a leaver still has access to.",
  },
]

/**
 * D-26 — THE TWO REAL-WORLD ORPHANS, appended explicitly because no generator mints them.
 *
 * Each slug matches `^(.*)-[a-z0-9]{6}$` and its captured base is ABSENT from the library, so
 * D-13's silence branch is the only honest reading. Both are real slugs from the operator's
 * database, named in CONTEXT D-26:
 *
 *   · `pm-weekly-status-report`      → base `pm-weekly-status`, absent. `report` is six legal
 *                                      lowercase alphanumerics.
 *   · `risk-register-fill-101uat`    → base `risk-register-fill`, absent. Note `risk-register`
 *                                      IS present — but the regex is greedy, so the captured
 *                                      base is the longer prefix, and that near-miss is
 *                                      exactly the kind of thing a hand-typed orphan misses.
 *
 * ⚠ THE CHARSET CANNOT BE NARROWED TO RESCUE THESE. `freshHash()` is
 * `Math.random().toString(36)` — genuinely `[a-z0-9]{6}` — so `report` is a legal hash and no
 * tightening of the pattern separates a real fork from a coincidence. The parent-exists guard
 * is load-bearing; the fallback is silence.
 */
const APPENDED_ORPHANS: FamilySpec[] = [
  {
    name: "PM Weekly Status Report",
    slug: "pm-weekly-status-report",
    total: 1,
    versions: 0,
    tier: "LOOSE",
    deliverable: "file",
    chain: ["llm_single", "llm_emit"],
    purpose: "Roll the programme's weekly notes into one status page.",
  },
  {
    name: "Risk Register Fill (101 UAT)",
    slug: "risk-register-fill-101uat",
    total: 1,
    versions: 0,
    tier: "MIDDLE",
    deliverable: "file",
    chain: ["programmatic", "llm_emit"],
    purpose: "Fill the risk-register template from a prepared spreadsheet.",
  },
]

/**
 * ⚠ THE ORPHANS THIS FIXTURE CARRIES WITHOUT BEING TOLD TO — measured over the slug table
 * above with the production rule, not asserted.
 *
 * Each of these is a family BASE or a singleton whose own slug happens to end in six legal
 * base-36 characters while its captured base is absent, so it renders no lineage segment. The
 * first is the one D-30 singles out and the one that will look like a bug at UAT.
 */
export const INHERENT_ORPHANS: readonly string[] = [
  "compliance-gap-report", // base `compliance-gap` — the 43-family's own original
  "weekly-status-report", // base `weekly-status`  — the 9-family's own original
  "vendor-risk-review", // base `vendor-risk`
  "churn-signal-digest", // base `churn-signal`
  "supplier-diversity-report", // base `supplier-diversity`
]

// ── the factory ──────────────────────────────────────────────────────────────────────

export interface LibraryFixtureOptions {
  /**
   * A CAP on the number of rows returned, in build order.
   *
   * ⚠ ANY CAP BELOW THE FULL SIZE LOSES THE PINNED SHAPE, and that is stated rather than
   * discovered: the families are built largest-first, so a small slice is 43 near-identical
   * rows and nothing else. Use a cap for a cheap smoke test; **never judge SC#1 on one.**
   */
  rows?: number
  /**
   * Whether to append D-26's two real-world orphan rows. Default `true`.
   *
   * ⚠ `false` DOES NOT PRODUCE AN ORPHAN-FREE LIBRARY, and believing it would is the trap.
   * Five slugs in the generated set are orphans by their own spelling (`INHERENT_ORPHANS`),
   * including the 43-family's own base. This flag omits only the two APPENDED rows.
   */
  orphans?: boolean
  /** The instant the timestamps are measured back from. Defaults to `FIXTURE_NOW`. */
  now?: number
}

/**
 * makeLibraryFixture — the merged library at the operator's measured shape.
 *
 * Deterministic (one seeded LCG per call, no `Math.random`), allocation-fresh (nothing is
 * shared between calls), and dependency-free.
 */
export function makeLibraryFixture(opts: LibraryFixtureOptions = {}): LibraryRow[] {
  const now = opts.now ?? FIXTURE_NOW
  const withOrphans = opts.orphans ?? true

  const rng = mkRng(SEED)
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)]
  const hash6 = (): string => {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789"
    let h = ""
    for (let i = 0; i < 6; i++) h += c[Math.floor(rng() * c.length)]
    return h
  }

  // ⚠ THE COUNTER IS PER-CALL, NOT MODULE-SCOPE. A module-level counter would make the ids
  // depend on how many times the fixture had been built earlier in the process, so two suites
  // in one worker would disagree about row `wf-0001` — determinism that holds only in
  // isolation is the kind that fails under `GSD_VITEST_MAX_WORKERS`.
  let uid = 0
  const mkId = (): string => {
    uid += 1
    return `wf-${String(uid).padStart(4, "0")}`
  }

  /** The family's own source row — v1, from the feed it was published on. */
  const makeSource = (spec: FamilySpec): Seed => {
    // ⚠ A STARTER CARRIES NO PROJECT, and that is production's rule rather than the sketch's:
    // `094_starter_workflows.sql` sets none on any of the three seeded rows, which is the very
    // fact D-17's toolbar note states out loud. The sketch picks a random project for starters
    // too; that would make the D-17 note describe data the fixture contradicts.
    const project = spec.starter ? { id: null, name: null } : pick(PROJECTS)
    return {
      id: mkId(),
      slug: spec.slug,
      name: spec.name,
      version: 1,
      provenance: spec.starter ? "starter" : "published",
      mine: !spec.starter,
      projectId: project.id,
      updatedAt: now - Math.floor(120 * rng() + 45) * DAY,
      purpose: spec.purpose,
      tier: spec.tier,
      deliverable: spec.deliverable,
      chain: spec.chain,
      parentSlug: null,
      forkKind: null,
    }
  }

  /** `onUseStarter` — a FRESH suffixed slug at v1. The name is copied VERBATIM. */
  const copyFork = (src: Seed): Seed => ({
    id: mkId(),
    slug: `${src.slug}-${hash6()}`,
    name: src.name, // ← THE DISEASE, and it is correct code
    version: 1,
    provenance: rng() < 0.45 ? "draft" : "published",
    mine: true,
    projectId: rng() < 0.55 ? src.projectId : pick(PROJECTS).id,
    updatedAt: now - Math.floor(rng() * 118) * DAY - Math.floor(rng() * DAY),
    purpose: src.purpose,
    tier: src.tier,
    deliverable: src.deliverable,
    chain: src.chain,
    parentSlug: src.slug,
    forkKind: "copy",
  })

  /** `onTweak` — the SAME slug at version N+1. The name is copied VERBATIM. */
  const versionFork = (src: Seed, nextVersion: number): Seed => ({
    id: mkId(),
    slug: src.slug, // ← same slug: this is the lineage key
    name: src.name,
    version: nextVersion,
    provenance: "draft",
    mine: true,
    projectId: src.projectId,
    updatedAt: now - Math.floor(rng() * 40) * DAY - Math.floor(rng() * DAY),
    purpose: src.purpose,
    tier: src.tier,
    deliverable: src.deliverable,
    chain: src.chain,
    parentSlug: src.slug,
    forkKind: "version",
  })

  const seeds: Seed[] = []

  for (const family of FAMILIES) {
    const src = makeSource(family)
    seeds.push(src)

    const copies: Seed[] = []
    const wantCopies = family.total - 1 - family.versions
    for (let i = 0; i < wantCopies; i++) {
      const copy = copyFork(src)
      copies.push(copy)
      seeds.push(copy)
    }
    // Version forks land on the source AND on some copies — which is exactly how one slug
    // ends up carrying two versions in the real table.
    for (let v = 0; v < family.versions; v++) {
      const target = v === 0 || copies.length === 0 ? src : copies[v % copies.length]
      seeds.push(versionFork(target, target.version + 1))
    }
  }

  for (const one of SINGLETONS) {
    const src = makeSource(one)
    // A singleton may belong to a colleague — the *Shared* half of the owner pill needs rows.
    src.mine = rng() < 0.75
    seeds.push(src)
  }

  if (withOrphans) for (const orphan of APPENDED_ORPHANS) seeds.push(makeSource(orphan))

  seedRecent(seeds, now)

  const rows = seeds.map(toLibraryRow)
  return typeof opts.rows === "number" ? rows.slice(0, opts.rows) : rows
}

/**
 * The sketch's `seedRecent` (`library-fixture-192-1.js:370-376`), KEPT — and it is not a
 * garnish. Without it the newest row is three weeks old, so `just now`, the hours band and
 * `yesterday` are all UNREACHABLE and SC#3's nine bands cannot be exercised against a
 * realistic library at all. Driven off `now`, so the fixture stays time-injectable.
 */
function seedRecent(seeds: Seed[], now: number): void {
  const mine = seeds.filter((s) => s.mine)
  if (mine[3]) mine[3].updatedAt = now - 42 * 60_000 // → the minutes band
  if (mine[11]) mine[11].updatedAt = now - 5 * 3_600_000 // → the hours band
  if (mine[27]) mine[27].updatedAt = now - 1 * DAY - 3 * 3_600_000 // → yesterday
  if (mine[40]) mine[40].updatedAt = now - 2 * DAY // → the days band
}

/** The definition JSONB, read-shaped — the source of the *Makes a file* and *Strict* chips. */
function defOf(seed: Seed): DefShape {
  const emitIndex = seed.chain.lastIndexOf("llm_emit")
  return {
    name: seed.name,
    business_requirement: seed.purpose,
    project_folder_id: seed.projectId,
    version: seed.version,
    phases: seed.chain.map((phaseType, i) => ({
      slug: `${phaseType}-${i}`,
      phase_index: i,
      config:
        i === emitIndex
          ? { phase_type: phaseType, citation_policy: POLICY_FOR[seed.tier] }
          : { phase_type: phaseType },
      // With no emit phase the policy defaults to `draft`; a floor-raising gate is the only
      // way a chat-deliverable workflow reaches MIDDLE. See the SINGLETONS docblock.
      validators:
        emitIndex === -1 && seed.tier !== "LOOSE" && i === seed.chain.length - 1
          ? [{ kind: "structure_check" }]
          : null,
    })),
  }
}

/**
 * A working record → the normalized row every `library/` module reads.
 *
 * ⚠ `isMine` FOLLOWS THE SHIPPED NORMALIZERS RATHER THAN THE SKETCH. `fromDraft`
 * (`libraryFilter.ts:97`) leaves it `undefined` on purpose — `/workflows/drafts` is already
 * scoped to `created_by = $1`, so the feed-derived fallback answers correctly without the row
 * asserting a bit no payload carried. A fixture that set `true` on every draft would hide the
 * fallback path entirely, and that path is D-04's whole point.
 *
 * ⚠ `parentSlug` and `forkKind` ARE DROPPED HERE. See the `Seed` docblock.
 */
function toLibraryRow(seed: Seed): LibraryRow {
  const def = defOf(seed)
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    version: seed.version,
    def,
    provenance: seed.provenance,
    isMine: seed.provenance === "draft" ? undefined : seed.mine,
    updatedAt: new Date(seed.updatedAt).toISOString(),
    // The original wire object, kept whole (`libraryRow.ts:115-120`). The fixture cannot build
    // a real `PublishedWorkflow` without importing the API client, so it carries the fields the
    // handlers actually reach for and casts, exactly as the house builder at
    // `WorkflowCard.test.tsx:99` does.
    source: {
      id: seed.id,
      slug: seed.slug,
      name: seed.name,
      definition: def,
      updated_at: new Date(seed.updatedAt).toISOString(),
      token: `${new Date(seed.updatedAt).toISOString()}#${seed.id}`,
    } as unknown as LibraryRow["source"],
  }
}

/**
 * THE OVERRIDE SEAM — one row, built the house way (`WorkflowCard.test.tsx:84-95`): a `...over`
 * spread last, and `as unknown as` casts for `def` and `source`. A suite that needs ONE odd row
 * beside the scale corpus injects it here instead of forking the fixture.
 */
export function libraryRowOf(over: Partial<LibraryRow> = {}): LibraryRow {
  const base = toLibraryRow({
    id: "wf-override",
    slug: "vendor-risk-review",
    name: "Vendor Risk Review",
    version: 1,
    provenance: "published",
    mine: true,
    projectId: "p-risk",
    updatedAt: FIXTURE_NOW - 5 * DAY,
    purpose: "Assess a vendor against our security requirements before renewal.",
    tier: "STRICT",
    deliverable: "file",
    chain: ["llm_agent", "llm_single", "llm_emit"],
    parentSlug: null,
    forkKind: null,
  })
  return { ...base, ...over }
}
