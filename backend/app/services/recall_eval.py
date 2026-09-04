"""Phase 230 Plan 05 / Phase 241 — Recall Evaluation Helpers.

Standard metrics calculation and probe dataset for the 77-document baseline corpus.
"""
from typing import Sequence

# Standard 10-query evaluation probe set over the 77 baseline documents
EVAL_PROBES = [
    {
        "query": "Northwind quarterly business review September 2026",
        "target_filename": "northwind-qbr-notes-sept-2026.md",
    },
    {
        "query": "commercial contract renewal Northwind pricing terms",
        "target_filename": "northwind-commercials-renewal.md",
    },
    {
        "query": "UAE Credit Reports BNPL buy now pay later and micro loan",
        "target_filename": "Update UAE Credit Reports now include BNPL and micro-loan information.eml",
    },
    {
        "query": "Project risks, mitigations and probability impact log",
        "target_filename": "risk-log.md",
    },
    {
        "query": "Triangulation research methodology with visuals",
        "target_filename": "Triangulation_Research_Complete_with_Visuals.docx",
    },
    {
        "query": "metrics decisions knowledge base document 3",
        "target_filename": "kb_doc3_metrics_decisions.md",
    },
    {
        "query": "uat111 axisa minimax integration testing",
        "target_filename": "uat111_axisa_minimax.md",
    },
    {
        "query": "uat111 axisa zhipu provider evaluation",
        "target_filename": "uat111_axisa_zhipu.md",
    },
    {
        "query": "supplier rate card and master rate sheet takeoff",
        "target_filename": "sample_master_rate_sheet.xlsx",
    },
    {
        "query": "board pack presentation 2026 Q3 agenda and governance",
        "target_filename": "2026 Q3 board pack.pdf",
    },
]


def compute_metrics(ranks: Sequence[int | None]) -> dict[str, float]:
    """Compute Hit@1, Hit@3, Hit@5, and MRR from a sequence of 1-indexed ranks."""
    if not ranks:
        return {"hit_at_1": 0.0, "hit_at_3": 0.0, "hit_at_5": 0.0, "mrr": 0.0}

    hit_1 = sum(1 for r in ranks if r is not None and r <= 1) / len(ranks)
    hit_3 = sum(1 for r in ranks if r is not None and r <= 3) / len(ranks)
    hit_5 = sum(1 for r in ranks if r is not None and r <= 5) / len(ranks)
    mrr = sum(1.0 / r for r in ranks if r is not None and r > 0) / len(ranks)

    return {
        "hit_at_1": round(hit_1, 4),
        "hit_at_3": round(hit_3, 4),
        "hit_at_5": round(hit_5, 4),
        "mrr": round(mrr, 4),
    }
