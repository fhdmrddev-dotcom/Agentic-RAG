---
id: SEED-057
title: Google 429 credit-depletion now reads as "rate limited — retry" — a deliberate Phase 095.1 trade-off that can under-warn on genuine Google billing exhaustion
status: partially-folded
folded_into: 210
planted: 2026-06-06
planted_by: orchestrator (095.1 verify-work — found real historical Google 429 "prepayment credits are depleted" runs in the live DB while validating PROVIDER-ERR D-03)
trigger_when: a user reports a genuine Google credit/billing exhaustion that the app told them to "retry in a moment" (so they kept retrying instead of topping up), OR Google exposes a structured signal that distinguishes RESOURCE_EXHAUSTED rate-limit vs credit-depletion, OR a support/UX review wants the rate-limit copy to also hint "if this persists, check billing"
priority: low
tags: [provider-gateway, error-classification, google, billing, rate-limit, PROVIDER-ERR, cross-provider]
related_seeds: []
---

# SEED-057: Google 429 credit-depletion reads as rate-limit

## Context (how it surfaced)

While validating Phase 095.1 PROVIDER-ERR D-03 (Test 9: "429 reads as rate-limit, not billing"), the live Supabase DB was found to hold REAL historical Google failures whose raw error was:

```
429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'Your prepayment credits are depleted. ...'}}
```

(threads `ef6586fb`, `17b1e158`). Those are genuinely a **billing/credit** problem that Google returns with HTTP **429**.

## The trade-off the fix deliberately makes

The 095.1 fix (`backend/app/services/provider_gateway/errors.py:128-136`) maps **any Google `exc.code == 429` → `rate_limit`**, BEFORE any billing branch — because the original bug (BUG-260606-01) was the opposite and worse: a real Google rate-limit was shown as *"check your billing dashboard / insufficient credits"*, telling users to spend money when they only needed to wait.

The consequence: a genuine Google **credit-depletion** (returned as 429) now also reads as *"Rate limited by the provider — please retry in a moment."* Retrying won't refill credits, so the message can **under-warn** in that specific case.

Why accepted now:
- **No structured signal** distinguishes Google rate-limit from credit-depletion — both arrive as `429 RESOURCE_EXHAUSTED`. The only differentiator is the message TEXT, and text-scanning is exactly the bug being killed (rate-limit messages contain "quota").
- The prior direction was the worse lie (tell a rate-limited user to pay).
- Other providers are unaffected — they expose structured `insufficient_quota` for true billing, which `_has_insufficient_quota` already routes to `billing`.

## Possible future resolutions (when triggered)

1. Soften the `rate_limit` copy to be billing-aware for providers that conflate the two (e.g. *"Rate limited — please retry shortly. If this keeps happening, check your provider quota/billing."*) — provider-scoped, no misclassification.
2. If Google ever exposes a structured field separating RESOURCE_EXHAUSTED sub-causes, branch on it (structured-only, never text).
3. A provider-specific Google heuristic that text-matches ONLY the unambiguous credit phrases as a LAST resort after the 429→rate_limit guard — accepted only if the rate-limit-shown-as-billing regression cannot reappear.

## Re-open trigger

A user reports being told to "retry" on a genuine Google credit exhaustion, OR Google adds a structured discriminator, OR a UX pass wants billing-aware rate-limit copy. Until then the 429→rate_limit guard stays as-is (the documented D-03 behavior).
