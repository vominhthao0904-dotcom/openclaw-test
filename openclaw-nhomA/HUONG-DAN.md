# Dùng 4 Skill nhóm A

Gói này có hai tài liệu:

| File | Đọc khi nào |
|---|---|
| **`CAI-DAT.md`** | **Đọc trước.** Kiểm tra máy → cài → kiểm tra lại → test → tài nguyên tốn bao nhiêu |
| **`HUONG-DAN.md`** (file này) | Sau khi cài xong. Dùng hằng ngày thế nào cho ra việc |

Tài liệu này nói về việc **dùng**, không nói về việc cài.

| Skill | Nói với Mây kiểu gì |
|---|---|
| `second-brain` | "Ghi lại giúp anh…", "Anh từng ghi gì về…" |
| `pdf-extract-crop` | "Trong file X.pdf, tìm chữ Y rồi cắt vùng đó ra ảnh" |
| `css-video-production` | "Ghép video raw.mp4 với 2 clip B-roll, chèn phụ đề tiếng Việt" |
| `pptx-deck-builder` | "Làm bộ slide 10 trang giới thiệu dịch vụ lọc nước" |

Không cần gõ lệnh. Mây tự nhận ra việc nào cần skill nào.

---

## Second Brain nên chạy ở đâu?

**Kết luận: kho đặt trên VPS, cùng chỗ với OpenClaw (đúng như gói này đang cài). Trang web chỉ bật khi cần, xem qua đường hầm SSH. Mỗi tuần kéo một bản sao về máy cá nhân.**

| Phương án | Mây ghi/tìm được lúc nào | An toàn | Bền lâu | Đánh giá |
|---|---|---|---|---|
| **Kho trên VPS + web qua đường hầm SSH** (gói này) | **24/7**, kể cả khi máy tính anh tắt | Không mở cổng nào ra Internet; trang web có mã truy cập; kho chỉ chủ sở hữu đọc được | Sao lưu tự động hằng ngày trên VPS + bản kéo về máy | **Tốt nhất** |
| Kho trên máy tính cá nhân | Chỉ khi máy bật **và** nối được với VPS | Tốt | Mất khi hỏng ổ, nếu không tự sao lưu | Mây không với tới kho khi anh ra ngoài — mất lý do tồn tại của "bộ não thứ hai" |
| Trang web công khai (Netlify, hosting, mở `0.0.0.0`) | 24/7 | **Kém**: kho nằm trên mạng, ai dò được là thử được; bản cũ đã từng lộ khoá theo đường này | Phụ thuộc dịch vụ ngoài | **Không dùng** |
| Notion / Google Docs | 24/7 | Dữ liệu ở bên thứ ba, cần khoá API | Tốt | Mây tìm chậm, tốn lượt gọi API, không tìm toàn văn tiếng Việt được như SQLite |

Vì sao cách này bền lâu:
- **Một file SQLite** — định dạng được hỗ trợ ít nhất tới năm 2050, mở được bằng mọi ngôn ngữ, không phụ thuộc dịch vụ nào.
- **Ba lớp giữ dữ liệu**: cất kho thay vì xoá → xoá hẳn vẫn còn bản riêng trong `deleted/` → sao lưu hằng ngày `backups/` + bản `.sqlite` kéo về máy anh.
- **`doctor`** khám định kỳ: báo ngay khi file hỏng, chỉ mục lệch, hay lịch sao lưu ngừng chạy.
- Xuất được ra **Markdown** đọc bằng mắt (`export --all`) — kể cả khi không còn phần mềm nào.

Muốn xem trang web mà không cần SSH (ví dụ trên điện thoại): cách an toàn là cài **Tailscale** trên VPS và điện thoại (mạng riêng, miễn phí cho cá nhân) rồi dùng đường hầm qua đó. **Đừng** mở cổng ra Internet.

---

## Mở giao diện web của Second Brain

Màu chủ đạo: **xanh dương** (nền, chiều sâu) · **vàng kim** (nhấn, liên kết, thẻ) · **cam** (nút hành động, quầng sáng quanh lõi). Bố cục giống bản cũ anh từng dùng: lõi ở giữa, ghi chú xoay quanh thành các vòng — mỗi vòng là một nhóm, mỗi nhóm một màu. Khác bản cũ ở chỗ **nó chạy trên VPS của anh, không gửi ghi chú nào ra ngoài** (thứ duy nhất trình duyệt tải từ Internet là font chữ).

