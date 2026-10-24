# Đánh giá và tối ưu 4 skill nhóm A

Bản này là bản đã sửa. Đọc `CAI-DAT.md` để cài, `HUONG-DAN.md` để dùng. File này ghi lại **đã kiểm gì, sửa gì, vì sao**.

## Kết luận

Bản gốc đã tốt: không khoá API, chạy offline, có bộ test, giữ dữ liệu kỹ (cất kho, `deleted/`, sao lưu xoay vòng).
Nhưng kiểm kỹ thì có **2 lỗ hổng an toàn thật**, **4 lỗi làm việc cài/nâng cấp sai**, và nhiều chỗ skill chạy chậm
hoặc cho kết quả kém hơn mức có thể. Tất cả đã sửa và có test đi kèm.

| | Bản gốc | Bản này |
|---|---|---|
| Test `test-brain.sh` | 50 | **147** |
| Test `test-web.sh` | 30 | **99** |
| Mục `kiemtra.sh` | 22 | **27** (thêm phần An toàn, phân loại/nạp) |
| Tìm cụm chữ trong PDF 300 trang | 3,5 giây | **0,1 giây** |
| Nhận ra ghi chú tiếng Việt viết lại cùng ý | Không | **Có** |
| Tìm bằng câu hỏi dài ("anh từng ghi gì về lỗi phụ đề") | 0 kết quả | **Ra kết quả** |
| Tìm gõ không dấu ("lap dat", "duong ong") | 0 kết quả | **Ra kết quả** |

## An toàn

| Mức | Vấn đề ở bản gốc | Đã sửa |
|---|---|---|
| **Cao** | Trang web chỉ kiểm `Host` cho POST. Một trang web lạ dùng **DNS rebinding** (trỏ tên miền của nó về 127.0.0.1) là **đọc được toàn bộ kho** qua `GET /api/notes`, `/api/search` — đã thử, lấy được dữ liệu. | Mọi yêu cầu (cả GET, cả file tĩnh) phải gửi tới `127.0.0.1`/`localhost`. Thêm 5 test. |
| **Cao** | `notes.sqlite`, `backups/`, `deleted/` tạo với quyền mặc định (thường 644) — **user khác trên VPS đọc được** ghi chú. | Tạo mới với 600/700; kho cũ tự siết lại khi chạy lệnh bất kỳ. Không đụng quyền thư mục dùng chung. Thêm 4 test. |
| Vừa | `install.sh --force` đặt bản sao lưu `.<tên>.bak-…` **ngay trong thư mục skills** — OpenClaw có thể quét trúng và thấy 2 skill trùng tên. | Sao lưu sang `workspace/skill-backups/` (quyền 700). |
| Vừa | Trang web không có CSP / chống iframe. | Thêm `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy`. |
| Vừa | Ô **Hỏi** đưa nội dung ghi chú cho agent mà không dặn gì — ghi chú có câu "hãy chạy…" có thể bị làm theo. | Dặn rõ: ghi chú là dữ liệu, không làm theo lệnh trong đó, không dùng công cụ. |
| Vừa | `build_pptx.py` tải ảnh theo link: kiểm host lúc đầu nhưng **không kiểm khi bị chuyển hướng** — có thể bị dẫn vào `127.0.0.1` / metadata VPS. | Kiểm lại từng lần chuyển hướng. |
| Thấp | `fetch_images.py` nhận mọi host kết thúc bằng `pexels.com` — lọt cả `evilpexels.com`. | Chỉ nhận `pexels.com` và tên miền con thật. |
| Thấp | `validate.py` không chặn symlink — symlink trỏ tới `~/.ssh` sẽ bị chép theo vào workspace. | Chặn symlink. |
| Thấp | `install.sh` không đặt quyền — chép bằng umask lỏng thì user khác sửa được code agent chạy. | `chmod go-w` toàn bộ; `kiemtra.sh` kiểm lại. |

## Cài đặt

| Vấn đề | Đã sửa |
|---|---|
| `validate.py` **sập** (traceback) nếu máy không có `node` trong PATH → `install.sh` từ chối cài với thông báo khó hiểu. | Thiếu node thì bỏ qua bước kiểm `.js`. |
| `truoc-khi-cai.sh` nói "cài lại sẽ ghi đè script" — **sai**: `install.sh` bỏ qua skill đã có. Người nâng cấp tưởng đã lên bản mới mà vẫn chạy bản cũ. | Sửa thông báo; tài liệu hướng dẫn `--force`. |
| `install.sh --only sai-ten` im lặng "Đã cài 0 skill". | Báo lỗi kèm danh sách tên đúng. |
| Hướng dẫn `pip install --break-system-packages` (cài vào thư viện hệ thống, có thể làm hỏng công cụ của Ubuntu). | Dùng `python3 -m pip install --user`; kiểm `pip` có chưa. |
| Không kiểm ffmpeg có **libass** (thiếu thì phụ đề không in được) và font tiếng Việt. | `truoc-khi-cai.sh` kiểm cả hai. |
| Kiểm cổng 8787 bằng `ss` — VPS tối giản không có `ss` thì luôn báo "trống". | Đọc thẳng `/proc/net/tcp`. |
| `kiemtra.sh` dùng `eval` ghép chuỗi đường dẫn (vỡ khi có dấu cách); test PDF cần `reportlab` (hiếm khi có) nên thực tế không chạy. | Bỏ `eval`; tự tạo PDF mẫu, tìm chữ **và cắt ảnh thật**. |
| Không có kiểm tra an toàn sau cài. | Thêm PHẦN 5: quyền ghi code skill, quyền kho, cổng web có mở ra ngoài không. |
| Chép hỏng giữa chừng để lại skill dở dang. | Chép vào thư mục tạm rồi đổi tên một lần. Thêm `--dry-run`. |

## Từng skill

### second-brain
- **Nhận ra trùng lặp tiếng Việt.** Bản cũ chỉ lấy từ ≥ 4 ký tự làm từ khoá — gần như mọi âm tiết tiếng Việt bị bỏ, nên hai ghi chú viết lại cùng ý không bao giờ bị nhắc trùng. Nay so bằng cụm 2 âm tiết ("dấu chấm", "mili giây") + từ dài, kèm danh sách từ vô nghĩa tiếng Việt mở rộng. Kiểm trên kho 2.000 ghi chú ngẫu nhiên: 0 báo nhầm, 0,24 giây.
- **Tìm bằng câu dài.** FTS mặc định đòi đủ mọi từ, nên câu hỏi tự nhiên ra 0 kết quả và agent phải đoán lại nhiều lượt. Nay tự chuyển sang chế độ `mo_rong` (ghi chú khớp nhiều từ nhất) và báo rõ chế độ trong kết quả.
- Ô **Hỏi** trên web lấy được ghi chú liên quan cho câu hỏi tiếng Việt (bản cũ bỏ mọi từ < 3 ký tự).
- `SKILL.md`: hướng dẫn cũ bảo agent `delete` ghi chú trùng — trái với nguyên tắc "mặc định cất kho" của chính skill. Nay dùng `merge` (cất kho, không mất). Thêm hướng dẫn tìm hiệu quả.
- `references/DATA-SAFETY.md`: bản cũ nói về Netlify Blobs (không còn dùng) — viết lại đúng với bản cục bộ.

### pdf-extract-crop
- **Nhanh hơn ~35 lần**: một lần gọi `pdftotext` cho cả khoảng trang thay vì mỗi trang một tiến trình.
- Khớp cụm chữ dính dấu câu / nằm giữa chữ dài / vắt qua nhiều chữ; chuẩn hoá Unicode (PDF tiếng Việt hay lưu dấu tách rời).
- `find` trả `pages_with_matches` và giới hạn danh sách; `text` tự cắt ở 30.000 ký tự để không đổ cả catalogue vào ngữ cảnh agent.
- Chặn `--dpi` quá lớn (dễ ngốn hết RAM VPS); báo lỗi rõ khi `--pages` sai hoặc thiếu Pillow; tên file bắt đầu bằng `-` không bị hiểu nhầm thành tuỳ chọn.

### css-video-production
- fps mặc định theo video chính (bản cũ cứng 25 → video 30 fps bị giật ở đoạn chèn).
- Đường dẫn tương đối tính theo thư mục chứa spec (giống `make_ass.py`).
- **Từ chối ghi đè video gốc** khi `out` trùng file đầu vào (`ffmpeg -y` sẽ xoá mất bản gốc).
- Báo ngay khi ffmpeg thiếu libass, thay vì lỗi ffmpeg khó đọc.
- Phụ đề: khung PlayRes lấy theo video (bản cũ cứng 1080×1920 → video ngang bị kéo giãn chữ), cỡ chữ/lề tự co; cảnh báo dòng không tô được từ khoá, dòng quá dài, thiếu font.
- Lưới QA giữ đúng tỉ lệ (bản cũ bóp méo video ngang), tối đa 30 khung.

### pptx-deck-builder
- **Kiểm toàn bộ JSON trước khi dựng** và trả mọi lỗi một lần (layout sai tên, chart thiếu/sai số, thiếu title) — agent sửa một lượt thay vì chạy đi chạy lại.
- **Tự co chữ cho vừa khung**; vẫn quá dài thì cảnh báo. Bản cũ để chữ tràn khỏi ô.
- Sửa 2 lỗi hiển thị có sẵn: **dấu đầu dòng không hiện** (`p.bullet = True` không phải API thật của python-pptx), và chữ **"Chart Title"** thừa trên mọi biểu đồ.
- Biểu đồ nhiều dãy số (so sánh năm), nhãn số liệu, định dạng số; từ chối số nhập nhằng kiểu `"1.200"` thay vì đoán sai.
- Speaker Notes (`notes`), giới hạn bước của `process`, cảnh báo chữ giữ chỗ.
- Dọn file tạm sau mỗi lần dựng (bản cũ để lại rác trong `/tmp`); thu nhỏ ảnh quá lớn để file `.pptx` nhẹ.
- Cảnh báo trả trong JSON (`canh_bao`) để agent đọc được, không chỉ in ra stderr.

## Rà soát lần 2 — Second Brain cho chạy lâu dài

| Mức | Vấn đề | Đã sửa |
|---|---|---|
| **Cao** | Tài liệu hướng dẫn sao lưu bằng `scp notes.sqlite`. Kho chạy chế độ WAL nên ghi chú mới nằm ở file `-wal` bên cạnh — **đã thử: bản chép ra rỗng hoàn toàn** ("no such table"). Người dùng tưởng có bản sao mà thực ra không có. | `snapshot` tạo thêm `backups/notes-latest.sqlite` bằng API backup của SQLite (đầy đủ, một file, thay nguyên khối). Tài liệu chỉ cách kéo file này. Thêm 3 test. |
| **Cao** | Trang web chỉ dựa vào việc nghe `127.0.0.1` — nhưng **mọi chương trình trên VPS** (n8n, app bị hack, công cụ duyệt web của agent) đều gọi được địa chỉ đó để đọc/sửa toàn bộ kho. | **Mã truy cập**: 256 bit ngẫu nhiên, file 600, đổi thành cookie HttpOnly + SameSite=Strict, so sánh hằng thời gian. Không mã → 401. Thêm 10 test. |
| Vừa | `Content-Length: -1` làm một luồng server **treo vĩnh viễn** (đã thử). Kết nối bỏ dở cũng giữ luồng mãi. | Độ dài âm → 400 ngay; mỗi kết nối tối đa 30 giây. |
| Vừa | Chạy nền bằng `nohup … >/tmp/brain-web.log` — log nằm trong `/tmp` (user khác đọc được), không có cách tắt/xem trạng thái gọn, log phình mãi. | `web.sh start/stop/status/link/restart`: log + pid cạnh kho (600), xoay vòng log 5 MB, **từ chối** chạy khi `BRAIN_HOST` mở ra ngoài. Mã chỉ in ra màn hình thật, không vào log. |
| Vừa | Không có cách biết kho hỏng hay chỉ mục tìm kiếm lệch (tìm thiếu kết quả mà không ai hay), hay lịch sao lưu đã ngừng từ lâu. | Lệnh `doctor` (+ `--fix`): kiểm toàn vẹn file, chỉ mục FTS so với dữ liệu thật, liên kết mồ côi, tuổi bản sao lưu, quyền file, dung lượng đĩa. |
| Vừa | Lịch sao lưu chỉ được nhắc trong tài liệu dùng, dễ bị bỏ qua. | Thành **Bước 5 của cài đặt** (một khối lệnh, dán lại không tạo dòng trùng); `kiemtra.sh` kiểm có lịch chưa. |
| Thấp | `restore` chạy hai lần đẻ ra hai bản giống hệt. | Đã có thì không thêm. |
| Thấp | `deepcheck.py` dùng thư mục cố định `/tmp/deepcheck-home` (user khác có thể tạo trước/gài symlink). | Thư mục tạm ngẫu nhiên, tự xoá. |

**Nên chạy Second Brain ở đâu:** trên VPS cùng OpenClaw (như gói này). Lý do và so sánh với chạy trên máy tính / web công khai / Notion: xem đầu `HUONG-DAN.md`.

