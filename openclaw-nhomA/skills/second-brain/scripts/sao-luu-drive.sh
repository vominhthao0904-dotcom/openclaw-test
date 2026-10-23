#!/usr/bin/env bash
# Sao lưu kho Second Brain lên Google Drive — MÃ HOÁ ngay trên VPS (rclone crypt) trước khi gửi đi.
# Google chỉ giữ dữ liệu đã khoá: không đọc được tên file, không đọc được nội dung.
#
#   bash sao-luu-drive.sh kiem            kiểm tra đã cài đủ chưa (rclone, remote mã hoá, kết nối)
#   bash sao-luu-drive.sh chay            sao lưu ngay: chụp kho -> mã hoá -> tải lên -> xoá bản quá hạn
#   bash sao-luu-drive.sh ds              liệt kê các bản trên Drive
#   bash sao-luu-drive.sh khoi-phuc [NGÀY]   tải về + giải mã (mặc định bản mới nhất) ra file riêng, KHÔNG đè kho đang dùng
#   bash sao-luu-drive.sh lich            đặt lịch tự chạy mỗi đêm 2h47 (sau bản sao lưu 2h17)
#
# Biến môi trường:
#   SB_DRIVE_REMOTE   tên remote mã hoá của rclone (mặc định: brain-mahoa)
#   SB_DRIVE_GIU_NGAY giữ bản trên Drive bao nhiêu ngày (mặc định 90)
set -uo pipefail
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"
WS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
DB="${SECOND_BRAIN_DB:-$WS/second-brain/notes.sqlite}"
DIR="$(dirname "$DB")"
BK="$DIR/backups"
REMOTE="${SB_DRIVE_REMOTE:-brain-mahoa}"
GIU="${SB_DRIVE_GIU_NGAY:-90}"
LOG="$BK/drive.log"
TRANG_THAI="$BK/drive-last.json"

ghi() { mkdir -p "$BK"; printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; echo "$*"; }
loi() { ghi "LỖI: $*"; exit 1; }

can_rclone() {
  command -v rclone >/dev/null 2>&1 || loi "chưa có rclone — cài: sudo apt install -y rclone"
}

can_remote() {
  # đọc HẾT danh sách rồi mới so, không dùng ống "rclone listremotes | grep -q": grep thấy tên ở dòng đầu là
  # thoát, rclone ghi tiếp dòng sau thì dính SIGPIPE, pipefail coi cả ống là lỗi -> báo "chưa có remote" oan.
  # VPS ít nhân CPU gặp gần như mỗi lần (đo 38/40) -> sao lưu đêm bị bỏ.
  local ds
  ds="$(rclone listremotes 2>/dev/null)"
  grep -qx "$REMOTE:" <<<"$ds" \
    || loi "chưa có remote '$REMOTE' — làm Bước 6 trong CAI-DAT.md (rclone config: tạo 'gdrive' rồi 'brain-mahoa' kiểu crypt)"
  local kieu
  kieu="$(rclone config show "$REMOTE" 2>/dev/null | awk -F' = ' '$1=="type"{print $2}')"
  # bảo vệ quan trọng nhất: chỉ chịu gửi qua remote MÃ HOÁ — gõ nhầm sang 'gdrive' là lộ ghi chú dạng thô
  [ "$kieu" = "crypt" ] || loi "remote '$REMOTE' có kiểu '$kieu', không phải 'crypt' (mã hoá). Từ chối gửi dữ liệu chưa mã hoá lên Drive."
}

