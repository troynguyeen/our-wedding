# Thiệp mời cưới online — Chí Thành & Ngọc Trinh

Dựng theo 8 mockup đánh số trong `Wedding/Wedding Invitation Flow/`, ảnh lấy từ
`Wedding/SOURCE HÌNH/`. Ưu tiên mobile: bố cục không tràn ngang ở bất kỳ bề ngang
máy nào.

Chủ nhật **07.03.2027** · Claris Palace Hall, 22 Hiệp Bình, Thủ Đức, TP.HCM.

## Chạy thử

Cần chạy qua HTTP — mở thẳng `file://` sẽ chặn ES module:

```bash
python3 -m http.server 8099
```

Rồi mở <http://localhost:8099>.

## Cấu trúc

```
index.html              onboarding + 3 màn hình
css/
  tokens.css            bảng màu, thang chữ, nền tảng chống tràn
  onboarding.css        phong thư · cào thiệp · mở thư
  home.css              collage, đếm ngược, sổ mời, đĩa
  story.css             giới thiệu, dòng thời gian, lời kết
  detail.css            trái tim, lịch trình, bản đồ, RSVP
js/
  main.js               khởi động, nối các module
  router.js             chuyển màn hình + vuốt ngang
  onboarding.js         máy trạng thái 5 bước
  scratch.js            lớp nhũ bạc cào được
  reveal.js             hiện dần khi cuộn + thị sai
  countdown.js          đếm ngược, neo ở +07:00
  audio.js              nhạc nền theo đĩa than
  rsvp.js               form xác nhận tham dự
assets/photos/          ảnh WebP dựng từ SOURCE HÌNH
tools/                  script dựng ảnh + kiểm thử (không deploy)
```

## Luồng

```
onboarding: niêm phong → cào → hiện thiệp → thư đóng lại → thư mở → HOME
HOME  ──[triện Our Story]──▶  OUR STORY  ──[nav ›]──▶  WEDDING DETAIL
      ──[đĩa Wedding Details]────────────────────────▶
```

Ba màn nằm chung một tài liệu, chuyển bằng mờ chồng chứ không tải lại trang: không
chớp trắng, nhạc chạy xuyên suốt, ảnh giữ nguyên trong cache. Trên máy cảm ứng có
thể vuốt ngang để chuyển.

## Dựng lại ảnh

Sau khi thay ảnh trong `Wedding/SOURCE HÌNH/`, sửa bảng `RECIPES` trong
`tools/build-images.py` rồi chạy:

```bash
python3 tools/build-images.py
```

Sinh WebP ở 640 / 1080 / 1600px cho `srcset`. Ảnh HEIC được giải mã qua `sips`.

## Kiểm thử

Cần server đang chạy ở cổng 8099. Không cần cài gói nào — điều khiển Chrome qua
DevTools Protocol bằng WebSocket có sẵn của Node 24.

```bash
node tools/audit.mjs                 # kiểm tràn ngang mọi khổ máy
node tools/audit.mjs --shots         # kèm chụp màn hình vào tools/shots/
node tools/audit.mjs --w 844 --h 390 # máy nằm ngang
node tools/flow-check.mjs            # chạy thật luồng cào thiệp → HOME
node tools/flow-check.mjs --reduced  # chế độ tắt chuyển động
```

Soi riêng từng bước của màn mở thiệp:

```bash
node tools/audit.mjs --screen ob --state scratch --shots
```

## Còn để ngỏ

- **RSVP chưa có backend.** Phản hồi lưu trong `localStorage` của máy khách; nối API
  tại chỗ đánh dấu trong `js/rsvp.js`.
- **Chân dung ở OUR STORY chưa tách nền** vì không ảnh gốc nào có kênh alpha. Hiện
  dùng mặt nạ vòm với đáy mờ dần hoà vào nền kem. Nếu có file PNG nền trong, đặt
  vào `assets/photos/cut-groom.png` và `cut-bride.png` là CSS tự nhận.
