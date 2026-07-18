# Governance — Audit Browser, Users & Access, Feature Visibility (Phase 148)

The governance slice of the Control Room (ADMIN-03 + VIS-01), inhabiting the locked 061-B
shell + 062-A receipts + the 066 graded-guard rule. Locked winners (all A, operator
2026-07-11): **067-A** (audit browser) + **068-A** (users) + **069-A** (visibility). These
sketches are the Phase 148 build contract (sketch-as-contract, no separate UI-SPEC).

## Design Decisions

### Audit browser (067-A — one browser, BOTH ledgers, chip filters + paged table)
- **The Audit tab gains a source switch**: *Operator actions* (`operator_audit_log`) |
  *Platform activity* (`audit_log` — the REAL 19-action CHECK vocabulary, migs 030+071),
  one filter/pagination/CSV grammar on both. Platform `audit_log` has NO operator read path
  today — the browse API is net-new.
- **Filter grammar = the 029-A chip strip**: `Show [action type] [when] [+user | ✎ changes-only]`
  — popover editors, a live match count (amber at zero), date presets (Today / 7d / 30d /
  All / custom) with a resolved-window readout (030-A heritage).
- **CSV export honesty**: the button always **names its row count**, exports exactly the
  FILTERED set, and the export ITSELF lands in the ledger (`audit.export` with the filter
  summary in the label).
