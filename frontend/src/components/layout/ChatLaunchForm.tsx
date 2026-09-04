import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { LaunchInputFields } from "@/components/workflows/LaunchInputFields"
import type { EntryInputField } from "@/components/workflows/soulData"

/**
 * Phase 214-12 (STEP-02 / D-214-04) — THE CHAT SURFACE'S LAUNCH MOMENT.
 *
 * ── WHY THIS FILE EXISTS AT ALL ──
 *
 * Chat had NO launch moment. PATTERNS' *No Analog Found* table says so in as many words:
 * nothing in `ChatArea` / `MessageInput` / `ChatLayout` opened a per-run form, and `RunModal`
 * — the nearest shape — is a library-page modal mounted from `WorkflowsPage`. So a `send_email`
 * step launched from a thread received nothing, its recipient resolved to `None`, and SC#2 was
 * two-thirds true. `BUG-260826-01` is that gap seen from the operator's side.
 *
 * ── ⛔ THE PERSON FILLS THIS IN. NOTHING ELSE MAY. ──
 *
 * D-214-04 CONSIDERED and REJECTED letting the agent supply the argument by reading the thread.
 * That rejection is a SECURITY decision, not a UX preference, and it has two halves:
 *
 *   · an LLM choosing a recipient address is a NEW TRUST SURFACE — the value crosses out of the
 *     product to a vendor, and nothing between here and there re-checks who picked it;
 *   · it is NOT REPRODUCIBLE between runs — the same workflow on the same thread could send to a
 *     different address tomorrow, which makes the run's own record unfalsifiable.
 *
 * So this component reads NOTHING from the conversation, from thread state, or from model
 * output. It is handed a name and a field list and it hands back a dict. That is the whole of
 * its access. ⚠ The rejection is enforced by a fence rather than by this paragraph:
 * `ChatLayout.launch.test.tsx` reads this file's stripped source and asserts the absence, with a
 * positive control — a comment cannot satisfy it and deleting a comment cannot break it.
 *
 * ── ⚠ IT RESOLVES **BEFORE** ANYTHING IS CREATED ──
 *
 * `doRun` awaits this form BEFORE `createThread`. A cancelled launch therefore creates no thread
 * at all, rather than creating one and relying on the WR-04 orphan cleanup to delete it — the
 * cleanup exists for a launch that FAILED, not for one a person chose not to start. Asserted by
 * a case that pins both `createThread` and the cleanup delete at zero after a cancel.
 *
 * ── THE SHELL IS THE SHIPPED ONE, NOT A NEW ONE ──
 *
 * The overlay/card/header/footer composition mirrors `library/RunModal.tsx` exactly (the same
 * `fixed inset-0 z-[9000] grid place-items-center` scrim, the same `w-[min(560px,92%)]` card,
 * the same 17px truncating title and dismiss control). One launch vocabulary, two doors — a
 * second dialog language for the same act would be the drift the sketch findings forbid. It
 * installs nothing: the primitives are already in the tree.
 *
 * ⚠ THE FIELDS ARE `LaunchInputFields`, THE SHARED LEAF. This surface renders no field markup of
 * its own, which is what makes the two-arm label rule ONE fact for all three launchers instead
 * of three copies that drift. The caller hands `launchInputFields(def)` — never
 * `entryInputFields(def)`, whose fallback arm draws a box for a RESERVED key the server strips.
 */
export function ChatLaunchForm({
  workflowName,
  fields,
  onConfirm,
  onCancel,
}: {
  workflowName: string
  /** `launchInputFields(def)` — the declared inputs, already minus the reserved keys. */
  fields: EntryInputField[]
  onConfirm: (values: Record<string, string>) => void
  onCancel: () => void
}) {
  /**
   * The collected values, keyed by the DECLARED key.
   *
   * ⚠ SEEDED FROM NOTHING — not from a prior launch, not from a default, not from the thread.
   * An empty box is an honest empty box. See the ⛔ block above.
   */
  const [values, setValues] = useState<Record<string, string>>({})

  // Escape dismisses, exactly as the library modal's does — the two doors behave the same way.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onCancel()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onCancel])

  /**
   * ⚠ PROJECTED ONTO THE DECLARED KEYS, never handed over raw. A key that stopped being declared
   * between two renders cannot ride along, and every declared key is PRESENT — an untouched
   * field sends `""`, which is a real answer here. No required-ness is validated: the publish
   * gate already refuses a workflow whose `ask` key is undeclared, and blocking on an empty
   * optional field would refuse a run the system can perform.
   */
  const submit = () => {
    const collected: Record<string, string> = {}
    for (const f of fields) collected[f.key] = values[f.key] ?? ""
    onConfirm(collected)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Run ${workflowName}`}
      data-testid="chat-launch-form"
      className="fixed inset-0 z-[9000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
    >
      <div className="w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="truncate text-[17px] font-semibold text-foreground">
            Run {workflowName}
          </h2>
          <button
            type="button"
            data-testid="chat-launch-close"
            aria-label="Close"
            onClick={onCancel}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {/* The one honest sentence about WHY there is a form here: the workflow declared these,
              and this run cannot supply them from anywhere else. It says what is asked, not what
              will be done with it — the run's own record is where that belongs. */}
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            This workflow asks for the values below before it runs.
          </p>
          <LaunchInputFields
            fields={fields}
            values={values}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            data-testid="chat-launch-cancel"
            onClick={onCancel}
            className="h-9 rounded-md border border-border px-4 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="chat-launch-confirm"
            onClick={submit}
            className="h-9 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Run
          </button>
        </div>
      </div>
    </div>
  )
}
