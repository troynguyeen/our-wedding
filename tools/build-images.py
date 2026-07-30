#!/usr/bin/env python3
"""Generate the web-ready photo set in assets/photos/ from Wedding/SOURCE HÌNH/.

Every photo the site uses is declared in RECIPES below, so the mapping from a
camera filename to its role in the design stays readable. Re-run after swapping
a source photo:

    python3 tools/build-images.py

HEIC sources are decoded through `sips` (macOS) into a temp JPEG first, because
Pillow cannot read them.
"""

import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Wedding", "SOURCE HÌNH")
OUT = os.path.join(ROOT, "assets", "photos")

# Widths emitted for each photo, wired up through srcset in index.html.
WIDTHS = (640, 1080, 1600)

# name          source file                  crop box (relative 0..1)   options
RECIPES = [
    # ── HOME · onboarding ─────────────────────────────────────────────────
    # Ghi chú: thẻ ảnh đầu màn HOME nay dùng thẳng hai file trong
    # Wedding/Material/ (xem MATERIALS), không còn dựng từ ảnh gốc nữa.
    # Polaroid inside the opened envelope (onboarding step 5). Same shot the
    # mockup uses; cropped to 0.78 portrait so the couple fills the frame.
    ("ob-polaroid", "IMG_1207.JPG", (0.055, 0.12, 0.945, 0.88), {}),

    # ── OUR STORY ─────────────────────────────────────────────────────────
    # Both café photos are landscape; take a portrait slice centred on each of
    # them so the arch mask frames a person rather than the street.
    ("story-groom", "IMG_4471.jpg", (0.25, 0.00, 0.75, 1.00), {"fade": True}),
    ("story-bride", "IMG_4472.jpg", (0.26, 0.00, 0.76, 1.00), {"fade": True}),
    # Nov 2024 — red roses and the first gift, in a circular mask. The source
    # stacks two photos; take only the lower one.
    ("story-nov2024", "24B8EED9-4A29-414A-9F82-BCF98ED9FCA5.JPG",
     (0.00, 0.52, 1.00, 1.00), {}),
    # Jan 2025 — the two of them, shown as a facing pair.
    ("story-jan2025-a", "IMG_7810.jpeg", (0.00, 0.30, 1.00, 1.00), {"fade": True}),
    ("story-jan2025-b", "IMG_7811.jpeg", (0.00, 0.00, 1.00, 0.72), {"fade": True}),
    # May 2026 — she said yes. Ring boxes on pink roses.
    ("story-may2026", "IMG_7946.heic", (0.00, 0.00, 1.00, 1.00), {}),
    # The proposal itself, middle frame of the three-up beach photo.
    ("story-proposal", "IMG_7996.HEIC", (0.00, 0.34, 1.00, 0.66), {}),
    # March 2027 — closing portrait.
    ("story-final", "FC54E441-84F2-4ADF-AF11-91134D666217.PNG",
     (0.02, 0.00, 0.98, 1.00), {}),

    # ── WEDDING DETAIL ────────────────────────────────────────────────────
    ("detail-strip-1", "IMG_1183.JPG", (0.06, 0.04, 0.94, 0.80), {}),
    ("detail-strip-2", "IMG_1210.JPG", (0.04, 0.02, 0.96, 0.78), {}),
    ("detail-strip-3", "IMG_1212.JPG", (0.04, 0.06, 0.96, 0.84), {}),
    ("detail-strip-4", "IMG_1180.JPG", (0.08, 0.02, 0.92, 0.78), {}),
]


