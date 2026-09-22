-- Migration 188 — Phase 260 (PACK-02, PACK-05, D-260-04, D-260-08)
-- Table: public.threads — add active_expert_id for durable consultant scoping
-- Seed: System financial knowledge folder ('Financial Reports & Filings') and sample 10-K document fixture
-- Update: financial-analyzer expert bundle member population

-- 1. Add active_expert_id column to public.threads
ALTER TABLE public.threads
    ADD COLUMN IF NOT EXISTS active_expert_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.threads.active_expert_id IS
    'Active consultant expert bundle invited to this thread (PACK-02, Phase 260). Scopes retrieval and tools, preserves chat history. Cleared to NULL on dismissal.';

-- Partial index for active expert lookups on threads
CREATE INDEX IF NOT EXISTS idx_threads_active_expert
    ON public.threads (active_expert_id)
    WHERE active_expert_id IS NOT NULL;

-- 2. Seed System Financial Knowledge Folder ('Financial Reports & Filings')
INSERT INTO public.folders (
    id,
    user_id,
    org_id,
    name,
    parent_id,
    is_org_shared,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000260'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '430bffc6-7275-499b-b307-d932b4750051'::uuid,
    'Financial Reports & Filings',
    NULL,
    true,
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed sample 10-K document fixture for PACK-05 verification
INSERT INTO public.documents (
    id,
    user_id,
    org_id,
    folder_id,
    filename,
    file_path,
    file_size,
    mime_type,
    status,
    chunk_count,
    version_number,
    is_latest,
    ingest_visibility,
    full_markdown,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000261'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '430bffc6-7275-499b-b307-d932b4750051'::uuid,
    '00000000-0000-0000-0000-000000000260'::uuid,
    'acme_q3_2026_financial_report.md',
    '/Financial Reports & Filings/acme_q3_2026_financial_report.md',
    3420,
    'text/markdown',
    'completed',
    2,
    1,
    true,
    'org',
    '# ACME Corporation - Q3 2026 Financial Results and Form 10-K Report

## Condensed Consolidated Statement of Operations (Unaudited)
*Quarter Ended September 30, 2026*

| Financial Metric | Q3 2026 ($M) | Q3 2025 ($M) | YoY Change (%) |
| :--- | :--- | :--- | :--- |
| **Total Revenue** | **$124.5** | $105.3 | **+18.2%** |
| Cost of Goods Sold (COGS) | $44.6 | $39.5 | +12.9% |
| **Gross Profit** | **$79.9** | $65.8 | **+21.4%** |
| Gross Margin (%) | **64.2%** | 62.5% | +170 bps |
| Research & Development | $23.1 | $20.4 | +13.2% |
| Sales & Marketing | $16.3 | $14.8 | +10.1% |
| General & Administrative | $8.8 | $8.1 | +8.6% |
| **Operating Income (EBIT)** | **$31.7** | $22.5 | **+40.9%** |
| Depreciation & Amortization | $6.7 | $5.9 | +13.6% |
| **EBITDA** | **$38.4** | $28.4 | **+35.2%** |
| EBITDA Margin (%) | **30.8%** | 27.0% | +380 bps |
| Net Income | $24.8 | $17.6 | +40.9% |
| **Operating Cash Flow** | **$29.1** | $21.3 | **+36.6%** |

## Balance Sheet & Capital Resources
As of September 30, 2026, ACME Corporation maintained total cash, cash equivalents, and short-term investments of $54.2 million compared to $46.8 million at December 31, 2025. Total outstanding term debt stood at $18.5 million, reflecting a net cash position of $35.7 million. Free cash flow for the quarter was $22.4 million after capital expenditures of $6.7 million.

## Item 1A. Quantitative and Qualitative Disclosures About Risk Factors
The following represent the principal risk factors disclosed in the quarterly filing:
1. **Supply Chain Concentration**: The Company relies on three primary Tier-1 suppliers in Southeast Asia for specialized semiconductor packaging and optical sub-assemblies. Any disruption from geopolitical tensions, natural disasters, or export restrictions could materially impair production schedules.
2. **Foreign Currency Volatility**: With approximately 42% of revenue generated internationally (primarily APAC and EMEA), fluctuations in the US Dollar relative to the Euro and Japanese Yen introduce margin sensitivity and transaction exposure.
3. **Regulatory Compliance and Data Privacy**: Expanding data governance regulations, including cross-border data transfer restrictions and sovereign AI compliance mandates, require substantial ongoing operational investments and pose exposure to potential penalties for non-compliance.',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed chunks for the document so search_documents and vector search can retrieve it
INSERT INTO public.document_chunks (
    id,
    document_id,
    user_id,
    org_id,
    chunk_index,
    content,
    search_vector,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000262'::uuid,
    '00000000-0000-0000-0000-000000000261'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '430bffc6-7275-499b-b307-d932b4750051'::uuid,
    0,
    'ACME Corporation Q3 2026 Financial Results and Statement of Operations. Total Revenue reached $124.5 million, an increase of 18.2% year-over-year compared to $105.3 million in Q3 2025. Cost of Goods Sold was $44.6 million, delivering Gross Profit of $79.9 million representing a Gross Margin of 64.2% (+170 basis points YoY). Operating Expenses included R&D of $23.1M, S&M of $16.3M, and G&A of $8.8M, yielding Operating Income (EBIT) of $31.7 million. Depreciation and Amortization was $6.7 million, resulting in EBITDA of $38.4 million (30.8% EBITDA Margin, +380 bps YoY). Net income was $24.8 million. Operating Cash Flow generated for the third quarter was $29.1 million (+36.6% YoY) and Free Cash Flow was $22.4 million.',
    to_tsvector('english', 'ACME Corporation Q3 2026 Financial Results and Statement of Operations. Total Revenue reached $124.5 million, an increase of 18.2% year-over-year compared to $105.3 million in Q3 2025. Cost of Goods Sold was $44.6 million, delivering Gross Profit of $79.9 million representing a Gross Margin of 64.2% (+170 basis points YoY). Operating Expenses included R&D of $23.1M, S&M of $16.3M, and G&A of $8.8M, yielding Operating Income (EBIT) of $31.7 million. Depreciation and Amortization was $6.7 million, resulting in EBITDA of $38.4 million (30.8% EBITDA Margin, +380 bps YoY). Net income was $24.8 million. Operating Cash Flow generated for the third quarter was $29.1 million (+36.6% YoY) and Free Cash Flow was $22.4 million.'),
    now()
), (
    '00000000-0000-0000-0000-000000000263'::uuid,
    '00000000-0000-0000-0000-000000000261'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '430bffc6-7275-499b-b307-d932b4750051'::uuid,
    1,
    'ACME Corporation Balance Sheet & Risk Factors (Item 1A). As of September 30, 2026, Cash and Cash Equivalents stood at $54.2 million. Total debt was $18.5 million, establishing a net cash position of $35.7 million. Risk Factors: 1. Supply Chain Concentration: The company relies on three primary Tier-1 suppliers in Southeast Asia for specialized semiconductor packaging; disruptions could materially delay production. 2. Foreign Currency Volatility: 42% of revenue is generated internationally (APAC and EMEA), exposing operating margins to foreign exchange fluctuations against the US Dollar. 3. Regulatory Compliance: Cross-border data privacy rules and emerging sovereign AI regulations increase compliance overhead and potential penalty risks.',
    to_tsvector('english', 'ACME Corporation Balance Sheet & Risk Factors (Item 1A). As of September 30, 2026, Cash and Cash Equivalents stood at $54.2 million. Total debt was $18.5 million, establishing a net cash position of $35.7 million. Risk Factors: 1. Supply Chain Concentration: The company relies on three primary Tier-1 suppliers in Southeast Asia for specialized semiconductor packaging; disruptions could materially delay production. 2. Foreign Currency Volatility: 42% of revenue is generated internationally (APAC and EMEA), exposing operating margins to foreign exchange fluctuations against the US Dollar. 3. Regulatory Compliance: Cross-border data privacy rules and emerging sovereign AI regulations increase compliance overhead and potential penalty risks.'),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 5. Seed system skill: financial_ratio_calculator
INSERT INTO public.skills (
    id,
    user_id,
    org_id,
    name,
    description,
    instructions,
    is_enabled,
    is_org_shared,
    is_system,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000264'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '430bffc6-7275-499b-b307-d932b4750051'::uuid,
    'financial_ratio_calculator',
    'Calculates key financial ratios (gross margin, EBITDA margin, operating margin, debt-to-equity) from financial metrics.',
    'When asked to calculate financial ratios or margins, apply these formulas:
1. Gross Margin = (Revenue - COGS) / Revenue
2. EBITDA Margin = EBITDA / Revenue
3. Operating Margin = Operating Income (EBIT) / Revenue
4. Net Margin = Net Income / Revenue
Always show intermediate arithmetic and percentage results clearly.',
    true,
    true,
    true,
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 6. Update financial-analyzer expert bundle to bind the seeded folder and skill
UPDATE public.expert_bundles
SET knowledge_folder_ids = ARRAY['00000000-0000-0000-0000-000000000260'::uuid],
    member_skills = ARRAY['financial_ratio_calculator']::text[],
    updated_at = now()
WHERE slug = 'financial-analyzer' AND is_system = true;
