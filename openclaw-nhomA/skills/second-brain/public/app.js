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
// 8 màu tách bạch trên nền xanh đậm: 3 màu chủ đạo (vàng kim, xanh dương, cam) + 5 màu phân biệt.
// Bản cũ chỉ có 3 tông lặp lại (vàng/vàng nhạt, xanh/xanh nhạt, cam/cam nhạt) nên từ vùng thứ 4 là trùng màu.
const MAU = ['#D4AF37', '#3E8EDE', '#F07F2D', '#2EC4B6', '#A78BFA', '#E8708F', '#8BCB6B', '#7DCBF5'];
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
let vongMau = [];        // màu theo thứ tự vòng
let noiBat = null;       // tên nhóm đang được làm nổi, null = không lọc
let quay = true;
let tapTrung = false;    // nhấp đúp: toàn màn hình — lõi, chấm và tên, ẩn mọi nút
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
  const v = DATA.viec_dang_mo || 0;
  $('#viecMo').textContent = v ? `${v} việc đang mở →` : '';
  $('#viecMo').hidden = !v;
  dienChon();
  dungQuyDao();
  if (xem === 'thu-vien') veCay();
  if (xem === 'viec') napViec();
}

/* Các ô chọn loại / vùng: đổ một lần, giữ lựa chọn đang có. */
function dienChon() {
  const dem = Object.fromEntries((DATA.loai || []).map((x) => [x.kind, x.so]));
  [['#chonLoai', false], ['#suaLoai', false], ['#napLoai', 'Theo file (mặc định: Kiến thức)'], ['#timLoai', 'Mọi loại']]
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
  tn.value = cu;
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
  nodes = [];
  vongMau = [];
  ten.forEach((k, vi) => {
    const ds = nhom[k];
    // mỗi nhóm một vòng; nhóm đông nằm vòng trong
    const bk = 0.26 + (vi + 1) / (ten.length + 1) * 0.70;
    const lech = vi * 0.9;
    const mau = mauCua(k);
    vongMau.push(mau);
    ds.forEach((note, i) => {
      nodes.push({
        note, nhom: k, vong: vi, mau,
        bk, pha: lech + (i / ds.length) * Math.PI * 2,
        toc: (vi % 2 ? -1 : 1) * (0.26 / (vi + 2)),
        r: 3.4 + Math.min(3.2, (note.tags?.length || 0) * 0.7),
      });
    });
  });
  veChuGiai(ten, nhom);
  veConLai();
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
  CY = H / 2;
  datLech();
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
const banKinh = () => Math.min((W - lechDich) * 0.40, H * (tapTrung ? 0.58 : 0.46));
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
  return { x: CX + Math.cos(a) * R * b, y: CY + Math.sin(a) * R * b * det() };
}

