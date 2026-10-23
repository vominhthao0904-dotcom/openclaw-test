# Cài 4 Skill nhóm A lên OpenClaw

Bốn skill trong gói này chạy hoàn toàn trên VPS của anh: **không cần khoá API, không cần tài khoản, không tốn tiền.**

| Skill | Dùng để làm gì | Cần cài thêm gì |
|---|---|---|
| `second-brain` | Kho kiến thức cá nhân: ghi, tìm toàn văn tiếng Việt, ôn lại, dọn kho, kèm giao diện web (Toàn cảnh, Thư viện, Việc) | **Không cần gì** |
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
| 4. Công cụ cho 3 skill còn lại | `pdftotext`, `pdftoppm`, `ffmpeg`, `ffprobe`, ffmpeg có libass (in phụ đề), font tiếng Việt, `pip`, `pillow`, `python-pptx` |
| 5. Máy có đủ sức không | Ổ đĩa trống, RAM trống, cổng 8787 còn rảnh |

### 1.4. Đọc kết quả

Mỗi dòng ra một trong ba trạng thái:

- **ĐẠT** — xong, không phải làm gì.
- **LƯU Ý** — không chặn việc cài, chỉ cho anh biết trước điều gì sẽ xảy ra. Ví dụ: skill đã có sẵn nên `install.sh` sẽ bỏ qua (muốn nâng cấp thì dùng `--force`, xem Bước 3), hoặc chưa có `ffmpeg` nên skill video sẽ chưa dùng được.
- **CHƯA ĐẠT** — **dừng lại, sửa rồi chạy lại script.** Mỗi dòng đều ghi sẵn lệnh để sửa.

Cuối cùng in ra một trong ba câu:

