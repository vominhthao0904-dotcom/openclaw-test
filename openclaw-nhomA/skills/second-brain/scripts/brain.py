#!/usr/bin/env python3
"""Second Brain: a local, offline note store (SQLite + FTS5). No network, no API keys.

Q&A/synthesis is done by the agent reading `search`/`show` output - this tool never calls an LLM,
so no note ever leaves the machine. Replaces the old Netlify/LLM-endpoint version.
"""
import argparse, gzip, json, os, re, sqlite3, sys, textwrap, uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path


def so_env(ten, mac_dinh, nho_nhat=0):
    """Biến môi trường gõ sai không được làm chết cả lệnh."""
    try:
        v = int(os.environ.get(ten, mac_dinh))
    except (TypeError, ValueError):
        print(f"[cảnh báo] {ten} không phải số, dùng mặc định {mac_dinh}", file=sys.stderr)
        return int(mac_dinh)
    return max(nho_nhat, v)


WORKSPACE = Path(os.environ.get("OPENCLAW_WORKSPACE", Path.home() / ".openclaw" / "workspace"))
DB_PATH = Path(os.environ.get("SECOND_BRAIN_DB", WORKSPACE / "second-brain" / "notes.sqlite"))
BACKUP_DIR = DB_PATH.parent / "backups"
DELETED_DIR = DB_PATH.parent / "deleted"      # bản sao vĩnh viễn, KHÔNG bao giờ tự dọn
KEEP_BACKUPS = so_env("SECOND_BRAIN_KEEP_BACKUPS", 60, 1)   # luôn giữ ít nhất 1 bản
SOURCES = ("book", "course", "experiment", "chat", "web", "meeting", "other")
COLS = "id,title,content,category,tags,source,url,created_at,updated_at,reviewed_at,status"
CON = "status='active'"                        # ghi chú đang dùng; 'archived' là đã cất kho


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat(timespec="milliseconds")


