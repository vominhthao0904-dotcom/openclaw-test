#!/usr/bin/env bash
# Bật/tắt trang web Second Brain chạy nền trên VPS.
#   bash web.sh start     bật (chỉ nghe 127.0.0.1)
#   bash web.sh stop      tắt
#   bash web.sh status    đang chạy không, cổng nào, tốn bao nhiêu RAM
#   bash web.sh link      in đường link có mã để mở trang (qua đường hầm SSH)
#   bash web.sh restart
# Log và file pid nằm cạnh kho với quyền 600 — không để trong /tmp, nơi user khác đọc được.
set -u
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"
WS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
DIR="$(dirname "${SECOND_BRAIN_DB:-$WS/second-brain/notes.sqlite}")"
PIDF="$DIR/web.pid"; LOG="$DIR/web.log"; PORT="${BRAIN_PORT:-8787}"
mkdir -p "$DIR"

dang_chay() {
  [ -f "$PIDF" ] || return 1
  local pid; pid="$(cat "$PIDF" 2>/dev/null)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && grep -q "server.py" "/proc/$pid/cmdline" 2>/dev/null
}

case "${1:-status}" in
  start)
    if dang_chay; then echo "Đang chạy rồi (pid $(cat "$PIDF"))."; else
      if [ -n "${BRAIN_HOST:-}" ] && [ "$BRAIN_HOST" != "127.0.0.1" ] && [ "$BRAIN_HOST" != "localhost" ]; then
        echo "Từ chối: BRAIN_HOST=$BRAIN_HOST sẽ mở kho ra ngoài. Bỏ biến này, xem qua đường hầm SSH." >&2; exit 2
      fi
      # log quá 5 MB thì xoay vòng, chạy lâu năm không đầy đĩa
      [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ] && mv -f "$LOG" "$LOG.1"
      nohup python3 "$HERE/server.py" >>"$LOG" 2>&1 &
      echo $! > "$PIDF"
      sleep 1
      if dang_chay; then
        echo "Đã bật (pid $(cat "$PIDF"), cổng $PORT)."
        echo "Trên máy cá nhân:  ssh -N -L $PORT:127.0.0.1:$PORT user@IP_VPS"
        echo "Rồi mở:            $(python3 "$HERE/server.py" --link)"
        if [ "${OPENCLAW_SHELL:-}" = exec ]; then
          # bật từ lệnh exec của agent (Mây): OpenClaw chặn ô Hỏi — chốt an toàn, không gỡ dấu
          echo "LƯU Ý: trang web vừa được bật từ lệnh của agent, nên OpenClaw sẽ CHẶN ô Hỏi (các phần khác dùng bình thường)."
          echo "       Muốn ô Hỏi chạy: chủ máy tự chạy trong terminal của mình (Termius):  bash ${HERE/#$HOME/~}/web.sh restart"
        fi
      else
        echo "Không bật được — xem lỗi:" >&2; tail -5 "$LOG" >&2; rm -f "$PIDF"; exit 1
      fi
    fi ;;
  stop)
    if dang_chay; then kill "$(cat "$PIDF")" && echo "Đã tắt."; else echo "Không chạy."; fi
    rm -f "$PIDF" ;;
  restart) bash "$0" stop; bash "$0" start ;;
  status)
    if dang_chay; then
      pid="$(cat "$PIDF")"
      echo "Đang chạy: pid $pid, cổng $PORT, RAM $(awk '/VmRSS/{printf "%d MB", $2/1024}' "/proc/$pid/status")"
      if tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | grep -qx 'OPENCLAW_SHELL=exec'; then
        echo "Ô Hỏi: BỊ CHẶN — trang web đang chạy từ lệnh của agent. Chủ máy tự chạy trong Termius:  bash ${HERE/#$HOME/~}/web.sh restart"
      else
        echo "Ô Hỏi: không bị chặn (trang web bật từ terminal của chủ máy)."
      fi
    else echo "Không chạy. Bật: bash $0 start"; fi ;;
  link) python3 "$HERE/server.py" --link ;;
  *) sed -n '2,8p' "$0"; exit 2 ;;
esac
