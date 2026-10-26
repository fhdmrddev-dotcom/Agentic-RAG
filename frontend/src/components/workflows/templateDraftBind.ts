/**
 * Phase 296-07 Task 2, step 0 — THE POST-DRAFT BIND, MOVED OUT OF `useTemplateFirstDraft.ts`.
 *
 * That hook's ledger verdict reads *"extraction FIRST"*: the next concern on it proposes the cut
 * before it adds anything. 296-07 adds three things to the bind (a snapshot taken when the draft
 * is written, every failure listed, only the references actually sent bound), so the bind
 * leaves first, in its own commit, with NO behaviour change. The words, order and failure
 * semantics below are the hook's, moved.
 *
 * ⚠ Like the hook, this module names neither describe host, in code or in prose (the D-24(b)
 * cycle fence in the hook's suite is a source assertion; the same rule is kept here so the
 * crude `grep -c` check stays readable).
 *
 * OWNS: which door each file is stored through (`bindPlanFor`) and the bind loop itself.
 * DOES NOT OWN: any React state. The hook passes its sinks in; this module calls them.
 */
import { uploadWorkflowReference, uploadWorkflowTemplate } from "@/lib/api"
import type { ReferenceAssetDescriptor, WordAnchor } from "@/lib/api"
import type { TemplateAssetDescriptor } from "./builderStore"
import type { TemplateReadAnswer } from "./useTemplateFirstDraft"

/**
 * 291-04 (D-07) — WHICH DOOR the slot's file is stored through at the first save.
 *
 *  · a template, a fillable PDF form, or a deck → the TEMPLATE door, the shipped way;
 *  · Word blanks → the template door WITH the ticked anchors, which stores the fillable copy;
 *    with every blank unticked there is nothing to fill, so it is kept as a reference;
 *  · a file with no fields, a flat or scanned PDF, or a Word file a copy cannot be made of →
 *    the REFERENCE door: it is used as a reference, so it is kept as one;
 *  · a read that never answered → the shipped template upload, except a PDF, which the
 *    template door can only fill when it has fields, so it is kept as a reference.
 *
 * ⚠ A deck stays a TEMPLATE: the reference door does not take decks, and a deck template is
 * filled at run time by the shipped engine.
 */
export function bindPlanFor(
  file: File,
  answer: TemplateReadAnswer | null,
): { door: "template"; anchors?: WordAnchor[] } | { door: "reference" } {
  if (!answer) return { door: "template" }
  if (answer.state.kind === "unavailable") {
    return file.name.toLowerCase().endsWith(".pdf") ? { door: "reference" } : { door: "template" }
  }
  const result = answer.state.result
  switch (result.arm) {
    case "template_fields":
    case "form_fields":
    case "not_word":
      return { door: "template" }
    case "blanks": {
      const anchors = result.fields.flatMap((f) =>
        !answer.unticked.includes(f.key) && f.anchor_kind !== null && f.anchor_label !== null
          ? [{ key: f.key, anchor_kind: f.anchor_kind, anchor_label: f.anchor_label }]
          : [],
      )
      return anchors.length > 0 ? { door: "template", anchors } : { door: "reference" }
    }
    default:
      return { door: "reference" }
  }
}

/** What one bind attaches: the slot's file and its reading, and the held references. */
export interface BindSubject {
  file: File | null
  answer: TemplateReadAnswer | null
  references: readonly { file: File }[]
}

/** Where the bind reports. Each is the hook's own writer, passed in. */
export interface BindSinks {
  /** The host's single writer for a bound template descriptor. */
  onTemplateBound: (asset: TemplateAssetDescriptor) => void
  /** The host's writer for the references of ONE bind, never called with an empty list. */
  onReferencesBound: (assets: ReferenceAssetDescriptor[]) => void
  /** The template bound: clear any earlier failure. */
  onTemplateOk: () => void
  /** One file could not be attached. */
  onFailed: (filename: string) => void
}

/**
 * D-06's bind. Uploads the held document — and, since 291-04, each held reference — to the
 * definition that now exists and hands the returned descriptors to the host's writers.
 *
 * ⚠ IT CATCHES EVERYTHING AND NEVER REJECTS (the hook's docblock on `bindHeldTemplate` says
 * why: its caller runs inside the write loop's own `try`).
 */
export async function bindDraftFiles(
  definitionId: string,
  { file, answer, references }: BindSubject,
  sinks: BindSinks,
): Promise<void> {
  // NO DOCUMENT, NO ACT. SC#4's fast path is untouched by construction rather than by a
  // flag: a session that supplied nothing performs no upload and can raise no failure.
  if (!file && references.length === 0) return
  const referenceAssets: ReferenceAssetDescriptor[] = []
  if (file) {
    try {
      const plan = bindPlanFor(file, answer)
      if (plan.door === "reference") {
        referenceAssets.push(await uploadWorkflowReference(definitionId, file))
      } else {
        // ⚠ Without anchors the call is the shipped one, argument for argument.
        const asset =
          plan.anchors !== undefined
            ? await uploadWorkflowTemplate(definitionId, file, plan.anchors)
            : await uploadWorkflowTemplate(definitionId, file)
        sinks.onTemplateOk()
        // The host's single writer. This module appends nothing to `assets[]` itself.
        sinks.onTemplateBound(asset)
      }
    } catch (err) {
      // The developer's evidence, at the boundary, in full.
      console.error(err)
      // …and the person's, which cannot carry any of it.
      sinks.onFailed(file.name)
    }
  }
  // 291-04 (D-07) — every held reference, kept with the draft. One failure names its file
  // and does not stop the others.
  for (const reference of references) {
    try {
      referenceAssets.push(await uploadWorkflowReference(definitionId, reference.file))
    } catch (err) {
      console.error(err)
      sinks.onFailed(reference.file.name)
    }
  }
  if (referenceAssets.length > 0) sinks.onReferencesBound(referenceAssets)
}
