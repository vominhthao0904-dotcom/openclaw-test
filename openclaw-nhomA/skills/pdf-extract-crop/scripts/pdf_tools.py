#!/usr/bin/env python3
"""pdf_tools: extract text, locate phrases and crop regions from PDFs.

Backends: poppler (pdftotext / pdftoppm) + Pillow. No network, no PDF modification.
Coordinates: PDF points (1/72 in), origin top-left, as reported by `pdftotext -bbox`.
"""
import argparse, html, json, os, re, shutil, subprocess, sys, tempfile, unicodedata
from pathlib import Path

DPI_MIN, DPI_MAX = 36, 600          # 600 dpi trang A4 đã ~35 triệu điểm ảnh; cao hơn dễ ngốn hết RAM VPS
TEXT_MAX_CHARS = 30000              # `text` không --out: cắt bớt để không đổ cả catalogue vào ngữ cảnh agent
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
    p = Path(path).expanduser()
    if not p.is_file():
        die(f"Không thấy file: {path}")
    # đường dẫn tuyệt đối: tên file bắt đầu bằng "-" không bị poppler hiểu nhầm thành tuỳ chọn
    return str(p.resolve())


def check_dpi(dpi):
    if not DPI_MIN <= dpi <= DPI_MAX:
        die(f"--dpi phải trong khoảng {DPI_MIN}-{DPI_MAX} (đang là {dpi})")
    return dpi


def need_pillow():
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        die("Thiếu Pillow. Cài: python3 -m pip install --user pillow  (hoặc sudo apt install -y python3-pil)")


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
    try:
        for part in spec.split(","):
            part = part.strip()
            if "-" in part:
                a, b = part.split("-", 1)
                pages.update(range(int(a), int(b) + 1))
            elif part:
                pages.add(int(part))
    except ValueError:
        die(f"--pages không hợp lệ: '{spec}' (ví dụ đúng: 3 hoặc 3-5 hoặc 1,4,7-9)")
    bad = [p for p in pages if p < 1 or p > total]
    if bad:
        die(f"Trang ngoài phạm vi 1..{total}: {sorted(bad)}")
    return sorted(pages)


_PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
_WORD_RE = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>')


def words_on_pages(pdf, first, last):
    """Một lần gọi pdftotext cho cả khoảng trang (bản cũ gọi riêng từng trang — catalogue
    300 trang là 300 tiến trình). Trả về {số trang: (rộng, cao, [(chữ, x0, y0, x1, y1)])}."""
    need("pdftotext")
    out = run(["pdftotext", "-bbox", "-f", str(first), "-l", str(last), pdf, "-"]).stdout
    res = {}
    for k, pm in enumerate(_PAGE_RE.finditer(out)):
        words = [(html.unescape(t), float(x0), float(y0), float(x1), float(y1))
                 for x0, y0, x1, y1, t in _WORD_RE.findall(pm.group(3))]
        res[first + k] = (float(pm.group(1)), float(pm.group(2)), words)
    return res


def words_on_page(pdf, page):
    """Return (page_w, page_h, words) where words = [(text, x0, y0, x1, y1)] in points."""
    return words_on_pages(pdf, page, page).get(page, (595.0, 842.0, []))


def norm(s):
    # NFC: PDF tiếng Việt hay lưu dấu ở dạng tách rời (e + dấu sắc), gõ vào lại là dạng dựng sẵn (é)
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", s)).lower()


def _khop_trang(words, target):
    """Mọi vị trí cụm chữ trên một trang.

    Nối chữ của cả trang thành một chuỗi (bỏ khoảng trắng) kèm bảng ký tự -> chữ thứ mấy, rồi tìm
    chuỗi con. Nhờ vậy khớp được cả khi cụm chữ dính dấu câu ("HA1600," / "(HA1600)"), nằm giữa
    một chữ dài, hay vắt qua nhiều chữ.
    """
    chuoi, chu_thu = [], []
    for i, w in enumerate(words):
        t = norm(w[0])
        chuoi.append(t)
        chu_thu.extend([i] * len(t))
    chuoi = "".join(chuoi)
    ra, pos = [], chuoi.find(target)
    while pos != -1:
        ra.append((chu_thu[pos], chu_thu[pos + len(target) - 1]))
        pos = chuoi.find(target, pos + len(target))
    return ra


