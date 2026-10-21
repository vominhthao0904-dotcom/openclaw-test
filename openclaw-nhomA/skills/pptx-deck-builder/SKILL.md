---
name: pptx-deck-builder
description: Dựng file PowerPoint (.pptx) chuyên nghiệp từ một outline JSON (các bố cục split, statement, cards, process, chart, quote), có chart thật, ảnh đúng chủ đề từ nguồn có giấy phép, và phân tích deck mẫu để giữ phong cách. Dùng khi người dùng cần bàn giao file .pptx cho pitch/báo cáo/đào tạo, hoặc muốn mở rộng một deck sẵn có.
metadata: {"openclaw":{"emoji":"📑","requires":{"bins":["python3"]},"envVars":[{"name":"PEXELS_API_KEY","required":false,"description":"Chỉ cần khi dùng fetch_images.py lấy ảnh tự động"}],"install":[{"id":"python-pptx","kind":"shell","label":"Cài python-pptx để tạo file PowerPoint","command":"pip install python-pptx Pillow"}]}}
---

# PPTX Deck Builder

Cần: `python3 -m pip install --user python-pptx pillow`. Ảnh tự động (tuỳ chọn) cần `PEXELS_API_KEY` (hoặc `~/.openclaw/secrets/pexels.env`, nên `chmod 600`). Không có khoá thì vẫn dựng được deck chữ + chart, hoặc dùng ảnh người dùng gửi (`image_path`).
Thay cho skill `openclaw-powerpoint` cũ: đã bỏ chân trang cố định của tác giả, bỏ cào ảnh Google/Pinterest, sửa lỗi crash khi thiếu ảnh, chart không còn tự bịa số.

## Quy trình
1. **Hỏi đủ thông tin trước khi viết** (không nhảy vào làm slide): mục tiêu của deck, người xem là ai (ngành, nỗi đau, quy mô), offer/giá/cam kết, số liệu & case study được phép dùng, số slide, CTA cuối, tỉ lệ ảnh/chart/chữ.
2. **Nếu có deck mẫu**: `python3 {baseDir}/scripts/analyze_deck.py mau.pptx --slides 1-6` rồi đọc `references/slide-analysis-playbook.md`. Rút ra font, cỡ chữ, màu, tone; ánh xạ từng slide mới vào đúng loại bố cục (không nhân bản mù một template).
3. **Viết outline và xin duyệt**: mỗi slide ghi số thứ tự, mục đích, 1 ý chốt, loại bố cục, nội dung chi tiết, tone. Không để 2 slide liền kề cùng bố cục + tone; cứ 4-6 slide đổi nhịp.
4. **Viết JSON** theo mẫu dưới, rồi (tuỳ chọn) lấy ảnh: `python3 {baseDir}/scripts/fetch_images.py --input deck.json --output deck.img.json --assets-dir ./assets` (mỗi slide một ảnh khác nhau; script **tự sinh** thêm file ghi nguồn ảnh `credits.json` trong thư mục assets — nhớ ghi công tác giả ảnh khi deck phát hành công khai).
5. **Dựng file**: `python3 {baseDir}/scripts/build_pptx.py --input deck.img.json --output deck.pptx [--footer "Tên công ty | Website"]`.
   - Script **kiểm toàn bộ JSON trước** (layout sai tên, chart thiếu/sai số liệu, thiếu title) và trả `ok:false` kèm danh sách `loi` — sửa hết một lượt rồi chạy lại.
   - Chữ dài được tự co cho vừa khung; co tới mức tối thiểu mà vẫn dài thì có cảnh báo "chữ quá dài" — **rút gọn hoặc tách slide**, đừng gửi.
   - Kết quả JSON có `canh_bao` (thiếu ảnh, ảnh lặp, ô rỗng, chữ quá dài, chữ giữ chỗ): sửa hết trước khi gửi.
