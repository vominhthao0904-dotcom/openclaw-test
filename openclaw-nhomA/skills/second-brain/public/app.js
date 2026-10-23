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
    ds.forEach((note, i) => {
      nodes.push({
        note, nhom: k, vong: vi, mau,
        bk, pha: lech + (i / ds.length) * Math.PI * 2,
        toc,
        r: 3.4 + Math.min(3.2, (note.tags?.length || 0) * 0.7),
      });
    });
  });
  nodes.forEach((n, i) => { n.chiSo = i; });   // thứ tự trên mặt A.I: các vùng nằm liền mạch theo đường nét
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

  // vòng quỹ đạo — mỗi nhóm một màu riêng (tắt dần khi hai quả cầu Âm Dương tách ra)
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
  quang.addColorStop(0, `rgba(240,127,45,${(0.3 + 0.07 * tho).toFixed(3)})`);
  quang.addColorStop(1, 'rgba(240,127,45,0)');
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
  const toCham = Math.max(1, Math.min(1.5, 2.2 - 0.3 * lnN));

  // các ghi chú — vẽ chấm trước, nhãn sau (node đang chọn được ưu tiên chỗ)
  nodes.forEach((nd) => {
    const p = diem.get(nd.note.id);
    const nb = nd === hover || nd === chon;
    const toi = mo(nd);
    if (eMat > 0.05) {                   // mặt A.I: nơ-ron phát sáng
      const rr = (nb ? nd.r + 2.4 : nd.r) * toCham * 3.2;
      cx.globalAlpha = eMat * (toi ? 0.15 : 0.75);
      cx.drawImage(quangCham(nd.mau), p.x - rr, p.y - rr, rr * 2, rr * 2);
    }
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
  const daVe = [{ x0: LX - RK - 6, x1: LX + RK + 6, y0: LY - RK - 6, y1: LY + RK + 6 }];
  const uuTien = nodes.slice().sort((a, b) =>
    (b === hover || b === chon) - (a === hover || a === chon));
  uuTien.forEach((nd) => {
    const nb = nd === hover || nd === chon;
    const toi = mo(nd);
    // chế độ "chỉ chấm" và mặt A.I: rê chuột mới hiện tên
    if (!nb && (toi || (tapTrung && !hienTen) || kMat > 0.12)) return;
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
  cx.drawImage(hinh, LX - w / 2, LY - w / 2, w, w);
  if (!itMotion) veKhi(RK);
  if (hoverLoi && RK > banKinhLoiTo() - 1) veTenQue(RK);
}

/* ---------------- Chế độ MẶT A.I — nút ẩn: bấm lõi Bát Quái (hoặc phím M) ----------------
   Chuyển cảnh: Thái Cực tách ra hai quả cầu Dương (vàng) và Âm (xanh tím) xoay quanh nhau, nối bằng hàng chục sợi năng lượng
   đan xen; các sợi gỡ dần thành đường vân của một cái đầu A.I trong suốt, hai quả cầu bay vào làm hai mắt, lõi Bát Quái xuống
   ngực. Thoát thì chạy ngược lại. Đầu vẽ bằng các đường đồng mức độ sâu (như bản đồ địa hình) của một mô hình 3D — ôm theo trán,
   hốc mắt, sống mũi, gò má, môi, cằm; cổ và vai cũng vậy. Trong hộp sọ là bộ não phát sáng: mỗi ghi chú là một nơ-ron mang màu
   vùng, mỗi vùng là một vòng tròn quanh đầu nối mạng vào não. Đầu quay nhìn theo con trỏ, chớp mắt, nhép miệng khi "Mây nói".
   Toạ độ mô hình: đơn vị = bán kính đầu, gốc ở tâm đầu, x sang phải, y xuống dưới, z hướng về người xem. */
let matDich = 0, kMat = 0, eMat = 0;     // đích (0/1), tiến độ chuyển cảnh, tiến độ đã làm mượt
let anQD = 1;                            // độ hiện của vòng quỹ đạo + nan hoa (tắt sớm khi hai quả cầu tách ra)
let LX = 0, LY = 0;                      // vị trí lõi Bát Quái: giữa đồ thị, hoặc trên ngực khi là mặt A.I
let dtKhung = 16.7, chuot = null, loiNoi = null;
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
  if (s <= 0) return s;
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
const RONG_THAN = [[1.1, 0.26], [1.45, 0.27], [1.57, 0.3], [1.64, 0.48], [1.72, 0.78], [1.82, 1.1], [1.92, 1.38], [2.02, 1.6],
  [2.14, 1.76], [2.27, 1.84], [2.47, 1.85], [2.72, 1.8], [2.97, 1.75]];
const NHO_THAN = [[1.1, 0.26], [1.57, 0.28], [1.67, 0.34], [1.87, 0.42], [2.12, 0.5], [2.42, 0.56], [2.97, 0.56]];
function doSauThan(x, y) {               // độ nhô của cổ, vai, ngực: thân tròn + xương quai xanh + cơ ngực + cơ vai
  const W = noiSuy(RONG_THAN, y), s = 1 - (x / W) ** 2;
  if (s <= 0) return s * 0.3;            // âm ngoài thân: đường đồng mức thấp nhất là viền thân
  const ax = Math.abs(x), r = Math.sqrt(s);
  return (noiSuy(NHO_THAN, y) + 0.12 * g2(ax, y, 1.66, 2.22, 0.22, 0.28)) * r
    + 0.04 * Math.exp(-(((y - 1.72 - 0.08 * ax) / 0.06) ** 2)) * em(0.1, 0.25, ax) * (1 - em(1.0, 1.25, ax))
    + 0.035 * g2(ax, y, 0.5, 2.34, 0.45, 0.3) - 0.015 * g2(x, y, 0, 2.3, 0.08, 0.3);
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

/* Dựng mô hình một lần (lần đầu bật mặt A.I): ~70 đường vân, não, mắt, hạt sáng của các sợi năng lượng. */
let MH = null;
function dungMoHinh() {
  let h = 20261024;
  const ngau = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
  const MAU_SOI = [[120, 220, 255], [215, 232, 255], [176, 140, 255]];
  const cha = [], manh = [];
  // Mỗi đường vân là một sợi năng lượng lúc chuyển cảnh: tham số sợi riêng; bd = lúc bắt đầu gỡ thành đường vân.
  const themDuong = (d, f, bd, sang, laDau, mi) => {
    const { d: ds } = chiaDeu(d, 0.03);
    const c = cha.length;
    cha.push({ bd, a1: 0.05 + 0.2 * ngau(), f1: 0.5 + 1.1 * ngau(), w1: 1.2 + 2 * ngau(), p1: ngau() * 6.28,
      a2: 0.03 + 0.1 * ngau(), f2: 1 + 1.5 * ngau(), w2: 1 + 2 * ngau(), p2: ngau() * 6.28, mau: MAU_SOI[c % 3] });
    // tách theo lớp sáng: phần hộp sọ (có não bên trong) mờ hơn để thấy não; còn lại theo độ nhô
    let ht = null, lop = -1;
    ds.forEach(([x, y, s]) => {
      const z = laDau ? Math.max(0, doSau(x, y)) : Math.max(0, doSauThan(x, y));
      const l = laDau ? Math.round(3 * em(-0.6, -0.1, y)) : 3;
      if (l !== lop) {
        if (ht) ht.pts.push([x, y, z, s]);
        ht = { cha: c, laDau, f, mi, pts: [], sang: sang * (0.45 + 0.55 * l / 3) };
        manh.push(ht);
        lop = l;
      }
      ht.pts.push([x, y, z, s]);
    });
  };
  // đầu: 16 mức cách đều theo bề ngang ở đường giữa (vân đều, thưa vừa từ viền vào), rồi cách đều theo độ nhô ở mặt trước
  // (trán, sống mũi, môi, cằm đều có vân — không để mảng trống)
  const mucDau = [];
  for (let k = 0; k < 16; k++) { const q = 1 - k / 20; mucDau.push(Math.max(0.004, 0.88 * (1 - q * q) ** 0.55)); }
  for (let z = 0.874; z < 1.1; z += 0.02) mucDau.push(z);
  let vien = null;
  dongMuc(doSau, -1.02, -1.34, 103, 127, 0.02, mucDau).forEach(({ d, chiSo }) => {
    if (d.length < 5) return;
    if (chiSo === 0 && (!vien || d.length > vien.length)) vien = d;
    themDuong(d, 1, 0.44 + 0.3 * chiSo / mucDau.length, 0.26 + 0.46 * Math.min(1, mucDau[chiSo] / 1.1), true);
  });
  // tai: vành ngoài + vành trong, mỗi bên
  [[[0.86, -0.14], [0.97, -0.12], [1.04, 0.0], [1.05, 0.16], [1.0, 0.3], [0.93, 0.4], [0.85, 0.42]],
    [[0.88, -0.04], [0.96, -0.02], [0.99, 0.1], [0.96, 0.24], [0.9, 0.3]]].forEach((d, i) => {
    for (const b of [-1, 1]) themDuong(d.map(([x, y]) => [b * x, y]), 1, 0.5 + 0.05 * i, 0.4 - 0.08 * i, true);
  });
  // nét mặt người: lông mày (hai nét), mí trên + mí dưới (chớp theo mắt), khe miệng
  const cung = (n, ham) => Array.from({ length: n }, (_, i) => ham(i / (n - 1)));
  for (const b of [-1, 1]) {
    for (const l of [0, 0.02]) {
      themDuong(cung(16, (t) => [b * (0.13 + 0.42 * t), -0.15 + l - 0.055 * Math.sin(Math.PI * t ** 0.75) + 0.02 * t]), 1, 0.7, 0.5, true);
    }
    themDuong(cung(14, (t) => [b * (0.2 + 0.28 * t), 0.012 - 0.06 * Math.sin(Math.PI * t) * (1 - 0.25 * t)]), 1, 0.72, 0.62, true, true);
    themDuong(cung(14, (t) => [b * (0.2 + 0.28 * t), 0.012 + 0.032 * Math.sin(Math.PI * t)]), 1, 0.72, 0.5, true, true);
  }
  themDuong(cung(17, (t) => { const x = -0.21 + 0.42 * t; return [x, 0.725 + 0.012 * (x / 0.21) ** 2]; }), 1, 0.74, 0.6, true);
  // cổ + vai + ngực: đường đồng mức như mặt — ôm theo cơ vai tròn, xương quai xanh, ngực; thân đứng yên, cổ xoay theo đầu một phần
  const mucThan = [];
  for (let z = 0.03; z < 0.66; z += 0.04) mucThan.push(z);
  dongMuc(doSauThan, -2.0, 1.1, 161, 76, 0.025, mucThan).forEach(({ d, chiSo }) => {
    if (d.length < 5) return;
    themDuong(d, null, 0.5 + 0.28 * chiSo / mucThan.length, 0.2 + 0.2 * chiSo / mucThan.length, false);
  });
  for (const b of [-1, 1]) {               // viền vai mềm: từ cổ xuống cánh tay
    themDuong(cung(44, (t) => { const y = 1.12 + 1.85 * t; return [b * noiSuy(RONG_THAN, y), y]; }), null, 0.5, 0.42, false);
  }
  manh.forEach((m) => {
    const n = m.pts.length;
    m.d = new Float32Array(n * 5);
    m.pts.forEach(([x, y, z, s], i) => {
      m.d.set([x, y, z, s, m.f ?? 0.85 * (1 - em(1.05, 1.5, y))], i * 5);
    });
    m.b = new Float32Array(n * 2);
    delete m.pts;
  });
  // não: hai bán cầu, mỗi bên một viền lượn sóng + các nếp cuộn (đi ngẫu nhiên, đổi hướng mượt, chạm mép thì quay vào)
  const nao = [], zNao = {};
  for (const b of [-1, 1]) {
    const tx = b * 0.35, ty = -0.68, rx = 0.33, ry = 0.4;
    zNao[b] = (x, y) => 0.12 + 0.48 * Math.sqrt(Math.max(0, 1 - ((x - tx) / rx) ** 2 - ((y - ty) / ry) ** 2));
    const v = [];
    for (let i = 0; i <= 72; i++) {
      const a = i / 72 * Math.PI * 2, w = 0.97 + 0.035 * Math.sin(a * 9 + b);
      v.push([tx + rx * w * Math.cos(a), ty + ry * w * Math.sin(a)]);
    }
    nao.push(v);
    // nếp cuộn não: đường đồng mức 0 của tổng vài sóng phẳng ngẫu nhiên — ra hoa văn mê cung như vỏ não; chỉ lấy trong bán cầu
    const song = Array.from({ length: 6 }, () => { const a = ngau() * Math.PI; return [Math.cos(a) * 44, Math.sin(a) * 44, ngau() * 6.28]; });
    const truong = (x, y) => (((x - tx) / rx) ** 2 + ((y - ty) / ry) ** 2 > 0.86 ? 1
      : song.reduce((s, [kx, ky, ph]) => s + Math.sin(kx * x + ky * y + ph), 0));
    dongMuc(truong, tx - rx, ty - ry, Math.ceil(2 * rx / 0.012) + 1, Math.ceil(2 * ry / 0.012) + 1, 0.012, [0])
      .forEach(({ d }) => { if (d.length > 8) nao.push(chiaDeu(d, 0.018).d); });
  }
  // gom nếp não theo 6 dải ngang — mỗi dải sáng lên theo một nhịp (sóng sáng chạy qua não), vẽ một lần mỗi dải
  const naoMH = Array.from({ length: 6 }, () => ({ ds: [], tx: 0 }));
  nao.forEach((d) => {
    const a = new Float32Array(d.length * 3);
    d.forEach(([x, y], i) => a.set([x, y, zNao[x < 0 ? -1 : 1](x, y)], i * 3));
    const tx = d.reduce((s, q) => s + q[0], 0) / d.length, g = naoMH[Math.min(5, Math.floor((tx + 0.7) / 1.4 * 6))];
    g.ds.push({ d: a, b: new Float32Array(d.length * 2) });
    g.tx = -0.7 + (naoMH.indexOf(g) + 0.5) * 1.4 / 6;
  });
  const hat = Array.from({ length: 90 }, () => ({ cha: Math.floor(ngau() * cha.length), s0: ngau(), v: (ngau() - 0.5) * 0.5, r: 0.6 + ngau() * 1.2 }));
  const vienD = new Float32Array(vien.length * 3);
  vien.forEach(([x, y], i) => vienD.set([x, y, 0], i * 3));
  return { cha, manh, nao: naoMH, hat, vien: vienD, vienB: new Float32Array(vien.length * 2),
    mat: [-1, 1].map((b) => [b * 0.34, 0.0, doSau(b * 0.34, 0) + 0.05]), vungXY: [] };
}

// Mỗi ghi chú một chỗ cố định trong não: vùng nào nằm ở thuỳ hướng về vòng tròn của vùng đó (trái → phải như các vòng).
const bam = (s, hat) => {
  let x = 2166136261 ^ hat;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return ((x >>> 0) % 100003) / 100003;
};
function viTriNao(nd) {
  const n = Math.max(1, vongMau.length), id = String(nd.note.id);
  const nh = (Math.PI + 1.1) / n;
  const th = -Math.PI - 0.55 + (nd.vong + 0.12 + 0.76 * bam(id, 1)) * nh;
  const rho = 0.28 + 0.66 * Math.sqrt(bam(id, 2));
  let x = 0.68 * rho * Math.cos(th);
  const y = -0.68 + 0.4 * rho * Math.sin(th);
  if (Math.abs(x) < 0.05) x = x < 0 ? -0.05 : 0.05;       // tránh rãnh giữa hai bán cầu
  const z = 0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (0.6 + 0.4 * bam(id, 3));
  return [x, y, z];
}

function capNhatMat(tg) {
  // vào ~2,6 giây (đủ thấy hai luồng âm dương), ra ~1,5 giây
  const buoc = itMotion ? 1 : dtKhung / 1000 / (matDich ? 2.6 : 1.5);
  kMat = matDich ? Math.min(1, kMat + buoc) : Math.max(0, kMat - buoc);
  eMat = em(0, 1, kMat);
  anQD = 1 - em(0, 0.3, kMat);
  // bố cục: vòng tròn các vùng trên đỉnh đầu (≈ −2 đơn vị) tới lò phản ứng trên ngực, nằm gọn giữa thanh chuyển và phụ đề
  const rong = W - lechDich, hep = rong < 600;
  const tren = 50, duoi = H - (tapTrung ? 18 : 60);      // trên chừa chỗ cho thanh chuyển / thông báo toàn màn hình
  MAT.u = Math.max(30, Math.min((duoi - tren - 60) / 4.14, hep ? rong / 2.35 : (rong / 2 - 70) / 2.2));
  MAT.oy = tren + 24 + 2.0 * MAT.u + Math.max(0, duoi - tren - 60 - 4.14 * MAT.u) / 2;
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
  // phụ đề chạy chữ, tắt sau khi nói xong 1,8 giây
  const pd = $('#loiMay');
  if (loiNoi && t - loiNoi.t0 < loiNoi.dai + 1.8 && eMat > 0.5) {
    const dai = loiNoi.chu.length;
    const n = itMotion || loiNoi.xong ? dai
      : loiNoi.tieng ? Math.min(dai, Math.max(loiNoi.chiSo || 0, Math.ceil((t - loiNoi.t0) * 8)))   // theo chữ đang đọc
        : Math.ceil(dai * keo((t - loiNoi.t0) / (loiNoi.dai * 0.9), 0, 1));
    if (pd.dataset.n !== String(n)) { pd.textContent = loiNoi.chu.slice(0, n); pd.dataset.n = String(n); }
    pd.style.left = `${CX}px`;                              // canh giữa theo khuôn mặt (thẻ chi tiết mở thì mặt dịch trái)
    pd.style.maxWidth = `${Math.round(rong * 0.9)}px`;
    pd.hidden = false;
  } else if (!pd.hidden) { pd.hidden = true; pd.dataset.n = ''; }
  // nút loa luôn nằm trong phần còn nhìn thấy (thẻ chi tiết mở thì dịch sang trái theo)
  if (matDich) $('#batTieng').style.right = `${16 + Math.round(lechDich)}px`;
  // lõi Bát Quái: giữa đồ thị ↔ lò phản ứng trên ngực
  const lo = chieuDiem(0, LO_NGUC, doSauThan(0, LO_NGUC), 0), e = em(0.45, 0.95, kMat);
  LX = CX + (lo.x - CX) * e;
  LY = CY + (lo.y - CY) * e;
}

/* Tiếng nói. Mặc định CHỈ dùng giọng tiếng Việt cài sẵn trong máy (Windows "Microsoft An", Android Google, iPhone "Linh") —
   không gửi gì ra ngoài. Máy không có giọng trong máy mà trình duyệt có giọng tiếng Việt qua mạng (Edge: HoaiMy, NamMinh)
   thì chỉ dùng khi anh đồng ý rõ ràng (hộp hỏi khi bấm nút loa): chữ Mây đọc sẽ gửi lên máy chủ của hãng đó; tắt tiếng là
   bỏ quyền này. Chrome trên Windows không thấy giọng của Windows (chỉ có giọng tiếng Anh) — nút loa chỉ cách mở bằng Edge.
   Không đọc được thì nút loa chuyển vàng, rê/bấm vào là thấy lý do và cách sửa; Mây vẫn hiện phụ đề. */
const coDocNoi = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const chromeWin = /Windows/.test(navigator.userAgent) && /Chrome\//.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
let coTieng = true, choMang = false, giongViet = null, giongMang = null, daBaoThieuGiong = false, cauDangDoc = null;
try {
  if (localStorage.getItem('sb.tieng') === '0') coTieng = false;
  choMang = localStorage.getItem('sb.giongMang') === '1';
} catch (_) { /* mặc định có tiếng, chỉ giọng trong máy */ }
const giongVN = (ds) => ds.find((v) => /^vi[-_]VN$/i.test(v.lang)) || ds[0] || null;
function chonGiong() {
  if (!coDocNoi) return;
  const ds = speechSynthesis.getVoices().filter((v) => /^vi([-_]|$)/i.test(v.lang));
  giongViet = giongVN(ds.filter((v) => v.localService));
  giongMang = giongVN(ds.filter((v) => !v.localService));
  capNhatLoa();
}
const giongDung = () => giongViet || (choMang ? giongMang : null);
function lyDoThieuGiong() {
  if (!coDocNoi) return 'Trình duyệt này không đọc thành tiếng được — Mây chỉ hiện phụ đề.';
  if (giongMang) return 'Máy chưa cài giọng tiếng Việt — bấm nút loa để chọn cách nghe.';
  if (chromeWin) return 'Chrome trên Windows không dùng được giọng tiếng Việt của máy — mở trang này bằng Microsoft Edge để nghe Mây nói.';
  return 'Máy chưa có giọng đọc tiếng Việt — Mây chỉ hiện phụ đề (cách thêm giọng: xem Hướng dẫn).';
}
function capNhatLoa() {
  const b = $('#batTieng'), g = giongDung(), thieu = coTieng && !g;
  b.setAttribute('aria-pressed', String(coTieng));
  b.classList.toggle('thieu-giong', thieu);
  b.title = !coTieng ? 'Đang tắt tiếng — bấm để bật'
    : thieu ? `Chưa nghe được: ${lyDoThieuGiong()}`
      : `Đang có tiếng — ${g.name}${g.localService ? '' : ' (giọng qua mạng)'} — bấm để tắt`;
}
function datTieng(bat) {
  coTieng = bat;
  if (!bat) choMang = false;               // tắt tiếng là bỏ quyền dùng giọng qua mạng — bật lại sẽ hỏi lại
  try {
    localStorage.setItem('sb.tieng', bat ? '1' : '0');
    localStorage.setItem('sb.giongMang', choMang ? '1' : '0');
  } catch (_) { /* không lưu được thì thôi */ }
  if (!bat && coDocNoi) speechSynthesis.cancel();
  capNhatLoa();
}
if (coDocNoi) {
  chonGiong();
  speechSynthesis.addEventListener?.('voiceschanged', chonGiong);   // Chrome nạp danh sách giọng sau khi mở trang
}
// Đang bật tiếng mà chưa có giọng: bấm nút loa thì hỏi / chỉ cách (không tắt). Có giọng thì đọc thử một câu.
function chonCachNghe() {
  chonGiong();
  if (!giongDung() && giongMang && confirm('Máy chưa cài giọng tiếng Việt trong máy.\n\n'
    + `Bấm OK để dùng giọng đọc qua mạng "${giongMang.name}": chữ Mây đọc (lời chào, tên ghi chú, câu trả lời) `
    + 'sẽ được gửi lên máy chủ của hãng để đọc. Tắt tiếng là bỏ quyền này.\n\n'
    + 'Bấm Huỷ để giữ riêng tư: Mây chỉ hiện phụ đề — cài giọng tiếng Việt cho máy theo Hướng dẫn.')) {
    choMang = true;
    try { localStorage.setItem('sb.giongMang', '1'); } catch (_) { /* chỉ trong lần mở trang này */ }
    capNhatLoa();
  }
  if (giongDung()) noi('Mây đây. Anh nghe rõ không?');
  else baoNhanh(lyDoThieuGiong(), 9000);
}

function noi(chu) {              // "Mây nói": nhép miệng + phụ đề + tiếng (chỉ khi đang ở chế độ mặt A.I)
  if (!matDich || !chu) return;
  chu = String(chu).replace(/\s+/g, ' ').trim();
  const ln = { chu, t0: giay(), dai: keo(chu.length * 0.065, 1.4, 7) };
  loiNoi = ln;
  if (!coTieng || !coDocNoi) return;
  speechSynthesis.cancel();
  if (!giongDung()) chonGiong();
  const g = giongDung();
  if (!g) {
    if (!daBaoThieuGiong) { daBaoThieuGiong = true; baoNhanh(lyDoThieuGiong(), 9000); }
    return;
  }
  const u = new SpeechSynthesisUtterance(chu);
  u.voice = g;
  u.lang = g.lang;
  u.rate = 1;
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

function datMat(bat) {
  matDich = bat ? 1 : 0;
  hoverLoi = false;          // lõi sắp dời chỗ — bỏ trạng thái rê chuột cũ (không thì tên 8 quẻ còn hiện lúc chuyển cảnh)
  document.body.classList.toggle('mat-ai', !!bat);
  if (bat) {
    const n = DATA.tong_ghi_chu ?? DATA.notes.length;
    const v = (DATA.cay || []).filter((c) => c.duong_dan).length;
    setTimeout(() => noi(n ? `Xin chào anh. Kho đang có ${n} ghi chú trong ${v} vùng kiến thức.`
      : 'Xin chào anh. Kho đang trống — mình bắt đầu ghi chú đầu tiên nhé?'), itMotion ? 0 : 2300);
  } else {
    loiNoi = null;
    if (coDocNoi) speechSynthesis.cancel();
  }
}
$('#batTieng').addEventListener('click', () => { if (coTieng && !giongDung()) chonCachNghe(); else datTieng(!coTieng); });
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

function veNao(t, a) {                   // nếp cuộn não sáng theo sóng chạy ngang; đang nói thì sáng hơn
  const noiNhieu = loiNoi && giay() - loiNoi.t0 < loiNoi.dai ? 1.5 : 1;
  for (const g of MH.nao) {
    if (!g.ds.length) continue;
    cx.beginPath();
    for (const c of g.ds) {
      const d = c.d, b = c.b, n = d.length / 3;
      for (let i = 0; i < n; i++) chieuVao(b, i * 2, d[i * 3], d[i * 3 + 1], d[i * 3 + 2], 1);
      cx.moveTo(b[0], b[1]);
      for (let i = 1; i < n; i++) cx.lineTo(b[i * 2], b[i * 2 + 1]);
    }
    const nhip = itMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.7 - g.tx * 4);
    const al = Math.min(1, a * (0.2 + 0.45 * nhip) * noiNhieu);
    cx.strokeStyle = `rgba(80,160,255,${(al * 0.3).toFixed(3)})`;
    cx.lineWidth = 3.2;
    cx.stroke();
    cx.strokeStyle = `rgba(190,228,255,${al.toFixed(3)})`;
    cx.lineWidth = 1;
    cx.stroke();
  }
}

/* Các vùng: vòng tròn quanh đầu (trái → phải theo thứ tự vòng quỹ đạo), nối mạng tới từng nơ-ron của vùng trong não;
   một xung sáng chạy từ vòng vào não. Bấm vòng: Mây đọc tên vùng và số ghi chú, các đường nối của vùng sáng lên. */
let hoverVung = null, nhayVung = null;
function veVung(a, t, diem) {
  MH.vungXY = [];
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
  cx.lineWidth = 1;
  MH.vungXY.forEach((v) => {
    const mau = mauCua(v.ten), toi = noiBat && noiBat !== v.ten, sang = v.ten === nhay || v.ten === hoverVung;
    const ds = nodes.filter((nd) => nd.nhom === v.ten).map((nd) => diem.get(nd.note.id)).filter(Boolean);
    if (!ds.length) return;
    cx.beginPath();
    ds.forEach((p) => { cx.moveTo(v.x, v.y); cx.lineTo(p.x, p.y); });
    cx.strokeStyle = rgba(mau, a * (toi ? 0.03 : sang ? 0.45 : 0.1));
    cx.stroke();
    if (itMotion || toi) return;
    const tb = ds.reduce((s, p) => ({ x: s.x + p.x / ds.length, y: s.y + p.y / ds.length }), { x: 0, y: 0 });
    const s = (t * 0.45 + bam(v.ten, 7)) % 1;
    cx.fillStyle = rgba(mau, a * 0.9);
    cx.beginPath();
    cx.arc(v.x + (tb.x - v.x) * s, v.y + (tb.y - v.y) * s, 2, 0, Math.PI * 2);
    cx.fill();
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
    const tx = keo(v.x, toiDa / 2 + 4, W - lechDich - toiDa / 2 - 4), ty = v.y + v.r + 8 + coChu * 0.6;
    cx.lineWidth = 3.5;
    cx.strokeStyle = 'rgba(6,14,30,.85)';
    cx.strokeText(ten, tx, ty);
    cx.fillStyle = 'rgba(225,236,252,.88)';
    cx.fillText(ten, tx, ty);
    cx.globalAlpha = 1;
  });
}
function timVung(x, y) {
  if (!matDich || kMat < 0.9 || !MH) return null;
  const v = MH.vungXY.find((o) => Math.hypot(o.x - x, o.y - y) < o.r + 5);
  return v ? v.ten : null;
}

function veCau(x, y, r, loi, vien, a) {  // quả cầu năng lượng: quầng + thân sáng dần vào tâm
  const q = cx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
  q.addColorStop(0, `rgba(${vien},${(0.5 * a).toFixed(3)})`);
  q.addColorStop(1, `rgba(${vien},0)`);
  cx.fillStyle = q;
  cx.beginPath(); cx.arc(x, y, r * 3, 0, Math.PI * 2); cx.fill();
  const g = cx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.05, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
  g.addColorStop(0.3, `rgba(${loi},${(0.9 * a).toFixed(3)})`);
  g.addColorStop(1, `rgba(${vien},${(0.35 * a).toFixed(3)})`);
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = `rgba(${loi},${(0.8 * a).toFixed(3)})`;
  cx.lineWidth = 1.2;
  cx.stroke();
}

function veMat(tg, diem) {
  if (!MH) MH = dungMoHinh();
  const u = MAT.u, k = kMat, t = itMotion ? 0 : giay(), xong = k >= 1;
  const phu = em(0.62, 1, k);            // kính, não, mắt, vòng HUD, các vùng: hiện khi đầu đã gần thành hình
  // hai quả cầu Âm Dương: tách khỏi lõi, xoay đúng một vòng quanh nhau rồi dừng ngang, bay vào làm hai mắt
  const tach = em(0.03, 0.3, k), vao = em(0.55, 0.93, k);
  const tamY = CY + (MAT.oy - 0.05 * u - CY) * em(0.08, 0.5, k);
  const gq = Math.PI * 2 * em(0.04, 0.56, k), d = 1.15 * u * tach;
  const mT = chieuDiem(...MH.mat[0], 1), mP = chieuDiem(...MH.mat[1], 1);
  let ax = CX - Math.cos(gq) * d, ay = tamY - Math.sin(gq) * d;
  let bx = CX + Math.cos(gq) * d, by = tamY + Math.sin(gq) * d;
  ax += (mT.x - ax) * vao; ay += (mT.y - ay) * vao;
  bx += (mP.x - bx) * vao; by += (mP.y - by) * vao;
  const L = Math.hypot(bx - ax, by - ay) || 1, px = -(by - ay) / L, py = (bx - ax) / L;
  const viTriSoi = (c, s) => {            // điểm s (0 → 1) trên sợi năng lượng của đường c, nối Dương → Âm
    const lech = Math.sin(Math.PI * s) * L * (c.a1 * Math.sin(6.283 * c.f1 * s + c.w1 * t + c.p1)
      + c.a2 * Math.sin(6.283 * c.f2 * s - c.w2 * t + c.p2));
    return [ax + (bx - ax) * s + px * lech, ay + (by - ay) * s + py * lech];
  };
  cx.save();
  cx.lineJoin = 'round';
  cx.lineCap = 'round';
  const vien = new Path2D();
  { const v = MH.vien, b = MH.vienB;
    for (let i = 0; i < v.length / 3; i++) {
      chieuVao(b, i * 2, v[i * 3], v[i * 3 + 1], v[i * 3 + 2], 1);
      if (i) vien.lineTo(b[i * 2], b[i * 2 + 1]); else vien.moveTo(b[0], b[1]);
    }
    vien.closePath(); }
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
    cx.fillStyle = g;
    cx.fill(vien);
    cx.globalCompositeOperation = 'lighter';
    veNao(t, phu);
    // vòng HUD — hai cung nét đứt xoay ngược chiều nhau
    [[1.42, '95,180,255', 1], [1.55, '150,200,255', -1]].forEach(([r, mau, chieu]) => {
      cx.setLineDash([3, 9]);
      cx.lineDashOffset = itMotion ? 0 : chieu * tg * 24;
      cx.beginPath();
      cx.arc(tam.x, tam.y, r * u, Math.PI * 0.82, Math.PI * 2.18);
      cx.strokeStyle = `rgba(${mau},${(0.3 * phu).toFixed(3)})`;
      cx.lineWidth = 1.2;
      cx.stroke();
    });
    cx.setLineDash([]);
    veVung(phu, t, diem);
  }
  // các đường vân: lúc chuyển cảnh còn là sợi năng lượng, gỡ dần (lệch nhịp: viền đầu trước, chóp mũi sau) thành đường vân
  cx.globalCompositeOperation = 'lighter';
  const soi = em(0.05, 0.25, k), mieng = MAT.mieng;
  const bo = [[], [], [], [], []];
  for (const m of MH.manh) {
    const c = MH.cha[m.cha], mo = xong ? 1 : em(c.bd, c.bd + 0.24, k);
    const al = soi * 0.55 * (1 - mo) + m.sang * mo;
    if (al < 0.01) continue;
    const dd = m.d, b = m.b, n = dd.length / 5;
    for (let i = 0; i < n; i++) {
      const o = i * 5, x = dd[o];
      let y = dd[o + 1];
      // nhép miệng: môi dưới và cằm hạ xuống
      if (mieng > 0 && m.laDau && y > 0.725 && x > -0.8 && x < 0.8) y += mieng * 0.9 * em(0.725, 0.79, y) * (1 - em(0.3, 0.8, Math.abs(x)));
      if (m.mi) y *= MAT.chop;                // chớp mắt: hai mí khép về giữa mắt (y = 0)
      chieuVao(b, i * 2, x, y, dd[o + 2], dd[o + 4]);
      if (mo < 1) {
        const [sx, sy] = viTriSoi(c, dd[o + 3]);
        b[i * 2] = sx + (b[i * 2] - sx) * mo;
        b[i * 2 + 1] = sy + (b[i * 2 + 1] - sy) * mo;
      }
    }
    if (xong) { bo[Math.min(4, Math.floor(m.sang * 5.5))].push(m); continue; }
    const [r0, g0, b0] = c.mau;
    const mau = `${Math.round(r0 + (130 - r0) * mo)},${Math.round(g0 + (215 - g0) * mo)},${Math.round(b0 + (255 - b0) * mo)}`;
    cx.beginPath();
    cx.moveTo(b[0], b[1]);
    for (let i = 1; i < n; i++) cx.lineTo(b[i * 2], b[i * 2 + 1]);
    cx.strokeStyle = `rgba(${mau},${(al * 0.22).toFixed(3)})`;
    cx.lineWidth = 3;
    cx.stroke();
    cx.strokeStyle = `rgba(${mau},${al.toFixed(3)})`;
    cx.lineWidth = 1;
    cx.stroke();
  }
  // đã thành hình: gom theo độ sáng, mỗi nhóm vẽ một lần, một lớp nét mảnh (nhẹ máy)
  bo.forEach((ds, i) => {
    if (!ds.length) return;
    const al = (i + 0.5) / 5.5;
    cx.beginPath();
    ds.forEach((m) => {
      const b = m.b;
      cx.moveTo(b[0], b[1]);
      for (let j = 1; j < b.length / 2; j++) cx.lineTo(b[j * 2], b[j * 2 + 1]);
    });
    cx.strokeStyle = `rgba(130,215,255,${al.toFixed(3)})`;
    cx.lineWidth = 1;
    cx.stroke();
  });
  // hạt sáng trôi dọc các sợi
  if (soi > 0 && !xong) {
    cx.fillStyle = '#E8F4FF';
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
    // vệt quét từ đỉnh đầu xuống cằm, ~3,5 giây một lượt
    if (!itMotion) {
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
    // miệng: lòng miệng sáng lên khi mở
    if (mieng > 0.005) {
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
    // mắt: lõi trắng, quầng xanh, vệt loé ngang; chớp mắt; đang nói thì sáng hơn
    const sang = phu * (mieng > 0 ? 1 : 0.88);
    [mT, mP].forEach((p) => {
      const r = u * 0.2;
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
  // hai quả cầu: Dương vàng (trái — phía Đông), Âm xanh tím (phải); nhỏ dần khi bay vào làm mắt
  const aCau = em(0.02, 0.14, k) * (1 - em(0.84, 0.98, k));
  if (aCau > 0.01) {
    const r = u * (0.05 + 0.15 * tach) * (1 - 0.65 * vao);
    veCau(ax, ay, r, '255,226,150', '240,170,60', aCau);
    veCau(bx, by, r, '160,175,255', '110,90,255', aCau);
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
    const x = LX + Math.cos(a) * rr, y = LY + Math.sin(a) * rr;
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
  cx.fillText('Thái Cực · Tiên Thiên Bát Quái', LX, LY + R + 42);
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
  if (v) { nhayVung = { ten: v, t0: giay() }; noi(`Vùng ${v}: ${vungSo[v] ?? 0} ghi chú.`); return; }
  const nd = timGan(x, y);
  if (nd) { moChiTiet(nd.note.id); noi(nd.note.title); }   // mặt A.I: đọc tên ghi chú vừa bấm
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
  noi(cauDau(r.answer || r.note || ''));
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
