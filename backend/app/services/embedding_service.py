from app.config import settings
from app.services.openai_service import embed_texts


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
