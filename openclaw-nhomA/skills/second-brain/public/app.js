/* Second Brain — đồ thị ghi chú quanh lõi BRAIN + các ô Thêm / Tìm / Hỏi.
   Mỗi vòng quỹ đạo là một nhóm (category). Ghi chú mới nằm gần lõi hơn. */
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

/* màu nhóm — lấy từ bảng sơn mài: vàng kim, vỏ trứng, xà cừ, son cam, bạc, hồng đất */
const MAU = ['#C9A227', '#EFE4D4', '#7FA8A0', '#D97A3C', '#A9B6C9', '#C98FA0'];

let DATA = { notes: [], categories: {}, links: [] };
let nodes = [];
let vongMau = [];        // màu theo thứ tự vòng
let noiBat = null;       // tên nhóm đang được làm nổi, null = không lọc
let quay = true;
let goc = 0;
let hover = null;
let chon = null;

const itMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (itMotion) quay = false;

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
  $('#count').textContent = n ? `${n} ghi chú · ${Object.keys(DATA.categories).length} nhóm` : 'Kho đang trống';
  $('#trong').hidden = n > 0;
  const cho = DATA.cho_phan_loai || 0;
  const nut = $('#choPhanLoai');
  nut.textContent = cho ? `${cho} ghi chú chưa xếp chỗ →` : '';
  nut.hidden = !cho;
  const dl = $('#dsNhom');
  dl.innerHTML = '';
  Object.keys(DATA.categories).sort().forEach((c) => {
    if (c === 'Chưa phân loại') return;
    const o = document.createElement('option');
    o.value = c;
    dl.appendChild(o);
  });
  dungQuyDao();
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
    const k = x.category || 'Chưa phân loại';
    (nhom[k] = nhom[k] || []).push(x);
  });
  // sắp theo số THẬT của nhóm, không phải số đang có trong tay
  const soThat = (k) => DATA.categories?.[k] ?? nhom[k].length;
  const tenDay = Object.keys(nhom).sort((a, b) => soThat(b) - soThat(a));
  const tongThat = DATA.notes.length;

  // cắt bớt cho vừa mắt — DATA.notes đã sắp theo updated_at giảm dần
  if (noiBat && nhom[noiBat]) {
    nhom[noiBat] = nhom[noiBat].slice(0, TRAN_MOT_NHOM);
    tenDay.forEach((k) => { if (k !== noiBat) nhom[k] = nhom[k].slice(0, 2); });
  } else if (tongThat > TRAN_NODE) {
    tenDay.forEach((k) => {
      const phan = Math.max(3, Math.round(TRAN_NODE * nhom[k].length / tongThat));
      nhom[k] = nhom[k].slice(0, phan);
    });
  }
  // cộng cả phần máy chủ đã cắt trước khi gửi xuống
  daBot = (DATA.tong_ghi_chu ?? tongThat) - tenDay.reduce((s, k) => s + nhom[k].length, 0);

  const ten = tenDay;
  nodes = [];
  vongMau = [];
  ten.forEach((k, vi) => {
    const ds = nhom[k];
    // mỗi nhóm một vòng; nhóm đông nằm vòng trong
    const bk = 0.26 + (vi + 1) / (ten.length + 1) * 0.70;
    const lech = vi * 0.9;
    const mau = MAU[vi % MAU.length];
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
    ? `Đang xem nhóm "${noiBat}". Đồ thị vẽ tối đa ${TRAN_MOT_NHOM} ghi chú mới sửa gần nhất của nhóm — ${daBot} ghi chú khác không vẽ ra. Tìm bằng ô Tìm.`
    : `Đồ thị vẽ ${nodes.length}/${DATA.tong_ghi_chu ?? DATA.notes.length} ghi chú mới sửa gần nhất — đây là cái nhìn tổng quan, không phải mục lục. Bấm tên nhóm để xem sâu một nhóm, hoặc dùng ô Tìm.`;
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
    d.style.background = MAU[vi % MAU.length];
    const t = document.createElement('span');
    t.textContent = k;
    const s = document.createElement('u');
    s.textContent = DATA.categories[k] ?? nhom[k].length;   // số thật, không phải số đang vẽ
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

const DO = '#C0392B', VANG = '#C9A227', TRUNG = '#EFE4D4';
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};
const mo = (nd) => !!noiBat && nd.nhom !== noiBat;   // nhóm bị làm mờ

const banKinh = () => Math.min((W - lechDich) * 0.40, H * 0.46);

function viTri(nd) {
  const R = banKinh();
  const a = nd.pha + goc * nd.toc;
  return { x: CX + Math.cos(a) * R * nd.bk, y: CY + Math.sin(a) * R * nd.bk * 0.74 };
}

function ve() {
  cx.clearRect(0, 0, W, H);
  const R = banKinh();

  // vòng quỹ đạo — mỗi nhóm một màu riêng
  const soVong = vongMau.length;
  const tenVong = [];
  nodes.forEach((n) => { tenVong[n.vong] = n.nhom; });
  for (let i = 0; i < soVong; i++) {
    const bk = 0.26 + (i + 1) / (soVong + 1) * 0.70;
    const sang = noiBat ? (tenVong[i] === noiBat ? 0.3 : 0.04) : 0.11;
    cx.beginPath();
    cx.ellipse(CX, CY, R * bk, R * bk * 0.74, 0, 0, Math.PI * 2);
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
    cx.strokeStyle = 'rgba(239,228,212,.17)';
    cx.lineWidth = 1;
    cx.stroke();
  });

  // lõi
  const quang = cx.createRadialGradient(CX, CY, 2, CX, CY, 56);
  quang.addColorStop(0, 'rgba(192,57,43,.55)');
  quang.addColorStop(1, 'rgba(192,57,43,0)');
  cx.fillStyle = quang;
  cx.beginPath(); cx.arc(CX, CY, 56, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(CX, CY, 21, 0, Math.PI * 2);
  cx.fillStyle = DO; cx.fill();
  cx.strokeStyle = VANG; cx.lineWidth = 1.4; cx.stroke();
  cx.fillStyle = TRUNG;
  cx.font = '600 10.5px "Be Vietnam Pro",sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('BRAIN', CX, CY + 0.5);

  // các ghi chú — vẽ chấm trước, nhãn sau (node đang chọn được ưu tiên chỗ)
  nodes.forEach((nd) => {
    const p = diem.get(nd.note.id);
    const nb = nd === hover || nd === chon;
    const toi = mo(nd);
    cx.beginPath();
    cx.arc(p.x, p.y, nb ? nd.r + 2.4 : nd.r, 0, Math.PI * 2);
    cx.fillStyle = nd.mau;
    cx.globalAlpha = nb ? 1 : toi ? 0.2 : 0.85;
    cx.fill();
    if (nb) { cx.strokeStyle = TRUNG; cx.lineWidth = 1.2; cx.stroke(); }
    cx.globalAlpha = 1;
  });

  cx.font = '500 12.5px "Be Vietnam Pro",sans-serif';
  cx.textBaseline = 'middle';
  const daVe = [];                                   // ô chữ đã chiếm chỗ
  const uuTien = nodes.slice().sort((a, b) =>
    (b === hover || b === chon) - (a === hover || a === chon));
  uuTien.forEach((nd) => {
    const nb = nd === hover || nd === chon;
    const toi = mo(nd);
    if (!nb && toi) return;
    const p = diem.get(nd.note.id);
    const t = nd.note.title.length > 32 ? nd.note.title.slice(0, 31) + '…' : nd.note.title;
    const w = cx.measureText(t).width;
    const phai = mepPhai() - 10;
    // đặt về phía còn chỗ: không tràn mép trái, không chui xuống dưới thẻ chi tiết
    let trai = p.x < CX;
    if (trai && p.x - 10 - w < 8) trai = false;
    else if (!trai && p.x + 10 + w > phai) trai = true;
    const x0 = trai ? p.x - 10 - w : p.x + 10;
    const o = { x0: x0 - 7, x1: x0 + w + 7, y0: p.y - 9, y1: p.y + 9 };
    if (!nb && daVe.some((q) => o.x0 < q.x1 && o.x1 > q.x0 && o.y0 < q.y1 && o.y1 > q.y0)) return;
    daVe.push(o);
    cx.textAlign = 'left';
    cx.fillStyle = nb ? TRUNG : 'rgba(239,228,212,.62)';
    cx.fillText(t, x0, p.y);
  });
}

function vong() {
  if (quay) goc += 0.0022;
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
  hover = timGan(e.clientX - b.left, e.clientY - b.top);
  cv.style.cursor = hover ? 'pointer' : 'default';
});
cv.addEventListener('mouseleave', () => { hover = null; });
cv.addEventListener('click', (e) => {
  const b = cv.getBoundingClientRect();
  const nd = timGan(e.clientX - b.left, e.clientY - b.top);
  if (nd) moChiTiet(nd.note.id);
});

