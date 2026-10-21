#!/usr/bin/env python3
"""Build an ASS subtitle file from a scenes JSON spec (short lines, keyword highlight, dot-milliseconds)."""
import argparse, json, re, subprocess, sys
from pathlib import Path

HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{font},{size},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,{outline},0,2,80,80,{marginv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def die(msg):
    sys.exit(f"[make_ass] {msg}")


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        die(f"ffprobe không đọc được độ dài: {path}")


def ass_time(sec):
    cs = int(round(sec * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"  # DOT before centiseconds, never a comma


def escape(text):
    return text.replace("\\", "／").replace("{", "(").replace("}", ")").replace("\n", " ")


def highlight(words, kw):
    if not kw:
        return words
    kws = escape(kw).split()
    low = [w.lower().strip(".,!?;:") for w in words]
    target = [k.lower().strip(".,!?;:") for k in kws]
    for i in range(len(words) - len(kws) + 1):
        if low[i:i + len(kws)] == target:
            out = list(words)
            out[i] = "{\\c&H00FFFF&}" + out[i]
            out[i + len(kws) - 1] += "{\\c&HFFFFFF&}"
            return out
    return words


def layout_lines(words, max_words):
    n = len(words)
    if n <= max_words:
        return [words]
    lines = -(-n // max_words)
    size = -(-n // lines)
    return [words[i:i + size] for i in range(0, n, size)]


def resolve_times(chunks, dur, scene_no):
    """Giờ bắt đầu/kết thúc cho từng chunk trong một cảnh.

    Chunk có 'start'/'end' thì giữ nguyên. Chunk không có thì chia **thời gian còn trống**
    giữa hai mốc cố định gần nhất theo độ dài chữ, nên trộn hai kiểu vẫn không tràn khỏi cảnh.
    """
    n = len(chunks)
    if not n:
        die(f"Scene {scene_no}: không có chunk nào")
    fixed = [None] * n
    for i, c in enumerate(chunks):
        if "start" in c and "end" in c:
            t0, t1 = float(c["start"]), float(c["end"])
            if t1 <= t0:
                die(f"Scene {scene_no}, chunk {i + 1}: end phải lớn hơn start ({t0:.2f}-{t1:.2f})")
            if t0 < -0.001 or t1 > dur + 0.05:
                die(f"Scene {scene_no}, chunk {i + 1}: {t0:.2f}-{t1:.2f}s nằm ngoài cảnh dài {dur:.2f}s")
            fixed[i] = (t0, t1)
    times = [None] * n
    i = 0
    cursor = 0.0
    while i < n:
        if fixed[i]:
            if fixed[i][0] < cursor - 0.05:
                die(f"Scene {scene_no}, chunk {i + 1}: bắt đầu {fixed[i][0]:.2f}s chồng lên chunk trước (kết thúc {cursor:.2f}s)")
            times[i] = fixed[i]
            cursor = fixed[i][1]
            i += 1
            continue
        j = i                                     # gom các chunk liên tiếp chưa có mốc thời gian
        while j < n and not fixed[j]:
            j += 1
        window_end = fixed[j][0] if j < n else dur
        span = window_end - cursor
        if span <= 0.01:
            die(f"Scene {scene_no}: không còn thời gian cho chunk {i + 1}-{j} (từ {cursor:.2f}s tới {window_end:.2f}s)")
        weights = [max(1, len(chunks[k]["text"])) for k in range(i, j)]
        total = sum(weights)
        t = cursor
        for k, wt in zip(range(i, j), weights):
            t_next = t + span * wt / total
            times[k] = (t, t_next)
            t = t_next
        cursor = window_end
        i = j
    return times


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    w, h = spec.get("width", 1080), spec.get("height", 1920)
    max_words = int(spec.get("max_words_per_line", 5))
    head = HEADER.format(w=w, h=h, font=spec.get("font", "DejaVu Sans"), size=spec.get("font_size", 72),
                         outline=spec.get("outline", 4), marginv=spec.get("margin_v", 260))
    events, offset = [], 0.0
    base = Path(a.spec).parent
    for si, scene in enumerate(spec["scenes"]):
        f = scene.get("file")
        if scene.get("duration") is not None:
            dur = float(scene["duration"])
        elif f and (base / f).exists():
            dur = duration(base / f)
        elif f and Path(f).exists():
            dur = duration(f)
        else:
            die(f"Scene {si + 1}: thiếu 'duration' và không thấy file {f}")
        chunks = scene["chunks"]
        times = resolve_times(chunks, dur, si + 1)
        for c, (t0, t1) in zip(chunks, times):
            words = highlight(escape(c["text"]).split(), c.get("keyword"))
            lines = layout_lines(words, max_words)
            text = "\\N".join(" ".join(l) for l in lines)
            events.append(f"Dialogue: 0,{ass_time(offset + t0)},{ass_time(offset + t1)},Main,,0,0,0,,{text}")
        offset += dur
    Path(a.out).write_text(head + "\n".join(events) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "file": a.out, "events": len(events), "total_seconds": round(offset, 2)}))


if __name__ == "__main__":
    main()
