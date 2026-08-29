/**
 * The SHARED tab primitive. Three surfaces mount it and NONE of them owns it:
 * `pages/SettingsPage.tsx`, `pages/KnowledgeHealthPage.tsx` and the Library.
 *
 * ── Phase 217-06 (D-217-20 / D-217-21) — the selected tab was a HOLE on Deep Midnight ──
 *
 * The active trigger used to paint `--background` (L 4%) inside a track painting `--muted`
 * (L 11%). That is SEVEN POINTS DARKER than what it sits in, while the same two tokens in
 * the light theme measure 97% over 94% — LIGHTER. The bar inverted between themes, and the
 * only other cue was `shadow-sm`, a 5%-opacity shadow that is invisible at 4% lightness.
 *
 * The fix is a theme-paired `--tab-active` token (index.css, both blocks) rather than a
 * swap, because NO shipped token is lighter than `--muted` in both themes — `--card` fails
 * dark, `--accent` fails light, `--background` fails dark. Plus a SECOND, non-colour cue:
 * an INSET ring (`ring-1 ring-inset ring-border`), which composes with `shadow-sm` through
 * Tailwind's separate `--tw-ring-shadow` / `--tw-shadow` slots.
 *
 * ⛔ The ring is a box-SHADOW, never a `border` utility: a real border changes the box size
 *    and the whole row would reflow every time the selection moves.
 * ⛔ No per-surface flag and no Library-local copy of this file (D-217-20 rejects both — two
 *    tab bars that disagree on one theme is how a design system stops being one).
 *
 * Guarded by `components/ui/__tests__/tabsContrast.test.ts`, which reads this file and
 * `index.css` as text and measures the token lightness in both blocks.
 */
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-tab-active data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-border",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