# Danh sách trống nhưng thư mục thật trên Drive vẫn có file -> gần như chắc chắn SAI MẬT KHẨU mã hoá
# (sai mật khẩu thì rclone không giải được tên file nên "không thấy" gì). Báo đúng bệnh, đừng để
# người dùng tưởng mất hết bản sao lưu.
bao_neu_sai_mat_khau() {
  local goc
  goc="$(rclone config show "$REMOTE" 2>/dev/null | awk -F' = ' '$1=="remote"{print $2}')"
  [ -n "$goc" ] || return 0
  if [ "$(rclone lsf -R "$goc" 2>/dev/null | grep -vc '/$')" -gt 0 ]; then
    loi "trên Drive CÓ dữ liệu nhưng không giải mã được — mật khẩu mã hoá của '$REMOTE' khác lúc sao lưu. Tạo lại remote với ĐÚNG 2 mật khẩu đã ghi lại (rclone config)."
  fi
}

cmd_kiem() {
  can_rclone
  echo "rclone: $(rclone version 2>/dev/null | head -1)"
  can_remote
  echo "remote mã hoá: $REMOTE: (crypt) → $(rclone config show "$REMOTE" | awk -F' = ' '$1=="remote"{print $2}')"
  # mkdir trước: lần đầu thư mục chưa có thì lsf báo "không thấy" dù kết nối vẫn tốt
  if rclone mkdir "$REMOTE:kho" >/dev/null 2>&1 && rclone lsf "$REMOTE:kho" >/dev/null 2>&1; then echo "kết nối Drive: được"
  else loi "không kết nối được Drive — token hết hạn? chạy: rclone config reconnect gdrive:"; fi
  if [ -f "$TRANG_THAI" ]; then echo "lần sao lưu Drive gần nhất: $(cat "$TRANG_THAI")"
  else echo "chưa sao lưu lên Drive lần nào — chạy: bash $0 chay"; fi
  grep -q "sao-luu-drive.sh chay" <<<"$(crontab -l 2>/dev/null)" && echo "lịch tự động: đã bật" || echo "lịch tự động: CHƯA bật — chạy: bash $0 lich"
}

cmd_chay() {
  can_rclone; can_remote
  [ -f "$DB" ] || loi "không thấy kho $DB"
  # không chạy chồng hai lần (cron + tay cùng lúc). Kho mới chưa chụp lần nào thì chưa có backups/:
  # phải tạo trước, không thì mở khoá hỏng và flock báo nhầm "đang có lần khác chạy"
  mkdir -p "$BK"
  exec 9>"$BK/.drive.lock"
  command -v flock >/dev/null 2>&1 && { flock -n 9 || loi "đang có một lần sao lưu Drive khác chạy"; }
  # 1. chụp kho thành MỘT file nhất quán (không chép thẳng notes.sqlite — chế độ WAL có thể thiếu dữ liệu)
  python3 "$HERE/brain.py" snapshot --reason drive >/dev/null || loi "không chụp được kho (brain.py snapshot)"
  local ngay ten
  ngay="$(date +%F)"; ten="notes-$ngay.sqlite"
  # 2. mã hoá + tải lên; rclone tự kiểm tra toàn vẹn sau khi tải
  rclone copyto "$BK/notes-latest.sqlite" "$REMOTE:kho/$ten" --retries 5 --low-level-retries 10 2>>"$LOG" \
    || loi "tải lên Drive thất bại (xem $LOG)"
  # 3. ghi chú đã xoá hẳn (deleted/) — bản vĩnh viễn, cũng đưa lên cho chắc
  if [ -d "$DIR/deleted" ]; then
    rclone copy "$DIR/deleted" "$REMOTE:deleted" --retries 5 2>>"$LOG" || ghi "cảnh báo: chưa tải được deleted/"
  fi
  # 4. kiểm lại: file vừa lên phải có mặt và khác rỗng
  local co
  co="$(rclone lsf "$REMOTE:kho" --include "$ten" 2>/dev/null)"
  [ "$co" = "$ten" ] || loi "không thấy $ten trên Drive sau khi tải"
  # 5. xoá bản quá hạn (chỉ trong thư mục kho/, chỉ file notes-*.sqlite)
  rclone delete "$REMOTE:kho" --min-age "${GIU}d" --include "notes-*.sqlite" 2>>"$LOG" || ghi "cảnh báo: chưa dọn được bản cũ"
  local so
  so="$(rclone lsf "$REMOTE:kho" --include 'notes-*.sqlite' 2>/dev/null | wc -l)"
  printf '{"luc": "%s", "file": "%s", "so_ban_tren_drive": %s, "remote": "%s"}\n' \
    "$(date -Iseconds)" "$ten" "$so" "$REMOTE" > "$TRANG_THAI"
  ghi "ĐÃ SAO LƯU $ten lên $REMOTE: (mã hoá) — trên Drive đang có $so bản, giữ $GIU ngày"
}

