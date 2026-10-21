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

## Mở giao diện web của Second Brain

Giao diện này giống bản cũ anh từng dùng: lõi **BRAIN** ở giữa, ghi chú xoay quanh thành các vòng — mỗi vòng là một nhóm, mỗi nhóm một màu. Khác bản cũ ở chỗ **nó chạy trên máy anh, không gửi ghi chú nào ra ngoài** (thứ duy nhất trình duyệt tải từ Internet là font chữ).

**Trên VPS**, chạy nền:
```bash
nohup python3 ~/.openclaw/workspace/skills/second-brain/scripts/server.py \
  >/tmp/brain-web.log 2>&1 &
```

Server chỉ nghe `127.0.0.1` — **cố ý**, vì trang này không có đăng nhập. Để xem từ máy cá nhân, mở một đường hầm SSH (Termius cũng làm được qua mục Port Forwarding):

```bash
ssh -N -L 8787:127.0.0.1:8787 root@IP_VPS
```

Giữ cửa sổ đó mở, rồi vào trình duyệt: **http://127.0.0.1:8787**

Trong trang có bốn ô ở cột trái:

- **Thêm** — lưu ghi chú mới. Điền ô *Nguồn* nếu lấy từ bài viết hay khoá học; sáu tháng sau anh sẽ cần biết điều này lấy ở đâu ra. Nếu kho đã có ghi chú gần giống, trang hiện cảnh báo kèm tên ghi chú cũ — bấm vào để xem rồi tự quyết gộp hay giữ cả hai.
- **Tìm** — tìm toàn văn tiếng Việt có dấu, bấm kết quả để mở ghi chú. Gõ cả câu dài cũng được: không ghi chú nào có đủ mọi từ thì nó đưa ra ghi chú khớp nhiều từ nhất.
- **Hỏi** — hỏi Mây dựa trên chính ghi chú trong kho (gọi `openclaw agent` ngay trên VPS).
- **Ôn** — ba phần: *Chưa xếp chỗ* (ghi chú thiếu nhóm/thẻ), *Kho lưu* (ghi chú đã cất, bấm vào để mở và lấy lại), và hàng chờ ôn lại.

Trên đồ thị: bấm một chấm để mở ghi chú; bấm tên nhóm ở dải chú giải dưới cùng để chỉ làm nổi nhóm đó; nút **Dừng xoay** ở góc phải nếu thấy chóng mặt.

Trong thẻ chi tiết có **Sửa** (đổi nhóm, thẻ, nguồn, nội dung ngay tại chỗ), **Nhớ rồi** (đánh dấu đã ôn) và **Cất vào kho lưu**.

Đổi cổng khi 8787 đã bận: `BRAIN_PORT=9090 python3 .../server.py` (nhớ đổi cả hai số trong lệnh `ssh -L`).

> **Đừng** đặt `BRAIN_HOST=0.0.0.0` để vào thẳng bằng IP VPS. Làm vậy là mở toàn bộ kho ghi chú cho bất kỳ ai quét được cổng đó. Đường hầm SSH ở trên an toàn hơn và cũng nhanh như nhau. (Nếu lỡ làm, `bash kiemtra.sh` sẽ báo CHƯA ĐẠT ở phần An toàn.)

---

## Dùng Second Brain vào việc thật

Kho ghi chú chết là kho chỉ có người bỏ vào, không ai lấy ra. Phần này là cách dùng để nó không chết.

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

Đặt lịch sao lưu hằng ngày, làm một lần rồi quên:
```bash
crontab -e
# dán dòng này — 2h sáng mỗi ngày
0 2 * * * python3 ~/.openclaw/workspace/skills/second-brain/scripts/brain.py snapshot >/dev/null 2>&1
```

Mỗi tháng kéo về máy một bản cho chắc:
```bash
scp root@IP_VPS:~/.openclaw/workspace/second-brain/notes.sqlite ~/backup-brain.sqlite
```
Hoặc xuất ra Markdown đọc được bằng mắt, không cần phần mềm gì:
```bash
$BR export --out brain-full.md --all
```

Ba thư mục cạnh kho, nên biết để khỏi nhầm:

| Thư mục | Chứa gì | Có tự dọn không |
|---|---|---|
| `notes.sqlite` | Kho thật, gồm cả ghi chú đã cất kho | Không |
| `deleted/` | Mỗi ghi chú xoá hẳn một file riêng | **Không bao giờ** |
| `backups/` | Ảnh chụp toàn kho | Có — giữ 60 bản gần nhất |

`backups/` là để cứu hộ cả kho khi hỏng file, **không phải** nơi giữ ghi chú đã xoá — cái đó nằm ở `deleted/`.

### Chống trùng lặp

Hai lớp:

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
