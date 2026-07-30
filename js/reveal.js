/* Hiện dần khi cuộn tới, và thị sai cho các lớp trang trí.
   Cả site dùng chung một IntersectionObserver và một handler cuộn. */

export function initReveal({ reduceMotion }){
  if (reduceMotion){
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-in'));
    return { scan(){}, };
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries){
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);   // hiện một lần rồi thôi
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

  // vé máy bay chỉ trượt ra khỏi máy in khi khối lịch trình vào khung nhìn
  const sectionIO = new IntersectionObserver((entries) => {
    for (const entry of entries){
      if (entry.isIntersecting) entry.target.classList.add('is-in');
    }
  }, { threshold: 0.15 });

  function scan(root = document){
    root.querySelectorAll('[data-reveal]:not(.is-in)').forEach(el => io.observe(el));
    root.querySelectorAll('.sched:not(.is-in)').forEach(el => sectionIO.observe(el));
  }

  scan();

  /* Thị sai: chỉ ghi translate3d, không đụng tới thuộc tính gây reflow. */
  const layers = [...document.querySelectorAll('[data-par]')];
  if (layers.length){
    let ticking = false;

    const apply = () => {
      const mid = window.innerHeight / 2;
      for (const el of layers){
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;
        const shift = (rect.top + rect.height / 2 - mid) * parseFloat(el.dataset.par);
        // ghi vào biến chứ không đặt transform, để CSS giữ được phép lật
        // ngang của những lớp như chim bồ câu hay nhành hoa bên phải
        el.style.setProperty('--par-y', `${shift.toFixed(1)}px`);
      }
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }, { passive: true });

    apply();
  }

  return { scan };
}
