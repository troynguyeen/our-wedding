/* Kiểm tra tràn ngang và chụp màn hình qua Chrome DevTools Protocol.
   Node 24 đã có sẵn WebSocket nên không cần cài thêm gói nào.

     node tools/audit.mjs                       # audit mọi khổ máy
     node tools/audit.mjs --shots               # audit + chụp màn hình
     node tools/audit.mjs --w 390 --shots       # chỉ một bề ngang
*/

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = process.env.ORIGIN || 'http://localhost:8099';

const args = process.argv.slice(2);
const has  = (f) => args.includes(f);
const val  = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : args[i + 1]; };

const WIDTHS  = val('--w') ? [Number(val('--w'))] : [320, 360, 390, 414, 430];
const HEIGHT  = Number(val('--h', 900));
// "ob" giữ nguyên màn mở thiệp thay vì bỏ qua, để soi riêng phần onboarding
const SCREENS = val('--screen') ? [val('--screen')] : ['home', 'story', 'detail'];
const SHOTS   = has('--shots');
const SHOTDIR = val('--out', 'tools/shots');

/* ── khởi động Chrome, lấy websocket điều khiển ───────────────────────── */
function launch(){
  const profile = mkdtempSync(join(tmpdir(), 'wedding-audit-'));
  const proc = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  return new Promise((resolve, reject) => {
    let buf = '';
    const to = setTimeout(() => reject(new Error('Chrome không khởi động kịp')), 25000);

    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!m) return;
      clearTimeout(to);
      resolve({ proc, profile, wsUrl: m[1] });
    });
    proc.on('exit', (c) => { clearTimeout(to); reject(new Error(`Chrome thoát sớm (${c})`)); });
  });
}

/* ── lớp bọc CDP mỏng ─────────────────────────────────────────────────── */
class CDP {
  constructor(ws){ this.ws = ws; this.id = 0; this.waiting = new Map(); this.events = []; }

