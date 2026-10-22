#!/usr/bin/env python3
"""Cắt đồ hoạ màn WEDDING DETAIL thẳng từ mockup 8.

    python3 tools/build-detail.py

Cùng cách làm với tools/build-story-bands.py: mockup là nguồn duy nhất dựng
lại đúng 100%, vì trái tim, máy in, vé, kẹp, dải ảnh và tấm ren hoa đều được
designer ghép thẳng trong file mockup — bộ Wedding/Material/ không có bản rời.

Xuất ra:
  assets/photos/detail-heart*.webp  khối tim: trái tim, chữ, ngày, đôi uyên ương,
                                    dải rách và máy in (y 0 → 4106)
  assets/photos/detail-pass*.webp   vé + kẹp, nền kem (x 2850 → 4098, y 4106 → 6303)
  assets/photos/detail-strip*.webp  dải 4 ảnh (x 3178 → 3885, y 6303 → 9866), nối khít
                                    ngay dưới vé; đục, không nền nên tràn xuống nhung được
  assets/rsvp-lace.webp             nguồn border-image 9 ô cho khung ren hoa quanh RSVP
  assets/photos/detail-velvet.webp  vân nhung nền bản đồ + RSVP, dệt lại theo phổ và màu
                                    của nhung mockup, lặp liền mạch

Vé trong mockup in ngày 05.03.2027 và địa điểm Unique Wedding / Đặng Văn Bi —
dữ liệu mẫu của designer. Theo spec, thiệp dùng Claris Palace · 07.03.2027, nên
script xoá các dòng đó và in lại bằng Be Vietnam Pro (chữ số 7 thì chép nguyên
từ chính "2027" trên vé). Cần numpy + Pillow; phông tự tải nếu chưa có.

Toạ độ đo trên mockup gốc 4098×16320. Đừng sửa tay: mockup đổi thì đo lại.
"""

import math
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent.parent
NAME = '8 - wedding detail.png'
CANDIDATES = [
    ROOT / 'Wedding' / 'Wedding Invitation Flow' / NAME,
    ROOT / 'Wedding' / 'Material' / NAME,
    ROOT / 'Material' / NAME,
]
OUT = ROOT / 'assets' / 'photos'

MOCK_W, MOCK_H = 4098, 16320
CREAM = (255, 252, 239)          # nền kem mockup = --cream-mock

# ── các mảng cắt ────────────────────────────────────────────────────────
# 4106 là mép dưới tờ giấy trong khe máy in, cũng là hàng đầu tiên vé lộ ra:
# lấy làm ranh giới để vé "chui ra" đúng từ khe khi khối lịch trình cắt mép trên.
HEART = (0, 0, MOCK_W, 4106)
# Mép trái 2850 nằm giữa chữ lịch trình (dài nhất tới x 2830) và mép vé (≥ 2866).
PASS = (2850, 4106, MOCK_W, 6303)
# Dải ảnh phẳng màu #f8f7f3, mép sắc không đổ bóng, từ 6303 trở xuống chỉ còn nó
# (và nửa dưới chiếc kẹp nằm gọn trong bề ngang dải).
STRIP = (3178, 6303, 3885, 9866)

