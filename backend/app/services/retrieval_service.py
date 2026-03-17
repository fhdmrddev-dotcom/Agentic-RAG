from langsmith import traceable
from supabase import Client

from app.config import settings
from app.services.openai_service import embed_texts


@traceable(name="search-documents", run_type="retriever")
def search_documents(query: str, user_id: str, supabase: Client) -> list[dict]:
    query_embedding = embed_texts([query])[0]

    result = supabase.rpc(
        "match_document_chunks",
        {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_count": settings.retrieval_top_k,
            "match_threshold": settings.retrieval_match_threshold,
        },
    ).execute()

    if not result.data:
        return []

    doc_ids = list({row["document_id"] for row in result.data})
    docs_result = supabase.table("documents").select("id, filename").in_("id", doc_ids).execute()
    doc_map = {doc["id"]: doc["filename"] for doc in (docs_result.data or [])}

    return [
        {
            "content": row["content"],
            "document_id": row["document_id"],
            "filename": doc_map.get(row["document_id"], "Unknown"),
            "similarity": row["similarity"],
        }
        for row in result.data
    ]
