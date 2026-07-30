# Nhật ký phiên làm việc — dựng lại UI thiệp cưới

**Ngày:** 2026-07-29 → 2026-07-30
**Thiết kế gốc:** `Wedding/Wedding Invitation Flow/` (8 mockup đánh số)
**Spec thiết kế:** [2026-07-29-wedding-invitation-redesign-design.md](./2026-07-29-wedding-invitation-redesign-design.md)

Tài liệu này ghi lại những gì đã làm, những quyết định quan trọng, và đặc biệt
là **các lỗi khó thấy** đã gặp — để lần sau không mất công tìm lại.

---

## 1. Kết quả

Toàn bộ UI được dựng lại theo 8 mockup, gồm màn mở thiệp và ba màn hình
(HOME · OUR STORY · WEDDING DETAIL) trong một tài liệu HTML duy nhất.

```
index.html                     onboarding + 3 màn hình
css/    tokens 253 · onboarding 433 · home 329 · story 229 · detail 472   (1716 dòng)
js/     main 37 · router 106 · onboarding 81 · scratch 170
        reveal 60 · countdown 45 · audio 34 · rsvp 50                     (583 dòng)
assets/photos/                 18 ảnh gốc × 3 kích thước, 7.7 MB
tools/  build-images.py · audit.mjs · flow-check.mjs
```

### Trạng thái kiểm chứng cuối phiên

| | kết quả |
|---|---|
| flow-check (chế độ thường) | 15/15 pass |
| flow-check (`--reduced`) | 12/12 pass |
| tràn ngang: 3 màn × 320/360/390/414/430 | 15/15 `overflow=0` |
| landscape 844×390 | pass |
| onboarding ở 320/430/landscape | pass |
| tham chiếu tài nguyên | 59, không thiếu file |
| ảnh sinh ra không dùng | không có |

---

## 2. Quyết định kiến trúc

**Một tài liệu, ba màn hình, router bằng hash.** Chuyển màn là mờ chồng
200ms/320ms chứ không tải lại trang — nhờ đó không chớp trắng, nhạc chạy
xuyên suốt, ảnh giữ nguyên trong cache. Màn không hoạt động bị gỡ khỏi luồng
bằng `[hidden]` để trang luôn cuộn bằng scroller gốc; đó là điều kiện để thanh
URL của Safari tự thu lại.

**Không có bước build.** Script ảnh là công cụ chạy tay, không phải build step.
Trang tĩnh chạy được ngay trên hosting hiện tại.

**Chống vỡ layout bằng vùng cắt, không bằng `overflow-x:hidden` toàn cục.**
Mỗi cụm trang trí nằm trong `.stage` riêng; container dùng
`width: min(100% - 2*pad, 34rem)`; mọi `font-size` là `clamp()` với sàn 13px.

---

## 3. Chuyển hướng lớn giữa phiên: dùng material của designer

Ban đầu tôi dựng lại từng mảnh của màn HOME bằng CSS (tên, thẻ ảnh, mảnh giấy,
phong thư, polaroid, ngày). Sau khi có `Wedding/Material/`, toàn bộ phần đó
được thay bằng ảnh ghép sẵn của designer.

**Vì sao đổi:** dựng tay không bao giờ khớp 100% — thiếu nơ lụa, hoa văn nổi,
nhánh lá rủ, bóng đổ. Dùng material thì mọi pixel là bản gốc.

**Đánh đổi:** chữ nằm trong ảnh nên không phải text thật. Đã bù bằng `<h1>` ẩn
và `alt` mô tả cho từng ảnh.

Gỡ được khoảng **4.500 ký tự CSS** dựng tay trong quá trình này.

### Cách xếp lớp hai material đầu

`picture & tẽt home.png` và `message and envelope.png` cùng khung ngang 3415px.
Mép trái mảnh giấy ở `x=87` (material 2) và mép trái thẻ ảnh ở `x=90`
(material 1) — lệch 3px trên 3415, tức **trùng khít**. Đó là bằng chứng hai file
là hai lớp của cùng một tài liệu, nên xếp nguyên cỡ, chỉ cần dịch dọc.

Về sau người dùng yêu cầu di chuyển từng mảnh riêng, nên cả hai được cắt thành
bốn mảnh rời theo bounding box của kênh alpha.

