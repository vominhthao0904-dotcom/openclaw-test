/* Second Brain — ba cách nhìn vào cùng một kho:
   Toàn cảnh (đồ thị quanh lõi BRAIN, mỗi vòng một VÙNG), Thư viện (duyệt theo cây nhóm + loại),
   Việc (việc cần làm theo hạn). Cột trái: Thêm / Nạp / Tìm / Hỏi / Ôn. */
'use strict';

const $ = (s) => document.querySelector(s);
/* Mọi lỗi mạng/máy chủ đều quy về {ok:false,error}. Trước đây fetch hỏng là trang
   đứng im không nói gì — tắt server trên VPS là bấm nút không thấy phản ứng. */
const api = async (path, body) => {
  try {
    const r = await fetch(path, body
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : undefined);
    const t = await r.text();
    try {
      return JSON.parse(t);
    } catch {
      return { ok: false, error: `Máy chủ trả về nội dung lạ (mã ${r.status})` };
    }
  } catch {
    return { ok: false, error: 'Mất kết nối tới máy chủ Second Brain. Kiểm tra server.py còn chạy và đường hầm SSH còn mở không.' };
  }
};

/* màu vùng — họ xanh dương / vàng kim / cam, xen kẽ để hai vòng cạnh nhau luôn khác tông */
// 12 màu tách bạch trên nền xanh đậm: 3 màu chủ đạo (vàng kim, xanh dương, cam) + 9 màu phân biệt, cách đều
// nhau trên vòng màu và cùng độ sáng tương đối (không vùng nào "nặng" hơn vùng nào). 8 màu đầu khác hẳn nhau;
// từ vùng thứ 9 vòng vẽ thêm nét đứt để 10–12 vòng vẫn phân biệt được.
const MAU = ['#D4AF37', '#3E8EDE', '#F07F2D', '#2EC4B6', '#A78BFA', '#E8708F', '#8BCB6B', '#7DCBF5',
             '#D16BE0', '#5BE0A4', '#FF8A65', '#9AA8FF'];
const MAU_CHUA = '#8A9BB5';   // "Chưa xếp chỗ" không phải một vùng — màu trung tính, nằm vòng ngoài cùng
const CHUA = 'Chưa xếp chỗ';
let mauVung = {};
/* Màu GẮN VỚI TÊN vùng, không theo thứ tự đông/vắng: vùng tăng giảm ghi chú vẫn giữ màu của nó.
   Băm tên ra một ô màu; ô đã có vùng khác thì lấy ô trống kế tiếp (không trùng khi ≤ 8 vùng). */
function ganMau(dsTen) {
  const ra = {}, dung = new Set();
  [...dsTen].sort((a, b) => a.localeCompare(b, 'vi')).forEach((t) => {
    let h = 0;
    for (const ch of t.normalize('NFC')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    let i = h % MAU.length;
    for (let k = 0; k < MAU.length && dung.has(i); k++) i = (i + 1) % MAU.length;
    dung.add(i);
    ra[t] = MAU[i];
  });
  return ra;
}
const mauCua = (vung) => (vung === CHUA ? MAU_CHUA : mauVung[vung] || MAU_CHUA);

/* Loại kiến thức — trục phân loại thứ hai (nhóm = chủ đề, loại = dạng kiến thức). */
const LOAI = {
  'kien-thuc': { ten: 'Kiến thức', mau: '#D4AF37' },
  'quy-trinh': { ten: 'Quy trình', mau: '#3E8EDE' },
  'khai-niem': { ten: 'Khái niệm', mau: '#8EC1F5' },
  'tai-lieu': { ten: 'Tài liệu', mau: '#E9D8A6' },
  'y-tuong': { ten: 'Ý tưởng', mau: '#6FB1F2' },
  'viec': { ten: 'Việc', mau: '#F07F2D' },
  'nguoi': { ten: 'Người', mau: '#EEF3FA' },
  'nhat-ky': { ten: 'Nhật ký', mau: '#8A9BB5' },
};
const tenLoai = (k) => LOAI[k]?.ten || 'Kiến thức';
const vungCua = (c) => (c || '').split('/')[0] || 'Chưa xếp chỗ';
const duongDep = (c) => (c || 'Chưa xếp chỗ').split('/').join(' › ');
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

let DATA = { notes: [], categories: {}, links: [], cay: [], loai: [] };
let vungSo = {};          // số ghi chú THẬT của từng vùng (gồm mọi nhóm con)
let nodes = [];
let dsVung = [];         // tên các vùng theo thứ tự vòng (trong → ngoài) — các vòng tròn quanh đầu A.I
let vongMau = [];        // màu theo thứ tự vòng
let tocVong = [];        // tốc độ góc theo thứ tự vòng (dấu = chiều xoay)
let noiBat = null;       // tên nhóm đang được làm nổi, null = không lọc
let quay = true;
let tapTrung = false;    // nhấp đúp: toàn màn hình — lõi, chấm và tên, ẩn mọi nút
let hienTen = true;      // toàn màn hình: có tên / chỉ chấm (nhấp 1 lần, phím T, nút Aa) — trình duyệt nhớ
try { if (localStorage.getItem('sb.hienTen') === '0') hienTen = false; } catch (_) { /* mặc định có tên */ }
let goc = 0;
let hover = null;
let chon = null;

const itMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (itMotion) quay = false;

// tốc độ xoay — 5 mức, "Vừa" là mặc định. Hệ số nhân với tốc độ gốc (bản đầu: vòng trong cùng ~6 phút một vòng —
// quá chậm, nay là mức "Rất chậm"). Vòng trong cùng hết một vòng: Vừa ≈ 75 giây, Rất nhanh ≈ 20 giây; vòng ngoài chậm hơn. Trình duyệt này nhớ lựa chọn cho lần mở sau
// (chặn lưu trữ, cửa sổ ẩn danh… thì dùng mặc định, trang vẫn chạy bình thường).
const MUC_TOC = [['Rất chậm', 1], ['Chậm', 2.5], ['Vừa', 5], ['Nhanh', 10], ['Rất nhanh', 20]];
let mucToc = 2;
try {
  const m = localStorage.getItem('sb.mucToc');
  if (m !== null && /^[0-4]$/.test(m)) mucToc = Number(m);
  const q = localStorage.getItem('sb.quay');
  if (q === '0' || q === '1') quay = q === '1';
} catch (_) { /* không lưu được thì thôi */ }

/* ---------------- nạp dữ liệu ---------------- */
async function nap() {
  const kq = await api('/api/notes');
  if (!kq.ok || !Array.isArray(kq.notes)) {
    $('#count').textContent = kq.error || 'Không nạp được kho';
    return;
  }
  DATA = { categories: {}, links: [], ...kq };
  // tong_ghi_chu là số THẬT trong kho; DATA.notes có thể đã bị máy chủ cắt bớt cho nhẹ
  const n = DATA.tong_ghi_chu ?? DATA.notes.length;
  const soVung = (DATA.cay || []).filter((c) => c.duong_dan).length;
  $('#count').textContent = n ? `${n} ghi chú · ${soVung} vùng · ${Object.keys(DATA.categories).filter((k) => k !== 'Chưa phân loại').length} nhóm` : 'Kho đang trống';
  $('#trong').hidden = n > 0;
  const cho = DATA.cho_phan_loai || 0;
  const nut = $('#choPhanLoai');
  nut.textContent = cho ? `${cho} ghi chú chưa xếp chỗ →` : '';
  nut.hidden = !cho;
  vungSo = {};
  (DATA.cay || []).forEach((v) => { vungSo[v.ten] = v.so; });
  mauVung = ganMau((DATA.cay || []).map((v) => v.ten).filter((t) => t && t !== CHUA));
  // gợi ý nhóm = mọi đường dẫn đã có, để chọn lại đúng nhóm cũ thay vì gõ ra nhóm mới gần giống
  const dl = $('#dsNhom');
  dl.innerHTML = '';
  const duyet = (ds) => ds.forEach((c) => {
    if (c.duong_dan) { const o = document.createElement('option'); o.value = c.duong_dan; o.label = `${duongDep(c.duong_dan)} (${c.so})`; dl.appendChild(o); }
    duyet(c.con || []);
  });
  duyet(DATA.cay || []);
  // gợi ý ô Nguồn / Trích dẫn: nguồn đã dùng trong kho — bấm vào ô hoặc gõ vài chữ (một phần link) để chọn lại,
  // khỏi chép tay; nhãn là tên ghi chú dùng nguồn đó gần nhất
  [['#dsNguon', DATA.nguon_da_dung], ['#dsTrich', DATA.trich_da_dung]].forEach(([id, ds]) => {
    const box = $(id);
    box.innerHTML = '';
    (ds || []).forEach((x) => {
      const o = document.createElement('option');
      o.value = x.gia_tri;
      o.label = (x.tieu_de || '') + (x.so > 1 ? ` · ${x.so} ghi chú` : '');
      box.appendChild(o);
    });
  });
  const v = DATA.viec_dang_mo || 0;
  $('#viecMo').textContent = v ? `${v} việc đang mở →` : '';
  $('#viecMo').hidden = !v;
  dienChon();
  dungQuyDao();
  if (xem === 'thu-vien') veCay();
  if (xem === 'viec') napViec();
  // tab Ôn đang mở: hộp "Chưa xếp chỗ" và nút Kho lưu đọc số từ kho vừa tải — vẽ lại. Trước đây mở lại trang thẳng vào tab Ôn
  // thì hai phần này vẽ lúc kho chưa tải xong (tưởng trống) rồi không vẽ lại: mất nút "Kho lưu (26)".
  if (!$('[data-pane="on"]').hidden) { veHopCho(); veKhoLuu(); }
}

/* Các ô chọn loại / vùng: đổ một lần, giữ lựa chọn đang có. */
function dienChon() {
  const dem = Object.fromEntries((DATA.loai || []).map((x) => [x.kind, x.so]));
  [['#chonLoai', false], ['#suaLoai', false], ['#napLoai', 'Theo file'], ['#timLoai', 'Mọi loại']]
    .forEach(([sel, dauTien]) => {
      const o = $(sel), cu = o.value;
      o.innerHTML = '';
      if (dauTien) o.appendChild(new Option(dauTien, ''));
      Object.entries(LOAI).forEach(([k, v]) => o.appendChild(new Option(dauTien && sel === '#timLoai' ? `${v.ten} (${dem[k] || 0})` : v.ten, k)));
      if (cu) o.value = cu;
    });
  const tn = $('#timNhom'), cu = tn.value;
  tn.innerHTML = '';
  tn.appendChild(new Option('Mọi vùng', ''));
  (DATA.cay || []).forEach((c) => { if (c.duong_dan) tn.appendChild(new Option(`${c.ten} (${c.so})`, c.duong_dan)); });
  tn.value = [...tn.options].some((o) => o.value === cu) ? cu : '';   // vùng vừa hết ghi chú: về "Mọi vùng", không để ô trống
}

/* ---------------- bố trí quỹ đạo ---------------- */
/* Đồ thị là cái nhìn tổng quan, không phải mục lục. Kho vài nghìn ghi chú mà vẽ hết
   thì chỉ ra mấy vòng tròn đặc, không đọc được gì — nên chỉ lấy số lượng vừa mắt,
   ưu tiên ghi chú mới sửa gần đây. Muốn xem sâu một nhóm thì bấm tên nhóm ở chú giải. */
const TRAN_NODE = 80;        // khi xem toàn kho
const TRAN_MOT_NHOM = 60;    // khi đang lọc riêng một nhóm
let daBot = 0;               // số ghi chú không vẽ ra

function dungQuyDao() {
  const nhom = {};
  DATA.notes.forEach((x) => {
    const k = vungCua(x.category);          // mỗi vòng một VÙNG (tầng đầu của cây nhóm)
    (nhom[k] = nhom[k] || []).push(x);
  });
  // sắp theo số THẬT của vùng, không phải số đang có trong tay
  const soThat = (k) => vungSo[k] ?? nhom[k].length;
  // vùng đông nằm vòng trong; "Chưa xếp chỗ" luôn ở vòng ngoài cùng
  const tenDay = Object.keys(nhom).sort((a, b) => (a === CHUA) - (b === CHUA) || soThat(b) - soThat(a));
  const tongThat = DATA.notes.length;

  // cắt bớt cho vừa mắt — DATA.notes đã sắp theo updated_at giảm dần
  const xemVung = noiBat && nhom[noiBat] ? noiBat : null;
  const tongVung = xemVung ? soThat(xemVung) : 0;
  if (xemVung) {
    nhom[xemVung] = nhom[xemVung].slice(0, TRAN_MOT_NHOM);
    tenDay.forEach((k) => { if (k !== xemVung) nhom[k] = nhom[k].slice(0, 2); });
  } else if (tongThat > TRAN_NODE) {
    tenDay.forEach((k) => {
      const phan = Math.max(3, Math.round(TRAN_NODE * nhom[k].length / tongThat));
      nhom[k] = nhom[k].slice(0, phan);
    });
  }
  // Đang xem một vùng: chỉ đếm ghi chú CỦA VÙNG ĐÓ không vẽ được. Vùng khác cố ý chỉ còn 2 chấm mờ làm nền —
  // đếm cả chúng thì báo "còn N ghi chú khác" sai dù vùng đang xem đã vẽ đủ.
  // Xem toàn kho: cộng cả phần máy chủ đã cắt trước khi gửi xuống.
  daBot = xemVung
    ? Math.max(0, tongVung - nhom[xemVung].length)
    : (DATA.tong_ghi_chu ?? tongThat) - tenDay.reduce((s, k) => s + nhom[k].length, 0);

  const ten = tenDay;
  dsVung = ten.slice();
  nodes = [];
  vongMau = [];
  tocVong = [];
  ten.forEach((k, vi) => {
    const ds = nhom[k];
    // mỗi nhóm một vòng; nhóm đông nằm vòng trong
    const bk = 0.26 + (vi + 1) / (ten.length + 1) * 0.70;
    const lech = vi * 0.9;
    const mau = mauCua(k);
    vongMau.push(mau);
    // Vận hành như vũ trụ: vòng trong nhanh, vòng ngoài chậm (Kepler: tốc độ góc ∝ bán kính^-1,5).
    // Âm dương đối đãi: vòng dương (1, 3, 5…) xoay thuận chiều khí Tiên Thiên (theo kim đồng hồ trên màn hình,
    // Chấn → Ly → Đoài → Càn → Tốn → Khảm → Cấn → Khôn), vòng âm (2, 4, 6…) xoay ngược.
    const toc = (vi % 2 ? -1 : 1) * 0.03 * Math.pow(bk, -1.5);
    tocVong.push(toc);
    // vùng đông (> 12 chấm): trải thành dải 3 làn so le quanh vòng — không thành chuỗi hạt dày đặc
    const lan = ds.length > 12 ? 0.035 : 0;
    ds.forEach((note, i) => {
      nodes.push({
        note, nhom: k, vong: vi, mau, thu: i,
        bk: bk + lan * ((i % 3) - 1), pha: lech + (i / ds.length) * Math.PI * 2,
        toc,
        r: 2.6 + Math.min(1.6, (note.tags?.length || 0) * 0.4),
      });
    });
  });
  nodes.forEach((n, i) => { n.chiSo = i; });   // thứ tự trên mặt A.I: các vùng nằm liền mạch theo đường nét
  veChuGiai(ten, nhom);
  veConLai();
  datChoTrong();                         // dải chip vừa đổi số hàng: tính lại chỗ trống cho đồ thị
}

/* Nói rõ đồ thị đang không vẽ hết — để anh không tưởng ghi chú bị mất. */
function veConLai() {
  const d = $('#conLai');
  if (!daBot) { d.hidden = true; return; }
  d.textContent = noiBat
    ? `Đang xem vùng "${noiBat}". Đồ thị vẽ tối đa ${TRAN_MOT_NHOM} ghi chú mới sửa gần nhất của vùng — ${daBot} ghi chú khác xem đầy đủ trong Thư viện.`
    : `Đồ thị vẽ ${nodes.length}/${DATA.tong_ghi_chu ?? DATA.notes.length} ghi chú mới sửa gần nhất — đây là toàn cảnh, không phải mục lục. Duyệt đủ theo nhóm và loại ở Thư viện.`;
  d.hidden = false;
}

/* bảng chú giải: mỗi nhóm một màu, bấm vào để chỉ làm nổi nhóm đó */
function veChuGiai(ten, nhom) {
  const box = $('#chuGiai');
  box.innerHTML = '';
  if (ten.length < 2) return;
  ten.forEach((k, vi) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cg' + (noiBat === k ? ' on' : '');
    b.setAttribute('aria-pressed', String(noiBat === k));
    const d = document.createElement('i');
    d.style.background = mauCua(k);
    const t = document.createElement('span');
    t.textContent = k;
    const s = document.createElement('u');
    s.textContent = vungSo[k] ?? nhom[k].length;   // số thật, không phải số đang vẽ
    b.append(d, t, s);
    b.addEventListener('click', () => {
      noiBat = noiBat === k ? null : k;
      dungQuyDao();          // đổi nhóm đang xem thì vẽ lại, để xem sâu được nhóm đó
    });
    box.appendChild(b);
  });
}

/* ---------------- vẽ ---------------- */
const cv = $('#do');
const cx = cv.getContext('2d');
let W = 0, H = 0, CX = 0, CY = 0, DV = 1;

let lechDich = 0;   // dịch lõi sang trái khi mở thẻ chi tiết, để node đang chọn không bị che
let lechDen = 0;

function coLai() {
  const b = cv.getBoundingClientRect();
  DV = Math.min(window.devicePixelRatio || 1, 2);
  W = b.width; H = b.height;
  cv.width = Math.round(W * DV);
  cv.height = Math.round(H * DV);
  cx.setTransform(DV, 0, 0, DV, 0, 0);
  datChoTrong();
  datLech();
}
/* Dải chip vùng (cùng dòng "Đồ thị vẽ …") nằm đè lên đáy khung. Máy tính một hàng, không chạm quỹ đạo; điện thoại 2–4 hàng
   chiếm ~1/3 khung — trước đây đè lên các vòng ngoài, kho nhiều vùng thì che cả lõi Bát Quái. Bị đè thì dồn đồ thị vào khoảng
   trống giữa thanh chế độ (trên) và dải chip (dưới); không đè thì giữ bố cục cũ. Dải chip đang ẩn (mặt A.I) thì giữ số đo cũ. */
let VUNG_TREN = 0, VUNG_DUOI = 0, MEP_TREN = 0;   // MEP_TREN: đáy thanh chuyển chế độ (toạ độ khung) — tên vòng vùng không được lên tới đó
function datChoTrong() {
  const d = $('.duoi'), n = $('.che-do');
  MEP_TREN = n && n.getClientRects().length ? Math.max(0, n.getBoundingClientRect().bottom - cv.getBoundingClientRect().top) : 0;
  if (W && d && d.getClientRects().length) {
    VUNG_TREN = VUNG_DUOI = 0;
    const c = cv.getBoundingClientRect(), day = d.getBoundingClientRect().top - c.top - 10;   // đỉnh dải chip, toạ độ khung
    if (H / 2 + banKinh() * det() + 14 > day) {
      VUNG_TREN = n && n.getClientRects().length ? Math.max(0, n.getBoundingClientRect().bottom - c.top + 6) : 0;
      VUNG_DUOI = Math.max(0, H - day);
    }
  }
  CY = tapTrung ? H / 2 : (VUNG_TREN + H - VUNG_DUOI) / 2;
}

/* Thẻ chi tiết nằm đè lên mép phải màn hình. Khi nó mở, thu hẹp vùng vẽ lại
   để không node nào — và không nhãn nào — chui xuống dưới thẻ. */
function datLech() {
  const sheet = $('#chiTiet');
  if (sheet.hidden || W < 760) { lechDen = 0; return; }
  const s = sheet.getBoundingClientRect(), c = cv.getBoundingClientRect();
  lechDen = Math.max(0, Math.min(c.right - s.left, W * 0.52));
}
const mepPhai = () => W - lechDich;   // mép phải của vùng còn nhìn thấy

const DO = '#F07F2D', VANG = '#D4AF37', TRUNG = '#EEF3FA';
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};
const mo = (nd) => !!noiBat && nd.nhom !== noiBat;   // nhóm bị làm mờ

// toàn màn hình: không còn thanh chuyển và dải vùng chiếm chỗ trên/dưới → đồ thị to hơn ~25%, dùng hết chiều cao
const banKinh = () => Math.min((W - lechDich) * 0.40, tapTrung ? H * 0.58 : (H - VUNG_TREN - VUNG_DUOI) * 0.46);
// độ dẹt của quỹ đạo: màn ngang dẹt cho vừa khung; màn dựng đứng (điện thoại) tròn đều để chấm trải theo chiều cao
const det = () => (H > (W - lechDich) * 1.2 ? 1 : 0.74);

/* Vòng quỹ đạo trong cùng luôn nằm NGOÀI lõi Bát Quái (màn hình hẹp thì lõi chiếm tỉ lệ lớn hơn):
   dồn dải bán kính 0.26–0.96 vào khoảng [mép lõi + khoảng thở, 0.96]. */
function bkThat(bk) {
  const R = banKinh();
  const dau = Math.min(0.6, Math.max(0.26, (banKinhLoi() + 14) / (R * det())));
  return dau + (bk - 0.26) * (0.96 - dau) / 0.70;
}

function viTri(nd) {
  const R = banKinh();
  const a = nd.pha + goc * nd.toc;
  const b = bkThat(nd.bk);
  const p = { x: CX + Math.cos(a) * R * b, y: CY + Math.sin(a) * R * b * det() };
  if (kMat <= 0) return p;
  // chế độ mặt A.I: mỗi chấm bay vào chỗ của nó trong não (nơ-ron), lệch nhịp nhau một chút
  const r = (nd.chiSo ?? 0) / Math.max(1, nodes.length), e = em(0.3 + 0.35 * r, 0.62 + 0.35 * r, kMat);
  if (e <= 0) return p;
  if (!nd.nao) nd.nao = viTriNao(nd);
  const q = chieuDiem(nd.nao[0], nd.nao[1], nd.nao[2], 1);
  return { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e };
}

// nền sao: vị trí cố định (sinh một lần), lấp lánh rất nhẹ lệch nhịp — nền vũ trụ, không tranh chỗ với chấm
const SAO = (() => {
  let h = 20261023;
  const nn = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
  return Array.from({ length: 110 }, () => ({ x: nn(), y: nn(), r: 0.35 + nn() * 0.9, pha: nn() * 6.28, nhip: 0.4 + nn() * 1.2 }));
})();

