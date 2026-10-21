#!/usr/bin/env python3
"""Overlay B-roll clips (anti-freeze combo) and burn ASS subtitles onto a main video with ffmpeg."""
import argparse, json, shutil, subprocess, sys
from pathlib import Path


def die(msg):
    sys.exit(f"[compose] {msg}")


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        die(f"Không đọc được file video: {path}")


def kich_thuoc(path):
    """Kích thước khung hình của video. B-roll phải khớp video chính, nếu không
    nó bị cắt thành dải lệch khuôn và lòi video chính ra quanh viền."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", str(path)],
                       capture_output=True, text=True)
    try:
        w, h = r.stdout.strip().split("x")[:2]
        return int(w), int(h)
    except ValueError:
        die(f"Không đọc được kích thước khung hình: {path}")


def esc_filter_path(p):
    return str(p).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,").replace("[", "\\[").replace("]", "\\]")


def build(spec, main_dur):
    # Mặc định lấy đúng kích thước video chính. Trước đây mặc định cứng 1080x1920 (dọc),
    # nên ghép B-roll vào video ngang là B-roll bị cắt thành dải dọc, lòi nền ra hai bên.
    mw, mh = kich_thuoc(spec["main"])
    W, H, FPS = spec.get("width", mw), spec.get("height", mh), spec.get("fps", 25)
    inputs, parts, last = ["-i", spec["main"]], [], "0:v"
    if spec.get("normalize_main"):
        parts.append(f"[0:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}[m0]")
        last = "m0"
    for i, b in enumerate(spec.get("broll", []), start=1):
        f, start, dur = b["file"], float(b["start"]), float(b["duration"])
        if not Path(f).is_file():
            die(f"Không thấy B-roll: {f}")
        if dur <= 0 or start < 0 or start + dur > main_dur + 0.05:
            die(f"B-roll {i}: khoảng {start}-{start + dur}s vượt độ dài video chính ({main_dur:.2f}s)")
        if probe(f) < dur - 0.05:
            die(f"B-roll {i}: clip ngắn hơn thời lượng chèn ({dur}s)")
        inputs += ["-i", f]
        # combo anti-freeze: trim + setpts shifted to the insertion time + overlay eof_action=pass
        parts.append(f"[{i}:v]fps={FPS},trim=0:{dur},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setpts=PTS-STARTPTS+{start}/TB[b{i}]")
        out = f"t{i}"
        parts.append(f"[{last}][b{i}]overlay=enable='between(t,{start},{start + dur})':eof_action=pass[{out}]")
        last = out
    if spec.get("ass"):
        parts.append(f"[{last}]ass='{esc_filter_path(spec['ass'])}'[vout]")
        last = "vout"
    return inputs, parts, last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not shutil.which("ffmpeg"):
        die("Thiếu ffmpeg")
    spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    for k in ("main", "out"):
        if k not in spec:
            die(f"Spec thiếu khoá '{k}'")
    if not Path(spec["main"]).is_file():
        die(f"Không thấy video chính: {spec['main']}")
    if spec.get("ass") and not Path(spec["ass"]).is_file():
        die(f"Không thấy file phụ đề: {spec['ass']}")
    main_dur = probe(spec["main"])
    inputs, parts, last = build(spec, main_dur)
    cmd = ["ffmpeg", "-y", *inputs]
    if parts:
        cmd += ["-filter_complex", ";".join(parts), "-map", f"[{last}]"]
    else:
        cmd += ["-map", "0:v"]
    cmd += ["-map", "0:a?", "-c:v", "libx264", "-crf", str(spec.get("crf", 26)), "-preset", spec.get("preset", "fast"), "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", spec["out"]]
    if a.dry_run:
        print(" ".join(repr(c) if " " in c or "[" in c else c for c in cmd))
        return
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        die("ffmpeg lỗi:\n" + r.stderr[-1500:])
    print(json.dumps({"ok": True, "file": spec["out"], "duration": round(probe(spec["out"]), 2), "broll": len(spec.get("broll", []))}))


if __name__ == "__main__":
    main()
