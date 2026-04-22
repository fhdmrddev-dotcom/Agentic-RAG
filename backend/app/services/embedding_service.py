import logging

from app.config import settings
from app.models.document import DocumentMetadata
from app.services.openai_service import embed_texts, get_llm_client

logger = logging.getLogger(__name__)


def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[str]:
    """Split text into overlapping chunks using hierarchical separator priority.

    Separators are tried in order from most structural (markdown headings, paragraph
    breaks) to least (character split). This preserves document structure — headings
    stay with their content, table rows are not split mid-row — and guarantees that
    each chunk advances by at least (chunk_size - overlap) characters, eliminating
    the 1-char sliding bug from period-based sentence detection.
    """
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    if not text.strip():
        return []

    # Tried in priority order. Space after sentence-end punctuation avoids splitting
    # on decimal numbers ($284,500.00) or numbered list markers (1. Item).
    SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", "! ", "? ", " ", ""]

    def _split_and_merge(text: str, separators: list[str]) -> list[str]:
        if not text.strip():
            return []

        # Text already fits — return as-is
        if len(text) <= chunk_size:
            return [text.strip()]

        # Find the first separator that actually divides this text
        chosen_sep: str = ""
        remaining_seps: list[str] = []
        for i, sep in enumerate(separators):
            if sep == "" or sep in text:
                chosen_sep = sep
                remaining_seps = separators[i + 1:]
                break

        # Produce split fragments, re-attaching separator to the start of each
        # subsequent fragment so headings stay with the content that follows them.
        if chosen_sep:
            raw = text.split(chosen_sep)
            splits = [raw[0]] + [chosen_sep + p for p in raw[1:]]
        else:
            # Character-level: treat each char as its own "split"
            splits = list(text)

        # Merge fragments into chunks of at most chunk_size, with overlap carry-over
        chunks: list[str] = []
        current = ""

        for fragment in splits:
            if len(fragment) > chunk_size:
                # Fragment alone exceeds chunk_size. Combine with any already-accumulated
                # text and recurse together — this prevents a tiny heading from being
                # flushed as a standalone chunk just because the body paragraph that
                # follows it is large (e.g. "1.3 Research Problem" + 1200-char paragraph).
                combined = current + fragment
                current = ""
                if remaining_seps:
                    chunks.extend(_split_and_merge(combined, remaining_seps))
                else:
                    # Absolute last resort: hard character split
                    step = max(1, chunk_size - overlap)
                    for i in range(0, len(combined), step):
                        sub = combined[i: i + chunk_size].strip()
                        if sub:
                            chunks.append(sub)
            elif len(current) + len(fragment) <= chunk_size:
                current += fragment
            else:
                # Current chunk is full — flush it, then begin next chunk with
                # an overlap prefix so context is not lost across boundaries.
                if current.strip():
                    chunks.append(current.strip())
                overlap_prefix = current[-overlap:] if len(current) > overlap else current
                current = overlap_prefix + fragment

        if current.strip():
            chunks.append(current.strip())

        return [c for c in chunks if c.strip()]

    return _split_and_merge(text, SEPARATORS)


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
