/**
 * Brand icons for the public landing page — Phase 226.
 *
 * ⚠ TWO SOURCES, BOTH SINGLE-SOURCE, NEITHER REDRAWN (D-226-08 / the icon convention):
 *
 *   - MODEL PROVIDER marks come from `@lobehub/icons`, the same package every app surface
 *     renders provider logos from.
 *   - SERVICE / CONNECTOR marks come from `@/lib/connectionMark`, the ONE module in the repo
 *     allowed to import the iconify logo pack directly. Its own suite asserts that NO OTHER source file
 *     imports a brand mark ("one home, not per-component"), and this file used to be the one
 *     offender — found by the count gate at the 226 merge, not by the phase's review, because
 *     pre-flight F-6 kept the phase off the gate while 224-05 edited it.
 *
 * `connectionMark()` is total (never null) and imports only lucide + `@/lib/utils`, so the
 * landing's own fence (no `@/lib/api`, `@/lib/supabase`, providers, auth, layout) still holds.
 * The landing renders marks at pixel sizes, so this file applies the entry's `ink` inline
 * instead of the app's Tailwind size classes.
 */
import type { CSSProperties } from "react"
import OpenAI from "@lobehub/icons/es/OpenAI/components/Mono"
import Anthropic from "@lobehub/icons/es/Anthropic/components/Mono"
import GeminiColor from "@lobehub/icons/es/Gemini/components/Color"
import DeepSeekColor from "@lobehub/icons/es/DeepSeek/components/Color"
import Moonshot from "@lobehub/icons/es/Moonshot/components/Mono"
import ZhipuColor from "@lobehub/icons/es/Zhipu/components/Color"
import MinimaxColor from "@lobehub/icons/es/Minimax/components/Color"
import OpenRouter from "@lobehub/icons/es/OpenRouter/components/Mono"
import Ollama from "@lobehub/icons/es/Ollama/components/Mono"
import LmStudio from "@lobehub/icons/es/LmStudio/components/Mono"
import { connectionMark } from "@/lib/connectionMark"

export interface IconProps {
  size?: number | string
  className?: string
  style?: CSSProperties
}

// ── Model providers (`@lobehub/icons`) ───────────────────────────────────────────────

export function OpenAIIcon({ size = 16, className, style }: IconProps) {
  return <OpenAI size={size} className={className} style={style} />
}

export function AnthropicIcon({ size = 16, className, style }: IconProps) {
  return <Anthropic size={size} className={className} style={style} />
}

/** The Google MODEL provider (Gemini). The Google SERVICE mark is `GoogleIcon` below. */
export function GeminiIcon({ size = 16, className, style }: IconProps) {
  return <GeminiColor size={size} className={className} style={style} />
}

export function DeepSeekIcon({ size = 16, className, style }: IconProps) {
  return <DeepSeekColor size={size} className={className} style={style} />
}

export function MoonshotIcon({ size = 16, className, style }: IconProps) {
  return <Moonshot size={size} className={className} style={style} />
}

export function ZhipuIcon({ size = 16, className, style }: IconProps) {
  return <ZhipuColor size={size} className={className} style={style} />
}

export function MinimaxIcon({ size = 16, className, style }: IconProps) {
  return <MinimaxColor size={size} className={className} style={style} />
}

export function OpenRouterIcon({ size = 16, className, style }: IconProps) {
  return <OpenRouter size={size} className={className} style={style} />
}

export function OllamaIcon({ size = 16, className, style }: IconProps) {
  return <Ollama size={size} className={className} style={style} />
}

export function LmStudioIcon({ size = 16, className, style }: IconProps) {
  return <LmStudio size={size} className={className} style={style} />
}

// ── Services / connectors (`@/lib/connectionMark` — the one home) ────────────────────

const MUTED = "hsl(220 16% 65%)"

