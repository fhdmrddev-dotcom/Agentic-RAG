/**
 * Phase 087 Plan 01 Task 2 (PANEL-01, A3) — hand-authored bottom-sheet primitive.
 *
 * Built on the ALREADY-INSTALLED `@radix-ui/react-dialog@^1.1.15` (the same
 * primitive `dialog.tsx` wraps) — NOT via `npx shadcn add sheet`, which would
 * pull `vaul` as a new dependency (forbidden by Phase 087 SC#3 / Research A3).
 *
 * Radix Dialog gives us focus-trap + Escape + focus-restore for free; we only
 * restyle `Content` to slide up from the bottom edge with rounded top corners
 * and a `.sheet-grip` drag-handle bar. `WorkspacePanel` (Plan 02) consumes this
 * at <768px as the mobile workspace surface (UI-SPEC Responsive Breakpoints:
 * top:30%, slide-up, must not occlude the composer, grip dismisses).
 *
 * Kept generic — `side` defaults to "bottom" (the only variant this phase needs)
 * but the prop leaves room for other edges without re-authoring the component.
 */
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root

const SheetTrigger = DialogPrimitive.Trigger

const SheetClose = DialogPrimitive.Close

const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Which edge the sheet slides from. Only "bottom" is exercised in Phase 087
   *  (the mobile workspace surface); the prop leaves room to extend later. */
  side?: "bottom"
  /** Hide the default top-right close button (the grip already dismisses). */
  hideCloseButton?: boolean
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "bottom", hideCloseButton, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-side={side}
      className={cn(
        // Bottom-sheet: pinned to the bottom edge, capped at ~70vh so it never
        // fully occludes the composer; rounded top corners; slides up on open.
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col rounded-t-[14px] border-t border-border bg-background shadow-lg",
        "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        className
      )}
      {...props}
    >
      {/* Drag-handle grip (UI-SPEC) — also the visual affordance that the sheet
          dismisses. The whole grip row is a Radix Close so a tap dismisses. */}
      <DialogPrimitive.Close
        aria-label="Dismiss"
        className="mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="sheet-grip block h-1.5 w-10 rounded-full bg-border" />
      </DialogPrimitive.Close>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 px-4 pb-2 text-left", className)}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
}