**Bước 1 — trên VPS**, bật trang (chạy nền):
```bash
bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh start
```
Nó in ra lệnh đường hầm và **đường link có mã**, dạng `http://127.0.0.1:8787/?t=Abc…`. Quên link thì chạy `web.sh link`.

**Bước 2 — trên máy cá nhân**, mở đường hầm SSH (Termius: mục Port Forwarding, Local, 8787 → 127.0.0.1:8787):
```bash
ssh -N -L 8787:127.0.0.1:8787 root@IP_VPS
```

**Bước 3** — giữ cửa sổ đó mở, dán **đường link có mã** vào trình duyệt. Chỉ cần lần đầu: trình duyệt nhớ (cookie), lần sau vào thẳng **http://127.0.0.1:8787**.

Vì sao có mã: server chỉ nghe `127.0.0.1`, nhưng mọi chương trình **trên chính VPS** (n8n, một app bị hack…) vẫn gọi được địa chỉ đó. Có mã thì phải biết mã mới đọc được kho. Đường link có mã = chìa khoá kho: đừng dán vào nhóm chat. Lỡ lộ thì đổi mã:
```bash
rm ~/.openclaw/workspace/second-brain/.web-token
bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh restart
```

Tắt khi xem xong (tắt đi Mây vẫn ghi/tìm bình thường qua chat): `web.sh stop`. Xem đang chạy không và tốn bao nhiêu RAM: `web.sh status`.

### Ba chế độ xem (nút trên cùng)

- **Toàn cảnh** — lõi **Thái Cực – Tiên Thiên Bát Quái** ở giữa (xem mục dưới), mỗi vòng quỹ đạo là một **vùng** (Kinh doanh, Kỹ thuật, Học tập…), mỗi chấm một ghi chú, đường nối là liên kết giữa các ghi chú. Bấm tên vùng ở dải dưới cùng để chỉ làm nổi vùng đó; **Dừng xoay** nếu thấy chóng mặt. Đây là bức tranh chung, không phải mục lục.
- **Thư viện** — chỗ truy xuất có hệ thống. Bên trái là **cây Vùng › Nhóm › Nhóm con** kèm số ghi chú (bấm ▸ để mở nhóm con; *Chưa xếp chỗ* màu vàng là chỗ cần dọn). Bên phải là các thẻ ghi chú, lọc nhanh bằng **chip loại** (Kiến thức, Quy trình, Khái niệm, Tài liệu…; số trên chip đếm trong nhóm đang xem), sắp theo mới sửa / mới tạo / cũ nhất / tên, bấm *Xem thêm* để xem tiếp. Mỗi thẻ ghi rõ loại, đường dẫn nhóm, có nguồn/trích dẫn không, hạn (nếu là việc).
- **Việc** — việc cần làm xếp theo **Quá hạn** (đỏ cam) · **Hôm nay** · **7 ngày tới** · **Sau này** · **Không hạn**. Tích ô vuông là xong.

### Lõi Thái Cực – Tiên Thiên Bát Quái

Lõi đồ thị là Thái Cực đồ với Bát Quái **Tiên Thiên (Phục Hy)**, dựng đúng chuẩn Kinh Dịch. Chọn Tiên Thiên vì đây là đồ của **bản thể** (trời đất, tri thức gốc), hợp với một "bộ não thứ hai". Hậu Thiên (Văn Vương) là đồ của **công dụng**, dùng cho phương vị nhà cửa.

| Quẻ | Hào (trong → ngoài) | Phương | Số |  | Quẻ đối | Hào | Phương | Số |
|---|---|---|---|---|---|---|---|---|
| ☰ Càn (trên) | ▬ ▬ ▬ | Nam | 1 | ↔ | ☷ Khôn (dưới) | ╌ ╌ ╌ | Bắc | 8 |
| ☱ Đoài | ▬ ▬ ╌ | Đông Nam | 2 | ↔ | ☶ Cấn | ╌ ╌ ▬ | Tây Bắc | 7 |
| ☲ Ly (trái) | ▬ ╌ ▬ | Đông | 3 | ↔ | ☵ Khảm (phải) | ╌ ▬ ╌ | Tây | 6 |
| ☳ Chấn | ▬ ╌ ╌ | Đông Bắc | 4 | ↔ | ☴ Tốn | ╌ ▬ ▬ | Tây Nam | 5 |