function ve() {
  cx.clearRect(0, 0, W, H);
  const R = banKinh();
  const tg = itMotion ? 0 : performance.now() / 1000;
  cx.fillStyle = '#CFE0FF';
  SAO.forEach((o) => {
    cx.globalAlpha = 0.1 + 0.3 * (0.5 + 0.5 * Math.sin(tg * o.nhip + o.pha));
    cx.beginPath(); cx.arc(o.x * W, o.y * H, o.r, 0, Math.PI * 2); cx.fill();
  });
  cx.globalAlpha = 1;
  capNhatMat(tg);

  // vòng quỹ đạo — mỗi nhóm một màu riêng (tắt dần khi hai luồng Âm Dương tuôn ra)
  cx.globalAlpha = anQD;
  const soVong = anQD > 0.003 ? vongMau.length : 0;
  const tenVong = [];
  nodes.forEach((n) => { tenVong[n.vong] = n.nhom; });
  // Mỗi vòng: màu của vùng; nét dày theo số ghi chú (vùng lớn nét đậm hơn); "thở" rất nhẹ lệch nhịp nhau;
  // một vệt sáng chạy dọc vòng cùng chiều các chấm, nhanh hơn chút — theo nút tốc độ, dừng xoay thì dừng.
  // Vòng vẫn nhạt hơn chấm: chấm (ghi chú) luôn là thứ nổi nhất.
  for (let i = 0; i < soVong; i++) {
    const ten = tenVong[i], mau = vongMau[i];
    const noi = noiBat && ten === noiBat, toiV = noiBat && !noi;
    const tho = itMotion ? 0 : Math.sin(tg * 0.9 + i * 1.3);
    const bk = bkThat(0.26 + (i + 1) / (soVong + 1) * 0.70) * (1 + 0.004 * tho);
    const rx = R * bk, ry = rx * det();
    const so = vungSo[ten] ?? nodes.filter((n) => n.vong === i).length;
    const day = 1 + Math.min(1.4, so / 20);
    cx.setLineDash(i >= 8 ? [6, 5] : []);
    cx.beginPath();
    cx.ellipse(CX, CY, rx, ry, 0, 0, Math.PI * 2);
    cx.strokeStyle = rgba(mau, toiV ? 0.05 : noi ? 0.45 : 0.17 + 0.04 * tho);
    cx.lineWidth = day;
    cx.stroke();
    cx.setLineDash([]);
    if (toiV || itMotion) continue;
    // vệt sáng: 6 đoạn ngắn, đậm ở đầu, nhạt dần về đuôi
    const huong = Math.sign(tocVong[i]) || 1;
    const dau = goc * tocVong[i] * 1.8 + i * 0.9;
    const doan = 0.07;
    for (let k = 0; k < 6; k++) {
      const a1 = dau - huong * (k + 1) * doan, a2 = dau - huong * k * doan;
      cx.beginPath();
      cx.ellipse(CX, CY, rx, ry, 0, Math.min(a1, a2), Math.max(a1, a2));
      cx.strokeStyle = rgba(mau, (noi ? 0.95 : 0.6) * (1 - k / 6));
      cx.lineWidth = day + 1.4;
      cx.lineCap = 'round';
      cx.stroke();
    }
    cx.lineCap = 'butt';
  }
  cx.globalAlpha = 1;

  const diem = new Map();
  nodes.forEach((nd) => diem.set(nd.note.id, viTri(nd)));

  // nan hoa từ lõi (mặt A.I thì không)
  cx.globalAlpha = anQD;
  if (anQD > 0.003) nodes.forEach((nd) => {
    const p = diem.get(nd.note.id);
    const nb = nd === hover || nd === chon;
    cx.beginPath();
    cx.moveTo(CX, CY);
    cx.lineTo(p.x, p.y);
    cx.strokeStyle = rgba(nd.mau, nb ? 0.5 : mo(nd) ? 0.03 : 0.1);
    cx.lineWidth = 1;
    cx.stroke();
  });
  cx.globalAlpha = 1;

  // liên kết giữa các ghi chú (mặt A.I: vẽ trong veMat, sau bộ não, thành cung khớp thần kinh)
  if (eMat < 0.95) DATA.links.forEach(([a, b]) => {
    const p = diem.get(a), q = diem.get(b);
    if (!p || !q) return;
    cx.beginPath();
    cx.moveTo(p.x, p.y);
    cx.lineTo(q.x, q.y);
    cx.strokeStyle = `rgba(238,243,250,${(0.17 * (1 - eMat)).toFixed(3)})`;
    cx.lineWidth = 1;
    cx.stroke();
  });
  if (kMat > 0.001) veMat(tg, diem);

  // lõi: Thái Cực – Tiên Thiên Bát Quái (đứng yên — Càn luôn ở trên mới đúng phương vị)
  const dich = hoverLoi ? banKinhLoiTo() : banKinhLoi();
  rkHienTai = itMotion ? dich : rkHienTai + (dich - rkHienTai) * 0.2;
  if (Math.abs(dich - rkHienTai) < 0.3) rkHienTai = dich;
  const RK = rkHienTai;
  // quầng sáng quanh Thái Cực "thở" chậm (~9 giây một nhịp)
  const tho = itMotion ? 0 : Math.sin(tg * 0.7);
  const rq = RK * (1.75 + 0.12 * tho);
  const quang = cx.createRadialGradient(LX, LY, RK * 0.6, LX, LY, rq);
  // quầng xanh lơ – vàng kim như quầng quanh Bát Quái trong ảnh mẫu (trước đây cam)
  quang.addColorStop(0, `rgba(241,197,88,${(0.22 + 0.05 * tho).toFixed(3)})`);
  quang.addColorStop(0.45, `rgba(71,177,228,${(0.2 + 0.05 * tho).toFixed(3)})`);
  quang.addColorStop(1, 'rgba(71,177,228,0)');
  cx.fillStyle = quang;
  cx.beginPath(); cx.arc(LX, LY, rq, 0, Math.PI * 2); cx.fill();
  // (Thái Cực vẽ sau cùng — nằm trên mọi chấm và nhãn)

  // Cỡ chữ, độ dài tên và cỡ chấm theo SỐ GHI CHÚ ĐANG HIỆN: ít thì chữ to, tên dài, chấm to — dễ đọc;
  // nhiều thì nhỏ lại cho đỡ chồng. Đang xem một vùng thì chỉ đếm vùng đó. Toàn màn hình to thêm một bậc.
  const soHien = Math.max(1, nodes.filter((n) => !mo(n)).length);
  const lnN = Math.log(soHien);
  let coChu = Math.max(11, Math.min(17, 19.5 - 2 * lnN));
  if (tapTrung) coChu *= 1.12;
  if (W - lechDich < 520) coChu = Math.min(coChu, 13.5);          // điện thoại: chừa chỗ ngang cho tên
  const tranTen = Math.round(Math.max(26, Math.min(46, 54 - 6 * lnN)));
  const toCham = Math.max(0.9, Math.min(1.35, 2 - 0.25 * lnN));
  // nhiều chấm thì không ghi tên hết: tối đa ~18 nhãn, chia đều các vùng (chấm thứ nhất của mỗi vùng, rồi thứ hai…)
  const tranNhan = soHien > 24 ? 18 : Infinity;

  // mặt A.I: quầng nơ-ron loang thành "lãnh thổ" sáng màu vùng trên vỏ não. Vẽ các quầng lên lớp riêng bằng 'lighten' (lấy sáng
  // nhất, không cộng dồn) rồi cộng sáng cả lớp lên khung một lần: vùng màu lam trên nền não lam vẫn nổi, mà kho đông cũng không
  // trắng xoá (trước đây cộng thẳng từng quầng: 120 quầng chồng nhau thành mảng trắng trên điện thoại). Cỡ quầng theo cỡ đầu.
  const toiMat = (nd) => mo(nd) || (eMat > 0.5 && hoverVung && nd.nhom !== hoverVung);   // rê vào vòng vùng: vùng khác mờ
  // đầu ảnh mẫu: não trong ảnh đã sáng sẵn — quầng màu vùng phủ lên làm đục ảnh, chỉ hiện cho vùng đang rê chuột
  const quangAnh = ANH_DAU.ok && kMat >= 1;
  if (eMat > 0.05 && (!quangAnh || hoverVung)) {
    if (!lopQuang) lopQuang = document.createElement('canvas');
    if (lopQuang.width !== cv.width || lopQuang.height !== cv.height) { lopQuang.width = cv.width; lopQuang.height = cv.height; }
    const gl = lopQuang.getContext('2d'), kc = 1 + (keo(MAT.u / 180, 0.55, 1.3) - 1) * eMat;
    gl.setTransform(1, 0, 0, 1, 0, 0);
    gl.clearRect(0, 0, lopQuang.width, lopQuang.height);
    gl.setTransform(DV, 0, 0, DV, 0, 0);
    gl.globalCompositeOperation = 'lighten';
    nodes.forEach((nd) => {
      const p = diem.get(nd.note.id), nb = nd === hover || nd === chon, toi = toiMat(nd);
      const rr = (nb ? nd.r + 2.4 : nd.r) * toCham * (3.2 + 2.6 * eMat) * kc;
      if (quangAnh && hoverVung !== nd.nhom) return;
      gl.globalAlpha = toi ? 0.08 : nb || hoverVung === nd.nhom ? 1 : 0.7;
      gl.drawImage(quangCham(nd.mau), p.x - rr, p.y - rr, rr * 2, rr * 2);
    });
    cx.save();
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 0.75 * eMat;
    cx.drawImage(lopQuang, 0, 0);
    cx.restore();
  }
  const loiTrang = eMat * 0.9 * keo(Math.sqrt(40 / soHien), 0.35, 1);   // lõi trắng: kho đông thì dịu lại
  // các ghi chú — vẽ chấm trước, nhãn sau (node đang chọn được ưu tiên chỗ)
  nodes.forEach((nd) => {
    const p = diem.get(nd.note.id);
    const nb = nd === hover || nd === chon;
    const toi = toiMat(nd);
    const rc = (nb ? nd.r + 2.4 : nd.r) * toCham * (1 - 0.45 * eMat);   // mặt A.I: nốt nhỏ, lõi trắng, quầng màu vùng
    // Đầu ảnh mẫu: nơ-ron là chấm sáng nhỏ như chấm sáng trong bộ não của ảnh — lõi trắng li ti, quầng nhỏ ánh màu vùng, lấp lánh
    // lệch nhịp. (Trước đây chấm màu viền tối: kho đông che kín não, đậm — anh: "các chấm che hết não, dày đặc quá, đậm quá".)
    // Lần 2 (anh: "các chấm cần nhỏ, rõ màu nhưng không đậm quá", "rõ màu, khoa học"): chấm màu vùng (đọc được ghi chú thuộc
    // vùng nào, khớp màu vòng vùng) như hạt cườm nhỏ — lõi màu đặc, viền xanh đêm mảnh tách khỏi nền não sáng, một đốm sáng
    // li ti lệch trên-trái, quầng nhạt cùng màu (vẽ thường, không "lighter": nền não đã sáng, cộng sáng thì mất màu), lấp lánh khẽ.
    if (eMat > 0.05 && ANH_DAU.ok) {
      const lap = itMotion ? 0.92 : 0.84 + 0.16 * Math.sin(tg * (0.8 + 1.6 * bam(nd.note.id, 9)) + 6.28 * bam(nd.note.id, 8));
      const a = eMat * (toi ? 0.18 : nb ? 1 : lap), lo = nb ? 3.2 : keo(MAT.u / 70, 1.4, 2.3), rq = lo * 3.2;
      cx.globalAlpha = a * 0.3;
      cx.drawImage(quangCham(nd.mau), p.x - rq, p.y - rq, rq * 2, rq * 2);
      cx.globalAlpha = a * 0.55;
      cx.beginPath(); cx.arc(p.x, p.y, lo + 0.75, 0, Math.PI * 2); cx.fillStyle = '#071a3d'; cx.fill();
      cx.globalAlpha = a;
      cx.beginPath(); cx.arc(p.x, p.y, lo, 0, Math.PI * 2); cx.fillStyle = nd.mau; cx.fill();
      cx.globalAlpha = a * 0.75;
      cx.beginPath(); cx.arc(p.x - lo * 0.3, p.y - lo * 0.3, lo * 0.32, 0, Math.PI * 2); cx.fillStyle = '#fff'; cx.fill();
      if (nb) { cx.globalAlpha = 1; cx.beginPath(); cx.arc(p.x, p.y, lo + 3, 0, Math.PI * 2); cx.strokeStyle = TRUNG; cx.lineWidth = 1.2; cx.stroke(); }
      if (eMat >= 1) { cx.globalAlpha = 1; return; }
      cx.globalAlpha = 1 - eMat;           // lúc chuyển cảnh: chấm quỹ đạo mờ dần thành chấm sáng
    }
    cx.beginPath();
    cx.arc(p.x, p.y, rc, 0, Math.PI * 2);
    cx.fillStyle = nd.mau;
    cx.globalAlpha = (nb ? 1 : toi ? 0.2 : 0.85) * (ANH_DAU.ok ? 1 - eMat : 1);
    cx.fill();
    if (nb) { cx.strokeStyle = TRUNG; cx.lineWidth = 1.2; cx.stroke(); }
    if (eMat > 0.05 && !toi && !ANH_DAU.ok) {
      cx.beginPath();
      cx.arc(p.x, p.y, rc * 0.5, 0, Math.PI * 2);
      cx.fillStyle = '#fff';
      cx.globalAlpha = nb ? eMat : loiTrang;
      cx.fill();
    }
    if (nhayNoron && kMat > 0.5 && nhayNoron.ids.has(nd.note.id)) {   // vừa tìm thấy bằng giọng nói: sóng sáng lan ra
      const tt = giay() - nhayNoron.t0, pha = (tt * 1.4) % 1;
      if (tt < 6) {
        cx.beginPath();
        cx.arc(p.x, p.y, nd.r * toCham + 3 + 9 * pha, 0, Math.PI * 2);
        cx.strokeStyle = TRUNG;
        cx.globalAlpha = (1 - pha) * (1 - tt / 6);
        cx.lineWidth = 1.5;
        cx.stroke();
      }
    }
    cx.globalAlpha = 1;
  });

  // rê chuột vào lõi: tên tám quẻ hiện quanh vành — nhãn ghi chú nằm dưới các ô tên đó thì tạm ẩn (trước đây "Tốn · Tây Nam"
  // đè lên chữ đầu của tên ghi chú bên cạnh); bỏ chuột ra là nhãn hiện lại
  const tenQue = hoverLoi && RK > banKinhLoiTo() - 1 ? oTenQue(RK) : [];
  cx.font = `500 ${coChu.toFixed(1)}px "Be Vietnam Pro",sans-serif`;
  cx.textBaseline = 'middle';
  // ô chữ đã chiếm chỗ — bắt đầu bằng chính lõi Bát Quái, để không nhãn nào bị lõi che mất một nửa
  const daVe = [{ x0: LX - RK - 6, x1: LX + RK + 6, y0: LY - RK - 6, y1: LY + RK + 6 }, ...tenQue];
  const uuTien = nodes.slice().sort((a, b) =>
    (b === hover || b === chon) - (a === hover || a === chon) || a.thu - b.thu || a.vong - b.vong);
  const daGhi = new Set();          // tên đã ghi — các trang của cùng một file chỉ ghi tên một lần
  let soNhan = 0;
  uuTien.forEach((nd) => {
    const nb = nd === hover || nd === chon;
    const toi = mo(nd);
    // chế độ "chỉ chấm" và mặt A.I: rê chuột mới hiện tên
    if (!nb && (toi || (tapTrung && !hienTen) || kMat > 0.12)) return;
    const khoa = nd.note.title.replace(/\s+—\s+trang\s+\d+$/u, '').toLowerCase();
    if (!nb && (daGhi.has(khoa) || soNhan >= tranNhan)) return;
    const p = diem.get(nd.note.id);
    const tran = nb ? 90 : tranTen;     // rê chuột / đang chọn: hiện đủ tên
    let t = nd.note.title.length > tran ? nd.note.title.slice(0, tran - 1) + '…' : nd.note.title;
    let w = cx.measureText(t).width;
    const phai = mepPhai() - 10;
    const cach = 6 + nd.r * toCham;     // khoảng cách chữ — chấm, theo cỡ chấm
    // Tên luôn quay RA NGOÀI (chấm bên trái lõi → tên bên trái), thiếu chỗ thì rút gọn kèm "…".
    // Chỉ lật sang phía kia khi phía ngoài quá chật — trước đây tên dài bị lật ngang qua lõi Bát Quái,
    // đụng ô của lõi nên bị bỏ: xem một vùng có 4 chấm mà chỉ 2 chấm có tên.
    // Không tràn mép trái, không chui xuống dưới thẻ chi tiết.
    const choTrai = p.x - cach - 8, choPhai = phai - p.x - cach;
    let trai = p.x < CX;
    const choNgoai = trai ? choTrai : choPhai, choKia = trai ? choPhai : choTrai;
    if (choNgoai < Math.min(w, 140) && choKia > choNgoai) trai = !trai;
    const cho = trai ? choTrai : choPhai;
    if (w > cho) {
      if (cho < 48 && !nb) return;
      while (t.length > 4 && cx.measureText(t).width > cho) t = t.slice(0, -2).trimEnd() + '…';
      w = cx.measureText(t).width;
    }
    const x0 = trai ? p.x - cach - w : p.x + cach;
    const nua = coChu * 0.72;     // nửa chiều cao ô chữ, theo cỡ chữ
    const o = { x0: x0 - 7, x1: x0 + w + 7, y0: p.y - nua, y1: p.y + nua };
    if ((!nb || tenQue.length) && daVe.some((q) => o.x0 < q.x1 && o.x1 > q.x0 && o.y0 < q.y1 && o.y1 > q.y0)) return;
    daVe.push(o);
    daGhi.add(khoa);
    soNhan++;
    cx.textAlign = 'left';
    if (nb && kMat > 0.5) {               // mặt A.I: nhãn nằm trên nền tối — khỏi chồng lên tên vòng vùng (anh chụp: hai dòng chữ đè nhau)
      cx.fillStyle = 'rgba(6,14,32,.9)';
      cx.globalAlpha = 1;
      cx.beginPath();
      if (cx.roundRect) cx.roundRect(x0 - 7, p.y - nua - 2, w + 14, 2 * nua + 4, 6); else cx.rect(x0 - 7, p.y - nua - 2, w + 14, 2 * nua + 4);
      cx.fill();
    }
    // viền tối quanh chữ: chấm và nan hoa đang quay chạy ngang qua nhãn thì chữ vẫn đọc rõ
    cx.lineJoin = 'round';
    cx.lineWidth = 4;
    cx.strokeStyle = 'rgba(10,20,36,.85)';
    cx.strokeText(t, x0, p.y);
    cx.fillStyle = nb ? TRUNG : 'rgba(238,243,250,.62)';
    cx.fillText(t, x0, p.y);
  });

  // đứng yên (không co/giãn, không đang chuyển cảnh — lúc đó cỡ lõi đổi từng khung): dùng hình vẽ đúng cỡ (nét sắc);
  // đang co/giãn: thu phóng hình cỡ lớn cho mượt
  const dungYen = (kMat === 0 || kMat === 1) && (RK === banKinhLoi() || RK === banKinhLoiTo());
  const hinh = hinhThaiCuc(dungYen ? RK : banKinhLoiTo());
  const s = (RK * 2 + 4) / ((dungYen ? RK : banKinhLoiTo()) * 2 + 4);
  const w = hinh.width / DV * s;
  cx.drawImage(hinh, LX - w / 2, LY - w / 2, w, w);
  if (!itMotion) veKhi(RK);
  if (tenQue.length) veTenQue(tenQue);
}

/* ---------------- Chế độ MẶT A.I — nút ẩn: bấm lõi Bát Quái (hoặc phím M) ----------------
   Chuyển cảnh: từ lõi tuôn ra hai luồng Dương (vàng kim) – Âm (xanh lam) xoáy đan nhau như Thái Cực, vòng Tiên Thiên Bát Quái
   sáng dần theo chiều khí; rồi hai luồng gỡ thành đường vân của một cái đầu A.I trong suốt, đầu luồng bay vào làm mắt, lõi Bát Quái xuống
   ngực. Thoát thì chạy ngược lại. Đầu vẽ bằng các đường vân dài, liền, cách đều (đường dòng) chạy theo khối của một mô hình 3D —
   vòng quanh mắt, mũi, môi, tai, dọc má, ngang trán; cổ thành vòng ngang chảy xuống vai. Trong hộp sọ là bộ não phát sáng: mỗi ghi chú là một nơ-ron mang màu
   vùng, mỗi vùng là một vòng tròn quanh đầu nối mạng vào não. Đầu quay nhìn theo con trỏ, chớp mắt, nhép miệng khi "Mây nói".
   Toạ độ mô hình: đơn vị = bán kính đầu, gốc ở tâm đầu, x sang phải, y xuống dưới, z hướng về người xem. */
let matDich = 0, kMat = 0, eMat = 0;     // đích (0/1), tiến độ chuyển cảnh, tiến độ đã làm mượt
let anQD = 1;                            // độ hiện của vòng quỹ đạo + nan hoa (tắt sớm khi hai luồng Âm Dương tuôn ra)
let LX = 0, LY = 0;                      // vị trí lõi Bát Quái: giữa đồ thị, hoặc trên ngực khi là mặt A.I
let dtKhung = 16.7, chuot = null, loiNoi = null, lopQuang = null, lopCo = null;
const MAT = { yaw: 0, pitch: 0, u: 1, oy: 0, mieng: 0, chop: 1, henChop: 2.5, batDauChop: -9 };
const QUAY = { cy: 1, sy: 0, cp: 1, sp: 0 };   // cos/sin góc quay đầu của khung hình đang vẽ
const keo = (v, a, b) => Math.max(a, Math.min(b, v));
const em = (a, b, v) => { const t = keo((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };   // chuyển mượt a → b
const giay = () => performance.now() / 1000;
const g2 = (x, y, x0, y0, sx, sy) => Math.exp(-(((x - x0) / sx) ** 2 + ((y - y0) / sy) ** 2));
const noiSuy = (bang, v) => {            // nội suy theo bảng [[v, giá trị], …]
  if (v <= bang[0][0]) return bang[0][1];
  for (let i = 1; i < bang.length; i++) {
    if (v <= bang[i][0]) { const [a, p] = bang[i - 1], [b, q] = bang[i]; return p + (q - p) * (v - a) / (b - a); }
  }
  return bang[bang.length - 1][1];
};

// Hình đầu nhìn thẳng: nửa bề rộng và độ nhô đường giữa mặt theo y. Đỉnh đầu là nửa elip; dưới thái dương lấy theo bảng.
const RONG_DUOI = [[-0.35, 0.92], [-0.05, 0.9], [0.25, 0.87], [0.5, 0.82], [0.7, 0.74], [0.86, 0.62], [0.98, 0.48],
  [1.07, 0.33], [1.13, 0.18], [1.16, 0]];
const NHO_DUOI = [[-0.35, 0.86], [-0.1, 0.9], [0.3, 0.86], [0.6, 0.82], [0.85, 0.77], [1.0, 0.68], [1.1, 0.5], [1.16, 0]];
const vom = (y) => Math.max(0, 1 - ((y + 0.35) / 0.95) ** 2);
const nuaRong = (y) => (y < -0.35 ? 0.92 * Math.sqrt(vom(y)) : noiSuy(RONG_DUOI, y));
const nhoGiua = (y) => (y < -0.35 ? 0.86 * Math.sqrt(vom(y)) : noiSuy(NHO_DUOI, y));   // trán dốc nhẹ ra sau
function doSau(x, y) {                   // độ nhô (z) của mặt trước đầu tại (x, y); âm = ngoài đầu
  const w = nuaRong(y);
  if (w <= 0) return -1;
  const s = 1 - (x / w) ** 2;
  if (s <= 0) {                          // tai: hai cánh nhỏ hai bên, ngoài viền đầu
    const ex = (Math.abs(x) - 0.95) / 0.13, ey = (y - 0.12) / 0.27, re = ex * ex + ey * ey;
    return re < 1 ? 0.12 * Math.sqrt(1 - re) : s;
  }
  const ax = Math.abs(x);
  let z = nhoGiua(y) * s ** 0.55
    - 0.13 * g2(ax, y, 0.34, 0.02, 0.17, 0.11)      // hốc mắt
    + 0.035 * g2(ax, y, 0.32, -0.15, 0.18, 0.05)    // cung mày
    - 0.04 * g2(x, y, 0, 0, 0.25, 0.07)             // chỗ trũng giữa hai mắt (tách sống mũi khỏi trán)
    + 0.05 * g2(ax, y, 0.52, 0.28, 0.16, 0.12)      // gò má
    - 0.03 * g2(ax, y, 0.5, 0.62, 0.14, 0.12)       // má hóp
    - 0.03 * g2(ax, y, 0.8, -0.35, 0.1, 0.18)       // thái dương
    + 0.07 * g2(ax, y, 0.12, 0.44, 0.06, 0.05)      // cánh mũi
    + 0.06 * g2(x, y, 0, 0.66, 0.2, 0.04)           // môi trên
    + 0.07 * g2(x, y, 0, 0.79, 0.17, 0.045)         // môi dưới
    - 0.04 * g2(x, y, 0, 0.725, 0.22, 0.018)        // khe môi
    + 0.06 * g2(x, y, 0, 0.98, 0.16, 0.08);         // cằm
  if (y > -0.1 && y < 0.6) {             // sống mũi cao dần từ giữa hai mắt tới chóp mũi rồi hụt xuống
    const t = keo((y + 0.05) / 0.47, 0, 1);
    let A = 0.03 + 0.17 * t ** 1.6;
    if (y > 0.42) A *= Math.exp(-(((y - 0.42) / 0.06) ** 2));
    z += A * Math.exp(-((x / (0.05 + 0.05 * t)) ** 2));
  }
  return z;
}
// cổ → dốc vai → vai tròn → cánh tay: nửa bề rộng nhìn thẳng, và độ nhô ở giữa thân, theo y
// cổ mọc từ dưới hàm (sau tai), thon lại rồi loe mềm ra dốc vai, vai tròn, cánh tay
const RONG_THAN = [[0.55, 0.6], [0.8, 0.5], [1.0, 0.45], [1.2, 0.43], [1.35, 0.45], [1.48, 0.56], [1.6, 0.84], [1.72, 1.14],
  [1.85, 1.42], [2.0, 1.62], [2.15, 1.74], [2.35, 1.8], [2.6, 1.78], [2.97, 1.72]];
const NHO_THAN = [[0.55, 0.42], [1.3, 0.4], [1.5, 0.42], [1.8, 0.5], [2.1, 0.56], [2.4, 0.6], [2.97, 0.6]];
function doSauThan(x, y) {               // độ nhô của cổ, vai, ngực: thân tròn + xương quai xanh + cơ ngực + cơ vai
  const W = noiSuy(RONG_THAN, y), s = 1 - (x / W) ** 2;
  if (s <= 0) return s * 0.3;            // âm ngoài thân: đường đồng mức thấp nhất là viền thân
  const ax = Math.abs(x), r = Math.sqrt(s);
  return (noiSuy(NHO_THAN, y) + 0.12 * g2(ax, y, 1.6, 2.12, 0.22, 0.28)) * r
    + 0.04 * Math.exp(-(((y - 1.62 - 0.08 * ax) / 0.06) ** 2)) * em(0.1, 0.25, ax) * (1 - em(1.0, 1.25, ax))
    + 0.035 * g2(ax, y, 0.5, 2.3, 0.45, 0.3) - 0.015 * g2(x, y, 0, 2.25, 0.08, 0.3);
}
const LO_NGUC = 2.12;                    // lò phản ứng (lõi Bát Quái) giữa ngực — cách cằm, dưới cổ
const NGHIENG = -0.3;                    // thân nhìn hơi từ trên xuống — vân trên vai, ngực cong theo khối

// điểm mô hình → màn hình, ghi vào b[o], b[o+1] (không tạo đối tượng mới — mỗi khung hình chiếu vài nghìn điểm).
// f = phần góc quay đầu áp cho điểm này: đầu 1, cổ giảm dần, vai 0 (thân đứng yên, nhìn hơi từ trên xuống)
function chieuVao(b, o, x, y, z, f) {
  let cy = QUAY.cy, sy = QUAY.sy, cp = QUAY.cp, sp = QUAY.sp;
  if (f !== 1) {
    const a = MAT.yaw * f, c = MAT.pitch * f + NGHIENG * (1 - f);
    cy = Math.cos(a); sy = Math.sin(a); cp = Math.cos(c); sp = Math.sin(c);
  }
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  const k = 6 / (6 - z2);
  b[o] = CX + x1 * k * MAT.u;
  b[o + 1] = MAT.oy + y1 * k * MAT.u;
}
const NHAP = new Float32Array(2);
const chieuDiem = (x, y, z, f) => { chieuVao(NHAP, 0, x, y, z, f); return { x: NHAP[0], y: NHAP[1] }; };

/* Đường đồng mức (marching squares) của hàm ham trên lưới bước h → các đường [[x, y], …]; đường khép kín lặp lại điểm đầu ở cuối. */
function dongMuc(ham, x0, y0, nx, ny, h, mucs) {
  const f = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) f[j * nx + i] = ham(x0 + i * h, y0 + j * h);
  const kq = [];
  mucs.forEach((muc, chiSo) => {
    const diem = new Map(), ke = new Map();
    // khoá cạnh: cạnh ngang (i,j)–(i+1,j) = 2(j·nx+i); cạnh dọc (i,j)–(i,j+1) = 2(j·nx+i)+1
    const cat = (k, i1, j1, i2, j2) => {
      if (!diem.has(k)) {
        const a = f[j1 * nx + i1] - muc, b = f[j2 * nx + i2] - muc, t = a / (a - b);
        diem.set(k, [x0 + (i1 + (i2 - i1) * t) * h, y0 + (j1 + (j2 - j1) * t) * h]);
      }
      return k;
    };
    const noi = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) { const l = ke.get(p); if (l) l.push(q); else ke.set(p, [q]); } };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v0 = f[j * nx + i] > muc, v1 = f[j * nx + i + 1] > muc, v2 = f[(j + 1) * nx + i + 1] > muc, v3 = f[(j + 1) * nx + i] > muc;
        if (v0 === v1 && v1 === v2 && v2 === v3) continue;
        const c = [];
        if (v0 !== v1) c.push(['T', cat(2 * (j * nx + i), i, j, i + 1, j)]);
        if (v1 !== v2) c.push(['R', cat(2 * (j * nx + i + 1) + 1, i + 1, j, i + 1, j + 1)]);
        if (v3 !== v2) c.push(['B', cat(2 * ((j + 1) * nx + i), i, j + 1, i + 1, j + 1)]);
        if (v0 !== v3) c.push(['L', cat(2 * (j * nx + i) + 1, i, j, i, j + 1)]);
        if (c.length === 2) { noi(c[0][1], c[1][1]); continue; }
        // ô yên ngựa: tâm ô quyết định cách nối
        const k = Object.fromEntries(c), tam = (f[j * nx + i] + f[j * nx + i + 1] + f[(j + 1) * nx + i + 1] + f[(j + 1) * nx + i]) / 4 > muc;
        if (v0 === tam) { noi(k.T, k.R); noi(k.B, k.L); } else { noi(k.T, k.L); noi(k.R, k.B); }
      }
    }
    const da = new Set();
    const di = (dau) => {
      const ds = [dau];
      da.add(dau);
      for (let hien = dau; ;) {
        const tiep = ke.get(hien).find((x) => !da.has(x));
        if (tiep === undefined) break;
        da.add(tiep); ds.push(tiep); hien = tiep;
      }
      return ds;
    };
    for (const [k, l] of ke) if (l.length === 1 && !da.has(k)) kq.push({ d: di(k).map((x) => diem.get(x)), chiSo });
    for (const k of ke.keys()) {
      if (da.has(k)) continue;
      const d = di(k).map((x) => diem.get(x));
      d.push(d[0]);
      kq.push({ d, chiSo });
    }
  });
  return kq;
}
function chiaDeu(d, buoc) {              // chia lại đường thành các điểm cách đều
  const dai = [0];
  for (let i = 1; i < d.length; i++) dai.push(dai[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
  const tong = dai[dai.length - 1], n = Math.max(6, Math.round(tong / buoc) + 1), kq = [];
  for (let k = 0, j = 1; k < n; k++) {
    const s = tong * k / (n - 1);
    while (j < d.length - 1 && dai[j] < s) j++;
    const t = (s - dai[j - 1]) / ((dai[j] - dai[j - 1]) || 1);
    kq.push([d[j - 1][0] + (d[j][0] - d[j - 1][0]) * t, d[j - 1][1] + (d[j][1] - d[j - 1][1]) * t, k / (n - 1)]);
  }
  return { d: kq, tong };
}

/* Lưới giá trị dựng một lần + nội suy song tuyến: đọc giá trị và hướng nhanh thay vì tính lại hàm 3D mỗi bước vẽ.
   Ra ngoài khung lưới thì trả `ngoai` (không kéo dài hàng mép — đường vân sẽ chạy tuột ra ngoài mãi). */
function luoi(ham, x0, y0, x1, y1, h, ngoai = -1) {
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, f = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) f[j * nx + i] = ham(x0 + i * h, y0 + j * h);
  return (x, y) => {
    if (!(x >= x0 && x <= x1 && y >= y0 && y <= y1)) return ngoai;
    const gx = keo((x - x0) / h, 0, nx - 1.001), gy = keo((y - y0) / h, 0, ny - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), a = gx - i, b = gy - j, o = j * nx + i;
    return (f[o] * (1 - a) + f[o + 1] * a) * (1 - b) + (f[o + nx] * (1 - a) + f[o + nx + 1] * a) * b;
  };
}
const tiepTuyen = (v, e) => (x, y) => {   // hướng dọc đường đồng mức của v (vuông góc với độ dốc)
  const gx = v(x + e, y) - v(x - e, y), gy = v(x, y + e) - v(x, y - e), n = Math.hypot(gx, gy);
  return n < 1e-9 ? [1, 0] : [-gy / n, gx / n];
};
/* Đường dòng cách đều (kiểu Jobard–Lefer): từ một điểm gieo, đi theo hướng cả hai chiều cho tới khi ra ngoài vùng hoặc tới
   sát (nửa khoảng cách) một đường đã có; rồi gieo tiếp các điểm cách đường vừa vẽ đúng dSep hai bên. Đường tự khép vòng
   (quanh mắt, mũi) thì nối kín. Cuối cùng quét cả vùng để không sót chỗ trống. Trả về các đường [[x, y], …]. */
function duongDong(trong, huong, dSep, buoc, [x0, y0, x1, y1], hat) {
  const o = dSep, nx = Math.ceil((x1 - x0) / o) + 2, oLuoi = new Map();
  const khoa = (ci, cj) => cj * nx + ci;
  const them = (x, y, id, k) => {
    const kk = khoa(Math.floor((x - x0) / o), Math.floor((y - y0) / o));
    const l = oLuoi.get(kk);
    if (l) l.push(x, y, id, k); else oLuoi.set(kk, [x, y, id, k]);
  };
  // điểm gần nhất trong bán kính r (bỏ qua các điểm vừa đi qua của chính đường id) → [id, k] hoặc null
  const gan = (x, y, r, id, kNay) => {
    const ci = Math.floor((x - x0) / o), cj = Math.floor((y - y0) / o), r2 = r * r;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const l = oLuoi.get(khoa(ci + di, cj + dj));
        if (!l) continue;
        for (let q = 0; q < l.length; q += 4) {
          if (l[q + 2] === id && Math.abs(l[q + 3] - kNay) < 3) continue;   // 2 điểm vừa đi qua (gần hơn bán kính)
          const dx = l[q] - x, dy = l[q + 1] - y;
          if (dx * dx + dy * dy < r2) return [l[q + 2], l[q + 3]];
        }
      }
    }
    return null;
  };
  const tich = (x, y, chieu, id) => {
    const ds = [];
    let [dx, dy] = huong(x, y);
    dx *= chieu; dy *= chieu;
    for (let k = 1; k < 1500; k++) {
      let [hx, hy] = huong(x, y);
      if (hx * dx + hy * dy < 0) { hx = -hx; hy = -hy; }
      let [mx, my] = huong(x + hx * buoc / 2, y + hy * buoc / 2);
      if (mx * hx + my * hy < 0) { mx = -mx; my = -my; }
      const x2 = x + mx * buoc, y2 = y + my * buoc;
      if (!trong(x2, y2)) break;
      const chan = gan(x2, y2, dSep * 0.5, id, chieu * k);
      if (chan) { if (chan[0] === id && Math.abs(chan[1]) < 3 && k > 20) ds.push(['kin']); break; }   // vòng kín: về lại điểm gieo
      // giậm chân tại chỗ (hướng đổi chiều liên tục ở chỗ khối gãy gắt): dừng
      if (k > 20 && Math.hypot(x2 - ds[k - 21][0], y2 - ds[k - 21][1]) < buoc * 6) break;
      x = x2; y = y2; dx = mx; dy = my;
      ds.push([x, y]);
      them(x, y, id, chieu * k);
    }
    return ds;
  };
  const duong = [];
  let id = 0;
  const chay = (hangCho) => {
    for (let qi = 0; qi < hangCho.length; qi++) {
      const [sx, sy] = hangCho[qi];
      if (!trong(sx, sy) || gan(sx, sy, dSep * 0.92, -1, 0)) continue;
      const idd = id++;
      them(sx, sy, idd, 0);
      const toi = tich(sx, sy, 1, idd);
      let d;
      if (toi.length && toi[toi.length - 1][0] === 'kin') { toi.pop(); d = [[sx, sy], ...toi, [sx, sy]]; }
      else {
        const lui = tich(sx, sy, -1, idd).filter((q) => q[0] !== 'kin');
        d = lui.reverse().concat([[sx, sy]], toi);
      }
      if (d.length < 6) continue;
      duong.push(d);
      for (let i = 0; i < d.length; i += 2) {      // gieo tiếp hai bên, cách đúng dSep
        const a = d[Math.max(0, i - 1)], b = d[Math.min(d.length - 1, i + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], n = Math.hypot(tx, ty) || 1;
        hangCho.push([d[i][0] - ty / n * dSep, d[i][1] + tx / n * dSep], [d[i][0] + ty / n * dSep, d[i][1] - tx / n * dSep]);
      }
    }
  };
  chay(hat.slice());
  const quet = [];
  for (let y = y0; y <= y1; y += dSep) for (let x = x0; x <= x1; x += dSep) quet.push([x, y]);
  chay(quet);
  return duong;
}

