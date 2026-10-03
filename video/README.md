# Syrel videos (Remotion)

Motion-graphic videos for Syrel, written as React code and rendered with [Remotion](https://www.remotion.dev).
Remotion is free for individuals and companies of up to 3 people; a larger company needs a Remotion company license.

## Commands (run in this folder)

| Command | What it does |
|---|---|
| `npm install` | First time only |
| `npm run studio` | Live preview in the browser — scrub, edit, re-time |
| `npm run render:overview` | Renders `out/syrel-overview.mp4` (1920×1080, 30 fps, ~63 s, ~1.5 min to render) |
| `npx remotion still src/index.ts <SceneId> out/frame.png --frame=60` | One frame as a PNG, for quick checks |

## Structure

- `src/theme.ts` — Deep Midnight colours and fonts (copied from `frontend/src/index.css`) and the motion identity: one entrance curve, one exit curve, three durations (300 / 500 / 800 ms), 100 ms stagger.
- `src/components/ui.tsx` — ambient background, signature entrance, captions, panels, chips, check/spinner, logo placeholder.
- `src/scenes/*` — one file per scene; each is also its own composition under **Scenes** in Studio.
- `src/SyrelOverview.tsx` — the full video: 7 scenes joined by 0.5 s crossfades.

## Content rules

- Scene content comes from `docs/history/`. Do **not** show anything those docs flag as unbuilt or undeployed: in-app Word/PDF preview, multiple deployment presets, or v4.5 features as live.
- Example data is fictional and the frame says "Illustrative example".
- No third-party logos; services are monogram tiles.
- The Syrel logo does not exist yet — `LogoPlaceholder` marks every spot it goes.

Agent guidance lives in `.claude/skills/remotion-best-practices` (official Remotion skills) and `.claude/skills/motion-design` (LottieFiles, MIT).
