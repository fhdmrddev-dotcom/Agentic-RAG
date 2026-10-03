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
