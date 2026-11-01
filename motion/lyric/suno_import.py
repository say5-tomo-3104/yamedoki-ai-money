"""Suno MCP で作った曲のデータから、映像用の data.json を作る。

    python3 lyric/suno_import.py songs/<フォルダ名>

フォルダに置くもの（Suno MCP の結果を加工せずに保存したもの）:
    audio_analysis.json    … audio-analysis の結果（拍・小節の位置・テンポ・構成）
    lyrics_alignment.json  … audio-lyrics-alignment の結果（単語ごとの歌われる時刻）
    song.mp3 か song.wav   … audio-download で保存した曲（書き出しに使う。data.json 作成には不要）
    meta.json（任意）      … {"title": "...", "small": "...", "big": "...", "tail": "..."} 最後のタイトル画面の文字
                             "motions": {"verse": [9, 11], "chorus": [14], "outro": [16]} 区間ごとに動きを番号で指定
                             （その区間の行に順番に割り当てる）、"lineMotions": {"HEY LOOK AT US": 11} 行ごとの指定

動きの番号（「Opus 5.5 Motion Graphics」の一覧の番号）:
    09 mask（輪郭がせり上がって塗られる）  10 elastic（伸ばして歌う語が伸び縮み）
    11 relayout（1 行の文がキーワード中心に組み変わる）  14 focus（区間の歌詞を並べ、歌っている行だけくっきり）
    16 particle（粒が集まってキーワードになる）

やること:
- 拍と小節の頭は audio-analysis をそのまま使う（推定しない）
- 歌詞は 1 行を 1 場面にし、単語は lyrics-alignment の実測時刻で出す
- 見せ方（テンプレート）は行の長さと言葉から自動で選ぶ。サビの頭はフラッシュ、区切りはワイプ
- 歌のない 2 小節以上の区間には「間奏」の場面、最後に余白があればタイトル画面を入れる
"""

import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import to_beat  # noqa: E402  (same beat/second conversion as the hand-made version)

FPS = 30
MOTION = {9: "mask", 10: "elastic", 11: "relayout", 14: "focus", 16: "particle"}
PALETTE = ["blue", "yellow", "red", "cream", "ink"]
DECO = {
    "LIGHT": "light", "SHINE": "light", "BRIGHT": "light", "SUN": "light",
    "STAR": "star", "STARS": "star",
    "STEP": "stairs", "STEPS": "stairs", "HIGHER": "stairs",
    "SING": "eq", "SOUND": "eq", "MUSIC": "eq", "SONG": "eq", "DANCE": "eq",
    "GROW": "grow", "BLOOM": "grow",
    "WAY": "arrow", "GO": "arrow", "UP": "arrow", "FLY": "arrow",
    "SPARK": "sparks", "SPARKS": "sparks", "SPARKLE": "sparks", "GLOW": "sparks",
}


def lyric_lines(alignment):
    """Rebuild the lyric text from the aligned tokens and give every word its start/end time.

    Tokens can split a word ("after" + "g" + "low") or carry punctuation, line breaks and
    section headers ("\\n\\n[Chorus]\\nHey"), so the text is reassembled first and each word
    takes the time of the token that holds its first / last character.
    """
    chars = []  # (character, start, end, token index)
    toks = alignment["words"]
    for ti, tok in enumerate(toks):
        for ch in tok["word"]:
            chars.append((ch, tok["start_s"], tok["end_s"], ti))
    text = "".join(c[0] for c in chars)

    def word_start(a, b):
        # a word split over tokens whose first piece is a stray 1–2 letters placed far earlier
        # ("He" … 2.6 s … "y, look") takes the time of the piece that follows
        first = chars[a][3]
        if chars[b][3] != first:
            letters = sum(1 for c in chars[a:b + 1] if c[3] == first and c[0].isalpha())
            nxt = next(c for c in chars[a:b + 1] if c[3] != first)
            if letters <= 2 and nxt[1] - toks[first]["end_s"] > 1.0:
                return nxt[1]
        return chars[a][1]

    lines = []
    section = "verse"
    pos = 0
    for raw in text.split("\n"):
        base = pos
        pos += len(raw) + 1
        stripped = raw.strip()
        if not stripped:
            continue
        head = re.fullmatch(r"\[(.+?)\]", stripped)
        if head:
            section = head.group(1).strip()
            continue
        words = []
        for m in re.finditer(r"\S+", raw):
            w = re.sub(r"[^\w'’]", "", m.group()).replace("’", "'").upper()
            if not w:
                continue
            pause = bool(re.search(r"[,;:.!?…—-]$", m.group()))  # punctuation = a natural place to break the line
            # times come from the letters only: punctuation can sit in the next token (", look")
            letters = [base + m.start() + k for k, c in enumerate(m.group()) if c.isalnum() or c in "'’"]
            a, b = letters[0], letters[-1]
            words.append((w, word_start(a, b), chars[b][2], pause))
        if words:
            lines.append({"section": section, "words": words})
    return lines


