---
title: Limits and spend
slug: api/concepts/limits-and-spend
section: api
audience: developer
status: stub
release: shipped
covers: [H45]
summary: >-
  Calls made with an API key are rate limited per key (10 starts and 120 reads a minute by
  default, 429 with Retry-After above that); calls with a user's token are not. Beyond that, what
  exists is per-run token caps (a run pauses when it reaches its cap), tier entitlements and an
  operator spend ledger. Per-organisation limits are planned (SEED-345). See Errors.
nearest: api/concepts/authentication
---
