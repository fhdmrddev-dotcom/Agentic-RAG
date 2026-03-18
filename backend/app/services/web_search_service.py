import httpx
from langsmith import traceable

TAVILY_API_URL = "https://api.tavily.com/search"


@traceable(name="web_search")
def web_search(query: str, api_key: str, max_results: int = 5) -> str:
    """Search the web using Tavily and return formatted results with attribution."""
    with httpx.Client(timeout=10.0) as client:
        response = client.post(
            TAVILY_API_URL,
            json={
                "api_key": api_key,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
            },
        )
        response.raise_for_status()
        data = response.json()

    results = data.get("results", [])
    if not results:
        return "No web search results found."

    parts = []
    for r in results:
        title = r.get("title", "Untitled")
        url = r.get("url", "")
        content = r.get("content", "").strip()
        parts.append(f"**{title}**\nURL: {url}\n{content}")

    return "\n\n---\n\n".join(parts)
