---
name: css-video-production
description: Dựng video dọc (reels/short) từ clip nhân vật/giọng đọc: chèn B-roll không bị đứng hình, tạo phụ đề ASS ngắn có từ khoá nổi màu, xuất bằng ffmpeg và kiểm tra bằng lưới ảnh QA. Dùng khi cần ghép B-roll + phụ đề cho video HeyGen hoặc video có sẵn, hoặc sửa lỗi mất chữ/đứng hình.
metadata: {"openclaw":{"emoji":"🎞️","requires":{"bins":["ffmpeg","ffprobe","python3"]}}}
---

# Video: B-roll + phụ đề (ffmpeg)

Chạy được ngay, không cần tài khoản dịch vụ nào. Đã kiểm thử với ffmpeg 6 (video 1080×1920, 25 fps).

## Quy trình
1. **Chuẩn bị**: video chính (`raw.mp4`), các clip B-roll, kịch bản chia theo cảnh. Đo trước độ dài/khung hình: `ffprobe -v error -show_entries format=duration:stream=width,height -of json raw.mp4`. Nếu tạo giọng/nhân vật bằng HeyGen (skill `heygen-video`, nếu đã cài — không nằm trong gói này): render tốc độ đọc 1.1-1.2, câu ngắn, kết câu bằng dấu `!` để nhịp nhanh; chỉ dùng avatar/giọng đã được cấp phép.
2. **Tạo phụ đề** từ `scenes.json`:
```json
{"video":"raw.mp4","font":"DejaVu Sans","scenes":[
  {"file":"s1.mp4","chunks":[{"text":"Câu thoại một!","keyword":"thoại"},{"text":"Câu hai!","keyword":"hai","start":3.0,"end":5.5}]}
]}
```
`python3 {baseDir}/scripts/make_ass.py --spec scenes.json --out perfect.ass`
   - Khung phụ đề (PlayRes) lấy theo `video` (hoặc file của cảnh đầu); không có thì 1080×1920. **Phải khớp tỉ lệ video sẽ in phụ đề**, lệch là chữ bị kéo giãn. Cỡ chữ và lề dưới tự co theo khung; đặt tay bằng `font_size`, `margin_v`, `width`/`height`.
   - Kết quả có `canh_bao` khi: dòng không tô được từ khoá, dòng quá dài (3+ hàng), thiếu font. **Sửa hết cảnh báo** rồi mới ghép.
   - Mỗi `chunk` có thể có `start`/`end` (giây, tính trong cảnh); nếu bỏ qua, thời gian chia theo độ dài chữ. Tổng độ dài các cảnh = độ dài video chính, nên các cảnh phải đúng thứ tự.
   - Quy tắc: tối đa 5 từ mỗi dòng, chữ trắng viền đen 4px, ít nhất 1 từ khoá mỗi dòng nổi màu (vàng). Ký tự `{ } \` trong lời thoại được thay an toàn.
   - Phải dùng dấu **chấm** cho phần lẻ giây của ASS (`0:00:01.88`). Dấu phẩy làm ffmpeg ẩn cả phụ đề; script đã tránh sẵn.
   - Font phải có trên máy chạy ffmpeg và hỗ trợ tiếng Việt (DejaVu Sans đủ dùng; đổi bằng `font` nếu cần).
3. **Ghép**: viết `comp.json` rồi chạy `python3 {baseDir}/scripts/compose.py --spec comp.json`
```json
{"main":"raw.mp4","ass":"perfect.ass","out":"final.mp4","broll":[{"file":"b1.mp4","start":5,"duration":5},{"file":"b2.mp4","start":15,"duration":5}]}
```
   Đường dẫn tương đối tính theo thư mục chứa `comp.json`. Script từ chối khi `out` trùng một file đầu vào (không bao giờ ghi đè video gốc) và báo ngay nếu ffmpeg thiếu libass.
   Thêm `--dry-run` để xem lệnh ffmpeg. Tuỳ chọn: `width`, `height`, `fps` (mặc định = fps video chính), `crf` (mặc định 26; 20-23 cho bản đăng chất lượng cao), `preset`, `normalize_main` (ép video chính về đúng khung).
   **`width`/`height` mặc định lấy đúng kích thước video chính** — video ngang thì B-roll cũng ngang, không cần khai báo. Chỉ đặt tay khi muốn đổi khuôn (ví dụ dựng bản dọc cho TikTok từ video ngang, kèm `normalize_main`).
   Chống đứng hình đã được áp dụng sẵn cho mọi B-roll: `trim=0:<thời lượng>` + `setpts=PTS-STARTPTS+<giây bắt đầu>/TB` + `overlay=…:eof_action=pass`. Script từ chối B-roll vượt độ dài video chính hoặc clip ngắn hơn thời lượng chèn.
4. **QA bắt buộc trước khi gửi người dùng**: `bash {baseDir}/scripts/qa_grid.sh final.mp4 qa_grid.jpg 2` (tối đa 30 khung, giữ đúng tỉ lệ; video dài tự giãn khoảng cách) rồi **mở ảnh** kiểm tra: (a) phụ đề hiện đủ, có từ khoá nổi màu, không tràn khung; (b) khung B-roll đổi bình thường, không đen/đứng; (c) video chính tiếp tục đúng nhịp sau khi B-roll kết thúc; (d) âm thanh còn nguyên. Chỉ báo thành công khi cả 4 đạt.

## Lưu ý
- B-roll và nhạc/hình dùng cho video công khai phải có bản quyền hợp lệ.
- Tệp trung gian đặt trong thư mục làm việc riêng; không ghi đè video gốc.
- VPS 1-2 GB RAM: video 1080×1920 vài phút vẫn dựng được với `preset` mặc định `fast`; đừng chạy song song nhiều lệnh ghép.
- Kết quả `compose.py` có `canh_bao` khi độ dài video ra lệch video chính > 0,5 giây — xem lại bằng lưới QA.
