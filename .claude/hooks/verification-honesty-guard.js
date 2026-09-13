#!/usr/bin/env node
/**
 * verification-honesty-guard.js — PostToolUse hook: DEBT-03's teeth, fired where verifications are
 * authored (Phase 245, D-03).
 *
 * Fires ONLY when the write touched a `*-VERIFICATION.md` that is INSIDE
 * `scripts/check-verification-honesty.cjs`'s declared boundary, so every other edit in the
 * repository costs one string comparison and nothing else.
 *
 * WHY THIS EXISTS
 * ---------------
 * `OV-SOLO-01` rules that solo running continues, on the condition that every phase closed under it
 * reads **"self-verified"** in its own VERIFICATION.md — never "reviewed". That condition was carried
 * by memory: 243 and 244 wrote it down because those phases remembered; 238, 240 and 241 did not,
 * and nothing noticed for days. ⚠ The previous version of OV-SOLO-01 carried a date-based re-arm
 * trigger that arrived and was not acted on — *"which is precisely how a self-verification comes to
 * read like a review."*
 *
 * WHY A HOOK AND NOT CI
 * ---------------------
 * It fires in the turn the verifier authors the file, while the author still holds the reason.
 * CLAUDE.md's measured argument applies directly: `develop` once ran **634 commits over 8 days
 * without a push**, so an `on: push` gate could not have fired once in that window — and a
 * verification written, committed and acted upon inside one session would slip past it entirely.
 * ⛔ No CI backstop was added by Phase 245 (D-03's rejected third option: a second file to keep in
 * sync over a planning-doc rule).
 *
 * WHY IT IS NOT A PreToolUse BLOCKER
 * ----------------------------------
 * A verifier writing a VERIFICATION.md is doing exactly the right thing and merely owes one field.
 * ⛔ A hook must never deny that write — denying it would trade a missing line for a lost verdict.
 * So this reports LOUDLY and IN-TURN, and always exits 0. Same posture as `claude-md-size-guard.js`
 * and `hot-file-ledger-guard.js`.
 *
 * ⛔ THE REGEX MUST NOT BE WIDER THAN THE GATE'S OWN BOUNDARY. A naive
 * `/\.planning\/.*-VERIFICATION\.md$/` matches **all 218** such files, including the **212 the gate's
 * header declares OUT OF BOUNDS**; each would be handed to `--files`, found to lack
 * `verification_mode`, and red — a loud finding on a file the design deliberately excludes, on every
 * archived-milestone edit forever. Hence the narrow active-milestone regex plus the three pinned
 * paths below.
 *
 * ⚠ BELT AND BRACES, because a regex here and a boundary there can drift apart: the gate ITSELF
 *   prints `outside boundary — skipped` and contributes no finding for any path that is neither under
 *   `.planning/phases/<phase>/` nor pinned. The boundary is defined in ONE place semantically
 *   (the gate's header) and enforced in TWO places mechanically, and neither can quietly widen the
 *   other — an over-narrow hook merely stays silent (scan mode still catches the file), and an
 *   over-wide hook is absorbed by the gate's own skip.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/** The three archived paths DEBT-03 names. Kept in sync with scripts/check-verification-honesty.cjs;
 *  a drift here cannot produce a false finding — only a silent hook — because the gate re-checks. */
const PINNED_SUFFIXES = [
  '.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md',
  '.planning/milestones/v4.0-phases/240-mail-is-a-shape-not-a-fourth-adapter/240-VERIFICATION.md',
  '.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-VERIFICATION.md',
];

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const input = JSON.parse(raw || '{}');
    filePath = (input.tool_input && (input.tool_input.file_path || input.tool_input.filePath)) || '';
  } catch {
    process.exit(0); // never break the turn on a parse failure
  }

  const norm = String(filePath).split(path.sep).join('/');

  // ONE boundary test, then out. The active-milestone half is exactly one directory level deep,
  // matching ACTIVE_RE in the gate; the archived half is the three pinned paths and nothing else.
  const active = /\.planning\/phases\/[^/]+\/[^/]*-VERIFICATION\.md$/.test(norm);
  const pinned = PINNED_SUFFIXES.some((s) => norm.endsWith(s));
  if (!active && !pinned) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const gate = path.join(root, 'scripts', 'check-verification-honesty.cjs');
  if (!fs.existsSync(gate)) process.exit(0);

  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [gate, '--files', norm], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    code = typeof e.status === 'number' ? e.status : 2;
  }

  if (code === 0) process.exit(0); // clear — say nothing, cost nothing

  const additionalContext = [
    code === 1
      ? 'DEBT-03 VERIFICATION HONESTY — this VERIFICATION.md does not say how it was verified.'
      : 'DEBT-03 VERIFICATION HONESTY — the gate could not run (harness error).',
    '',
    out.trim(),
    '',
    'A VERIFICATION.md without `verification_mode` is not under-documented — it is a',
    'self-verification that every future reader, and every scan, will take for a review.',
    'OV-SOLO-01 permits solo running ONLY on the condition that each phase says so in its own record.',
    '',
    'Add this line to the frontmatter, immediately after `verified:`:',
    '',
    '  verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.',
    '',
    '⛔ Do NOT satisfy it by editing body prose. Every honest sentence naming an owed review must',
    '   stay — deleting them destroys the record the marker exists to index (D-01).',
    'Verify with: node scripts/check-verification-honesty.cjs --files ' + norm,
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext,
        honesty_gate_exit: code,
        file_path: norm,
      },
    })
  );
  process.exit(0);
});
