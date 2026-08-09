#!/usr/bin/env node
/* ==========================================================================
 * check-gap-closure-rounds.cjs — the mechanical half of CLAUDE.md's G-7.
 * ==========================================================================
 * Why this exists (ratified 2026-08-04, at Phase 187's close):
 *   G-7 caps gap-closure ROUNDS the way G-1 caps phase INSERTS. Phase 187 ran
 *   FIVE rounds and went from 15 plans to 29 in three days; at round 5 BOTH
 *   remaining gaps lived in code round 5 had authored that same day, so a
 *   round 6 would have been 100% cleanup of round 5 — while every ROADMAP
 *   success criterion was already verified.
 *
 *   G-7 as prose binds the orchestrator's ROUTING. This script is the part a
 *   tired reader cannot talk themselves past: it counts the rounds from the
 *   repository itself and exits non-zero when another one is being started.
 *
 *   Structural sibling: scripts/vitest-count-gate.cjs — same shape (why/usage/
 *   notes header, explicit exit codes, named failure reasons, every number
 *   printed with the derivation that produced it, never a watch flag).
 *
 * THE TWO CHECKS
 *
 *   [round-cap]  Rounds already completed >= 2 and no unmet ROADMAP success
 *                criterion was named. Only an actually-unmet success criterion
 *                justifies a further round; everything else is triaged
 *                fast-fix / defer-to-next-phase / accept.
 *
 *   [new-capability-in-closure]
 *                A gap-closure plan's `files_modified` contains a non-test
 *                source file that did NOT exist when that plan was written.
 *                A closure round fixes shipped code; building a new surface
 *                inside one is a phase, not a gap — and it is how Phase 187
 *                shipped a blocker in `DescribeKbPicker.tsx`, a file with zero
 *                prior review cycles, during a round meant to CLOSE defects.
 *
 * HOW ROUNDS ARE DERIVED (printed on every run, so the number is auditable):
 *   `gap_closure_round:` frontmatter is authoritative WHERE PRESENT, but it is
 *   a late convention — Phase 187's rounds 1-4 carry only `gap_closure: true`.
 *   So the count is max(highest explicit round, number of distinct commits
 *   that ADDED gap-closure plan files). Each round is planned in one commit,
 *   which makes the commit count a sound floor when the field is missing.
 *
 * Usage:
 *   node scripts/check-gap-closure-rounds.cjs 187
 *   node scripts/check-gap-closure-rounds.cjs 187 --unmet-criterion "SC#3: a seeded grounded node does not get its gate"
 *   node scripts/check-gap-closure-rounds.cjs 187 --capability-approved "operator asked for the picker here, 2026-08-04"
 *
 * The two escape hatches are deliberately WORDED, not boolean. A flag that
 * takes a reason makes the override land in the shell history and in whatever
 * transcript records the command, which is what "never silently skipped" means
 * in CLAUDE.md's guardrail protocol. Record it under
 * STATE.md -> Guardrail overrides as well.
 *
 * Notes:
 *   - Read-only. Runs `git log` / `git cat-file` and reads .planning/. Writes
 *     nothing, needs no database, no backend, no network.
 *   - Phase argument matches the directory prefix, so "187" finds
 *     .planning/phases/187-business-vocabulary-ai-seeded-canvas.
 *
 * Exit codes: 0 = G-7 clear · 1 = G-7 fires · 2 = harness error.
 * ========================================================================== */

"use strict"

const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

const REPO_ROOT = path.resolve(__dirname, "..")
const PHASES_DIR = path.join(REPO_ROOT, ".planning", "phases")

const RED = "\x1b[31m"
const GRN = "\x1b[32m"
const YEL = "\x1b[33m"
const RST = "\x1b[0m"

/** The threshold G-7 names. Two rounds are allowed; the THIRD is what fires. */
const ROUND_CAP = 2

function fatal(message) {
  console.error(`FATAL: ${message}`)
  process.exit(2)
}

function git(args) {
  const res = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" })
  if (res.error) fatal(`git ${args.join(" ")} — ${res.error.message}`)
  return { ok: res.status === 0, out: (res.stdout || "").trim() }
}

