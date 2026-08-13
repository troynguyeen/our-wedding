/* Màn mở thiệp: sealed → scratch → revealed → closing → open → done. */

import { makeScratch }    from './scratch.js';
import { makeScratchSfx } from './sfx.js';

const SKIP_AFTER   = 4000;  // hiện nút "Bỏ qua" nếu khách chưa cào
const HOLD_REVEAL  = 1500;  // giữ thiệp đã cào để khách kịp đọc
const HOLD_CLOSING = 700;   // thiệp tụt vào thư
const HOLD_OPEN    = 1900;  // thư mở, thiệp và ảnh xoè ra

export function initOnboarding({ reduceMotion, onFinish, onReveal }){
  const root   = document.getElementById('onboarding');
  const foil   = document.getElementById('obFoil');
  const tap    = document.getElementById('obTap');
  const skip   = document.getElementById('obSkip');
  if (!root) return;

  const timers = [];
  const wait = (ms, fn) => timers.push(setTimeout(fn, ms));

  let destroyScratch = null;
  let sfx = null;

  function setState(state){
    root.dataset.state = state;
  }

  function finish(){
    setState('done');
    document.body.classList.remove('is-onboarding');
    wait(750, () => {
      root.classList.add('is-gone');
      onFinish?.();
    });
  }

  function openEnvelope(){
    if (root.dataset.state === 'open' || root.dataset.state === 'done') return;
    // Đường dự phòng cho chế độ tắt chuyển động: ở đó không có màn cào nên
    // reveal() không chạy. onReveal tự bỏ qua nếu nhạc đã phát rồi.
    onReveal?.();
    setState('open');
    wait(HOLD_OPEN, finish);
  }

  function reveal(){
    destroyScratch?.();
    destroyScratch = null;
    // nút "Bỏ qua" cũng vào đây mà không đi qua scratch.js, nên phải tự tắt
    sfx?.stop();
    // Nhạc bắt đầu ngay khi cào xong. Gọi được vì trình duyệt vẫn giữ quyền
    // phát sau cú chạm mở thiệp trước đó (sticky activation), và lúc này
    // khách đang giữ tay trên màn hình để cào.
    onReveal?.();
    setState('revealed');
    skip.classList.remove('is-shown');
    wait(HOLD_REVEAL, () => {
      setState('closing');
      wait(HOLD_CLOSING, openEnvelope);
    });
  }

  function startScratch(){
    // chạm lần hai khi đã cào dở sẽ tạo thêm một phiên makeScratch nữa và
    // rò listener của phiên cũ, nên chỉ nhận cú chạm từ trạng thái niêm phong
    if (root.dataset.state !== 'sealed') return;
    setState('scratch');
    // dựng ngay để kịp tải file tiếng trước nét cào đầu tiên
    sfx = makeScratchSfx();
    // canvas chỉ có kích thước thật sau khi thiệp đã trồi lên
    requestAnimationFrame(() => {
      destroyScratch = makeScratch(foil, {
        onReveal: reveal,
        onActive: on => (on ? sfx.start() : sfx.stop()),
      });
    });
    wait(SKIP_AFTER, () => {
      if (root.dataset.state === 'scratch') skip.classList.add('is-shown');
    });
  }

  // Không chuyển động: bỏ hẳn màn cào, chạm là mở thẳng phong thư.
  tap.addEventListener('click', reduceMotion ? openEnvelope : startScratch);
  skip.addEventListener('click', reveal);

  return function destroy(){
    timers.forEach(clearTimeout);
    destroyScratch?.();
    sfx?.destroy();
  };
}
