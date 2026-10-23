#!/usr/bin/env bash
# Bộ test cho server.py — dựng kho tạm, chạy server ở cổng rảnh, gọi API thật.
#   bash test-web.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SB="$HERE/skills/second-brain"
[ -d "$SB" ] || SB="$HERE"
TMP="$(mktemp -d)"
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')
U="http://127.0.0.1:$PORT"
OK=0; FAIL=0
don_dep() { [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null; rm -rf "$TMP"; }
trap don_dep EXIT

pad() {
  local s="$1" n="$2" len
  len=$(printf '%s' "$s" | python3 -c \
    'import sys;print(len(sys.stdin.buffer.read().decode("utf-8","replace")))' 2>/dev/null)
  [ -n "$len" ] || len=${#s}
  printf '%s' "$s"; while [ "$len" -lt "$n" ]; do printf ' '; len=$((len+1)); done
}
check() {
  pad "  $1" 50
  local thuc; thuc="$(eval "$2" 2>&1)"
  if [ "$thuc" = "$3" ]; then echo "ĐẠT"; OK=$((OK+1));
  else echo "HỎNG — mong '$3', nhận '$thuc'"; FAIL=$((FAIL+1)); fi
}
jq_() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)" 2>/dev/null || echo "(không phải JSON)"; }
# gọi API đúng cách: JSON + Origin của chính trang
post() { curl -sS -X POST "$U$1" -H "Content-Type: application/json" -H "Origin: $U" -d "$2"; }

export SECOND_BRAIN_DB="$TMP/n.sqlite"
python3 "$SB/scripts/brain.py" add --title "Hero mobile contain" \
  --content "Ảnh hero ngang trên mobile dùng background-size contain." \
  --category "Landing page" --tags "landing,mobile" --url "https://example.com/bai" >/dev/null
python3 "$SB/scripts/brain.py" add --title "Ghi chú chưa xếp chỗ" --content "Bắt vội, chưa phân loại." >/dev/null

export BRAIN_TOKEN_FILE="$TMP/.web-token"
export OPENCLAW_BIN="$TMP/openclaw-gia"
cat > "$OPENCLAW_BIN" <<'SH'
#!/usr/bin/env bash
# openclaw giả cho ô Hỏi: như bản thật — thiếu --to/--session-key/--session-id/--agent thì từ chối, lỗi in nhiều dòng [openclaw]
phien=""; tep=""; lo=khong
for x in "$@"; do case "$x" in *"=== CÂU HỎI ==="*) lo=co;; esac; done
while [ $# -gt 0 ]; do case "$1" in
  --to|--session-key|--session-id|--agent) phien="$phien$1=$2;"; shift 2;;
  --message-file) tep="$2"; shift 2;; *) shift;; esac; done
loi() { printf '%s\n' "[openclaw] Agent failed" "[openclaw] Reason: $1" "[openclaw] Try: openclaw doctor" "[openclaw] Help: openclaw --help" >&2; exit 1; }
[ "${OPENCLAW_SHELL:-}" = exec ] && loi "Gateway agent from agent exec would lose inter-session attribution. Use the attributed session-messaging tool available to this run, or return the result through normal subagent completion. Do not retry through another CLI route or remove the exec marker."
[ -n "$phien" ] || loi "Pass --to <E.164>, --session-key, --session-id, or --agent to choose a session"
[ -r "$tep" ] || loi "no message"
grep -q "GIA-LOI" "$tep" && loi "Gateway not reachable"
moc=khong; grep -q "MOC-THUY-DIEN" "$tep" && moc=co
printf '{"payloads":[{"text":"%s moc=%s lo-dong-lenh=%s"}]}\n' "$phien" "$moc" "$lo"
SH
chmod +x "$OPENCLAW_BIN"
python3 - "$TMP/dai.txt" <<'PY'
import sys
d = [f"Đoạn {i}: nội dung chung về móng nhà phố, phần {i}, viết dài thêm cho đủ một đoạn văn." for i in range(1, 80)]
d.insert(70, "Thuỷ điện Hoà Bình: MOC-THUY-DIEN công suất 1920 MW, khởi công năm 1979.")
open(sys.argv[1], "w", encoding="utf-8").write("\n\n".join(d))
PY
python3 "$SB/scripts/brain.py" add --title "Tài liệu dài một file" --content-file "$TMP/dai.txt" --category "Học tập" >/dev/null
BRAIN_PORT=$PORT python3 "$SB/scripts/server.py" >"$TMP/log" 2>&1 &
PID=$!
for i in $(seq 25); do [ -s "$BRAIN_TOKEN_FILE" ] && command curl -sS -o /dev/null "$U/app.js" 2>/dev/null && break; sleep 0.2; done
TOK="$(cat "$BRAIN_TOKEN_FILE")"
# mọi lệnh curl bên dưới gửi kèm mã như trình duyệt đã đăng nhập; test xác thực dùng `command curl` (không mã)
curl() { command curl -H "Authorization: Bearer $TOK" "$@"; }

