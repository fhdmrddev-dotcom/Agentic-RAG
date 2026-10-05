"""Synthesize "Syrel Pulse" — an original, license-clean 120 BPM electronic track for the promo videos.

Pure numpy + soundfile (no samples, no downloads, no third-party audio), so the track is ours to use
anywhere. Also writes src/promo/beatMap.ts so the picture can lock to the music frame-accurately.

    cd video
    tools/.venv/Scripts/python.exe tools/make_music.py           # -> public/music/syrel-pulse.wav + src/promo/beatMap.ts

Structure (bars of 4 beats, 2.0 s per bar at 120 BPM):
    bars  1-2   intro: filtered-noise riser + rising pad + soft pulse
    bar   3     IMPACT + DROP 1 (bars 3-10): 4-on-the-floor kick, claps on 2 & 4, 8th hats,
                side-chained saw bass, supersaw pad chords  Am-F-C-G
    bars 11-12  breakdown (arp + pad) -> build (snare roll + riser) in bar 12
    bars 13-15  DROP 2 (full)
    bar  16     FINAL HIT (downbeat of bar 16) + tail
Master: ~-14 LUFS integrated (measured by ffmpeg ebur128 after writing), peaks <= -1 dBFS, 44.1 kHz stereo.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44_100
BPM = 120
BEAT = 60 / BPM  # 0.5 s
BAR = 4 * BEAT  # 2.0 s
BARS = 16
TAIL = 1.5  # seconds after bar 16 ends
TOTAL = BARS * BAR + TAIL
N = int(TOTAL * SR)
FPS = 30
TARGET_LUFS = -14.0

ROOT = Path(__file__).resolve().parent.parent
OUT_WAV = ROOT / "public" / "music" / "syrel-pulse.wav"
OUT_MAP = ROOT / "src" / "promo" / "beatMap.ts"

rng = np.random.default_rng(7)  # deterministic: same track every run

# Sections (1-based bar numbers)
DROP1 = range(3, 11)
BREAK = 11
BUILD = 12
DROP2 = range(13, 16)
FINAL = 16

# Am - F - C - G (one chord per bar), MIDI notes
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
ROOTS = [45, 41, 36, 43]  # bass roots (A2, F2, C2, G2)


def t_of(bar: int, beat: float = 0.0) -> float:
    return (bar - 1) * BAR + beat * BEAT


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf: np.ndarray, sig: np.ndarray, start_s: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """Add a mono signal into the stereo buffer at start_s with equal-power pan (-1 L .. +1 R)."""
    i = int(start_s * SR)
    if i >= buf.shape[0]:
        return
    n = min(sig.size, buf.shape[0] - i)
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    buf[i : i + n, 0] += sig[:n] * gain * left
    buf[i : i + n, 1] += sig[:n] * gain * right


def env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / max(decay, 1e-4))


def onepole_lp(x: np.ndarray, cutoff: float | np.ndarray) -> np.ndarray:
    """One-pole low-pass; cutoff may vary per sample (for sweeps)."""
    cut = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(x.size):  # ~1.5 M samples max per call; fine for an offline tool
        acc = (1 - a[k]) * x[k] + a[k] * acc
        y[k] = acc
    return y


def fft_band(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(x.size, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(spec, x.size)


def saw(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    return 2 * ((t * freq + phase) % 1.0) - 1


# ── instruments ─────────────────────────────────────────────────────────────
def kick() -> np.ndarray:
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    click = rng.standard_normal(n) * np.exp(-t / 0.003) * 0.3
    return np.tanh(1.6 * (body + click))


def clap() -> np.ndarray:
    n = int(0.35 * SR)
    noise = fft_band(rng.standard_normal(n), 900, 7000)
    e = np.zeros(n)
    for d in (0.0, 0.011, 0.022):  # three quick hits = clap
        i = int(d * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (0.012 if d < 0.02 else 0.12))
    return noise * e / np.max(np.abs(noise * e))


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.25 if open_ else 0.06) * SR)
    noise = fft_band(rng.standard_normal(n), 7000, 16000)
    return noise * env(n, 0.0005, 0.08 if open_ else 0.018) / 3


def snare() -> np.ndarray:
    n = int(0.2 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    noise = fft_band(rng.standard_normal(n), 1200, 9000) * np.exp(-t / 0.07) / 3
    return 0.5 * tone + noise


def pad_chord(notes: list[int], dur: float) -> np.ndarray:
    n = int(dur * SR)
    sig = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.12):  # supersaw: detuned in cents/100
            sig += saw(midi_hz(m + 12 + det), n, rng.random())
    sig = onepole_lp(sig / (len(notes) * 3), 2200)
    a = np.clip(np.arange(n) / SR / 0.25, 0, 1)
    r = np.clip((dur - np.arange(n) / SR) / 0.2, 0, 1)
    return sig * a * r


def bass_note(m: int, dur: float) -> np.ndarray:
    n = int(dur * SR)
    sig = 0.6 * saw(midi_hz(m), n) + 0.4 * saw(midi_hz(m) * 1.003, n)
    sig = onepole_lp(sig, 900)
    return np.tanh(1.8 * sig) * env(n, 0.003, dur * 1.6)


def pluck(m: int) -> np.ndarray:
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    tri = 2 * np.abs(2 * ((t * midi_hz(m)) % 1) - 1) - 1
    return tri * np.exp(-t / 0.06)


def riser(dur: float, f_from: float = 300, f_to: float = 9000) -> np.ndarray:
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    cut = f_from * (f_to / f_from) ** (x**2)
    noise = onepole_lp(rng.standard_normal(n), cut)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (3 * x**2)) / SR) * 0.15
    return (noise * 0.5 + tone) * x**1.5


def impact() -> np.ndarray:
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.9)
    crash = fft_band(rng.standard_normal(n), 3000, 15000) * np.exp(-t / 0.7) * 0.35
    return np.tanh(1.4 * boom) + crash


def reverb(x: np.ndarray, seconds: float = 1.1, mix: float = 0.25) -> np.ndarray:
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (seconds / 4))
    ir /= np.sqrt(np.sum(ir**2))
    size = 1 << int(np.ceil(np.log2(x.size + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: x.size]
    return (1 - mix) * x + mix * wet


# ── arrangement ─────────────────────────────────────────────────────────────
def build_track() -> np.ndarray:
    drums = np.zeros((N, 2))
    music = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    fx = np.zeros((N, 2))
    K, CL, HC, HO, SN = kick(), clap(), hat(), hat(True), snare()
    kicks: list[float] = []

    def drop_bar(bar: int) -> None:
        chord_i = (bar - 3) % 4
        for b in range(4):
            tk = t_of(bar, b)
            kicks.append(tk)
            place(drums, K, tk, 0.95)
            place(drums, HC, t_of(bar, b + 0.5), 0.5, pan=0.3)
            place(drums, HO if b % 2 else HC, t_of(bar, b + 0.5), 0.35, pan=-0.25)
            if b in (1, 3):
                place(drums, CL, tk, 0.55, pan=0.05)
        for e8 in range(8):  # 8th-note bass on the chord root, octave bounce
            m = ROOTS[chord_i] + (12 if e8 % 2 else 0)
            place(bass, bass_note(m, BEAT / 2 * 0.95), t_of(bar, e8 * 0.5), 0.55)
        place(music, pad_chord(CHORDS[chord_i], BAR), t_of(bar), 0.32, pan=-0.4)
        place(music, pad_chord(CHORDS[chord_i], BAR), t_of(bar), 0.32, pan=0.4)

    # Intro: riser + rising pad + soft pulse
    place(fx, riser(2 * BAR), 0.0, 0.6)
    for bar in (1, 2):
        place(music, pad_chord(CHORDS[bar - 1], BAR), t_of(bar), 0.18 * bar, pan=0.0)
        for b in range(4):
            place(drums, HC, t_of(bar, b + 0.5), 0.25)
    for b in (2, 2.5, 3, 3.25, 3.5, 3.75):  # pickup snares into the drop
        place(drums, SN, t_of(2, b), 0.25 + 0.05 * b)

    place(fx, impact(), t_of(3), 0.9)
    for bar in DROP1:
        drop_bar(bar)

    # Breakdown (bar 11): pad + 16th arp, no kick
    place(music, pad_chord(CHORDS[0], BAR), t_of(BREAK), 0.35)
    arp = CHORDS[0] + [CHORDS[0][1] + 12]
    for s in range(16):
        place(music, pluck(arp[s % 4] + 12), t_of(BREAK, s * 0.25), 0.22, pan=0.5 if s % 2 else -0.5)
    # Build (bar 12): accelerating snare roll + riser
    place(music, pad_chord(CHORDS[3], BAR), t_of(BUILD), 0.35)
    place(fx, riser(BAR, 500, 12000), t_of(BUILD), 0.7)
    times = [t_of(BUILD, b * 0.5) for b in range(4)] + [t_of(BUILD, 2 + b * 0.25) for b in range(4)] + [
        t_of(BUILD, 3 + b * 0.125) for b in range(8)
    ]
    for i, ts in enumerate(times):
        place(drums, SN, ts, 0.18 + 0.025 * i)

    place(fx, impact(), t_of(13), 0.8)
    for bar in DROP2:
        drop_bar(bar)

    # Final hit + tail
    place(fx, impact(), t_of(FINAL), 1.0)
    place(drums, K, t_of(FINAL), 1.0)
    place(drums, CL, t_of(FINAL), 0.6)
    place(music, pad_chord(CHORDS[0], BAR + TAIL), t_of(FINAL), 0.4)
    kicks.append(t_of(FINAL))

    # Side-chain: duck bass + pad under every kick
    duck = np.ones(N)
    tt = np.arange(N) / SR
    for tk in kicks:
        i = int(tk * SR)
        seg = tt[i : i + int(0.4 * SR)] - tk
        duck[i : i + seg.size] = np.minimum(duck[i : i + seg.size], 1 - 0.85 * np.exp(-seg / 0.11))
    bass *= duck[:, None]
    music *= (0.35 + 0.65 * duck)[:, None]

    music = np.stack([reverb(music[:, c], 1.4, 0.3) for c in (0, 1)], axis=1)
    drums_rev = np.stack([reverb(drums[:, c], 0.6, 0.12) for c in (0, 1)], axis=1)
    mix = drums_rev + bass + music + fx
    return mix


def measure_lufs(path: Path) -> tuple[float, float]:
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True,
        text=True,
    ).stderr
    tail = out[out.rfind("Summary:") :]
    lufs = float(tail.split("I:")[1].split("LUFS")[0])
    peak = float(tail.split("Peak:")[1].split("dBFS")[0])
    return lufs, peak


def master(mix: np.ndarray, gain_db: float) -> np.ndarray:
    x = mix * 10 ** (gain_db / 20)
    x = np.tanh(x * 1.1) / 1.1  # gentle soft clip / limiter
    peak = np.max(np.abs(x))
    ceiling = 10 ** (-1.2 / 20)
    if peak > ceiling:
        x *= ceiling / peak
    return x.astype(np.float32)


def write_beat_map() -> None:
    f = lambda s: round(s * FPS)  # noqa: E731
    beats = [f(i * BEAT) for i in range(BARS * 4 + 1)]
    bars = [f((b - 1) * BAR) for b in range(1, BARS + 2)]
    OUT_MAP.parent.mkdir(parents=True, exist_ok=True)
    OUT_MAP.write_text(
        "// GENERATED by tools/make_music.py — frame map (30 fps) for public/music/syrel-pulse.wav.\n"
        "// To use another track (Pixabay / YouTube Audio Library), drop it in public/music/ and set\n"
        "// MUSIC in src/promo/music.ts to its file, BPM and offset (seconds to the first downbeat);\n"
        "// makeBeatMap() rebuilds this same map from those numbers, assuming the same 16-bar shape.\n"
        f"export const BPM = {BPM};\n"
        f"export const OFFSET_S = 0;\n"
        f"export const BEAT_FRAMES = {f(BEAT)};\n"
        f"export const BAR_FRAMES = {f(BAR)};\n"
        f"export const BEATS = [{', '.join(map(str, beats))}] as const;\n"
        f"export const BARS = [{', '.join(map(str, bars))}] as const; // bar N starts at BARS[N - 1]\n"
        f"export const DROP_1 = {f(t_of(3))}; // bar 3 — impact + first drop\n"
        f"export const BREAKDOWN = {f(t_of(BREAK))}; // bar 11\n"
        f"export const BUILD = {f(t_of(BUILD))}; // bar 12 — snare roll + riser\n"
        f"export const DROP_2 = {f(t_of(13))}; // bar 13\n"
        f"export const FINAL_HIT = {f(t_of(FINAL))}; // bar 16 downbeat\n"
        f"export const TRACK_FRAMES = {f(TOTAL)};\n",
        encoding="utf-8",
    )


def main() -> None:
    OUT_WAV.parent.mkdir(parents=True, exist_ok=True)
    mix = build_track()
    rms_db = 20 * np.log10(np.sqrt(np.mean(mix**2)) + 1e-9)
    gain = TARGET_LUFS + 1.5 - rms_db  # first guess, refined with a real loudness measurement
    for _ in range(4):
        sf.write(OUT_WAV, master(mix, gain), SR, subtype="PCM_16")
        lufs, peak = measure_lufs(OUT_WAV)
        print(f"gain {gain:+.2f} dB -> {lufs:.1f} LUFS, true peak {peak:.1f} dBFS")
        if abs(lufs - TARGET_LUFS) < 0.5:
            break
        gain += TARGET_LUFS - lufs
    write_beat_map()
    print(f"-> {OUT_WAV} ({TOTAL:.1f}s)  -> {OUT_MAP}")


if __name__ == "__main__":
    main()
