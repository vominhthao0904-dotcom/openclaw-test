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

**Bước 1 — trên VPS**, bật trang (chạy nền) — **anh tự gõ lệnh này trong Termius**, đừng nhờ Mây bật:
```bash
bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh start
```
Nó in ra lệnh đường hầm và **đường link có mã**, dạng `http://127.0.0.1:8787/?t=Abc…`. Quên link thì chạy `web.sh link`.

> **Vì sao tự bật:** trang web do Mây bật (lệnh chạy trong *exec* của agent) thì OpenClaw **chặn ô Hỏi** — chốt an toàn của OpenClaw: lệnh chạy từ exec của agent không được tạo lượt hỏi mới trên Gateway. Các phần khác vẫn dùng bình thường. Ô Hỏi báo *"Trang web đang chạy từ lệnh của Mây…"* thì anh chạy `web.sh restart` trong Termius là xong. Kiểm nhanh: `bash ~/.openclaw/workspace/skills/second-brain/scripts/web.sh status` → dòng **Ô Hỏi: không bị chặn**.

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

- **Toàn cảnh** — lõi **Thái Cực – Tiên Thiên Bát Quái** ở giữa (xem mục dưới), mỗi vòng quỹ đạo là một **vùng** (Kinh doanh, Kỹ thuật, Học tập…) với **màu riêng cố định** (cùng màu với chấm ở cây Thư viện; *Chưa xếp chỗ* màu xám, vòng ngoài cùng) — bao nhiêu vùng bấy nhiêu vòng (12 màu; từ vòng thứ 9 có thêm nét đứt). Vòng **dày hơn khi vùng nhiều ghi chú**, "thở" nhẹ, có **vệt sáng chạy dọc vòng** theo chiều xoay (theo nút tốc độ; dừng xoay thì dừng), mỗi chấm một ghi chú — rê chuột vào chấm để đọc đủ tên, đường nối là liên kết giữa các ghi chú. Bấm tên vùng ở dải dưới cùng để chỉ làm nổi vùng đó. **Tốc độ xoay**: bấm biểu tượng đồng hồ nhỏ, mờ ở góc dưới bên phải → hiện **−** / **+** (5 mức: Rất chậm · Chậm · Vừa · Nhanh · Rất nhanh) và **❚❚** dừng xoay; bảng tự ẩn sau vài giây. Biểu tượng chuyển vàng khi đang dừng. Trình duyệt nhớ lựa chọn cho lần mở sau. Dải tên vùng và biểu tượng tốc độ **tự ẩn sau 6 giây** không động vào màn hình — rê chuột hay chạm là hiện lại. **Nhấp đúp** (điện thoại: **chạm đúp**) vào chỗ trống của đồ thị → **toàn màn hình**, ẩn hết nút, đồ thị to hơn (bấm chấm vẫn mở ghi chú). Có hai chế độ: **có tên** và **chỉ chấm** — đổi bằng **nhấp 1 lần** (điện thoại: **chạm 1 lần**) vào chỗ trống, phím **T**, hoặc nút **Aa** nhỏ ở góc; trình duyệt nhớ chế độ anh chọn. **Cỡ chữ tự theo số ghi chú đang hiện**: ít ghi chú thì chữ to, tên dài, chấm to; nhiều thì chữ nhỏ lại cho đỡ chồng, vùng đông trải thành dải 3 làn, tên trùng nhau chỉ ghi một lần và nhiều chấm quá thì chỉ ghi ~18 tên chia đều các vùng (rê chuột vào chấm vẫn đọc được tên); nhấp đúp lần nữa hoặc **Esc** để thoát. Đây là bức tranh chung, không phải mục lục.
- **Thư viện** — chỗ truy xuất có hệ thống. Bên trái là **cây Vùng › Nhóm › Nhóm con** kèm số ghi chú (bấm ▸ để mở nhóm con; *Chưa xếp chỗ* màu vàng là chỗ cần dọn). Bên phải là các thẻ ghi chú, lọc nhanh bằng **chip loại** (Kiến thức, Quy trình, Khái niệm, Tài liệu…; số trên chip đếm trong nhóm đang xem; bấm sang nhóm khác trên cây thì bỏ lọc, để số trên cây khớp số trong danh sách), sắp theo mới sửa / mới tạo / cũ nhất / tên, bấm *Xem thêm* để xem tiếp. Mỗi thẻ ghi rõ loại, đường dẫn nhóm, có nguồn/trích dẫn không, hạn (nếu là việc). Có file từng nạp kiểu *mỗi trang 1 ghi chú* (tên dạng "… — trang 5") thì đầu Thư viện hiện dòng vàng **«tên file» đang là N ghi chú — Gộp thành 1 ghi chú**: bấm là nối các trang theo thứ tự thành một ghi chú (giữ thẻ, liên kết); các ghi chú trang vào *Kho lưu* — không mất, lấy lại được.
- **Việc** — việc cần làm xếp theo **Quá hạn** (đỏ cam) · **Hôm nay** · **7 ngày tới** · **Sau này** · **Không hạn**. Tích ô vuông là xong. **Bộ lọc** trên danh sách: **Chưa làm** · **Đang chờ** · **Đã xong** · **Tất cả**, mỗi nút kèm số việc; trình duyệt nhớ bộ lọc anh chọn. Việc đã làm phần mình, đang **đợi người khác / đợi kết quả** (đã gửi báo giá, chờ khách ký): bấm **Chờ** ở dòng việc — việc chuyển sang *Đang chờ* (ghi "đang chờ từ 3 ngày trước"), bấm **Làm tiếp** để đưa về *Chưa làm*. Trong thẻ chi tiết của việc cũng có nút **Đang chờ** / **Hết chờ**. Tích xong thì tự hết chờ; ở *Đã xong* bỏ tích là mở lại việc. **Tạo việc ngay trên đầu cột**: gõ việc (vd "Gọi chị Lan báo giá"), chọn **hạn** và **nhóm** nếu muốn, bấm **Thêm việc** hoặc Enter — việc hiện ngay vào đúng nhóm hạn. Việc lặp lại cùng tên ("Nộp báo cáo tuần") thêm được nếu khác hạn; cùng tên cùng hạn thì báo trùng kèm nút mở việc đã có. Việc chưa có nhóm không bị tính vào *Chưa xếp chỗ*. Cần ghi chi tiết (các bước, ghi chú dài) thì dùng tab **Thêm**, chọn loại *Việc*.

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
- **Khí vận hành**: một luồng sáng chạy quanh vành Bát Quái theo **âm dương tiêu trưởng** — Dương sinh ở Chấn → Ly → Đoài → cực thịnh ở Càn; Âm sinh ở Tốn → Khảm → Cấn → cực thịnh ở Khôn → lại về Chấn (trên màn hình là chiều kim đồng hồ, khớp hướng đầu cá Dương và đầu cá Âm). Nửa trái khí **vàng kim**, mạnh dần tới Càn; nửa phải khí **xanh**, đậm dần tới Khôn; qua Càn khí đổi sang xanh ("Dương cực thì Âm sinh"), qua Khôn đổi sang vàng ("Âm cực thì Dương sinh"). Quầng sáng quanh Thái Cực "thở" chậm.
- **Mặt A.I (nút ẩn)** — **bấm vào lõi Bát Quái** (hoặc phím **M**): từ lõi tuôn ra **hai luồng Âm Dương** — Dương **vàng kim**, Âm **xanh lam** — xoáy như Thái Cực và đan cắt qua nhau; quanh đó **vòng Tiên Thiên Bát Quái** hiện dần đúng phương vị (Càn trên, Khôn dưới, Ly trái, Khảm phải; hào dương vàng, hào âm lam), sáng lần lượt theo chiều khí Chấn → Ly → Đoài → Càn rồi Tốn → Khảm → Cấn → Khôn. Rồi hai luồng gỡ thành **đầu A.I hologram** — các đường vân dài, liền, cách đều như vân tay: vòng quanh mắt, tai; dọc má, dọc sống mũi; ngang trán, môi, cằm; cổ thành vòng ngang chảy xuống vai. Đầu hai luồng bay vào làm **hai mắt**, lõi Bát Quái xuống **giữa ngực**. Trong đầu là **bộ não phát sáng**: mỗi ghi chú là một **nơ-ron** mang màu vùng; mỗi vùng là một **vòng tròn quanh đầu** (số ở giữa = số ghi chú), nối mạng vào não.
  - Quanh đầu là **ba vòng nét đứt xoay** — xanh lam, vàng kim, cam (màu của luồng Dương và lõi Bát Quái), xoay xen kẽ chiều nhau; vòng khép kín như vầng hào quang, phần đi qua sau cổ và vai thì khuất.
  - Đầu **quay nhìn theo con trỏ chuột** (điện thoại: lắc nhẹ), chớp mắt; **Mây nhép miệng và hiện phụ đề** khi chào, khi anh bấm một nơ-ron (mở ghi chú, đọc tên), bấm một vòng vùng (đọc tên vùng + số ghi chú, đường nối của vùng sáng lên) và khi trả lời ở tab **Hỏi**.
  - Các vòng vùng và đường nối vào não **tự mờ đi** sau vài giây không động vào màn hình; rê chuột hay chạm là hiện lại.
  - **Nói với Mây** — nút **micro** cạnh nút loa: bấm rồi nói. *"Tìm bê tông"* → Mây đọc số ghi chú tìm thấy và ghi chú đầu, các nơ-ron đó nháy sáng, danh sách đủ ở tab Tìm. *"Mở sinh nhật mẹ"* → mở ghi chú khớp nhất. *"Ghi chú mai họp lúc 8 giờ"* → chép vào ô Thêm để anh đặt chủ đề, xem lại rồi bấm Lưu (Mây không tự lưu). *"Thoát"* → về quỹ đạo. Nói câu khác → Mây hỏi kho như tab Hỏi rồi đọc câu trả lời.
  - Bấm lõi lần nữa, phím M hoặc **Esc** để về — chạy ngược lại: đầu tan thành hai luồng, xoáy về lõi. Dùng chung được với toàn màn hình. Máy bật "giảm chuyển động" thì chuyển ngay, không chạy hiệu ứng.