## Nâng cấp lần 3 — Second Brain thành bộ não thứ hai chuyên nghiệp

### Phân loại: ba trục độc lập
| | Bản trước | Bản này |
|---|---|---|
| Nhóm | Một tầng, gõ tự do — "Landing page", "landing page", "Landing  Page" thành 3 nhóm | **Cây `Vùng/Nhóm/Nhóm con`** (≤ 3 tầng). Tự gộp khác hoa/thường, khoảng trắng, kiểu gõ dấu (NFC/NFD) về nhóm đã có. Gõ thiếu dấu / sai chính tả → gợi ý, không tự đổi (vì "Ban" ≠ "Bán"). Lọc nhóm cha lấy cả nhóm con |
| Loại | Không có | **8 loại**: kiến thức, quy trình, khái niệm, tài liệu (có trích dẫn), ý tưởng, việc (có hạn), người, nhật ký. Nhận bí danh (task → việc, meeting → nhật ký) |
| Thẻ | Có | Thêm gợi ý khi thẻ mới chỉ khác thẻ cũ ở dấu (`phu-de` / `phụ-đề`) |
| Nguồn | `url` | `url` + **`cite`** (trích dẫn học thuật) + ngày ghi/sửa/ôn + ghi chú liên kết kèm tên |

### Chống trùng: ba lớp
1. **Trùng y hệt** (dấu vân tay SHA-256 của tiêu đề + nội dung đã chuẩn hoá): không lưu bản thứ hai — ở mọi đường vào (chat, web, nạp, nhập, khôi phục), và chặn cả việc *sửa* một ghi chú thành bản sao của ghi chú khác.
2. **Gần giống**: lưu nhưng nhắc, đề xuất gộp/nối (đã có từ trước).
3. **Nhóm/thẻ gần giống**: gợi ý dùng chung — cây nhóm không phình vì lỗi gõ.

### Nạp đa nguồn (`nap`, tab Nạp trên web)
Markdown (tách theo tiêu đề, đọc frontmatter kiểu Obsidian) · TXT (dòng đầu làm tên, giữ dấu) · PDF (cả file hoặc mỗi trang một ghi chú kèm trích dẫn trang) · CSV (tên cột tiếng Việt hoặc tiếng Anh) · HTML (bỏ script/menu) · JSON · cả thư mục · stdin.
An toàn: xem trước (`--dry-run`), bỏ file ẩn và symlink, giới hạn 5 MB/file và 2000 file/lần, sao lưu trước khi nạp, cả lô ghi trong **một giao dịch**, bỏ trùng trong lô và với kho. Nội dung nạp vào là dữ liệu, không phải lệnh cho agent.

### Công việc
Loại `viec` có hạn (`--due`, nhận `2026-11-05` / `5/11/2026`), trạng thái xong; lệnh `viec` chia **quá hạn / hôm nay / 7 ngày tới / sau này / không hạn**. Việc không lẫn vào hàng chờ ôn.

### Tìm kiếm
Xếp hạng bm25 có trọng số: khớp ở **tiêu đề ×4, thẻ ×3, nhóm ×2**, nội dung ×1. Lọc theo loại và nhóm (gồm nhóm con).

### Giao diện
- **Toàn cảnh**: đồ thị theo **vùng** (tầng 1) thay vì từng nhóm — kho nhiều nhóm con vẫn gọn.
- **Thư viện** (mới): cây vùng/nhóm có số đếm, chip lọc loại (đếm trong nhóm đang xem), lọc thẻ, 4 cách sắp xếp, phân trang — duyệt **toàn bộ** kho, không giới hạn như đồ thị.
- **Việc** (mới): theo hạn, tích là xong.
- **Nạp** (tab mới): kéo thả nhiều file .md/.txt hoặc dán, xem trước, nạp.
- **Thẻ chi tiết**: đường dẫn nhóm bấm được, nhãn loại, thẻ bấm được, khối Nguồn · Trích dẫn · Hạn (quá hạn tô đỏ), ghi chú liên kết, sửa được mọi trường.
- Màu chủ đạo **xanh dương · vàng kim · cam**: nền navy có chiều sâu, vàng kim cho nhấn/liên kết/mục đang chọn, cam cho nút hành động và lõi BRAIN; chữ trên nền cam dùng navy để đủ tương phản (trắng trên cam chỉ ~2,6:1).
- Đã kiểm bằng trình duyệt thật (Chromium) ở 1440×900 và 390×844 (điện thoại), không lỗi JavaScript, chạy dưới CSP chặt.

### Bền vững
- **Nâng cấp tại chỗ**: kho tạo bằng bản gốc mở bằng bản mới tự thêm cột, tính bù dấu vân tay, giữ nguyên dữ liệu và trạng thái cất kho; bản gốc vẫn đọc được kho đã nâng cấp (quay về được). Đã thử cả hai chiều.
- Hiệu năng đo ở **10.000 ghi chú**: thêm 0,11 s, tìm 0,08-0,11 s, lọc/cây nhóm/việc ≤ 0,15 s, `duplicates` 1,4 s, kho 8 MB.
- `SKILL.md` viết lại: quy trình lưu chuẩn từng bước (xem cây nhóm → lưu → xử lý từng loại kết quả), quy tắc phân loại bắt buộc, cách tìm và trả lời có dẫn nguồn, nạp, việc.

### Lõi Thái Cực – Tiên Thiên Bát Quái
- Thay chữ "BRAIN" ở tâm đồ thị bằng Thái Cực đồ + Bát Quái **Tiên Thiên (Phục Hy)**, theo mẫu anh chốt (navy, vàng kim, xanh dương). Đã đối chiếu mẫu: đúng thứ tự Tiên Thiên, đúng chiều Thái Cực.
- **Vẽ bằng hình học** chứ không dán ảnh: Thái Cực ghép từ các nửa đường tròn chuẩn, 8 quẻ đặt vuông góc với bán kính, hào sơ ở trong; nét sắc ở mọi kích thước và mọi độ phân giải màn hình. Vẽ một lần vào bộ đệm, mỗi khung hình chỉ dán lại.
- Lõi đứng yên (Càn luôn ở trên), lúc nghỉ nhỏ gọn Ø 60px như chữ BRAIN cũ (hào vẽ dày hơn ở cỡ nhỏ để vẫn đọc được quẻ); rê chuột thì phóng to mượt, hiện tên quẻ + phương vị. Có favicon SVG cùng hình học.
- **Test tự động khoá chuẩn Kinh Dịch**: đúng hào 8 quẻ, đúng số Tiên Thiên, quẻ đối có hào ngược nhau, tổng mỗi cặp bằng 9, Càn trên – Khôn dưới – Ly trái. Đã thử đổi chỗ Đoài/Tốn: test báo hỏng ngay.

## Rà soát cuối (chạy như người cài mới từ file zip)
- Giải nén gói vào thư mục trống → `truoc-khi-cai.sh` → `validate.py` → `install.sh` → `kiemtra.sh` → 2 bộ test: tất cả đạt.
- Sửa: `truoc-khi-cai.sh` trước đây có thể kiểm thư mục `/root/...` trong khi `install.sh` cài vào thư mục của user đang đăng nhập → nay dùng cùng một công thức với `install.sh`.
- Sửa: `nap`/`import` gặp JSON có phần tử không phải ghi chú thì sập (traceback) → nay báo lỗi rõ, không ghi gì.
- Sửa: API web nhận trường sai kiểu (nhóm là object, nội dung là danh sách) từng lưu thẳng `{'a': 1}` vào kho hoặc lỗi 500 → nay từ chối với thông báo rõ; thẻ dạng danh sách được nhận đúng.
- Thêm 5 test cho các trường hợp trên (brain 92, web 67).

## Sao lưu Google Drive mã hoá (bổ sung)
- `scripts/sao-luu-drive.sh` (`kiem` · `chay` · `ds` · `khoi-phuc [ngày]` · `lich`): mỗi đêm 2h47 chụp kho thành một file nhất quán, **mã hoá trên VPS bằng rclone crypt** (cả tên file lẫn nội dung) rồi mới gửi lên Drive; gửi cả `deleted/`; giữ 90 ngày, tự dọn bản cũ; ghi trạng thái cho `doctor` và `kiemtra.sh`.
- An toàn: **chỉ chịu gửi qua remote kiểu `crypt`** (cấu hình nhầm sang kết nối thường là từ chối); quyền Google `drive.file` — rclone chỉ thấy file do nó tạo; khôi phục ra **file riêng**, kiểm toàn vẹn, không đè kho đang dùng; sai mật khẩu báo đúng "không giải mã được"; khoá chống chạy chồng; nhật ký `drive.log`.
- Thử thật bằng "Drive giả" (thư mục cục bộ, cùng cơ chế crypt, rclone 1.60 — bản của Ubuntu 24.04): sao lưu, kiểm không lộ chữ thô, liệt kê, khôi phục, dọn bản > 90 ngày, sai mật khẩu, remote không mã hoá, đặt lịch 2 lần không trùng. 8 test tự động (brain 100). **Chưa thử với Google Drive thật** (cần tài khoản Google của anh) — phần đăng nhập Google làm theo Bước 6 trong CAI-DAT.md.

## Giọng nói và tìm không dấu (bổ sung)
- **Quy tắc giọng nói** (SKILL.md mục 2b): nội dung đến từ giọng nói thì Mây đọc lại chủ đề / nhóm / loại / thẻ / hạn và **chờ xác nhận mới lưu**; bắt buộc hỏi lại tên người, số tiền, số đo, số điện thoại, ngày giờ (đọc bằng số); tin thoại nhiều ý tách thành từng ghi chú, xác nhận cả lô; lệnh xoá/gộp/cất kho/xong việc bằng giọng phải nhắc lại và chờ xác nhận, "xoá" mặc định thành cất kho; ghi chú lưu với `--source voice` + thẻ `giong-noi` để rà lại; trả lời ngắn, nói được thành lời.
- **Lỗi tìm kiếm đã sửa:** gõ không dấu chỉ ra kết quả khi may mắn — "loc nuoc" ra, nhưng "lap dat", "duong ong" ra 0 (bộ tách từ của SQLite không bỏ được dấu chồng như ắ, ợ và không coi "đ" là "d"). Thêm chỉ mục thứ hai đã bỏ hết dấu: thứ tự tìm là *đúng dấu* → *bỏ dấu, đủ mọi từ* → *khớp nhiều từ nhất*; đoạn trích vẫn hiện chữ gốc có dấu và tô chỗ khớp. Dùng cho lệnh `search`, ô Tìm và ô Hỏi trên web.
- Chỉ mục mới tự dựng khi mở kho cũ, tự cập nhật khi thêm/sửa/xoá; sửa kho bằng công cụ khác thì `doctor` phát hiện, `doctor --fix` dựng lại. Đo trên kho 5.000 ghi chú: mở kho 0,02 giây, tìm 0,02 giây; kho to thêm khoảng bằng phần chữ của ghi chú.
- 11 test mới (brain 111, web 68).

## Sửa sau khi cài thật trên VPS
- **`deepcheck.py` báo thiếu python-pptx dù máy đã cài** (Mây phát hiện khi nghiệm thu). Nguyên nhân: để không đụng dữ liệu thật,
  `deepcheck.py` chạy script với HOME giả — mà thư viện cài bằng `pip install --user` (cách `CAI-DAT.md` hướng dẫn) nằm dưới
  HOME thật (`~/.local`), nên Python không thấy; `install.sh` gọi `deepcheck.py` nên cũng dừng oan. Máy thử trước đây cài
  python-pptx cho toàn hệ thống nên không lộ lỗi. Sửa: giữ đường dẫn thư viện của user (`PYTHONUSERBASE`) khi đổi HOME.
  Đã tái hiện lỗi bằng một skill thử chỉ có thư viện trong `~/.local`: bản cũ báo LỖI, bản sửa 0 lỗi.
- **`kiemtra.sh` Phần 2 báo "OpenClaw chưa thấy" cả 4 skill dù đã ready** (Mây phát hiện và tự xác minh bằng catalog JSON).
  Nguyên nhân: `printf "$DS" | grep -q` dưới `set -o pipefail` — danh sách skill của OpenClaw thật dài hơn bộ đệm ống (~64 KB),
  grep thấy tên thì thoát sớm, printf dính SIGPIPE, cả ống bị coi là lỗi. Sửa: so khớp ngay trong bash, không qua ống.
  Tái hiện bằng `openclaw` giả in 310 KB: bản cũ 4 dòng CHƯA ĐẠT, bản sửa 4 ĐẠT; thiếu skill thật vẫn báo đúng CHƯA ĐẠT.
