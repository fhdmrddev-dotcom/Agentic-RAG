/**
 * BUG-260829-01 — the cron composer and the echo.
 *
 * ⚠ THE ECHO'S CORRECTNESS PROPERTY IS NOT "it phrases a lot of expressions". It is **it never
 * phrases one wrong** — a confident sentence about a misparsed expression is worse than no
 * sentence, because the whole point is that the author checks their typing against it. So the
 * suite spends most of its cases on what `describeCron` REFUSES, and pins a round trip
 * (`dailyCron → describeCron`) so the composed form and the read form cannot drift.
 *
 * The five shipped presets are driven verbatim: an echo that could not phrase the app's own
 * presets would print "we can't put this one in words" on the four cases a person reaches by
 * clicking rather than typing.
 */
import { describe, expect, it } from "vitest"

import {
  CRON_UNREADABLE,
  dailyCron,
  describeCron,
  timeOfDailyCron,
} from "@/components/workflows/cronPlain"

/** Verbatim from `WorkflowScheduleModal.tsx`'s `CRON_PRESETS`. */
const SHIPPED_PRESETS = [
  "0 * * * *",
  "0 3 * * *",
  "0 8 * * 1-5",
  "0 8 * * 1",
  "0 6 1 * *",
]

describe("dailyCron — composing the common case", () => {
  it("writes the expression the operator had to hand-type", () => {
    expect(dailyCron("04:18")).toBe("18 4 * * *")
  })

  it("accepts what an <input type=\"time\"> actually produces, seconds included", () => {
    expect(dailyCron("09:05")).toBe("5 9 * * *")
    expect(dailyCron("23:59")).toBe("59 23 * * *")
    expect(dailyCron("00:00")).toBe("0 0 * * *")
    expect(dailyCron("07:30:00")).toBe("30 7 * * *")
  })

  it("emits the UNPADDED dialect the shipped presets use", () => {
    // A padded `18 04 * * *` is valid cron and would make the preset dropdown's
    // `.some(p => p.expr === cron)` miss, silently falling to "Custom…" for an expression
    // this composer had just written.
    expect(dailyCron("04:18")).not.toContain("04")
    expect(dailyCron("08:00")).toBe("0 8 * * *")
    expect(dailyCron("08:00")).toBe(SHIPPED_PRESETS[1].replace("3", "8"))
  })

  it("returns null rather than writing rubbish into the field", () => {
    for (const bad of ["", "  ", "4", "4:5", "25:00", "12:60", "abc", "4:18 PM", "-1:00"]) {
      expect(dailyCron(bad)).toBeNull()
    }
    expect(dailyCron(undefined as never)).toBeNull()
  })
})

describe("timeOfDailyCron — reflecting what is already in the field", () => {
  it("round-trips with dailyCron", () => {
    for (const t of ["04:18", "00:00", "23:59", "09:05"]) {
      expect(timeOfDailyCron(dailyCron(t)!)).toBe(t)
    }
  })

  it("pads for display even though the expression is unpadded", () => {
    expect(timeOfDailyCron("5 9 * * *")).toBe("09:05")
  })

  it("returns null for anything that is not every-day-at-a-time, so the control is left alone", () => {
    expect(timeOfDailyCron("0 8 * * 1-5")).toBeNull()
    expect(timeOfDailyCron("0 * * * *")).toBeNull()
    expect(timeOfDailyCron("0 6 1 * *")).toBeNull()
    expect(timeOfDailyCron("*/5 * * * *")).toBeNull()
    expect(timeOfDailyCron("nonsense")).toBeNull()
    expect(timeOfDailyCron("")).toBeNull()
  })
})

describe("describeCron — the echo", () => {
  it("phrases the expression the operator typed, with the clock attached", () => {
    expect(describeCron("18 4 * * *", "Asia/Dubai")).toBe("Every day at 04:18 (Asia/Dubai)")
  })

  it("distinguishes the two orderings a person can plausibly confuse", () => {
    // THE WHOLE POINT. `18 4` and `4 18` are both legal and mean different hours; the echo is
    // the only thing on screen that tells them apart before tomorrow morning.
    expect(describeCron("18 4 * * *")).toBe("Every day at 04:18")
    expect(describeCron("4 18 * * *")).toBe("Every day at 18:04")
  })

  it("phrases every shipped preset — an echo that could not would fire on clicks, not typos", () => {
    for (const expr of SHIPPED_PRESETS) {
      expect(describeCron(expr), expr).not.toBeNull()
    }
    expect(describeCron("0 * * * *")).toBe("Every hour, at 00 minutes past")
    expect(describeCron("0 3 * * *")).toBe("Every day at 03:00")
    expect(describeCron("0 8 * * 1-5")).toBe("Every weekday (Mon–Fri) at 08:00")
    expect(describeCron("0 8 * * 1")).toBe("Every Monday at 08:00")
    expect(describeCron("0 6 1 * *")).toBe("The 1st of each month at 06:00")
  })

  it("names each day and ordinal correctly", () => {
    expect(describeCron("0 9 * * 0")).toBe("Every Sunday at 09:00")
    expect(describeCron("0 9 * * 7")).toBe("Every Sunday at 09:00")
    expect(describeCron("0 9 * * 6")).toBe("Every Saturday at 09:00")
    expect(describeCron("0 6 2 * *")).toBe("The 2nd of each month at 06:00")
    expect(describeCron("0 6 3 * *")).toBe("The 3rd of each month at 06:00")
    expect(describeCron("0 6 11 * *")).toBe("The 11th of each month at 06:00")
    expect(describeCron("0 6 21 * *")).toBe("The 21st of each month at 06:00")
  })

  it("appends the zone only when there is one, and never invents one", () => {
    expect(describeCron("18 4 * * *")).toBe("Every day at 04:18")
    expect(describeCron("18 4 * * *", "")).toBe("Every day at 04:18")
    expect(describeCron("18 4 * * *", null)).toBe("Every day at 04:18")
    expect(describeCron("18 4 * * *", "UTC")).toBe("Every day at 04:18 (UTC)")
  })

  it("⭐ REFUSES rather than approximating — the correctness property", () => {
    // Every one of these is LEGAL cron this module deliberately does not read. A phrase that
    // was nearly right about any of them would license the exact mistake the echo prevents.
    for (const expr of [
      "*/5 * * * *",
      "1,15 4 * * *",
      "0 9-17 * * *",
      "0 8 * JAN *",
      "0 8 * * MON",
      "0 8 1,15 * *",
      "18 4 * *",
      "18 4 * * * *",
      "",
      "   ",
      "not cron at all",
      "60 4 * * *",
      "18 24 * * *",
      "18 4 32 * *",
      "18 4 * * 8",
    ]) {
      expect(describeCron(expr), expr).toBeNull()
    }
  })

  it("is TOTAL — no input throws", () => {
    for (const bad of [undefined, null, 0, {}, []] as never[]) {
      expect(() => describeCron(bad)).not.toThrow()
    }
  })

  it("the unreadable copy claims nothing about validity", () => {
    // The server owns that verdict. A client sentence like "that isn't valid" would be an
    // invented ruling — and `*/5 * * * *` above is perfectly good cron.
    const lowered = CRON_UNREADABLE.toLowerCase()
    for (const forbidden of ["invalid", "not valid", "wrong", "error", "bad", "incorrect"]) {
      expect(lowered).not.toContain(forbidden)
    }
  })
})
