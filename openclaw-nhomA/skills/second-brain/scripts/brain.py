#!/usr/bin/env python3
"""Second Brain: a local, offline note store (SQLite + FTS5). No network, no API keys.

Q&A/synthesis is done by the agent reading `search`/`show` output - this tool never calls an LLM,
so no note ever leaves the machine. Replaces the old Netlify/LLM-endpoint version.
"""
import argparse, gzip, hashlib, json, os, re, sqlite3, sys, textwrap, unicodedata, uuid
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
# Loại kiến thức — trục phân loại thứ hai, độc lập với nhóm (chủ đề) và thẻ.
# Một ghi chú "Landing page" có thể là kết luận, quy trình, hay tài liệu tham khảo: biết loại thì
# lấy ra đúng thứ cần (cần cách làm -> quy-trinh; cần trích dẫn -> tai-lieu; cần việc -> viec).
KINDS = {
    "kien-thuc": "Kiến thức / kết luận rút ra",
    "quy-trinh": "Quy trình / cách làm từng bước",
    "khai-niem": "Khái niệm / định nghĩa",
    "tai-lieu": "Tài liệu / trích dẫn học thuật",
    "y-tuong": "Ý tưởng / giả thuyết chưa kiểm",
    "viec": "Công việc / việc cần làm",
    "nguoi": "Người / khách hàng / đối tác",
    "nhat-ky": "Nhật ký / biên bản họp",
}
MAX_TANG = 3                                   # Vùng / Nhóm / Nhóm con — sâu hơn thì khó tìm, không dễ hơn
COLS = ("id,title,content,category,tags,source,url,created_at,updated_at,reviewed_at,status,"
        "kind,cite,due,done_at,content_hash")
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


def bao_ve_quyen():
    """Kho là dữ liệu riêng: chỉ chủ sở hữu đọc được.

    Tạo mới thì umask 077 lo. Kho tạo bằng bản cũ (thường 644 — user nào trên VPS cũng đọc được)
    thì siết lại, nhưng CHỈ đụng vào file của chính kho, không bao giờ chmod thư mục cha
    (SECOND_BRAIN_DB có thể trỏ vào /tmp hay một thư mục dùng chung).
    """
    for f in (DB_PATH, Path(str(DB_PATH) + "-wal"), Path(str(DB_PATH) + "-shm")):
        try:
            if f.is_file() and f.stat().st_mode & 0o077:
                f.chmod(0o600)
        except OSError:
            pass
    if DB_PATH.parent == WORKSPACE / "second-brain":        # thư mục kho mặc định là của skill này
        for d in (DB_PATH.parent, BACKUP_DIR, DELETED_DIR):
            try:
                if d.is_dir() and d.stat().st_mode & 0o077:
                    d.chmod(0o700)
            except OSError:
                pass


def connect():
    os.umask(0o077)
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
    bao_ve_quyen()
    return db


def nang_cap(db):
    """Kho tạo bằng bản cũ vẫn mở được: thêm cột còn thiếu, không đụng dữ liệu sẵn có."""
    co = {r["name"] for r in db.execute("PRAGMA table_info(notes)")}
    them = False
    for ten, kieu in (("url", "TEXT DEFAULT ''"), ("reviewed_at", "TEXT"),
                      ("status", "TEXT DEFAULT 'active'"), ("kind", "TEXT DEFAULT 'kien-thuc'"),
                      ("cite", "TEXT DEFAULT ''"), ("due", "TEXT"), ("done_at", "TEXT"),
                      ("content_hash", "TEXT")):
        if ten not in co:
            db.execute(f"ALTER TABLE notes ADD COLUMN {ten} {kieu}")
            them = True
    if them:   # chỉ quét cả bảng ngay sau khi nâng cấp, không phải mỗi lần mở kho
        db.execute("UPDATE notes SET status='active' WHERE status IS NULL OR trim(status)=''")
        db.execute("UPDATE notes SET kind='kien-thuc' WHERE kind IS NULL OR trim(kind)=''")
    db.execute("CREATE INDEX IF NOT EXISTS ix_notes_hash ON notes(content_hash)")
    # ghi chú thêm bằng bản cũ (người dùng quay về bản cũ rồi lên lại) chưa có dấu vân tay -> tính bù.
    # Có chỉ mục nên khi không còn dòng nào thiếu, câu này gần như không tốn gì.
    for r in db.execute("SELECT id,title,content FROM notes WHERE content_hash IS NULL").fetchall():
        db.execute("UPDATE notes SET content_hash=?, kind=coalesce(nullif(trim(kind),''),'kien-thuc') WHERE id=?",
                   (van_tay(r["title"], r["content"]), r["id"]))
    db.execute("CREATE INDEX IF NOT EXISTS ix_notes_cat ON notes(status, category)")
    db.execute("CREATE INDEX IF NOT EXISTS ix_notes_kind ON notes(status, kind)")
    db.commit()