echo "======================================================================"
echo " TEST server.py — cổng $PORT, kho tạm $TMP"
echo "======================================================================"

echo
echo "1. TRANG VÀ TỆP TĨNH"
check "trang chính trả 200" 'curl -sS -o /dev/null -w "%{http_code}" "$U/"' "200"
check "app.js trả 200" 'curl -sS -o /dev/null -w "%{http_code}" "$U/app.js"' "200"
check "styles.css đúng kiểu nội dung" \
  'curl -sS -o /dev/null -w "%{content_type}" "$U/styles.css"' "text/css; charset=utf-8"
check "tệp không có trả 404" 'curl -sS -o /dev/null -w "%{http_code}" "$U/khongco.js"' "404"

echo
echo "1b. MÃ TRUY CẬP — chương trình khác trên VPS không đọc được kho"
check "file mã chỉ chủ sở hữu đọc (600)" 'stat -c %a "$BRAIN_TOKEN_FILE"' "600"
check "API không mã bị chặn (401)" 'command curl -sS -o /dev/null -w "%{http_code}" "$U/api/notes"' "401"
check "tìm kiếm không mã bị chặn" 'command curl -sS -o /dev/null -w "%{http_code}" "$U/api/search?q=hero"' "401"
check "POST không mã bị chặn" \
  'command curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: $U" -d "{\"title\":\"x\",\"content\":\"y\"}"' "401"
check "trang chính không mã: hiện hướng dẫn" 'command curl -sS "$U/" | grep -c "web.sh link"' "1"
check "mã sai bị từ chối" 'command curl -sS -o /dev/null -w "%{http_code}" "$U/?t=sai-ma"' "403"
check "mã sai trong cookie bị từ chối" \
  'command curl -sS -o /dev/null -w "%{http_code}" -H "Cookie: sb_auth=sai" "$U/api/notes"' "401"
check "link đúng mã cấp cookie HttpOnly" \
  'command curl -sS -D - -o /dev/null "$U/?t=$TOK" | grep -ci "^set-cookie:.*HttpOnly.*SameSite=Strict"' "1"
check "cookie đúng thì đọc được" \
  'command curl -sS -o /dev/null -w "%{http_code}" -H "Cookie: sb_auth=$TOK" "$U/api/notes"' "200"
check "Content-Length âm trả lỗi ngay, không treo" \
  'curl -sS -m 5 -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: $U" -H "Content-Length: -1"' "400"

echo
echo "2. KHÔNG RA ĐƯỢC NGOÀI THƯ MỤC public/"
check "..%2F..%2F leo thư mục bị chặn" \
  'curl -sS -o /dev/null -w "%{http_code}" "$U/..%2F..%2Fscripts%2Fbrain.py"' "404"
check "đường dẫn ../ thẳng bị chặn" \
  'curl -sS -o /dev/null -w "%{http_code}" --path-as-is "$U/../scripts/brain.py"' "404"
check "không đọc được SKILL.md" \
  'curl -sS -o /dev/null -w "%{http_code}" "$U/..%2FSKILL.md"' "404"

echo
echo "3. CHẶN TRANG KHÁC GỬI LỆNH SANG (CSRF)"
check "POST không có Content-Type JSON bị chặn" \
  'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" --data "{}"' "403"
check "POST từ Origin lạ bị chặn" \
  'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: https://ke-xau.example" -d "{}"' "403"