# Tác phẩm ghép sẵn của designer trong Wedding/Material/. Khác RECIPES ở chỗ
# phải giữ kênh alpha.
#
# Hai file gốc mỗi file gộp nhiều thành phần, nên cắt thành từng mảnh rời để
# xếp lại được theo bố cục mong muốn. Toạ độ cắt lấy từ bounding box của kênh
# alpha, đo bằng chính script này — xem lịch sử lệnh đo trong tài liệu.
MATERIALS = [
    # tên chữ ký, tách khỏi thẻ ảnh để đặt vào trong khung
    ("home-names",    "picture & tẽt home.png",     (124, 195, 2280, 821)),
    # thẻ ảnh có viền trắng
    ("home-card",     "picture & tẽt home.png",     (86, 1211, 3329, 5503)),
    # mảnh giấy lời mời kèm triện sáp
    ("home-note",     "message and envelope.png",   (81, 42, 1252, 1850)),
    # phong thư mở, ảnh polaroid, triện và ngày
    ("home-envelope", "message and envelope.png",   (1788, 186, 3181, 1897)),
    # cụm đĩa "Our Wedding Details": dải lụa, đĩa sứ, thiệp có nơ, dao nĩa
    ("home-plate",    "plate wedding.png",          (0, 826, 3415, 3402)),
]

MATERIAL_SRC = os.path.join(ROOT, "Wedding", "Material")

# Vật thể lấy từ một tấm material bày nhiều thứ trên cùng một canvas trong
# suốt. Không cắt được bằng bounding box vì các vật thể dính nhau theo trục
# dọc, nên tô loang từ một điểm bên trong để lấy đúng vùng liền khối.
#   name, file nguồn, vùng khoanh, điểm tô loang (toạ độ tuyệt đối)
FLOOD_CUTS = [
    ("seal-ourstory", "envelope main session.png",
     (1000, 7400, 2500, 9400), (1750, 8550)),
]


def build_flood_cuts():
    from PIL import ImageDraw

    for name, filename, region, seed in FLOOD_CUTS:
        path = os.path.join(MATERIAL_SRC, filename)
        if not os.path.exists(path):
            print(f"{name}  <-  {filename}  (KHÔNG TÌM THẤY, bỏ qua)")
            continue

        im = Image.open(path).convert("RGBA")
        reg = im.crop(region)
        mask = reg.split()[-1].point(lambda v: 255 if v > 20 else 0).convert("L")
        ImageDraw.floodfill(mask, (seed[0] - region[0], seed[1] - region[1]), 128,
                            thresh=10)
        comp = mask.point(lambda v: 255 if v == 128 else 0)

        bb = comp.getbbox()
        box = (region[0] + bb[0], region[1] + bb[1],
               region[0] + bb[2], region[1] + bb[3])
        cut = Image.new("RGBA", (bb[2] - bb[0], bb[3] - bb[1]), (0, 0, 0, 0))
        cut.paste(im.crop(box), (0, 0), comp.crop(bb))

        out = os.path.join(ROOT, "assets", f"{name}.webp")
        cut.save(out, "WEBP", quality=88, method=6)
        print(f"{name}  <-  {filename}  {cut.size}  -> assets/{name}.webp")


def build_materials():
    for name, filename, box in MATERIALS:
        path = os.path.join(MATERIAL_SRC, filename)
        if not os.path.exists(path):
            print(f"{name}  <-  {filename}  (KHÔNG TÌM THẤY, bỏ qua)")
            continue
        im = Image.open(path).convert("RGBA").crop(box)
        print(f"{name}  <-  {filename}  {im.size}")
        for width in WIDTHS:
            if width > im.width * 1.4:
                continue
            h = round(im.height * width / im.width)
            frame = im.resize((width, h), Image.LANCZOS)
            suffix = "" if width == WIDTHS[0] else f"@{width}"
            out = os.path.join(OUT, f"{name}{suffix}.webp")
            frame.save(out, "WEBP", quality=86, method=6)
            print(f"  {os.path.basename(out):28} {width}x{h}")