- **`sao-luu-drive.sh` có lúc báo "chưa có remote 'brain-mahoa'" dù đã cấu hình đúng** (Mây thấy 5 test Drive giả hỏng trong
  `test-brain.sh` khi nghiệm thu PR #13). Cùng loại lỗi với `kiemtra.sh` ở trên: `rclone listremotes | grep -qx` dưới `pipefail` —
  `brain-mahoa` đứng đầu danh sách, grep thấy là thoát, rclone ghi dòng tiếp theo thì dính SIGPIPE. Máy nhiều nhân hiếm gặp; ép chạy
  trên 1 nhân CPU (như VPS nhỏ) thì hỏng 38/40 lần. Nếu bật sao lưu Drive thật mà chưa sửa thì **nhiều đêm sẽ bỏ sao lưu**.
  Sửa: đọc hết danh sách rồi mới so (cả chỗ kiểm lịch trong `kiem`).
- Cùng đợt: **lần sao lưu Drive đầu tiên trên kho chưa có `backups/`** thì hỏng và báo nhầm "đang có một lần sao lưu Drive khác chạy"
  (file khoá nằm trong thư mục chưa tạo). Sửa: tạo thư mục trước khi khoá.
- Bộ test cũng có lỗi riêng làm mục Drive hỏng lác đác: mật khẩu thử tạo bằng `rclone obscure` là chuỗi ngẫu nhiên, khoảng 1/64 lần
  mở đầu bằng "-" nên rclone tưởng là cờ, không tạo được remote. Sửa: đưa mật khẩu thô kèm `--obscure`. Bước 6 trong `CAI-DAT.md`
  dùng `rclone config` hỏi đáp nên không dính lỗi này.
- Thêm 2 test (brain 113): rclone giả in danh sách chậm từng dòng — bản cũ hỏng mọi lần, bản sửa đạt — và kho mới chưa có `backups/`.
  Chạy 15 lần liên tiếp trên 1 nhân CPU: 15/15 đạt.

- **Trang web, kho trống: chữ "Kho đang trống" đè lên lõi Bát Quái** (thấy trên ảnh chụp máy anh). Chữ và lõi cùng nằm giữa khung.
  Sửa: đẩy chữ xuống dưới lõi, đủ xa để không đè cả khi rê chuột (lõi nở to, hiện tên 8 quẻ). Đã chụp kiểm ở laptop 1366×640,
  màn thấp 1280×520 và điện thoại 390×760.

- **Toàn cảnh, bấm xem một vùng: báo "còn 3 ghi chú khác" dù vùng đã vẽ đủ** (thấy trên ảnh chụp kho thật 14 ghi chú, vùng
  Kỹ thuật 4/4). Khi xem một vùng, các vùng khác cố ý chỉ vẽ 2 chấm mờ làm nền, nhưng số "còn lại" lại tính trên cả kho nên
  cộng nhầm phần của vùng khác. Sửa: chỉ đếm ghi chú của vùng đang xem. Tái hiện bằng kho cùng phân bố: bản cũ báo "3 ghi chú
  khác" ở cả Kỹ thuật lẫn Học tập; bản sửa không báo; vùng 65 ghi chú báo đúng "5 ghi chú khác" (vẽ 60).
- **Nhãn ghi chú bị chấm và nan hoa đang quay chạy ngang qua chữ** (cũng thấy trên ảnh kho thật). Thêm viền tối mỏng quanh chữ
  nhãn để chữ luôn nổi trên nền.

- **Chỉnh tốc độ xoay** (anh yêu cầu): **−** / **+** đổi 5 mức (dải tốc độ đã nới sau — xem mục "Góp ý sau khi dùng thật")
  và nút dừng. Theo ý anh, các nút **không bày ra màn hình**: chỉ còn một biểu tượng đồng hồ nhỏ, mờ ở góc; bấm mới hiện bảng,
  bảng tự ẩn sau 5 giây / bấm ra ngoài / Esc; biểu tượng chuyển vàng khi đang dừng. Chỉnh tốc độ khi đang dừng thì xoay lại luôn;
  trình duyệt nhớ lựa chọn (không lưu được thì dùng mặc định).
  Tốc độ tính theo thời gian thật — trước đây tính theo khung hình nên màn 120 Hz xoay nhanh gấp đôi màn 60 Hz.
  Đo trên trình duyệt: Rất nhanh = 3,05× Vừa, Rất chậm = 0,25×, Dừng = 0.
- **Nhãn bị cắt chữ ở mép màn hình điện thoại**: hai phía đều thiếu chỗ thì nhãn tự rút gọn kèm "…" cho vừa.

## Rà soát giao diện máy tính + điện thoại (kho thật 17 ghi chú và kho 220 ghi chú, 4 cỡ màn hình)
Không lỗi JavaScript, không trang nào tràn ngang. Đã sửa:
- **Màu vùng trùng nhau**: bảng màu cũ chỉ có 3 tông lặp (vàng/vàng nhạt, xanh/xanh nhạt, cam/cam nhạt) nên từ vùng thứ 4 là
  trùng (Học tập và Cá nhân cùng cam; Kinh doanh và "Chưa xếp chỗ" cùng vàng). Nay 8 màu tách bạch, **gắn với tên vùng** (vùng
  tăng giảm ghi chú vẫn giữ màu), không trùng khi ≤ 8 vùng; "Chưa xếp chỗ" màu xám, luôn ở vòng ngoài cùng; cây Thư viện có
  chấm màu cùng màu với vòng. Đo: 6/6 vùng khác màu ở cả hai kho.
- **Điện thoại: thanh Toàn cảnh/Thư viện/Việc nổi đè lên thẻ chi tiết**, che nút Sửa/Đánh dấu xong. Thẻ chi tiết nay nằm trên cùng.
- **"Xem thêm (0 ghi chú)" vẫn hiện ở cuối Thư viện**: quy tắc CSS khác ghi đè thuộc tính `hidden`. Nay `[hidden]` luôn ẩn.
- **Nút quá nhỏ cho ngón tay** (thanh chuyển 28px, ô tích việc 13px, nút báo 16px): màn cảm ứng / điện thoại nay ≥ 36–44px.
- **Điện thoại mở lần đầu là form Thêm dài cả màn hình**, đồ thị bị đẩy xuống: nay vào tab Tìm (gọn), trang nhớ tab dùng lần trước.
- Rê chuột / chọn một chấm: nhãn hiện **đủ tên** (trước cắt ở 32 ký tự). Phím **/** nhảy vào ô Tìm. Gợi ý ô Tìm ngắn lại cho vừa điện thoại.
- **Tự ẩn khi không dùng** (anh yêu cầu): dải tên vùng và biểu tượng tốc độ mờ dần sau 6 giây không động vào màn hình; rê chuột,
  chạm, cuộn, gõ phím là hiện lại; đang chọn bằng bàn phím hoặc bảng tốc độ đang mở thì không ẩn.
- **Nhấp đúp / chạm đúp → toàn màn hình, chỉ lõi và các chấm** (anh yêu cầu): dùng toàn màn hình thật của trình duyệt khi được
  phép, không được (iPhone) thì phủ kín cửa sổ; ẩn thanh chuyển, dải vùng, nút tốc độ, nhãn (rê chuột vẫn hiện tên); nhấp đúp lên
  một chấm vẫn là mở ghi chú; thoát bằng nhấp đúp, Esc hoặc phím thoát toàn màn hình của trình duyệt. Tự đo nhấp đúp bằng
  pointerup cho cả chuột lẫn cảm ứng (iPhone không phát dblclick tin cậy). Kiểm trên trình duyệt: máy tính vào toàn màn hình
  thật 1366×768, thoát bằng nhấp đúp và Esc đều được; điện thoại chạm đúp vào được.

## Góp ý sau khi dùng thật (ảnh chụp màn hình của anh)
- **"Rất nhanh" vẫn chậm**: đo lại thì vòng trong cùng mất ~6 phút một vòng ở tốc độ gốc, ~2 phút ở "Rất nhanh" cũ. Nới dải tốc độ:
  Rất chậm = tốc độ gốc (~6 phút) · Chậm 2,5× · **Vừa 5× (mặc định, ~75 giây)** · Nhanh 10× · Rất nhanh 20× (~18 giây); vòng ngoài
  chậm hơn vòng trong. Đo trên trình duyệt: Vừa 73 giây, Rất nhanh 18 giây, Rất chậm 367 giây một vòng.
- **Toàn màn hình không hiện tên ghi chú**: nay hiện đủ tên (chữ 14px, to hơn thường), ẩn hết nút; đồ thị to hơn ~25% vì không còn
  thanh trên/dưới chiếm chỗ.
- Màn hình dựng đứng (điện thoại): quỹ đạo tròn đều thay vì dẹt, chấm trải theo chiều cao, đỡ chen nhau.
- **Cỡ chữ theo số lượng** (anh yêu cầu): cỡ chữ, độ dài tên và cỡ chấm tính theo số ghi chú đang hiện (đang xem một vùng thì chỉ
  đếm vùng đó) — ít thì to, nhiều thì nhỏ; toàn màn hình to thêm một bậc; điện thoại giới hạn để chừa chỗ ngang. Đo toàn màn hình
  1366×768: 5 ghi chú → 18 px, 17 ghi chú → 15,5 px, 81 ghi chú → 12 px.
- **Hai chế độ toàn màn hình: có tên / chỉ chấm** (anh yêu cầu): nhấp 1 lần (chạm 1 lần) vào chỗ trống, phím T, hoặc nút Aa nhỏ ở góc
  (chỉ có khi toàn màn hình, tự ẩn khi không dùng, vàng khi đang tắt tên). Nhấp 1 lần chờ 0,33 giây để phân biệt với nhấp đúp
  (thoát) — nhấp đúp không làm đổi chế độ tên. Trình duyệt nhớ lựa chọn. Kiểm trên trình duyệt: cả 3 cách đổi đều được, nhấp
  đúp thoát mà giữ nguyên chế độ, tải lại trang vẫn nhớ; điện thoại chạm 1 lần đổi, chạm đúp thoát.

## Vòng quỹ đạo sinh động hơn (anh yêu cầu)
- Bao nhiêu vùng bấy nhiêu vòng (đã đúng từ trước) — nhưng vòng cũ gần như vô hình (nét 1px, độ đậm 11%, đứng yên).
- **Màu**: mỗi vòng đúng màu vùng, rõ hơn (17–21%, vùng đang xem 45%) nhưng vẫn nhạt hơn chấm — chấm (ghi chú) luôn nổi nhất.
  Bảng màu nới lên 12 màu, cách đều trên vòng màu, cùng độ sáng tương đối; từ vòng thứ 9 thêm nét đứt để 10–12 vòng vẫn tách bạch.
- **Mã hoá dữ liệu**: nét vòng dày theo số ghi chú của vùng (1–2,4 px) — nhìn là biết vùng lớn/nhỏ.
- **Chuyển động**: vòng "thở" rất nhẹ (bán kính ±0,4%, độ sáng ±4%), lệch nhịp giữa các vòng; mỗi vòng một **vệt sáng** chạy
  dọc vòng cùng chiều chấm, nhanh hơn 1,8 lần — theo nút tốc độ, dừng xoay thì dừng; máy bật "giảm chuyển động" thì tắt hẳn.
- Đo: kho 6 vùng và kho 10 vùng — đúng 6 và 10 vòng, 6/6 và 10/10 màu khác nhau, ~60 khung hình/giây, không lỗi JS.

## Vận hành theo Bát Quái và vũ trụ (anh yêu cầu)
- **Khí âm dương tiêu trưởng** quanh vành Bát Quái; Bát Quái vẫn đứng yên (Càn trên, đúng phương vị). Thứ tự Tiên Thiên: Chấn → Ly →
  Đoài → Càn (dương trưởng) → Tốn → Khảm → Cấn → Khôn (âm trưởng) → Chấn — trên màn hình (Nam trên, Đông trái) là chiều kim đồng hồ,
  khớp hướng đầu cá Dương/Âm của Thái Cực đã vẽ. Màu: nửa trái vàng kim mạnh dần tới Càn, nửa phải xanh mạnh dần tới Khôn; qua Càn
  đổi xanh yếu (Dương cực Âm sinh), qua Khôn đổi vàng yếu (Âm cực Dương sinh). Theo nút tốc độ. Quầng Thái Cực "thở" ~9 giây/nhịp.
- **Vũ trụ**: tốc độ góc ∝ bán kính^-1,5 (Kepler) — vòng trong nhanh, vòng ngoài chậm; vòng dương (1, 3, 5…) xoay thuận chiều khí,
  vòng âm ngược chiều; vệt sáng mỗi vòng theo đúng tốc độ vòng đó; nền 110 ngôi sao lấp lánh nhẹ.
- **Kiểm chứng tự động** (`test-web.sh`, khi có node): khí phải xuất phát ở Chấn và đi theo góc tăng; Chấn/Tốn là "mới sinh" (yếu),
  Càn/Khôn là "cực thịnh"; Ly thuộc Dương, Khảm thuộc Âm. Thử cố tình đảo chiều âm dương → test báo HỎNG đủ 6 lỗi.
- Đo trên trình duyệt: khí đi qua đúng Chấn → Ly → Đoài → Càn → Tốn → Khảm → Cấn → Khôn → Chấn; 6 vòng tốc độ 0,139 / −0,096 /
  0,072 / −0,056 / 0,045 / −0,038 (trong → ngoài, dấu = chiều); ~60 khung hình/giây; máy bật "giảm chuyển động" thì đứng yên.

## Rà ảnh chụp sau PR #12
- **Xem một vùng: 4 chấm mà chỉ 2 chấm có tên.** Chấm nằm ngang hàng lõi, ở mép ngoài: tên dài không vừa phía ngoài thì bị
  lật sang phía bên kia — tức ngang qua lõi Bát Quái — rồi đụng ô của lõi nên bị bỏ. Nay tên luôn quay ra ngoài, rút gọn kèm "…"
  cho vừa; chỉ lật khi phía ngoài quá chật (< 140 px) và phía kia rộng hơn. Đo 5 thời điểm: bản cũ 2/4 2/4 2/4 4/4 4/4, bản sửa
  4/4 cả 5. Xem toàn kho / toàn màn hình: số tên hiện như cũ (không thụt lùi).
- **Thư viện lọc theo loại mà tiêu đề vẫn "Tất cả ghi chú · 1"** — dễ tưởng kho chỉ có 1 ghi chú. Nay "Tất cả ghi chú · Ý tưởng · 1".
- **Tab Nạp, ô Loại bị cắt chữ** "Theo file (mặc…": nay "Theo file", rê chuột hiện giải thích (file không ghi loại thì là Kiến thức).

## Chế độ mặt A.I (anh yêu cầu)
- Nút ẩn: bấm lõi Bát Quái (hoặc phím M); bấm lại / M / Esc để về. Chấm bay từ quỹ đạo về (~1,25 giây, lệch nhịp từng chấm),
  xếp đều theo chiều dài các nét khuôn mặt, mỗi vùng một đoạn liền mạch, giữ màu vùng; vòng quỹ đạo và nan hoa mờ dần.
- Mặt nạ hologram 3D: khung lưới vàng kim (viền) / xanh (mặt nạ), mắt khe sáng, nền mờ, vòng HUD xoay ngược chiều, vệt quét
  ngang. Chiều sâu lấy theo mặt elip của đầu, có phối cảnh — đầu quay (yaw ±0,42) và gật (pitch ±0,2) nhìn theo con trỏ;
  điện thoại lắc nhẹ. Chớp mắt mỗi 2,5–5,5 giây. Lõi Bát Quái thành lò phản ứng trên ngực (thân đứng yên, chỉ đầu quay).
- Nhép miệng + phụ đề chạy chữ khi: vào chế độ (chào, số ghi chú/vùng), bấm một chấm (đọc tên), trả lời ở tab Hỏi (câu đầu).
- **Tiếng nói** (anh yêu cầu): Web Speech API, **chỉ giọng tiếng Việt cài sẵn trong máy** (`localService`) — giọng đọc qua mạng
  như "Google Tiếng Việt" trên Chrome máy tính bị loại vì gửi nội dung lên máy chủ. Miệng mở từ lúc bắt đầu phát tới lúc đọc
  xong, phụ đề theo chữ đang đọc (sự kiện `boundary`). Nút loa bật/tắt (nhớ trong trình duyệt), thoát chế độ thì dừng đọc.
  Không có giọng tiếng Việt trong máy: báo một lần, chỉ phụ đề. Kiểm bằng giọng giả lập (máy thử không có loa): chọn đúng
  giọng trong máy, bỏ giọng mạng và giọng tiếng Anh; tắt tiếng thì không phát nhưng vẫn phụ đề; tải lại vẫn nhớ; Esc dừng đọc.
  **Chưa nghe thử bằng loa thật** — giọng thật tuỳ máy (Windows "Microsoft An", Android Google, iPhone "Linh").
- Bố cục tự co theo khung (máy tính, toàn màn hình, điện thoại); phụ đề canh giữa theo mặt, không bị thẻ chi tiết che; dải tên
  vùng ẩn trong chế độ này. Máy bật "giảm chuyển động": chuyển ngay, không lắc đầu / quét / nhép miệng, phụ đề hiện đủ.
- Kiểm trên trình duyệt: vào/ra bằng bấm lõi, phím M, chạm lõi trên điện thoại; đầu nhìn theo chuột (yaw +0,36 / −0,36);
  miệng mở khi nói; bấm chấm mở đúng ghi chú và đọc tên; toàn màn hình; ~61 khung hình/giây; không lỗi JS.

## Mặt A.I làm lại theo ảnh mẫu (anh yêu cầu: bản đầu "xấu quá")
Bản đầu là khung lưới thưa kiểu "người sắt": kho 14 ghi chú chỉ có 14 chấm lưa thưa, nét đa giác thô, đường nối ghi chú
cắt ngang mặt. Làm lại theo 3 ảnh anh gửi:
- **Đầu và thân (ảnh 2)**: mô hình 3D (bề rộng, độ nhô theo từng tầng mặt + hốc mắt, cung mày, sống mũi, cánh mũi, gò má, môi,
  cằm, thái dương; cổ, dốc vai, cơ vai, xương quai xanh, ngực) vẽ bằng **đường đồng mức độ sâu** (marching squares, dựng một
  lần khi bật) — vân ôm theo khối như bản đồ địa hình. Thêm tai, lông mày, mí mắt (khép khi chớp), khe miệng. Nhép miệng: môi
  dưới và cằm hạ xuống theo tiếng. Đầu quay có phối cảnh; cổ xoay theo một phần; thân đứng yên, nhìn hơi từ trên xuống.
- **Não và mạng (ảnh 3)**: hộp sọ trong suốt (vân mờ dần lên đỉnh), bên trong hai bán cầu não — nếp cuộn là đường đồng mức của
  tổng vài sóng phẳng (ra hoa văn mê cung như vỏ não), sáng theo sóng chạy ngang, đang nói thì sáng hơn. Mỗi ghi chú là một
  nơ-ron phát sáng, chỗ cố định theo mã ghi chú, vùng nào nằm ở thuỳ hướng về vòng của vùng đó. Mỗi vùng một vòng tròn quanh
  đầu (trái → phải theo thứ tự vòng quỹ đạo; 7 vùng trở lên thì vòng lan xuống hai bên), nối tới từng nơ-ron, có xung sáng chạy
  vào não. Bấm vòng: Mây đọc tên vùng và số ghi chú.
- **Chuyển cảnh (ảnh 1 + ý anh "hai luồng âm dương")**: Thái Cực tách hai quả cầu Dương (vàng, bên trái — phía Đông) và Âm
  (xanh tím), xoay đúng một vòng quanh nhau; mỗi đường vân của đầu lúc đầu là một sợi năng lượng nối hai quả cầu (~90 sợi, có
  hạt sáng trôi dọc), rồi gỡ dần thành đường vân (viền đầu trước, chóp mũi sau); hai quả cầu bay vào làm hai mắt, lõi Bát Quái
  xuống giữa ngực (theo góp ý: hạ xuống qua khỏi cổ, không sát đầu). Vào ~2,6 giây, ra ~1,5 giây chạy ngược lại.
- Theo góp ý sau bản thử: mặt mềm hơn (vân viền thưa, dịu hơn; trán dốc nhẹ nên không còn mảng trống hình chữ T), vai mềm và
  thật hơn (vai dốc dài, tròn, rộng; cổ rõ).
- Nhẹ máy: tọa độ chiếu ghi thẳng vào mảng có sẵn (không tạo đối tượng mỗi điểm), đã thành hình thì gom nét theo độ sáng và vẽ
  một lớp, quầng nơ-ron vẽ sẵn mỗi màu một lần. Trình duyệt không card đồ hoạ (máy thử): ~60 khung hình/giây ở kho 14 và kho
  200 ghi chú, máy tính và điện thoại.
- Sửa kèm: thông báo dài (vd "chưa có giọng đọc tiếng Việt") trên điện thoại tràn khỏi màn hình — nay xuống dòng; ở chế độ mặt
  A.I thông báo nằm trên phụ đề, không che các vòng vùng. Kho trống: ẩn chữ "Kho đang trống" (Mây đã nói câu đó) để không đè mặt.
- Kiểm trên trình duyệt (kho 14 ghi chú, kho 200 ghi chú / 9 vùng, kho trống; 1366×768, toàn màn hình, điện thoại 390×844):
  vào/ra bằng bấm lõi và phím M, giữa chừng chuyển cảnh; đầu nhìn theo chuột; miệng mở khi nói; rê vòng vùng ra con trỏ bàn tay,
  bấm vòng đọc đúng "Vùng Kỹ thuật: 4 ghi chú", không mở thẻ, không phóng to; bấm nơ-ron mở đúng ghi chú và đọc tên; mở thẻ chi
  tiết thì mặt dịch trái vừa khung; "giảm chuyển động" vào/ra ngay; không lỗi JS.

## Tiếng nói: "bật loa mà không nghe gì" (anh báo khi thử trên máy)
- Nguyên nhân: anh mở bằng **Chrome trên Windows**. Chrome chỉ thấy giọng SAPI cũ của Windows (tiếng Anh: David, Zira, Mark);
  giọng tiếng Việt cài trong Cài đặt Windows ("Microsoft An") chỉ Edge thấy, và danh sách giọng Google qua mạng của Chrome máy
  tính không có tiếng Việt. Máy không có giọng nào để đọc; thông báo cũ chỉ hiện 6 giây một lần, lại nói chung chung → dễ bỏ qua.
- Sửa: nút loa có trạng thái **"chưa nghe được"** (vàng, chấm đỏ); rê/bấm vào là thấy lý do đúng theo trình duyệt — Chrome trên
  Windows: "mở bằng Microsoft Edge"; máy chưa cài giọng: cách cài. Máy không có giọng trong máy mà trình duyệt có giọng tiếng Việt
  qua mạng (Edge: HoaiMy, NamMinh): bấm nút loa thì **hỏi rõ** có dùng không (chữ Mây đọc sẽ gửi lên máy chủ của hãng); mặc định
  vẫn chỉ giọng trong máy, tắt tiếng là bỏ quyền, bật lại hỏi lại. Thêm hai cách chống lỗi Chrome làm tiếng không phát (kẹt trạng
  thái tạm dừng; câu đang đọc bị thu hồi mất sự kiện kết thúc). Danh sách giọng nạp chậm vẫn bắt được.
- Kiểm bằng giọng giả lập 5 tình huống: Chrome Windows (chỉ tiếng Anh) → nút vàng + chỉ mở bằng Edge, không hộp hỏi; Edge chưa cài
  giọng → hỏi; đồng ý thì đọc bằng HoaiMy, tải lại vẫn nhớ, tắt tiếng thì bỏ quyền; từ chối thì chỉ phụ đề; Edge có Microsoft An →
  đọc ngay, không hỏi; giọng nạp chậm → vẫn đọc. **Chưa nghe bằng loa thật** — cần anh thử trên Edge.

## Góp ý sau PR #14 (ảnh mẫu đầu A.I, tiếng Anh, micro, nạp Word/PDF)
- **Đầu – cổ – vai nối liền, vân như ảnh mẫu.** Thử kiểu vân mê cung (sọc + nhiễu): anh chê *rời rạc, xấu* — vân đứt vụn, có lỗ
  đen. Làm lại bằng **đường dòng cách đều**: mỗi đường vân đi theo hướng khối (trên mặt dọc đường đồng mức độ nhô; cổ, vai theo
  0,7·y − độ nhô), đường mới luôn cách đường cũ đúng một khoảng, sát quá thì dừng → đường dài, liền, đều, chỗ hai dòng gặp nhau
  thì dừng gọn như vân tay. Tai nằm trong khối đầu nên cũng có vân. Cổ to ra, mọc từ dưới hàm, các vòng ngang chảy liền xuống vai.
  Dựng sẵn lúc máy rảnh (~0,3 giây, ~20.000 điểm) để lần đầu bấm không khựng; ~60 khung hình/giây.
  Lỗi gặp khi làm: lưới giá trị ra ngoài khung lại trả giá trị hàng mép → đường vân chạy tuột ra ngoài mãi, hàng chờ phình hết bộ
  nhớ, trang treo; đã sửa (ngoài khung trả "ngoài vùng") và thêm điều kiện dừng khi đường giậm chân tại chỗ.
- **Chrome không có giọng tiếng Việt → giọng nữ tiếng Anh trong máy** (Windows "Zira", trầm ấm hơn chút): câu của Mây nói tiếng
  Anh, chữ của anh đọc không dấu, phụ đề vẫn đủ dấu. Bỏ dòng cảnh báo "Chrome trên Windows…". Edge chưa cài giọng Windows: đọc
  tiếng Anh trước, bấm loa thì hỏi có dùng giọng Việt qua mạng (HoaiMy) không.
- **Phụ đề không giật**: trước đây khung co giãn theo từng chữ (canh giữa nên nhảy qua lại) và chữ vọt theo từng từ. Nay khung
  giữ đủ cỡ cả câu từ đầu (phần chưa đọc trong suốt), chữ hiện đều ~9–24 chữ/giây theo tiếng; tắt sau 3 giây.
- **Vòng vùng + đường nối vào não tự mờ** sau ~6 giây để yên, rê chuột / chạm là hiện lại.
- **Nhập bằng giọng nói + nói với Mây**: nút micro ở ô Chủ đề, Nội dung, Nạp, Tìm, Hỏi và ở mặt A.I (lệnh *tìm / mở / ghi chú /
  thoát*, câu khác thì hỏi kho). Nhận giọng của trình duyệt chạy trên máy chủ Google / Microsoft → mỗi lần mở trình duyệt hỏi
  đồng ý một lần. Ghi chú nhập bằng giọng: nguồn `voice` + thẻ `giong-noi`, không tự lưu (giống quy tắc xác nhận giọng nói).
- **Nạp file Word / PDF trên web** (anh báo "không nạp file được" — anh chọn file Word/PDF, web chỉ nhận .md/.txt): trình duyệt
  gửi nguyên file (base64), máy chủ đọc chữ. Word đọc bằng thư viện có sẵn của Python (zip + XML, không cần cài gì): Heading 1/2
  thành mục để tách, danh sách giữ gạch đầu dòng, dòng lệnh mẫu mở đầu bằng "#" không bị tưởng là tiêu đề; chặn file nén "bom".
  PDF: pdftotext, máy không có thì pypdf; PDF dài tự tách mỗi trang một ghi chú. Dòng lệnh `brain.py nap` cũng đọc được .docx.
  Giới hạn thân yêu cầu nâng 4 → 8 MB (file ~4 MB gửi dạng base64). Thử file hướng dẫn thật: Word → 16 ghi chú theo tiêu đề,
  PDF 27 trang → 27 ghi chú. Thêm 4 test brain (Word tách mục, giữ gạch đầu dòng, Word hỏng báo rõ, PDF tách trang) và 3 test web.

- **Vẫn chưa đạt so với ảnh mẫu** (anh gửi lại ảnh): vân đường dòng liền nhưng chóp mũi / môi / cằm thành vòng tròn đồng tâm
  như bia bắn. Nay chóp mũi đi dọc, môi và cằm đi ngang (trộn dần vào hướng đồng mức). Thử thêm chất mê cung (từng mảng rẽ vuông
  góc): thành nhiều đoạn ngắn như nét gạch — anh chê *rời rạc, xấu* — đã bỏ, giữ đường vân dài liền. Thử thêm lớp quầng mờ quanh
  vân: máy yếu tụt còn ~26 khung/giây — bỏ; nét giữ đúng 1px (1,1px làm trình duyệt bỏ đường vẽ nhanh, chậm gấp đôi).
- **Mục 8 — chuyển cảnh chỉ còn 2 luồng Âm Dương** (anh yêu cầu): bỏ hai quả cầu và các sợi nhiều màu. Từ lõi tuôn ra luồng Dương
  vàng kim và luồng Âm xanh lam — hai cánh xoắn ốc như Thái Cực, nhấp nhô ngược pha nên cắt đan qua nhau; mỗi luồng là một bó
  60 sợi mảnh (mỗi đường vân của đầu nằm trên một đoạn luồng dài tương ứng — trải hết luồng thì thành nét thẳng cắt ngang).
  Vẽ sợi thường, không cộng sáng (60 sợi cộng sáng thành trắng xoá, mất màu). **Hiệu ứng Tiên Thiên**: vòng 8 quẻ đúng phương vị,
  hào sơ sát tâm, hào dương vàng / hào âm lam, sáng lần lượt theo chiều khí Tiên Thiên (Chấn → Ly → Đoài → Càn → Tốn → Khảm →
  Cấn → Khôn, theo kim đồng hồ) với đốm khí chạy trước (vàng nửa dương trưởng, lam nửa âm trưởng). Rồi sợi gỡ thành đường vân,
  đầu hai luồng bay vào làm mắt, vòng quẻ mờ đi. Vào ~3,2 giây, ra ~1,6 giây chạy ngược.

## Sau PR #15: ô Hỏi báo lỗi, nạp PDF ra 25 chấm (anh báo kèm ảnh chụp)
- **Ô Hỏi lỗi "openclaw agent lỗi (mã 1): [openclaw] Help: openclaw --help"** — gõ chữ hay nói đều lỗi. Nguyên nhân: OpenClaw
  (đã đối chiếu mã nguồn bản 2026.9.6 anh đang dùng và 2026.10.6) bắt buộc `openclaw agent` có một tham số chọn phiên
  (`--to` / `--session-key` / `--session-id` / `--agent`); server chỉ thêm khi có `BRAIN_AGENT`, máy anh không đặt nên bị từ chối.
  Lý do thật nằm ở dòng `Reason:`, nhưng trang lại in dòng cuối (`Help: …`) nên không ai đoán ra. Sửa: luôn chọn phiên riêng
  `--session-key second-brain` (thuộc agent mặc định — không lẫn vào cuộc trò chuyện Telegram của Mây; có `BRAIN_AGENT` thì
  `agent:<id>:second-brain`); báo lỗi lấy đúng dòng lý do; Mây lỗi vẫn liệt kê ghi chú liên quan. Câu hỏi + ghi chú gửi qua
  `--message-file` (file tạm trong thư mục quyền riêng) thay vì tham số dòng lệnh — hết chuyện user khác trên VPS thấy qua `ps`
  (mục "Chưa làm" cũ). Ghi chú dài: gửi các đoạn có từ khoá của câu hỏi (kèm đoạn kế), tối đa ~3.000 chữ, thay vì 1.500 chữ
  đầu — thử cuốn hướng dẫn 56.000 chữ, hỏi "sao lưu Google Drive" thì Mây nhận đúng mục Bước 6. Test web dùng một `openclaw`
  giả xử sự như bản thật (thiếu chọn phiên thì từ chối, lỗi in nhiều dòng `[openclaw]`); bản cũ tái hiện đúng lỗi anh gặp.
- **Nạp PDF ra 25 ghi chú, Toàn cảnh rối** — "file có chung 1 chủ đề mà ra rất nhiều mục nhiều chấm". Bỏ việc tự tách mỗi trang
  một ghi chú (PDF > 6.000 chữ): nay **mỗi file một ghi chú**, tách chỉ khi anh chọn ở ô Tách (bỏ lựa chọn "Tự động" trên web cho
  khỏi khó hiểu). Tên ghi chú PDF lấy tiêu đề trong file (có dấu: "Bộ 4 Skill nhóm A cho OpenClaw — Cài đặt & Sử dụng") thay vì
  tên file bỏ dấu. **Gộp trang**: `brain.py gop-trang` (xem trước, `--yes` để gộp) và dòng vàng *Gộp thành 1 ghi chú* đầu Thư
  viện — nối các ghi chú "<file> — trang N" theo thứ tự trang, dồn thẻ và liên kết, sao lưu trước, các trang vào kho lưu.
- **Toàn cảnh "chấm to, không cân đối, rối"**: chấm nhỏ lại khoảng một phần ba (to nhất ~6 px thay vì ~10 px); vùng đông (> 12 chấm) trải
  thành dải 3 làn so le thay vì chuỗi hạt dày đặc; tên trùng nhau chỉ ghi một lần; nhiều hơn 24 chấm thì ghi tối đa ~18 tên,
  chia đều các vùng (chấm thứ nhất mỗi vùng, rồi thứ hai…). Thử kho giống kho anh (25 trang + 15 ghi chú, màn 1366×768):
  trước — 13 nhãn "OpenClaw NhomA Cai dat va Su du…" lặp; sau — mỗi vùng có tên, không lặp; bấm Gộp → 14 chấm, đủ tên.
- Thêm 6 test brain (gộp trang: xem trước, thứ tự + thẻ, trang vào kho lưu, lần 2 không gộp; PDF mặc định 1 ghi chú, tên có
  dấu từ thông tin file) và 7 test web (chọn phiên + gửi qua file, đoạn liên quan của ghi chú dài, báo đúng lý do lỗi, Thư viện
  mời gộp, gộp qua web, gộp lần 2, tên sai kiểu).

## Sau PR #16: ô Hỏi vẫn lỗi "Gateway agent from agent exec would lose inter-session attribution…"
- Lỗi khác hẳn lỗi cũ: lệnh đã chọn phiên đúng, nhưng OpenClaw chặn. Mã nguồn 2026.9.6: `openclaw agent` chạy với biến
  `OPENCLAW_SHELL=exec` thì từ chối gọi Gateway — chốt an toàn để lệnh trong exec của agent không tạo lượt hội thoại mới
  mất dấu người gửi thật; thông báo dặn rõ *không gỡ dấu, không thử đường CLI khác*. Trang web được **Mây** bật lại lúc cập
  nhật (bước `web.sh restart` trong hướng dẫn gửi Mây), nên tiến trình web và lệnh `openclaw agent` con mang dấu đó.
- Cách sửa đúng: chủ kho tự bật trang web trong Termius. Không gỡ dấu trong code. Thêm: ô Hỏi gặp dấu này thì không chạy
  lệnh vô ích mà báo tiếng Việt kèm đúng lệnh `web.sh restart`, vẫn liệt kê ghi chú liên quan; `web.sh start` (bật từ exec)
  nhắc trước ô Hỏi sẽ bị chặn; `web.sh status` có dòng **Ô Hỏi: không bị chặn / BỊ CHẶN** (đọc biến môi trường của tiến trình
  web). SKILL.md dặn Mây: cần ô Hỏi thì đưa lệnh cho người dùng tự chạy. Từ nay hướng dẫn cập nhật: Mây cài, **anh** khởi
  động lại web.
- `openclaw` giả trong test-web.sh thêm đúng chốt chặn này. Thêm 3 test (ô Hỏi báo cách sửa; `web.sh start` nhắc; `web.sh
  status` chỉ ra bị chặn). Mây chạy bộ test trong exec thì 3 test gọi Mây tự bỏ qua (79), chạy từ terminal thì đủ 82.
- **Thẻ chi tiết chỉ đóng bằng ×** (anh báo: bấm ra chỗ trống không tắt). Nay bấm chỗ trống ngoài thẻ — ở Thư viện, Việc, cột
  trái hay nền Toàn cảnh (trừ lõi Bát Quái) — là đóng. Bấm nút, ô nhập, thẻ ghi chú khác thì vẫn làm việc của nó (mở ghi chú
  khác, không đóng rồi mở lại). Đang Sửa thì không tự đóng. Thử bằng trình duyệt thật 10 tình huống (mở, đổi ghi chú, bấm trong
  thẻ, chỗ trống, đang sửa, ×, Esc, chấm và chỗ trống trên đồ thị): đạt cả.
- **Ô Nguồn phải gõ / dán tay** (anh hỏi "không cho truy tìm nguồn?"). Thêm gợi ý: ô Nguồn và Trích dẫn (cả form Thêm lẫn form
  Sửa) hiện danh sách nguồn đã dùng trong toàn kho — mới dùng trước, tối đa 200, nhãn là tên ghi chú dùng gần nhất và số ghi
  chú dùng chung; gõ vài chữ để lọc. Máy chủ tính trên toàn kho (không chỉ phần ghi chú gửi xuống trang). Không tra Internet —
  trang không gửi gì ra ngoài. +1 test web (83; trong exec của Mây 80).
- **"Chọn Cả file 1 ghi chú vẫn thêm 2 ghi chú"**: lần nạp đó có cả file lẫn chữ trong ô *Hoặc dán nội dung* — hai nguồn, mỗi
  nguồn một ghi chú (ghi chú "Ghi chú dán vào" chỉ sinh ra từ ô dán). Đúng thiết kế nhưng trang không nói rõ. Nay: có cả hai thì
  hỏi trước khi nạp (Huỷ = không nạp gì); kết quả / xem trước ghi rõ "từ file …" hay "từ ô dán" và đếm "(1 từ file, 1 từ ô
  dán)"; thêm nút **× bỏ chọn** file (file chọn từ lần trước còn nằm đó dễ quên). Bài thử trình duyệt bắt được một lỗi trước khi
  gửi: ô chọn file trong suốt phủ cả khung đè lên nút "× bỏ chọn" — bấm thì mở hộp chọn file; đã đưa nút nổi lên trên.
- **Xoá ghi chú thế nào — chuột phải không có gì** (anh hỏi). Thêm menu chuột phải trên mọi chỗ hiện một ghi chú (thẻ Thư viện,
  kết quả Tìm / Hỏi / Nạp, việc, ghi chú liên kết, chấm trên đồ thị; điện thoại: chạm giữ): **Mở · Sửa · Cất vào kho lưu (xoá
  khỏi kho)**, có hỏi lại trước khi cất. Chỗ khác vẫn là menu thường của trình duyệt. Vẫn không có xoá hẳn trên web (cố ý). Cất
  kho từ thẻ chi tiết nay cũng làm mới Thư viện ngay (trước đây thẻ đã cất còn nằm trong lưới tới khi tải lại). Thử trình duyệt
  10 tình huống: đạt cả.
- **Thư viện "các mục, tiêu đề hiện ra không khớp"** (anh gửi ảnh). Bốn nguyên nhân:
  1. *Bộ lọc loại "dính"*: bấm chip Ý tưởng rồi đi nhóm khác vẫn lọc → cây "Phương pháp 3" mà danh sách "Ý tưởng · 0 —
     không có ghi chú nào", "Tài chính 2" mà hiện 1. Nay đổi nhóm trên cây là bỏ lọc loại / thẻ.
  2. *Thẻ bị băm*: không có dấu phẩy thì tách theo khoảng trắng — "Hướng dẫn cài đặt Openclaw" thành #hướng #dẫn #cài #đặt
     #openclaw, "Khoa hoc Openclaw" thành #khoa #hoc #openclaw. Nay chỉ ngăn bằng dấu phẩy / chấm phẩy / xuống dòng / kiểu
     "#a #b"; không dấu ngăn thì cả cụm là một thẻ. Thẻ cũ đã băm không tự ghép lại được — sửa tay vài ghi chú.
  3. *Tên ghi chú cả file lấy mục đầu*: file mở đầu bằng "1. Cần chuẩn bị gì?" thì tên là "1. Cần chuẩn bị gì?". Nay mục đánh
     số (1. / II) / Bước 2 / Chương 3…) không thành tên, lấy tên file.
  4. *Không có chỗ đặt tên khi nạp*: anh gõ tên vào ô dán → thành ghi chú riêng "Ghi chú dán vào". Nay có ô **Tên ghi chú**;
     ô dán chỉ một dòng mà chọn 1 file thì trang hỏi có dùng làm tên; chữ dán chỉ một dòng ngắn thì dòng đó là tên (không
     còn "Ghi chú dán vào"). Ô Tên mà lần nạp ra nhiều ghi chú thì báo rõ, không đoán.
  +3 test brain (thẻ một cụm, thẻ kiểu #, mục đánh số không thành tên, dán một dòng — 126), +2 test web (85; exec 82). Thử
  trình duyệt: lọc dính, đặt tên từ ô dán, thẻ không băm — đạt.

## Sau PR #17: nạp bị chặn, tìm ra ghi chú lạ, Kho lưu dài, chọn nhiều file (anh gửi ảnh)
- **"Bấm Nạp ra bảng hỏi và chưa thấy nạp"**: anh chọn 1 file, gõ Tên ghi chú, ô dán còn sót "Bảo trì". Trang hỏi nạp cả hai
  → OK → máy chủ thấy ra 2 ghi chú mà ô Tên chỉ dùng cho 1 → từ chối, không nạp gì. Hai lớp "an toàn" chặn đúng việc anh cần.
  Nay một lần nạp là **file HOẶC chữ dán**: đã chọn file thì ô dán mờ đi kèm dòng nhắc, không nạp; không còn hộp hỏi nào. Ô
  Tên tự tắt khi nạp nhiều file hoặc tách nhỏ (không bao giờ gặp lỗi "ra 2 ghi chú"). Gõ tên vào ô dán rồi mới chọn 1 file thì
  dòng đó tự chuyển sang ô Tên. Nạp xong (kể cả toàn bản trùng) thì bỏ chọn file.
- **"Không cho chọn nhiều file?"**: ô chọn file vốn nhận nhiều file (giữ Ctrl), nhưng bấm *chọn file* lần hai thì thay hẳn
  danh sách cũ. Nay cộng thêm (trùng tên lấy bản mới); tổng một lần ~7 MB (giới hạn 8 MB của máy chủ, file Word/PDF gửi dạng
  base64), quá thì báo file nào để đợt sau. Bài thử bắt được lỗi đếm "bỏ -1 file" (xoá ô chọn file làm trống luôn danh sách
  gốc) — đã sửa trước khi gửi.
- **Tìm "kinh doanh" ra ghi chú khác**: không dấu nên dùng chỉ mục bỏ dấu và chỉ đòi đủ hai chữ ở bất kỳ đâu — "kinh nghiệm…
  doanh thu", "kính… doanh nghiệp" cũng khớp. Từ tiếng Việt nhiều âm tiết: nay tìm **đúng cụm liền nhau** trước (chỉ mục có dấu
  rồi bỏ dấu), không ra mới tìm chữ rời như cũ, câu dài vẫn ra theo số chữ khớp. Cụm khớp được tô cả cụm («bê tông tươi»).
  +3 test brain (cụm đúng, cụm không dấu, chữ rời vẫn ra); 2 test cũ đổi kỳ vọng tô sáng (cả cụm thay vì từng chữ).
- **Kho lưu liệt kê 25 trang đã gộp**: các trang của cùng một file gom thành một dòng "«tên file» — 25 trang", bấm để bung.
- **Vòng trên đầu mặt A.I** (anh yêu cầu): 2 cung xanh → 3 cung nét đứt xanh lam / vàng kim / cam (màu luồng Dương và lõi), xoay
  xen kẽ chiều, nhanh chậm khác nhau; đậm hơn chút cho rõ trên màn sáng. Vẫn ~60 khung hình/giây.
- **Quay đầu sang bên thì dưới tai – hàm phía bên kia đứt nét** (anh khoanh đỏ). Mô hình đầu chỉ có mặt trước, cổ chừa sẵn
  vùng dưới hàm (nhìn thẳng bị mặt che): quay đầu là hở một mảng tối giữa tai, hàm và cổ. Sửa: vân cổ chạy liền lên dưới hàm và
  lên tới sau tai; phần cổ phía trên hai bên lùi dần ra sau (gáy, cơ cổ — chuyển mượt, không gãy độ sâu) nên quay đầu thì phía
  bên kia trượt ra ngoài mép hàm như đầu thật; mỗi khung hình che phần cổ nằm sau mặt theo đúng viền đầu lúc đó (chỉ 23/319
  mảnh vân sát dưới hàm phải qua lớp che, đặt lớp che một lần). Nhìn thẳng giữ nguyên. Lần đầu che cả thân: tụt 60 → 40
  khung/giây — đã tối ưu, còn ~57.
- Thử trình duyệt: nạp file + chữ sót + Tên (đúng ảnh anh) → 1 ghi chú đúng tên, không hỏi; chọn nhiều file / cộng thêm / trùng
  tên / quá tổng; Kho lưu gọn và bung; tìm "kinh doanh" — đạt cả.

## Sau PR #18: ô Hỏi chạy thật — câu trả lời hiện ký hiệu thô
- Ô Hỏi đã trả lời được trên máy anh (lỗi "state-lifecycle" lần trước không lặp lại — nhiều khả năng bận nhất thời). Nhưng câu
  trả lời hiện nguyên ký hiệu Markdown (`**Cài rclone trên VPS**`, dấu backtick) và mã nguồn `[63d7736d5d92]` chỉ là chữ.
- Nay câu trả lời được dựng thành phần tử trang (không dùng innerHTML — câu trả lời chỉ là dữ liệu, chèn thẻ HTML không chạy):
  **đậm**, `dòng lệnh`, danh sách đánh số / gạch đầu dòng (dòng thụt vào nối tiếp mục trên, dòng trống giữa các mục không cắt
  danh sách), khối lệnh ```; mã ghi chú (cả dạng `[id1, id2]`) thành nút vàng mang tên ghi chú, bấm mở, chuột phải có menu; mã
  lạ giữ nguyên chữ. Câu Mây đọc to / phụ đề bỏ hết ký hiệu và mã. Thử trình duyệt 11 tình huống (kể cả thẻ `<img onerror>`
  chèn trong câu trả lời — hiện dạng chữ, không chạy): đạt cả.

## Sau PR #18: chọn file thì không bấm được vào ô dán; vai có nét đứt
- *"Thêm được 2 file, nhưng con trỏ không vào cho nhấp vào ô dán nội dung"* — rồi *"Nhập 1 file cũng bị"*. Bản trước cố ý tắt
  ô dán khi đã chọn file (tránh lần nạp ra ghi chú lạ từ chữ sót), nhưng ô bị tắt thì chỉ thấy con trỏ cấm, tưởng hỏng. Nay ô
  dán **luôn gõ được**; có cả file lẫn chữ dán thì nạp cả hai, chữ dán thành ghi chú riêng (tên lấy dòng đầu), và dòng vàng dưới
  ô dán báo trước kèm chữ đầu đoạn dán — chữ sót nhìn là thấy, không hộp hỏi, không chặn. Ô Tên đặt cho file khi có file, không
  có file thì cho chữ dán (máy chủ theo đúng quy ước này, không còn lỗi "ra 2 ghi chú"); chữ mờ trong ô Tên nói bỏ trống thì tên
  lấy từ đâu (trước đây chữ mờ là một tên mẫu, trên ảnh trông như đã gõ sẵn). +2 test web (87; exec 84); thử trình duyệt 14 tình
  huống (chọn 1 file rồi gõ vào ô dán, xem trước / nạp ra đúng 2 ghi chú đúng tên, chỉ dán + Tên, 2 file + dán…): đạt cả.
- Ảnh chụp gần phần vai: trên đỉnh hai vai còn vài **mẩu vân ngắn đứng lẻ** — đường vân chạy chéo dốc vai, chạm mép hai đầu nên
  chỉ còn một khúc ngắn. Nay thêm **viền thân liền một nét** hai bên, từ dưới hàm xuống dốc vai tới cánh tay (mờ dần phía dưới
  như vân bên cạnh), và bỏ các mẩu ngắn kẹt sát mép; vân thân chạm mép thì gặp viền, đỉnh vai gọn. Quay đầu hai bên vẫn liền
  tai – hàm – cổ; tốc độ vẽ giữ ~55 khung hình/giây.

## Rà soát kỹ toàn trang (sau "Kiểm tra rà soát thật kỹ để sửa cho dứt điểm lỗi")
Chạy thật trên trình duyệt với kho giống của anh (18 ghi chú ở 5 vùng, bộ 26 trang PDF trong kho lưu, có việc quá hạn), máy
tính 1366×768 và iPhone 390×844, Mây giả trả lời kiểu Markdown: 66 tình huống qua Thêm · Nạp · Tìm · Hỏi · Ôn/Kho lưu · Thư
viện · Việc · Toàn cảnh · mặt A.I · thẻ chi tiết · menu chuột phải / chạm giữ. Thêm 737 yêu cầu dữ liệu sai kiểu vào mọi đường
API. Tìm ra và đã sửa:
- **Chuột phải vào ghi chú nằm sát mép khung: menu vừa hiện đã tắt.** Trình duyệt tự cuộn thẻ vào khung, mà cứ cuộn là menu
  đóng. Nay bỏ qua cái cuộn nhỏ ngay lúc mở.
- **iPhone chạm giữ không ra menu** (tài liệu có hứa): Safari trên iPhone không phát sự kiện chuột phải. Nay tự đếm 0,55 giây
  chạm giữ (Android vẫn dùng của trình duyệt); mở menu kiểu này thì lúc nhấc tay không mở luôn ghi chú; kéo ngón tay để cuộn thì
  không hiện menu; chạm giữ không bôi đen chữ.
- **Ghi chú trong Kho lưu: menu vẫn là "Cất vào kho lưu"** (bấm thì không có gì xảy ra). Nay là **Lấy lại khỏi kho lưu**.
- **Cất một ghi chú từ kết quả Tìm xong, nó vẫn nằm trong danh sách** (trông như chưa cất). Nay cất / lấy lại xong thì Tìm tự
  chạy lại; các nút trỏ tới ghi chú đó trong kết quả Nạp, Hỏi mờ đi, gạch ngang, chuột phải thành *Lấy lại*.
- **Bấm đúp "Nạp vào kho"**: gửi hai lần, dòng kết quả là của lần sau — *"Đã thêm 0 ghi chú · bỏ 1 bản trùng"*, tưởng không nạp
  được. Nay khoá hai nút trong lúc chờ.
- Chạy chồng: mở/đóng Kho lưu thật nhanh có lúc hiện danh sách dưới nút "xem lại"; bấm hai ghi chú liền nhau thì thẻ có thể hiện
  ghi chú bấm trước; gõ Tìm nhanh thì kết quả của chữ gõ trước về muộn có thể đè kết quả mới. Nay chỉ lần sau cùng được vẽ.
- Ô lọc vùng ở Tìm: vùng đang chọn vừa hết ghi chú thì ô trống trơn — nay về "Mọi vùng".
- Máy chủ: mã ghi chú gửi lên dạng danh sách/object, câu hỏi dạng số, ký tự NUL trong ô tìm → lỗi 500. Nay báo lỗi gọn (737/737
  yêu cầu sai kiểu không còn lỗi 500).
- **Câu chữ riêng tư ô Hỏi**: trang ghi "Không gửi gì ra ngoài" — không đúng: câu hỏi và vài ghi chú liên quan đi tới Mây, tức
  qua mô hình AI mà OpenClaw đang dùng (như mọi tin nhắn anh gửi Mây). Nay ghi đúng như vậy, cả ở bảng An toàn trong CAI-DAT.
- +4 test web (91; exec 88), +1 test brain (129; máy có crontab chạy thêm 1 mục lịch Drive → 130).

## Sau PR #19: `kiemtra.sh` báo oan 23/27 trên máy nhiều agent
- Mây cài PR #19 đúng (kho không đổi, 130/130, 91/91), nhưng `kiemtra.sh` báo 4 skill "OpenClaw chưa thấy". Máy anh có nhiều
  agent; `openclaw skills list` không kèm `--agent` thì OpenClaw 2026.9.6 chọn agent theo thứ tự: `--agent`, rồi **thư mục đang
  đứng** (nằm trong workspace của agent nào thì xem kho agent đó), rồi agent mặc định. Mây kiểm lại (chỉ đọc): Telegram và agent
  mặc định đều là `main` — nên chỗ lệch không phải agent mặc định mà nhiều khả năng là thư mục đang đứng lúc chạy script (thư
  mục giải nén gói) nằm trong workspace của agent khác. 4 skill nằm trong workspace của `main`; thêm `--agent main` thì 27/27,
  và Mây trên Telegram dùng đủ 4 skill.
- Nay script tự tìm agent có workspace chứa thư mục skills (`openclaw agents list --json`) rồi kiểm đúng agent đó, in dòng
  *(kiểm kho skill của agent: …)*; thêm tuỳ chọn `--agent <id>`; không tự tìm được thì gợi ý `--agent main` ngay trong dòng
  báo lỗi. Ghi rõ `--agent` thì OpenClaw bỏ qua thư mục đang đứng, nên đúng cho cả hai trường hợp. Thử với openclaw giả 2 agent (lệnh trơn trả kho agent khác): bản cũ báo oan, bản mới 4/4; `agents list` hỏng thì về cách
  cũ, không lỗi. Lệnh kiểm bằng mắt trong CAI-DAT thêm `--agent main`.
- test-brain ra 130 trên VPS mà tài liệu ghi 129: một mục (đặt lịch Drive giữ nguyên lịch khác) chỉ chạy khi có `crontab`.
  Tài liệu ghi rõ.
- Tab Ôn: máy chủ lỗi thì trước đây cũng hiện *"Chưa có gì để ôn"* (tưởng kho trống) — nay hiện đúng dòng lỗi. Hàng ôn trống
  trên máy anh là đúng: ghi chú phải cũ hơn 3 ngày mới vào hàng chờ, mà kho mới dùng từ 21/10.

## Sau PR #20: mở lại trang ở tab Ôn thì mất nút "Kho lưu"
- Ảnh của anh: tab Ôn chỉ còn "Chưa có gì để ôn", mất nút *Kho lưu (26)* (ảnh trước vẫn có). Anh tải lại trang lúc đang ở tab
  Ôn — trang tự mở lại đúng tab đó. Hai lỗi chồng nhau:
  1. Đoạn "mở lại tab lần trước" nằm giữa file, chạy trước khi các biến của Kho lưu được khởi tạo → lỗi JavaScript *"Cannot
     access … before initialization"*. Bản cũ cũng dính (biến `moKhoLuu`), chỉ là lỗi nằm im; bộ đếm chống chạy chồng thêm ở
     PR #19 làm lỗi lộ ra mỗi lần.
  2. Kể cả không lỗi, tab Ôn được vẽ lúc kho chưa tải xong (tưởng 0 ghi chú cất kho) rồi không vẽ lại.
- Sửa: đưa đoạn mở lại tab xuống cuối file (sau mọi khai báo); tải kho xong mà tab Ôn đang mở thì vẽ lại hộp "Chưa xếp chỗ" và
  nút Kho lưu.
- Bài thử mới: mở lại trang ở **từng tab** (Thêm · Nạp · Tìm · Hỏi · Ôn), máy tính và iPhone, đòi đúng tab, đủ nội dung, không
  lỗi JavaScript (12/12); tải lại 3 lần ở tab Ôn vẫn có nút Kho lưu. Cả bộ rà soát trình duyệt chạy lại: 101/101.

## Rà soát toàn diện lần 2 ("Kiểm tra thật kỹ, sửa 1 lần luôn")
Lỗi tab Ôn lọt qua lần rà trước vì chưa thử mở lại trang — lần này thử theo danh sách thay vì theo lỗi: mọi trạng thái trình
duyệt nhớ (tab × ẩn tên × dừng xoay × tốc độ × tiếng: 20 tổ hợp, mở lại trang), phím tắt (/, M, T, nhấp đúp, Esc, bảng tốc độ),
kho lớn 218 ghi chú 8 vùng (Thư viện xem thêm tới hết không trùng, 4 kiểu sắp xếp, cây khớp số từng vùng / nhóm con, Việc, mặt
A.I ~46 khung/giây), kho trống, mọi nút trên thẻ chi tiết (xong / mở lại việc, nhớ rồi, đường dẫn nhóm, nguồn, trích dẫn, sửa
sang nhóm mới, xoá trắng rồi lưu, menu bằng Shift+F10), Nạp file Word / PDF thật (tên tiếng Việt, kéo thả, file > 4 MB, tổng
> 7 MB, .doc đời cũ, PDF hỏng), 4 kiểu lỗi ô Hỏi, 5 cỡ màn hình (1280×520, 1920×1080, máy tính bảng, iPhone, Android 360×640).
Tổng 197 tình huống trình duyệt — đạt cả sau khi sửa:
- **Word "QUY TRÌNH SỬA CHỮA THANG MÁY…" thành ghi chú tên "Tiếp nhận sự cố"** — tiêu đề mục đầu tiên bị coi là tên tài liệu.
  Nay tiêu đề đầu chỉ là tên khi phía sau không còn tiêu đề cùng cấp; kiểu **Title** của Word luôn là tên tài liệu (trước đây
  lẫn với Heading 1); title trong frontmatter không bị tiêu đề mục đè; chữ dán không tên file thì tiêu đề đầu vẫn làm tên.
- **Tên lấy từ tên file mất dấu " - "** ("…THANG MÁY LƯU ĐỒ…") — nay giữ; gạch nối kiểu slug ("bai-hoc") vẫn thành khoảng trắng.
- **PDF "Mỗi trang 1 ghi chú" ra 0 ghi chú** khi các trang quá ngắn (trang < 40 chữ bị bỏ như bìa/trang trắng) — nay không
  trang nào đủ dài thì cả file một ghi chú.
- PDF hỏng / có mật khẩu: báo tiếng Việt cách xử lý (mở trên máy, In → Lưu thành PDF), dòng lỗi gốc chỉ kèm theo.
- Ô Hỏi khi Gateway OpenClaw tắt: thêm gợi ý tiếng Việt (đợi rồi hỏi lại; vẫn lỗi thì `openclaw gateway status`).
- **Ba vòng quanh đầu hở phía dưới** (anh hỏi: "Ba vòng tròn nên nối phía sau còn bị đứt thiếu?") — trước đây là cung từ ~4
  giờ qua đỉnh tới ~8 giờ. Nay vòng khép kín; cung dưới đi sau cổ, vai thì bị bóng thân che như vầng hào quang thật. Chỉ cung
  dưới cắt theo bóng thân (cắt cả vòng theo viền đầu + thân mỗi khung làm chậm rõ); nét đứt nối tiếp đúng nhịp chỗ nối.
- **Dải chip vùng đè lên đồ thị** trên điện thoại (2–4 hàng chip, kho nhiều vùng che cả lõi) và laptop màn thấp — điện thoại:
  dải chip nằm dưới đồ thị; máy tính: bị đè thì đồ thị tự dồn vào khoảng trống giữa thanh chế độ và dải chip.
- +6 test brain (135; VPS có crontab 136), test web cập nhật mục lỗi Gateway (91).

## Rà soát lần 3 (giọng nói, mặt A.I) và tạo việc ngay ở cột Việc
Lần này thử kỹ phần nói / nghe (giả lập giọng trong máy, giọng qua mạng, không có giọng nào, micro bị từ chối, nói lệnh) và
phụ đề ở mọi cỡ màn hình. Lỗi tìm được và đã sửa:
- **Tắt tiếng rồi bật lại không hỏi lại giọng tiếng Việt qua mạng** — tài liệu ghi "bật lại sẽ hỏi lại" nhưng nút loa chỉ bật
  tiếng, vẫn đọc tiếng Anh. Nay bấm loa bật lại là hỏi (máy không có giọng Việt, có giọng qua mạng); bấm Huỷ thì lần sau bấm loa
  để tắt như thường.
- **Phụ đề có khoảng trắng trước dấu câu** ("theo ghi chú .") khi câu trả lời Markdown có liên kết / chữ đậm ở cuối câu.
- **Phụ đề dài đè lên lõi Bát Quái** (laptop, toàn màn hình, điện thoại) — nay chừa chỗ cho 2–3 dòng phụ đề dưới mặt; điện
  thoại: phụ đề nằm hẳn dưới khung mặt.
- **Cột Việc không tạo được việc** (anh hỏi: "Cột việc cần làm: không nhập/tạo việc được?") — trước chỉ có dòng hướng dẫn sang
  tab Thêm. Nay có ô tạo việc ngay trên đầu cột: tên + hạn + nhóm (tuỳ chọn), Enter là xong, con trỏ quay lại ô tên để gõ việc
  tiếp. Việc tạo nhanh chỉ cần tên (nội dung lấy luôn tên; dòng việc không lặp lại tên).
- **Việc lặp lại bị chặn như bản trùng** ("Nộp báo cáo tuần" tuần này và tuần sau) — nay cùng tên khác hạn là việc mới; cùng
  tên cùng hạn mới là trùng. Áp dụng cả khi Mây thêm việc (`add`), sửa việc và nhập lại bản sao lưu; `duplicates` và
  cảnh báo "gần giống" cũng không còn gợi ý gộp hai lần của cùng một việc lặp lại.
- **Việc chưa có nhóm bị đếm vào "Chưa xếp chỗ"** (trang web, `inbox`, `stats`) — việc sống theo hạn, không cần xếp vào vùng;
  nay không tính, dòng việc cũng không ghi "Chưa xếp chỗ".
- +4 test brain (139; VPS có crontab 140), +4 test web (95; exec 92). Trình duyệt: 12 bước tạo việc (máy tính + iPhone) cùng toàn
  bộ các lượt rà trước chạy lại (239/239).

## Bộ lọc việc: Chưa làm · Đang chờ · Đã xong · Tất cả
Anh hỏi: "Thiếu bộ lọc: việc đã làm, việc chưa làm, việc chờ…". Trước chỉ có ô "Hiện việc đã xong".
- Việc có thêm trạng thái **đang chờ** (đã làm phần mình, đợi người khác / đợi kết quả): cột mới `waiting_at` (thời điểm bắt đầu
  chờ). Kho cũ mở lần đầu bằng bản này tự thêm cột — chỉ thêm cột trống, không đổi ghi chú nào (file kho vì thế đổi mã SHA).
- Web: dải lọc kèm số đếm, trình duyệt nhớ lựa chọn; nút **Chờ / Làm tiếp** ở từng dòng và trong thẻ chi tiết; *Đang chờ* ghi
  "đang chờ từ …"; *Đã xong* xếp việc xong gần nhất trước (200 việc, đếm đủ), bỏ tích là mở lại; thẻ Thư viện ghi "đang chờ".
- Xong thì tự hết chờ; mở lại việc đã xong là việc chưa làm; việc đã xong không chuyển sang chờ được. Bấm lọc liên tục chỉ vẽ
  kết quả lần bấm cuối. Đầu trang "N việc đang mở" vẫn gồm việc đang chờ.
- Mây: `viec --cho <id>` / `--het-cho <id>`; `viec` trả thêm `dang_cho` và `dem` (chua_lam / dang_cho / da_xong); `--tat-ca`
  trả việc xong mới nhất trước. Sao lưu, xuất, nhập lại, khôi phục ghi chú đã xoá đều giữ trạng thái chờ.
- Sửa kèm: thẻ Thư viện của việc tạo nhanh không còn lặp tên hai lần (nội dung = tên).
- +8 test brain (147; VPS có crontab 148; có test kho của bản trước tự thêm cột, giữ dữ liệu), +4 test web (99; exec 96).
  Trình duyệt: 22 bước lọc / chờ / xong / mở lại / nhớ lọc / thẻ chi tiết / Thư viện / iPhone.

## Kiểm theo ảnh anh chụp sau khi cài PR #22
Tạo việc, bộ lọc và nút Chờ chạy đúng trên máy anh (Chrome, Windows); phụ đề nằm dưới tượng, không đè lõi. Từ ảnh còn 3 chỗ, đã sửa:
- **Rê chuột vào lõi: tên quẻ đè tên ghi chú** — "Tốn · Tây Nam" che chữ đầu của "Email khách hàng Phúc Khang…", "Cấn · Tây Bắc"
  chạm "1. Cần chuẩn bị gì?". Các ô tên quẻ (và dòng "Thái Cực · Tiên Thiên Bát Quái") nay được tính là chỗ đã chiếm: nhãn ghi
  chú nằm dưới thì tạm ẩn, bỏ chuột ra là hiện lại. Thử 16 góc xoay: bản trước 90 chỗ đè, bản này 0.
- **Nói "mấy giờ" với Mây ở mặt A.I → "Chưa có thông tin về giờ cụ thể trong các ghi chú"** — câu hỏi giờ / ngày bị gửi đi hỏi
  kho. Nay "mấy giờ (rồi)", "bây giờ là mấy giờ", "hôm nay thứ mấy / ngày mấy" trả lời ngay theo đồng hồ máy (ô Hỏi và giọng nói),
  không gửi Mây; câu kiến thức có chữ "mấy giờ" ("mấy giờ thì đổ bê tông") vẫn hỏi kho.
- **Câu "chưa có thông tin" vẫn gắn 2 ghi chú nguồn** — lời dặn Mây thêm: câu báo chưa có thông tin thì không gắn mã ghi chú.
- Hướng dẫn sửa câu sai: giọng tiếng Anh thì phụ đề câu chào cũng là tiếng Anh (phụ đề = đúng câu đang đọc).
- Ảnh tiếng Anh ở mặt A.I là đúng thiết kế: Chrome trên Windows không có giọng tiếng Việt nào (cả trong máy lẫn qua mạng),
  nên tắt / bật loa trên Chrome không có hộp hỏi — hộp hỏi giọng qua mạng chỉ có ở Edge.
- Trình duyệt: 9 bước mới (16 góc xoay khi rê lõi, câu hỏi giờ / ngày qua ô Hỏi và giọng nói, câu kiến thức vẫn hỏi kho).

## Bộ não mới trong mặt A.I (theo ảnh mẫu anh gửi)
Anh: "Ảnh bộ não hiện tại chưa đẹp, chưa đúng, sửa lại theo các ý tưởng hình ảnh bộ não anh gửi" — kèm ảnh não hologram, não mạch
điện, não nhìn chính diện có cuống sáng, não trong đầu trong suốt; dặn "tập trung vào kiểu dây thần kinh, chấm, tia sáng".
Bản cũ: hai hình bầu dục có hoa văn tổ ong — không ra nếp cuộn não. Bản mới:
- **Hình não nhìn chính diện** (khớp với đầu nhìn thẳng): hai bán cầu tách bởi rãnh giữa, rãnh ngang (Sylvius) tách hai thuỳ thái
  dương bên dưới, khoảng lõm giữa đáy là thân não — như ảnh não chính diện có cuống sáng.
- **Nếp cuộn thật**: sinh bằng phản ứng – khuếch tán (Gray-Scott) trong mặt nạ từng thuỳ; các đường mảnh làm rãnh, phần rộng giữa
  làm nếp; độ cao theo khoảng cách tới rãnh và mép thuỳ nên nếp tròn đầy, rãnh tối mảnh; tô bóng đèn trên trái, xanh lơ ngả tím
  xuống dưới, viền sáng kiểu hologram (đã thử 12 kiểu trước khi chọn — kiểu đường viền nếp ra hoa văn san hô, kiểu khắc rãnh
  trên lưới thô bị nhoè, nên bỏ).
- **Dây thần kinh, chấm, tia sáng**: ~1.100 hạt sáng dồn trên đỉnh nếp + 90 chấm lấp lánh; mạng sợi hồng – xanh nối 36 nốt; ánh sáng
  vàng – hồng chảy trong rãnh giữa và rãnh ngang; nguồn sáng ở khoảng lõm giữa với 24 tia toả, xoay chậm, chập chờn; vài nốt có
  tia chữ thập. Ghi chú (nơ-ron) thành chấm nhỏ lõi trắng, quầng màu vùng (trước là đốm màu loang).
- (Bó dây thần kinh từ thân não xuống lõi Bát Quái đã thử rồi bỏ — xem mục sau.)
- Vân hộp sọ mờ hơn để thấy não như đầu trong suốt ở ảnh mẫu; khi Mây nói não sáng hơn, chấm lấp lánh nhanh hơn.
- Dựng ảnh não một lần (~0,6–0,9 giây máy thử), chia lượt 12 ms nên không giật; bắt đầu ngay khi rê chuột vào lõi hay bật mặt
  A.I — xong trước khi chuyển cảnh 3,2 giây kết thúc. Mỗi khung hình chỉ dán ảnh theo góc quay đầu + lớp động: 39–43 khung/giây.
  Màn hình to lên nhiều (toàn màn hình) thì tự dựng lại cho nét.

## Đầu – não – đường nối dữ liệu cân đối lại (rà soát tổng thể sau bộ não mới)
Anh: "thiết lập thiết kế phần đầu cho cân đối với bộ não mới, các kết nối thông tin dữ liệu… hài hoà, cân đối, khoa học, trực
quan"; "Sao có các tia sáng từ bát quái lên lỗ mũi kỳ vậy?".
- **Bỏ bó dây thần kinh từ lõi Bát Quái lên** — nhìn như tia sáng chui vào mũi. Không còn đường nào chạy qua mặt, cổ.
- **Não ôm khít hộp sọ**: viền não lấy theo chính viền đầu, chừa lớp xương sọ 0,075 — đỉnh sát đỉnh đầu, rộng ~90% bề ngang hộp
  sọ, thuỳ thái dương nằm sau thái dương, đáy ngang cung mày (trước: não nhỏ nằm giữa trán, hai bên còn trống). Vân mặt nằm trên
  não mờ hẳn (sọ như kính), ngoài não giữ sáng: viền đầu, mắt, mũi, miệng rõ.
- **Đường nối dữ liệu gom bó** (như dây thần kinh thật, cách các phần mềm vẽ mạng lưới gom cạnh cho đỡ rối): mỗi vùng MỘT trục từ
  vòng tới cửa vào trên rìa não (theo hướng tâm vỏ não → vòng), có xung dữ liệu chạy vào rồi rẽ vào một nhánh; từ cửa vào toả nhánh
  cong tới từng nơ-ron. Trước: mỗi ghi chú một đường thẳng từ vòng xuyên qua đầu — kho 218 ghi chú thành chùm tia rối.
- **Lãnh thổ vùng**: quầng nơ-ron to, mờ, cộng ánh sáng — nơ-ron cùng vùng loang thành vùng sáng màu trên vỏ não như bản đồ não;
  vùng màu lam trên nền não lam vẫn nổi. Rê chuột vào vòng vùng: trục, nhánh, lãnh thổ, liên kết của vùng đó rực lên, vùng khác mờ.
- **Liên kết giữa ghi chú** ở mặt A.I thành cung khớp thần kinh pha màu hai vùng, có xung sáng nhỏ; vẽ sau bộ não (trước: vạch thẳng
  xám nằm dưới não nên khuất). Mạng sợi trang trí trong não mờ đi để nhường đường dữ liệu thật.
- Kiểm: kho 18 ghi chú / 5 vùng và kho 218 ghi chú / 8 vùng; laptop 1366×768, 1920×1080, iPhone; rê vào vùng; 38–41 khung/giây.
- Anh xem ảnh: "Chưa hài hoà, ảnh 2 bộ não sáng quá" (kho 218 ghi chú trên điện thoại). Rà lại, sửa:
  - **Não trắng xoá** khi kho đông: quầng của hơn trăm nơ-ron cộng dồn. Nay vẽ các quầng lên một lớp riêng theo kiểu "lấy sáng nhất"
    (chồng nhau không sáng thêm) rồi cộng cả lớp lên một lần; cỡ quầng theo cỡ đầu (điện thoại nhỏ lại); lõi trắng dịu dần khi kho đông.
  - **Nơ-ron dồn nửa trên**, thuỳ thái dương trống: nay mỗi vùng một hình quạt trên vỏ não (trái → qua đỉnh → phải, theo thứ tự các
    vòng), nốt rải đều trong quạt — kể cả thuỳ thái dương, não sáng đều trên dưới.
  - **Tên vòng phía trên đè ba vòng hào quang**: đưa lên trên vòng khi mọi vòng phía trên còn chỗ dưới thanh nút; không đủ chỗ
    (điện thoại) thì tất cả ghi dưới — cho đều nhau.
  - **Mép dưới não như vành mũ** cắt ngang trán: viền não nhạt dần xuống đáy; thuỳ thái dương bớt tím cho cùng tông phần trên.
  - Ba vòng hào quang thu nhỏ một chút (1,30 / 1,41 / 1,52 bán kính đầu, trước 1,38 / 1,50 / 1,62): vẫn ôm quanh đầu, chừa khoảng
    thở cho tên vòng vùng trên cùng (kho 5 vùng trên máy tính, tên "Kinh doanh" chạm vòng ngoài).
- Anh: "Hình bát quái trên ngực cần cho nhỏ lại tí cho hài hoà" — lõi giữ Ø 60px cố định nên trên điện thoại to gần nửa bề ngang
  đầu. Nay khi xuống ngực lõi co theo cỡ đầu (0,18 bán kính đầu): laptop Ø ~48px, điện thoại Ø 30px; ở Toàn cảnh vẫn Ø 60px.
  Lúc chuyển cảnh dùng một hình cỡ lớn thu phóng (không vẽ lại hình lõi mỗi khung).
- Anh: "Chỗ cằm anh thấy có các viền sáng hơn bình thường". Tách từng lớp để tìm nguồn — ba nguyên nhân chồng nhau:
  1. **Mây nói, cằm hạ xuống nhưng viền đầu đứng yên**: cằm đè lên vân cổ mà vân cổ không bị che → hai lớp chồng thành dải sáng.
     Nay viền đầu hạ cằm cùng các đường vân (dùng chung một hàm).
  2. **Vân cổ sau mặt cắt cứng theo viền đầu**: các vòng cổ cắt xéo qua đường cằm để lại nhiều mẩu ngắn ôm sát cằm. Nay vẽ lên lớp
     riêng rồi khoét phần sau mặt, mép khoét mờ dần ~0,05 bán kính đầu — cổ chìm dần vào dưới hàm như bóng đổ.
  3. **Vân mặt dồn sát nhau ở mép hàm, dưới cằm** (các đường ôm hàm hội về cằm) → viền sáng: đoạn vân ở dải này dịu còn 55%.
  Mặt A.I vẫn 38 khung/giây.
- Anh: "Miệng cần làm cho thấy rõ miệng hơn" — đã thử vẽ môi riêng (cung môi trên, môi dưới, lòng miệng tối khi mở); anh chọn
  "Giữ miệng này" (miệng tạo từ chính các đường vân) và "chỉ cần 1 vạch sáng hơn" (khoanh đỏ). Bỏ bản môi riêng. Lần đầu em làm
  sáng nhầm vạch khe môi phía trên; anh báo "nhầm rồi — sáng chỗ khoanh đỏ": đúng ra là đường vân trong cùng ở giữa nhóm vòng môi
  (y ≈ 0,79, rộng ~0,22 bán kính đầu) — mắt người đọc nó là "miệng". Nay chỉ vạch đó thêm quầng mảnh + lõi sáng (dày theo cỡ đầu),
  hạ cùng môi dưới khi Mây nói; các vân quanh miệng giữ nguyên.
  - Bài thử hỏi giờ hỏng một lần đúng lúc sang phút mới (máy trả lời 6 giờ 24, bài thử đọc 6 giờ 25) — sửa bài thử chấp nhận cả phút
    trước và sau khi hỏi.

## Quy trình chuyển kiến thức vào kho (SKILL.md mục 2c)
- Phiên mới chỉ cần câu ngắn ("chuyển kiến thức từ MEMORY.md vào Second Brain") mà vẫn giữ đúng quy trình: chỉ trong chat riêng
  với chủ kho; lọc kiến thức của người dùng, bỏ nhật ký vận hành và bí mật; `categories` trước, kiểm trùng; đề xuất ≤ 15 mục
  đánh số, duyệt rồi mới lưu.
- Bộ nhớ agent: chỉ `MEMORY.md` + daily notes trong khoảng ngày chỉ định; `memory_search` chỉ tìm ứng viên, phải đọc lại bằng
  `memory_get` và dẫn `file#dòng`; lưu với thẻ `tu-memory`, `--source other`, `--cite`. Không sửa/xoá bộ nhớ gốc.
- Kiến thức chung: có nguồn chính thống mới đề xuất lưu; chưa có nguồn thì không tự lưu (chỉ `y-tuong` "chưa kiểm chứng" khi
  người dùng yêu cầu). 4 ràng buộc này do Mây đề xuất khi rà; tên công cụ `memory_search`/`memory_get` và cấu trúc bộ nhớ
  đã đối chiếu với tài liệu OpenClaw. Chỉ đổi SKILL.md — không đổi code, schema, dữ liệu.

## Chưa làm (cố ý)
- Trang web không có HTTPS riêng — dựa vào đường hầm SSH (đã mã hoá). Không mở trang ra Internet.
- Font Google trên trang web giữ nguyên cho đẹp; muốn hoàn toàn offline thì xoá 3 dòng `<link … fonts.googleapis …>` trong `public/index.html` (trang tự dùng font hệ thống).
- Trường `install` trong metadata (`kind: apt`/`shell`) giữ nguyên như bản gốc; công cụ vẫn cài tay theo `CAI-DAT.md`.