- **Tiếng nói của Mây** (chế độ mặt A.I): Mây **đọc thành tiếng**, miệng nhép và phụ đề chạy theo đúng chữ đang đọc. Nút **loa** ở góc trên bên phải để tắt/bật (trình duyệt nhớ). Mặc định chỉ dùng **giọng cài sẵn trong máy**, nên không có gì rời khỏi máy anh. Máy chưa có giọng tiếng Việt thì Mây nói bằng **giọng nữ tiếng Anh** trong máy (Windows "Zira"): câu chào, câu báo vùng nói bằng tiếng Anh; tên ghi chú, câu trả lời đọc không dấu; phụ đề vẫn tiếng Việt đủ dấu. Máy không có giọng nào thì nút loa chuyển **vàng, có chấm đỏ** và Mây chỉ hiện phụ đề.
  - **Máy Windows dùng Chrome: Chrome không dùng được giọng tiếng Việt của Windows** (chỉ thấy giọng tiếng Anh) — nên Mây nói tiếng Anh. Muốn Mây nói **tiếng Việt**: mở trang Second Brain bằng **Microsoft Edge** (dán cùng đường link vào Edge).
  - **Trong Edge**, chọn một trong hai:
    - Cài giọng tiếng Việt cho Windows — **riêng tư, đọc ngay trong máy**: Cài đặt › Thời gian và ngôn ngữ › Giọng nói › *Thêm giọng nói* › chọn **Tiếng Việt** (giọng "Microsoft An"), rồi mở lại Edge.
    - Hoặc bấm nút loa → Mây hỏi có dùng **giọng đọc qua mạng của Microsoft** (HoaiMy, NamMinh — giọng rất tự nhiên) không. Bấm **OK** thì nghe được ngay, nhưng chữ Mây đọc (lời chào, tên ghi chú, câu trả lời) được gửi lên máy chủ Microsoft để đọc. Tắt tiếng là bỏ quyền này (bật lại sẽ hỏi lại).
  - **Android**: Cài đặt › Hệ thống › Ngôn ngữ › Chuyển văn bản thành giọng nói › Công cụ của Google › tải **Tiếng Việt**.
  - **iPhone**: Cài đặt › Trợ năng › Nội dung được đọc › Giọng nói › Tiếng Việt › tải giọng **Linh**.
