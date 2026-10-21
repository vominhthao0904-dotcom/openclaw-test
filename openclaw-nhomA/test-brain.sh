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
echo "13. TIẾNG VIỆT: TRÙNG LẶP VÀ TÌM CÂU DÀI"
BR add --title "Phụ đề ASS dùng dấu chấm" --content "Mili giây trong file phụ đề ASS phải dùng dấu chấm, dấu phẩy làm ffmpeg ẩn hết phụ đề." --category Video --tags ass >/dev/null
check "viết lại bằng câu khác vẫn bị nhắc trùng" \
  'BR add --title "Lỗi phụ đề không hiện" --content "Phụ đề không hiện vì mili giây viết bằng dấu phẩy, đổi sang dấu chấm là được." | jq_ "len(d.get(\"similar_existing\",[])) >= 1"' "True"
check "ghi chú khác chủ đề không bị nhắc trùng" \
  'BR add --title "Khách Hải Châu hỏi lọc tổng" --content "Khách khu Hải Châu hay hỏi hệ lọc tổng trước, hỏi giá sau." | jq_ "len(d.get(\"similar_existing\",[]))"' "0"
check "câu hỏi dài vẫn tìm ra (chế độ mở rộng)" \
  'BR search "anh từng ghi gì về lỗi phụ đề ffmpeg" | jq_ "(d[\"che_do\"], d[\"count\"] >= 1)"' "('mo_rong', True)"
check "đủ mọi từ thì tìm chính xác" \
  'BR search "dấu chấm" | jq_ "d[\"che_do\"]"' "chinh_xac"

echo
echo "14. QUYỀN FILE — người dùng khác trên máy không đọc được kho"
check "file kho chỉ chủ sở hữu đọc (600)" 'stat -c %a "$SECOND_BRAIN_DB"' "600"
check "bản sao lưu chỉ chủ sở hữu đọc" \
  'BR snapshot >/dev/null; stat -c %a "$(ls -t "$TMP"/backups/* | head -1)"' "600"
chmod 644 "$SECOND_BRAIN_DB"
check "kho cũ để 644 được tự siết lại" 'BR stats >/dev/null; stat -c %a "$SECOND_BRAIN_DB"' "600"
mkdir -p "$TMP/chung"; chmod 755 "$TMP/chung"
check "không đổi quyền thư mục dùng chung" \
  'SECOND_BRAIN_DB="$TMP/chung/k.sqlite" BR stats >/dev/null; stat -c %a "$TMP/chung"' "755"

echo
echo "15. SAO LƯU DÀI HẠN VÀ KHÁM KHO"
check "bản .sqlite đủ ghi chú (cả phần trong WAL)" \
  'BR snapshot >/dev/null; python3 -c "import sqlite3,sys;print(sqlite3.connect(sys.argv[1]).execute(\"select count(*) from notes\").fetchone()[0])" "$TMP/backups/notes-latest.sqlite"' \
  "$(python3 -c "import sqlite3,sys;print(sqlite3.connect(sys.argv[1]).execute('select count(*) from notes').fetchone()[0])" "$SECOND_BRAIN_DB")"
check "bản .sqlite là file độc lập" \
  'python3 -c "import sqlite3,sys;print(sqlite3.connect(sys.argv[1]).execute(\"pragma journal_mode\").fetchone()[0])" "$TMP/backups/notes-latest.sqlite"' "delete"
check "xoay vòng sao lưu không xoá bản .sqlite" \
  'SECOND_BRAIN_KEEP_BACKUPS=1 BR snapshot >/dev/null; [ -f "$TMP/backups/notes-latest.sqlite" ] && echo con' "con"
check "doctor: kho khoẻ" 'BR doctor | jq_ "d[\"ok\"]"' "True"
python3 -c "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute(\"INSERT INTO notes_fts(rowid,title,content,tags,category) VALUES(99999,'ma','ma','','')\");c.commit()" "$SECOND_BRAIN_DB"
check "doctor phát hiện chỉ mục tìm kiếm lệch" 'BR doctor | jq_ "d[\"ok\"]"' "False"
check "doctor --fix dựng lại chỉ mục" 'BR doctor --fix >/dev/null; BR doctor | jq_ "d[\"ok\"]"' "True"
RID=$(BR add --title "Xoá rồi lấy lại" --content "Nội dung khôi phục" | jq_ 'd["id"]')
BR delete --id "$RID" --yes >/dev/null
BR restore --file "$RID" >/dev/null
check "restore hai lần không đẻ bản trùng" \
  'BR restore --file '"$RID"' >/dev/null; BR search "khôi phục" | jq_ "d[\"count\"]"' "1"

echo
echo "16. PHÂN LOẠI: NHÓM PHÂN CẤP, LOẠI KIẾN THỨC"
check "nhóm 3 tầng giữ đúng" \
  'BR add --title "Gốc A1" --content "nội dung gốc một" --category "Kinh doanh/Lọc nước/Khách lẻ" | jq_ "d[\"category\"]"' "Kinh doanh/Lọc nước/Khách lẻ"
check "khác hoa/thường + khoảng trắng -> dùng chung nhóm cũ" \
  'BR add --title "Gốc A2" --content "nội dung gốc hai" --category " kinh DOANH /  lọc nước " | jq_ "d[\"category\"]"' "Kinh doanh/Lọc nước"
check "gõ thiếu dấu -> gợi ý, không tự đổi" \
  'BR add --title "Gốc A3" --content "nội dung gốc ba" --category "Kinh doanh/Loc nuoc" | jq_ "(d[\"category\"], len(d.get(\"goi_y\",[]))>=1)"' "('Kinh doanh/Loc nuoc', True)"