---

## 4. Các lỗi khó thấy đã gặp

Ghi lại đầy đủ vì đây là phần tốn thời gian nhất, và phần lớn **không phát hiện
được bằng cách đọc code hay nhìn ảnh chụp** — phải đo bằng số.

### 4.1 Lớp `opacity:0` nuốt cú chạm

Triệu chứng: chạm vào thân phong thư không mở được thiệp, chỉ vùng chữ phía
trên mới ăn.

Nguyên nhân: `.ob__pocket` (`opacity:0`, `z-index:4`) nằm đè lên phong thư.
**`opacity:0` không làm phần tử mất khả năng nhận chuột.**

Cách tìm: bắn click thật qua CDP vào 7 điểm trên phong thư và in ra
`document.elementFromPoint` tại mỗi điểm — 6/7 điểm trả về `img.ob__pocket`.

Sửa: đặt `pointer-events:none` cho mọi lớp trang trí. Vùng chạm thật chỉ còn
`.ob__env`, `.ob__foil` (lúc cào) và `.ob__skip`.

### 4.2 `canvas.width` mặc định là 300, không phải 0

Triệu chứng: lớp nhũ bạc không hiện, thiệp lộ chữ ngay từ đầu.

Nguyên nhân: `scratch.js` dùng `canvas.width ? ... : null` để đoán "đã vẽ chưa".
Nhưng canvas mới có `width = 300`, nên điều kiện luôn đúng — lần vẽ đầu tiên bị
hiểu nhầm là có nội dung cũ cần giữ, và `destination-in` xoá sạch lớp nhũ vừa
sơn.

Sửa: dùng cờ `painted` tường minh.

### 4.3 Canvas phình vô hạn thành 19200×9600

Do chính lần sửa 4.2 gây ra khi tôi bỏ `width/height` CSS của canvas.

`<canvas>` là **replaced element**: bỏ kích thước CSS thì nó lấy theo thuộc tính
`canvas.width`, mà `resize()` lại đặt thuộc tính đó bằng `rect.width × dpr` →
vòng lặp tự nhân đôi qua ResizeObserver.

Sửa: ghi rõ `width`/`height` theo phần trăm, cộng chốt chặn `MAX_SIDE = 3000`.

**Quy tắc rút ra:** canvas phải luôn có kích thước do CSS quyết định.

### 4.4 `lace-card.webp` không phải asset viền ren

Nó là **ảnh chụp form RSVP đã có sẵn khung ren**, phần giữa đục hoàn toàn
(độ phủ alpha = 1.0). Dùng làm `background` kéo giãn thì kéo cả cái form thành
mảng trắng sau thiệp.

Sửa: `border-image: url(...) 62 round` — chỉ vẽ vành 9 ô, bỏ phần giữa.

### 4.5 `padding` phần trăm của `<img>` lấy mốc là khung chứa

Triệu chứng: viền trắng polaroid phồng lên 22% thay vì 8%, bóp nhỏ ảnh bên trong.

Nguyên nhân: `padding: 8%` trên `<img>` tính theo bề ngang **khung chứa**
(`.ob__stage`, 331px), không phải bề ngang chính nó (119px).

Sửa: dùng `cqw`.

### 4.6 `overflow: clip` cắt mất phần nhô ra theo chiều dọc

Triện Our Story nhô 45.7px dưới đáy khung, bị `.stage` (`overflow:clip` cả hai
trục) xén.

Lần đầu tôi nới `padding-bottom` — cách này **không bền**: đệm ghi bằng `rem`
(cố định) còn phần nhô tính bằng `cqw` (co giãn), nên máy lớn hơn lại bị cắt.

Sửa gốc: `overflow-x: clip; overflow-y: visible`. Cặp `clip + visible` hợp lệ
theo chuẩn; `hidden + visible` thì trình duyệt ép vế visible thành `auto` và
sinh thanh cuộn.

### 4.7 Quy đổi nhầm chiều giữa hai trục

Tôi đặt `aspect-ratio: 41.4 / 19.8` cho thân phong thư, trong đó 19.8 là "27.6%
chiều cao thẻ quy sang đơn vị bề ngang". Nhưng quy đổi phải **nhân** tỉ lệ thẻ
(1.393), không phải chia → thân thư chỉ cao 14% thay vì 27.6%, làm ngày tháng
rơi ra ngoài mép giấy.

