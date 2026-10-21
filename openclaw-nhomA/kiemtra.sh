#!/usr/bin/env bash
# Kiểm tra sau khi cài: 4 skill nhóm A đã lên OpenClaw chưa, và có chạy được không.
# Chỉ đọc và thử nghiệm trên file tạm — không sửa gì của anh.
#
# Dùng:  bash kiemtra.sh
#        bash kiemtra.sh --dir /duong/dan/skills     (nếu workspace nằm chỗ khác)

set -uo pipefail

SKILLS_DIR="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills"
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) SKILLS_DIR="${2:?--dir cần đường dẫn}"; shift 2 ;;
    *) echo "Tham số lạ: $1" >&2; exit 2 ;;
  esac
done
SKILLS_DIR="${SKILLS_DIR%/}"
NHOM_A=(second-brain pdf-extract-crop css-video-production pptx-deck-builder)
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
DAT=0; HONG=0

# Đếm theo KÝ TỰ, không theo byte: `wc -m` trả về byte khi locale không phải UTF-8,
# làm chữ có dấu bị lệch cột. python3 là thứ skill nào cũng cần nên dùng luôn.
pad() {
  local s="$1" n="$2" len
  len=$(printf '%s' "$s" | python3 -c \
    'import sys;print(len(sys.stdin.buffer.read().decode("utf-8","replace")))' 2>/dev/null)
  [ -n "$len" ] || len=${#s}
  printf '%s' "$s"
  while [ "$len" -lt "$n" ]; do printf ' '; len=$((len+1)); done
}
ok()   { echo "ĐẠT"; DAT=$((DAT+1)); }
hong() { echo "CHƯA ĐẠT — $1"; HONG=$((HONG+1)); }

echo "======================================================================"
echo " KIỂM TRA 4 SKILL NHÓM A (26 mục)"
echo " Thư mục skills: $SKILLS_DIR"
echo "======================================================================"

# ---------- PHẦN 1: file skill đã nằm đúng chỗ chưa ----------
echo
echo "PHẦN 1 — Thư mục skill đã được chép lên VPS chưa?"
for s in "${NHOM_A[@]}"; do
  pad "  $s" 32
  if [ -f "$SKILLS_DIR/$s/SKILL.md" ]; then ok; else hong "không thấy $SKILLS_DIR/$s/SKILL.md — chạy lại ./install.sh"; fi
done

# ---------- PHẦN 2: OpenClaw đã nhận chưa ----------
echo
echo "PHẦN 2 — OpenClaw đã nhận 4 skill này chưa?"
if command -v openclaw >/dev/null 2>&1; then
  DS="$(timeout 60 openclaw skills list 2>&1)"
  for s in "${NHOM_A[@]}"; do
    pad "  $s" 32
    if printf '%s' "$DS" | grep -q -- "$s"; then ok
    else hong "OpenClaw chưa thấy — thiếu gói phần mềm, hoặc chưa chạy: openclaw gateway restart"; fi
  done
else
  echo "  Không tìm thấy lệnh 'openclaw' — bỏ qua phần này."
  echo "  (Nếu OpenClaw cài cho user khác, hãy chạy script bằng đúng user đó.)"
fi

# ---------- PHẦN 3: công cụ kèm theo ----------
echo
echo "PHẦN 3 — Công cụ cần thiết đã cài chưa?"
check_bin() {
  pad "  $1" 32
  if command -v "$1" >/dev/null 2>&1; then ok; else hong "thiếu — cài bằng: sudo apt install -y $2"; fi
}
check_py() {
  pad "  thư viện Python: $1" 32
  if python3 -c "import $1" 2>/dev/null; then ok; else hong "thiếu — cài bằng: pip install $2"; fi
}
check_bin pdftotext poppler-utils
check_bin pdftoppm  poppler-utils
check_bin ffmpeg    ffmpeg
check_bin ffprobe   ffmpeg
check_py  PIL   pillow
check_py  pptx  python-pptx

# ---------- PHẦN 4: chạy thử thật ----------
echo
echo "PHẦN 4 — Chạy thử từng skill (trên file tạm, không đụng dữ liệu của anh)"

pad "  second-brain" 32
if [ -f "$SKILLS_DIR/second-brain/scripts/brain.py" ] &&
   SECOND_BRAIN_DB="$TMP/thu.sqlite" python3 "$SKILLS_DIR/second-brain/scripts/brain.py" \
     add --title "Ghi chú thử" --content "Nội dung kiểm tra" --tags thu >/dev/null 2>&1 &&
   SECOND_BRAIN_DB="$TMP/thu.sqlite" python3 "$SKILLS_DIR/second-brain/scripts/brain.py" \
     search "kiểm tra" 2>/dev/null | grep -q "Ghi chú thử"
then ok; else hong "ghi/tìm ghi chú không thành công"; fi

pad "  second-brain (duy trì kho)" 32
if SECOND_BRAIN_DB="$TMP/thu.sqlite" python3 "$SKILLS_DIR/second-brain/scripts/brain.py" \
     inbox 2>/dev/null | grep -q '"cho_phan_loai"' &&
   SECOND_BRAIN_DB="$TMP/thu.sqlite" python3 "$SKILLS_DIR/second-brain/scripts/brain.py" \
     review --min-age 0 2>/dev/null | grep -q '"notes"' &&
   SECOND_BRAIN_DB="$TMP/thu.sqlite" python3 "$SKILLS_DIR/second-brain/scripts/brain.py" \
     digest --days 7 2>/dev/null | grep -q '"theo_nhom"' &&
   SECOND_BRAIN_DB="$TMP/thu.sqlite" python3 "$SKILLS_DIR/second-brain/scripts/brain.py" \
     stats 2>/dev/null | grep -q '"suc_khoe_kho"'
then ok; else hong "lệnh inbox/review/digest/stats không chạy được"; fi

pad "  second-brain (giữ dữ liệu)" 32
# hàm thay cho eval: đường dẫn có dấu cách hay ký tự lạ cũng không vỡ lệnh
SB() { SECOND_BRAIN_DB="$TMP/thu.sqlite" python3 "$SKILLS_DIR/second-brain/scripts/brain.py" "$@"; }
THU_ID=$(SB list --limit 1 2>/dev/null | \
  python3 -c 'import json,sys;print(json.load(sys.stdin)["notes"][0]["id"])' 2>/dev/null)
if [ -n "$THU_ID" ] &&
   SB archive --id "$THU_ID" >/dev/null 2>&1 &&
   [ "$(SB list 2>/dev/null | grep -c "\"$THU_ID\"")" = "0" ] &&
   SB unarchive --id "$THU_ID" >/dev/null 2>&1 &&
   SB delete --id "$THU_ID" --yes 2>/dev/null | grep -q '"ban_sao_vinh_vien"' &&
   SB restore --file "$THU_ID" 2>/dev/null | grep -q '"lay_lai"'
then ok; else hong "cất kho / xoá có bản sao / lấy lại không hoạt động"; fi

pad "  second-brain (trang web)" 32
if [ -f "$SKILLS_DIR/second-brain/public/index.html" ] &&
   [ -f "$SKILLS_DIR/second-brain/public/app.js" ] &&
   [ -f "$SKILLS_DIR/second-brain/public/styles.css" ] &&
   python3 "$SKILLS_DIR/second-brain/scripts/server.py" --help >/dev/null 2>&1
then ok; else hong "thiếu file giao diện hoặc server.py không chạy được"; fi

pad "  pdf-extract-crop" 32
# Tự tạo một PDF mẫu (không cần reportlab) rồi tìm chữ và cắt ảnh thật
if python3 - "$TMP/thu.pdf" <<'PY' 2>/dev/null
import sys
s = "BT /F1 12 Tf 72 700 Td (Ma may HA1600/570PVC thu nghiem) Tj ET"
objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
        f"<< /Length {len(s)} >>\nstream\n{s}\nendstream"]
