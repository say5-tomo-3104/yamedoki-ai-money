"""やめどきAI Money 15秒モーショングラフィック用の音を numpy だけで合成する。

考え方（参考動画から借りたのは「作り方」だけ）:
- 先にビートグリッドを決め、映像も音も同じグリッド（拍番号）で配置する
- 30fps で 1 拍 = 14 フレームちょうどになるテンポ（128.57 BPM）にして、
  拍の頭が必ずフレームの頭に乗るようにする
- 書き出した音をもう一度 numpy で解析し、キックの実測位置を beatmap.json に残す
  （映像側はこの実測値をタグとして表示する）

出力: audio.wav（48kHz/16bit/stereo）, beatmap.json
"""

import json
import math
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent

FPS = 30
FRAMES_PER_BEAT = 14
BEAT = FRAMES_PER_BEAT / FPS          # 0.46667 s
BPM = 60 / BEAT                       # 128.571...
BEATS = 32                            # 8 小節
DURATION = 15.0
TOTAL_FRAMES = int(DURATION * FPS)    # 450
SR = 48000
N = int(DURATION * SR)

rng = np.random.default_rng(20261031)

# ---------------------------------------------------------------------------
# アプリのサンプルデータ（src/App.jsx の sampleSubscriptions と同じ値）
# ブランド名は動画に出さず、カテゴリ名だけ使う
# ---------------------------------------------------------------------------
SAMPLE = [
    ("動画配信", 1490, "daily"),
    ("音楽", 1080, "daily"),
    ("AI", 2000, "weekly"),
    ("クラウド", 130, "monthly"),
    ("動画配信", 600, "weekly"),
    ("ジム", 9800, "weekly"),
    ("仕事・ツール", 1100, "weekly"),
    ("音楽", 1280, "daily"),
    ("電子書籍", 980, "monthly"),
    ("クラウド", 250, "monthly"),
]
FREQ_SCORE = {"daily": 0, "weekly": 20, "monthly": 30, "rarely": 40}


def js_round(x):
    return math.floor(x + 0.5)


def cancel_score(price, freq):
    # App.jsx の calculateCancelScore と同じ式
    return min(100, min(40, js_round(price / 3000 * 40)) + FREQ_SCORE[freq])


# ---------------------------------------------------------------------------
# DSP helpers
# ---------------------------------------------------------------------------

def tt(d):
    return np.arange(int(d * SR)) / SR


def bw_filter(x, lo=None, hi=None, order=2):
    """FFT 上で Butterworth 振幅特性をかける（ゼロ位相）。"""
    n = len(x)
    size = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, size)
    f = np.fft.rfftfreq(size, 1 / SR)
    g = np.ones_like(f)
    if hi is not None:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo is not None:
        with np.errstate(divide="ignore"):
            g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(X * g, size)[:n]


def saw(freq, t):
    return 2 * ((freq * t) % 1.0) - 1


def note(name):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4,
             "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave - 4)) / 12)


tracks = {k: np.zeros(N) for k in ["kick", "clap", "hat", "bass", "tone", "fx", "pad"]}


def add(track, t, sig, gain=1.0):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0:
        return
    s = max(0, -i)
    i = max(0, i)
    end = min(N, i + len(sig) - s)
    tracks[track][i:end] += sig[s:s + end - i] * gain


def T(b):
    return b * BEAT


# ---------------------------------------------------------------------------
# Instruments
# ---------------------------------------------------------------------------

def kick():
    t = tt(0.38)
    f = 46 + 120 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.0)
    click = bw_filter(rng.standard_normal(len(t)), lo=1500) * np.exp(-t * 700) * 0.5
    return np.tanh(1.7 * (body + click))


def clap():
    t = tt(0.32)
    nz = bw_filter(rng.standard_normal(len(t)), lo=900, hi=5000)
    env = np.exp(-t * 16)
    for off in (0.0, 0.011, 0.022):
        env = env + np.where(t >= off, np.exp(-(t - off) * 160), 0) * 0.8
    return nz * env * 0.6


def hat(decay=70):
    t = tt(0.08)
    return bw_filter(rng.standard_normal(len(t)), lo=7000) * np.exp(-t * decay)


def bass(freq, dur):
    t = tt(dur)
    s = saw(freq, t) * 0.7 + np.sin(2 * np.pi * freq * t)
    s = bw_filter(s, hi=520)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 5.5)
    return s * env


def blip(freq, d=0.2):
    t = tt(d)
    s = np.sin(2 * np.pi * freq * t) + 0.28 * np.sin(2 * np.pi * 2 * freq * t)
    return s * np.minimum(1, t / 0.002) * np.exp(-t * 20)


def pop(freq):
    t = tt(0.09)
    f = freq * (1 + 0.8 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38)


def bong(freq):
    t = tt(0.45)
    s = np.sin(2 * np.pi * freq * t) + 0.45 * np.sin(2 * np.pi * 2.01 * freq * t)
    return s * np.minimum(1, t / 0.003) * np.exp(-t * 7)