$('#dung').addEventListener('click', (e) => {
  quay = !quay;
  e.target.textContent = quay ? 'Dừng xoay' : 'Xoay lại';
  e.target.setAttribute('aria-pressed', String(!quay));
});

/* ---------------- thẻ chi tiết ---------------- */
async function moChiTiet(id) {
  const r = await api('/api/note?id=' + encodeURIComponent(id));
  if (!r.ok) return;
  const n = r.note;
  chon = nodes.find((x) => x.note.id === id) || null;
  $('#ctMeta').textContent = [n.category || 'Chưa phân loại', ...(n.tags || []).map((t) => '#' + t)].join('  ');
  $('#ctTitle').textContent = n.title;
  $('#ctBody').textContent = n.content;
  const ngn = $('#ctNguon');
  ngn.innerHTML = '';
  if (/^https?:\/\//i.test(n.url || '')) {        // chỉ mở link http(s), bỏ qua javascript: và dữ liệu lạ
    const a = document.createElement('a');
    a.href = n.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = n.url;
    ngn.append(document.createTextNode('Nguồn: '), a);
    ngn.hidden = false;
  } else ngn.hidden = true;
  const nho = $('#ctNho');
  nho.dataset.id = n.id;
  nho.disabled = false;
  nho.textContent = 'Nhớ rồi';
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
  f.category.value = n.category || '';
  f.tags.value = (n.tags || []).join(', ');
  f.url.value = n.url || '';
  f.content.value = n.content || '';
}

