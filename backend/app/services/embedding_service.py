import logging

from app.config import settings
from app.models.document import DocumentMetadata
from app.services.openai_service import embed_texts, get_llm_client

logger = logging.getLogger(__name__)


def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[str]:
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    if not text.strip():
        return []

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + chunk_size, text_len)

        # Try to break at sentence boundary within the overlap window
        if end < text_len:
            search_start = max(start + overlap, end - overlap)
            for i in range(end, search_start, -1):
                if text[i - 1] in ".!?":
                    end = i
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        next_start = end - overlap
        if next_start <= start:
            next_start = start + 1
        start = next_start

    return chunks


def embed_chunks(chunks: list[str], model: str | None = None) -> list[list[float]]:
    if not chunks:
        return []
    return embed_texts(chunks, model=model)


def extract_metadata(content: str, model: str | None = None) -> DocumentMetadata | None:
    """Extract structured metadata from document text using the LLM.

    Uses the first ~3000 characters (~750 tokens) — enough to capture title,
    abstract, and author block without wasting tokens. Returns None on any
    failure so ingestion is never blocked.
    """
    snippet = content[:3000].strip()
    if not snippet:
        return None

    try:
        client = get_llm_client()
        response = client.chat.completions.create(
            model=model or settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract structured metadata from the provided document text. "
                        "Return ONLY a JSON object with these fields (use null for any you cannot determine): "
                        "\"title\" (string), \"author\" (string), \"date\" (string, ISO 8601 YYYY-MM-DD preferred), "
                        "\"document_type\" (string, lowercase noun: report, tutorial, article, specification, email, meeting notes, etc.), "
                        "\"topics\" (array of 3-7 concise strings), \"language\" (string, e.g. English), "
                        "\"summary\" (string, 1-3 sentences). "
                        "No markdown, no explanation — only the JSON object."
                    ),
                },
                {"role": "user", "content": f"Document text:\n\n{snippet}"},
            ],
            response_format={"type": "json_object"},
            stream=False,
        )
        return DocumentMetadata.model_validate_json(response.choices[0].message.content)
    except Exception as e:
        # Metadata extraction is best-effort — never block ingestion
        logger.warning("Metadata extraction failed: %s", e, exc_info=True)
        return None