# ---------------- chuẩn hoá: nhóm, thẻ, dấu vân tay ----------------
def gon(s):
    """NFC + gộp khoảng trắng. Gõ trên điện thoại/Mac hay ra dấu tách rời (NFD) — không chuẩn hoá
    thì "Lọc nước" gõ hai kiểu thành hai nhóm khác nhau."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s or "")).strip()


def bo_dau(s):
    s = unicodedata.normalize("NFD", (s or "").lower()).replace("đ", "d").replace("đ", "d")
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def van_tay(title, content):
    """Dấu vân tay nội dung: giống hệt nhau (bỏ qua hoa/thường, khoảng trắng, kiểu gõ dấu) là một."""
    t = gon(title).lower() + "\n" + gon(content).lower()
    return hashlib.sha256(t.encode("utf-8")).hexdigest()[:32]


def chuan_nhom(db, raw):
    """Chuẩn hoá đường dẫn nhóm "Vùng/Nhóm/Nhóm con" và khớp với nhóm đã có.

    - "kinh doanh / lọc  nước" -> "Kinh doanh/Lọc nước" nếu kho đã có nhóm đó (khớp không phân biệt hoa/thường)
    - Gõ thiếu dấu ("loc nuoc") KHÔNG tự đổi — chỉ gợi ý, vì "Ban" và "Bán" là hai nghĩa khác nhau
    - Tối đa 3 tầng
    Trả về (đường dẫn chuẩn, danh sách tầng mới tạo, gợi ý, cảnh báo).
    """
    segs = [gon(x) for x in re.split(r"[/\\>›]", raw or "")]
    segs = [x for x in segs if x]
    canh_bao = []
    if len(segs) > MAX_TANG:
        canh_bao.append(f"Nhóm sâu {len(segs)} tầng — chỉ giữ {MAX_TANG} tầng đầu; phần sau nên đưa vào thẻ")
        segs = segs[:MAX_TANG]
    if not segs:
        return "", [], [], canh_bao
    da_co = [r[0] for r in db.execute("SELECT DISTINCT category FROM notes WHERE trim(coalesce(category,''))<>''")]
    cay = {}                                            # (tầng, cha) -> {lower: tên gốc}
    for c in da_co:
        ps = [x for x in c.split("/") if x]
        for i, x in enumerate(ps):
            cay.setdefault((i, "/".join(ps[:i]).lower()), {}).setdefault(x.lower(), x)
    ra, moi, goi_y = [], [], []
    for i, x in enumerate(segs):
        cung_cap = cay.get((i, "/".join(ra).lower()), {})
        if x.lower() in cung_cap:
            ra.append(cung_cap[x.lower()])
            continue
        gan = [v for k, v in cung_cap.items() if bo_dau(k) == bo_dau(x)]
        if not gan:                                     # gõ sai chính tả: "Maketing" ~ "Marketing"
            import difflib
            khop = difflib.get_close_matches(bo_dau(x), [bo_dau(k) for k in cung_cap], n=1, cutoff=0.82)
            gan = [v for k, v in cung_cap.items() if khop and bo_dau(k) == khop[0]]
        if gan:
            goi_y.append(f"Nhóm '{x}' rất giống nhóm đã có '{gan[0]}' — nếu cùng ý thì sửa lại cho dùng chung nhóm")
        ten = x[:1].upper() + x[1:]
        ra.append(ten)
        moi.append("/".join(ra))
    return "/".join(ra), moi, goi_y, canh_bao


def goi_y_the(db, tags_csv):
    """Thẻ mới mà chỉ khác thẻ cũ ở dấu ("phu-de" vs "phụ-đề") -> gợi ý dùng lại thẻ cũ."""
    if not tags_csv:
        return []
    cu = {}
    for r in db.execute(f"SELECT tags FROM notes WHERE {CON}"):
        for t in (r["tags"] or "").split(","):
            if t:
                cu.setdefault(bo_dau(t), set()).add(t)
    ra = []
    for t in tags_csv.split(","):
        khac = sorted(cu.get(bo_dau(t), set()) - {t})
        if khac and t not in {x for v in cu.values() for x in v}:
            ra.append(f"Thẻ '{t}' gần giống thẻ đã có '{khac[0]}' — nên dùng chung một thẻ")
    return ra


def chuan_kind(k):
    k = bo_dau(gon(k or "kien-thuc")).replace(" ", "-")
    bi_danh = {"kien-thuc": "kien-thuc", "ket-luan": "kien-thuc", "knowledge": "kien-thuc",
               "quy-trinh": "quy-trinh", "cach-lam": "quy-trinh", "how-to": "quy-trinh", "howto": "quy-trinh",
               "khai-niem": "khai-niem", "dinh-nghia": "khai-niem", "concept": "khai-niem",
               "tai-lieu": "tai-lieu", "trich-dan": "tai-lieu", "hoc-thuat": "tai-lieu", "reference": "tai-lieu",
               "y-tuong": "y-tuong", "idea": "y-tuong", "viec": "viec", "cong-viec": "viec", "task": "viec",
               "todo": "viec", "nguoi": "nguoi", "khach-hang": "nguoi", "person": "nguoi",
               "nhat-ky": "nhat-ky", "hop": "nhat-ky", "bien-ban": "nhat-ky", "meeting": "nhat-ky", "log": "nhat-ky"}
    if k not in bi_danh:
        return None
    return bi_danh[k]


def chuan_han(d):
    """Hạn công việc: nhận 2026-11-05, 5/11/2026, 05-11-2026. Trả về YYYY-MM-DD hoặc None."""
    d = (d or "").strip()
    if not d:
        return None
    for f in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(d, f).strftime("%Y-%m-%d")
        except ValueError:
            pass
    raise ValueError(f"Hạn '{d}' không đọc được — ghi dạng 2026-11-05 hoặc 5/11/2026")


def loc_nhom(where, params, category, cot="category"):
    """Lọc theo nhóm, GỒM cả nhóm con: "Kinh doanh" lấy cả "Kinh doanh/Lọc nước"."""
    if category:
        c = "/".join(gon(x) for x in category.split("/") if gon(x))
        where.append(f"(lower({cot})=lower(?) OR lower({cot}) LIKE lower(?) ESCAPE '\\')")
        params += [c, c.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "/%"]


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
    d = {k: r[k] for k in r.keys() if not k.startswith("_") and k != "content_hash"}
    d["tags"] = [t for t in (d.get("tags") or "").split(",") if t]
    if snippet is not None:
        d["snippet"] = snippet
    return d


def them_note(db, nid, title, content, category="", tags="", source="chat", url="",
              created=None, updated=None, reviewed=None, status="active",
              kind="kien-thuc", cite="", due=None, done_at=None):
    t = now()
    title, content = gon(title), content.strip()
    db.execute(f"INSERT INTO notes({COLS}) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (nid, title, content, category, tags, source, url,
                created or t, updated or t, reviewed, status or "active",
                kind or "kien-thuc", cite or "", due, done_at, van_tay(title, content)))


def trung_hoan_toan(db, title, content, bo_qua=None):
    r = db.execute("SELECT id,title,status FROM notes WHERE content_hash=?" + (" AND id<>?" if bo_qua else ""),
                   (van_tay(title, content),) + ((bo_qua,) if bo_qua else ())).fetchone()
    return dict(r) if r else None


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
           "không phải người nhiều trên dưới theo bằng hoặc nhau luôn chỉ thôi rằng việc điều cách hơn lại mới chưa "
           "thấy biết muốn giúp nhất thành đang đều vẫn rồi nên sẽ còn ra vào lên xuống qua tại bị do vì nào gì ai "
           "làm hết sang "
           "đây kia vậy thế rất quá lắm hãy đừng cần nữa mà hay ở đã the and for with that this from you your are was "
           "have has not but can will all any into than then them they what when which".split())


def _tu(text):
    return re.findall(r"\w+", (text or "").lower())[:20000]


def tu_khoa(text, n=8):
    """Từ khoá đặc trưng của một đoạn văn.

    Tiếng Việt là tiếng đơn âm: "phụ đề", "dấu phẩy", "bất động sản" mới là đơn vị nghĩa, còn từng
    âm tiết ("phụ", "đề") thì ngắn và mơ hồ. Bản cũ chỉ lấy từ ≥4 ký tự nên gần như bỏ sót hết từ
    tiếng Việt. Ở đây lấy cả cụm 2 âm tiết liền nhau (không chứa từ vô nghĩa) lẫn từ đơn dài.
    """
    # Counter chứ không phải words.count() trong vòng lặp: ghi chú dài vài nghìn từ
    # mà đếm kiểu cũ là O(n²), đủ để treo máy.
    ws = _tu(text)
    dem = Counter(w for w in ws if len(w) >= 4 and w not in STOP and not w.isdigit())
    for x, y in zip(ws, ws[1:]):
        if x in STOP or y in STOP or len(x) < 2 or len(y) < 2 or (x.isdigit() and y.isdigit()):
            continue
        dem[x + " " + y] += 1.5          # cụm từ mang nghĩa rõ hơn từ đơn
    return [w for w, _ in dem.most_common(n)]


def dac_trung(text, n=24):
    """Dấu vân tay của một ghi chú để so trùng: từ đơn dài + cặp âm tiết liền nhau.

    Âm tiết tiếng Việt đứng riêng ("ngân", "phụ") quá mơ hồ — so bằng chúng thì hai ghi chú chẳng
    liên quan cũng bị coi là giống. Cặp liền nhau ("dấu chấm", "mili giây") mới giữ được nghĩa,
    nên ghi chú viết lại bằng câu khác vẫn khớp mà ghi chú khác chủ đề thì không.
    """
    ws, dem = _tu(text), Counter()
    for w in ws:
        if len(w) >= 4 and w not in STOP and not w.isdigit():
            dem[w] += 1
    for x, y in zip(ws, ws[1:]):
        if x not in STOP and y not in STOP and len(x) >= 2 and len(y) >= 2:
            dem[x + " " + y] += 1
    return [w for w, _ in dem.most_common(n)]


def _van_ban(*phan):
    """Chuỗi để so từ khoá: chữ thường, mọi khoảng trắng/xuống dòng/dấu câu gộp thành một dấu cách."""
    return " " + " ".join(_tu(" ".join(p or "" for p in phan))) + " "


def _co(w, vb):
    return f" {w} " in vb


def tim_tuong_tu(db, title, content, bo_qua=None, limit=3, nguong=0.5):
    """Tìm ghi chú đã có gần giống — để cảnh báo trùng, không chặn.

    Cùng thước đo với lệnh duplicates: tỉ lệ từ đặc trưng trùng nhau trên ghi chú ngắn hơn.
    """
    mine = dac_trung(title + " " + content)
    if len(mine) < 3:
        return []
    q = " OR ".join(f'"{w}"' for w in mine)
    try:
        rows = db.execute("SELECT n.id,n.title,n.content FROM notes_fts f JOIN notes n ON n.rowid=f.rowid "
                          f"WHERE notes_fts MATCH ? AND n.{CON} ORDER BY bm25(notes_fts) LIMIT 30", (q,)).fetchall()
    except sqlite3.OperationalError:
        return []
    A, ra = set(mine), []
    for x in rows:
        if bo_qua and x["id"] == bo_qua:
            continue
        B = set(dac_trung(x["title"] + " " + x["content"]))
        chung = A & B
        if B and len(chung) >= 3 and len(chung) / min(len(A), len(B)) >= nguong:
            ra.append({"id": x["id"], "title": x["title"], "giong": round(len(chung) / min(len(A), len(B)), 2),
                       "shared_keywords": sorted(chung)[:8]})
    ra.sort(key=lambda d: -d["giong"])
    return ra[:limit]


# ---------------- commands ----------------
def cmd_add(a, db):
    content = read_content(a)
    title = gon(a.title)
    if not title or not content.strip():
        out({"ok": False, "error": "Cần --title và nội dung (--content, --content-file hoặc stdin với --content -)"}, 2)
    if a.source not in SOURCES:
        out({"ok": False, "error": f"--source phải thuộc {SOURCES}"}, 2)
    kind = chuan_kind(a.kind)
    if not kind:
        out({"ok": False, "error": f"--kind '{a.kind}' không có. Dùng một trong: {', '.join(KINDS)}"}, 2)
    try:
        due = chuan_han(a.due)
    except ValueError as e:
        out({"ok": False, "error": str(e)}, 2)
    # Lớp 1: trùng y hệt -> không thêm bản thứ hai (trừ khi --force)
    trung = trung_hoan_toan(db, title, content)
    if trung and not a.force:
        out({"ok": True, "trung_hoan_toan": trung["id"], "title": trung["title"], "da_them": False,
             "note": "Kho đã có ghi chú y hệt" + (" (đang ở kho lưu — unarchive để dùng lại)" if trung["status"] == "archived" else "")
                     + ". Không thêm bản trùng; muốn thêm vẫn thêm thì dùng --force."})
    nhom, nhom_moi, goi_y, canh_bao = chuan_nhom(db, a.category)
    tags = norm_tags(a.tags)
    goi_y += goi_y_the(db, tags)
    # Lớp 2: gần giống -> vẫn lưu, nhưng nhắc
    giong = tim_tuong_tu(db, title, content.strip())
    nid = uuid.uuid4().hex[:12]
    them_note(db, nid, title, content, nhom, tags, a.source, (a.url or "").strip(),
              kind=kind, cite=gon(a.cite), due=due)
    db.commit()
    kq = {"ok": True, "id": nid, "title": title, "kind": kind, "category": nhom, "tags": [t for t in tags.split(",") if t],
          "db": str(DB_PATH)}
    if nhom_moi:
        kq["nhom_moi"] = nhom_moi
    if goi_y:
        kq["goi_y"] = goi_y
    if canh_bao:
        kq["canh_bao"] = canh_bao
    if giong:
        kq["similar_existing"] = giong
        kq["hint"] = ("Kho đã có ghi chú gần giống. Hỏi người dùng: gộp vào ghi chú cũ "
                      f"(merge --from {nid} --into <id cũ> --yes — ghi chú vừa tạo được cất kho, không mất), "
                      "hay giữ cả hai rồi link lại?")
    if not nhom:
        kq["nhac"] = "Chưa có nhóm — ghi chú nằm ở 'Chưa xếp chỗ'. Xem các nhóm sẵn có: categories"
    out(kq)


def cmd_list(a, db):
    sql, params = "SELECT * FROM notes", []
    where = ["status='archived'"] if a.archived else [CON]
    if a.tag:
        where.append("(',' || tags || ',') LIKE ?")
        params.append(f"%,{a.tag.lstrip('#').lower()},%")
    loc_nhom(where, params, a.category)
    if a.kind:
        where.append("kind=?")
        params.append(chuan_kind(a.kind) or a.kind)
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


def _tim(db, q, limit, ca_kho=False, category=None, kind=None):
    """Tìm toàn văn. Trả về (các dòng, chế độ).

    chế độ "chinh_xac": mọi từ đều phải có (FTS mặc định AND).
    chế độ "mo_rong":   không ghi chú nào có đủ mọi từ, nên lấy ghi chú có NHIỀU từ nhất (OR, xếp theo bm25).
    Nhờ vậy câu hỏi dài kiểu "anh từng ghi gì về lỗi phụ đề không hiện" vẫn ra kết quả,
    thay vì agent phải đoán lại từ khoá nhiều lần.
    """
    them, tham = [], []
    loc_nhom(them, tham, category, "n.category")
    if kind:
        them.append("n.kind=?")
        tham.append(kind)
    # bm25 trọng số: tiêu đề x4, thẻ x3, nhóm x2, nội dung x1 — khớp ở tiêu đề quan trọng hơn khớp giữa bài
    sql = ("SELECT n.*, snippet(notes_fts, 1, '«', '»', '…', 14) AS snip FROM notes_fts f "
           "JOIN notes n ON n.rowid = f.rowid WHERE notes_fts MATCH ?" +
           ("" if ca_kho else f" AND n.{CON}") + "".join(" AND " + w for w in them) +
           " ORDER BY bm25(notes_fts, 4.0, 1.0, 3.0, 2.0) LIMIT ?")
    try:
        rows = db.execute(sql, (q, *tham, limit)).fetchall()
    except sqlite3.OperationalError:   # user typed FTS operators wrongly -> fall back to a plain phrase
        rows = db.execute(sql, ('"' + q.replace('"', " ") + '"', *tham, limit)).fetchall()
    if rows:
        return rows, "chinh_xac"
    tu = [w for w in dict.fromkeys(_tu(q)) if w not in STOP]
    if len(tu) < 2:
        return rows, "chinh_xac"
    return db.execute(sql, (" OR ".join(f'"{w}"' for w in tu[:16]), *tham, limit)).fetchall(), "mo_rong"


def cmd_search(a, db):
    q = a.query.strip()
    if not q:
        out({"ok": False, "error": "Thiếu từ khoá"}, 2)
    notes = []
    rows, che_do = _tim(db, q, a.limit, a.all, a.category, chuan_kind(a.kind) if a.kind else None)
    for r in rows:
        d = row_dict(r, snippet=r["snip"])
        d.pop("snip", None)
        d["content"] = d["content"] if a.full else rut_gon(d["content"], 200)
        notes.append(d)
    kq = {"ok": True, "query": q, "count": len(notes), "che_do": che_do, "notes": notes}
    if che_do == "mo_rong" and notes:
        kq["note"] = ("Không ghi chú nào chứa đủ mọi từ; đây là các ghi chú khớp NHIỀU từ nhất. "
                      "Đọc kỹ trước khi dẫn — có thể chỉ liên quan một phần.")
    out(kq)


def cmd_show(a, db):
    r = db.execute("SELECT * FROM notes WHERE id=?", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id}"}, 2)
    d = row_dict(r)
    linked = [x["b"] for x in db.execute("SELECT b FROM links WHERE a=?", (a.id,))] + \
             [x["a"] for x in db.execute("SELECT a FROM links WHERE b=?", (a.id,))]
    d["linked_notes"] = sorted(set(linked))
    d["linked"] = [{"id": x["id"], "title": x["title"], "kind": x["kind"]} for x in db.execute(
        f"SELECT id,title,kind FROM notes WHERE id IN ({','.join('?' * len(d['linked_notes']))})",
        d["linked_notes"])] if d["linked_notes"] else []
    d["loai"] = KINDS.get(d.get("kind") or "", "")
    out({"ok": True, "note": d})


def sua_note(db, r, title=None, content=None, category=None, tags=None, url=None,
             kind=None, cite=None, due=None):
    """Một chỗ duy nhất sửa ghi chú (dòng lệnh, trang web, gộp đều đi qua đây): chuẩn hoá nhóm/thẻ/loại,
    tính lại dấu vân tay, chặn sửa thành bản trùng y hệt ghi chú khác. Trả về (ok, thông tin)."""
    title = gon(title) if title else r["title"]
    content = content.strip() if content and content.strip() else r["content"]
    info = {}
    if category is not None:
        category, moi, goi_y, cb = chuan_nhom(db, category)
        if moi:
            info["nhom_moi"] = moi
        if goi_y:
            info["goi_y"] = goi_y
        if cb:
            info["canh_bao"] = cb
    else:
        category = r["category"]
    if kind is not None:
        k = chuan_kind(kind)
        if not k:
            return False, {"error": f"Loại '{kind}' không có. Dùng: {', '.join(KINDS)}"}
        kind = k
    else:
        kind = r["kind"] or "kien-thuc"
    if due is not None:
        try:
            due = chuan_han(due)
        except ValueError as e:
            return False, {"error": str(e)}
    else:
        due = r["due"]
    trung = trung_hoan_toan(db, title, content, bo_qua=r["id"])
    if trung:
        return False, {"error": f"Sửa xong sẽ y hệt ghi chú '{trung['title']}' ({trung['id']}) — gộp bằng merge thay vì sửa"}
    db.execute("UPDATE notes SET title=?, content=?, category=?, tags=?, url=?, kind=?, cite=?, due=?, "
               "content_hash=?, updated_at=? WHERE id=?",
               (title, content, category, norm_tags(tags) if tags is not None else r["tags"],
                (url if url is not None else (r["url"] or "")).strip(), kind,
                gon(cite) if cite is not None else (r["cite"] or ""), due,
                van_tay(title, content), now(), r["id"]))
    db.commit()
    return True, info


def cmd_edit(a, db):
    r = db.execute("SELECT * FROM notes WHERE id=?", (a.id,)).fetchone()
    if not r:
        out({"ok": False, "error": f"Không thấy ghi chú {a.id}"}, 2)
    co_noi_dung_moi = bool(a.content or a.content_file)
    if a.append and not co_noi_dung_moi:
        # trước đây chỗ này nối ghi chú với chính nó, nhân đôi nội dung
        out({"ok": False, "error": "--append cần kèm --content hoặc --content-file"}, 2)
    content = read_content(a) if co_noi_dung_moi else None
    if a.append:
        content = r["content"].rstrip() + "\n\n" + content.strip()
    ok, info = sua_note(db, r, a.title, content, a.category, a.tags, a.url, a.kind, a.cite, a.due)
    if not ok:
        out({"ok": False, **info}, 2)
    out({"ok": True, "id": a.id, "updated": True, **info})


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
    trung = trung_hoan_toan(db, d.get("title") or "", d.get("content") or "")
    if trung:                    # chạy restore hai lần không được đẻ ra hai bản giống hệt
        out({"ok": True, "lay_lai": trung["id"], "note": "Ghi chú này đã có trong kho, không thêm bản trùng"})
    nid = d.get("id") or uuid.uuid4().hex[:12]
    if db.execute("SELECT 1 FROM notes WHERE id=?", (nid,)).fetchone():
        nid = uuid.uuid4().hex[:12]
    tags = d.get("tags")
    them_note(db, nid, d["title"], d["content"], d.get("category", ""),
              norm_tags(",".join(tags) if isinstance(tags, list) else (tags or "")),
              d.get("source", "other"), d.get("url", ""),
              d.get("created_at"), now(), d.get("reviewed_at"), "active",
              chuan_kind(d.get("kind")) or "kien-thuc", d.get("cite") or "", d.get("due"), d.get("done_at"))
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
        vb = _van_ban(x["title"], x["content"], (x["tags"] or "").replace("-", " "))
        shared = [w for w in top if _co(w, vb)]
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
    # việc đã xong và việc nói chung không cần "ôn" — ôn là cho kiến thức
    where, params = [CON, "created_at < ?", "kind<>'viec'"], [days_ago(a.min_age)]
    loc_nhom(where, params, a.category)
    if a.kind:
        where.append("kind=?")
        params.append(chuan_kind(a.kind) or a.kind)
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
    bo = {r["id"]: set(dac_trung(r["title"] + " " + r["content"])) for r in rows}
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
    db.execute("UPDATE notes SET content=?, tags=?, url=?, cite=?, content_hash=?, updated_at=? WHERE id=?",
               (noi_dung, ",".join(the), dich["url"] or nguon["url"] or "",
                dich["cite"] or nguon["cite"] or "", van_tay(dich["title"], noi_dung), now(), a.into_id))
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


def ban_sao_sqlite(db):
    """Bản sao .sqlite NHẤT QUÁN của cả kho, dùng API backup của SQLite.

    Không được chép thẳng notes.sqlite: kho chạy chế độ WAL, ghi chú mới có thể còn nằm trong
    notes.sqlite-wal — chép mỗi file chính là được một kho thiếu, thậm chí rỗng.
    Chỉ giữ MỘT file (ghi đè mỗi lần) để không tốn đĩa; lịch sử nhiều bản đã có ở *.json.gz.
    """
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BACKUP_DIR / "notes-latest.sqlite"
    tmp = dest.with_name(dest.name + ".tmp")
    if tmp.exists():
        tmp.unlink()
    dst = sqlite3.connect(tmp)
    try:
        db.backup(dst)
        dst.execute("PRAGMA journal_mode=DELETE")   # một file duy nhất, mở ở đâu cũng đủ dữ liệu
    finally:
        dst.close()
    os.replace(tmp, dest)                           # thay một lần: đang chép dở thì bản cũ vẫn còn nguyên
    return dest


def cmd_snapshot(a, db):
    """Sao lưu chủ động — để đặt lịch chạy hằng ngày trên VPS."""
    b = backup(db, a.reason)
    s = ban_sao_sqlite(db)
    tong = db.execute("SELECT count(*) c FROM notes").fetchone()["c"]
    out({"ok": True, "file": str(b), "ban_sao_sqlite": str(s), "ghi_chu_trong_ban": tong,
         "giu_lai": KEEP_BACKUPS, "thu_muc": str(BACKUP_DIR),
         "note": "Kéo về máy cá nhân file ban_sao_sqlite (KHÔNG chép thẳng notes.sqlite)."})


def cmd_doctor(a, db):
    """Khám sức khoẻ kho: file có hỏng không, chỉ mục tìm kiếm có khớp không, sao lưu có đều không."""
    loi, nhac, da_sua = [], [], []
    kq = db.execute("PRAGMA integrity_check").fetchone()[0]
    if kq != "ok":
        loi.append(f"File kho hỏng ({kq}). Dừng ghi; khôi phục: import --file <bản .json.gz mới nhất trong backups/> "
                   "vào kho mới, hoặc dùng backups/notes-latest.sqlite")
    try:
        # rank=1: so chỉ mục với bảng notes thật (không có nó, FTS5 chỉ tự kiểm nội bộ và bỏ sót chỗ lệch)
        db.execute("INSERT INTO notes_fts(notes_fts, rank) VALUES('integrity-check', 1)")
    except sqlite3.DatabaseError:
        # dựng lại chỉ mục chỉ đọc từ bảng notes, không đụng ghi chú — sai thì cũng vô hại
        if a.fix:
            db.execute("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')")
            db.commit()
            da_sua.append("Đã dựng lại chỉ mục tìm kiếm")
        else:
            loi.append("Chỉ mục tìm kiếm lệch với ghi chú (tìm sẽ thiếu kết quả). Sửa: doctor --fix")
    mo_coi = db.execute("SELECT count(*) FROM links l WHERE NOT EXISTS(SELECT 1 FROM notes WHERE id=l.a) "
                        "OR NOT EXISTS(SELECT 1 FROM notes WHERE id=l.b)").fetchone()[0]
    if mo_coi:
        if a.fix:
            db.execute("DELETE FROM links WHERE a NOT IN (SELECT id FROM notes) OR b NOT IN (SELECT id FROM notes)")
            db.commit()
            da_sua.append(f"Đã bỏ {mo_coi} liên kết trỏ tới ghi chú không còn")
        else:
            nhac.append(f"{mo_coi} liên kết trỏ tới ghi chú không còn. Sửa: doctor --fix")
    for f in (DB_PATH, BACKUP_DIR, DELETED_DIR):
        try:
            if f.exists() and f.stat().st_mode & 0o077:
                nhac.append(f"{f} user khác đọc được — chmod {'700' if f.is_dir() else '600'} {f}")
        except OSError:
            pass
    ds = ds_backup()
    if not ds:
        nhac.append("Chưa có bản sao lưu nào. Chạy: snapshot, và đặt lịch hằng ngày (xem SKILL.md)")
    else:
        tuoi = (datetime.now().timestamp() - max(f.stat().st_mtime for f in ds)) / 86400
        if tuoi > 2:
            nhac.append(f"Bản sao lưu mới nhất đã {tuoi:.0f} ngày — lịch sao lưu hằng ngày có thể đã ngừng (crontab -l)")
    if not (BACKUP_DIR / "notes-latest.sqlite").is_file():
        nhac.append("Chưa có backups/notes-latest.sqlite để kéo về máy cá nhân. Chạy: snapshot")
    try:
        du = os.statvfs(DB_PATH.parent)
        trong_mb = du.f_bavail * du.f_frsize / 1024 / 1024
        if trong_mb < 200:
            nhac.append(f"Ổ đĩa chỉ còn {trong_mb:.0f} MB — hết đĩa là không ghi được ghi chú")
    except OSError:
        pass
    out({"ok": not loi, "loi": loi, "nhac": nhac, "da_sua": da_sua,
         "ghi_chu": db.execute(f"SELECT count(*) FROM notes WHERE {CON}").fetchone()[0],
         "ket_luan": "Kho khoẻ" if not loi and not nhac else ("Có lỗi cần xử lý" if loi else "Kho ổn, có vài việc nên làm")},
        0 if not loi else 1)


def cmd_export(a, db):
    where, params = ([] if a.all else [CON]), []
    loc_nhom(where, params, a.category)
    if a.kind:
        where.append("kind=?")
        params.append(chuan_kind(a.kind) or a.kind)
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
            nhom = (n['category'] or 'Chưa phân loại').replace("/", " › ")
            dong = f"*{nhom}* · {KINDS.get(n.get('kind') or '', '')} · {tags} · {n['created_at'][:10]} · `{n['id']}`"
            if n.get("url"):
                dong += f"\n\nNguồn: {n['url']}"
            if n.get("cite"):
                dong += f"\n\nTrích dẫn: {n['cite']}"
            if n.get("due"):
                dong += f"\n\nHạn: {n['due']}" + (" (đã xong)" if n.get("done_at") else "")
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
        if trung_hoan_toan(db, title, content):
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
                  "archived" if it.get("status") == "archived" else "active",
                  chuan_kind(it.get("kind")) or "kien-thuc", it.get("cite") or "",
                  it.get("due"), it.get("done_at"))
        added += 1
    db.commit()
    out({"ok": True, "added": added, "skipped_duplicate_or_empty": skipped, "backup": str(b) if b else None})


# ---------------- phân loại: cây nhóm, loại ----------------
def cay_nhom(db, ca_kho=False):
    """Cây Vùng/Nhóm/Nhóm con kèm số ghi chú (của riêng nút và gồm cả nhóm con)."""
    goc = {"ten": "", "duong_dan": "", "rieng": 0, "tong": 0, "con": {}}
    for r in db.execute("SELECT category, count(*) n FROM notes WHERE " + ("1" if ca_kho else CON) +
                        " GROUP BY category"):
        ps = [x for x in (r["category"] or "").split("/") if x] or ["Chưa xếp chỗ"]
        nut = goc
        nut["tong"] += r["n"]
        for i, x in enumerate(ps):
            nut = nut["con"].setdefault(x, {"ten": x, "duong_dan": "/".join(ps[:i + 1]) if r["category"] else "",
                                            "rieng": 0, "tong": 0, "con": {}})
            nut["tong"] += r["n"]
        nut["rieng"] += r["n"]

    def ra_list(nut):
        con = sorted(nut["con"].values(), key=lambda x: (x["ten"] == "Chưa xếp chỗ", -x["tong"], x["ten"]))
        return [{"ten": c["ten"], "duong_dan": c["duong_dan"], "so": c["tong"], "rieng": c["rieng"],
                 "con": ra_list(c)} for c in con]
    return ra_list(goc), goc["tong"]


def cmd_categories(a, db):
    cay, tong = cay_nhom(db)

    def ve(ds, sau=0):
        for c in ds:
            yield "  " * sau + f"{c['ten']} ({c['so']})"
            yield from ve(c["con"], sau + 1)
    out({"ok": True, "tong": tong, "cay": cay, "dang_chu": list(ve(cay)),
         "note": "Dùng lại đúng đường dẫn nhóm đã có (duong_dan). Chỉ tạo nhóm mới khi không nhóm nào hợp; "
                 f"tối đa {MAX_TANG} tầng: Vùng/Nhóm/Nhóm con."})


def cmd_kinds(a, db):
    dem = {r[0]: r[1] for r in db.execute(f"SELECT kind, count(*) FROM notes WHERE {CON} GROUP BY kind")}
    out({"ok": True, "loai": [{"kind": k, "mo_ta": v, "so": dem.get(k, 0)} for k, v in KINDS.items()]})


# ---------------- công việc ----------------
def danh_dau_viec(db, ids, xong=True):
    n = 0
    for i in [x.strip() for x in ids.split(",") if x.strip()]:
        n += db.execute("UPDATE notes SET done_at=?, updated_at=? WHERE id=? AND kind='viec'",
                        (now() if xong else None, now(), i)).rowcount
    db.commit()
    return n


def cmd_viec(a, db):
    """Việc cần làm: một loại ghi chú có hạn và trạng thái xong."""
    for ids, xong in ((a.xong, True), (a.mo_lai, False)):
        if ids:
            n = danh_dau_viec(db, ids, xong)
            out({"ok": bool(n), "da_cap_nhat": n, **({} if n else {"error": "Không thấy việc nào với id đó"})},
                0 if n else 2)
    out({"ok": True, **ds_viec(db, a.category, a.tat_ca),
         "note": "Thêm việc: add --kind viec --due 2026-11-05. Xong: viec --xong <id>."})


def ds_viec(db, category=None, tat_ca=False):
    where, params = [CON, "kind='viec'"], []
    if not tat_ca:
        where.append("done_at IS NULL")
    loc_nhom(where, params, category)
    rows = db.execute("SELECT * FROM notes WHERE " + " AND ".join(where) +
                      " ORDER BY done_at IS NOT NULL, due IS NULL, due, created_at", params).fetchall()
    hom_nay = datetime.now().strftime("%Y-%m-%d")
    tuan = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    nhom = {"qua_han": [], "hom_nay": [], "7_ngay_toi": [], "sau_nay": [], "khong_han": [], "da_xong": []}
    for r in rows:
        d = {"id": r["id"], "title": r["title"], "due": r["due"], "category": r["category"],
             "tom_tat": rut_gon(r["content"], 120)}
        if r["done_at"]:
            nhom["da_xong"].append(d)
        elif not r["due"]:
            nhom["khong_han"].append(d)
        elif r["due"] < hom_nay:
            nhom["qua_han"].append(d)
        elif r["due"] == hom_nay:
            nhom["hom_nay"].append(d)
        elif r["due"] <= tuan:
            nhom["7_ngay_toi"].append(d)
        else:
            nhom["sau_nay"].append(d)
    return {"dang_mo": sum(len(v) for k, v in nhom.items() if k != "da_xong"),
            **{k: v for k, v in nhom.items() if v or k != "da_xong"}}


# ---------------- nạp kiến thức từ nhiều nguồn ----------------
NAP_DUOI = {".md", ".markdown", ".txt", ".pdf", ".csv", ".json", ".gz", ".html", ".htm"}
NAP_MAX_FILE = 5 * 1024 * 1024
NAP_MAX_SO_FILE = 2000


def _frontmatter(text):
    """--- key: value --- ở đầu file Markdown (kiểu Obsidian). Chỉ đọc cặp key: value đơn giản."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        if _ and k.strip():
            v = v.strip().strip("\"'")
            if v.startswith("[") and v.endswith("]"):
                v = ",".join(x.strip().strip("\"'") for x in v[1:-1].split(","))
            meta[k.strip().lower()] = v
    return meta, text[m.end():]


