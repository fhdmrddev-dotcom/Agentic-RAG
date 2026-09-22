/**
 * Phase 262 plan 04 (PACK-12) — the Expert detail view.
 *
 * ⭐ THIS IS THE FIRST COMPONENT IN THE REPOSITORY TO RENDER `example_output` AT ALL. RESEARCH R-3
 * measured it: the admin surface renders three of migration 189's four presentation columns and
 * this one is rendered by NOTHING — not by the org management tab, not by the composer, not by
 * the spotlight. So there is no precedent to copy for the sample deliverable, and the criterion
 * the ROADMAP writes for it is the CONTENT, never a block being present. `262-RECORD.md` is the
 * sharper version of this project's "presence assertions cannot see content drift" finding: the
 * content here was never rendered at all, so a presence assertion would have passed over the
 * defect for two phases.
 *
 * ⛔ THE MODAL NAMES; IT DOES NOT COUNT. The card face carries the folder COUNT, deliberately
 * (plan 03, sketch §1). Here every bound resource is spelled out — PACK-12's own words are
 * "what knowledge it reads, which connections it needs". The admin tab's envelope line is the
 * exact shape this requirement exists to replace, and it is NOT copied.
 *
 * ⛔ A KNOWLEDGE FOLDER CAN LEGITIMATELY HAVE NO NAME HERE, AND SAYING SO IS THE POINT.
 * Migration 188 seeds the one system Expert's folder into a SINGLE org, so every other tenant's
 * `listFolders()` resolves nothing for it (RESEARCH §4b / P-6). Names come ONLY from the caller's
 * own visible folders — this component never fetches a folder by id, so it cannot name one the
 * caller has no access to (T-262-14). An id it cannot name renders {@link UNNAMEABLE_FOLDER}, so
 * the list still adds up and the reason is on screen. "Unknown" is not "none".
 *
 * ⛔ EVERY OPTIONAL FIELD OWES AN HONEST LINE. All four presentation columns are optional on
 * `ExpertBundle`. A blank section states a fact about the Expert that nobody measured; the
 * absence is named instead, and the literal string `undefined` must never reach the DOM.
 *
 * ⛔ THE SAMPLE DELIVERABLE IS TEXT, NEVER MARKUP (T-262-13). It is the longest author-controlled
 * string this app renders to other org members. It is a React text child inside a pre-formatted
 * block, so React escapes it; there is no rich-text pass and no raw-HTML escape hatch. The
 * disclosure is React state rather than the native HTML disclosure element, because the native
 * one keeps its content in the DOM while closed — which would let a content assertion pass
 * against text nobody can see, and this whole requirement is about text nobody can see.
 *
 * ⛔ THE FOOTER CARRIES TWO CONTROLS, NOT THREE. The sketch draws a third, deferred by CONTEXT as
 * `SEED-303 S8` — a write on a read surface. It is named in `262-04-SUMMARY.md` rather than here,
 * because the acceptance grep proving it absent from this file would be satisfied by a comment
 * spelling it (the trap plans 02 and 03 each recorded). It is not rendered in any form, including
 * a disabled or coming-soon one: a control that cannot act is the dead affordance D-262-02
 * refuses a whole requirement over.
 *
 * ⚠ THE ACTION PROMPTS RENDER AS CONTENT, NOT AS TRIGGERS, AND THAT IS A STATED SCOPE CALL.
 * PACK-12 requires the example prompts to be READABLE; one-click execution needs a callback that
 * carries the prompt it names, and no props contract in this phase declares one. Pointing a tile
 * at the footer's action would start a conversation WITHOUT the prompt the tile advertises — a
 * control that lies about itself, which is the dishonesty this phase exists to remove. Reasoning
 * and the re-open trigger are in `262-04-SUMMARY.md`.
 */

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, EyeOff, FolderClosed, Plug, Sparkles, Wrench } from "lucide-react"
import { ExpertIcon } from "@/components/experts/expertIcon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ExpertBundle, Folder } from "@/types"
import { cn } from "@/lib/utils"
import { resolveFolderNames } from "./expertCatalog"

/**
 * ⛔ THE WORDING IS THE DELIVERABLE, so it lives in one place and its suite pins the literal.
 * A folder id the caller cannot resolve is neither dropped nor blanked: it is named as a thing
 * that exists and is out of view.
 */
export const UNNAMEABLE_FOLDER = "a knowledge folder you cannot see"

/** Every honest line, in one place — an absence is a sentence, never an empty box. */
export const HONEST = {
  whenToUse: "The author has not said when to use this Expert yet.",
  exampleOutput: "The author has not attached a sample deliverable yet.",
  noFolders: "This Expert binds no knowledge folders of its own.",
  noSkills: "This Expert binds no skills of its own.",
  noConnections: "This Expert needs no external connections.",
  noPrompts: "The author has not written any example prompts yet.",
  noDescription: "The author has not described what this Expert does yet.",
} as const

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

function HonestLine({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-muted-foreground/80">{children}</p>
}

function NamePill({ icon, label, dim }: { icon: React.ReactNode; label: string; dim?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        dim
          ? "border-border/60 bg-muted/20 italic text-muted-foreground"
          : "border-violet-500/25 bg-violet-500/10 text-violet-200",
      )}
    >
      {icon}
      {label}
    </span>
  )
}

