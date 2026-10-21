#!/usr/bin/env python3
"""Fill image_path for slides that need a photo, using the Pexels API (licensed stock) – one distinct photo per slide.

Slides keep their own image_path/image_url if already set. No scraping of Google/Pinterest.
Key: PEXELS_API_KEY env or ~/.openclaw/secrets/pexels.env (line PEXELS_API_KEY=...).
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request, urllib.error
from pathlib import Path

HOME = Path(os.environ.get("OPENCLAW_HOME", Path.home() / ".openclaw"))
API = os.environ.get("PEXELS_API_BASE", "https://api.pexels.com/v1").rstrip("/")
IMAGE_LAYOUTS = {"split", "split-left", "split-right", "center", "statement"}
MAX_BYTES = 15 * 1024 * 1024


def api_key():
    k = os.environ.get("PEXELS_API_KEY", "").strip()
    f = HOME / "secrets" / "pexels.env"
    if not k and f.is_file():
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("PEXELS_API_KEY="):
                k = line.split("=", 1)[1].strip().strip("'\"")
    if not k:
        sys.exit("Thiếu PEXELS_API_KEY (biến môi trường hoặc ~/.openclaw/secrets/pexels.env). Có thể bỏ qua bước này nếu người dùng tự cung cấp ảnh (image_path).")
    return k


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "image"


def search(key, query):
    url = f"{API}/search?" + urllib.parse.urlencode({"query": query, "per_page": 15, "orientation": "landscape", "size": "large"})
    req = urllib.request.Request(url, headers={"Authorization": key, "User-Agent": "pptx-deck-builder/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode()).get("photos", [])
    except urllib.error.HTTPError as e:
        sys.exit(f"Pexels HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:200]}")


def score(p):
    w, h, src = int(p.get("width") or 0), int(p.get("height") or 0), p.get("src") or {}
    return (w >= 1600) * 3 + (h >= 900) * 2 + (w > h) * 2 + bool(src.get("large2x")) * 2


def download(url, dest):
    host = urllib.parse.urlparse(url)
    if host.scheme != "https" or not (host.hostname or "").endswith("pexels.com"):
        raise ValueError("chỉ tải ảnh từ pexels.com qua https")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "pptx-deck-builder/1.0"}), timeout=60) as r:
        data = r.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES or len(data) < 1000:
        raise ValueError("kích thước ảnh bất thường")
    dest.write_bytes(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--assets-dir", required=True)
    a = ap.parse_args()
    data = json.loads(Path(a.input).read_text(encoding="utf-8"))
    slides = data["slides"] if isinstance(data, dict) and "slides" in data else data
    assets = Path(a.assets_dir)
    assets.mkdir(parents=True, exist_ok=True)
    key = None
    used_ids, credits, missing = set(), [], []
    for i, s in enumerate(slides, 1):
        if (s.get("layout") or "").strip().lower() not in IMAGE_LAYOUTS or s.get("image_path") or s.get("image_url"):
            continue
        query = (s.get("image_query") or s.get("title") or "").strip()
        if not query:
            missing.append(i)
            continue
        key = key or api_key()
        photos = [p for p in search(key, query) if p.get("id") not in used_ids]
        if not photos:
            missing.append(i)
            continue
        pick = max(photos, key=score)
        used_ids.add(pick["id"])
        src = pick.get("src") or {}
        url = src.get("large2x") or src.get("large") or src.get("original")
        dest = assets / f"slide{i:02d}-{slug(query)}.jpg"
        try:
            download(url, dest)
        except Exception as e:
            print(f"[CẢNH BÁO] slide {i}: tải ảnh lỗi: {e}", file=sys.stderr)
            missing.append(i)
            continue
        s["image_path"] = str(dest)
        credits.append({"slide": i, "query": query, "photographer": pick.get("photographer"), "page_url": pick.get("url"), "file": str(dest)})
    Path(a.output).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    (assets / "credits.json").write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "output": a.output, "images": len(credits), "slides_without_image": missing, "credits": str(assets / "credits.json")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