out, offs = "%PDF-1.4\n", []
for i, o in enumerate(objs, 1):
    offs.append(len(out)); out += f"{i} 0 obj\n{o}\nendobj\n"
x = len(out)
out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offs)
out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n"
open(sys.argv[1], "w").write(out)
PY
   python3 "$SKILLS_DIR/pdf-extract-crop/scripts/pdf_tools.py" find "$TMP/thu.pdf" "HA1600/570PVC" 2>/dev/null | grep -q '"matches": 1' &&
   python3 "$SKILLS_DIR/pdf-extract-crop/scripts/pdf_tools.py" crop-text "$TMP/thu.pdf" "HA1600/570PVC" \
     --below 30 --out "$TMP/cat.png" >/dev/null 2>&1 && [ -s "$TMP/cat.png" ]
then ok; else hong "không tìm/cắt được chữ trong PDF — kiểm tra poppler-utils và pillow"; fi

pad "  css-video (khuôn hình)" 32
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 &&
   ffmpeg -hide_banner -loglevel error -f lavfi -i "testsrc=size=640x360:rate=10:duration=3" \
     -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$TMP/m.mp4" -y >/dev/null 2>&1 &&
   printf '%s' "{\"main\":\"$TMP/m.mp4\",\"out\":\"$TMP/o.mp4\",\"broll\":[{\"file\":\"$TMP/m.mp4\",\"start\":1,\"duration\":1}]}" > "$TMP/c.json" &&
   python3 "$SKILLS_DIR/css-video-production/scripts/compose.py" --spec "$TMP/c.json" --dry-run 2>/dev/null \
     | grep -q "scale=640:360"
