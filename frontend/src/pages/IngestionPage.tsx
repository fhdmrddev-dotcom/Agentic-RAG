import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { useDocuments } from "@/hooks/useDocuments"

export function IngestionPage() {
  const { documents, uploading, uploadingCount, upload, deleteDoc } = useDocuments()

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="max-w-3xl w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Upload documents to give the AI context for your conversations.
          </p>
        </div>

        <DocumentUpload onUpload={upload} uploading={uploading} uploadingCount={uploadingCount} />

        <DocumentList documents={documents} onDelete={deleteDoc} />
      </div>
    </div>
  )
}
