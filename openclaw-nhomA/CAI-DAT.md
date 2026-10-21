# Cài 4 Skill nhóm A lên OpenClaw

Bốn skill trong gói này chạy hoàn toàn trên VPS của anh: **không cần khoá API, không cần tài khoản, không tốn tiền.**

| Skill | Dùng để làm gì | Cần cài thêm gì |
|---|---|---|
| `second-brain` | Kho kiến thức cá nhân: ghi, tìm toàn văn tiếng Việt, ôn lại, dọn kho, kèm giao diện web đồ thị BRAIN | **Không cần gì** |
| `pdf-extract-crop` | Đọc PDF, tìm cụm chữ, cắt đúng vùng đó ra thành ảnh | `poppler-utils` |
| `css-video-production` | Chèn B-roll không bị đứng hình, tạo phụ đề, kiểm tra bằng lưới ảnh | `ffmpeg` |
| `pptx-deck-builder` | Dựng file PowerPoint từ dàn ý, có biểu đồ thật | `python-pptx`, `pillow` |

**Toàn bộ các bước dưới đây làm trên VPS qua SSH, không phải trên máy tính cá nhân.**

Anh cần: tài khoản SSH vào VPS (Termius, PuTTY hoặc terminal), OpenClaw đã chạy sẵn trên VPS đó, và file `openclaw-nhomA.zip`.

---

# PHẦN 1 — Kiểm tra trước khi cài

Mục đích: biết trước máy thiếu gì, **thay vì cài vào rồi mới phát hiện lỗi**.

### 1.1. Đưa file zip lên VPS

**Cách A — dùng lệnh** (máy anh có sẵn `scp`):
```bash
scp openclaw-nhomA.zip root@IP_VPS:~/
```

Chỉ muốn cài mỗi Second Brain? Vẫn tải cả gói này lên, rồi ở Bước 3 chạy `./install.sh --only second-brain`. Ba skill kia nằm yên trong file zip, không lên VPS.

**Cách B — dùng phần mềm có giao diện:**
Mở Termius (mục SFTP), FileZilla hoặc WinSCP, kết nối tới VPS bằng giao thức **SFTP**, kéo thả file zip vào thư mục home (thường là `/root/`).

### 1.2. SSH vào VPS, giải nén

```bash
cd ~
unzip openclaw-nhomA.zip
cd openclaw-nhomA
```

Nếu báo `unzip: command not found`:
```bash
sudo apt update && sudo apt install -y unzip
```

### 1.3. Chạy script kiểm tra

```bash
bash truoc-khi-cai.sh
```

Script này **chỉ đọc, không cài gì, không sửa gì**. Nó kiểm tra 5 nhóm:

| Nhóm | Nó xem gì |
|---|---|
| 1. Bắt buộc phải có | `python3` ≥ 3.8, SQLite có FTS5 (tìm tiếng Việt), `unzip`, lệnh `openclaw` |
| 2. Chỗ sẽ cài vào | Tìm thư mục skills của OpenClaw, kiểm tra quyền ghi |
| 3. Đã cài lần nào chưa | 4 skill đã có chưa, kho ghi chú cũ có bao nhiêu ghi chú |
| 4. Công cụ cho 3 skill còn lại | `pdftotext`, `pdftoppm`, `ffmpeg`, `ffprobe`, `pillow`, `python-pptx` |
| 5. Máy có đủ sức không | Ổ đĩa trống, RAM trống, cổng 8787 còn rảnh |

### 1.4. Đọc kết quả

Mỗi dòng ra một trong ba trạng thái:

- **ĐẠT** — xong, không phải làm gì.
- **LƯU Ý** — không chặn việc cài, chỉ cho anh biết trước điều gì sẽ xảy ra. Ví dụ: skill đã có sẵn nên cài lại sẽ ghi đè script (ghi chú thì không bị đụng), hoặc chưa có `ffmpeg` nên skill video sẽ chưa dùng được.
- **CHƯA ĐẠT** — **dừng lại, sửa rồi chạy lại script.** Mỗi dòng đều ghi sẵn lệnh để sửa.

Cuối cùng in ra một trong ba câu:

```
 Máy sẵn sàng. Sang PHẦN 2 trong CAI-DAT.md.           ← cài được
 Cài được. Lưu ý: N skill đã có sẵn...                   ← cài được, có cái đã tồn tại
 ĐỪNG CÀI VỘI. Sửa các dòng CHƯA ĐẠT ở trên...           ← chưa cài được
```

### 1.5. Ba lỗi hay gặp ở phần này

**`lệnh openclaw — CHƯA ĐẠT`**
Anh đang đăng nhập sai user. OpenClaw cài cho user nào thì phải SSH bằng chính user đó. Tìm xem nó nằm đâu:
```bash
find / -name "openclaw" -type f 2>/dev/null | head
ps aux | grep -i openclaw | grep -v grep
```
Cột đầu của `ps aux` là tên user đang chạy nó.

**`không tìm thấy workspace của OpenClaw`**
```bash
find / -name "workspace" -path "*openclaw*" 2>/dev/null | head
```
Ra đường dẫn khác thì chạy lại kèm đường dẫn đó:
```bash
bash truoc-khi-cai.sh --dir /duong/dan/thuc/te/skills
```

**`python3 thiếu FTS5`**
Hiếm, thường do python3 cài từ nguồn lạ. Cài lại bản chuẩn:
```bash
sudo apt install --reinstall -y python3
```

---

# PHẦN 2 — Cài đặt

Bốn bước. Làm đúng thứ tự.

### Bước 1 — Cài công cụ cho 3 skill kia

**Bỏ qua bước này nếu anh chỉ cần Second Brain** — nó không cần gì ngoài `python3`.

```bash
sudo apt update
sudo apt install -y poppler-utils ffmpeg
pip install python-pptx pillow
```

Nếu `pip` báo *"externally-managed-environment"*:
```bash
pip install --break-system-packages python-pptx pillow
```

> **Vì sao cần bước này?** Skill chỉ là bản hướng dẫn kèm vài đoạn script — nó không tự xử lý PDF hay video được, nó *gọi* các chương trình có sẵn trên máy. Giống bản quy trình ghi "scan tài liệu rồi cắt lấy bảng biểu": đọc thì hiểu, nhưng phòng phải có máy scan mới làm được. Dòng `apt install` chính là đi sắm máy. `apt` không biết gì về OpenClaw hay skill — nó chỉ tải chương trình về đặt vào `/usr/bin/`.

### Bước 2 — Kiểm tra gói skill chưa bị hỏng

```bash
cd ~/openclaw-nhomA
python3 validate.py
```

Phải ra **`4 skill, 0 lỗi`**. Ra khác thì dừng lại và báo tôi — file zip có vấn đề, đừng cài tiếp.

### Bước 3 — Chép skill vào chỗ của OpenClaw

```bash
./install.sh
```

In ra `Đã cài 4 skill vào /root/.openclaw/workspace/skills`.

Việc nó làm chỉ là **chép 4 thư mục** vào đúng chỗ. Chép xong là xong — nó không tự báo cho OpenClaw biết.

Workspace nằm chỗ khác thì chỉ định bằng `--dest` (lưu ý: `install.sh` dùng `--dest`, còn hai script kiểm tra dùng `--dir`):
```bash
./install.sh --dest /duong/dan/khac/skills
```

Chỉ cài một vài skill:
```bash
./install.sh --only second-brain
```

### Bước 4 — Bắt OpenClaw đọc lại

```bash
openclaw gateway restart
```

**Đây là bước hay bị quên nhất.** OpenClaw chỉ quét thư mục skill một lần lúc khởi động. Không restart thì nó vẫn chạy với danh sách cũ, Mây sẽ không thấy skill mới — y như chưa cài gì.

Cài skill trước rồi mới cài công cụ cũng không sao: **không phải cài lại skill**, chỉ cần `openclaw gateway restart` lần nữa.

`install.sh` chạy **một lần**. `openclaw gateway restart` chạy **mỗi khi có gì thay đổi**.

---

# PHẦN 3 — Kiểm tra cài đã ok chưa

```bash
cd ~/openclaw-nhomA
bash kiemtra.sh
```

Workspace ở chỗ khác:
```bash
bash kiemtra.sh --dir /duong/dan/khac/skills
```

Script kiểm tra 4 phần:

**Phần 1 — Thư mục skill đã chép lên chưa.** Xem 4 thư mục có nằm đúng chỗ không. Hỏng ở đây nghĩa là `install.sh` chưa chạy hoặc chạy sai thư mục.

