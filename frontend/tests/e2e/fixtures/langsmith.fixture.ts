// Phase 075.4 Plan 05 Task 2 — LangSmith trace polling fixture (Wave 0 bootstrap).
//
// Plan 06 scenarios use these helpers to assert that:
// (a) every agent run produced a LangSmith trace (no silent skip);
// (b) the trace records the provider that the run was supposed to use
//     (catches the Phase 067.3 N-01 silent-fallback class of bugs).
//
// Soft-skip behavior: if LANGSMITH_API_KEY is unset, every call returns
// null + console.warn. Local dev without the key still runs Playwright
// scenarios; CI MUST set the GitHub Actions secret to enforce the gate.
//
// Threat T-075.4-08 mitigation: the key flows through GitHub Actions
// secrets.LANGSMITH_API_KEY which auto-redacts in step output. We never
// log the key value here; only the absence/presence is observable.

const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 4000, 4000] // 5 attempts, ~15s ceiling

export interface LangSmithTrace {
  id: string
  run_type: string
  metadata?: Record<string, unknown>
  // Other fields exist but we intentionally pin a narrow shape — Plan 06
  // tests should only assert against fields we explicitly type here.
}

export interface PollOptions {
  /** Override backoff schedule (ms). Defaults to BACKOFF_DELAYS_MS. */
  delays?: readonly number[]
  /** Optional AbortSignal for early cancellation. */
  signal?: AbortSignal
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"))
      return
    }
    const t = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(new Error("aborted"))
    })
  })
}

export async function pollLangSmithTrace(
  runId: string,
  opts: PollOptions = {},
): Promise<LangSmithTrace | null> {
  const apiKey = process.env.LANGSMITH_API_KEY
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      "langsmith.fixture: LANGSMITH_API_KEY unset — returning null (soft-skip). " +
        "CI MUST set secrets.LANGSMITH_API_KEY to enforce the gate.",
    )
    return null
  }

  const delays = opts.delays ?? BACKOFF_DELAYS_MS
  const url = `https://api.smith.langchain.com/runs/${encodeURIComponent(runId)}`

  let lastStatus = 0
  for (let i = 0; i < delays.length; i++) {
    await sleep(delays[i], opts.signal)
    const res = await fetch(url, {
      headers: { "X-API-Key": apiKey },
      signal: opts.signal,
    })
    lastStatus = res.status
    if (res.status === 200) {
      const body = (await res.json()) as LangSmithTrace
      return body
    }
    // 404 is expected on the first 1-2 polls while LangSmith ingests the
    // trace. Anything else is an unrecoverable error worth surfacing.
    if (res.status !== 404 && res.status !== 202) {
      throw new Error(
        `pollLangSmithTrace: unexpected status ${res.status} for run ${runId}`,
      )
    }
  }

  // Trace never showed up within the budget. Returning null lets the caller
  // decide whether absence is a hard failure (CI) or a soft warning (local
  // dev with a stale LangSmith state).
  // eslint-disable-next-line no-console
  console.warn(
    `pollLangSmithTrace: trace ${runId} not found after ${delays.length} attempts ` +
      `(last status ${lastStatus}). Returning null.`,
  )
  return null
}

export async function assertLangSmithTraceExists(
  runId: string,
  providerExpected?: string,
  opts?: PollOptions,
): Promise<void> {
  const trace = await pollLangSmithTrace(runId, opts)
  if (trace === null) {
    // Soft-skip on missing API key (already warned in pollLangSmithTrace).
    if (!process.env.LANGSMITH_API_KEY) return
    throw new Error(
      `assertLangSmithTraceExists: no trace found for run ${runId} ` +
        `after exponential backoff. The agent loop may have failed to attach ` +
        `the @traceable decorator (see Phase 075.1 Plan 04 / Phase 067.x).`,
    )
  }

  if (trace.run_type !== "llm") {
    throw new Error(
      `assertLangSmithTraceExists: trace ${runId} has run_type='${trace.run_type}', expected 'llm'.`,
    )
  }

  if (providerExpected) {
    const md = trace.metadata || {}
    const provider =
      (md.provider as string | undefined) ||
      (md.ls_provider as string | undefined) ||
      ""
    if (provider.toLowerCase() !== providerExpected.toLowerCase()) {
      throw new Error(
        `assertLangSmithTraceExists: trace ${runId} provider='${provider}', expected '${providerExpected}' ` +
          `(case-insensitive). Phase 067.3 N-01 class of silent-fallback bug suspected.`,
      )
    }
  }
}
