#!/usr/bin/env python3
"""Kiểm tra sâu bộ skill: tham chiếu file, script chạy được, biến môi trường khai báo đủ.

Khác validate.py (chỉ kiểm cú pháp + frontmatter + rò rỉ khoá), file này tìm các lỗi
"cài được nhưng dùng mới biết hỏng" — đúng loại lỗi các gói gốc hay mắc.
"""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "skills"
PY = sys.executable
# HOME giả riêng cho mỗi lần chạy (tên ngẫu nhiên, quyền 700) — thư mục cố định trong /tmp
# có thể bị user khác tạo trước hoặc gài symlink
FAKE_HOME = tempfile.mkdtemp(prefix="deepcheck-home-")
problems = []       # (mức độ, skill, mô tả)


def add(level, skill, msg):
    problems.append((level, skill, msg))


def frontmatter(md_text):
    m = re.match(r"^---\n(.*?)\n---\n", md_text, re.S)
    return m.group(1) if m else ""


def meta_json(fm):
    m = re.search(r"^metadata:\s*(.+)$", fm, re.M)
    if not m:
        return {}
    try:
        return json.loads(m.group(1)).get("openclaw", {})
    except Exception:
        return {}


def check_file_refs(skill_dir, name, body):
    """Mọi đường dẫn {baseDir}/... và `scripts/x`, `references/y` nhắc trong SKILL.md phải tồn tại."""
    refs = set()
    for m in re.finditer(r"\{baseDir\}/([A-Za-z0-9_./\-]+)", body):
        refs.add(m.group(1).rstrip(".,;:)"))
    for m in re.finditer(r"`((?:scripts|references|assets|template|integration|public|app)/[A-Za-z0-9_./\-]+)`", body):
        refs.add(m.group(1).rstrip(".,;:)"))
    generated = re.compile(r"tự sinh|sẽ tạo|ghi ra|xuất ra|kết quả lưu|output", re.I)
    for r in sorted(refs):
        if "*" in r or r.endswith("/"):
            continue
        line = next((l for l in body.splitlines() if r in l), "")
        if generated.search(line):          # file do script tạo ra lúc chạy, không kèm sẵn
            continue
        if not (skill_dir / r).exists():
            add("LỖI", name, f"SKILL.md nhắc tới `{r}` nhưng file không tồn tại")


def check_runs(skill_dir, name):
    """Mỗi script Python phải chạy được --help (bắt lỗi import/runtime, không chỉ cú pháp)."""
    for f in sorted(skill_dir.rglob("scripts/*.py")):
        if f.name.startswith("_"):
            continue
        src = f.read_text(encoding="utf-8", errors="replace")
        if "argparse" not in src:
            continue
        r = subprocess.run([PY, str(f), "--help"], capture_output=True, text=True, timeout=60,
                           env={**os.environ, "HOME": FAKE_HOME})
        if r.returncode != 0:
            add("LỖI", name, f"{f.relative_to(skill_dir)} --help thoát mã {r.returncode}: {(r.stderr or r.stdout).strip()[-120:]}")


def check_env_declared(skill_dir, name, meta):
    """Biến môi trường mà code đọc nhưng frontmatter không khai báo -> OpenClaw báo metadata mismatch."""
    declared = set(meta.get("requires", {}).get("env", []))
    declared.add(meta.get("primaryEnv"))
    for e in meta.get("envVars", []) or []:
        if isinstance(e, dict):
            declared.add(e.get("name"))
    declared.discard(None)
    used = set()
    for f in list(skill_dir.rglob("scripts/*.py")) + list(skill_dir.rglob("scripts/*.mjs")):
        src = f.read_text(encoding="utf-8", errors="replace")
        used |= set(re.findall(r"""environ(?:\.get)?[\(\[]["']([A-Z][A-Z0-9_]{3,})["']""", src))
        used |= set(re.findall(r"""process\.env\.([A-Z][A-Z0-9_]{3,})""", src))
        used |= set(re.findall(r"""env\(["']([A-Z][A-Z0-9_]{3,})["']""", src))
    # bỏ qua biến nội bộ/chuẩn hệ thống và biến chỉ dùng để ghi đè khi thử nghiệm
    ignore = {"HOME", "PATH", "TMPDIR", "NODE_ENV", "OPENCLAW_HOME", "OPENCLAW_WORKSPACE", "OPENCLAW_CONFIG",
              "OPENCLAW_BIN", "PLAYWRIGHT_MODULE_DIR", "SECOND_BRAIN_DB"}
    secret_like = {u for u in used - declared - ignore
                   if re.search(r"(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)$", u)}
    for u in sorted(secret_like):
        add("CẢNH BÁO", name, f"code đọc `{u}` nhưng frontmatter chưa khai báo (requires.env/primaryEnv/envVars)")


def check_structure(skill_dir, name, fm, body):
    if len(body.strip()) < 400:
        add("CẢNH BÁO", name, f"SKILL.md quá ngắn ({len(body.strip())} ký tự) — agent khó biết cách dùng")
    desc = re.search(r"^description:\s*(.+)$", fm, re.M)
    if desc and len(desc.group(1)) > 1024:
        add("LỖI", name, "description vượt 1024 ký tự")
    # Script có trong thư mục nhưng SKILL.md không hề nhắc tới -> agent sẽ không bao giờ dùng
    mentioned = set(re.findall(r"[A-Za-z0-9_\-]+\.(?:py|mjs|sh)", body))
    for f in sorted(skill_dir.glob("scripts/*")):
        if f.is_file() and f.suffix in (".py", ".mjs", ".sh") and not f.name.startswith("_") and f.name not in mentioned:
            add("CẢNH BÁO", name, f"scripts/{f.name} không được nhắc trong SKILL.md")


def main():
    dirs = sorted(p for p in ROOT.iterdir() if p.is_dir())
    for d in dirs:
        md = d / "SKILL.md"
        if not md.is_file():
            add("LỖI", d.name, "thiếu SKILL.md")
            continue
        text = md.read_text(encoding="utf-8")
        fm = frontmatter(text)
        body = text[len(fm) + 8:] if fm else text
        meta = meta_json(fm)
        check_file_refs(d, d.name, body)
        check_runs(d, d.name)
        check_env_declared(d, d.name, meta)
        check_structure(d, d.name, fm, body)

    errs = [p for p in problems if p[0] == "LỖI"]
    warns = [p for p in problems if p[0] == "CẢNH BÁO"]
    by_skill = {}
    for lvl, s, m in problems:
        by_skill.setdefault(s, []).append((lvl, m))
    for d in dirs:
        items = by_skill.get(d.name)
        if not items:
            print(f"ĐẠT   {d.name}")
        else:
            worst = "LỖI" if any(l == "LỖI" for l, _ in items) else "CẢNH BÁO"
            print(f"{worst:5} {d.name}")
            for lvl, m in items:
                print(f"        [{lvl}] {m}")
    print(f"\n{len(dirs)} skill — {len(errs)} lỗi, {len(warns)} cảnh báo")
    return 1 if errs else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    finally:
        import shutil
        shutil.rmtree(FAKE_HOME, ignore_errors=True)
