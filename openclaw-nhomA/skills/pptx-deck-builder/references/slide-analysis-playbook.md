# Slide Analysis Playbook

## Mục tiêu

Trước khi mở rộng từ một deck gốc, phải hiểu được 4 lớp:
1. **Structure** — số shape, loại layout, thứ tự đọc
2. **Typography** — font, cỡ chữ, màu, độ đậm
3. **Narrative** — vai trò từng slide trong flow bán hàng
4. **Taste** — dấu hiệu slide đẹp / xấu theo audience chủ doanh nghiệp khó tính

Không được build bổ sung nếu chưa phân tích xong 4 lớp này.

## Bước 1: Phân loại slide gốc

Gắn nhãn từng slide vào một loại:
- `hero-statement`
- `pain-statement`
- `comparison`
- `feature-grid`
- `capability-grid`
- `process`
- `proof`
- `offer`
- `cta`

Với mỗi slide, phải ghi:
- `slide_goal`
- `core_message`
- `layout_type`
- `text_density`: low / medium / high
- `visual_anchor`: title / image / chart / cards / process

## Bước 2: Nhận diện dấu hiệu slide đẹp

### Slide đẹp khi:
- Có **1 trọng tâm thị giác rõ ràng** trong 2 giây đầu nhìn vào
- Title đủ lớn để đọc từ xa
- Có khoảng thở lớn, không nghẹt chữ
- Text được chia thành cụm logic, không thành “bức tường chữ”
- Mỗi slide chỉ có **1 ý chính**
- Nếu là slide chỉ có chữ, chữ phải được đưa vào vị trí trung tâm hoặc tạo nhịp rõ ràng
- Nếu là slide có ảnh, ảnh phải đủ lớn để làm visual anchor thật sự
- Có phân cấp: eyebrow / title / supporting text / proof
- Màu nhấn được dùng để điều hướng mắt, không phải để trang trí cho vui

### Slide xấu khi:
- Chữ chạy lung tung, không có trục thẳng hàng
- Có quá nhiều text box nhỏ, nhìn như dán patch
- Ảnh nhỏ, lạc lõng, không đóng vai trò thị giác chính
- Title không nổi bật hơn body
- Một slide cố nói quá nhiều ý
- Layout bị lệch, chật, khoảng thở không đều
- Có cảm giác “đổ nội dung vào template” thay vì thiết kế từ trọng tâm thông điệp
- Slide chỉ có chữ nhưng chữ bị nhét ở góc, không có sân khấu trung tâm

## Bước 3: Rule visual premium

### Với slide text-only
Chỉ được dùng text-only khi câu nói đủ mạnh.

Bắt buộc:
- Title cực lớn hoặc chia 2 tầng rõ ràng
- 1 câu phụ ngắn
- 1 accent line / block / number lớn / shape lớn làm neo thị giác
- Không được đặt một cụm chữ nhỏ ở góc trên trái rồi để trống phần còn lại

### Với slide image-text
Bắt buộc:
- Ảnh chiếm ít nhất 42% chiều ngang slide
- Ảnh crop full chiều cao vùng ảnh
- Text không quá 4 bullet ngắn hoặc 1 đoạn ngắn + 3 bullet
- Không thêm card/chart phụ vào cùng slide

### Với slide comparison
Bắt buộc:
- 2 cột cân rõ
- Mỗi cột tối đa 4 ý
- Headline trái/phải ngắn, mạnh
- Có 1 câu chốt lớn ở phần trên hoặc dưới

### Với slide grid/cards
Bắt buộc:
- 2 đến 4 ô lớn, không quá 5 ô nếu mỗi ô có 2 dòng trở lên
- Mỗi ô chỉ có 1 headline + 1 supporting line
- Khoảng cách giữa ô phải đều

### Với slide proof/case
Bắt buộc:
- Phải có một trong ba thứ: số lớn / quote lớn / before-after
- Không chỉ kể case bằng text thường

## Bước 4: Rule clone từ slide gốc

Nếu user cung cấp deck gốc và muốn “làm tiếp cùng phong cách”:
- Không clone mù một template cho toàn bộ deck
- Phải chọn **nhiều template gốc khác nhau** theo vai trò slide
- Mỗi slide mới phải map vào template gần nhất về vai trò

Ví dụ:
- Slide hook mới → clone từ hero-statement
- Slide so sánh → clone từ comparison
- Slide năng lực → clone từ feature-grid / capability-grid
- Slide case → clone từ proof hoặc statement mạnh

## Bước 5: Rule viết nội dung cho deck bán hàng

Mỗi slide phải trả lời một câu hỏi bán hàng:
- Khách đang đau ở đâu?
- Vì sao cách cũ không đủ?
- Vì sao OpenClaw khác?
- OpenClaw mang lợi ích gì?
- Bằng chứng đâu?
- Vì sao phải hành động bây giờ?

Nếu slide không trả lời được câu hỏi nào ở trên, slide đó có nguy cơ là filler slide.

## Bước 6: Checklist trước khi export

- Slide nào là visual anchor của mỗi cụm 4-5 slide?
- Có slide nào đang chỉ “thêm chữ cho đủ số lượng” không?
- Có slide nào title chưa đủ lớn?
- Có slide nào text-only nhưng không đủ lực?
- Có slide nào cần ảnh mà chưa có ảnh?
- Có slide nào dùng ảnh nhưng ảnh không thực sự liên quan?
- Có slide nào comparison mà hai cột không cân?
- Có slide nào grid nhưng mỗi card quá nhiều chữ?
- Có slide nào nhìn phát là biết “xấu / rẻ / tạm bợ” không?

Nếu còn câu trả lời “có”, chưa được export.