def find_phrase(pdf, phrase, pages=None):
    """Find phrase (whitespace/case-insensitive, Unicode-normalised; also matches inside a word). Bbox in points."""
    total = page_count(pdf)
    target = norm(phrase)
    if not target:
        die("Cụm chữ rỗng")
    pages = sorted(pages or range(1, total + 1))
    hits = []
    # gom các trang liền nhau thành từng khoảng để gọi pdftotext ít lần nhất
    khoang, dau = [], pages[0]
    for a, b in zip(pages, pages[1:] + [None]):
        if b != a + 1:
            khoang.append((dau, a))
            dau = b
    for first, last in khoang:
        for pg, (pw, ph, words) in sorted(words_on_pages(pdf, first, last).items()):
            for i, j in _khop_trang(words, target):
                seg = words[i:j + 1]
                hits.append({
                    "page": pg, "page_size": [pw, ph],
                    "bbox": [min(w[1] for w in seg), min(w[2] for w in seg), max(w[3] for w in seg), max(w[4] for w in seg)],
                    "text": " ".join(w[0] for w in seg),
                })
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
    need_pillow()
    from PIL import Image
    check_dpi(dpi)
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
        with Image.open(img_path) as img:
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
    if not re.sub(r"=== Trang \d+ ===", "", text).strip():
        print("(Không có lớp chữ: có thể là PDF scan. Dùng page-shot rồi đọc ảnh/OCR.)", file=sys.stderr)
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(text, encoding="utf-8")
        print(json.dumps({"ok": True, "file": a.out, "chars": len(text), "pages": len(pages)}, ensure_ascii=False))
    elif a.max_chars and len(text) > a.max_chars:
        print(text[:a.max_chars])
        print(f"\n[… đã cắt: còn {len(text) - a.max_chars} ký tự. Thu hẹp bằng --pages, "
              "tìm đúng chỗ bằng find, hoặc ghi ra file bằng --out rồi đọc từng phần]")
    else:
        print(text)


def cmd_find(a):
    pdf = check_pdf(a.pdf)
    pages = parse_pages(a.pages, page_count(pdf)) if a.pages else None
    hits = find_phrase(pdf, a.phrase, pages)
    res = {"ok": True, "phrase": a.phrase, "matches": len(hits),
           "pages_with_matches": sorted({h["page"] for h in hits}),
           "hits": [dict(h, index=i) for i, h in enumerate(hits[:a.limit])]}
    if len(hits) > a.limit:
        res["note"] = f"Chỉ liệt kê {a.limit}/{len(hits)} kết quả đầu; thu hẹp bằng --pages hoặc tăng --limit"
    if not hits:
        res["note"] = "Không thấy. PDF scan (không có lớp chữ) thì find luôn rỗng — thử: text --pages 1 xem có chữ không"
    print(json.dumps(res, ensure_ascii=False, indent=2))


def cmd_page_shot(a):
    pdf = check_pdf(a.pdf)
    total = page_count(pdf)
    if a.page < 1 or a.page > total:
        die(f"Trang ngoài phạm vi 1..{total}")
    check_dpi(a.dpi)
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
    s = sub.add_parser("text"); s.add_argument("pdf"); s.add_argument("--pages"); s.add_argument("--out")
    s.add_argument("--max-chars", type=int, default=TEXT_MAX_CHARS, help="0 = không cắt"); s.set_defaults(fn=cmd_text)
    s = sub.add_parser("find"); s.add_argument("pdf"); s.add_argument("phrase"); s.add_argument("--pages")
    s.add_argument("--limit", type=int, default=50); s.set_defaults(fn=cmd_find)
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
