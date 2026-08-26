# 2026-08-25 bug-fix session — POST-EXECUTION CHECK

**Reviewed:** 2026-08-25 · **Reviewer:** Claude (post-execution; the fixes are another session's)
**Commits:** `97881102` · `63735613` · `4d7d690f` · `0289e873`
**Verdict:** **ACCEPT the three fixes.** ⚠ **One status-honesty problem and one scope note.**

---

## Re-derived myself, not quoted

| Gate | Reading |
|---|---|
| backend | `68 failed, 2678 passed, 2 xfailed, 2 xpassed` — **baseline 68 held**, +65 new passes |
| `tsc -p tsconfig.app.json` | **34**, zero in any touched file |
| count gate | `count gate OK — 114/114 pinned, total 5755, failed 0` |
| `check-deploy-drift.sh` | `RESULT: PASS` |
| new suites | `test_per_format_ingestion.py` + `test_html_extraction_no_markup.py` → **37 passed** |
| OpenRouter suites | **37 passed** |
| `fileTypeMark.test.tsx` pinned? | ✅ yes (3 refs in the count gate) — not deletable-while-green |

## The three fixes — verified at source

**BUG-01.** `.docx` / `.pdf` added to `_EXT_MIME_OVERRIDES`, with the measured 422 matrix recorded
in-line. The NUL fix is **centralized, not a fourth copy**: `services/text_sanitize.py` is now the
one home, it is **byte-identical** to Phase 203's `scrub_text` (so every email fixture passes
unedited), and `email_extraction_service` **re-exports** it so the old import path stays live.
Called once, at `ingest_document` — correctly, because `/reextract` and the email-attachment cascade
both route through it while `extract_text` would have missed the PDF/DOCX composer branch.

**BUG-02.** `text/html` routed through the email parser's existing stdlib `html_to_plain_text`. One
converter in the codebase, still.

**BUG-03.** `parallel_tool_calls` popped **inside** the openrouter + quality branch;
`require_parameters` kept (D-129-02 wants it). Scoping asserted at source, and every other provider
still sends the parameter unchanged.

---

## ⚠ FINDING 1 — two bugs are marked `closed` without being verified where they were reported

Both were reported **from the deployed cloud build**. Both were fixed and verified **locally**. Both
now read `status: closed`, and each says so in its own frontmatter:

- **BUG-260825-03:** *"NOT yet driven against live OpenRouter"* — and the failing **model id was
  never captured**, so the fix is derived from OpenRouter's docs plus our request body. Plausible,
  well-argued, unit-driven — **and never once run against the provider that produced the 404.**
- **BUG-260825-01:** *"the cloud instance is EXPLAINED, not OBSERVED."* The local repro is
  genuinely strong (it reproduces the operator's split character for character), but the cloud
  failure itself was never seen.

Recording the limitation in `verified_closed_by` and `re_open_trigger` is **exactly the right
instinct** and it is why this is a finding rather than a defect. The problem is the status word:
this project's own lifecycle says `closed` means *"the shipped phase verifiably closes it"*, and
**a bug's `status:` frontmatter IS the index** — every future scan filters on `open`. A `closed`
bug with an owed verification is invisible to the sweep that would have chased it.

**Recommendation — do not just re-open them.** The verification is a **deploy-time** obligation, and
CLAUDE.md already carries a standing rule that every production push walks the operator through
DB + non-code parity. Add these to that walk-through as post-deploy checks:

1. Upload a `.docx` and a `.pdf` on cloud — the original report's exact case.
2. Re-run the OpenRouter model that 404'd, **capturing the model id this time**.
3. If either still fails, the re_open_triggers already say what to do.

## ⚠ FINDING 2 — `0289e873` was not requested, and it added a dependency

The commit ships official file-type marks. It fixes a **real defect** — the documents surface drew
Word/Excel/PowerPoint/Acrobat as hand-drawn inline SVG (trademark approximations the icon convention
forbids) and its five-arm switch rendered a **blank grey page** for `.html .epub .eml .msg .json`,
every image and every code file. Good work, and `fileTypeMark.test.tsx` is properly pinned.

But **no bug report asked for it**, and it added `@iconify-json/vscode-icons` to `package.json`
**without the package-legitimacy gate** Phase 206.1 applied to its own icon dependency (`npm pack` +
tarball inspection, `scripts: {}`, dependency tree, secret-needle scan, slopcheck). Deploy drift
passes because it is a devDependency inlined at build — so this is a **process** note, not a live
risk. Worth a retro-active legitimacy check on that one package.

## Note — a limit the fix cannot cross, and it is already documented

`text_sanitize.py`'s docstring records it: **a `.docx` carrying a NUL dies earlier**, inside
`python-docx` (`Char 0x0 out of allowed range` — XML forbids NUL), so no text is ever produced for
the scrubber to clean. *"Scrubbing cannot save that file; only the producer can."* That is the right
call and the right place for it — but it means *"all files ingest correctly"* is true for
well-formed files, not for a corrupt one.

## The best thing in this batch

BUG-02's resolution **refuted its own proposed fix**. The report said to reach for `beautifulsoup4`
because it is installed in the venv — true, and **it is not in `backend/requirements.txt`**, which
is what the Docker image builds from. Taking the obvious route would have shipped an `ImportError`
that reproduces **only in cloud** — this project's most expensive class of bug. It was caught by
checking, not by reasoning.