def _tieu_de_tu_ten(path):
    t = re.sub(r"[-_]+", " ", Path(path).stem).strip()
    return t[:1].upper() + t[1:] if t else "Không tên"


def _tach_markdown(text, tach, mac_dinh_tieu_de, dung_dong_dau=False):
    """Tách Markdown theo tiêu đề # / ##. Mỗi mục có nội dung thành một ghi chú."""
    dong = text.splitlines()
    vi_tri = [i for i, l in enumerate(dong) if re.match(r"^#{1,2}\s+\S", l)]
    if not vi_tri or tach == "khong" or (tach != "heading" and len(vi_tri) < 2):
        tieu_de = mac_dinh_tieu_de
        if vi_tri and vi_tri[0] < 3:            # tiêu đề nằm ngay đầu file thì dùng làm tên ghi chú
            tieu_de = re.sub(r"^#+\s*", "", dong[vi_tri[0]]).strip()
            dong = dong[:vi_tri[0]] + dong[vi_tri[0] + 1:]
        elif dung_dong_dau:
            # văn bản thường: dòng đầu ngắn, không kết thúc bằng dấu câu -> đó là tên (giữ được dấu tiếng Việt,
            # tên file thường bị bỏ dấu)
            dau = next((i for i, l in enumerate(dong) if l.strip()), None)
            if dau is not None and len(dong[dau].strip()) <= 100 and not dong[dau].strip().endswith((".", ",", ";", ":")) \
                    and any(l.strip() for l in dong[dau + 1:]):
                tieu_de = dong[dau].strip()
                dong = dong[dau + 1:]
        return [(tieu_de, "\n".join(dong).strip())]
    ra = []
    dau = "\n".join(dong[:vi_tri[0]]).strip()
    if len(dau) > 40:
        ra.append((mac_dinh_tieu_de, dau))
    for k, i in enumerate(vi_tri):
        j = vi_tri[k + 1] if k + 1 < len(vi_tri) else len(dong)
        ra.append((re.sub(r"^#+\s*", "", dong[i]).strip(), "\n".join(dong[i + 1:j]).strip()))
    return ra


