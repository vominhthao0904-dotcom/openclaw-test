# Đánh giá và tối ưu 4 skill nhóm A

Bản này là bản đã sửa. Đọc `CAI-DAT.md` để cài, `HUONG-DAN.md` để dùng. File này ghi lại **đã kiểm gì, sửa gì, vì sao**.

## Kết luận

Bản gốc đã tốt: không khoá API, chạy offline, có bộ test, giữ dữ liệu kỹ (cất kho, `deleted/`, sao lưu xoay vòng).
Nhưng kiểm kỹ thì có **2 lỗ hổng an toàn thật**, **4 lỗi làm việc cài/nâng cấp sai**, và nhiều chỗ skill chạy chậm
hoặc cho kết quả kém hơn mức có thể. Tất cả đã sửa và có test đi kèm.

| | Bản gốc | Bản này |
|---|---|---|
| Test `test-brain.sh` | 50 | **111** |
| Test `test-web.sh` | 30 | **68** |
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

- **Trang web, kho trống: chữ "Kho đang trống" đè lên lõi Bát Quái** (thấy trên ảnh chụp máy anh). Chữ và lõi cùng nằm giữa khung.
  Sửa: đẩy chữ xuống dưới lõi, đủ xa để không đè cả khi rê chuột (lõi nở to, hiện tên 8 quẻ). Đã chụp kiểm ở laptop 1366×640,
  màn thấp 1280×520 và điện thoại 390×760.

- **Toàn cảnh, bấm xem một vùng: báo "còn 3 ghi chú khác" dù vùng đã vẽ đủ** (thấy trên ảnh chụp kho thật 14 ghi chú, vùng
  Kỹ thuật 4/4). Khi xem một vùng, các vùng khác cố ý chỉ vẽ 2 chấm mờ làm nền, nhưng số "còn lại" lại tính trên cả kho nên
  cộng nhầm phần của vùng khác. Sửa: chỉ đếm ghi chú của vùng đang xem. Tái hiện bằng kho cùng phân bố: bản cũ báo "3 ghi chú
  khác" ở cả Kỹ thuật lẫn Học tập; bản sửa không báo; vùng 65 ghi chú báo đúng "5 ghi chú khác" (vẽ 60).
- **Nhãn ghi chú bị chấm và nan hoa đang quay chạy ngang qua chữ** (cũng thấy trên ảnh kho thật). Thêm viền tối mỏng quanh chữ
  nhãn để chữ luôn nổi trên nền.

- **Chỉnh tốc độ xoay** (anh yêu cầu): nút **−** / **+** đổi 5 mức (Rất chậm 0,25× · Chậm 0,5× · Vừa 1× · Nhanh 1,75× · Rất nhanh 3×)
  cạnh nút Dừng xoay; chỉnh tốc độ khi đang dừng thì xoay lại luôn; trình duyệt nhớ lựa chọn (không lưu được thì dùng mặc định).
  Tốc độ tính theo thời gian thật — trước đây tính theo khung hình nên màn 120 Hz xoay nhanh gấp đôi màn 60 Hz.
  Đo trên trình duyệt: Rất nhanh = 3,05× Vừa, Rất chậm = 0,25×, Dừng = 0.
- **Nhãn bị cắt chữ ở mép màn hình điện thoại**: hai phía đều thiếu chỗ thì nhãn tự rút gọn kèm "…" cho vừa.

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
- Ô **Hỏi** truyền câu hỏi + ghi chú liên quan cho `openclaw agent` qua tham số dòng lệnh; trên VPS nhiều người dùng, user khác có thể thấy trong `ps` lúc lệnh đang chạy. VPS một người dùng thì không ảnh hưởng. (Chưa đổi vì chưa xác minh được `openclaw agent` có nhận nội dung qua stdin hay không.)
- Font Google trên trang web giữ nguyên cho đẹp; muốn hoàn toàn offline thì xoá 3 dòng `<link … fonts.googleapis …>` trong `public/index.html` (trang tự dùng font hệ thống).
- Trường `install` trong metadata (`kind: apt`/`shell`) giữ nguyên như bản gốc; công cụ vẫn cài tay theo `CAI-DAT.md`.