cmd_ds() {
  can_rclone; can_remote
  local ds
  ds="$(rclone lsl "$REMOTE:kho" --include 'notes-*.sqlite' 2>/dev/null | sort -k4)"
  [ -n "$ds" ] || { bao_neu_sai_mat_khau; echo "trên Drive chưa có bản nào"; return; }
  echo "$ds"
}

cmd_khoi_phuc() {
  can_rclone; can_remote
  local ten
  if [ -n "${1:-}" ]; then ten="notes-$1.sqlite"
  else ten="$(rclone lsf "$REMOTE:kho" --include 'notes-*.sqlite' 2>/dev/null | sort | tail -1)"; fi
  [ -n "$ten" ] || { bao_neu_sai_mat_khau; loi "trên Drive chưa có bản nào"; }
  local dich="$DIR/khoi-phuc-${ten#notes-}"
  rclone copyto "$REMOTE:kho/$ten" "$dich" 2>>"$LOG" || loi "không tải được $ten (sai ngày? xem: bash $0 ds)"
  local kq
  kq="$(python3 - "$dich" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
ok = c.execute("PRAGMA integrity_check").fetchone()[0]
n = c.execute("SELECT count(*) FROM notes").fetchone()[0]
print(f"{ok} {n}")
PY
)" || loi "file tải về không mở được — sai mật khẩu mã hoá? (remote crypt phải dùng ĐÚNG mật khẩu cũ)"
  set -- $kq
  [ "$1" = "ok" ] || loi "file tải về bị hỏng ($1)"
  ghi "ĐÃ TẢI VỀ + GIẢI MÃ: $dich ($2 ghi chú, nguyên vẹn)"
  cat <<EOF

Kho đang dùng KHÔNG bị đụng tới. Muốn dùng bản vừa khôi phục thay cho kho hiện tại:
  bash $HERE/web.sh stop
  mv "$DB" "$DB.truoc-khoi-phuc-\$(date +%F)"; rm -f "$DB-wal" "$DB-shm"
  mv "$dich" "$DB"
  python3 $HERE/brain.py doctor
Hoặc chỉ lấy lại một vài ghi chú: mở file bằng brain.py (SECOND_BRAIN_DB="$dich" python3 $HERE/brain.py search "…").
EOF
}

cmd_lich() {
  command -v crontab >/dev/null 2>&1 || loi "chưa có cron — cài: sudo apt install -y cron"
  # đọc HẾT lịch cũ vào biến rồi mới ghi — không bao giờ làm mất các dòng lịch khác của anh
  local cu
  cu="$(crontab -l 2>/dev/null | grep -v 'second-brain/scripts/sao-luu-drive.sh')"
  { [ -n "$cu" ] && printf '%s\n' "$cu"
    echo "47 2 * * * bash $HERE/sao-luu-drive.sh chay >/dev/null 2>&1"
  } | crontab - || loi "không ghi được lịch (crontab)"
  ghi "đã đặt lịch: mỗi đêm 2h47 tự sao lưu lên Drive"
  crontab -l | grep sao-luu-drive
}

case "${1:-}" in
  kiem) cmd_kiem ;;
  chay) cmd_chay ;;
  ds) cmd_ds ;;
  khoi-phuc) cmd_khoi_phuc "${2:-}" ;;
  lich) cmd_lich ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