# ── sửa chữ trên vé ─────────────────────────────────────────────────────
# Vé xoay 90° + nghiêng 2.25°. Mọi toạ độ dưới đây đo trong khung đã xoay
# thẳng (Image.rotate(87.75, expand=True)) của vùng TICKET_FRAME.
TICKET_FRAME = (2850, 4106, MOCK_W, 6400)
TICKET_ANGLE = 87.75
INK = (64, 10, 10)
PAPER = (255, 255, 252)
# ngày: thay chữ số '5' (x 561→586) bằng '7' chép từ "2027" (x 789→813)
DIGIT_WIPE = (557, 704, 590, 757)
DIGIT_SRC = (786, 704, 817, 757)
DIGIT_DST_X = 558
# dòng giá trị cũ: điểm mực bắt đầu x≈764, chân chữ đo bên dưới
VALUE_WIPES = [
    (752, 808, 1362, 868),     # Unique Wedding & Event
    (752, 872, 1000, 932),     # Daisy Hall
    (752, 957, 1362, 1017),    # 38 Dang Van Bi, Thu Duc
    (752, 1021, 1075, 1078),   # Ward, HCMC
]
VALUE_X = 764
VALUE_LINES = [
    # (dòng thay thế, hàng chân chữ đo từ dòng cũ cùng vị trí)
    ('Claris Palace Hall', 'dest'),
    ('22 Hiệp Bình, Thủ Đức,', 'loc1'),
    ('TP.HCM', 'loc2'),
]
GLASSES_X = 1410               # cụm ly sâm panh bắt đầu từ đây — chữ không được chạm

FONT_URL = ('https://github.com/google/fonts/raw/main/ofl/bevietnampro/'
            'BeVietnamPro-Regular.ttf')

# ── khung ren hoa quanh RSVP ────────────────────────────────────────────
# Tấm ren là lưới bông: 5 cột chu kỳ 537.8px, hai bông góc cao 540px và 4 bông
# giữa mỗi cạnh dọc cao 629px (designer kéo giãn dọc). Cắt đúng trên các
# đường ranh giữa hai bông thì nối lặp không thấy mối.
LACE_X = (808, 1346, 2959, 3497)       # mép trái, ranh cột 1, ranh cột 4, mép phải
LACE_Y = (11979, 12519, 13148, 15035, 15575)  # mép trên, ranh hàng 1, +1 chu kỳ, ranh cuối, mép dưới
LACE_BOTTOM_TILE_X = 2421              # cột 3: dưới đáy cột 2 có mấy vệt màu lạc của form
LACE_COLOR = (178, 154, 148)
VELVET = (50, 2, 2)
VELVET_G_MAX = 9
CARD_BOX = (1159, 12214, 3153, 15324)  # thẻ form trắng + viền xám, nới vài px
CARD_RADIUS = 84


def find_mockup():
    for p in CANDIDATES:
        if p.exists():
            return p
    sys.exit('thiếu mockup 8 — đặt "%s" vào một trong:\n  %s'
             % (NAME, '\n  '.join(str(p.parent) for p in CANDIDATES)))


def emit(img, name, widths, quality, folder=OUT):
    folder.mkdir(parents=True, exist_ok=True)
    for w in widths:
        h = round(img.height * w / img.width)
        out = folder / (f'{name}.webp' if w == widths[0] else f'{name}@{w}.webp')
        img.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=quality, method=6)
        print(f'{out.relative_to(ROOT)}  {w}×{h}  {out.stat().st_size / 1024:.1f} KB')


# ═══════════════════════════════════════════════════════════════════════
# Vé
# ═══════════════════════════════════════════════════════════════════════
def rotate_matrix(w, h, angle):
    """Ma trận affine (đích → nguồn) giống hệt Image.rotate(angle, expand=True)."""
    a = -math.radians(angle)
    m = [math.cos(a), math.sin(a), 0.0, -math.sin(a), math.cos(a), 0.0]

    def t(x, y):
        return m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]

    cx, cy = w / 2, h / 2
    m[2], m[5] = t(-cx, -cy)
    m[2] += cx
    m[5] += cy
    xs, ys = zip(*(t(x, y) for x, y in ((0, 0), (w, 0), (w, h), (0, h))))
    nw = math.ceil(max(xs)) - math.floor(min(xs))
    nh = math.ceil(max(ys)) - math.floor(min(ys))
    m[2], m[5] = t(-(nw - w) / 2, -(nh - h) / 2)
    return nw, nh, m


def invert(m):
    a, b, c, d, e, f = m
    det = a * e - b * d
    ia, ib, id_, ie = e / det, -b / det, -d / det, a / det
    return [ia, ib, -(ia * c + ib * f), id_, ie, -(id_ * c + ie * f)]


