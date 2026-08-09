# Phase 177: v3.4 Org-Surface Polish - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 3 new shared primitives + 10 modified surfaces
**Analogs found:** 13 / 13 (every file has an in-repo analog — this is polish over shipped 166/167/168 code, so the analogs ARE the files being polished)

> **Nature of this phase:** cohesion/extraction refactor with behavior held **byte-identical**
> (D-01). There is no green-field file here — every "new" primitive is an EXTRACTION of code
> that already ships inline across 2–5 sibling files. The "analog" for a new primitive is the
> set of duplicated inline blocks it consolidates; the "analog" for a modified file is its own
> current body (what to preserve vs. what to swap for the shared primitive). Favor extraction
> over per-surface duplication (the sketch through-line).

---

## RED LINES (flag verbatim in every plan that touches these)

| Red line | Rule | Source |
|----------|------|--------|
| **StreamsProvider stream path** | `frontend/src/providers/StreamsProvider.tsx` is **OFF-LIMITS**. Org polish touches org/auth/nav/layout components only. `<OrgContext>` stays OUTSIDE the stream path (067.5 Branch-D3 / G-5 light). | D-02, CONTEXT `<code_context>` Integration Points |
| **Server contracts** | `/org/*`, `/org/sso/*`, `/invite` accept, `getSsoRoute` — **unchanged**. Render-gates stay courtesy-only; the server gates remain the wall (T-166-09 / T-167-17 / T-168-06). No new endpoints, packages, or migration. | D-01, D-02 |
| **Authz gates byte-identical** | No gate widened/loosened. `canManage` / `canManageSso` / `canInvite` / `canAuditView` polarity + call sites unchanged. Any authz change is OUT (own phase). | D-01 |
| **Honest behaviors preserved** | honest-ABSENT affordances (gone, never disabled), **link-first** delivery, **victim-naming** remove confirm, **fail-open** to password (never a lockout). Polish is visual/cohesion only. | D-06, D-10, D-13 |
| **Zone colors** | Org zone = **indigo** (`primary` / `indigo-400`). Operator zone = **amber** — RESERVED for `/admin`, never used in org surfaces. | D-07 |

---

## File Classification

### New shared primitives (extractions)

| New File (suggested) | Role | Data Flow | Consolidates (analog sources) | Match Quality |
|----------------------|------|-----------|-------------------------------|---------------|
| `frontend/src/components/org/StatusChip.tsx` | component (presentational) | transform (status → chip) | `InvitationsTab.tsx:51-75`, `SsoTab.tsx:52-75` + `OrgMembersTab.tsx:58-62` | exact (identical `CHIP_TONE_CLASS` in two files) |
| `frontend/src/components/org/OrgIdentity.tsx` (+ `RoleBadge`) | component (presentational) | transform (role → badge) / display | `OrgBand.tsx:46-87`, `ProfileMenu.tsx:56-142`, `InvitationsTab.tsx:43-49,254-266`, `OrgMembersTab.tsx:47-53,147-181` | exact (4-site duplicated role badge) |
| `frontend/src/components/auth/HonestNotice.tsx` (or `components/ui/`) | component (presentational) | transform (severity → callout) | `AcceptInvitePage.tsx:137-204`, `SignInForm.tsx:127`, `SsoTab.tsx:340-360` | role-match (ad-hoc per-state today) |

### Modified surfaces

