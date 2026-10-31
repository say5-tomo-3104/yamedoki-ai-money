"""Something Great (Sky) の曲を解析して、映像用の data.json を作る。

    python3 lyric/analyze.py <曲の mp4 か wav>

1. ffmpeg で音を lyric/song.wav（48kHz stereo）に取り出す
2. numpy だけで拍を追う
   - 35〜110Hz のキック帯域のエネルギー立ち上がりを 1ms 単位で計算
   - 動的計画法（Ellis 2007 方式）で 1 拍ずつ追跡（テンポが揺れても追従できる）
   - 各拍を「キックの山が立ち上がった瞬間」に寄せ、
     全帯域のオンセットと区間ごとに照合してズレを補正、最後になめらかにする
3. lyrics.json（元のリリック動画から読み取った歌詞と表示秒数）を拍番号に変換し、
   16 分音符（0.25 拍）に寄せて data.json に書き出す
"""

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view as sw

HERE = Path(__file__).resolve().parent
FPS = 30


def load_audio(src):
    wav = HERE / "song.wav"
    if src.suffix.lower() != ".wav" or src.resolve() != wav:
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
             "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(wav)],
            check=True,
        )
    with wave.open(str(wav)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2).mean(1) / 32768
    return x, sr


def band(x, sr, lo=None, hi=None, lo_order=2, hi_order=4):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    g = np.ones_like(f)
    if hi:
        g /= np.sqrt(1 + (f / hi) ** (2 * hi_order))
    if lo:
        g /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * lo_order))
    return np.fft.irfft(X * g, len(x))


def kick_onset(x, sr):
    """1 ms resolution onset strength of the kick band."""
    low = band(x, sr, lo=35, hi=110)
    hop = sr // 1000
    env = np.sqrt(np.add.reduceat(low ** 2, np.arange(0, len(low), hop)) / hop)
    env = np.convolve(env, np.hanning(9) / np.hanning(9).sum(), "same")
    on = np.maximum(0, np.diff(env, prepend=env[0]))
    return np.convolve(on, np.hanning(15) / np.hanning(15).sum(), "same")


def broadband_flux(x, sr):
    """10 ms resolution spectral flux (log magnitude)."""
    hop, win = sr // 100, 2048
    n = 1 + (len(x) - win) // hop
    out = np.zeros(n)
    prev = None
    w = np.hanning(win)
    for s in range(0, n, 512):                      # chunked to keep memory small
        idx = np.arange(win)[None, :] + hop * np.arange(s, min(n, s + 512))[:, None]
        L = np.log1p(10 * np.abs(np.fft.rfft(x[idx] * w, axis=1)))
        if prev is not None:
            L = np.vstack([prev[None, :], L])
            d = np.maximum(0, np.diff(L, axis=0)).sum(1)
            out[s:s + len(d)] = d
        else:
            d = np.maximum(0, np.diff(L, axis=0)).sum(1)
            out[s + 1:s + 1 + len(d)] = d
        prev = L[-1]
    return np.maximum(0, out - np.convolve(out, np.ones(50) / 50, "same"))


def local_linear(b, half, weighted=False):
    k = np.arange(len(b))
    out = b.copy()
    for i in range(len(b)):
        lo, hi = max(0, i - half), min(len(b), i + half + 1)
        w = np.hanning(hi - lo + 2)[1:-1] if weighted else np.ones(hi - lo)
        A = np.vstack([k[lo:hi], np.ones(hi - lo)]).T * w[:, None]
        m, c = np.linalg.lstsq(A, b[lo:hi] * w, rcond=None)[0]
        out[i] = m * i + c
    return out