/* Dựng mô hình một lần (lần đầu bật mặt A.I): ~70 đường vân, não, mắt, hạt sáng của các sợi năng lượng. */
let MH = null;
// Độ nhô của vân thân. Cổ phía trên, hai bên (sau hàm, dưới tai) lùi dần ra SAU (gáy, cơ cổ): nhìn thẳng thì khuất sau má, hàm;
// quay đầu sang bên thì các điểm phía sau ở bên xa trượt ra ngoài mép hàm — lộ ra, nối liền tai – hàm – cổ như đầu thật.
// (Trước đây cổ chỉ có mặt trước, quay đầu là hở một mảng tối dưới tai — anh khoanh đỏ.) Chuyển mượt, không gãy độ sâu.
function doSauCo(x, y) {
  const w = em(0.42, 0.78, Math.abs(x)) * (1 - em(0.95, 1.15, y));
  return (1 - w) * Math.max(0, doSauThan(x, y)) + w * -0.32;
}
function dungMoHinh() {
  let h = 20261024;
  const ngau = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
  // 120 sợi mảnh chia đều cho 2 luồng: sợi chẵn thuộc luồng Dương (vàng kim), sợi lẻ thuộc luồng Âm (xanh lam) — mỗi luồng là
  // một bó sợi. Mỗi đường vân gắn vào một sợi theo thứ tự hiện (viền đầu trước, chóp mũi sau, rồi cổ, vai);
  // bd = lúc sợi bắt đầu gỡ thành đường vân. Vẽ theo sợi: mỗi sợi một nét, đỡ nặng máy.
  const SO_SOI = 120;
  const cha = Array.from({ length: SO_SOI }, (_, c) => ({ bd: 0.5 + 0.26 * c / SO_SOI, j: c % 2,
    lech: (ngau() - 0.5) * 0.12, f1: 1 + 2 * ngau(), w1: 1.5 + 2 * ngau(), p1: ngau() * 6.28,
    mau: c % 2 ? [90, 150, 255] : [242, 206, 107] }));
  const manh = [];
  const soiTheo = (thuTu) => Math.min(SO_SOI - 1, Math.max(0, Math.floor((thuTu + (ngau() - 0.5) * 0.08) * SO_SOI)));
  const themDuong = (d, thuTu, sang, laDau, mi, buoc = 0.012) => {
    const { d: ds, tong } = chiaDeu(d, buoc);
    const c = soiTheo(thuTu);
    // lúc chuyển cảnh đường này nằm trên một đoạn của luồng dài tương ứng độ dài của nó (đường ngắn trải hết luồng thì thành
    // các nét thẳng cắt ngang luồng)
    const span = Math.min(1, tong / 4), s0 = ngau() * (1 - span);
    // tách theo lớp sáng: đoạn nằm trên bộ não mờ hẳn (sọ trong suốt — não là trọng tâm); mép hàm, dưới cằm dịu bớt; còn lại giữ sáng
    let ht = null, lop = -1;
    ds.forEach(([x, y, s]) => {
      const z = laDau ? Math.max(0, doSau(x, y)) : doSauCo(x, y);
      // lớp: 0 = trên bộ não, 1 = mép hàm – dưới cằm (các vân ôm hàm dồn sát nhau về phía cằm, sáng thành viền), 2 = còn lại
      const l = !laDau ? 2 : trongDaGiac(x, y, NAO.bao) ? 0
        : y > 0.75 && (y > 1.07 || 1 - (x / Math.max(0.01, nuaRong(y))) ** 2 < 0.14) ? 1 : 2;
      if (l !== lop) {
        if (ht) ht.pts.push([x, y, z, s]);
        ht = { cha: c, laDau, f: laDau ? 1 : null, mi, pts: [], sang: sang * [0.17, 0.55, 1][l], s0, span };
        manh.push(ht);
        lop = l;
      }
      ht.pts.push([x, y, z, s]);
    });
  };
  /* Vân như ảnh mẫu: các ĐƯỜNG DÒNG CÁCH ĐỀU chạy theo khối — trên đầu dọc theo đường đồng mức độ nhô (vòng quanh mắt,
     mũi, môi, tai; dọc má; ngang trán), cách nhau đều ~0,034 bán kính đầu; đường dài, liền, chỗ hai dòng gặp nhau thì
     đường dừng gọn — ra chất vân tay / mê cung liền mạch, không đứt vụn. */
  const vDau = luoi(doSau, -1.14, -1.36, 1.14, 1.2, 0.01);
  // Chóp mũi đi dọc, môi và cằm đi ngang (trộn dần vào hướng đồng mức) — không thành các vòng tròn đồng tâm như bia bắn.
  // (Đã thử chất mê cung — từng mảng rẽ vuông góc: thành nhiều đoạn ngắn như nét gạch, anh chê rời rạc, nên bỏ.)
  const tron = (h, gx, gy, w) => {         // trộn hướng h với hướng dẫn (gx, gy) theo trọng số w — hướng không dấu nên lật cho cùng chiều
    if (h[0] * gx + h[1] * gy < 0) { gx = -gx; gy = -gy; }
    const x = h[0] * (1 - w) + gx * w, y = h[1] * (1 - w) + gy * w, l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const dongMucDau = tiepTuyen(vDau, 0.012);
  const huongDau = (x, y) => {
    const ax = Math.abs(x);
    let h = dongMucDau(x, y);
    h = tron(h, 0, 1, 0.85 * g2(ax, y, 0, 0.36, 0.11, 0.12));                  // chóp mũi: dọc
    h = tron(h, 1, 0, 0.85 * Math.max(g2(ax, y, 0, 0.76, 0.2, 0.09), g2(ax, y, 0, 0.98, 0.18, 0.08)));   // môi, cằm: ngang
    return h;
  };
  duongDong((x, y) => vDau(x, y) > 0.004, huongDau, 0.034, 0.007, [-1.14, -1.36, 1.14, 1.2],
    [[0, -0.6], [0.4, 0.45], [-0.4, 0.45], [0.95, 0.12], [-0.95, 0.12]]).forEach((d) => {
    const zt = d.reduce((t, [x, y]) => t + Math.max(0, vDau(x, y)), 0) / d.length;
    themDuong(d, 0.62 * Math.min(1, zt), 0.64, true);
  });
  // viền đầu (kể cả tai) cho lớp kính trong suốt và vệt quét
  let vien = null;
  dongMuc(doSau, -1.12, -1.34, 113, 127, 0.02, [0.004]).forEach(({ d }) => { if (!vien || d.length > vien.length) vien = d; });
  // mí mắt (chớp theo mắt) và khe miệng
  const cung = (n, ham) => Array.from({ length: n }, (_, i) => ham(i / (n - 1)));
  for (const b of [-1, 1]) {
    themDuong(cung(14, (t) => [b * (0.2 + 0.28 * t), 0.012 - 0.06 * Math.sin(Math.PI * t) * (1 - 0.25 * t)]), 0.62, 0.7, true, true, 0.03);
    themDuong(cung(14, (t) => [b * (0.2 + 0.28 * t), 0.012 + 0.032 * Math.sin(Math.PI * t)]), 0.62, 0.55, true, true, 0.03);
  }
  themDuong(cung(17, (t) => { const x = -0.21 + 0.42 * t; return [x, 0.725 + 0.012 * (x / 0.21) ** 2]; }), 0.62, 0.6, true, false, 0.03);
  // cổ + vai + ngực liền một mạch với đầu: đường dòng theo (0,7·y − độ nhô) — trên cổ thành vòng ngang, xuống ngực loang
  // rộng, tới mép uốn theo dốc vai. Thân đứng yên, cổ xoay theo đầu một phần. Vân cổ chạy LIỀN lên tận dưới hàm; lúc vẽ,
  // phần nằm sau mặt bị che theo đường viền đầu của khung hình đó — đầu quay sang bên thì cổ lộ ra tới đâu có vân tới đó
  // (trước đây chừa sẵn vùng dưới hàm, quay đầu là hở một khoảng trống, đứt nét giữa hàm và cổ).
  // Thêm mặt bên cổ chạy lên sau tai (cơ cổ) — chỉ phần nằm trong viền đầu nên nhìn thẳng thì khuất sau má, hàm; quay đầu
  // sang bên thì phía bên kia lộ ra, nối liền tai – hàm – cổ (mô hình đầu chỉ có mặt trước, thiếu phần này là hở một mảng).
  const coBen = (x, y) => y > 0.32 && y < 1.05 && Math.abs(x) > 0.3 && Math.abs(x) < 0.9 && doSau(x, y) > 0.002;
  const vThan = luoi((x, y) => 0.7 * y - doSauThan(x, y), -2.0, 0.3, 2.0, 3.0, 0.012);
  const mThan = luoi((x, y) => ((y > 0.6 && Math.abs(x) < noiSuy(RONG_THAN, y) - 0.012) || coBen(x, y) ? 1 : 0),
    -2.0, 0.3, 2.0, 3.0, 0.012);
  duongDong((x, y) => mThan(x, y) > 0.5, tiepTuyen(vThan, 0.015), 0.038, 0.008, [-2.0, 0.3, 2.0, 3.0],
    [[0, 1.3], [0.9, 1.95], [-0.9, 1.95], [0, 2.5], [0.62, 0.62], [-0.62, 0.62]]).forEach((d) => {
    const ym = d.reduce((t, q) => t + q[1], 0) / d.length;
    // mẩu ngắn kẹt giữa mép thân và đường kế bên (đỉnh dốc vai, góc dưới): đứng lẻ thành nét đứt (anh chụp gần thấy) — bỏ
    const mep = ([x, y]) => Math.abs(x) > noiSuy(RONG_THAN, y) - 0.1 || y > 2.9;
    if (ym > 0.6 && d.length * 0.008 < 0.3 && mep(d[0]) && mep(d[d.length - 1])) return;
    themDuong(d, 0.64 + 0.34 * em(0.6, 2.9, ym), 0.56 * (1 - 0.7 * em(2.2, 2.95, ym)), false);
  });
  // viền thân hai bên: một nét liền từ cổ xuống dốc vai tới cánh tay — vân thân chạm mép thì gặp nét này, đỉnh vai không còn
  // lởm chởm như răng lược. Chia đoạn để phía dưới mờ dần như các vân bên cạnh.
  for (const b of [-1, 1]) {
    for (let y0 = 1.0; y0 < 2.95; y0 += 0.25) {
      const d = [];
      for (let y = y0; y <= Math.min(2.97, y0 + 0.25) + 1e-9; y += 0.01) d.push([b * (noiSuy(RONG_THAN, y) - 0.008), y]);
      const ym = y0 + 0.125;
      themDuong(d, 0.64 + 0.34 * em(0.6, 2.9, ym), 0.56 * (1 - 0.7 * em(2.2, 2.95, ym)), false);
    }
  }
  manh.forEach((m) => {
    // vạch giữa miệng: đường vân trong cùng của nhóm vòng môi (y ≈ 0,79, rộng ~0,22) — mắt người đọc nó là "miệng"; vẽ thêm một nét
    // sáng hơn (anh khoanh đỏ: "chỉ cần 1 vạch sáng hơn"). Mây nói thì vạch hạ cùng môi dưới.
    m.khe = m.laDau && !m.mi && m.pts.every(([x, y]) => Math.abs(x) < 0.14 && y > 0.775 && y < 0.8);
    // mảnh vân cổ sát dưới hàm (có thể bị mặt che khi đầu quay): chỉ những mảnh này phải vẽ qua lớp che — lớp che tốn công
    m.sauMat = !m.laDau && m.pts.some(([x, y]) => y < 1.35 && Math.abs(x) < 0.95);
    const n = m.pts.length;
    m.d = new Float32Array(n * 5);
    m.pts.forEach(([x, y, z, s], i) => {
      m.d.set([x, y, z, s, m.f ?? 0.85 * (1 - em(1.05, 1.5, y))], i * 5);
    });
    m.b = new Float32Array(n * 2);
    delete m.pts;
  });
  const theoCha = cha.map(() => []);
  manh.forEach((m) => theoCha[m.cha].push(m));
  cha.forEach((c, i) => { c.sang = theoCha[i].reduce((t, m) => t + m.sang, 0) / Math.max(1, theoCha[i].length); });
  const hat = Array.from({ length: 90 }, () => ({ cha: Math.floor(ngau() * cha.length), s0: ngau(), v: (ngau() - 0.5) * 0.5, r: 0.6 + ngau() * 1.2 }));
  const vienD = new Float32Array(vien.length * 3);
  vien.forEach(([x, y], i) => vienD.set([x, y, 0], i * 3));
  return { cha, manh, theoCha, hat, vien: vienD, vienB: new Float32Array(vien.length * 2),
    mat: [-1, 1].map((b) => [b * 0.34, 0.0, doSau(b * 0.34, 0) + 0.05]), vungXY: [] };
}

// Mỗi ghi chú một chỗ cố định trong não: vùng nào nằm ở thuỳ hướng về vòng tròn của vùng đó (trái → phải như các vòng).
const bam = (s, hat) => {
  let x = 2166136261 ^ hat;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return ((x >>> 0) % 100003) / 100003;
};
/* ---------- Đầu A.I theo ảnh mẫu anh chọn ----------
   Anh gửi bốn ảnh mẫu, chọn ảnh "đầu đội mũ giáp trắng – xanh, bộ não phát sáng trong vòm kính, Bát Quái giữa ngực, vầng hào
   quang sau đầu" và dặn "sửa giống y chang như ảnh mẫu". Dùng chính ảnh đó (public/dau-ai.webp: tách khỏi nền — nền tối và vầng
   sáng quanh người thành trong suốt dần, hoà vào nền trang; mép vai và đáy mờ dần) làm đầu khi đã thành hình; các lớp dữ liệu vẽ
   chồng lên: nơ-ron ghi chú là các chấm nhỏ màu vùng trong bộ não của ảnh (như hạt cườm, rõ màu mà không đậm), trục thần kinh từ vòng vùng
   vào rìa não, cung liên kết, lõi Bát Quái sống (có khí vận hành) đặt đúng chỗ Bát Quái trên ngực, mắt và khe miệng sáng lên khi
   Mây nói. Toạ độ: như mô hình đầu (đơn vị = bán kính đầu); ảnh đặt sao cho hai mắt trùng mắt mô hình (±0,34; 0,03) — lúc chuyển
   cảnh các đường vân gỡ ra thành đầu rồi ảnh hiện dần lên đúng chỗ. Đầu không quay theo chuột (ảnh phẳng); đường vân chỉ còn dùng
   lúc chuyển cảnh và khi ảnh chưa tải được. Ảnh đã có vầng hào quang nên không vẽ thêm ba vòng nét đứt. */
const ANH_DAU = { img: new Image(), ok: false,
  X: -1.899, Y: -1.4295, R: 3.798, C: 4.5577,                     // góc trên trái, rộng, cao (đơn vị đầu)
  BQ: [-0.008, 2.3377], BQR: 0.2916,                                      // Bát Quái giữa ngực: tâm, bán kính (đo trên ảnh)
  MAT: [[-0.34, 0.047], [0.34, 0.047]], MONG: 0.085,                      // tâm hai mống mắt, bán kính mống mắt
  // khe mắt trái (đo trên ảnh, đi vòng từ khoé ngoài theo mí trên rồi mí dưới); mắt phải lấy đối xứng. Ánh sáng thêm vào mắt
  // chỉ nằm trong khe này — mí che bớt mống mắt như mắt thật, vòng sáng không tràn ra mi.
  KHE_MAT: [[-0.484, 0.018], [-0.442, 0.001], [-0.393, -0.007], [-0.343, -0.011], [-0.293, -0.009], [-0.252, 0.004],
    [-0.217, 0.036], [-0.187, 0.077], [-0.172, 0.106], [-0.21, 0.118], [-0.26, 0.122], [-0.318, 0.12], [-0.372, 0.11],
    [-0.419, 0.092], [-0.455, 0.066], [-0.476, 0.039]] };
ANH_DAU.img.decoding = 'async';
ANH_DAU.img.onload = () => { ANH_DAU.ok = true; };
ANH_DAU.img.src = 'dau-ai.webp';
// khe miệng trong ảnh — luôn sáng nhẹ, Mây nói thì sáng rực theo nhịp
const KHE_ANH = [[-0.224, 0.667], [-0.12, 0.671], [0, 0.674], [0.12, 0.671], [0.24, 0.667]];
function cong(ds, n) {                    // đường cong Catmull-Rom qua các điểm
  const kq = [];
  for (let i = 0; i < ds.length - 1; i++) {
    const p0 = ds[Math.max(0, i - 1)], p1 = ds[i], p2 = ds[i + 1], p3 = ds[Math.min(ds.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      kq.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2
        + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  kq.push(ds[ds.length - 1]);
  return kq;
}
// Bộ não trong vòm kính của ảnh: viền (dò trên ảnh, thu vào 12% cho chấm nằm gọn trên não), tâm vỏ não
const NAO = {
  bao: [[0.551, -0.872], [0.526, -0.825], [0.511, -0.781], [0.499, -0.738], [0.494, -0.692], [0.463, -0.656], [0.432, -0.622], [0.432, -0.568], [0.382, -0.551], [0.344, -0.527], [0.315, -0.496], [0.252, -0.51], [0.215, -0.497], [0.188, -0.467], [0.15, -0.458], [0.119, -0.426], [0.085, -0.383], [0.052, -0.275], [-0.0, -0.197], [-0.05, -0.304], [-0.088, -0.374], [-0.12, -0.426], [-0.151, -0.46], [-0.187, -0.473], [-0.212, -0.505], [-0.25, -0.516], [-0.316, -0.496], [-0.343, -0.529], [-0.387, -0.547], [-0.436, -0.567], [-0.466, -0.603], [-0.461, -0.657], [-0.495, -0.692], [-0.5, -0.738], [-0.512, -0.781], [-0.527, -0.825], [-0.552, -0.872], [-0.556, -0.92], [-0.535, -0.966], [-0.528, -1.013], [-0.541, -1.068], [-0.514, -1.111], [-0.518, -1.171], [-0.445, -1.183], [-0.386, -1.194], [-0.366, -1.237], [-0.327, -1.261], [-0.283, -1.276], [-0.244, -1.294], [-0.203, -1.306], [-0.159, -1.308], [-0.121, -1.32], [-0.081, -1.326], [-0.041, -1.331], [-0.0, -1.347], [0.039, -1.331], [0.08, -1.329], [0.119, -1.317], [0.16, -1.313], [0.201, -1.306], [0.242, -1.291], [0.282, -1.276], [0.313, -1.245], [0.362, -1.235], [0.402, -1.209], [0.439, -1.18], [0.516, -1.169], [0.51, -1.11], [0.534, -1.067], [0.518, -1.011], [0.531, -0.965], [0.56, -0.92]],
  Z: 0,
  GIUA: [0, -0.87],          // tâm vỏ não: các vùng kiến thức chia lãnh thổ quanh điểm này
};
function trongDaGiac(x, y, d) {
  let c = false;
  for (let i = 0, j = d.length - 1; i < d.length; j = i++) {
    const [xi, yi] = d[i], [xj, yj] = d[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// điểm nằm trên vỏ não: trong viền, ngoài rãnh giữa hai bán cầu, cách mép một chút (chấm không nằm ngay trên viền). Mép trên
// cách xa hơn: viền đo trên ảnh lấy cả lớp kính vòm sáng ngay trên đỉnh não (~0,05) — chấm nằm đó trông như lơ lửng trên kính.
const trongNao = (x, y) => Math.abs(x) > 0.03 && [[0, 0], [0.035, 0], [-0.035, 0], [0, 0.035], [0, -0.085]]
  .every(([dx, dy]) => trongDaGiac(x + dx, y + dy, NAO.bao));

// Mỗi ghi chú một nốt cố định trên vỏ não, rải đều trong "lãnh thổ" của vùng: vỏ não chia hình quạt quanh tâm theo thứ tự các
// vòng (trái → qua đỉnh → phải, như các vòng quanh đầu), mỗi vùng một quạt, kín cả bộ não.
const QUAT0 = 2.2, QUAT1 = 2 * Math.PI + 0.94;    // góc quanh tâm vỏ não (y hướng xuống): từ trái-dưới, qua đỉnh, tới phải-dưới
const gocNao = (x, y) => { const g = Math.atan2(y - NAO.GIUA[1], x - NAO.GIUA[0]); return g < 1.57 ? g + 2 * Math.PI : g; };
// Hai chấm không chồng lên nhau (chồng thì trông như một chấm, bấm trúng chấm bên cạnh): chỗ thử cách các chấm đã đặt của vùng
// mình và hai vùng kề ít nhất kc — kc theo mật độ của vùng (quạt ~0,75/n đơn vị², vùng đông thì khít hơn, tối đa 0,055). Thử
// hết lượt vẫn không được thì lấy chỗ thoáng nhất đã thử.
function viTriNao(nd) {
  const n = Math.max(1, vongMau.length), id = String(nd.note.id), w = (QUAT1 - QUAT0) / n;
  const g0 = QUAT0 + nd.vong * w + 0.06 * w, g1 = QUAT0 + (nd.vong + 1) * w - 0.06 * w;
  const cung = nodes.filter((m) => m.vong === nd.vong).length;
  const kc = keo(0.75 * Math.sqrt(0.75 / n / Math.max(1, cung)), 0.02, 0.055);
  const da = nodes.filter((m) => m.nao && m !== nd && Math.abs(m.vong - nd.vong) <= 1);
  let tot = null, xa = -1;
  for (let lan = 0; lan < 240; lan++) {
    // lấy mẫu thẳng trong quạt của vùng (đều theo diện tích quanh tâm vỏ não; 0,7 phủ hết viền não) — đa số chỗ thử hợp lệ
    const g = g0 + (g1 - g0) * bam(id, 11 + 2 * lan), r = 0.7 * Math.sqrt(bam(id, 12 + 2 * lan));
    const x = NAO.GIUA[0] + r * Math.cos(g), y = NAO.GIUA[1] + r * Math.sin(g);
    if (!trongNao(x, y)) continue;
    let d = 9;
    for (const m of da) { d = Math.min(d, Math.hypot(m.nao[0] - x, m.nao[1] - y)); if (d < xa) break; }
    if (d >= kc) return [x, y, NAO.Z];
    if (d > xa) { xa = d; tot = [x, y, NAO.Z]; }
  }
  if (tot) return tot;
  const g = (g0 + g1) / 2;
  return [0.4 * Math.cos(g), NAO.GIUA[1] + 0.25 * Math.sin(g), NAO.Z];
}

function capNhatMat(tg) {
  // vào ~3,2 giây (đủ thấy hai luồng Âm Dương và vòng Tiên Thiên), ra ~1,6 giây
  const buoc = itMotion ? 1 : dtKhung / 1000 / (matDich ? 3.2 : 1.6);
  kMat = matDich ? Math.min(1, kMat + buoc) : Math.max(0, kMat - buoc);
  eMat = em(0, 1, kMat);
  anQD = 1 - em(0, 0.3, kMat);
  // bố cục: vòng tròn các vùng trên đỉnh đầu (≈ −2 đơn vị) tới lò phản ứng trên ngực, nằm gọn giữa thanh chuyển và phụ đề
  const rong = W - lechDich, hep = rong < 600;
  // trên chừa chỗ cho thanh chuyển / thông báo toàn màn hình (toàn màn hình không có thanh chuyển: chừa ít hơn); dưới chừa đủ
  // phụ đề 2 dòng (câu trả lời dài) — trước đây chừa 60px (toàn màn hình 18px): phụ đề 2 dòng đè lên lõi Bát Quái.
  // Điện thoại: phụ đề nằm trong ô riêng dưới khung (CSS) — không cần chừa.
  const phuDeNgoai = !tapTrung && matchMedia('(max-width:900px)').matches;
  const tren = tapTrung ? 34 : 50, duoi = H - (phuDeNgoai ? 18 : tapTrung ? 96 : 90);
  // chiều cao cần (đơn vị đầu): vòng vùng trên cùng ≈ −2 tới lò phản ứng trên ngực (đường vân 2,14; ảnh mẫu: Bát Quái giữa ngực)
  const cao = ANH_DAU.ok ? 2.06 + ANH_DAU.BQ[1] + ANH_DAU.BQR : 4.14;
  MAT.u = Math.max(30, Math.min((duoi - tren - 60) / cao, hep ? rong / 2.35 : (rong / 2 - 70) / 2.2));
  MAT.oy = tren + 24 + 2.0 * MAT.u + Math.max(0, duoi - tren - 60 - cao * MAT.u) / 2;
  const t = giay();
  const dangNoi = loiNoi && t - loiNoi.t0 < loiNoi.dai;
  // đầu nhìn theo con trỏ; không có con trỏ (điện thoại) thì lắc nhẹ; đang nói thì gật khẽ theo nhịp
  let yawT = 0, pitchT = 0;
  if (!itMotion) {
    if (chuot) {
      yawT = keo((chuot.x - CX) / (rong * 0.5), -1, 1) * 0.42;
      pitchT = -keo((chuot.y - MAT.oy) / (H * 0.5), -1, 1) * 0.2;
    } else { yawT = 0.2 * Math.sin(tg * 0.4); pitchT = 0.05 * Math.sin(tg * 0.55); }
    if (dangNoi) pitchT += 0.03 * Math.sin(t * 6);
  }
  if (ANH_DAU.ok) yawT = pitchT = 0;     // đầu là ảnh phẳng: không quay theo chuột
  MAT.yaw += (yawT - MAT.yaw) * 0.05;
  MAT.pitch += (pitchT - MAT.pitch) * 0.05;
  QUAY.cy = Math.cos(MAT.yaw); QUAY.sy = Math.sin(MAT.yaw); QUAY.cp = Math.cos(MAT.pitch); QUAY.sp = Math.sin(MAT.pitch);
  // chớp mắt mỗi 2,5–5,5 giây
  if (!itMotion && t > MAT.henChop) { MAT.batDauChop = t; MAT.henChop = t + 2.5 + Math.random() * 3; }
  const dc = t - MAT.batDauChop;
  MAT.chop = dc < 0.16 ? 1 - 0.9 * Math.sin(dc / 0.16 * Math.PI) : 1;
  // miệng: mở theo âm tiết giả lập khi đang nói
  if (dangNoi && !itMotion) {
    const tt = t - loiNoi.t0, cuoi = Math.min(1, (loiNoi.dai - tt) / 0.3);
    MAT.mieng = 0.16 * Math.abs(Math.sin(tt * 13)) * (0.55 + 0.45 * Math.sin(tt * 3.7 + 1)) * cuoi;
  } else MAT.mieng = 0;
  // Phụ đề chạy chữ, tắt sau khi nói xong 3 giây. Khung giữ đủ cỡ cả câu ngay từ đầu (phần chưa tới trong suốt) nên không
  // co giãn, nhảy qua lại theo từng chữ; chữ hiện mượt, bám theo tiếng đang đọc nhưng không vọt (tối đa ~24 chữ/giây).
  const pd = $('#loiMay');
  if (loiNoi && t - loiNoi.t0 < loiNoi.dai + 3 && eMat > 0.5) {
    const ln = loiNoi, dai = ln.chu.length;
    const dich = itMotion || ln.xong ? dai
      : ln.tieng ? Math.max(ln.chiSo || 0, (t - ln.t0) * 9)
        : dai * keo((t - ln.t0) / (ln.dai * 0.9), 0, 1);
    ln.hienN = itMotion ? dai : Math.min(dai, ln.hienN + keo(dich - ln.hienN, 0, 24 * dtKhung / 1000));
    const n = String(Math.ceil(ln.hienN)) + '|' + ln.t0;
    if (pd.dataset.n !== n) {
      pd.firstElementChild.textContent = ln.chu.slice(0, Math.ceil(ln.hienN));
      pd.lastElementChild.textContent = ln.chu.slice(Math.ceil(ln.hienN));
      pd.dataset.n = n;
    }
    pd.style.left = `${CX}px`;                              // canh giữa theo khuôn mặt (thẻ chi tiết mở thì mặt dịch trái)
    pd.style.maxWidth = `${Math.round(rong * 0.9)}px`;
    pd.hidden = false;
  } else if (!pd.hidden) { pd.hidden = true; pd.dataset.n = ''; }
  // nút loa luôn nằm trong phần còn nhìn thấy (thẻ chi tiết mở thì dịch sang trái theo)
  if (matDich) {
    $('#batTieng').style.right = `${16 + Math.round(lechDich)}px`;
    $('#noiMay').style.right = `${58 + Math.round(lechDich)}px`;
  }
  // lõi Bát Quái: giữa đồ thị ↔ chỗ Bát Quái giữa ngực của ảnh mẫu; ảnh chưa tải được thì lò phản ứng của đầu đường vân
  const lo = ANH_DAU.ok ? chieuDiem(ANH_DAU.BQ[0], ANH_DAU.BQ[1], 0, 1) : chieuDiem(0, LO_NGUC, doSauThan(0, LO_NGUC), 0);
  const e = em(0.45, 0.95, kMat);
  LX = CX + (lo.x - CX) * e;
  LY = CY + (lo.y - CY) * e;
}

/* Tiếng nói. Thứ tự chọn giọng:
   1. Giọng tiếng Việt cài sẵn trong máy (Windows "Microsoft An" — Edge mới thấy; Android Google; iPhone "Linh") — không gửi gì ra ngoài.
   2. Giọng tiếng Việt qua mạng (Edge: HoaiMy, NamMinh) — chỉ khi anh đồng ý rõ ràng (bấm nút loa → hộp hỏi): chữ Mây đọc gửi
      lên máy chủ của hãng; tắt tiếng là bỏ quyền này.
   3. Không có giọng tiếng Việt nào (vd Chrome trên Windows chỉ thấy giọng tiếng Anh): giọng NỮ tiếng Anh trong máy (Windows
      "Zira", Mac "Samantha"…), chỉnh trầm ấm hơn chút. Câu của Mây (chào, báo vùng, trả lời lệnh) nói bằng tiếng Anh; chữ của anh
      (tên ghi chú, câu trả lời từ kho) đọc không dấu cho giọng tiếng Anh đọc được.
   Không có giọng nào: nút loa vàng, rê vào xem lý do; Mây vẫn hiện phụ đề. */
const coDocNoi = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let coTieng = true, choMang = false, daHoiMang = false, giongViet = null, giongMang = null, giongAnh = null, cauDangDoc = null;
try {
  coTieng = localStorage.getItem('sb.tieng') !== '0';
  choMang = localStorage.getItem('sb.giongMang') === '1';
  daHoiMang = localStorage.getItem('sb.hoiGiongMang') === '1';
} catch (_) { /* mặc định có tiếng, chỉ giọng trong máy */ }
const giongVN = (ds) => ds.find((v) => /^vi[-_]VN$/i.test(v.lang)) || ds[0] || null;
const GIONG_NU = /zira|aria|jenny|samantha|karen|moira|tessa|serena|libby|sonia|hazel|susan|catherine|allison|ava|victoria|female/i;
function chonGiong() {
  if (!coDocNoi) return;
  const ds = speechSynthesis.getVoices();
  const vi = ds.filter((v) => /^vi([-_]|$)/i.test(v.lang));
  giongViet = giongVN(vi.filter((v) => v.localService));
  giongMang = giongVN(vi.filter((v) => !v.localService));
  const en = ds.filter((v) => /^en([-_]|$)/i.test(v.lang) && v.localService);
  giongAnh = en.find((v) => GIONG_NU.test(v.name) && /^en[-_](US|GB)$/i.test(v.lang)) || en.find((v) => GIONG_NU.test(v.name))
    || en.find((v) => /^en[-_]US$/i.test(v.lang)) || en[0] || null;
  capNhatLoa();
}
const giongDung = () => giongViet || (choMang ? giongMang : null) || giongAnh;
const laTiengAnh = (g) => !!g && !/^vi/i.test(g.lang);
const boDau = (s) => String(s).normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
function capNhatLoa() {
  const b = $('#batTieng'), g = giongDung(), thieu = coTieng && !g;
  b.setAttribute('aria-pressed', String(coTieng));
  b.classList.toggle('thieu-giong', thieu);
  b.title = !coTieng ? 'Đang tắt tiếng — bấm để bật'
    : thieu ? 'Máy chưa có giọng đọc nào — Mây chỉ hiện phụ đề (xem Hướng dẫn)'
      : laTiengAnh(g) ? `Đang có tiếng — giọng tiếng Anh ${g.name} (máy chưa có giọng tiếng Việt) — bấm để tắt`
        : `Đang có tiếng — ${g.name}${g.localService ? '' : ' (giọng qua mạng)'} — bấm để tắt`;
}
function luuGiong() {
  try {
    localStorage.setItem('sb.tieng', coTieng ? '1' : '0');
    localStorage.setItem('sb.giongMang', choMang ? '1' : '0');
    localStorage.setItem('sb.hoiGiongMang', daHoiMang ? '1' : '0');
  } catch (_) { /* không lưu được thì thôi */ }
}
function datTieng(bat) {
  coTieng = bat;
  if (!bat) { choMang = false; daHoiMang = false; }   // tắt tiếng là bỏ quyền dùng giọng qua mạng — bật lại, bấm loa sẽ hỏi lại
  luuGiong();
  if (!bat && coDocNoi) speechSynthesis.cancel();
  capNhatLoa();
}
if (coDocNoi) {
  chonGiong();
  speechSynthesis.addEventListener?.('voiceschanged', chonGiong);   // Chrome nạp danh sách giọng sau khi mở trang
}
// Edge chưa cài giọng Windows nhưng có giọng tiếng Việt qua mạng: lần đầu bấm loa thì hỏi (thay vì đọc tiếng Anh mãi)
function hoiGiongMang() {
  daHoiMang = true;
  choMang = confirm('Máy chưa cài giọng tiếng Việt trong máy — Mây đang nói bằng giọng tiếng Anh.\n\n'
    + `Bấm OK để dùng giọng tiếng Việt qua mạng "${giongMang.name}": chữ Mây đọc (lời chào, tên ghi chú, câu trả lời) `
    + 'sẽ được gửi lên máy chủ của hãng để đọc. Tắt tiếng là bỏ quyền này.\n\n'
    + 'Bấm Huỷ để giữ riêng tư: Mây tiếp tục nói tiếng Anh — cài giọng tiếng Việt cho máy theo Hướng dẫn.');
  luuGiong();
  capNhatLoa();
  noi('Mây đây. Anh nghe rõ không?', 'Hi, this is May. Can you hear me clearly?');
}

// "Mây nói": nhép miệng + phụ đề + tiếng (chỉ ở chế độ mặt A.I). chuAnh: câu tương đương khi phải dùng giọng tiếng Anh.
function noi(chu, chuAnh) {
  if (!matDich || !chu) return;
  if (coTieng && coDocNoi && !giongDung()) chonGiong();
  const g = coTieng && coDocNoi ? giongDung() : null, anh = laTiengAnh(g);
  const hien = String(anh && chuAnh ? chuAnh : chu).replace(/\s+/g, ' ').trim();   // phụ đề = đúng câu đang đọc
  const ln = { chu: hien, t0: giay(), dai: keo(hien.length * 0.075, 1.6, 9), hienN: 0 };
  loiNoi = ln;
  if (!g) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(anh && !chuAnh ? boDau(hien) : hien);   // bỏ dấu: cùng độ dài, phụ đề vẫn khớp chữ
  u.voice = g;
  u.lang = g.lang;
  u.rate = anh ? 0.96 : 1;
  u.pitch = anh ? 0.92 : 1;                // giọng nữ tiếng Anh trầm ấm hơn chút
  // miệng và phụ đề bám theo tiếng thật: bắt đầu khi phát, tới đâu hiện chữ tới đó, dừng khi đọc xong
  u.onstart = () => { ln.t0 = giay(); ln.dai = 60; ln.tieng = true; };
  u.onboundary = (e) => { ln.chiSo = e.charIndex + (e.charLength || 0); };
  u.onend = u.onerror = () => { if (ln.tieng) ln.dai = giay() - ln.t0; ln.xong = true; };
  cauDangDoc = u;                          // giữ tham chiếu: Chrome có lúc thu hồi câu đang đọc, mất sự kiện kết thúc
  speechSynthesis.resume();                // Chrome đôi khi kẹt ở trạng thái tạm dừng — đọc mà không ra tiếng
  speechSynthesis.speak(u);
}
const cauDau = (s) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^.{20,160}?[.!?…](\s|$)/);
  return m ? m[0].trim() : t.slice(0, 160) + (t.length > 160 ? '…' : '');
};

/* Nghe anh nói: nhập bằng giọng nói (ô Chủ đề, Nội dung, ô dán ở Nạp, Tìm, Hỏi) và nói với Mây ở chế độ mặt A.I.
   Bộ nhận giọng của Chrome / Edge chạy trên máy chủ Google / Microsoft (âm thanh gửi đi để chuyển thành chữ), nên mỗi lần mở
   trình duyệt, lần đầu bấm micro sẽ hỏi anh đồng ý. Chữ nhận được chỉ điền vào ô hoặc dùng để tìm trong kho của anh.
   Ghi chú nhập bằng giọng: tự gắn nguồn "voice" + thẻ giong-noi để sau rà lại; không tự lưu — anh xem lại rồi bấm Lưu.
   Trình duyệt không có bộ nhận giọng (vd Firefox) thì không hiện nút micro. */
const NhanGiong = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" '
  + 'fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" stroke-width="1.8" '
  + 'stroke-linecap="round"/></svg>';
const LOI_NGHE = {
  'not-allowed': 'Trình duyệt chưa cho dùng micro — bấm biểu tượng ổ khoá cạnh địa chỉ trang, cho phép Micro rồi thử lại.',
  'service-not-allowed': 'Trình duyệt chưa cho dùng bộ nhận giọng — bấm biểu tượng ổ khoá cạnh địa chỉ trang để cho phép.',
  'no-speech': 'Chưa nghe thấy gì — bấm micro rồi nói nhé.',
  'audio-capture': 'Không thấy micro trên máy.',
  network: 'Không nhận được giọng — bộ nhận giọng của trình duyệt cần mạng.',
};
let dangNghe = null;
function choPhepNghe() {
  try { if (sessionStorage.getItem('sb.nghe') === '1') return true; } catch (_) { /* hỏi lại */ }
  const ok = confirm('Nhập bằng giọng nói dùng bộ nhận giọng của trình duyệt: Chrome gửi âm thanh lên máy chủ Google, Edge lên '
    + 'máy chủ Microsoft để chuyển thành chữ. Chữ nhận được chỉ điền vào ô hoặc dùng để tìm trong kho của anh.\n\n'
    + 'Bấm OK để dùng micro (mở lại trình duyệt sẽ hỏi lại). Bấm Huỷ để không dùng.');
  if (ok) try { sessionStorage.setItem('sb.nghe', '1'); } catch (_) { /* chỉ lần này */ }
  return ok;
}
// Nghe một lượt: khiNghe(chữ nghe được tới giờ) gọi liên tục, khiXong(chữ đã chốt) khi dừng. Đang nghe mà bấm micro là dừng.
function nghe(nut, { lienTuc = false, khiNghe, khiXong } = {}) {
  if (dangNghe) { dangNghe.rec.stop(); return; }
  if (!choPhepNghe()) return;
  const rec = new NhanGiong();
  rec.lang = 'vi-VN';
  rec.interimResults = true;
  rec.continuous = lienTuc;
  let chot = '';
  rec.onresult = (e) => {
    let tam = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) chot += e.results[i][0].transcript; else tam += e.results[i][0].transcript;
    }
    khiNghe?.((chot + tam).trim());
  };
  rec.onerror = (e) => { if (LOI_NGHE[e.error]) baoNhanh(LOI_NGHE[e.error], 6000); };
  rec.onend = () => {
    nut.classList.remove('dang-nghe');
    if (dangNghe?.rec === rec) dangNghe = null;
    khiXong?.(chot.trim());
  };
  if (coDocNoi) speechSynthesis.cancel();      // Mây im khi anh nói — không tự nghe chính mình
  try { rec.start(); } catch (_) { return; }
  dangNghe = { rec, nut };
  nut.classList.add('dang-nghe');
}
// nút micro trong ô nhập: chữ nghe được nối vào sau chữ đang có
function ganMic(o, { lienTuc = false, khiXong } = {}) {
  if (!NhanGiong || !o) return;
  const boc = document.createElement('span');
  boc.className = 'co-mic';
  o.replaceWith(boc);
  const nut = document.createElement('button');
  nut.type = 'button';
  nut.className = 'mic';
  nut.title = 'Nói để nhập (bấm lại để dừng)';
  nut.setAttribute('aria-label', 'Nhập bằng giọng nói');
  nut.innerHTML = MIC_SVG;
  boc.append(o, nut);
  nut.addEventListener('click', () => {
    const goc = o.value;
    const dien = (chu) => {
      o.value = goc + (goc && chu && !/\s$/.test(goc) ? ' ' : '') + chu;
      o.dispatchEvent(new Event('input', { bubbles: true }));
    };
    nghe(nut, { lienTuc, khiNghe: dien, khiXong: (chu) => { if (chu) dien(chu); khiXong?.(chu); } });
  });
}
const oThem = (ten) => $('#formThem').elements.namedItem(ten);
function danhDauGiong() {                  // ghi chú nhập bằng giọng: nguồn voice + thẻ giong-noi (anh bỏ thẻ được)
  oThem('source').value = 'voice';
  const the = oThem('tags').value.split(',').map((x) => x.trim()).filter(Boolean);
  if (!the.includes('giong-noi')) oThem('tags').value = [...the, 'giong-noi'].join(', ');
}
ganMic(oThem('title'), { khiXong: (c) => c && danhDauGiong() });
ganMic(oThem('content'), { lienTuc: true, khiXong: (c) => c && danhDauGiong() });
ganMic($('#napChu'), { lienTuc: true });
ganMic($('#oTim'));
ganMic($('#oHoi'), { khiXong: (c) => { if (c) $('#nutHoi').click(); } });

/* Nói với Mây (chế độ mặt A.I, nút micro cạnh nút loa):
   "tìm / tra cứu …" → tìm trong kho, đọc số kết quả + ghi chú đầu, các nơ-ron tìm thấy nháy sáng, danh sách ở tab Tìm;
   "mở / xem …" → mở ghi chú khớp nhất; "ghi chú / ghi lại / ghi nhớ …" → chép vào ô Thêm để anh xem lại rồi bấm Lưu
   (giống quy tắc xác nhận giọng nói của Mây); "thoát" → về quỹ đạo; câu khác → hỏi Mây như tab Hỏi, đọc câu đầu câu trả lời. */
let nhayNoron = null;
async function timBangGiong(q, mo) {
  const r = await api('/api/search?' + new URLSearchParams({ q }));
  const ds = r.ok && Array.isArray(r.notes) ? r.notes : [];
  $('#oTim').value = q;
  moTab('tim');
  timNgay();
  if (!ds.length) { noi(`Chưa có ghi chú nào về ${q}.`, `I found no notes about ${boDau(q)}.`); return; }
  nhayNoron = { ids: new Set(ds.map((n) => n.id)), t0: giay() };
  if (mo) { moChiTiet(ds[0].id); noi(ds[0].title); return; }
  noi(`Có ${ds.length} ghi chú về ${q}. Đầu tiên: ${ds[0].title}.`,
    `I found ${ds.length} ${ds.length === 1 ? 'note' : 'notes'} about ${boDau(q)}. First: ${boDau(ds[0].title)}.`);
}
function ghiBangGiong(noiDung) {
  moTab('them');
  oThem('content').value = noiDung;
  danhDauGiong();
  oThem('title').focus();
  noi('Em đã chép vào ô Thêm. Anh đặt chủ đề, xem lại rồi bấm Lưu nhé.',
    'I put it in the Add form. Please add a title, check it, then press Save.');
}
function lenhGiong(cau) {
  const c = cau.replace(/[.?!…]+$/u, '').trim();
  let m;
  if (/^(thoát|tắt mặt|về quỹ đạo|tạm biệt)/iu.test(c)) {
    noi('Tạm biệt anh.', 'Goodbye.');
    setTimeout(() => datMat(false), 1300);
  } else if ((m = c.match(/^(?:tìm kiếm|tìm|tra cứu|tra|kiếm)(?:\s+(?:giúp|cho)\s+(?:anh|em|tôi))?(?:\s+về)?\s+(.+)/iu))) {
    timBangGiong(m[1], false);
  } else if ((m = c.match(/^(?:mở|xem)(?:\s+ghi chú)?(?:\s+về)?\s+(.+)/iu))) {
    timBangGiong(m[1], true);
  } else if ((m = c.match(/^(?:thêm ghi chú|ghi chú|ghi lại|ghi nhớ|lưu lại)(?:\s+là|\s+rằng)?\s*[:,]?\s+(?!(?:nào|gì|về)(?:\s|$))(.+)/iu))) {
    ghiBangGiong(m[1]);
  } else {
    $('#oHoi').value = c;                  // câu hỏi: hỏi Mây như tab Hỏi — trả lời xong Mây đọc câu đầu
    moTab('hoi');
    if (!traLoiTaiCho(c)) noi('Để em xem trong kho…', 'Let me check your notes.');   // hỏi giờ / ngày: trả lời ngay
    $('#nutHoi').click();
  }
}
const nutNoiMay = $('#noiMay');
if (NhanGiong) nutNoiMay.hidden = false;
nutNoiMay.addEventListener('click', () => nghe(nutNoiMay, {
  khiNghe: (chu) => baoNhanh(`Anh: ${chu}`, 4000),
  khiXong: (chu) => { if (chu) lenhGiong(chu); },
}));

function datMat(bat) {
  matDich = bat ? 1 : 0;
  hoverLoi = false;          // lõi sắp dời chỗ — bỏ trạng thái rê chuột cũ (không thì tên 8 quẻ còn hiện lúc chuyển cảnh)
  document.body.classList.toggle('mat-ai', !!bat);
  if (bat) {
    const n = DATA.tong_ghi_chu ?? DATA.notes.length;
    const v = (DATA.cay || []).filter((c) => c.duong_dan).length;
    setTimeout(() => (n ? noi(`Xin chào anh. Kho đang có ${n} ghi chú trong ${v} vùng kiến thức.`,
      `Hello. Your Second Brain holds ${n} ${n === 1 ? 'note' : 'notes'} in ${v} knowledge ${v === 1 ? 'area' : 'areas'}.`)
      : noi('Xin chào anh. Kho đang trống — mình bắt đầu ghi chú đầu tiên nhé?',
        'Hello. Your Second Brain is empty. Shall we write the first note?')), itMotion ? 0 : 2300);
  } else {
    loiNoi = null;
    if (coDocNoi) speechSynthesis.cancel();
  }
}
// Máy chỉ có giọng tiếng Việt qua mạng: bấm loa lần đầu, hoặc BẬT LẠI sau khi tắt (tắt tiếng là bỏ quyền), thì hỏi có dùng
// không. Trước đây bật lại thì im lặng dùng giọng tiếng Anh, phải bấm thêm lần nữa mới được hỏi (Hướng dẫn ghi "bật lại sẽ hỏi lại").
$('#batTieng').addEventListener('click', () => {
  const canHoi = giongMang && !giongViet && !choMang && !daHoiMang;
  if (!coTieng) { datTieng(true); if (canHoi) hoiGiongMang(); return; }
  if (canHoi) hoiGiongMang(); else datTieng(false);
});
datTieng(coTieng);
document.addEventListener('keydown', (e) => {
  const a = document.activeElement;
  if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey && xem === 'do') datMat(!matDich);
  else if (e.key === 'Escape' && matDich && !tapTrung && $('#chiTiet').hidden) datMat(false);
});

// quầng sáng quanh chấm (nơ-ron): vẽ sẵn mỗi màu một lần — tạo gradient cho từng chấm mỗi khung hình thì nặng
const quangMau = new Map();
function quangCham(mau) {
  let c = quangMau.get(mau);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, rgba(mau, 0.9)); r.addColorStop(0.25, rgba(mau, 0.35)); r.addColorStop(1, rgba(mau, 0));
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    quangMau.set(mau, c);
  }
  return c;
}

