#!/usr/bin/env python3
"""Cắt các dải ảnh của màn OUR STORY thẳng từ mockup 7.

    python3 tools/build-story-bands.py

Màn OUR STORY là một collage phân lớp: người được tách nền, tràn ra mép, chồng
lên nhau và hoà vào mảng hoa. Bộ Wedding/Material/ không có các cutout rời đó —
designer cắt thẳng trong file mockup — nên nguồn duy nhất dựng lại đúng 100% là
chính file mockup.

Vì nền mockup là một màu kem phẳng (#fffcef), ta nướng luôn nền vào từng dải:
không cần tách alpha, không cần clip-path, và bốn dải xếp khít nhau cho lại đúng
từng điểm ảnh của bản thiết kế. Điều kiện duy nhất là màn hình phải dùng đúng
màu kem đó (xem --cream-mock trong css/tokens.css).

Toạ độ dưới đây đo trên mockup gốc 4098×19770. Đừng sửa tay: nếu mockup thay
đổi, đo lại rồi cập nhật ở đây.
"""

import sys
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'Wedding' / 'Wedding Invitation Flow' / '7 - OUR STORY.png'
OUT = ROOT / 'assets' / 'photos'

MOCK_W, MOCK_H = 4098, 19770

# Bề ngang xuất ra. Sân khấu bị chặn ở --wrap (34rem = 544px), nên 1080 đủ cho
# màn 2x mà vẫn còn dư.
WIDTHS = (640, 1080)

# tên file            y bắt đầu  y kết thúc   nội dung
BANDS = [
    # 2100 là khe kem sạch ngay dưới dòng "người trên núi/trời"; cắt cao hơn sẽ
    # nướng luôn chữ vào ảnh, mà chữ thì phải là HTML
    ('story-card',      2100,  5072),  # nửa dưới thẻ giới thiệu: chân dung, viền, nửa trên triện
    ('story-disc',      5072,  9320),  # nửa dưới triện + ảnh hoa hồng bo cung + khoảng kem
    ('story-collage',   9320, 16150),  # mảng collage liền mạch: người, hoa, hộp nhẫn
    ('story-close',    16150, 19770),  # khoảng kem + ảnh cưới viền trắng tràn mép
]


# Chữ trong mockup phải bị xoá khỏi ảnh, vì màn hình vẽ lại chữ đó bằng HTML —
# để nguyên là chữ hiện hai lần, lệch nhau. Mọi khối chữ đều nằm trên nền kem
# phẳng nên tô đè kem là sạch. Toạ độ mockup, đã nới rộng ra khỏi vệt mực.
TEXT_BOXES = [
    (1630, 8035, 2530, 8220),    # Nov 2024
    (1420, 8335, 2745, 8445),    # When Two Opposites Attract
    (2025, 8515, 2140, 9115),    # chấm 1 + vạch 1 (dính nhau, phải gộp một khung)
    (1650, 9120, 2510, 9305),    # Jan 2025
    # Khung này lách qua khe 24px giữa tóc chú rể (hết ở x=1516) và chữ
    # (bắt đầu x≈1531). Nới biên trái ra nữa là ăn vào tóc.
    (1524, 9424, 2700, 9534),    # Officially Started Dating
    (2025, 9600, 2140, 10140),   # chấm 2 + vạch 2
    (1630, 10215, 2530, 10430),  # May 2026
    (1785, 10510, 2375, 10615),  # She Said Yes
    (2025, 10685, 2140, 11220),  # chấm 3 + vạch 3
    (1525, 15905, 2575, 16095),  # March 2027
    (1120, 16195, 2905, 16330),  # And Now… We're Getting Married!
    (1995, 16390, 2110, 16900),  # chấm 4 + vạch 4
    (255, 16905, 1545, 17235),   # Thành & Trinh
    (160, 17335, 1715, 19075),   # hai đoạn lời kết
]

CREAM = (255, 252, 239)


def wipe_text(im):
    """Tô kem đè lên các khối chữ, sau khi đã tự kiểm tra là an toàn.

    Mỗi khung phải có viền hoàn toàn là kem thì mới chắc nó chỉ bọc chữ chứ
    không ăn vào ảnh. Sai một khung là mất một mảng ảnh, nên thà dừng hẳn còn
    hơn lặng lẽ cho ra asset hỏng.
    """
    px = im.load()

    def is_cream(c):
        return all(abs(c[i] - CREAM[i]) < 10 for i in range(3))

    for x0, y0, x1, y1 in TEXT_BOXES:
        edge = ([(x, y0) for x in range(x0, x1, 4)] + [(x, y1 - 1) for x in range(x0, x1, 4)]
                + [(x0, y) for y in range(y0, y1, 4)] + [(x1 - 1, y) for y in range(y0, y1, 4)])
        bad = [p for p in edge if not is_cream(px[p])]
        if bad:
            sys.exit(f'khung {(x0, y0, x1, y1)} chạm vào ảnh tại {bad[:3]} — nới lại trước khi dựng')
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x, y] = CREAM
    print(f'đã xoá {len(TEXT_BOXES)} khối chữ khỏi ảnh (màn hình tự vẽ lại bằng HTML)')


def main():
    if not SRC.exists():
        sys.exit(f'thiếu mockup: {SRC}')

    im = Image.open(SRC).convert('RGB')
    if im.size != (MOCK_W, MOCK_H):
        sys.exit(f'mockup đổi kích thước: {im.size}, chờ {(MOCK_W, MOCK_H)} — phải đo lại BANDS')

    wipe_text(im)
    OUT.mkdir(parents=True, exist_ok=True)

    # các dải phải phủ liên tục, không hở không chồng, nếu không sẽ thấy đường
    # nối ngang khi xếp lại
    for (_, _, end), (name, start, _) in zip(BANDS, BANDS[1:]):
        if end != start:
            sys.exit(f'dải {name} không khít dải trước: {end} != {start}')

    for name, top, bottom in BANDS:
        band = im.crop((0, top, MOCK_W, bottom))
        for w in WIDTHS:
            h = round(band.height * w / MOCK_W)
            out = OUT / (f'{name}.webp' if w == WIDTHS[0] else f'{name}@{w}.webp')
            band.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
            print(f'{out.relative_to(ROOT)}  {w}×{h}  {out.stat().st_size / 1024:.1f} KB')
        print(f'   → tỉ lệ {MOCK_W}:{bottom - top}  '
              f'({(top / MOCK_H) * 100:.3f}% → {(bottom / MOCK_H) * 100:.3f}% chiều cao sân khấu)')


if __name__ == '__main__':
    main()
