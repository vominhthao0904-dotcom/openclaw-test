#!/usr/bin/env bash
# Tạo lưới ảnh QA (mỗi N giây một khung) để kiểm tra phụ đề và B-roll bằng mắt. Dùng: qa_grid.sh video.mp4 [out.jpg] [giây=3]
set -euo pipefail
IN="${1:?Dùng: qa_grid.sh video.mp4 [out.jpg] [giây]}"; OUT="${2:-qa_grid.jpg}"; EVERY="${3:-3}"
[[ "$EVERY" =~ ^[0-9]+$ ]] || { echo "giây phải là số nguyên" >&2; exit 2; }
DUR="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$IN")"
N="$(python3 -c "import math,sys; print(max(1, math.ceil(float(sys.argv[1])/int(sys.argv[2]))))" "$DUR" "$EVERY")"
COLS=5; ROWS="$(( (N + COLS - 1) / COLS ))"
ffmpeg -y -v error -i "$IN" -vf "fps=1/${EVERY},scale=270:480,tile=${COLS}x${ROWS}" -frames:v 1 "$OUT"
echo "$OUT ($N khung, mỗi ${EVERY}s)"