/** Frontmatter only — the first `---` block. Never the body, which quotes fields in prose. */
function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8")
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return m ? m[1] : ""
}

function scalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.+)$`, "m"))
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null
}

/** A top-level YAML list: `files_modified:` followed by `  - path` lines. */
function list(fm, key) {
  const lines = fm.split(/\r?\n/)
  const start = lines.findIndex((l) => new RegExp(`^${key}:[ \\t]*$`).test(l))
  if (start < 0) return []
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    const item = lines[i].match(/^[ \t]+-[ \t]+(.+)$/)
    if (item) {
      out.push(item[1].trim().replace(/^["']|["']$/g, ""))
      continue
    }
    if (/^\S/.test(lines[i])) break
  }
  return out
}

/** Tests, planning artifacts and tooling are not "a new user-facing capability". */
function isSourceFile(p) {
  if (/(^|\/)\.planning\//.test(p)) return false
  if (/(^|\/)scripts\//.test(p)) return false
  if (/\.(test|spec)\.[jt]sx?$/.test(p)) return false
  if (/(^|\/)tests?\//.test(p)) return false
  if (/(^|\/)test_[^/]+\.py$/.test(p)) return false
  if (/\.(md|json|ya?ml|sql)$/.test(p)) return false
  return true
}

// ── Resolve the phase ────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const phaseArg = argv.find((a) => !a.startsWith("--"))
if (!phaseArg) fatal("usage: node scripts/check-gap-closure-rounds.cjs <phase> [--unmet-criterion \"…\"] [--capability-approved \"…\"]")

function flagValue(name) {
  const i = argv.indexOf(`--${name}`)
  if (i >= 0) return (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "").trim()
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(`--${name}=`.length).replace(/^["']|["']$/g, "").trim() : null
}

const unmetCriterion = flagValue("unmet-criterion")
const capabilityApproved = flagValue("capability-approved")

if (!fs.existsSync(PHASES_DIR)) fatal(`no .planning/phases directory at ${PHASES_DIR}`)
const phaseDirName = fs
  .readdirSync(PHASES_DIR)
  .find((d) => d === phaseArg || d.startsWith(`${phaseArg}-`))
if (!phaseDirName) fatal(`no phase directory matching "${phaseArg}" under .planning/phases`)

const phaseDir = path.join(PHASES_DIR, phaseDirName)
const relPhaseDir = path.relative(REPO_ROOT, phaseDir).split(path.sep).join("/")

// ── Collect the gap-closure plans ────────────────────────────────────────────

const plans = fs
  .readdirSync(phaseDir)
  .filter((f) => /-PLAN\.md$/.test(f))
  .sort()
  .map((f) => {
    const fm = frontmatter(path.join(phaseDir, f))
    return {
      file: f,
      rel: `${relPhaseDir}/${f}`,
      gap: scalar(fm, "gap_closure") === "true",
      round: Number.parseInt(scalar(fm, "gap_closure_round") ?? "", 10) || null,
      files: list(fm, "files_modified"),
    }
  })

const gapPlans = plans.filter((p) => p.gap)

console.log(`\nG-7 gap-closure round cap — ${phaseDirName}`)
console.log(`  plans: ${plans.length} total · ${gapPlans.length} gap-closure\n`)

if (gapPlans.length === 0) {
  console.log(`${GRN}G-7 clear${RST} — no gap-closure plans in this phase.\n`)
  process.exit(0)
}

// ── Derive the round count, and PRINT the derivation ─────────────────────────

const explicitRounds = gapPlans.map((p) => p.round).filter((r) => r !== null)
const explicitMax = explicitRounds.length ? Math.max(...explicitRounds) : 0

const addCommits = new Map()
for (const p of gapPlans) {
  const { ok, out } = git(["log", "--diff-filter=A", "--format=%h %ad", "--date=short", "-1", "--", p.rel])
  const key = ok && out ? out : "(uncommitted)"
  if (!addCommits.has(key)) addCommits.set(key, [])
  addCommits.get(key).push(p.file.replace(/-PLAN\.md$/, ""))
}

const roundsCompleted = Math.max(explicitMax, addCommits.size)

console.log("  rounds derived from:")
console.log(`    highest explicit gap_closure_round : ${explicitMax || "— (field absent on every gap plan)"}`)
console.log(`    distinct commits adding gap plans  : ${addCommits.size}`)
for (const [commit, ids] of addCommits) console.log(`      ${commit}  ${ids.join(", ")}`)
console.log(`    => rounds completed: ${roundsCompleted} (cap is ${ROUND_CAP})\n`)

// ── Check 2: a closure round that built something new ────────────────────────

const newCapabilities = []
for (const p of gapPlans) {
  const { ok, out } = git(["log", "--diff-filter=A", "--format=%H", "-1", "--", p.rel])
  if (!ok || !out) continue
  for (const f of p.files.filter(isSourceFile)) {
    const existed = git(["cat-file", "-e", `${out}:${f}`]).ok
    const existsNow = fs.existsSync(path.join(REPO_ROOT, f))
    if (!existed && existsNow) newCapabilities.push({ plan: p.file.replace(/-PLAN\.md$/, ""), file: f })
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────────

const failures = []

if (roundsCompleted >= ROUND_CAP) {
  if (unmetCriterion) {
    console.log(
      `${YEL}[round-cap] OVERRIDDEN${RST} — ${roundsCompleted} rounds completed, but an unmet success criterion was named:\n    "${unmetCriterion}"\n  Record this under STATE.md -> Guardrail overrides.\n`,
    )
  } else {
    failures.push(
      `[round-cap] ${roundsCompleted} gap-closure round(s) already completed (cap ${ROUND_CAP}).\n` +
        `    Do NOT route to /gsd:plan-phase ${phaseArg} --gaps. Triage each remaining finding as\n` +
        `    fast-fix (G-3: <=1 file, <=10 lines, no schema/API) / defer-to-next-phase / accept.\n` +
        `    Before deciding, report ROADMAP success-criteria status and date the offending code\n` +
        `    (git log --diff-filter=A -- <file>) — a gap in the LAST round's own output is a\n` +
        `    signal to stop, not to iterate.\n` +
        `    If a ROADMAP success criterion is genuinely unmet, re-run with:\n` +
        `      --unmet-criterion "SC#N: <what is not true>"`,
    )
  }
}

