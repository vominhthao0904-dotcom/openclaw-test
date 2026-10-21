# Đánh giá và tối ưu 4 skill nhóm A

Bản này là bản đã sửa. Đọc `CAI-DAT.md` để cài, `HUONG-DAN.md` để dùng. File này ghi lại **đã kiểm gì, sửa gì, vì sao**.

## Kết luận

Bản gốc đã tốt: không khoá API, chạy offline, có bộ test, giữ dữ liệu kỹ (cất kho, `deleted/`, sao lưu xoay vòng).
Nhưng kiểm kỹ thì có **2 lỗ hổng an toàn thật**, **4 lỗi làm việc cài/nâng cấp sai**, và nhiều chỗ skill chạy chậm
hoặc cho kết quả kém hơn mức có thể. Tất cả đã sửa và có test đi kèm.

| | Bản gốc | Bản này |
|---|---|---|
| Test `test-brain.sh` | 50 | **65** |
| Test `test-web.sh` | 30 | **45** |
| Mục `kiemtra.sh` | 22 | **26** (thêm phần An toàn) |
| Tìm cụm chữ trong PDF 300 trang | 3,5 giây | **0,1 giây** |
| Nhận ra ghi chú tiếng Việt viết lại cùng ý | Không | **Có** |
| Tìm bằng câu hỏi dài ("anh từng ghi gì về lỗi phụ đề") | 0 kết quả | **Ra kết quả** |

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

## Chưa làm (cố ý)
- Trang web không có HTTPS riêng — dựa vào đường hầm SSH (đã mã hoá). Không mở trang ra Internet.
- Ô **Hỏi** truyền câu hỏi + ghi chú liên quan cho `openclaw agent` qua tham số dòng lệnh; trên VPS nhiều người dùng, user khác có thể thấy trong `ps` lúc lệnh đang chạy. VPS một người dùng thì không ảnh hưởng. (Chưa đổi vì chưa xác minh được `openclaw agent` có nhận nội dung qua stdin hay không.)
- Font Google trên trang web giữ nguyên cho đẹp; muốn hoàn toàn offline thì xoá 3 dòng `<link … fonts.googleapis …>` trong `public/index.html` (trang tự dùng font hệ thống).
- Trường `install` trong metadata (`kind: apt`/`shell`) giữ nguyên như bản gốc; công cụ vẫn cài tay theo `CAI-DAT.md`.
