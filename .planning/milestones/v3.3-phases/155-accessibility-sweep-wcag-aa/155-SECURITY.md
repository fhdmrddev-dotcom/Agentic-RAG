---
phase: 155-accessibility-sweep-wcag-aa
requirement: A11Y-01
audited: 2026-07-16
asvs_level: L1
block_on: [critical, high]
threats_total: 20
threats_closed: 20
threats_open: 0
status: SECURED
register_authored_at_plan_time: true
---

# Phase 155 — Accessibility Sweep (WCAG AA): Security Audit (SECURITY.md)

Verification of every declared threat mitigation against the **implemented code** (not
documentation/intent). The register was authored at plan time across all 7 PLANs and is
treated as COMPLETE — this audit verifies dispositions, it does not scan for new threats.
Implementation files were READ-ONLY throughout.

**Result: SECURED.** 20/20 threats resolved (19 `mitigate` verified in code, 1 `accept`
boundary holds). 0 open. Diff scope confirmed against `git diff d53857f6..f13ee40c` — 81
non-`.planning` files, all under `frontend/**` + `.github/workflows/frontend-tests.yml`; no
`backend/**`, no `*.py`, no auth surface touched.

---

## Threat Verification

### 155-01 — supply-chain / CI (`package.json`, `package-lock.json`, `.github/workflows/frontend-tests.yml`)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-155-01-SC | Tampering (supply-chain) | mitigate | CLOSED | `frontend/package.json:69` pins EXACT `"eslint-plugin-jsx-a11y": "6.10.2"` (no `^`/`~`); `package-lock.json:6193-6221` resolves `6.10.2` from `registry.npmjs.org` with `sha512` integrity + `"dev": true`; the lock entry has NO `scripts`/`hasInstallScript` block → no pre/postinstall. jsx-eslint org package, RESEARCH slopcheck `[OK]`. |
| T-155-01-CI | Tampering (CI-config) | mitigate | CLOSED | Workflow diff is purely ADDITIVE: one step `Lint (jsx-a11y as errors)` → `npm run lint:a11y` appended to the existing vitest job. No new `secrets.*` referenced, no new third-party `uses:` action, `playwright` job unchanged (only its unmodified `needs: vitest` context shows in the hunk). |

### 155-02 — global token lift (`index.css`, admin cluster)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-155-02-VIS | Tampering (visual regression) | mitigate | CLOSED | `index.css:118` `--muted-foreground-dim: 220 16% 70%` (lifted from `45%`), WHY-commented to mirror the operator-approved 088-05 panel token (`#a6aebf → 8.42:1`); base `--muted-foreground: 220 16% 65%` intentionally left. D-07 operator eyeball recorded: `155-HUMAN-UAT.md:17` (test 1 "passed — Operator approved the retuned look at the D-07 checkpoint"). |
| T-155-02-G5 | Tampering (hot files) | mitigate | CLOSED | `git diff --name-only d53857f6 f13ee40c` shows NEITHER `MessageItem.tsx` nor `StreamsProvider.tsx`. RED LINE held. |
| T-155-02-FALSEGREEN | Repudiation (false-green) | mitigate | CLOSED | a11y suites are structural-only (see 04-FALSEGREEN). Contrast proven ONLY by the live Chrome scan: `155-HUMAN-UAT.md:21` — 1,206 muted-text elements, min ratio 6.2:1, **0 failures** — never asserted from vitest. |

### 155-03 — aria labeling / lint-zero (shared primitives, icon buttons)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-155-03-INFO | Information Disclosure | mitigate | CLOSED | Every added `aria-label` in the diff is a UI verb / already-visible text ("Thread options", "Stop run", "New chat", "Delete document", "Row actions", …). The only templated ones (`MemorySection.tsx:167,224,233` `Edit/Delete ${entry.key}`) interpolate the memory KEY that is itself rendered visibly at `MemorySection.tsx:157` — no document IDs, user IDs, or secret values. |
| T-155-03-G5 | Tampering (hot files) | mitigate | CLOSED | Additive aria only; both hot files absent from `--name-only`. |
| T-155-03-SUPPRESS | Repudiation (false-green) | mitigate | CLOSED | **CRITICAL check:** `git grep "eslint-disable.*jsx-a11y" frontend/src` at HEAD = **0 matches**. The only inline disables in scope target `react-hooks/*`, `import/first`, `@typescript-eslint/*` — never jsx-a11y. Lint-zero reached by real fixes. |

### 155-04 — kill-switch / status suites (admin control-plane)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-155-04-FALSEGREEN | Repudiation (false-green) | mitigate | CLOSED | Every `*.a11y.test.tsx` header declares "STRUCTURAL rules only (no contrast assertion)"; `git grep -i contrast` over the a11y suites returns only these disclaimers — no "verify contrast" assertion exists in jsdom. |
| T-155-04-EXCLUDE | Repudiation (axe exclusion) | mitigate | CLOSED | Exactly TWO axe exclusions phase-wide, both per-rule + per-selector with a WHY comment AND mirrored in `155-VALIDATION.md:121-124` (D-14 register): `ModelRegistryTab.a11y.test.tsx:68` `empty-table-header` (best-practice rule, `th` named via `aria-label`) and `CitationUI.a11y.test.tsx:77` `nested-interactive` (nested Open-document button independently reachable). No global/blanket disable. |
| T-155-04-GUARD | Elevation of Privilege (adjacent) | **accept** | CLOSED (accepted-risk — boundary held) | The a11y suites make the destructive guard keyboard-operable via display/role assertions ONLY. `git diff --name-only` scope = `frontend/**` + `.github/**` exclusively — NO `backend/**`, NO `*.py`, NO auth/`require_operator` file in the diff; authorization is untouched. Accepted boundary confirmed intact. |