- Quy ước cổ: **phương Nam ở trên**. Hào đọc **từ trong ra ngoài**: hào sơ nằm sát Thái Cực.
- Hai quẻ đối nhau có hào **ngược hoàn toàn**; số Tiên Thiên mỗi cặp cộng lại bằng **9**.
- Thái Cực: **Dương** (vàng kim) sinh ở Chấn, lên bên trái, cực thịnh ở Càn, nên đầu Dương ở trên. **Âm** (xanh dương) sinh ở Tốn, xuống bên phải, cực thịnh ở Khôn, nên đầu Âm ở dưới. Chấm xanh trong đầu Dương là "trong Dương có Âm"; chấm vàng trong đầu Âm là "trong Âm có Dương".
- Lõi **đứng yên**, không xoay theo các vòng ghi chú: Càn luôn ở trên mới đúng phương vị.
- Lõi **nhỏ gọn** (cỡ chữ BRAIN cũ) để đồ thị thoáng. **Rê chuột vào lõi** thì nó phóng to mượt, hiện tên 8 quẻ và phương vị; bỏ chuột ra là thu nhỏ lại. Biểu tượng này cũng là icon trên tab trình duyệt.

### Cột trái

- **Thêm** — lưu ghi chú mới: chủ đề, **loại**, **nhóm** (gõ vài chữ là hiện các nhóm đã có — chọn lại nhóm cũ thay vì gõ ra nhóm mới gần giống), thẻ, nội dung. Chọn loại *Việc* thì hiện ô **Hạn**; chọn *Tài liệu* hay *Khái niệm* thì hiện ô **Trích dẫn**. Lưu bản y hệt ghi chú đã có thì bị chặn kèm nút mở bản cũ; gần giống thì được lưu nhưng có cảnh báo; gõ nhóm/thẻ thiếu dấu hay sai chính tả thì có gợi ý.
- **Nạp** — kéo thả file **.md / .txt** (nhiều file một lúc) hoặc dán văn bản. Markdown có nhiều tiêu đề `#`/`##` được tách mỗi mục thành một ghi chú. Đặt nhóm, loại, thẻ chung cho cả lô; bấm **Xem trước** để thấy sẽ thêm gì, rồi **Nạp vào kho**. Bản trùng tự bỏ qua.
- **Tìm** — tìm toàn văn tiếng Việt có dấu, lọc thêm theo **loại** và **vùng**. Khớp ở tiêu đề/thẻ được xếp trên. Gõ cả câu dài cũng được.
- **Hỏi** — hỏi Mây dựa trên chính ghi chú trong kho; câu trả lời kèm danh sách ghi chú nguồn bấm được.
- **Ôn** — *Chưa xếp chỗ*, *Kho lưu* (ghi chú đã cất, lấy lại được), và hàng chờ ôn lại (không gồm việc).

### Thẻ chi tiết (bấm vào bất kỳ ghi chú nào)

Trên cùng là **đường dẫn nhóm** — bấm từng tầng để mở đúng nhóm đó trong Thư viện. Rồi tới nhãn **loại**, các **thẻ** (bấm để lọc Thư viện theo thẻ), tiêu đề, ngày ghi/sửa/ôn, mã ghi chú. Khối **Nguồn · Trích dẫn · Hạn** cho biết kiến thức này lấy từ đâu — để kiểm lại khi cần. Cuối là **Ghi chú liên kết** (bấm để chuyển sang). Nút: **Sửa** (đổi được mọi trường), **Nhớ rồi**, **Đánh dấu xong** (với việc), **Cất vào kho lưu**.

Đổi cổng khi 8787 đã bận: `BRAIN_PORT=9090 bash .../web.sh start` (nhớ đổi cả hai số trong lệnh `ssh -L`).

> **Đừng** đặt `BRAIN_HOST=0.0.0.0` để vào thẳng bằng IP VPS: mã truy cập đi qua mạng không mã hoá, ai nghe lén được là có chìa khoá kho. `web.sh` từ chối chạy kiểu đó; chạy tay thì `bash kiemtra.sh` báo CHƯA ĐẠT ở phần An toàn. Đường hầm SSH mã hoá toàn bộ và cũng nhanh như nhau.

