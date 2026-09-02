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

import GoogleDriveIcon from "~icons/logos/google-drive"
import GoogleGmailIcon from "~icons/logos/google-gmail"
import GoogleCalendarIcon from "~icons/logos/google-calendar"
import GoogleSheetsGlyph from "~icons/simple-icons/googlesheets"
import GoogleDocsGlyph from "~icons/simple-icons/googledocs"
import SlackIcon from "~icons/logos/slack-icon"
import JiraIcon from "~icons/logos/jira"
import GithubIcon from "~icons/logos/github-icon"
import NotionIcon from "~icons/logos/notion-icon"
import MicrosoftIcon from "~icons/logos/microsoft-icon"
import FigmaIcon from "~icons/logos/figma"
import LinearIcon from "~icons/logos/linear-icon"
import SentryIcon from "~icons/logos/sentry-icon"
import IntercomIcon from "~icons/logos/intercom-icon"
import MiroIcon from "~icons/logos/miro-icon"
import McpIcon from "~icons/logos/model-context-protocol-icon"

export interface IconProps {
  size?: number | string
  className?: string
  style?: Record<string, any>
}

export function OpenAIIcon({ size = 16, className, style }: IconProps) {
  return <OpenAI size={size} className={className} style={style} />
}

export function AnthropicIcon({ size = 16, className, style }: IconProps) {
  return <Anthropic size={size} className={className} style={style} />
}

export function GoogleIcon({ size = 16, className, style }: IconProps) {
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

// Connection marks
export function GmailIcon({ size = 16, className, style }: IconProps) {
  return <GoogleGmailIcon width={size} height={size} className={className} style={style} />
}

export function CalendarIcon({ size = 16, className, style }: IconProps) {
  return <GoogleCalendarIcon width={size} height={size} className={className} style={style} />
}

export function DriveIcon({ size = 16, className, style }: IconProps) {
  return <GoogleDriveIcon width={size} height={size} className={className} style={style} />
}

export function SheetsIcon({ size = 16, className, style }: IconProps) {
  return (
    <GoogleSheetsGlyph
      width={size}
      height={size}
      className={className}
      style={{ color: "#34A853", ...style }}
    />
  )
}

export function DocsIcon({ size = 16, className, style }: IconProps) {
  return (
    <GoogleDocsGlyph
      width={size}
      height={size}
      className={className}
      style={{ color: "#4285F4", ...style }}
    />
  )
}

export function SlackBrandIcon({ size = 16, className, style }: IconProps) {
  return <SlackIcon width={size} height={size} className={className} style={style} />
}

export function JiraBrandIcon({ size = 16, className, style }: IconProps) {
  return <JiraIcon width={size} height={size} className={className} style={style} />
}

export function GithubBrandIcon({ size = 16, className, style }: IconProps) {
  return <GithubIcon width={size} height={size} className={className} style={style} />
}

export function NotionBrandIcon({ size = 16, className, style }: IconProps) {
  return <NotionIcon width={size} height={size} className={className} style={style} />
}

export function MicrosoftBrandIcon({ size = 16, className, style }: IconProps) {
  return <MicrosoftIcon width={size} height={size} className={className} style={style} />
}

export function FigmaBrandIcon({ size = 16, className, style }: IconProps) {
  return <FigmaIcon width={size} height={size} className={className} style={style} />
}

export function LinearBrandIcon({ size = 16, className, style }: IconProps) {
  return <LinearIcon width={size} height={size} className={className} style={style} />
}

export function SentryBrandIcon({ size = 16, className, style }: IconProps) {
  return <SentryIcon width={size} height={size} className={className} style={style} />
}

export function IntercomBrandIcon({ size = 16, className, style }: IconProps) {
  return <IntercomIcon width={size} height={size} className={className} style={style} />
}

export function MiroBrandIcon({ size = 16, className, style }: IconProps) {
  return <MiroIcon width={size} height={size} className={className} style={style} />
}

export function McpBrandIcon({ size = 16, className, style }: IconProps) {
  return <McpIcon width={size} height={size} className={className} style={style} />
}
