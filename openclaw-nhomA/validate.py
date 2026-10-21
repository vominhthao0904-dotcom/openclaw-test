#!/usr/bin/env python3
"""Validate every skill folder: frontmatter, name==folder, single-line JSON metadata, syntax, leftovers."""
import json, re, shutil, subprocess, sys
from pathlib import Path

NODE = shutil.which("node")

root = Path(__file__).resolve().parent / "skills"
bad = 0
PATTERNS = {r"/home/openclaw": "đường dẫn cứng", r"\b(?!127\.0\.0\.1|0\.0\.0\.0)\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}\b": "IP:port cứng",
            r"sk-[A-Za-z0-9_-]{16,}": "khoá API dạng sk-", r"EAA[A-Za-z0-9]{20,}": "token Meta", r"AIza[0-9A-Za-z_-]{20,}": "khoá Google",
            r"-----BEGIN [A-Z ]*PRIVATE KEY": "private key"}
dirs = sorted(p for p in root.iterdir() if p.is_dir())
for d in dirs:
    errs = []
    md = d / "SKILL.md"
    if not md.is_file():
        errs.append("thiếu SKILL.md")
    else:
        t = md.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n", t, re.S)
        if not m:
            errs.append("thiếu frontmatter")
        else:
            fm = m.group(1)
            name = re.search(r"^name:\s*(.+)$", fm, re.M)
            desc = re.search(r"^description:\s*(.+)$", fm, re.M)
            meta = re.search(r"^metadata:\s*(.+)$", fm, re.M)
            if not name or name.group(1).strip() != d.name:
                errs.append(f"name != tên thư mục ({name.group(1).strip() if name else None} vs {d.name})")
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", d.name):
                errs.append("tên thư mục phải là chữ thường/số/gạch ngang")
            if not desc or len(desc.group(1)) < 40:
                errs.append("description thiếu/quá ngắn")
            if meta:
                try:
                    json.loads(meta.group(1))
                except Exception as e:
                    errs.append(f"metadata không phải JSON một dòng hợp lệ: {e}")
    skip_dirs = {"node_modules", ".next", "__pycache__"}
    for f in d.rglob("*"):
        # symlink có thể trỏ ra ngoài gói (ví dụ ~/.ssh) rồi bị chép theo vào workspace
        if f.is_symlink():
            errs.append(f"symlink không được phép: {f.relative_to(d)}")
            continue
        if not f.is_file() or f.suffix in (".png", ".jpg", ".jpeg", ".webp", ".mp3", ".mp4", ".pyc", ".ico", ".woff", ".woff2"):
            continue
        if any(part in skip_dirs for part in f.parts):
            continue
        if f.suffix == ".py":
            r = subprocess.run([sys.executable, "-m", "py_compile", str(f)], capture_output=True, text=True)
            if r.returncode: errs.append(f"py_compile {f.name}: {r.stderr.strip()[-120:]}")
        elif f.suffix in (".mjs", ".js"):
            # node không bắt buộc: thiếu node thì bỏ qua bước này, đừng làm hỏng cả việc cài
            if NODE:
                r = subprocess.run([NODE, "--check", str(f)], capture_output=True, text=True)
                if r.returncode: errs.append(f"node --check {f.name}: {r.stderr.strip()[-120:]}")
        elif f.suffix == ".sh":
            r = subprocess.run(["bash", "-n", str(f)], capture_output=True, text=True)
            if r.returncode: errs.append(f"bash -n {f.name}: {r.stderr.strip()[-120:]}")
        try:
            txt = f.read_text(encoding="utf-8")
        except Exception:
            continue
        for pat, label in PATTERNS.items():
            if re.search(pat, txt):
                errs.append(f"{label} trong {f.relative_to(d)}")
    print(("FAIL " if errs else "OK   ") + d.name + ("" if not errs else "\n       - " + "\n       - ".join(errs)))
    bad += bool(errs)
print(f"\n{len(dirs)} skill, {bad} lỗi")
sys.exit(1 if bad else 0)
