/* ══════════════════════════════════════════════════════════════════
   Thiệp mời cưới · Chí Thành & Ngọc Trinh
   Hiệu ứng: mở thư → chuyển màn lụa → cuộn có parallax + reveal
   ══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ─── cấu hình ─── */
  const WEDDING = new Date('2027-03-07T17:00:00+07:00');   // 17:00, CN 07.03.2027

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const softMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const landing = $('#landing');
  const veil    = $('#veil');
  const main    = $('#main');
  const story   = $('#story');


  /* ══════════════════════════════════════════════════════════
     1 · MỞ THƯ
     ══════════════════════════════════════════════════════════ */
  requestAnimationFrame(() => landing.classList.add('ready'));

  let opened = false;

  function openInvitation() {
    if (opened) return;
    opened = true;

    landing.classList.add('opening');
    playMusic(true);                       // cử chỉ người dùng → được phép phát

    const wait = softMotion ? 0 : 1150;

    setTimeout(() => {
      veil.classList.add('sweep');

      // đổi màn ngay giữa lúc lụa phủ kín
      setTimeout(() => {
        landing.classList.add('gone');
        document.body.classList.remove('is-locked');
        main.classList.add('live');
        main.setAttribute('aria-hidden', 'false');
        window.scrollTo(0, 0);
        onScroll();
      }, softMotion ? 0 : 640);

      setTimeout(() => {
        veil.classList.remove('sweep');
        landing.style.display = 'none';
      }, softMotion ? 30 : 1560);
    }, wait);
  }

  $('#openBtn').addEventListener('click', openInvitation);

  /* Mở thẳng vào một mục khi có hash (#rsvp, #details, #story…) — tiện khi
     chia sẻ link tới đúng phần cần xem, khỏi phải mở thư lại. */
  function skipEnvelope(hash) {
    opened = true;
    landing.style.display = 'none';
    document.body.classList.remove('is-locked');
    main.classList.add('live');
    main.setAttribute('aria-hidden', 'false');

    if (hash === '#story') {
      story.classList.add('open');
      story.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
    } else {
      const t = document.querySelector(hash);
      if (t) t.scrollIntoView();
    }
    risers.forEach(el => el.classList.add('in'));
    onScroll();
  }


  /* ══════════════════════════════════════════════════════════
     2 · REVEAL KHI CUỘN
     ══════════════════════════════════════════════════════════ */
  const risers = $$('[data-rise]');
  risers.forEach(el => {
    if (el.dataset.d) el.style.setProperty('--d', el.dataset.d);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

  risers.forEach(el => io.observe(el));


  /* ══════════════════════════════════════════════════════════
     3 · PARALLAX + THIỆP TRƯỢT KHỎI PHONG THƯ
     ══════════════════════════════════════════════════════════ */
  const parallaxEls = $$('[data-par]').map(el => ({
    el, k: parseFloat(el.dataset.par) || 0,
    base: getComputedStyle(el).transform.replace('none', ''),
  }));

  let ticking = false;

  function onScroll() {
    if (softMotion) return;
    const vh = innerHeight;

    // đẩy nhẹ các hoạ tiết theo tốc độ riêng
    for (const { el, k, base } of parallaxEls) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) continue;
      const mid = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(mid * k).toFixed(2)}px, 0) ${base}`;
    }

    ticking = false;
  }

  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();


  /* ══════════════════════════════════════════════════════════
     4 · ĐẾM NGƯỢC
     ══════════════════════════════════════════════════════════ */
  const cd = { d: $('#cd-d'), h: $('#cd-h'), m: $('#cd-m'), s: $('#cd-s') };

  function tick() {
    let ms = WEDDING - Date.now();
    if (ms < 0) ms = 0;

    const s = Math.floor(ms / 1000);
    const dd = Math.floor(s / 86400);
    const hh = Math.floor(s % 86400 / 3600);
    const mm = Math.floor(s % 3600 / 60);
    const ss = s % 60;

    set(cd.d, String(dd).padStart(3, '0'));
    set(cd.h, String(hh).padStart(2, '0'));
    set(cd.m, String(mm).padStart(2, '0'));
    set(cd.s, String(ss).padStart(2, '0'));
  }

  function set(el, v) { if (el && el.textContent !== v) el.textContent = v; }

  tick();
  setInterval(tick, 1000);


  /* ══════════════════════════════════════════════════════════
     5 · NHẠC NỀN (đĩa than)
     — audio.loop lo việc lặp lại vô hạn, tự nó không bao giờ dừng.
     — pause() không reset currentTime, nên bấm dừng rồi bấm lại sẽ
       PHÁT TIẾP đúng chỗ đang dừng, không phát lại từ đầu.
     ══════════════════════════════════════════════════════════ */
  const bgm   = $('#bgm');
  const vinyl = $('#vinyl');

  function setVinylState(on) {
    vinyl.classList.toggle('on', on);
    vinyl.setAttribute('aria-pressed', String(on));
  }

  function playMusic(quiet) {
    if (!bgm) return;
    bgm.volume = 0.55;
    bgm.play().then(() => setVinylState(true)).catch(() => {
      // trình duyệt chặn autoplay chưa có cử chỉ người dùng — im lặng bỏ qua,
      // sẽ tự phát ngay khi người dùng chạm/click lần đầu (xem armFirstGesture)
      if (!quiet) setVinylState(false);
    });
  }

  // Thử phát THẬT SỰ ngay khi trang vừa mở, trước cả khi mở phong thư.
  // Nếu trình duyệt chặn (hầu hết di động sẽ chặn), tự động thử lại ở
  // cử chỉ chạm/click ĐẦU TIÊN của người dùng trên toàn trang.
  playMusic(true);

  function armFirstGesture() {
    if (!bgm.paused) return;               // đã phát được rồi thì thôi
    const start = () => { playMusic(true); cleanup(); };
    const cleanup = () => {
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
    };
    document.addEventListener('pointerdown', start, { once: true, passive: true });
    document.addEventListener('keydown', start, { once: true });
  }
  armFirstGesture();

  // Bấm đĩa than: đang phát thì tạm dừng (giữ nguyên vị trí); đang dừng thì
  // phát tiếp từ đúng vị trí đó — không bao giờ tua về đầu.
  vinyl.addEventListener('click', () => {
    if (bgm.paused) {
      playMusic(false);
    } else {
      bgm.pause();
      setVinylState(false);
    }
  });


  /* ══════════════════════════════════════════════════════════
     6 · OUR STORY
     ══════════════════════════════════════════════════════════ */
  const storyBtn   = $('#storyBtn');
  const storyClose = $('#storyClose');

  function toggleStory(open) {
    veil.classList.add('sweep');

    setTimeout(() => {
      story.classList.toggle('open', open);
      story.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('is-locked', open);
      if (open) $('.story__scroll').scrollTop = 0;
    }, softMotion ? 0 : 640);

    setTimeout(() => veil.classList.remove('sweep'), softMotion ? 30 : 1560);
  }

  storyBtn.addEventListener('click', () => toggleStory(true));
  storyClose.addEventListener('click', () => toggleStory(false));

  addEventListener('keydown', e => {
    if (e.key === 'Escape' && story.classList.contains('open')) toggleStory(false);
  });


  /* ══════════════════════════════════════════════════════════
     7 · RSVP
     ══════════════════════════════════════════════════════════ */
  const form     = $('#rsvpForm');
  const msg      = $('#rsvpMsg');
  const guestFld = $('#guestsFld');

  // ẩn ô "số lượng" khi khách chọn không tham dự
  form.addEventListener('change', e => {
    if (e.target.name === 'attend') {
      guestFld.classList.toggle('hide', e.target.value === 'no');
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    if (!data.name || !data.name.trim()) {
      msg.textContent = 'Bạn vui lòng cho tụi mình biết tên nhé.';
      msg.className = 'rsvp__msg err';
      form.name.focus();
      return;
    }

    const btn = $('.rsvp__submit', form);
    btn.disabled = true;
    btn.textContent = 'Đang gửi…';

    // Lưu tạm trên máy khách. Nối API/Google Form tại đây nếu cần.
    try {
      const all = JSON.parse(localStorage.getItem('rsvp') || '[]');
      all.push({ ...data, at: new Date().toISOString() });
      localStorage.setItem('rsvp', JSON.stringify(all));
    } catch (_) { /* chế độ riêng tư — bỏ qua */ }

    setTimeout(() => {
      msg.textContent = data.attend === 'no'
        ? 'Cảm ơn bạn đã phản hồi. Tụi mình sẽ nhớ bạn thật nhiều!'
        : `Cảm ơn ${data.name.trim()}! Hẹn gặp bạn ngày 07.03.2027 nhé.`;
      msg.className = 'rsvp__msg ok';
      btn.textContent = 'Đã gửi ✓';
    }, 700);
  });


  /* ══════════════════════════════════════════════════════════
     8 · VỀ ĐẦU THIỆP
     ══════════════════════════════════════════════════════════ */
  $('#backTop').addEventListener('click', () => {
    scrollTo({ top: 0, behavior: softMotion ? 'auto' : 'smooth' });
  });


  /* ══════════════════════════════════════════════════════════
     9 · VÀO THẲNG MỤC ĐƯỢC CHIA SẺ
     ══════════════════════════════════════════════════════════ */
  const DEEP = ['#hero', '#date', '#details', '#map', '#rsvp', '#story'];

  function routeHash() {
    const h = location.hash;
    if (!DEEP.includes(h)) return;
    if (!opened) { skipEnvelope(h); return; }
    if (h === '#story') {
      if (!story.classList.contains('open')) toggleStory(true);
    } else {
      if (story.classList.contains('open')) toggleStory(false);
      const t = document.querySelector(h);
      if (t) t.scrollIntoView({ behavior: softMotion ? 'auto' : 'smooth' });
    }
  }

  routeHash();
  addEventListener('hashchange', routeHash);

})();
