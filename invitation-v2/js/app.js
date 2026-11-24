/* =============================================================
   Thành & Trinh — invitation runtime
   Vanilla ES2019, no dependencies.
   ============================================================= */
(function () {
  'use strict';

  var CFG   = window.WEDDING || {};
  var $     = function (s, r) { return (r || document).querySelector(s); };
  var $$    = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     1 ▸ The deck — pages 1-8, advanced by tapping the screen.
         Each page cross-fades into the next; page 6 moves on by
         itself once the film has played out.
     --------------------------------------------------------- */
  var ROOT    = document.documentElement;
  var deck    = $('#deck');
  var scenes  = $$('.scene', deck);
  var LAST    = scenes.length;
  var bar     = $('#progress-bar');
  var cueText = $('#cue-text');
  var at      = 0;          // 1-based page; 0 = nothing shown yet
  var busy    = false;      // ignore taps during a cross-fade
  var FADE    = REDUCE ? 20 : 500;

  var CUE = { 1: 'tap to open', 6: 'tap to skip', 8: 'tap for the details' };

  var flashEl = $('#flash');
  function show(n) {
    if (n > LAST) { finishDeck(); return; }
    if (n < 1 || n === at) return;
    // the reference washes the frame to white on exactly this one turn
    if (at === 1 && n === 2 && flashEl && !REDUCE) {
      flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
    }
    // after the scratch, page 3 is the same picture as page 2 minus the foil:
    // cross-fading two identical frames only produces a dip in brightness, so cut.
    var cut = (at === 2 && n === 3);
    if (cut && deck) deck.classList.add('cut');
    at = n;
    for (var i = 0; i < scenes.length; i++) scenes[i].classList.toggle('is-live', i === n - 1);
    if (cut && deck) requestAnimationFrame(function () {
      requestAnimationFrame(function () { deck.classList.remove('cut'); });
    });
    ROOT.setAttribute('data-at', String(n));
    if (bar) bar.style.width = (n / LAST * 100) + '%';
    if (cueText) cueText.textContent = CUE[n] || 'tap to continue';
    // the film has its own soundtrack — the two must never talk over each other
    if (n === 6) { music.hush(true); video.enter(); }
    else         { video.leave();    music.hush(false); }
    if (n === 7) music.wantPlay();
    if (n === 2 && scratch) window.setTimeout(scratch.remeasure, 40);
    preload(n + 1);
    busy = true;
    window.setTimeout(function () { busy = false; }, FADE);
  }

  var gateTries = 0;
  function next() {
    if (busy) return;
    // page 2 asks to be scratched first — but never trap a guest there
    if (at === 2 && scratch && !scratch.done) {
      if (++gateTries >= 3) { scratch.reveal(); return; }
      var hint = $('#scratch');
      if (hint) { hint.classList.remove('nudge'); void hint.offsetWidth; hint.classList.add('nudge'); }
      return;
    }
    show(at + 1);
  }
  function prev() { if (!busy && at > 1) show(at - 1); }

  /* Pages 3-8 ship as placeholders (data-src / data-srcset). A page's images
     are only requested when the guest is one page away, so a phone on a slow
     connection never downloads the whole film-and-artwork set up front. */
  function hydrate(n) {
    var s = scenes[n - 1];
    if (!s) return;
    $$('img[data-src]', s).forEach(function (im) {
      if (im.dataset.srcset) im.setAttribute('srcset', im.dataset.srcset);
      im.setAttribute('src', im.dataset.src);
      im.removeAttribute('data-src');
      im.removeAttribute('data-srcset');
    });
  }
  function preload(n) {
    hydrate(n);
    var s = scenes[n - 1];
    if (!s) return;
    $$('img', s).forEach(function (im) {
      im.setAttribute('fetchpriority', 'high');
      if (!im.complete && im.decode) im.decode().catch(function () {});
    });
  }

  function finishDeck() {
    video.leave();
    ROOT.classList.remove('deck-on');
    ROOT.classList.add('deck-done');
    ROOT.removeAttribute('data-at');
    window.scrollTo(0, 0);
    startReveals();
    document.dispatchEvent(new Event('deckdone'));
    // let the deck fade out, then stand it down completely
    window.setTimeout(function () {
      for (var i = 0; i < scenes.length; i++) scenes[i].classList.remove('is-live');
      at = 0;
    }, REDUCE ? 20 : 780);
  }

  /* --- tap / swipe ----------------------------------------- */
  var INTERACTIVE = 'button, a, input, select, textarea, label, canvas, .story, .modal';
  var down = null, slid = 0;

  if (deck) {
    deck.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY, t: Date.now() }; slid = 0;
    });
    deck.addEventListener('pointermove', function (e) {
      if (down) slid = Math.max(slid, Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y));
    });
    deck.addEventListener('pointercancel', function () { down = null; });
    deck.addEventListener('pointerup', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y, dt = Date.now() - down.t;
      down = null;
      if (e.target.closest && e.target.closest(INTERACTIVE)) return;

      // an open story panel closes on the next tap instead of turning the page
      var open = $('.story.is-open');
      if (open) { closePanel(open); return; }

      if (Math.abs(dy) > 56 && Math.abs(dy) > Math.abs(dx) * 1.3) { dy < 0 ? next() : prev(); return; }
      if (slid < 14 && dt < 800) next();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!ROOT.classList.contains('deck-on')) return;
    var t = e.target;
    if (t && t.closest && t.closest('button, a, input, select, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); next();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); prev();
    }
  });

  /* ---------------------------------------------------------
     2 ▸ Reveal-on-scroll for the long sections.
         Held back until the deck is done, otherwise H1 would
         animate itself away behind the deck.
     --------------------------------------------------------- */
  var revealIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  var revealsOn = false;
  function startReveals() {
    if (revealsOn) return;
    revealsOn = true;
    $$('.sect .anim').forEach(function (el) { revealIO.observe(el); });
  }

  /* ---------------------------------------------------------
     3 ▸ Scratch-to-reveal (scene 2)
     --------------------------------------------------------- */
  function Scratch(root) {
    var canvas  = $('.scratch__canvas', root);
    var img     = $('.scratch__foil', root);
    var ctx     = canvas.getContext('2d', { willReadFrequently: false });
    var GRID    = 22;
    var cells   = new Uint8Array(GRID * GRID);
    var filled  = 0;
    var done    = false;
    var painting = false;
    var ready   = false;
    var last    = null;

    function size() {
      // offsetWidth/Height are the LAYOUT box: unlike getBoundingClientRect they
      // ignore the entrance transform, so the foil is never drawn into a canvas
      // that is still squashed mid-animation.
      var cw = canvas.offsetWidth, ch = canvas.offsetHeight;
      if (!cw || !ch) return false;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(cw * dpr), h = Math.round(ch * dpr);
      if (canvas.width === w && canvas.height === h && ready) return true;
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-out';
      ready = true;
      return true;
    }

    function pt(ev) {
      var r = canvas.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
    }

    function brush(p) {
      var R = canvas.width * 0.085;
      var x = p.x * canvas.width, y = p.y * canvas.height;
      var g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.62, 'rgba(0,0,0,.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, R, 0, 6.2832); ctx.fill();
      mark(p);
    }

    function mark(p) {
      var gx = Math.floor(p.x * GRID), gy = Math.floor(p.y * GRID);
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        var ax = gx + dx, ay = gy + dy;
        if (ax < 0 || ay < 0 || ax >= GRID || ay >= GRID) continue;
        if (dx * dx + dy * dy > 5) continue;
        var i = ay * GRID + ax;
        if (!cells[i]) { cells[i] = 1; filled++; }
      }
      if (!done && filled / (GRID * GRID) >= (CFG.SCRATCH_THRESHOLD || 0.52)) finish();
    }

    function line(a, b) {
      var d = Math.hypot(b.x - a.x, b.y - a.y);
      var steps = Math.max(1, Math.ceil(d * 26));
      for (var i = 1; i <= steps; i++) {
        brush({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps });
      }
    }

    function down(ev) {
      if (done || !size()) return;
      painting = true; last = pt(ev); brush(last);
      canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
      root.classList.add('is-scratching');
      ev.preventDefault();
    }
    function move(ev) {
      if (!painting || done) return;
      var p = pt(ev); line(last, p); last = p; ev.preventDefault();
    }
    function up() { painting = false; last = null; }

    /* Once enough has come off, the rest of the foil is swept away as one
       soft wave down the card. Fading a half-scratched slab out instead
       just looks like the reveal stopped halfway. */
    function sweep(after) {
      var W = canvas.width, H = canvas.height;
      var FEATHER = H * 0.30, DUR = 540, t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / DUR);
        var e = 1 - Math.pow(1 - k, 3);                 // ease-out cubic
        var front = e * (H + FEATHER);
        var top = Math.max(0, front - FEATHER);
        if (top > 0) { ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fillRect(0, 0, W, top); }
        var g = ctx.createLinearGradient(0, top, 0, front);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, top, W, front - top);
        if (k < 1) requestAnimationFrame(step); else if (after) after();
      })(t0);
    }

    function finish() {
      done = true;
      document.documentElement.setAttribute('data-scratched', '1');
      sweep(function () {
        root.classList.add('is-revealed');
        window.setTimeout(function () { goToScene(3); }, 420);
      });
    }

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove',  function (e) { e.preventDefault(); }, { passive: false });
    window.addEventListener('resize', function () { ready = false; });

    if (img.complete) size(); else img.addEventListener('load', size);

    return {
      get done() { return done; },
      remeasure: function () { if (!done) { ready = false; size(); } },
      reveal: function () { if (!done) { root.classList.add('is-revealed'); done = true;
        document.documentElement.setAttribute('data-scratched', '1'); } }
    };
  }

  var scratch = $('#scratch') ? Scratch($('#scratch')) : null;

  function goToScene(n) { show(n); }

  /* ---------------------------------------------------------
     4 ▸ Page-6 film
     --------------------------------------------------------- */
  var video = (function () {
    var v = $('#film');
    var started = false, timer = 0, guard = 0;

    function done() {
      // the film is the one page that turns itself
      if (at === 6) { busy = false; show(7); }
    }

    if (v) {
      v.addEventListener('ended', done);
      // a stalled or un-decodable file must not strand the guest on page 6
      v.addEventListener('error', function () {
        window.clearTimeout(guard);
        guard = window.setTimeout(done, 3500);
      });
    }

    return {
      enter: function () {
        if (!v) return;
        if (!v.getAttribute('src') && v.dataset.src) {
          // phones get the lighter 960 px encode; everything else the 1280 px one
          var small = window.matchMedia('(max-width: 760px)').matches && v.dataset.mobile;
          v.setAttribute('src', small ? v.dataset.mobile : v.dataset.src);
          v.load();
        }
        window.clearTimeout(timer);

        // The film has its own soundtrack, so play() must fire inside the very
        // tap that turned the page — Safari only grants sound to a play() call
        // that sits in the user-gesture stack. Any delay here loses the audio.
        v.muted = false;
        var p = v.play();
        if (p && p.catch) p.catch(function () {
          // sound refused: play it silently rather than not at all
          v.muted = true;
          var q = v.play();
          if (q && q.catch) q.catch(function () {
            window.clearTimeout(guard);
            guard = window.setTimeout(done, 4000);
          });
        });
        if (!started) { started = true; document.documentElement.setAttribute('data-film', '1'); }

        // backstop: whatever happens, page 6 never holds for longer than the
        // film plus a beat. Uses real duration once the metadata has landed.
        window.clearTimeout(guard);
        var len = (v.duration && isFinite(v.duration) ? v.duration : 31) * 1000;
        guard = window.setTimeout(done, len + 5000);
      },
      leave: function () {
        window.clearTimeout(timer); window.clearTimeout(guard);
        if (v && !v.paused) v.pause();
        if (v) { try { v.currentTime = 0; } catch (e) {} }
      }
    };
  })();

  /* ---------------------------------------------------------
     5 ▸ Music — "The Ordinary"
     --------------------------------------------------------- */
  var music = (function () {
    var el = null;
    var on = false;        // audible right now
    var blocked = false;   // we asked to play and the browser said no
    var missing = false;   // the file could not be loaded at all
    var tried = false;     // page 7 has already made its one attempt
    var btns = $$('[data-music]');   // the vinyl on page 7 + the small one that
    var raf = 0;                     // stays with the guest after the deck

    function audio() {
      if (el) return el;
      el = new Audio();
      el.src = CFG.MUSIC_SRC;
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      el.addEventListener('error', function () {
        missing = true; blocked = false; on = false; paint();
      });
      return el;
    }

    function fade(to, ms) {
      var a = audio(), from = a.volume, t0 = performance.now();
      cancelAnimationFrame(raf);
      (function step(t) {
        var k = Math.min(1, (t - t0) / ms);
        a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k < 1) raf = requestAnimationFrame(step);
        else if (to === 0) a.pause();
      })(t0);
    }

    function paint() {
      btns.forEach(function (btn) {
        btn.classList.toggle('is-playing', on);
        // the pulsing ring means "the browser is holding the music back",
        // never "the guest chose silence".
        btn.classList.toggle('is-blocked', blocked && !on && !missing);
        btn.classList.toggle('is-missing', missing);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label',
          (on ? 'Pause ' : 'Play ') + (CFG.MUSIC_TITLE || 'the music'));
      });
    }

    function start() {
      var p = audio().play();
      if (!p || !p.then) { on = true; blocked = false; fade(CFG.MUSIC_VOLUME || 0.55, 1400); paint(); return; }
      p.then(function () {
        on = true; blocked = false;
        fade(CFG.MUSIC_VOLUME || 0.55, 1400);
        paint();
      }).catch(function () {
        on = false; blocked = !missing;
        paint();
      });
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        tried = true;
        if (on) { on = false; blocked = false; fade(0, 500); paint(); }
        else { start(); }
      });
    });

    var hushed = false;
    return {
      // called once, when the guest first reaches page 7
      wantPlay: function () { if (!tried) { tried = true; start(); } },
      // page 6 silences the music for the film, and hands it back afterwards
      hush: function (q) {
        if (q) { if (on) { hushed = true; on = false; fade(0, 300); paint(); } }
        else if (hushed) { hushed = false; start(); }
      },
      stop: function () { if (on) { on = false; blocked = false; fade(0, 400); paint(); } }
    };
  })();

  /* ---------------------------------------------------------
     6 ▸ Countdown
     --------------------------------------------------------- */
  (function countdown() {
    var box = $('#countdown');
    if (!box) return;
    var slots = { d: $('[data-cd="d"]', box), h: $('[data-cd="h"]', box),
                  m: $('[data-cd="m"]', box), s: $('[data-cd="s"]', box) };
    var target = Date.parse(CFG.EVENT_ISO || '2027-03-28T18:00:00+07:00');
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      var ms = Math.max(0, target - Date.now());
      var sec = Math.floor(ms / 1000);
      var d = Math.floor(sec / 86400);
      var h = Math.floor(sec % 86400 / 3600);
      var m = Math.floor(sec % 3600 / 60);
      var s = sec % 60;
      if (slots.d) slots.d.textContent = String(d);
      if (slots.h) slots.h.textContent = pad(h);
      if (slots.m) slots.m.textContent = pad(m);
      if (slots.s) slots.s.textContent = pad(s);
    }
    tick(); setInterval(tick, 1000);
  })();

  /* ---------------------------------------------------------
     7 ▸ "Our Story" seal  &  "Our Wedding Details" plate
     --------------------------------------------------------- */
  $$('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = document.getElementById(btn.getAttribute('data-toggle'));
      if (!t) return;
      var open = t.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  function closePanel(t) {
    if (!t) return;
    t.classList.toggle('is-open', false);
    var o = document.querySelector('[data-toggle="' + t.id + '"]');
    if (o) o.setAttribute('aria-expanded', 'false');
    return o;
  }
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var o = closePanel(document.getElementById(btn.getAttribute('data-close')));
      if (o) o.focus();
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $$('.story.is-open').forEach(closePanel);
  });

  $$('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = document.getElementById(btn.getAttribute('data-goto'));
      if (t) t.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---------------------------------------------------------
     7b ▸ H1 ends with a menu; H2 only exists once it is tapped
     --------------------------------------------------------- */
  (function details() {
    var h1 = $('#h1'), h2 = $('#h2'), bar = $('#detailbar');
    if (!h1 || !h2) return;
    var open = false;

    function openDetails() {
      if (open) return;
      open = true;
      ROOT.classList.add('details-open');
      ROOT.classList.remove('detailbar-on');
      // the section was display:none, so let it lay out before scrolling
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          h2.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
        });
      });
    }
    $$('[data-open-details]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openDetails(); });
    });

    // the menu surfaces once the guest has reached the foot of H1
    var ticking = false;
    function check() {
      ticking = false;
      if (open || !ROOT.classList.contains('deck-done')) return;
      var r = h1.getBoundingClientRect();
      var near = r.bottom <= window.innerHeight * 1.12 && r.bottom > 0;
      ROOT.classList.toggle('detailbar-on', near);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    window.addEventListener('resize', check);
    window.setTimeout(check, 400);
    document.addEventListener('deckdone', check);
  })();

  /* ---------------------------------------------------------
     8 ▸ QR modal — the letter for guests who cannot come
     --------------------------------------------------------- */
  (function qr() {
    var open = $('#letter'), modal = $('#qr'), close = $('#qr-close');
    if (!open || !modal) return;
    var lastFocus = null;
    function show() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      requestAnimationFrame(function () { modal.classList.add('is-open'); });
      document.body.classList.add('is-locked');
      (close || modal).focus();
    }
    function hide() {
      modal.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      window.setTimeout(function () { modal.hidden = true; }, 320);
      if (lastFocus) lastFocus.focus();
    }
    open.addEventListener('click', show);
    if (close) close.addEventListener('click', hide);
    modal.addEventListener('click', function (e) { if (e.target === modal) hide(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) hide();
    });
  })();

  /* ---------------------------------------------------------
     9 ▸ RSVP
     --------------------------------------------------------- */
  (function rsvp() {
    var form = $('#rsvp-form');
    if (!form) return;
    var btn   = $('#rsvp-send', form);
    var state = $('#rsvp-state');
    var wishes = $('#rsvp-wishes', form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (form.elements.name.value || '').trim();
      if (!name) {
        form.elements.name.focus();
        form.classList.add('is-invalid');
        window.setTimeout(function () { form.classList.remove('is-invalid'); }, 1200);
        return;
      }
      var data = {
        name: name,
        attending: (form.elements.attending && form.elements.attending.value) || '',
        guests: (form.elements.guests && form.elements.guests.value) || '',
        wishes: (wishes && wishes.value || '').trim(),
        ua: navigator.userAgent
      };

      btn.disabled = true;
      form.classList.add('is-sending');

      var url = CFG.RSVP_ENDPOINT;
      var finish = function (ok) {
        form.classList.remove('is-sending');
        form.classList.add(ok ? 'is-sent' : 'is-error');
        if (state) {
          state.textContent = ok
            ? 'Thank you, ' + name.split(' ').slice(-1)[0] + '. Your seat is saved. ♥'
            : 'We could not reach the server — please try again, or text us directly.';
        }
        if (!ok) btn.disabled = false;
      };

      if (!url) { window.setTimeout(function () { finish(true); }, 650); return; }

      fetch(url, {
        method: 'POST',
        // text/plain keeps this a "simple request": no CORS preflight,
        // which Apps Script web apps cannot answer.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (j) { finish(!!(j && j.ok)); })
        .catch(function () { finish(false); });
    });

    // "Other: leave your wishes here" focuses the textarea
    $$('input[name="attending"]', form).forEach(function (r) {
      r.addEventListener('change', function () {
        form.setAttribute('data-choice', r.value);
        if (r.value === 'other' && wishes) wishes.focus();
      });
    });
  })();

  /* ---------------------------------------------------------
     9b ▸ Venue link
     --------------------------------------------------------- */
  (function maps() {
    var a = document.getElementById('maplink');
    if (a && CFG.MAPS_URL) a.setAttribute('href', CFG.MAPS_URL);
  })();

  /* ---------------------------------------------------------
     10 ▸ Progressive asset warm-up
     --------------------------------------------------------- */
  /* No background warm-up: pages 3-8 are fetched one page ahead (see
     preload/hydrate above), so a phone never pulls the full artwork set on load. */

  /* ---------------------------------------------------------
     11 ▸ Boot
     --------------------------------------------------------- */
  ROOT.classList.add('js');
  if (deck && scenes.length) {
    ROOT.classList.add('deck-on');
    show(1);
  } else {
    startReveals();            // no deck in the markup — just show the sections
  }
  window.addEventListener('load', function () {
    ROOT.classList.add('is-loaded');
  });
})();
