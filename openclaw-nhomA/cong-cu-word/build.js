// Dựng file Word từ CAI-DAT.md + HUONG-DAN.md (qua AST JSON của pandoc).
// Khối lệnh: MỖI DÒNG MỘT ĐOẠN (không dùng ngắt dòng mềm), Consolas, nháy thẳng, không gạch chính tả
// -> bôi đen, Ctrl+C, dán vào terminal là chạy.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, ExternalHyperlink, ImageRun, TableOfContents,
  Footer, Header, PageNumber, PageBreak, TableLayoutType, Bookmark, InternalHyperlink, PositionalTab,
  PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader,
} = require('docx');

const NAVY = '10203A', XANH = '1F5FAD', CAM = 'D9661F', VANG = 'C9A227', XAM = '5B6B82';
const FONT = 'Arial', MONO = 'Consolas';
const PAGE_W = 11906, MARGIN = 1134, CONTENT_W = PAGE_W - 2 * MARGIN;   // A4, lề 2 cm

// ---------- inline ----------
function inl(arr, fmt = {}) {
  const out = [];
  for (const x of arr || []) {
    switch (x.t) {
      case 'Str': out.push(new TextRun({ text: x.c, ...fmt })); break;
      case 'Space': case 'SoftBreak': out.push(new TextRun({ text: ' ', ...fmt })); break;
      case 'LineBreak': out.push(new TextRun({ text: '', break: 1, ...fmt })); break;
      case 'Strong': out.push(...inl(x.c, { ...fmt, bold: true })); break;
      case 'Emph': out.push(...inl(x.c, { ...fmt, italics: true })); break;
      case 'Code':
        out.push(new TextRun({ text: x.c[1], font: MONO, size: 19, color: 'A3410E', noProof: true,
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F4F9' }, ...(fmt.bold ? { bold: true } : {}) }));
        break;
      case 'Link': {
        const url = x.c[2][0];
        out.push(new ExternalHyperlink({ link: url, children: inl(x.c[1], { ...fmt, color: XANH, underline: {} }) }));
        break;
      }
      case 'Quoted': out.push(new TextRun({ text: '"', ...fmt }), ...inl(x.c[1], fmt), new TextRun({ text: '"', ...fmt })); break;
      default: if (x.c && Array.isArray(x.c)) out.push(...inl(x.c, fmt));
    }
  }
  return out;
}
const plain = (arr) => (arr || []).map((x) => x.t === 'Str' ? x.c : x.t === 'Space' || x.t === 'SoftBreak' ? ' '
  : x.t === 'Code' ? x.c[1] : Array.isArray(x.c) ? plain(x.t === 'Link' ? x.c[1] : x.c) : '').join('');

// ---------- khối lệnh ----------
function codeBlock(text, indentLeft = 0) {
  const lines = text.replace(/\s+$/, '').split('\n');
  const bd = { style: BorderStyle.SINGLE, size: 4, color: 'D5DDEA' };
  return lines.map((ln, i) => new Paragraph({
    keepNext: i < lines.length - 1, keepLines: true,
    spacing: { before: i === 0 ? 80 : 0, after: i === lines.length - 1 ? 160 : 0, line: 264 },
    indent: { left: indentLeft + 170, right: 120 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F6FB' },
    border: {                                    // thứ tự bắt buộc: top, left, bottom, right
      ...(i === 0 ? { top: { ...bd, space: 4 } } : {}),
      left: { style: BorderStyle.SINGLE, size: 24, color: CAM, space: 6 },
      ...(i === lines.length - 1 ? { bottom: { ...bd, space: 4 } } : {}),
      right: { ...bd, space: 4 },
    },
    children: [new TextRun({
      text: ln.length ? ln : ' ', font: MONO, size: 19, noProof: true,
      color: /^\s*#/.test(ln) ? '6A7A90' : '13233F',
    })],
  }));
}

// ---------- bảng ----------
const r0Head = (rows, j) => rows[0].h && rows[0].cells[j][4].length > 0;
function table(c) {
  const head = c[3][1];                       // TableHead rows
  const body = c[4][0][3];                    // TableBody rows
  const cellsText = (row) => row[1].map((cell) => cell[4].map((b) => plain(b.c)).join(' '));
  const rows = [...head.map((r) => ({ h: true, cells: r[1] })), ...body.map((r) => ({ h: false, cells: r[1] }))];
  const n = rows[0].cells.length;
  // độ rộng cột theo độ dài chữ, có sàn và trần
  // độ rộng: không cột nào hẹp hơn TỪ DÀI NHẤT của nó (tránh gãy chữ "Phươn/g"), phần dư chia theo độ dài chữ
  const len = Array(n).fill(4), tu = Array(n).fill(2);
  rows.forEach((r) => r.cells.forEach((cell, j) => {
    const t = cell[4].map((b) => plain(b.c)).join(' ');
    len[j] = Math.max(len[j], Math.min(60, t.length));
    // ô ngắn (≤ 12 ký tự, ví dụ hào "╌ ▬ ▬") giữ trọn một dòng; ô dài thì không cắt giữa từ
    (t.length <= 12 ? [t] : t.split(/\s+/)).forEach((x) => { tu[j] = Math.max(tu[j], Math.min(22, x.length)); });
  }));
  const san = tu.map((k, j) => Math.round(k * (r0Head(rows, j) ? 125 : 112) + 230));
  const conLai = Math.max(0, CONTENT_W - san.reduce((a, b) => a + b, 0));
  const tong = len.reduce((a, b) => a + b, 0);
  let w = san.map((x, j) => x + Math.round(conLai * len[j] / tong));
  const sum = w.reduce((a, b) => a + b, 0);
  w = w.map((x) => Math.floor(x * CONTENT_W / sum));
  w[n - 1] += CONTENT_W - w.reduce((a, b) => a + b, 0);
  const bd = { style: BorderStyle.SINGLE, size: 4, color: 'C9D3E3' };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED,
    rows: rows.map((r, ri) => new TableRow({
      tableHeader: r.h, cantSplit: true,
      children: r.cells.map((cell, j) => new TableCell({
        width: { size: w[j], type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        borders: { top: bd, left: bd, bottom: bd, right: bd },
        shading: r.h ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY }
          : ri % 2 === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F6F8FC' } : undefined,
        children: cell[4].length ? cell[4].map((b) => new Paragraph({
          spacing: { before: 0, after: 0, line: 260 },
          children: inl(b.c, r.h ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19 }),
        })) : [new Paragraph({ children: [] })],
      })),
    })),
  });
}

// ---------- tiêu đề có dấu trang (bookmark) để mục lục bấm nhảy tới ----------
const MUC = [];
function headingMuc(H, lv, text, runs) {
  const id = `muc_${MUC.length + 1}`;
  if (lv <= 2) MUC.push({ id, lv, text });
  return new Paragraph({ heading: H, keepNext: true,
    children: lv <= 2 ? [new Bookmark({ id, children: runs })] : runs });
}

// ---------- khối ----------
let listInst = 0;
function blocks(arr, ctx) {
  const out = [];
  for (const b of arr) {
    switch (b.t) {
      case 'Header': {
        const lv = ctx.map(b.c[0]);
        if (lv === null) break;
        const H = { 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 }[lv] || HeadingLevel.HEADING_4;
        out.push(headingMuc(H, lv, plain(b.c[2]), inl(b.c[2])));
        break;
      }
      case 'Para': case 'Plain':
        out.push(new Paragraph({ children: inl(b.c), spacing: { after: 120, line: 288 },
          indent: ctx.quote ? { left: 340, right: 200 } : undefined,
          shading: ctx.quote ? { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF7E3' } : undefined,
          border: ctx.quote ? { left: { style: BorderStyle.SINGLE, size: 18, color: VANG, space: 8 } } : undefined }));
        break;
      case 'CodeBlock': out.push(...codeBlock(b.c[1], ctx.quote ? 340 : 0)); break;
      case 'Table': out.push(table(b.c)); out.push(new Paragraph({ spacing: { after: 80 }, children: [] })); break;
      case 'BlockQuote': out.push(...blocks(b.c, { ...ctx, quote: true })); break;
      case 'BulletList': case 'OrderedList': {
        const ordered = b.t === 'OrderedList';
        const items = ordered ? b.c[1] : b.c;
        const inst = ++listInst;
        const level = ctx.level || 0;
        for (const item of items) {
          item.forEach((blk, k) => {
            if (k === 0 && (blk.t === 'Plain' || blk.t === 'Para')) {
              out.push(new Paragraph({
                numbering: { reference: ordered ? 'so' : 'cham', level, instance: ordered ? inst : undefined },
                spacing: { after: 60, line: 288 }, children: inl(blk.c),
              }));
            } else out.push(...blocks([blk], { ...ctx, level: level + 1 }));
          });
        }
        out.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
        break;
      }
      case 'HorizontalRule': break;
      default: break;
    }
  }
  return out;
}

const ast = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).blocks;
// CAI-DAT: tiêu đề # đầu tiên bỏ (đã có tiêu đề phần), # -> H2, ### -> H3
const HUONG_DAN_H = headingMuc(HeadingLevel.HEADING_2, 2, 'Cách dùng tài liệu này', [new TextRun('Cách dùng tài liệu này')]);
const PART_A_H = headingMuc(HeadingLevel.HEADING_1, 1, 'PHẦN A — CÀI ĐẶT', [new TextRun('PHẦN A — CÀI ĐẶT')]);
let daBoTitle1 = false;
const partA = blocks(ast('CAI-DAT.json'), {
  map: (l) => { if (l === 1 && !daBoTitle1) { daBoTitle1 = true; return null; } return l === 1 ? 2 : l <= 3 ? 3 : 4; },
});
// HUONG-DAN: # đầu bỏ, ## -> H2, ### -> H3
const PART_B_H = headingMuc(HeadingLevel.HEADING_1, 1, 'PHẦN B — SỬ DỤNG HẰNG NGÀY', [new TextRun('PHẦN B — SỬ DỤNG HẰNG NGÀY')]);
const partB = blocks(ast('HUONG-DAN.json'), { map: (l) => (l === 1 ? null : l) });

const p = (text, o = {}) => new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 120, before: o.before ?? 0 },
  children: [new TextRun({ text, bold: o.bold, size: o.size, color: o.color, font: o.font, italics: o.italics })] });

