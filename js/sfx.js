/* Tiếng cào giấy cho màn scratch.

   Dùng Web Audio chứ không phải thẻ <audio> vì hai lẽ: iOS Safari bỏ qua
   HTMLMediaElement.volume (gán vào không có tác dụng gì), mà thiệp cưới thì chủ
   yếu mở trên điện thoại; và hành vi "tiếng bám theo ngón tay" dựng trên fade,
   trong khi pause() cắt ngang dạng sóng nên nghe 'cạch'. GainNode giải quyết cả
   hai.

   Mọi lỗi đều nuốt: hỏng tiếng thì im lặng, chứ việc cào và lật thiệp không bao
   giờ được phụ thuộc vào âm thanh. */

const SRC      = 'assets/sfx-scratch.m4a';
const VOLUME   = 0.6;
const FADE_IN  = 0.04;
const FADE_OUT = 0.15;

const SILENT = { start(){}, stop(){}, destroy(){} };

export function makeScratchSfx(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return SILENT;

  let ctx = null;
  let buffer = null;
  let decoding = null;
  let source = null;
  let gain = null;
  let wanted = false;   // đang muốn phát; có thể buffer chưa decode xong
  let dead = false;

  // Tải sớm ngay từ lúc dựng — onboarding gọi hàm này khi vừa vào trạng thái
  // cào, nên có sẵn vài trăm ms trước nét cào đầu tiên. Chỉ lấy bytes chứ chưa
  // đụng Web Audio: mở AudioContext ngoài một thao tác người dùng sẽ ra một
  // context bị treo cùng lời cảnh báo trong console.
  const bytes = fetch(SRC).then(r => r.arrayBuffer()).catch(() => null);

  function ensureCtx(){
    if (ctx || dead) return;
    try {
      ctx = new AC();
    } catch {
      dead = true;
      return;
    }
    // start() luôn được gọi từ trong pointermove, tức là vẫn còn quyền phát
    // thừa hưởng từ cú chạm trước đó
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function ensureBuffer(){
    if (buffer) return Promise.resolve();
    if (!decoding){
      decoding = bytes
        .then(b => b && ctx.decodeAudioData(b))
        .then(buf => { buffer = buf || null; })
        .catch(() => { buffer = null; });
    }
    return decoding;
  }

  function play(){
    if (dead || source || !ctx || !buffer) return;

    gain = ctx.createGain();
    gain.connect(ctx.destination);

    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(VOLUME, t + FADE_IN);
    // vào ở một điểm ngẫu nhiên: cào nhiều lần liên tiếp sẽ không nghe ra là
    // vẫn đúng một đoạn thu đó lặp lại
    source.start(t, Math.random() * buffer.duration);
  }

  function start(){
    if (dead) return;
    wanted = true;
    ensureCtx();
    if (!ctx) return;
    if (buffer) play();
    // chưa decode xong thì phát ngay khi xong, miễn là khách vẫn còn đang cào
    else ensureBuffer().then(() => { if (wanted) play(); });
  }

  function stop(){
    wanted = false;
    if (!source) return;

    const t = ctx.currentTime;
    const g = gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);   // neo lại đúng chỗ fade-in đang dở
    g.linearRampToValueAtTime(0, t + FADE_OUT);
    source.stop(t + FADE_OUT);

    source = null;
    gain = null;
  }

  function destroy(){
    stop();
    dead = true;
    ctx?.close().catch(() => {});
    ctx = null;
  }

  return { start, stop, destroy };
}