---

## Dùng Second Brain vào việc thật

Kho ghi chú chết là kho chỉ có người bỏ vào, không ai lấy ra. Phần này là cách dùng để nó không chết.

### Hệ phân loại: ba trục, mỗi trục trả lời một câu hỏi

| Trục | Câu hỏi | Ví dụ |
|---|---|---|
| **Nhóm** — cây tối đa 3 tầng `Vùng/Nhóm/Nhóm con` | Thuộc **mảng nào**? | `Kinh doanh/Lọc nước/Khách hàng` |
| **Loại** — 8 loại cố định | Là **dạng** kiến thức gì? | Quy trình |
| **Thẻ** — tự do | **Liên quan** tới ai/cái gì, cắt ngang các nhóm? | `khach-lan`, `bao-gia` |

**8 loại kiến thức:** *Kiến thức* (kết luận, bài học) · *Quy trình* (cách làm từng bước) · *Khái niệm* (định nghĩa, công thức) · *Tài liệu* (sách, bài báo, quy chuẩn — kèm trích dẫn) · *Ý tưởng* (chưa kiểm chứng) · *Việc* (có hạn) · *Người* (khách hàng, đối tác) · *Nhật ký* (biên bản họp, sự kiện).

Nhờ có loại mà lấy ra đúng thứ cần: *"lấy hết quy trình nhóm Lọc nước"* khác hẳn *"lấy hết kiến thức nhóm Lọc nước"*.

**Vùng gợi ý khởi đầu** (tầng 1, ít thay đổi): `Kinh doanh` · `Marketing` · `Kỹ thuật` · `Học tập` · `Đầu tư` · `Cá nhân`. Tầng 2-3 mọc dần theo việc thật — đừng dựng sẵn cả cây rỗng. Nhóm dưới ~50 ghi chú thì chưa cần chia nhóm con.

Kho tự giữ cây gọn: gõ `kinh doanh / lọc  nước` vẫn vào đúng `Kinh doanh/Lọc nước` đã có; gõ `Loc nuoc` (thiếu dấu) hay `Maketing` (sai chính tả) thì được nhắc "có phải ý là…". Mây luôn xem cây nhóm trước khi xếp chỗ, và báo khi tạo nhóm mới.

### Nạp tài liệu có sẵn

Có sẵn ghi chép cũ (Obsidian, Notion xuất Markdown, file Word lưu thành .txt), tài liệu khoá học, quy chuẩn PDF, danh sách Excel lưu .csv? Nhờ Mây:
> "Nạp thư mục ~/ghi-chep vào kho, nhóm Học tập/Khoá học."

> "Nạp file QCVN-nuoc.pdf vào kho, loại tài liệu, nhóm Kỹ thuật/Tiêu chuẩn, mỗi trang một ghi chú."

Mây xem trước rồi báo *sẽ thêm bao nhiêu ghi chú, vào nhóm nào*, anh đồng ý mới nạp. Hoặc tự chạy:
```bash
BR="python3 ~/.openclaw/workspace/skills/second-brain/scripts/brain.py"
$BR nap ~/ghi-chep --category "Học tập/Khoá học" --dry-run    # xem trước
$BR nap ~/ghi-chep --category "Học tập/Khoá học"              # nạp thật
```
Markdown có tiêu đề `##` → mỗi mục một ghi chú; có frontmatter (`category:`, `tags:`, `kind:`, `url:`) thì dùng luôn. CSV cần dòng tiêu đề cột: `tieu_de,noi_dung,nhom,the,loai,han`. Nạp lại cùng thư mục không sinh bản trùng.

### Việc cần làm

> "Nhắc anh gọi chị Lan về bảo trì vào thứ sáu."

Mây lưu thành ghi chú loại *Việc*, đổi "thứ sáu" ra ngày cụ thể và đọc lại cho anh xác nhận. Hỏi *"hôm nay có việc gì?"* là Mây liệt kê việc quá hạn trước. Trên web: chế độ **Việc**, tích là xong.

### Ghi cái gì

Ghi **kết luận**, đừng ghi tài liệu. Thứ đáng ghi là thứ anh phải *trả giá* mới biết:

