import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { listDocuments, uploadDocument, deleteDocument } from "@/lib/api"
import type { Document } from "@/types"

interface UseDocuments {
  documents: Document[]
  uploading: boolean
  uploadingCount: number
  upload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  deleteDoc: (id: string, scope?: "version" | "all") => Promise<void>
  loadDocuments: () => Promise<void>
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
              const newDoc = payload.new as Document
              // Realtime payload reflects ONLY the documents table — but
              // table_count + image_count + chunk_count are server-side
              // aggregates from joined tables (see backend/app/api/documents.py
              // D-09). They are NOT in payload.new. Spread-merge so the prior
              // fetch's aggregates aren't blown away mid-transition; then on
              // terminal-state transitions refetch the list to surface fresh
              // counts (BUG-260516-01 follow-up: user reported "counts don't
              // reflect real-time" after status badge started updating).
              setDocuments((prev) =>
                prev.map((d) => (d.id === newDoc.id ? { ...d, ...newDoc } : d)),
              )
              if (newDoc.status === "completed" || newDoc.status === "failed") {
                loadDocuments().catch(console.error)
              }
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

  const deleteDoc = useCallback(async (id: string, scope?: "version" | "all") => {
    await deleteDocument(id, scope)
    if (scope === "all") {
      // Optimistically remove all documents with the same filename in the same folder
      const target = documents.find((d) => d.id === id)
      if (target) {
        setDocuments((prev) =>
          prev.filter((d) => !(d.filename === target.filename && d.folder_id === target.folder_id))
        )
      }
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    }
  }, [documents])

  return { documents, uploading: uploadingCount > 0, uploadingCount, upload, deleteDoc, loadDocuments }
}
