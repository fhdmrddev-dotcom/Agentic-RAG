"""Unit tests for app.services.web_search_service.web_search.

All HTTP calls are mocked via httpx — no real network requests.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.services.web_search_service import web_search

API_KEY = "tvly-test-key"


def _make_httpx_response(results: list[dict], status_code: int = 200):
    """Build a mock httpx Response."""
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = {"results": results}
    # raise_for_status raises on 4xx/5xx
    if status_code >= 400:
        from httpx import HTTPStatusError, Request, Response
        response.raise_for_status.side_effect = HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(),
            response=MagicMock(),
        )
    else:
        response.raise_for_status.return_value = None
    return response


def _mock_post(results: list[dict], status_code: int = 200):
    """Return a context-manager-compatible mock for httpx.Client."""
    response = _make_httpx_response(results, status_code)
    client_mock = MagicMock()
    client_mock.__enter__ = MagicMock(return_value=client_mock)
    client_mock.__exit__ = MagicMock(return_value=False)
    client_mock.post.return_value = response
    return client_mock


# ── Happy path ────────────────────────────────────────────────────────────────

class TestWebSearchHappyPath:
    def test_returns_formatted_results(self):
        results = [
            {"title": "Python 3.13", "url": "https://python.org", "content": "Latest release."},
        ]
        with patch("app.services.web_search_service.httpx.Client", return_value=_mock_post(results)):
            output = web_search("latest Python version", API_KEY)
        assert "Python 3.13" in output
        assert "https://python.org" in output
        assert "Latest release." in output

    def test_multiple_results_separated_by_divider(self):
        results = [
            {"title": "Result 1", "url": "https://a.com", "content": "Content A."},
            {"title": "Result 2", "url": "https://b.com", "content": "Content B."},
        ]
        with patch("app.services.web_search_service.httpx.Client", return_value=_mock_post(results)):
            output = web_search("query", API_KEY)
        assert "---" in output
        assert "Result 1" in output
        assert "Result 2" in output

    def test_result_includes_url_label(self):
        results = [{"title": "T", "url": "https://example.com", "content": "body"}]
        with patch("app.services.web_search_service.httpx.Client", return_value=_mock_post(results)):
            output = web_search("query", API_KEY)
        assert "URL: https://example.com" in output

    def test_posts_to_tavily_endpoint(self):
        results = [{"title": "T", "url": "https://x.com", "content": "x"}]
        client_mock = _mock_post(results)
        with patch("app.services.web_search_service.httpx.Client", return_value=client_mock):
            web_search("test query", API_KEY, max_results=3)
        client_mock.post.assert_called_once()
        call_args = client_mock.post.call_args
        assert "tavily.com" in call_args[0][0]

    def test_sends_api_key_and_query_in_body(self):
        results = [{"title": "T", "url": "https://x.com", "content": "x"}]
        client_mock = _mock_post(results)
        with patch("app.services.web_search_service.httpx.Client", return_value=client_mock):
            web_search("my query", API_KEY, max_results=3)
        payload = client_mock.post.call_args[1]["json"]
        assert payload["api_key"] == API_KEY
        assert payload["query"] == "my query"
        assert payload["max_results"] == 3

    def test_handles_missing_title_gracefully(self):
        results = [{"url": "https://x.com", "content": "body"}]  # no title
        with patch("app.services.web_search_service.httpx.Client", return_value=_mock_post(results)):
            output = web_search("query", API_KEY)
        assert "Untitled" in output

    def test_handles_missing_content_gracefully(self):
        results = [{"title": "T", "url": "https://x.com"}]  # no content
        with patch("app.services.web_search_service.httpx.Client", return_value=_mock_post(results)):
            output = web_search("query", API_KEY)
        assert "T" in output  # should not crash


# ── Empty / no results ────────────────────────────────────────────────────────

class TestWebSearchNoResults:
    def test_returns_no_results_message_when_empty(self):
        with patch("app.services.web_search_service.httpx.Client", return_value=_mock_post([])):
            output = web_search("obscure query", API_KEY)
        assert output == "No web search results found."

    def test_returns_no_results_when_results_key_missing(self):
        client_mock = _mock_post([])
        # Override response to return no 'results' key
        client_mock.post.return_value.json.return_value = {}
        with patch("app.services.web_search_service.httpx.Client", return_value=client_mock):
            output = web_search("query", API_KEY)
        assert output == "No web search results found."


# ── Error handling ────────────────────────────────────────────────────────────

class TestWebSearchErrors:
    def test_raises_on_http_error(self):
        from httpx import HTTPStatusError
        client_mock = _mock_post([], status_code=401)
        with patch("app.services.web_search_service.httpx.Client", return_value=client_mock):
            with pytest.raises(HTTPStatusError):
                web_search("query", API_KEY)
