import { supabase } from "./supabase"
import type { Thread, Message } from "../types"

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

export async function listThreads(): Promise<Thread[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads`, { headers })
  if (!res.ok) throw new Error("Failed to list threads")
  return res.json() as Promise<Thread[]>
}

export async function createThread(title = "New Chat"): Promise<Thread> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to create thread")
  return res.json() as Promise<Thread>
}

export async function getMessages(threadId: string): Promise<Message[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, { headers })
  if (!res.ok) throw new Error("Failed to get messages")
  return res.json() as Promise<Message[]>
}

export async function streamMessage(
  threadId: string,
  content: string,
  onDelta: (text: string) => void,
  onDone: () => void,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content }),
  })

  if (!res.ok) throw new Error("Failed to send message")
  if (!res.body) throw new Error("No response body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const raw = line.slice(6).trim()
      if (raw === "[DONE]") {
        onDone()
        return
      }
      try {
        const parsed = JSON.parse(raw) as { type: string; content: string }
        if (parsed.type === "delta") {
          onDelta(parsed.content)
        }
      } catch {
        // ignore malformed lines
      }
    }
  }

  onDone()
}