function veNao(t, a) {                   // bộ não trong ảnh "thở" sáng nhẹ; Mây nói thì sáng hơn
  const noi = loiNoi && giay() - loiNoi.t0 < loiNoi.dai ? 1 : 0, tho = itMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.3);
  const G = chieuDiem(NAO.GIUA[0], NAO.GIUA[1] + 0.03, 0, 1), r = 0.72 * MAT.u;
  const g = cx.createRadialGradient(G.x, G.y, 0, G.x, G.y, r);
  g.addColorStop(0, `rgba(120,210,255,${(a * (0.08 + 0.07 * tho + 0.14 * noi)).toFixed(3)})`);
  g.addColorStop(1, 'rgba(120,210,255,0)');
  const p = new Path2D();
  NAO.bao.forEach(([x, y], i) => { const q = chieuDiem(x, y, 0, 1); if (i) p.lineTo(q.x, q.y); else p.moveTo(q.x, q.y); });
  p.closePath();
  cx.fillStyle = g;
  cx.fill(p);
}
/* Liên kết giữa hai ghi chú ở mặt A.I: cung khớp thần kinh cong ra ngoài, pha màu hai vùng, có xung sáng nhỏ chạy qua lại.
   Vẽ sau bộ não (trước đây là vạch thẳng xám, nằm dưới não nên khuất). */
function veKhop(t, a, diem) {
  if (!DATA.links.length) return;
  const theoId = new Map(nodes.map((nd) => [nd.note.id, nd]));
  cx.lineWidth = 1.1;
  DATA.links.forEach(([i, j], k) => {
    const A = theoId.get(i), B = theoId.get(j), p = diem.get(i), q = diem.get(j);
    if (!A || !B || !p || !q) return;
    const toi = (mo(A) && mo(B)) || (hoverVung && A.nhom !== hoverVung && B.nhom !== hoverVung), dx = q.x - p.x, dy = q.y - p.y, c = { x: (p.x + q.x) / 2 - dy * 0.22, y: (p.y + q.y) / 2 + dx * 0.22 };
    const g = cx.createLinearGradient(p.x, p.y, q.x, q.y);
    g.addColorStop(0, rgba(A.mau, a * (toi ? 0.08 : 0.6))); g.addColorStop(1, rgba(B.mau, a * (toi ? 0.08 : 0.6)));
    cx.strokeStyle = g;
    cx.beginPath(); cx.moveTo(p.x, p.y); cx.quadraticCurveTo(c.x, c.y, q.x, q.y); cx.stroke();
    if (itMotion || toi) return;
    const s0 = (t * 0.3 + k * 0.173) % 2, s = s0 < 1 ? s0 : 2 - s0, m = 1 - s;
    const x = m * m * p.x + 2 * m * s * c.x + s * s * q.x, y = m * m * p.y + 2 * m * s * c.y + s * s * q.y;
    cx.fillStyle = `rgba(255,255,255,${(0.8 * a).toFixed(3)})`;
    cx.beginPath(); cx.arc(x, y, 1.4, 0, Math.PI * 2); cx.fill();
  });
}

/* Các vùng: vòng tròn quanh đầu (trái → phải theo thứ tự vòng quỹ đạo), nối mạng tới từng nơ-ron của vùng trong não;
   một xung sáng chạy từ vòng vào não. Bấm vòng: Mây đọc tên vùng và số ghi chú, các đường nối của vùng sáng lên. */
