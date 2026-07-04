// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 03 Task 1 (PANEL-01 / EVAL-03 / EVAL-04) — RunCaseDetail.
// Phase 137.1 Plan 09 Task 2 (EVAL-05d/e / 059-A) — the judge's advisory
// `case_feedback` as a violet "◇ Judge on this case" note (never a verdict, never in
// the rollup) + per-arm `⏱ duration_ms` beside the token line (metadata, never a verdict).
//
// The per-case body of an expanded eval run (sketch 055-B "expandable rows"). It
// is a PURE presentational leaf: EvalsTab (Plan 05) owns all state and passes the
// case's real `TestCase`, its `EvalResult[]` (both arms), and an `onRate` handler.
//
// D-11 (the fix for BUG-260701-02): the case is rendered PROMPT-FIRST from the
// `testCase` prop — the raw test_case_id uuid NEVER appears as a label. `EvalResult`
// carries only `test_case_id` (no prompt text), so the prompt must come from the
// TestCase the container looks up in its casesById map. When the case was deleted
// after the run (`testCase === null`) a neutral fallback line renders, never the uuid.
//
// D-04 honesty locks: the judge verdict badge is LIFTED VERBATIM from
// SkillEvalSection (:68-79) — never re-derive pass/fail. "not measured" (an errored/
// empty arm, excluded from the rollup) and "judge error" (arms completed, the judge
// call failed — neither pass nor fail) render as NEUTRAL text, never colored/styled
// as a fail. The "Your rating" thumbs are a DISTINCT truth from the judge verdict
// (T-137-04): they render `result.rating` from the server readout and call `onRate`
// (which Plan 05 wires to a PUT-then-refetch) — no optimistic local rating truth.
//
// T-137-05 (XSS): prompt / expected_behavior / judge reason / output / error all
// render as React text nodes — never as raw/injected inner HTML.
// ─────────────────────────────────────────────────────────────────────────────
import { ThumbsUp, ThumbsDown } from "lucide-react"
import type { EvalResult, TestCase } from "@/types"

// Fixed arm order — WITH before WITHOUT, side-by-side (SkillEvalSection :60).
const VARIANTS = ["with_skill", "without_skill"] as const

// LIFTED VERBATIM from SkillEvalSection :68-79 (D-04). A completed/non-empty arm
// reads PASS/FAIL; an errored/empty arm is honestly "not measured" (NEVER a
// fabricated pass/fail); a completed arm whose judge shot failed reads "judge
// error". null → no badge (old pre-081 rows / verdict absent).
function verdictBadge(r: EvalResult): string | null {
  switch (r.verdict_state) {
    case "graded":
      return r.verdict_passed ? "PASS" : "FAIL"
    case "not_measured":
      return "not measured"
    case "judge_error":
      return "judge error"
    default:
      return null
  }
}

interface Props {
  /** The real test case for this row — prompt-first source (D-11). null when the
   *  case was deleted after the run: a neutral fallback renders, never the uuid. */
  testCase: TestCase | null
  /** Both arms' durable results for this one case (with_skill + without_skill). */
  results: EvalResult[]
  /** Toggle a thumbs rating; choosing the same rating clears it to null. Plan 05
   *  wires this to the owner-scoped PUT-then-refetch (never optimistic). */
  onRate: (resultId: string, choice: "up" | "down" | null) => void
}

