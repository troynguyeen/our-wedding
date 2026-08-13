/* Chạy thật luồng mở thiệp bằng con trỏ giả lập qua CDP:
   chạm → cào → lật mở → thư mở ra → vào màn HOME.

     node tools/flow-check.mjs
     node tools/flow-check.mjs --reduced      # kiểm chế độ tắt chuyển động
*/

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = process.env.ORIGIN || 'http://localhost:8099';
const REDUCED = process.argv.includes('--reduced');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function launch(){
  const profile = mkdtempSync(join(tmpdir(), 'wedding-flow-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  return new Promise((ok, no) => {
    let buf = '';
    const to = setTimeout(() => no(new Error('Chrome không khởi động kịp')), 25000);
    proc.stderr.on('data', d => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m){ clearTimeout(to); ok({ proc, profile, wsUrl: m[1] }); }
    });
  });
}

class CDP {
  constructor(ws){ this.ws = ws; this.id = 0; this.waiting = new Map(); }
  static async connect(url){
    const ws = new WebSocket(url);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('WS lỗi')); });
    const cdp = new CDP(ws);
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && cdp.waiting.has(m.id)){
        const { ok, no } = cdp.waiting.get(m.id);
        cdp.waiting.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      }
    };
    return cdp;
  }
  send(method, params = {}, sessionId){
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((ok, no) => this.waiting.set(id, { ok, no }));
  }
}