def out(obj, code=0):
    try:
        print(json.dumps(obj, ensure_ascii=False, indent=2))
        sys.stdout.flush()
    except BrokenPipeError:        # `brain.py list | head` — không đổ traceback ra màn hình
        try:
            sys.stdout.close()
        except Exception:
            pass
        os._exit(code)
    sys.exit(code)


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # timeout: trang web và lệnh dòng lệnh có thể ghi cùng lúc — chờ nhau thay vì báo "database is locked"
    db = sqlite3.connect(DB_PATH, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout=20000")
    db.executescript("""
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS notes(
        id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
        category TEXT DEFAULT '', tags TEXT DEFAULT '', source TEXT DEFAULT 'chat',
        created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS links(a TEXT, b TEXT, UNIQUE(a, b));
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title, content, tags, category, content='notes', content_rowid='rowid', tokenize='unicode61');
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid,title,content,tags,category) VALUES (new.rowid,new.title,new.content,new.tags,new.category); END;
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts,rowid,title,content,tags,category) VALUES('delete',old.rowid,old.title,old.content,old.tags,old.category); END;
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts,rowid,title,content,tags,category) VALUES('delete',old.rowid,old.title,old.content,old.tags,old.category);
        INSERT INTO notes_fts(rowid,title,content,tags,category) VALUES (new.rowid,new.title,new.content,new.tags,new.category); END;
    """)
    nang_cap(db)
    return db


def nang_cap(db):
    """Kho tạo bằng bản cũ vẫn mở được: thêm cột còn thiếu, không đụng dữ liệu sẵn có."""
    co = {r["name"] for r in db.execute("PRAGMA table_info(notes)")}
    them = False
    for ten, kieu in (("url", "TEXT DEFAULT ''"), ("reviewed_at", "TEXT"),
                      ("status", "TEXT DEFAULT 'active'")):
        if ten not in co:
            db.execute(f"ALTER TABLE notes ADD COLUMN {ten} {kieu}")
            them = True
    if them:   # chỉ quét cả bảng ngay sau khi nâng cấp, không phải mỗi lần mở kho
        db.execute("UPDATE notes SET status='active' WHERE status IS NULL OR trim(status)=''")
    db.commit()


def norm_tags(s):
    """Chuẩn hoá thẻ.

    Có dấu phẩy  -> tách theo dấu phẩy, khoảng trắng bên trong thành gạch nối:
                    "bất động sản, vay" -> "bất-động-sản,vay"
    Không dấu phẩy -> tách theo khoảng trắng như cũ: "landing mobile" -> "landing,mobile"
    Trước đây luôn tách theo khoảng trắng nên thẻ tiếng Việt nhiều chữ bị băm nhỏ.
    """
    if not s:
        return ""
    tho = s.split(",") if "," in s else re.split(r"\s+", s)
    parts = []
    for t in tho:
        t = re.sub(r"\s+", "-", t.strip().lstrip("#").lower()).strip("-")
        if t:
            parts.append(t)
    return ",".join(dict.fromkeys(parts))


def row_dict(r, snippet=None):
    d = {k: r[k] for k in r.keys() if not k.startswith("_")}
    d["tags"] = [t for t in (d.get("tags") or "").split(",") if t]
    if snippet is not None:
        d["snippet"] = snippet
    return d


def them_note(db, nid, title, content, category="", tags="", source="chat", url="",
              created=None, updated=None, reviewed=None, status="active"):
    t = now()
    db.execute(f"INSERT INTO notes({COLS}) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
               (nid, title, content, category, tags, source, url,
                created or t, updated or t, reviewed, status or "active"))


def doc_json(path):
    """Đọc file JSON, nén gzip hay không đều được. Lỗi thì báo rõ, không đổ traceback."""
    p = Path(path)
    try:
        if p.suffix == ".gz":
            with gzip.open(p, "rt", encoding="utf-8") as f:
                return json.load(f)
        return json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        out({"ok": False, "error": f"Không thấy file: {p}"}, 2)
    except (json.JSONDecodeError, UnicodeDecodeError, OSError, EOFError) as e:
        out({"ok": False, "error": f"File {p} không đọc được: {type(e).__name__} — {e}"}, 2)


def ds_backup():
    if not BACKUP_DIR.is_dir():
        return []
    return sorted(list(BACKUP_DIR.glob("notes-*.json")) + list(BACKUP_DIR.glob("notes-*.json.gz")))


def backup(db, reason):
    """Ảnh chụp toàn kho, nén gzip (nhỏ hơn khoảng 8 lần).
    Các bản này CÓ xoay vòng — đừng coi đây là nơi giữ ghi chú đã xoá."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BACKUP_DIR / f"notes-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{reason}.json.gz"
    if dest.exists():      # hai thao tác trong cùng một giây thì đừng đè lên nhau
        dest = dest.with_name(dest.name[:-8] + "-" + uuid.uuid4().hex[:4] + ".json.gz")
    rows = [row_dict(r) for r in db.execute("SELECT * FROM notes ORDER BY created_at")]
    with gzip.open(dest, "wt", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    for f in ds_backup()[:-KEEP_BACKUPS]:
        try:
            f.unlink()
        except OSError:
            pass
    return dest


def luu_vinh_vien(db, r):
    """Trước khi xoá hẳn: cất riêng một file cho ghi chú đó. Thư mục này không bao giờ tự dọn,
    nên dù ảnh chụp toàn kho đã xoay hết vòng thì ghi chú cũ vẫn còn lấy lại được."""
    DELETED_DIR.mkdir(parents=True, exist_ok=True)
    d = row_dict(r)
    d["deleted_at"] = now()
    d["links"] = sorted({x["b"] for x in db.execute("SELECT b FROM links WHERE a=?", (d["id"],))} |
                        {x["a"] for x in db.execute("SELECT a FROM links WHERE b=?", (d["id"],))})
    dest = DELETED_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{d['id']}.json"
    dest.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    return dest


def read_content(a):
    if a.content_file:
        try:
            return Path(a.content_file).read_text(encoding="utf-8")
        except FileNotFoundError:
            out({"ok": False, "error": f"Không thấy file: {a.content_file}"}, 2)
        except (OSError, UnicodeDecodeError) as e:
            out({"ok": False, "error": f"Không đọc được {a.content_file}: {e}"}, 2)
    if a.content == "-":
        return sys.stdin.read()
    return a.content or ""


def rut_gon(s, n=160):
    return textwrap.shorten((s or "").replace("\n", " "), n, placeholder="…")


STOP = set("và của là các có cho một những được với thì để khi này đó trong nhưng cũng như về từ nếu bạn tôi anh em mình "
           "the and for with that this from you your are was".split())


def tu_khoa(text, n=8):
    # Counter chứ không phải words.count() trong vòng lặp: ghi chú dài vài nghìn từ
    # mà đếm kiểu cũ là O(n²), đủ để treo máy.
    words = [w for w in re.findall(r"\w{4,}", (text or "").lower())[:20000] if w not in STOP]
    return [w for w, _ in Counter(words).most_common(n)]


def tim_tuong_tu(db, title, content, bo_qua=None, limit=3):
    """Tìm ghi chú đã có gần giống — để cảnh báo trùng, không chặn."""
    top = tu_khoa(title + " " + content)
    if not top:
        return []
    q = " OR ".join(f'"{w}"' for w in top)
    try:
        rows = db.execute("SELECT n.id,n.title,n.content,n.tags FROM notes_fts f JOIN notes n ON n.rowid=f.rowid "
                          f"WHERE notes_fts MATCH ? AND n.{CON} ORDER BY bm25(notes_fts) LIMIT 30", (q,)).fetchall()
    except sqlite3.OperationalError:
        return []
    ra = []
    for x in rows:
        if bo_qua and x["id"] == bo_qua:
            continue
        text = (x["title"] + " " + x["content"] + " " + (x["tags"] or "")).lower()
        chung = [w for w in top if w in text]
        if len(chung) >= max(3, len(top) // 2):          # trùng quá nửa từ khoá mới coi là giống
            ra.append({"id": x["id"], "title": x["title"], "shared_keywords": chung})
    ra.sort(key=lambda d: -len(d["shared_keywords"]))
    return ra[:limit]


# ---------------- commands ----------------
def cmd_add(a, db):
    content = read_content(a)
    if not a.title.strip() or not content.strip():
        out({"ok": False, "error": "Cần --title và nội dung (--content, --content-file hoặc stdin với --content -)"}, 2)
    if a.source not in SOURCES:
        out({"ok": False, "error": f"--source phải thuộc {SOURCES}"}, 2)
    giong = tim_tuong_tu(db, a.title.strip(), content.strip())
    nid = uuid.uuid4().hex[:12]
    them_note(db, nid, a.title.strip(), content.strip(), (a.category or "").strip(),
              norm_tags(a.tags), a.source, (a.url or "").strip())
    db.commit()
    kq = {"ok": True, "id": nid, "title": a.title.strip(), "db": str(DB_PATH)}
    if giong:
        kq["similar_existing"] = giong
        kq["hint"] = ("Kho đã có ghi chú gần giống. Hỏi người dùng: bổ sung vào ghi chú cũ "
                      "(edit --append) và xoá ghi chú vừa tạo, hay giữ cả hai rồi link lại?")
    out(kq)


def cmd_list(a, db):
    sql, params = "SELECT * FROM notes", []
    where = ["status='archived'"] if a.archived else [CON]
    if a.tag:
        where.append("(',' || tags || ',') LIKE ?")
        params.append(f"%,{a.tag.lstrip('#').lower()},%")
    if a.category:
        where.append("lower(category)=lower(?)")
        params.append(a.category)
    if a.source:
        where.append("source=?")
        params.append(a.source)
    sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY updated_at DESC, rowid DESC LIMIT ?"
    params.append(a.limit)
    rows = [row_dict(r) for r in db.execute(sql, params)]
    for r in rows:
        r["content"] = rut_gon(r["content"])
    out({"ok": True, "count": len(rows), "notes": rows})


def _tim(db, q, limit, ca_kho=False):
    sql = ("SELECT n.*, snippet(notes_fts, 1, '«', '»', '…', 14) AS snip FROM notes_fts f "
           "JOIN notes n ON n.rowid = f.rowid WHERE notes_fts MATCH ?" +
           ("" if ca_kho else f" AND n.{CON}") + " ORDER BY bm25(notes_fts) LIMIT ?")
    try:
        return db.execute(sql, (q, limit)).fetchall()
    except sqlite3.OperationalError:   # user typed FTS operators wrongly -> fall back to a plain phrase
        return db.execute(sql, ('"' + q.replace('"', " ") + '"', limit)).fetchall()


def cmd_search(a, db):
    q = a.query.strip()
    if not q:
        out({"ok": False, "error": "Thiếu từ khoá"}, 2)
    notes = []
    for r in _tim(db, q, a.limit, a.all):
        d = row_dict(r, snippet=r["snip"])
        d.pop("snip", None)
        d["content"] = d["content"] if a.full else rut_gon(d["content"], 200)
        notes.append(d)
    out({"ok": True, "query": q, "count": len(notes), "notes": notes})


def cmd_show(a, db):
    r = db.execute("SELECT * FROM notes WHERE id=?", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id}"}, 2)
    d = row_dict(r)
    linked = [x["b"] for x in db.execute("SELECT b FROM links WHERE a=?", (a.id,))] + \
             [x["a"] for x in db.execute("SELECT a FROM links WHERE b=?", (a.id,))]
    d["linked_notes"] = sorted(set(linked))
    out({"ok": True, "note": d})


def cmd_edit(a, db):
    r = db.execute("SELECT * FROM notes WHERE id=?", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id}"}, 2)
    co_noi_dung_moi = bool(a.content or a.content_file)
    if a.append and not co_noi_dung_moi:
        # trước đây chỗ này nối ghi chú với chính nó, nhân đôi nội dung
        out({"ok": False, "error": "--append cần kèm --content hoặc --content-file"}, 2)
    content = read_content(a) if co_noi_dung_moi else r["content"]
    if a.append:
        content = r["content"].rstrip() + "\n\n" + content.strip()
    db.execute("UPDATE notes SET title=?, content=?, category=?, tags=?, url=?, updated_at=? WHERE id=?",
               (a.title or r["title"], content, a.category if a.category is not None else r["category"],
                norm_tags(a.tags) if a.tags is not None else r["tags"],
                a.url if a.url is not None else (r["url"] or ""), now(), a.id))
    db.commit()
    out({"ok": True, "id": a.id, "updated": True})


def cmd_archive(a, db):
    """Cất kho: ghi chú biến khỏi đồ thị, tìm kiếm và ôn lại — nhưng vẫn còn nguyên trong file."""
    r = db.execute("SELECT id,title,status FROM notes WHERE id=?", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id}"}, 2)
    if r["status"] == "archived":
        out({"ok": True, "id": a.id, "note": "Ghi chú này đã ở kho lưu từ trước"})
    db.execute("UPDATE notes SET status='archived', updated_at=? WHERE id=?", (now(), a.id))
    db.commit()
    out({"ok": True, "cat_kho": a.id, "title": r["title"],
         "note": "Lấy lại bất cứ lúc nào: unarchive --id " + a.id})


def cmd_unarchive(a, db):
    r = db.execute("SELECT id,title FROM notes WHERE id=? AND status='archived'", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id} trong kho lưu"}, 2)
    db.execute("UPDATE notes SET status='active', updated_at=? WHERE id=?", (now(), a.id))
    db.commit()
    out({"ok": True, "lay_lai": a.id, "title": r["title"]})


def cmd_delete(a, db):
    """Xoá hẳn khỏi kho. Luôn ghi một bản sao riêng vào deleted/ trước — thư mục đó không tự dọn."""
    r = db.execute("SELECT * FROM notes WHERE id=?", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id}"}, 2)
    if not a.yes:
        out({"ok": False, "blocked": "Cần --yes để xoá hẳn. Muốn chỉ giấu đi thì dùng: archive --id " + a.id,
             "note": {"id": r["id"], "title": r["title"]}}, 3)
    f = luu_vinh_vien(db, r)
    b = backup(db, "before-delete")
    db.execute("DELETE FROM notes WHERE id=?", (a.id,))
    db.execute("DELETE FROM links WHERE a=? OR b=?", (a.id, a.id))
    db.commit()
    out({"ok": True, "deleted": a.id, "ban_sao_vinh_vien": str(f), "backup": str(b)})


def cmd_restore(a, db):
    """Lấy lại một ghi chú đã xoá hẳn, từ file trong deleted/."""
    f = Path(a.file)
    if not f.is_file():
        ds = sorted(DELETED_DIR.glob(f"*{a.file}*.json")) if DELETED_DIR.is_dir() else []
        if not ds:
            out({"ok": False, "error": f"Không thấy file hay ghi chú đã xoá nào khớp '{a.file}'",
                 "thu_muc": str(DELETED_DIR)}, 2)
        f = ds[-1]
    d = doc_json(f)
    nid = d.get("id") or uuid.uuid4().hex[:12]
    if db.execute("SELECT 1 FROM notes WHERE id=?", (nid,)).fetchone():
        nid = uuid.uuid4().hex[:12]
    tags = d.get("tags")
    them_note(db, nid, d["title"], d["content"], d.get("category", ""),
              norm_tags(",".join(tags) if isinstance(tags, list) else (tags or "")),
              d.get("source", "other"), d.get("url", ""),
              d.get("created_at"), now(), d.get("reviewed_at"), "active")
    db.commit()
    out({"ok": True, "lay_lai": nid, "title": d["title"], "tu_file": str(f)})


def cmd_link(a, db):
    if a.a == a.b:
        out({"ok": False, "error": "Không nối một ghi chú với chính nó"}, 2)
    for i in (a.a, a.b):
        if not db.execute("SELECT 1 FROM notes WHERE id=?", (i,)).fetchone():
            out({"ok": False, "error": f"Không thấy ghi chú {i}"}, 2)
    x, y = sorted([a.a, a.b])
    db.execute("INSERT OR IGNORE INTO links VALUES(?,?)", (x, y))
    db.commit()
    out({"ok": True, "linked": [x, y]})


def cmd_suggest_links(a, db):
    r = db.execute("SELECT * FROM notes WHERE id=?", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id}"}, 2)
    top = tu_khoa(r["title"] + " " + r["content"])
    if not top:
        out({"ok": True, "suggestions": [], "note": "Ghi chú quá ngắn để gợi ý"})
    q = " OR ".join(f'"{w}"' for w in top)
    rows = db.execute("SELECT n.id,n.title,n.content,n.tags FROM notes_fts f JOIN notes n ON n.rowid=f.rowid "
                      f"WHERE notes_fts MATCH ? AND n.id<>? AND n.{CON} "   # đừng gợi ý ghi chú đã cất kho
                      "ORDER BY bm25(notes_fts) LIMIT 50", (q, a.id)).fetchall()
    da_noi = {x["b"] for x in db.execute("SELECT b FROM links WHERE a=?", (a.id,))} | \
             {x["a"] for x in db.execute("SELECT a FROM links WHERE b=?", (a.id,))}
    scored = []
    for x in rows:  # require real overlap, not a single common word
        if x["id"] in da_noi:
            continue
        text = (x["title"] + " " + x["content"] + " " + (x["tags"] or "")).lower()
        shared = [w for w in top if w in text]
        if len(shared) >= 2:
            scored.append({"id": x["id"], "title": x["title"], "shared_keywords": shared})
    scored.sort(key=lambda d: -len(d["shared_keywords"]))
    out({"ok": True, "keywords": top, "suggestions": scored[: a.limit],
         "note": "Gợi ý theo từ khoá trùng (>=2 từ), đã bỏ ghi chú nối rồi; agent tự đánh giá rồi mới dùng lệnh link."})


# ---------------- duy trì kho ----------------
def cmd_inbox(a, db):
    """Ghi chú bắt vội, chưa phân loại — cần dọn thì kho mới dùng được lâu dài."""
    rows = db.execute(
        f"SELECT * FROM notes WHERE {CON} AND (trim(coalesce(category,''))='' OR trim(coalesce(tags,''))='') "
        "ORDER BY created_at ASC LIMIT ?", (a.limit,)).fetchall()
    ds = []
    for r in rows:
        d = row_dict(r)
        d["content"] = rut_gon(d["content"])
        d["thieu"] = [x for x, v in (("nhóm", r["category"]), ("thẻ", r["tags"])) if not (v or "").strip()]
        ds.append(d)
    tong = db.execute(f"SELECT count(*) c FROM notes WHERE {CON} AND "
                      "(trim(coalesce(category,''))='' OR trim(coalesce(tags,''))='')").fetchone()["c"]
    out({"ok": True, "cho_phan_loai": tong, "count": len(ds), "notes": ds,
         "note": "Dùng edit --category/--tags để xếp chỗ. Hỏi người dùng nhóm nào, đừng tự đoán."})


def cmd_review(a, db):
    """Ôn lại: kho chỉ thành bộ não thứ hai khi ghi chú được gặp lại, không nằm im."""
    if a.done:
        ids = [x.strip() for x in a.done.split(",") if x.strip()]
        n = 0
        for i in ids:
            cur = db.execute("UPDATE notes SET reviewed_at=? WHERE id=?", (now(), i))
            n += cur.rowcount
        db.commit()
        out({"ok": True, "da_on": n, "ids": ids})
    where, params = [CON, "created_at < ?"], [days_ago(a.min_age)]
    if a.category:
        where.append("lower(category)=lower(?)")
        params.append(a.category)
    if a.tag:
        where.append("(',' || tags || ',') LIKE ?")
        params.append(f"%,{a.tag.lstrip('#').lower()},%")
    params.append(a.limit)
    rows = db.execute(
        "SELECT * FROM notes WHERE " + " AND ".join(where) +
        " ORDER BY (reviewed_at IS NOT NULL), coalesce(reviewed_at, created_at) ASC LIMIT ?", params).fetchall()
    ds = []
    for r in rows:
        d = row_dict(r)
        d["content"] = rut_gon(d["content"], 300)
        d["lan_on_cuoi"] = r["reviewed_at"] or "chưa ôn lần nào"
        ds.append(d)
    out({"ok": True, "count": len(ds), "notes": ds,
         "note": "Nêu lại từng ghi chú cho người dùng, hỏi còn đúng không / có gì bổ sung. "
                 "Ôn xong gọi: review --done <id1,id2>."})


def cmd_digest(a, db):
    """Những gì đã ghi trong N ngày — nguyên liệu để viết bài, báo cáo, dạy lại."""
    moc = days_ago(a.days)
    rows = db.execute(f"SELECT * FROM notes WHERE {CON} AND created_at >= ? "
                      "ORDER BY category, created_at", (moc,)).fetchall()
    nhom = {}
    for r in rows:
        k = (r["category"] or "").strip() or "Chưa phân loại"
        nhom.setdefault(k, []).append({"id": r["id"], "title": r["title"],
                                       "tom_tat": rut_gon(r["content"], 200),
                                       "tags": [t for t in (r["tags"] or "").split(",") if t],
                                       "url": r["url"] or ""})
    out({"ok": True, "so_ngay": a.days, "tong": len(rows),
         "theo_nhom": [{"nhom": k, "so_ghi_chu": len(v), "notes": v}
                       for k, v in sorted(nhom.items(), key=lambda x: -len(x[1]))],
         "note": "Dùng để viết bản tin/bài đăng/tổng kết tuần. Giữ giọng người dùng, dẫn id ghi chú nguồn."})


def cmd_tags(a, db):
    dem = {}
    for r in db.execute(f"SELECT tags FROM notes WHERE {CON}"):
        for t in (r["tags"] or "").split(","):
            if t:
                dem[t] = dem.get(t, 0) + 1
    sx = sorted(dem.items(), key=lambda x: (-x[1], x[0]))
    out({"ok": True, "tong_the": len(sx),
         "the": [{"the": k, "so_ghi_chu": v} for k, v in sx],
         "dung_mot_lan": [k for k, v in sx if v == 1],
         "note": "Thẻ chỉ dùng 1 lần thường là trùng nghĩa với thẻ khác — gộp bằng: retag --from x --to y"})


def cmd_retag(a, db):
    cu, moi = norm_tags(a.from_tag), norm_tags(a.to_tag)
    if not cu or not moi:
        out({"ok": False, "error": "Cần --from và --to"}, 2)
    # đổi cả ghi chú trong kho lưu: không thì lấy ra dùng lại là thẻ cũ sống lại
    rows = db.execute("SELECT id,tags FROM notes WHERE (',' || tags || ',') LIKE ?",
                      (f"%,{cu},%",)).fetchall()
    if not rows:
        out({"ok": True, "doi": 0, "note": f"Không ghi chú nào mang thẻ '{cu}'"})
    if not a.yes:
        out({"ok": False, "blocked": "Cần --yes để đổi", "se_doi": len(rows), "tu": cu, "sang": moi}, 3)
    b = backup(db, "before-retag")
    for r in rows:
        ds = [moi if t == cu else t for t in r["tags"].split(",") if t]
        db.execute("UPDATE notes SET tags=?, updated_at=? WHERE id=?",
                   (",".join(dict.fromkeys(ds)), now(), r["id"]))
    db.commit()
    out({"ok": True, "doi": len(rows), "tu": cu, "sang": moi, "backup": str(b)})


def cmd_duplicates(a, db):
    """Quét cả kho tìm những cặp ghi chú nói gần như cùng một chuyện.

    Không so từng cặp một (kho 2000 ghi chú là 2 triệu phép so, ngốn hàng trăm MB RAM).
    Thay vào đó mỗi ghi chú chỉ hỏi FTS lấy vài ứng viên gần nhất rồi mới so kỹ.
    """
    rows = db.execute(f"SELECT id,title,content,tags FROM notes WHERE {CON}").fetchall()
    bo = {r["id"]: set(tu_khoa(r["title"] + " " + r["content"], 14)) for r in rows}
    ten = {r["id"]: r["title"] for r in rows}

    # chỉ mục ngược: từ -> các ghi chú chứa nó
    muc = {}
    for i, s in bo.items():
        for w in s:
            muc.setdefault(w, []).append(i)
    # từ xuất hiện ở quá nhiều ghi chú thì không phân biệt được gì -> bỏ qua
    tran = max(int(len(rows) * 0.2), 40)
    rieng = {w: v for w, v in muc.items() if len(v) <= tran}

    da_xet, cap = set(), []
    for x, s in bo.items():
        if not s:
            continue
        dem = {}
        for w in s:
            for y in rieng.get(w, ()):
                if y != x:
                    dem[y] = dem.get(y, 0) + 1
        for y, n_chung in dem.items():
            if n_chung < 2:                       # chung đúng 1 từ thì chưa đáng xét
                continue
            khoa = (x, y) if x < y else (y, x)
            if khoa in da_xet:
                continue
            da_xet.add(khoa)
            chung = s & bo[y]
            tiLe = len(chung) / min(len(s), len(bo[y]))
            if tiLe >= a.nguong:
                cap.append({"a": khoa[0], "tieu_de_a": ten[khoa[0]], "b": khoa[1], "tieu_de_b": ten[khoa[1]],
                            "giong": round(tiLe, 2), "tu_chung": sorted(chung)[:8]})
    cap.sort(key=lambda d: -d["giong"])
    out({"ok": True, "so_cap": len(cap), "da_quet": len(rows), "cap": cap[: a.limit],
         "note": "Đây là NGHI NGỜ trùng, không phải kết luận. Đọc cả hai rồi hỏi người dùng. "
                 "Gộp bằng: merge --from <id bỏ> --into <id giữ> --yes"})


def cmd_merge(a, db):
    """Gộp hai ghi chú: nối nội dung, dồn thẻ và liên kết, rồi cất ghi chú nguồn vào kho lưu."""
    nguon = db.execute("SELECT * FROM notes WHERE id=?", (a.from_id,)).fetchone()
    dich = db.execute("SELECT * FROM notes WHERE id=?", (a.into_id,)).fetchone()
    if not nguon or not dich:
        out({"ok": False, "error": "Không thấy một trong hai ghi chú"}, 2)
    if a.from_id == a.into_id:
        out({"ok": False, "error": "Hai id trùng nhau"}, 2)
    if not a.yes:
        out({"ok": False, "blocked": "Cần --yes để gộp",
             "se_gop": {"bo": nguon["title"], "giu": dich["title"]}}, 3)
    b = backup(db, "before-merge")
    noi_dung = dich["content"].rstrip() + "\n\n---\n\n" + nguon["content"].strip()
    the = dict.fromkeys([t for t in (dich["tags"] or "").split(",") if t] +
                        [t for t in (nguon["tags"] or "").split(",") if t])
    db.execute("UPDATE notes SET content=?, tags=?, url=?, updated_at=? WHERE id=?",
               (noi_dung, ",".join(the), dich["url"] or nguon["url"] or "", now(), a.into_id))
    # liên kết của ghi chú nguồn chuyển sang ghi chú giữ lại
    for r in db.execute("SELECT a,b FROM links WHERE a=? OR b=?", (a.from_id, a.from_id)).fetchall():
        kia = r["b"] if r["a"] == a.from_id else r["a"]
        if kia != a.into_id:
            x, y = sorted([a.into_id, kia])
            db.execute("INSERT OR IGNORE INTO links VALUES(?,?)", (x, y))
    db.execute("DELETE FROM links WHERE a=? OR b=?", (a.from_id, a.from_id))
    db.execute("UPDATE notes SET status='archived', updated_at=? WHERE id=?", (now(), a.from_id))
    db.commit()
    out({"ok": True, "giu": a.into_id, "da_cat_kho": a.from_id, "backup": str(b),
         "note": "Ghi chú nguồn nằm ở kho lưu, không mất. Lấy lại: unarchive --id " + a.from_id})


def cmd_snapshot(a, db):
    """Sao lưu chủ động — để đặt lịch chạy hằng ngày trên VPS."""
    b = backup(db, a.reason)
    tong = db.execute("SELECT count(*) c FROM notes").fetchone()["c"]
    out({"ok": True, "file": str(b), "ghi_chu_trong_ban": tong,
         "giu_lai": KEEP_BACKUPS, "thu_muc": str(BACKUP_DIR)})


def cmd_export(a, db):
    where, params = ([] if a.all else [CON]), []
    if a.category:
        where.append("lower(category)=lower(?)")
        params.append(a.category)
    if a.tag:
        where.append("(',' || tags || ',') LIKE ?")
        params.append(f"%,{a.tag.lstrip('#').lower()},%")
    if a.since:
        where.append("created_at >= ?")
        params.append(days_ago(a.since))
    sql = "SELECT * FROM notes" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY category, created_at"
    rows = [row_dict(r) for r in db.execute(sql, params)]
    dest = Path(a.out).expanduser()
    if dest.parent and not dest.parent.exists():
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            out({"ok": False, "error": f"Không tạo được thư mục {dest.parent}: {e}"}, 2)
    if a.format == "json":
        dest.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        parts = []
        for n in rows:
            tags = " ".join("#" + t for t in n["tags"])
            dong = f"*{n['category'] or 'Chưa phân loại'}* · {tags} · {n['created_at']} · `{n['id']}`"
            if n.get("url"):
                dong += f"\n\nNguồn: {n['url']}"
            parts.append(f"# {n['title']}\n\n{dong}\n\n{n['content']}\n")
        dest.write_text("\n---\n\n".join(parts), encoding="utf-8")
    out({"ok": True, "file": str(dest), "notes": len(rows), "format": a.format})


def cmd_import(a, db):
    data = doc_json(a.file)                     # nhận cả .json lẫn .json.gz
    items = data if isinstance(data, list) else data.get("notes", [])
    added, skipped = 0, 0
    b = backup(db, "before-import") if db.execute("SELECT count(*) c FROM notes").fetchone()["c"] else None
    for it in items:
        title = (it.get("title") or "").strip()
        content = (it.get("content") or "").strip()
        if not title or not content:
            skipped += 1
            continue
        if db.execute("SELECT 1 FROM notes WHERE title=? AND content=?", (title, content)).fetchone():
            skipped += 1
            continue
        nid = (it.get("id") or uuid.uuid4().hex[:12])[:12]
        if db.execute("SELECT 1 FROM notes WHERE id=?", (nid,)).fetchone():
            nid = uuid.uuid4().hex[:12]
        tags = it.get("tags")
        tags = ",".join(tags) if isinstance(tags, list) else (tags or "")
        them_note(db, nid, title, content, it.get("category", ""), norm_tags(tags),
                  it.get("source", "other"), it.get("url", ""),
                  it.get("created_at"), it.get("updated_at"), it.get("reviewed_at"),
                  # giữ nguyên trạng thái: nhập lại bản sao lưu không được làm sống dậy ghi chú đã cất kho
                  "archived" if it.get("status") == "archived" else "active")
        added += 1
    db.commit()
    out({"ok": True, "added": added, "skipped_duplicate_or_empty": skipped, "backup": str(b) if b else None})


def cmd_stats(a, db):
    q = lambda s, *p: db.execute(s, p).fetchone()[0]
    total = q(f"SELECT count(*) FROM notes WHERE {CON}")
    cats = [dict(r) for r in db.execute(
        f"SELECT category, count(*) n FROM notes WHERE {CON} GROUP BY category ORDER BY n DESC")]
    tags = {}
    for r in db.execute(f"SELECT tags FROM notes WHERE {CON}"):
        for t in (r["tags"] or "").split(","):
            if t:
                tags[t] = tags.get(t, 0) + 1
    so_xoa = len(list(DELETED_DIR.glob("*.json"))) if DELETED_DIR.is_dir() else 0
    ds_bk = ds_backup()
    so_backup = len(ds_bk)
    moi_nhat = max((f.stat().st_mtime for f in ds_bk), default=None)
    cho_dia = sum(f.stat().st_size for f in ds_bk) + \
        (sum(f.stat().st_size for f in DELETED_DIR.glob("*.json")) if DELETED_DIR.is_dir() else 0) + \
        (DB_PATH.stat().st_size if DB_PATH.is_file() else 0)
    out({"ok": True, "db": str(DB_PATH), "total_notes": total, "categories": cats,
         "tags": dict(sorted(tags.items(), key=lambda x: -x[1])[:25]),
         "links": q("SELECT count(*) FROM links"),
         "suc_khoe_kho": {
             "them_7_ngay_qua": q(f"SELECT count(*) FROM notes WHERE {CON} AND created_at>=?", days_ago(7)),
             "them_30_ngay_qua": q(f"SELECT count(*) FROM notes WHERE {CON} AND created_at>=?", days_ago(30)),
             "cho_phan_loai": q(f"SELECT count(*) FROM notes WHERE {CON} AND "
                                "(trim(coalesce(category,''))='' OR trim(coalesce(tags,''))='')"),
             "chua_on_lan_nao": q(f"SELECT count(*) FROM notes WHERE {CON} AND reviewed_at IS NULL"),
             "khong_noi_voi_ghi_chu_nao": q(
                 f"SELECT count(*) FROM notes n WHERE n.{CON} AND "
                 "NOT EXISTS(SELECT 1 FROM links l WHERE l.a=n.id OR l.b=n.id)"),
             "co_nguon_url": q(f"SELECT count(*) FROM notes WHERE {CON} AND trim(coalesce(url,''))<>''"),
         },
         "luu_tru": {
             "trong_kho_luu": q("SELECT count(*) FROM notes WHERE status='archived'"),
             "da_xoa_han_con_ban_sao": so_xoa,
             "so_ban_sao_luu_toan_kho": so_backup,
             "sao_luu_gan_nhat": datetime.fromtimestamp(moi_nhat).isoformat(timespec="seconds") if moi_nhat else None,
             "tong_dung_luong_mb": round(cho_dia / 1024 / 1024, 1),
             "thu_muc_ban_sao_vinh_vien": str(DELETED_DIR),
         }})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("add"); s.add_argument("--title", required=True); s.add_argument("--content")
    s.add_argument("--content-file"); s.add_argument("--category", default=""); s.add_argument("--tags", default="")
    s.add_argument("--source", default="chat"); s.add_argument("--url", default=""); s.set_defaults(fn=cmd_add)
    s = sub.add_parser("list"); s.add_argument("--tag"); s.add_argument("--category"); s.add_argument("--source")
    s.add_argument("--limit", type=int, default=20)
    s.add_argument("--archived", action="store_true", help="xem ghi chú trong kho lưu")
    s.set_defaults(fn=cmd_list)
    s = sub.add_parser("search"); s.add_argument("query"); s.add_argument("--limit", type=int, default=10)
    s.add_argument("--full", action="store_true")
    s.add_argument("--all", action="store_true", help="tìm cả trong kho lưu"); s.set_defaults(fn=cmd_search)
    s = sub.add_parser("show"); s.add_argument("--id", required=True); s.set_defaults(fn=cmd_show)
    s = sub.add_parser("edit"); s.add_argument("--id", required=True); s.add_argument("--title")
    s.add_argument("--content"); s.add_argument("--content-file"); s.add_argument("--category")
    s.add_argument("--tags"); s.add_argument("--url"); s.add_argument("--append", action="store_true")
    s.set_defaults(fn=cmd_edit)
    s = sub.add_parser("archive"); s.add_argument("--id", required=True); s.set_defaults(fn=cmd_archive)
    s = sub.add_parser("unarchive"); s.add_argument("--id", required=True); s.set_defaults(fn=cmd_unarchive)
    s = sub.add_parser("delete"); s.add_argument("--id", required=True); s.add_argument("--yes", action="store_true"); s.set_defaults(fn=cmd_delete)
    s = sub.add_parser("restore"); s.add_argument("--file", required=True,
                                                  help="đường dẫn file trong deleted/, hoặc id ghi chú")
    s.set_defaults(fn=cmd_restore)
    s = sub.add_parser("link"); s.add_argument("--a", required=True); s.add_argument("--b", required=True); s.set_defaults(fn=cmd_link)
    s = sub.add_parser("suggest-links"); s.add_argument("--id", required=True); s.add_argument("--limit", type=int, default=5); s.set_defaults(fn=cmd_suggest_links)
    s = sub.add_parser("inbox"); s.add_argument("--limit", type=int, default=15); s.set_defaults(fn=cmd_inbox)
    s = sub.add_parser("review"); s.add_argument("--limit", type=int, default=5)
    s.add_argument("--min-age", type=int, default=3, help="chỉ ôn ghi chú cũ hơn N ngày")
    s.add_argument("--category"); s.add_argument("--tag")
    s.add_argument("--done", help="đánh dấu đã ôn: id1,id2"); s.set_defaults(fn=cmd_review)
    s = sub.add_parser("digest"); s.add_argument("--days", type=int, default=7); s.set_defaults(fn=cmd_digest)
    s = sub.add_parser("tags"); s.set_defaults(fn=cmd_tags)
    s = sub.add_parser("retag"); s.add_argument("--from", dest="from_tag", required=True)
    s.add_argument("--to", dest="to_tag", required=True); s.add_argument("--yes", action="store_true")
    s.set_defaults(fn=cmd_retag)
    s = sub.add_parser("duplicates"); s.add_argument("--limit", type=int, default=20)
    s.add_argument("--nguong", type=float, default=0.6, help="tỉ lệ từ khoá trùng, 0-1")
    s.set_defaults(fn=cmd_duplicates)
    s = sub.add_parser("merge"); s.add_argument("--from", dest="from_id", required=True)
    s.add_argument("--into", dest="into_id", required=True); s.add_argument("--yes", action="store_true")
    s.set_defaults(fn=cmd_merge)
    s = sub.add_parser("snapshot"); s.add_argument("--reason", default="dinh-ky"); s.set_defaults(fn=cmd_snapshot)
    s = sub.add_parser("export"); s.add_argument("--out", required=True)
    s.add_argument("--format", choices=["markdown", "json"], default="markdown")
    s.add_argument("--category"); s.add_argument("--tag")
    s.add_argument("--all", action="store_true", help="xuất cả ghi chú trong kho lưu")
    s.add_argument("--since", type=int, help="chỉ lấy ghi chú trong N ngày gần đây"); s.set_defaults(fn=cmd_export)
    s = sub.add_parser("import"); s.add_argument("--file", required=True); s.set_defaults(fn=cmd_import)
    s = sub.add_parser("stats"); s.set_defaults(fn=cmd_stats)
    a = ap.parse_args()
    try:
        db = connect()
    except sqlite3.DatabaseError as e:
        out({"ok": False, "error": f"Không mở được kho {DB_PATH}: {e}. "
                                   "File có thể hỏng — thử bản gần nhất trong backups/ bằng lệnh import."}, 2)
    except OSError as e:
        out({"ok": False, "error": f"Không ghi được vào {DB_PATH.parent}: {e}"}, 2)
    try:
        a.fn(a, db)
    except sqlite3.OperationalError as e:
        if "locked" in str(e).lower():
            out({"ok": False, "error": "Kho đang bị khoá bởi tiến trình khác. "
                                       "Trang web hoặc một lệnh khác đang ghi — thử lại sau vài giây."}, 4)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
