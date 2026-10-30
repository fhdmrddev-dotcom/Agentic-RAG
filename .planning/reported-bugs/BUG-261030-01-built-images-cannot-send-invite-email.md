---
id: BUG-261030-01
title: Built images cannot send invite email — the resend SDK the invite path imported was never in the image's requirements
reported: 2026-10-30
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/email, backend/org-invites, deploy/images]
folded_into: "300"
verified_closed_by: null
related_seeds: [SEED-281]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: cf5a463d4
  date: 2026-10-30
status_note: >
  2026-10-30 (302 REG-08, D-15a / D-29): filed formally (300-CONTEXT.md named it "the pre-existing 'built
  images cannot send invite email' defect -> D-21 (REG-08 files it formally)"). Folded -> 300: fixed in code
  by 300 D-21 (300-CONTEXT.md, "One sender (NOTE-06)": one app mailer seam, providers none / resend over
  httpx / smtp; the resend SDK dropped), proven by test_300_clean_image_imports.py (an AST/requirements
  closure, not a Docker build). NOT closed: no live send from a built image exists yet — the real-mail half
  of 300 G4-1 is owed and Resend is deferred by the operator (300-HUMAN-UAT.md:43). The commit above is the
  302 phase base where the report was written, not the commit the defect was first seen on.
---

# BUG-261030-01: Built images cannot send invite email

## What we observed

The invite path sent mail through the `resend` Python SDK, and `resend` was not in
`backend/requirements*.txt`. A development venv that happened to have it installed could send; a built
image (cloud Coolify, the one-box) could not import it, so every invitation from a built image fell back to
"copy the link yourself". 300-CONTEXT.md D-21 records it in one line: *"the `resend` SDK is dropped — it is
not in `backend/requirements*.txt`, which is exactly why a built image cannot send invite email today"*.

## Why it matters

Inviting a colleague is the first step of using an org. On every deployed environment the invite email
never left, and the only signal was the fallback line in the dialog. It is also the mailer the run-waiting
email (SEED-281's email half) depends on.

## Hypothesized cause

Not a hypothesis — measured at 300 discuss: a dev-only dependency imported on a production path, with no
test that imports the email path against the image's own requirements.

## Surface classification

Agentic-RAG — this app's own invite email.

## Suggested routing

- **Fold into in-flight phase:** 300 (fixed in code by D-21; one sender for invites and run-waiting email)
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

The invite dialog's Copy link — send the link by hand.

## Reference / evidence links

- `.planning/phases/300-told-when-a-run-waits-backend-and-mailer/300-CONTEXT.md` D-21 (§ "One sender (NOTE-06)") and the folded-bugs list ("The pre-existing 'built images cannot send invite email' defect → D-21")
- `backend/tests/unit/test_300_clean_image_imports.py`
- `.planning/phases/300-told-when-a-run-waits-backend-and-mailer/300-HUMAN-UAT.md:43` (Resend deferred) and its G4-1 row (local catcher PASS; real provider owed)
