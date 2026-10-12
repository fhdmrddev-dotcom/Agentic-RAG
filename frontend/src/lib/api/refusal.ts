/**
 * Phase 275 plan 02 (S10 / D-14) — THE ONE TYPED REFUSAL for the delete clients.
 *
 * A legal hold refuses a delete with HTTP 409 and `detail: {code, title, message, held_count}`.
 * The delete clients used to throw a bare `Error("Failed to delete …")`, so every door said
 * "Delete failed. Please try again." — the wrong advice for a hold. They now throw THIS, and a
 * door renders `title` + `message` (the server's own sentence, built in `hold_guard.py`).
 *
 * ⚠ It extends `Error`, NOT `ApiError`, and imports nothing — on purpose. Measured at this plan: a
 * subclass of `ApiError` is evaluated when `documents.ts` loads, and every suite that mocks `_core`
 * with a factory lacking `ApiError` then throws AT MOUNT (two suites went red — the 196-08 failure
 * mode). `deleteDocument` / `deleteFolder` threw a plain `Error` before, so nothing is lost there;
 * `purgeWatchFiles` loses only `ApiError`'s 401 session latch on that one call.
 *
 * ⛔ This lives in its OWN module, imported (never re-exported) by `documents.ts` and
 * `sources.ts`: `apiBarrel.test.ts` requires every runtime export of `api/documents.ts` to be
 * re-exported by `lib/api.ts`, and a class added there would widen that public surface.
 * The shape mirrors `attachments.ts`'s `PromoteError` + `refusalOf`.
 */
export class ApiRefusal extends Error {
  readonly status: number
  /** The bold lead the door renders (`"Can't delete."` for a hold); empty when the server sent none. */
  readonly title: string

  constructor(status: number, title: string, message: string) {
    super(message)
    this.name = "ApiRefusal"
    this.status = status
    this.title = title
  }
}

/**
 * Unwrap FastAPI's `detail`: a plain string, or `{title?, message?}`. A body that is not JSON,
 * or carries no sentence, falls back to `fallback` — never to raw HTML.
 */
export async function refusalOf(res: Response, fallback: string): Promise<ApiRefusal> {
  const body = await res.json().catch(() => null)
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === "string" && detail.trim() !== "") {
    return new ApiRefusal(res.status, "", detail)
  }
  const structured = (detail ?? null) as { title?: unknown; message?: unknown } | null
  const title = typeof structured?.title === "string" ? structured.title : ""
  const message =
    typeof structured?.message === "string" && structured.message.trim() !== ""
      ? structured.message
      : fallback
  return new ApiRefusal(res.status, title, message)
}