**Phần 2 — OpenClaw đã nhận chưa.** Chạy `openclaw skills list` rồi dò từng tên. Hỏng ở đây mà phần 1 đạt thì gần như chắc chắn là **quên restart**.

**Phần 3 — Công cụ đã cài chưa.** `pdftotext`, `pdftoppm`, `ffmpeg`, `ffprobe`, `pillow`, `python-pptx`.

**Phần 4 — Chạy thử thật.** Đây mới là phần quan trọng: nó **thật sự chạy** từng skill trên file tạm —

- `second-brain`: ghi một ghi chú rồi tìm lại bằng tiếng Việt có dấu
- `second-brain (duy trì kho)`: chạy `inbox`, `review`, `digest`, `stats`
- `second-brain (giữ dữ liệu)`: cất kho → lấy lại → xoá hẳn → khôi phục từ bản sao
- `second-brain (trang web)`: kiểm tra file giao diện và `server.py`
- `pdf-extract-crop`: tạo một PDF mẫu rồi tìm chữ trong đó
- `css-video-production`: dựng một file phụ đề `.ass`
- `pptx-deck-builder`: dựng một file `.pptx` thật

Script chỉ đọc và thử trên file tạm, **không đụng vào dữ liệu của anh**.

### Hai bộ test sâu hơn (tuỳ chọn)

`kiemtra.sh` kiểm tra skill đã cài. Hai script dưới đây kiểm tra *bản thân phần mềm* — chạy khi anh nghi ngờ có lỗi, hoặc sau khi tôi gửi bản cập nhật:

```bash
bash test-brain.sh     # 50 trường hợp: kho rỗng, thẻ tiếng Việt, cất kho/xoá/lấy lại,
                       # file hỏng, ghi chú rất dài, biến môi trường gõ sai…
bash test-web.sh       # 30 trường hợp: leo thư mục, chặn trang lạ gửi lệnh,
                       # đầu vào xấu, server có sống sót không…
```

Cả hai chạy trên kho tạm rồi tự xoá, **không đụng dữ liệu thật**. Kết quả phải là `HỎNG: 0`.

---

# PHẦN 4 — Thế nào là ĐẠT

### Kết quả phải ra

```
 ĐẠT: 22     CHƯA ĐẠT: 0

 Xong. Cả 4 skill đã sẵn sàng.
```

**22 mục đạt, 0 mục chưa đạt.** Có dòng CHƯA ĐẠT nào là chưa xong.

Con số có thể khác 22 trong hai trường hợp bình thường, không phải lỗi:

- **Ra 18 và phần 2 ghi "bỏ qua"** — script không tìm thấy lệnh `openclaw`, nên nó bỏ 4 mục của phần 2. Nghĩa là anh đang đăng nhập sai user. SSH lại bằng đúng user chạy OpenClaw rồi chạy lại.
- **Chỉ cài mỗi Second Brain** — các dòng của 3 skill kia sẽ báo CHƯA ĐẠT. Đúng như vậy. Chỉ cần 4 dòng `second-brain*` đều ĐẠT là ổn.

### Kiểm tra thêm bằng mắt

```bash
openclaw skills list | grep -E "second-brain|pdf-extract|css-video|pptx-deck"
```
Phải thấy đủ 4 dòng.

### Khi có dòng CHƯA ĐẠT

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| Phần 1 báo thiếu thư mục | `install.sh` chưa chạy, hoặc chạy sai chỗ | `cd ~/openclaw-nhomA && ./install.sh` |
| Phần 1 đạt, phần 2 không thấy | Quên restart | `openclaw gateway restart` |
| Phần 2 thiếu `css-video-production` | Chưa có `ffmpeg` | `sudo apt install -y ffmpeg` rồi restart |
| Phần 2 thiếu `pdf-extract-crop` | Chưa có `poppler-utils` | `sudo apt install -y poppler-utils` rồi restart |
| Phần 4 không dựng được `.pptx` | Chưa có `python-pptx` | `pip install python-pptx pillow` |
| Không tìm thấy lệnh `openclaw` | Đang đăng nhập sai user | SSH lại bằng user đang chạy OpenClaw |