function ve() {
  cx.clearRect(0, 0, W, H);
  const R = banKinh();

  // vòng quỹ đạo — mỗi nhóm một màu riêng
  const soVong = vongMau.length;
  const tenVong = [];
  nodes.forEach((n) => { tenVong[n.vong] = n.nhom; });
  for (let i = 0; i < soVong; i++) {
    const bk = bkThat(0.26 + (i + 1) / (soVong + 1) * 0.70);
    const sang = noiBat ? (tenVong[i] === noiBat ? 0.3 : 0.04) : 0.11;
    cx.beginPath();
    cx.ellipse(CX, CY, R * bk, R * bk * det(), 0, 0, Math.PI * 2);
    cx.strokeStyle = rgba(vongMau[i], sang);
    cx.lineWidth = 1;
    cx.stroke();
  }

  const diem = new Map();
  nodes.forEach((nd) => diem.set(nd.note.id, viTri(nd)));

  // nan hoa từ lõi
  nodes.forEach((nd) => {
    const p = diem.get(nd.note.id);
    const nb = nd === hover || nd === chon;
    cx.beginPath();
    cx.moveTo(CX, CY);
    cx.lineTo(p.x, p.y);
    cx.strokeStyle = rgba(nd.mau, nb ? 0.5 : mo(nd) ? 0.03 : 0.1);
    cx.lineWidth = 1;
    cx.stroke();
  });

  // liên kết giữa các ghi chú
  DATA.links.forEach(([a, b]) => {
    const p = diem.get(a), q = diem.get(b);
    if (!p || !q) return;
    cx.beginPath();
    cx.moveTo(p.x, p.y);
    cx.lineTo(q.x, q.y);
    cx.strokeStyle = 'rgba(238,243,250,.17)';
    cx.lineWidth = 1;
    cx.stroke();
  });

  // lõi: Thái Cực – Tiên Thiên Bát Quái (đứng yên — Càn luôn ở trên mới đúng phương vị)
  const dich = hoverLoi ? banKinhLoiTo() : banKinhLoi();
  rkHienTai = itMotion ? dich : rkHienTai + (dich - rkHienTai) * 0.2;
  if (Math.abs(dich - rkHienTai) < 0.3) rkHienTai = dich;
  const RK = rkHienTai;
  const quang = cx.createRadialGradient(CX, CY, RK * 0.6, CX, CY, RK * 1.75);
  quang.addColorStop(0, 'rgba(240,127,45,.32)');
  quang.addColorStop(1, 'rgba(240,127,45,0)');
  cx.fillStyle = quang;
  cx.beginPath(); cx.arc(CX, CY, RK * 1.75, 0, Math.PI * 2); cx.fill();
  // (Thái Cực vẽ sau cùng — nằm trên mọi chấm và nhãn)

  // Cỡ chữ, độ dài tên và cỡ chấm theo SỐ GHI CHÚ ĐANG HIỆN: ít thì chữ to, tên dài, chấm to — dễ đọc;
  // nhiều thì nhỏ lại cho đỡ chồng. Đang xem một vùng thì chỉ đếm vùng đó. Toàn màn hình to thêm một bậc.
  const soHien = Math.max(1, nodes.filter((n) => !mo(n)).length);
  const lnN = Math.log(soHien);
  let coChu = Math.max(11, Math.min(17, 19.5 - 2 * lnN));
  if (tapTrung) coChu *= 1.12;
  if (W - lechDich < 520) coChu = Math.min(coChu, 13.5);          // điện thoại: chừa chỗ ngang cho tên
  const tranTen = Math.round(Math.max(26, Math.min(46, 54 - 6 * lnN)));
  const toCham = Math.max(1, Math.min(1.5, 2.2 - 0.3 * lnN));

  // các ghi chú — vẽ chấm trước, nhãn sau (node đang chọn được ưu tiên chỗ)
  nodes.forEach((nd) => {
    const p = diem.get(nd.note.id);
    const nb = nd === hover || nd === chon;
    const toi = mo(nd);
    cx.beginPath();
    cx.arc(p.x, p.y, (nb ? nd.r + 2.4 : nd.r) * toCham, 0, Math.PI * 2);
    cx.fillStyle = nd.mau;
    cx.globalAlpha = nb ? 1 : toi ? 0.2 : 0.85;
    cx.fill();
    if (nb) { cx.strokeStyle = TRUNG; cx.lineWidth = 1.2; cx.stroke(); }
    cx.globalAlpha = 1;
  });

  cx.font = `500 ${coChu.toFixed(1)}px "Be Vietnam Pro",sans-serif`;
  cx.textBaseline = 'middle';
  // ô chữ đã chiếm chỗ — bắt đầu bằng chính lõi Bát Quái, để không nhãn nào bị lõi che mất một nửa
  const daVe = [{ x0: CX - RK - 6, x1: CX + RK + 6, y0: CY - RK - 6, y1: CY + RK + 6 }];
  const uuTien = nodes.slice().sort((a, b) =>
    (b === hover || b === chon) - (a === hover || a === chon));
  uuTien.forEach((nd) => {
    const nb = nd === hover || nd === chon;
    const toi = mo(nd);
    if (!nb && toi) return;
    const p = diem.get(nd.note.id);
    const tran = nb ? 90 : tranTen;     // rê chuột / đang chọn: hiện đủ tên
    let t = nd.note.title.length > tran ? nd.note.title.slice(0, tran - 1) + '…' : nd.note.title;
    let w = cx.measureText(t).width;
    const phai = mepPhai() - 10;
    const cach = 6 + nd.r * toCham;     // khoảng cách chữ — chấm, theo cỡ chấm
    // đặt về phía còn chỗ: không tràn mép trái, không chui xuống dưới thẻ chi tiết
    let trai = p.x < CX;
    if (trai && p.x - cach - w < 8) trai = false;
    else if (!trai && p.x + cach + w > phai) trai = true;
    // màn hẹp (điện thoại): hai phía đều thiếu chỗ thì rút gọn nhãn cho vừa, không để chữ bị cắt ở mép
    const cho = trai ? p.x - cach - 8 : phai - p.x - cach;
    if (w > cho) {
      if (cho < 48 && !nb) return;
      while (t.length > 4 && cx.measureText(t).width > cho) t = t.slice(0, -2).trimEnd() + '…';
      w = cx.measureText(t).width;
    }
    const x0 = trai ? p.x - cach - w : p.x + cach;
    const nua = coChu * 0.72;     // nửa chiều cao ô chữ, theo cỡ chữ
    const o = { x0: x0 - 7, x1: x0 + w + 7, y0: p.y - nua, y1: p.y + nua };
    if (!nb && daVe.some((q) => o.x0 < q.x1 && o.x1 > q.x0 && o.y0 < q.y1 && o.y1 > q.y0)) return;
    daVe.push(o);
    cx.textAlign = 'left';
    // viền tối quanh chữ: chấm và nan hoa đang quay chạy ngang qua nhãn thì chữ vẫn đọc rõ
    cx.lineJoin = 'round';
    cx.lineWidth = 4;
    cx.strokeStyle = 'rgba(10,20,36,.85)';
    cx.strokeText(t, x0, p.y);
    cx.fillStyle = nb ? TRUNG : 'rgba(238,243,250,.62)';
    cx.fillText(t, x0, p.y);
  });

  // đứng yên: dùng hình vẽ đúng cỡ (nét sắc); đang co/giãn: thu phóng hình cỡ lớn cho mượt
  const dungYen = RK === banKinhLoi() || RK === banKinhLoiTo();
  const hinh = hinhThaiCuc(dungYen ? RK : banKinhLoiTo());
  const s = (RK * 2 + 4) / ((dungYen ? RK : banKinhLoiTo()) * 2 + 4);
  const w = hinh.width / DV * s;
  cx.drawImage(hinh, CX - w / 2, CY - w / 2, w, w);
  if (hoverLoi && RK > banKinhLoiTo() - 1) veTenQue(RK);
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
const MAU_DUONG = '#E6C46A', MAU_AM = '#2563C4', NAVY_LOI = '#0C2147', NAVY_VANH = '#0F2B5B';
let hoverLoi = false;

/* Lõi nhỏ gọn cỡ chữ BRAIN cũ khi nhìn tổng thể; rê chuột vào thì phóng to mượt để xem rõ quẻ. */
const banKinhLoi = () => 30;                                          // lúc nghỉ: Ø 60px
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

/* Rê chuột vào lõi: hiện tên tám quẻ và phương vị quanh vành. */
function veTenQue(R) {
  cx.font = '600 11.5px "Be Vietnam Pro",sans-serif';
  cx.textBaseline = 'middle';
  BAT_QUAI.forEach(([ten, , goc, huong]) => {
    const a = goc * Math.PI / 180, rr = R + 15;
    const x = CX + Math.cos(a) * rr, y = CY + Math.sin(a) * rr;
    cx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right';
    cx.fillStyle = 'rgba(10,20,36,.78)';
    const t = `${ten} · ${huong}`, w = cx.measureText(t).width;
    const x0 = cx.textAlign === 'center' ? x - w / 2 : cx.textAlign === 'left' ? x : x - w;
    cx.fillRect(x0 - 5, y - 9, w + 10, 18);
    cx.fillStyle = MAU_DUONG;
    cx.fillText(t, x, y);
  });
  cx.textAlign = 'center';
  cx.fillStyle = 'rgba(238,243,250,.75)';
  cx.font = '500 11px "Be Vietnam Pro",sans-serif';
  cx.fillText('Thái Cực · Tiên Thiên Bát Quái', CX, CY + R + 42);
}

let tCu = 0;
function vong(t) {
  // tính theo thời gian thật, không theo số khung hình: màn 120Hz không xoay nhanh gấp đôi màn 60Hz;
  // chặn 100ms để quay lại tab đang ẩn thì không nhảy vọt
  const dt = tCu && t ? Math.min(100, t - tCu) : 16.7;
  tCu = t || 0;
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
  hoverLoi = Math.hypot(mx - CX, my - CY) < (hoverLoi ? rkHienTai + 6 : banKinhLoi() + 4);
  hover = hoverLoi ? null : timGan(mx, my);
  cv.style.cursor = hover ? 'pointer' : hoverLoi ? 'help' : 'default';
});
cv.addEventListener('mouseleave', () => { hover = null; hoverLoi = false; });
cv.addEventListener('click', (e) => {
  const b = cv.getBoundingClientRect();
  const nd = timGan(e.clientX - b.left, e.clientY - b.top);
  if (nd) moChiTiet(nd.note.id);
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
function datTapTrung(bat) {
  if (bat === tapTrung) return;
  tapTrung = bat;
  document.body.classList.toggle('tap-trung', bat);
  if (bat) {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { /* không cho thì dùng chế độ phủ cửa sổ */ });
    }
    const g = $('#goiYThoat');
    g.textContent = matchMedia('(pointer:coarse)').matches ? 'Chạm đúp để thoát' : 'Nhấp đúp hoặc Esc để thoát';
    g.hidden = false;
    clearTimeout(henGoiY);
    henGoiY = setTimeout(() => { g.hidden = true; }, 2500);
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
  if (dup && !timGan(x, y)) datTapTrung(!tapTrung);   // nhấp đúp lên một chấm là mở ghi chú, không phóng to
});
// thoát toàn màn hình bằng phím của trình duyệt (Esc, F11) thì cũng thoát chế độ này
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && tapTrung) datTapTrung(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tapTrung && $('#chiTiet').hidden) datTapTrung(false); });