const steps = [];
function check(name, ok, detail = ''){
  steps.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function main(){
  const { proc, profile, wsUrl } = await launch();
  const b = await CDP.connect(wsUrl);

  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const S = sessionId;

  // userGesture: Chrome chỉ coi là thao tác người dùng khi cờ này bật. Thiếu
  // nó thì chính sách autoplay chặn nhạc, và phép thử báo hỏng oan.
  const evalJs = async (expression, userGesture = false) => {
    const { result, exceptionDetails } = await b.send('Runtime.evaluate',
      { expression, returnByValue: true, userGesture }, S);
    if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' +
      (exceptionDetails.exception?.description || ''));
    return result.value;
  };

  try {
    await b.send('Page.enable', {}, S);
    await b.send('Runtime.enable', {}, S);
    await b.send('Log.enable', {}, S);
    await b.send('Emulation.setDeviceMetricsOverride',
      { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, S);
    if (REDUCED){
      await b.send('Emulation.setEmulatedMedia',
        { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, S);
    }

    // gom lỗi console để phát hiện script hỏng
    const errors = [];
    b.ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error'){
        errors.push(m.params.entry.text);
      }
      if (m.method === 'Runtime.exceptionThrown'){
        errors.push(m.params.exceptionDetails.text);
      }
    });

    // Máy ghi Web Audio, cài trước khi trang chạy script. Nằm hẳn bên phía
    // phép thử: js/sfx.js không có móc nào dành riêng cho kiểm thử, ở đây chỉ
    // bọc API sẵn có của trình duyệt để nhìn xem module thật đã làm gì.
    await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      (() => {
        const log = { started: 0, stopped: 0, live: 0, loop: null, ramps: [] };
        window.__sfx = log;
        const src = AudioBufferSourceNode.prototype;
        const start = src.start, stop = src.stop;
        src.start = function(...a){
          if (!this.__seen){ this.__seen = true; log.started++; log.live++; log.loop = this.loop; }
          return start.apply(this, a);
        };
        src.stop = function(...a){
          if (this.__seen && !this.__done){ this.__done = true; log.stopped++; log.live--; }
          return stop.apply(this, a);
        };
        const ramp = AudioParam.prototype.linearRampToValueAtTime;
        AudioParam.prototype.linearRampToValueAtTime = function(v, t){
          log.ramps.push(v);
          return ramp.call(this, v, t);
        };
      })()
    ` }, S);
    const sfx = () => evalJs(`JSON.stringify(window.__sfx)`).then(JSON.parse);

    await b.send('Page.navigate', { url: `${ORIGIN}/index.html` }, S);
    await sleep(2500);

    check('màn mở thiệp ở trạng thái niêm phong',
      await evalJs(`document.getElementById('onboarding').dataset.state`) === 'sealed');

    // chạm để mở — mô phỏng đúng một cú chạm thật của khách
    await evalJs(`document.getElementById('obTap').click()`, true);
    await sleep(1200);

    const nhac = `(() => { const a = document.getElementById('bgm');
      return 'paused=' + a.paused + ' readyState=' + a.readyState; })()`;

    const state1 = await evalJs(`document.getElementById('onboarding').dataset.state`);
    if (REDUCED){
      check('chế độ tắt chuyển động bỏ qua màn cào', state1 === 'open', `state=${state1}`);
      // không có màn cào nên nhạc phải bật ngay từ cú chạm
      check('tắt chuyển động: chạm là nhạc bật luôn',
        await evalJs(`!document.getElementById('bgm').paused`),
        await evalJs(nhac));
    } else {
      check('chạm chuyển sang trạng thái cào', state1 === 'scratch', `state=${state1}`);
      check('chạm mở thiệp thì nhạc CHƯA chạy',
        await evalJs(`document.getElementById('bgm').paused`),
        await evalJs(nhac));

      const box = await evalJs(`(() => {
        const r = document.getElementById('obFoil').getBoundingClientRect();
        return JSON.stringify({x:r.x, y:r.y, w:r.width, h:r.height});
      })()`);
      const r = JSON.parse(box);
      check('canvas nhũ có kích thước thật', r.w > 50 && r.h > 50, `${Math.round(r.w)}×${Math.round(r.h)}`);

      // cào bằng con trỏ thật: quét ngang nhiều lượt phủ kín mặt thiệp
      const dispatch = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', {
        type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1,
        clickCount: 1, pointerType: 'mouse', ...extra,
      }, S);

      await dispatch('mousePressed', r.x + 8, r.y + 8);

      // --- hiệu ứng tiếng cào giấy ---
      // Ngón tay đặt xuống mà chưa kéo thì chưa phải là đang cào.
      await sleep(300);
      const s0 = await sfx();
      check('chạm xuống nhưng chưa di thì chưa có tiếng cào',
        s0.started === 0, `started=${s0.started}`);

      // vài nét ngắn: đủ để bật tiếng, chưa đủ phủ để lật thiệp
      const swipe = async (y, from, to, steps = 6) => {
        for (let k = 0; k <= steps; k++){
          const t = from + (to - from) * (k / steps);
          await dispatch('mouseMoved', r.x + 4 + t * (r.w - 8), y);
        }
      };
      await swipe(r.y + r.h * 0.12, 0, 1);
      const s1 = await sfx();
      check('di ngón tay thì tiếng cào chạy',
        s1.started >= 1 && s1.live === 1 && s1.loop === true,
        `started=${s1.started} live=${s1.live} loop=${s1.loop}`);
      check('tiếng cào vào bằng fade chứ không bật thẳng',
        s1.ramps.some(v => v > 0), `ramps=${JSON.stringify(s1.ramps)}`);

      // vẫn giữ nút chuột nhưng ngừng di — tiếng phải tự tắt
      await sleep(500);
      const s2 = await sfx();
      check('ngừng tay thì tiếng cào tắt',
        s2.live === 0 && s2.ramps.at(-1) === 0,
        `live=${s2.live} ramp cuối=${s2.ramps.at(-1)}`);

      await swipe(r.y + r.h * 0.22, 1, 0);
      const s3 = await sfx();
      check('cào tiếp thì tiếng cào vào lại',
        s3.started > s2.started && s3.live === 1,
        `started=${s2.started}→${s3.started} live=${s3.live}`);

      const rows = 14;
      for (let i = 0; i < rows; i++){
        const y = r.y + (r.h * (i + 0.5)) / rows;
        for (let k = 0; k <= 10; k++){
          const t = i % 2 ? 1 - k / 10 : k / 10;
          await dispatch('mouseMoved', r.x + 4 + t * (r.w - 8), y);
        }
      }
      await dispatch('mouseReleased', r.x + r.w - 8, r.y + r.h - 8);
      await sleep(600);

      const state2 = await evalJs(`document.getElementById('onboarding').dataset.state`);
      check('cào đủ thì thiệp tự lật mở',
        ['revealed', 'closing', 'open', 'done'].includes(state2), `state=${state2}`);

      check('cào xong là nhạc nền bật lên',
        await evalJs(`!document.getElementById('bgm').paused`),
        await evalJs(nhac));

      const s4 = await sfx();
      check('thiệp lật mở thì tiếng cào đã tắt hẳn',
        s4.live === 0, `live=${s4.live} started=${s4.started} stopped=${s4.stopped}`);
    }

    // chờ chuỗi closing → open → done chạy hết
    await sleep(6000);

    check('màn mở thiệp đã đóng lại',
      await evalJs(`document.getElementById('onboarding').classList.contains('is-gone')`));
    check('trang đã bỏ khoá cuộn',
      await evalJs(`!document.body.classList.contains('is-onboarding')`));
    check('màn HOME đang hiển thị',
      await evalJs(`!document.getElementById('screen-home').hidden`));
    check('đếm ngược đang chạy',
      await evalJs(`/^\\d{3}$/.test(document.getElementById('cd-d').textContent)`),
      await evalJs(`document.getElementById('cd-d').textContent + ' ngày'`));

    // chuyển màn hình
    await evalJs(`document.getElementById('storyBtn').click()`);
    await sleep(900);
    check('triện Our Story mở màn OUR STORY',
      await evalJs(`!document.getElementById('screen-story').hidden
                    && document.getElementById('screen-home').hidden`),
      await evalJs(`location.hash`));

    await evalJs(`document.querySelector('#screen-story [data-go="detail"]').click()`);
    await sleep(900);
    check('nav mở màn WEDDING DETAIL',
      await evalJs(`!document.getElementById('screen-detail').hidden
                    && document.getElementById('screen-story').hidden`),
      await evalJs(`location.hash`));

    // quay về HOME rồi thử nút đĩa mở màn chi tiết
    await evalJs(`document.querySelector('#screen-detail [data-go="home"]').click()`);
    await sleep(900);
    await evalJs(`document.getElementById('detailBtn').click()`);
    await sleep(900);
    check('đĩa Wedding Details mở màn WEDDING DETAIL',
      await evalJs(`!document.getElementById('screen-detail').hidden`),
      await evalJs(`location.hash`));

    // RSVP
    await evalJs(`(() => {
      const f = document.getElementById('rsvpForm');
      f.name.value = 'Khách thử';
      f.requestSubmit();
    })()`);
    await sleep(1200);
    check('RSVP nhận và lưu phản hồi',
      await evalJs(`document.getElementById('rsvpMsg').classList.contains('ok')`),
      await evalJs(`document.getElementById('rsvpMsg').textContent`));

    check('không có lỗi console', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    const closed = new Promise(r => proc.once('exit', r));
    proc.kill();
    await Promise.race([closed, sleep(3000)]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }

  const failed = steps.filter(s => !s.ok).length;
  console.log(failed === 0
    ? `\nAll ${steps.length} flow checks pass.`
    : `\n${failed} of ${steps.length} flow checks FAIL.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