| Đáng ghi | Không đáng ghi |
|---|---|
| "Đất đường dưới 5m thì khó ra hàng, dù giá rẻ" | Toàn bộ bài báo về thị trường BĐS Đà Nẵng |
| "Dấu phẩy trong file ASS làm ffmpeg ẩn hết phụ đề" | Tài liệu ffmpeg |
| "Khách khu Hải Châu hay hỏi hệ lọc tổng trước, hỏi giá sau" | Danh sách khách hàng |
| "Prompt viết kịch bản phải chốt độ dài trước, không thì nó dàn đều" | Thư viện prompt chép trên mạng |

**Tiêu đề là một câu khẳng định**, không phải chủ đề. "Hero mobile dùng contain, không dùng cover" tìm lại được; "Về ảnh hero" thì không.

Trong nội dung luôn có phần **vì sao**. Không có vì sao thì nửa năm sau đọc lại anh sẽ không dám tin chính mình.

### Ba nhịp dùng

**1. Bắt ngay lúc vừa nghĩ ra** — nói với Mây, không cần mở trang web:
> "Ghi lại giúp anh: landing dài hơn 3 màn thì phải lặp CTA ở đầu, giữa và cuối, vì người đọc quyết định ở những thời điểm khác nhau."

Chưa kịp nghĩ nhóm thì cứ để trống. Nó rơi vào *Chưa xếp chỗ*, dọn sau.

**2. Dọn mỗi tuần vài phút** — mở tab **Ôn**:
- Phần *Chưa xếp chỗ*: mở từng cái, bấm **Sửa**, điền nhóm và thẻ. Thiếu nhóm thì ghi chú đó coi như mất.
- Hàng chờ ôn lại: đọc, còn đúng thì bấm **Nhớ rồi**; thấy thiếu thì sửa; hết thời thì xoá.

Hoặc nhờ Mây: *"Mây dọn hộp chờ giúp anh"* — nó sẽ đọc từng cái và hỏi anh xếp vào đâu.

**3. Lấy ra khi làm việc** — đây mới là lý do tồn tại của kho:

> "Anh sắp viết bài về landing page, lấy hết ghi chú nhóm Landing page ra tổng hợp giúp anh."

> "Tuần này anh ghi được gì rồi? Viết thành bản tin ngắn để anh đăng."

> "Khách này hỏi hệ lọc tổng, anh từng ghi gì về nhóm khách Hải Châu?"

> "Trước anh gặp lỗi phụ đề không hiện, anh ghi cách sửa ở đâu rồi ấy nhỉ?"

### Vài việc cụ thể hợp với công việc của anh

**Soạn bài dạy / nội dung bán hàng.** Mọi thứ anh dạy đều là thứ anh đã làm. Xuất đúng mảng cần ra một file rồi viết từ đó, không phải nhớ lại từ đầu:
```bash
BR="python3 ~/.openclaw/workspace/skills/second-brain/scripts/brain.py"
$BR export --out landing.md --category "Landing page"
$BR export --out thang-nay.md --since 30
```

**Tổng kết tuần.** `digest` gom những gì ghi trong 7 ngày theo nhóm — nguyên liệu sẵn cho báo cáo hoặc bài đăng:
```bash
$BR digest --days 7
```

**Thẻ nhiều chữ.** Gõ thẻ tiếng Việt có khoảng trắng thì **nhớ ngăn bằng dấu phẩy**:

| Gõ | Ra | |
|---|---|---|
| `bất động sản, vay ngân hàng` | `bất-động-sản` `vay-ngân-hàng` | đúng |
| `bất động sản vay ngân hàng` | `bất` `động` `sản` `vay` `ngân` `hàng` | sai — 6 thẻ vụn |

Không có dấu phẩy thì nó hiểu mỗi chữ là một thẻ (tiện cho thẻ tiếng Anh: `landing mobile ux`). Có dấu phẩy thì khoảng trắng bên trong thành gạch nối.

**Hồ sơ khách hàng.** Mỗi khách một thẻ (`--tags khach-abc`). Trước khi gặp lại:
```bash
$BR list --tag khach-abc
```