let hoverVung = null, nhayVung = null;
function veVung(a, t, diem) {
  MH.vungXY = [];
  // vòng vùng + đường nối vào não: để yên ~6 giây thì mờ đi (cùng lúc dải tên vùng, các nút); rê chuột / chạm là hiện lại
  const yen = document.body.classList.contains('lang-yen') ? 0 : 1;
  MH.hienVung = itMotion ? yen : (MH.hienVung ?? 1) + (yen - (MH.hienVung ?? 1)) * 0.06;
  a *= MH.hienVung;
  const n = dsVung.length;
  if (!n || a <= 0.01) return;
  const u = MAT.u, rong = W - lechDich, hep = rong < 600;
  const rv = keo(u * 0.15, 13, 24);
  const rx = hep ? rong / 2 - rv - 8 : Math.min(2.2 * u, rong / 2 - 62), ry = 1.72 * u, tamY = MAT.oy - 0.25 * u;
  const cung = n <= 6 ? Math.PI : Math.min(Math.PI * 1.45, Math.PI + (n - 6) * 0.38);
  const nhay = nhayVung && giay() - nhayVung.t0 < 2.5 ? nhayVung.ten : null;
  dsVung.forEach((ten, r) => {
    const goc0 = -Math.PI / 2 + ((r + 0.5) / n - 0.5) * cung;
    MH.vungXY.push({ ten, x: CX + rx * Math.cos(goc0), y: tamY + ry * Math.sin(goc0), r: rv });
  });
  cx.globalCompositeOperation = 'lighter';
  // Nối dữ liệu như dây thần kinh thật (gom bó, đỡ rối): mỗi vùng MỘT trục từ vòng tới cửa vào trên rìa não — điểm viền theo
  // hướng tâm vỏ não → vòng — rồi từ cửa vào toả nhánh cong tới từng nơ-ron của vùng. Xung dữ liệu chạy dọc trục rồi rẽ vào
  // một nhánh. (Trước đây mỗi ghi chú một đường thẳng từ vòng xuyên qua đầu: vùng nhiều ghi chú thành chùm tia rối.)
  const G0 = chieuDiem(NAO.GIUA[0], NAO.GIUA[1], NAO.Z, 1);
  const bien = NAO.bao.filter((_, i) => i % 3 === 0).map(([x, y]) => chieuDiem(x, y, NAO.Z, 1));
  MH.vungXY.forEach((v) => {
    const mau = mauCua(v.ten), sang = v.ten === nhay || v.ten === hoverVung;
    const toi = (noiBat && noiBat !== v.ten) || (hoverVung && hoverVung !== v.ten);
    const ds = nodes.filter((nd) => nd.nhom === v.ten).map((nd) => diem.get(nd.note.id)).filter(Boolean);
    if (!ds.length) return;
    const g = Math.atan2(v.y - G0.y, v.x - G0.x);
    let E = bien[0], gan = 9;
    bien.forEach((p) => { const d = Math.abs(((Math.atan2(p.y - G0.y, p.x - G0.x) - g) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (d < gan) { gan = d; E = p; } });
    const dai = Math.hypot(E.x - v.x, E.y - v.y) || 1, ux = (E.x - v.x) / dai, uy = (E.y - v.y) / dai;
    const S = { x: v.x + ux * (v.r + 5), y: v.y + uy * (v.r + 5) };
    const k = toi ? 0.12 : sang ? 1.6 : 1;
    // trục: quầng + lõi
    cx.beginPath(); cx.moveTo(S.x, S.y); cx.lineTo(E.x, E.y);
    cx.strokeStyle = rgba(mau, a * 0.1 * k); cx.lineWidth = 4; cx.stroke();
    cx.strokeStyle = rgba(mau, a * 0.42 * k); cx.lineWidth = 1.3; cx.stroke();
    // nhánh: cong nhẹ, lệch luân phiên hai bên
    const nhanh = ds.map((p, i) => {
      const dx = p.x - E.x, dy = p.y - E.y, c = (i % 2 ? 0.14 : -0.14);
      return { p, c: { x: E.x + dx * 0.45 - dy * c, y: E.y + dy * 0.45 + dx * c } };
    });
    cx.beginPath();
    nhanh.forEach(({ p, c }) => { cx.moveTo(E.x, E.y); cx.quadraticCurveTo(c.x, c.y, p.x, p.y); });
    cx.strokeStyle = rgba(mau, a * 0.2 * k); cx.lineWidth = 1; cx.stroke();
    // cửa vào: chấm sáng nhỏ
    cx.fillStyle = rgba(mau, a * 0.8 * Math.min(1, k));
    cx.beginPath(); cx.arc(E.x, E.y, 2.2, 0, Math.PI * 2); cx.fill();
    if (itMotion || toi) return;
    const pha = (t * 0.4 + bam(v.ten, 7)) % 1, lan = Math.floor(t * 0.4 + bam(v.ten, 7));
    let x, y;
    if (pha < 0.45) { const s = pha / 0.45; x = S.x + (E.x - S.x) * s; y = S.y + (E.y - S.y) * s; }
    else {
      const { p, c } = nhanh[lan % nhanh.length], s = (pha - 0.45) / 0.55, m = 1 - s;
      x = m * m * E.x + 2 * m * s * c.x + s * s * p.x; y = m * m * E.y + 2 * m * s * c.y + s * s * p.y;
    }
    const q = cx.createRadialGradient(x, y, 0, x, y, 5);
    q.addColorStop(0, `rgba(255,255,255,${(0.95 * a).toFixed(3)})`); q.addColorStop(0.4, rgba(mau, 0.7 * a)); q.addColorStop(1, rgba(mau, 0));
    cx.fillStyle = q;
    cx.beginPath(); cx.arc(x, y, 5, 0, Math.PI * 2); cx.fill();
  });
  cx.beginPath();                        // chòm sao nối các vòng kề nhau
  MH.vungXY.forEach((v, i) => { if (i) cx.lineTo(v.x, v.y); else cx.moveTo(v.x, v.y); });
  cx.strokeStyle = `rgba(120,190,255,${(0.12 * a).toFixed(3)})`;
  cx.stroke();
  cx.globalCompositeOperation = 'source-over';
  const coChu = hep ? 10 : 11.5, toiDa = hep ? 74 : 104;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.lineJoin = 'round';
  // vòng nằm phía trên đầu: tên ghi phía trên vòng (ghi dưới thì đè ba vòng hào quang nét đứt) — nhưng chỉ khi MỌI vòng phía
  // trên còn chỗ dưới thanh nút; không thì tất cả ghi dưới (điện thoại), cho đều nhau
  const laTren = (v) => v.y < MAT.oy - 1.45 * MAT.u;
  const lenTren = MH.vungXY.filter(laTren).every((v) => v.y - v.r - 8 - coChu * 1.4 > (tapTrung ? 6 : MEP_TREN + 4));
  MH.vungXY.forEach((v) => {
    const mau = mauCua(v.ten), sang = v.ten === nhay || v.ten === hoverVung;
    const aa = a * (noiBat && noiBat !== v.ten ? 0.35 : 1);
    const q = cx.createRadialGradient(v.x, v.y, v.r * 0.7, v.x, v.y, v.r * 2);
    q.addColorStop(0, rgba(mau, (sang ? 0.5 : 0.28) * aa));
    q.addColorStop(1, rgba(mau, 0));
    cx.fillStyle = q;
    cx.beginPath(); cx.arc(v.x, v.y, v.r * 2, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = `rgba(8,20,44,${(0.88 * aa).toFixed(3)})`;
    cx.beginPath(); cx.arc(v.x, v.y, v.r, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = rgba(mau, 0.95 * aa);
    cx.lineWidth = sang ? 2.4 : 1.6;
    cx.stroke();
    cx.setLineDash([2, 5]);
    cx.lineDashOffset = itMotion ? 0 : -t * 10;
    cx.beginPath(); cx.arc(v.x, v.y, v.r + 5, 0, Math.PI * 2);
    cx.strokeStyle = rgba(mau, 0.45 * aa);
    cx.lineWidth = 1;
    cx.stroke();
    cx.setLineDash([]);
    cx.globalAlpha = aa;
    cx.font = `700 ${Math.round(v.r * 0.62)}px "Be Vietnam Pro",sans-serif`;
    cx.fillStyle = TRUNG;
    cx.fillText(String(vungSo[v.ten] ?? nodes.filter((nd) => nd.nhom === v.ten).length), v.x, v.y + 0.5);
    cx.font = `500 ${coChu}px "Be Vietnam Pro",sans-serif`;
    let ten = v.ten;
    while (ten.length > 3 && cx.measureText(ten).width > toiDa) ten = ten.slice(0, -2).trimEnd() + '…';
    const tren = lenTren && laTren(v);
    const tx = keo(v.x, toiDa / 2 + 4, W - lechDich - toiDa / 2 - 4), ty = tren ? v.y - v.r - 8 - coChu * 0.4 : v.y + v.r + 8 + coChu * 0.6;
    cx.lineWidth = 3.5;
    cx.strokeStyle = 'rgba(6,14,30,.85)';
    cx.strokeText(ten, tx, ty);
    cx.fillStyle = 'rgba(225,236,252,.88)';
    cx.fillText(ten, tx, ty);
    cx.globalAlpha = 1;
  });
}
function timVung(x, y) {
  if (!matDich || kMat < 0.9 || !MH || MH.hienVung < 0.5) return null;
  const v = MH.vungXY.find((o) => Math.hypot(o.x - x, o.y - y) < o.r + 5);
  return v ? v.ten : null;
}

/* Vòng Tiên Thiên Bát Quái lúc chuyển cảnh: 8 quẻ đúng phương vị (Càn trên, Khôn dưới, Ly trái, Khảm phải), hào sơ sát tâm;
   hào dương (liền) vàng kim, hào âm (đứt) xanh lam. Quẻ sáng dần theo chiều khí Tiên Thiên — Chấn → Ly → Đoài → Càn (dương
   trưởng), Tốn → Khảm → Cấn → Khôn (âm trưởng), theo kim đồng hồ — có đốm khí chạy trước. quet: số độ đã quét từ Chấn. */
function veTienThien(tx, ty, R, a, quet) {
  const u = MAT.u, hl = 0.13 * u, gap = 0.075 * u, day = Math.max(2.4, 0.034 * u);
  cx.setLineDash([2, 7]);
  cx.beginPath(); cx.arc(tx, ty, R, 0, Math.PI * 2);
  cx.strokeStyle = `rgba(150,190,255,${(0.22 * a).toFixed(3)})`;
  cx.lineWidth = 1;
  cx.stroke();
  cx.setLineDash([]);
  cx.font = `500 ${Math.round(keo(u * 0.085, 10, 13))}px "Be Vietnam Pro",sans-serif`;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  for (const [ten, hao, gocDo] of BAT_QUAI) {
    const tuChan = ((gocDo - 135) % 360 + 360) % 360;    // quẻ này cách Chấn bao nhiêu độ theo chiều khí
    const hien = a * em(tuChan - 10, tuChan + 25, quet);
    if (hien < 0.01) continue;
    const g = gocDo * Math.PI / 180, nx = Math.cos(g), ny = Math.sin(g), qx = -ny, qy = nx;
    const px = tx + nx * R, py = ty + ny * R;
    hao.forEach((duong, i) => {
      const d = (i - 1) * gap, ox = px + nx * d, oy = py + ny * d;
      const mau = duong ? '242,206,107' : '90,150,255';
      const doan = duong ? [[-hl, hl]] : [[-hl, -0.22 * hl], [0.22 * hl, hl]];
      for (const [w, al] of [[day * 2.6, 0.18], [day, 0.95]]) {
        cx.beginPath();
        for (const [s0, s1] of doan) { cx.moveTo(ox + qx * s0, oy + qy * s0); cx.lineTo(ox + qx * s1, oy + qy * s1); }
        cx.strokeStyle = `rgba(${mau},${(al * hien).toFixed(3)})`;
        cx.lineWidth = w;
        cx.stroke();
      }
    });
    cx.fillStyle = `rgba(225,236,252,${(0.75 * hien).toFixed(3)})`;
    cx.fillText(ten, tx + nx * (R + 0.27 * u), ty + ny * (R + 0.27 * u));
  }
  if (quet > 0 && quet < 360) {                          // đốm khí: vàng ở nửa dương trưởng, lam ở nửa âm trưởng
    const g = (135 + quet) * Math.PI / 180, { mau } = khiTai(g);
    const x = tx + Math.cos(g) * R, y = ty + Math.sin(g) * R;
    const q = cx.createRadialGradient(x, y, 0, x, y, 0.16 * u);
    q.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
    q.addColorStop(0.3, `rgba(${mau},${(0.8 * a).toFixed(3)})`);
    q.addColorStop(1, `rgba(${mau},0)`);
    cx.fillStyle = q;
    cx.beginPath(); cx.arc(x, y, 0.16 * u, 0, Math.PI * 2); cx.fill();
  }
}

// ảnh đầu mẫu: đặt theo toạ độ đầu; đang hiện dần thì cắt từ đỉnh xuống tới mép quét, mép quét có vệt sáng
function veAnhDau(anh) {
  const A = ANH_DAU, u = MAT.u, O = chieuDiem(A.X, A.Y, 0, 1), w = A.R * u, h = A.C * u, yq = O.y + h * anh;
  cx.save();
  cx.globalCompositeOperation = 'source-over';
  if (anh < 1) { cx.beginPath(); cx.rect(O.x - 2, O.y - 2, w + 4, yq - O.y + 2); cx.clip(); }
  cx.globalAlpha = em(0, 0.3, anh);
  cx.drawImage(anhDauDungCo(w, h), O.x, O.y, w, h);
  cx.restore();
  if (anh > 0 && anh < 1) {
    const g = cx.createLinearGradient(O.x, 0, O.x + w, 0), al = Math.sin(Math.PI * anh);
    g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.5, `rgba(200,240,255,${(0.8 * al).toFixed(3)})`);
    g.addColorStop(1, 'rgba(120,220,255,0)');
    cx.fillStyle = g;
    cx.fillRect(O.x, yq - 1.5, w, 3);
  }
}
// ảnh thu về đúng cỡ đang hiện, vẽ sẵn một lần (thu nhỏ chất lượng cao) — mỗi khung chỉ dán 1:1. Thu phóng ảnh 1145×1374 mỗi
// khung hình thì màn 2x còn ~24 khung/giây
function anhDauDungCo(w, h) {
  const A = ANH_DAU, cw = Math.round(w * DV), ch = Math.round(h * DV);
  if (!A.dem || A.dem.width !== cw || A.dem.height !== ch) {
    const c = A.dem || document.createElement('canvas'), g = c.getContext('2d');
    c.width = cw; c.height = ch;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(A.img, 0, 0, cw, ch);
    A.dem = c;
  }
  return A.dem;
}
// Mắt ảnh mẫu "có hồn": vòng sáng mảnh quanh mống mắt thở theo nhịp (nói thì sáng hơn), đốm sáng long lanh phía trên-trái
// mống mắt dịch nhẹ theo con trỏ như mắt nhìn theo, lấp lánh khẽ; thỉnh thoảng một vệt sáng lướt qua mống mắt
function veMatAnh(a, mieng, t) {
  const u = MAT.u, r = ANH_DAU.MONG * u, noi = mieng > 0 ? 1 : 0, tho = itMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.1);
  const huong = chuot && !itMotion ? { x: keo((chuot.x - CX) / (W * 0.5), -1, 1), y: keo((chuot.y - MAT.oy) / (H * 0.5), -1, 1) } : { x: 0, y: 0 };
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  ANH_DAU.MAT.forEach(([mx, my], i) => {
    const p = chieuDiem(mx, my, 0, 1), dx = Math.sign(mx);
    cx.save();
    cx.beginPath();
    ANH_DAU.KHE_MAT.forEach(([x, y], j) => { const q = chieuDiem(-dx * x, y, 0, 1); j ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y); });
    cx.closePath(); cx.clip();
    // ánh trong mống mắt: lặng thì thở nhẹ, Mây nói thì sáng hẳn lên
    const ga = a * (noi ? 0.3 : 0.06 + 0.06 * tho);
    const gm = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    gm.addColorStop(0, `rgba(140,225,255,${ga.toFixed(3)})`); gm.addColorStop(1, 'rgba(140,225,255,0)');
    cx.fillStyle = gm; cx.beginPath(); cx.arc(p.x, p.y, r, 0, Math.PI * 2); cx.fill();
    // vòng mống mắt
    cx.beginPath(); cx.arc(p.x, p.y, r, 0, Math.PI * 2);
    cx.strokeStyle = `rgba(110,215,255,${(a * (0.16 + 0.14 * tho + 0.25 * noi)).toFixed(3)})`;
    cx.lineWidth = Math.max(1, 0.012 * u);
    cx.stroke();
    // đốm long lanh
    const lx = p.x - 0.32 * r + huong.x * 0.12 * r, ly = p.y - 0.34 * r + huong.y * 0.1 * r, lr = Math.max(1.2, 0.2 * r);
    const lap = itMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 2.3 + i);
    const g = cx.createRadialGradient(lx, ly, 0, lx, ly, lr * 2.2);
    g.addColorStop(0, `rgba(255,255,255,${(0.95 * a * lap).toFixed(3)})`); g.addColorStop(0.45, `rgba(220,245,255,${(0.5 * a * lap).toFixed(3)})`);
    g.addColorStop(1, 'rgba(200,240,255,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(lx, ly, lr * 2.2, 0, Math.PI * 2); cx.fill();
    // vệt sáng lướt qua mống mắt, ~7 giây một lần
    if (!itMotion) {
      const pha = (t / 7 + i * 0.04) % 1;
      if (pha < 0.08) {
        const k = pha / 0.08, x0 = p.x - r + 2 * r * k;
        cx.save(); cx.beginPath(); cx.arc(p.x, p.y, r, 0, Math.PI * 2); cx.clip();
        const gl = cx.createLinearGradient(x0 - r * 0.3, 0, x0 + r * 0.3, 0);
        gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, `rgba(255,255,255,${(0.35 * a * Math.sin(Math.PI * k)).toFixed(3)})`);
        gl.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = gl; cx.fillRect(x0 - r * 0.3, p.y - r, r * 0.6, 2 * r);
        cx.restore();
      }
    }
    cx.restore();
  });
  cx.restore();
}
// khe miệng trong ảnh: luôn sáng nhẹ (như anh muốn "1 vạch sáng hơn"), Mây nói thì sáng rực theo nhịp miệng
function veKheAnh(a, mieng) {
  if (a <= 0.01) return;
  const ds = KHE_ANH.map(([x, y]) => chieuDiem(x, y, 0, 1)), u = MAT.u, m = keo(mieng / 0.12, 0, 1);
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  cx.beginPath();
  ds.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
  cx.strokeStyle = `rgba(110,200,255,${(a * (0.12 + 0.35 * m)).toFixed(3)})`;
  cx.lineWidth = Math.max(2.5, 0.035 * u);
  cx.stroke();
  cx.strokeStyle = `rgba(200,242,255,${(a * (0.55 + 0.45 * m)).toFixed(3)})`;
  cx.lineWidth = Math.max(1, 0.01 * u);
  cx.stroke();
  cx.restore();
}

// nhép miệng: môi dưới và cằm hạ xuống bao nhiêu tại (x, y) của đầu — dùng chung cho đường vân và viền đầu
const haCam = (x, y, mieng) => (mieng > 0 && y > 0.725 && x > -0.8 && x < 0.8
  ? mieng * 0.9 * em(0.725, 0.79, y) * (1 - em(0.3, 0.8, Math.abs(x))) : 0);
