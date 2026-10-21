"""Sắp lại phần tử con của <w:pBdr> theo đúng thứ tự schema: top, left, bottom, right, between, bar."""
import re, sys, zipfile, shutil, os
ORDER = ["top", "left", "bottom", "right", "between", "bar"]
src = sys.argv[1]; tmp = src + ".tmp"
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename in ("word/document.xml", "word/styles.xml"):
            s = data.decode("utf-8")
            def sap(m):
                kids = re.findall(r"<w:(\w+) [^>]*/>", m.group(1))
                els = dict(zip(kids, re.findall(r"<w:\w+ [^>]*/>", m.group(1))))
                return "<w:pBdr>" + "".join(els[k] for k in ORDER if k in els) + "</w:pBdr>"
            s = re.sub(r"<w:pBdr>(.*?)</w:pBdr>", sap, s)
            # dấu trang: docx-js gán cùng w:id cho mọi bookmark -> đánh số lại, cặp start/end dùng chung số
            dem, mo = [100], []
            def bm(m):
                if m.group(1) == "Start":
                    dem[0] += 1; mo.append(dem[0]); k = dem[0]
                else:
                    k = mo.pop() if mo else 0
                return re.sub(r'w:id="\d+"', f'w:id="{k}"', m.group(0))
            s = re.sub(r"<w:bookmark(Start|End)\b[^>]*/>", bm, s)
            data = s.encode("utf-8")
        zout.writestr(item, data)
shutil.move(tmp, src)