/* ---------------- thẻ chi tiết ---------------- */
function ngayDep(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function moChiTiet(id) {
  const r = await api('/api/note?id=' + encodeURIComponent(id));
  if (!r.ok) return;
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
      n.done_at ? ` · đã xong ${ngayTu(n.done_at)}` : quaHan ? ' · quá hạn' : ' · đang mở'));
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
      b.addEventListener('click', () => moChiTiet(x.id));
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

$('#ctCat').addEventListener('click', async (e) => {
  const r = await api('/api/archive', { id: e.target.dataset.id });
  if (!r.ok) return alert(r.error || 'Không cất được');
  dongChiTiet();
  await nap();
  if (!$('[data-pane="on"]').hidden) napHangOn();
});

$('#ctLay').addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  const r = await api('/api/archive', { id, lay_lai: true });
  if (!r.ok) return alert(r.error || 'Không lấy lại được');
  await nap();
  await moChiTiet(id);
  if (!$('[data-pane="on"]').hidden) napHangOn();
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
// Mở lại đúng tab lần trước. Lần đầu trên điện thoại/máy tính bảng: mở tab Tìm (gọn) thay vì form Thêm dài
// cả màn hình — ghi chú trên điện thoại thường nhắn qua Telegram, còn trang web dùng để tra và xem.
{
  let t = null;
  try { t = localStorage.getItem('sb.tab'); } catch (_) { /* bỏ qua */ }
  if (!t || !document.querySelector(`.tabs [data-tab="${t}"]`)) t = matchMedia('(max-width:900px)').matches ? 'tim' : null;
  if (t && t !== 'them') moTab(t, false);
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
  const ds = DATA.notes.filter((n) => !(n.category || '').trim() || !(n.tags || []).length);
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
    b.addEventListener('click', () => moChiTiet(n.id));
    khung.appendChild(b);
  });
  box.appendChild(khung);
}

