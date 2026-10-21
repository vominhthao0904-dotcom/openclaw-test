#!/usr/bin/env python3
"""pdf_tools: extract text, locate phrases and crop regions from PDFs.

Backends: poppler (pdftotext / pdftoppm) + Pillow. No network, no PDF modification.
Coordinates: PDF points (1/72 in), origin top-left, as reported by `pdftotext -bbox`.
"""
import argparse, html, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

DEFAULT_OUT = Path(os.environ.get("OPENCLAW_WORKSPACE", Path.home() / ".openclaw" / "workspace")) / ".openclaw" / "pdf-crops"


def die(msg, code=1):
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False), file=sys.stderr)
    sys.exit(code)


def need(binary):
    if not shutil.which(binary):
        die(f"Thiếu '{binary}'. Cài: sudo apt install poppler-utils")


def run(cmd, **kw):
    try:
        return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)
    except subprocess.CalledProcessError as e:
        die(f"{cmd[0]} lỗi: {(e.stderr or '').strip()[:300]}")


def check_pdf(path):
    p = Path(path)
    if not p.is_file():
        die(f"Không thấy file: {path}")
    return str(p)


def page_count(pdf):
    out = run(["pdfinfo", pdf]).stdout if shutil.which("pdfinfo") else ""
    m = re.search(r"^Pages:\s+(\d+)", out, re.M)
    if m:
        return int(m.group(1))
    # fallback: pypdf
    try:
        from pypdf import PdfReader
        return len(PdfReader(pdf).pages)
    except Exception:
        die("Không đọc được số trang (cần pdfinfo hoặc pypdf)")


def parse_pages(spec, total):
    if not spec:
        return list(range(1, total + 1))
    pages = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            pages.update(range(int(a), int(b) + 1))
        elif part:
            pages.add(int(part))
    bad = [p for p in pages if p < 1 or p > total]
    if bad:
        die(f"Trang ngoài phạm vi 1..{total}: {sorted(bad)}")
    return sorted(pages)


def words_on_page(pdf, page):
    """Return (page_w, page_h, words) where words = [(text, x0, y0, x1, y1)] in points."""
    need("pdftotext")
    out = run(["pdftotext", "-bbox", "-f", str(page), "-l", str(page), pdf, "-"]).stdout
    pm = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', out)
    pw, ph = (float(pm.group(1)), float(pm.group(2))) if pm else (595.0, 842.0)
    words = []
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', out):
        x0, y0, x1, y1, t = m.groups()
        words.append((html.unescape(t), float(x0), float(y0), float(x1), float(y1)))
    return pw, ph, words


def norm(s):
    return re.sub(r"\s+", "", s).lower()


def find_phrase(pdf, phrase, pages=None):
    """Find phrase (whitespace/case-insensitive; also matches inside a single word). Bbox in points."""
    total = page_count(pdf)
    target = norm(phrase)
    if not target:
        die("Cụm chữ rỗng")
    hits = []
    for pg in (pages or range(1, total + 1)):
        pw, ph, words = words_on_page(pdf, pg)
        n = len(words)
        for i in range(n):
            acc = ""
            for j in range(i, min(n, i + 40)):
                acc += norm(words[j][0])
                if (j == i and target in acc) or acc == target:
                    seg = words[i:j + 1]
                    hits.append({
                        "page": pg, "page_size": [pw, ph],
                        "bbox": [min(w[1] for w in seg), min(w[2] for w in seg), max(w[3] for w in seg), max(w[4] for w in seg)],
                        "text": " ".join(w[0] for w in seg),
                    })
                    break
                if not target.startswith(acc):
                    break
    return hits


def render_page(pdf, page, dpi, tmpdir):
    need("pdftoppm")
    base = os.path.join(tmpdir, "pg")
    run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(dpi), "-png", pdf, base])
    cands = sorted(Path(tmpdir).glob("pg-*.png"))
    if not cands:
        die("pdftoppm không tạo được ảnh")
    return cands[-1]


def out_path(out, default_name):
    p = Path(out) if out else DEFAULT_OUT / default_name
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def crop_points(pdf, page, box, out, dpi):
    from PIL import Image
    total = page_count(pdf)
    if page < 1 or page > total:
        die(f"Trang ngoài phạm vi 1..{total}")
    pw, ph, _ = words_on_page(pdf, page)
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(pw, x1), min(ph, y1)
    if x1 - x0 < 2 or y1 - y0 < 2:
        die(f"Vùng cắt rỗng sau khi giới hạn trong trang ({pw:.0f}x{ph:.0f} pt)")
    with tempfile.TemporaryDirectory() as td:
        img_path = render_page(pdf, page, dpi, td)
        img = Image.open(img_path)
        s = dpi / 72.0
        crop = img.crop((int(x0 * s), int(y0 * s), int(x1 * s), int(y1 * s)))
        dest = out_path(out, f"{Path(pdf).stem}-p{page}-crop.png")
        crop.save(dest)
    return {"ok": True, "file": str(dest), "page": page, "box_pt": [round(v, 1) for v in (x0, y0, x1, y1)], "size_px": list(crop.size)}


