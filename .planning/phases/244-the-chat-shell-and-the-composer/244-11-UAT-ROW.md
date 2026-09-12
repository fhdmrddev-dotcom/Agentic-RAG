# 244-11 — the browser row (UAT gap G-3 / G-4), UNFILLED

**Owner:** `/gsd:verify-work`. ⛔ **Nothing below was driven by the executor.** Every verdict field
reads `pending`. `244-11` reports **built, drive owed** for `SHELL-01` — never closed (D-244-14 /
D-244-19).

**Requirement:** `SHELL-01` · **Closes:** UAT `G-3` (visible failure state) and supplies the live
observation `G-4`'s ruling turns on (trace §6.4).

---

## Method — ⛔ FORCE the failure, do not wait for it

The 503 is **intermittent** (2 of 4 observed calls) and is **not reproducible on demand**. The UAT
already proved it is forceable, and that is the method this row uses:

> **Patch `window.fetch` to answer every request whose URL contains `/snapshot` with the
> endpoint's own 503** — body `{"detail": "Streaming infrastructure unavailable"}`,
> status `503`, header `Retry-After: 10` — and pass every other request through untouched.

```js
// Arm the patch. Keep the original so Arm 2 can restore it.
window.__realFetch = window.fetch
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url
  if (url.includes("/snapshot")) {
    return Promise.resolve(
      new Response(JSON.stringify({ detail: "Streaming infrastructure unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "10" },
      }),
    )
  }
  return window.__realFetch(input, init)
}
```

⛔ **Do NOT seed a real Redis outage on the operator's machine.** The point is the CLIENT's
behaviour on a 503; taking the dependency down to observe it is a much larger blast radius for no
extra evidence.

**Fixture thread:** `261d5f57-36fb-40ec-bb0b-1c72b7550350` (the 78-message thread from the UAT
drive). Surface: `/app`, `activeView === "chat"`.

**The sweep, re-used verbatim from the UAT that found the gap** — it returned **ZERO** matches
before this plan (the single hit was an unrelated CSS comment):

```js
[...document.querySelectorAll("*")]
  .filter((el) => !el.children.length)
  .filter((el) => /unavailable|error|failed|retry|try again|something went wrong/i.test(el.textContent || ""))
  .map((el) => [el.tagName, el.textContent.trim()])
```

---

## The row

| # | Arm | What to do | What must be true | Verdict |
|---|---|---|---|---|
| 1 | **the gap closed** | Arm the patch, then open the fixture thread from the chat list | A **visible failure sentence** is on screen; the **Retry** control is present and focusable; the sweep above returns a **non-zero** match **inside the chat column** | `pending` |
| 2 | **Retry recovers** | Restore `window.fetch = window.__realFetch`, click **Retry** | The full transcript renders and the banner is **gone** | `pending` |
| 3 | **the negative** | Reload with **no** patch, open a normal thread | **No** banner anywhere. ⛔ This is the ROADMAP's named failure mode in its general form — *a signal nobody will trust after the first false one* | `pending` |
| 4 | **G-4's live discriminator** | With the patch armed, on the failed open, read WHICH pane rendered | Record it **whichever it is**: the **WELCOME** state (`How can I help you?` + the two starter-prompt chips) **or** the **thread frame with an empty transcript**. See below | `pending` |

---

## Arm 1 — the exact readings to record

- The sentence, **verbatim**. With an empty transcript it must be
  `Couldn't load this conversation. It's still there — try again.`
  ⛔ It must **not** read `Showing cached version` — that sentence is false when nothing is on
  screen, and making it true is the whole of this plan's ChatArea half.
- Whether the banner carries **Retry** (a 503 is not in `NON_RETRYABLE`, so it should) and
  **Dismiss**.
- The sweep's output, pasted. ⚠ **Filter to the chat column**: a match in the nav rail or a CSS
  comment is not the banner, and the pre-fix sweep's one hit was exactly that.

## Arm 4 — why this arm exists, and what it settles

Trace `244-01-BUG-260911-02-TRACE.md` **§6** rules `BUG-260911-02` a **SECOND CAUSE** and names the
discriminator. This arm is the one observation that settles it against a live browser:

| Reading | What it means |
|---|---|
| **WELCOME pane** — `How can I help you?` and/or `📁 Search connected files` / `💬 Draft a team update` | The click **did not select**. Trace §4's overlay click-sink (or C-6 candidate (a)) is live; the snapshot-503 path is **not** what the reporter hit. |
| **Thread frame** — header + composer around an **empty** transcript, **plus the new banner** | The click **did** select. The snapshot-503 path is the live cause of the reported complaint. |

Those three literals occur **exactly once each** in `ChatArea.tsx` and all sit inside
`if (!thread)`, so a selected thread cannot render any of them.

⚠ **The banner is a NEW observable that did not exist when `BUG-260911-02` was filed** — do not
read its absence in the original 2026-09-11 report as evidence either way.

⛔ **This row does NOT close `BUG-260911-02`.** Closing it needs the report's own
`re_open_trigger` — the right-hand-third click on a real row, unpatched — which is a different
visit with a different setup. `status:` stays `folded` until that is driven.

---

## Not covered here, stated rather than implied

- **The 503's own cause.** Established only partially: `threads.py:517`/`:526` raise it when
  `redis.xinfo_stream` times out (2.0 s) or errors. ⚠ A `cap_paused` run is non-terminal and so
  keeps being probed on every thread open, and the seeded `cap_paused` thread produced both
  observed 503s — **whether that is causal was NOT established and must not be written down as
  though it were.**
- **Anything that needs layout.** jsdom performs no layout, so the fences behind this row prove the
  state and the sentence, never that the banner is *visible* at a real viewport. That is what this
  row is for.
