---
status: partial
phase: 103-workflows-page-authoring-api-nl-authoring
source: [103-VERIFICATION.md]
started: 2026-06-14
updated: 2026-06-14
---

## Current Test

[awaiting human testing]

## Tests

### 1. Single-state-transition draft reveal
expected: In the Builder, typing a description and generating shows "Composing…" then the full read-only phase-spine graph appears in ONE DOM batch — no per-node animation/stagger, no half-rendered draft. An `ok:false`/thrown generate shows an honest "could not generate" with ZERO phase nodes (never a broken partial draft).

### 2. 400px push-panel geometry (responsive)
expected: At ≥1100px desktop the form panel PUSHES (the graph column shrinks; no horizontal scroll). At <768px it becomes a bottom-sheet. The panel never overlays the graph on desktop.

### 3. Read-only spine — behavioral drag backstop
expected: Pointer-dragging a phase node produces ZERO change to phase order (selection only). The "View only" badge + the verbatim "READ-ONLY GRAPH … inspect, don't drag" legend are visible. Exactly one dashed `skip_to_phase` branch renders when the definition has one.

### 4. Publish gauntlet — judge HARD WALL
expected: Run the publish gauntlet to a verdict. Force (or encounter) a judge block: per-criterion rows render, the 5 PublishVerdict fields show VERBATIM from the server, "publish anyway" appears only as struck-through text with NO enabled override/escape-hatch control. A judge-fail CANNOT publish. Polymorphic `named_failures` render per-stage (key-detection); an unknown shape renders as a generic block (never silently dropped).

### 5. Run lands in Chat as a REAL server-side run
expected: From a published workflow card, Run → the single-textarea modal (read-only project-folder chip + one textarea) → launches a NEW thread reusing the existing kickoff path; navigation completes to Chat AND `GET /threads/{id}/workflow` returns `mode: "harness"` (verify via DB :54322 or backend logs). One click = one thread (no double-submit).

### 6. Deep chat byte-identical lived-experience
expected: One normal (non-workflow) streaming chat turn behaves exactly as before — the workflows surface is additive and does NOT regress the Deep chat path. (Automated diff already confirms threads.py/anthropic_service.py byte-identical; this is the lived confirmation.)

### 7. SC#10 cross-provider NL-generation scoreboard (4-axis)
expected: Exercise the VALIDATION.md cross-provider rows LIVE — NL `POST /workflows/generate` across the provider axis (OpenAI / Anthropic / Google / OpenRouter representative + note the native-7 where relevant), with the multi-tool / parallel-thread / long-message axes. Each returns either a valid grounded draft (folder-scopes ⊆ project, tools/skills ∈ registry) OR an honest structured failure — never a partial/hallucinated draft. The strict-mode-400 risk (OpenAI/DeepSeek) must NOT recur (additive `strict=False` on the authoring shot).

## Known scope boundary (not a gap)

- **Publishing/refining an ALREADY-SAVED draft from the Workflows page is not wired** (code-review WR-01, deferred). The describe-first Builder is BIRTH-ONLY — the PublishGauntlet is reachable only within a fresh describe→draft→publish session and for the Tweak fork. Resuming an existing draft into the Builder is net-new "draft-resume" work outside REQ-5's describe-first scope. Re-open trigger: a SPEC/requirement that mandates resuming saved drafts.

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