- **Cross-user reading is visible, never silent**: switching to Platform activity records
  `audit.view_platform` + a quiet in-surface note ("looking at user activity is itself
  recorded") — the SC#4 service-role/no-RLS-backstop threat made legible.
- Plain-first action labels grouped Documents / Chat & agent / Organizing / Other; raw
  `action_type` codes behind ⌥ Technical names. Clicking a user in a platform row filters
  to them.

### Users & Access (068-A — instrument-table roster + graded guards)
- One dense table: identity (avatar + email + joined · docs · chats) · **last-active from
  `last_sign_in_at`** (recent=green, stale=dim, `never signed in` italic — never fabricated)
  · status chip · role chip · per-row actions. Search box; sorted newest-active first.
- **Disable = target-specific with a victim → the 064-B victim-naming sheet**: names the
  user, states the effect ("loses access immediately — sign-in refused, API refused,
  in-flight run cancelled"), states what is KEPT ("their documents, chats and settings are
  kept, untouched"), states reversibility, says it's recorded. **Enable = restorative →
  flips direct** (deliberate asymmetry).
- **Self-protection**: your own row's Disable / Remove-operator are disabled with a tooltip
  ("You cannot disable yourself") — the lockout-proof guard.
- Disable rides the **GoTrue ban mechanism (`banned_until`) + an app-layer check** so
  "cannot access the app" is API-enforced. The disabled row shows what THAT user sees
  ("This account is disabled — contact your administrator").
- **Grant/revoke operator** (scope-flagged "ratify at discuss"; mig 095 `granted_by`
  anticipated it): an AMBER sheet naming the blast radius ("they can see every user's
  activity, kill anyone's runs…"); revoke keeps their normal account; past operator actions
  stay in the trail forever.
- Every write → row flips to a `✎ … · recorded` receipt + band-marker flash (062-A).

### Feature visibility (069-A — audience rows on Users & Access, API-enforced)
- **Home = the Users & Access tab, below the roster** (visibility governs WHO — the 065-A
  location-carries-meaning rule). The in-Controls placement was sketched as a foil and
  REJECTED: "OFF for everyone" (kill-switch) and "Operators only" (visibility) must never
  be styling-only neighbors.
- One card per advanced feature with a **two-position audience control**
  (*Everyone* | *⛨ Operators only*). Flipping to operators-only reveals a concrete
  consequence line ("End users no longer see X — and their API calls to it are **refused
  server-side**, not just hidden") + an expandable "what exactly this controls" (UI surface ·
  refused API · who decides; route prefixes behind ⌥).
- **Enforcement = a require-visible dependency on each feature router**, reading the same
  `app_settings` TTL substrate as the 147 kill-switches (no new flag infra); default-deny
  posture like `require_operator` (403-vs-404 = discuss decision). Every flip = ✎
  `visibility.set`, direct with receipt (reversible, no victim — 066 graded-guard rule).
- **Day-one map**: Skill Studio (ONE flag covers "eval studio" + "trigger tuner" — the
  tuner is a Studio tab per 057-A) · model management (Settings AI-model/embedding/engine-
  health sections) · workflow authoring & publishing (additive scope; **Run stays for
  everyone**) · governance health.
- **THE EXTENSIBLE-AUDIENCE FORWARD-COMPAT CONTRACT (operator directive, Glean-grounded):**
  Glean's reference model = IdP/directory groups (departments) → group-based **feature
  greenlists** → permission-aware per-request doc checks. Our two-position control is the
  degenerate two-audience case, so: (1) the stored audience value is an **extensible
  enum-shaped record, NEVER a boolean**; (2) the segmented control is designed to grow into
  an audience picker; (3) `require_visible` resolves audience via ONE swappable function
  ("is operator" → "is in group X" at one boundary); (4) the roster role column is a
  chip-set. Doc-level ACL mirroring = v3.4+ (SEED-115).
- 069-B's live end-user preview (mini-app + 200→404 API probe) = documented enhancement
  (a later "view as user" affordance), not day-one scope.

## CSS Patterns

```css
/* Source switch (audit) — segmented, count-annotated */
.source-switch { display: inline-flex; background: var(--color-muted);
  border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 3px; }
.source-switch button.on { background: var(--color-surface-hi); color: var(--color-text);
  font-weight: 600; box-shadow: var(--shadow-sm); }

/* Filter chips (029-A heritage) */
.f-chip { display: inline-flex; gap: 7px; background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 5px 12px; }
.writes-chip.on { color: var(--color-warning); border-color: hsl(38 92% 60% / 0.4);
  background: var(--color-warning-dim); }        /* ✎ changes only */

/* Roster status/role chips */
.u-status.active   { color: var(--color-success); background: var(--color-success-dim); }
.u-status.disabled { color: var(--color-danger);  background: var(--color-danger-dim);
  border: 1px solid hsl(0 72% 51% / 0.3); }
.u-role { color: var(--color-warning); background: var(--color-warning-dim);
  border: 1px solid hsl(38 92% 60% / 0.3); border-radius: var(--radius-full); } /* ⛨ operator */
.last-active.recent { color: var(--color-success); }
.last-active.never  { font-style: italic; }

/* Audience segmented control (visibility ≠ kill-switch red) */
.aud-seg button.on.everyone { background: var(--color-success-dim); color: var(--color-success); }
.aud-seg button.on.ops      { background: var(--color-warning-dim); color: var(--color-warning); }
.feat-card.op-only { border-color: hsl(38 92% 60% / 0.3); }   /* amber-warmed, never red */
```

## HTML Structures

- Audit row (operator source): `[when mono] [✎? label] [operator email right]`; platform
  source: `[when] [user — click to filter] [label + detail + ⌥code]`. Pager: `‹ Prev ·
  page i of N · Next ›`.
- Roster row: `[avatar] [email / joined · docs · chats] [last-active] [status] [role] [actions]`
  with the confirm sheet absolutely anchored to the row.
- Feature card: `[glyph] [name / desc · lives on X] [receipt?] [audience seg]` +
  consequence line + `<details>` enforcement grid.

## What to Avoid

- **Two audit UIs** — one browser, a source switch; never a separate platform-activity page.
- **Silent cross-user reads** — viewing platform activity must itself be recorded + noted.
- **A bare Disable toggle** (needs the victim-naming sheet) or a guarded Enable (restorative
  actions flip direct).
- **Boolean visibility storage** — kills the v3.4 roles/departments path (the contract).
- **Placing the visibility map next to kill-switches** (the rejected 069-C foil).
- Letting an operator disable/demote themselves; fabricating last-active for never-signed-in
  users; exporting more than the filtered set.
- Day-grouped feed (067-B) / query-rail explorer (067-C) — documented alternatives;
  B's day-headers are a possible later graft onto A's table.

## Origin

Synthesized from sketches: 067, 068, 069 (Phase 148; operator-locked 2026-07-11; winners
all A). Source files: `sources/067-audit-browser/`, `sources/068-users-and-access/`,
`sources/069-feature-visibility/`. Forward-compat seed: `.planning/seeds/SEED-115-…`.
MANIFEST Running Design Decisions 57–59 carry the authoritative build contract.
