/**
 * Phase 293-04 (D-19, T-293-25) — the copy-ready `curl` text on the show-once card. PURE.
 *
 * Built from the REAL values, never placeholders the caller must discover: the API base the
 * frontend itself calls, the just-created secret, the workflow's id, and the workflow's declared
 * launch field keys in declared order (the same rule the server's `declared_fields` applies, both
 * pinned to `launch_fields_cases.json`). Only each input's VALUE is a placeholder, `"<key>"`.
 *
 * Paths are the inbound door's (plan 293-02): `POST /inbound/workflows/{id}/runs` and
 * `GET /inbound/runs/{run_id}`, both with `Authorization: Bearer <secret>`.
 */

/** The base for a pasted command. An absolute `VITE_API_BASE_URL` is used as is; a relative one
 *  (a same-origin deploy) is resolved against the page's origin, because a shell has no origin. */
export function apiBaseForCurl(apiBase: string | undefined | null, origin: string): string {
  const raw = (apiBase ?? "").trim()
  const absolute = /^https?:\/\//i.test(raw) ? raw : new URL(raw || "/", origin).toString()
  return absolute.replace(/\/+$/, "")
}

/** Text inside a single-quoted shell word: a `'` closes, escapes and reopens the quote. */
function shellSingleQuoted(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`
}

export function startCurl({
  base,
  secret,
  workflowId,
  fields,
}: {
  base: string
  secret: string
  workflowId: string
  fields: readonly { key: string }[]
}): string {
  const pairs = fields.map((f) => `${JSON.stringify(f.key)}: ${JSON.stringify(`<${f.key}>`)}`)
  const body = `{"inputs": {${pairs.join(", ")}}}`
  return [
    `curl -X POST "${base}/inbound/workflows/${encodeURIComponent(workflowId)}/runs" \\`,
    `  -H "Authorization: Bearer ${secret}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d ${shellSingleQuoted(body)}`,
  ].join("\n")
}

export function statusCurl({ base, secret }: { base: string; secret: string }): string {
  return [`curl "${base}/inbound/runs/RUN_ID" \\`, `  -H "Authorization: Bearer ${secret}"`].join("\n")
}

/** A sample status read (the `InboundRunRead` wire), shown closed under the commands. */
export function statusSampleJson(): string {
  const sample = {
    run_id: "7f3a91c2-5b1e-4d0a-9c8f-2e6b1a0d4f13",
    status: "completed",
    step_index: 3,
    step_total: 3,
    waiting_on: null,
    output_text: "Renewal brief for Acme Logistics: the contract renews on 1 Dec 2026 …",
    end_reason: null,
    steps: [
      { name: "Find the contract", state: "completed" },
      { name: "Check the renewal terms", state: "completed" },
      { name: "Write the brief", state: "completed" },
    ],
    files: [
      {
        name: "renewal-brief.docx",
        size_bytes: 48213,
        url: "https://syrel.example.com/api/inbound/files/one-time-link-token",
        expires_in: 300,
      },
    ],
  }
  return JSON.stringify(sample, null, 2)
}
