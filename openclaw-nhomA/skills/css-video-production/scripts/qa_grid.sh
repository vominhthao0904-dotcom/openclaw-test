#!/usr/bin/env bash
# Tạo lưới ảnh QA (mỗi N giây một khung) để kiểm tra phụ đề và B-roll bằng mắt. Dùng: qa_grid.sh video.mp4 [out.jpg] [giây=3]
# Giữ đúng tỉ lệ khung (video ngang không bị bóp méo) và tối đa 30 khung — video dài thì tự giãn khoảng cách.
set -euo pipefail
IN="${1:?Dùng: qa_grid.sh video.mp4 [out.jpg] [giây]}"; OUT="${2:-qa_grid.jpg}"; EVERY="${3:-3}"
[[ "$EVERY" =~ ^[0-9]+([.][0-9]+)?$ ]] && [ "$EVERY" != "0" ] || { echo "giây phải là số dương" >&2; exit 2; }
[ -f "$IN" ] || { echo "Không thấy video: $IN" >&2; exit 2; }
DUR="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$IN")"
read -r EVERY N <<<"$(python3 -c "
import math, sys
dur, every = float(sys.argv[1]), float(sys.argv[2])
n = max(1, math.ceil(dur / every))
if n > 30:
    every = math.ceil(dur / 30 * 10) / 10
    n = max(1, math.ceil(dur / every))
print(every, n)" "$DUR" "$EVERY")"
COLS=$(( N < 5 ? N : 5 )); ROWS="$(( (N + COLS - 1) / COLS ))"
# Cạnh dài mỗi khung 480px, cạnh kia theo đúng tỉ lệ video (-2: số chẵn cho bộ mã hoá)
ffmpeg -y -v error -i "$IN" \
  -vf "fps=1/${EVERY},scale='if(gt(iw,ih),480,-2)':'if(gt(iw,ih),-2,480)',tile=${COLS}x${ROWS}:padding=4:color=black" \
  -frames:v 1 -q:v 3 "$OUT"
echo "$OUT ($N khung, mỗi ${EVERY}s, video dài ${DUR%.*}s)"