def chord_stab(freqs, d=0.7, cutoff=2200, decay=4.5):
    t = tt(d)
    s = sum(saw(f, t) + saw(f * 1.004, t) for f in freqs) / (2 * len(freqs))
    s = bw_filter(s, hi=cutoff)
    return s * np.minimum(1, t / 0.003) * np.exp(-t * decay)


def crash(d=1.6):
    t = tt(d)
    return bw_filter(rng.standard_normal(len(t)), lo=5000) * np.exp(-t * 2.8) * np.minimum(1, t / 0.002)


def riser(d):
    t = tt(d)
    x = t / d
    nz = rng.standard_normal(len(t))
    lo_part = bw_filter(nz, lo=600, hi=3000) * (1 - x)
    hi_part = bw_filter(nz, lo=3000, hi=11000) * x
    return (lo_part + hi_part) * x ** 2.2


def swish(d=0.16):
    t = tt(d)
    return bw_filter(rng.standard_normal(len(t)), lo=1800, hi=8000) * np.sin(np.pi * t / d) ** 2


def tick():
    t = tt(0.06)
    return (np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90)
            + bw_filter(rng.standard_normal(len(t)), lo=3000) * np.exp(-t * 400) * 0.6)


# ---------------------------------------------------------------------------
# Arrangement（拍番号で書く。映像側 scene.js も同じ拍番号を使う）
# ---------------------------------------------------------------------------
# 小節ごとのコード（A minor）
BAR_CHORDS = [
    ("A1", ["A3", "C4", "E4", "A4"]),   # bar0  b0-3   COUNT
    ("F1", ["F3", "A3", "C4", "F4"]),   # bar1  b4-7   COUNT
    ("C2", ["C4", "E4", "G4", "C5"]),   # bar2  b8-11  REST → 月額
    ("G1", ["G3", "B3", "D4", "G4"]),   # bar3  b12-15 年間カウント
    ("A1", ["A3", "C4", "E4", "A4"]),   # bar4  b16-19 年間スラム
    ("F1", ["F3", "A3", "C4", "F4"]),   # bar5  b20-23 判定
    ("G1", ["G3", "B3", "D4", "G4"]),   # bar6  b24-27 卒業
    ("A1", ["A3", "C4", "E4", "B4"]),   # bar7  b28-31 タイトル
]
REST = {8, 9}

COUNT_A_HITS = [0, 1, 2, 3, 4, 5, 6, 6.5, 7, 7.5]           # サブスク 1→10 件
COUNT_C_HITS = [12 + 0.5 * k for k in range(12)]             # 1→12 ヶ月
SHAPE_HITS = [20 + 0.25 * k for k in range(10)]              # 図形が 16 分で出る
JUDGE_HITS = [23, 23.5, 24]                                  # 見直し候補 3 件

kick_beats = []
for b in range(BEATS):
    bar = b // 4
    root, chord = BAR_CHORDS[bar]
    in_bar = b % 4

    if (b < 28 and b not in REST) or b == 28:
        add("kick", T(b), kick())
        kick_beats.append(b)
    if in_bar in (1, 3) and b < 28 and b not in REST:
        add("clap", T(b), clap())
    if b not in REST and b < 28:
        add("hat", T(b + 0.5), hat())
        if 6 <= b < 8 or 16 <= b < 18:            # ビルド: 16 分刻みに
            add("hat", T(b + 0.25), hat(110), 0.6)
            add("hat", T(b + 0.75), hat(110), 0.6)
    if b >= 28:
        add("hat", T(b + 0.5), hat(90), 0.35)
    if b not in REST and b < 26:
        for k in range(2):
            pattern = [1, 1, 2, 1, 1, 2, 1, 1][(in_bar * 2 + k) % 8]
            add("bass", T(b + 0.5 * k), bass(note(root) * pattern, BEAT * 0.5))
    if 26 <= b < 28 and b % 2 == 0:
        add("bass", T(b), bass(note(root), BEAT * 2))

# COUNT A: サブスク 1→10（ペンタトニックで上がっていく）
penta = ["A4", "C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6", "G6"]
for hit, n in zip(COUNT_A_HITS, penta):
    add("tone", T(hit), blip(note(n)))
add("fx", T(4), swish(), 0.8)                                # 赤→黄 ワイプ

# B: 無音 → tick → 月額 → スラム
add("fx", T(9), tick(), 0.9)
add("fx", T(9), riser(BEAT), 0.6)
add("fx", T(10), crash(), 0.55)
add("pad", T(10), chord_stab([note(n) for n in BAR_CHORDS[2][1]]), 1.0)
add("tone", T(10.5), pop(520), 0.8)
add("tone", T(11), blip(note("G5")), 0.5)
add("tone", T(11.5), blip(note("C6")), 0.5)

# C: 1→12 ヶ月（A マイナースケールで上昇）
scale = ["A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6", "D6", "E6"]
for hit, n in zip(COUNT_C_HITS, scale):
    add("tone", T(hit), blip(note(n), 0.16), 0.9)