check "POST Host lạ bị chặn (DNS rebinding)" \
  'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Host: ke-xau.example" -d "{}"' "403"
check "GET Host lạ không đọc được kho (DNS rebinding)" \
  'curl -sS -o /dev/null -w "%{http_code}" -H "Host: ke-xau.example" "$U/api/notes"' "403"
check "GET Host lạ không tìm được trong kho" \
  'curl -sS -o /dev/null -w "%{http_code}" -H "Host: ke-xau.example:$PORT" "$U/api/search?q=hero"' "403"
check "Host localhost:cổng vẫn dùng được" \
  'curl -sS -o /dev/null -w "%{http_code}" -H "Host: localhost:$PORT" "$U/api/notes"' "200"
check "cấm nhúng vào iframe (X-Frame-Options)" \
  'curl -sS -D - -o /dev/null "$U/" | tr -d "\r" | grep -i "^x-frame-options:" | cut -d" " -f2' "DENY"
check "có Content-Security-Policy" \
  'curl -sS -D - -o /dev/null "$U/" | grep -ci "^content-security-policy:"' "1"
check "POST đúng chuẩn thì qua" \
  'post /api/add "{\"title\":\"Thử\",\"content\":\"Nội dung thử\"}" | jq_ "d[\"ok\"]"' "True"

echo
echo "4. KHÔNG XOÁ HẲN ĐƯỢC QUA TRANG WEB"
ID=$(curl -sS "$U/api/notes" | jq_ 'd["notes"][0]["id"]')
check "/api/delete bị từ chối" 'post /api/delete "{\"id\":\"'"$ID"'\"}" | jq_ "d[\"ok\"]"' "False"
check "ghi chú vẫn còn nguyên" 'curl -sS "$U/api/note?id='"$ID"'" | jq_ "d[\"ok\"]"' "True"

echo
echo "5. CẤT KHO / LẤY LẠI"
check "cất kho" 'post /api/archive "{\"id\":\"'"$ID"'\"}" | jq_ "d[\"status\"]"' "archived"
check "đồ thị không còn thấy" \
  'curl -sS "$U/api/notes" | jq_ "any(n[\"id\"]==\"'"$ID"'\" for n in d[\"notes\"])"' "False"
check "kho lưu thấy" \
  'curl -sS "$U/api/archived" | jq_ "any(n[\"id\"]==\"'"$ID"'\" for n in d[\"notes\"])"' "True"
check "lấy lại" 'post /api/archive "{\"id\":\"'"$ID"'\",\"lay_lai\":true}" | jq_ "d[\"status\"]"' "active"

echo
echo "6. TÌM KIẾM VÀ SỐ ĐẾM"
check "tìm tiếng Việt có dấu" 'curl -sS "$U/api/search?q=%C4%91%E1%BB%99ng" -o /dev/null -w "%{http_code}"' "200"
check "ô Tìm gõ không dấu vẫn ra" \
  'curl -sS "$U/api/search?q=anh%20hero%20ngang%20tren" | jq_ "len(d[\"notes\"])>=1 and \"«trên»\" in d[\"notes\"][0].get(\"snippet\",\"\")"' "True"
check "cú pháp FTS sai không làm chết server" \
  'curl -sS "$U/api/search?q=AND%20OR%20(((" | jq_ "d[\"ok\"]"' "True"
check "đếm số ghi chú chưa xếp chỗ" 'curl -sS "$U/api/notes" | jq_ "d[\"cho_phan_loai\"] >= 1"' "True"
check "có tổng số ghi chú thật" 'curl -sS "$U/api/notes" | jq_ "\"tong_ghi_chu\" in d"' "True"

echo
echo "7. ĐẦU VÀO XẤU"
check "JSON hỏng trả 400" \
  'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: $U" -d "khong-phai-json"' "400"
check "thân là mảng chứ không phải object" \
  'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: $U" -d "[1,2,3]"' "400"
check "thiếu nội dung trả 400" 'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: $U" -d "{\"title\":\"x\"}"' "400"
check "id không tồn tại" 'curl -sS "$U/api/note?id=zzzzzzzzzzzz" | jq_ "d[\"ok\"]"' "False"
check "thân quá 8 MB bị chặn" \
  'python3 -c "print(\"{\\\"title\\\":\\\"\" + \"x\"*8500000 + \"\\\"}\")" > "$TMP/to.json"; curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: $U" --data-binary @"$TMP/to.json"' "413"
