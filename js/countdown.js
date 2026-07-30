/* Đếm ngược tới giờ đãi tiệc.

   Ngày giờ neo cứng ở +07:00 nên khách ở bất kỳ múi giờ nào cũng thấy đúng
   một con số, thay vì lệch theo đồng hồ máy họ. */

const TARGET = new Date('2027-03-07T18:00:00+07:00').getTime();

export function initCountdown(){
  const box = document.getElementById('clock');
  if (!box) return;

  const out = {
    d: document.getElementById('cd-d'),
    h: document.getElementById('cd-h'),
    m: document.getElementById('cd-m'),
    s: document.getElementById('cd-s'),
  };

  let timer = null;

  function tick(){
    const left = TARGET - Date.now();

    if (left <= 0){
      out.d.textContent = '000';
      out.h.textContent = out.m.textContent = out.s.textContent = '00';
      box.setAttribute('aria-label', 'Hôm nay là ngày cưới của chúng mình');
      clearInterval(timer);
      return;
    }

    const s = Math.floor(left / 1000);
    const days = Math.floor(s / 86400);

    out.d.textContent = String(days).padStart(3, '0');
    out.h.textContent = String(Math.floor(s / 3600) % 24).padStart(2, '0');
    out.m.textContent = String(Math.floor(s / 60) % 60).padStart(2, '0');
    out.s.textContent = String(s % 60).padStart(2, '0');

    box.setAttribute('aria-label', `Còn ${days} ngày nữa tới ngày cưới`);
  }

  tick();
  timer = setInterval(tick, 1000);
}
