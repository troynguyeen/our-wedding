/* Chuyển giữa HOME · OUR STORY · WEDDING DETAIL.

   Màn không hoạt động bị gỡ khỏi luồng bằng [hidden], nên trang luôn cuộn
   bằng scroller gốc — đó là điều kiện để thanh URL của Safari tự thu lại.
   Chuyển cảnh là mờ chồng trên nền chung, không phải tải lại trang. */

const ORDER = ['home', 'story', 'detail'];
const OUT_MS = 200;
const IN_MS  = 320;

export function initRouter({ reduceMotion, onEnter }){
  const screens = new Map(
    ORDER.map(name => [name, document.getElementById(`screen-${name}`)])
  );

  let current = 'home';
  let busy = false;

  function nameFromHash(){
    const key = location.hash.replace(/^#\/?/, '');
    return ORDER.includes(key) ? key : 'home';
  }

  function show(next, { push = true } = {}){
    if (busy || next === current || !screens.has(next)) return;

    const from = screens.get(current);
    const to   = screens.get(next);
    busy = true;

    const swap = () => {
      from.hidden = true;
      from.classList.remove('is-leaving');

      to.hidden = false;
      to.classList.add('is-entering');
      document.body.dataset.screen = next;
      window.scrollTo(0, 0);

      // ép trình duyệt tính lại layout trước khi gỡ lớp mờ, nếu không
      // trình duyệt gộp hai thay đổi và mất hẳn hiệu ứng hiện dần
      void to.offsetHeight;

      requestAnimationFrame(() => {
        to.classList.remove('is-entering');
        current = next;
        busy = false;
        onEnter?.(next, to);
      });
    };

    if (reduceMotion){
      swap();
    } else {
      from.classList.add('is-leaving');
      setTimeout(swap, OUT_MS);
    }

    if (push && location.hash !== `#/${next}`){
      history.pushState({ screen: next }, '', `#/${next}`);
    }
  }

  // nút bấm mang data-go
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => show(btn.dataset.go));
  });

  window.addEventListener('popstate', () => {
    show(nameFromHash(), { push: false });
  });

  /* Vuốt ngang để chuyển màn. Ý định dọc luôn thắng, nên vuốt không bao giờ
     tranh chấp với cuộn trang. */
  let sx = 0, sy = 0, tracking = false;
  const THRESHOLD = 60;

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;

    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;

    const i = ORDER.indexOf(current);
    const next = dx < 0 ? ORDER[i + 1] : ORDER[i - 1];
    if (next) show(next);
  }, { passive: true });

  return {
    go: show,
    start(){
      const initial = nameFromHash();
      if (initial !== 'home') show(initial, { push: false });
      else onEnter?.('home', screens.get('home'));
    },
  };
}
