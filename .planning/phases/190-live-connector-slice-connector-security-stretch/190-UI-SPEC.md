---
phase: 190
slug: live-connector-slice-connector-security-stretch
status: draft
shadcn_initialized: true
preset: none (pre-existing shadcn install — `frontend/components.json`, style `default`, baseColor `slate`, cssVariables true, iconLibrary `lucide`)
created: 2026-08-08
---

# Phase 190 — UI Design Contract

> The visual and interaction contract for the **live connector slice**. This is a BACKEND
> SECURITY phase with a small author-facing edge, and this document is sized to that edge:
> **one Settings tab, one new child component, one badge state that becomes reachable for the
> first time, and the refusal / status copy.** Everything else is a fence saying *do not touch*.

**What 190 adds to the screen, in one paragraph.** A sixth Settings tab — **Connections** —
holds an instrument table of the real destinations an org's workflows may send to, each row
leading with `name · sends-to · state`. Adding or editing one opens the shipped 400px
right-side push/split panel, whose always-on 🔒 destination footer says where this will send
before you have typed a password, and whose two refusals — *"the host you typed is refused"*
and *"this platform cannot store a credential safely yet"* — behave differently on purpose. On
the canvas, an `external_action` step that now has a destination bound loses its **"Not
connected"** badge and gains **nothing in its place** — the first time that false branch has
ever been reachable. At run time the vocabulary grows by zero words: a send that leaves reads
the shipped complete reading, a send that fails reads the shipped failure reading with the
host's own words, and a step with nothing bound still reads **"Not sent — recorded"**.

**Sketches are contracts here, not inspiration.** G-2 fired at D-27 and was honoured: sketch
**155-C** (*own tab · instrument table*) and sketch **156-A** (*push/split panel*) are both
operator-decided winners, 2026-08-08, commits `29b012fd` and `ab3df848`. Anything cited to a
sketch below is **already decided** and is restated here only so an executor need not open the
HTML. Anything marked **NEW** is a call this document takes, with its reasoning, so the
operator can reverse exactly that one thing.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **shadcn** (pre-existing — `frontend/components.json`; 190 initialises nothing) |
| Preset | none — the install predates this phase; style `default`, baseColor `slate`, `cssVariables: true`, no prefix |
| Component library | Radix via shadcn `@/components/ui` — **190 adds no shadcn component and installs no npm package** |
| Icon library | `@iconify-json/fluent-emoji` (capability marks — §10) · `lucide` (chrome, shipped) · `@lobehub/icons` (**LLM providers only — not used on this surface**, §10) |
| Font | Inter (body) · Manrope (`font-headline` — page and panel titles) · JetBrains Mono (`font-mono` — hosts, ports, ids, timestamps) |
| Theme | Aether **Deep Midnight** (`frontend/src/index.css .dark`) — the only theme this surface is designed against |

---

## 1 · Surface inventory

### 1a · What 190 draws

| Surface | File | Cost |
|---|---|---|
| Settings → **Connections** tab | `frontend/src/pages/SettingsPage.tsx` | one `TabsTrigger` + one `TabsContent` (§2a) |
| The connections table + filter bar + empty state | **NEW** `frontend/src/components/settings/ConnectionsTab.tsx` | net-new |
| The add/edit push-split panel | **NEW** `frontend/src/components/settings/ConnectionFormPanel.tsx` | net-new |
| The author-side picker | **NEW** `frontend/src/components/workflows/ConnectionPicker.tsx` | net-new — §6 |
| Mounting the picker | `frontend/src/components/workflows/ExternalActionSection.tsx` | **+1 import, +1 JSX line, nothing else** |
| The badge's data | `frontend/src/components/workflows/phaseVocabulary.ts` | **exactly one line: `:812`** |
| The picker's write seam | `frontend/src/pages/WorkflowBuilderPage.tsx` + a tiny new context module | §6c |

### 1b · What 190 must NOT touch — the empty-diff fences

These are measured, not asserted. A non-empty diff on any of them means the plan is wrong, not
the code.

| File | Required `git diff --numstat` | Authority |
|---|---|---|
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | **`0 0`** | D-23; G-5 ledger row (*"the next surface that needs the panel gets its own component and one gated line"* — 189-14 already spent that line) |
| `frontend/src/components/workflows/PhaseNode.tsx` | **empty** | D-24 |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | **empty** | D-24; the 188.2 extraction exists to make this true |
| `phaseNodeCardContract.ts` · `ownProperty.ts` · `NodeCornerMarks.tsx` · `NodeRunOverlay.tsx` · `NodeIconWell.tsx` | **empty** | D-24 — the six fenced card-subtree modules |

Plus three property fences that are not diffs:

- **`phaseVocabulary.ts` still has ZERO import statements** after the `:812` edit (measured
  holding at HEAD — §M3). The replacement line reads `phase.config` — a parameter it already
  receives — so nothing new must arrive via `canvasModel.buildPhaseData` and no import is needed.
- **`ExternalActionSection.test.tsx`'s six source-purity fences stay GREEN** after the mount
  line lands (§M4). The child's import must be the relative sibling form `"./ConnectionPicker"`
  — the route-string fence regex requires a leading slash, so a relative import cannot match,
  but **run the fence, do not trust this sentence.**
- **The canvas badge maximum is 2 and a third badge is a typecheck error.** 190 proposes no new
  badge, in either slot.

### 1c · Explicitly not built (D-32, restated so a gap-closure round cannot smuggle it in)

No broad connector catalog · no OAuth consent screen · no vendor-branded integration gallery ·
no per-field mapping/expression UI · no run-surface approval affordance (**BUG-260808-02 is
DEFERRED, not folded**) · no retry/queue surface · no fourth capability.

---

## 2 · Settings → Connections (sketch 155-C — the instrument table)

### 2a · Placement and route — **NEW decision, with the reversible half named**

**Decided by sketch 155-C:** Connections is a **sixth Settings tab**, not a `SectionCard` inside
Integrations. Variant B was built to be rejected and did its job — the five shipped tabs are
each a single-value form saved en masse behind one Save (`SettingsPage.tsx:1354-1365`), while a
connection is a row with its own transaction and a write-only secret. Nesting them means either
the tab-level Save silently skips rows or a row edit is lost on navigate-away.

**Left to discretion by CONTEXT, decided here (NEW):**

Settings has **no router** — `activeTab` is a numeric string in React state, persisted to
`localStorage["settings_active_tab"]`, initialised at `SettingsPage.tsx:521-528`. So the "route"
is a tab value, and the contract is:

| Property | Value | Reason |
|---|---|---|
| Routing key | **`value="5"`** | Appending the next free key renumbers nothing. Every user's persisted tab keeps pointing at the tab they left. The file already records this discipline in its own words at the retrieval relabel: *"`value="1"` — the tab ROUTING key — is unchanged (D-02a / no contract break)."* |
| Visual position | **fourth in the `TabsList`, immediately after `Integrations`** | Connections is what Integrations is *about*; Memory and Audit Log are unrelated. Visual order is independent of the routing key, so this costs nothing. |
| Label | **`Connections`** | Plain-first, per LANG-01. There is no ⌥ Technical name for it — *connection* is already the plain word and inventing `connector_connections` as a reveal would teach the schema, not the concept. |
| Deep link | **none** | The three-homes IA contract forbids a router here. A `/settings?tab=connections` URL is out of scope and must not be added. |

⚠ **The reversible half:** if the operator prefers the tab last (after Audit Log), only the
`TabsList` order changes — the routing key stays `"5"` either way. Reverse this one line without
touching anything else in this document.

### 2b · The org-admin gate — **RECOMMENDED, and flagged for the threat model**

Research **Open Question #2** and sketch 155's own open questions both raise it and CONTEXT never
answered it: **D-12 makes a connection org-shared, but nothing says a plain member may create
one.** A member who creates a connection binds their colleagues' published workflows to a
destination they chose. That is an access-control decision with a UI consequence.

**Recommendation (NEW — requires operator ratification at plan-phase, and belongs in
`190-SECURITY.md`, not a follow-up):**

| Capability | Audience |
|---|---|
| **Read** the Connections tab and its table | everyone in the org |
| **Bind** a connection to a step (the picker, §6) | everyone in the org |
| **Create / edit / delete / check** a connection | **org admins only** |

**What a non-admin sees:** the tab, the table, the states, the destinations — and **no
`＋ Add a connection` button at all.** Not disabled: **removed**, per the shipped 185 rule *"a
control that could never do anything is REMOVED, not disabled."* In its place, one line at the
foot of the table header:

> `Only an organisation admin can add or change a connection. You can bind an existing one to a workflow step.`

Row click opens the panel **read-only** for a non-admin: fields render as static text, the
secret row renders its stored form with no `Replace`, and the footer carries no actions.

⚠ **The gate must be API-enforced, not merely hidden** — the `require_visible` / `require_operator`
precedent (`dependencies.py:672/693`) is the shape. A hidden button that the API still honours is
the defect the 069-A contract exists to prevent.

### 2c · The table — the columns ARE the contract (155-C, locked)

```
Connection            Sends to                        Used by      Credential        State
─────────────────────────────────────────────────────────────────────────────────────────────
✉  Ops mailbox        🔒 smtp.fastmail.com:465        4 steps      checked 2 days    ✓ Ready
▣  Northwind Jira     🔒 northwind.atlassian.net      1 step       never checked     ◌ Not checked
＃ #ops-alerts        🔒 slack.com/api  [fixed]       11 steps     checked 3 h ago   ✕ Credential failed
```

Layout is the shipped 068-A instrument-table roster (`UsersAndAccess.tsx:168` —
`divide-y divide-border/60` rows, **not** a `<table>` element and **not** a new shadcn Table
block). This is a re-use, not a new pattern, and its density behaviour is already known at real
scale.