def _doc_html(text):
    from html.parser import HTMLParser

    class P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.chu, self.title, self._bo, self._t = [], "", 0, False

        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style", "noscript", "nav", "footer"):
                self._bo += 1
            self._t = tag == "title"
            if tag in ("p", "br", "li", "h1", "h2", "h3", "h4", "tr", "div"):
                self.chu.append("\n")

        def handle_endtag(self, tag):
            if tag in ("script", "style", "noscript", "nav", "footer") and self._bo:
                self._bo -= 1
            self._t = False

        def handle_data(self, d):
            if self._t:
                self.title += d
            elif not self._bo:
                self.chu.append(d)
    p = P()
    p.feed(text)
    noi_dung = re.sub(r"\n\s*\n+", "\n\n", re.sub(r"[ \t]+", " ", "".join(p.chu))).strip()
    return gon(p.title), noi_dung


def doc_nguon(path, tach):
    """Đọc một file thành danh sách mục {title, content, ...}. Ném ValueError khi không đọc được."""
    f = Path(path)
    if f.stat().st_size > NAP_MAX_FILE:
        raise ValueError(f"lớn hơn {NAP_MAX_FILE // 1024 // 1024} MB — tách nhỏ hoặc trích phần cần thiết")
    duoi = "".join(f.suffixes[-2:]).lower() if f.name.lower().endswith(".json.gz") else f.suffix.lower()
    ten = _tieu_de_tu_ten(f)
    if duoi in (".md", ".markdown", ".txt"):
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raise ValueError("không phải văn bản UTF-8")
        meta, than = _frontmatter(text)
        tieu_de = meta.get("title") or meta.get("tieu_de") or ten
        muc = _tach_markdown(than, tach, tieu_de, dung_dong_dau=not (meta.get("title") or meta.get("tieu_de")))
        chung = {"category": meta.get("category") or meta.get("nhom") or "",
                 "tags": meta.get("tags") or meta.get("the") or "", "kind": meta.get("kind") or meta.get("loai"),
                 "url": meta.get("url") or meta.get("source") or meta.get("nguon") or "",
                 "cite": meta.get("cite") or meta.get("trich_dan") or "", "due": meta.get("due") or meta.get("han")}
        return [{"title": t, "content": c, **chung} for t, c in muc]
    if duoi == ".pdf":
        import shutil, subprocess
        if not shutil.which("pdftotext"):
            raise ValueError("cần pdftotext (sudo apt install -y poppler-utils)")
        r = subprocess.run(["pdftotext", "-enc", "UTF-8", str(f.resolve()), "-"], capture_output=True, text=True)
        if r.returncode:
            raise ValueError("pdftotext lỗi: " + (r.stderr or "").strip()[:150])
        trang = [unicodedata.normalize("NFC", x).strip() for x in r.stdout.split("\f")]
        if not any(trang):
            raise ValueError("PDF không có lớp chữ (PDF scan) — cần OCR trước")
        if tach == "trang":
            return [{"title": f"{ten} — trang {i}", "content": t, "cite": f"{ten}, tr. {i}"}
                    for i, t in enumerate(trang, 1) if len(t) > 40]
        return [{"title": ten, "content": "\n\n".join(t for t in trang if t), "cite": ten}]
    if duoi in (".html", ".htm"):
        tieu_de, noi_dung = _doc_html(f.read_text(encoding="utf-8", errors="replace"))
        return [{"title": tieu_de or ten, "content": noi_dung}]
    if duoi == ".csv":
        import csv
        with open(f, newline="", encoding="utf-8-sig") as fh:
            rows = list(csv.DictReader(fh))
        bi_danh = {"tieu_de": "title", "tiêu đề": "title", "noi_dung": "content", "nội dung": "content",
                   "nhom": "category", "nhóm": "category", "the": "tags", "thẻ": "tags", "loai": "kind",
                   "loại": "kind", "nguon": "url", "nguồn": "url", "trich_dan": "cite", "han": "due", "hạn": "due"}
        ra = []
        for r in rows:
            d = {bi_danh.get((k or "").strip().lower(), (k or "").strip().lower()): (v or "").strip()
                 for k, v in r.items()}
            ra.append(d)
        return ra
    if duoi in (".json", ".json.gz"):
        data = doc_json(f)
        return data if isinstance(data, list) else data.get("notes", [])
    raise ValueError(f"chưa hỗ trợ đuôi {duoi or '(không đuôi)'}")


