# Layout playbook cho PowerPoint

## Mục tiêu sau nâng cấp

Deck phải nhìn như proposal/pitch deck chuyên nghiệp cho tệp **chủ doanh nghiệp khó tính**, không còn cảm giác slide text thuần hoặc template phổ thông.

Bắt buộc nâng chất theo 3 trục:
1. **Ảnh thật đúng chủ đề**: dùng ảnh có giấy phép rõ ràng (Pexels API, ảnh do người dùng cung cấp, ảnh AI tự tạo (nếu có skill tạo ảnh riêng)), query chính xác theo từng slide.
2. **Chart xịn hơn**: chart thật trong PPTX + insight + KPI phụ, phân cấp rõ, có câu chuyện dữ liệu.
3. **Graphic premium hơn**: spacing thoáng, typography rõ cấp bậc, màu sang và tiết chế.

## Nguyên tắc bố cục

Không để toàn bộ nội dung co lại thành một khối chữ nhỏ ở góc trái trên.

Mỗi slide phải chọn 1 bố cục rõ ràng:

1. **Hero / Center statement**
   - Tiêu đề lớn ở giữa
   - 1 câu phụ ngắn bên dưới
   - 1 thanh màu hoặc shape lớn làm điểm nhấn

2. **Text trái - ảnh phải**
   - Text chiếm khoảng 42-48% chiều ngang
   - Ảnh chiếm khoảng 45-50% chiều ngang
   - Ảnh phải crop full khung, không để bé lọt thỏm
   - Có overlay caption ngắn nếu cần

3. **Ảnh trái - text phải**
   - Dùng để tránh lặp bố cục
   - Ảnh vẫn phải chiếm nửa slide, không dùng icon bé thay ảnh thật

4. **Chart lớn**
   - Chart thật chiếm nửa trái hoặc trung tâm
   - Bên phải có insight card + 2-3 KPI phụ
   - Màu cột đa sắc nhưng cùng tông business

5. **Cards / tiles**
   - 2-4 ô lớn, khoảng thở rõ
   - Mỗi ô có headline mạnh + 1 đoạn body ngắn
   - Dùng accent bar nhỏ để tránh cảm giác nhàm

6. **Quote / proof**
   - Câu chốt lớn ở khối chính
   - Bên cạnh là 2-3 proof tile hoặc số liệu phụ

7. **Process / timeline**
   - Chuỗi box ngang
   - Mỗi box có số bước + tiêu đề ngắn
   - Màu từng box có thể đổi nhẹ để nhìn hiện đại hơn

## Cách chọn ảnh tự động

Khi tạo slide có ảnh:
- Ưu tiên lấy từ `image_path` hoặc `image_url` nếu đã có sẵn.
- Nếu cần tự tìm trên mạng, chỉ dùng nguồn có giấy phép rõ ràng: **Pexels API / ảnh người dùng cung cấp / ảnh AI tự tạo**; không cào ảnh từ Google Images hoặc Pinterest.
- Tuyệt đối không dùng nguồn random ảnh theo tag.
- Query phải bám **đúng chủ đề slide**, không dùng ảnh business chung chung nếu slide đang nói về AI/agent/automation.

### Quy tắc bắt buộc khi tạo query ảnh

Mỗi slide phải được tóm lại thành **1 query chính xác nhất**:
- cấu trúc: `core topic` + `use case` + `style`

Ví dụ query tốt:
- `AI agent dashboard professional`
- `marketing automation analytics professional`
- `CRM lead tracking dashboard`
- `workflow orchestration system interface`

Ví dụ query không đạt:
- `business team`
- `office meeting`
- `startup people`
- `productivity`

Tiêu chí chọn ảnh:
- Ảnh ngang, đủ lớn để crop nửa slide
- Không quá tối
- Không quá nhiều chữ watermark
- Phải khớp chủ đề slide ở mức nhìn vào là hiểu liên quan
- Mỗi slide có ảnh phải là ảnh khác nhau hoàn toàn
- Với deck OpenClaw, ưu tiên hình có cảm giác công nghệ, màn hình, dashboard, AI workflow, operator, interface hơn là ảnh họp chung chung

## Quy tắc dùng ảnh vs graphic

**Không được nhét cả ảnh lẫn chart/graphic mạnh vào cùng một slide.**

Ưu tiên như sau:
- Nếu slide là `chart`, `data` → chỉ dùng chart + insight + KPI phụ, **không dùng ảnh**
- Nếu slide là `cards`, `grid` → chỉ dùng cards/tiles làm điểm nhấn, **không dùng ảnh**
- Nếu slide là `process`, `timeline`, `flow` → chỉ dùng process graphic, **không dùng ảnh**
- Nếu slide là `quote`, `proof` → ưu tiên quote block + proof tiles, **không dùng ảnh**
- Chỉ dùng ảnh ở các layout kiểu `split-left` / `split-right` hoặc slide text-heavy cần một visual hero rõ ràng

Nói ngắn gọn:
- **Slide có chart/graphic rồi → cấm thêm ảnh**
- **Slide thiếu visual chính → mới dùng ảnh**

## Style hiện tại của anh Tuấn

- Nền trắng
- Title xanh đậm
- Body đen/xanh đậm
- Keyword quan trọng đỏ
- Footer xanh dương đậm, chữ trắng
- Accent sinh động: đỏ, vàng, xanh trời, teal, tím

## Graphic nên dùng

- Column chart đa sắc
- KPI cards
- Comparison blocks
- Timeline ngang
- Process flow nhiều bước
- Quote + proof tiles
- Full-height image block

## Quy tắc chart đẹp hơn (bản executive)

- Không dùng một màu duy nhất cho mọi cột
- Gap width vừa phải để chart nhìn premium hơn
- Có insight box bên cạnh để slide không chỉ là chart trơ
- Có 2-3 KPI phụ ở cạnh phải hoặc dưới chart
- Font nhỏ hơn body text thường để đỡ rối
- Trục và gridline phải nhẹ, ưu tiên readability
- Nhãn số liệu phải rõ và tiết chế, không nhồi text vào chart
- Mỗi chart cần trả lời được câu hỏi business cụ thể (tăng gì, giảm gì, hành động gì)
- Ưu tiên phối màu “sang” cho audience chủ doanh nghiệp: xanh đậm + điểm nhấn đỏ/vàng/cyan, hạn chế phối quá nhiều tông neon

## Checklist trước khi xuất PPTX

- Có slide center statement chưa?
- Có slide split text/image với ảnh thật chưa?
- Có slide chart thật chưa?
- Có slide card/grid chưa?
- Có slide process/timeline hoặc quote/proof chưa?
- Footer đã thành thanh màu chưa?
- Màu có sinh động hơn nhưng vẫn business chưa?
- Không còn layout chữ bé xíu ở góc trái trên?
- Ảnh đã crop full khung chưa?
- Chart đã có insight + KPI phụ chưa?
