from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import asyncpg
import pytest
from fastapi.datastructures import UploadFile

from app.services.expert_authoring import (
    ExpertDraftOutput,
    _generate_fallback_draft,
    generate_expert_draft,
)


# --- 1. Unit Tests for AI Drafting Service ---

@pytest.mark.asyncio
async def test_generate_fallback_draft_heuristics():
    # HR prompt
    hr_draft = _generate_fallback_draft(
        description="HR specialist for employee onboarding and leave policies",
    )
    assert hr_draft.icon == "shield"
    assert hr_draft.category == "Human Resources"
    assert hr_draft.scope_mode == "biased"
    assert hr_draft.tool_floor_enabled is True
    assert len(hr_draft.prompt_suggestions) == 3

    # Legal prompt
    legal_draft = _generate_fallback_draft(
        description="Corporate contract review and legal compliance officer",
    )
    assert legal_draft.icon == "scale"
    assert legal_draft.category == "Legal"

    # Engineering prompt
    dev_draft = _generate_fallback_draft(
        description="DevOps engineering and code deployment specialist",
    )
    assert dev_draft.icon == "terminal"
    assert dev_draft.category == "Engineering"


@pytest.mark.asyncio
async def test_generate_expert_draft_asset_grounding():
    folder_id = uuid4()
    folders = [{"id": str(folder_id), "name": "Company HR Policies"}]
    skills = [{"name": "policy_summary", "description": "Summarize company policies"}]
    connections = [{"slug": "slack_alerts", "service_name": "Slack Notifications"}]

    draft = await generate_expert_draft(
        description="HR specialist using company policies and slack alerts",
        brainstorm_text="We need to review leave policies and alert team on Slack",
        available_folders=folders,
        available_skills=skills,
        available_connections=connections,
    )

    assert isinstance(draft, ExpertDraftOutput)
    assert draft.name
    assert draft.slug
    assert draft.scope_mode == "biased"
    assert draft.tool_floor_enabled is True
    assert folder_id in draft.knowledge_folder_ids
    assert "policy_summary" in draft.member_skills
    assert "slack_alerts" in draft.required_connections


@pytest.mark.asyncio
async def test_generate_expert_draft_uses_forced_emit():
    mock_emit = AsyncMock(return_value={
        "emitted": {
            "name": "Tax Synthesizer",
            "slug": "tax-synthesizer",
            "icon": "scale",
            "category": "Finance",
            "when_to_use": 'Consult for quarterly tax synthesis, provision roll-forwards, and reconciling estimates against filed returns.',
            "example_output": '## Q3 Tax Provision\n\n| Component | Amount | Basis |\n|---|---|---|\n| Current federal | 412,000 | Taxable income x statutory rate |\n| Deferred | (38,000) | Timing differences |\n\n**Effective rate**: 21.4%.',
            "description": 'Synthesises quarterly tax positions from source filings and ledgers. Synthesises quarterly tax positions from source filings and ledgers. Synthesises quarterly tax positions from source filings and ledgers. Synthesises quarterly tax positions from source filings and ledgers. Synthesises quarterly tax positions from source filings and ledgers. Synthesises quarterly tax positions from source filings and ledgers. Synthesises quarterly tax positions from source filings and ledgers. Synthesises quarterly tax positions from source filings and ledgers. ',
            "scope_mode": "biased",
            "tool_floor_enabled": True,
            # BUG-260921-01a: the draft contract now requires EXACTLY 3 tiles whose
            # prompt bodies clear 150 chars. A thin fixture falls to the fallback and this
            # test's own name assertion is what catches it — the floors bind on mocked
            # payloads too, which is the point.
            "prompt_suggestions": [
                {"title": f"Q{i} Tax", "prompt": 'Compute the Q3 tax estimate from the filings in scope. Show the taxable-income build, the statutory and effective rates, and reconcile the result against the prior quarter, citing each figure to its source document.'} for i in range(1, 4)
            ],
            "member_skills": [],
            "knowledge_folder_ids": [],
            "required_connections": [],
            # Phase 263 (D-263-02): REQUIRED on ExpertDraftOutput. ⛔ Omitting it here does
            # NOT surface as a ValidationError — `generate_expert_draft` constructs the model
            # inside a `try` whose `except Exception` reaches the fallback, so the assertion
            # that fails is an unrelated one about the NAME ("… Specialist" instead of the
            # emitted name). The success path validates the dict too, not just the fallback.
            "suggested_new_skills": [],
        }
    })

    with patch("app.services.expert_authoring.forced_emit", mock_emit):
        res = await generate_expert_draft(
            description="Expert to synthesize quarterly taxes",
        )
        assert res.name == "Tax Synthesizer"
        assert res.slug == "tax-synthesizer"
        assert mock_emit.called
        call_kwargs = mock_emit.call_args[1]
        assert call_kwargs["emitter"] == "emit_expert_draft"
        assert call_kwargs["schema_model"] == ExpertDraftOutput


# --- 2. Non-Ingestion Guarantee Verification Test ---