6. **Kiểm tra bằng mắt** theo checklist: không chữ tràn/đè, hierarchy rõ, ảnh đúng ngữ cảnh, không ô rỗng. Có LibreOffice thì xuất ảnh để xem:
   `soffice --headless --convert-to pdf deck.pptx && pdftoppm -r 50 -png deck.pdf xem` rồi mở các file `xem-*.png`.

## Mẫu JSON
```json
{"slides":[
 {"layout":"statement","title":"Hook","statement":"Câu chốt lớn","subtitle":"Câu phụ ngắn","image_query":"modern office team"},
 {"layout":"split-right","eyebrow":"Vấn đề","title":"Tiêu đề","content":["Ý 1","Ý 2","Ý 3"],"image_query":"warehouse logistics"},
 {"layout":"cards","title":"4 năng lực","cards":[{"title":"A","body":"mô tả"},{"title":"B","body":"mô tả"}]},
 {"layout":"process","title":"Quy trình","steps":["Bước 1","Bước 2","Bước 3"]},
 {"layout":"chart","title":"Doanh thu theo quý","chart":{"type":"column","categories":["Q1","Q2","Q3"],"values":[120,150,180],"series_name":"Triệu đồng"},"insight":"Nhận định ngắn, dựa trên số liệu thật","stats":[{"label":"Tăng trưởng Q3","value":"+20%"}]},
 {"layout":"chart","title":"So sánh hai năm","chart":{"type":"column","categories":["Q1","Q2"],"series":[{"name":"2025","values":[120,150]},{"name":"2026","values":[140,175]}]},"notes":"Lời dẫn cho người thuyết trình"},
 {"layout":"quote","title":"Khách hàng nói","quote":"Nội dung trích dẫn thật","quote_author":"Tên người, chức danh"}
]}
```
Bố cục hợp lệ: `split-right`, `split-left`, `cards`/`grid`, `center`/`statement`, `process`/`timeline`/`flow`, `chart`/`data`, `quote`/`proof`. Slide có chart thì không đặt ảnh và ngược lại.
Kiểu chart: `column`, `bar`, `line`, `area`, `pie`, `doughnut`. Chart **bắt buộc có số liệu thật** (`categories` + `values` cùng độ dài, hoặc `series` nhiều dãy); script dừng và báo lỗi thay vì tự bịa số.
- Số liệu ghi bằng số JSON (`1200`, `1.5`). Chuỗi nhập nhằng như `"1.200"` bị từ chối — script không đoán là một nghìn hai hay một phẩy hai.
- Tuỳ chọn chart: `number_format` (vd `"#,##0"`, `"0%"`), `data_labels` (true/false; mặc định bật khi ≤ 6 cột hoặc biểu đồ tròn).
- Biểu đồ tròn: một dãy, không số âm, tốt nhất ≤ 6 miếng.
- `notes` (chuỗi hoặc danh sách) ở mọi slide → ghi vào Speaker Notes cho người thuyết trình.
- `metrics` (tối đa 4 thẻ KPI: label/value/note) dùng được ở mọi bố cục trừ split. `process` tối đa 6 bước; `cards` tối đa 4 thẻ.

## Quy tắc nội dung
- Mỗi slide một ý chốt; nội dung cụ thể, có lợi ích rõ ràng cho người xem; không viết sơ sài một dòng.
- Dẫn dắt từ vấn đề của khách hàng đến giải pháp của **chính người dùng** (không gắn tên sản phẩm của bên khác); tránh ép mua lộ liễu ("mua ngay", "cơ hội duy nhất").
- Số liệu, case study, trích dẫn khách hàng phải do người dùng cung cấp hoặc có nguồn: **không bịa**; để trống `quote_author` nếu không có tên thật.
- Ảnh chỉ dùng nguồn có giấy phép (Pexels API, ảnh của người dùng, ảnh AI tự tạo). Không cào Google Images/Pinterest.
