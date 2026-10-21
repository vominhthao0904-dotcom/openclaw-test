---
name: pdf-extract-crop
description: Đọc PDF (lấy text theo trang), tìm một cụm chữ trong PDF rồi cắt đúng vùng đó thành ảnh PNG, chụp nguyên trang PDF thành ảnh, hoặc cắt theo toạ độ. Dùng khi người dùng cần lấy thông số/bảng/hình sản phẩm từ catalogue PDF để đưa vào báo giá, slide, bài đăng hoặc gửi khách.
metadata: {"openclaw":{"emoji":"✂️","requires":{"bins":["pdftotext","pdftoppm","python3"]},"install":[{"id":"poppler","kind":"apt","package":"poppler-utils","bins":["pdftotext","pdftoppm"],"label":"Cài poppler-utils (cần sudo)"}]}}
---

# PDF Extract & Crop

Công cụ nhỏ, chạy offline: `python3 {baseDir}/scripts/pdf_tools.py <lệnh> ...`
Cần `poppler-utils` (pdftotext/pdftoppm) và `Pillow` (`pip install pillow`).

## Lệnh

| Việc cần làm | Lệnh |
|---|---|
| Xem số trang, kích thước | `info file.pdf` |
| Lấy text (có thể chọn trang) | `text file.pdf --pages 3-5` |
| Tìm cụm chữ, in ra trang + toạ độ | `find file.pdf "HA1600/570PVC"` |
| Chụp nguyên 1 trang | `page-shot file.pdf --page 3 --out out/p3.png --dpi 150` |
| Cắt vùng quanh cụm chữ | `crop-text file.pdf "HA1600/570PVC" --out out/ha1600.png --below 220 --pad 12` |
| Cắt theo toạ độ (điểm PDF, gốc trên-trái) | `crop file.pdf --page 3 --box 40,120,420,360 --out out/c.png` |

Ghi chú:
- `crop-text` lấy khung chữ khớp đầu tiên (hoặc `--match N`), rồi mở rộng: `--below` (pt xuống dưới), `--above`, `--left`, `--right`, `--pad`. Không đặt thì cắt cả bề ngang trang từ vị trí chữ xuống `--below` (mặc định 200).
- Luôn mở ảnh kết quả để kiểm tra bằng mắt trước khi gửi người dùng (cụm chữ có thể xuất hiện nhiều lần: dùng `find` xem danh sách rồi chọn `--match`).
- PDF scan (ảnh) không có lớp chữ nên `text`/`find` trả rỗng: dùng `page-shot` rồi đọc ảnh, hoặc OCR riêng.
- Kết quả mặc định lưu ở `~/.openclaw/workspace/.openclaw/pdf-crops/` nếu không có `--out`.

## Quy tắc
- Không sửa file PDF gốc. Chỉ ghi ảnh/text ra thư mục đầu ra.
- Báo rõ cho người dùng: file nào, trang nào, cụm chữ nào đã khớp, đường dẫn ảnh.
- Tôn trọng bản quyền catalogue: chỉ dùng cho mục đích người dùng được phép.
