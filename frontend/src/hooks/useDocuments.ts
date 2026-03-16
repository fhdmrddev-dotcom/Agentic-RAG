import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { listDocuments, uploadDocument, deleteDocument } from "@/lib/api"
import type { Document } from "@/types"

interface UseDocuments {
  documents: Document[]
  uploading: boolean
  upload: (file: File) => Promise<void>
  deleteDoc: (id: string) => Promise<void>
}

export function useDocuments(): UseDocuments {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadDocuments = useCallback(async () => {
    const data = await listDocuments()
    setDocuments(data)
  }, [])

  useEffect(() => {
    loadDocuments().catch(console.error)

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id ?? null
      if (!userId) return

      const channel = supabase
        .channel("documents-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "documents",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === "UPDATE") {
              setDocuments((prev) =>
                prev.map((d) => (d.id === (payload.new as Document).id ? (payload.new as Document) : d)),
              )
            } else if (payload.eventType === "INSERT") {
              const newDoc = payload.new as Document
              setDocuments((prev) => {
                if (prev.some((d) => d.id === newDoc.id)) return prev
                return [newDoc, ...prev]
              })
            } else if (payload.eventType === "DELETE") {
              setDocuments((prev) => prev.filter((d) => d.id !== (payload.old as Document).id))
            }
          },
        )
        .subscribe()

      channelRef.current = channel
    })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [loadDocuments])

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const doc = await uploadDocument(file)
      // Optimistically add the document immediately; Realtime UPDATE events
      // will still fire to update status (pending → processing → completed)
      setDocuments((prev) => {
        if (prev.some((d) => d.id === doc.id)) return prev
        return [doc, ...prev]
      })
    } finally {
      setUploading(false)
    }
  }, [])

  const deleteDoc = useCallback(async (id: string) => {
    await deleteDocument(id)
    // Realtime DELETE event will update state; optimistically remove too
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { documents, uploading, upload, deleteDoc }
}
