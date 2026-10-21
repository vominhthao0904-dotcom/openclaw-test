#!/usr/bin/env bash
# Cài các skill trong thư mục skills/ vào workspace OpenClaw. Không dùng sudo, không đụng cấu hình khác,
# không đụng kho ghi chú (kho nằm ở workspace/second-brain/, ngoài thư mục skills).
#
# Dùng:  ./install.sh                       cài skill chưa có, bỏ qua skill đã có
#        ./install.sh --force               cài đè (nâng cấp) — bản cũ được sao lưu trước
#        ./install.sh --only a,b            chỉ cài vài skill
#        ./install.sh --dest /đường/dẫn/skills
#        ./install.sh --dry-run             chỉ in ra sẽ làm gì, không chép gì
set -euo pipefail
umask 022
HERE="$(cd "$(dirname "$0")" && pwd)"
WS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
DEST="$WS/skills"; FORCE=0; ONLY=""; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --only) ONLY="${2:?--only cần danh sách tên skill}"; shift ;;
    --dest) DEST="${2:?--dest cần đường dẫn}"; shift ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Tuỳ chọn không hợp lệ: $1" >&2; exit 2 ;;
  esac; shift
done
DEST="${DEST%/}"
command -v python3 >/dev/null 2>&1 || { echo "Thiếu python3 — cài: sudo apt install -y python3" >&2; exit 1; }

# Tên gõ sai trong --only thì báo ngay, đừng im lặng "Đã cài 0 skill"
if [ -n "$ONLY" ]; then
  IFS=',' read -r -a WANT <<<"$ONLY"
  for w in "${WANT[@]}"; do
    w="$(echo "$w" | tr -d '[:space:]')"
    [ -z "$w" ] || [ -d "$HERE/skills/$w" ] || {
      echo "Không có skill tên '$w'. Có: $(cd "$HERE/skills" && ls -d */ | tr -d / | tr '\n' ' ')" >&2; exit 2; }
  done
fi

python3 "$HERE/validate.py" >/dev/null || { echo "Bộ skill không qua kiểm tra: chạy python3 validate.py để xem lỗi" >&2; exit 1; }
python3 "$HERE/deepcheck.py" >/dev/null 2>&1 || { echo "Kiểm tra sâu không đạt: chạy python3 deepcheck.py để xem chi tiết" >&2; exit 1; }

# Sao lưu đặt NGOÀI thư mục skills: để trong đó thì OpenClaw có thể quét trúng
# bản cũ và thấy hai skill trùng tên.
BACKUP_ROOT="$(dirname "$DEST")/skill-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"; n=0; skip=0
[ "$DRY" -eq 1 ] && echo "(chạy thử — không chép gì)"
[ "$DRY" -eq 1 ] || mkdir -p "$DEST"
for src in "$HERE"/skills/*/; do
  name="$(basename "$src")"
  if [ -n "$ONLY" ] && ! [[ ",$(echo "$ONLY" | tr -d '[:space:]')," == *",$name,"* ]]; then continue; fi
  if [ -e "$DEST/$name" ]; then
    if [ "$FORCE" -ne 1 ]; then
      echo "BỎ QUA  $name (đã có; muốn nâng cấp thì chạy lại với --force, bản cũ sẽ được sao lưu)"
      skip=$((skip+1)); continue
    fi
    if [ "$DRY" -eq 1 ]; then echo "SẼ SAO LƯU  $name -> $BACKUP_ROOT/$name-$STAMP"
    else
      mkdir -p "$BACKUP_ROOT"; chmod 700 "$BACKUP_ROOT"
      mv "$DEST/$name" "$BACKUP_ROOT/$name-$STAMP"; echo "SAO LƯU $name -> $BACKUP_ROOT/$name-$STAMP"
    fi
  fi
  if [ "$DRY" -eq 1 ]; then echo "SẼ CÀI  $name"; n=$((n+1)); continue; fi
  # Chép vào thư mục tạm cạnh đích rồi đổi tên một lần: hỏng giữa chừng thì không để lại skill dở dang
  tmp="$DEST/.$name.installing-$$"
  rm -rf "$tmp"
  cp -R "$src" "$tmp"
  find "$tmp" -name '__pycache__' -prune -exec rm -rf {} +
  # Quyền chuẩn: không ai ngoài chủ sở hữu sửa được code mà agent sẽ chạy
  chmod -R u+rwX,go-w "$tmp"
  find "$tmp/scripts" -maxdepth 1 -type f \( -name '*.py' -o -name '*.sh' \) -exec chmod 755 {} + 2>/dev/null || true
  mv "$tmp" "$DEST/$name"
  echo "ĐÃ CÀI  $name"; n=$((n+1))
done
echo
if [ "$DRY" -eq 1 ]; then echo "Chạy thử xong: sẽ cài $n skill vào $DEST"; exit 0; fi
echo "Đã cài $n skill vào $DEST"
[ "$skip" -gt 0 ] && echo "Bỏ qua $skip skill đã có (dùng --force để nâng cấp)."
echo "Tiếp theo: openclaw gateway restart   rồi   bash kiemtra.sh"
