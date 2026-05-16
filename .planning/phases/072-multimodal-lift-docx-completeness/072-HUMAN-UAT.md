---
phase: 072-multimodal-lift-docx-completeness
plan: 03
type: human-uat
status: pending
target_doc: "<thesis-document-id-to-be-filled>"
last_updated: "2026-05-17"
---

# Phase 072 — Human UAT Scoreboard

Closes Phase 072 SC#1/#3 on the DEFAULT engine only. The ≥80% recall target
that a `vision_sweep` opt-in engine would have closed is DEFERRED to a future
spike phase (see SEED-021 + CONTEXT.md `<deferred>` ▸ "vision_sweep + figure-
extractor OSS spike"). Phase 072's job is to fix the dropped-empty-row gap,
close the DOCX completeness gap, and wire the `app_settings` dead-code seam —
NOT to lift the raw detection ceiling.

## Default engine — pymupdf_full

**Thesis document_id:** `<fill>`
**app_settings at run start:**
- `extraction_image_engine_pdf` = `pymupdf_full`
- `multimodal_max_vision_calls` = 100
- `multimodal_max_b64_bytes_kb` = 4096

**Reingest trigger:** `<button click | curl>`
**Wall time:** `<seconds>`

**SQL output:**
```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE description != '') AS with_desc,
       count(*) FILTER (WHERE description = '') AS empty
FROM document_images WHERE document_id = '<thesis-id>';
```

| total | with_desc | empty |
|-------|-----------|-------|
| `<fill>` | `<fill>` | `<fill>` |

**Verdict:** `<GREEN if total >= 20 AND empty/total <= 0.10 else RED>`
**Notes:** `<any operator observations>`

---

## DOCX micro-UAT

Hand-crafted DOCX with:
- (a) one inline image
- (b) header logo
- (c) one floating shape (wp:anchor)
- (d) duplicate logo in footer (same image bytes as the header logo)

Expected: exactly **3** `document_images` rows (the duplicate logo is dropped
by `_dedup_images_by_hash`); description prefixes include `[Image header]:`,
`[Image inline]:`, and `[Image floating]:`.

**DOCX document_id:** `<fill>`
**SQL output:**
```sql
SELECT image_index, page, left(description, 40) AS desc_prefix
FROM document_images WHERE document_id = '<docx-id>'
ORDER BY image_index;
```

| image_index | page | desc_prefix |
|-------------|------|-------------|
| `<fill>` | `<fill>` | `<fill>` |
| `<fill>` | `<fill>` | `<fill>` |
| `<fill>` | `<fill>` | `<fill>` |

**Row count:** `<fill — should be 3>`
**Verdict:** `<GREEN if row count = 3 AND prefixes contain header/inline/floating else RED>`

---

## Retry-empty smoke

**Setup:** Disconnect API key → reingest thesis under `pymupdf_full` →
reconnect → POST `/reextract?retry_empty_descriptions_only=true`.

**Pre-retry SQL:**
| total | empty |
|-------|-------|
| `<fill>` | `<fill>` |

**Post-retry SQL:**
| total | empty |
|-------|-------|
| `<fill>` | `<fill>` |

**Chunk count unchanged:** `<yes/no — pre vs post 'SELECT count(*) FROM document_chunks WHERE document_id=<thesis-id>'>`

**Verdict:** `<GREEN if empty count decreased AND chunk count unchanged | DEFERRED if skipped>`

---

## Phase 072 closure status

- [ ] Default engine UAT GREEN (total >= 20, empty/total <= 0.10)
- [ ] DOCX micro-UAT GREEN (3 rows, location prefixes present)
- [ ] Retry-empty smoke GREEN / DEFERRED
- [ ] All unit + integration tests still green after live UAT (no regressions)

**Overall verdict:** `<pending | green | red>`

**Carry-forwards (if any):**
`<empty or list>`