/* Kho lưu: nơi ghi chú hết thời nằm lại, không bị xoá. */
let moKhoLuu = false;

async function veKhoLuu() {
  const box = $('#khoLuu');
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
  if (!r.ok) return;
  r.notes.forEach((x) => {
    const b = document.createElement('button');
    b.className = 'hit';
    b.type = 'button';
    const t = document.createElement('b'); t.textContent = x.title;
    const s = document.createElement('span');
    s.textContent = `${duongDep(x.category)} · cất ${ngayTu(x.updated_at) || ''}`;
    b.append(t, s);
    b.addEventListener('click', () => moChiTiet(x.id));
    box.appendChild(b);
  });
}

async function napHangOn() {
  veHopCho();
  veKhoLuu();
  const box = $('#hangOn');
  box.textContent = 'Đang lấy…';
  const r = await api('/api/review?limit=5');
  box.innerHTML = '';
  if (!r.ok || !r.notes.length) {
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
    mo.addEventListener('click', () => moChiTiet(n.id));
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
    b.addEventListener('click', () => moChiTiet(s.id));
    box.appendChild(b);
  });
  box.hidden = false;
}

let hen;
function timNgay() {
  clearTimeout(hen);
  const q = $('#oTim').value.trim();
  hen = setTimeout(async () => {
    const box = $('#ketQua');
    if (!q) { box.innerHTML = ''; return; }
    const r = await api('/api/search?' + new URLSearchParams({ q, kind: $('#timLoai').value, category: $('#timNhom').value }));
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
      b.addEventListener('click', () => moChiTiet(n.id));
      box.appendChild(b);
    });
    if (r.che_do === 'mo_rong') box.prepend(el('p', 'none', 'Không ghi chú nào có đủ mọi từ — đây là các ghi chú khớp nhiều từ nhất.'));
    else if (r.che_do === 'khong_dau') box.prepend(el('p', 'none', 'Không có kết quả đúng dấu — đây là các ghi chú khớp khi bỏ dấu.'));
  }, 220);
}
$('#oTim').addEventListener('input', timNgay);
$('#timLoai').addEventListener('change', timNgay);
$('#timNhom').addEventListener('change', timNgay);

