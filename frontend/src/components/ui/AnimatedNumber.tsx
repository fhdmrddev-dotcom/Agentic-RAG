import { useEffect, useRef, useState } from "react"

export interface AnimatedNumberProps {
  value: number | string
  duration?: number
  className?: string
}

/**
 * AnimatedNumber — smoothly counts numbers on mount and on real value CHANGE.
 *
 * Honors:
 * - <400ms duration (default 300ms)
 * - reduced-motion bypass (prefers-reduced-motion: reduce)
 * - test environment bypass (process.env.NODE_ENV === "test" / MODE === "test")
 * - real value change only, skipping re-animation on refetches (D-v2.5-03)
 */
export function AnimatedNumber({ value, duration = 300, className }: AnimatedNumberProps) {
  const isTest =
    (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.NODE_ENV === "test") ||
    (typeof import.meta !== "undefined" && (import.meta as any)?.env?.MODE === "test")
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // In test or reduced motion, render true value immediately with zero overhead
  if (isTest || prefersReduced) {
    return className ? <span className={className}>{value}</span> : <>{value}</>
  }

  return <AnimatedNumberInner value={value} duration={duration} className={className} />
}

function AnimatedNumberInner({
  value,
  duration,
  className,
}: {
  value: number | string
  duration: number
  className?: string
}) {
  const prevValueRef = useRef<number | string | undefined>(undefined)
  const prevNumRef = useRef<number>(0)
  const [display, setDisplay] = useState<number | string>(value)

  useEffect(() => {
    // Never re-animate on refetch with the same value (D-v2.5-03)
    if (prevValueRef.current !== undefined && prevValueRef.current === value) {
      return
    }

    const cleanStr = String(value).replace(/,/g, "")
    const match = cleanStr.match(/^([^0-9.-]*)([0-9]+(?:\.[0-9]+)?)(.*)$/)
    if (!match) {
      prevValueRef.current = value
      setDisplay(value)
      return
    }

    const prefix = match[1]
    const targetNum = parseFloat(match[2])
    const suffix = match[3]
    const hasCommas = String(value).includes(",")
    const decimalPlaces = match[2].includes(".") ? match[2].split(".")[1].length : 0

    // If mount: animate from 0 to targetNum.
    // If real value change: animate from prevNum to targetNum.
    const startNum = prevValueRef.current === undefined ? 0 : prevNumRef.current
    // ⚠ Captured so the cleanup can UNDO them. See the StrictMode note below.
    const prevValueAtStart = prevValueRef.current
    const prevNumAtStart = prevNumRef.current
    let completed = false
    prevValueRef.current = value
    prevNumRef.current = targetNum

    if (startNum === targetNum) {
      setDisplay(value)
      return
    }

    const startTime = performance.now()
    let rafId: number

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const rawCurrent = startNum + (targetNum - startNum) * ease

      let formattedNum: string
      if (decimalPlaces > 0) {
        const factor = Math.pow(10, decimalPlaces)
        const current = Math.round(rawCurrent * factor) / factor
        formattedNum = hasCommas
          ? current.toLocaleString(undefined, {
              minimumFractionDigits: decimalPlaces,
              maximumFractionDigits: decimalPlaces,
            })
          : current.toFixed(decimalPlaces)
      } else {
        const current = Math.round(rawCurrent)
        formattedNum = hasCommas ? current.toLocaleString() : current.toString()
      }

      setDisplay(`${prefix}${formattedNum}${suffix}`)

      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        completed = true
        setDisplay(value)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafId)
      /* ⚠ REACT STRICTMODE DOUBLE-INVOKES EFFECTS IN DEV, and without this the mount
         animation NEVER RAN on any tile that mounts already holding its final value.
         Run 1 set prevValueRef to the value and started the rAF; cleanup cancelled it;
         run 2 then hit the `prevValueRef.current === value` refetch guard and returned
         early. Net: a static number. It was invisible on the Documents tiles only
         because those mount BEFORE their data arrives, so they animate on a real value
         CHANGE rather than on mount — which is why one tab animated and the rest did not.
         Undoing the refs on an INCOMPLETE run keeps the refetch guard intact (a genuine
         same-value refetch still skips) while letting an interrupted mount re-animate. */
      if (!completed) {
        prevValueRef.current = prevValueAtStart
        prevNumRef.current = prevNumAtStart
      }
    }
  }, [value, duration])

  return className ? <span className={className}>{display}</span> : <>{display}</>
}
