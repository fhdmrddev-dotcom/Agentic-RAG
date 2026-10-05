---
title: Operator API
slug: api/reference/operator
section: api
audience: operator
status: written
release: shipped
covers: [H37, router:admin]
summary: >-
  The operator endpoints, under /admin, run the Control Room. They are not part of the public
  reference.
reviewed: 2026-10-04
---

The operator endpoints, under `/admin`, run the Control Room. They are not part of the public reference.

These endpoints answer **404 Not Found** to anyone who is not an operator — on purpose, so they cannot be discovered.

Each Syrel deployment has its own live API explorer at `https://<your-api-host>/docs`. In production it opens only after you sign in.

To read the operator endpoints, sign in to your own deployment as an operator and open its explorer.

## Read next

- [Control Plane](/docs/administer/control-room/control-plane)
- [Errors](/docs/api/concepts/errors)
