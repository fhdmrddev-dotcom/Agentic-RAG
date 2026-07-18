// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §4, D-10) — the Supabase/Redis bind form.
//
// Two grouped forms in one scroll — Supabase (URL + the 4 keys + POSTGRES_DSN) and
// Redis (REDIS_URL) — modelled on the `settings/ProviderPicker.tsx` masked-input
// pattern (`type=password` + Eye/EyeOff). Every secret is masked; the env-var name
// rides as a secondary mono hint under each plain label.
//
// LIVE VALIDATION (D-10): a per-group "Test connection" button calls the token-gated
// `postValidate()`, which probes the SUBMITTED values server-side via throwaway
// connections and returns SANITIZED pass/fail (a bare exception class name — never a
// raw host, T-158-03). Each result renders the HealthSignals dot vocabulary (green
// "Connected" / red "Couldn't connect — {reason}"). Continue is GATED until BOTH
// groups test green, the schema sub-check included.
//
// SCHEMA SUB-STATE (D-10): if Postgres connects but the sentinel table is absent, the
// AMBER `<SchemaGuidancePanel/>` renders the OPERATOR.md Step-3 copy-guide.
//
// SECURITY (T-158-10): no field renders a secret in full by default; there is NO
// raw-HTML injection sink anywhere (the copied SQL renders as plain React text).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Loader2, Info } from "lucide-react"
import {
  postValidate,
  SetupApiError,
  type BindBody,
  type ValidateResult,
  type ProbeResult,
} from "@/lib/setupApi"
import { cn } from "@/lib/utils"
import { SchemaGuidancePanel } from "./SchemaGuidancePanel"

// ── Masked / plain field leaves (the ProviderPicker Eye/EyeOff pattern) ──────────

function SecretField({
  id,
  label,
  env,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  env: string
  value: string
  onChange: (v: string) => void
  children?: ReactNode
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <p className="font-mono text-[10px] text-muted-foreground">{env}</p>
      <div className="relative flex items-center">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste value"
          className="pr-9 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide value" : "Show value"}
          className="absolute right-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {children}
    </div>
  )
}

function PlainField({
  id,
  label,
  env,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string
  label: string
  env: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <p className="font-mono text-[10px] text-muted-foreground">{env}</p>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className="font-mono text-xs"
      />
    </div>
  )
}

/** One probe result → the HealthSignals dot vocabulary (green up / red down), always
 *  with a WORD beside the dot (never colour-alone). The fail reason is the server's
 *  SANITIZED string, rendered verbatim (T-158-03). */
function ProbeLine({ label, probe }: { label: string; probe: ProbeResult }) {
  const up = probe.state === "up"
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span
        aria-hidden="true"
        className={cn("mt-1 h-1.5 w-1.5 flex-none rounded-full", up ? "bg-success" : "bg-destructive")}
      />
      <span className="font-medium text-foreground">{label}</span>
      <span className={up ? "text-success" : "text-destructive"}>
        {up ? "Connected" : `Couldn't connect${probe.reason ? ` — ${probe.reason}` : ""}`}
      </span>
    </div>
  )
}

// ── Test state ───────────────────────────────────────────────────────────────────

type GroupTest =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "done"; result: ValidateResult }
  | { status: "error"; message: string }

interface ConnectionBindStepProps {
  /** The setup token — every test/probe is a token-gated write (D-15). */
  token: string
  /** The submitted infra tier (host-owned; pre-filled from the chosen preset). */
  value: BindBody
  onChange: (next: BindBody) => void
  onContinue: () => void
}

