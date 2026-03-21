import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { listDocuments, uploadDocument, deleteDocument } from "@/lib/api"
import type { Document } from "@/types"

interface UseDocuments {
  documents: Document[]
  uploading: boolean
  uploadingCount: number
  upload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  deleteDoc: (id: string) => Promise<void>
}

export function useDocuments(): UseDocuments {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadDocuments = useCallback(async () => {
    const data = await listDocuments()
    setDocuments(data)
  }, [])

  useEffect(() => {
    loadDocuments().catch(console.error)

    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session?.user.id) return

      // No user_id filter here — RLS policies ensure users only receive their
      // own rows. Adding a column filter on UPDATE events requires
      // REPLICA IDENTITY FULL on the table; omitting it avoids that requirement.
      const channel = supabase
        .channel("documents-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "documents",
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
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [loadDocuments])

  const upload = useCallback(async (file: File, folderId?: string | null): Promise<{ isDuplicate: boolean }> => {
    setUploadingCount((c) => c + 1)
    try {
      const { doc, isDuplicate } = await uploadDocument(file, folderId)
      // Optimistically add the document immediately; Realtime UPDATE events
      // will still fire to update status (pending → processing → completed)
      setDocuments((prev) => {
        if (prev.some((d) => d.id === doc.id)) return prev
        return [doc, ...prev]
      })
      return { isDuplicate }
    } finally {
      setUploadingCount((c) => c - 1)
    }
  }, [])

  const deleteDoc = useCallback(async (id: string) => {
    await deleteDocument(id)
    // Realtime DELETE event will update state; optimistically remove too
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { documents, uploading: uploadingCount > 0, uploadingCount, upload, deleteDoc }
}