def cmd_nap(a, db):
    """Nạp kiến thức hàng loạt: file hoặc cả thư mục. Chống trùng, xem trước được, một giao dịch."""
    nguon = []
    for p in a.duong_dan:
        if p == "-":
            nguon.append("-")
            continue
        P = Path(p).expanduser()
        if P.is_dir():
            for f in sorted(P.rglob("*")):
                if any(x.startswith(".") for x in f.relative_to(P).parts) or f.is_symlink() or not f.is_file():
                    continue
                if f.suffix.lower() in NAP_DUOI:
                    nguon.append(f)
        elif P.is_file():
            nguon.append(P)
        else:
            out({"ok": False, "error": f"Không thấy file/thư mục: {p}"}, 2)
    if len(nguon) > NAP_MAX_SO_FILE:
        out({"ok": False, "error": f"{len(nguon)} file — quá {NAP_MAX_SO_FILE}. Nạp từng thư mục con."}, 2)
    kind_mac_dinh = chuan_kind(a.kind) if a.kind else None
    if a.kind and not kind_mac_dinh:
        out({"ok": False, "error": f"--kind '{a.kind}' không có. Dùng: {', '.join(KINDS)}"}, 2)
    muc, loi = [], []
    for f in nguon:
        try:
            if f == "-":
                text = sys.stdin.read()
                meta, than = _frontmatter(text)
                ds = [{"title": t, "content": c} for t, c in
                      _tach_markdown(than, a.tach, meta.get("title") or a.title or "Ghi chú dán vào")]
                ten_f = "(dán vào)"
            else:
                ds, ten_f = doc_nguon(f, a.tach), str(f)
            for d in ds:
                d["_file"] = ten_f
            muc += ds
        except (ValueError, OSError) as e:
            loi.append({"file": str(f), "loi": str(e)})
    kq = nap_vao(db, muc, a.category, a.tags, kind_mac_dinh, a.url, a.cite, a.source, a.dry_run)
    kq["so_file"] = len(nguon)
    kq["loi"] = loi + kq["loi"]
    kq["ok"] = not kq["loi"] or bool(kq.get("da_them") or kq.get("se_them"))
    out(kq)