- **Các vòng như vũ trụ**: vòng trong xoay nhanh, vòng ngoài chậm (như hành tinh — định luật Kepler); **vòng dương** (1, 3, 5…) xoay thuận chiều khí, **vòng âm** (2, 4, 6…) xoay ngược — âm dương đối đãi. Nền có sao lấp lánh nhẹ.
- Lõi **nhỏ gọn** (cỡ chữ BRAIN cũ) để đồ thị thoáng. **Rê chuột vào lõi** thì nó phóng to mượt, hiện tên 8 quẻ và phương vị; bỏ chuột ra là thu nhỏ lại. Biểu tượng này cũng là icon trên tab trình duyệt.

### Cột trái

Trang nhớ tab anh dùng lần trước. Mở lần đầu trên **điện thoại** thì vào thẳng tab **Tìm** (gọn), đồ thị nằm ngay bên dưới — ghi chú mới trên điện thoại nhắn qua Telegram tiện hơn.


- **Thêm** — lưu ghi chú mới: chủ đề, **loại**, **nhóm** (gõ vài chữ là hiện các nhóm đã có — chọn lại nhóm cũ thay vì gõ ra nhóm mới gần giống), thẻ, nội dung. Chọn loại *Việc* thì hiện ô **Hạn**; chọn *Tài liệu* hay *Khái niệm* thì hiện ô **Trích dẫn**. Lưu bản y hệt ghi chú đã có thì bị chặn kèm nút mở bản cũ; gần giống thì được lưu nhưng có cảnh báo; gõ nhóm/thẻ thiếu dấu hay sai chính tả thì có gợi ý. Ô **Nguồn** và **Trích dẫn**: bấm vào ô (hoặc gõ vài chữ, ví dụ "wikipedia") là hiện các nguồn **đã dùng trong kho**, kèm tên ghi chú dùng nguồn đó — chọn là xong, khỏi chép lại. Nguồn mới thì dán link (copy từ thanh địa chỉ trình duyệt); nguồn không phải link (sách, người kể, tài liệu giấy) ghi vào Trích dẫn.
- **Nạp** — kéo thả file **.md / .txt / Word .docx / PDF** hoặc dán văn bản. Chọn **nhiều file** một lúc (giữ Ctrl khi bấm), hoặc bấm *chọn file* thêm lần nữa để **cộng thêm** vào danh sách; mỗi file dưới 4 MB, tổng một lần nạp ~7 MB (quá thì trang báo file nào để đợt sau). **Mỗi file thành một ghi chú** (một chủ đề, một chấm ở Toàn cảnh) — kể cả cuốn PDF dài: tìm vẫn ra, và ô Hỏi tự lấy đúng đoạn liên quan bên trong. Tên ghi chú PDF lấy từ tiêu đề ghi trong file (có dấu), không có mới lấy tên file. Muốn tách nhỏ thì chọn ở ô **Tách**: *Mỗi tiêu đề 1 ghi chú* (Markdown `#`/`##`, Word Heading 1/2) hoặc *Mỗi trang PDF 1 ghi chú*. Ô **Tên ghi chú** (tuỳ chọn): đặt tên khi nạp ra đúng 1 ghi chú; bỏ trống thì lấy tên trong file — kiểu **Title** của Word; hoặc tiêu đề đầu file nếu đó là tên tài liệu (phía sau chỉ có tiêu đề cấp nhỏ hơn). File mở đầu bằng một mục ("Tiếp nhận sự cố" rồi "Sửa chữa"), hoặc mục đánh số ("1. Cần chuẩn bị gì?", "Bước 1…"), thì lấy tên file — giữ nguyên dấu " - " trong tên ("QUY TRÌNH … THANG MÁY - LƯU ĐỒ …"). Chọn nhiều file hoặc tách nhỏ thì ô Tên tự tắt (mỗi ghi chú lấy tên riêng). Ô **Dán nội dung** lúc nào cũng gõ được, kể cả khi đã chọn file: có cả file lẫn chữ dán thì **nạp cả hai** — chữ dán thành một ghi chú riêng (tên lấy dòng đầu), ô Tên đặt cho file; ngay dưới ô dán có dòng vàng báo trước điều này kèm chữ đầu của đoạn dán. Chỉ muốn nạp file thì xoá chữ trong ô dán. Không chọn file thì ô Tên đặt tên cho chữ dán. Lỡ gõ tên vào ô dán rồi mới chọn 1 file thì dòng đó tự chuyển sang ô Tên. Kết quả ghi rõ từng ghi chú *từ file …* hay *từ ô dán*. File Word đời cũ (.doc): mở bằng Word, *Lưu thành* .docx. PDF dạng ảnh scan không có chữ — cần OCR trước. Đặt nhóm, loại, thẻ chung cho cả lô; bấm **Xem trước** để thấy sẽ thêm gì, rồi **Nạp vào kho**. Bản trùng tự bỏ qua.
- **Tìm** — tìm toàn văn tiếng Việt, **có dấu hay không dấu đều được**, lọc thêm theo **loại** và **vùng**. Gõ nhiều chữ thì tìm **đúng cụm liền nhau** trước ("kinh doanh" không ra ghi chú chỉ có "kinh nghiệm… doanh thu"); không ghi chú nào có đúng cụm mới tìm các chữ rời. Khớp ở tiêu đề/thẻ được xếp trên. Gõ cả câu dài cũng được. Trên máy tính bấm phím **/** là nhảy ngay vào ô Tìm.
- **Hỏi** — hỏi Mây dựa trên chính ghi chú trong kho; câu trả lời kèm danh sách ghi chú nguồn bấm được. Mây chỉ nhận câu hỏi và vài ghi chú liên quan (không phải cả kho) — như một tin nhắn anh gửi Mây, đi qua mô hình AI mà Mây đang dùng. Câu trả lời hiện đúng định dạng (chữ đậm, dòng lệnh, danh sách); chỗ Mây dẫn nguồn là **nút vàng mang tên ghi chú** — bấm để mở ghi chú đó. Ghi chú dài (cả một file) thì Mây nhận các đoạn có từ khoá của câu hỏi chứ không phải mấy trang đầu. Câu hỏi đi vào **phiên riêng "second-brain"** của Mây — không lẫn vào cuộc trò chuyện Telegram. Mây lỗi (Gateway tắt…) thì trang báo đúng lý do và vẫn liệt kê các ghi chú liên quan để anh tự mở đọc. Trang web do Mây bật thì ô Hỏi bị OpenClaw chặn — tự bật lại trong Termius (xem *Mở giao diện web*, Bước 1).
- **Nhập bằng giọng nói** — ô Chủ đề, Nội dung, ô dán ở Nạp, ô Tìm và ô Hỏi có nút **micro** ở góc phải: bấm rồi nói, chữ hiện vào ô; bấm lại để dừng. Ghi chú nhập bằng giọng tự gắn thẻ `giong-noi` (để sau rà lại); anh xem lại rồi mới bấm Lưu. Ô Hỏi: nói xong là hỏi luôn. Lưu ý riêng tư: bộ nhận giọng của **Chrome gửi âm thanh lên máy chủ Google**, **Edge lên Microsoft** để chuyển thành chữ — nên lần đầu bấm micro mỗi khi mở trình duyệt, trang sẽ hỏi anh đồng ý. Firefox không có bộ nhận giọng nên không hiện nút micro.
- **Ôn** — *Chưa xếp chỗ*, *Kho lưu* (ghi chú đã cất, lấy lại được; các trang của cùng một file đã gộp nằm gọn trong **một dòng** "«tên file» — N trang", bấm để bung ra), và hàng chờ ôn lại (không gồm việc).

### Thẻ chi tiết (bấm vào bất kỳ ghi chú nào)

Trên cùng là **đường dẫn nhóm** — bấm từng tầng để mở đúng nhóm đó trong Thư viện. Rồi tới nhãn **loại**, các **thẻ** (bấm để lọc Thư viện theo thẻ), tiêu đề, ngày ghi/sửa/ôn, mã ghi chú. Khối **Nguồn · Trích dẫn · Hạn** cho biết kiến thức này lấy từ đâu — để kiểm lại khi cần. Cuối là **Ghi chú liên kết** (bấm để chuyển sang). Nút: **Sửa** (đổi được mọi trường), **Nhớ rồi**, **Đánh dấu xong** (với việc), **Cất vào kho lưu**. **Đóng thẻ**: bấm ×, phím Esc, hoặc **bấm vào chỗ trống bên ngoài thẻ** (bấm ghi chú khác thì thẻ chuyển sang ghi chú đó; đang Sửa thì thẻ không tự đóng, khỏi mất chữ đang gõ).

**Chuột phải** vào một ghi chú — thẻ trong Thư viện, kết quả Tìm / Hỏi / Nạp, việc, chấm trên đồ thị (điện thoại: **chạm giữ**) — hiện menu **Mở · Sửa · Cất vào kho lưu** (chạm giữ chạy cả trên iPhone lẫn Android). Muốn **xoá** một ghi chú: chọn *Cất vào kho lưu* (ghi chú biến khỏi đồ thị, Thư viện, tìm kiếm; lấy lại được ở tab **Ôn** → *Kho lưu*). Ghi chú trong *Kho lưu* thì menu là **Mở · Sửa · Lấy lại khỏi kho lưu**. Cất xong, kết quả Tìm tự cập nhật; nút trỏ tới ghi chú đó trong kết quả Hỏi / Nạp mờ đi, gạch ngang. Xoá hẳn thì nhờ Mây (xem *Cất kho và xoá hẳn* bên dưới).

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

Có sẵn ghi chép cũ (Obsidian, Notion xuất Markdown, file Word .docx), tài liệu khoá học, quy chuẩn PDF, danh sách Excel lưu .csv? Vài file thì kéo thả ở tab **Nạp** trên web; cả thư mục thì nhờ Mây:
> "Nạp thư mục ~/ghi-chep vào kho, nhóm Học tập/Khoá học."

> "Nạp file QCVN-nuoc.pdf vào kho, loại tài liệu, nhóm Kỹ thuật/Tiêu chuẩn."

Một file là một ghi chú — gọn, một chấm. Chỉ nói *"mỗi trang một ghi chú"* khi thật cần trích dẫn từng trang (quy chuẩn, giáo trình); lỡ tách rồi thì gộp lại: bấm **Gộp thành 1 ghi chú** ở Thư viện, hoặc nhờ Mây *"gộp các trang của file … lại"* (`$BR gop-trang` xem trước, thêm `--yes` để gộp).

Mây xem trước rồi báo *sẽ thêm bao nhiêu ghi chú, vào nhóm nào*, anh đồng ý mới nạp. Hoặc tự chạy:
```bash
BR="python3 ~/.openclaw/workspace/skills/second-brain/scripts/brain.py"
$BR nap ~/ghi-chep --category "Học tập/Khoá học" --dry-run    # xem trước
$BR nap ~/ghi-chep --category "Học tập/Khoá học"              # nạp thật
```
Markdown có tiêu đề `##` → mỗi mục một ghi chú; có frontmatter (`category:`, `tags:`, `kind:`, `url:`) thì dùng luôn. CSV cần dòng tiêu đề cột: `tieu_de,noi_dung,nhom,the,loai,han`. Nạp lại cùng thư mục không sinh bản trùng.

### Việc cần làm

> "Nhắc anh gọi chị Lan về bảo trì vào thứ sáu."

Mây lưu thành ghi chú loại *Việc*, đổi "thứ sáu" ra ngày cụ thể và đọc lại cho anh xác nhận. Hỏi *"hôm nay có việc gì?"* là Mây liệt kê việc quá hạn trước. Trên web: chế độ **Việc** — gõ việc vào ô trên đầu cột rồi Enter là tạo xong; tích ô vuông là xong việc.

> "Báo giá gửi chị Lan rồi, đang chờ chị ấy trả lời."

Mây chuyển việc đó sang **Đang chờ**. Hỏi *"hôm nay có việc gì?"* thì Mây nói việc cần làm trước, việc đang chờ nói riêng sau.

### Dùng bằng giọng nói

Anh nói thay vì gõ được, bằng 2 cách:

| Cách | Làm thế nào | Cần cài gì |
|---|---|---|
| **Đọc chính tả bằng bàn phím** | Trong ô nhắn Telegram, bấm micro **trên bàn phím** (Gboard, bàn phím iPhone), nói, xem lại chữ rồi gửi | Không — dùng được ngay |
| **Tin nhắn thoại** | Giữ nút micro **của Telegram** để ghi âm, gửi cho Mây | OpenClaw phải bật chức năng chép giọng nói thành chữ — thử gửi một tin thoại ngắn là biết |

Giọng nói chép thành chữ hay sai dấu, sai tên riêng, sai con số. Vì vậy Mây **không lưu ngay** mà đọc lại trước:

> 📝 Gọi chị Lan về bảo trì hệ lọc tổng\
> Nhóm: Kinh doanh › Khách hàng · Loại: Việc · Thẻ: khach-lan, giong-noi · Hạn: 07/11/2026\
> Hỏi tình trạng lõi lọc, hẹn ngày thay.\
> Lưu nhé?

- Đúng thì trả lời **"ok"**. Sai chỗ nào thì nói chỗ đó ("hạn là thứ bảy", "tên là Lành"), Mây sửa rồi đọc lại.
- Có **tên người, số tiền, số đo, số điện thoại, ngày giờ** thì Mây luôn hỏi lại, đọc bằng số cho dễ soát.
- Một tin thoại nói nhiều ý → Mây tách mỗi ý một ghi chú, đánh số, anh "ok" một lần cho cả lô hoặc "bỏ số 2".
- Lệnh xoá, gộp, cất kho, đánh dấu xong bằng giọng nói → Mây nhắc lại đúng ghi chú và hành động, chờ anh xác nhận.
  Nói "xoá" thì Mây đề nghị **cất kho** (lấy lại được), chỉ xoá hẳn khi anh nói rõ "xoá hẳn".
- Ghi chú từ giọng nói được gắn thẻ **giong-noi**. Thỉnh thoảng rà lại: *"liệt kê các ghi chú giọng nói tuần này"*,
  hoặc trên web: Thư viện → bấm thẻ *giong-noi*.
- Hỏi bằng giọng: *"anh từng ghi gì về phụ đề không hiện?"* — Mây trả lời câu ngắn, dẫn mã ghi chú ở cuối.
- **Đừng đọc mật khẩu, số thẻ, số CCCD** — Mây sẽ không ghi, và tin thoại có thể còn nằm trong lịch sử Telegram.

**Tìm không dấu:** gõ *"loc nuoc"*, *"duong ong"* vẫn ra "lọc nước", "đường ống" — cả khi nhắn Mây lẫn ô **Tìm** trên web.
Kết quả chỉ khớp khi bỏ dấu ("ban" có thể là "bán" hay "bàn") được ghi chú rõ để anh kiểm lại.

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
| `bất động sản vay ngân hàng` | `bất-động-sản-vay-ngân-hàng` | một thẻ dài — thiếu dấu phẩy |
| `#landing #mobile` | `landing` `mobile` | đúng |

Các thẻ **ngăn bằng dấu phẩy** (hoặc chấm phẩy, xuống dòng, hay viết kiểu `#thẻ1 #thẻ2`); khoảng trắng bên trong một thẻ thành gạch nối. Không có dấu ngăn nào thì **cả cụm là một thẻ** — chữ tiếng Việt nhiều âm tiết không còn bị băm thành từng chữ (trước đây `Hướng dẫn cài đặt` thành 4 thẻ `hướng` `dẫn` `cài` `đặt`).

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

Kiến thức được giữ ở **3 nơi**, mất một nơi vẫn còn hai:

| Nơi | Bản nào | Tự động? | Chống được |
|---|---|---|---|
| **VPS** | Kho + 60 bản chụp gần nhất | Mỗi đêm 2h17 (Bước 5) | Xoá nhầm, sửa nhầm, file kho hỏng |
| **Google Drive — mã hoá** | Mỗi ngày một bản, giữ 90 ngày | Mỗi đêm 2h47 (Bước 6) | VPS hỏng / hết hạn / bị xoá; mất máy tính |
| **Máy tính của anh** | Một bản mỗi tháng | Anh tự kéo về | Mất cả VPS lẫn tài khoản Google |

**Google Drive** (sau khi làm Bước 6): không phải làm gì thêm. Xem nhanh tình trạng:
```bash
bash ~/.openclaw/workspace/skills/second-brain/scripts/sao-luu-drive.sh kiem
```
Hoặc nhờ Mây: *"bản sao lưu Drive gần nhất là khi nào?"*. Trên Drive, thư mục **SecondBrain** chỉ toàn tên vô nghĩa — đúng, đó là dữ liệu đã mã hoá; Google không đọc được.

**Khi gặp sự cố — lấy lại từ Drive:**
```bash
BRAIN_SH=~/.openclaw/workspace/skills/second-brain/scripts
bash $BRAIN_SH/sao-luu-drive.sh ds
bash $BRAIN_SH/sao-luu-drive.sh khoi-phuc
bash $BRAIN_SH/sao-luu-drive.sh khoi-phuc 2026-11-05
```
`ds` liệt kê các bản theo ngày; `khoi-phuc` tải bản mới nhất (hoặc đúng ngày chỉ định) về **file riêng**, kiểm tra nguyên vẹn, báo số ghi chú, rồi in sẵn lệnh để thay kho — kho đang dùng không bị đụng cho tới khi anh tự chạy lệnh đó.

**VPS mới hoàn toàn** (VPS cũ mất hẳn): cài lại theo CAI-DAT.md Bước 1-5; Bước 6 tạo lại 2 kết nối, riêng ở 6.4 chọn **y** (tự gõ mật khẩu) và gõ **đúng 2 mật khẩu đã ghi lại**; rồi chạy `sao-luu-drive.sh khoi-phuc` và làm theo lệnh nó in ra.

**Máy tính:** mỗi tháng kéo một bản về (Termius/WinSCP: kéo file qua SFTP cũng được):
```bash
scp root@IP_VPS:~/.openclaw/workspace/second-brain/backups/notes-latest.sqlite ~/brain-$(date +%Y-%m).sqlite
```
> Nếu thư mục trên máy tính đang **đồng bộ với Google Drive** thì file kéo về sẽ lên Drive ở dạng **chưa mã hoá**. Để nó ở thư mục không đồng bộ, hoặc nén bằng 7-Zip có mật khẩu (AES-256) trước.

Lịch sao lưu trên VPS đã bật ở **Bước 5 khi cài** (CAI-DAT.md). Chưa bật thì dán khối này — dán lại bao nhiêu lần cũng không tạo dòng trùng:
```bash
CU="$(crontab -l 2>/dev/null | grep -v 'second-brain/scripts/brain.py snapshot')"
{ [ -n "$CU" ] && printf '%s\n' "$CU"
  echo '17 2 * * * python3 $HOME/.openclaw/workspace/skills/second-brain/scripts/brain.py snapshot >/dev/null 2>&1'
} | crontab -
crontab -l | grep snapshot
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
| `backups/drive-last.json`, `drive.log` | Lần sao lưu Drive gần nhất, nhật ký | `drive.log` không tự dọn (rất nhỏ) |

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
