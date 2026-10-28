# Phase 291: Describe It From Your Own Files - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-22
**Phase:** 291-describe-it-from-your-own-files
**Areas discussed:** Fold-in, What a "form" is, Reference docs (use + keep), Fields → inputs, Hidden instructions, Sketch + G-4

The seeds gate matched nothing because there are no plans yet. The seeds below were surfaced by hand.

---

## Fold-in
| Option | Selected |
|---|---|
| SEED-051 generalized NL authoring (Recommended) | ✓ |
| SEED-157 AI drafts blind (Recommended) | ✓ |
| SEED-133 ignores `degraded` | ✓ |
| Todo: NL authoring spike | ✓ |

## What a "form" is
| Question | Options | Selected |
|---|---|---|
| Form kinds | PDF fillable (Rec) / Word blanks via AI (Rec) / Flat or scanned PDFs | all three |
| No fields found | Say so, still use it (Rec) / Refuse | Say so, still use it |
| File limits | 1 + up to 5 refs (Rec) / Unlimited by size / You decide | 1 + up to 5 |
| Preview fields | Yes, list first (Rec) / No | Yes |

## Reference docs: use + keep
| Question | Options | Selected |
|---|---|---|
| Use | Inform + stay attached (Rec) / Inform only / Add to KB | Inform + stay attached |
| On reload | Files + fields (Rec) / Just the draft | Files + fields |
| Scans | Existing image path (Rec) / Defer | Existing image path |
| Doc length | You decide (Rec) / First N pages | You decide |

## Fields → inputs
| Question | Options | Selected |
|---|---|---|
| Who fills | AI proposes, author confirms (Rec) / Every field asks | AI proposes, author confirms |
| Match rule | Every field covered (Rec) / Exactly 1:1 / Best effort | Every field covered |
| Field types | Carry over where declared (Rec) / All text | Carry over |
| Uncovered field | Retry once then show gap (Rec) / Refuse | Retry once then show gap |

## Hidden instructions
| Question | Options | Selected |
|---|---|---|
| The guard | Powers only from author (Rec) / Fence + trust model | Powers only from author |
| Tell author | Yes, plainly (Rec) / Silent | Yes, plainly |
| Detection | No, structural guard (Rec) / Heuristic badge | No |
| Step text | Yes, it's content (Rec) / Description only | Yes |

## Sketch + G-4
| Question | Options | Selected |
|---|---|---|
| Sketch | Yes, after context (Rec) / UI-SPEC only | Yes |
| G-4 scenarios | Use these 5 (Rec) / Write my own | Use these 5 |

## Claude's Discretion
- Reference-doc character cap per provider, with a visible truncation notice.
- Storage location of attached files; showing which file a step came from.
- How each provider's structured-output call is shaped (provider-docs-first).

## Deferred Ideas
- Injection detector (rejected). Ingesting into the KB (rejected). Unlimited files (rejected).