check "đường dẫn API không có trả 404" 'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/khongco" -H "Content-Type: application/json" -H "Origin: $U" -d "{}"' "404"

echo
echo "7b. PHÂN LOẠI, THƯ VIỆN, VIỆC, NẠP"
check "thêm có loại + nhóm 2 tầng" \
  'post /api/add "{\"title\":\"Quy trình A\",\"content\":\"Bước một bước hai\",\"kind\":\"quy-trinh\",\"category\":\"kỹ thuật / lắp đặt\"}" | jq_ "d[\"category\"]"' "Kỹ thuật/Lắp đặt"
check "thêm y hệt bị chặn, trả id bản cũ" \
  'post /api/add "{\"title\":\"quy trình a\",\"content\":\"Bước một  bước hai\"}" | jq_ "(d[\"ok\"], bool(d.get(\"trung_id\")))"' "(False, True)"
check "thư viện lọc nhóm cha" 'curl -sS "$U/api/library?category=K%E1%BB%B9%20thu%E1%BA%ADt" | jq_ "d[\"tong\"]"' "1"
check "thư viện lọc loại" 'curl -sS "$U/api/library?kind=quy-trinh" | jq_ "d[\"tong\"]"' "1"
check "thư viện đếm loại trong nhóm" 'curl -sS "$U/api/library?category=K%E1%BB%B9%20thu%E1%BA%ADt" | jq_ "d[\"dem_loai\"]"' "{'quy-trinh': 1}"
check "thư viện: ô chưa xếp chỗ" 'curl -sS "$U/api/library?category=__chua__" | jq_ "d[\"tong\"] >= 1"' "True"
check "thư viện: phân trang" 'curl -sS "$U/api/library?limit=1&offset=1" | jq_ "(len(d[\"notes\"]), d[\"offset\"])"' "(1, 1)"
check "sắp xếp lạ không làm lỗi SQL" 'curl -sS "$U/api/library?sort=1;DROP" | jq_ "d[\"ok\"]"' "True"
check "thêm việc có hạn" \
  'post /api/add "{\"title\":\"Việc A\",\"content\":\"Gọi khách A\",\"kind\":\"viec\",\"due\":\"2020-01-01\"}" | jq_ "d[\"ok\"]"' "True"
VID=$(curl -sS "$U/api/tasks" | jq_ 'd["qua_han"][0]["id"]')
check "việc quá hạn hiện đúng" 'curl -sS "$U/api/tasks" | jq_ "d[\"dang_mo\"]"' "1"
check "đánh dấu xong qua web" 'post /api/task "{\"id\":\"'"$VID"'\",\"xong\":true}" >/dev/null; curl -sS "$U/api/tasks" | jq_ "d[\"dang_mo\"]"' "0"
check "sửa loại + nhóm qua web" \
  'post /api/update "{\"id\":\"'"$VID"'\",\"kind\":\"nhat-ky\",\"category\":\"Kinh doanh/Họp\"}" >/dev/null; curl -sS "$U/api/note?id='"$VID"'" | jq_ "(d[\"note\"][\"kind\"], d[\"note\"][\"category\"])"' "('nhat-ky', 'Kinh doanh/Họp')"
check "nạp: xem trước không ghi" \
  'post /api/ingest "{\"text\":\"# Mục một\\nNội dung một\\n# Mục hai\\nNội dung hai\",\"dry_run\":true}" | jq_ "d[\"se_them\"]"' "2"
check "nạp: tách 2 mục, gán nhóm" \
  'post /api/ingest "{\"text\":\"# Mục một\\nNội dung một\\n# Mục hai\\nNội dung hai\",\"category\":\"Học tập\"}" | jq_ "d[\"da_them\"]"' "2"
check "nạp lại: bỏ trùng" \
  'post /api/ingest "{\"text\":\"# Mục một\\nNội dung một\\n# Mục hai\\nNội dung hai\"}" | jq_ "(d[\"da_them\"], d[\"bo_qua_trung\"])"' "(0, 2)"