| Column | Content | Binding rules |
|---|---|---|
| **Connection** | capability mark + `name` | The name is the author's word. Never the row id. |
| **Sends to** | `🔒 {host}:{port}` in `font-mono`, plus a `fixed` tag on Slack rows | The 🔒 destination line is **024-A's always-on endpoint footer applied to a destination**. Slack carries `fixed` because D-02 makes its host a code constant — one of three destinations unforgeable by construction, and the surface says so. |
| **Used by** | `N steps` | ⚠ **Net-new wire** (counting `connection_id` references across published `workflow_definitions.definition` JSONB). It exists because deleting a connection three published workflows depend on is the **073-A victim-naming** case, and this count is what names the victims. If the JSONB scan measures slow against the local corpus, this becomes an on-demand expand — **a UI change, not a schema change** (research OQ#6). |
| **Credential** | `checked {relative}` / `never checked` in `font-mono`, dim | Requires `last_checked_at` + `last_check_verdict` on `connector_connections` — **a column decision for migration 116**, recorded by sketch 155 as its own binding obligation. |
| **State** | glyph + word (below) | **Never colour alone.** |

**The four state words (155-C, locked — must read in greyscale, WCAG 1.4.1):**

| State | Render | Colour token |
|---|---|---|
| ready | `✓ Ready` | `--success` |
| unchecked | `◌ Not checked` | `--warning` |
| check failed | `✕ Credential failed` | `--destructive` |
| disabled | `⏻ Disabled` | `--muted-foreground` |

### 2d · The filter bar and the live count — load-bearing, not decoration

C won the 24-row drive, not a taste vote. The bar is mandatory:

`[Filter connections…] [All] [✉ Email] [▣ Tickets] [＃ Messages] ······················ 13 of 24`

- The count reads `{N} connections` when unfiltered and `{N} of {total}` when filtered.
- Chips filter by capability; the text input matches name, destination and detail.
- At `0` matches the count line reads `0 of {total}` and the table body renders
  `No connection matches this filter.` — **distinct from the empty state below**, which is a
  different fact and must not borrow its copy.

### 2e · Empty state (0 connections) — must explain what a connection IS, without a manual

```
                                   ⇗
                          No connections yet

     A connection is a real destination — a mailbox, a Jira project, a Slack
     channel — that a workflow step can send to. Nothing sends until a person
     approves it in the run.

                      [ ＋ Add a connection ]
```

Verbatim from 155-C. The second sentence is load-bearing: it is the armed-checkpoint promise
(189 D-04) told at the moment someone first meets the concept, and it must not be trimmed.

### 2f · Action budget — at most three primary actions at rest

Per the shipped sketch rule. At rest the page offers:

1. `＋ Add a connection` (page-level, org-admins only)
2. **row click → open the panel** (edit)
3. a per-row `⋯` overflow (`dropdown-menu`) carrying `Check credential` · `Disable` · `Delete`

Nothing else is a button. `Check` is not a per-row visible button — it lives in the overflow and
in the panel footer, because it has a side effect (it writes `last_checked_at`).

### 2g · Destructive actions — the graded-guard rule (146–148, locked)

| Action | Guard | Why |
|---|---|---|
| **Delete a connection** | **victim-naming sheet** (`Sheet side="bottom" max-w-lg`, the `UsersAndAccess.tsx:390-402` shape) | Target-specific destructive with real victims — the `Used by N steps` count names them. |
| **Disable a connection** | **victim-naming sheet** when `Used by > 0`; **direct flip** when `Used by = 0` | Same rule, honestly graded by whether a victim exists. |
| **Enable a connection** | **direct flip** | Restorative — the deliberate asymmetry 068-A already ships. |
| **Replace a stored secret** | **direct**, inside the panel | Reversible by replacing again; no victim. It **invalidates the last check verdict** (research OQ#4 — set `last_check_verdict` back to `not_checked` in the same UPDATE), and the panel says so. |

**Every write lands as a receipt, never a toast** — the 062-A rule: the row flips to
`✎ {verb} · recorded` and the audit ledger carries it. `consequence ≠ receipt`: a disabled
connection keeps a persistent state chip, which is its consequence, separate from the one-time
receipt.

### 2h · The `live_connectors` OFF banner (D-26) — the banner owns platform-wide truth

Sketch 155's `tell it` control settled this: at 24 rows a per-row platform notice is 24 identical
amber lines. **So the platform fact is told ONCE, in a banner above the card, and never on a row.**

```
⛨  Live sending is off for this platform
    Connections below can be saved and bound to a workflow, but no message, ticket or email
    will leave. Steps still record what they would have done and read “Not sent — recorded”.
    An operator turns live_connectors on in the Control Room.
```

Verbatim from 155-C. `live_connectors` renders in `font-mono` inside a `<code>` — it is the one
place a technical name appears on this surface, because it is the exact string the operator must
find.

---

## 3 · The add / edit panel (sketch 156-A — push/split, locked)

### 3a · The shell

- **400px right-side push/split panel**; the table stays visible. Grid `minmax(0,1fr) 400px`.
  Lineage: `PhaseFormPanel` (140-A), the 037-A rules builder, the 027-A document detail shell.
  **This is a re-use of a known container, not a fourth way to open a form.**
- **It is the only container that does not trap you at a failed check** — when a check fails the
  honest next action is to look at the list (which connection is now unusable, is anything else
  in the same state). A dialog scrims that away.
- **Mobile (<768px) → bottom sheet**, per the shipped shell rule. **It must survive 375px.**
- ⚠ **A inherits two obligations B would have given free: no focus trap and no focus restore.**
  `Dialog` provides both; the panel does not. **Both are net-new a11y work in this phase** — name
  them as plan tasks, do not discover them in review. Escape closes; focus returns to the row that
  opened the panel.

### 3b · The fields, by capability

The capability is chosen first and the rest of the form appears — *"every capability needs
different facts, and Slack needs almost none."*

| Capability | Fields |
|---|---|
| `send_email` | `Name` · `SMTP host and port` (a `1fr 92px` two-column row) · `Send from` · `App password` |
| `create_ticket` | `Name` · `Jira site` · `Project key` · `Account email` · `API token` |
| `post_message` | `Name` · `Channel` · `Bot token` — **and nothing else** |

**Slack says out loud that it has nothing to type** (156-A, verbatim):

> `The only thing you supply. The address this posts to is a constant in our source — it cannot be pointed anywhere else, by you or by a workflow.`

**SMTP's host help line** (verbatim):

> `Must be reachable on the public internet over TLS. Plain smtp:// is refused, including for addresses inside this network.`

### 3c · The always-on 🔒 destination footer

Rendered **always**, updating as you type, **never behind an Advanced disclosure**. This is
024-A's cure for BUG-260616-01 (a silently mis-routed endpoint), applied to a destination instead
of a model: **you can never bind a connection without seeing where it sends.**

```
🔒 sends to  smtp.fastmail.com:465   [implicit TLS]  · from ops@northwind.co
🔒 sends to  https://slack.com/api/chat.postMessage   [fixed in code] [TLS]
🔒 sends to  smtp.internal.northwind.co:587   [refused]        ← border --destructive/50
```

### 3d · The write-only secret

On **create**, a `password` input with the help line:

> `Encrypted before it touches the database, and never rendered back to any browser once saved.`

On **edit**, never an input:

```
•••••••••••••••• ················· stored 3 Aug   [ Replace ]
The stored value is never sent back to this browser — not to you, not to an admin,
not to the workflow author who picks this connection. It can be replaced, never read.
```

Both verbatim from 156-A. The dots are a `font-mono` `<span>`, **never an `<input type=password>`
carrying a fake value** — a fake value is a value the DOM holds.

### 3e · The org-shared line

At the foot of the fields, stating D-12 as a property, because the person creating it is
authorising their colleagues:

> `⚭ Shared with everyone in {Org} — a connection exists so colleagues' workflows can use it. It is never visible to another organisation.`

---

## 4 · ⭐ THE EGRESS REFUSAL COPY (CONTEXT `Claude's Discretion` — decided here)

CONTEXT names *"the wording of the egress refusal shown to an author"* as open. Phase 189's
UI-SPEC §9d is the precedent: it fixed the *"Not sent — recorded"* phrasing rules and they are
still cited as authority. This section does the same job and is **binding phrasing on a security
surface**.

### 4a · Four required properties

1. **It names the refused host and the reason — and never the credential**, the request body, or
   the resolved secret. D-08 inherits `secret_cipher`'s *"column NAMES + counts only"* discipline.
2. **It is legible to an org admin, not only to an engineer.** The audience is the person
   configuring a connection. **Banned from user-facing copy:** `SSRF`, `RFC1918`, `CIDR`,
   `link-local`, `NAT64`, `SIIT`, `TOCTOU`, `metadata endpoint`, `allow-list`. The register is
   sketch 156's: *"a private address inside the network this platform runs on."*
3. **It must never imply the destination is merely misconfigured when it was refused for
   security.** Those are different sentences with different next steps, and conflating them
   trains users to retry. §4c gives the three distinct headings.
4. **It is real DOM text**, wired by `aria-describedby` where it explains a disabled control —
   **never a `title`** (142-B's binding rule; the 184-07 lesson).

### 4b · THE TWO REFUSALS — the binding asymmetry (156-A, locked)

> **A refusal you can fix leaves the door open; a refusal you cannot fix closes it.**

| | **8 · egress refused** | **9 · no encryption key** |
|---|---|---|
| Glyph | `⛔` | `⛔` |
| Cause | the host you typed resolves to a non-public address | the platform has no `SECRETS_ENCRYPTION_KEY` |
| Can the person fix it? | **yes** — correct the host | **no** — nothing they type helps |
| **Save button** | **stays ENABLED**, with `Correct the host and try again.` | **goes DISABLED**, with `aria-describedby` → `Disabled because no encryption key is configured.` |

**Refusal block 8 — verbatim strings:**

```
⛔  That address was refused before anything was sent

    {host} resolves to {ip} — a private address inside the network this platform
    runs on. Connections may only reach the public internet.

    The refusal happened before your password was read, so it was never used and
    never left this form.

    Recorded as a refusal: capability, host and reason — never the credential.
```

The third paragraph is the **n8n CVE inversion (D-06) told in user-facing words** — the guard does
not depend on a credential being present — and it is not optional prose. It is the one sentence
that makes the ordering property visible to a human.

**Refusal block 9 — verbatim strings:**

```
⛔  This platform cannot store a credential safely yet

    No encryption key is configured, so a token saved now would sit in the database
    as readable text — and it would be your organisation's token, not ours.

    What this costs you: no connection can be created until it is set, so every
    external_action step keeps reading “Not sent — recorded”.

    To lift it: an operator sets SECRETS_ENCRYPTION_KEY and restarts the backend.
    Nothing you have typed here is sent anywhere in the meantime.
```

Both follow the **142-B** rule: name the cause, name what the refusal **costs**, put the reason in
real DOM text.

### 4c · The closed refusal-reason table — **NEW, and it is the part 156 did not draw**

Sketch 156 drew one refusal (a private address, on SMTP). `egress.py` can refuse for six reasons
across three capabilities. Each gets **one sentence, authored here, never improvised at the call
site**, and the executor renders it from a closed map keyed by the guard's own reason code.

| Reason code | Heading (glyph `⛔`) | Body sentence | Save |
|---|---|---|---|
| `address_not_public` | `That address was refused before anything was sent` | `{host} resolves to {ip} — a private address inside the network this platform runs on. Connections may only reach the public internet.` | enabled |
| `scheme_not_tls` | `That address was refused before anything was sent` | `{host} was given without encryption. Connections must be encrypted end to end — a plain http:// or smtp:// address is refused, including inside this network.` | enabled |
| `host_not_allowed` | `That address was refused before anything was sent` | `{host} is not a {vendor} address. A {capability_word} connection may only send to {allowed}.` | enabled |
| `host_not_ascii` | `That address was refused before anything was sent` | `{host} contains characters that can be made to look like another address. Type the address using plain Latin letters.` | enabled |
| `unresolvable` | `That address could not be looked up` | `Nothing on the internet answers to {host}. Check the spelling — nothing was sent, and your password was never read.` | enabled |
| `redirected` | `That address was refused before anything was sent` | `{host} answered by pointing somewhere else. Connections follow no redirects, so the address you type is the only address that is ever contacted.` | enabled |

**Every row closes with the same audit line**, unchanged:
`Recorded as a refusal: capability, host and reason — never the credential.`

Substitutions: `{capability_word}` ∈ `email` · `ticket` · `message` (never the wire id).
`{allowed}` is rendered from the guard's own allow-list, never re-typed in the client.

⚠ **`unresolvable` is deliberately worded as a lookup failure, not a security refusal** — it is
the one row where the person genuinely made a typo, and calling it a refusal would train the
distrust §4a-3 forbids.

### 4d · Refused ≠ unreachable ≠ rejected — three headings, three next steps (**NEW**)

The single most likely copy defect on this surface is flattening these three into one "could not
connect". They are separate states with separate causes, and each gets its own glyph, heading and
action.

| | Glyph | Heading | What it means | Next step offered |
|---|---|---|---|---|
| **Refused** | `⛔` | `That address was refused before anything was sent` | **We** declined to open the socket, for a security property | `Correct the host and try again.` |
| **Unreachable** | `✕` | `That host did not answer` | The address is allowed; nothing answered on it | `The address is allowed — nothing answered on it. Check the host and port, then check again.` |
| **Rejected** | `✕` | `The host rejected this credential` | We reached it; **it** said no | verbatim vendor error (§5b) |

**A refusal must never render the word "failed", and an unreachable host must never render the
word "refused".** These are the two swaps that make a security decision read as a bug and a bug
read as a policy.

---

## 5 · ⭐ THE PROMISE THE BACKEND MUST HONOUR (research Open Question #3)

Sketch 156 **moment 6** ships this sentence:

> *"The connection is saved but no step will be allowed to use it until this passes."*

**The backend does not honour it today, and there is no third door where the copy stays and the
gate does not exist.** Research states the fork plainly: build cheap gates, or delete the
sentence.

### 5a · DECISION — build the gates, and narrow the sentence to exactly what they do (**NEW**)

Option (a), with the copy corrected so it claims precisely what ships and not one word more.

**Gate 1 — BIND time, client, real.** `ConnectionPicker` (§6) renders a connection whose
`last_check_verdict = failed` as **not selectable**: the option carries `✕ credential failed`, is
`aria-disabled="true"`, and choosing it is refused inline with

> `This connection's credential is failing. Fix it in Settings → Connections, then pick it here.`

A connection already bound **before** it started failing keeps its binding and renders the same
failed marker — the picker never silently unbinds an author's choice.

**Gate 2 — BIND time, server, real.** The read endpoint the picker consumes
(`GET /connectors/connections?capability=…`) returns `last_check_verdict` per row, and the
`connection_id` write is validated server-side against the row's org **and** its `is_enabled`
flag. A **disabled** connection is treated as unbound at run time → `recorded_not_sent` (D-17,
zero new statuses).

**What the gates deliberately do NOT do:** they do **not** block a run on a stale
`last_check_verdict`. A verdict from two days ago deciding a live run is exactly the
settings-sync-staleness class this codebase has already been bitten by, and a credential rotated
since the check would be refused while working perfectly. **At run time the executor attempts the
send and reports the true outcome** (`completed` / `failed`, D-17).

### 5b · The corrected sentence — **binding, replaces sketch 156 moment 6's**

```
✕  The host rejected this credential

    Reached {host}:{port} and it answered — the address is fine, the password is not.

    The connection is saved. A workflow author cannot pick it while it is failing, and
    a step already bound to it will fail on the next run rather than pretend.

    what the host said, verbatim
    ┌──────────────────────────────────────────────┐
    │ 535 5.7.8 Authentication credentials invalid │
    └──────────────────────────────────────────────┘
```

Only the middle paragraph changed from the sketch. **Every clause in it is honoured by a gate
above**, and the second clause replaces a universal claim ("no step will be allowed to use it")
with the true specific ("will fail on the next run rather than pretend"). The verbatim block
inherits the **071-A verbatim-provider-error rule**: the host's own words, in `font-mono`, under a
label that says they are verbatim, never paraphrased and never truncated.

⚠ **The fallback, if the planner finds Gate 1 too expensive:** delete the middle paragraph
entirely and ship only *"The connection is saved."* That is option (b) and it is legitimate — but
it must be recorded as a deletion with its reason, not achieved by leaving the sentence in.

### 5c · The check itself (156-A, locked)

- **The check runs on the STORED connection, not the typed form** — so no plaintext secret ever
  crosses the wire for a non-storage purpose, **and** the check exercises the same org-scoped
  resolver D-14 protects.
- Endpoint shape: a dedicated action, **because it has a side effect** (it writes
  `last_checked_at` / `last_check_verdict`). Research OQ#1 recommends
  `POST /connectors/connections/{id}/check`; the exact path is a plan decision, the *dedicated
  action* is not.
- **The success headline is load-bearing and is verbatim:**

```
✓  Credential works — and nothing was sent

    Authenticated as {identity} at {host}:{port}. The check connected, authenticated
    and disconnected. No mail was delivered to anyone.
    Checked just now · re-checking is always safe.
```

The closing negation is picked from the **same closed table 189 §9d already ships**, never
improvised: `send_email` → `No mail was delivered to anyone.` · `create_ticket` → `No ticket was
created.` · `post_message` → `No message was posted.`

- **In-flight:** `Checking the credential…` / `Asking the host who this token belongs to. No
  email, ticket or message is sent by this check.` Footer button reads
  `[⟳ Checking…]` disabled, beside `Saved. Nothing is sent by a check.`

---

## 6 · `ConnectionPicker.tsx` — the net-new component

### 6a · Why it exists — the structural collision (research ⚠ CORRECTION #3)

CONTEXT D-23 says the picker "extends the EXISTING `ExternalActionSection.tsx`", claiming it has
six props. **Measured: it has THREE** (`ExternalActionSection.tsx:88-98`). The "six" are six
**source-purity fences** in `ExternalActionSection.test.tsx:381-412` — a different thing, and a
much more binding one: a fetch inside that file turns all six RED. And `onChange={set("capability")}`
is **key-bound**, so writing `connection_id` through it needs a fourth prop on the section, which
needs a fourth argument from `PhaseFormPanel.tsx`, which makes D-23's `0 0` impossible.

**The resolution — and it satisfies D-23 and D-24 exactly as written:** a **new child component**
that `ExternalActionSection` renders, owning the fetch AND the write.

| File | Diff |
|---|---|
| `PhaseFormPanel.tsx` | **`0 0`** ✅ |
| `ExternalActionSection.tsx` | +1 import (`"./ConnectionPicker"` — relative, no leading slash) + 1 JSX line. **All six purity fences stay GREEN** because each reads a `?raw` string of *that file only*. |
| `ConnectionPicker.tsx` | net-new — owns `useEffect`, the API read, and the store write |

### 6b · Placement inside the section

Directly beneath the capability radiogroup, inside the same `<section data-section="external-action">`,
and **rendered only when a capability is selected** — the two questions are ordered (*what does this
step do?* then *where does it send?*) and asking the second before the first is answerable is noise.

When no capability is selected, the shipped
`EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE` still renders and the picker renders nothing. **190 does not
change that note** — `ExternalActionSection.tsx:222-231`'s docblock already anticipates this phase
and its reasoning holds.

### 6c · The write seam — **NEW, and measured, because the obvious wiring breaks D-23**

`patchConfig(slug, patch)` lives on the builder store (`builderStore.ts:255`) — but the store does
**not** hold the selected slug. `selectedSlug` is React state in `WorkflowBuilderPage.tsx:582`, and
the panel is mounted at `:1838`, inside `<BuilderStoreProvider store={store}>` at `:1808`. So the
child cannot reach the slug through the store, and it cannot reach it through a prop without
re-opening the panel.

**The seam:** a tiny new context module exporting a `SelectedPhaseSlugProvider` +
`useSelectedPhaseSlug()`, mounted in `WorkflowBuilderPage.tsx` around the same subtree that already
carries `BuilderStoreProvider`. `ConnectionPicker` then writes:

```ts
store.getState().patchConfig(slug, { connection_id: id })
store.getState().flushHistory()
```

**Files touched: `WorkflowBuilderPage.tsx` + the new context module + `ConnectionPicker.tsx`.
`PhaseFormPanel.tsx` is untouched.** ✅

⚠ **Degrade, never throw.** `ExternalActionSection.test.tsx` renders the section standalone, with
no store and no provider. The picker **must** use the optional readers
(`useBuilderStoreOptional()` and a null-tolerant `useSelectedPhaseSlug()`) and render its
**disconnected** state rather than crashing — otherwise 190 turns a shipped suite RED for a reason
that has nothing to do with connections.

### 6d · The picker's states — the seam vocabulary is the table row's, unchanged

Sketch 155's seam strip exists precisely to prove this: **the picker renders `name · sends-to ·
state` — the same three facts the table row leads with. No second vocabulary is invented at the
seam.**

| State | Render |
|---|---|
| **Loading** | `Loading…` — one dim line, no spinner (this is a 400px panel field, not a run surface) |
| **None exist for this capability** | `No email connection yet — add one in Settings → Connections.` ⚠ **Text only, no link** — the three-homes IA has no router and a leaf inside the builder cannot switch `ActiveView`. Naming the destination is honest; a dead link is not. |
| **Nothing bound** (the default) | The select shows `— none —` and the footer reads `🔒 nothing bound — this step will record, not send` |
| **Bound** | The select shows `{name}`; the footer reads `🔒 {sends-to} · {detail}` |
| **Bound, credential failing** | `{name}  ✕ credential failed` + the §5a refusal line |
| **Not checked** | `{name}  ◌ not checked` — selectable (an unchecked connection is not a failed one) |
| **Disabled connection** | **not listed at all** — a disabled connection is not a choice |
| **Read failed** | `Could not load connections. The step will record, not send, until one is bound.` (`role="alert"`) — honest 4-state set: populated ≠ empty ≠ loading ≠ error |

The footer line uses the **same 🔒 destination form** as the Settings panel and the table's
`Sends to` column — one mark, one shape, three surfaces.

**Control:** a shadcn `Select`. The candidate set is a per-capability list scoped to the org, in
the low tens by construction (D-04 caps capabilities at three) — the 035-A "a `Select` dies past
~30 docs" argument does **not** apply here, and a typeahead would be a heavier control than the
data warrants.

---

## 7 · ⭐ The canvas: what a BOUND `external_action` node looks like (D-24)

### 7a · The badge retires by DATA, in exactly one line

```ts
// frontend/src/components/workflows/phaseVocabulary.ts — the function spans :810-813
export function notConnectedOf(phase: PhaseSpecJSON): boolean {
  if (phase.config?.phase_type !== EXTERNAL_ACTION_PHASE_TYPE) return false
  return true                    // ← LINE 812 — the ONLY line 190 edits
}
```

⚠ **The line number in CONTEXT (`:811-814`), in `<canonical_refs>` (`:788-814`) and in the
planning prompt (`:788-814`) are ALL wrong** (research ⚠ CORRECTION #2 — measured: the file is 813
lines and the function is the last thing in it). **The line is 812. Re-grep before editing; never
cite.**

The replacement is a pure read of `phase.config` — the parameter the function already receives —
so `phaseVocabulary.ts`'s zero-import property survives by construction and
`canvasModel.buildPhaseData` needs no new data.

### 7b · The bound state — **absent, and NOTHING replaces it** (decided here)

This is the first time the false branch has ever been reachable, so it is stated explicitly
rather than left to be inferred:

| | Unbound (today) | **Bound (190, new)** |
|---|---|---|
| Badge slot 1 | `Not connected` (muted word-badge, no glyph) | **empty — renders nothing** |
| Badge slot 2 | as shipped | as shipped, unchanged |
| Card border / ring / icon well / corner marks | as shipped | **byte-identical** |
| Anything else on the card | — | **nothing. No "Connected" badge, no dot, no tint, no mark.** |

**Why nothing replaces it — three reasons, each already binding elsewhere:**

1. **The badge maximum is 2 and a third badge is a typecheck error** (mechanically guarded since
   188.2-01). A positive-confirmation badge would spend the budget the design deliberately
   withholds.
2. **The canvas is calm at rest** (052-A). A resting node that is correctly configured should say
   nothing — the badge existed to flag an *incomplete* step, and completing it removes the flag.
   Adding a "Connected" badge would put a permanent green sticker on every finished step, which
   is the opposite of the density argument that won 137-B.
3. **The destination is legible where it can be read, not where it can only be glanced at** — the
   panel's 🔒 footer (§6d) carries `sends-to`, in text, at the moment the author is deciding. The
   canvas answers *"is this step finished?"*; the panel answers *"where does it send?"*

**The absence IS the signal**, and it is the same reading the card already uses for every other
completed configuration.

### 7c · The suite gains its first genuine bound case

189 recorded that the false branch was unreachable and that the falsifiable half was the TYPE
test. **190 makes the state test falsifiable**, so the suite must gain a case that renders an
`external_action` phase **with** a `connection_id` and asserts the badge is **absent** — alongside
the shipped case that asserts it is present without one. Without both, the one-line edit is
unguarded.

---

## 8 · ⭐ Run-time status vocabulary — ZERO new words, and one lie it must not learn

### 8a · The four outcomes (D-17 — no new status, no `workflow_phases` migration)

| Outcome | Status | Canvas word | Body opens with |
|---|---|---|---|
| Bound + approved + **sent** | `completed` | the shipped complete reading | the shipped complete body |
| Bound + approved + send **FAILED** | `failed` | the shipped failure reading | **the host's verbatim error** (§8c) |
| **No connection bound** (or a disabled one) | `recorded_not_sent` | `Not sent — recorded` | `NOT SENT — recorded only.` (189 §9d, unchanged) |
| Approval declined | existing decline path | unchanged | unchanged |

### 8b · Failed-send vs `recorded_not_sent` must stay distinguishable — the invariant

Both are "nothing arrived", and conflating them is a real risk. They are separated on **three
independent axes**, and all three must hold:

| Axis | `failed` | `recorded_not_sent` |
|---|---|---|
| **Ring shape** | the shipped `failed` ring | the 8th reading — **4 arcs**, identifiable by arc count alone in greyscale (189 §4b) |
| **Word** | the shipped failure reading | `Not sent — recorded` |
| **Body's first line** | the host's verbatim error, under a `what the host said, verbatim` label | `NOT SENT — recorded only.` |

**Neither may ever read "Complete", and neither may borrow the other's word.** A failed send is
not a record of an intention; a record of an intention is not a failure.

### 8c · ⚠ The Slack `ok:false` trap (research §R11 / threat T13) — the likeliest lie this phase ships

> Slack's Web API returns **HTTP 200** with `{"ok": false, "error": "channel_not_found"}`.
> A naive `raise_for_status()` reads that as **success**.

That is D-31's *"a phase reads Complete for a send that did not leave the app"* verbatim, on the
one surface whose entire discipline is not over-claiming.

**Binding UI consequences:**

1. **A Slack send is successful iff `status_code == 200` AND `json()["ok"] is True`.** Anything
   else lands `failed` — **never** `completed`.
2. **The error code is surfaced verbatim**, under the `what the host said, verbatim` label, using
   the same 071-A block as §5b. Codes to expect: `channel_not_found` · `not_authed` ·
   `invalid_auth` · `missing_scope` · `rate_limited` · `no_text` · `invalid_blocks` ·
   `too_many_attachments`. **They are rendered, not translated** — a paraphrase is a second
   truth-teller.
3. **No shared "check the response" helper across Jira and Slack.** Jira signals errors with
   proper HTTP status codes; Slack does not. Flattening the difference *is* the defect. This is a
   copy-and-status contract, not only an adapter concern, and it is written here because the lie
   would surface as a word on a card.

---

## 9 · The `live_connectors` kill-switch OFF state (D-26) — where it is said, and where it is NOT

With the switch off, an `external_action` step behaves **exactly as it does today**: it records,
it does not send, and it reads `Not sent — recorded`. That is a genuine, already-tested,
already-shipped state — which is what makes this off-switch cheap and honest rather than a second
code path.

| Surface | Does it say anything? |
|---|---|
| Settings → Connections **list** | **YES** — one banner above the card (§2h). The banner owns platform-wide truth. |
| Settings → Connections **panel** (create/edit) | **YES** — one `⛨` notice (156-A moment 10, verbatim below). The person is about to create a connection that will not send; not saying so would be the coy version. |
| A table **row** | **NO.** At 24 rows this is 24 identical amber lines — the exact finding sketch 155's `tell it` control produced. |
| **The canvas** (node card, badge, ring) | **NO. Nothing. Explicitly.** No new badge, no new mark, no tint change. |
| **The panel's `ExternalActionSection` / `ConnectionPicker`** | **NO.** |
| **Run time** | **NO new word** — the shipped `Not sent — recorded` already tells the whole truth. |

**Why the canvas and the picker say nothing — stated so silence reads as a decision, not an
omission:** the author-facing surfaces would have to render a *platform-wide* fact on a
*per-step* surface, which is the same 24-identical-lines error one scale down; the fact is
already told at the two places a person can act on it (Settings) and at the one place it becomes
observable (the run); and a canvas notice would spend a badge slot that does not exist (§7b).

The panel notice, verbatim (156-A):

```
⛨  Live sending is off for this platform

    You can save this connection and workflow authors can bind it to a step. Nothing
    will leave: steps record what they would have done and read “Not sent — recorded”.
    An operator turns live_connectors on in the Control Room.
```

Footer, in `font-mono`, `--warning`: `will save · will not send`

---

## 10 · Icons — where the Slack / Jira / SMTP marks come from (**NEW**)

Sketch 155 flagged its own `✉ ▣ ＃` as **placeholders that must not become a fourth icon
vocabulary**. Settled here.

**The rule: this surface renders CAPABILITY marks, never vendor logos.**

| Capability | Mark | Source |
|---|---|---|
| `send_email` | ✉ envelope | `@iconify-json/fluent-emoji` — the **same set** as the shipped 3D phase-type marks |
| `create_ticket` | ▣ ticket | `@iconify-json/fluent-emoji` |
| `post_message` | ＃ speech balloon | `@iconify-json/fluent-emoji` |

**Three reasons vendor logos are refused:**

1. **`@lobehub/icons` is the single source for provider marks — and it is an LLM-provider set**
   (`providerLogo.tsx`, the native-7 + OpenRouter). Slack/Jira/SMTP are not in its domain.
   Sourcing them from a *second* icon package is exactly the per-surface vocabulary the icon
   convention forbids.
2. **A vendor logo implies a vendor-branded catalog**, which D-32 explicitly does not build. The
   mark should say *"this sends an email"*, not *"this is Fastmail"*.
3. **The vendor is already told, in text, where it is actionable** — the `Sends to` column and the
   🔒 footer carry `slack.com/api`, `northwind.atlassian.net`, `smtp.fastmail.com:465`. Identity
   lives in the destination string, which is the thing a person must verify anyway.

⚠ **Slug verification is mandatory, at build time** — icon-convention §3's empty-icon trap
(`fluent-emoji:direct-hit` shipped EMPTY in Phase 127). Confirm each slug resolves in the
installed set (or bundle the SVG) so no production icon can render blank. **The exact three slugs
are locked at plan-phase against the installed package, not quoted from this document.**

**The canvas glyph vocabulary is untouched.** 190 draws no canvas mark; `⛨`, `🔒`, `⤳`, `＋`/`✕`,
`↶`/`↷`, `◆` and `PHASE_GLYPHS` (which lives in **`soulData.ts:43`**, *not* `phaseVocabulary.ts`)
all stay exactly where they are.

---

## 11 · Spacing, Typography, Color, Copywriting

### 11a · Spacing Scale

4px grid (`--space-1` … `--space-16`). **190 introduces no new spacing value.**

| Token | Value | Where 190 uses it |
|-------|-------|-------|
| xs | 4px | glyph→word gap in a state chip; the mark→name gap in a row |
| sm | 8px | filter-chip gaps; the destination footer's inline gaps |
| md | 16px | field-to-field rhythm in the panel (`.fld` bottom margin ≈ 14px is the shipped panel value and is kept, see exceptions) |
| lg | 24px | panel body padding; card header padding |
| xl | 32px | table-to-banner separation |
| 2xl | 48px | the empty state's vertical breathing |
| 3xl | 64px | not used |

**Exceptions (measured, pre-existing, load-bearing — 190 must not "fix" them):** the shipped panel
form uses `padding: 16px 18px` on header/body/footer and `margin-bottom: 14px` between fields
(156-A, inherited from `PhaseFormPanel`); chips use `py-0.5` (2px) per `StatusChip.tsx:42`; the
picker's option rows inherit `ExternalActionSection`'s `px-2 py-1`. Panel width is **400px**, a
shipped shell constant, not a spacing token.

### 11b · Typography

Three families, **four sizes, two weights.** 190 adds no new size and no new weight.

| Role | Size | Weight | Line height | Family |
|------|------|--------|-------------|--------|
| Page / panel title | 16px (`--text-md`) | 700 | 1.25 | Manrope (`font-headline`) |
| Body · row name · notice paragraph | 13px (`--text-sm`) | 400 | 1.5 | Inter |
| Label · state word · column header · help line | 11px (`--text-xs`) | 500 (labels) / 400 (help) | 1.45 | Inter |
| Technical value — host, port, id, timestamp, verbatim vendor error | 11px | 400 | 1.5 | JetBrains Mono (`font-mono`) |

**The mono family is reserved for values a person may need to copy or compare character by
character** — hosts, ports, `live_connectors`, `SECRETS_ENCRYPTION_KEY`, the verbatim error block.
It is never used for prose.

### 11c · Color

Deep Midnight (`frontend/src/index.css .dark`), measured at HEAD.

| Role | Token | Value | 190's use |
|------|-------|-------|-----------|
| Dominant (60%) | `--background` | `216 45% 4%` | the Settings page plane |
| Secondary (30%) | `--card` | `220 30% 7%` | the connections card, the panel surface, the row hover |
| Accent (10%) | `--primary` | `239 100% 82%` | **reserved on this surface for: the `＋ Add a connection` primary button · the selected row's inset left bar · the focused input border · the active filter chip. Nothing else.** |
| Success | `--success` | `142 71% 45%` | the `✓ Ready` state word and the check-passed notice — **and nothing else** |
| Warning | `--warning` | `38 92% 60%` | the `◌ Not checked` state word · the `live_connectors` off banner · the `will save · will not send` footer |
| Destructive | `--destructive` | `0 72% 51%` | the `✕ Credential failed` state word · both refusal blocks · the refused destination footer · the Delete affordance and its sheet |
| Muted | `--muted-foreground` | `220 16% 65%` (≈7.7:1 on `--background`) | help lines, the `Credential` column, the `⏻ Disabled` state, the org-shared line |

**Accent reserved for:** the four `--primary` sites named above. **190 introduces no new colour
value.** Every semantic colour it spends is a token this app already ships, and every one of them
is paired with a word or a glyph so that removing colour removes nothing.

### 11d · Copywriting Contract

| Element | Copy (verbatim — these are the strings) |
|---------|------|
| **Primary CTA** | `＋ Add a connection` |
| Panel title (create) | `Add a connection` |
| Panel subtitle (create) | `A real destination a workflow step can send to. It sends nothing until a person approves it in a run.` |
| Panel subtitle (edit) | `Everyone in your organisation can bind this to a workflow step.` |
| Panel save (create) | `Save connection` |
| Panel save (edit) | `Save changes` |
| Secondary action | `Check credential` |
| **Empty state heading** | `No connections yet` |
| **Empty state body** | `A connection is a real destination — a mailbox, a Jira project, a Slack channel — that a workflow step can send to. Nothing sends until a person approves it in the run.` |
| Filtered-to-zero body | `No connection matches this filter.` |
| **Error state — refused (security)** | `That address was refused before anything was sent` + the §4c reason sentence + `Correct the host and try again.` |
| **Error state — unreachable** | `That host did not answer` + `The address is allowed — nothing answered on it. Check the host and port, then check again.` |
| **Error state — credential rejected** | `The host rejected this credential` + `Reached {host}:{port} and it answered — the address is fine, the password is not.` + the verbatim block |
| **Error state — cannot store (fail-CLOSED)** | `This platform cannot store a credential safely yet` + the §4b block; Save **disabled** with `Disabled because no encryption key is configured.` |
| Error state — read failure (picker) | `Could not load connections. The step will record, not send, until one is bound.` |
| Check success | `Credential works — and nothing was sent` |
| Check in flight | `Checking the credential…` / `Asking the host who this token belongs to. No email, ticket or message is sent by this check.` |
| Kill-switch banner heading | `Live sending is off for this platform` |
| Org-shared line | `⚭ Shared with everyone in {Org} — a connection exists so colleagues' workflows can use it. It is never visible to another organisation.` |
| Write-only secret note | `The stored value is never sent back to this browser — not to you, not to an admin, not to the workflow author who picks this connection. It can be replaced, never read.` |
| Picker — nothing bound | `🔒 nothing bound — this step will record, not send` |
| Picker — none exist | `No {email\|ticket\|message} connection yet — add one in Settings → Connections.` |
| Picker — failing connection refused | `This connection's credential is failing. Fix it in Settings → Connections, then pick it here.` |
| Non-admin note | `Only an organisation admin can add or change a connection. You can bind an existing one to a workflow step.` |
| **Destructive confirmation — Delete** | `Delete {name}?` / `{N} published workflow steps send through this connection. They will read “Not sent — recorded” until another connection is bound. The stored credential is destroyed and cannot be recovered. This is recorded with your name.` |
| **Destructive confirmation — Disable (Used by > 0)** | `Disable {name}?` / `{N} published workflow steps send through this connection. They will read “Not sent — recorded” until it is enabled again. The stored credential is kept, untouched. You can enable it at any time. This is recorded with your name.` |
| Receipt (every write) | `✎ {verb} · recorded` |

**Four copy rules that bind every string above:**

1. **Never `sent successfully` / `done` / `delivered` about an action that did not leave the app.**
2. **A refusal names its cause and its cost**, in that order (142-B).
3. **A vendor's words are rendered verbatim under a label that says so** (071-A) — never
   paraphrased, never truncated, never re-styled as our own sentence.
4. **`Not sent — recorded` is one string with one meaning**, inherited verbatim from migration 115
   and 189 §9d. **190 must not invent a second phrase for that state**, on any surface.

---

## 12 · Accessibility

| Requirement | How 190 meets it |
|---|---|
| **Never colour alone** (WCAG 1.4.1) | Every state is a **glyph + word**: `✓ Ready` · `◌ Not checked` · `✕ Credential failed` · `⏻ Disabled`. All four read in greyscale. Refusals lead with a heading sentence, not a colour. |
| **Text contrast ≥ 4.5:1** | `--muted-foreground` on `--background` ≈ **7.7:1**. Meaningful text never uses a dim-only token. |
| **Refusal reasons are real DOM text** | Rendered in a `<p id>` wired by `aria-describedby` on the disabled Save. **Never a `title`** — 142-B, and the 184-07 lesson. |
| **Focus trap + focus restore in the panel** | ⚠ **NET-NEW WORK** — `Dialog` would have given both free; the push/split panel gives neither. Escape closes; focus returns to the row that opened it. Named here so it is a plan task, not a review finding. |
| **375px** | The panel becomes a bottom sheet below 768px and must remain usable at 375px — the toolbar viewport buttons drive this, and the notice blocks are the tallest content. |
| **The picker is one control** | A shadcn `Select` with a real `<label>`. A failing option is `aria-disabled="true"` with its reason in the adjacent refusal line, not in the option text alone. |
| **Live regions** | `role="status"` for the in-flight check and the `✎ … recorded` receipt; `role="alert"` for a read failure. **190 adds no other live region** — the table does not announce on filter. |
| **Table semantics** | The roster is a `div` grid, matching the shipped `UsersAndAccess` pattern; column headers carry `scope`-equivalent labelling via `aria-label` on each cell group. Do not introduce a `<table>` on one surface only. |
| **Motion** | The only animation is the check spinner, behind `prefers-reduced-motion`. Nothing on this surface pulses, shimmers or slides. |

---

## 13 · NEW decisions taken here — each reversible on its own

| # | Decision | §  | Reverse it by |
|---|---|---|---|
| U-01 | Connections is tab routing key `"5"`, visually fourth (after Integrations) | §2a | moving one `TabsTrigger` |
| U-02 | Create/edit/delete/check gated on org-admin; read + bind org-wide; the Add button is **removed**, not disabled, for members | §2b | dropping the gate — but then record it in `190-SECURITY.md` as an accepted risk |
| U-03 | Row actions live in a `⋯` overflow; at most three primary actions at rest | §2f | promoting one to a visible button |
| U-04 | Delete + Disable-with-victims use the victim-naming sheet; Enable and Replace flip direct | §2g | re-grading one row |
| U-05 | The closed six-row refusal-reason table, with `unresolvable` worded as a lookup failure rather than a refusal | §4c | editing one row's sentence |
| U-06 | **Refused ≠ unreachable ≠ rejected** — three headings, three glyphs, three next steps | §4d | collapsing two — but that is the exact conflation §4a-3 forbids |
| U-07 | ⭐ **Build the two gates; narrow sketch 156 moment 6's sentence** to what they honour; do NOT gate a run on a stale check verdict | §5a–b | the named fallback: delete the middle paragraph entirely (option b) |
| U-08 | The picker's write seam is a new `SelectedPhaseSlugContext` mounted in `WorkflowBuilderPage.tsx`; the picker degrades when no store/provider is present | §6c | adding `selectedSlug` to `builderStore` instead — **never** by adding a prop to `PhaseFormPanel` |
| U-09 | The picker is a `Select`, not a typeahead | §6d | swapping the control if a real org exceeds ~30 connections per capability |
| U-10 | ⭐ **A bound node's badge is absent and NOTHING replaces it** | §7b | proposing a positive badge — which is a typecheck error today |
| U-11 | The kill-switch OFF state is told in the Settings banner + the panel notice, and **nowhere on the canvas, the picker or the run word** | §9 | adding one surface, and accepting the 24-identical-lines finding one scale down |
| U-12 | Capability marks from `fluent-emoji`, **no vendor logos anywhere** | §10 | sourcing vendor marks — which needs a second icon package and breaks the convention |

---

## 14 · How we'd know this failed (G-6)

Concrete and observable. Each is a UI-visible condition; the backend halves live in
`190-CONTEXT.md` D-31.

- A card reads **`✓ Complete`** for a Slack send that returned `ok:false`. *(T13 — the likeliest.)*
- A **failed** send and a **`recorded_not_sent`** step become indistinguishable on the canvas —
  same ring, same word, or the same opening body line.
- A refusal renders the word **"failed"**, or an unreachable host renders the word **"refused"**.
- A credential, a token, a request body or a `secret_ciphertext` appears in **any** rendered
  string, `data-` attribute, `aria-label`, tooltip or console line.
- `git diff --numstat` on **`PhaseFormPanel.tsx`** is not `0 0`, or any of the **six card-subtree
  modules** has a non-empty diff.
- `phaseVocabulary.ts` gains an **import**.
- A **third badge** appears on a node card, or a bound node grows any new mark.
- The **`Not connected`** badge still renders on a step with a `connection_id` bound — or renders
  on a step of any other type.
- Sketch 156 moment 6's sentence **ships unchanged** while no gate exists.
- A **member** (non-admin) creates a connection through an API the UI merely hid.
- A **stale** `last_check_verdict` blocks a live run whose credential actually works.
- The kill-switch OFF state is announced on a **table row** (24 identical amber lines) or on the
  **canvas**.
- The panel **traps focus nowhere** (Tab escapes into the table behind it) or **restores focus
  nowhere** on close.
- A capability mark renders **blank** in production (the `fluent-emoji:direct-hit` trap).

---

## 15 · Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (pre-existing install) | **none added.** 190 reuses already-vendored primitives only: `tabs` · `button` · `input` · `label` · `select` · `sheet` · `dropdown-menu` · `card` | not required |
| third-party | **NONE DECLARED** | not applicable — no `shadcn view` gate was needed |

**190 installs zero npm packages and adds zero shadcn blocks.** `@iconify-json/fluent-emoji` and
`@lobehub/icons` are both already installed. There is no `table` primitive in
`src/components/ui/` and **190 must not add one** — the roster uses the shipped
`divide-y divide-border/60` row pattern (`UsersAndAccess.tsx:168`).

---

## 16 · Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
