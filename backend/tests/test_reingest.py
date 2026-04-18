"""
Test stubs for POST /documents/{document_id}/reingest endpoint.

These stubs are intentionally skipped pending test database setup.
Remove the skip markers and add fixture setup to activate them.
"""
import pytest


@pytest.mark.skip(reason="requires test Supabase instance — remove skip to activate")
def test_reingest_sets_status_pending():
    """
    GIVEN: an authenticated user with a document in status='ready' and is_latest=True
    WHEN:  POST /documents/{id}/reingest is called
    THEN:  response is 200 and returned document.status == 'pending'
    """
    pass


@pytest.mark.skip(reason="requires test Supabase instance — remove skip to activate")
def test_reingest_rejects_other_user_document():
    """
    GIVEN: a document owned by user-A
    WHEN:  user-B calls POST /documents/{id}/reingest for that document
    THEN:  response is 404 (ownership enforced via user_id filter)
    """
    pass


@pytest.mark.skip(reason="requires test Supabase instance — remove skip to activate")
def test_reingest_rejects_non_latest_document():
    """
    GIVEN: a document with is_latest=False (an older version)
    WHEN:  POST /documents/{id}/reingest is called for it
    THEN:  response is 404 (endpoint only targets is_latest=True documents)
    """
    pass