@pytest.mark.asyncio
async def test_expert_draft_non_ingestion_guarantee():
    """Verify that uploading files to /experts/draft NEVER inserts rows into documents or chunks (PACK-09)."""
    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres", timeout=2)
    except Exception:
        pytest.skip("Local PostgreSQL not reachable on 127.0.0.1:54322")

    try:
        # Measure initial document and chunk counts
        doc_count_before = await conn.fetchval("SELECT count(*) FROM public.documents;")
        chunk_count_before = await conn.fetchval("SELECT count(*) FROM public.document_chunks;")

        # Simulate uploading 2 brainstorm files
        file1 = UploadFile(
            file=io.BytesIO(b"Quarterly Financial Plan and Forecast Notes 2026\nRevenue target $10M."),
            filename="notes_2026.txt",
        )
        file2 = UploadFile(
            file=io.BytesIO(b"Policy Guidelines for Internal Auditing and Expense Compliance."),
            filename="guidelines.md",
        )

        from app.api.experts import draft_expert

        # Call the draft_expert endpoint handler directly with active mock user
        org_id = uuid4()
        draft_result = await draft_expert(
            description="Auditor for financial forecasts and policy guidelines",
            files=[file1, file2],
            active_org=str(org_id),
            current_user={"id": str(uuid4()), "role": "org-admin"},
            pool=conn,
        )

        # Assert valid draft produced
        assert draft_result is not None
        assert isinstance(draft_result, ExpertDraftOutput)
        assert draft_result.name

        # Verify documents and chunks counts remain STRICTLY IDENTICAL (zero additions)
        doc_count_after = await conn.fetchval("SELECT count(*) FROM public.documents;")
        chunk_count_after = await conn.fetchval("SELECT count(*) FROM public.document_chunks;")

        assert doc_count_after == doc_count_before, (
            f"Non-ingestion violation: documents grew from {doc_count_before} to {doc_count_after}"
        )
        assert chunk_count_after == chunk_count_before, (
            f"Non-ingestion violation: document_chunks grew from {chunk_count_before} to {chunk_count_after}"
        )
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_expert_draft_pdf_docx_extraction():
    """Verify F-2: in-memory text extraction for PDF and DOCX brainstorm files in /experts/draft."""
    from app.api.experts import draft_expert
    from docx import Document as DocxDocument

    # 1. Create in-memory DOCX
    docx_io = io.BytesIO()
    doc = DocxDocument()
    doc.add_paragraph("Employee Leave Policy Document and Guidelines")
    doc.save(docx_io)
    docx_file = UploadFile(
        file=io.BytesIO(docx_io.getvalue()),
        filename="leave_policy.docx",
    )

    # 2. Mock pypdf reader for PDF extraction
    mock_pdf_page = MagicMock()
    mock_pdf_page.extract_text.return_value = "Quarterly Compliance and Risk Assessment Report"
    mock_pdf_reader = MagicMock()
    mock_pdf_reader.pages = [mock_pdf_page]

    pdf_file = UploadFile(
        file=io.BytesIO(b"%PDF-1.4 test mock pdf content"),
        filename="compliance_report.pdf",
    )

    mock_pool = MagicMock()
    mock_pool.fetch = AsyncMock(return_value=[])

    with patch("pypdf.PdfReader", return_value=mock_pdf_reader), \
         patch("app.services.expert_authoring.forced_emit", new_callable=AsyncMock) as mock_emit:
        mock_emit.return_value = {
            "emitted": {
                "name": "Policy & Compliance Officer",
                "slug": "policy-compliance-officer",
                "icon": "shield",
                "category": "Legal",
                "when_to_use": 'When reviewing HR and compliance policies, auditing leave entitlements, or assessing regulatory exposure across filings.',
                "example_output": '## Compliance Risk Memo\n\n| Area | Finding | Severity | Action |\n|---|---|---|---|\n| Leave accrual | Policy conflicts with statute in two regions | High | Amend clause 4.2 |\n| Retention | No stated schedule | Medium | Publish schedule |',
                "description": 'Reviews HR and compliance policy source material, extracting obligations and flagging conflicts against statute. Reviews HR and compliance policy source material, extracting obligations and flagging conflicts against statute. Reviews HR and compliance policy source material, extracting obligations and flagging conflicts against statute. Reviews HR and compliance policy source material, extracting obligations and flagging conflicts against statute. Reviews HR and compliance policy source material, extracting obligations and flagging conflicts against statute. ',
                "scope_mode": "biased",
                "tool_floor_enabled": True,
                # BUG-260921-01a: 3 tiles with >=150-char prompts are now contractual.
                "prompt_suggestions": [
                    {"title": f"Audit {n}", "prompt": 'Review the attached policy material end to end. Extract every stated obligation, flag each conflict with statute or internal precedent, and rank the findings by severity, citing the clause and document behind each one.'} for n in ("Leave", "Retention", "Exposure")
                ],
                "member_skills": [],
                "knowledge_folder_ids": [],
                "required_connections": [],
                "suggested_new_skills": [],  # Phase 263 (D-263-02) — required
            }
        }

        res = await draft_expert(
            description="Policy and compliance reviewer",
            files=[docx_file, pdf_file],
            active_org=str(uuid4()),
            current_user={"id": str(uuid4()), "role": "org-admin"},
            pool=mock_pool,
        )

        assert res.name == "Policy & Compliance Officer"
        assert mock_emit.called
        # Verify brainstorm_text received the extracted text from both docx and pdf
        call_kwargs = mock_emit.call_args[1]
        user_content = call_kwargs["messages"][0]["content"]
        assert "Employee Leave Policy Document and Guidelines" in user_content
        assert "Quarterly Compliance and Risk Assessment Report" in user_content


@pytest.mark.asyncio
async def test_expert_draft_without_files():
    """Verify draft_expert succeeds when no brainstorm files are attached (files=None)."""
    from app.api.experts import draft_expert

    mock_pool = MagicMock()
    mock_pool.fetch = AsyncMock(return_value=[])

    res = await draft_expert(
        description="Academic review specialist for thesis review",
        files=None,
        active_org=str(uuid4()),
        current_user={"id": str(uuid4()), "role": "org-admin"},
        pool=mock_pool,
    )

    assert isinstance(res, ExpertDraftOutput)
    assert res.name
    assert res.slug
    assert res.scope_mode == "biased"
    assert res.tool_floor_enabled is True

