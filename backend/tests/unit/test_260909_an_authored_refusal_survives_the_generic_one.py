"""A message written FOR a person is not overwritten by an exception's `str()` — 2026-09-09.

⛔ **WHAT THE OPERATOR ACTUALLY SAW.** A watched email failed and its Library row read:

    no bytes in storage for document 47a73155-ee9f-4650-8880-5ccbef929b5a

`splice_document` had already written the sentence meant for a person —
*"The stored copy of this file could not be read, so nothing was extracted from it. Please
upload it again."* — and then `record_job_failure` replaced it, in the same transaction, with
the raw text of the `RuntimeError` the queue happened to catch.

⚠ **BOTH HALVES WERE WRONG.** The internal string leaked to a surface, and the sentence it
replaced was itself giving bad advice: the file was never missing (145,843 bytes, intact in the
bucket, uploaded 22 seconds earlier), so *"upload it again"* was not the remedy.

⚠ **A UUID AND A PYTHON EXCEPTION ARE NOT A USER-FACING VOCABULARY.** This project already
enforces that rule on the read side — `sourceFailureSentence` and `fileFailureKind` exist so a
provider string cannot reach a screen. Nothing enforced it on the WRITE side, so the queue could
put whatever it caught into a column the Library renders verbatim.

## The invariant these tests pin

1. **A claim clears the previous attempt's message.** `documents.error_message` describes the
   CURRENT attempt, so a stale reason can never masquerade as the live one.
2. **A terminal failure fills that column only if this attempt did not already author one.**
   `COALESCE(NULLIF(...))`, so the specific sentence wins and the generic one is the fallback
   rather than the overwrite.

⚠ (1) IS WHAT MAKES (2) SAFE. Preserving an existing message without clearing it on claim would
show a retried document the reason from a previous attempt — a fresher lie than the one being
fixed. The two changes only work as a pair.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db.ingestion_jobs import claim_due_ingestion_jobs, record_job_failure


def _mock_pool():
    pool = MagicMock()
    con = AsyncMock()
    txn = MagicMock()
    txn.__aenter__ = AsyncMock()
    txn.__aexit__ = AsyncMock()
    con.transaction = MagicMock(return_value=txn)
    pool.acquire.return_value.__aenter__.return_value = con
    return pool, con


@pytest.mark.asyncio
async def test_a_terminal_failure_does_not_clobber_a_message_this_attempt_authored():
    """⭐ The whole finding, in one assertion on the SQL that touches `documents`."""
    pool, con = _mock_pool()
    con.fetchrow.return_value = {"retry_count": 2, "max_retries": 3}
    con.fetchval.return_value = uuid4()

    await record_job_failure(
        pool,
        uuid4(),
        error_message="no bytes in storage for document 47a73155-ee9f-4650-8880-5ccbef929b5a",
        is_transient=False,
    )

    doc_updates = [
        c[0][0] for c in con.execute.call_args_list if "UPDATE documents" in str(c[0][0])
    ]
    assert doc_updates, "the terminal path no longer marks the document failed at all"
    sql = " ".join(doc_updates[-1].split())
    assert "COALESCE" in sql.upper() and "NULLIF" in sql.upper(), (
        "documents.error_message is still assigned unconditionally, so an authored sentence is "
        "replaced by whatever str(exc) the queue happened to catch"
    )


@pytest.mark.asyncio
async def test_claiming_a_job_clears_the_previous_attempt_s_message():
    """⚠ The half that makes preservation safe rather than a fresher lie."""
    pool, con = _mock_pool()
    con.fetchval.return_value = 0
    con.fetch.return_value = [{"id": uuid4(), "document_id": uuid4(), "status": "pending"}]

    await claim_due_ingestion_jobs(pool, worker_id="w1", limit=1)

    cleared = [
        c for c in con.execute.call_args_list
        if "UPDATE documents" in str(c[0][0]) and "error_message" in str(c[0][0])
    ]
    assert cleared, (
        "claiming a job leaves the previous attempt's error_message in place — preserving an "
        "authored message would then show a stale reason for the live attempt"
    )