def load(filename, tmpdir):
    """Open a source photo, decoding HEIC through sips when needed."""
    path = os.path.join(SRC, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    if filename.lower().endswith((".heic", ".heif")):
        decoded = os.path.join(tmpdir, filename + ".jpg")
        subprocess.run(
            ["sips", "-s", "format", "jpeg", path, "--out", decoded],
            check=True, capture_output=True,
        )
        path = decoded

    im = Image.open(path)
    # Honour the camera's rotation flag before any cropping happens.
    try:
        from PIL import ImageOps
        im = ImageOps.exif_transpose(im)
    except Exception:
        pass
    return im.convert("RGB")


def motion_blur(im, length_px, angle_deg):
    """Directional (motion) blur — averages copies shifted along one axis.

    Mockup 6's hero photo is smeared vertically, not softened evenly: vertical
    edges stay crisp while horizontal detail streaks. A Gaussian blur cannot
    reproduce that, so average shifted copies instead.

    Edges are replicated into a padded canvas first; without that, the shifted
    copies would average against empty pixels and leave dark bands.
    """
    import math

    length_px = max(2, int(round(length_px)))
    w, h = im.size
    pad = length_px

    big = Image.new(im.mode, (w + 2 * pad, h + 2 * pad))
    big.paste(im, (pad, pad))
    big.paste(im.crop((0, 0, w, 1)).resize((w, pad)), (pad, 0))
    big.paste(im.crop((0, h - 1, w, h)).resize((w, pad)), (pad, h + pad))
    tall = h + 2 * pad
    big.paste(big.crop((pad, 0, pad + 1, tall)).resize((pad, tall)), (0, 0))
    big.paste(big.crop((w + pad - 1, 0, w + pad, tall)).resize((pad, tall)), (w + pad, 0))

    dx = math.cos(math.radians(angle_deg))
    dy = math.sin(math.radians(angle_deg))
    steps = max(3, min(length_px, 41))

    acc = None
    for i in range(steps):
        t = (i / (steps - 1) - 0.5) * length_px
        off = big.transform(big.size, Image.AFFINE,
                            (1, 0, dx * t, 0, 1, dy * t), resample=Image.BILINEAR)
        acc = off if acc is None else Image.blend(acc, off, 1.0 / (i + 1))

    return acc.crop((pad, pad, pad + w, pad + h))


def feather_bottom(im):
    """Fade the bottom quarter to transparent so a portrait melts into the page."""
    im = im.convert("RGBA")
    w, h = im.size
    alpha = im.split()[-1]
    start = int(h * 0.72)
    mask = Image.new("L", (1, h), 255)
    for y in range(start, h):
        t = (y - start) / max(1, h - start)
        mask.putpixel((0, y), int(255 * (1 - t) ** 1.6))
    alpha = Image.composite(alpha, Image.new("L", (w, h), 0), mask.resize((w, h)))
    im.putalpha(alpha)
    return im


def emit(name, im, opts):
    fade = opts.get("fade")
    for width in WIDTHS:
        if width > im.width * 1.4:
            continue
        h = round(im.height * width / im.width)
        frame = im.resize((width, h), Image.LANCZOS)

        if opts.get("blur"):
            radius = opts["blur"] * width / WIDTHS[-1]
            frame = frame.filter(ImageFilter.GaussianBlur(radius))

        if opts.get("motion"):
            fraction, angle = opts["motion"]
            frame = motion_blur(frame, fraction * frame.height, angle)

        if opts.get("grade"):
            # hệ số nhân từng kênh: nâng sáng và kéo tông ấm lên, vì bản gốc
            # chụp tường bê tông nên ngả xám lạnh so với mockup
            rg, gg, bg = opts["grade"]
            r, g, b = frame.split()
            frame = Image.merge("RGB", (
                r.point(lambda v: min(255, round(v * rg))),
                g.point(lambda v: min(255, round(v * gg))),
                b.point(lambda v: min(255, round(v * bg))),
            ))

        if fade:
            frame = feather_bottom(frame)

        suffix = "" if width == WIDTHS[0] else f"@{width}"
        out = os.path.join(OUT, f"{name}{suffix}.webp")
        frame.save(out, "WEBP", quality=82, method=6)
        print(f"  {os.path.basename(out):28} {width}x{h}")


def main():
    os.makedirs(OUT, exist_ok=True)
    tmpdir = tempfile.mkdtemp(prefix="wedding-img-")
    try:
        for name, filename, box, opts in RECIPES:
            im = load(filename, tmpdir)
            w, h = im.size
            l, t, r, b = box
            im = im.crop((round(w * l), round(h * t), round(w * r), round(h * b)))
            print(f"{name}  <-  {filename}")
            emit(name, im, opts)
        build_materials()
        build_flood_cuts()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    print("\nDone.")


if __name__ == "__main__":
    sys.exit(main())