**Kiểm tra sức khoẻ kho.** Lâu lâu chạy một lần:
```bash
$BR stats
```
Khối `suc_khoe_kho` nói thẳng kho đang lệch chỗ nào: `cho_phan_loai` cao là anh bắt nhiều mà không dọn; `chua_on_lan_nao` cao là anh chỉ bỏ vào chứ chưa lấy ra bao giờ; `khong_noi_voi_ghi_chu_nao` cao là các ghi chú đang nằm rời, chưa thành mạng lưới.

**Dọn thẻ bị trùng nghĩa.** Dùng lâu sẽ có cả `landing` lẫn `landing-page`:
```bash
$BR tags                                      # xem thẻ nào chỉ dùng 1 lần
$BR retag --from landing-page --to landing --yes
```

### Ghi chú có bao giờ mất không

Không. **Không có cơ chế nào tự xoá ghi chú theo thời gian.** Ghi hôm nay, mười năm sau mở ra vẫn còn, miễn file `notes.sqlite` còn. Lệnh `review` chỉ *nêu lại* ghi chú cũ cho anh đọc, nó không đụng vào nội dung.

Muốn bỏ thứ vô giá trị thì có hai mức, khác nhau rõ ràng:

**Cất kho** (`archive`) — dùng cho hầu hết trường hợp. Ghi chú biến khỏi đồ thị, khỏi tìm kiếm, khỏi hàng chờ ôn, nhưng **vẫn nằm nguyên trong file**. Kho sạch mà không mất gì. Trên trang web là nút *Cất vào kho lưu*; xem lại ở tab **Ôn** → *Kho lưu*.

**Xoá hẳn** (`delete --yes`) — chỉ chạy được bằng lệnh trên VPS. Trước khi xoá, nó ghi riêng một file JSON cho ghi chú đó vào thư mục `deleted/`, và **thư mục này không bao giờ tự dọn**. Lấy lại:
```bash
$BR restore --file <id ghi chú>
```

Trang web **cố ý không có nút xoá hẳn** — một cú bấm nhầm không được phép làm mất ghi chú.

### Sao lưu

Lịch sao lưu hằng ngày đã bật ở **Bước 5 khi cài** (CAI-DAT.md). Chưa bật thì dán khối này — dán lại bao nhiêu lần cũng không tạo dòng trùng:
```bash
( crontab -l 2>/dev/null | grep -v 'second-brain/scripts/brain.py snapshot'
  echo '17 2 * * * python3 $HOME/.openclaw/workspace/skills/second-brain/scripts/brain.py snapshot >/dev/null 2>&1'
) | crontab -
crontab -l | grep snapshot
```

Mỗi tuần kéo về máy cá nhân một bản (Termius/WinSCP: kéo file này qua SFTP cũng được):
```bash
scp root@IP_VPS:~/.openclaw/workspace/second-brain/backups/notes-latest.sqlite ~/backup-brain-$(date +%F).sqlite
```
> **Đừng** chép thẳng `notes.sqlite`. Kho chạy chế độ WAL: ghi chú mới có thể còn nằm trong file `notes.sqlite-wal` bên cạnh, chép mỗi file chính là được bản thiếu — đã thử, có lúc **rỗng hoàn toàn**. `notes-latest.sqlite` do lệnh `snapshot` tạo ra là bản đầy đủ, một file duy nhất.

Mỗi tháng khám sức khoẻ kho một lần (hoặc nhờ Mây: *"kiểm tra kho ghi chú giúp anh"*):
```bash
$BR doctor
```
Ra `"Kho khoẻ"` là xong. Có dòng `loi` thì chạy `$BR doctor --fix` (chỉ dựng lại chỉ mục tìm kiếm, không đụng nội dung ghi chú). Báo *"Bản sao lưu mới nhất đã N ngày"* nghĩa là lịch cron đã ngừng — kiểm bằng `crontab -l`.
Hoặc xuất ra Markdown đọc được bằng mắt, không cần phần mềm gì:
```bash
$BR export --out brain-full.md --all
```

Ba thư mục cạnh kho, nên biết để khỏi nhầm:

| Thư mục | Chứa gì | Có tự dọn không |
|---|---|---|
| `notes.sqlite` | Kho thật, gồm cả ghi chú đã cất kho | Không |
| `deleted/` | Mỗi ghi chú xoá hẳn một file riêng | **Không bao giờ** |
| `backups/*.json.gz` | Ảnh chụp toàn kho | Có — giữ 60 bản gần nhất |
| `backups/notes-latest.sqlite` | Bản sao đầy đủ mới nhất — **file để kéo về máy** | Ghi đè mỗi lần `snapshot` |
| `.web-token` | Mã truy cập trang web | Không |