const huongDanCopy = [
  HUONG_DAN_H,
  new Paragraph({ spacing: { after: 120, line: 288 }, children: [
    new TextRun('Mọi câu lệnh nằm trong '), new TextRun({ text: 'khung xám có vạch cam bên trái', bold: true }),
    new TextRun('. Mỗi dòng trong khung là một dòng lệnh thật — bôi đen cả khung (hoặc từng dòng), '),
    new TextRun({ text: 'Ctrl+C', bold: true }), new TextRun(', rồi dán vào cửa sổ SSH (Termius: Paste; PuTTY: chuột phải; terminal Mac/Linux: Ctrl+Shift+V hoặc Cmd+V).')] }),
  ...codeBlock('# Ví dụ: dòng bắt đầu bằng # là chú thích, dán vào cũng không sao\ncd ~/openclaw-nhomA\nbash truoc-khi-cai.sh'),
  new Paragraph({ spacing: { after: 80, line: 288 }, numbering: { reference: 'cham', level: 0 }, children: [
    new TextRun('Chữ '), new TextRun({ text: 'màu cam trên nền xám', color: 'A3410E', font: MONO }),
    new TextRun(' trong câu văn là tên lệnh, file hoặc thư mục — cũng copy được nguyên văn.')] }),
  new Paragraph({ spacing: { after: 80, line: 288 }, numbering: { reference: 'cham', level: 0 }, children: [
    new TextRun('Thay '), new TextRun({ text: 'IP_VPS', font: MONO, color: 'A3410E' }),
    new TextRun(' bằng địa chỉ IP thật của VPS, '), new TextRun({ text: 'root', font: MONO, color: 'A3410E' }),
    new TextRun(' bằng user đang chạy OpenClaw nếu khác.')] }),
  new Paragraph({ spacing: { after: 80, line: 288 }, numbering: { reference: 'cham', level: 0 }, children: [
    new TextRun('Đừng gõ lại lệnh bằng tay trong Word rồi copy: Word tự đổi dấu nháy thẳng thành nháy cong, lệnh sẽ hỏng. Copy từ các khung có sẵn là an toàn.')] }),
  new Paragraph({ spacing: { after: 120, line: 288 }, numbering: { reference: 'cham', level: 0 }, children: [
    new TextRun('Phần A làm '), new TextRun({ text: 'một lần', bold: true }),
    new TextRun(' khi cài. Phần B đọc khi dùng hằng ngày.')] }),
];

