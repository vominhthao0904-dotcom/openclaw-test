#!/usr/bin/env python3
"""Overlay B-roll clips (anti-freeze combo) and burn ASS subtitles onto a main video with ffmpeg."""
import argparse, json, shlex, shutil, subprocess, sys
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


def toc_do_khung(path):
    """fps của video chính. B-roll được đưa về đúng fps này — mặc định cứng 25 làm video 30 fps bị
    giật nhịp ở đoạn chèn."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate",
                        "-of", "default=noprint_wrappers=1:nokey=1", str(path)], capture_output=True, text=True)
    try:
        a, _, b = r.stdout.strip().partition("/")
        fps = float(a) / float(b or 1)
        return round(fps, 3) if 1 <= fps <= 120 else 25
    except (ValueError, ZeroDivisionError):
        return 25


def tim_file(f, base):
    """Đường dẫn trong spec: tuyệt đối, hoặc tương đối so với thư mục hiện tại, hoặc so với thư mục chứa spec
    (giống make_ass.py) — agent hay viết spec cạnh file video rồi chạy từ chỗ khác."""
    p = Path(f).expanduser()
    if p.is_absolute() or p.exists():
        return str(p)
    q = base / p
    return str(q) if q.exists() else str(p)


def co_bo_loc_ass():
    r = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True)
    return any(l.split()[1:2] == ["ass"] for l in r.stdout.splitlines() if l.strip())


def esc_filter_path(p):
    return str(p).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,").replace("[", "\\[").replace("]", "\\]")


FPS_DUNG = {}


def build(spec, main_dur):
    # Mặc định lấy đúng kích thước video chính. Trước đây mặc định cứng 1080x1920 (dọc),
    # nên ghép B-roll vào video ngang là B-roll bị cắt thành dải dọc, lòi nền ra hai bên.
    mw, mh = kich_thuoc(spec["main"])
    W, H, FPS = spec.get("width", mw), spec.get("height", mh), spec.get("fps") or toc_do_khung(spec["main"])
    FPS_DUNG["fps"] = FPS
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
    try:
        spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        die(f"Không đọc được spec {a.spec}: {e}")
    for k in ("main", "out"):
        if k not in spec:
            die(f"Spec thiếu khoá '{k}'")
    base = Path(a.spec).resolve().parent
    spec["main"] = tim_file(spec["main"], base)
    if spec.get("ass"):
        spec["ass"] = tim_file(spec["ass"], base)
    for b in spec.get("broll", []):
        b["file"] = tim_file(b["file"], base)
    out = Path(spec["out"]).expanduser()
    if not out.is_absolute():
        out = base / out
    spec["out"] = str(out)
    # Không bao giờ ghi đè đầu vào: ffmpeg -y đè lên video gốc là mất trắng
    dau_vao = [spec["main"]] + [b["file"] for b in spec.get("broll", [])] + ([spec["ass"]] if spec.get("ass") else [])
    if any(Path(x).resolve() == out.resolve() for x in dau_vao):
        die(f"'out' trùng với file đầu vào ({out.name}) — đặt tên file kết quả khác")
    if spec.get("ass") and not co_bo_loc_ass():
        die("ffmpeg trên máy này không có bộ lọc 'ass' (thiếu libass) nên không in được phụ đề. "
            "Cài bản ffmpeg của Ubuntu: sudo apt install -y ffmpeg")
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
        print(shlex.join(cmd))
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        die("ffmpeg lỗi:\n" + r.stderr[-1500:])
    dur_out = probe(spec["out"])
    kq = {"ok": True, "file": spec["out"], "duration": round(dur_out, 2), "main_duration": round(main_dur, 2),
          "broll": len(spec.get("broll", [])), "fps": FPS_DUNG.get("fps")}
    if abs(dur_out - main_dur) > 0.5:
        kq["canh_bao"] = "Độ dài video ra lệch video chính hơn 0,5 giây — kiểm tra lại bằng qa_grid.sh"
    print(json.dumps(kq, ensure_ascii=False))


if __name__ == "__main__":
    main()
