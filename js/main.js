/* Khởi động thiệp mời.
   Mỗi module lo đúng một việc; file này chỉ nối chúng lại. */

import { initOnboarding } from './onboarding.js';
import { initRouter }     from './router.js';
import { initReveal }     from './reveal.js';
import { initCountdown }  from './countdown.js';
import { initAudio }      from './audio.js';
import { initRsvp }       from './rsvp.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const reveal = initReveal({ reduceMotion });

const router = initRouter({
  reduceMotion,
  // màn vừa vào có phần tử chưa từng được quan sát, quét lại cho chúng
  onEnter: (_name, screen) => reveal.scan(screen),
});

initCountdown();
const audio = initAudio();
initRsvp();

initOnboarding({
  reduceMotion,
  // nhạc bắt đầu đúng lúc khách cào xong lớp nhũ và thiệp hiện ra
  onReveal: () => audio.play(),
  onFinish: () => router.start(),
});

// Vào thẳng #/story hoặc #/detail thì bỏ qua màn mở thiệp.
if (location.hash && location.hash !== '#/home'){
  document.getElementById('onboarding')?.classList.add('is-gone');
  document.body.classList.remove('is-onboarding');
  router.start();
}