```
 Máy sẵn sàng. Sang PHẦN 2 trong CAI-DAT.md.           ← cài được
 Cài được. Lưu ý: N skill đã có sẵn — muốn nâng cấp...   ← cài được, có cái đã tồn tại
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

**`thư mục skills — CHƯA ĐẠT — không thấy workspace OpenClaw ở …`**
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

Sáu bước. Làm đúng thứ tự (Bước 6 nên làm, không bắt buộc).

### Bước 1 — Cài công cụ cho 3 skill kia

**Bỏ qua bước này nếu anh chỉ cần Second Brain** — nó không cần gì ngoài `python3`.

```bash
sudo apt update
sudo apt install -y poppler-utils ffmpeg fonts-dejavu-core python3-pip
python3 -m pip install --user python-pptx pillow
```

Chạy dòng `pip` bằng **đúng user đang chạy OpenClaw** (thư viện cài kiểu `--user` chỉ user đó thấy).

Nếu `pip` báo *"externally-managed-environment"* (Ubuntu 23.04 trở lên):
```bash
python3 -m pip install --user --break-system-packages python-pptx pillow
```
Có `--user` thì thư viện nằm trong `~/.local/` của anh, **không đè lên thư viện hệ thống** — an toàn hơn chạy `pip` không có `--user` (cách đó có thể làm hỏng công cụ của Ubuntu).

> **Vì sao cần bước này?** Skill chỉ là bản hướng dẫn kèm vài đoạn script — nó không tự xử lý PDF hay video được, nó *gọi* các chương trình có sẵn trên máy. Giống bản quy trình ghi "scan tài liệu rồi cắt lấy bảng biểu": đọc thì hiểu, nhưng phòng phải có máy scan mới làm được. Dòng `apt install` chính là đi sắm máy. `apt` không biết gì về OpenClaw hay skill — nó chỉ tải chương trình về đặt vào `/usr/bin/`.

### Bước 2 — Kiểm tra gói skill chưa bị hỏng

```bash
cd ~/openclaw-nhomA
python3 validate.py
```

Phải ra **`4 skill, 0 lỗi`**. Ra khác thì dừng lại và báo tôi — file zip có vấn đề, đừng cài tiếp.

`validate.py` kiểm cú pháp mọi script, tìm khoá API/mật khẩu lọt vào gói, và **chặn symlink** (một symlink trỏ tới `~/.ssh` chẳng hạn sẽ bị chép theo vào workspace). Máy không có Node.js thì nó bỏ qua bước kiểm file `.js`, không báo lỗi.

### Bước 3 — Chép skill vào chỗ của OpenClaw

```bash
./install.sh
```

In ra `Đã cài 4 skill vào /root/.openclaw/workspace/skills`.

Việc nó làm chỉ là **chép 4 thư mục** vào đúng chỗ. Chép xong là xong — nó không tự báo cho OpenClaw biết. Không dùng `sudo`, không đụng cấu hình OpenClaw, không đụng kho ghi chú. Nó chép vào thư mục tạm rồi mới đổi tên, nên hỏng giữa chừng cũng không để lại skill dở dang. Quyền file được đặt để chỉ chủ sở hữu sửa được code mà agent sẽ chạy.

Muốn xem trước nó sẽ làm gì mà không chép gì:
```bash
./install.sh --dry-run
```

**Nâng cấp khi đã cài bản cũ.** `install.sh` mặc định **bỏ qua** skill đã có (không ghi đè). Muốn thay bằng bản mới:
```bash
./install.sh --force
```
Bản cũ được chuyển sang `~/.openclaw/workspace/skill-backups/<tên>-<giờ>` — **nằm ngoài** thư mục `skills/`, để OpenClaw không quét trúng và thấy hai skill trùng tên. Ghi chú trong kho không bị đụng tới. Cài xong, kiểm tra ổn thì xoá thư mục sao lưu cho gọn.

Workspace nằm chỗ khác thì chỉ định bằng `--dest` (lưu ý: `install.sh` dùng `--dest`, còn hai script kiểm tra dùng `--dir`):
```bash
./install.sh --dest /duong/dan/khac/skills
```

Chỉ cài một vài skill (gõ sai tên thì nó báo ngay, kèm danh sách tên đúng):
```bash
./install.sh --only second-brain
./install.sh --only second-brain,pdf-extract-crop
```

### Bước 4 — Bắt OpenClaw đọc lại

```bash
openclaw gateway restart
```

**Đây là bước hay bị quên nhất.** OpenClaw chỉ quét thư mục skill một lần lúc khởi động. Không restart thì nó vẫn chạy với danh sách cũ, Mây sẽ không thấy skill mới — y như chưa cài gì.

Cài skill trước rồi mới cài công cụ cũng không sao: **không phải cài lại skill**, chỉ cần `openclaw gateway restart` lần nữa.

`install.sh` chạy **một lần**. `openclaw gateway restart` chạy **mỗi khi có gì thay đổi**.

### Bước 5 — Bật sao lưu kho ghi chú hằng ngày

Làm một lần rồi quên. Dán nguyên khối này (chạy lại bao nhiêu lần cũng không tạo dòng trùng):
```bash
CU="$(crontab -l 2>/dev/null | grep -v 'second-brain/scripts/brain.py snapshot')"
{ [ -n "$CU" ] && printf '%s\n' "$CU"
  echo '17 2 * * * python3 $HOME/.openclaw/workspace/skills/second-brain/scripts/brain.py snapshot >/dev/null 2>&1'
} | crontab -
crontab -l | grep snapshot
```
Báo `crontab: command not found` thì cài trước: `sudo apt install -y cron`.

Mỗi đêm 2h17 nó chụp toàn kho vào `backups/` (giữ 60 bản) và làm mới `backups/notes-latest.sqlite` — file để anh kéo về máy cá nhân mỗi tháng (xem `HUONG-DAN.md`, mục Sao lưu).

### Bước 6 (nên làm) — Sao lưu MÃ HOÁ lên Google Drive mỗi đêm

Bước 5 giữ bản sao **trên VPS**. VPS hỏng, hết hạn hay bị xoá thì mất cả kho lẫn bản sao. Bước này gửi thêm một bản **ra ngoài** — lên Google Drive của anh — tự động mỗi đêm 2h47.

Bản lên Drive được **mã hoá ngay trên VPS** (công cụ `rclone`, chế độ *crypt*) trước khi gửi đi: Google chỉ thấy các file tên vô nghĩa, nội dung vô nghĩa. Lộ tài khoản Google cũng không lộ kiến thức. Script **chỉ chịu gửi qua kết nối mã hoá** — cấu hình nhầm sang kết nối thường thì nó từ chối.

**Cần chuẩn bị:** tài khoản Google; một máy tính có trình duyệt (để đăng nhập Google một lần); 15 phút. Gói Drive miễn phí 15 GB là thừa — mỗi bản chỉ vài MB, giữ 90 ngày.

**6.1. Cài rclone trên VPS**
```bash
sudo apt install -y rclone
rclone version
```

**6.2. Cài rclone trên máy tính của anh** (chỉ để đăng nhập Google một lần — VPS không có trình duyệt)

Windows: tải tại https://rclone.org/downloads/ → bản *Windows Intel/AMD 64 Bit* → giải nén ra `C:\rclone`. Mac: mở Terminal, chạy `brew install rclone` (hoặc tải ở trang trên).

**6.3. Tạo kết nối Google Drive trên VPS** — tên `gdrive`
```bash
rclone config
```
Trả lời lần lượt (gõ chữ in đậm rồi Enter; câu nào không nêu thì cứ Enter):

| rclone hỏi | Trả lời |
|---|---|
| `e/n/d/r/c/s/q>` | **n** (tạo mới) |
| `name>` | **gdrive** |
| `Storage>` | **drive** (Google Drive) |
| `client_id>` · `client_secret>` | Enter · Enter |
| `scope>` | **drive.file** (hoặc gõ số đứng trước dòng *drive.file*) — rclone **chỉ thấy file do chính nó tạo**, không đụng được tài liệu khác trong Drive của anh |
| `service_account_file>` | Enter |
| `Edit advanced config?` | **n** |
| `Use web browser to automatically authenticate…?` | **n** (VPS không có trình duyệt) |

rclone in ra một dòng lệnh dạng `rclone authorize "drive" "eyJ…"`. **Copy nguyên dòng đó**, mở cửa sổ lệnh **trên máy tính của anh** (Windows: vào `C:\rclone`, gõ `cmd` trên thanh địa chỉ thư mục), dán, Enter → trình duyệt mở ra → đăng nhập Google → **Cho phép**. Cửa sổ lệnh trên máy tính in ra một đoạn mã dài (giữa hai dòng `--->` và `<---End paste`) → copy đoạn đó, dán vào VPS ở câu `config_token>`.

| rclone hỏi tiếp | Trả lời |
|---|---|
| `Configure this as a Shared Drive…?` | **n** |
| `y/e/d>` | **y** (lưu) |

**6.4. Tạo kết nối MÃ HOÁ chồng lên trên** — tên `brain-mahoa`

Vẫn trong `rclone config` (hoặc chạy lại `rclone config`):

| rclone hỏi | Trả lời |
|---|---|
| `e/n/d/r/c/s/q>` | **n** |
| `name>` | **brain-mahoa** (đúng tên này — script dùng tên này) |
| `Storage>` | **crypt** (Encrypt/Decrypt a remote) |
| `remote>` | **gdrive:SecondBrain** |
| `filename_encryption>` | **standard** (hoặc Enter) — mã hoá cả tên file |
| `directory_name_encryption>` | **true** (hoặc Enter) |
| `y/g>` (password) | **g** → chọn **256** bit → rclone tạo mật khẩu ngẫu nhiên → **y** để dùng |
| `y/g/n>` (password2 — salt) | **g** → **256** → **y** |
| `Edit advanced config?` | **n** |
| `y/e/d>` | **y** |
| `e/n/d/r/c/s/q>` | **q** (thoát) |

> ⚠ **GHI LẠI 2 MẬT KHẨU** rclone vừa tạo (dòng `password` và `password2` hiện trên màn hình) — vào trình quản lý mật khẩu **và** ra giấy cất kỹ. Mất 2 mật khẩu này thì **không ai giải mã được** bản trên Drive, kể cả khi còn tài khoản Google. Không gửi mật khẩu qua chat, kể cả cho Mây.

**6.5. Thử, rồi bật lịch tự động**
```bash
BRAIN_SH=~/.openclaw/workspace/skills/second-brain/scripts
bash $BRAIN_SH/sao-luu-drive.sh kiem
bash $BRAIN_SH/sao-luu-drive.sh chay
bash $BRAIN_SH/sao-luu-drive.sh ds
bash $BRAIN_SH/sao-luu-drive.sh lich
```
*Đạt khi:* `kiem` báo **kết nối Drive: được**; `chay` báo **ĐÃ SAO LƯU notes-<ngày>.sqlite … (mã hoá)**; `ds` liệt kê đúng bản đó; `lich` báo **đã đặt lịch: mỗi đêm 2h47**. Mở Google Drive trên điện thoại: thấy thư mục **SecondBrain** chứa các tên vô nghĩa — đúng, đó là dữ liệu đã mã hoá.

**6.6. Thử khôi phục** (nên làm ngay một lần cho yên tâm — bản sao lưu chưa từng thử khôi phục thì chưa chắc dùng được)
```bash
bash ~/.openclaw/workspace/skills/second-brain/scripts/sao-luu-drive.sh khoi-phuc
```
*Đạt khi:* báo **ĐÃ TẢI VỀ + GIẢI MÃ … (N ghi chú, nguyên vẹn)**. File tải về nằm riêng (`khoi-phuc-<ngày>.sqlite`), kho đang dùng không bị đụng; xem xong có thể xoá file đó.

| Hiện tượng | Cách xử lý |
|---|---|
| `chưa có remote 'brain-mahoa'` | Làm lại 6.4, đặt đúng tên `brain-mahoa` |
| `không kết nối được Drive` | Token Google hết hạn: `rclone config reconnect gdrive:` rồi làm lại phần dán mã ở 6.3 |
| `không giải mã được` | Kết nối `brain-mahoa` đang dùng mật khẩu khác lúc sao lưu — tạo lại bằng **đúng 2 mật khẩu đã ghi** (ở 6.4 chọn **y** “type in my own password” thay vì **g**) |
| `Từ chối gửi dữ liệu chưa mã hoá` | Đang trỏ nhầm vào `gdrive`. Không đặt biến `SB_DRIVE_REMOTE`, hoặc đặt `SB_DRIVE_REMOTE=brain-mahoa` |
| `doctor` / `kiemtra.sh` báo bản trên Drive cũ quá 2 ngày | Chạy `sao-luu-drive.sh kiem` để xem nguyên nhân; nhật ký ở `~/.openclaw/workspace/second-brain/backups/drive.log` |

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

Script kiểm tra 5 phần:

**Phần 1 — Thư mục skill đã chép lên chưa.** Xem 4 thư mục có nằm đúng chỗ không. Hỏng ở đây nghĩa là `install.sh` chưa chạy hoặc chạy sai thư mục.

**Phần 2 — OpenClaw đã nhận chưa.** Chạy `openclaw skills list` rồi dò từng tên. Hỏng ở đây mà phần 1 đạt thì gần như chắc chắn là **quên restart**.

**Phần 3 — Công cụ đã cài chưa.** `pdftotext`, `pdftoppm`, `ffmpeg`, `ffprobe`, `pillow`, `python-pptx`.

**Phần 4 — Chạy thử thật.** Đây mới là phần quan trọng: nó **thật sự chạy** từng skill trên file tạm —

- `second-brain`: ghi một ghi chú rồi tìm lại bằng tiếng Việt có dấu
- `second-brain (duy trì kho)`: chạy `inbox`, `review`, `digest`, `stats`
- `second-brain (giữ dữ liệu)`: cất kho → lấy lại → xoá hẳn → khôi phục từ bản sao
- `second-brain (phân loại, nạp)`: nhóm phân cấp tự chuẩn hoá, nạp một file Markdown tách 2 mục, nạp lại thì bỏ trùng
- `second-brain (trang web)`: kiểm tra file giao diện và `server.py`
- `pdf-extract-crop`: tự tạo một PDF mẫu (không cần cài thêm gì), tìm chữ rồi cắt ảnh thật
- `css-video (khuôn hình)`: kiểm B-roll tự khớp khung video chính
- `css-video-production`: dựng một file phụ đề `.ass`
- `pptx-deck-builder`: dựng một file `.pptx` thật

**Phần 5 — An toàn.** Bốn việc:
- Không có file nào trong 4 skill mà user khác ghi được (nếu có, ai đó có thể sửa code mà Mây sẽ chạy).
- Kho ghi chú chỉ chủ sở hữu đọc được (quyền 600).
- Trang web Second Brain không mở cổng ra mọi địa chỉ (`0.0.0.0`).
- Lịch sao lưu hằng ngày đã bật (Bước 5).

Script chỉ đọc và thử trên file tạm, **không đụng vào dữ liệu của anh**.

### Hai bộ test sâu hơn (tuỳ chọn)

`kiemtra.sh` kiểm tra skill đã cài. Hai script dưới đây kiểm tra *bản thân phần mềm* — chạy khi anh nghi ngờ có lỗi, hoặc sau khi tôi gửi bản cập nhật:

```bash
bash test-brain.sh     # 123 trường hợp: tìm không dấu, ghi bằng giọng nói, sao lưu Drive mã hoá (khi có rclone), phân loại nhóm/loại, chống trùng y hệt, nạp nhiều nguồn (cả Word .docx, PDF), gộp các ghi chú trang, việc, kho rỗng, thẻ tiếng Việt, cất kho/xoá/lấy lại,
                       # file hỏng, ghi chú rất dài, biến môi trường gõ sai,
                       # trùng lặp tiếng Việt, quyền file của kho,
                       # bản sao .sqlite đầy đủ, doctor phát hiện/sửa chỉ mục lệch…
