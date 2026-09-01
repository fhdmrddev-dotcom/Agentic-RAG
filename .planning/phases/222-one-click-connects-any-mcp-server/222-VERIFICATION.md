# Phase 222 — VERIFICATION (reviewer, Claude)

**Driven 2026-09-02 in a real browser against the live backend and the live internet**, after
Gemini's five door plans and my crypto half. This is the un-mocked join `AGENTS.md` §3.1 says a
split phase owes — not a restatement of either side's own green suite.

---

## 1 · ⭐ The join, proven against four real servers

Driven from the page's own session (real JWT, real `X-Org-Id`, real backend at `:8000`, real
outbound sockets). **Every one of the contract's four `kind` values was observed on a real
server**, not a fixture:

| server | status | `kind` | `authorization_host` | `registration_required` |
|---|---|---|---|---|
| `mcp.deepwiki.com/mcp` | 200 | **`open`** | `null` | `false` |
| `mcp.notion.com/mcp` | 200 | **`oauth`** | `mcp.notion.com` | **`false`** — RFC 7591 |
| `api.githubcopilot.com/mcp/` | 200 | **`oauth`** | `github.com` | **`true`** — BYO |
| `http://127.0.0.1:8000/mcp` | **422** | — | — | `{"reason_code": "scheme_not_tls", "message": …}` |

⚠ **The 422 row is `BUS-052`'s correction, live.** `BUS-047` had promised the door a `400`
carrying the `reason_code`; the route shipped a `422` whose `detail` was an English sentence, and
`readConnectorReasonCode` returns the code only for an object. The closed six-code set could not
reach the door at all. It now does, and the door reads it.

⭐ **`api.githubcopilot.com` answers `registration_required: true`.** That matters far beyond a
table row — see §3.

## 2 · The door itself, on live rows

- **Notion (DCR)** — `mcp-auth-door` mounts, the OAuth card reads *"Authentication required. Sign
  in with mcp.notion.com to connect."*, and **no client-id inputs render**, which is correct: the
  server does dynamic registration and the operator supplies nothing.
- **GitHub (BYO)** — the same door renders `mcp-byo-fields`, `mcp-client-id-input`,
  `mcp-client-secret-input` and *"Supply your client credentials to sign in with github.com."*

No console errors, no `Could not load connections`, panel closes clean.

⚠ **NOT DRIVEN, AND SAID PLAINLY RATHER THAN IMPLIED:** the BYO *submit* was not clicked. Doing so
needs real GitHub OAuth credentials and would mutate the operator's live row while they are away.
The request body is pinned behaviourally instead (`McpAuthDoor.byo.test.tsx`, 3 tests). **A person
should run one BYO connect by hand before this is called finished.**

## 3 · ⭐ What the drive found that no suite could

**`registration_required: true` is not hypothetical — GitHub is that server, and it is in the
operator's own Popular list carrying 44 tools.** The BYO arm was therefore on a path they would
have walked. And until `c0eaeef0f` that arm was **dead**: the door rendered the inputs on
`registration_required`, enabled the button on both being filled, and then submitted on
`draft.authType === "custom_app"` — a value `ConnectionDraft.authType` does not have. Always
false. Neither credential was ever sent, and nothing errored.

⚠ **`tsc` had said so, in those words** — `TS2367 … have no overlap`, three times, at **81 against
a 66 baseline**. The signal existed and was not read. *A typecheck nobody reads is a test nobody
runs*, which is exactly why the count-gate rule pairs a suite with a number.

## 4 · Gates, re-derived on this tree

| Gate | Result |
|---|---|
| `tsc -p tsconfig.app.json` | **66** — baseline |
| count gate | **OK · 187/187 · total 7153 · pinned 6430 · 0 failing** |
| backend unit | **70 failed** — baseline |
| `test_222_*` (7 files) | all green; the seam file 10/10 |
| integration `test_222_mcp_oauth_seam.py` | 5/5 |

⚠ **One regression was caused and fixed during this work, and it is recorded rather than tidied
away.** My first refresh test assigned `_PinnedFetch.request` directly instead of through
`monkeypatch`. `_PinnedFetch` is the same class object `mcp_auth_discovery` exports, so the
assignment replaced the pinned fetch **for the whole session** and took 8 tests in
`test_222_probe_auth_seam.py` with it — every one of which passed when that file ran alone. **That
signature — red in a full run, green in isolation — is pollution, never a defect.**

## 5 · ⛔ What is NOT done

1. **A BYO connect has never completed.** §2. Needs a human with GitHub OAuth credentials.
2. **`BUS-048`** — the Phase 215 state parameter still carries the client secret and PKCE verifier
   base64'd in the authorize URL. Reported, deliberately unfixed, needs its own scoped phase.
3. **Cloud parity** — migration 151 is LOCAL only, and a read against a policy-less table returns
   **empty rather than erroring**, which is the silent half of the defect it fixes.
4. **Two live provider keys** in `e5977a244` are still unrevoked, and ~520 commits sit unpushed
   because of them.
5. **`SEED-239`** — one malformed `config` still takes down every connection in the org.
6. **`D-222-02`'s auto-probe-on-typing** stands as designed; §3 of `222-PREFLIGHT.md` records why
   blur-or-button would open fewer sockets to hosts a person is merely passing through.

---

## 6 · ⚠ SC#7 IS PARTLY UNMET, AND THE MEASUREMENT SAYS WHY

ROADMAP SC#7 reads: *"⭐ **Notion and Atlassian Rovo connect** — both are OAuth-only … **They are
the phase's proof; a unit test is not.**"*

**Notion: MET.** OAuth end to end, RFC 7591 self-registration, no console, **41 tools**, and the
token now renews.

⛔ **Atlassian Rovo: NOT MET — and it is not a defect in this phase.** Probed live, both documented
endpoints:

| endpoint | `kind` | `resource_status` |
|---|---|---|
| `mcp.atlassian.com/v1/sse` | **`token`** | 401 |
| `mcp.atlassian.com/v1/mcp` | **`token`** | 401 |

> *"This server asks for a credential but does not advertise how to obtain one, so it needs a token
> you create yourself."*

**Rovo returns 401 and advertises no authorization server**, so RFC 9728 discovery has nothing to
read. The premise in SC#7 — *"both are OAuth-only"* — is **false for Rovo as it is served today**.
⭐ **The door handles it correctly**: it falls back to the paste-a-token arm with a sentence naming
the cause, which is SC#5 working rather than SC#7 failing quietly. **No code change would connect
Rovo by OAuth; the vendor would have to advertise it.**

⭐ **Two other real OAuth servers were found unprompted, and they are better proof of the thesis
than Rovo would have been** — because neither was designed for, and both work:

| server | `kind` | `registration_required` |
|---|---|---|
| `mcp.linear.app/mcp` | `oauth` | `false` — self-registers |
| `mcp.sentry.dev/mcp` | `oauth` | `false` — self-registers |

**Four independent vendors (Notion, GitHub, Linear, Sentry) are reachable through one generic door
with no vendor entry anywhere.** That is SC#2 — *authorization is DISCOVERED, not configured* —
demonstrated more strongly than the criterion asked for, while SC#7's second named vendor turns out
to be unreachable by OAuth for reasons outside this repository.

**Recommended disposition (operator's call, not mine):** amend SC#7 to name a vendor that actually
advertises discovery, and record Rovo as a `token`-door service. Re-opening the phase would not
change the measurement.
