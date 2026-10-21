#!/usr/bin/env bash
# Cài các skill trong thư mục skills/ vào workspace OpenClaw. Không dùng sudo, không đụng cấu hình khác.
# Dùng:  ./install.sh [--force] [--only tên1,tên2] [--dest /đường/dẫn/skills]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills"; FORCE=0; ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --only) ONLY="$2"; shift ;;
    --dest) DEST="$2"; shift ;;
    *) echo "Tuỳ chọn không hợp lệ: $1" >&2; exit 2 ;;
  esac; shift
done
python3 "$HERE/validate.py" >/dev/null || { echo "Bộ skill không qua kiểm tra: chạy python3 validate.py để xem lỗi" >&2; exit 1; }
python3 "$HERE/deepcheck.py" >/dev/null 2>&1 || { echo "Kiểm tra sâu không đạt: chạy python3 deepcheck.py để xem chi tiết" >&2; exit 1; }
mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"; n=0
for src in "$HERE"/skills/*/; do
  name="$(basename "$src")"
  if [ -n "$ONLY" ] && ! [[ ",$ONLY," == *",$name,"* ]]; then continue; fi
  if [ -e "$DEST/$name" ]; then
    if [ "$FORCE" -ne 1 ]; then echo "BỎ QUA  $name (đã tồn tại; dùng --force để ghi đè, sẽ có backup)"; continue; fi
    mv "$DEST/$name" "$DEST/.$name.bak-$STAMP"; echo "BACKUP  $name -> .$name.bak-$STAMP"
  fi
  cp -r "$src" "$DEST/$name"; chmod +x "$DEST/$name"/scripts/* 2>/dev/null || true
  echo "ĐÃ CÀI  $name"; n=$((n+1))
done
echo; echo "Đã cài $n skill vào $DEST"
echo "Tiếp theo: openclaw gateway restart   rồi   bash kiemtra.sh"
