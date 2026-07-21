# What's New — In Plain Language

> A running, jargon-free list of what each chapter of work actually delivers **for you**.
> No variable names, no file paths — just "here's what changed and whether you can see it yet."
> Updated as each phase ships.

**How to read the badges:**

| Badge | Meaning |
|-------|---------|
| 🟢 **Use it now** | There's a real screen, panel, or button you can interact with today. |
| ⚙️ **In Settings** | It shipped, but it only lives on a settings/config screen. |
| 🔧 **Groundwork** | Behind-the-scenes plumbing. Nothing on your screen changed yet — but it powers a visible feature in a later chapter. |

---

## The app today, in one breath

You have an AI assistant that **knows your uploaded knowledge base**, can **run code in a safe sandbox**, can be **taught new skills that stick**, can **run multi-step workflows** for you, and **genuinely understands your documents** (smart folders, linked documents, auto-sorting). Chat is the main way you talk to it; you add documents by uploading files. (That's everything shipped through v3.1.)

The current chapter — **Skill Eval Studio + Self-Improving (v3.2)** — is about trusting your skills: test them against real prompts, see honest with-vs-without proof that they help, and let the app *suggest* improvements that you approve — never applied behind your back.

---

## 🟢 Latest — invite teammates into one organization (v3.4, in progress)

Until now, every person who signed up landed in their *own* private organization — there was no way to bring someone onto your team. This chapter fixes exactly that.

- **Invite people by email or link.** An org admin can open their organization's admin area → **Invitations & Roles** and invite someone — as a **Member** or a co-**Org-admin**. No email service is required: the app hands you a secure invite **link to copy and share** (and can send real emails once you configure a provider). The roster shows who's **pending** vs **active**. 🟢 *Use it now (org admins).*
- **Joining keeps everything you had.** When someone accepts an invite, they **join your org while keeping their own** — so they can switch between both with the org switcher. Accepting is safe to click twice; expired or cancelled links say so plainly. 🟢 *Use it now.*
- **Pick your own default AI model.** Each person can choose their preferred default model from the set your organization allows — and an operator can **lock** it org-wide when needed. ⚙️ *In Settings.*
- **Show features to the right roles.** Operators can now make a feature visible **by role** (e.g. only org-admins), not just "everyone or operators." 🟢 *Use it now (operators).*
- Behind the scenes: this all ships with **no database changes** — the groundwork laid earlier was built to accept exactly these features. *(Final live testing across AI providers is the last step before sign-off.)*

## 🟢 Earlier — your own identity corner + an organization home (v3.4)

This chapter turns the app from "just you" into "you, inside an organization" — safely, with everyone's data walled off from everyone else's behind the scenes. This first visible piece is the **human-facing corner** of that.

- **A real profile menu.** The bottom of the sidebar now has a proper identity anchor — your name, email, a role badge (**Org-admin** or **Member**), the theme toggle, and sign-out, all in one tidy menu. If you ever belong to more than one organization, an **org switcher** appears right there; switching cleanly swaps everything to the new org (and never mixes the two orgs' data). Today everyone belongs to exactly one org, so you just see the quiet name button — no clutter. 🟢 *Use it now.*
- **An organization admin area.** If you manage your org, a second shield — in **indigo** (distinct from the operator's amber) — sits on the sidebar and opens an **org admin console**: a read-only member list, an activity log scoped to your org (you see everyone's if you're allowed, otherwise just your own — and it says so honestly), and a light org-settings home. Four more tabs (invitations, single sign-on, subscription, retention) show an honest "coming soon." A regular member doesn't see the shield at all. 🟢 *Use it now (org admins).*
- **Honest by construction.** The org you're acting in is re-checked on the server every request — you can't trick the app into showing another org's data. *(Final live cross-provider testing is the last step before this is signed off.)*

## 🟢 Earlier — the app now has a staff-only Control Room (v3.3, shipped)

This new chapter is about making the whole platform manageable by a trusted person — the "operator" — right from the app, no developer tools needed.

- **A hidden Control Room for the operator.** If your account is designated as the operator, a small amber shield appears at the bottom of the sidebar. It opens a Control Room showing the system's health in plain words (server capacity, agents working, database connections, work spread) — with the technical names one click away if you want them. 🟢 *Use it now (operators only).*
- **Invisible to everyone else.** Regular users see absolutely nothing new — no button, no menu, and even someone poking at the server directly gets a plain "not found," as if the admin area doesn't exist. Verified live.
- **Every admin action leaves a receipt.** Anything an operator does is written to a permanent log the moment it happens, and shows up in a "Recent operator actions" list that survives reloads. Trust through receipts, not promises.
- **Coming to this Control Room next:** live run monitoring with a kill button, user management, hiding advanced features from regular users, and model management — the tabs are already there, honestly marked "Not built yet — coming soon."

---

## 🟢 Your skills can now improve themselves (with your approval) (v3.2)

This chapter turns the Skills feature into a proper test-and-improve studio. Shipped so far:

- **Skills now keep a version history.** Every time you save a skill, the app snapshots it as a frozen version — so you can always see exactly what a skill said at any point in time, and nothing you do later can quietly rewrite the past. 🔧 *Groundwork today; a browsable version-history view arrives with the upcoming Evals panel.*
- **You can build a test suite for a skill.** Write test prompts for a skill once and they stick around — edit them, add more, reuse them on every future check. ⚙️ *Lives in the skill's eval section for now.*
- **Prove a skill actually helps.** Run an evaluation and the app answers the question you actually care about: *does this skill make the assistant better?* It runs each test prompt twice — once with the skill, once without — side by side, on the real AI providers you use. Eval runs happen quietly in the background without cluttering your chat list.
- **An honest verdict, not a vibe.** Each eval ends with a clear per-provider pass/fail readout, and you can thumbs-up/down individual outputs to teach the system your taste. When something couldn't be measured (say, a provider was down), it says "not measured" instead of pretending.
- **The skill can now propose its own improvement — but you're always the boss.** New in this drop: based on eval results and trigger tuning signals, the app can draft a suggested edit to a skill's instructions and show it to you as a plain before/after diff. You read it, then approve or reject. Approve, and it becomes a new frozen version that is **automatically re-tested before it's promoted** — if the re-test fails, the app tells you honestly and holds it back (you can still force it through, and that override is recorded). Reject, and nothing changes. The system never, ever edits a skill behind your back. 🟢 **Use it now** — verified live on OpenAI, Anthropic, and Google.
- **The skill tune-up now goes through the same "you approve it" door.** New in this drop: when the trigger tune-up finds a better wording for a skill's description (the short text that decides *when* the skill kicks in), it no longer applies it with one click. Instead it drafts a proposal — you see a plain before/after diff **plus the per-provider scoreboard proving the new wording actually won its head-to-head test** — and you approve or reject. Approve, and it becomes a new frozen version in the skill's history; reject, and nothing changes. And if your current wording already won the test, the app says so honestly and proposes nothing. 🟢 **Use it now** — in the skill's Tuner page. *(Live cross-provider walkthrough still queued as the final check.)*
- **Sharing a skill now has a quality gate.** New in this drop: when you click the globe to share a skill with everyone, a confirmation dialog first checks whether the skill has actually **passed a test on its current wording**. Passed? You'll see "Publish ready — eval passed" and a normal Publish button. Never tested, or the test failed, or you edited the skill since it last passed? The dialog tells you plainly why it's not ready — and if you publish anyway, that choice is **permanently recorded** ("Published without a passing eval on \<date\>") so there's always an honest trail. Un-sharing is always instant and never blocked, and sharing again re-checks from scratch — no free passes. 🟢 **Use it now** — tested live in the browser.

Still coming in this chapter: a polished Skill Evals panel to see all of this in one place (and to fix today's cramped eval section — that redesign is next).

---

## 🟢 A cleaner, clearer chat (v3.1)

- **Watching the assistant work is calmer now.** While it runs, each step stays as one tidy line that lights up as it's working and turns green when it's done — no more cards flickering open and snapping shut. A running step shows a live timer right on its status tag. Curious what a step is doing? Click it to expand the live code or output; click again to tuck it away.
- **Less clutter under each run.** The repeated "to-dos updated · see panel" links, the duplicate "skill activated" note, and an extra "preparing…" status line that used to pile up beneath a run are gone. Your to-do list now lives in exactly one place — the workspace panel on the right — so there's only one of everything to look at. Same clean look across every AI provider, in both light and dark mode.
- **Every tool now shows the real provider's logo.** When the assistant runs a step, its card shows the actual AI provider's brand mark (OpenAI, Anthropic, Google, DeepSeek, and more) on a clean white badge — so you can tell at a glance which model is doing the work. It reads well in both light and dark mode, and even your local models (Ollama, LM Studio) get their own logo.
- **It tells you what it's about to do.** The instant the assistant starts a step, a short description appears during the brief "preparing" beat — no more staring at a blank pause.
- **Long pasted prompts stay tidy.** A very long message now collapses to a short preview with a "Read more" link instead of filling the whole screen.
- **One timer, not three.** Removed a redundant elapsed-time bar that used to sit above the message box; the run's status and timer now live in one consistent place — giving you back screen space.

---

## 🟢 What you can actually see and use right now (this chapter)

- **Open any document's info card.** Click a document in your library and a side panel slides open showing every detail the system pulled out of it — title, author, topics, dates, and more.
- **See how sure the system is.** Each detail is marked with a confidence rating, and anything it's only loosely guessing at is clearly flagged so you know what's worth double-checking.
- **Fix anything by hand.** Correct any value right there in the panel; your edit is saved and quietly recorded.
- **Organize documents into self-updating smart folders.** Use the new point-and-click builder to filter by type, date, number range, or "expiring within 90 days," save it with a name, and it appears in your sidebar like a folder — staying current on its own as documents change.
- **Choose your document search engine (in Settings).** You can pick which service makes your documents searchable — including a private "runs on your own computer" option — with a clear warning before any switch. *(Caveats below.)*

Everything else built so far is **groundwork** — real, tested, and important, but invisible until the screens that use it arrive in upcoming chapters.

---

## Document Management (v3.0) — chapter by chapter

### ✅ Done

**Phase 110 — The foundation** &nbsp; 🔧 Groundwork
Laid the secure, private foundation the whole document toolkit sits on — like pouring the foundation and running the plumbing for a new wing before any rooms exist. Includes a master on/off switch for the wing, a tamper-proof activity log, and strict walls so no one can ever see anyone else's files. *Nothing visible yet.*

**Phase 111 — Smarter automatic fact-finding** &nbsp; 🔧 Groundwork
Rebuilt the part that automatically reads key facts out of every uploaded document. It now reads the **whole** document instead of just the first page, can use whichever AI the system is set to (including a private one on your own computer), **notes how confident it is** about each fact, and can be set up to look for your own custom facts. If the reading ever fails, the document still uploads cleanly instead of getting stuck. *Runs in the background on upload — no new screen until the info card (Phase 112) shows the results.*

**Phase 111.1 — Choose your own document search engine** &nbsp; ⚙️ In Settings
Until now the app was locked to a single outside company to make your documents searchable — an outage there, or a simple preference for something else, left you stuck. You can now **pick your search provider from a menu in Settings**, including a private "nothing leaves your computer" choice, and the app warns you before switching.
*Honest caveats:* using the private on-your-own-computer option means **you have to run that local helper yourself**, and the "rebuild my existing library after switching" progress view is wired up but **hasn't been fully exercised end-to-end yet**.

**Phase 112 — The document info card** &nbsp; 🟢 Use it now
Gives each document a proper info card you can open, read, and fix by hand — like the details pane on a file, but **honest about how sure it is** of each fact, and it **keeps a record** whenever you change something. *(This is the visible payoff of Phases 110 and 111.)*

**Phase 113 — The smart-folders engine** &nbsp; 🔧 Groundwork
Built the safe, behind-the-scenes engine for **"smart folders."** It's the part that stores a saved search — like *"all invoices from Acme"* — as a named, **self-updating** list, and figures out live which documents match. The same document can appear in several lists at once without ever being copied, and a list you share with a teammate only ever shows them documents they're already allowed to see. *The on-screen controls that put this engine to work arrived in Phase 114 — see below.*

**Phase 114 — Smart folders, for real** &nbsp; 🟢 Use it now
This is where smart folders become something you actually use. There's now a **point-and-click builder** — no search syntax to learn — where you stack up conditions like *type is Invoice*, *amount is over 5,000*, or *expiring within the next 90 days*, and **save the result as a named smart folder**. It shows up in your **sidebar like a normal folder** and **keeps itself up to date** — new documents that match appear on their own, and the same document can live in several smart folders at once without ever being copied. Text matches ignore capitalization, and "within the next N days"-style date filters always count from today, so a saved folder never quietly goes stale. *(This is the visible payoff of the Phase 113 engine.)*

### ⏳ Coming next (not built yet)

- **Phase 115 — Your assistant can use your smart folders.** Ask a question in chat and the assistant can run one of your saved searches to answer it.
- **Phase 116 — Linking documents together.** The ability to say "this contract relates to that invoice," and let the assistant pull up related documents. *(Mostly groundwork + an assistant skill.)*
- **Phase 117 — See a document's links.** A "related documents" section on the info card, showing what's connected to what (and hiding anything you're not allowed to see).
- **Phase 118 — Auto-sorting new uploads.** When you upload a document, the app *suggests* where it belongs and how to label it — and always asks first; it never silently moves your files.
- **Phase 119 — A document health view.** A simple read-only dashboard flagging things that need attention: broken links, unsorted documents, and low-confidence facts, each with a link to go fix it.

---

## Earlier chapters (already shipped, one line each)

- **v2.9 — Workflow Studio.** Build, publish, and run repeatable multi-step workflows, with a quality gate that blocks low-quality output.
- **v2.8 — Workflow engine & live execution.** The behind-the-scenes engine that runs those multi-step jobs and shows them happening live.
- **v1.0–v2.7 — The core platform.** Chat with an AI that knows your uploaded knowledge base, runs code in a sandbox, and can be taught skills that persist.

---

*Maintenance note: this file is kept up to date as each phase finishes — one plain-language entry per phase, written from your perspective. If a line ever reads as too technical or over-promises something you can't actually see, say so and it gets fixed.*