`backups/` là để cứu hộ cả kho khi hỏng file, **không phải** nơi giữ ghi chú đã xoá — cái đó nằm ở `deleted/`.

### Chống trùng lặp

Ba lớp:

**Trùng y hệt** — cùng tiêu đề và nội dung (kể cả khác hoa/thường, khoảng trắng, kiểu gõ dấu) thì **không lưu bản thứ hai**, dù ghi bằng chat, trên web hay nạp hàng loạt. Mây báo ghi chú đó đã có, kèm mã.

**Lúc ghi** — thêm ghi chú gần giống cái đã có, nó báo ngay kèm tên ghi chú cũ. Không chặn lưu, chỉ nhắc. Nhận ra được cả khi anh viết lại cùng ý bằng câu khác (so theo cụm từ như "dấu chấm", "mili giây", không theo từng chữ rời). Muốn gộp thì Mây dùng `merge` — ghi chú thừa được cất kho, không bị xoá.

**Quét định kỳ** — vài tháng một lần, hoặc khi kho vượt khoảng 200 ghi chú:
```bash
$BR duplicates
```
Nó liệt kê từng cặp nghi ngờ kèm tỉ lệ giống nhau (mặc định từ 0,5; `--nguong 0.4` bắt rộng hơn, `0.7` chỉ bắt cặp rất giống). Đọc cả hai rồi quyết:
```bash
$BR merge --from <id bỏ> --into <id giữ> --yes
```
Gộp sẽ nối nội dung, dồn thẻ và liên kết về ghi chú giữ lại, rồi **cất** ghi chú kia vào kho lưu — không xoá.

Lưu ý: hai ghi chú cùng chủ đề nhưng khác góc nhìn thì nên `link` chứ đừng gộp. `duplicates` chỉ đưa ra nghi ngờ, người quyết là anh.

> **Đừng ghi mật khẩu, token hay số thẻ vào ghi chú.** File SQLite không mã hoá. Kho tự để quyền chỉ chủ sở hữu đọc được (user khác trên VPS không đọc được), nhưng ai đăng nhập được bằng user của anh hoặc root thì vẫn đọc được.

---

## Mẹo cho 3 skill còn lại

**pdf-extract-crop.** Nói rõ tên file và cụm chữ. Cụm chữ xuất hiện nhiều chỗ thì Mây sẽ báo có bao nhiêu chỗ, ở trang nào — anh chọn chỗ cần cắt ("lấy chỗ ở trang 12"). Ảnh bị cụt bảng thông số thì nói "cắt rộng xuống dưới thêm". PDF scan (ảnh chụp) thì không tìm chữ được, chỉ chụp nguyên trang.

**css-video-production.** Gửi kèm kịch bản chia theo cảnh và ghi luôn từ khoá muốn tô vàng cho mỗi câu. Mây luôn gửi kèm ảnh lưới QA (các khung hình cách đều nhau) — xem ảnh đó trước khi đăng: phụ đề đủ chưa, B-roll có đen/đứng hình không. Video ngang hay dọc đều được, phụ đề tự theo khung video.

**pptx-deck-builder.** Mây sẽ hỏi trước: deck cho ai, mục tiêu gì, bao nhiêu slide, số liệu thật nào được dùng. Có số liệu thì đưa dạng bảng hoặc liệt kê ("Q1 120, Q2 150 triệu") — Mây không tự bịa số cho biểu đồ. So sánh hai năm thì nói rõ, biểu đồ sẽ có hai cột mỗi quý kèm chú giải. Muốn có lời dẫn khi thuyết trình thì nói "thêm ghi chú cho người trình bày" — nằm ở phần Notes dưới mỗi slide.

---

## Sau này muốn cài thêm 16 skill còn lại

Gói đầy đủ `openclaw-skills-bundle.zip` vẫn dùng được, cài chồng lên không sao — skill nào đã có sẽ bị bỏ qua, không ghi đè. Nhưng nhóm đó cần khoá API và có vài cái cần chỉnh khi chạy với giao diện thật, nên anh cứ dùng quen 4 cái này trước đã.