function veMat(tg, diem) {
  if (!MH) MH = dungMoHinh();
  const u = MAT.u, k = kMat, t = itMotion ? 0 : giay(), xong = k >= 1;
  const phu = em(0.62, 1, k);            // kính, não, mắt, vòng HUD, các vùng: hiện khi đầu đã gần thành hình
  // ảnh đầu mẫu hiện dần (quét từ đỉnh xuống) khi các đường vân đã gần thành hình; hiện đủ thì thôi vẽ đường vân
  const anh = ANH_DAU.ok ? em(0.66, 0.97, k) : 0, chiAnh = anh >= 1;
  // Hai luồng Âm Dương từ lõi Bát Quái: Dương vàng kim, Âm xanh lam — hai cánh xoắn ốc như Thái Cực, vừa xoáy vừa nhấp nhô
  // ngược pha nên cắt đan qua nhau; mỗi luồng là một bó sợi mảnh. Rồi các sợi gỡ thành đường vân của đầu, đầu luồng bay vào
  // làm hai mắt. Thoát thì chạy ngược lại.
  const no = em(0.03, 0.35, k), vao = em(0.55, 0.93, k), R = 1.3 * u * no;
  const tx0 = CX, ty0 = CY + (MAT.oy - 0.05 * u - CY) * em(0.08, 0.5, k);
  const xoay = (itMotion ? 0 : t * 1.6) + Math.PI * 2 * em(0.04, 0.6, k);
  const matXY = ANH_DAU.ok ? ANH_DAU.MAT.map(([x, y]) => [x, y, 0]) : MH.mat;   // đầu luồng bay vào hai mắt
  const mT = chieuDiem(...matXY[0], 1), mP = chieuDiem(...matXY[1], 1);
  const luong = (j, s, lech) => {          // điểm s (0 tâm → 1 đầu luồng) của luồng j (0 Dương, 1 Âm), lệch khỏi trục luồng
    const g = xoay + j * Math.PI + Math.PI * 2 * 1.15 * s;
    const r = R * (0.1 + 0.9 * s) * (1 + 0.14 * Math.sin(6 * Math.PI * s + t * 3 + j * Math.PI)) + lech * u;
    let x = tx0 + Math.cos(g) * r, y = ty0 + Math.sin(g) * r * 0.92;
    if (vao > 0) { const m = j ? mP : mT, w = vao * (0.35 + 0.65 * s); x += (m.x - x) * w; y += (m.y - y) * w; }
    return [x, y];
  };
  const viTriSoi = (c, s) => luong(c.j, s, c.lech * Math.sin(c.f1 * 6.283 * s + c.w1 * t + c.p1));
  cx.save();
  cx.lineJoin = 'round';
  cx.lineCap = 'round';
  const vien = new Path2D();
  // viền đầu hạ cằm theo miệng như các đường vân — trước đây viền đứng yên: Mây nói, cằm hạ xuống đè lên vân cổ mà vân cổ không
  // bị che, hai lớp chồng nhau thành dải sáng dưới cằm (anh chụp lúc Mây đang nói)
  { const v = MH.vien, b = MH.vienB;
    for (let i = 0; i < v.length / 3; i++) {
      chieuVao(b, i * 2, v[i * 3], v[i * 3 + 1] + haCam(v[i * 3], v[i * 3 + 1], MAT.mieng), v[i * 3 + 2], 1);
      if (i) vien.lineTo(b[i * 2], b[i * 2 + 1]); else vien.moveTo(b[0], b[1]);
    }
    vien.closePath(); }
  const ngoaiDau = new Path2D();         // cả khung trừ phần trong viền đầu (tô evenodd) — để che vân cổ nằm sau mặt
  ngoaiDau.rect(-W, -H, 3 * W, 3 * H);
  ngoaiDau.addPath(vien);
  const tam = chieuDiem(0, -0.1, 0, 1);
  if (phu > 0) {
    // quầng xanh sau đầu, kính trong suốt, não bên trong
    const q = cx.createRadialGradient(tam.x, tam.y, u * 0.3, tam.x, tam.y, u * 2.1);
    q.addColorStop(0, `rgba(40,120,255,${(0.2 * phu).toFixed(3)})`);
    q.addColorStop(1, 'rgba(40,120,255,0)');
    cx.fillStyle = q;
    cx.fillRect(tam.x - u * 2.2, tam.y - u * 2.2, u * 4.4, u * 4.4);
    const g = cx.createRadialGradient(tam.x, tam.y - u * 0.2, u * 0.1, tam.x, tam.y, u * 1.3);
    g.addColorStop(0, `rgba(90,180,255,${(0.13 * phu).toFixed(3)})`);
    g.addColorStop(1, `rgba(30,90,200,${(0.05 * phu).toFixed(3)})`);
    if (anh < 1) {
      cx.globalAlpha = 1 - anh;
      cx.fillStyle = g;
      cx.fill(vien);
      cx.globalAlpha = 1;
    }
    cx.globalCompositeOperation = 'lighter';
    // vòng HUD — ba vòng nét đứt: xanh lam, vàng kim (màu luồng Dương), cam (màu lõi); xoay xen kẽ chiều, nhanh chậm khác nhau.
    // Vòng khép kín quanh đầu như vầng hào quang: phần đi qua sau cổ, vai bị thân che (trước đây chỉ là cung hở, dừng ngang
    // hàm — anh hỏi "ba vòng tròn nên nối phía sau"). Nửa trên vẽ thẳng; chỉ cung dưới (đi sau cổ) mới cắt theo bóng thân —
    // cắt cả vòng theo viền đầu + thân mỗi khung hình thì chậm thấy rõ. Vòng to hơn đầu nên không cần cắt theo đầu.
    const than = new Path2D(), MEP = 16;
    for (let i = 0; i <= 2 * MEP + 1; i++) {   // mép cổ – vai – cánh tay hai bên, chiếu như vân thân
      const b = i <= MEP ? -1 : 1, y = 0.7 + 2.27 * ((i <= MEP ? i : 2 * MEP + 1 - i) / MEP) ** 1.3;
      chieuVao(NHAP, 0, b * noiSuy(RONG_THAN, y), y, 0, 0.85 * (1 - em(1.05, 1.5, y)));
      if (i) than.lineTo(NHAP[0], NHAP[1]); else than.moveTo(NHAP[0], NHAP[1]);
    }
    than.closePath();
    const ngoaiThan = new Path2D();
    ngoaiThan.rect(-W, -H, 3 * W, 3 * H);
    ngoaiThan.addPath(than);
    // bán kính vừa ôm đầu, chừa khoảng thở cho tên các vòng vùng phía trên (trước 1,38–1,62: tên vòng trên cùng chạm vòng ngoài)
    const VONG = [[1.3, '95,180,255', 1, 24, 0.45], [1.41, '230,196,106', -1, 18, 0.6], [1.52, '240,127,45', 1, 13, 0.58]];
    const D0 = Math.PI * 0.15;               // cung dưới: từ ~4 giờ tới ~8 giờ
    cx.lineWidth = 1.5;
    cx.setLineDash([4, 8]);
    if (!ANH_DAU.ok) for (const duoi of [false, true]) {   // ảnh mẫu đã có vầng hào quang sau đầu
      if (duoi) { cx.save(); cx.clip(ngoaiThan, 'evenodd'); }
      VONG.forEach(([r, mau, chieu, toc, dam]) => {
        // cung dưới nối tiếp đúng nhịp nét đứt của cung trên (lùi độ lệch đúng bằng chiều dài cung trên) — khỏi giật ở chỗ nối
        cx.lineDashOffset = (itMotion ? 0 : chieu * tg * toc) - (duoi ? r * u * (Math.PI + 2 * D0) : 0);
        cx.beginPath();
        if (duoi) cx.arc(tam.x, tam.y, r * u, D0, Math.PI - D0);
        else cx.arc(tam.x, tam.y, r * u, Math.PI - D0, Math.PI * 2 + D0);
        cx.strokeStyle = `rgba(${mau},${(dam * phu).toFixed(3)})`;
        cx.stroke();
      });
      if (duoi) cx.restore();
    }
    cx.setLineDash([]);
    if (anh > 0) veAnhDau(anh);          // ảnh đầu che phần vòng đi sau đầu, cổ, vai
    cx.globalCompositeOperation = 'lighter';
    veNao(t, phu);
    veKhop(t, phu, diem);
    veVung(phu, t, diem);
  }
  // vòng Tiên Thiên Bát Quái quanh luồng xoáy, rồi thân hai luồng (dải sáng dọc trục) — chỉ lúc chuyển cảnh
  cx.globalCompositeOperation = 'lighter';
  const soi = em(0.05, 0.25, k), mieng = MAT.mieng;
  const aTT = em(0.12, 0.3, k) * (1 - em(0.6, 0.85, k));
  if (aTT > 0.01) veTienThien(tx0, ty0, 1.75 * u * em(0.05, 0.3, k), aTT, 360 * em(0.14, 0.52, k));
  const aL = soi * (1 - em(0.55, 0.85, k));
  if (aL > 0.01) {
    for (const j of [0, 1]) {
      const mau = j ? '90,150,255' : '242,206,107';
      cx.beginPath();
      for (let i = 0; i <= 90; i++) { const [x, y] = luong(j, i / 90, 0); if (i) cx.lineTo(x, y); else cx.moveTo(x, y); }
      for (const [w, al] of [[16, 0.12], [7, 0.3], [2.2, 0.9]]) {
        cx.strokeStyle = `rgba(${mau},${(al * aL).toFixed(3)})`;
        cx.lineWidth = w;
        cx.stroke();
      }
      const [x, y] = luong(j, 1, 0), q = cx.createRadialGradient(x, y, 0, x, y, 0.12 * u);   // đầu luồng sáng
      q.addColorStop(0, `rgba(255,255,255,${aL.toFixed(3)})`);
      q.addColorStop(0.35, `rgba(${mau},${(0.7 * aL).toFixed(3)})`);
      q.addColorStop(1, `rgba(${mau},0)`);
      cx.fillStyle = q;
      cx.beginPath(); cx.arc(x, y, 0.12 * u, 0, Math.PI * 2); cx.fill();
    }
  }
  // các đường vân: lúc chuyển cảnh còn là sợi trong hai luồng, gỡ dần (lệch nhịp: viền đầu trước, chóp mũi sau) thành đường vân
  const bo = Array.from({ length: 10 }, () => []);   // theo 5 mức sáng: 0–4 vẽ thẳng, 5–9 vân cổ sát dưới hàm (qua lớp che)
  if (!chiAnh) MH.cha.forEach((c, ci) => {
    const ds = MH.theoCha[ci], mo = xong ? 1 : em(c.bd, c.bd + 0.24, k);
    const al = (soi * 0.45 * (1 - mo) + c.sang * mo) * (1 - anh);
    if (!ds.length || al < 0.01) return;
    for (const m of ds) {
      const dd = m.d, b = m.b, n = dd.length / 5;
      for (let i = 0; i < n; i++) {
        const o = i * 5, x = dd[o];
        let y = dd[o + 1];
        if (m.laDau) y += haCam(x, y, mieng);   // nhép miệng: môi dưới và cằm hạ xuống
        if (m.mi) y *= MAT.chop;                // chớp mắt: hai mí khép về giữa mắt (y = 0)
        chieuVao(b, i * 2, x, y, dd[o + 2], dd[o + 4]);
        if (mo < 1) {
          const [sx, sy] = viTriSoi(c, m.s0 + dd[o + 3] * m.span);
          b[i * 2] = sx + (b[i * 2] - sx) * mo;
          b[i * 2 + 1] = sy + (b[i * 2 + 1] - sy) * mo;
        }
      }
      if (xong) bo[Math.min(4, Math.floor(m.sang * 5.5)) + (m.sauMat ? 5 : 0)].push(m);
    }
    if (xong) return;
    // còn đang chuyển cảnh: cả sợi một nét (mọi mảnh của sợi cùng màu, cùng độ gỡ). Còn trong luồng thì vẽ thường (không
    // cộng sáng) — 60 sợi chồng nhau cộng sáng thành trắng xoá, mất màu vàng kim / xanh lam
    cx.globalCompositeOperation = mo < 0.5 ? 'source-over' : 'lighter';
    const [r0, g0, b0] = c.mau;
    const mau = `${Math.round(r0 + (130 - r0) * mo)},${Math.round(g0 + (215 - g0) * mo)},${Math.round(b0 + (255 - b0) * mo)}`;
    for (const che of [false, true]) {
      cx.beginPath();
      let co = false;
      for (const m of ds) {
        if (!!m.sauMat !== che) continue;
        const b = m.b;
        cx.moveTo(b[0], b[1]);
        for (let i = 1; i < b.length / 2; i++) cx.lineTo(b[i * 2], b[i * 2 + 1]);
        co = true;
      }
      if (!co) continue;
      if (che) { cx.save(); cx.clip(ngoaiDau, 'evenodd'); }      // vân cổ sau mặt: che theo viền đầu
      cx.strokeStyle = `rgba(${mau},${(al * 0.22).toFixed(3)})`;
      cx.lineWidth = 3;
      cx.stroke();
      cx.strokeStyle = `rgba(${mau},${al.toFixed(3)})`;
      cx.lineWidth = 1;
      cx.stroke();
      if (che) cx.restore();
    }
  });
  cx.globalCompositeOperation = 'lighter';
  // đã thành hình: gom theo độ sáng, mỗi nhóm vẽ một lần, một nét mảnh (thêm lớp quầng mờ thì máy yếu còn ~26 khung/giây).
  // Vân cổ sau mặt (nhóm 5–9) vẽ lên lớp riêng rồi khoét phần nằm sau mặt, mép khoét mờ dần ra ngoài — trước đây cắt cứng theo
  // viền đầu: các vòng cổ cắt xéo qua đường cằm để lại nhiều mẩu ngắn ôm sát cằm, chồng nhau thành dải sáng dưới cằm (anh chụp).
  const coSau = xong && bo.slice(5).some((ds) => ds.length);
  let gc = null;
  if (coSau) {
    if (!lopCo) lopCo = document.createElement('canvas');
    if (lopCo.width !== cv.width || lopCo.height !== cv.height) { lopCo.width = cv.width; lopCo.height = cv.height; }
    gc = lopCo.getContext('2d');
    gc.setTransform(1, 0, 0, 1, 0, 0);
    gc.clearRect(0, 0, lopCo.width, lopCo.height);
    gc.setTransform(DV, 0, 0, DV, 0, 0);
    gc.globalCompositeOperation = 'source-over';
  }
  bo.forEach((ds, i) => {
    if (!ds.length) return;
    const g = i >= 5 ? gc : cx, al = (i % 5 + 0.5) / 5.5;
    g.beginPath();
    ds.forEach((m) => {
      const b = m.b;
      g.moveTo(b[0], b[1]);
      for (let j = 1; j < b.length / 2; j++) g.lineTo(b[j * 2], b[j * 2 + 1]);
    });
    g.strokeStyle = `rgba(130,215,255,${al.toFixed(3)})`;
    g.lineWidth = 1;                     // đúng 1px: trình duyệt có đường vẽ nhanh riêng cho nét 1px (1,1px chậm gấp đôi)
    g.stroke();
  });
  // vạch giữa miệng: thêm một nét sáng hơn các đường vân (quầng mảnh + lõi sáng) — miệng rõ hơn, vẫn đúng kiểu vân
  if (xong && !chiAnh) {
    cx.beginPath();
    MH.manh.forEach((m) => {
      if (!m.khe) return;
      const b = m.b;
      cx.moveTo(b[0], b[1]);
      for (let j = 1; j < b.length / 2; j++) cx.lineTo(b[j * 2], b[j * 2 + 1]);
    });
    cx.lineCap = 'round';
    cx.strokeStyle = `rgba(120,210,255,${(0.22 * phu).toFixed(3)})`;
    cx.lineWidth = Math.max(2.5, 0.03 * u);
    cx.stroke();
    cx.strokeStyle = `rgba(195,238,255,${(0.88 * phu).toFixed(3)})`;
    cx.lineWidth = Math.max(1.2, 0.011 * u);
    cx.stroke();
  }
  if (coSau) {
    gc.globalCompositeOperation = 'destination-out';
    gc.fill(vien);
    gc.lineJoin = 'round';
    for (const [w, a] of [[0.1, 0.35], [0.06, 0.45], [0.03, 0.6]]) {   // ba nét khoét chồng nhau: mờ dần trong ~0,05 bán kính đầu
      gc.lineWidth = w * u;
      gc.strokeStyle = `rgba(0,0,0,${a})`;
      gc.stroke(vien);
    }
    cx.save();
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.drawImage(lopCo, 0, 0);
    cx.restore();
  }
  // hạt sáng trôi dọc hai luồng
  if (soi > 0 && !xong) {
    cx.fillStyle = '#FFF6DA';
    for (const p of MH.hat) {
      const c = MH.cha[p.cha], a = soi * (1 - em(c.bd, c.bd + 0.24, k));
      if (a < 0.02) continue;
      const [x, y] = viTriSoi(c, ((p.s0 + p.v * t) % 1 + 1) % 1);
      cx.globalAlpha = a;
      cx.beginPath(); cx.arc(x, y, p.r, 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1;
  }
  if (phu > 0) {
    // vệt quét từ đỉnh đầu xuống cằm, ~3,5 giây một lượt (đầu đường vân; đầu ảnh thì không)
    if (!itMotion && !chiAnh) {
      const yq = chieuDiem(0, -1.35 + ((t * 0.28) % 1) * 2.6, 0.9, 1).y;
      const g = cx.createLinearGradient(0, yq - u * 0.1, 0, yq + u * 0.1);
      g.addColorStop(0, 'rgba(120,220,255,0)');
      g.addColorStop(0.5, `rgba(120,220,255,${(0.16 * phu).toFixed(3)})`);
      g.addColorStop(1, 'rgba(120,220,255,0)');
      cx.save();
      cx.clip(vien);
      cx.fillStyle = g;
      cx.fillRect(tam.x - u * 1.4, yq - u * 0.1, u * 2.8, u * 0.2);
      cx.restore();
    }
    if (ANH_DAU.ok) veKheAnh(phu * anh, mieng);
    // miệng: lòng miệng sáng lên khi mở (đầu đường vân)
    if (mieng > 0.005 && !chiAnh) {
      cx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = -0.22 + 0.44 * i / 12, q = chieuDiem(x, 0.725, doSau(x, 0.725), 1);
        if (i) cx.lineTo(q.x, q.y); else cx.moveTo(q.x, q.y);
      }
      for (let i = 12; i >= 0; i--) {
        const x = -0.22 + 0.44 * i / 12, y = 0.725 + mieng * 0.6 * (1 - (x / 0.22) ** 2);
        const q = chieuDiem(x, y, doSau(x, y), 1);
        cx.lineTo(q.x, q.y);
      }
      cx.fillStyle = `rgba(120,200,255,${(keo(mieng * 2, 0, 0.3) * phu).toFixed(3)})`;
      cx.fill();
    }
    // mắt: lõi trắng, quầng xanh, vệt loé ngang; chớp mắt; đang nói thì sáng hơn. Đầu ảnh mẫu: giữ nguyên mống mắt, lông mi
    // của ảnh (quầng trắng phủ lên làm mất hồn — anh: "mắt thiết kế có hồn hơn"), chỉ thêm ánh long lanh (veMatAnh)
    if (chiAnh) { veMatAnh(phu, mieng, t); cx.restore(); return; }
    const sang = phu * (mieng > 0 ? 1 : 0.88);
    [mT, mP].forEach((p) => {
      const r = u * (chiAnh ? 0.15 : 0.2);
      cx.save();
      cx.translate(p.x, p.y);
      cx.scale(1, Math.max(0.1, MAT.chop));
      const g = cx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(255,255,255,${sang.toFixed(3)})`);
      g.addColorStop(0.1, `rgba(200,240,255,${(0.95 * sang).toFixed(3)})`);
      g.addColorStop(0.3, `rgba(90,190,255,${(0.4 * sang).toFixed(3)})`);
      g.addColorStop(1, 'rgba(60,140,255,0)');
      cx.fillStyle = g;
      cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.fill();
      cx.restore();
      const fl = cx.createLinearGradient(p.x - u * 0.5, 0, p.x + u * 0.5, 0);
      fl.addColorStop(0, 'rgba(150,220,255,0)');
      fl.addColorStop(0.5, `rgba(220,245,255,${(0.55 * sang * MAT.chop).toFixed(3)})`);
      fl.addColorStop(1, 'rgba(150,220,255,0)');
      cx.fillStyle = fl;
      cx.fillRect(p.x - u * 0.5, p.y - 0.8, u, 1.6);
    });
  }
  cx.restore();
}

/* Khí âm dương tiêu trưởng chạy quanh vành Bát Quái — Bát Quái đứng yên (Càn luôn ở trên), chỉ khí vận hành.
   Thứ tự Tiên Thiên: Dương sinh ở Chấn (Đông Bắc) → Ly (Đông) → Đoài (Đông Nam) → cực thịnh ở Càn (Nam, trên);
   Âm sinh ở Tốn (Tây Nam) → Khảm (Tây) → Cấn (Tây Bắc) → cực thịnh ở Khôn (Bắc, dưới) → về Chấn.
   Với bố cục Nam ở trên, Đông bên trái, vòng này chạy THEO kim đồng hồ — khớp hướng đầu cá Dương (trên) và đầu cá Âm (dưới).
   Màu: nửa trái (dương trưởng) vàng kim, mạnh dần từ Chấn tới Càn; nửa phải (âm trưởng) xanh, mạnh dần từ Tốn tới Khôn.
   Qua Càn là đổi sang xanh yếu ("Dương cực thì Âm sinh"), qua Khôn đổi sang vàng yếu ("Âm cực thì Dương sinh"). Theo nút tốc độ. */
function khiTai(a) {
  const trai = Math.cos(a) < 0;                         // nửa trái màn hình = phía Đông = dương trưởng
  const manh = (1 + (trai ? -Math.sin(a) : Math.sin(a))) / 2;   // 0 lúc mới sinh → 1 lúc cực thịnh
  return { mau: trai ? '242,206,107' : '90,162,255', manh };
}
function veKhi(RK) {
  const rv = RK + 3.5;
  const dau = Math.PI * 0.75 + goc * 0.9;          // bắt đầu ở Chấn (135°), góc tăng = theo kim đồng hồ trên màn hình
  const doan = 0.09;
  cx.lineCap = 'round';
  for (const [rong, dam] of [[7, 0.22], [2.6, 1]]) {     // lớp ngoài mờ rộng = quầng; lớp trong = lõi luồng khí
    for (let k = 0; k < 9; k++) {
      const a1 = dau - (k + 1) * doan, a2 = dau - k * doan;
      const { mau, manh } = khiTai((a1 + a2) / 2);
      cx.beginPath();
      cx.arc(LX, LY, rv, a1, a2);
      cx.strokeStyle = `rgba(${mau},${(dam * (0.35 + 0.65 * manh) * (1 - k / 9)).toFixed(3)})`;
      cx.lineWidth = rong;
      cx.stroke();
    }
  }
  cx.lineCap = 'butt';
  const { mau, manh } = khiTai(dau);
  cx.beginPath();
  cx.arc(LX + Math.cos(dau) * rv, LY + Math.sin(dau) * rv, 2.4 + 1.2 * manh, 0, Math.PI * 2);
  cx.fillStyle = `rgba(${mau},${(0.6 + 0.4 * manh).toFixed(3)})`;
  cx.fill();
}

/* ---------------- Thái Cực – Tiên Thiên Bát Quái (Phục Hy) ----------------
   Chuẩn Kinh Dịch:
   - Thứ tự Tiên Thiên, quy ước cổ phương Nam ở trên: Càn (Nam) trên, Khôn (Bắc) dưới, Ly (Đông) trái,
     Khảm (Tây) phải, Đoài Đông Nam, Chấn Đông Bắc, Tốn Tây Nam, Cấn Tây Bắc.
   - Hào đọc từ TRONG ra NGOÀI: hào sơ (dưới cùng) nằm sát Thái Cực, hào thượng ở vành ngoài.
   - Hai quẻ đối nhau có hào ngược hoàn toàn; số Tiên Thiên mỗi cặp cộng lại bằng 9.
   - Thái Cực: Dương (vàng kim) sinh ở Chấn, lên bên trái, cực thịnh ở Càn — đầu Dương ở trên;
     Âm (xanh) sinh ở Tốn, xuống bên phải, cực thịnh ở Khôn — đầu Âm ở dưới.
     Trong Dương có Âm (chấm xanh ở đầu Dương), trong Âm có Dương (chấm vàng ở đầu Âm). */
const BAT_QUAI = [
  // [tên, hào sơ→thượng (1 = liền/dương, 0 = đứt/âm), góc trên màn hình (độ, 0 = phải, chiều kim đồng hồ), phương, số Tiên Thiên]
  ['Càn', [1, 1, 1], -90, 'Nam', 1],
  ['Tốn', [0, 1, 1], -45, 'Tây Nam', 5],
  ['Khảm', [0, 1, 0], 0, 'Tây', 6],
  ['Cấn', [0, 0, 1], 45, 'Tây Bắc', 7],
  ['Khôn', [0, 0, 0], 90, 'Bắc', 8],
  ['Chấn', [1, 0, 0], 135, 'Đông Bắc', 4],
  ['Ly', [1, 0, 1], 180, 'Đông', 3],
  ['Đoài', [1, 1, 0], -135, 'Đông Nam', 2],
];
// hai màu chủ đạo vàng kim – xanh lam (đo trên Bát Quái của ảnh mẫu anh chọn: vàng 241,197,88; lam 6,68,149; vành tối)
const MAU_DUONG = '#F1C558', MAU_AM = '#0A47A0', NAVY_LOI = '#0B1E33', NAVY_VANH = '#112638';
let hoverLoi = false;

/* Lõi nhỏ gọn cỡ chữ BRAIN cũ khi nhìn tổng thể; rê chuột vào thì phóng to mượt để xem rõ quẻ. */
// lúc nghỉ: Ø 60px. Mặt A.I: lõi về chỗ Bát Quái giữa ngực của ảnh, đúng cỡ Bát Quái trong ảnh (phủ kín hình tĩnh bên dưới);
// ảnh chưa tải được thì giữa ngực đầu đường vân, ~0,18 bán kính đầu
const banKinhLoi = () => {
  const e = em(0.45, 0.95, kMat), dich = ANH_DAU.ok ? keo(ANH_DAU.BQR * MAT.u + 1, 11, 46) : keo(0.18 * MAT.u, 15, 30);
  return e > 0 ? Math.round((30 + (dich - 30) * e) * 2) / 2 : 30;
};
const banKinhLoiTo = () => Math.max(56, Math.min(92, banKinh() * 0.22)); // lúc rê chuột
let rkHienTai = 30;                                                   // bán kính đang vẽ (đang co/giãn)

function veHinhThaiCuc(g, R) {
  const u = R / 100;                 // mọi kích thước tính theo bán kính, nét giữ tỉ lệ ở mọi cỡ
  const vong = (r, mau, day, dash) => {
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
    g.strokeStyle = mau; g.lineWidth = day; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]);
  };
  // nền và các vành
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fillStyle = NAVY_LOI; g.fill();
  vong(R - 1.1 * u, MAU_DUONG, 2.2 * u);
  const nho = R < 45;              // cỡ nhỏ: bỏ vành chấm li ti, hào dày hơn để vẫn đọc được quẻ
  if (!nho) vong(92 * u, MAU_DUONG, 0.7 * u, [0.9 * u, 2.6 * u]);
  g.beginPath(); g.arc(0, 0, 64 * u, 0, Math.PI * 2); g.fillStyle = NAVY_VANH; g.fill();
  vong(64 * u, MAU_DUONG, 0.9 * u);
  vong(57.5 * u, '#3E8EDE', 0.5 * u);

  // tám quẻ — mỗi hào là một thanh vuông góc với bán kính; hào đứt = hai nửa có khe giữa
  const dai = (nho ? 27 : 25) * u, day = (nho ? 5.6 : 4.4) * u, khe = (nho ? 6.2 : 5.2) * u;
  const banKinhHao = nho ? [69 * u, 77 * u, 85 * u] : [70 * u, 76.8 * u, 83.6 * u];
  const thanh = (x, y, w, h) => {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h * 0.22); else g.rect(x, y, w, h);
    g.fill();
  };
  g.fillStyle = MAU_DUONG;
  BAT_QUAI.forEach(([, hao, goc]) => {
    g.save();
    g.rotate(goc * Math.PI / 180 + Math.PI / 2);     // trục -y của hệ toạ độ mới chỉ thẳng ra ngoài
    hao.forEach((lien, i) => {
      const y = -banKinhHao[i] - day / 2;
      if (lien) thanh(-dai / 2, y, dai, day);
      else { thanh(-dai / 2, y, (dai - khe) / 2, day); thanh(khe / 2, y, (dai - khe) / 2, day); }
    });
    g.restore();
  });

  // Thái Cực
  const r = 53 * u;
  vong(r + 1.6 * u, MAU_DUONG, 1.1 * u);
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = MAU_DUONG; g.fill();   // Dương: cả hình tròn
  g.beginPath();                                   // Âm: nửa phải + đầu Âm phình sang trái ở dưới,
  g.moveTo(0, -r);                                 // đầu Dương lấn sang phải ở trên
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  g.arc(0, r / 2, r / 2, Math.PI / 2, Math.PI * 1.5, false);
  g.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  g.closePath(); g.fillStyle = MAU_AM; g.fill();
  const cham = r * 0.15;
  g.beginPath(); g.arc(0, -r / 2, cham, 0, Math.PI * 2); g.fillStyle = MAU_AM; g.fill();      // trong Dương có Âm
  g.beginPath(); g.arc(0, r / 2, cham, 0, Math.PI * 2); g.fillStyle = MAU_DUONG; g.fill();    // trong Âm có Dương
}

/* Vẽ một lần vào canvas đệm, mỗi khung hình chỉ dán lại — 60 khung/giây không tốn CPU. */
const dem = new Map();
function hinhThaiCuc(R) {
  const k = `${R.toFixed(1)}|${DV}`;
  if (dem.has(k)) return dem.get(k);
  if (dem.size > 6) dem.clear();
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil((R * 2 + 4) * DV);
  const g = c.getContext('2d');
  g.setTransform(DV, 0, 0, DV, c.width / 2, c.height / 2);
  veHinhThaiCuc(g, R);
  dem.set(k, c);
  return c;
}

/* Rê chuột vào lõi: hiện tên tám quẻ và phương vị quanh vành. oTenQue tính chỗ từng ô chữ (để nhãn ghi chú tránh),
   veTenQue vẽ. Ô cuối là dòng "Thái Cực · Tiên Thiên Bát Quái" dưới lõi. */
const CHU_QUE = '600 11.5px "Be Vietnam Pro",sans-serif', CHU_THAI_CUC = '500 11px "Be Vietnam Pro",sans-serif';
function oTenQue(R) {
  cx.font = CHU_QUE;
  const ra = BAT_QUAI.map(([ten, , goc, huong]) => {
    const a = goc * Math.PI / 180, rr = R + 15;
    const x = LX + Math.cos(a) * rr, y = LY + Math.sin(a) * rr;
    const canh = Math.abs(Math.cos(a)) < 0.3 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right';
    const t = `${ten} · ${huong}`, w = cx.measureText(t).width;
    const x0 = canh === 'center' ? x - w / 2 : canh === 'left' ? x : x - w;
    return { t, x, y, canh, x0: x0 - 5, x1: x0 + w + 5, y0: y - 9, y1: y + 9 };
  });
  cx.font = CHU_THAI_CUC;
  const t = 'Thái Cực · Tiên Thiên Bát Quái', w = cx.measureText(t).width, y = LY + R + 42;
  ra.push({ t, x: LX, y, canh: 'center', x0: LX - w / 2 - 4, x1: LX + w / 2 + 4, y0: y - 8, y1: y + 8, phu: true });
  return ra;
}
function veTenQue(ds) {
  cx.textBaseline = 'middle';
  ds.forEach((o) => {
    cx.textAlign = o.canh;
    if (o.phu) {
      cx.font = CHU_THAI_CUC;
      cx.fillStyle = 'rgba(238,243,250,.75)';
    } else {
      cx.font = CHU_QUE;
      cx.fillStyle = 'rgba(10,20,36,.78)';
      cx.fillRect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
      cx.fillStyle = MAU_DUONG;
    }
    cx.fillText(o.t, o.x, o.y);
  });
  cx.textAlign = 'center';
}

let tCu = 0;
function vong(t) {
  // tính theo thời gian thật, không theo số khung hình: màn 120Hz không xoay nhanh gấp đôi màn 60Hz;
  // chặn 100ms để quay lại tab đang ẩn thì không nhảy vọt
  const dt = tCu && t ? Math.min(100, t - tCu) : 16.7;
  tCu = t || 0;
  dtKhung = dt;
  if (quay) goc += 0.0022 * MUC_TOC[mucToc][1] * dt / 16.7;
  if (!itMotion && Math.abs(lechDen - lechDich) > 0.4) lechDich += (lechDen - lechDich) * 0.14;
  else lechDich = lechDen;
  CX = (W - lechDich) / 2;
  ve();
  requestAnimationFrame(vong);
}

/* ---------------- tương tác đồ thị ---------------- */
function timGan(mx, my) {
  let gan = null, min = 20;
  nodes.forEach((nd) => {
    const p = viTri(nd);
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < min) { min = d; gan = nd; }
  });
  return gan;
}
cv.addEventListener('mousemove', (e) => {
  const b = cv.getBoundingClientRect();
  const mx = e.clientX - b.left, my = e.clientY - b.top;
  chuot = { x: mx, y: my };
  hoverVung = timVung(mx, my);
  hoverLoi = !hoverVung && Math.hypot(mx - LX, my - LY) < (hoverLoi ? rkHienTai + 6 : banKinhLoi() + 4);
  hover = hoverLoi || hoverVung ? null : timGan(mx, my);
  cv.style.cursor = hover || hoverVung ? 'pointer' : hoverLoi ? 'help' : 'default';
});
cv.addEventListener('mouseleave', () => { hover = null; hoverLoi = false; hoverVung = null; chuot = null; });
cv.addEventListener('click', (e) => {
  const b = cv.getBoundingClientRect();
  const x = e.clientX - b.left, y = e.clientY - b.top;
  const v = timVung(x, y);                 // mặt A.I, bấm vòng một vùng: đọc tên vùng + số ghi chú, đường nối sáng lên
  if (v) {
    const so = vungSo[v] ?? 0;
    nhayVung = { ten: v, t0: giay() };
    noi(`Vùng ${v}: ${so} ghi chú.`, `${boDau(v)}: ${so} ${so === 1 ? 'note' : 'notes'}.`);
    return;
  }
  const nd = timGan(x, y);
  if (nd) { moChiTiet(nd.note.id); noi(nd.note.title); }   // mặt A.I: đọc tên ghi chú vừa bấm
  // bấm chỗ trống của đồ thị (không phải lõi Bát Quái): đóng thẻ chi tiết đang mở
  else if (Math.hypot(x - LX, y - LY) >= rkHienTai + 6) dongNeuTrong();
});

function capNhatToc(luu) {
  $('#mucToc').textContent = MUC_TOC[mucToc][0];
  $('#cham').disabled = mucToc === 0;
  $('#nhanh').disabled = mucToc === MUC_TOC.length - 1;
  const d = $('#dung');
  d.setAttribute('aria-pressed', String(!quay));
  d.setAttribute('aria-label', quay ? 'Dừng xoay' : 'Xoay lại');
  d.title = quay ? 'Dừng xoay' : 'Xoay lại';
  // biểu tượng nhỏ ở góc đổi màu vàng khi đang dừng — để biết vì sao đồ thị đứng yên
  $('#moToc').classList.toggle('dang-dung', !quay);
  $('#moToc').title = quay ? `Tốc độ xoay: ${MUC_TOC[mucToc][0]}` : 'Đang dừng xoay';
  if (luu) {
    try {
      localStorage.setItem('sb.mucToc', String(mucToc));
      localStorage.setItem('sb.quay', quay ? '1' : '0');
    } catch (_) { /* không lưu được thì thôi */ }
  }
}
// bảng chỉnh ẩn sẵn; bấm biểu tượng mới hiện, tự ẩn sau 5 giây không dùng, bấm ra ngoài hoặc Esc
let henAn = 0;
function moBangToc(mo) {
  $('#tocBang').hidden = !mo;
  $('#moToc').setAttribute('aria-expanded', String(mo));
  clearTimeout(henAn);
  if (mo) henAn = setTimeout(() => moBangToc(false), 5000);
}
$('#moToc').addEventListener('click', () => moBangToc($('#tocBang').hidden));
document.addEventListener('click', (e) => { if (!$('#tocDo').contains(e.target)) moBangToc(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#tocBang').hidden) moBangToc(false); });
// chỉnh tốc độ nghĩa là muốn xem xoay — đang dừng thì cho xoay lại luôn
const chinhToc = (f) => () => { f(); capNhatToc(true); moBangToc(true); };
$('#cham').addEventListener('click', chinhToc(() => { mucToc = Math.max(0, mucToc - 1); quay = true; }));
$('#nhanh').addEventListener('click', chinhToc(() => { mucToc = Math.min(MUC_TOC.length - 1, mucToc + 1); quay = true; }));
$('#dung').addEventListener('click', chinhToc(() => { quay = !quay; }));
capNhatToc(false);

/* Dải tên vùng và biểu tượng tốc độ tự ẩn sau một lúc không động vào màn hình — để đồ thị thoáng.
   Rê chuột, chạm, cuộn hay gõ phím là hiện lại ngay. Đang dùng (đang chọn bằng bàn phím, bảng tốc độ đang mở) thì không ẩn. */
const AN_SAU = 6000;
let henAnDuoi = 0;
function hienDuoi() {
  document.body.classList.remove('lang-yen');
  clearTimeout(henAnDuoi);
  henAnDuoi = setTimeout(() => {
    if (document.querySelector('.duoi:focus-within, .toc-do:focus-within') || !$('#tocBang').hidden) return hienDuoi();
    document.body.classList.add('lang-yen');
  }, AN_SAU);
}
['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll'].forEach((ev) =>
  window.addEventListener(ev, hienDuoi, { passive: true, capture: true }));
hienDuoi();

/* Nhấp đúp (máy tính) / chạm đúp (điện thoại) vào chỗ trống của đồ thị: phóng toàn màn hình: lõi, các chấm và tên, ẩn mọi nút.
   Tự đo nhấp đúp bằng pointerup cho cả chuột lẫn cảm ứng (iPhone không phát dblclick tin cậy).
   Toàn màn hình thật (Fullscreen API) nếu trình duyệt cho; không cho (iPhone) thì phủ kín cửa sổ bằng CSS — vẫn dùng được. */
let lanCham = { t: 0, x: 0, y: 0 };
let henGoiY = 0;
let henMotLan = 0;
const cam = () => matchMedia('(pointer:coarse)').matches;
function baoNhanh(chu, ms) {
  const g = $('#goiYThoat');
  g.textContent = chu;
  g.hidden = false;
  clearTimeout(henGoiY);
  henGoiY = setTimeout(() => { g.hidden = true; }, ms);
}
function datHienTen(bat) {
  hienTen = bat;
  $('#batTen').setAttribute('aria-pressed', String(bat));
  $('#batTen').title = bat ? 'Đang hiện tên — bấm để chỉ còn chấm (phím T)' : 'Chỉ chấm — bấm để hiện tên (phím T)';
  try { localStorage.setItem('sb.hienTen', bat ? '1' : '0'); } catch (_) { /* không lưu được thì thôi */ }
  if (tapTrung) baoNhanh(bat ? 'Hiện tên' : 'Chỉ chấm', 1200);
}
function datTapTrung(bat) {
  if (bat === tapTrung) return;
  tapTrung = bat;
  document.body.classList.toggle('tap-trung', bat);
  if (bat) {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { /* không cho thì dùng chế độ phủ cửa sổ */ });
    }
    baoNhanh(cam() ? 'Chạm 1 lần: bật/tắt tên · Chạm đúp: thoát'
      : 'Nhấp 1 lần (hoặc phím T): bật/tắt tên · Nhấp đúp hoặc Esc: thoát', 3500);
  } else {
    $('#goiYThoat').hidden = true;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  requestAnimationFrame(coLai);
}
cv.addEventListener('pointerup', (e) => {
  const b = cv.getBoundingClientRect();
  const x = e.clientX - b.left, y = e.clientY - b.top;
  const dup = e.timeStamp - lanCham.t < 350 && Math.hypot(x - lanCham.x, y - lanCham.y) < 30;
  lanCham = dup ? { t: 0, x: 0, y: 0 } : { t: e.timeStamp, x, y };
  if (Math.hypot(x - LX, y - LY) < rkHienTai + 6) {   // nút ẩn: bấm lõi Bát Quái — bật/tắt mặt A.I
    clearTimeout(henMotLan);
    if (!dup) datMat(!matDich);
    return;
  }
  if (timGan(x, y) || timVung(x, y)) return;   // lên một chấm / một vòng vùng: không phóng to, không bật tắt tên
  clearTimeout(henMotLan);
  if (dup) { datTapTrung(!tapTrung); return; }
  // toàn màn hình, nhấp 1 lần vào chỗ trống: bật/tắt tên — chờ một nhịp để phân biệt với nhấp đúp
  if (tapTrung) henMotLan = setTimeout(() => datHienTen(!hienTen), 330);
});
$('#batTen').addEventListener('click', () => datHienTen(!hienTen));
document.addEventListener('keydown', (e) => {
  if (!tapTrung || (e.key !== 't' && e.key !== 'T') || e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement;
  if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  datHienTen(!hienTen);
});
datHienTen(hienTen);
// thoát toàn màn hình bằng phím của trình duyệt (Esc, F11) thì cũng thoát chế độ này
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && tapTrung) datTapTrung(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tapTrung && $('#chiTiet').hidden) datTapTrung(false); });

/* ---------------- thẻ chi tiết ---------------- */
function ngayDep(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// nút mở một ghi chú: mang id ghi chú, để menu chuột phải (Mở · Sửa · Cất vào kho lưu) biết đang trỏ vào ghi chú nào
function ganMo(b, id) { b.dataset.ghiChu = id; b.addEventListener('click', () => moChiTiet(id)); }

let luotMo = 0;
async function moChiTiet(id) {
  const lan = ++luotMo;
  const r = await api('/api/note?id=' + encodeURIComponent(id));
  if (lan !== luotMo || !r.ok) return;     // bấm nhanh hai ghi chú: trả lời về muộn của ghi chú trước không đè ghi chú sau
  const n = r.note;
  chon = nodes.find((x) => x.note.id === id) || null;

  // đường dẫn nhóm — bấm từng tầng để mở đúng nhóm đó trong Thư viện
  const vun = $('#ctDuong');
  vun.innerHTML = '';
  const tang = (n.category || '').split('/').filter(Boolean);
  if (!tang.length) vun.appendChild(el('span', 'chua', 'Chưa xếp chỗ'));
  tang.forEach((t, i) => {
    if (i) vun.appendChild(el('i', null, '›'));
    const b = el('button', null, t);
    b.type = 'button';
    b.addEventListener('click', () => moThuVien({ category: tang.slice(0, i + 1).join('/') }));
    vun.appendChild(b);
  });

  const nl = $('#ctLoai');
  nl.textContent = tenLoai(n.kind);
  nl.style.setProperty('--m', LOAI[n.kind]?.mau || '#D4AF37');
  const the = $('#ctThe');
  the.innerHTML = '';
  (n.tags || []).forEach((t) => {
    const b = el('button', 'the', '#' + t);
    b.type = 'button';
    b.addEventListener('click', () => moThuVien({ tag: t }));
    the.appendChild(b);
  });
  $('#ctTitle').textContent = n.title;
  $('#ctNgay').textContent = `Ghi ${ngayDep(n.created_at)}` +
    (n.updated_at && n.updated_at.slice(0, 10) !== (n.created_at || '').slice(0, 10) ? ` · sửa ${ngayDep(n.updated_at)}` : '') +
    (n.reviewed_at ? ` · ôn ${ngayTu(n.reviewed_at)}` : '') + ` · mã ${n.id}`;
  $('#ctBody').textContent = n.content;

  // khối nguồn: link, trích dẫn học thuật, hạn — để truy lại gốc của kiến thức
  const ngn = $('#ctNguon');
  ngn.innerHTML = '';
  if (/^https?:\/\//i.test(n.url || '')) {        // chỉ mở link http(s), bỏ qua javascript: và dữ liệu lạ
    const a = document.createElement('a');
    a.href = n.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = n.url;
    ngn.append(el('b', null, 'Nguồn'), a);
    ngn.hidden = false;
  } else ngn.hidden = true;
  const tr = $('#ctTrich');
  tr.innerHTML = '';
  if (n.cite) { tr.append(el('b', null, 'Trích dẫn'), el('span', null, n.cite)); tr.hidden = false; } else tr.hidden = true;
  const han = $('#ctHan');
  han.innerHTML = '';
  if (n.kind === 'viec') {
    const quaHan = !n.done_at && n.due && n.due < new Date().toISOString().slice(0, 10);
    const o = el('span', null, n.due ? ngayDep(n.due) : 'không đặt hạn');
    o.appendChild(el('em', n.done_at ? 'xong' : quaHan ? 'tre' : 'mo',
      n.done_at ? ` · đã xong ${ngayTu(n.done_at)}` : (quaHan ? ' · quá hạn' : '') +
        (n.waiting_at ? ` · đang chờ từ ${ngayTu(n.waiting_at)}` : quaHan ? '' : ' · đang mở')));
    han.append(el('b', null, 'Hạn'), o);
    han.hidden = false;
  } else han.hidden = true;
  $('#ctNguonKhoi').hidden = ngn.hidden && tr.hidden && han.hidden;

  const lien = $('#ctLien');
  lien.innerHTML = '';
  if (n.linked?.length) {
    lien.appendChild(el('h3', null, `Ghi chú liên kết (${n.linked.length})`));
    n.linked.forEach((x) => {
      const b = el('button', 'hit');
      b.type = 'button';
      b.append(el('b', null, x.title), el('span', null, `${tenLoai(x.kind)} · ${duongDep(x.category)}`));
      ganMo(b, x.id);
      lien.appendChild(b);
    });
    lien.hidden = false;
  } else lien.hidden = true;

  const nho = $('#ctNho');
  nho.dataset.id = n.id;
  nho.disabled = false;
  nho.textContent = 'Nhớ rồi';
  nho.hidden = n.kind === 'viec';
  const xong = $('#ctXong');
  xong.dataset.id = n.id;
  xong.hidden = n.kind !== 'viec';
  xong.dataset.xong = n.done_at ? '0' : '1';
  xong.textContent = n.done_at ? 'Mở lại việc' : 'Đánh dấu xong';
  const cho = $('#ctCho');
  cho.dataset.id = n.id;
  cho.hidden = n.kind !== 'viec' || !!n.done_at;
  cho.dataset.cho = n.waiting_at ? '0' : '1';
  cho.textContent = n.waiting_at ? 'Hết chờ — làm tiếp' : 'Đang chờ';
  cho.title = n.waiting_at ? 'Đưa về Chưa làm' : 'Đang chờ người khác / chờ kết quả';
  const daCat = n.status === 'archived';
  $('#ctCat').dataset.id = n.id;
  $('#ctCat').hidden = daCat;
  $('#ctLay').dataset.id = n.id;
  $('#ctLay').hidden = !daCat;
  dongSua(n);
  $('#chiTiet').hidden = false;
  datLech();
}

/* ---------------- sửa ngay trong thẻ ---------------- */
let dangSua = null;

function dongSua(n) {
  dangSua = n;
  const f = $('#ctSua');
  f.hidden = true;
  $('#ctBody').hidden = false;
  $('#ctSuaMo').textContent = 'Sửa';
  $('#saySua').textContent = '';
  f.title.value = n.title || '';
  f.kind.value = n.kind || 'kien-thuc';
  f.category.value = n.category || '';
  f.tags.value = (n.tags || []).join(', ');
  f.url.value = n.url || '';
  f.cite.value = n.cite || '';
  f.due.value = n.due || '';
  f.content.value = n.content || '';
}

$('#ctSuaMo').addEventListener('click', () => {
  const f = $('#ctSua');
  const mo = f.hidden;
  f.hidden = !mo;
  $('#ctBody').hidden = mo;
  $('#ctSuaMo').textContent = mo ? 'Thôi sửa' : 'Sửa';
  if (mo) f.title.focus();
});
$('#ctHuy').addEventListener('click', () => dangSua && dongSua(dangSua));

$('#ctSua').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!dangSua) return;
  const f = e.target, say = $('#saySua');
  say.textContent = 'Đang lưu…'; say.className = 'say';
  const r = await api('/api/update', {
    id: dangSua.id, title: f.title.value.trim() || dangSua.title, kind: f.kind.value,
    category: f.category.value.trim(), tags: f.tags.value.trim(), url: f.url.value.trim(),
    cite: f.cite.value.trim(), due: f.due.value, content: f.content.value.trim() || dangSua.content,
  });
  if (!r.ok) { say.textContent = r.error || 'Không lưu được'; say.className = 'say er'; return; }
  const id = dangSua.id;
  await nap();
  await moChiTiet(id);
  const say2 = $('#saySua');
  say2.textContent = r.goi_y?.length ? 'Đã lưu. ' + r.goi_y.join(' ') : 'Đã lưu.';
  say2.className = 'say ok';
  if (xem === 'thu-vien') napThuVien();
  if (!$('[data-pane="on"]').hidden) napHangOn();
});
function dongChiTiet() { $('#chiTiet').hidden = true; chon = null; datLech(); }
$('#dong').addEventListener('click', dongChiTiet);
// Bấm ra chỗ trống ngoài thẻ chi tiết thì đóng thẻ, như bấm ×. Bấm nút / thẻ ghi chú khác / ô nhập thì làm việc của nó
// (mở ghi chú khác…). Đang sửa ghi chú thì không tự đóng — khỏi mất chữ đang gõ.
function dongNeuTrong() { if (!$('#chiTiet').hidden && $('#ctSua').hidden) dongChiTiet(); }
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element) || t === cv || $('#chiTiet').contains(t)) return;   // đồ thị tự xử lý ở trên
  if (t.closest('button, a, input, select, textarea, label, summary, [role="button"], [contenteditable="true"]')) return;
  dongNeuTrong();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#chiTiet').hidden) dongChiTiet();
});
$('#ctNho').addEventListener('click', async (e) => {
  const b = e.target;
  b.disabled = true;
  const r = await api('/api/reviewed', { id: b.dataset.id });
  b.textContent = r.ok ? 'Đã đánh dấu' : 'Không lưu được';
  if (r.ok) { await nap(); if (!$('[data-pane="on"]').hidden) await napHangOn(); }
});

/* Trên trang web chỉ có cất kho, không có xoá hẳn — xoá thật phải chạy lệnh trên máy chủ. */
$('#ctXong').addEventListener('click', async (e) => {
  const b = e.target, id = b.dataset.id;
  const r = await api('/api/task', { id, xong: b.dataset.xong === '1' });
  if (!r.ok) return alert(r.error || 'Không cập nhật được');
  await nap();
  await moChiTiet(id);
});

$('#ctCho').addEventListener('click', async (e) => {
  const b = e.target, id = b.dataset.id;
  const r = await api('/api/task', { id, cho: b.dataset.cho === '1' });
  if (!r.ok) return alert(r.error || 'Không cập nhật được');
  await nap();
  await moChiTiet(id);
});

$('#ctCat').addEventListener('click', async (e) => {
  const r = await api('/api/archive', { id: e.target.dataset.id });
  if (!r.ok) return alert(r.error || 'Không cất được');
  dongChiTiet();
  await sauKhiCat(e.target.dataset.id, true);
});
// ghi chú vừa cất kho (hoặc lấy lại): rời / về đồ thị, Thư viện, hàng ôn; kết quả Tìm chạy lại; các nút trỏ tới nó trong kết
// quả Nạp / Hỏi đánh dấu "đã cất" (chuột phải thành Lấy lại). Trước đây cất từ kết quả Tìm xong vẫn thấy nằm trong danh sách.
async function sauKhiCat(id, cat) {
  await nap();
  if (xem === 'thu-vien') napThuVien();
  if (!$('[data-pane="on"]').hidden) napHangOn();
  if ($('#oTim').value.trim()) timNgay();
  if (id) document.querySelectorAll(`#napKq [data-ghi-chu="${CSS.escape(id)}"], #traLoi [data-ghi-chu="${CSS.escape(id)}"]`)
    .forEach((b) => { b.classList.toggle('da-cat', cat); if (cat) b.dataset.daCat = '1'; else delete b.dataset.daCat; });
}

/* Menu chuột phải trên một ghi chú — thẻ Thư viện, kết quả Tìm / Hỏi / Nạp, việc, chấm trên đồ thị: Mở · Sửa · Cất vào
   kho lưu. Điện thoại: chạm giữ. Trên web không có xoá hẳn (cất kho lấy lại được); xoá thật phải nhờ Mây / lệnh máy chủ. */
const menuGc = $('#menuGc');
let menuId = null, moMenuLuc = 0;
function dongMenu() { menuGc.hidden = true; menuId = null; }
// mở menu cho ghi chú dưới phần tử t / điểm (x, y); không có ghi chú ở đó thì trả về false
function moMenu(t, x, y) {
  const o = t instanceof Element ? t.closest('[data-ghi-chu]') : null;
  let id = o?.dataset.ghiChu;
  if (!id && t === cv) {
    const b = cv.getBoundingClientRect();
    id = timGan(x - b.left, y - b.top)?.note.id;
  }
  if (!id) return false;
  menuId = id;
  // ghi chú đang nằm trong kho lưu (danh sách Kho lưu, kết quả vừa cất): mục cuối là "Lấy lại", không phải "Cất" lần nữa
  const daCat = o?.dataset.daCat === '1';
  menuGc.querySelector('[data-lam="cat"]').hidden = daCat;
  menuGc.querySelector('[data-lam="lay"]').hidden = !daCat;
  menuGc.hidden = false;
  moMenuLuc = performance.now();
  const r = menuGc.getBoundingClientRect();
  menuGc.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menuGc.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  return true;
}
document.addEventListener('contextmenu', (e) => {
  if (!moMenu(e.target, e.clientX, e.clientY)) { dongMenu(); return; }   // chỗ khác: để menu thường của trình duyệt
  e.preventDefault();
});
// Chạm giữ trên điện thoại: Android tự phát contextmenu, còn iPhone (Safari) thì không — tự đếm 0,55 giây. Mở menu bằng
// cách này thì cái "chạm" lúc nhấc tay bị bỏ, không mở luôn ghi chú. Kéo ngón tay (cuộn) thì thôi.
let giu = null, boClick = false;
document.addEventListener('pointerdown', (e) => {
  boClick = false;
  clearTimeout(giu?.hen);
  if (e.pointerType !== 'touch') { giu = null; return; }
  const t = e.target, x = e.clientX, y = e.clientY;
  giu = { x, y, hen: setTimeout(() => { giu = null; if (menuGc.hidden && moMenu(t, x, y)) boClick = true; }, 550) };
});
['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => { clearTimeout(giu?.hen); giu = null; }));
document.addEventListener('pointermove', (e) => {
  if (giu && Math.hypot(e.clientX - giu.x, e.clientY - giu.y) > 10) { clearTimeout(giu.hen); giu = null; }
});
window.addEventListener('click', (e) => {
  if (!boClick) return;
  boClick = false;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
menuGc.addEventListener('click', async (e) => {
  const lam = e.target.closest('button')?.dataset.lam, id = menuId;
  if (!lam || !id) return;
  dongMenu();
  if (lam === 'mo') return moChiTiet(id);
  if (lam === 'sua') { await moChiTiet(id); if ($('#ctSua').hidden) $('#ctSuaMo').click(); return; }
  if (lam === 'lay') {
    const r = await api('/api/archive', { id, lay_lai: true });
    if (!r.ok) return alert(r.error || 'Không lấy lại được');
    await sauKhiCat(id, false);
    if (!$('#chiTiet').hidden && $('#ctLay').dataset.id === id) await moChiTiet(id);
    return;
  }
  const ten = DATA.notes.find((x) => x.id === id)?.title;
  if (!confirm(`Cất ${ten ? `«${ten}»` : 'ghi chú này'} vào kho lưu?\n\nGhi chú rời khỏi đồ thị, Thư viện và tìm kiếm, `
    + 'nhưng không mất — lấy lại được ở tab Ôn › Kho lưu.')) return;
  const r = await api('/api/archive', { id });
  if (!r.ok) return alert(r.error || 'Không cất được');
  if (!$('#chiTiet').hidden && $('#ctCat').dataset.id === id) dongChiTiet();
  await sauKhiCat(id, true);
});
document.addEventListener('click', (e) => { if (!menuGc.hidden && !menuGc.contains(e.target)) dongMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dongMenu(); });
// cuộn thì đóng menu — trừ cái cuộn nhỏ ngay lúc mở (bấm chuột phải / chạm giữ vào thẻ nằm sát mép, trình duyệt tự cuộn thẻ
// vào khung): trước đây menu vừa hiện đã tắt ngay
window.addEventListener('scroll', () => { if (performance.now() - moMenuLuc > 400) dongMenu(); }, true);
window.addEventListener('resize', dongMenu);

$('#ctLay').addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  const r = await api('/api/archive', { id, lay_lai: true });
  if (!r.ok) return alert(r.error || 'Không lấy lại được');
  await sauKhiCat(id, false);
  await moChiTiet(id);
});

/* ---------------- các ô bên trái ---------------- */
document.querySelectorAll('.tabs button').forEach((b) => {
  b.addEventListener('click', () => moTab(b.dataset.tab));
});

/* ---------------- hàng chờ ôn lại ---------------- */
function ngayTu(iso) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'hôm nay';
  if (d === 1) return 'hôm qua';
  if (d < 30) return `${d} ngày trước`;
  if (d < 365) return `${Math.floor(d / 30)} tháng trước`;
  return `${Math.floor(d / 365)} năm trước`;
}

function moTab(ten, luu = true) {
  document.querySelectorAll('.tabs button').forEach((x) =>
    x.setAttribute('aria-selected', String(x.dataset.tab === ten)));
  document.querySelectorAll('.tab').forEach((p) => { p.hidden = p.dataset.pane !== ten; });
  if (ten === 'on') napHangOn();
  if (luu) try { localStorage.setItem('sb.tab', ten); } catch (_) { /* không lưu được thì thôi */ }
}
// phím / (khi không đang gõ chữ): nhảy tới ô Tìm
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement;
  if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  e.preventDefault();
  moTab('tim');
  $('#oTim').focus();
});
$('#choPhanLoai').addEventListener('click', () => moTab('on'));

/* Ghi chú bắt vội, chưa có nhóm hoặc thẻ — xếp chỗ thì sau mới tìm lại được. */
function veHopCho() {
  const box = $('#hopCho');
  box.innerHTML = '';
  const ds = DATA.notes.filter((n) => n.kind !== 'viec' && (!(n.category || '').trim() || !(n.tags || []).length));
  if (!ds.length) return;
  const khung = document.createElement('div');
  khung.className = 'hop-cho';
  const h = document.createElement('h2');
  h.textContent = `Chưa xếp chỗ (${ds.length})`;
  const vi = document.createElement('p');
  vi.className = 'vi';
  vi.textContent = 'Thiếu nhóm hoặc thẻ thì sau này tìm lại rất khó. Mở ra điền cho xong.';
  khung.append(h, vi);
  ds.slice(0, 8).forEach((n) => {
    const b = document.createElement('button');
    b.className = 'hit';
    b.type = 'button';
    const t = document.createElement('b'); t.textContent = n.title;
    const s = document.createElement('span');
    s.textContent = 'thiếu ' + [!(n.category || '').trim() && 'nhóm', !(n.tags || []).length && 'thẻ']
      .filter(Boolean).join(' và ');
    b.append(t, s);
    ganMo(b, n.id);
    khung.appendChild(b);
  });
  box.appendChild(khung);
}

/* Kho lưu: nơi ghi chú hết thời nằm lại, không bị xoá. */
let moKhoLuu = false;
const moBoKho = new Set();     // bộ trang đang bung trong Kho lưu

let luotKho = 0;
async function veKhoLuu() {
  const box = $('#khoLuu'), lan = ++luotKho;
  box.innerHTML = '';
  const n = DATA.trong_kho_luu || 0;
  if (!n) { moKhoLuu = false; return; }
  const nut = document.createElement('button');
  nut.type = 'button';
  nut.className = 'mo-kho';
  nut.textContent = moKhoLuu ? `Ẩn kho lưu (${n})` : `Kho lưu (${n}) — xem lại`;
  nut.addEventListener('click', () => { moKhoLuu = !moKhoLuu; veKhoLuu(); });
  box.appendChild(nut);
  if (!moKhoLuu) return;

  const r = await api('/api/archived');
  if (lan !== luotKho || !r.ok) return;     // đã có lần vẽ mới hơn (bấm mở/đóng nhanh, vừa cất thêm) — để lần đó vẽ
  const dong = (x, trongBo) => {
    const b = el('button', 'hit' + (trongBo ? ' trong-bo' : ''));
    b.type = 'button';
    b.append(el('b', null, x.title), el('span', null, `${duongDep(x.category)} · cất ${ngayTu(x.updated_at) || ''}`));
    ganMo(b, x.id);
    b.dataset.daCat = '1';
    return b;
  };
  // các trang của cùng một file ("<file> — trang N", thường là bản đã gộp) gom thành MỘT dòng, bấm để bung ra
  const bo = new Map(), le = [];
  r.notes.forEach((x) => {
    const m = /^(.+?) — trang (\d+)$/.exec(x.title);
    if (!m) { le.push(x); return; }
    if (!bo.has(m[1])) bo.set(m[1], []);
    bo.get(m[1]).push({ ...x, so: +m[2] });
  });
  bo.forEach((ds, ten) => {
    if (ds.length < 2) { le.push(...ds); return; }
    ds.sort((x, y) => x.so - y.so);
    const mo = moBoKho.has(ten);
    const nut = el('button', 'hit bo-kho');
    nut.type = 'button';
    nut.setAttribute('aria-expanded', String(mo));
    nut.append(el('b', null, `${mo ? '▾' : '▸'} «${ten}» — ${ds.length} trang`),
      el('span', null, `${duongDep(ds[0].category)} · cất ${ngayTu(ds[0].updated_at) || ''} · ${mo ? 'bấm để thu gọn' : 'bấm để xem từng trang'}`));
    nut.addEventListener('click', () => { if (mo) moBoKho.delete(ten); else moBoKho.add(ten); veKhoLuu(); });
    box.appendChild(nut);
    if (mo) ds.forEach((x) => box.appendChild(dong(x, true)));
  });
  le.forEach((x) => box.appendChild(dong(x)));
}
async function napHangOn() {
  veHopCho();
  veKhoLuu();
  const box = $('#hangOn');
  box.textContent = 'Đang lấy…';
  const r = await api('/api/review?limit=5');
  box.innerHTML = '';
  // máy chủ lỗi thì nói lỗi — trước đây cũng hiện "Chưa có gì để ôn", tưởng kho trống
  if (!r.ok) { box.appendChild(el('p', 'none', r.error || 'Không lấy được hàng ôn')); return; }
  if (!r.notes.length) {
    box.innerHTML = '<p class="none">Chưa có gì để ôn. Ghi chú cần cũ hơn 3 ngày mới vào hàng chờ.</p>';
    return;
  }
  r.notes.forEach((n) => {
    const the = document.createElement('div');
    the.className = 'the-on';
    const h = document.createElement('h3'); h.textContent = n.title;
    const p = document.createElement('p');
    p.textContent = (n.content || '').slice(0, 280) + ((n.content || '').length > 280 ? '…' : '');
    const khi = document.createElement('span');
    khi.className = 'khi';
    khi.textContent = n.reviewed_at
      ? `${duongDep(n.category)} · ôn lần cuối ${ngayTu(n.reviewed_at)}`
      : `${duongDep(n.category)} · ghi ${ngayTu(n.created_at)}, chưa ôn lần nào`;
    const nut = document.createElement('div'); nut.className = 'nut';
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'chinh'; ok.textContent = 'Nhớ rồi';
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      await api('/api/reviewed', { id: n.id });
      the.remove();
      if (!box.children.length) napHangOn();
      nap();
    });
    const mo = document.createElement('button');
    mo.type = 'button'; mo.textContent = 'Mở ra xem';
    ganMo(mo, n.id);
    nut.append(ok, mo);
    the.append(h, p, khi, nut);
    box.appendChild(the);
  });
}

