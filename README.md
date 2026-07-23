# Thiệp mời cưới online — Chí Thành & Ngọc Trinh

Website thiệp mời dựng lại theo `Design Gốc/`, dùng đúng ảnh nền và các lớp hoạ tiết
đã tách sẵn trong `Material/`, với hiệu ứng chuyển động mô phỏng `Clips Animation/video.mp4`.

## Chạy thử

Cần chạy qua HTTP (mở thẳng `file://` sẽ bị chặn một số tài nguyên):

```bash
cd web
python -m http.server 8080
```

Rồi mở <http://localhost:8080>.

## Cấu trúc

```
web/
├─ index.html          # 3 màn: phong thư · thiệp chính · our story
├─ css/style.css       # bảng màu + toàn bộ hiệu ứng
├─ js/main.js          # mở thư, parallax, đếm ngược, nhạc, RSVP
└─ assets/             # ảnh đã tách lớp & nén từ Material/
```

## Ba màn hình

| Màn | Nội dung | Hiệu ứng |
|---|---|---|
| **1 · Phong thư** | nền xanh mờ, phong thư kem, triện sáp chữ T | chữ nổi dần lên, phong thư nhấc nhẹ, chạm để mở |
| **2 · Thiệp chính** | phong thư mở, Save the date, đếm ngược, boarding pass, bản đồ, RSVP | thiệp trượt ra khỏi phong thư theo cuộn, parallax lan/bồ câu, reveal từng khối |
| **3 · Our Story** | khung ren oval, chuyện tình, nhẫn cưới, ảnh cưới tách nền | mở bằng triện "Our Story", chuyển cảnh màn lụa |

### Màn Our Story dựng thế nào

Giống hệt `Design Gốc/3.png`: **một khung ren duy nhất** ôm trọn bài viết, cô dâu
chú rể đã tách nền đứng **bên trong và đè lên** phần dưới khung, bệ hoa che thân dưới.

**Khung ren co giãn được** — `frame-oval.webp` gốc là hình bầu dục cố định, không
ôm nổi bài viết dài trên màn hình hẹp (chữ sẽ tràn ra hai chỏm hẹp). Nên khung
được cắt làm 3 mảnh:

| Mảnh | Vai trò |
|---|---|
| `oval-top.webp` | chỏm trên, giữ nguyên tỉ lệ thật |
| `oval-mid.webp` | lát ren mỏng lấy **đúng chỗ eo rộng nhất** (nơi hai bên gần như thẳng đứng), lật gương thành ô lặp liền mạch |
| `oval-bot.webp` | chỏm dưới kèm hoa ly và chùm quả rủ |

CSS xếp 3 mảnh theo cột flex, mảnh giữa `repeat-y` giãn theo lượng chữ. Nhờ vậy
khung luôn ôm vừa bài viết, hai chỏm không méo, thớ ren không bị kéo thành vệt.

**Ảnh cưới tách nền** — `assets/couple-cutout.webp` tách từ `Material/IMG_1210.JPG`
bằng `rembg` (model `u2net_human_seg` + alpha matting, giữ viền tóc và ren váy).
Muốn tách lại từ ảnh khác: `rembg i <ảnh-gốc> <ảnh-ra>.png`, rồi cắt sát viền và
xuất WebP.

### Trình tự mở thư (bám theo video)

1. Chạm phong thư → triện sáp bung ra và mờ dần
2. Thiệp trượt lên khỏi phong thư
3. Màn lụa trắng quét từ dưới lên phủ kín, đổi màn, rồi quét tiếp lên trên
4. Hiện thiệp chính

## Bảng màu (lấy từ ảnh gốc)

