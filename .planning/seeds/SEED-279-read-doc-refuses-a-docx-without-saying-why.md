---
seed_id: SEED-279
title: read_doc on a .docx id returns a bare FAILED_PRECONDITION
status: planted
surface: Agentic-RAG
relates_to:
  - backend/app/services/google/docs.py
  - backend/app/services/connectors/service_tools.py
trigger_when: "The next phase that touches the Google read tools, or the first report of a model looping on read_doc."
planted: 2026-08-31
renumbered_from: SEED-228
renumbered_because: >
  D-07/D-20: the OLDEST seed keeps the id, by the `created`-else-`planted` date. This file reads
  `planted: 2026-08-31`; `SEED-228-a-workflow-cannot-say-the-whole-library-on-purpose.md` reads
  `planted: 2026-08-28` and is 3 days older, so it keeps id 228 and this seed moved to 279. ⚠ The
  FRONTMATTER date is authoritative: git records this file as ADDED 2026-09-01 00:40:34 +0400, a
  day after its own `planted:` line, and that disagreement does not flip the verdict. ⛔ Not chosen
  by reference weight — D-07 rejects that rule by name.
---

## What was measured

Driving all 15 Google read tools against a live connection on 2026-08-31, `read_doc` handed the
Drive id of a **`.docx`** returned:

```
ServiceToolError: Google refused read_doc: HTTP 400 (FAILED_PRECONDITION)
```

The Docs API is enabled and answering; `FAILED_PRECONDITION` is its way of saying *"that id is
not a native Google Doc"*.

## Why it matters more than it looks

**A model will do exactly this, unprompted.** `search_files` returns `.docx` and native-Doc ids
side by side, with `mime_type` present but no instruction about which tool takes which. The
account driven on 2026-08-31 held exactly one document — `Fahed_Mrad_CV_Jun2026_Final.docx` —
so the *only* available id was the wrong one for `read_doc`.

The refusal names an enum and no remedy, so a model cannot recover from it. `read_file` handles
that id correctly (it exports or reports honestly), and nothing tells the model to switch.

## The shape of the fix

The same shape BUS-040 defect (d) already established at this seam: **carry the vendor's enum
and add the remedy.** `FAILED_PRECONDITION` on `read_doc` becomes *"that file is not a Google
Doc — use `read_file` for it."*

⚠ Not a scope problem and not an API-enablement problem, so it must not be worded like either;
telling someone to re-consent here would be the wrong-cause refusal that phase fixed.
