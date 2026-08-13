#!/usr/bin/env python3
"""Dựng ảnh đôi uyên ương tách nền cho khối tim màn WEDDING DETAIL.

    python3 tools/build-couple.py

Mockup 8 đặt đôi uyên ương ở góc dưới trái khối tim, tách khỏi nền đường phố
và viền một đường trắng kiểu sticker. Ảnh gốc chụp ngoài đường (nhà cửa, xe
máy, cây) nên không key màu được — phải phân vùng chủ thể thật.

Máy không có rembg, nhưng macOS có sẵn Vision. tools/cutout.swift gọi
VNGenerateForegroundInstanceMaskRequest để lấy mặt nạ chủ thể; script này biên
dịch nó (cần Command Line Tools), chạy, rồi bồi viền trắng và xuất WebP.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'Wedding' / 'SOURCE HÌNH' / 'IMG_4470.jpg'
SWIFT = ROOT / 'tools' / 'cutout.swift'
OUT = ROOT / 'assets' / 'photos'
NAME = 'detail-couple'

WIDTHS = (640, 1080)

# Viền trắng, tính theo phần trăm bề ngang chủ thể — đo trên mockup được ~2%.
HALO_PCT = 0.020
# Chừa thêm một chút quanh mép để viền không bị xén.
PAD_PCT = 0.035


def main():
    if not SRC.exists():
        sys.exit(f'thiếu ảnh gốc: {SRC}')

    with tempfile.TemporaryDirectory() as tmp:
        binary = Path(tmp) / 'cutout'
        print('biên dịch tools/cutout.swift …')
        subprocess.run(['swiftc', '-O', str(SWIFT), '-o', str(binary)], check=True)
        cut = Path(tmp) / 'cut.png'
        subprocess.run([str(binary), str(SRC), str(cut)], check=True)

        im = Image.open(cut).convert('RGBA')

    box = im.getchannel('A').getbbox()
    if box is None:
        sys.exit('mặt nạ rỗng — Vision không tìm được chủ thể')
    im = im.crop(box)
    print(f'chủ thể: {im.width}×{im.height}')

    halo = max(1, round(im.width * HALO_PCT))
    pad = max(halo + 2, round(im.width * PAD_PCT))
    im = _expand(im, pad)

    # Viền trắng = mặt nạ nở ra rồi tô trắng, đặt DƯỚI chủ thể.
    grown = im.getchannel('A').filter(ImageFilter.MaxFilter(halo * 2 + 1))
    # làm mềm răng cưa của phép nở
    grown = grown.filter(ImageFilter.GaussianBlur(halo * 0.18))
    grown = grown.point(lambda v: 255 if v > 120 else 0)

    sticker = Image.new('RGBA', im.size, (255, 255, 255, 0))
    sticker.putalpha(grown)
    sticker.paste(im, (0, 0), im)

    OUT.mkdir(parents=True, exist_ok=True)
    for w in WIDTHS:
        h = round(sticker.height * w / sticker.width)
        name = f'{NAME}.webp' if w == WIDTHS[0] else f'{NAME}@{w}.webp'
        path = OUT / name
        sticker.resize((w, h), Image.LANCZOS).save(path, 'WEBP', quality=90, method=6)
        print(f'{path.relative_to(ROOT)}  {w}×{h}  {path.stat().st_size / 1024:.1f} KB')
    print(f'tỉ lệ ảnh {sticker.width}:{sticker.height} = {sticker.width / sticker.height:.4f}')


def _expand(im, pad):
    canvas = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    return canvas


if __name__ == '__main__':
    main()