$('#nutHoi').addEventListener('click', async () => {
  const q = $('#oHoi').value.trim();
  const out = $('#traLoi');
  if (!q) { out.textContent = 'Chưa nhập câu hỏi.'; return; }
  $('#nutHoi').disabled = true;
  out.textContent = 'Mây đang đọc ghi chú…';
  const r = await api('/api/ask', { question: q });
  $('#nutHoi').disabled = false;
  out.textContent = '';
  if (!r.ok) { out.textContent = r.error || 'Không hỏi được'; return; }
  out.appendChild(document.createTextNode(r.answer || r.note || ''));
  if (r.used?.length) {
    const d = document.createElement('div');
    d.className = 'src';
    d.appendChild(document.createTextNode('Dựa trên:'));
    r.used.forEach((u) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = u.title;
      b.addEventListener('click', () => moChiTiet(u.id));
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
  tatCa.addEventListener('click', () => { LOC.category = ''; LOC.offset = 0; veCay(); napThuVien(); });
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
      LOC.category = duong; LOC.offset = 0;
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
  $('#kTieuDe').textContent = (c === '__chua__' ? 'Chưa xếp chỗ' : c ? c.split('/').pop() : 'Tất cả ghi chú') + ` · ${r.tong}`;
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

  if (!r.notes.length && !themNua) {
    ds.appendChild(el('p', 'none', 'Không có ghi chú nào ở đây.'));
  }
  r.notes.forEach((n) => ds.appendChild(theGhiChu(n)));
  LOC.offset = r.offset + r.notes.length;
  const them = $('#kThem');
  them.hidden = LOC.offset >= r.tong;
  them.textContent = `Xem thêm (${r.tong - LOC.offset} ghi chú)`;
}

function theGhiChu(n) {
  const b = el('button', 'the-gc');
  b.type = 'button';
  b.style.setProperty('--m', LOAI[n.kind]?.mau || '#D4AF37');
  const dau = el('div', 'dau');
  dau.append(el('span', 'nhan', tenLoai(n.kind)), el('span', 'duong-nho', duongDep(n.category)));
  const meta = [];
  if (n.kind === 'viec') meta.push(n.done_at ? 'đã xong' : n.due ? `hạn ${ngayDep(n.due)}` : 'chưa đặt hạn');
  meta.push(`sửa ${ngayTu(n.updated_at) || ''}`);
  if (n.url) meta.push('có nguồn');
  if (n.cite) meta.push('có trích dẫn');
  b.append(dau, el('h3', null, n.title), el('p', null, n.preview || ''),
    el('div', 'chan', meta.join(' · ') + ((n.tags || []).length ? '  ' + n.tags.map((t) => '#' + t).join(' ') : '')));
  b.addEventListener('click', () => moChiTiet(n.id));
  return b;
}

$('#kSap').addEventListener('change', (e) => { LOC.sort = e.target.value; napThuVien(); });
$('#kThem').addEventListener('click', () => napThuVien(true));

/* ---------------- Việc ---------------- */
const NHOM_VIEC = [['qua_han', 'Quá hạn'], ['hom_nay', 'Hôm nay'], ['7_ngay_toi', '7 ngày tới'],
  ['sau_nay', 'Sau này'], ['khong_han', 'Không đặt hạn'], ['da_xong', 'Đã xong']];
async function napViec() {
  const r = await api('/api/tasks' + ($('#vXong').checked ? '?tat_ca=1' : ''));
  const box = $('#vDs');
  box.innerHTML = '';
  if (!r.ok) { box.appendChild(el('p', 'none', r.error || 'Không nạp được')); return; }
  let co = false;
  NHOM_VIEC.forEach(([k, ten]) => {
    const ds = r[k] || [];
    if (!ds.length) return;
    co = true;
    const khoi = el('section', 'khoi-viec ' + k);
    khoi.appendChild(el('h3', null, `${ten} · ${ds.length}`));
    ds.forEach((v) => {
      const dong = el('div', 'dong-viec');
      const o = el('input');
      o.type = 'checkbox';
      o.checked = k === 'da_xong';
      o.setAttribute('aria-label', 'Đánh dấu xong: ' + v.title);
      o.addEventListener('change', async () => {
        o.disabled = true;
        await api('/api/task', { id: v.id, xong: o.checked });
        await nap();
      });
      const t = el('button', 'ten-viec');
      t.type = 'button';
      t.append(el('b', null, v.title), el('span', null, [v.due ? 'hạn ' + ngayDep(v.due) : '', duongDep(v.category), v.tom_tat].filter(Boolean).join(' · ')));
      t.addEventListener('click', () => moChiTiet(v.id));
      dong.append(o, t);
      khoi.appendChild(dong);
    });
    box.appendChild(khoi);
  });
  if (!co) box.appendChild(el('p', 'none', 'Không có việc nào đang mở.'));
}
$('#vXong').addEventListener('change', napViec);

/* ---------------- Nạp: dán văn bản / chọn file .md .txt ---------------- */
let tepChon = [];
async function docTep(files) {
  const ok = [...files].filter((f) => /\.(md|markdown|txt)$/i.test(f.name) && f.size < 2 * 1024 * 1024);
  tepChon = await Promise.all(ok.map(async (f) => ({ name: f.name, text: await f.text() })));
  const bo = files.length - ok.length;
  $('#dsTep').textContent = tepChon.length
    ? `${tepChon.length} file: ${tepChon.map((t) => t.name).join(', ').slice(0, 160)}` + (bo ? ` · bỏ ${bo} file không phải .md/.txt hoặc quá 2 MB` : '')
    : (bo ? `Bỏ ${bo} file — chỉ nhận .md / .txt dưới 2 MB` : '');
}
$('#chonTep').addEventListener('change', (e) => docTep(e.target.files));
const vung = $('#vungTha');
['dragenter', 'dragover'].forEach((ev) => vung.addEventListener(ev, (e) => { e.preventDefault(); vung.classList.add('keo'); }));
['dragleave', 'drop'].forEach((ev) => vung.addEventListener(ev, () => vung.classList.remove('keo')));
vung.addEventListener('drop', (e) => { e.preventDefault(); docTep(e.dataTransfer.files); });

async function napVao(thu) {
  const out = $('#napKq');
  const chu = $('#napChu').value.trim();
  if (!tepChon.length && !chu) { out.textContent = 'Chưa có file hay nội dung để nạp.'; return; }
  out.textContent = thu ? 'Đang xem trước…' : 'Đang nạp…';
  const r = await api('/api/ingest', {
    files: tepChon, text: chu, category: $('#napNhom').value.trim(), kind: $('#napLoai').value,
    tags: $('#napThe').value.trim(), tach: $('#napTach').value, dry_run: thu,
  });
  out.innerHTML = '';
  if (!r.ok) { out.appendChild(el('p', 'say er', r.error || 'Không nạp được')); return; }
  const so = thu ? r.se_them : r.da_them;
  out.appendChild(el('p', 'say ok', (thu ? `Sẽ thêm ${so} ghi chú` : `Đã thêm ${so} ghi chú`) +
    (r.bo_qua_trung ? ` · bỏ ${r.bo_qua_trung} bản trùng` : '') + (r.bo_qua_rong ? ` · bỏ ${r.bo_qua_rong} mục rỗng` : '')));
  if (r.nhom_moi?.length) out.appendChild(el('p', 'hint', 'Nhóm mới: ' + r.nhom_moi.map(duongDep).join(', ')));
  const ds = el('div', 'list');
  (r.ghi_chu || []).forEach((g) => {
    const b = el('button', 'hit');
    b.type = 'button';
    b.append(el('b', null, g.title), el('span', null, `${tenLoai(g.kind)} · ${duongDep(g.category)}`));
    if (g.id) b.addEventListener('click', () => moChiTiet(g.id)); else b.disabled = true;
    ds.appendChild(b);
  });
  out.appendChild(ds);
  if (!thu && so) {
    tepChon = []; $('#chonTep').value = ''; $('#dsTep').textContent = ''; $('#napChu').value = '';
    await nap();
  }
}
$('#napThu').addEventListener('click', () => napVao(true));
$('#napThat').addEventListener('click', () => napVao(false));

/* ---------------- chạy ---------------- */
window.addEventListener('resize', coLai);
coLai();
nap().then(hienTheoLoai);
requestAnimationFrame(vong);
