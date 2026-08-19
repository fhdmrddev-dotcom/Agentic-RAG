/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        headline: ['"Manrope"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // Phase 088-05 (UAT SC#2 / WCAG 2.1 AA 1.4.3): panel-scoped muted text
        // colors that hit ≥4.5:1 on the workspace --panel-surface in BOTH themes.
        // Used ONLY inside components/panel/* (text-panel-muted-foreground[-dim])
        // so the global muted aesthetic of chat/nav stays unchanged.
        "panel-muted-foreground": "hsl(var(--panel-muted-foreground))",
        "panel-muted-foreground-dim": "hsl(var(--panel-muted-foreground-dim))",
        // Phase 088-05 (operator request / WCAG 2.1 AA 1.4.3): panel-scoped
        // status-TEXT colors for the todo STATUS label (completed=green,
        // in_progress=amber). Same mapping pattern as panel-muted-foreground;
        // used ONLY in components/panel/* (text-panel-status-done/-active).
        "panel-status-done": "hsl(var(--panel-status-done))",
        "panel-status-active": "hsl(var(--panel-status-active))",
        // Phase 094 (D-05 / UI-SPEC Build-Prerequisite A): the purple `retrying`
        // accent token (gate-retry glyph + llm_batch_agents left-border). Same
        // mapping shape as panel-status-*; defined in index.css :root/.dark.
        // Used via text-accent-violet / border-accent-violet (Plan 03 surfaces).
        "accent-violet": "hsl(var(--accent-violet))",
        // Phase 094 WR-04 (UI-SPEC §Color contrast) — LIGHTENED violet for the
        // `retrying` pill LABEL TEXT (normal text ≥4.5:1). The base accent-violet
        // is graphic-level (≥3:1) and stays for the glyph/border; this token is the
        // text-safe shade. Used via text-accent-violet-text (PhaseCard retrying).
        "accent-violet-text": "hsl(var(--accent-violet-text))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        // Phase 192.2 WR-01 — a MISSING DECLARATION, not a new colour. `--warning` /
        // `--warning-foreground` have existed in index.css since Phase 087 (the amber
        // ask_user treatment) but this key never did, so `bg-warning` / `text-warning`
        // compiled to NOTHING everywhere they were used — the WorkflowCard `stopped` run
        // gutter, plus ModelDiscoveryPanel, ModelRegistryTab and ConnectionFormPanel.
        // Same two-member shape as `success` directly above. Guarded by
        // components/workflows/library/gutterTokens.fences.test.ts.
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
        },
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(239 84% 67% / 0.4)" },
          "50%": { boxShadow: "0 0 0 6px hsl(239 84% 67% / 0)" },
        },
        // Phase 068.5 (D-068.5-05..07): brand-mark breathing pulse — sibling of
        // pulseGlow. Keyframe body lives in index.css; this entry preserves the
        // utility class name from Tailwind purge. camelCase matches existing
        // convention (fadeSlideUp, pulseGlow).
        brandPulse: {
          "0%, 100%": { transform: "scale(1.0)", opacity: "0.85" },
          "50%": { transform: "scale(1.05)", opacity: "1.0" },
        },
      },
      animation: {
        fadeSlideUp: "fadeSlideUp 0.3s ease-out forwards",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        brandPulse: "brandPulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}