  static async connect(url){
    const ws = new WebSocket(url);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('WS lỗi')); });
    const cdp = new CDP(ws);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && cdp.waiting.has(msg.id)){
        const { ok, no } = cdp.waiting.get(msg.id);
        cdp.waiting.delete(msg.id);
        msg.error ? no(new Error(msg.error.message)) : ok(msg.result);
      } else if (msg.method){
        cdp.events.push(msg);
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ── biểu thức chạy trong trang để tìm phần tử tràn mép ───────────────── */
const AUDIT_EXPR = `(() => {
  const inner = window.innerWidth;
  const offenders = [];
  for (const el of document.body.querySelectorAll('*')){
    if (offenders.length >= 12) break;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right <= inner + 0.5 && r.left >= -0.5) continue;
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement){
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX)){ clipped = true; break; }
    }
    if (clipped) continue;
    const cls = el.className && el.className.baseVal !== undefined
      ? el.className.baseVal : String(el.className || '');
    offenders.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 60),
                     left: Math.round(r.left), right: Math.round(r.right) });
  }
  return JSON.stringify({
    inner,
    scrollWidth: document.documentElement.scrollWidth,
    offenders,
    errors: window.__err || [],
  });
})()`;

/* Bỏ qua onboarding, hiện sẵn mọi khối, và ép tải hết ảnh lazy — ảnh dưới
   khung nhìn không tự tải khi chụp captureBeyondViewport, sẽ để lại khoảng
   trắng khiến ảnh chụp không phản ánh đúng trang thật. */
const SKIP_OB = `(() => {
  const ob = document.getElementById('onboarding');
  if (ob) ob.classList.add('is-gone');
  document.body.classList.remove('is-onboarding');
  document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-in'));
  document.querySelectorAll('.sched').forEach(el => el.classList.add('is-in'));
  // đổi loading sang eager là đủ để trình duyệt tải ngay; gán lại src ở đây
  // sẽ huỷ mất lượt tải vừa được kích hoạt và ảnh không bao giờ hiện
  document.querySelectorAll('img[loading="lazy"]').forEach(img => {
    img.loading = 'eager';
  });
  return true;
})()`;

/* Cuộn hết trang một lượt rồi về đầu. captureBeyondViewport không raster hoá
   phần chưa từng lọt vào khung nhìn, nên nếu bỏ bước này ảnh chụp sẽ thiếu
   nội dung mà trang thật vẫn hiển thị đầy đủ. */
const RASTERISE = `(async () => {
  const step = window.innerHeight;
  for (let y = 0; y < document.body.scrollHeight; y += step){
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 90));
  }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 200));
  return true;
})()`;

/* Chờ mọi ảnh giải mã xong rồi mới chụp. Ảnh lazy còn ngoài khung nhìn sẽ
   không bao giờ giải mã, nên phải có hạn chờ, nếu không lời hứa treo mãi. */
const IMAGES_READY = `Promise.race([
  Promise.all([...document.images].map(i => i.complete ? 0 : i.decode().catch(() => 0))),
  new Promise(r => setTimeout(r, 4000)),
]).then(() => true)`;

async function main(){
  const { proc, profile, wsUrl } = await launch();
  const browser = await CDP.connect(wsUrl);
  if (SHOTS) mkdirSync(SHOTDIR, { recursive: true });

  let failures = 0;

  try {
    for (const width of WIDTHS){
      for (const screen of SCREENS){
        const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });

        await browser.send('Page.enable', {}, sessionId);
        await browser.send('Runtime.enable', {}, sessionId);
        const isOb = screen === 'ob';
        await browser.send('Emulation.setDeviceMetricsOverride', {
          width, height: HEIGHT, deviceScaleFactor: 2, mobile: true,
        }, sessionId);

        const route = isOb ? '' : `#/${screen}`;
        await browser.send('Page.navigate', { url: `${ORIGIN}/index.html${route}` }, sessionId);
        await sleep(2200);
        if (isOb){
          // ép màn mở thiệp về một bước cụ thể để soi từng trạng thái
          const forced = val('--state');
          if (forced){
            await browser.send('Runtime.evaluate', { expression:
              `document.getElementById('onboarding').dataset.state = ${JSON.stringify(forced)}`,
            }, sessionId);
            await sleep(1200);
          }
        } else {
          await browser.send('Runtime.evaluate', { expression: SKIP_OB }, sessionId);
        }
        await browser.send('Runtime.evaluate',
          { expression: IMAGES_READY, awaitPromise: true }, sessionId);
        await sleep(700);

        const { result } = await browser.send('Runtime.evaluate',
          { expression: AUDIT_EXPR, returnByValue: true }, sessionId);
        const r = JSON.parse(result.value);

        const overflow = r.scrollWidth - r.inner;
        const pass = overflow <= 0;
        if (!pass) failures++;

        console.log(`  ${screen.padEnd(7)} @ ${String(width).padStart(3)}px  ` +
                    `scrollWidth=${r.scrollWidth} inner=${r.inner} overflow=${overflow}  ` +
                    (pass ? 'PASS' : 'FAIL'));
        for (const o of r.offenders){
          console.log(`        ↳ ${o.tag}.${o.cls}  left=${o.left} right=${o.right}`);
        }

        if (SHOTS){
          if (!isOb){
            await browser.send('Runtime.evaluate',
              { expression: RASTERISE, awaitPromise: true }, sessionId);
          }
          const { data } = await browser.send('Page.captureScreenshot',
            { format: 'jpeg', quality: 72, captureBeyondViewport: !isOb }, sessionId);
          writeFileSync(join(SHOTDIR, `${screen}-${width}.jpg`), Buffer.from(data, 'base64'));
        }

        await browser.send('Target.closeTarget', { targetId });
      }
    }
  } finally {
    // đợi Chrome đóng hẳn rồi mới xoá profile, nếu không thư mục vẫn còn
    // file đang mở và rmSync báo ENOTEMPTY
    const closed = new Promise(r => proc.once('exit', r));
    proc.kill();
    await Promise.race([closed, sleep(3000)]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }

  console.log(failures === 0 ? '\nAll widths pass.' : `\n${failures} case(s) FAIL.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
