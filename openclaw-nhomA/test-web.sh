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

BRAIN_PORT=$PORT python3 "$SB/scripts/server.py" >"$TMP/log" 2>&1 &
PID=$!
for i in $(seq 25); do curl -sS -o /dev/null "$U/" 2>/dev/null && break; sleep 0.2; done

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
check "thân quá lớn bị chặn" \
  'python3 -c "print(\"{\\\"title\\\":\\\"\" + \"x\"*1100000 + \"\\\"}\")" > "$TMP/to.json"; curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/add" -H "Content-Type: application/json" -H "Origin: $U" --data-binary @"$TMP/to.json"' "413"
check "đường dẫn API không có trả 404" 'curl -sS -o /dev/null -w "%{http_code}" -X POST "$U/api/khongco" -H "Content-Type: application/json" -H "Origin: $U" -d "{}"' "404"

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