if (newCapabilities.length > 0) {
  const rows = newCapabilities.map((c) => `      ${c.plan} creates ${c.file}`).join("\n")
  if (capabilityApproved) {
    console.log(`${YEL}[new-capability-in-closure] OVERRIDDEN${RST} — "${capabilityApproved}"\n${rows}\n`)
  } else {
    failures.push(
      `[new-capability-in-closure] a gap-closure plan builds a source file that did not exist when it was written:\n` +
        `${rows}\n` +
        `    A closure round fixes shipped code. A new surface has had zero review cycles, which is\n` +
        `    how Phase 187 shipped CR-R5-01 inside a round meant to CLOSE defects. That is a phase,\n` +
        `    not a gap. If it genuinely belongs here, re-run with:\n` +
        `      --capability-approved "<why this surface belongs in a closure round>"`,
    )
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`${RED}FAIL${RST}  ${f}\n`)
  console.error(`${RED}G-7 fires${RST} — see CLAUDE.md § Workflow guardrails, rule G-7.\n`)
  process.exit(1)
}

// The closing line must not launder an override into a clean bill of health — a summary
// that says "nothing was found" when something was found and waved through is the same
// defect class as a comment that lies about its code (D-ITEM-183-02).
const overrides = []
if (roundsCompleted >= ROUND_CAP && unmetCriterion) overrides.push("[round-cap]")
if (newCapabilities.length > 0 && capabilityApproved) overrides.push("[new-capability-in-closure]")

if (overrides.length > 0) {
  console.log(
    `${YEL}G-7 passed WITH OVERRIDES${RST} — ${overrides.join(" + ")} waved through by an explicit reason, not by absence of a finding.\n` +
      `  Record each under STATE.md -> Guardrail overrides.\n`,
  )
} else {
  console.log(
    `${GRN}G-7 clear${RST} — ${roundsCompleted} round(s) completed, no new capability built inside a closure round.\n`,
  )
}
process.exit(0)