export function RunCaseDetail({ testCase, results, onRate }: Props) {
  // Group this case's results by variant so the two arms render in VARIANTS order.
  const byVariant: Partial<Record<string, EvalResult>> = {}
  for (const r of results) byVariant[r.variant] = r

  // 059-A (EVAL-05d): the judge's ADVISORY critique of the CASE — never a verdict,
  // never in the rollup. The judge annotates the case once, so it is sourced from the
  // first arm that carries a non-empty `case_feedback` and rendered as a violet note
  // (visually distinct from the PASS/FAIL chips). Absent → no advisory block renders.
  const caseFeedback =
    results.find((r) => r.case_feedback && r.case_feedback.trim())?.case_feedback ?? null

  return (
    <div
      data-testid="run-case-detail"
      className="flex flex-col gap-2 border-t border-border/30 pt-3"
    >
      {/* Prompt-first case header (D-11) — never the raw uuid. */}
      {testCase ? (
        <div className="flex flex-col gap-0.5">
          <p
            data-testid="case-prompt"
            className="truncate text-xs font-medium text-foreground"
            title={testCase.prompt}
          >
            {testCase.prompt}
          </p>
          {testCase.expected_behavior && (
            <p
              className="truncate text-[11px] text-muted-foreground"
              title={testCase.expected_behavior}
            >
              {testCase.expected_behavior}
            </p>
          )}
        </div>
      ) : (
        <p
          data-testid="case-prompt-fallback"
          className="text-xs italic text-muted-foreground"
        >
          (this test case was removed)
        </p>
      )}

      {/* 059-A: the judge's advisory case critique — INFO, not a verdict. Violet +
          dashed-left border (green/red are reserved for verdicts, amber for stale);
          captioned never-blocks; NEVER enters the rollup or a pass count. */}
      {caseFeedback && (
        <div
          data-testid="case-feedback"
          className="flex flex-col gap-0.5 rounded-r-md border-l-2 border-dashed border-accent-violet/60 bg-accent-violet/5 py-1.5 pl-2.5"
        >
          <p className="text-[11px] leading-relaxed text-accent-violet-text">
            <span aria-hidden>◇</span>{" "}
            <span className="font-semibold">Judge on this case:</span> {caseFeedback}
          </p>
          <p className="text-[9px] uppercase tracking-wide text-accent-violet-text/80">
            feedback only — never blocks the run
          </p>
        </div>
      )}

      {/* Side-by-side WITH / WITHOUT arms. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {VARIANTS.map((v) => {
          const r = byVariant[v]
          const badge = r ? verdictBadge(r) : null
          const armLabel = v === "with_skill" ? "With skill" : "Without skill"
          const errored = !!r && r.status !== "completed" && !!r.error
          return (
            <div
              key={v}
              data-testid={`arm-${v}`}
              className={
                "flex flex-col gap-1.5 rounded-md border p-2.5 " +
                (v === "with_skill"
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/40 bg-muted/20")
              }
            >
              {/* Arm label + judge verdict chip. */}
              <div className="flex items-center gap-2">
                <span
                  className={
                    "text-[10px] font-bold uppercase tracking-wide " +
                    (v === "with_skill" ? "text-primary" : "text-muted-foreground")
                  }
                >
                  {armLabel}
                </span>
                {badge && (
                  <span
                    data-testid={`verdict-chip-${v}`}
                    className={
                      "rounded-full px-2 py-0.5 text-[9px] font-bold " +
                      (badge === "PASS"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : badge === "FAIL"
                          ? "bg-destructive/10 text-destructive"
                          : badge === "judge error"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground")
                    }
                  >
                    {badge}
                    {r && r.verdict_state === "graded" && r.verdict_score != null
                      ? ` · ${r.verdict_score.toFixed(2)}`
                      : ""}
                  </span>
                )}
              </div>

              {/* Judge reason (a different truth from the human rating below). */}
              {r?.verdict_reason && (
                <p
                  className="text-[11px] leading-relaxed text-muted-foreground"
                  title={r.verdict_reason}
                >
                  <span className="font-semibold text-foreground/80">Judge:</span>{" "}
                  {r.verdict_reason}
                </p>
              )}

              {/* Arm output, or an errored arm's error message. */}
              {errored ? (
                <p className="font-mono text-[10px] text-destructive">{r.error}</p>
              ) : (
                r?.output && (
                  <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/80">
                    {r.output}
                  </pre>
                )
              )}

              {/* Token counts + per-arm wall-clock duration (EVAL-05e). Duration is
                  METADATA beside tokens — never a verdict. */}
              {r && (r.input_tokens != null || r.output_tokens != null || r.duration_ms != null) && (
                <p className="font-mono text-[9px] text-muted-foreground/70">
                  {r.input_tokens ?? "—"} → {r.output_tokens ?? "—"} tok
                  {r.duration_ms != null && (
                    <span data-testid={`duration-${v}`}>
                      {" "}
                      · <span aria-hidden>⏱</span> {r.duration_ms}ms
                    </span>
                  )}
                </p>
              )}

              {/* "Your rating" — DISTINCT from the judge verdict chip (two truths,
                  never blended). aria-pressed reflects the server rating; clicking
                  toggles (the same choice clears to null). */}
              {r && r.status === "completed" && (
                <div
                  data-testid={`rating-${v}`}
                  className="mt-auto flex items-center gap-1.5 pt-1"
                >
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
                    Your rating
                  </span>
                  <button
                    type="button"
                    aria-label="Thumbs up"
                    aria-pressed={r.rating === "up"}
                    onClick={() => onRate(r.id, r.rating === "up" ? null : "up")}
                    className={
                      "rounded border p-0.5 " +
                      (r.rating === "up"
                        ? "border-emerald-500 text-emerald-500"
                        : "border-border/40 text-muted-foreground hover:text-foreground")
                    }
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Thumbs down"
                    aria-pressed={r.rating === "down"}
                    onClick={() => onRate(r.id, r.rating === "down" ? null : "down")}
                    className={
                      "rounded border p-0.5 " +
                      (r.rating === "down"
                        ? "border-destructive text-destructive"
                        : "border-border/40 text-muted-foreground hover:text-foreground")
                    }
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
