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

## Video library

Three styles, all free: **narrated** (Kokoro voice, local), **documentary/explainer** (NotebookLM video wrapped in Syrel branding), and **music-driven promo** (no narration, original synthesized track).

| Composition | Style | Purpose | Size · length | Render |
|---|---|---|---|---|
| `SyrelOverview` | calm motion graphics, no voice | sales / landing | 1920×1080 · 63 s | `npm run render:overview` |
| `SyrelEnergetic` | narrated, energetic | landing hero, sales | 1920×1080 · 40 s | `npm run render:energetic` |
| `SyrelEnergeticVertical` | narrated, energetic (re-laid-out 9:16, not cropped) | LinkedIn / Shorts / Reels | 1080×1920 · 40 s | `npm run render:vertical` |
| `Clip-Chat`, `Clip-Library`, `Clip-Workflows`, `Clip-Connections`, `Clip-Experts`, `Clip-Admin` | narrated feature clips | docs-page embeds (Phase 276 guides) | 1920×1080 · 15.3 s each | `npm run render:clips` |
| `BrandedEpisode` | NotebookLM video + Syrel intro/lower-third/outro | documentaries ("Syrel: The Build Story") and explainers | 1920×1080 · source + ~6 s | `npm run render:episode -- --props='{...}'` |
| `SyrelPromo` | music-driven, no narration | landing / launch / social | 1920×1080 · 33.5 s | `npm run render:promo` |
| `SyrelPromoVertical` | music-driven, no narration | Shorts / Reels / LinkedIn | 1080×1920 · 33.5 s | `npm run render:promo` |
| `SyrelTeaser` | music-driven 15 s cutdown | ads, social | 1920×1080 · 15.5 s | `npm run render:promo` |

### Feature clips (narrated)

`npm run vo:clips` regenerates `public/vo/clip-<id>.wav` and `src/clips/clipTimings.ts` from the six lines in `tools/make_vo.py` (each ≤ 22 words, written from `docs/history/` "Still true" rows). Each clip = title card → the energetic scene re-voiced → end card ("Read the full guide in the Syrel docs" + Book a demo).

### Branded NotebookLM episodes

NotebookLM videos are large and generated outside the repo, so `public/notebooklm/` is git-ignored. Download the video (NotebookLM MCP `download_artifact`), copy it into `public/notebooklm/`, then:

```bash
npm run render:episode -- --props='{"src":"notebooklm/<file>.mp4","series":"Syrel: The Build Story","episodeLabel":"Episode 1 · Chapter 1","title":"A document chat you can trust"}'
```

`calculateMetadata` reads the source length (Mediabunny), so the composition always fits the video.

### Music-driven promo

Run `npm run music` once before rendering a promo (the WAV is git-ignored: it is regenerated deterministically in ~12 s). It synthesizes **"Syrel Pulse"** — an original 120 BPM track made in numpy (no samples, no downloads; ours to use anywhere) — to `public/music/syrel-pulse.wav` (~−14 LUFS, peaks ≤ −1 dBFS) and writes `src/promo/beatMap.ts`. Structure: 2-bar riser → impact + drop at bar 3 (bars 3–10) → breakdown bar 11 → build bar 12 → drop 2 bars 13–15 → final hit bar 16 + tail. Every cut lands on a beat from the map; `src/promo/music.ts` checks the generated and computed maps agree. Counters read real numbers from `frontend/src/landing/facts.ts` (providers, publish checks, built-in tools, connector services).

**Swap the music:** put a free track (Pixabay Music, YouTube Audio Library) in `public/music/`, set `MUSIC.src`, `bpm` and `offsetS` (seconds to the first downbeat) in `src/promo/music.ts`. The picture re-times itself from those numbers; pick a track whose sections fall on the same bars, or edit `MUSIC.sections`.

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

## Energetic cut + voiceover

`SyrelEnergetic` (~40 s) is the fast version: ease-out-expo entrances, spring pops on hero elements, word-by-word kinetic headlines, slide / wipe / zoom-through cuts with two light-sweep overlays, a slow camera push-in, faster ambient background, and low-volume SFX from Remotion's hosted set. The calm `SyrelOverview` is unchanged. Code lives in `src/energetic/`.

**Voiceover is generated locally and free** with [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0, no API key, runs on CPU). The script is in `tools/make_vo.py` (drafted by NotebookLM from the release-history sources, then fact-checked).

```bash
# one-time setup (≈ 1 GB: torch CPU + Kokoro weights)
python -m venv tools/.venv
tools/.venv/Scripts/python.exe -m pip install kokoro soundfile

npm run vo                 # regenerate public/vo/beat-1..7.wav + src/energetic/voTimings.ts
npm run render:energetic   # out/syrel-energetic.mp4
```

Each scene is sized from the measured speech length (`voTimings.ts`), so editing a line and re-running `npm run vo` keeps picture and voice in sync. Try another voice with `tools/.venv/Scripts/python.exe tools/make_vo.py --compare` (writes samples to `tools/samples/`).

**Music:** pass a free track (e.g. from Pixabay Music or the YouTube Audio Library) via the `musicSrc` prop — put the file in `public/music/` and render with `--props='{"musicSrc":"track.mp3"}'`. It plays at 15% volume. **SFX** come from `https://remotion.media/*.wav` at render time; set `SFX_ENABLED = false` in `src/energetic/kit.tsx` to render offline.