def split_long(lines, max_words=8):
    out = []
    for ln in lines:
        ws = ln["words"]
        while len(ws) > max_words:
            cut = len(ws) // 2
            out.append({**ln, "words": ws[:cut]})
            ws = ws[cut:]
        out.append({**ln, "words": ws})
    return out


def chunk(ws, size=3):
    """Split at punctuation first, then cut longer pieces into even lines of at most `size` words."""
    pieces, cur = [], []
    for w in ws:
        cur.append(w)
        if w[3]:
            pieces.append(cur)
            cur = []
    if cur:
        pieces.append(cur)
    out = []
    for pc in pieces:
        n = max(1, -(-len(pc) // size))
        sizes = [len(pc) // n + (1 if k < len(pc) % n else 0) for k in range(n)]
        i = 0
        for sz in sizes:
            out.append(pc[i:i + sz])
            i += sz
    return out


def split_point(ws):
    """Index to split a line in two: the punctuation closest to the middle, else the middle."""
    cands = [k + 1 for k, w in enumerate(ws[:-1]) if w[3]]
    mid = len(ws) / 2
    return min(cands, key=lambda h: abs(h - mid)) if cands else len(ws) // 2


def choose_template(ws, i, first_in_section, kind, prev):
    n = len(ws)
    starts = [w[1] for w in ws]
    mean_gap = float(np.mean(np.diff(starts))) if n > 1 else 1.0
    if kind == "chorus" and first_in_section and n >= 4:
        return "two"
    if n <= 3:
        return "stack"
    cycle = ["hero", "boxes", "stack", "giant"]
    for k in range(len(cycle)):
        tpl = cycle[(i + k) % len(cycle)]
        if tpl == prev:
            continue
        if tpl == "giant" and (n > 6 or mean_gap < 0.3):
            continue
        if tpl == "hero" and max(len(w[0]) for w in ws) < 4:
            continue
        return tpl
    return "stack"


def group(ws, beats, role=None, br=False):
    g = {
        "t": round(ws[0][1], 3),
        "w": " ".join(w[0] for w in ws),
        "words": [w[0] for w in ws],
        "sec": round(ws[0][1], 3),
        "beat": round(to_beat(ws[0][1], beats), 4),
        "wordBeats": [round(to_beat(w[1], beats), 4) for w in ws],
        "wordEnds": [round(to_beat(w[2], beats), 4) for w in ws],
    }
    if role:
        g["role"] = role
    if br:
        g["br"] = True
    return g


def lead_hero_tail(ws, beats, hi):
    gs = []
    if hi > 0:
        gs.append(group(ws[:hi], beats, role="lead"))
    gs.append(group(ws[hi:hi + 1], beats, role="hero"))
    if hi + 1 < len(ws):
        gs.append(group(ws[hi + 1:], beats, role="tail"))
    return gs


def build_groups(tpl, ws, beats):
    if tpl in ("elastic", "particle"):
        # the word that is held longest (later one on ties); single letters only if nothing else
        hi = max(range(len(ws)), key=lambda k: (len(ws[k][0]) > 1, ws[k][2] - ws[k][1], k))
        return lead_hero_tail(ws, beats, hi), None
    if tpl == "relayout":
        hi = max(range(len(ws)), key=lambda k: (len(ws[k][0]), k))
        return lead_hero_tail(ws, beats, hi), None
    if tpl == "mask":
        return [group(c, beats) for c in chunk(ws)], None
    if tpl == "two":
        h = split_point(ws)
        return [group(ws[:h], beats), group(ws[h:], beats, br=True)], None
    if tpl == "hero":
        # the longest word becomes the hero (later one on ties)
        hi = max(range(len(ws)), key=lambda k: (len(ws[k][0]), k))
        gs = []
        if hi > 0:
            gs.append(group(ws[:hi], beats, role="lead"))
        gs.append(group(ws[hi:hi + 1], beats, role="hero"))
        if hi + 1 < len(ws):
            gs.append(group(ws[hi + 1:], beats, role="tail"))
        return gs, DECO.get(ws[hi][0])
    if tpl == "stack":
        return [group(c, beats) for c in chunk(ws)], next((DECO[w[0]] for w in ws if DECO.get(w[0]) == "arrow"), None)
    return [group(ws, beats)], None


def audio_duration(folder):
    for name in ("song.wav", "song.mp3"):
        f = folder / name
        if not f.exists():
            continue
        if f.suffix == ".wav":
            with wave.open(str(f)) as w:
                return w.getnframes() / w.getframerate()
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
            capture_output=True, text=True, check=True,
        )
        return float(out.stdout.strip())
    return None


def main():
    folder = Path(sys.argv[1]).resolve()
    analysis = json.loads((folder / "audio_analysis.json").read_text())
    alignment = json.loads((folder / "lyrics_alignment.json").read_text())
    meta = json.loads((folder / "meta.json").read_text()) if (folder / "meta.json").exists() else {}
    if analysis.get("status") != "complete" or alignment.get("status") != "complete":
        sys.exit(f"Suno data not complete yet: analysis={analysis.get('status')} alignment={alignment.get('status')}")

    beats = np.array([b["time_s"] for b in analysis["beats"]])
    bar_pos = [int(b["bar_position"]) for b in analysis["beats"]]
    duration = audio_duration(folder) or float(analysis["duration_s"])
    end_beat = to_beat(duration, beats)

    lines = split_long(lyric_lines(alignment))
    phrases = []
    seen = {}
    prev_tpl = None
    prev_section = None
    used_in_kind = {}
    for i, ln in enumerate(lines):
        ws = ln["words"]
        name = ln["section"]
        kind = re.sub(r"[^a-z]", "", name.lower().split()[0]) if name else "verse"
        first = name != prev_section
        if first:
            seen[kind] = seen.get(kind, 0) + 1
        prev_section = name
        text = " ".join(w[0] for w in ws)
        wanted = meta.get("lineMotions", {}).get(text)
        if wanted is None and kind in meta.get("motions", {}):
            nums = meta["motions"][kind]
            wanted = nums[used_in_kind.get(kind, 0) % len(nums)] if nums else None
        used_in_kind[kind] = used_in_kind.get(kind, 0) + 1
        tpl = MOTION.get(int(wanted)) if wanted is not None else None
        if wanted is not None and tpl is None:
            sys.exit(f"unknown motion number {wanted} (available: {sorted(MOTION)})")
        tpl = tpl or choose_template(ws, i, first, kind, prev_tpl)
        prev_tpl = tpl
        groups, deco = build_groups(tpl, ws, beats)
        start = groups[0]["beat"]
        phrases.append({
            "s": f"{kind} {seen[kind]}",
            "tpl": tpl,
            "groups": groups,
            **({"lines": True} if tpl in ("stack", "mask") else {}),
            "start": start,
            "lastWordEnd": round(to_beat(ws[-1][2], beats), 4),
            **({"deco": deco} if deco else {}),
            **({"enter": "flash" if kind == "chorus" else "wipe"} if first and i > 0 else {}),
        })

    k = 0
    while k < len(phrases):
        if phrases[k]["tpl"] != "focus":
            k += 1
            continue
        j = k
        while j + 1 < len(phrases) and phrases[j + 1]["tpl"] == "focus" and phrases[j + 1]["s"] == phrases[k]["s"]:
            j += 1
        run = phrases[k:j + 1]
        context = [{
            "words": [w for g in p["groups"] for w in g["words"]],
            "beats": [b for g in p["groups"] for b in g["wordBeats"]],
            "ends": [b for g in p["groups"] for b in g["wordEnds"]],
        } for p in run]
        for n, p in enumerate(run):
            p["context"] = context
            p["ctxIndex"] = n
            if n:
                p.pop("enter", None)
        k = j + 1

    # the background cuts a little before the first word, on the eighth-note grid
    for k, p in enumerate(phrases):
        floor = phrases[k - 1]["lastWordEnd"] if k else 0.0
        p["start"] = round(max(floor, np.floor(p["start"] * 2) / 2, p["start"] - 1.0), 4)

    def next_downbeat(after):
        for k, bp in enumerate(bar_pos):
            if bp == 1 and k >= after:
                return k
        return None

    # instrumental passages (2 bars or more without singing), intro and outro
    filled = []
    if phrases and phrases[0]["start"] >= 8:
        filled.append({"s": "intro", "tpl": "inst", "label": "INTRO", "groups": [], "start": 0.0})
    for k, p in enumerate(phrases):
        filled.append(p)
        nxt = phrases[k + 1]["start"] if k + 1 < len(phrases) else end_beat
        db = next_downbeat(int(np.ceil(p["lastWordEnd"] + 1)))
        if db is None or nxt - db < 8:
            continue
        if k + 1 < len(phrases):
            filled.append({"s": "instrumental", "tpl": "inst", "label": "INSTRUMENTAL", "groups": [], "start": float(db)})
        else:
            filled.append({
                "s": "", "tpl": "title", "groups": [], "start": float(db),
                "small": meta.get("small", ""), "big": meta.get("big", meta.get("title", "SUNO")).upper(),
                "tail": meta.get("tail", ""),
            })

    used = None
    for k, p in enumerate(filled):
        p["end"] = filled[k + 1]["start"] if k + 1 < len(filled) else end_beat
        p.pop("lastWordEnd", None)
        bg = PALETTE[k % len(PALETTE)]
        if bg == used:
            bg = PALETTE[(k + 1) % len(PALETTE)]
        if p["tpl"] == "focus" and p.get("ctxIndex"):
            bg = used
        p["bg"] = "cream" if p["tpl"] == "title" else bg
        used = p["bg"]
        if p["tpl"] == "inst":
            p["enter"] = "wipe"

    first_down = next((k for k, bp in enumerate(bar_pos) if bp == 1), 0)
    data = {
        "fps": FPS,
        "durationSec": round(duration, 4),
        "totalFrames": int(round(duration * FPS)),
        "bpm": round(float(analysis.get("bpm") or 60 / np.median(np.diff(beats))), 2),
        "beats": [round(float(t), 4) for t in beats],
        "barPos": bar_pos,
        "downbeatPhase": first_down % 4,
        "countdownTo": round(duration, 3),
        "beatSource": "from Suno audio-analysis",
        "key": analysis.get("key"),
        "title": meta.get("title", folder.name).upper(),
        "source": {"audioId": analysis.get("audio_id")},
        "phrases": filled,
    }
    (folder / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"{folder.name}: {duration:.2f}s  {len(beats)} beats  {data['bpm']} BPM  key {data['key']}")
    for p in filled:
        words = " / ".join(g["w"] for g in p["groups"]) or p.get("label") or p.get("big")
        print(f"  beat {p['start']:6.2f}-{p['end']:6.2f}  {p['tpl']:6s} {p['bg']:6s} {p.get('enter', ''):5s} "
              f"{p['s']:12s} {words}{'  [' + p['deco'] + ']' if p.get('deco') else ''}")


if __name__ == "__main__":
    main()
