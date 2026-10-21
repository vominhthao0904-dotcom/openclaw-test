# Dựng lại file Word hướng dẫn

Dùng khi sửa `CAI-DAT.md` / `HUONG-DAN.md` và muốn xuất lại bản Word (cần `pandoc`, Node.js có gói `docx`, Python 3).

```bash
cd cong-cu-word
for f in CAI-DAT HUONG-DAN; do pandoc -f gfm -t json ../$f.md -o $f.json; done
node build.js OpenClaw-NhomA-Cai-dat-va-Su-dung.docx
python3 fix_order.py OpenClaw-NhomA-Cai-dat-va-Su-dung.docx
```

Khối lệnh trong Word: mỗi dòng lệnh là một đoạn riêng (không dùng ngắt dòng mềm), font Consolas,
nháy thẳng, không gạch chính tả — bôi đen, Ctrl+C, dán vào terminal là chạy.