| Modified File | Role | Data Flow | What Changes | Primitive(s) consumed |
|---------------|------|-----------|--------------|-----------------------|
| `frontend/src/components/org/OrgBand.tsx` | component | display | Swap inline role badge → `RoleBadge`; keep Shield/ORG-ADMIN chip, recording marker, ⌥ | `OrgIdentity`/`RoleBadge` (D-04) |
| `frontend/src/components/layout/ProfileMenu.tsx` | component | display | Swap inline header role badge → `RoleBadge`; **audit** honest-absent switcher (`>= 2` orgs) | `RoleBadge` (D-04); D-06 audit |
| `frontend/src/components/layout/NavPanel.tsx` | component | display | **Audit-only** honest-absent org shield (`canManage &&`) + indigo-vs-amber zone separation | none (D-06/D-07 audit) |
| `frontend/src/components/org/OrgMembersTab.tsx` | component | CRUD (read-only roster) | Swap inline role/adoption chips → `RoleBadge` + `StatusChip`; align row anatomy + 4px grid | `RoleBadge`, `StatusChip` (D-04/D-08/D-09) |
| `frontend/src/components/org/InvitationsTab.tsx` | component | CRUD (list + mutate) | Delete local `CHIP_TONE_CLASS`/`statusChip`/`roleLabel` → shared; snap row to shared anatomy; keep link-first | `StatusChip`, `RoleBadge` (D-08/D-09/D-10) |
| `frontend/src/components/org/SsoTab.tsx` | component | CRUD (list + mutate) | Delete local `CHIP_TONE_CLASS` + **retire UPPERCASE off-grid fork** → shared `StatusChip`; snap half-steps to 4px grid; keep victim-naming | `StatusChip` (D-08/D-09/D-10) |
| `frontend/src/components/org/InviteMemberDialog.tsx` | component | request-response (create) | Align role-picker chips + label spacing to shared 4px grid/vocab; keep link-first success | shared spacing/vocab (D-09/D-10) |
| `frontend/src/components/auth/SignInForm.tsx` | component | request-response (auth) | Error line + **add reassuring fail-open note** via `HonestNotice`; behavior byte-identical | `HonestNotice` (D-11/D-13) |
| `frontend/src/pages/AcceptInvitePage.tsx` | page | event-driven (accept flow) | Route all 6 states through `HonestNotice`; **recolor recoverable → calm** (not red); success → green | `HonestNotice` (D-11/D-12); shared shell (D-14) |
| `frontend/src/pages/AuthPage.tsx` | page | display | Consolidate brand-card shell drift with AcceptInvitePage (optional `AuthCardShell` extraction) | shared card shell (D-14) |

**Audit-only (no source change expected — verify at plan, do NOT touch if already correct):**
`frontend/src/components/org/OrgAdminShell.tsx` (already threads `role` → `OrgBand`; if OrgBand consumes `RoleBadge`, the shell is unchanged) · `frontend/src/providers/OrgProvider.tsx` (D-05 read: confirm role re-derives on switch — see Shared Patterns §D-05).

---

## Pattern Assignments

### NEW: `frontend/src/components/org/StatusChip.tsx` (component, transform) — D-08

**Structural analog:** `frontend/src/components/metadata/ConfidenceChip.tsx` — the shipped
precedent for a shared, tone-keyed, extracted chip primitive (props → variant map → one `<span>`).
Copy its shape: a `BASE_CLASSES` constant + a `Record<tone, string>` variant map + `cn(BASE, VARIANT[tone])`, `data-testid`/`data-state` for tests, glyph/word decoupling.

