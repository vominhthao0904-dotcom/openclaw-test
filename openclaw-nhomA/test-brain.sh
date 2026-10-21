#!/usr/bin/env bash
# Bộ test cho brain.py — chạy trên kho tạm, KHÔNG đụng dữ liệu thật.
#   bash test-brain.sh
# Mỗi dòng là một trường hợp đã từng sai hoặc dễ sai. Thêm tính năng thì thêm test ở đây.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BR_PY="$HERE/skills/second-brain/scripts/brain.py"
[ -f "$BR_PY" ] || BR_PY="$HERE/scripts/brain.py"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export SECOND_BRAIN_DB="$TMP/n.sqlite"
BR() { python3 "$BR_PY" "$@"; }
OK=0; FAIL=0

pad() {
  local s="$1" n="$2" len
  len=$(printf '%s' "$s" | python3 -c \
    'import sys;print(len(sys.stdin.buffer.read().decode("utf-8","replace")))' 2>/dev/null)
  [ -n "$len" ] || len=${#s}
  printf '%s' "$s"; while [ "$len" -lt "$n" ]; do printf ' '; len=$((len+1)); done
}
dat()  { echo "ĐẠT";          OK=$((OK+1)); }
hong() { echo "HỎNG — $1";    FAIL=$((FAIL+1)); }
# so sánh: nhãn | lệnh sinh ra giá trị | giá trị mong đợi
check() {
  pad "  $1" 46
  local thuc; thuc="$(eval "$2" 2>&1)"
  if [ "$thuc" = "$3" ]; then dat; else hong "mong '$3', nhận '$thuc'"; fi
}
jq_() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)"; }

echo "======================================================================"
echo " TEST brain.py — kho tạm: $TMP"
echo "======================================================================"

echo
echo "1. KHO RỖNG"
check "list trên kho rỗng" 'BR list | jq_ "d[\"count\"]"' "0"
check "search trên kho rỗng" 'BR search "gì đó" | jq_ "d[\"count\"]"' "0"
check "stats trên kho rỗng" 'BR stats | jq_ "d[\"total_notes\"]"' "0"
check "inbox trên kho rỗng" 'BR inbox | jq_ "d[\"cho_phan_loai\"]"' "0"
check "review trên kho rỗng" 'BR review | jq_ "d[\"count\"]"' "0"
check "digest trên kho rỗng" 'BR digest | jq_ "d[\"tong\"]"' "0"
check "duplicates trên kho rỗng" 'BR duplicates | jq_ "d[\"so_cap\"]"' "0"
check "tags trên kho rỗng" 'BR tags | jq_ "d[\"tong_the\"]"' "0"

echo
echo "2. THẺ TIẾNG VIỆT NHIỀU CHỮ"
BR add --title "Tiêu chí đất" --content "Đường vào trên 5m, pháp lý sạch." \
   --category "Đầu tư" --tags "bất động sản, vay ngân hàng" >/dev/null
check "'bất động sản, vay ngân hàng' thành 2 thẻ" \
  'BR list --limit 1 | jq_ "len(d[\"notes\"][0][\"tags\"])"' "2"
check "thẻ giữ nguyên nghĩa" \
  'BR list --limit 1 | jq_ "d[\"notes\"][0][\"tags\"][0]"' "bất-động-sản"
check "không dấu phẩy thì tách theo khoảng trắng" \
  'python3 -c "import sys;sys.path.insert(0,\"$(dirname "$BR_PY")\");import brain;print(brain.norm_tags(\"landing mobile ux\"))"' \
  "landing,mobile,ux"
check "tìm được theo thẻ tiếng Việt" \
  'BR list --tag bất-động-sản | jq_ "d[\"count\"]"' "1"

echo
echo "3. edit --append"
ID=$(BR list --limit 1 | jq_ 'd["notes"][0]["id"]')
check "--append không kèm nội dung thì bị chặn" \
  'BR edit --id '"$ID"' --append | jq_ "d[\"error\"][:8]"' "--append"
BR edit --id "$ID" --content "Bổ sung: ưu tiên sổ riêng." --append >/dev/null
check "--append có nội dung thì nối đúng 1 lần" \
  'BR show --id '"$ID"' | jq_ "d[\"note\"][\"content\"].count(\"Đường vào\")"' "1"
