#!/usr/bin/env bash
# Kiểm tra VPS trước khi cài 4 skill nhóm A.
# Script này CHỈ ĐỌC, không cài gì, không sửa gì, không đụng vào dữ liệu.
#   bash truoc-khi-cai.sh
#   bash truoc-khi-cai.sh --dir /duong/dan/khac/skills

set -u
DAT=0; CANHBAO=0; HONG=0
SKILLS_DIR=""
NHOM_A=(second-brain pdf-extract-crop css-video-production pptx-deck-builder)

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) SKILLS_DIR="${2:-}"; shift 2 ;;
    *) echo "Tham số lạ: $1"; exit 2 ;;
  esac
done

pad() {
  local s="$1" n="$2" len
  len=$(printf '%s' "$s" | python3 -c \
    'import sys;print(len(sys.stdin.buffer.read().decode("utf-8","replace")))' 2>/dev/null)
  [ -n "$len" ] || len=${#s}
  printf '%s' "$s"
  while [ "$len" -lt "$n" ]; do printf ' '; len=$((len+1)); done
}
ok()   { echo "ĐẠT — $1";      DAT=$((DAT+1)); }
luu()  { echo "LƯU Ý — $1";    CANHBAO=$((CANHBAO+1)); }
hong() { echo "CHƯA ĐẠT — $1"; HONG=$((HONG+1)); }

echo "======================================================================"
echo " KIỂM TRA TRƯỚC KHI CÀI — 4 skill nhóm A"
echo " Máy: $(hostname 2>/dev/null || echo '?')   User: $(whoami)"
echo "======================================================================"

# ---------- 1. Những thứ bắt buộc ----------
echo
echo "1. BẮT BUỘC PHẢI CÓ"

pad "  python3" 26
if command -v python3 >/dev/null 2>&1; then
  V=$(python3 -c 'import sys;print("%d.%d"%sys.version_info[:2])' 2>/dev/null)
  MIN=$(python3 -c 'import sys;print(1 if sys.version_info>=(3,8) else 0)' 2>/dev/null)
  if [ "$MIN" = "1" ]; then ok "bản $V"; else hong "bản $V quá cũ, cần từ 3.8 trở lên"; fi
else
  hong "chưa có python3 — cài: sudo apt install -y python3"
fi

pad "  sqlite3 (trong python)" 26
if python3 -c 'import sqlite3' 2>/dev/null; then
  FTS=$(python3 - <<'PY' 2>/dev/null
import sqlite3
d = sqlite3.connect(":memory:")
try:
    d.execute("CREATE VIRTUAL TABLE t USING fts5(a, tokenize='unicode61')")
    print("co")
except Exception:
    print("khong")
PY
)
  if [ "$FTS" = "co" ]; then ok "có FTS5, tìm kiếm tiếng Việt chạy được"
  else hong "python3 thiếu FTS5 — Second Brain không tìm kiếm được. Cài lại python3 bản chuẩn của Ubuntu/Debian"; fi
else
  hong "python3 không có module sqlite3 — cài: sudo apt install -y python3"
fi

pad "  unzip" 26
command -v unzip >/dev/null 2>&1 && ok "có" || hong "chưa có — cài: sudo apt install -y unzip"

pad "  lệnh openclaw" 26
if command -v openclaw >/dev/null 2>&1; then
  ok "$(command -v openclaw)"
else
  hong "không thấy lệnh openclaw. Có thể anh đang đăng nhập SAI USER — hãy SSH lại bằng đúng user đang chạy OpenClaw"
fi

# ---------- 2. Chỗ sẽ cài vào ----------
echo
echo "2. CHỖ SẼ CÀI VÀO"

if [ -z "$SKILLS_DIR" ]; then
  for c in "$HOME/.openclaw/workspace/skills" "/root/.openclaw/workspace/skills" \
           "$HOME/openclaw/workspace/skills"; do
    [ -d "$(dirname "$c")" ] && { SKILLS_DIR="$c"; break; }
  done
  [ -n "$SKILLS_DIR" ] || SKILLS_DIR="$HOME/.openclaw/workspace/skills"
fi

pad "  thư mục skills" 26
if [ -d "$SKILLS_DIR" ]; then
  ok "$SKILLS_DIR"
elif [ -d "$(dirname "$SKILLS_DIR")" ]; then
  luu "chưa có $SKILLS_DIR — install.sh sẽ tự tạo, không sao"
else
  hong "không tìm thấy workspace của OpenClaw. Tìm bằng: find / -name 'workspace' -path '*openclaw*' 2>/dev/null | head"
fi

pad "  quyền ghi" 26
GOC="$SKILLS_DIR"; while [ ! -d "$GOC" ] && [ "$GOC" != "/" ]; do GOC=$(dirname "$GOC"); done
if [ -w "$GOC" ]; then ok "ghi được vào $GOC"
else hong "không có quyền ghi vào $GOC — SSH lại bằng user khác, hoặc dùng sudo"; fi

# ---------- 3. Đã cài lần nào chưa ----------
echo
echo "3. ĐÃ CÀI LẦN NÀO CHƯA"
DA_CO=0
for s in "${NHOM_A[@]}"; do
  pad "  $s" 26
  if [ -d "$SKILLS_DIR/$s" ]; then
    DA_CO=$((DA_CO+1))
    luu "đã có sẵn — cài lại sẽ ghi đè phần script, DỮ LIỆU GHI CHÚ KHÔNG BỊ ĐỤNG"
  else
    ok "chưa có, cài mới"
  fi
done

pad "  kho ghi chú cũ" 26
KHO="$(dirname "$SKILLS_DIR")/second-brain/notes.sqlite"
if [ -f "$KHO" ]; then
  SO=$(python3 - "$KHO" <<'PY' 2>/dev/null
import sqlite3, sys
try:
    print(sqlite3.connect(sys.argv[1]).execute("SELECT count(*) FROM notes").fetchone()[0])
except Exception:
    print("?")
PY
)
  if [ "$SO" = "0" ]; then
    ok "có file kho nhưng đang rỗng"
  else
    luu "đã có kho $SO ghi chú tại $KHO — bản mới tự nâng cấp, giữ nguyên dữ liệu"
  fi
else
  ok "chưa có kho, sẽ tạo mới khi ghi chú đầu tiên"
fi

# ---------- 4. Công cụ cho 3 skill còn lại ----------
echo
echo "4. CÔNG CỤ CHO 3 SKILL CÒN LẠI (second-brain KHÔNG cần)"
kiem_bin() {
  pad "  $1" 26
  command -v "$1" >/dev/null 2>&1 && ok "có" || luu "chưa có — cài: sudo apt install -y $2"
}
kiem_py() {
  pad "  python: $1" 26
  python3 -c "import $1" 2>/dev/null && ok "có" || luu "chưa có — cài: pip install $2"
}
kiem_bin pdftotext poppler-utils
kiem_bin pdftoppm  poppler-utils
kiem_bin ffmpeg    ffmpeg
kiem_bin ffprobe   ffmpeg
kiem_py  PIL  pillow
kiem_py  pptx python-pptx

# ---------- 5. Tài nguyên máy ----------
echo
echo "5. MÁY CÓ ĐỦ SỨC KHÔNG"

pad "  ổ đĩa trống" 26
TRONG_MB=$(df -Pm "$GOC" 2>/dev/null | awk 'NR==2{print $4}')
if [ -n "$TRONG_MB" ]; then
  if [ "$TRONG_MB" -ge 500 ]; then ok "${TRONG_MB} MB (4 skill cần ~1 MB; ffmpeg nếu phải cài thêm ~300 MB)"
  elif [ "$TRONG_MB" -ge 60 ]; then luu "${TRONG_MB} MB — đủ cho skill, nhưng hơi chật nếu phải cài ffmpeg"
  else hong "chỉ còn ${TRONG_MB} MB — dọn bớt trước khi cài"; fi
else
  luu "không đọc được dung lượng trống"
fi

pad "  RAM" 26
if [ -r /proc/meminfo ]; then
  TONG=$(awk '/MemTotal/{printf "%d", $2/1024}' /proc/meminfo)
  CON=$(awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo)
  if [ "$CON" -ge 200 ]; then ok "còn trống ${CON} MB / tổng ${TONG} MB (trang web Second Brain tốn ~25 MB)"
  else luu "chỉ còn ${CON} MB trống / tổng ${TONG} MB — vẫn chạy được, nhưng đừng mở trang web cùng lúc nhiều việc nặng"; fi
else
  luu "không đọc được /proc/meminfo"
fi

pad "  cổng 8787" 26
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ':8787 '; then
  luu "đang có thứ khác dùng cổng 8787 — chạy trang web bằng: BRAIN_PORT=9090 python3 .../server.py"
else
  ok "trống, trang web dùng được"
fi

# ---------- tổng kết ----------
echo
echo "======================================================================"
printf " ĐẠT: %-4s LƯU Ý: %-4s CHƯA ĐẠT: %s\n" "$DAT" "$CANHBAO" "$HONG"
echo
if [ "$HONG" -gt 0 ]; then
  echo " ĐỪNG CÀI VỘI. Sửa các dòng CHƯA ĐẠT ở trên rồi chạy lại script này."
elif [ "$DA_CO" -gt 0 ]; then
  echo " Cài được. Lưu ý: $DA_CO skill đã có sẵn, cài lại chỉ ghi đè script."
  echo " Ghi chú trong kho KHÔNG bị đụng tới."
else
  echo " Máy sẵn sàng. Sang PHẦN 2 trong CAI-DAT.md."
fi
[ "$CANHBAO" -gt 0 ] && echo " Dòng LƯU Ý không chặn việc cài — đọc để biết trước điều gì sẽ xảy ra."
echo "======================================================================"
[ "$HONG" -gt 0 ] && exit 1
exit 0
