/* Form xác nhận tham dự.

   Chưa nối backend: phản hồi lưu vào localStorage của máy khách, đúng như
   bản hiện tại. Muốn gửi về server thì thay khối lưu bên dưới. */

export function initRsvp(){
  const form  = document.getElementById('rsvpForm');
  const msg   = document.getElementById('rsvpMsg');
  const guest = document.getElementById('guestsFld');
  if (!form) return;

  // chọn "không tham dự" thì ô số lượng không còn ý nghĩa
  form.addEventListener('change', e => {
    if (e.target.name === 'attend'){
      guest.classList.toggle('hide', e.target.value === 'no');
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    if (!data.name || !data.name.trim()){
      msg.textContent = 'Bạn vui lòng cho tụi mình biết tên nhé.';
      msg.className = 'rsvp__msg err';
      form.name.focus();
      return;
    }

    const btn = form.querySelector('.rsvp__submit');
    btn.disabled = true;
    btn.textContent = 'Đang gửi…';

    try {
      const all = JSON.parse(localStorage.getItem('rsvp') || '[]');
      all.push({ ...data, at: new Date().toISOString() });
      localStorage.setItem('rsvp', JSON.stringify(all));
    } catch {
      // chế độ riêng tư chặn localStorage — vẫn báo thành công cho khách
    }

    setTimeout(() => {
      msg.textContent = data.attend === 'no'
        ? 'Cảm ơn bạn đã phản hồi. Tụi mình sẽ nhớ bạn thật nhiều!'
        : `Cảm ơn ${data.name.trim()}! Hẹn gặp bạn ngày 07.03.2027 nhé.`;
      msg.className = 'rsvp__msg ok';
      btn.textContent = 'Đã gửi ✓';
    }, 600);
  });
}