const logo = fs.readFileSync('logo.png');
const ngay = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const doc = new Document({
  creator: 'OpenClaw nhóm A', title: 'Bộ 4 Skill nhóm A cho OpenClaw — Cài đặt & Sử dụng',
  description: 'Hướng dẫn cài đặt và sử dụng 4 skill: second-brain, pdf-extract-crop, css-video-production, pptx-deck-builder',
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: '1B2433' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 40, bold: true, color: NAVY, font: FONT },
        paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0, pageBreakBefore: true,
          border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: CAM, space: 6 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: XANH, font: FONT },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 1,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VANG, space: 4 } } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, color: CAM, font: FONT },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 2 } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: NAVY, font: FONT },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 3 } },
    ],
  },
  numbering: { config: [
    { reference: 'cham', levels: [0, 1, 2].map((l) => ({ level: l, format: LevelFormat.BULLET, text: ['•', '◦', '▪'][l],
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400 + l * 360, hanging: 260 } } } })) },
    { reference: 'so', levels: [0, 1].map((l) => ({ level: l, format: LevelFormat.DECIMAL, text: `%${l + 1}.`,
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420 + l * 360, hanging: 300 } } } })) },
  ] },
  sections: [
    { // bìa
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1700, bottom: 1134, left: MARGIN, right: MARGIN } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
          children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 210, height: 210 },
            altText: { title: 'Thái Cực – Tiên Thiên Bát Quái', description: 'Biểu tượng Second Brain', name: 'logo' } })] }),
        p('BỘ 4 SKILL NHÓM A CHO OPENCLAW', { align: AlignmentType.CENTER, bold: true, size: 44, color: NAVY, after: 120 }),
        p('Hướng dẫn cài đặt & sử dụng', { align: AlignmentType.CENTER, size: 32, color: CAM, after: 480 }),
        p('second-brain  ·  pdf-extract-crop  ·  css-video-production  ·  pptx-deck-builder',
          { align: AlignmentType.CENTER, size: 22, color: XANH, font: MONO, after: 120 }),
        p('Chạy hoàn toàn trên VPS — không cần khoá API, không tốn phí',
          { align: AlignmentType.CENTER, size: 22, color: XAM, italics: true, after: 1400 }),
        p('Phần A — Cài đặt (làm một lần)', { align: AlignmentType.CENTER, size: 24, bold: true, color: NAVY, after: 60 }),
        p('Phần B — Sử dụng hằng ngày', { align: AlignmentType.CENTER, size: 24, bold: true, color: NAVY, after: 600 }),
        p(`Bản cuối · ${ngay}`, { align: AlignmentType.CENTER, size: 20, color: XAM }),
      ],
    },
    { // mục lục + nội dung
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1134, bottom: 1134, left: MARGIN, right: MARGIN },
        pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: 'OpenClaw · 4 skill nhóm A', size: 16, color: XAM })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ['Trang ', PageNumber.CURRENT], size: 16, color: XAM })] })] }) },
      children: [
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Mục lục', bold: true, size: 36, color: NAVY })] }),
        ...MUC.map((m) => new Paragraph({
          spacing: { before: m.lv === 1 ? 160 : 0, after: 40 }, indent: { left: m.lv === 1 ? 0 : 360 },
          children: [new InternalHyperlink({ anchor: m.id, children: [new TextRun({ text: m.text,
            bold: m.lv === 1, size: m.lv === 1 ? 23 : 21, color: m.lv === 1 ? NAVY : XANH })] })],
        })),
        p('Bấm vào một dòng để nhảy tới phần đó (Word: giữ Ctrl rồi bấm).', { size: 17, color: XAM, italics: true, before: 160 }),
        ...huongDanCopy,
        PART_A_H,
        ...partA,
        PART_B_H,
        ...partB,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2] || 'out.docx', buf);
  console.log('ok', buf.length);
});