def track_beats(on):
    # tempo prior from autocorrelation (0.3–0.7 s)
    d10 = on[: len(on) // 10 * 10].reshape(-1, 10).max(1)
    d10 = d10 - d10.mean()
    ac = np.correlate(d10, d10, "full")[len(d10) - 1:]
    lags = np.arange(30, 70)
    period = lags[np.argmax(ac[lags])] / 100
    # refine prior to 1 ms
    fine = np.arange(period - 0.012, period + 0.012, 0.001)
    sig1 = on / np.percentile(on, 99.5)
    def comb(p):
        ts = np.arange(0, len(on) / 1000 - 1.0, p)
        return max(sig1[np.round((ts + ph) * 1000).astype(int)].mean() for ph in np.arange(0, p, 0.005))
    period = fine[np.argmax([comb(p) for p in fine])]

    fps = 200.0                                     # dynamic programming at 5 ms
    sig = on[: len(on) // 5 * 5].reshape(-1, 5).max(1)
    sig = sig / np.percentile(sig, 99.5)
    P = fps * period
    n = len(sig)
    score = sig.copy()
    back = -np.ones(n, dtype=int)
    taus = np.arange(int(P * 0.75), int(P * 1.33))
    pen = -9 * np.log(taus / P) ** 2
    for t in range(taus[-1], n):
        cand = score[t - taus] + pen
        k = int(np.argmax(cand))
        score[t] = sig[t] + cand[k]
        back[t] = t - taus[k]
    end = int(np.argmax(score[-int(P * 1.5):])) + n - int(P * 1.5)
    path = [end]
    while back[path[-1]] >= 0:
        path.append(back[path[-1]])
    return np.array(path[::-1]) / fps, period


def refine(beats, on, flux):
    b = local_linear(beats, 4)
    # 1) move each beat to the start of its kick hump (25 % of the hump peak)
    st = []
    for t in b:
        c = int(t * 1000)
        lo, hi = max(0, c - 280), min(len(on) - 1, c + 30)
        seg = on[lo:hi]
        pk = int(np.argmax(seg))
        j = pk
        while j > 0 and seg[j] > seg[pk] * 0.25:
            j -= 1
        st.append((lo + j) / 1000)
    b = local_linear(np.array(st), 6)
    # 2) per-section check against broadband onsets: their peak should sit 50 ms before the line
    #    (flux frames are stamped at the window start, so -50 ms here = the audible attack)
    corr = np.zeros(len(b))
    for i in range(len(b)):
        prof = np.zeros(31)
        for t in b[max(0, i - 8):i + 9]:
            c = int(round(t * 100))
            if c - 20 >= 0 and c + 11 <= len(flux):
                prof += flux[c - 20:c + 11]
        corr[i] = ((np.argmax(prof) - 20) * 10 + 50) / 1000
    corr = np.array([np.median(corr[max(0, i - 6):i + 7]) for i in range(len(corr))])
    b = b + corr
    for _ in range(2):
        b = local_linear(b, 8, weighted=True)
    return b


def downbeat_phase(x, sr, beats):
    """Bar phase = beat phase where the harmony changes the most."""
    feats = []
    for i in range(len(beats) - 1):
        s, e = int(beats[i] * sr) + int(0.05 * sr), int(beats[i + 1] * sr)
        seg = x[s:e]
        if len(seg) < 2048:
            feats.append(np.zeros(12))
            continue
        S = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
        f = np.fft.rfftfreq(len(seg), 1 / sr)
        m = (f > 80) & (f < 2000)
        pc = np.round(12 * np.log2(f[m] / 440)).astype(int) % 12
        c = np.bincount(pc, weights=S[m] ** 2, minlength=12)
        feats.append(c / (c.sum() + 1e-9))
    F = np.array(feats)
    nov = np.r_[0, np.linalg.norm(np.diff(F, axis=0), axis=1)]
    return int(np.argmax([nov[p::4].mean() for p in range(4)]))


def to_beat(sec, beats):
    k = np.arange(len(beats))
    if sec <= beats[0]:
        return (sec - beats[0]) / (beats[1] - beats[0])
    if sec >= beats[-1]:
        return len(beats) - 1 + (sec - beats[-1]) / (beats[-1] - beats[-2])
    return float(np.interp(sec, beats, k))


def snap(b, q=0.25):
    return round(b / q) * q


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "song.wav"
    x, sr = load_audio(src)
    duration = len(x) / sr
    on = kick_onset(x, sr)
    flux = broadband_flux(x, sr)
    raw, period = track_beats(on)
    beats = refine(raw, on, flux)
    phase = downbeat_phase(x, sr, beats)
    checks = []
    for a in range(0, int(duration), 30):
        sel = beats[(beats >= a) & (beats < a + 30)]
        prof = np.zeros(41)
        for t in sel:
            c = int(round(t * 100))
            if c - 20 >= 0 and c + 21 <= len(flux):
                prof += flux[c - 20:c + 21]
        checks.append(f"{a}s:{(np.argmax(prof) - 20) * 10:+d}ms")
    print("onset check (expect -50ms):", " ".join(checks))
    ibi = np.diff(beats)

    lyr = json.loads((HERE / "lyrics.json").read_text())
    phrases = []
    for p in lyr["phrases"]:
        groups = []
        for g in p["groups"]:
            words = g["w"].split()
            b0 = snap(to_beat(g["t"], beats))
            groups.append({**g, "words": words, "beat": b0, "sec": round(g["t"], 3)})
        phrases.append({**p, "groups": groups, "start": groups[0]["beat"]})
    for i, p in enumerate(phrases):
        p["end"] = phrases[i + 1]["start"] if i + 1 < len(phrases) else to_beat(duration, beats)

    data = {
        "fps": FPS,
        "durationSec": round(duration, 4),
        "totalFrames": int(round(duration * FPS)),
        "bpm": round(60 / float(np.median(ibi)), 2),
        "beats": [round(float(t), 4) for t in beats],
        "downbeatPhase": phase,
        "title": lyr["title"],
        "phrases": phrases,
    }
    (HERE / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"duration {duration:.2f}s  beats {len(beats)}  prior {60 / period:.2f} BPM  "
          f"median {data['bpm']} BPM  ibi {ibi.min() * 1000:.0f}-{ibi.max() * 1000:.0f} ms  downbeat phase {phase}")
    print(f"phrases {len(phrases)}  words {sum(len(g['words']) for p in phrases for g in p['groups'])}")


if __name__ == "__main__":
    main()