check "quá 3 tầng bị cắt, có cảnh báo" \
  'BR add --title "Gốc A4" --content "nội dung gốc bốn" --category "A/B/C/D" | jq_ "(d[\"category\"], len(d.get(\"canh_bao\",[])))"' "('A/B/C', 1)"
check "lọc nhóm cha lấy cả nhóm con" 'BR list --category "Kinh doanh" | jq_ "d[\"count\"]"' "3"
check "categories ra cây đúng" 'BR categories | jq_ "[c[\"ten\"] for c in d[\"cay\"] if c[\"ten\"]==\"Kinh doanh\"][0]"' "Kinh doanh"
check "loại lạ bị từ chối" 'BR add --title x --content y --kind "linh tinh" | jq_ "d[\"ok\"]"' "False"
check "bí danh loại: task -> viec" \
  'BR add --title "Gọi khách" --content "gọi lại khách hàng" --kind task --due 1/1/2020 | jq_ "d[\"kind\"]"' "viec"
check "việc quá hạn vào đúng nhóm" 'BR viec | jq_ "len(d.get(\"qua_han\",[]))"' "1"
VID=$(BR list --kind viec | jq_ 'd["notes"][0]["id"]')
check "đánh dấu xong thì hết việc mở" 'BR viec --xong '"$VID"' >/dev/null; BR viec | jq_ "d[\"dang_mo\"]"' "0"
check "hạn sai định dạng bị từ chối" 'BR add --title y --content z --kind viec --due "mai" | jq_ "d[\"ok\"]"' "False"
check "tìm theo loại" 'BR search "gốc" --kind kien-thuc | jq_ "d[\"count\"] >= 1"' "True"

echo
echo "17. CHỐNG TRÙNG Y HỆT"
check "thêm lại y hệt (khác hoa/thường, khoảng trắng) không tạo bản mới" \
  'BR add --title "gốc  a1" --content "Nội dung  gốc một" | jq_ "(d.get(\"da_them\"), bool(d.get(\"trung_hoan_toan\")))"' "(False, True)"
check "--force vẫn thêm được" 'BR add --title "gốc a1" --content "nội dung gốc một" --force | jq_ "bool(d.get(\"id\"))"' "True"
A1=$(BR search "Gốc A2" | jq_ 'd["notes"][0]["id"]')
check "sửa thành y hệt ghi chú khác bị chặn" \
  'BR edit --id '"$A1"' --title "Gốc A3" --content "nội dung gốc ba" | jq_ "d[\"ok\"]"' "False"

echo
echo "18. NẠP NHIỀU NGUỒN"
mkdir -p "$TMP/nap/.an"
printf -- '---\ncategory: Học tập/Khoá học\ntags: [khoa-hoc]\n---\n## Bài một tiêu đề\nNội dung bài một.\n\n## Bài hai tiêu đề\nNội dung bài hai.\n' > "$TMP/nap/k.md"
printf 'Quy trình lắp đặt mẫu\n\nBước một\nBước hai\n' > "$TMP/nap/q.txt"
printf 'tieu_de,noi_dung,nhom,loai\nCSV một,Nội dung csv một,Kỹ thuật/CSV,khai-niem\n' > "$TMP/nap/c.csv"
printf '<html><title>Trang web mẫu</title><script>bimat()</script><p>Đoạn văn trang web.</p></html>' > "$TMP/nap/w.html"
echo "an" > "$TMP/nap/.an/x.md"
check "xem trước không ghi gì" \
  'T0=$(BR stats | jq_ "d[\"total_notes\"]"); BR nap "$TMP/nap" --dry-run >/dev/null; [ "$(BR stats | jq_ "d[\"total_notes\"]")" = "$T0" ] && echo ok' "ok"
check "nạp thư mục: md tách 2 mục + txt + csv + html" 'BR nap "$TMP/nap" | jq_ "d[\"da_them\"]"' "5"
check "frontmatter đặt nhóm + thẻ" 'BR list --category "Học tập/Khoá học" | jq_ "(d[\"count\"], d[\"notes\"][0][\"tags\"])"' "(2, ['khoa-hoc'])"
check "txt lấy dòng đầu làm tên (giữ dấu)" 'BR search "lắp đặt mẫu" | jq_ "d[\"notes\"][0][\"title\"]"' "Quy trình lắp đặt mẫu"
check "csv giữ loại" 'BR list --category "Kỹ thuật/CSV" | jq_ "d[\"notes\"][0][\"kind\"]"' "khai-niem"
check "html bỏ script" 'BR search "bimat" | jq_ "d[\"count\"]"' "0"
check "nạp lại: bỏ hết bản trùng" 'BR nap "$TMP/nap" | jq_ "(d[\"da_them\"], d[\"bo_qua_trung\"])"' "(0, 5)"
check "bỏ qua file trong thư mục ẩn" 'BR search "an" --kind kien-thuc | jq_ "[n for n in d[\"notes\"] if n[\"title\"]==\"X\"]"' "[]"
check "nạp từ stdin" 'echo "Dán nhanh vào kho từ chat" | BR nap - --title "Ghi chú dán" | jq_ "d[\"da_them\"]"' "1"
check "đường dẫn không có báo lỗi rõ" 'BR nap "$TMP/khong-co" | jq_ "d[\"ok\"]"' "False"

echo
echo "======================================================================"
printf " ĐẠT: %-5s HỎNG: %s\n" "$OK" "$FAIL"
[ "$FAIL" -eq 0 ] && echo " Tất cả test đều qua." || echo " CÓ TEST HỎNG — xem các dòng HỎNG ở trên."
echo "======================================================================"
[ "$FAIL" -eq 0 ] || exit 1