export function ConnectionBindStep({ token, value, onChange, onContinue }: ConnectionBindStepProps) {
  const [supabaseTest, setSupabaseTest] = useState<GroupTest>({ status: "idle" })
  const [redisTest, setRedisTest] = useState<GroupTest>({ status: "idle" })

  // Editing a field invalidates that group's last test result — Continue must never
  // stay green against edited-but-untested values.
  function setSupabaseField(field: keyof BindBody, v: string) {
    onChange({ ...value, [field]: v })
    setSupabaseTest({ status: "idle" })
  }
  function setRedisField(v: string) {
    onChange({ ...value, redis_url: v })
    setRedisTest({ status: "idle" })
  }

  async function testSupabase() {
    setSupabaseTest({ status: "testing" })
    try {
      const result = await postValidate(token, {
        supabase_url: value.supabase_url,
        supabase_anon_key: value.supabase_anon_key,
        supabase_service_role_key: value.supabase_service_role_key,
        supabase_publishable_key: value.supabase_publishable_key,
        supabase_secret_key: value.supabase_secret_key,
        postgres_dsn: value.postgres_dsn,
      })
      setSupabaseTest({ status: "done", result })
    } catch (err) {
      setSupabaseTest({
        status: "error",
        message: err instanceof SetupApiError ? err.message : "Test failed — check the values and try again.",
      })
    }
  }

  async function testRedis() {
    setRedisTest({ status: "testing" })
    try {
      const result = await postValidate(token, { redis_url: value.redis_url })
      setRedisTest({ status: "done", result })
    } catch (err) {
      setRedisTest({
        status: "error",
        message: err instanceof SetupApiError ? err.message : "Test failed — check the value and try again.",
      })
    }
  }

  const sbDone = supabaseTest.status === "done" ? supabaseTest.result : null
  const redisDone = redisTest.status === "done" ? redisTest.result : null

  const schemaMissing =
    !!sbDone && sbDone.postgres.state === "up" && sbDone.postgres.schema_present === false

  const sbGreen =
    !!sbDone &&
    sbDone.supabase.state === "up" &&
    sbDone.postgres.state === "up" &&
    sbDone.postgres.schema_present === true
  const redisGreen = !!redisDone && redisDone.redis.state === "up"
  const bothGreen = sbGreen && redisGreen

  return (
    <section aria-label="Connect your database" className="space-y-5">
      <div>
        <h2 className="font-headline text-xl font-semibold text-foreground">Connect your database</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste your Supabase and Redis details. We'll test each connection before you continue —
          nothing is saved until the final step.
        </p>
      </div>

      {/* ── Supabase group ──────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-[10px] border border-border bg-card/40 p-4">
        <h3 className="font-headline text-base font-semibold text-foreground">Supabase</h3>

        <PlainField
          id="supabase_url"
          label="Project URL"
          env="SUPABASE_URL"
          value={value.supabase_url ?? ""}
          onChange={(v) => setSupabaseField("supabase_url", v)}
          type="url"
          placeholder="https://<project-ref>.supabase.co"
        />
        <SecretField
          id="supabase_anon_key"
          label="Anon key"
          env="SUPABASE_ANON_KEY"
          value={value.supabase_anon_key ?? ""}
          onChange={(v) => setSupabaseField("supabase_anon_key", v)}
        />
        <SecretField
          id="supabase_service_role_key"
          label="Service role key"
          env="SUPABASE_SERVICE_ROLE_KEY"
          value={value.supabase_service_role_key ?? ""}
          onChange={(v) => setSupabaseField("supabase_service_role_key", v)}
        />
        <SecretField
          id="supabase_publishable_key"
          label="Publishable key"
          env="SUPABASE_PUBLISHABLE_KEY"
          value={value.supabase_publishable_key ?? ""}
          onChange={(v) => setSupabaseField("supabase_publishable_key", v)}
        />
        <SecretField
          id="supabase_secret_key"
          label="Secret key"
          env="SUPABASE_SECRET_KEY"
          value={value.supabase_secret_key ?? ""}
          onChange={(v) => setSupabaseField("supabase_secret_key", v)}
        />
        <SecretField
          id="postgres_dsn"
          label="Postgres connection string"
          env="POSTGRES_DSN"
          value={value.postgres_dsn ?? ""}
          onChange={(v) => setSupabaseField("postgres_dsn", v)}
        >
          {/* Always-visible DSN hint (OPERATOR.md A4). */}
          <p className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 flex-none" aria-hidden="true" />
            <span>
              Use the <span className="font-semibold text-foreground">Session pooler</span> on{" "}
              <code className="font-mono">:5432</code> — not the direct{" "}
              <code className="font-mono">{"db.<ref>"}</code> host, not{" "}
              <code className="font-mono">:6543</code>.
            </span>
          </p>
        </SecretField>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={testSupabase}
            disabled={supabaseTest.status === "testing"}
            className="w-full sm:w-auto"
          >
            {supabaseTest.status === "testing" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Testing…
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        </div>

        {supabaseTest.status === "error" && (
          <p role="alert" className="text-[12px] text-destructive">
            {supabaseTest.message}
          </p>
        )}
        {sbDone && (
          <div role="status" className="space-y-1.5">
            <ProbeLine label="Supabase Auth" probe={sbDone.supabase} />
            <ProbeLine label="Postgres" probe={sbDone.postgres} />
            {sbGreen && (
              <div className="flex items-center gap-2 text-[12px] text-success">
                <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-success" />
                Schema present
              </div>
            )}
          </div>
        )}

        {schemaMissing && (
          <SchemaGuidancePanel
            token={token}
            bind={{
              supabase_url: value.supabase_url,
              supabase_service_role_key: value.supabase_service_role_key,
              postgres_dsn: value.postgres_dsn,
            }}
            onBootstrapped={testSupabase}
          />
        )}
      </div>

      {/* ── Redis group ─────────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-[10px] border border-border bg-card/40 p-4">
        <h3 className="font-headline text-base font-semibold text-foreground">Redis</h3>

        <SecretField
          id="redis_url"
          label="Redis URL"
          env="REDIS_URL"
          value={value.redis_url ?? ""}
          onChange={setRedisField}
        >
          <p className="text-[10px] leading-snug text-muted-foreground">
            Use <code className="font-mono">rediss://</code> (two s's) for a managed Redis over TLS.
          </p>
        </SecretField>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={testRedis}
            disabled={redisTest.status === "testing"}
            className="w-full sm:w-auto"
          >
            {redisTest.status === "testing" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Testing…
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        </div>

        {redisTest.status === "error" && (
          <p role="alert" className="text-[12px] text-destructive">
            {redisTest.message}
          </p>
        )}
        {redisDone && (
          <div role="status">
            <ProbeLine label="Redis" probe={redisDone.redis} />
          </div>
        )}
      </div>

      {/* Continue is gated until BOTH groups test green (schema sub-check included). */}
      <div className="space-y-1.5">
        <Button onClick={onContinue} disabled={!bothGreen} className="w-full sm:w-auto">
          Continue
        </Button>
        {!bothGreen && (
          <p className="text-[11px] text-muted-foreground">
            Test both connections — Continue unlocks when both are green.
          </p>
        )}
      </div>
    </section>
  )
}