check "nội dung mới có mặt" \
  'BR show --id '"$ID"' | jq_ "\"Bổ sung\" in d[\"note\"][\"content\"]"' "True"

echo
echo "4. LIÊN KẾT"
BR add --title "Thế chấp" --content "Ngân hàng cho vay 60-70% giá thẩm định." --category "Đầu tư" --tags vay >/dev/null
ID2=$(BR list --limit 1 | jq_ 'd["notes"][0]["id"]')
check "không nối ghi chú với chính nó" \
  'BR link --a '"$ID"' --b '"$ID"' | jq_ "d[\"error\"]"' "Không nối một ghi chú với chính nó"
check "nối hai ghi chú khác nhau" \
  'BR link --a '"$ID"' --b '"$ID2"' | jq_ "d[\"ok\"]"' "True"
check "nối lại lần nữa không nhân đôi" \
  'BR link --a '"$ID"' --b '"$ID2"' >/dev/null; BR stats | jq_ "d[\"links\"]"' "1"

echo
echo "5. CẤT KHO / XOÁ / LẤY LẠI"
BR archive --id "$ID2" >/dev/null
check "cất kho xong thì list không thấy" 'BR list | jq_ "d[\"count\"]"' "1"
check "search cũng không thấy" 'BR search "thẩm định" | jq_ "d[\"count\"]"' "0"
check "search --all thì thấy" 'BR search "thẩm định" --all | jq_ "d[\"count\"]"' "1"
check "list --archived thấy" 'BR list --archived | jq_ "d[\"count\"]"' "1"
check "suggest-links không gợi ý ghi chú đã cất" \
  'BR suggest-links --id '"$ID"' | jq_ "len(d[\"suggestions\"])"' "0"
check "unarchive lấy lại được" 'BR unarchive --id '"$ID2"' >/dev/null; BR list | jq_ "d[\"count\"]"' "2"
check "xoá thiếu --yes thì bị chặn" \
  'BR delete --id '"$ID2"'; echo "exit=$?"' "$(BR delete --id "$ID2" 2>&1; echo "exit=$?")"
BR delete --id "$ID2" --yes >/dev/null
check "xoá rồi thì còn 1 ghi chú" 'BR list | jq_ "d[\"count\"]"' "1"
check "có bản sao vĩnh viễn trong deleted/" 'ls "$TMP/deleted" | wc -l | tr -d " "' "1"
check "xoá sạch backups vẫn restore được" \
  'rm -rf "$TMP/backups"; BR restore --file '"$ID2"' | jq_ "d[\"ok\"]"' "True"

echo
echo "6. SAO LƯU GIỮ ĐÚNG TRẠNG THÁI"
ID3=$(BR list --limit 1 | jq_ 'd["notes"][0]["id"]')
BR archive --id "$ID3" >/dev/null
BR export --out "$TMP/all.json" --format json --all >/dev/null
rm -f "$SECOND_BRAIN_DB"*
check "nhập lại: ghi chú đã cất vẫn ở kho lưu" \
  'BR import --file "$TMP/all.json" >/dev/null; BR list --archived | jq_ "d[\"count\"]"' "1"

echo
echo "7. FILE HỎNG / THIẾU — phải báo lỗi, không đổ traceback"
check "import file không tồn tại" \
  'BR import --file /khong/co/that.json | jq_ "d[\"error\"][:15]"' "Không thấy file"
printf 'không phải json' > "$TMP/hong.json"
check "import file hỏng" 'BR import --file "$TMP/hong.json" | jq_ "\"không đọc được\" in d[\"error\"]"' "True"
check "add --content-file không tồn tại" \
  'BR add --title x --content-file /khong/co.txt | jq_ "d[\"error\"][:15]"' "Không thấy file"
check "restore id không tồn tại" \
  'BR restore --file zzzzzzzzzzzz | jq_ "d[\"ok\"]"' "False"
check "show id không tồn tại" 'BR show --id zzzzzzzzzzzz | jq_ "d[\"ok\"]"' "False"
check "export vào thư mục chưa có" \
  'BR export --out "$TMP/moi/sau/brain.md" | jq_ "d[\"ok\"]"' "True"

