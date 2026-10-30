/**
 * Phase 302 plan 01 (FIX-01 / BUG-261027-01) — the Workspace panel's "Generated files" group.
 *
 * The thread's sandbox outputs, listed after the workspace rows (UI-D1) under their own label
 * (UI-D2). Each row is a native download LINK at the panel's density, OUTSIDE the workspace
 * listbox (UI-D4): no roving focus, no preview, no Versions hook, no ⋯ menu (UI-D7), no
 * fresh-write flash (UI-D8). The download itself is the chat's — one shared hook,
 * `useSandboxDownload` (UI-D5) — so the two surfaces can never download differently.
 *
 * File names render as React text through the shared row; nothing here injects markup.
 */
import { useId } from "react"
import { cn } from "@/lib/utils"
import { FileRow } from "@/components/files/FileRow"
import { fileAgeLabel } from "@/components/files/fileRowUtils"
import { useSandboxDownload } from "@/components/files/useSandboxDownload"
import { GENERATED_FILES_LABEL, type GeneratedFile } from "./generatedFiles"

export interface GeneratedFilesGroupProps {
  files: readonly GeneratedFile[]
  /** The list's ONE instant (the same `rowsNow` the workspace rows use). */
  now: number
}

function GeneratedFileRow({ file, now }: { file: GeneratedFile; now: number }) {
  const { downloading, errorText, href, onClick } = useSandboxDownload(file.url, file.filename)
  const age = fileAgeLabel(file.producedAt, now)

  // A url-less file: the shared row's dead arm ("Download unavailable"), inside a plain div that
  // is not focusable — the chat's dead branch, at panel density.
  if (!href) {
    return (
      <FileRow asChild density="panel" trailing="dead" name={file.filename} age={age}>
        <div className="rounded-md border border-transparent px-2.5 py-2" data-dead="true" />
      </FileRow>
    )
  }

  return (
    <FileRow
      asChild
      density="panel"
      name={file.filename}
      sizeBytes={file.size}
      age={age}
      errorText={errorText}
      trailing={downloading ? "spinner" : "download"}
    >
      <a
        href={href}
        download={file.filename}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-disabled={downloading}
        className={cn(
          "cursor-pointer rounded-md border px-2.5 py-2 transition-colors",
          "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          errorText ? "border-red-500/40" : "border-transparent",
          downloading && "opacity-60 cursor-not-allowed",
        )}
      />
    </FileRow>
  )
}

export function GeneratedFilesGroup({ files, now }: GeneratedFilesGroupProps) {
  const labelId = useId()
  if (files.length === 0) return null
  return (
    <>
      <p
        id={labelId}
        className="px-2.5 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-panel-muted-foreground"
      >
        {GENERATED_FILES_LABEL}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-0.5">
        {files.map((file) => (
          <GeneratedFileRow key={file.filename} file={file} now={now} />
        ))}
      </div>
    </>
  )
}

export default GeneratedFilesGroup