check "nạp file .md gửi từ trình duyệt" \
  'post /api/ingest "{\"files\":[{\"name\":\"bai-hoc.md\",\"text\":\"Nội dung bài học từ file\"}]}" | jq_ "d[\"ghi_chu\"][0][\"title\"]"' "Bai hoc"
python3 - "$TMP/w.docx" <<'DOCX'
import sys, zipfile
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
def p(t, kieu=None, ds=False):
    pr = (f'<w:pStyle w:val="{kieu}"/>' if kieu else '') + ('<w:numPr><w:ilvl w:val="0"/></w:numPr>' if ds else '')
    return f'<w:p>{"<w:pPr>" + pr + "</w:pPr>" if pr else ""}<w:r><w:t>{t}</w:t></w:r></w:p>'
than = (p("Mục Word một", "Heading1") + p("Nội dung mục một của file Word.") + p("# chú thích trong lệnh mẫu")
        + p("Mục Word hai", "Heading1") + p("Ý gạch đầu dòng", ds=True) + p("Nội dung mục hai."))
with zipfile.ZipFile(sys.argv[1], "w") as z:
    z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    z.writestr("word/document.xml", f'<?xml version="1.0" encoding="UTF-8"?><w:document {W}><w:body>{than}</w:body></w:document>')
DOCX
W64="$(python3 -c 'import base64,sys;print(base64.b64encode(open(sys.argv[1],"rb").read()).decode())' "$TMP/w.docx")"
check "nạp Word .docx gửi từ trình duyệt" \
  'post /api/ingest "{\"files\":[{\"name\":\"tai-lieu.docx\",\"b64\":\"$W64\"}],\"dry_run\":true}" | jq_ "[g[\"title\"] for g in d[\"ghi_chu\"]]"' "['Mục Word một', 'Mục Word hai']"
check "file nhị phân đuôi lạ bị từ chối" \
  'post /api/ingest "{\"files\":[{\"name\":\"x.exe\",\"b64\":\"QUJD\"}]}" | jq_ "d[\"ok\"]"' "False"
check "base64 hỏng: báo lỗi, không lỗi 500" \
  'post /api/ingest "{\"files\":[{\"name\":\"a.pdf\",\"b64\":\"@@@\"}]}" | jq_ "(d[\"ok\"], \"hỏng\" in d[\"error\"])"' "(False, True)"
check "nhóm sai kiểu (object) bị từ chối" \
  'post /api/add "{\"title\":\"x\",\"content\":\"y z\",\"category\":{\"a\":1}}" | jq_ "d[\"ok\"]"' "False"
check "thẻ dạng danh sách được nhận" \
  'post /api/add "{\"title\":\"Thẻ list\",\"content\":\"thử thẻ danh sách\",\"tags\":[\"a\",\"b c\"]}" | jq_ "d[\"ok\"]"' "True"
check "nạp: phần tử file sai kiểu bị bỏ, không lỗi 500" \
  'post /api/ingest "{\"files\":[\"chuoi\",5,{\"name\":5,\"text\":[\"a\"]}]}" | jq_ "d[\"ok\"]"' "False"
check "thông tin chi tiết có ghi chú liên kết kèm tên" \
  'curl -sS "$U/api/note?id='"$VID"'" | jq_ "type(d[\"note\"][\"linked\"]).__name__"' "list"

echo
echo "7b2. Ô HỎI (openclaw agent) VÀ GỘP TRANG"
if [ "${OPENCLAW_SHELL:-}" = exec ]; then
  # bộ test đang chạy trong lệnh exec của agent: OpenClaw chặn openclaw agent (chốt an toàn) — 3 test gọi Mây bỏ qua
  echo "  (đang chạy trong exec của agent — bỏ qua 3 test gọi Mây; ô Hỏi phải báo bị chặn, xem test ngay dưới)"