def cmd_info(a):
    pdf = check_pdf(a.pdf)
    total = page_count(pdf)
    pw, ph, _ = words_on_page(pdf, 1)
    print(json.dumps({"ok": True, "file": pdf, "pages": total, "page1_size_pt": [pw, ph]}, ensure_ascii=False))


def cmd_text(a):
    pdf = check_pdf(a.pdf)
    need("pdftotext")
    total = page_count(pdf)
    pages = parse_pages(a.pages, total)
    chunks = []
    for pg in pages:
        t = run(["pdftotext", "-layout", "-f", str(pg), "-l", str(pg), pdf, "-"]).stdout
        chunks.append(f"=== Trang {pg} ===\n{t.strip()}")
    text = "\n\n".join(chunks)
    if not text.replace("=", "").strip():
        print("(Không có lớp chữ: có thể là PDF scan. Dùng page-shot rồi đọc ảnh/OCR.)", file=sys.stderr)
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(text, encoding="utf-8")
        print(json.dumps({"ok": True, "file": a.out, "chars": len(text)}, ensure_ascii=False))
    else:
        print(text)


def cmd_find(a):
    pdf = check_pdf(a.pdf)
    pages = parse_pages(a.pages, page_count(pdf)) if a.pages else None
    hits = find_phrase(pdf, a.phrase, pages)
    print(json.dumps({"ok": True, "phrase": a.phrase, "matches": len(hits), "hits": [dict(h, index=i) for i, h in enumerate(hits)]}, ensure_ascii=False, indent=2))


def cmd_page_shot(a):
    pdf = check_pdf(a.pdf)
    total = page_count(pdf)
    if a.page < 1 or a.page > total:
        die(f"Trang ngoài phạm vi 1..{total}")
    with tempfile.TemporaryDirectory() as td:
        img = render_page(pdf, a.page, a.dpi, td)
        dest = out_path(a.out, f"{Path(pdf).stem}-p{a.page}.png")
        shutil.copyfile(img, dest)
    print(json.dumps({"ok": True, "file": str(dest), "page": a.page, "dpi": a.dpi}, ensure_ascii=False))


def cmd_crop(a):
    pdf = check_pdf(a.pdf)
    try:
        box = [float(v) for v in a.box.split(",")]
        assert len(box) == 4
    except Exception:
        die("--box phải dạng x0,y0,x1,y1 (điểm PDF)")
    print(json.dumps(crop_points(pdf, a.page, box, a.out, a.dpi), ensure_ascii=False))


def cmd_crop_text(a):
    pdf = check_pdf(a.pdf)
    pages = parse_pages(a.pages, page_count(pdf)) if a.pages else None
    hits = find_phrase(pdf, a.phrase, pages)
    if not hits:
        die(f"Không tìm thấy '{a.phrase}' trong PDF (PDF scan? thử page-shot)")
    if a.match >= len(hits):
        die(f"--match {a.match} vượt quá số kết quả ({len(hits)})")
    h = hits[a.match]
    pw, ph = h["page_size"]
    x0, y0, x1, y1 = h["bbox"]
    box_x0 = (x0 - a.left) if a.left is not None else 0
    box_x1 = (x1 + a.right) if a.right is not None else pw
    box_y0 = y0 - (a.above or 0)
    box_y1 = y1 + (a.below if a.below is not None else 200)
    box = [box_x0 - a.pad, box_y0 - a.pad, box_x1 + a.pad, box_y1 + a.pad]
    res = crop_points(pdf, h["page"], box, a.out, a.dpi)
    res.update({"matched_text": h["text"], "match_index": a.match, "total_matches": len(hits)})
    print(json.dumps(res, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("info"); s.add_argument("pdf"); s.set_defaults(fn=cmd_info)
    s = sub.add_parser("text"); s.add_argument("pdf"); s.add_argument("--pages"); s.add_argument("--out"); s.set_defaults(fn=cmd_text)
    s = sub.add_parser("find"); s.add_argument("pdf"); s.add_argument("phrase"); s.add_argument("--pages"); s.set_defaults(fn=cmd_find)
    s = sub.add_parser("page-shot"); s.add_argument("pdf"); s.add_argument("--page", type=int, required=True)
    s.add_argument("--out"); s.add_argument("--dpi", type=int, default=150); s.set_defaults(fn=cmd_page_shot)
    s = sub.add_parser("crop"); s.add_argument("pdf"); s.add_argument("--page", type=int, required=True)
    s.add_argument("--box", required=True); s.add_argument("--out"); s.add_argument("--dpi", type=int, default=200); s.set_defaults(fn=cmd_crop)
    s = sub.add_parser("crop-text"); s.add_argument("pdf"); s.add_argument("phrase")
    s.add_argument("--pages"); s.add_argument("--match", type=int, default=0)
    s.add_argument("--above", type=float); s.add_argument("--below", type=float)
    s.add_argument("--left", type=float); s.add_argument("--right", type=float)
    s.add_argument("--pad", type=float, default=8); s.add_argument("--out"); s.add_argument("--dpi", type=int, default=200)
    s.set_defaults(fn=cmd_crop_text)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