add("fx", T(12), swish(), 0.8)
add("fx", T(16), riser(BEAT * 2), 0.7)
add("fx", T(18), crash(), 0.6)
add("pad", T(18), chord_stab([note(n) for n in BAR_CHORDS[4][1]], d=0.9), 1.1)
add("tone", T(18.5), pop(440), 0.8)
add("tone", T(19), blip(note("E5")), 0.5)
add("tone", T(19.5), blip(note("A5")), 0.5)

# D: 図形 10 個 → 見直し候補 3 件
add("fx", T(20), swish(), 0.8)
for k, hit in enumerate(SHAPE_HITS):
    add("tone", T(hit), pop(380 + 40 * k), 0.7)
for hit, n in zip(JUDGE_HITS, ["E4", "C4", "A3"]):
    add("tone", T(hit), bong(note(n)), 0.8)
add("fx", T(25), swish(0.22), 0.7)

# E1: なんとなく払い、→ 打ち消し線 → 卒業。
add("pad", T(26), chord_stab([note(n) for n in BAR_CHORDS[6][1]], d=0.5), 0.9)
add("fx", T(26.5), swish(0.12), 0.9)
add("fx", T(27), crash(), 0.6)
add("pad", T(27), chord_stab([note(n) for n in BAR_CHORDS[6][1]], d=0.5, cutoff=3200), 1.0)

# E2: タイトル
add("fx", T(28), crash(2.2), 0.5)
pad_t = tt(DURATION - T(28))
pad = sum(saw(note(n), pad_t) + saw(note(n) * 1.005, pad_t) for n in BAR_CHORDS[7][1]) / 8
pad = bw_filter(pad, hi=1400) * np.minimum(1, pad_t / 0.01) * np.exp(-pad_t * 1.1)
add("pad", T(28), pad, 1.0)
add("tone", T(28.5), pop(660), 0.6)
for k, hit in enumerate([29, 29.25, 29.5]):
    add("tone", T(hit), pop(520 + 120 * k), 0.5)
add("fx", T(30), tick(), 0.5)

# ---------------------------------------------------------------------------
# Mix
# ---------------------------------------------------------------------------
t_all = np.arange(N) / SR
duck = np.ones(N)
for b in kick_beats:
    m = t_all >= T(b)
    duck[m] -= 0.55 * np.exp(-(t_all[m] - T(b)) * 11)
duck = np.clip(duck, 0.3, 1)

gains = {"kick": 0.95, "clap": 0.45, "hat": 0.22, "bass": 0.42,
         "tone": 0.24, "fx": 0.32, "pad": 0.30}
mix = np.zeros(N)
for k, sig in tracks.items():
    s = sig * gains[k]
    if k in ("bass", "pad"):
        s = s * duck
    mix += s

mix = bw_filter(mix, lo=28)
mix = np.tanh(1.15 * mix) / np.tanh(1.15)
mix *= 0.89 / np.max(np.abs(mix))
fade = int(0.35 * SR)
mix[-fade:] *= np.linspace(1, 0, fade) ** 1.5

pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
stereo = np.repeat(pcm[:, None], 2, axis=1)
with wave.open(str(HERE / "audio.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())

# ---------------------------------------------------------------------------
# 書き出した音を解析して、キックの実測位置を取る（低域エネルギーの立ち上がり）
# ---------------------------------------------------------------------------
low = bw_filter(mix, hi=140, order=4)
hop = 48                                           # 1 ms
env = np.sqrt(np.convolve(low ** 2, np.ones(hop) / hop, mode="same"))[::hop]
measured = []
for b in kick_beats:
    c = int(T(b) * 1000)
    lo_i, hi_i = max(0, c - 40), min(len(env) - 1, c + 60)
    win = env[lo_i:hi_i]
    peak = win.max()
    onset_ms = lo_i + int(np.argmax(win >= peak * 0.5))
    measured.append({
        "beat": b,
        "grid": round(T(b), 4),
        "measured": round(onset_ms / 1000, 3),
        "devMs": round(onset_ms - T(b) * 1000, 1),
    })

items = [
    {"category": c, "price": p, "freq": f, "score": cancel_score(p, f)}
    for c, p, f in SAMPLE
]
monthly = sum(p for _, p, _ in SAMPLE)
beatmap = {
    "fps": FPS,
    "framesPerBeat": FRAMES_PER_BEAT,
    "beatSec": BEAT,
    "bpm": round(BPM, 3),
    "beats": BEATS,
    "durationSec": DURATION,
    "totalFrames": TOTAL_FRAMES,
    "sampleRate": SR,
    "kicks": measured,
    "maxKickDevMs": max(abs(k["devMs"]) for k in measured),
    "data": {
        "items": items,
        "monthly": monthly,
        "yearly": monthly * 12,
    },
}
(HERE / "beatmap.json").write_text(json.dumps(beatmap, ensure_ascii=False, indent=2))
print(f"audio.wav {DURATION}s @ {BPM:.3f} BPM / beat {BEAT:.4f}s")
print(f"monthly ¥{monthly:,}  yearly ¥{monthly * 12:,}")
print("scores:", [(i['category'], i['score']) for i in items])
print(f"kicks measured: {len(measured)}  max deviation {beatmap['maxKickDevMs']} ms")