### 4.8 `str.replace` của Python đổi mọi chỗ khớp

Khi phóng to đĩa than 15%→21% rồi triện 21%→29.4%, lần thay thứ hai khớp luôn
đĩa than vừa đổi thành 21% → nó to hơn 96% thay vì 40%.

Phép đo bắt được ngay vì cả hai cùng ra 29.4%.

### 4.9 Ba lỗi của chính bộ kiểm thử

Đáng ghi vì suýt nữa báo hỏng oan cho code đúng:

- **`--dump-dom` treo** trong Chrome 150 → chuyển sang điều khiển qua DevTools
  Protocol bằng WebSocket có sẵn của Node 24.
- **`captureBeyondViewport` không raster hoá** phần chưa từng vào khung nhìn →
  ảnh chụp thiếu nội dung mà trang thật vẫn hiển thị. Sửa bằng cách cuộn hết
  trang một lượt trước khi chụp.
- **`Runtime.evaluate` không được tính là thao tác người dùng** → chính sách
  autoplay chặn nhạc, test báo hỏng. Sửa bằng cờ `userGesture: true`.

---

## 5. Bộ công cụ

Không cần cài gói nào — điều khiển Chrome qua DevTools Protocol bằng
`WebSocket` có sẵn của Node 24. Cần server chạy ở cổng 8099.

```bash
python3 -m http.server 8099          # trong thư mục gốc repo

python3 tools/build-images.py        # sinh lại toàn bộ ảnh
node tools/audit.mjs                 # kiểm tràn ngang mọi khổ máy
node tools/audit.mjs --shots         # kèm chụp màn hình
node tools/audit.mjs --screen ob --state scratch --shots
node tools/flow-check.mjs            # chạy thật luồng cào thiệp → HOME
node tools/flow-check.mjs --reduced  # chế độ tắt chuyển động
```

`audit.mjs` báo `scrollWidth` và **liệt kê chính xác phần tử nào** vượt mép
(bỏ qua phần tử có tổ tiên cắt tràn, vì chúng vô hại).

`build-images.py` có ba nhánh:
- `RECIPES` — ảnh chụp từ `SOURCE HÌNH`, hỗ trợ `blur`, `motion`, `grade`, `fade`
- `MATERIALS` — cắt mảnh từ tác phẩm ghép sẵn, giữ alpha
- `FLOOD_CUTS` — tô loang tách vật thể khỏi tấm bày nhiều thứ

---

## 6. Ba kỹ thuật xử lý ảnh tự viết

**`motion_blur()`** — nền mockup 6 là blur **chuyển động dọc**, không phải
Gauss: vân dọc của tường vẫn sắc trong khi chi tiết ngang bị kéo nhoè. Gauss
làm mờ đều mọi hướng nên không tái tạo được. Hàm này trung bình nhiều bản dịch
chuyển dọc theo một trục, có nới biên bằng cách nhân bản mép trước khi dịch —
thiếu bước đó thì các bản dịch trung bình với vùng rỗng và để lại dải tối ở rìa.

**`grade`** — ảnh gốc chụp tường bê tông nên ngả xám lạnh. Hệ số nhân từng kênh
`(1.15, 1.09, 1.07)` đẩy chênh lệch đỏ–lam từ +16 lên +27 (mockup là +20).

**`FLOOD_CUTS`** — con dấu "Our Story" trong `envelope main session.png` dính
liền khối với đĩa than theo trục dọc, không có hàng trống nào ngăn giữa (đã
quét kiểm tra), nên bounding box của alpha luôn dính cả hai. Tô loang từ một
điểm bên trong con dấu mới lấy được đúng vùng cần.

---

## 7. Chỗ cố tình lệch khỏi thiết kế

**Chữ trong mảnh giấy mời.** Mockup đặt đoạn này ở khoảng **1.3% bề ngang thẻ**
— quy ra máy 390px chỉ còn **~4.5px**, không đọc nổi. Đã đặt sàn 8px và bù bằng
cách nới bề ngang giấy + siết `line-height`, nên khối chữ cao hơn mockup chút ít.

Đây là chỗ duy nhất cố tình khác bản thiết kế.

