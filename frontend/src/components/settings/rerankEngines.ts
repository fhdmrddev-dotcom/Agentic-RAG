/**
 * Phase 294-04 (DEC-01 / D-02 / D-05 / D-20a) — THE rerank engine fact table.
 *
 * Every fact an engine card shows lives here and nowhere else (the 024 rule: preset data is an
 * exported table, never hardcoded in component logic). `RerankEngineBlock.tsx` renders these rows;
 * plan 05's chat-side reason line reads `engineFor()` and `keyName`.
 *
 * The ids mirror the backend `EngineId` Literal in
 * `backend/app/services/rerank_engines/registry.py`, and every `defaultModel` appears in that file.
 * Both are pinned by `__tests__/rerankEngines.parity.test.ts` through a `?raw` source read, so an
 * engine added on one side only fails a test instead of shipping a card the server cannot run.
 *
 * Prices are vendor list prices read on 2026-10-20 (294-RESEARCH §1, D-24). Cohere publishes no
 * per-search number we can state, so its price says "per search (Cohere plan)" rather than a figure.
 * `cuts` is true only for the two engines whose scores are probabilities (D-07 / D-08).
 */

export type RerankEngineId = "local" | "jev" | "openai_decisions" | "cohere"

/** Which saved key an engine uses (D-02). `null` = runs on this server, no key. */
export type RerankKeySource = "openrouter" | "openai" | "cohere"

export interface RerankEngineFacts {
  id: RerankEngineId
  /** Card title. */
  name: string
  /** Short label for the chat action ("Check citations · Jev"). */
  shortName: string
  where: "local" | "hosted"
  /** Who receives the passages when hosted; null when the engine runs on this server. */
  vendor: string | null
  defaultModel: string
  keySource: RerankKeySource | null
  /** The key's name in a sentence ("your OpenRouter key"); null when no key is needed. */
  keyName: string | null
  price: string
  /** Drops passages below 0.1 (keeps at least 3). False = reorders only. */
  cuts: boolean
  /** Takes the agent's steering instruction (D-09). */
  steering: boolean
  /** Can run the on-demand citation check (D-16). */
  citationCheck: boolean
  /** A one-time cost the operator should know before choosing; null when there is none. */
  firstUseNote: string | null
}

/** Card order is the order here: On this server, Jev, OpenAI Decisions, Cohere (sketch 294 B). */
export const RERANK_ENGINES: readonly RerankEngineFacts[] = [
  {
    id: "local",
    name: "On this server",
    shortName: "Local",
    where: "local",
    vendor: null,
    defaultModel: "BAAI/bge-reranker-v2-m3",
    keySource: null,
    keyName: null,
    price: "free",
    cuts: false,
    steering: false,
    citationCheck: false,
    // True by construction: plan 01's local engine loads the model on a background thread and
    // the search falls back to today's order until it is resident.
    firstUseNote: "First use downloads about 2.3 GB; until it has loaded, searches keep today's order.",
  },
  {
    id: "jev",
    name: "Jev via OpenRouter",
    shortName: "Jev",
    where: "hosted",
    vendor: "OpenRouter (TypeSafe)",
    defaultModel: "typesafe/jev-1.14",
    keySource: "openrouter",
    keyName: "OpenRouter key",
    price: "$0.042 / 1M input · output free",
    cuts: true,
    steering: true,
    citationCheck: true,
    firstUseNote: null,
  },
  {
    id: "openai_decisions",
    name: "OpenAI Decisions",
    shortName: "OpenAI Decisions",
    where: "hosted",
    vendor: "OpenAI",
    defaultModel: "gpt-6-luna",
    keySource: "openai",
    keyName: "OpenAI key",
    price: "$0.10 / 1M input · output free",
    cuts: true,
    steering: true,
    citationCheck: true,
    firstUseNote: null,
  },
  {
    id: "cohere",
    name: "Cohere",
    shortName: "Cohere",
    where: "hosted",
    vendor: "Cohere",
    defaultModel: "rerank-v3.5",
    keySource: "cohere",
    keyName: "Cohere rerank key",
    price: "per search (Cohere plan)",
    cuts: false,
    steering: false,
    citationCheck: false,
    firstUseNote: null,
  },
] as const

const BY_ID: Record<string, RerankEngineFacts> = Object.fromEntries(RERANK_ENGINES.map((e) => [e.id, e]))

/**
 * The row for a stored `rerank_provider`. Total: the legacy `"api"` (which meant Cohere before
 * 294) and any unknown id resolve to the Cohere row — the backend's own alias — never `undefined`.
 * Own-property guarded, so a prototype key such as `"constructor"` cannot resolve to anything else.
 */
export function engineFor(id: string | null | undefined): RerankEngineFacts {
  if (typeof id === "string" && Object.prototype.hasOwnProperty.call(BY_ID, id)) return BY_ID[id]
  return BY_ID.cohere
}