**Vocabulary analog (the exact tokens to lift):** `InvitationsTab.tsx:71-75` and `SsoTab.tsx:71-75`
— **byte-identical** maps (SsoTab's comment at line 70 even says "Identical to InvitationsTab's map; kept local"):

```typescript
type ChipTone = "primary" | "success" | "muted"

const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  muted: "border-border bg-muted/40 text-muted-foreground",
}
```

**Tone vocabulary (D-08 — bake into the component as the ONE mapping):**

| Tone | States | Meaning |
|------|--------|---------|
| `primary` (indigo) | Pending · Pending approval | live/waiting, needs attention |
| `success` (green) | Accepted · Active | positive terminal state |
| `muted` | Expired · Revoked · Disabled | calm terminal state |

**The base pill class (from `InvitationsTab.tsx:271-274`) — the grid-correct baseline to keep:**

```typescript
"inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
```

**RETIRE this fork (`SsoTab.tsx:302-310`) — the D-08/D-09 target.** SsoTab renders the SAME
tones but UPPERCASE, tracked, and on `py-1` (off the 4px `py-0.5` grid). Snap it to the
`StatusChip` baseline above (drop `uppercase tracking-wide`, `py-1` → `py-0.5`):

```typescript
// SsoTab.tsx:303-308 — the intentional off-grid UPPERCASE fork to REMOVE:
"inline-flex flex-none items-center rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide"
```

> NOTE: SsoTab's header comment (lines 25-29) documents this UPPERCASE/off-grid deviation as
> "gate-required intentional — do NOT fix them back." **D-08/D-09 explicitly OVERRIDE that
> instruction for phase 177** — the deviation is now the cohesion target. Update/remove that
> comment when you retire the fork so the next reader isn't misled.

**Status→(label,tone) mappers** live inline today and should move onto/beside the component
(keep them pure): `InvitationsTab.tsx:56-69` (`statusChip`), `SsoTab.tsx:57-67` (`statusChip`),
`OrgMembersTab.tsx:58-62` (`adoptionChip`). One shared mapping table, three call sites.

---

### NEW: `frontend/src/components/org/OrgIdentity.tsx` + `RoleBadge` (component, display) — D-04

**Analog: the role badge is duplicated at FOUR sites, byte-identical class strings.** Extract one
`RoleBadge` (and compose it into an `OrgIdentity` = avatar · name · badge). The four sources:

1. `OrgBand.tsx:46-49` (`isOrgAdminRole`) + `:78-87` (render)
2. `ProfileMenu.tsx:56-60` (`isOrgAdminRole` — comment says "mirrors OrgBand.isOrgAdminRole so the badge copy never disagrees") + `:133-142` (render)
3. `InvitationsTab.tsx:43-49` (`roleLabel`) + `:254-266` (render)
4. `OrgMembersTab.tsx:47-53` (`roleBadge`) + `:147-165` (render)

**The exact badge markup to consolidate (identical across all four):**

```tsx
// admin (org-admin / super-admin / dept-admin):
<span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
  <span aria-hidden="true">◆</span>
  Org-admin
</span>
// member (everything else):
<span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
  Member
</span>
```

**The role→label mapping (reconcile the 4-tier drift — D-04/D-166-05).** `OrgBand` + `ProfileMenu`
only distinguish admin/member; `InvitationsTab`/`OrgMembersTab` also emit `Dept-admin`. Unify on
the fuller mapping (`InvitationsTab.tsx:45-49` / `OrgMembersTab.tsx:49-53`):

```typescript
function roleBadge(role: string): { label: string; admin: boolean } {
  if (role === "org-admin" || role === "super-admin") return { label: "Org-admin", admin: true }
  if (role === "dept-admin") return { label: "Dept-admin", admin: true }
  return { label: "Member", admin: false }
}
```

**The avatar (initial-circle) atom** — duplicated in `InvitationsTab.tsx:236-241` and
`OrgMembersTab.tsx:193-198` (and a dashed pending variant at `OrgMembersTab.tsx:225-228`):

```tsx
<div aria-hidden="true"
  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-semibold text-white">
  {initial}
</div>
```

> NOTE: this hand-rolled gradient initial-circle is NOT the shadcn `components/ui/avatar.tsx`
> (that's an image-Avatar with a `bg-muted` fallback). Keep the gradient initial for the org
> identity primitive; do not swap to shadcn Avatar (behavior/look would change).

**Honest-absent + per-org role (D-05/D-06) — the primitive reads, never decides.** The role value
flows from `OrgProvider` → `role` (`OrgProvider.tsx:48,116`); managers gate on `canManage`
(`OrgProvider.tsx:51`). `RoleBadge`/`OrgIdentity` render whatever role prop they're handed — the
call site keeps the honest-absent gate (e.g. `NavPanel.tsx:190` `{canManage && ...}`). Do NOT move
gating into the primitive.

---

### NEW: `frontend/src/components/auth/HonestNotice.tsx` (component, transform) — D-11

**Analog: per-state ad-hoc callouts today** — `AcceptInvitePage.tsx:137-204` (6 states, each with
its own glyph + copy), `SignInForm.tsx:127` (bare `text-destructive` line), `SsoTab.tsx:340-360`
(the danger-weight victim-naming callout). Extract ONE severity-keyed notice.

**Severity vocabulary (D-11 — bake in as the ONE mapping):**

| Severity | Use | Tone tokens (lift from) | Glyph |
|----------|-----|-------------------------|-------|
| `calm` (muted) | recoverable dead-end (expired/revoked/invalid/missing-token) | `border-border bg-muted/40 text-muted-foreground` (StatusChip muted) | Info / AlertCircle (muted) — NOT AlertTriangle-red |
| `progress` (indigo) | in-progress (accepting, SSO redirect) | `border-primary/30 bg-primary/[0.06] text-primary` (see `InvitationsTab.tsx:311`) | `Loader2 animate-spin` (`AcceptInvitePage.tsx:151`) |
| `success` (green) | joined / already-member | `border-success/30 bg-success/10 text-success` (StatusChip success) | `CheckCircle2` (`AcceptInvitePage.tsx:160`) |
| `error` (danger, EARNED only) | genuine system error | `border-destructive/30 bg-destructive/[0.06] text-foreground` (`SsoTab.tsx:342`) | `AlertTriangle` |

**D-12 recolor — the highest-value polish.** Today `AcceptInvitePage.tsx:182,196` render the
recoverable `missing`/`error(409/404)` states with `AlertTriangle` + `text-muted-foreground` — the
copy is honest but the red-triangle glyph reads alarming. Route expired/revoked/invalid/missing
through `severity="calm"` ("ask for a fresh link"). Note the honest copy already exists verbatim at
`AcceptInvitePage.tsx:116-124` — **preserve it**, only reskin the container/glyph. Reserve
`severity="error"` weight for a genuine, non-recoverable system failure only.

**D-13 fail-open note (add, don't change behavior).** `SignInForm.tsx:42-46` already fails OPEN to
the password field on a route-lookup failure — that logic is byte-frozen (T-168-07 / SC#3). D-13
adds a reassuring `HonestNotice severity="calm"` near the revealed password field ("nothing's wrong
with your account") so the degrade is legible. The existing error copy at `SignInForm.tsx:54,93`
stays; the bare `text-destructive` line at `:127` becomes a `HonestNotice severity="error"`.

**D-14 shared card shell.** `AcceptInvitePage.tsx:206-227` is a verbatim clone of
`AuthPage.tsx:15-44` (same orbs `bg-primary/10` + `bg-violet-500/10 blur-3xl`, same
`Card ... ghost-border bg-card/80 backdrop-blur-sm`, same `gradient-primary` sparkle header).
Consolidate the drift — optionally extract an `AuthCardShell` both consume (Claude's discretion,
D-14). Keep each page's own title/subhead/body as children.

---

## Shared Patterns

### `cn()` + shadcn + lucide toolkit (the house style — apply to all 3 primitives)
**Source:** `frontend/src/lib/utils.ts:4` — `cn(...) = twMerge(clsx(inputs))`. Every primitive
composes classes via `cn(BASE, VARIANT[key])`, uses `lucide-react` glyphs (`aria-hidden="true"`),
and pulls shadcn kit from `@/components/ui/{button,input,label,dialog,card}`. No new packages
(D-01). `ConfidenceChip.tsx` is the canonical structural template for a shared chip.

### D-05: per-org role re-derivation (audit, likely NO new behavior)
**Source:** `frontend/src/providers/OrgProvider.tsx:107-117` + `hooks/useOrgPermissionsProbe.ts:68-111`.
The probe is **keyed on `activeOrgId`** (`useOrgPermissionsProbe.ts:111`) and fail-closed
(`:29-38,93`), so an org switch already re-probes and re-derives `role` + `canManage` per-org.
**Verify at plan:** D-05 most likely collapses to a display-consistency audit (confirm every badge
site reads `OrgProvider.role`, not a stale/local copy), NOT new wiring. Do not add role-derivation
logic — it exists.

### Honest-absent gating (D-06 — courtesy render gates, server is the wall)
**Source:** `NavPanel.tsx:190` (`{canManage && <RailItem .../>}`), `NavPanel.tsx:209`
(`{isOperator && ...}`), `ProfileMenu.tsx:79` (`const showSwitcher = orgs.length >= 2`),
`OrgAdminShell.tsx:318-336` (non-manager guard renders a message, never chrome),
`InvitationsTab.tsx:140` / `SsoTab.tsx:313` (`canInvite`/`canManageSso &&`). Every affordance is
**absent** (not disabled) when the gate is false. Preserve every one — do not convert any to a
disabled state.

### Zone separation (D-07)
**Source:** `NavPanel.tsx:190-222` — org shield = `text-indigo-400` / `bg-indigo-500/15`; operator
shield = `text-amber-400` / `bg-amber-500/15`. `OrgBand.tsx:63-67` band = `border-primary/25`
indigo. The two shields must read as distinct zones; amber never appears in org surfaces.

### Link-first + victim-naming (D-10 — preserve verbatim)
**Link-first:** `InviteMemberDialog.tsx:146-188` (dialog success surfaces copyable link) +
`InvitationsTab.tsx:308-339` (resend surfaces fresh link). Both must keep surfacing a copyable
link. **Victim-naming remove:** `SsoTab.tsx:340-360` names the domain + its consequence ("members
who sign in with acme.com fall back to password"). Keep the two-step confirm + copy verbatim;
polish is spacing/token only.

---

## No Analog Found

None. Every phase-177 file has an in-repo analog (this is polish over shipped 166/167/168 surfaces).
No file needs to fall back to RESEARCH.md patterns.

---

## Row-anatomy + 4px-grid reference (D-09)

The **grid-correct** row baseline to standardize on (from `InvitationsTab.tsx:231-306`):

```tsx
<div className="flex flex-col gap-2 px-3.5 py-3">            {/* row container */}
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
    {/* identity (avatar + primary + sub-line) */}  flex min-w-0 flex-[2] items-center gap-3
    {/* role/meta chip */}                           flex-none
    {/* status chip */}                              flex-none
    {/* honest-absent actions */}                    flex flex-none items-center gap-1
  </div>
</div>
```

`OrgMembersTab.tsx:190-211` already matches this. **`SsoTab.tsx:284-325` is the off-grid outlier**
(`px-4 py-3` container + `py-1` chips + no avatar) — snap it to the baseline above (identity uses a
domain string, not an avatar, which is fine; the spacing/chip must match).

---

## Metadata

**Analog search scope:** `frontend/src/components/org/`, `frontend/src/components/layout/`,
`frontend/src/components/auth/`, `frontend/src/pages/`, `frontend/src/providers/`,
`frontend/src/components/ui/`, `frontend/src/components/metadata/` (ConfidenceChip precedent),
`frontend/src/hooks/`, `frontend/src/lib/`.
**Files read:** 14 (OrgBand, OrgMembersTab, InvitationsTab, SsoTab, InviteMemberDialog,
OrgAdminShell, ProfileMenu, NavPanel, AcceptInvitePage, SignInForm, AuthPage, OrgProvider,
useOrgPermissionsProbe, ConfidenceChip) + utils.ts + avatar.tsx.
**Grep confirmed:** no pre-existing shared `StatusChip`/`RoleBadge`/`HonestNotice`/`OrgIdentity`
primitive — all three are inline-duplicated across the sibling files above.
**Pattern extraction date:** 2026-07-23