**Chân dung OUR STORY chưa tách nền.** Không ảnh gốc nào có kênh alpha, nên
dùng mặt nạ vòm với đáy mờ dần hoà vào nền kem. Nếu có PNG nền trong, đặt vào
`assets/photos/cut-groom.png` và `cut-bride.png` là CSS tự nhận.

---

## 8. Bố cục màn HOME hiện tại

Sau nhiều vòng tinh chỉnh theo yêu cầu. Mọi phép dịch nhỏ viết bằng `cqw`
(1cqw = 1% bề ngang khung), **quy đổi ở bề ngang khung 351px** (máy 390px) —
nên giữ đúng tỉ lệ ở mọi khổ máy khác.

| phần tử | giá trị | ghi chú |
|---|---|---|
| `.hero__names` | `top:4.5%; width:66%` | canh giữa trong lòng thẻ |
| `.hero__collage` | `bottom:calc(17% - 1.99cqw); width:97.24%` | lệch tâm `-1.14cqw` bù cho dịch của mảnh giấy |
| `.hero__note` | `z-index:2; left:4.57cqw; width:44%` | nằm **trên** phong thư |
| `.hero__envelope` | `left:-0.57cqw; top:1.71cqw; width:53%; margin-left:-3%` | |
| `.vinyl` | `right:-2.98cqw; top:-3.35cqw; width:21%` | vắt qua góc trên phải |
| `.seal-btn` | `right:-2.92cqw; bottom:-13.02cqw; width:29.4%` | vắt xuống dưới đáy |

Muốn chỉnh tiếp thì đo bằng `probe` (xem mục 9) chứ đừng ước lượng bằng mắt —
sai số tích luỹ rất nhanh qua nhiều vòng.

---

## 9. Cách kiểm chứng vị trí bằng số

Trong phiên này tôi dùng script CDP đo toạ độ từng phần tử theo phần trăm của
thẻ ảnh, rồi so với số đo trên mockup. Cách này bắt được những sai lệch mà mắt
thường bỏ qua (ví dụ mục 4.7, 4.8).

Mẫu script nằm trong lịch sử phiên; ý tưởng cốt lõi:

```js
const card = document.querySelector('.hero__card').getBoundingClientRect();
const pct = r => ({
  x1: (r.left  - card.left) / card.width  * 100,
  x2: (r.right - card.left) / card.width  * 100,
  y1: (r.top   - card.top)  / card.height * 100,
  y2: (r.bottom- card.top)  / card.height * 100,
});
```

Đo mockup thì cắt vùng thẻ ảnh ra rồi phủ lưới phần trăm lên — đừng đọc toạ độ
theo khung ảnh gốc, vì thẻ ảnh không chiếm trọn khung.

---

## 10. Nhạc nền

Bắt đầu đúng lúc khách **cào xong lớp nhũ** (`onReveal` trong `onboarding.js`).

Trình duyệt chỉ cho phát nhạc trong một thao tác người dùng. Cú chạm mở thiệp
trước đó tạo "sticky activation" nên lệnh phát lúc cào xong vẫn được chấp nhận.

Có đường dự phòng: ở chế độ `prefers-reduced-motion` không có màn cào, nên
`openEnvelope()` cũng gọi `onReveal` — nếu không khách sẽ không bao giờ nghe
được. `play()` tự bỏ qua nếu nhạc đã chạy nên gọi hai chỗ không xung đột.

---

## 11. Việc còn để ngỏ

- **RSVP chưa có backend.** Phản hồi lưu trong `localStorage`; nối API tại chỗ
  đánh dấu trong `js/rsvp.js`.
- **Ba ảnh thành file thừa** sau khi dùng material đĩa: `silk.webp`,
  `pass-table.webp`, `pass-glasses.webp` — hiện 0 tham chiếu. Chưa xoá vì chúng
  thuộc commit gốc.
- **`Wedding/` đã vào `.gitignore`.** Nghĩa là ảnh gốc và material **không nằm
  trong repo**, nên `tools/build-images.py` chỉ chạy được trên máy có sẵn thư
  mục đó. Ai clone repo về sẽ có `assets/photos/` nhưng không tái tạo lại được.
- **Chưa commit gì.** Toàn bộ thay đổi còn trong working tree.