bash test-web.sh       # 79 trường hợp: lõi Bát Quái đúng Kinh Dịch, khí âm dương tiêu trưởng đúng chiều, thư viện, việc, nạp qua web (cả Word), ô Hỏi gọi openclaw agent đúng cách, mã truy cập, leo thư mục, chặn trang lạ gửi lệnh,
                       # chặn đọc trộm qua DNS rebinding, header bảo mật,
                       # đầu vào xấu, server có sống sót không…
```

Cả hai chạy trên kho tạm rồi tự xoá, **không đụng dữ liệu thật**. Kết quả phải là `HỎNG: 0`.

---

# PHẦN 4 — Thế nào là ĐẠT

### Kết quả phải ra

```
 ĐẠT: 27     CHƯA ĐẠT: 0

 Xong. Cả 4 skill đã sẵn sàng.
```

**27 mục đạt, 0 mục chưa đạt.** Có dòng CHƯA ĐẠT nào là chưa xong.

Con số có thể khác 27 trong hai trường hợp bình thường, không phải lỗi:

- **Ra 23 và phần 2 ghi "bỏ qua"** — script không tìm thấy lệnh `openclaw`, nên nó bỏ 4 mục của phần 2. Nghĩa là anh đang đăng nhập sai user. SSH lại bằng đúng user chạy OpenClaw rồi chạy lại.
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
| Phần 4 không dựng được `.pptx` | Chưa có `python-pptx` | `python3 -m pip install --user python-pptx pillow` |
| Không tìm thấy lệnh `openclaw` | Đang đăng nhập sai user | SSH lại bằng user đang chạy OpenClaw |
| Phần 5: file ai cũng ghi được | Chép tay bằng `cp` thay vì `install.sh`, hoặc umask lỏng | `chmod -R go-w ~/.openclaw/workspace/skills` |
| Phần 5: chưa có lịch sao lưu | Chưa làm Bước 5 | Dán khối lệnh ở Bước 5 |
| Phần 5: kho user khác đọc được | Kho tạo từ bản cũ | `python3 .../brain.py stats` (tự siết về 600) |
| Phần 5: cổng mở ra ngoài | Đã chạy trang web với `BRAIN_HOST=0.0.0.0` | `bash .../second-brain/scripts/web.sh stop` (hoặc `pkill -f second-brain/scripts/server.py`) rồi `web.sh start`, không đặt `BRAIN_HOST` |

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

**Test 2b — nhắc trùng.** Ghi thêm một ghi chú nói lại ý trên bằng câu khác:
> "Ghi lại: phụ đề không hiện là do mili giây viết bằng dấu phẩy, đổi sang dấu chấm là được."

*Đạt khi:* Mây báo kho đã có ghi chú gần giống và hỏi anh muốn gộp hay giữ cả hai.

**Test 3 — trang web.** Trên VPS:
```bash
bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh start
```
Nó in ra đường link có mã. Trên máy cá nhân, mở đường hầm SSH (Termius có mục Port Forwarding):
```bash
ssh -N -L 8787:127.0.0.1:8787 root@IP_VPS
```
Giữ cửa sổ đó mở, dán **đường link có mã** vào trình duyệt. Thử mở **http://127.0.0.1:8787** trong một cửa sổ ẩn danh (không có mã): phải thấy trang báo "cần mở bằng đường link có mã" — đó là đúng.

*Đạt khi:* thấy nền xanh dương, lõi **Thái Cực – Bát Quái** ở giữa (Càn ☰ ở trên, Khôn ☷ ở dưới; rê chuột vào lõi hiện tên 8 quẻ và phương vị), các ghi chú vừa ghi xoay quanh thành chấm có tên. Bấm một chấm phải mở ra nội dung đầy đủ. Bấm **Thư viện**: thấy cây vùng/nhóm bên trái kèm số ghi chú, bấm một nhóm thì chỉ hiện ghi chú của nhóm đó.

**Test 4 — phân loại.** Nói với Mây:
> "Ghi lại: quy trình lắp hệ lọc tổng gồm khảo sát nước, chọn cột lọc, lắp bypass, xả rửa 30 phút, bàn giao."

*Đạt khi:* Mây xếp vào loại **Quy trình**, nhóm kiểu `Kỹ thuật/Lọc nước` (hoặc hỏi anh nhóm nào), và báo nếu tạo nhóm mới. Nói lại **y hệt** câu đó lần nữa: Mây phải báo *đã có ghi chú này*, không lưu bản thứ hai.

**Test 5 — việc.**
> "Nhắc anh gọi chị Lan về bảo trì vào thứ sáu tuần này."

*Đạt khi:* Mây đọc lại **ngày cụ thể** của thứ sáu để anh xác nhận. Sau đó hỏi *"tuần này anh có việc gì?"* phải thấy việc đó. Trên web, chế độ **Việc** hiện nó đúng nhóm theo hạn.

**Test 6 — nạp tài liệu.** Tạo nhanh một file thử rồi nhờ Mây nạp:
```bash
printf '## Bài 1: Hero\nTiêu đề hero nói lợi ích trong 5 giây.\n\n## Bài 2: CTA\nMỗi trang một mục tiêu.\n' > ~/thu-nap.md
```
> "Nạp file ~/thu-nap.md vào kho, nhóm Học tập/Khoá học."

*Đạt khi:* Mây xem trước, báo **2 ghi chú**, nạp xong thấy chúng trong Thư viện › Học tập › Khoá học. Nhờ nạp lại lần nữa: phải báo *bỏ 2 bản trùng*.

### pdf-extract-crop

Tải một file PDF bất kỳ lên VPS rồi nói với Mây:
> "Trong file /root/catalogue.pdf, tìm giúp anh chữ 'HA1600' rồi cắt vùng đó ra thành ảnh."

*Đạt khi:* Mây trả về số trang tìm thấy (và có bao nhiêu chỗ khớp) cùng đường dẫn file ảnh đã cắt. Mở ảnh ra thấy đúng vùng chứa chữ đó.

### css-video-production

> "Tạo cho anh file phụ đề tiếng Việt cho đoạn này: 'Chào anh em, hôm nay mình nói về lọc nước tổng cho gia đình.'"

*Đạt khi:* ra file `.ass`, mở bằng `cat` thấy các dòng `Dialogue:` và **mili giây dùng dấu chấm** (`0:00:01.50`), không phải dấu phẩy.

### pptx-deck-builder

> "Làm cho anh bộ slide 5 trang giới thiệu dịch vụ lọc nước của công ty Phúc Khang."

*Đạt khi:* ra file `.pptx`, tải về mở bằng PowerPoint hoặc Google Slides thấy đủ 5 trang có nội dung, không lỗi font, **không có chữ tràn khỏi khung**, các ý có dấu đầu dòng. Mây phải hỏi anh số liệu thật trước khi vẽ biểu đồ — tự bịa số là không đạt.

### Bảng tóm tắt

| Skill | Test | Đạt khi |
|---|---|---|
| second-brain | Ghi rồi hỏi lại | Mây đọc đúng nội dung + dẫn mã ghi chú |
| second-brain | Tìm từ có dấu | Ra kết quả |
| second-brain | Mở trang web qua SSH tunnel | Thấy lõi Thái Cực – Bát Quái, bấm chấm mở được ghi chú |
| pdf-extract-crop | Tìm chữ + cắt ảnh | Ra file ảnh đúng vùng |
| css-video-production | Tạo phụ đề | File `.ass` có `Dialogue:`, mili giây dùng dấu chấm |
| pptx-deck-builder | Dựng slide | File `.pptx` mở được, đủ số trang |

---

# PHẦN 6 — An toàn: gói này làm gì và không làm gì

| Mục | Gói này làm gì / không làm gì |
|---|---|
| **Không cần** | `sudo` khi chép skill, khoá API, tài khoản, mở cổng firewall |
| **Không gửi ra ngoài** | Ghi chú, PDF, video, slide đều xử lý trên VPS. Ra Internet chỉ có: bản sao lưu Google Drive (Bước 6, tuỳ chọn) — **đã mã hoá trên VPS trước khi gửi**, Google không đọc được; `fetch_images.py` (tuỳ chọn, cần khoá Pexels); font chữ của trang web (Google Fonts) |
| **Kho ghi chú** | `notes.sqlite`, `backups/`, `deleted/` chỉ chủ sở hữu đọc được (600/700) — user khác trên VPS không đọc được |
| **Trang web** | Chỉ nghe `127.0.0.1` và **cần mã truy cập** (chương trình khác trên VPS cũng không đọc được kho); từ chối yêu cầu không gửi tới localhost (chống DNS rebinding), từ chối POST từ trang lạ (chống CSRF), không cho nhúng iframe, không có nút xoá hẳn; kết nối treo tự ngắt sau 30 giây |
| **Sao lưu** | VPS: hằng đêm `.json.gz` (giữ 60 bản) + bản `.sqlite` đầy đủ. Google Drive (Bước 6): mã hoá rclone crypt, giữ 90 ngày, chỉ chịu gửi qua kết nối mã hoá, quyền Google chỉ thấy file do nó tạo. `doctor` báo khi lịch sao lưu ngừng |
| **Ô Hỏi** | Chỉ gửi ~12 ghi chú liên quan (ghi chú dài: chỉ các đoạn khớp câu hỏi) cho `openclaw agent` trên chính VPS, qua file tạm quyền riêng — không nằm trên dòng lệnh; phiên riêng `second-brain`; dặn agent coi ghi chú là dữ liệu, không làm theo câu lệnh nằm trong ghi chú |
| **Video** | Từ chối khi file kết quả trùng file gốc — không bao giờ ghi đè video gốc |
| **Slide** | Ảnh tải từ link chỉ nhận https, máy chủ công khai, ≤ 15 MB; kiểm lại cả khi bị chuyển hướng (không lọt vào mạng nội bộ/metadata VPS) |

Những điều anh cần tự giữ:
1. **Không** đặt `BRAIN_HOST=0.0.0.0`. Xem trang web qua đường hầm SSH. Đường link có mã là chìa khoá kho — đừng dán vào nhóm chat.
2. **Không** ghi mật khẩu, token, số thẻ vào ghi chú — file SQLite không mã hoá.
3. Giữ kỹ **2 mật khẩu mã hoá** của sao lưu Drive (Bước 6) — mất là không giải mã được bản trên Drive.
4. Khoá Pexels (nếu dùng) để trong `~/.openclaw/secrets/pexels.env` với quyền 600: `chmod 600 ~/.openclaw/secrets/pexels.env`.

---

# PHẦN 7 — Tốn RAM, CPU, ổ đĩa, swap bao nhiêu?

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

Ba skill còn lại không sinh dữ liệu — chúng đọc file anh đưa, ghi kết quả ra rồi thôi. File tạm (ảnh cắt khi dựng slide) tự xoá sau mỗi lần chạy. Tìm chữ trong catalogue PDF 300 trang mất khoảng 0,1 giây. Nhưng `ffmpeg` nếu phải cài thì kéo theo khoảng **300 MB** thư viện hệ thống. Đó là phần nặng nhất của cả gói, và chỉ cài một lần.

### RAM

| Lúc nào | Tốn bao nhiêu |
|---|---|
| Không ai dùng | **0 MB** — không có tiến trình nào chạy |
| Mây ghi/tìm một ghi chú | **~18 MB**, trong vòng dưới 0,1 giây rồi thoát |
| Trang web đang chạy (kho 2.000 ghi chú) | **28 MB**, đứng yên không tăng |
| Lệnh `duplicates` quét cả kho | **~27 MB** |

28 MB là mức của trang web, đo sau 20 lượt gọi API vẫn y nguyên — không rò rỉ bộ nhớ. VPS 1 GB chạy thoải mái.

### CPU

| Việc | Thời gian |
|---|---|
| Thêm một ghi chú (có chống trùng, chuẩn hoá nhóm) — kho 10.000 ghi chú | 0,11 giây |
| Tìm kiếm trong 10.000 ghi chú | 0,08-0,11 giây |
| Lọc theo nhóm + loại, cây nhóm, danh sách việc — kho 10.000 | 0,1-0,15 giây |
| `duplicates` quét cả 10.000 ghi chú | 1,4 giây |
| `doctor` khám kho 10.000 ghi chú | 0,26 giây |
| `snapshot` kho 10.000 ghi chú (8 MB) | 0,9 giây |
| `stats` | 0,05 giây |
| `digest --days 7` | 0,41 giây |
| `duplicates` quét cả 2.000 ghi chú | 0,24 giây |
| Trang web trả danh sách 2.000 ghi chú | 0,02 giây |

Trang web khi không ai thao tác: **0% CPU**. Nó nằm chờ kết nối, không quét gì theo chu kỳ.

### Swap

**Không đụng tới.** Mức RAM cao nhất đo được là 28 MB — VPS nào cũng còn thừa chừng đó, máy không cần tráo ra swap. Nếu VPS của anh đang swap nhiều thì nguyên nhân nằm ở chỗ khác (n8n giữ nhiều execution là thủ phạm quen thuộc), không phải mấy skill này.

### Muốn kiểm chứng

```bash
# RAM trang web đang dùng
bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh status

# dung lượng toàn bộ kho
du -sh ~/.openclaw/workspace/second-brain/

# tải máy chung
free -h
top -bn1 | head -5
```

### Khi nào cần để mắt

Kho vượt khoảng **10.000 ghi chú** thì xem lại dung lượng sao lưu (~150 MB với 60 bản; giảm bằng `SECOND_BRAIN_KEEP_BACKUPS`). Tốc độ vẫn ổn: đo thật ở 10.000 ghi chú, mọi thao tác hằng ngày dưới 0,2 giây. Với nhịp ghi vài ghi chú mỗi ngày, mốc đó cách đây nhiều năm.

Trang web nếu quên tắt sẽ chạy mãi với ~28 MB RAM (không sao, nhưng không cần). Xem và tắt:
```bash
bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh status
bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh stop
```