> OpenClaw **ẩn** skill nào thiếu công cụ bắt buộc. Nên nếu `openclaw skills list` không thấy một skill, hãy nghĩ tới thiếu công cụ trước khi nghĩ tới cài sai.

---

# PHẦN 5 — Test từng skill sau khi cài

Phần 3 kiểm tra bằng script. Phần này là anh **tự nói chuyện với Mây** như dùng thật — không gõ lệnh.

### second-brain

**Test 1 — ghi và tìm lại.** Nói với Mây:
> "Ghi lại giúp anh: landing page trên mobile mà dùng ảnh ngang thì phải để background-size contain, không dùng cover, vì đáy ảnh có nút bấm."

*Đạt khi:* Mây xác nhận đã lưu và đưa ra mã ghi chú (12 ký tự).

Rồi hỏi lại:
> "Anh từng ghi gì về landing page mobile?"

*Đạt khi:* Mây đọc lại đúng nội dung vừa ghi, có dẫn mã ghi chú. **Không đạt** nếu Mây trả lời bằng kiến thức chung chung về landing page mà không nhắc tới ghi chú của anh.

**Test 2 — tiếng Việt có dấu.** Ghi một ghi chú có dấu rồi tìm bằng từ có dấu:
> "Ghi lại: mili giây trong file phụ đề ASS phải dùng dấu chấm, dấu phẩy làm ffmpeg ẩn hết phụ đề."

Sau đó: *"Tìm giúp anh ghi chú về phụ đề"*

*Đạt khi:* tìm ra. Gõ "phụ đề" có dấu mà không ra là FTS5 có vấn đề.

**Test 3 — trang web.** Trên VPS:
```bash
nohup python3 ~/.openclaw/workspace/skills/second-brain/scripts/server.py \
  >/tmp/brain-web.log 2>&1 &
```
Trên máy cá nhân, mở đường hầm SSH (Termius có mục Port Forwarding):
```bash
ssh -N -L 8787:127.0.0.1:8787 root@IP_VPS
```
Giữ cửa sổ đó mở, vào trình duyệt: **http://127.0.0.1:8787**

*Đạt khi:* thấy lõi BRAIN đỏ ở giữa, các ghi chú vừa ghi xoay quanh thành chấm có tên. Bấm một chấm phải mở ra nội dung đầy đủ.

### pdf-extract-crop

Tải một file PDF bất kỳ lên VPS rồi nói với Mây:
> "Trong file /root/catalogue.pdf, tìm giúp anh chữ 'HA1600' rồi cắt vùng đó ra thành ảnh."

*Đạt khi:* Mây trả về số trang tìm thấy và đường dẫn file ảnh đã cắt. Mở ảnh ra thấy đúng vùng chứa chữ đó.

### css-video-production

> "Tạo cho anh file phụ đề tiếng Việt cho đoạn này: 'Chào anh em, hôm nay mình nói về lọc nước tổng cho gia đình.'"

*Đạt khi:* ra file `.ass`, mở bằng `cat` thấy các dòng `Dialogue:` và **mili giây dùng dấu chấm** (`0:00:01.50`), không phải dấu phẩy.

### pptx-deck-builder

> "Làm cho anh bộ slide 5 trang giới thiệu dịch vụ lọc nước của công ty Phúc Khang."

*Đạt khi:* ra file `.pptx`, tải về mở bằng PowerPoint hoặc Google Slides thấy đủ 5 trang có nội dung, không lỗi font.

### Bảng tóm tắt

| Skill | Test | Đạt khi |
|---|---|---|
| second-brain | Ghi rồi hỏi lại | Mây đọc đúng nội dung + dẫn mã ghi chú |
| second-brain | Tìm từ có dấu | Ra kết quả |
| second-brain | Mở trang web qua SSH tunnel | Thấy đồ thị BRAIN, bấm chấm mở được ghi chú |
| pdf-extract-crop | Tìm chữ + cắt ảnh | Ra file ảnh đúng vùng |
| css-video-production | Tạo phụ đề | File `.ass` có `Dialogue:`, mili giây dùng dấu chấm |
| pptx-deck-builder | Dựng slide | File `.pptx` mở được, đủ số trang |

---

# PHẦN 6 — Tốn RAM, CPU, ổ đĩa, swap bao nhiêu?

