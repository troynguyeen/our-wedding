/* Lớp nhũ bạc cào được, phủ lên thiệp Save the date.
   Trả về hàm huỷ để onboarding gỡ listener khi chuyển trạng thái. */

const REVEAL_AT = 0.55;   // cào tới đâu thì tự lật mở
const SAMPLE_MS = 120;    // giãn cách giữa hai lần đo độ phủ

/**
 * @param {HTMLCanvasElement} canvas
 * @param {() => void} onReveal  gọi một lần khi đã cào đủ
 */
export function makeScratch(canvas, onReveal){
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const probe = document.createElement('canvas');
  probe.width = probe.height = 64;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });

  let dpr = 1;
  let done = false;
  let drawing = false;
  let last = null;
  let lastSample = 0;
  // canvas.width mặc định của trình duyệt là 300 (khác 0!), nên không thể
  // dùng canvas.width để biết "đã từng vẽ chưa" — phải có cờ riêng, nếu
  // không lần resize() đầu tiên tưởng nhầm có nội dung cũ cần giữ lại, và
  // thao tác destination-in xoá sạch luôn lớp nhũ vừa sơn.
  let painted = false;

  function paintFoil(){
    const { width: w, height: h } = canvas;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0,    '#d9dde0');
    g.addColorStop(0.25, '#f2f4f5');
    g.addColorStop(0.45, '#b9c0c4');
    g.addColorStop(0.7,  '#eef0f1');
    g.addColorStop(1,    '#c6ccd0');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // hạt lấm tấm cho ra chất nhũ thay vì một mảng phẳng
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < (w * h) / 900; i++){
      ctx.fillRect(Math.random() * w, Math.random() * h, dpr, dpr);
    }
  }

  // Chặn trên cho bộ đệm canvas. CSS phải luôn ghi rõ width/height cho canvas;
  // nếu lỡ để auto, kích thước hiển thị sẽ bám theo canvas.width và vòng lặp
  // resize tự nhân đôi mỗi lượt. Chốt này giữ thiệt hại ở mức vô hại.
  const MAX_SIDE = 3000;

  /* Đo lại canvas khi đổi cỡ hoặc xoay máy, giữ nguyên phần đã cào. */
  function resize(){
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(Math.round(rect.width * dpr), MAX_SIDE);
    const h = Math.min(Math.round(rect.height * dpr), MAX_SIDE);
    if (painted && w === canvas.width && h === canvas.height) return;

    const previous = painted
      ? ctx.getImageData(0, 0, canvas.width, canvas.height)
      : null;
    const oldW = canvas.width;
    const oldH = canvas.height;

    canvas.width = w;
    canvas.height = h;
    paintFoil();
    painted = true;

    if (previous && oldW && oldH){
      // vẽ lại mặt nạ cũ đã co giãn, nên tiến độ cào không bị mất
      const buf = document.createElement('canvas');
      buf.width = oldW;
      buf.height = oldH;
      buf.getContext('2d').putImageData(previous, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(buf, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(buf, 0, 0, w, h);
    }
  }

  function pointAt(e){
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function erase(from, to){
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(canvas.width, canvas.height) * 0.11;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  /* Độ phủ đo trên bản thu nhỏ 64×64 — rẻ hơn đọc toàn bộ canvas rất nhiều. */
  function cleared(){
    probeCtx.clearRect(0, 0, 64, 64);
    probeCtx.drawImage(canvas, 0, 0, 64, 64);
    const { data } = probeCtx.getImageData(0, 0, 64, 64);
    let clear = 0;
    for (let i = 3; i < data.length; i += 4){
      if (data[i] < 40) clear++;
    }
    return clear / (64 * 64);
  }

  function onDown(e){
    if (done) return;
    drawing = true;
    last = pointAt(e);
    erase(last, last);
    try {
      // ném lỗi nếu con trỏ không còn hoạt động; việc cào vẫn chạy tốt nếu
      // không bắt được con trỏ nên chỉ cần bỏ qua
      canvas.setPointerCapture?.(e.pointerId);
    } catch { /* không bắt được con trỏ */ }
  }

  function onMove(e){
    if (!drawing || done) return;
    const next = pointAt(e);
    erase(last, next);
    last = next;

    const now = performance.now();
    if (now - lastSample < SAMPLE_MS) return;
    lastSample = now;

    if (cleared() >= REVEAL_AT){
      done = true;
      drawing = false;
      onReveal();
    }
  }

  function onUp(){ drawing = false; }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  /* ResizeObserver thay vì một lần gọi resize() cộng listener resize/orientation
     của window. getBoundingClientRect() đo ngay sau khi đổi trạng thái có thể
     rơi vào đúng khung hình canvas chưa lên layout (đặc biệt khi cha dùng
     container query), khiến resize() bỏ qua và không bao giờ vẽ được — lớp
     nhũ trong suốt, thiệp lộ chữ ngay từ đầu. ResizeObserver tự bắn lại callback
     ngay khi hộp canvas có kích thước thật, nên không còn kẽ hở thời điểm này. */
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return function destroy(){
    done = true;
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    ro.disconnect();
  };
}
