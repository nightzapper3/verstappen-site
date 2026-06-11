/* ============================================================
   MONVMENTVM MAXIMI — behavior
   preloader · inertial scroll · reveals · parallax · cursor
   track · countdown · counters · placard
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* central ticker: rAF when available, timer fallback when rAF is starved
     (hidden/headless iframes). Subscribers get (now) each frame. */
  var tickSubs = [];
  var lastRafTs = 0;
  function onTick(fn) {
    tickSubs.push(fn);
    window.__mvSubs = tickSubs.length;
    return function unsub() {
      var i = tickSubs.indexOf(fn);
      if (i >= 0) tickSubs.splice(i, 1);
    };
  }
  function runTick(now) {
    window.__mvTicks = (window.__mvTicks || 0) + 1;
    for (var i = tickSubs.length - 1; i >= 0; i--) {
      try { tickSubs[i](now); } catch (err) { /* keep other subs alive */ }
    }
  }
  (function rafLoop(now) {
    lastRafTs = performance.now();
    runTick(now || lastRafTs);
    requestAnimationFrame(rafLoop);
  })(performance.now());
  setInterval(function () {
    if (performance.now() - lastRafTs > 200) runTick(performance.now());
  }, 50);
  var finePointer = matchMedia('(pointer: fine)').matches;
  var SMOOTH = finePointer && !reduced && innerWidth > 900;

  window.__mvMotion = 1; // scaled by Tweaks

  /* ---------- preloader ---------- */
  var pre = document.getElementById('preloader');
  var lamps = pre ? Array.prototype.slice.call(pre.querySelectorAll('.lamp')) : [];
  var preCap = pre ? pre.querySelector('.pre-cap') : null;
  var preDone = false;

  function finishPreloader() {
    if (preDone || !pre) return;
    preDone = true;
    pre.classList.add('away');
    document.body.classList.add('loaded');
    setTimeout(function () { pre.remove(); }, 1300);
    // pin fixed chrome to final state (transitions can freeze headless)
    setTimeout(function () {
      ['topbar', 'placard'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.style.transition = 'none'; el.style.opacity = '1'; el.style.transform = 'none'; }
      });
    }, 2400);
  }

  function runPreloader() {
    if (!pre) { document.body.classList.add('loaded'); return; }
    if (reduced) { finishPreloader(); return; }
    var i = 0;
    var ignite = setInterval(function () {
      if (i < lamps.length) {
        lamps[i].classList.add('on');
        i++;
      } else {
        clearInterval(ignite);
        setTimeout(function () {
          lamps.forEach(function (l) { l.classList.remove('on'); l.classList.add('out'); });
          if (preCap) preCap.textContent = 'AND AWAY WE GO';
          setTimeout(finishPreloader, 620);
        }, 720);
      }
    }, 260);
    pre.addEventListener('click', finishPreloader);
    setTimeout(finishPreloader, 5200); // hard safety
  }

  /* ---------- inertial scroll (wheel-lerp, native flow) ---------- */
  var page = document.getElementById('page');
  var cur = window.scrollY || 0, target = cur, lastWritten = -1;

  function maxScroll() {
    return Math.max(0, docEl.scrollHeight - innerHeight);
  }

  if (SMOOTH) {
    docEl.classList.add('smooth');
    addEventListener('wheel', function (e) {
      if (e.ctrlKey) return; // pinch-zoom
      e.preventDefault();
      target = Math.max(0, Math.min(maxScroll(), target + e.deltaY));
    }, { passive: false });
    addEventListener('scroll', function () {
      // resync ONLY for scrolls we didn't write ourselves
      // (scrollbar drag, keyboard, find-in-page). Our own scrollTo()
      // events arrive a frame late — compare against what we wrote,
      // not against the already-advanced lerp position.
      var y = window.scrollY || 0;
      if (Math.abs(y - lastWritten) > 2 && Math.abs(y - cur) > 2) {
        cur = target = y;
      }
    }, { passive: true });
  }

  function pageY(el) {
    var r = el.getBoundingClientRect();
    return r.top + (window.scrollY || 0);
  }

  /* ---------- reveal registry ---------- */
  var revealEls = [];
  function collectReveals() {
    revealEls = Array.prototype.slice.call(document.querySelectorAll('.rv, .rv-line, .rv-rule, [data-split]'))
      .filter(function (el) { return !el.classList.contains('in'); });
  }

  function finalizeReveal(el) {
    // After the transition window, pin final values inline (transitions can
    // freeze in hidden/headless iframes; timers still run there).
    setTimeout(function () {
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = el.classList.contains('rv-rule') ? 'scaleX(1)' : 'none';
      if (el.classList.contains('rv-line')) {
        var s = el.firstElementChild;
        if (s) { s.style.transition = 'none'; s.style.transform = 'none'; }
      }
    }, 2300);
  }

  function checkReveals() {
    if (!revealEls.length) return;
    var vh = innerHeight;
    var remaining = [];
    for (var i = 0; i < revealEls.length; i++) {
      var el = revealEls[i];
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.88 && r.bottom > 0) {
        el.classList.add('in');
        if (el.hasAttribute('data-split')) {
          // after the cascade finishes, hand the letters over to hover-wave mode
          (function (sEl) {
            setTimeout(function () {
              sEl.removeAttribute('data-split');
              sEl.classList.add('wave-on');
              // pin final state (transitions can freeze in hidden iframes),
              // then release so the class-based hover transitions take over
              var ls = sEl.querySelectorAll('.wl');
              ls.forEach(function (s) {
                s.style.transition = 'none';
                s.style.opacity = '1';
                s.style.transform = 'none';
                s.style.filter = 'none';
              });
              setTimeout(function () {
                ls.forEach(function (s) {
                  s.style.removeProperty('transition');
                  s.style.removeProperty('opacity');
                  s.style.removeProperty('transform');
                  s.style.removeProperty('filter');
                });
              }, 150);
            }, 2100);
          })(el);
        } else {
          finalizeReveal(el);
        }
        if (el.hasAttribute('data-count')) startCounter(el);
      } else {
        remaining.push(el);
      }
    }
    revealEls = remaining;
  }

  /* ---------- counters ---------- */
  function startCounter(el) {
    var endVal = parseFloat(el.getAttribute('data-count'));
    var numEl = el.querySelector('[data-num]') || el;
    var dur = 1600;
    var t0 = null;
    if (reduced) { numEl.textContent = String(endVal); return; }
    var stop = onTick(function (ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 4);
      numEl.textContent = String(Math.round(endVal * eased));
      if (p >= 1) stop();
    });
  }

  /* ---------- parallax ---------- */
  var prxEls = [];
  function collectParallax() {
    prxEls = Array.prototype.slice.call(document.querySelectorAll('[data-prx]')).map(function (el) {
      return { el: el, f: parseFloat(el.getAttribute('data-prx')) || 0.1 };
    });
  }
  function applyParallax() {
    if (reduced) return;
    var vh = innerHeight;
    var m = window.__mvMotion;
    for (var i = 0; i < prxEls.length; i++) {
      var o = prxEls[i];
      var r = o.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      var center = r.top + r.height / 2 - vh / 2;
      o.el.style.transform = 'translate3d(0,' + (center * o.f * m).toFixed(1) + 'px,0)';
    }
  }

  /* ---------- placard ---------- */
  var placard = document.getElementById('placard');
  var placardText = '';
  var labeled = [];
  function collectLabeled() {
    labeled = Array.prototype.slice.call(document.querySelectorAll('[data-placard]'));
  }
  function updatePlacard() {
    if (!placard) return;
    var best = '';
    for (var i = 0; i < labeled.length; i++) {
      var r = labeled[i].getBoundingClientRect();
      if (r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.25) {
        best = labeled[i].getAttribute('data-placard');
      }
    }
    if (best && best !== placardText) {
      placardText = best;
      placard.textContent = best;
    }
  }

  /* ---------- main loop ---------- */
  var frame = 0;
  function mainTick() {
    frame++;
    if (SMOOTH && Math.abs(target - cur) > 0.1) {
      cur += (target - cur) * 0.09;
      if (Math.abs(target - cur) < 0.5) cur = target;
      lastWritten = Math.round(cur);
      window.scrollTo(0, lastWritten);
    }
    if (frame % 2 === 0) {
      checkReveals();
      applyParallax();
    }
    if (frame % 12 === 0) updatePlacard();
  }

  /* ---------- nav anchors ---------- */
  function wireAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        var top = Math.max(0, pageY(el) - 20);
        if (SMOOTH) {
          target = Math.min(maxScroll(), top); // lerp does the easing
        } else {
          window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
        }
      });
    });
  }

  /* ---------- custom cursor ---------- */
  function wireCursor() {
    if (!finePointer || reduced) return;
    var c = document.getElementById('cursor');
    if (!c) return;
    docEl.classList.add('fine-cursor');
    var tag = c.querySelector('.cursor-tag');
    var cx = -100, cy = -100, tx = -100, ty = -100;
    addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
    onTick(function () {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      c.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    });
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-cursor], a, button, image-slot');
      if (t) {
        c.classList.add('big');
        var label = t.getAttribute && t.getAttribute('data-cursor');
        if (!label && t.tagName === 'IMAGE-SLOT') label = 'DROP';
        tag.textContent = label || '';
      } else {
        c.classList.remove('big');
      }
    });
  }

  /* ---------- marquee ---------- */
  function wireMarquees() {
    document.querySelectorAll('.marquee .train').forEach(function (train) {
      train.innerHTML += train.innerHTML; // duplicate for seamless loop
    });
  }

  /* ---------- countdown ---------- */
  var GP_TIME = Date.UTC(2026, 5, 14, 13, 0, 0); // 14 Jun 2026, 15:00 CEST
  function wireCountdown() {
    var box = document.getElementById('countdown');
    if (!box) return;
    var d = box.querySelector('[data-u="d"]');
    var h = box.querySelector('[data-u="h"]');
    var m = box.querySelector('[data-u="m"]');
    var s = box.querySelector('[data-u="s"]');
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      var diff = GP_TIME - Date.now();
      if (diff <= 0) {
        d.textContent = '00'; h.textContent = '00'; m.textContent = '00'; s.textContent = '00';
        var note = document.getElementById('gp-live-note');
        if (note) note.textContent = 'LVMINA EXSTINCTA — IT IS RACE DAY';
        return;
      }
      var sec = Math.floor(diff / 1000);
      d.textContent = pad(Math.floor(sec / 86400));
      h.textContent = pad(Math.floor(sec / 3600) % 24);
      m.textContent = pad(Math.floor(sec / 60) % 60);
      s.textContent = pad(sec % 60);
      setTimeout(tick, 1000 - (Date.now() % 1000));
    }
    tick();
  }

  /* ---------- interactive track ---------- */
  var CORNERS = [
    { x: 668, y: 440, name: 'T1 · ELF' },
    { x: 782, y: 188, name: 'T4 · REPSOL' },
    { x: 662, y: 238, name: 'T5 · SEAT' },
    { x: 384, y: 178, name: 'T9 · CAMPSA' },
    { x: 196, y: 394, name: 'T10 · LA CAIXA' },
    { x: 290, y: 390, name: 'T12 · BANC SABADELL' }
  ];

  function wireTrack() {
    var svg = document.getElementById('tracksvg');
    if (!svg) return;
    var race = svg.querySelector('.raceline');
    var dot = svg.querySelector('.lapdot');
    var halo = svg.querySelector('.lapdot-halo');
    var tip = document.getElementById('tracktip');
    var box = document.getElementById('trackbox');
    var L = race.getTotalLength();

    // scroll-draw
    race.style.strokeDasharray = L + ' ' + L;
    race.style.strokeDashoffset = reduced ? 0 : L;

    // corner markers snapped onto the path
    var samples = [];
    var N = 700;
    for (var i = 0; i <= N; i++) samples.push(race.getPointAtLength((i / N) * L));
    function snap(x, y) {
      var best = 0, bd = Infinity;
      for (var i = 0; i <= N; i++) {
        var dx = samples[i].x - x, dy = samples[i].y - y;
        var d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = i; }
      }
      return samples[best];
    }
    var NS = 'http://www.w3.org/2000/svg';
    CORNERS.forEach(function (c) {
      var p = snap(c.x, c.y);
      var dotEl = document.createElementNS(NS, 'circle');
      dotEl.setAttribute('class', 'corner-dot');
      dotEl.setAttribute('cx', p.x); dotEl.setAttribute('cy', p.y); dotEl.setAttribute('r', 4.5);
      var hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('class', 'corner-hit');
      hit.setAttribute('cx', p.x); hit.setAttribute('cy', p.y); hit.setAttribute('r', 18);
      hit.setAttribute('data-cursor', 'CVRVA');
      svg.appendChild(dotEl);
      svg.appendChild(hit);
      function show() {
        var br = box.getBoundingClientRect();
        var sr = svg.getBoundingClientRect();
        var sx = sr.width / 900, sy = sr.height / 600;
        tip.textContent = c.name;
        tip.style.left = (sr.left - br.left + p.x * sx) + 'px';
        tip.style.top = (sr.top - br.top + p.y * sy) + 'px';
        tip.classList.add('show');
        dotEl.setAttribute('r', 7);
      }
      function hide() { tip.classList.remove('show'); dotEl.setAttribute('r', 4.5); }
      hit.addEventListener('mouseenter', show);
      hit.addEventListener('mouseleave', hide);
      hit.addEventListener('click', show);
    });

    // lap dot
    var lapT = 0;
    var LAP_SECONDS = 14;
    var last = performance.now();
    onTick(function (now) {
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!reduced) lapT = (lapT + dt / LAP_SECONDS) % 1;
      var p = race.getPointAtLength(lapT * L);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y);
    });

    // draw progress tied to viewport position
    onTick(function () {
      if (reduced) return;
      var r = box.getBoundingClientRect();
      var vh = innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (vh * 0.75)));
      race.style.strokeDashoffset = String(L * (1 - p));
    });
  }

  /* ---------- wave letter splitting (entrance + hover) ---------- */
  function waveSplit(el, enter) {
    var label = el.textContent;
    var li = 0;
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) return; // keep <br>, <small>, <em> intact
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
        var wspan = document.createElement('span');
        wspan.className = 'ww';
        wspan.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(w, function (ch) {
          var s = document.createElement('span');
          s.className = 'wl';
          s.textContent = ch;
          s.style.setProperty('--wd', (li * 0.018).toFixed(3) + 's');
          if (enter) s.style.setProperty('--d', (0.1 + li * 0.045).toFixed(3) + 's');
          li++;
          wspan.appendChild(s);
        });
        frag.appendChild(wspan);
      });
      el.replaceChild(frag, node);
    });
    el.setAttribute('aria-label', label.replace(/\s+/g, ' ').trim());
  }

  function splitLetters() {
    document.querySelectorAll('[data-split]').forEach(function (el) { waveSplit(el, true); });
    document.querySelectorAll('[data-wave]').forEach(function (el) { waveSplit(el, false); });
  }

  /* ---------- boot ---------- */
  function boot() {
    splitLetters();
    wireMarquees();
    collectReveals();
    collectParallax();
    collectLabeled();
    wireAnchors();
    wireCursor();
    wireCountdown();
    wireTrack();
    runPreloader();
    onTick(mainTick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