else
  check "Hỏi: có chọn phiên riêng, câu hỏi qua file" \
    'post /api/ask "{\"question\":\"móng nhà phố\"}" | jq_ "(d[\"answer\"].split(\" moc\")[0], \"lo-dong-lenh=khong\" in d[\"answer\"])"' "('--session-key=second-brain;', True)"
  check "Hỏi ghi chú dài: gửi đúng đoạn liên quan" \
    'post /api/ask "{\"question\":\"Thuỷ điện Hoà Bình công suất bao nhiêu\"}" | jq_ "\"moc=co\" in d[\"answer\"]"' "True"
  python3 "$SB/scripts/brain.py" add --title "Ghi chú gây lỗi" --content "Hồ chứa GIA-LOI thử báo lỗi." >/dev/null
  check "Hỏi lỗi: báo đúng lý do, không phải dòng Help" \
    'post /api/ask "{\"question\":\"hồ chứa thử báo lỗi\"}" | jq_ "(d[\"ok\"], d[\"error\"].endswith(\"Gateway not reachable\"), len(d[\"used\"]) > 0)"' "(False, True, True)"
fi
# web bật từ exec của agent (OPENCLAW_SHELL=exec): ô Hỏi không gọi openclaw, báo rõ cách sửa, vẫn đưa ghi chú liên quan
check "Hỏi khi web bật từ lệnh của agent: báo cách sửa" \
  'OPENCLAW_SHELL=exec python3 -B -c "import sys;sys.path.insert(0,sys.argv[1]);import server,brain;r=server.api_ask(brain.connect(),{},{\"question\":\"móng nhà phố\"});print(r[\"ok\"],\"web.sh restart\" in r[\"error\"],len(r[\"used\"])>0)" "$SB/scripts"' "False True True"
P2=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')
check "web.sh bật từ lệnh của agent: nhắc ô Hỏi bị chặn" \
  'OPENCLAW_SHELL=exec BRAIN_PORT=$P2 bash "$SB/scripts/web.sh" start | grep -c "CHẶN ô Hỏi"' "1"
check "web.sh status: chỉ ra ô Hỏi đang bị chặn" 'BRAIN_PORT=$P2 bash "$SB/scripts/web.sh" status | grep -c "Ô Hỏi: BỊ CHẶN"' "1"
BRAIN_PORT=$P2 bash "$SB/scripts/web.sh" stop >/dev/null
for i in 1 2; do python3 "$SB/scripts/brain.py" add --title "Tài liệu thử — trang $i" --content "Trang $i của tài liệu thử gộp qua web." >/dev/null; done
check "Thư viện mời gộp bộ trang" 'curl -sS "$U/api/library" | jq_ "d[\"bo_trang\"]"' "[{'ten': 'Tài liệu thử', 'so_trang': 2}]"
check "gộp trang qua web" 'post /api/gop-trang "{\"ten\":\"Tài liệu thử\"}" | jq_ "(d[\"ok\"], d[\"da_gop\"])"' "(True, 1)"
check "gộp lại lần 2: báo rõ, không lỗi 500" 'post /api/gop-trang "{\"ten\":\"Tài liệu thử\"}" | jq_ "d[\"ok\"]"' "False"
check "gộp trang: tên sai kiểu bị từ chối" 'post /api/gop-trang "{\"ten\":5}" | jq_ "d[\"ok\"]"' "False"

echo
echo "7c. LÕI THÁI CỰC – TIÊN THIÊN BÁT QUÁI ĐÚNG KINH DỊCH"
cat > "$TMP/kinh_dich.py" <<'PY'
import re, sys
src = open(sys.argv[1], encoding="utf-8").read()
q = {m[0]: ([int(x) for x in m[1].split(",")], int(m[2]), int(m[3]))
     for m in re.findall(r"\['(\S+?)', \[([01], ?[01], ?[01])\], (-?\d+), '[^']+', (\d)\]", src)}
q = {k: ([int(x) for x in "".join(v[0] if isinstance(v[0], str) else map(str, v[0]))], v[1], v[2]) for k, v in q.items()}
# tên quẻ <- hào sơ→thượng (chuẩn Kinh Dịch)
CHUAN = {"Càn": [1,1,1], "Đoài": [1,1,0], "Ly": [1,0,1], "Chấn": [1,0,0],
         "Tốn": [0,1,1], "Khảm": [0,1,0], "Cấn": [0,0,1], "Khôn": [0,0,0]}