def baseline(dark, box):
    """Hàng chân chữ của một dòng: hàng dưới cùng còn mực ở ≥ 1/3 số cột có mực
    (bỏ qua đuôi g, q, y và dấu phẩy, vốn chỉ chiếm vài cột)."""
    x0, y0, x1, y1 = box
    sub = dark[y0:y1, x0:x1]
    counts = sub.sum(1)
    need = counts.max() / 3
    rows = np.nonzero(counts >= need)[0]
    return y0 + rows.max() + 1


def font_file():
    cached = Path(tempfile.gettempdir()) / 'BeVietnamPro-Regular.ttf'
    if not cached.exists():
        print('tải Be Vietnam Pro …')
        urllib.request.urlretrieve(FONT_URL, cached)
    return str(cached)


def fix_ticket(mock):
    """Trả về mockup đã sửa ngày + địa điểm trên vé."""
    frame = mock.crop(TICKET_FRAME)
    w, h = frame.size
    nw, nh, m = rotate_matrix(w, h, TICKET_ANGLE)
    straight = frame.transform((nw, nh), Image.AFFINE, m, Image.BICUBIC, fillcolor=CREAM)

    px = np.asarray(straight).astype(int)
    dark = (px[..., 0] < 200) & (px[..., 1] < 160) & (px[..., 0] - px[..., 1] > 15)

    # chân chữ của ba dòng cũ, đo trực tiếp
    rows = {
        'dest': baseline(dark, VALUE_WIPES[0]),
        'loc1': baseline(dark, VALUE_WIPES[2]),
        'loc2': baseline(dark, VALUE_WIPES[3]),
    }
    # cỡ chữ: khớp chiều cao chữ hoa 'W' của "Ward"
    wx0, wy0, wx1, wy1 = VALUE_WIPES[3]
    cols = np.nonzero(dark[wy0:wy1, wx0:wx0 + 60].any(0))[0]
    wrows = np.nonzero(dark[wy0:wy1, wx0 + cols.min():wx0 + cols.max() + 1].any(1))[0]
    cap = wrows.max() - wrows.min() + 1
    probe = ImageFont.truetype(font_file(), 200)
    l, t, r, b = probe.getbbox('W', anchor='ls')
    size = 200 * cap / (b - t)
    font = ImageFont.truetype(font_file(), round(size))
    print(f'vé: chữ hoa cao {cap}px → Be Vietnam Pro {round(size)}px, chân chữ {rows}')

    # lớp vá vẽ trong khung đã xoay thẳng
    patch = Image.new('RGBA', (nw, nh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(patch)
    for box in VALUE_WIPES + [DIGIT_WIPE]:
        draw.rectangle((box[0], box[1], box[2] - 1, box[3] - 1), fill=PAPER + (255,))
    seven = straight.crop(DIGIT_SRC).convert('RGBA')
    patch.paste(seven, (DIGIT_DST_X, DIGIT_SRC[1]))
    for text, key in VALUE_LINES:
        draw.text((VALUE_X, rows[key]), text, font=font, fill=INK + (255,), anchor='ls')
        right = VALUE_X + draw.textlength(text, font=font)
        if right > GLASSES_X:
            sys.exit(f'dòng "{text}" dài tới x {right:.0f}, đè lên cụm ly sâm panh')

    # xoay lớp vá về đúng góc nghiêng của vé rồi đè lên mockup
    back = patch.transform((w, h), Image.AFFINE, invert(m), Image.BICUBIC)
    fixed = frame.convert('RGBA')
    fixed.alpha_composite(back)
    out = mock.copy()
    out.paste(fixed.convert('RGB'), TICKET_FRAME[:2])
    return out


# ═══════════════════════════════════════════════════════════════════════
# Ren hoa
# ═══════════════════════════════════════════════════════════════════════
def lace_alpha(mock):
    """Tách tấm ren khỏi nền nhung: điểm ảnh ren là pha trộn giữa màu nhung và
    màu chỉ ren, nên độ phủ đọc được từ kênh G (nhung gần như G = 0). Điểm nào
    không nằm trên đường pha trộn đó (viền xám của thẻ, vệt hồng vàng của form)
    thì loại."""
    x0, x1 = LACE_X[0], LACE_X[3]
    y0, y1 = LACE_Y[0], LACE_Y[4]
    px = np.asarray(mock.crop((x0, y0, x1, y1))).astype(np.float32)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    lc, v = np.array(LACE_COLOR, np.float32), np.array(VELVET, np.float32)
    # nhung lốm đốm tới G≈8: lấy đó làm mốc 0, kẻo cả nền nhung bị kéo theo thành
    # một lớp sương hồng mờ phủ lên nền thật của trang
    a = np.clip((g - VELVET_G_MAX) / (lc[1] - VELVET_G_MAX), 0, 1)
    r_pred = v[0] + a * (lc[0] - v[0])
    b_pred = v[2] + a * (lc[2] - v[2])
    off = (np.abs(r - r_pred) > 32) | (np.abs(b - b_pred) > 32) | (r - g < 10)
    a[off] = 0
    # thẻ bo góc: chỉ xoá đúng phần thẻ che, ren lộ ở bốn góc bo vẫn giữ
    card = Image.new('L', (x1 - x0, y1 - y0), 0)
    cx0, cy0, cx1, cy1 = CARD_BOX
    ImageDraw.Draw(card).rounded_rectangle(
        (cx0 - x0, cy0 - y0, cx1 - x0, cy1 - y0), radius=CARD_RADIUS, fill=255)
    a[np.asarray(card) > 0] = 0
    rgba = np.zeros(px.shape[:2] + (4,), np.uint8)
    rgba[..., :3] = LACE_COLOR
    rgba[..., 3] = np.round(a * 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def build_lace(mock):
    sheet = lace_alpha(mock)
    X, Y = LACE_X, LACE_Y
    ox, oy = X[0], Y[0]

    def cut(x, y, w, h):
        return sheet.crop((x - ox, y - oy, x - ox + w, y - oy + h))

    L, R = X[1] - X[0], X[3] - X[2]
    T, B = Y[1] - Y[0], Y[4] - Y[3]
    tw, th = X[1] - X[0], Y[2] - Y[1]           # một bông ngang, một bông dọc
    src = Image.new('RGBA', (L + tw + R, T + th + B), (0, 0, 0, 0))
    src.paste(cut(X[0], Y[0], L, T), (0, 0))                    # góc trên trái
    src.paste(cut(X[1], Y[0], tw, T), (L, 0))                   # cạnh trên
    src.paste(cut(X[2], Y[0], R, T), (L + tw, 0))               # góc trên phải
    src.paste(cut(X[0], Y[1], L, th), (0, T))                   # cạnh trái
    src.paste(cut(X[2], Y[1], R, th), (L + tw, T))              # cạnh phải
    src.paste(cut(X[0], Y[3], L, B), (0, T + th))               # góc dưới trái
    src.paste(cut(LACE_BOTTOM_TILE_X, Y[3], tw, B), (L, T + th))  # cạnh dưới
    src.paste(cut(X[2], Y[3], R, B), (L + tw, T + th))          # góc dưới phải

    half = src.resize((round(src.width / 2), round(src.height / 2)), Image.LANCZOS)
    out = ROOT / 'assets' / 'rsvp-lace.webp'
    # RGB là một màu phẳng, dung lượng nằm cả ở kênh alpha
    half.save(out, 'WEBP', quality=80, alpha_quality=75, method=6)
    print(f'{out.relative_to(ROOT)}  {half.width}×{half.height}  {out.stat().st_size / 1024:.1f} KB')
    print(f'   border-image-slice (ảnh nửa cỡ): {round(T / 2)} {round(R / 2)} {round(B / 2)} {round(L / 2)}'
          f'   — border-width theo mockup: {T} {R} {B} {L}')


# ═══════════════════════════════════════════════════════════════════════
# Nhung
# ═══════════════════════════════════════════════════════════════════════
# Nhung trong mockup bị bản đồ, ren, form che gần hết, chỉ hai lề bên RSVP là
# trơn — quá hẹp để cắt làm nền, còn ghép gương thì lộ hoa văn đối xứng. Nên
# dệt lại: nhiễu 1/f^β tuần hoàn (lặp liền mạch cả hai chiều), mang đúng phổ
# và phân bố màu đo trên lề trái mockup ở cỡ 1/8.
VELVET_SAMPLE = (0, 11900, 784, 16320)   # lề trái cạnh khung ren RSVP
VELVET_TILE = 512                        # = 4096px mockup ở cỡ 1/8: phủ đúng bề ngang
VELVET_SEED = 8


def build_velvet(mock):
    x0, y0, x1, y1 = VELVET_SAMPLE
    sample = mock.crop(VELVET_SAMPLE).resize(((x1 - x0) // 8, (y1 - y0) // 8), Image.BOX)
    px = np.asarray(sample).astype(np.float64).reshape(-1, 3)
    r_mean, r_std = px[:, 0].mean(), px[:, 0].std()
    g_fit = np.polyfit(px[:, 0], px[:, 1], 1)
    b_fit = np.polyfit(px[:, 0], px[:, 2], 1)

    # độ dốc phổ công suất của vân thật
    p = px[:, 0].reshape(sample.height, sample.width)[:96, :96]
    spec = np.abs(np.fft.fftshift(np.fft.fft2(p - p.mean()))) ** 2
    yy, xx = np.indices(spec.shape)
    rad = np.hypot(yy - 48, xx - 48).astype(int)
    prof = np.bincount(rad.ravel(), spec.ravel()) / np.bincount(rad.ravel())
    ks = np.arange(2, 40)
    beta = -np.polyfit(np.log(ks), np.log(prof[ks]), 1)[0]

    n = VELVET_TILE
    noise = np.random.default_rng(VELVET_SEED).standard_normal((n, n))
    fy, fx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing='ij')
    f = np.hypot(fy, fx)
    f[0, 0] = 1
    field = np.real(np.fft.ifft2(np.fft.fft2(noise) * f ** (-beta / 2)))
    z = (field - field.mean()) / field.std()

    r = r_mean + z * r_std
    rgb = np.stack([r, np.polyval(g_fit, r), np.polyval(b_fit, r)], axis=-1)
    img = Image.fromarray(np.clip(np.round(rgb), 0, 255).astype(np.uint8), 'RGB')
    path = OUT / 'detail-velvet.webp'
    img.save(path, 'WEBP', quality=90, method=6)
    print(f'{path.relative_to(ROOT)}  {n}×{n}  {path.stat().st_size / 1024:.1f} KB'
          f'  (R {r_mean:.1f}±{r_std:.1f}, β {beta:.2f})')


def main():
    sys.stdout.reconfigure(encoding='utf-8')   # console Windows mặc định cp1252
    src = find_mockup()
    mock = Image.open(src).convert('RGB')
    if mock.size != (MOCK_W, MOCK_H):
        sys.exit(f'mockup đổi kích thước: {mock.size}, chờ {(MOCK_W, MOCK_H)} — phải đo lại')

    emit(mock.crop(HEART), 'detail-heart', (640, 1080, 1600), 88)

    fixed = fix_ticket(mock)
    emit(fixed.crop(PASS), 'detail-pass', (420, 840), 90)
    emit(mock.crop(STRIP), 'detail-strip', (240, 480), 88)

    build_lace(mock)
    build_velvet(mock)


if __name__ == '__main__':
    main()
