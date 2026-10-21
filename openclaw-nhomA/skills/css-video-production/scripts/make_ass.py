#!/usr/bin/env python3
"""Build an ASS subtitle file from a scenes JSON spec (short lines, keyword highlight, dot-milliseconds)."""
import argparse, json, re, shutil, subprocess, sys
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


def kich_thuoc(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0:s=x", str(path)], capture_output=True, text=True)
    try:
        w, h = r.stdout.strip().split("x")[:2]
        return int(w), int(h)
    except ValueError:
        return None


def font_co_san(font):
    """Font không có trên máy thì libass lặng lẽ thay font khác — tiếng Việt dễ vỡ dấu. Báo trước."""
    if not shutil.which("fc-list"):
        return None                       # không kiểm được, đừng báo động giả
    r = subprocess.run(["fc-list", ":", "family"], capture_output=True, text=True)
    return any(font.lower() == f.strip().lower() for line in r.stdout.splitlines() for f in line.split(","))


def ass_time(sec):
    cs = int(round(sec * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"  # DOT before centiseconds, never a comma


def escape(text):
    return text.replace("\\", "／").replace("{", "(").replace("}", ")").replace("\n", " ")


def highlight(words, kw):
    """Tô vàng từ khoá. Trả về (danh sách chữ, đã tô được hay chưa)."""
    if not kw:
        return words, False
    kws = escape(kw).split()
    low = [w.lower().strip(".,!?;:") for w in words]
    target = [k.lower().strip(".,!?;:") for k in kws]
    for i in range(len(words) - len(kws) + 1):
        if low[i:i + len(kws)] == target:
            out = list(words)
            out[i] = "{\\c&H00FFFF&}" + out[i]
            out[i + len(kws) - 1] += "{\\c&HFFFFFF&}"
            return out, True
    return words, False


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
    try:
        spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        die(f"Không đọc được spec {a.spec}: {e}")
    base = Path(a.spec).parent
    canh_bao = []
    # PlayRes phải cùng tỉ lệ với video sẽ in phụ đề, nếu không libass kéo giãn chữ. Thứ tự ưu tiên:
    # width/height khai báo tay > kích thước "video" trong spec > file của cảnh đầu tiên > 1080x1920 (dọc)
    w, h = spec.get("width"), spec.get("height")
    if not (w and h):
        nguon = [spec.get("video")] + [sc.get("file") for sc in spec.get("scenes", [])[:1]]
        for f in filter(None, nguon):
            for cand in (Path(f), base / f):
                if cand.is_file() and (kt := kich_thuoc(cand)):
                    w, h = kt
                    break
            if w and h:
                break
    w, h = w or 1080, h or 1920
    font = spec.get("font", "DejaVu Sans")
    if font_co_san(font) is False:
        canh_bao.append(f"Không thấy font '{font}' trên máy — ffmpeg sẽ thay font khác, dấu tiếng Việt có thể vỡ. "
                        "Cài: sudo apt install -y fonts-dejavu-core, hoặc đổi 'font' trong spec")
    # cỡ chữ mặc định theo cạnh ngắn: 72 cho 1080 chiều ngang dọc, tự co cho video nhỏ/ngang
    size = spec.get("font_size") or max(24, round(min(w, h) * 72 / 1080))
    max_words = int(spec.get("max_words_per_line", 5))
    head = HEADER.format(w=w, h=h, font=font, size=size,
                         outline=spec.get("outline", 4), marginv=spec.get("margin_v", round(h * 260 / 1920)))
    events, offset = [], 0.0
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
            words, to_duoc = highlight(escape(c["text"]).split(), c.get("keyword"))
            if not to_duoc:
                canh_bao.append(f"Cảnh {si + 1}: không tô được từ khoá cho dòng '{c['text'][:40]}'"
                                + (f" (không thấy '{c['keyword']}' trong câu)" if c.get("keyword") else " (thiếu 'keyword')"))
            if len(c["text"].split()) > max_words * 2:
                canh_bao.append(f"Cảnh {si + 1}: dòng '{c['text'][:40]}…' dài {len(c['text'].split())} từ — "
                                f"sẽ thành 3+ hàng chữ, nên tách thành nhiều chunk")
            lines = layout_lines(words, max_words)
            text = "\\N".join(" ".join(l) for l in lines)
            events.append(f"Dialogue: 0,{ass_time(offset + t0)},{ass_time(offset + t1)},Main,,0,0,0,,{text}")
        offset += dur
    Path(a.out).write_text(head + "\n".join(events) + "\n", encoding="utf-8")
    kq = {"ok": True, "file": a.out, "events": len(events), "total_seconds": round(offset, 2), "play_res": [w, h]}
    if canh_bao:
        kq["canh_bao"] = canh_bao
    print(json.dumps(kq, ensure_ascii=False))


if __name__ == "__main__":
    main()
