/**
 * Phase 075.9 Task 1 — stable per-tool identifier independent of provider id
 * lifecycle.
 *
 * Why: provider-emitted `tc.id` is unstable during the preparing→running
 * transition. Some providers don't emit an id until tool_start; others change
 * the id between SSE events; OpenRouter occasionally re-issues ids after
 * retry. Any UI surface that uses `tc.id` as a Record key or dedup key
 * suffers stale/duplicate state mid-stream.
 *
 * Stable-key contract: derive the key from (provider, messageId, name,
 * observedAt) at first observation. The streams store (StreamsProvider)
 * stamps the resulting `tc.clientKey` on creation and never mutates it.
 * Reads should ALWAYS prefer `tc.clientKey` over `tc.id` for React keys,
 * dedup keys, and Record keys.
 *
 * The `index` field disambiguates the rare collision where the same tool
 * name is observed twice within the same message at the same millisecond
 * (e.g. two near-simultaneous `analyze_document` calls in the same agent
 * loop iteration).
 */

export interface MakeToolKeyOptions {
  /** Provider id (e.g. "openai", "anthropic", "openrouter", "google"). */
  provider?: string | null
  /** Owning assistant-message id. Stable for the lifetime of the message. */
  messageId?: string | null
  /** Tool name (e.g. "execute_code", "search_documents"). */
  name: string
  /** Milliseconds since epoch at first observation (typically Date.now()). */
  observedAt: number
  /** Per-message tool index, used to break ties when all other fields collide. */
  index?: number
}

export function makeToolKey(opts: MakeToolKeyOptions): string {
  const parts = [
    opts.provider ?? "unknown",
    opts.messageId ?? "no-msg",
    opts.name,
    String(opts.observedAt),
    opts.index != null ? String(opts.index) : "",
  ]
  return parts.join("|")
}