def nap_vao(db, muc, category="", tags="", kind_mac_dinh=None, url="", cite="", source="other", dry_run=False):
    """Lõi của việc nạp (dùng chung cho dòng lệnh và trang web): chuẩn hoá, chống trùng trong lô và
    với kho, rồi ghi tất cả trong MỘT giao dịch — hỏng giữa chừng thì không có gì được ghi."""
    da_thay, them, trung, rong, ket_qua, nhom_moi = set(), [], 0, 0, [], set()
    for d in muc:
        title = gon(str(d.get("title") or ""))[:200]
        content = str(d.get("content") or "").strip()
        if not title or len(content) < 3:
            rong += 1
            continue
        vt = van_tay(title, content)
        if vt in da_thay or db.execute("SELECT 1 FROM notes WHERE content_hash=?", (vt,)).fetchone():
            trung += 1
            continue
        da_thay.add(vt)
        k = chuan_kind(d.get("kind")) if d.get("kind") else None
        try:
            due = chuan_han(d.get("due"))
        except ValueError:
            due = None
        them.append((title, content, d.get("category") or category or "",
                     ",".join(x for x in (norm_tags(str(d.get("tags") or "")), norm_tags(tags)) if x),
                     k or kind_mac_dinh or "kien-thuc", d.get("url") or url or "", d.get("cite") or cite or "",
                     due, d.get("_file", "")))
    if not dry_run and them:
        b = backup(db, "before-nap") if db.execute("SELECT count(*) FROM notes").fetchone()[0] else None
        for title, content, cat, tags, kind, url, cite, due, ten_f in them:
            nhom, moi, _, _ = chuan_nhom(db, cat)
            nhom_moi.update(moi)
            nid = uuid.uuid4().hex[:12]
            try:
                them_note(db, nid, title, content, nhom, norm_tags(tags), source, url, kind=kind, cite=cite, due=due)
            except Exception:
                db.rollback()
                raise
            ket_qua.append({"id": nid, "title": title, "category": nhom, "kind": kind, "tu": ten_f})
        db.commit()
    else:
        b = None
        ket_qua = [{"title": t[0], "category": t[2], "kind": t[4], "tu": t[8], "do_dai": len(t[1])} for t in them]
    return {"ok": True, "xem_truoc": dry_run,
            ("se_them" if dry_run else "da_them"): len(them), "bo_qua_trung": trung, "bo_qua_rong": rong,
            "loi": [], "nhom_moi": sorted(nhom_moi), "ghi_chu": ket_qua[:40],
            **({"con_nua": len(ket_qua) - 40} if len(ket_qua) > 40 else {}),
            "backup": str(b) if b else None,
            "note": ("Chỉ xem trước — chạy lại không có --dry-run để nạp thật." if dry_run else
                     "Nạp xong. Ghi chú thiếu nhóm/thẻ nằm ở inbox; nên xếp chỗ ngay.")}


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
         "theo_loai": {r[0]: r[1] for r in db.execute(
             f"SELECT kind, count(*) FROM notes WHERE {CON} GROUP BY kind ORDER BY 2 DESC")},
         "viec_dang_mo": q(f"SELECT count(*) FROM notes WHERE {CON} AND kind='viec' AND done_at IS NULL"),
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
    s.add_argument("--content-file"); s.add_argument("--category", default="", help="Vùng/Nhóm/Nhóm con")
    s.add_argument("--tags", default="")
    s.add_argument("--source", default="chat"); s.add_argument("--url", default="")
    s.add_argument("--kind", default="kien-thuc", help="loại: " + ", ".join(KINDS))
    s.add_argument("--cite", default="", help="trích dẫn: Tác giả (năm). Tên. Nơi xuất bản, tr.")
    s.add_argument("--due", help="hạn (cho --kind viec): 2026-11-05 hoặc 5/11/2026")
    s.add_argument("--force", action="store_true", help="thêm cả khi kho đã có bản y hệt")
    s.set_defaults(fn=cmd_add)
    s = sub.add_parser("list"); s.add_argument("--tag"); s.add_argument("--category"); s.add_argument("--source")
    s.add_argument("--kind")
    s.add_argument("--limit", type=int, default=20)
    s.add_argument("--archived", action="store_true", help="xem ghi chú trong kho lưu")
    s.set_defaults(fn=cmd_list)
    s = sub.add_parser("search"); s.add_argument("query"); s.add_argument("--limit", type=int, default=10)
    s.add_argument("--full", action="store_true"); s.add_argument("--category"); s.add_argument("--kind")
    s.add_argument("--all", action="store_true", help="tìm cả trong kho lưu"); s.set_defaults(fn=cmd_search)
    s = sub.add_parser("show"); s.add_argument("--id", required=True); s.set_defaults(fn=cmd_show)
    s = sub.add_parser("edit"); s.add_argument("--id", required=True); s.add_argument("--title")
    s.add_argument("--content"); s.add_argument("--content-file"); s.add_argument("--category")
    s.add_argument("--tags"); s.add_argument("--url"); s.add_argument("--append", action="store_true")
    s.add_argument("--kind"); s.add_argument("--cite"); s.add_argument("--due")
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
    s.add_argument("--category"); s.add_argument("--tag"); s.add_argument("--kind")
    s.add_argument("--done", help="đánh dấu đã ôn: id1,id2"); s.set_defaults(fn=cmd_review)
    s = sub.add_parser("digest"); s.add_argument("--days", type=int, default=7); s.set_defaults(fn=cmd_digest)
    s = sub.add_parser("tags"); s.set_defaults(fn=cmd_tags)
    s = sub.add_parser("retag"); s.add_argument("--from", dest="from_tag", required=True)
    s.add_argument("--to", dest="to_tag", required=True); s.add_argument("--yes", action="store_true")
    s.set_defaults(fn=cmd_retag)
    s = sub.add_parser("duplicates"); s.add_argument("--limit", type=int, default=20)
    s.add_argument("--nguong", type=float, default=0.5, help="tỉ lệ từ khoá trùng, 0-1")
    s.set_defaults(fn=cmd_duplicates)
    s = sub.add_parser("merge"); s.add_argument("--from", dest="from_id", required=True)
    s.add_argument("--into", dest="into_id", required=True); s.add_argument("--yes", action="store_true")
    s.set_defaults(fn=cmd_merge)
    s = sub.add_parser("snapshot"); s.add_argument("--reason", default="dinh-ky"); s.set_defaults(fn=cmd_snapshot)
    s = sub.add_parser("export"); s.add_argument("--out", required=True)
    s.add_argument("--format", choices=["markdown", "json"], default="markdown")
    s.add_argument("--category"); s.add_argument("--tag"); s.add_argument("--kind")
    s.add_argument("--all", action="store_true", help="xuất cả ghi chú trong kho lưu")
    s.add_argument("--since", type=int, help="chỉ lấy ghi chú trong N ngày gần đây"); s.set_defaults(fn=cmd_export)
    s = sub.add_parser("import"); s.add_argument("--file", required=True); s.set_defaults(fn=cmd_import)
    s = sub.add_parser("stats"); s.set_defaults(fn=cmd_stats)
    s = sub.add_parser("categories", help="cây nhóm Vùng/Nhóm/Nhóm con kèm số ghi chú"); s.set_defaults(fn=cmd_categories)
    s = sub.add_parser("kinds", help="các loại kiến thức"); s.set_defaults(fn=cmd_kinds)
    s = sub.add_parser("viec", help="công việc: quá hạn / hôm nay / sắp tới")
    s.add_argument("--xong", help="đánh dấu xong: id1,id2"); s.add_argument("--mo-lai", dest="mo_lai")
    s.add_argument("--category"); s.add_argument("--tat-ca", dest="tat_ca", action="store_true")
    s.set_defaults(fn=cmd_viec)
    s = sub.add_parser("nap", help="nạp hàng loạt: .md .txt .pdf .csv .json .html, cả thư mục; - = stdin")
    s.add_argument("duong_dan", nargs="+")
    s.add_argument("--tach", choices=["tu-dong", "heading", "khong", "trang"], default="tu-dong",
                   help="tu-dong: Markdown có ≥2 tiêu đề thì mỗi mục một ghi chú; trang: PDF mỗi trang một ghi chú")
    s.add_argument("--category", default=""); s.add_argument("--tags", default=""); s.add_argument("--kind")
    s.add_argument("--url", default=""); s.add_argument("--cite", default=""); s.add_argument("--title", default="")
    s.add_argument("--source", default="other", choices=SOURCES)
    s.add_argument("--dry-run", action="store_true", help="chỉ xem trước, không ghi gì")
    s.set_defaults(fn=cmd_nap)
    s = sub.add_parser("doctor", help="khám sức khoẻ kho"); s.add_argument("--fix", action="store_true")
    s.set_defaults(fn=cmd_doctor)
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
