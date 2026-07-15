"""Pure citation-marker helpers for the Deep agent loop (Phase 153, CITE-01).

The backend is the SINGLE source of citation truth. The model's emitted ``[n]``
markers are untrusted claims about attribution; this module validates them against
the finalized retrieval set and renumbers survivors to match the numbered footer.

Design constraints (do NOT relax):
  * PURE — no Redis, no DB, no I/O, no network, no provider branch. Every function
    here is synchronous and unit-testable in isolation.
  * The ``unique_citations`` list handed in is the canonical, order-preserving dedup
    set (the footer). Its ordering is the one source of numbering truth (D-03).
  * A ``[n]`` marker refers to the source at manifest position ``n``. Because the
    manifest handed to the model is built from the SAME dedup order, a valid marker
    already aligns with the footer; out-of-range / non-member markers are dropped so
    that claim reads unmarked (D-02) — never a broken or fabricated attribution.

Numbering mechanism (Discretion #1): a numbered source manifest is embedded in the
retrieval-turns-only instruction, rebuilt from the deduped set each retrieval turn.
"""

import re

# Density wording (Discretion #3): mark load-bearing facts only, leave framing /
# general knowledge unmarked, one marker per claim, absence-as-signal. This is static
# guidance; the numbered manifest of THIS turn's sources is appended after it.
CITATION_INSTRUCTION = (
    "When you state a specific fact, figure, name, quote, or claim that comes from the "
    "documents retrieved this turn, place a citation marker [n] immediately after it, "
    "where n is the source number from the list below. Cite only load-bearing claims — "
    "the specific facts a reader would want to verify. Do not cite framing sentences, "
    "transitions, your own reasoning, or general knowledge; those flow unmarked. One "
    "marker per claim is enough; never stack markers or add a marker to a sentence that "
    "is not grounded in a listed source. If a sentence draws on your general knowledge "
    "rather than a retrieved source, leave it unmarked — an unmarked sentence tells the "
    "reader it is general knowledge.\n\nSources retrieved this turn:"
)

# Delimiters wrapping the injected note so it can be stripped and refreshed cleanly on
# each retrieval turn (the manifest may grow as more sources are retrieved) without
# double-appending and without disturbing any other instruction (e.g. tool-usage) that
# may have been appended after it (D-12 fresh-each-turn / guard against stacking).
_NOTE_START = "\n\n<<<CITATION_GUIDANCE>>>\n"
_NOTE_END = "\n<<<END_CITATION_GUIDANCE>>>"

# ``[n]`` marker: a bracketed positive integer. Applied only to NON-code text.
_MARKER_RE = re.compile(r"\[(\d+)\]")

# Code regions to pass through untouched (Pitfall 2 — never treat a bracketed int
# inside code as a marker). Fenced blocks first, then inline spans; alternation is
# left-to-right so a fence delimiter is not mis-matched as a single inline span.
_CODE_RE = re.compile(
    r"("
    r"```.*?```"        # fenced ``` ... ``` block
    r"|~~~.*?~~~"        # fenced ~~~ ... ~~~ block
    r"|``.*?``"          # double-backtick inline span
    r"|`[^`\n]*`"        # single-backtick inline span
    r")",
    re.DOTALL,
)


def _deduplicate_citations(citations: list[dict]) -> list[dict]:
    """Deduplicate by ``(document_id, chunk_index)``, preserving first-occurrence order.

    Mirrors ``agent_loop._deduplicate_citations`` (kept here so this module stays
    dependency-free — importing from ``agent_loop`` would be a cycle). Identical key
    and ordering, so the manifest numbering equals the eventual footer numbering.
    """
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in citations:
        key = (c["document_id"], c.get("chunk_index"))
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


def _transform_prose(segment: str, k: int) -> str:
    """Keep ``[n]`` iff ``1 <= n <= k`` (identity renumber to footer row n); drop others."""

    def _keep_or_drop(match: "re.Match[str]") -> str:
        n = int(match.group(1))
        if 1 <= n <= k:
            # Valid member. The number the model was shown (manifest position n) maps
            # to unique_citations[n-1], which is footer row n — so the renumber is an
            # identity by construction (D-03). Keep the token as-is.
            return f"[{n}]"
        # Out-of-range / non-member -> strip so the claim reads unmarked (D-02).
        return ""

    return _MARKER_RE.sub(_keep_or_drop, segment)


def normalize_citation_markers(text: str, unique_citations: list[dict]) -> str:
    """Strip non-member/out-of-range ``[n]`` and align survivors to the footer.

    ``unique_citations`` is the finalized, order-preserving dedup set (the footer).
    ``[n]`` tokens inside inline code spans / fenced blocks are left literal. Pure —
    safe to call at the settle point before persist (D-05).
    """
    if not text:
        return text
    k = len(unique_citations)
    # Split into alternating non-code / code segments; only even indices are prose.
    parts = _CODE_RE.split(text)
    for i in range(0, len(parts), 2):
        parts[i] = _transform_prose(parts[i], k)
    return "".join(parts)


def format_citation_manifest(unique_citations: list[dict]) -> str:
    """Render one numbered line per source, 1-based, in dedup order.

    Chunk rows -> ``[n] {filename} · chunk {chunk_index+1}``; full-doc rows ->
    ``[n] {filename} · full document`` (the ``is_full_doc`` branch, D-10 shape).
    """
    lines: list[str] = []
    for i, c in enumerate(unique_citations):
        n = i + 1
        filename = c.get("filename") or "document"
        if c.get("is_full_doc"):
            lines.append(f"[{n}] {filename} · full document")
        else:
            chunk_index = c.get("chunk_index")
            if chunk_index is not None:
                lines.append(f"[{n}] {filename} · chunk {chunk_index + 1}")
            else:
                lines.append(f"[{n}] {filename}")
    return "\n".join(lines)


def _strip_citation_note(text: str) -> str:
    """Remove a previously-injected citation note (delimited block), wherever it sits."""
    start = text.find(_NOTE_START)
    if start == -1:
        return text
    end = text.find(_NOTE_END, start)
    if end == -1:
        # Malformed (start present, no end) — drop from the start marker onward.
        return text[:start]
    return text[:start] + text[end + len(_NOTE_END):]


def apply_citation_instruction(
    active_system_prompt: str,
    messages: list[dict],
    retrieved_citations: list[dict],
) -> str:
    """Inject the retrieval-turns-only citation instruction via the dual channel.

    Returns the (possibly augmented) system prompt for the native ``system_prompt=``
    channel, and appends the SAME note to the first ``role == "system"`` entry of
    ``messages`` in place for the compat ``messages[0]`` channel (SC#10 — Anthropic
    drops mid-list system messages, so both channels are required).

    When ``retrieved_citations`` is empty this is a no-op: the system prompt is
    returned unchanged and ``messages`` is not touched, so a non-retrieval turn is
    byte-identical (D-12/D-14). Recomputed fresh each retrieval turn (the note is
    stripped and re-appended) so the manifest reflects the current deduped set and
    never double-appends.
    """
    if not retrieved_citations:
        return active_system_prompt

    manifest = format_citation_manifest(_deduplicate_citations(retrieved_citations))
    note = _NOTE_START + CITATION_INSTRUCTION + "\n" + manifest + _NOTE_END

    new_system_prompt = _strip_citation_note(active_system_prompt) + note
    for i, m in enumerate(messages):
        if m.get("role") == "system":
            messages[i] = {
                "role": "system",
                "content": _strip_citation_note(m.get("content", "")) + note,
            }
            break
    return new_system_prompt
