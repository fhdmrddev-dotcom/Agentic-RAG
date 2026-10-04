---
title: Streaming (SSE) and reconnecting
slug: api/concepts/streaming
section: api
audience: developer
status: written
release: shipped
covers: [H43, E17]
summary: >-
  Sending a message starts a run and returns its id; you read the answer from the run's
  Server-Sent Events stream and can replay it from the start after a disconnect.
reviewed: 2026-10-04
---

A chat answer is produced by a **run** that keeps going on the server whether or not anyone is watching. You start it with one request and read it with another, so a dropped connection never loses the answer.

## 1. Send the message

```http
POST /threads/{thread_id}/messages
Authorization: Bearer <access_token>
Content-Type: application/json

{"content": "What are the payment terms in the Acme contract?"}
```

The response comes back straight away — it does not stream — with status `201`:

```json
{"message_id": "…", "run_id": "…", "model": "…", "provider": "…"}
```

`model` and `provider` are the ones the server resolved for this run. You can pass `model` and `provider` in the request body to choose them for this message.

## 2. Read the run's stream

```http
GET /runs/{run_id}/stream?since=0
Authorization: Bearer <access_token>
Accept: text/event-stream
```

The response is a Server-Sent Events stream. Each event is a `data:` line holding a JSON object with a `type` field — text deltas, tool activity, run status and so on. The event types are the app's own and may change; treat unknown types as safe to ignore. The stream ends after a terminal event: `done`, `error`, `cancelled` or `timed_out`.

> **Note:** The browser's built-in `EventSource` cannot send an `Authorization` header. Read the stream with `fetch` (or any HTTP client that streams the body) instead.

## Reconnecting

Run events are buffered on the server. If your connection drops, open `GET /runs/{run_id}/stream?since=0` again: the stream replays the run from its first event and then continues live. Replaying is safe to repeat, and it is what the Syrel app does after a refresh. If the run has already finished, you receive its terminal event.

To find a run to reconnect to, `GET /threads/{thread_id}/active-runs` lists the thread's runs that are still in progress.

## Controlling a run

| Request | What it does |
|---|---|
| `DELETE /runs/{run_id}` | Cancels the run. |
| `POST /runs/{run_id}/ask_user_response` | Answers a question the run is waiting on. |
| `POST /runs/{run_id}/continue` | Grants a run that reached its step limit a bounded amount of extra work. |

## Stream errors

| Status / event | Meaning |
|---|---|
| `404` "Run not found" | The run does not exist, or it is not yours. |
| `503` "Streaming infrastructure unavailable" | The server's stream store (Redis) is unreachable. Retry later. |
| event `{"type": "error", "error": "invalid_since"}` | The `since` value was not a valid stream position. Use `0`. |

## A note on event detail

While a model writes a large tool call, the stream may report the arguments' progress in chunks. The size of those chunks is an internal setting, not something to rely on.

## Related

- [Authentication](/docs/api/concepts/authentication)
- [Errors](/docs/api/concepts/errors)