Tất cả số dưới đây tôi **đo thật** trên kho 2.000 ghi chú, không phải ước lượng.

### Tóm tắt một dòng

Không đáng kể. Skill không chạy nền — chỉ chạy khi Mây gọi, xong là thoát. Thứ duy nhất chạy liên tục là trang web, và chỉ khi anh tự bật.

### Ổ đĩa

| Thứ | Dung lượng |
|---|---|
| 4 skill (code) | **~400 KB** |
| Kho 2.000 ghi chú (gồm chỉ mục tìm kiếm) | **4,8 MB** — khoảng 2,5 KB/ghi chú |
| Một bản sao lưu (nén gzip) | **0,5 MB** |
| 60 bản sao lưu (tối đa) | **30 MB** |

Quy mô thực tế:

| Số ghi chú | Kho | Sao lưu tối đa | Tổng |
|---|---|---|---|
| 500 | 1,2 MB | 8 MB | **~9 MB** |
| 2.000 | 4,8 MB | 30 MB | **~35 MB** |
| 10.000 | 24 MB | 151 MB | **~175 MB** |

Phần tốn nhất là thư mục sao lưu, không phải kho. Muốn ít hơn thì giảm số bản giữ lại:
```bash
echo 'export SECOND_BRAIN_KEEP_BACKUPS=20' >> ~/.bashrc
```

Xem đang chiếm bao nhiêu:
```bash
python3 ~/.openclaw/workspace/skills/second-brain/scripts/brain.py stats
```
Khối `luu_tru` có dòng `tong_dung_luong_mb`.

Ba skill còn lại không sinh dữ liệu — chúng đọc file anh đưa, ghi kết quả ra rồi thôi. Nhưng `ffmpeg` nếu phải cài thì kéo theo khoảng **300 MB** thư viện hệ thống. Đó là phần nặng nhất của cả gói, và chỉ cài một lần.

### RAM

| Lúc nào | Tốn bao nhiêu |
|---|---|
| Không ai dùng | **0 MB** — không có tiến trình nào chạy |
| Mây ghi/tìm một ghi chú | **~18 MB**, trong vòng dưới 0,1 giây rồi thoát |
| Trang web đang chạy (kho 2.000 ghi chú) | **28 MB**, đứng yên không tăng |
| Lệnh `duplicates` quét cả kho | **27 MB** |

28 MB là mức của trang web, đo sau 20 lượt gọi API vẫn y nguyên — không rò rỉ bộ nhớ. VPS 1 GB chạy thoải mái.

### CPU

| Việc | Thời gian |
|---|---|
| Thêm một ghi chú | 0,04 giây |
| Tìm kiếm trong 2.000 ghi chú | 0,05 giây |
| `stats` | 0,05 giây |
| `digest --days 7` | 0,41 giây |
| `duplicates` quét cả 2.000 ghi chú | 0,20 giây |
| Trang web trả danh sách 2.000 ghi chú | 0,02 giây |

Trang web khi không ai thao tác: **0% CPU**. Nó nằm chờ kết nối, không quét gì theo chu kỳ.

### Swap

**Không đụng tới.** Mức RAM cao nhất đo được là 28 MB — VPS nào cũng còn thừa chừng đó, máy không cần tráo ra swap. Nếu VPS của anh đang swap nhiều thì nguyên nhân nằm ở chỗ khác (n8n giữ nhiều execution là thủ phạm quen thuộc), không phải mấy skill này.

### Muốn kiểm chứng

```bash
# RAM trang web đang dùng
ps -eo pid,rss,args | grep "[s]erver.py" | awk '{printf "RSS %.0f MB\n",$2/1024}'

# dung lượng toàn bộ kho
du -sh ~/.openclaw/workspace/second-brain/

# tải máy chung
free -h
top -bn1 | head -5
```

### Khi nào cần để mắt

Kho vượt khoảng **10.000 ghi chú** thì xem lại: lúc đó sao lưu chiếm ~150 MB và tìm kiếm bắt đầu chậm thấy được. Với nhịp ghi vài ghi chú mỗi ngày, mốc đó cách đây nhiều năm.

Trang web nếu quên tắt sẽ chạy mãi với 28 MB RAM. Muốn tắt:
```bash
pkill -f "second-brain/scripts/server.py"
```