### 155-05 — governance / registry suites (audit, roster, model registry)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-155-05-FALSEGREEN | Repudiation (false-green) | mitigate | CLOSED | Same rule as 04-FALSEGREEN — structural-only suites, contrast proven live (`155-HUMAN-UAT.md:21`). |
| T-155-05-EXCLUDE | Repudiation (axe exclusion) | mitigate | CLOSED | `ModelRegistryTab.a11y.test.tsx:68` `empty-table-header` per-rule/per-selector exclusion is the 155-05 governance-surface case; WHY comment present + D-14 mirror (`155-VALIDATION.md:123`). |
| T-155-05-INFO | Information Disclosure | mitigate | CLOSED | Asserted accessible names are role verbs / already-visible field text ("Platform state", "Row actions", audit/roster row names). No label exposes a hidden ID or secret. |

### 155-06 — citation cluster (`CitationUI.a11y.test.tsx`, run modal, composer)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-155-06-XSS | Tampering (XSS) | mitigate | CLOSED | **CRITICAL check:** `CitationUI.a11y.test.tsx:282-286` asserts a passage containing HTML "renders as ESCAPED text — no injected element (auto-escaped, no innerHTML)"; suite header (`:106,125`) states markers are `document.createElement`-owned, NOT `dangerouslySetInnerHTML`. Phase 153's innerHTML drop is not reintroduced. |
| T-155-06-G5 | Tampering (hot files) | mitigate | CLOSED | Citation suite renders components directly; `MessageItem.tsx`/`StreamsProvider.tsx` absent from the diff. |
| T-155-06-FALSEGREEN | Repudiation (false-green) | mitigate | CLOSED | Structural-only; contrast + keyboard proven live (`155-HUMAN-UAT.md:21,29-45`). |

### 155-07 — app-wide className sweep (31 files, chat/studio/settings/ingestion/pages)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-155-07-G5 | Tampering (hot files) | mitigate | CLOSED | `MessageItem.tsx`/`StreamsProvider.tsx` absent from every commit in the diff; `ToolCallPanel.tsx` present but className-only (G-5-adjacent, allowed). |
| T-155-07-VIS | Tampering (visual regression) | mitigate | CLOSED | className-only edits onto the D-07-approved token — `155-07-SUMMARY.md` self-check: swept files carry full-opacity `text-muted-foreground`, no layout/structure change, 20 residuals all documented exemptions. |
| T-155-07-FALSEGREEN | Repudiation (false-green) | mitigate | CLOSED | App-wide color-contrast zero proven ONLY by the live Chrome scan (`155-HUMAN-UAT.md:21` — 1,206 elements, 0 failures), never claimed from vitest. |

---

## Code-Review Findings (context — remediation confirmed in HEAD)

`155-REVIEW.md` opened `issues_found` (1 Critical + 3 Warnings). All fixes are present in the
committed HEAD (`f13ee40c`) and independently confirmed:

- **CR-01** (NavPanel thread-row Stop/options unreachable by keyboard — WCAG 2.1.1 A):
  `NavPanel.tsx:223` now carries `group-focus-within:opacity-100` → controls mount/reveal on
  keyboard focus. Live-verified per MEMORY + `155-VERIFICATION.md:79`.
- **WR-01** (hover-only reveal missing focus path): `MessageFeedback.tsx:76` +
  `MemorySection.tsx:218` (+ document row) now add `group-focus-within:opacity-100`.
- **WR-02 / WR-03**: addressed (`aria-pressed` scope, honest `InfoHint` comment — commit
  `ff0cde20`).

These are hardening, not part of the declared register; noted for completeness.

---

## Unregistered Flags

**None.** Both executor threat-surface self-reports declare no new attack surface:
`155-02-SUMMARY.md:143` and `155-07-SUMMARY.md:154` — "No new security-relevant surface."
Every changed file maps to a registered threat's disposition. No `unregistered_flag` logged.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-155-01 | T-155-04-GUARD | a11y hardening makes the Control-Plane destructive guard (kill-switch / Kill confirm) keyboard-operable via display/role assertions only. It does NOT change the `require_operator` backend authorization — diff scope is `frontend/**` + `.github/**` exclusively (no `backend/**`, no `*.py`, no auth file). The authorization boundary is untouched; the accepted residual is that the guard is now reachable by the accessibility tree, which is the intended WCAG outcome. | Operator (secure-phase gate) | 2026-07-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-16 | 20 | 20 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (19 mitigate / 1 accept)
- [x] Accepted risks documented in Accepted Risks Log (AR-155-01)
- [x] `threats_open: 0` confirmed
- [x] `status: SECURED` set in frontmatter

**Approval:** verified 2026-07-16

---

## Result

**SECURED — 20/20 threats CLOSED (19 mitigate verified in code, 1 accept boundary held), 0 open.**
No implementation gap. Phase 155 may ship on the security axis. (Note: the live-browser UAT half
was closed separately in `155-HUMAN-UAT.md` — status `accepted` 2026-07-16 — and is the source of
truth for the contrast/button-name proofs cited above.)
