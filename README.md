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
  story.css             sân khấu khoá tỉ lệ, dựng đúng mockup 7
  detail.css            trái tim, lịch trình, bản đồ, RSVP
js/
  main.js               khởi động, nối các module
  router.js             chuyển màn hình + vuốt ngang
  onboarding.js         máy trạng thái 5 bước
  scratch.js            lớp nhũ bạc cào được
  sfx.js                tiếng cào giấy, bám theo ngón tay
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

## Dựng lại dải ảnh màn OUR STORY

```bash
python3 tools/build-story-bands.py
```

Màn OUR STORY khác hai màn kia: mockup 7 là một collage phân lớp — người tách
nền tràn ra mép, chồng lên nhau, chữ đặt đè lên ảnh. Không dựng lại được bằng
luồng khối thông thường, nên cả màn là **một sân khấu khoá `aspect-ratio` đúng
bằng mockup (4098×19770)**; bốn dải ảnh cắt thẳng từ mockup xếp khít nhau, chữ
là HTML đặt tuyệt đối theo toạ độ mockup.

Hai điều phải nhớ khi sửa màn này:

- **Chữ không reflow, nó phóng theo khung.** Đổi nội dung dài ngắn khác đi là
  vỡ bố cục — phải chỉnh `--fs` tương ứng trong `css/story.css`.
- **Số trong CSS là toạ độ điểm ảnh trên mockup gốc**, không phải phần trăm;
  `calc()` lo phần quy đổi. Cần đo lại thì mở thẳng file mockup mà đối chiếu.

Nền màn dùng `--cream-mock` (`#fffcef`, kem của mockup) chứ không phải
`--cream-100`, vì các dải ảnh mang sẵn nền kem đó — lệch màu là lộ mép ảnh.

Phông chữ trong mockup (serif condensed cho tên người, serif chân bằng cho mốc
ngày) không có trong bộ site nạp và không nhận dạng được từ ảnh. Chữ vẫn để là
text thật, `--fs` được hiệu chỉnh cho khớp **bề ngang** từng khối — sát nhất có
thể mà không để hai cột tên đè nhau. Có file phông gốc thì thả vào
`assets/fonts/`, khai `@font-face` là khớp tuyệt đối.

## Dựng lại ảnh đôi uyên ương (khối tim màn WEDDING DETAIL)

```bash
python3 tools/build-couple.py
```

Tách `Wedding/SOURCE HÌNH/IMG_4470.jpg` khỏi nền đường phố rồi bồi viền trắng
kiểu sticker như mockup 8, xuất `assets/photos/detail-couple.webp`.

Ảnh gốc chụp ngoài đường (nhà cửa, xe máy, cây) nên không key màu được. Máy
không có `rembg`, nhưng macOS có sẵn Vision: `tools/cutout.swift` gọi
`VNGenerateForegroundInstanceMaskRequest` để lấy mặt nạ chủ thể. Script Python
tự biên dịch file Swift đó (cần Xcode Command Line Tools), chạy, rồi nở mặt nạ
ra ~2% bề ngang để làm viền trắng.

Vị trí đặt trong khối tim (`--fs`, `left`, `bottom` trong `css/detail.css`) dò
bằng cách quét tỉ lệ và độ lệch, chọn bộ tham số cho sai lệch điểm ảnh nhỏ nhất
so với mockup — không ướm bằng mắt.

## Dựng lại tiếng cào giấy

```bash
python3 tools/build-audio.py
```

Đọc `Wedding/paper scratching sound .mov`, gộp về mono, cắt phần lặng ở đầu,
chuẩn hoá lên −3 dBFS rồi mã hoá AAC 96kbps thành `assets/sfx-scratch.m4a`
(~35KB). Máy không có `ffmpeg` nên dùng `afconvert` của macOS.

Không cắt phần đuôi: đuôi file đã tắt hẳn về 0 nên điểm nối khi loop không nghe
"cạch" — cắt đi mới sinh ra bước nhảy biên độ đó. Âm lượng phát ra do hằng
`VOLUME` trong `js/sfx.js` quyết, chỉnh ở đó chứ không phải mã hoá lại file.

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
- **Màn WEDDING DETAIL còn cao hơn mockup 26%.** Nhịp dọc đã siết từ 6.22×
  xuống 4.97× bề ngang (mockup 3.98×): khối tim khớp đúng 0.995×, chân trang
  lệch 6%, bản đồ lệch 5%. Hai khối không siết thêm được vì đụng ngưỡng dùng
  được, không phải vì chưa làm: lịch trình (+28%) vướng sàn chữ 13px trong
  `tokens.css`, còn RSVP (+64%) vướng font 16px của ô nhập (nhỏ hơn là Safari
  iOS tự phóng khi bấm vào) và vùng chạm 44px của nút chọn. Mockup vẽ form ở
  khung 4098px nên chữ nhỏ hơn ngưỡng đọc được khi quy về bề ngang thật; phần
  form trong mockup cũng là ảnh chụp form chưa style chứ không phải thiết kế.

- **Màn OUR STORY thiếu đúng phông của mockup.** Bố cục và ảnh đã khớp bản thiết
  kế (sai lệch điểm ảnh trung bình 5.88/255 so với mockup; dải chỉ có ảnh là
  1.6). Phần còn lệch chỉ là mặt chữ: mockup dùng một serif condensed cho tên
  người và một serif chân bằng cho mốc ngày, cả hai đều không có trong bộ Google
  Fonts site nạp. Hệ quả thấy được: chữ thấp hơn bản thiết kế đôi chút, và khối
  lời kết tuy đúng 10 dòng, đúng nhịp dòng, nhưng ngắt dòng ở chỗ khác. Xin được
  file phông từ designer rồi khai `@font-face` là hết lệch.