/** Render a service mark at a pixel size, honouring the map's ink token inline. */
function ServiceMark({ id, size = 16, className, style }: IconProps & { id: string }) {
  const { Mark, ink } = connectionMark({ service_id: id })
  const inkStyle: CSSProperties =
    ink === "fill" ? { fill: "currentColor", color: MUTED } : ink === "stroke" ? { color: MUTED } : {}
  return (
    <Mark aria-hidden="true" width={size} height={size} className={className} style={{ ...inkStyle, ...style }} />
  )
}

/** Google Workspace — the Google "G", not the Gemini model mark. */
export function GoogleIcon(p: IconProps) {
  return <ServiceMark id="google" {...p} />
}
export function GmailIcon(p: IconProps) {
  return <ServiceMark id="google-gmail" {...p} />
}
export function CalendarIcon(p: IconProps) {
  return <ServiceMark id="google-calendar" {...p} />
}
export function DriveIcon(p: IconProps) {
  return <ServiceMark id="google-drive" {...p} />
}
export function SheetsIcon(p: IconProps) {
  return <ServiceMark id="google-sheets" {...p} />
}
export function DocsIcon(p: IconProps) {
  return <ServiceMark id="google-docs" {...p} />
}
export function SlackBrandIcon(p: IconProps) {
  return <ServiceMark id="slack" {...p} />
}
export function JiraBrandIcon(p: IconProps) {
  return <ServiceMark id="jira" {...p} />
}
export function GithubBrandIcon(p: IconProps) {
  return <ServiceMark id="github" {...p} />
}
export function NotionBrandIcon(p: IconProps) {
  return <ServiceMark id="notion" {...p} />
}
export function MicrosoftBrandIcon(p: IconProps) {
  return <ServiceMark id="microsoft" {...p} />
}
export function FigmaBrandIcon(p: IconProps) {
  return <ServiceMark id="figma" {...p} />
}
export function LinearBrandIcon(p: IconProps) {
  return <ServiceMark id="linear" {...p} />
}
export function SentryBrandIcon(p: IconProps) {
  return <ServiceMark id="sentry" {...p} />
}
export function IntercomBrandIcon(p: IconProps) {
  return <ServiceMark id="intercom" {...p} />
}
export function MiroBrandIcon(p: IconProps) {
  return <ServiceMark id="miro" {...p} />
}
export function McpBrandIcon(p: IconProps) {
  return <ServiceMark id="custom_mcp" {...p} />
}
export function SmtpBrandIcon(p: IconProps) {
  return <ServiceMark id="smtp" {...p} />
}

// ── Lookups by fact id ────────────────────────────────────────────────────────────────

/** Provider ids as `facts.ts` `MODEL_PROVIDERS` / `LOCAL_RUNTIMES` carry them. */
export function getModelIcon(id: string, props: IconProps = { size: 18 }) {
  switch (id) {
    case "anthropic":
      return <AnthropicIcon {...props} />
    case "openai":
      return <OpenAIIcon {...props} />
    case "google":
      return <GeminiIcon {...props} />
    case "deepseek":
      return <DeepSeekIcon {...props} />
    case "zhipu":
      return <ZhipuIcon {...props} />
    case "minimax":
      return <MinimaxIcon {...props} />
    case "moonshot":
      return <MoonshotIcon {...props} />
    case "openrouter":
      return <OpenRouterIcon {...props} />
    case "ollama":
      return <OllamaIcon {...props} />
    case "lmstudio":
      return <LmStudioIcon {...props} />
    default:
      return <OpenAIIcon {...props} />
  }
}

/**
 * Service ids as `facts.ts` `CONNECTOR_CATALOG` carries them. Total by construction:
 * `connectionMark()` answers an unknown id with the map's own NAMED neutral (a plug), never
 * another vendor's mark — so this needs no default arm of its own.
 */
export function getServiceIcon(id: string, props: IconProps = { size: 22 }) {
  return <ServiceMark id={id} {...props} />
}