then ok; else hong "B-roll không tự khớp khuôn hình video chính"; fi

pad "  css-video-production" 32
printf '%s' '{"scenes":[{"duration":5,"chunks":[{"text":"Cau thu nghiem phu de","keyword":"phu de"}]}]}' > "$TMP/canh.json"
if python3 "$SKILLS_DIR/css-video-production/scripts/make_ass.py" --spec "$TMP/canh.json" --out "$TMP/phude.ass" >/dev/null 2>&1 &&
   grep -q "Dialogue:" "$TMP/phude.ass"
then ok; else hong "không tạo được file phụ đề"; fi

pad "  pptx-deck-builder" 32
printf '%s' '{"slides":[{"layout":"cards","title":"Thu nghiem","cards":[{"title":"A","body":"mo ta"}]}]}' > "$TMP/deck.json"
if python3 "$SKILLS_DIR/pptx-deck-builder/scripts/build_pptx.py" --input "$TMP/deck.json" --output "$TMP/thu.pptx" >/dev/null 2>&1 &&
   [ -s "$TMP/thu.pptx" ]
then ok; else hong "không dựng được file .pptx — kiểm tra python-pptx"; fi

# ---------- PHẦN 5: an toàn ----------
echo
echo "PHẦN 5 — An toàn"

pad "  code skill không ai sửa lén" 32
LO=$(find "${NHOM_A[@]/#/$SKILLS_DIR/}" -perm -o+w 2>/dev/null | head -3)
if [ -z "$LO" ]; then ok; else hong "có file ai cũng ghi được: $LO — chạy: chmod -R go-w $SKILLS_DIR"; fi

pad "  kho ghi chú riêng tư" 32
KHO="${SECOND_BRAIN_DB:-$(dirname "$SKILLS_DIR")/second-brain/notes.sqlite}"
if [ ! -f "$KHO" ]; then ok
elif [ "$(( 0$(stat -c %a "$KHO") & 077 ))" -eq 0 ]; then ok
else hong "$KHO user khác đọc được — chạy một lệnh bất kỳ (brain.py stats) để tự siết, hoặc: chmod 600 $KHO"; fi

pad "  trang web không mở ra ngoài" 32
# Đọc thẳng /proc/net/tcp{,6} (không cần ss/netstat): cổng đang LISTEN trên địa chỉ 0.0.0.0 / ::
MO=$(python3 - "${BRAIN_PORT:-8787}" <<'PY' 2>/dev/null
import sys
port = int(sys.argv[1])
for f in ("/proc/net/tcp", "/proc/net/tcp6"):
    try:
        rows = open(f).read().splitlines()[1:]
    except OSError:
        continue
    for r in rows:
        c = r.split()
        ip, p = c[1].split(":")
        if c[3] == "0A" and int(p, 16) == port and set(ip) == {"0"}:
            print("mo"); sys.exit()
PY
)
if [ "$MO" = "mo" ]; then
  hong "cổng ${BRAIN_PORT:-8787} đang mở cho mọi địa chỉ — ai biết IP là đọc được kho. Tắt (pkill -f second-brain/scripts/server.py) rồi chạy lại KHÔNG đặt BRAIN_HOST"
else ok; fi

pad "  sao lưu hằng ngày đã bật" 32
if crontab -l 2>/dev/null | grep -v '^[[:space:]]*#' | grep -q 'second-brain/scripts/brain.py snapshot'; then ok
elif ! command -v crontab >/dev/null 2>&1; then hong "máy chưa có cron — cài: sudo apt install -y cron, rồi làm Bước 5 trong CAI-DAT.md"
else hong "chưa có lịch sao lưu — làm Bước 5 trong CAI-DAT.md (dán một khối lệnh)"; fi

# ---------- KẾT LUẬN ----------
echo
echo "======================================================================"
echo " ĐẠT: $DAT     CHƯA ĐẠT: $HONG"
if [ "$HONG" -eq 0 ]; then
  echo
  echo " Xong. Cả 4 skill đã sẵn sàng. Thử nói với Mây:"
  echo '   "Ghi lại giúp anh: landing page mobile dùng ảnh ngang thì phải để contain"'
else
  echo
  echo " Đọc các dòng CHƯA ĐẠT ở trên — mỗi dòng có ghi sẵn cách sửa."
  echo " Sửa xong nhớ chạy lại:  openclaw gateway restart"
fi
echo "======================================================================"
[ "$HONG" -eq 0 ]