$('#ctSuaMo').addEventListener('click', () => {
  const f = $('#ctSua');
  const mo = f.hidden;
  f.hidden = !mo;
  $('#ctBody').hidden = mo;
  $('#ctSuaMo').textContent = mo ? 'Thôi sửa' : 'Sửa';
  if (mo) f.category.focus();
});
$('#ctHuy').addEventListener('click', () => dangSua && dongSua(dangSua));

$('#ctSua').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!dangSua) return;
  const f = e.target, say = $('#saySua');
  say.textContent = 'Đang lưu…'; say.className = 'say';
  const r = await api('/api/update', {
    id: dangSua.id, category: f.category.value.trim(), tags: f.tags.value.trim(),
    url: f.url.value.trim(), content: f.content.value.trim() || dangSua.content,
  });
  if (!r.ok) { say.textContent = r.error || 'Không lưu được'; say.className = 'say er'; return; }
  say.textContent = 'Đã lưu.'; say.className = 'say ok';
  await nap();
  await moChiTiet(dangSua.id);
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

function moTab(ten) {
  document.querySelectorAll('.tabs button').forEach((x) =>
    x.setAttribute('aria-selected', String(x.dataset.tab === ten)));
  document.querySelectorAll('.tab').forEach((p) => { p.hidden = p.dataset.pane !== ten; });
  if (ten === 'on') napHangOn();
}
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
    s.textContent = `${x.category || 'Chưa phân loại'} · cất ${ngayTu(x.updated_at) || ''}`;
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
      ? `${n.category || 'Chưa phân loại'} · ôn lần cuối ${ngayTu(n.reviewed_at)}`
      : `${n.category || 'Chưa phân loại'} · ghi ${ngayTu(n.created_at)}, chưa ôn lần nào`;
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
  if (!r.ok) { say.textContent = r.error || 'Không lưu được'; say.className = 'say er'; return; }
  say.textContent = 'Đã lưu.'; say.className = 'say ok';
  f.reset();
  await nap();
  if (r.similar?.length) baoTrung(r.similar);
});

/* Trùng không chặn lưu — chỉ nhắc, để anh tự gộp nếu muốn. */
function baoTrung(ds) {
  const box = $('#trungLap');
  box.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = ds.length === 1
    ? 'Kho đã có một ghi chú gần giống:'
    : `Kho đã có ${ds.length} ghi chú gần giống:`;
  box.appendChild(p);
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
$('#oTim').addEventListener('input', (e) => {
  clearTimeout(hen);
  const q = e.target.value.trim();
  hen = setTimeout(async () => {
    const box = $('#ketQua');
    if (!q) { box.innerHTML = ''; return; }
    const r = await api('/api/search?q=' + encodeURIComponent(q));
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
      const s = document.createElement('span');
      (n.snippet || '').split(/[«»]/).forEach((part, i) => {
        if (i % 2) { const em = document.createElement('em'); em.textContent = part; s.appendChild(em); }
        else s.appendChild(document.createTextNode(part));
      });
      b.append(t, s);
      b.addEventListener('click', () => moChiTiet(n.id));
      box.appendChild(b);
    });
  }, 220);
});

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

/* ---------------- chạy ---------------- */
window.addEventListener('resize', coLai);
coLai();
nap();
requestAnimationFrame(vong);