$('#formThem').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, nut = f.querySelector('.go'), say = $('#sayThem');
  const d = Object.fromEntries(new FormData(f).entries());
  nut.disabled = true; say.textContent = 'Đang lưu…'; say.className = 'say';
  $('#trungLap').hidden = true;
  const r = await api('/api/add', d);
  nut.disabled = false;
  if (!r.ok) {
    say.textContent = r.error || 'Không lưu được'; say.className = 'say er';
    if (r.trung_id) baoTrung([{ id: r.trung_id, title: 'Mở ghi chú đã có' }], 'Ghi chú y hệt đang nằm ở đây:');
    return;
  }
  say.textContent = `Đã lưu vào ${duongDep(r.category)}.` + (r.nhom_moi?.length ? ` Nhóm mới: ${r.nhom_moi.map(duongDep).join(', ')}.` : '');
  say.className = 'say ok';
  f.reset();
  hienTheoLoai();
  await nap();
  if (r.similar?.length || r.goi_y?.length) baoTrung(r.similar || [], null, r.goi_y || []);
});

/* Hạn chỉ hiện khi là Việc; Trích dẫn khi là Tài liệu/Khái niệm — form gọn, không bắt điền thừa. */
function hienTheoLoai() {
  const k = $('#chonLoai').value || 'kien-thuc';
  document.querySelectorAll('#formThem .theo-loai').forEach((l) => { l.hidden = !l.dataset.loai.split(' ').includes(k); });
}
$('#chonLoai').addEventListener('change', hienTheoLoai);

/* Trùng không chặn lưu — chỉ nhắc, để anh tự gộp nếu muốn. */
function baoTrung(ds, loiDan, goiY = []) {
  const box = $('#trungLap');
  box.innerHTML = '';
  goiY.forEach((g) => box.appendChild(el('p', 'goi-y', g)));
  if (ds.length) {
    box.appendChild(el('p', null, loiDan || (ds.length === 1
      ? 'Kho đã có một ghi chú gần giống — mở ra xem để gộp hoặc nối lại:'
      : `Kho đã có ${ds.length} ghi chú gần giống — mở ra xem để gộp hoặc nối lại:`)));
  }
  ds.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.title;
    ganMo(b, s.id);
    box.appendChild(b);
  });
  box.hidden = false;
}

let hen, luotTim = 0;
function timNgay() {
  clearTimeout(hen);
  const q = $('#oTim').value.trim(), lan = ++luotTim;
  hen = setTimeout(async () => {
    const box = $('#ketQua');
    if (!q) { box.innerHTML = ''; return; }
    const r = await api('/api/search?' + new URLSearchParams({ q, kind: $('#timLoai').value, category: $('#timNhom').value }));
    if (lan !== luotTim) return;           // anh đã gõ tiếp / đổi bộ lọc: kết quả cũ về muộn không đè kết quả mới
    if (!r.ok || !Array.isArray(r.notes)) {
      box.innerHTML = '';
      const p = document.createElement('p'); p.className = 'none';
      p.textContent = r.error || 'Không tìm được';
      box.appendChild(p);
      return;
    }
    if (!r.notes.length) { box.innerHTML = '<p class="none">Không có ghi chú nào khớp.</p>'; return; }
    box.innerHTML = '';
    r.notes.forEach((n) => {
      const b = document.createElement('button');
      b.className = 'hit';
      b.type = 'button';
      const t = document.createElement('b'); t.textContent = n.title;
      const m = el('small', 'nho-meta', `${tenLoai(n.kind)} · ${duongDep(n.category)}`);
      const s = document.createElement('span');
      (n.snippet || '').split(/[«»]/).forEach((part, i) => {
        if (i % 2) { const em = document.createElement('em'); em.textContent = part; s.appendChild(em); }
        else s.appendChild(document.createTextNode(part));
      });
      b.append(t, m, s);
      ganMo(b, n.id);
      box.appendChild(b);
    });
    if (r.che_do === 'mo_rong') box.prepend(el('p', 'none', 'Không ghi chú nào có đủ mọi từ — đây là các ghi chú khớp nhiều từ nhất.'));
    else if (r.che_do === 'khong_dau') box.prepend(el('p', 'none', 'Không có kết quả đúng dấu — đây là các ghi chú khớp khi bỏ dấu.'));
  }, 220);
}
$('#oTim').addEventListener('input', timNgay);
$('#timLoai').addEventListener('change', timNgay);
$('#timNhom').addEventListener('change', timNgay);

/* Câu trả lời của Mây viết kiểu Markdown (**đậm**, `lệnh`, danh sách, khối ```) và dẫn nguồn bằng mã ghi chú [63d7736d5d92].
   Dựng thành phần tử DOM — không dùng innerHTML, câu trả lời chỉ là dữ liệu — để định dạng hiện đúng thay vì ký hiệu thô;
   mã nguồn thành nút mang tên ghi chú, bấm là mở (chuột phải có menu như mọi ghi chú). */