echo
echo "8. NỘI DUNG KHÓ"
BR add --title 'Ký tự lạ: <script> & "nháy" $PATH' \
   --content 'Dòng 1
Dòng 2 có	tab và emoji 🧠 — vẫn phải lưu được.' --category "Thử" --tags thu >/dev/null
check "tiêu đề có ký tự đặc biệt" 'BR search "Ký tự lạ" | jq_ "d[\"count\"]"' "1"
python3 -c "print('từ khoá lặp '*4000)" > "$TMP/dai.txt"
check "ghi chú rất dài (12k từ) vẫn thêm được" \
  'BR add --title "Ghi chú dài" --content-file "$TMP/dai.txt" --category "Thử" --tags dai | jq_ "d[\"ok\"]"' "True"
check "duplicates trên ghi chú dài không treo" \
  'timeout 20 python3 "$BR_PY" duplicates >/dev/null; echo $?' "0"
check "cú pháp FTS sai không làm chết lệnh" 'BR search "AND OR (((" | jq_ "d[\"ok\"]"' "True"
check "tìm dấu nháy đơn" "BR search \"it's\" | jq_ 'd[\"ok\"]'" "True"
check "source sai bị chặn" 'BR add --title x --content y --source bay | jq_ "d[\"ok\"]"' "False"
check "thiếu nội dung bị chặn" 'BR add --title x --content "" | jq_ "d[\"ok\"]"' "False"

echo
echo "9. BIẾN MÔI TRƯỜNG GÕ SAI"
check "KEEP_BACKUPS không phải số" \
  'SECOND_BRAIN_KEEP_BACKUPS=abc BR stats 2>/dev/null | jq_ "d[\"ok\"]"' "True"
check "KEEP_BACKUPS=0 vẫn giữ ít nhất 1 bản" \
  'SECOND_BRAIN_KEEP_BACKUPS=0 BR snapshot | jq_ "d[\"giu_lai\"]"' "1"

echo
echo "10. ĐƯỜNG ỐNG / NGẮT"
check "brain.py list | head không đổ traceback" \
  'BR list 2>&1 | head -2 | grep -c Traceback || true' "0"

echo
echo "11. GỘP"
BR add --title "Hero mobile contain" --content "Ảnh hero ngang trên mobile dùng background-size contain không dùng cover." --category LP --tags landing >/dev/null
A=$(BR list --limit 1 | jq_ 'd["notes"][0]["id"]')
BR add --title "Ảnh hero điện thoại" --content "Trên điện thoại ảnh hero ngang phải để background-size contain chứ không cover." --category LP --tags mobile >/dev/null
B=$(BR list --limit 1 | jq_ 'd["notes"][0]["id"]')
check "duplicates bắt được cặp giống" 'BR duplicates | jq_ "d[\"so_cap\"] >= 1"' "True"
check "merge thiếu --yes bị chặn" 'BR merge --from '"$B"' --into '"$A"' | jq_ "d[\"ok\"]"' "False"
BR merge --from "$B" --into "$A" --yes >/dev/null
check "gộp xong thẻ dồn lại" 'BR show --id '"$A"' | jq_ "sorted(d[\"note\"][\"tags\"])"' "['landing', 'mobile']"
check "ghi chú nguồn vào kho lưu chứ không mất" \
  'BR show --id '"$B"' | jq_ "d[\"note\"][\"status\"]"' "archived"

echo
echo "12. retag"
check "retag đổi cả ghi chú trong kho lưu" \
  'BR retag --from mobile --to di-dong --yes >/dev/null; BR show --id '"$B"' | jq_ "\"di-dong\" in d[\"note\"][\"tags\"]"' "True"

echo
echo "======================================================================"
printf " ĐẠT: %-5s HỎNG: %s\n" "$OK" "$FAIL"
[ "$FAIL" -eq 0 ] && echo " Tất cả test đều qua." || echo " CÓ TEST HỎNG — xem các dòng HỎNG ở trên."
echo "======================================================================"
[ "$FAIL" -eq 0 ] || exit 1
