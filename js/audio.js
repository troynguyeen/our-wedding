/* Nhạc nền, bật tắt bằng đĩa than trên màn HOME.

   Nhạc bắt đầu ngay khi khách chạm mở thiệp — cú chạm đó là thao tác người
   dùng nên trình duyệt cho phép phát. Gọi play() ngoài một thao tác như vậy
   sẽ bị chặn, nên onboarding.js phải gọi ngay trong handler của cú chạm chứ
   không hoãn lại. Đĩa chỉ quay khi nhạc đang chạy. */

export function initAudio(){
  const vinyl = document.getElementById('vinyl');
  const bgm   = document.getElementById('bgm');
  if (!bgm) return { play(){} };

  bgm.volume = 0.55;

  async function play(){
    if (!bgm.paused) return;
    try {
      await bgm.play();
    } catch {
      // trình duyệt từ chối — giữ nguyên trạng thái tắt, khách vẫn bật được
      // bằng đĩa than
    }
  }

  vinyl?.addEventListener('click', () => {
    if (bgm.paused) play();
    else bgm.pause();
  });

  bgm.addEventListener('pause', () => vinyl?.setAttribute('aria-pressed', 'false'));
  bgm.addEventListener('play',  () => vinyl?.setAttribute('aria-pressed', 'true'));

  return { play };
}