const MA_NGUON = /\[([0-9a-f]{12}(?:\s*[,;]\s*[0-9a-f]{12})*)\]/g;
function veTraLoi(chu, used) {
  const ten = new Map((used || []).map((u) => [u.id, u.title]));
  const khung = el('div', 'tl');
  const dong = (s, cha) => {                 // một dòng: **đậm**, `lệnh`, [mã ghi chú]
    const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([0-9a-f]{12}(?:\s*[,;]\s*[0-9a-f]{12})*)\]/g;
    let i = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > i) cha.append(s.slice(i, m.index));
      if (m[1] !== undefined) { const b = el('strong'); dong(m[1], b); cha.append(b); }
      else if (m[2] !== undefined) cha.append(el('code', null, m[2]));
      else m[3].split(/\s*[,;]\s*/).forEach((id) => {
        if (!ten.has(id)) { cha.append(`[${id}]`); return; }
        const t = ten.get(id);
        const n = el('button', 'trich', t.length > 42 ? t.slice(0, 40).trimEnd() + '…' : t);
        n.type = 'button';
        n.title = `Mở ghi chú nguồn: ${t}`;
        ganMo(n, id);
        cha.append(n);
      });
      i = re.lastIndex;
    }
    if (i < s.length) cha.append(s.slice(i));
  };
  let ds = null, loaiDs = '', liCuoi = null, doan = null, khoi = null;
  for (const l of String(chu || '').replace(/\r/g, '').split('\n')) {
    if (khoi) { if (/^\s*```/.test(l)) khoi = null; else khoi.textContent += (khoi.textContent ? '\n' : '') + l; continue; }
    if (/^\s*```/.test(l)) {
      const pre = el('pre');
      khoi = el('code');
      pre.append(khoi);
      khung.append(pre);
      ds = liCuoi = doan = null;
      continue;
    }
    if (!l.trim()) { doan = null; continue; }   // dòng trống: hết đoạn (danh sách vẫn nối tiếp nếu mục sau cũng là danh sách)
    let m;
    if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)$/)) || (m = l.match(/^\s*[-*•]\s+()(.*)$/))) {
      const loai = m[1] ? 'ol' : 'ul';
      if (!ds || loaiDs !== loai) {
        ds = el(loai);
        if (m[1]) ds.start = +m[1];
        loaiDs = loai;
        khung.append(ds);
      }
      liCuoi = el('li');
      dong(m[2], liCuoi);
      ds.append(liCuoi);
      doan = null;
      continue;
    }
    if ((m = l.match(/^#{1,4}\s+(.*)$/))) {
      const h = el('p', 'tl-de');
      dong(m[1], h);
      khung.append(h);
      ds = liCuoi = doan = null;
      continue;
    }
    if (/^\s/.test(l) && liCuoi) { liCuoi.append(el('br')); dong(l.trim(), liCuoi); continue; }   // dòng thụt vào: tiếp mục trên
    ds = liCuoi = null;
    if (doan) doan.append(el('br'));
    else { doan = el('p'); khung.append(doan); }
    dong(l.trim(), doan);
  }
  return khung;
}
// bản để đọc to / phụ đề: bỏ ký hiệu định dạng và mã ghi chú
const chuTron = (s) => String(s || '').replace(MA_NGUON, '').replace(/```[a-z]*|\*\*|`/g, '')
  .replace(/^\s*#{1,4}\s+/gm, '').replace(/^\s*(\d+[.)]|[-*•])\s+/gm, '')
  .replace(/[ \t]+([.,;:!?…])/g, '$1');      // bỏ mã nguồn xong còn sót khoảng trắng trước dấu câu ("theo ghi chú .")

/* Hỏi giờ / ngày ("mấy giờ rồi", "hôm nay thứ mấy"): trả lời ngay theo đồng hồ máy, không gửi Mây. Trước đây câu này đi hỏi
   kho và nhận về "chưa có thông tin về giờ trong các ghi chú". Chỉ bắt đúng câu hỏi ngắn — "giờ làm việc của kho bãi" vẫn hỏi kho. */
const DUOI_HOI = String.raw`(?:\s+(?:rồi|vậy|nhỉ|thế|ạ|anh|em|mây|bạn|hả|à))*`;
const HOI_GIO = new RegExp(String.raw`^(?:(?:bây giờ|giờ|hiện tại|hiện giờ|lúc này)\s+(?:là\s+)?)?mấy giờ` + DUOI_HOI + '$', 'iu');
const HOI_NGAY = new RegExp(String.raw`^(?:(?:hôm nay|nay|bữa nay)\s+(?:là\s+)?)?(ngày|thứ)\s+(?:mấy|bao nhiêu)(?:\s+tháng\s+mấy)?` + DUOI_HOI + '$', 'iu');
function traLoiTaiCho(cau) {
  const c = String(cau).replace(/[.?!…]+$/u, '').replace(/\s+/g, ' ').trim();
  const d = new Date(), thu = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  const ngay = `${thu}, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  const ngayAnh = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (HOI_GIO.test(c)) {
    return { vi: `Bây giờ là ${d.getHours()} giờ ${String(d.getMinutes()).padStart(2, '0')}, ${ngay}.`,
      en: `It is ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, ${ngayAnh}.` };
  }
  if (HOI_NGAY.test(c)) return { vi: `Hôm nay là ${ngay}.`, en: `Today is ${ngayAnh}.` };
  return null;
}

$('#nutHoi').addEventListener('click', async () => {
  const q = $('#oHoi').value.trim();
  const out = $('#traLoi');
  if (!q) { out.textContent = 'Chưa nhập câu hỏi.'; return; }
  const taiCho = traLoiTaiCho(q);
  if (taiCho) {
    out.textContent = '';
    out.append(el('p', null, taiCho.vi), el('p', 'hint', 'Theo đồng hồ máy anh — câu này không cần hỏi kho.'));
    noi(taiCho.vi, taiCho.en);
    return;
  }
  $('#nutHoi').disabled = true;
  out.textContent = 'Mây đang đọc ghi chú…';
  const r = await api('/api/ask', { question: q });
  $('#nutHoi').disabled = false;
  out.textContent = '';
  if (!r.ok) {
    // Mây lỗi vẫn đưa ra các ghi chú liên quan đã tìm được — anh tự mở đọc được
    out.textContent = r.error || 'Không hỏi được';
    noi('Em chưa hỏi được, anh xem dòng báo lỗi nhé.', "Sorry, I couldn't get an answer. Please see the error message.");
  } else {
    out.appendChild(veTraLoi(r.answer || r.note || '', r.used));
    noi(cauDau(chuTron(r.answer || r.note || '')));
  }
  if (r.used?.length) {
    const d = document.createElement('div');
    d.className = 'src';
    d.appendChild(document.createTextNode(r.ok ? 'Dựa trên:' : 'Ghi chú liên quan:'));
    r.used.forEach((u) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = u.title;
      ganMo(b, u.id);
      d.appendChild(b);
    });
    out.appendChild(d);
  }
});

/* ---------------- chế độ xem: Toàn cảnh / Thư viện / Việc ---------------- */
let xem = 'do';
function doiXem(ten) {
  xem = ten;
  document.querySelectorAll('.che-do button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.xem === ten)));
  document.querySelectorAll('.xem').forEach((s) => { s.hidden = s.dataset.xem !== ten; });
  if (ten === 'do') coLai();
  if (ten === 'thu-vien') { veCay(); napThuVien(); }
  if (ten === 'viec') napViec();
}
document.querySelectorAll('.che-do button').forEach((b) => b.addEventListener('click', () => doiXem(b.dataset.xem)));
$('#viecMo').addEventListener('click', () => doiXem('viec'));

/* ---------------- Thư viện: duyệt có hệ thống theo cây nhóm × loại × thẻ ---------------- */
const LOC = { category: '', kind: '', tag: '', sort: 'moi-sua', offset: 0 };
const moRong = new Set();       // các nút cây đang mở

function moThuVien(loc) {
  Object.assign(LOC, { category: '', kind: '', tag: '', offset: 0 }, loc);
  (LOC.category || '').split('/').forEach((_, i, a) => moRong.add(a.slice(0, i + 1).join('/')));
  if (window.innerWidth < 900) dongChiTiet();
  doiXem('thu-vien');
}

function veCay() {
  const box = $('#cayNhom');
  box.innerHTML = '';
  const tatCa = el('button', 'nut-cay' + (!LOC.category ? ' on' : ''));
  tatCa.type = 'button';
  tatCa.append(el('span', null, 'Toàn bộ kho'), el('u', null, String(DATA.tong_ghi_chu ?? '')));
  // đổi nhóm trên cây thì bỏ lọc loại / thẻ: số bên cây (cả nhóm) mới khớp số trong danh sách. Trước đây bấm chip "Ý tưởng"
  // một lần rồi đi nhóm khác vẫn dính lọc → "Phương pháp 3" mà danh sách "Ý tưởng · 0 — không có ghi chú nào"
  tatCa.addEventListener('click', () => { Object.assign(LOC, { category: '', kind: '', tag: '', offset: 0 }); veCay(); napThuVien(); });
  box.appendChild(tatCa);
  const ve = (ds, sau, cha) => ds.forEach((c) => {
    const duong = c.duong_dan || '__chua__';
    const dong = el('div', 'dong-cay');
    dong.style.paddingLeft = `${sau * 14}px`;
    const coCon = c.con?.length > 0;
    const mo = moRong.has(duong);
    const mui = el('button', 'mui' + (coCon ? '' : ' an'), coCon ? (mo ? '▾' : '▸') : '');
    mui.type = 'button';
    mui.setAttribute('aria-label', mo ? 'Thu gọn' : 'Mở rộng');
    mui.addEventListener('click', () => { if (mo) moRong.delete(duong); else moRong.add(duong); veCay(); });
    const b = el('button', 'nut-cay' + (LOC.category === duong ? ' on' : '') + (c.ten === 'Chưa xếp chỗ' ? ' chua' : ''));
    b.type = 'button';
    const ten = el('span', null, c.ten);
    if (sau === 0 && c.ten !== CHUA) {   // chấm màu của vùng — cùng màu với vòng ở Toàn cảnh
      const i = el('i', 'cham-vung');
      i.style.background = mauCua(c.ten);
      ten.prepend(i);
    }
    b.append(ten, el('u', null, String(c.so)));
    b.addEventListener('click', () => {
      Object.assign(LOC, { category: duong, kind: '', tag: '', offset: 0 });
      if (coCon) moRong.add(duong);
      veCay(); napThuVien();
    });
    dong.append(mui, b);
    box.appendChild(dong);
    if (coCon && mo) ve(c.con, sau + 1, duong);
  });
  ve(DATA.cay || [], 0, '');
}

let dangNapTV = 0;
async function napThuVien(themNua = false) {
  if (!themNua) LOC.offset = 0;
  const lan = ++dangNapTV;
  const r = await api('/api/library?' + new URLSearchParams({
    category: LOC.category, kind: LOC.kind, tag: LOC.tag, sort: LOC.sort, offset: LOC.offset, limit: 40,
  }));
  if (lan !== dangNapTV) return;        // người dùng đã bấm lọc khác trong lúc chờ
  const ds = $('#kDs');
  if (!themNua) ds.innerHTML = '';
  if (!r.ok) { ds.appendChild(el('p', 'none', r.error || 'Không nạp được')); return; }

  const c = LOC.category;
  $('#kDuong').textContent = c === '__chua__' ? 'Cần xếp chỗ' : c ? 'Toàn bộ kho › ' + duongDep(c) : 'Toàn bộ kho';
  // đang lọc theo loại thì ghi rõ trên tiêu đề — "Tất cả ghi chú · 1" khi đang lọc Ý tưởng dễ hiểu nhầm là kho chỉ có 1
  $('#kTieuDe').textContent = (c === '__chua__' ? 'Chưa xếp chỗ' : c ? c.split('/').pop() : 'Tất cả ghi chú')
    + (LOC.kind ? ` · ${tenLoai(LOC.kind)}` : '') + ` · ${r.tong}`;
  const tt = $('#kThe');
  tt.hidden = !LOC.tag;
  if (LOC.tag) {
    tt.innerHTML = '';
    const x = el('button', null, '× bỏ lọc');
    x.type = 'button';
    x.addEventListener('click', () => { LOC.tag = ''; napThuVien(); });
    tt.append(document.createTextNode(`Thẻ #${LOC.tag} `), x);
  }

  // chip loại: số đếm toàn kho, bấm để lọc
  const chip = $('#kLoai');
  const LOAI_DANG = LOC.kind;
  chip.innerHTML = '';
  const tao = (k, ten, so, mau) => {
    const b = el('button', 'chip' + (LOC.kind === k ? ' on' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(LOC.kind === k));
    if (mau) { const i = el('i'); i.style.background = mau; b.appendChild(i); }
    b.append(el('span', null, ten), el('u', null, String(so)));
    b.addEventListener('click', () => { LOC.kind = LOC.kind === k ? '' : k; napThuVien(); });
    chip.appendChild(b);
  };
  const dem = r.dem_loai || {};
  tao('', 'Mọi loại', r.tong_khong_loc_loai ?? '', null);
  Object.keys(LOAI).filter((k) => dem[k] || LOAI_DANG === k).forEach((k) => tao(k, tenLoai(k), dem[k] || 0, LOAI[k].mau));

  veGopTrang(r.bo_trang || []);

  if (!r.notes.length && !themNua) {
    ds.appendChild(el('p', 'none', 'Không có ghi chú nào ở đây.'));
  }
  r.notes.forEach((n) => ds.appendChild(theGhiChu(n)));
  LOC.offset = r.offset + r.notes.length;
  const them = $('#kThem');
  them.hidden = LOC.offset >= r.tong;
  them.textContent = `Xem thêm (${r.tong - LOC.offset} ghi chú)`;
}

/* File nạp kiểu "mỗi trang 1 ghi chú" thành cả chục ghi chú trùng tên, chục chấm ở Toàn cảnh — mời gộp lại thành 1.
   Các ghi chú trang vào kho lưu (lấy lại được), máy chủ sao lưu trước khi gộp. */
function veGopTrang(bo) {
  const box = $('#kGop');
  box.innerHTML = '';
  box.hidden = !bo.length;
  bo.forEach(({ ten, so_trang: so }) => {
    const dong = el('p');
    const nut = el('button', 'go', 'Gộp thành 1 ghi chú');
    nut.type = 'button';
    nut.addEventListener('click', async () => {
      if (!confirm(`Gộp ${so} ghi chú trang của «${ten}» thành một ghi chú?\n\nNội dung nối theo thứ tự trang, giữ thẻ và liên kết. `
        + 'Các ghi chú trang chuyển vào kho lưu — không mất, lấy lại được.')) return;
      nut.disabled = true;
      const r = await api('/api/gop-trang', { ten });
      if (!r.ok) { nut.disabled = false; alert(r.error || 'Không gộp được'); return; }
      await nap();
      veCay(); napThuVien();
    });
    dong.append(el('b', null, `«${ten}»`), document.createTextNode(` đang là ${so} ghi chú — mỗi trang một chấm. `), nut);
    box.appendChild(dong);
  });
}

function theGhiChu(n) {
  const b = el('button', 'the-gc');
  b.type = 'button';
  b.style.setProperty('--m', LOAI[n.kind]?.mau || '#D4AF37');
  const dau = el('div', 'dau');
  dau.append(el('span', 'nhan', tenLoai(n.kind)), el('span', 'duong-nho', duongDep(n.category)));
  const meta = [];
  if (n.kind === 'viec') meta.push(n.done_at ? 'đã xong' : (n.waiting_at ? 'đang chờ · ' : '') + (n.due ? `hạn ${ngayDep(n.due)}` : 'chưa đặt hạn'));
  meta.push(`sửa ${ngayTu(n.updated_at) || ''}`);
  if (n.url) meta.push('có nguồn');
  if (n.cite) meta.push('có trích dẫn');
  b.append(dau, el('h3', null, n.title), el('p', null, n.preview !== n.title ? n.preview || '' : ''),   // việc tạo nhanh: nội dung = tên
    el('div', 'chan', meta.join(' · ') + ((n.tags || []).length ? '  ' + n.tags.map((t) => '#' + t).join(' ') : '')));
  ganMo(b, n.id);
  return b;
}

$('#kSap').addEventListener('change', (e) => { LOC.sort = e.target.value; napThuVien(); });
$('#kThem').addEventListener('click', () => napThuVien(true));

/* ---------------- Việc ----------------
   Bộ lọc: Chưa làm (xếp theo hạn) · Đang chờ (đợi người khác / đợi kết quả) · Đã xong · Tất cả. Trình duyệt nhớ bộ lọc. */
const NHOM_CHUA = [['qua_han', 'Quá hạn'], ['hom_nay', 'Hôm nay'], ['7_ngay_toi', '7 ngày tới'],
  ['sau_nay', 'Sau này'], ['khong_han', 'Không đặt hạn']];
const LOC_VIEC = {
  chua: { nhom: NHOM_CHUA, trong: 'Không có việc nào chưa làm.' },
  cho: { nhom: [['dang_cho', 'Đang chờ']], trong: 'Không có việc nào đang chờ. Việc đợi người khác / đợi kết quả: bấm Chờ ở dòng việc.' },
  xong: { nhom: [['da_xong', 'Đã xong']], trong: 'Chưa có việc nào xong.' },
  tat: { nhom: [...NHOM_CHUA, ['dang_cho', 'Đang chờ'], ['da_xong', 'Đã xong']], trong: 'Chưa có việc nào.' },
};
let locViec = 'chua', luotViec = 0;
try { const x = localStorage.getItem('sb.locViec'); if (LOC_VIEC[x]) locViec = x; } catch (_) { /* mặc định Chưa làm */ }
async function napViec() {
  const luot = ++luotViec;                 // bấm lọc liên tục: chỉ vẽ kết quả của lần bấm cuối
  const r = await api('/api/tasks' + (locViec === 'xong' || locViec === 'tat' ? '?tat_ca=1' : ''));
  if (luot !== luotViec) return;
  const box = $('#vDs');
  box.innerHTML = '';
  const dem = r.ok ? r.dem : {};
  const so = { chua: dem.chua_lam, cho: dem.dang_cho, xong: dem.da_xong, tat: (dem.chua_lam + dem.dang_cho + dem.da_xong) || 0 };
  document.querySelectorAll('#vLoc .chip').forEach((b) => {
    const on = b.dataset.loc === locViec;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
    b.querySelector('u').textContent = r.ok ? so[b.dataset.loc] : '';
  });
  if (!r.ok) { box.appendChild(el('p', 'none', r.error || 'Không nạp được')); return; }
  let co = false;
  LOC_VIEC[locViec].nhom.forEach(([k, ten]) => {
    const ds = r[k] || [];
    if (!ds.length) return;
    co = true;
    const khoi = el('section', 'khoi-viec ' + k);
    const conNua = k === 'da_xong' && dem.da_xong > ds.length ? ` (${ds.length} việc xong gần nhất)` : '';
    khoi.appendChild(el('h3', null, `${ten} · ${k === 'da_xong' ? dem.da_xong : ds.length}${conNua}`));
    ds.forEach((v) => khoi.appendChild(dongViec(v, k)));
    box.appendChild(khoi);
  });
  if (!co) {
    const p = el('p', 'none', LOC_VIEC[locViec].trong);
    if (locViec === 'chua' && dem.dang_cho) p.append(` ${dem.dang_cho} việc đang chờ — bấm Đang chờ để xem.`);
    box.appendChild(p);
  }
}
function dongViec(v, k) {
  const xong = k === 'da_xong', cho = k === 'dang_cho';
  const dong = el('div', 'dong-viec' + (cho ? ' dang-cho' : ''));
  const o = el('input');
  o.type = 'checkbox';
  o.checked = xong;
  o.setAttribute('aria-label', (xong ? 'Mở lại việc: ' : 'Đánh dấu xong: ') + v.title);
  o.addEventListener('change', async () => {
    o.disabled = true;
    await api('/api/task', { id: v.id, xong: o.checked });
    await nap();
  });
  const t = el('button', 'ten-viec');
  t.type = 'button';
  // việc chưa có nhóm thì thôi ghi "Chưa xếp chỗ"; việc tạo nhanh có nội dung = tên thì không lặp lại tên
  t.append(el('b', null, v.title), el('span', null, [
    xong ? 'xong ' + ngayTu(v.done_at) : cho ? 'đang chờ từ ' + ngayTu(v.waiting_at) : '',
    v.due ? (cho && v.qua_han ? 'quá hạn ' : 'hạn ') + ngayDep(v.due) : '',
    (v.category || '').trim() && duongDep(v.category),
    v.tom_tat !== v.title && v.tom_tat].filter(Boolean).join(' · ')));
  ganMo(t, v.id);
  dong.append(o, t);
  if (!xong) {                             // việc đã xong không cần "chờ"
    const c = el('button', 'nhe nut-cho', cho ? 'Làm tiếp' : 'Chờ');
    c.type = 'button';
    c.title = cho ? 'Hết chờ — đưa về Chưa làm' : 'Đang chờ người khác / chờ kết quả';
    c.setAttribute('aria-label', (cho ? 'Hết chờ: ' : 'Đánh dấu đang chờ: ') + v.title);
    c.addEventListener('click', async () => {
      c.disabled = true;
      const r = await api('/api/task', { id: v.id, cho: !cho });
      if (!r.ok) { c.disabled = false; alert(r.error || 'Không cập nhật được'); return; }
      await nap();
    });
    dong.appendChild(c);
  }
  return dong;
}
$('#vLoc').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b || b.dataset.loc === locViec) return;
  locViec = b.dataset.loc;
  try { localStorage.setItem('sb.locViec', locViec); } catch (_) { /* không nhớ được thì thôi */ }
  napViec();
});
// Tạo việc ngay ở cột Việc (trước đây chỉ có dòng hướng dẫn sang tab Thêm — anh hỏi "không nhập / tạo việc được?").
// Chỉ cần tên; hạn, nhóm tuỳ chọn; máy chủ lấy tên làm nội dung.
$('#formViec').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, o = (ten) => f.elements.namedItem(ten), nut = f.querySelector('.go'), say = $('#sayViec');
  const ten = o('title').value.trim();
  if (!ten || nut.disabled) return;
  nut.disabled = true; say.textContent = 'Đang thêm…'; say.className = 'say';
  const han = o('due').value;
  const r = await api('/api/add', { title: ten, content: '', kind: 'viec', due: han, category: o('category').value.trim() });
  nut.disabled = false;
  if (!r.ok) {
    say.textContent = r.error || 'Không thêm được'; say.className = 'say er';
    if (r.trung_id) { const b = el('button', 'nho', 'Mở việc đã có'); b.type = 'button'; ganMo(b, r.trung_id); say.append(' ', b); }
    return;
  }
  say.textContent = `Đã thêm «${ten}»` + (han ? ` — hạn ${ngayDep(han)}.` : ' — không đặt hạn.'); say.className = 'say ok';
  f.reset();
  await nap();                             // nap() vẽ lại danh sách Việc và số "việc đang mở"
  o('title').focus();
});

/* ---------------- Nạp: dán văn bản / chọn file .md .txt .pdf .docx ----------------
   .md/.txt: trình duyệt đọc chữ rồi gửi lên. PDF / Word: gửi nguyên file (base64), máy chủ đọc chữ. Mặc định mỗi file
   một ghi chú. Ô dán lúc nào cũng gõ được (từng bị tắt khi đã chọn file — bấm không vào, tưởng hỏng): có cả file lẫn chữ
   dán thì nạp cả hai, chữ dán thành ghi chú riêng, và dòng nhắc nói trước điều đó — không hộp hỏi, không chặn. */
let tepChon = [];
const LA_CHU = /\.(md|markdown|txt)$/i, LA_TEP = /\.(pdf|docx)$/i, TOI_DA = 4 * 1024 * 1024;
const base64 = (buf) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const TONG_TOI_DA = 7.5e6;      // một lần gửi lên máy chủ tối đa 8 MB (file Word/PDF gửi dạng base64, to hơn ~1/3)
async function docTep(files) {
  files = [...files];                    // chép ra trước: xoá ô chọn file (bên dưới) làm trống luôn danh sách gốc
  const ok = files.filter((f) => (LA_CHU.test(f.name) || LA_TEP.test(f.name)) && f.size < TOI_DA);
  const moi = await Promise.all(ok.map(async (f) => (LA_CHU.test(f.name)
    ? { name: f.name, text: await f.text() } : { name: f.name, b64: base64(await f.arrayBuffer()) })));
  // chọn thêm lần nữa thì CỘNG vào danh sách (trước đây thay hẳn — chọn file thứ hai là mất file thứ nhất);
  // trùng tên thì lấy bản mới; tổng quá giới hạn một lần gửi thì để file sau cho đợt sau
  const coTep = (t) => (t.text || t.b64 || '').length;
  tepChon = tepChon.filter((t) => !moi.some((m) => m.name === t.name));
  let tong = tepChon.reduce((x, t) => x + coTep(t), 0), tran = 0;
  moi.forEach((t) => { if (tong + coTep(t) <= TONG_TOI_DA) { tepChon.push(t); tong += coTep(t); } else tran++; });
  $('#chonTep').value = '';              // chọn lại đúng file đó vẫn nhận
  const bo = files.length - ok.length + tran;
  const doc = files.some((f) => /\.doc$/i.test(f.name)) ? ' (file Word .doc đời cũ: mở bằng Word, Lưu thành .docx)' : '';
  // chọn 1 file mà ô dán đang có đúng MỘT dòng ngắn, ô Tên trống: đó là tên anh gõ trước — chuyển sang ô Tên
  const chu = $('#napChu').value.trim();
  if (tepChon.length === 1 && chu && !chu.includes('\n') && chu.length <= 150 && !$('#napTen').value.trim()) {
    $('#napTen').value = chu; $('#napChu').value = '';
  }
  veDsTep(tepChon.length
    ? `${tepChon.length} file: ${tepChon.map((t) => t.name).join(', ').slice(0, 220)}`
      + (tran ? ` · ${tran} file để đợt sau (một lần nạp tối đa ~7 MB)` : '')
      + (bo - tran ? ` · bỏ ${bo - tran} file không nhận được${doc}` : '')
    : (bo ? `Bỏ ${bo} file — chỉ nhận .md .txt .pdf .docx dưới 4 MB, tổng một lần ~7 MB${doc}` : ''));
}
// Có file lẫn chữ dán: dòng nhắc nói trước sẽ ra thêm một ghi chú từ ô dán. Ô Tên đặt tên cho file (không có file thì
// cho chữ dán), chỉ bật khi phần đó ra đúng một ghi chú; chữ mờ trong ô nói bỏ trống thì tên lấy từ đâu.
function capNhatNap() {
  const chu = $('#napChu').value.trim(), coTep = tepChon.length > 0, coChu = !!chu, ten = $('#napTen'), ghi = $('#napChuGhi');
  ghi.hidden = !(coTep && coChu);
  if (!ghi.hidden) {                     // nêu tên ghi chú sẽ ra từ ô dán: chữ sót lại thì nhìn là thấy
    const dau = chu.split('\n')[0].trim();
    ghi.replaceChildren('Sẽ nạp ', el('b', null, 'cả file lẫn chữ dán'), ': chữ dán thành một ghi chú riêng (bắt đầu «'
      + (dau.length > 50 ? dau.slice(0, 50) + '…' : dau) + '»). Chỉ muốn nạp file thì xoá chữ trong ô dán.');
  }
  const mot = tepChon.length <= 1 && $('#napTach').value === 'khong';
  ten.disabled = !mot;
  ten.placeholder = !mot ? (tepChon.length > 1 ? 'Nhiều file: mỗi file lấy tên riêng' : 'Đang tách nhiều ghi chú: mỗi ghi chú lấy tên riêng')
    : coTep ? 'Bỏ trống: lấy tên trong file' : coChu ? 'Bỏ trống: lấy dòng đầu ô dán' : 'vd: Quy trình bảo trì thang máy';
}
$('#napTach').addEventListener('change', capNhatNap);
$('#napChu').addEventListener('input', capNhatNap);
// danh sách file đã chọn + nút bỏ chọn (file chọn từ lần trước còn nằm đó thì lần nạp sau nạp luôn — dễ quên)
function veDsTep(chu) {
  const d = $('#dsTep');
  d.textContent = chu;
  capNhatNap();
  if (!tepChon.length) return;
  const x = el('button', 'bo-tep', '× bỏ chọn');
  x.type = 'button';
  x.addEventListener('click', (e) => {
    e.preventDefault();                    // nút nằm trong khung chọn file: không để nó mở hộp chọn file
    tepChon = []; $('#chonTep').value = ''; veDsTep('');
  });
  d.append(' ', x);
}
$('#chonTep').addEventListener('change', (e) => docTep(e.target.files));
const vung = $('#vungTha');
['dragenter', 'dragover'].forEach((ev) => vung.addEventListener(ev, (e) => { e.preventDefault(); vung.classList.add('keo'); }));
['dragleave', 'drop'].forEach((ev) => vung.addEventListener(ev, () => vung.classList.remove('keo')));
vung.addEventListener('drop', (e) => { e.preventDefault(); docTep(e.dataTransfer.files); });

let dangNap = false;
async function napVao(thu) {
  const out = $('#napKq');
  const chu = $('#napChu').value.trim();
  if (!tepChon.length && !chu) { out.textContent = 'Chưa có file hay nội dung để nạp.'; return; }
  if (dangNap) return;
  out.textContent = thu ? 'Đang xem trước…' : 'Đang nạp…';
  // khoá hai nút trong lúc chờ: bấm đúp "Nạp vào kho" từng gửi hai lần — lần sau báo "Đã thêm 0 ghi chú · bỏ 1 bản trùng"
  dangNap = true; $('#napThu').disabled = $('#napThat').disabled = true;
  const r = await api('/api/ingest', {
    files: tepChon, text: chu, category: $('#napNhom').value.trim(), kind: $('#napLoai').value, tags: $('#napThe').value.trim(),
    tach: $('#napTach').value, title: $('#napTen').disabled ? '' : $('#napTen').value.trim(), dry_run: thu,
  });
  dangNap = false; $('#napThu').disabled = $('#napThat').disabled = false;
  out.innerHTML = '';
  if (!r.ok) { out.appendChild(el('p', 'say er', r.error || 'Không nạp được')); return; }
  const so = thu ? r.se_them : r.da_them;
  const tuDan = (r.ghi_chu || []).filter((g) => g.tu === '(dán vào)').length;
  const nguon = tuDan && tuDan < (r.ghi_chu || []).length ? ` (${(r.ghi_chu || []).length - tuDan} từ file, ${tuDan} từ ô dán)` : '';
  out.appendChild(el('p', 'say ok', (thu ? `Sẽ thêm ${so} ghi chú` : `Đã thêm ${so} ghi chú`) + nguon +
    (r.bo_qua_trung ? ` · bỏ ${r.bo_qua_trung} bản trùng` : '') + (r.bo_qua_rong ? ` · bỏ ${r.bo_qua_rong} mục rỗng` : '')));
  if (r.nhom_moi?.length) out.appendChild(el('p', 'hint', 'Nhóm mới: ' + r.nhom_moi.map(duongDep).join(', ')));
  const ds = el('div', 'list');
  (r.ghi_chu || []).forEach((g) => {
    const b = el('button', 'hit');
    b.type = 'button';
    const tu = !g.tu ? '' : g.tu === '(dán vào)' ? ' · từ ô dán' : ` · từ file ${g.tu}`;
    b.append(el('b', null, g.title), el('span', null, `${tenLoai(g.kind)} · ${duongDep(g.category)}${tu}`));
    if (g.id) ganMo(b, g.id); else b.disabled = true;
    ds.appendChild(b);
  });
  out.appendChild(ds);
  if (!thu) {                             // nạp xong (kể cả toàn bản trùng): bỏ chọn file, xoá ô dán
    tepChon = []; $('#chonTep').value = ''; $('#napChu').value = ''; $('#napTen').value = ''; veDsTep('');
    await nap();
  }
}
capNhatNap();
$('#napThu').addEventListener('click', () => napVao(true));
$('#napThat').addEventListener('click', () => napVao(false));

/* ---------------- chạy ---------------- */
window.addEventListener('resize', coLai);
coLai();
// Mở lại đúng tab lần trước. Lần đầu trên điện thoại/máy tính bảng: mở tab Tìm (gọn) thay vì form Thêm dài
// cả màn hình — ghi chú trên điện thoại thường nhắn qua Telegram, còn trang web dùng để tra và xem.
// Đặt ở cuối file: trước đây nằm giữa file, mở lại thẳng tab Ôn là chạy khi các biến của Kho lưu chưa khởi tạo → lỗi,
// mất nút "Kho lưu".
{
  let t = null;
  try { t = localStorage.getItem('sb.tab'); } catch (_) { /* bỏ qua */ }
  if (!t || !document.querySelector(`.tabs [data-tab="${t}"]`)) t = matchMedia('(max-width:900px)').matches ? 'tim' : null;
  if (t && t !== 'them') moTab(t, false);
}
nap().then(hienTheoLoai);
requestAnimationFrame(vong);
// dựng sẵn mô hình mặt A.I lúc máy rảnh (~0,3 giây) — lần đầu bấm lõi Bát Quái không bị khựng
(window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => { if (!MH) MH = dungMoHinh(); }, { timeout: 4000 });