SO = {"Càn": 1, "Đoài": 2, "Ly": 3, "Chấn": 4, "Tốn": 5, "Khảm": 6, "Cấn": 7, "Khôn": 8}
loi = []
if set(q) != set(CHUAN): loi.append(f"thiếu/thừa quẻ: {sorted(q)}")
for k, (hao, goc, so) in q.items():
    if hao != CHUAN.get(k): loi.append(f"{k}: hào {hao} sai")
    if so != SO.get(k): loi.append(f"{k}: số Tiên Thiên {so} sai")
    doi = [t for t, (_, g, _) in q.items() if (g - goc) % 360 == 180]
    if len(doi) != 1: loi.append(f"{k}: không có quẻ đối"); continue
    h2, _, s2 = q[doi[0]]
    if [1 - x for x in hao] != h2: loi.append(f"{k}–{doi[0]}: hào không ngược nhau")
    if so + s2 != 9: loi.append(f"{k}–{doi[0]}: tổng số {so + s2} ≠ 9")
if q.get("Càn", (0, 0))[1] != -90: loi.append("Càn không ở trên (phương Nam)")
if q.get("Khôn", (0, 0))[1] != 90: loi.append("Khôn không ở dưới (phương Bắc)")
if q.get("Ly", (0, 0))[1] != 180: loi.append("Ly không ở bên trái (phương Đông)")
print("dung" if not loi else "; ".join(loi))
PY
check "8 quẻ đúng hào, đúng số, đúng phương" 'python3 "$TMP/kinh_dich.py" "$SB/public/app.js"' "dung"
if command -v node >/dev/null 2>&1; then
  # khí vận hành: đi theo kim đồng hồ từ Chấn; Dương (vàng) mạnh dần tới Càn, Âm (xanh) mạnh dần tới Khôn
  cat > "$TMP/khi.js" <<'JS'
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const m = src.match(/function khiTai\(a\) \{[\s\S]*?\n\}/);
if (!m) { console.log('không thấy khiTai'); process.exit(0); }
const khiTai = new Function(m[0] + '; return khiTai;')();
const rad = (d) => d * Math.PI / 180, vang = '242,206,107', xanh = '90,162,255', loi = [];
const xem = (ten, deg, mau, lon) => { const k = khiTai(rad(deg)); if (k.mau !== mau || (lon ? k.manh < 0.95 : k.manh > 0.2)) loi.push(`${ten} ${deg}°: ${k.mau} ${k.manh.toFixed(2)}`); };
xem('Chấn (Dương mới sinh)', 135, vang, false); xem('Càn (Dương cực thịnh)', -90.5, vang, true);
xem('Tốn (Âm mới sinh)', -45, xanh, false);    xem('Khôn (Âm cực thịnh)', 89.5, xanh, true);
const ly = khiTai(rad(180)), kham = khiTai(rad(0.5));
if (ly.mau !== vang) loi.push('Ly phải thuộc Dương'); if (kham.mau !== xanh) loi.push('Khảm phải thuộc Âm');
if (!/Math\.PI \* 0\.75 \+ goc/.test(src)) loi.push('khí phải bắt đầu ở Chấn (135°) và đi theo góc tăng');
console.log(loi.length ? loi.join('; ') : 'dung');
JS
  check "khí âm dương tiêu trưởng đúng chiều, đúng màu" 'node "$TMP/khi.js" "$SB/public/app.js"' "dung"
fi
check "favicon Thái Cực mở được (không cần mã)" 'command curl -sS -o /dev/null -w "%{http_code} %{content_type}" "$U/favicon.svg"' "200 image/svg+xml"

echo
echo "8. SERVER VẪN SỐNG SAU TẤT CẢ"
check "server còn chạy" 'kill -0 '"$PID"' && echo song' "song"
check "không có traceback trong log" 'grep -c Traceback "$TMP/log" || true' "0"
check "trang vẫn trả 200" 'curl -sS -o /dev/null -w "%{http_code}" "$U/"' "200"

echo
echo "======================================================================"
printf " ĐẠT: %-5s HỎNG: %s\n" "$OK" "$FAIL"
[ "$FAIL" -eq 0 ] && echo " Tất cả test đều qua." || echo " CÓ TEST HỎNG — xem các dòng HỎNG ở trên."
echo "======================================================================"
[ "$FAIL" -eq 0 ] || exit 1
