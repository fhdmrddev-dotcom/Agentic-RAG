"""Generate the Syrel voiceover locally with Kokoro TTS (Apache-2.0, free, no API key).

Writes one WAV per beat to video/public/vo/beat-N.wav and the measured speech lengths to
video/src/energetic/voTimings.ts, which the SyrelEnergetic composition uses to size each scene.

    cd video
    tools/.venv/Scripts/python.exe tools/make_vo.py                 # default voice
    tools/.venv/Scripts/python.exe tools/make_vo.py --voice af_heart --speed 1.1
    tools/.venv/Scripts/python.exe tools/make_vo.py --compare       # beat 1 in each candidate voice
    tools/.venv/Scripts/python.exe tools/make_vo.py --clips         # one line per feature clip

First run downloads the Kokoro-82M weights from Hugging Face (~330 MB, cached).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SAMPLE_RATE = 24_000
ROOT = Path(__file__).resolve().parent.parent
VO_DIR = ROOT / "public" / "vo"
TIMINGS = ROOT / "src" / "energetic" / "voTimings.ts"
CLIP_TIMINGS = ROOT / "src" / "clips" / "clipTimings.ts"
CANDIDATES = ["am_michael", "af_heart"]

# Drafted by NotebookLM from the release-history sources, then fact-checked
# (only shipped / "Still true" capabilities; no v4.5, no in-app document preview).
SCRIPT = [
    "Your company's documents hold the answers. Most AI never reads them.",
    "Syrel searches your knowledge and answers with cited sources and a confidence badge.",
    "When there's real work to do, it runs Python in a sealed sandbox and hands back finished files.",
    "Turn recurring tasks into workflows that run every step in order, and must pass publish checks before they go live.",
    "Connect your tools, and decide what each one may do. Allow. Ask. Or deny.",
    "Install Experts for every team, with spend tracked per Expert.",
    "Syrel. Answers from your knowledge. With receipts.",
]

# Feature clips (docs-page embeds, Phase 276). One line each, <= 22 words, written from
# docs/history "Still true" rows. Library avoids Find/download (v4.5, not released).
CLIPS = {
    "chat": "Ask Syrel anything about your documents. Every answer cites its sources, and a confidence badge tells you how sure it is.",
    "library": "Organise documents in folders and saved views. Syrel keeps their metadata, with honest confidence, so every answer can cite the page.",
    "workflows": "Describe a process in plain English. Syrel runs each step in order, checks it, and won't publish until it proves it works.",
    "connections": "Connect Google Workspace, Jira or any MCP server, then decide what every tool may do: allow it, ask first, or deny it.",
    "experts": "Install an Expert for any team. It adds its own knowledge and skills, and its spend is tracked separately.",
    "admin": "Run Syrel from the Control Room: manage users and models, watch spend per Expert, read the audit log, and flip kill switches.",
}


def synth(pipeline: KPipeline, text: str, voice: str, speed: float) -> np.ndarray:
    parts = [np.asarray(audio) for _, _, audio in pipeline(text, voice=voice, speed=speed)]
    audio = np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32)
    return trim_silence(audio)


def trim_silence(audio: np.ndarray, threshold: float = 0.01, keep: float = 0.05) -> np.ndarray:
    """Trim leading/trailing near-silence, keeping a short tail so words don't clip."""
    loud = np.where(np.abs(audio) > threshold)[0]
    if loud.size == 0:
        return audio
    pad = int(keep * SAMPLE_RATE)
    return audio[max(0, loud[0] - pad) : min(audio.size, loud[-1] + pad)]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="am_michael")
    ap.add_argument("--speed", type=float, default=1.1)
    ap.add_argument("--compare", action="store_true", help="render beat 1 in each candidate voice to tools/samples/")
    ap.add_argument("--clips", action="store_true", help="render the feature-clip lines to public/vo/clip-<id>.wav")
    args = ap.parse_args()

    pipeline = KPipeline(lang_code="a")  # American English

    if args.compare:
        out = Path(__file__).resolve().parent / "samples"
        out.mkdir(exist_ok=True)
        for v in CANDIDATES:
            audio = synth(pipeline, SCRIPT[0] + " " + SCRIPT[3], v, args.speed)
            sf.write(out / f"{v}.wav", audio, SAMPLE_RATE)
            print(f"{v}: {audio.size / SAMPLE_RATE:.2f}s -> {out / (v + '.wav')}")
        return

    VO_DIR.mkdir(parents=True, exist_ok=True)

    if args.clips:
        CLIP_TIMINGS.parent.mkdir(parents=True, exist_ok=True)
        clip_seconds: dict[str, float] = {}
        for cid, line in CLIPS.items():
            words = len(line.split())
            assert words <= 22, f"{cid}: {words} words (max 22)"
            audio = synth(pipeline, line, args.voice, args.speed)
            sf.write(VO_DIR / f"clip-{cid}.wav", audio, SAMPLE_RATE)
            clip_seconds[cid] = round(audio.size / SAMPLE_RATE, 2)
            print(f"clip-{cid}: {clip_seconds[cid]:.2f}s ({words} words)  {line}")
        body = ", ".join(f"{k}: {v}" for k, v in clip_seconds.items())
        CLIP_TIMINGS.write_text(
            "// GENERATED by tools/make_vo.py --clips — seconds of speech per feature clip.\n"
            f"// Voice: {args.voice} · speed {args.speed}\n"
            f"export const CLIP_VO_SECONDS = {{ {body} }} as const;\n"
            "export type ClipId = keyof typeof CLIP_VO_SECONDS;\n",
            encoding="utf-8",
        )
        print(f"-> {CLIP_TIMINGS}")
        return

    seconds: list[float] = []
    for i, line in enumerate(SCRIPT, start=1):
        audio = synth(pipeline, line, args.voice, args.speed)
        sf.write(VO_DIR / f"beat-{i}.wav", audio, SAMPLE_RATE)
        seconds.append(round(audio.size / SAMPLE_RATE, 2))
        print(f"beat-{i}: {seconds[-1]:.2f}s  {line}")

    TIMINGS.write_text(
        "// GENERATED by tools/make_vo.py — seconds of speech per voiceover beat (beat-1 … beat-7).\n"
        f"// Voice: {args.voice} · speed {args.speed}\n"
        f"export const VO_SECONDS = [{', '.join(str(s) for s in seconds)}] as const;\n",
        encoding="utf-8",
    )
    print(f"total speech {sum(seconds):.1f}s -> {TIMINGS}")


if __name__ == "__main__":
    main()
