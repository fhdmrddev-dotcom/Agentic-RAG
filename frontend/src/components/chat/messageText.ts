/**
 * Phase 227 Wave 3 — messageText.ts (B-2).
 *
 * Encapsulates text transformation and deduplication utilities extracted
 * from MessageItem.tsx:
 *   - dedupParagraphs: two-pass paragraph and sentence-level deduplication
 */

/**
 * Phase 076.1 D-07: Render-time dedup for consecutive identical text blocks.
 * Two-pass approach:
 *   1. Split by \n\n and collapse consecutive duplicate paragraphs (handles
 *      models that emit paragraph breaks between repeats).
 *   2. Detect repeated sentence-sized chunks within a single block (handles
 *      models like Anthropic/DeepSeek that concatenate repeats without breaks).
 * Preserves raw data in StreamsProvider unchanged — display-only.
 */
export function dedupParagraphs(text: string): string {
  if (!text) return text

  // Pass 1: paragraph-level dedup (split by \n\n)
  const paragraphs = text.split("\n\n")
  const deduped: string[] = []
  let prev = ""
  for (const p of paragraphs) {
    const trimmed = p.trim()
    if (trimmed === prev && trimmed.length > 20) continue
    deduped.push(p)
    prev = trimmed
  }

  // Pass 2: within each paragraph, detect repeated sentence-sized chunks.
  // If a block contains the same sentence (>30 chars) repeated 2+ times
  // consecutively, collapse to single occurrence.
  const result = deduped.map((block) => {
    if (block.length < 80) return block
    // Only flatten-dedup single-line run-on repeats (models that concatenate
    // the same sentence without a break). A block with real line breaks — e.g.
    // the agent's interim narration — is preserved verbatim so markdown keeps
    // its newlines (breaks:true renders them); Pass 1 already handled
    // paragraph-level repeats. Without this guard the sentence rejoin below
    // collapsed every intra-paragraph newline into a single space (the
    // reported run-on-blob narration).
    if (block.includes("\n")) return block
    // Split on sentence boundaries (period/exclamation/question + space + capital)
    const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z])/)
    if (sentences.length < 2) return block
    const seen: string[] = []
    for (const s of sentences) {
      const trimmed = s.trim()
      if (trimmed.length > 30 && seen.length > 0 && seen[seen.length - 1] === trimmed) {
        continue
      }
      seen.push(trimmed)
    }
    return seen.join(" ")
  })

  return result.join("\n\n")
}