| Biến | Mã | Dùng cho |
|---|---|---|
| `--green-1` | `#8fa068` | xanh sáng phía trên nền |
| `--green-2` | `#5f7442` | xanh trung |
| `--green-3` | `#2f3f26` | xanh đậm phía dưới |
| `--cream` | `#f7f1e3` | giấy thiệp |
| `--ink` | `#2c3823` | chữ xanh rêu |
| `--sage` | `#b9bd94` | triện sáp |
| `--gold` | `#c3a86c` | chữ lồng |
| `--wine` | `#8e2231` | nút *Gửi xác nhận* |

## Cần chỉnh trước khi gửi cho khách

**1. Ngày giờ** — sửa ở hai chỗ cho khớp nhau:
- `js/main.js` → hằng `WEDDING`
- `index.html` → khối `.bigdate` và `.pass__meta`

> ⚠️ **Thiết kế gốc đang ghi hai ngày khác nhau.** Trong `Design Gốc/2.png`, thiệp
> Save the date và phần đếm ngược ghi **07.03.27 / Sunday, 07 March 2027**, nhưng ô
> DATE trên boarding pass lại ghi **05.03.2027**. Ngày 07.03.2027 rơi đúng Chủ nhật
> (05.03.2027 là thứ Sáu), nên trang đang dùng **07.03.2027** ở mọi chỗ.
>
> Vì lý do đó, phần boarding pass được **dựng lại bằng chữ thật** thay vì dùng ảnh
> `assets/boarding-pass.webp` — nếu dùng ảnh thì trang sẽ hiện hai ngày mâu thuẫn.
> Cách này cũng giúp vé luôn nét và đọc được trên mọi cỡ màn hình. Muốn quay lại
> đúng ảnh của thiết kế, mở `css/style.css` và đổi:
> `.pass__img{ display:none }` → `display:block`, rồi `.pass__alt{ display:grid }` → `display:none`.
> Nhớ sửa ngày trong ảnh trước khi dùng.

**2. RSVP** — hiện lưu tạm vào `localStorage` của máy khách.
Muốn nhận được phản hồi thật thì nối vào Google Form / Sheet / API trong
`js/main.js`, ngay chỗ chú thích `// Lưu tạm trên máy khách`.

**3. Bản đồ** — ảnh bản đồ là ảnh tĩnh của thiết kế, bấm vào sẽ mở chỉ đường
Google Maps. Đổi địa chỉ ở thuộc tính `href` của `.mapcard` trong `index.html`.

## Nhạc nền

Bài **Beautiful In White** (`assets/music.mp3`) tự phát khi mở trang, lặp lại vô hạn,
bấm đĩa than để tạm dừng/phát tiếp:

- **Tự phát khi mở web** — trang thử phát nhạc ngay khi vừa tải xong. Hầu hết
  trình duyệt di động chặn autoplay có tiếng khi chưa có thao tác nào của người
  dùng, nên nếu bị chặn, nhạc sẽ tự bật ngay ở **cử chỉ chạm/click đầu tiên**
  (thường chính là lúc khách chạm mở phong thư — hành động "mở web" theo đúng
  nghĩa trải nghiệm của thiệp mời).
- **Bấm đĩa than để dừng/tiếp tục** — `pause()` không tua nhạc về đầu, nên bấm
  dừng rồi bấm lại sẽ phát tiếp đúng chỗ đang dừng, không phát lại từ đầu bài.
- **Lặp mãi mãi** — thẻ `<audio loop>` tự lặp lại toàn bộ bài hát vô hạn, không
  cần JavaScript can thiệp.

Muốn đổi nhạc: thay file `assets/music.mp3` bằng file khác (giữ nguyên tên),
hoặc sửa `src` của thẻ `<audio id="bgm">` trong `index.html`.

## Tương thích

- Mobile-first (thiết kế gốc là khổ dọc), có bố cục riêng cho màn ≥ 820px
- Boarding pass: màn nhỏ dùng ảnh gốc, màn lớn dựng lại bằng chữ thật cho sắc nét
- Tôn trọng `prefers-reduced-motion`
- Ảnh dùng WebP (hoạ tiết có nền trong suốt) và JPEG progressive (ảnh nền, ảnh cưới)
