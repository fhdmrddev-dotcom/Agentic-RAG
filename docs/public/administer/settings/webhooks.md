---
title: Webhooks settings
slug: administer/settings/webhooks
section: administer
audience: user
status: stub
release: shipped
covers: [router:webhooks]
summary: >-
  Syrel can tell your own systems when a run finishes, a run waits on you, or a document is
  ingested. Until the full guide is written, start with What Syrel is.
nearest: get-started/overview
---

A webhook endpoint is an https address your own system listens on. Syrel sends it a short,
signed message for each event you picked, with ids, a status and a link back into Syrel, and
never any document text.