export interface ExpertDetailModalProps {
  expert: ExpertBundle | null
  /** The CALLER'S OWN visible folders. Nothing here fetches a folder by id (T-262-14). */
  folders: Folder[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartChat: (expert: ExpertBundle) => void
}

export function ExpertDetailModal({
  expert,
  folders,
  open,
  onOpenChange,
  onStartChat,
}: ExpertDetailModalProps) {
  const [sampleShown, setSampleShown] = useState(false)

  // The disclosure is per-Expert and per-opening: a sample revealed for one Expert must not be
  // pre-revealed for the next one the person inspects.
  useEffect(() => {
    setSampleShown(false)
  }, [expert?.id, open])

  if (!expert) return null

  const isRestricted = expert.scope_mode === "restricted"
  const resolvedFolders = resolveFolderNames(expert.knowledge_folder_ids ?? [], folders)
  const skills = expert.member_skills ?? []
  const connections = expert.required_connections ?? []
  const prompts = expert.prompt_suggestions ?? []
  const whenToUse = expert.when_to_use?.trim() ?? ""
  const sample = expert.example_output?.trim() ?? ""
  const description = expert.description?.trim() ?? ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 rounded-2xl border-border/80 bg-card/95 p-0 shadow-2xl backdrop-blur-md">
        {/* ── header: gem · name · scope badge · meta line ── */}
        <DialogHeader className="space-y-2 border-b border-border/60 p-6 pb-5">
          <div className="flex items-start gap-3.5 pr-8">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-200 ring-1 ring-violet-500/30">
              <ExpertIcon icon={expert.icon} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base font-semibold text-foreground">
                  {expert.name}
                </DialogTitle>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                    isRestricted
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-300",
                  )}
                >
                  {/* The card face's own two words, so the two catalog surfaces cannot disagree
                      about one fact while a person moves between them. */}
                  {isRestricted ? "Restricted" : "Biased"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-primary">
                {expert.category?.trim() || "Uncategorised"}
                {" · "}
                {expert.is_system ? "System Template" : "Org Custom"}
              </p>
            </div>
          </div>
          <DialogDescription className="text-left text-xs text-muted-foreground">
            {description || HONEST.noDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-6">
          {/* ── 1 · what the scope mode MEANS for this Expert, in plain words ── */}
          <section>
            <SectionTitle>Knowledge Composition</SectionTitle>
            <p className="rounded-lg border border-border/60 bg-muted/25 p-3 text-xs leading-relaxed text-foreground/90">
              {isRestricted
                ? "Strict isolation — this Expert reads only the knowledge folders bound below. Documents in your chat's own folder will not be used."
                : "Union scope — this Expert adds the knowledge folders bound below to whatever your chat already reads. Both sets of documents are searched together."}
            </p>
          </section>

          {/* ── 2 · when_to_use, verbatim, or the honest line ── */}
          <section>
            <SectionTitle>When To Summon This Expert</SectionTitle>
            {whenToUse ? (
              <p className="rounded-lg border border-border/60 bg-muted/25 p-3 text-xs leading-relaxed text-foreground/90">
                {whenToUse}
              </p>
            ) : (
              <HonestLine>{HONEST.whenToUse}</HonestLine>
            )}
          </section>

          {/* ── 3 · the envelope, BY NAME ── */}
          <section>
            <SectionTitle>Grounded Knowledge &amp; Tool Envelope</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-[11px] font-semibold text-foreground/80">Bound Folders</p>
                {resolvedFolders.length === 0 ? (
                  <HonestLine>{HONEST.noFolders}</HonestLine>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {resolvedFolders.map((f) =>
                      f.known ? (
                        <NamePill
                          key={f.id}
                          icon={<FolderClosed className="h-3 w-3" />}
                          label={f.name}
                        />
                      ) : (
                        <NamePill
                          key={f.id}
                          dim
                          icon={<EyeOff className="h-3 w-3" />}
                          label={UNNAMEABLE_FOLDER}
                        />
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-foreground/80">Bound Skills</p>
                  {skills.length === 0 ? (
                    <HonestLine>{HONEST.noSkills}</HonestLine>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((s) => (
                        <NamePill
                          key={`skill-${s}`}
                          icon={<Wrench className="h-3 w-3" />}
                          label={s}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-foreground/80">
                    Required Connections
                  </p>
                  {connections.length === 0 ? (
                    <HonestLine>{HONEST.noConnections}</HonestLine>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {connections.map((c) => (
                        <NamePill key={`conn-${c}`} icon={<Plug className="h-3 w-3" />} label={c} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── 4 · the Expert's own example prompts, title AND prompt ── */}
          <section>
            <SectionTitle>One-Click Action Prompts</SectionTitle>
            {prompts.length === 0 ? (
              <HonestLine>{HONEST.noPrompts}</HonestLine>
            ) : (
              <ul className="space-y-2">
                {prompts.map((p, i) => (
                  <li
                    key={`${p.title}-${i}`}
                    className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2"
                  >
                    <p className="text-xs font-medium text-foreground">{p.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {p.prompt}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── 5 · the sample deliverable, behind a disclosure, as escaped TEXT ── */}
          <section>
            <SectionTitle>Sample Deliverable Output</SectionTitle>
            {sample ? (
              <>
                <button
                  type="button"
                  aria-expanded={sampleShown}
                  onClick={() => setSampleShown((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {sampleShown ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {sampleShown ? "Hide sample deliverable" : "Show sample deliverable"}
                </button>
                {sampleShown && (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-background/70 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                    {expert.example_output}
                  </pre>
                )}
              </>
            ) : (
              <HonestLine>{HONEST.exampleOutput}</HonestLine>
            )}
          </section>
        </div>

        {/* ── footer: exactly two controls ── */}
        <div className="flex items-center justify-end gap-2 border-t border-border/60 p-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onStartChat(expert)
              onOpenChange(false)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Start Scoped Chat with Expert
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
