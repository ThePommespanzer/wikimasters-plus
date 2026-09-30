(() => {
  let settings = { ...WM.DEFAULTS };
  let packState = null;
  let detectedPeriod = null;
  let lastSent = null;

  const toPage = () => window.postMessage({ __wmPlusSettings: settings }, location.origin);
  chrome.storage.local.get(['settings', 'packState', 'detectedPeriod'], (r) => {
    settings = { ...WM.DEFAULTS, ...(r.settings || {}) };
    toPage();
    packState = r.packState || null;
    detectedPeriod = r.detectedPeriod || null;
  });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.cacheClearReq) window.postMessage({ __wmPlusCacheClear: true }, location.origin);
    if (ch.settings) { settings = { ...WM.DEFAULTS, ...(ch.settings.newValue || {}) }; toPage(); }
    if (ch.packState) packState = ch.packState.newValue || null;
    if (ch.detectedPeriod) detectedPeriod = ch.detectedPeriod.newValue || null;
  });

  const send = (msg, cb) => { try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; cb && cb(r); }); } catch (_) {} };
  const period = () => WM.periodFor(settings.regenMode, detectedPeriod);
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const TIER = { C: 0, PC: 1, R: 2, SR: 3, UR: 4, L: 5 };

  // =====================================================================
  //  Calque d'effets (Shadow DOM, au-dessus de tout, ne capte aucun clic)
  // =====================================================================
  const host = document.createElement('div');
  host.id = 'wm-plus-root';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
  <style>
    :host{all:initial}
    .fx{position:fixed;inset:0;pointer-events:none;overflow:hidden}
    .dim{position:absolute;inset:0;opacity:0}
    .rays{position:absolute;width:260vmax;height:260vmax;margin:-130vmax 0 0 -130vmax;opacity:0;
      background:repeating-conic-gradient(var(--c) 0deg 5deg, transparent 5deg 15deg);
      -webkit-mask:radial-gradient(circle, transparent 0 4%, #000 9%, transparent 36%);
              mask:radial-gradient(circle, transparent 0 4%, #000 9%, transparent 36%)}
    .flash{position:absolute;inset:0;opacity:0}
    .holo{position:absolute;overflow:hidden;border-radius:16px;opacity:0}
    .holo::before{content:"";position:absolute;inset:-50%;transform:translateX(-100%) rotate(20deg);
      background:linear-gradient(90deg,transparent 30%,rgba(255,0,128,.35),rgba(255,200,0,.4),rgba(0,255,170,.4),rgba(0,160,255,.4),rgba(190,0,255,.35),transparent 70%);
      mix-blend-mode:screen}
    .holo.go{opacity:1}
    .holo.go::before{animation:sweep 1.1s ease-in-out forwards}
    @keyframes sweep{to{transform:translateX(100%) rotate(20deg)}}
    canvas{position:absolute;inset:0;width:100%;height:100%}
    .banner{position:absolute;transform:translate(-50%,-50%);opacity:0;white-space:nowrap;text-align:center;color:#fff;
      font-family:var(--font-heading,system-ui),system-ui,-apple-system,"Segoe UI",sans-serif}
    .banner .bt{display:flex;align-items:center;justify-content:center;gap:.35em}
    .banner .w{font-size:clamp(34px,5.6vw,72px);line-height:1;font-weight:900;letter-spacing:.06em;color:#fff;
      text-shadow:0 0 14px var(--c),0 0 36px var(--c),0 0 70px color-mix(in srgb,var(--c) 60%,transparent),0 3px 0 rgba(0,0,0,.45)}
    .banner .o{font-size:clamp(18px,2.6vw,34px);color:var(--c);display:inline-block;animation:ospin 2s ease-out both}
    .banner small{display:inline-flex;align-items:center;gap:10px;margin-top:10px;font:600 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
      letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.92);text-shadow:0 1px 8px rgba(0,0,0,.8)}
    .banner small::before,.banner small::after{content:"";width:34px;height:1px;background:linear-gradient(90deg,transparent,var(--c))}
    .banner small::after{transform:scaleX(-1)}
    @keyframes ospin{from{transform:rotate(-180deg) scale(0)}60%{transform:rotate(20deg) scale(1.3)}to{transform:rotate(0) scale(1)}}
    .badge{position:absolute;transform:translate(-50%,-50%) scale(0);padding:6px 13px 5px;border-radius:999px;overflow:hidden;
      font:900 12px/1 var(--font-heading,system-ui),system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.12em;color:#06140e;
      background:linear-gradient(135deg,#ffffff 0%,#c9fbe6 40%,#34d399 100%);
      box-shadow:0 0 0 2px #0c0d0c,0 0 0 3px rgba(52,211,153,.6),0 8px 22px rgba(52,211,153,.45)}
    .badge::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 35%,rgba(255,255,255,.9) 50%,transparent 65%);
      transform:translateX(-120%);animation:bshine 2.6s ease-in-out .5s infinite}
    @keyframes bshine{0%,55%{transform:translateX(-120%)}80%,100%{transform:translateX(120%)}}
    .toast{position:fixed;right:16px;bottom:16px;width:min(340px,calc(100vw - 32px));pointer-events:auto;
      background:rgba(19,22,21,.96);color:#f2f4f3;border:.8px solid rgba(200,208,203,.14);border-radius:16px;
      box-shadow:0 12px 40px rgba(0,0,0,.5);font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;
      padding:12px 12px 10px;transform:translateY(20px);opacity:0;transition:transform .35s cubic-bezier(.2,.9,.3,1.2),opacity .25s}
    .toast.show{transform:none;opacity:1}
    .toast h4{margin:0 0 8px;font-size:12px;font-weight:600;color:rgba(242,244,243,.45);display:flex;justify-content:space-between}
    .toast h4 span{cursor:pointer}
    .row{display:flex;align-items:center;gap:8px;padding:3px 0;opacity:0;transform:translateX(12px);animation:in .3s forwards}
    .chip{flex:none;min-width:28px;text-align:center;font-weight:800;font-size:11px;padding:2px 5px;border-radius:6px;color:#111}
    .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .new{flex:none;font-size:11px;font-weight:600;color:#34d399}
    .tag{flex:none;font-size:10px;color:#e9c15a;border:.8px solid rgba(233,193,90,.5);border-radius:4px;padding:0 4px}
    .own{flex:none;color:rgba(242,244,243,.45);font-size:11px}
    .foot{margin-top:6px;padding-top:6px;border-top:.8px solid rgba(200,208,203,.1);color:rgba(242,244,243,.5);font-size:11px}
    @keyframes in{to{opacity:1;transform:none}}
  </style>
  <div class="fx"><div class="dim"></div><div class="rays"></div><div class="holo"></div><canvas></canvas><div class="flash"></div><div class="banner"></div><div class="badge">NOUVELLE</div></div>
  <div class="toast" role="status"></div>`;
  (document.body || document.documentElement).appendChild(host);
  const $ = (s) => root.querySelector(s);

  // =====================================================================
  //  Moteur de particules
  // =====================================================================
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  let parts = [], raf = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rainbow = () => `hsl(${rnd(0, 360)},95%,68%)`;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) {
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function add(p) { parts.push(p); if (!raf) { resize(); raf = requestAnimationFrame(loop); } }

  function sparks(x, y, color, n, speed = 9, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(speed * .3, speed);
      add({ k: Math.random() < .4 ? 'star' : 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.up || 2),
        g: opts.g ?? .16, drag: .975, life: 1, decay: rnd(.008, .018), size: rnd(1.5, opts.size || 4.5), rot: rnd(0, 6), vr: rnd(-.3, .3),
        color: opts.rainbow ? rainbow() : (Math.random() < .3 ? '#fff' : color) });
    }
  }
  function confetti(x, y, colors, n) {
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * .95, -Math.PI * .05), v = rnd(6, 17);
      add({ k: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .22, drag: .985, life: 1, decay: rnd(.004, .008),
        w: rnd(5, 10), h: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-.25, .25), flip: rnd(0, 6), color: colors[i % colors.length] });
    }
  }
  function implode(x, y, color, n, dur) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = rnd(160, Math.max(innerWidth, innerHeight) * .6);
      add({ k: 'imp', sx: x + Math.cos(a) * d, sy: y + Math.sin(a) * d, tx: x, ty: y, t0: performance.now() + rnd(0, dur * .7),
        dur: rnd(dur * .35, dur * .6), size: rnd(1.5, 3.5), color: Math.random() < .4 ? '#fff' : color, life: 1 });
    }
  }
  function ring(x, y, color, maxR, width = 6, dur = 700) { add({ k: 'ring', x, y, t0: performance.now(), dur, maxR, width, color, life: 1 }); }
  function dust(rect, color, dur, rate = 3, rainbowMode = false) {
    const end = performance.now() + dur;
    add({ k: 'emit', end, rect, color, rate, rainbowMode, life: 1 });
  }

  function drawStar(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .38 : r; const a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function loop(now) {
    resize();
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const born = [];
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      if (p.k === 'emit') {
        if (now > p.end) { p.life = 0; continue; }
        for (let i = 0; i < p.rate; i++) if (Math.random() < .5) {
          const r = p.rect;
          born.push({ k: Math.random() < .5 ? 'star' : 'dot', x: rnd(r.left - 20, r.right + 20), y: rnd(r.top, r.bottom + 10), vx: rnd(-.3, .3), vy: rnd(-1.6, -.5),
            g: -.005, drag: .99, life: 1, decay: rnd(.008, .016), size: rnd(1, 2.8), rot: 0, vr: .05, color: p.rainbowMode ? rainbow() : (Math.random() < .35 ? '#fff' : p.color) });
        }
        continue;
      }
      if (p.k === 'imp') {
        const t = (now - p.t0) / p.dur;
        if (t < 0) continue;
        if (t >= 1) { p.life = 0; continue; }
        const e = t * t * t;
        const x = p.sx + (p.tx - p.sx) * e, y = p.sy + (p.ty - p.sy) * e;
        ctx.globalAlpha = Math.min(1, t * 3) * (1 - e * .6); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, 7); ctx.fill();
        continue;
      }
      if (p.k === 'ring') {
        const t = Math.max(0, (now - p.t0) / p.dur);
        if (t >= 1) { p.life = 0; continue; }
        const e = 1 - Math.pow(1 - t, 3);
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - t) + .5;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.1, 10 + e * p.maxR), 0, 7); ctx.stroke();
        continue;
      }
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.rot += p.vr; p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); ctx.fillStyle = p.color;
      if (p.k === 'star') drawStar(p.x, p.y, p.size * 1.7, p.rot);
      else if (p.k === 'conf') {
        p.flip += .15; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.flip));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.1, p.size), 0, 7); ctx.fill(); }
    }
    parts.push(...born);
    ctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : null;
    if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  // =====================================================================
  //  Sons synthétisés (aucun fichier)
  // =====================================================================
  let actx = null;
  function audio() { if (!settings.sound) return null; try { actx = actx || new AudioContext(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (_) { return null; } }
  function tone(f, t, dur, type = 'sine', vol = .1, f2) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, a.currentTime + t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + t + dur);
    g.gain.setValueAtTime(0, a.currentTime + t); g.gain.linearRampToValueAtTime(vol, a.currentTime + t + .015);
    g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + dur);
    o.connect(g).connect(a.destination); o.start(a.currentTime + t); o.stop(a.currentTime + t + dur + .05);
  }
  const sfx = {
    tick: () => tone(1200, 0, .08, 'sine', .04),
    pop: (tier) => { tone(660 + tier * 80, 0, .18, 'triangle', .06); tone(990 + tier * 120, .06, .22, 'sine', .05); },
    chime: (n) => [523, 659, 784, 1047, 1319, 1568, 2093].slice(0, n).forEach((f, i) => tone(f, i * .07, .5, 'triangle', .07)),
    riser: (dur) => { tone(140, 0, dur, 'sawtooth', .025, 900); tone(70, 0, dur, 'sine', .08, 140); },
    heart: (times, gap) => { for (let i = 0; i < times; i++) { tone(60, i * gap, .18, 'sine', .22, 40); tone(60, i * gap + .16, .15, 'sine', .14, 40); } },
    boom: () => { tone(90, 0, .9, 'sine', .3, 30); tone(180, 0, .5, 'triangle', .08, 60); },
    shiny: () => [1568, 1976, 2349, 2637, 3136].forEach((f, i) => tone(f, i * .05, .35, 'sine', .05))
  };

  // =====================================================================
  //  Primitives visuelles
  // =====================================================================
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const anims = [];
  const run = (el, kf, opts) => { if (!el) return null; const a = el.animate(kf, opts); anims.push(a); return a; };

  function spotlight(rect, strength, dur, hold) {
    const c = center(rect);
    const d = $('.dim');
    d.style.background = `radial-gradient(ellipse ${rect.width * .85}px ${rect.height * .7}px at ${c.x}px ${c.y}px, transparent 55%, rgba(0,0,0,${strength}) 100%)`;
    return run(d, [{ opacity: 0 }, { opacity: 1, offset: dur / (dur + hold + 500) }, { opacity: 1, offset: (dur + hold) / (dur + hold + 500) }, { opacity: 0 }],
      { duration: dur + hold + 500, easing: 'ease-out' });
  }
  function rays(rect, color, dur, peak = .6, spin = 50) {
    const c = center(rect), r = $('.rays');
    r.style.left = c.x + 'px'; r.style.top = c.y + 'px'; r.style.setProperty('--c', color);
    return run(r, [{ opacity: 0, transform: 'rotate(0deg) scale(.5)' }, { opacity: peak, transform: `rotate(${spin * .3}deg) scale(1)`, offset: .25 },
      { opacity: 0, transform: `rotate(${spin}deg) scale(1.1)` }], { duration: dur, easing: 'ease-out' });
  }
  function flash(rect, color, strength, dur = 700) {
    const c = center(rect), f = $('.flash');
    f.style.background = `radial-gradient(circle at ${c.x}px ${c.y}px, #fff 0%, ${color} 18%, transparent 60%)`;
    run(f, [{ opacity: 0 }, { opacity: strength, offset: .08 }, { opacity: 0 }], { duration: dur, easing: 'ease-out' });
  }
  function banner(rect, text, sub, color, dur = 1800) {
    const b = $('.banner');
    b.innerHTML = `<div class="bt"><span class="o">✦</span><span class="w">${esc(text)}</span><span class="o">✦</span></div>` + (sub ? `<small>${esc(sub)}</small>` : '');
    b.style.left = (rect.left + rect.width / 2) + 'px'; b.style.top = (rect.top + rect.height * .42) + 'px';
    b.style.setProperty('--c', color);
    run(b, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.9)', filter: 'blur(10px)', easing: 'cubic-bezier(.2,.9,.3,1)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(.96)', filter: 'blur(0)', offset: .14, easing: 'ease-out' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', filter: 'blur(0)', offset: .8, easing: 'ease-in' },
      { opacity: 0, transform: 'translate(-50%,-75%) scale(1.03)', filter: 'blur(4px)' }
    ], { duration: dur, easing: 'linear' });
  }
  function holo(rect) {
    const h = $('.holo');
    Object.assign(h.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    h.classList.remove('go'); void h.offsetWidth; h.classList.add('go');
    later(1200, () => h.classList.remove('go'));
  }
  function newBadge(rect) {
    const b = $('.badge');
    // en haut au centre de la carte : ne cache ni la rareté (à gauche) ni le favori (à droite)
    const x = rect.left + rect.width / 2, y = rect.top + 2;
    b.style.left = x + 'px'; b.style.top = y + 'px';
    run(b, [
      { transform: 'translate(-50%,-50%) rotate(-20deg) scale(0)' },
      { transform: 'translate(-50%,-50%) rotate(4deg) scale(1.3)', offset: .55 },
      { transform: 'translate(-50%,-50%) rotate(-2deg) scale(.95)', offset: .8 },
      { transform: 'translate(-50%,-50%) rotate(0deg) scale(1)' }
    ], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'forwards' });
    later(220, () => { sparks(x, y, '#34d399', 16, 5, { size: 2.6, up: 1 }); tone(1320, 0, .12, 'triangle', .05); tone(1760, .07, .16, 'triangle', .05); });
  }
  function shake(power, dur = 450) {
    const main = document.querySelector('main');
    if (!main) return;
    const kf = [];
    for (let i = 0; i < 10; i++) { const k = power * (1 - i / 10); kf.push({ transform: `translate(${rnd(-k, k)}px,${rnd(-k, k)}px)` }); }
    kf.push({ transform: 'none' });
    run(main, kf, { duration: dur, easing: 'linear' });
  }

  function clearFx() {
    timers.forEach(clearTimeout); timers = [];
    anims.splice(0).forEach((a) => { try { a.cancel(); } catch (_) {} });
    parts = parts.filter((p) => p.k === 'conf' || p.k === 'dot' || p.k === 'star'); // on laisse retomber les confettis
    $('.holo').classList.remove('go');
  }

  // =====================================================================
  //  Révélé carte par carte
  // =====================================================================
  let pack = null;          // { cards, owned:{id:n}, seen:Set, recapShown, record }
  let cur = { el: null, idx: -1, shiny: false };
  let revealActive = false;

  function readReveal() {
    const flip = document.querySelector('main [class*="animate-card-flip"]');
    if (!flip) return null;
    const card = flip.querySelector('[class*="glow-"]') || flip.firstElementChild;
    const cls = card ? String(card.className) : '';
    const col = flip.closest('.flex.flex-col') || flip.parentElement.parentElement;
    let idx = -1;
    const counter = col && [...col.querySelectorAll('span')].find((s) => s.previousElementSibling && s.previousElementSibling.textContent.trim() === 'Carte');
    if (counter) idx = parseInt(counter.textContent, 10) - 1;
    const m = cls.match(/\bglow-(c|pc|r|sr|ur|l)\b/);
    let rarity = m ? m[1].toUpperCase() : null;
    const shiny = /\bglow-shiny\b/.test(cls);
    const data = pack && idx >= 0 ? pack.cards[idx] : null;
    if (data && data.rarity) rarity = data.rarity;
    return { flip, card, wrap: flip.parentElement, idx, rarity: rarity || 'C', shiny, data };
  }

  function check() {
    const r = readReveal();
    if (!r) {
      if (revealActive) { revealActive = false; cur = { el: null, idx: -1, shiny: false }; clearFx(); onRevealEnd(); }
      return;
    }
    revealActive = true;
    if (r.flip !== cur.el || r.idx !== cur.idx) {
      cur = { el: r.flip, idx: r.idx, shiny: r.shiny };
      onCardShown(r);
    } else if (r.shiny && !cur.shiny) {
      cur.shiny = true;
      onShinyFlip(r);
    }
  }

  function isNew(r) {
    if (!pack || !r.data || !pack.owned) return false;
    const n = pack.owned[r.data.id];
    const inPack = pack.cards.filter((c) => c.id === r.data.id).length;
    return typeof n === 'number' && n <= inPack;
  }

  function onCardShown(r) {
    clearFx();
    if (!settings.effects) return;
    const tier = TIER[r.rarity] ?? 0;
    const color = WM.COLORS[r.rarity] || '#fff';
    const firstTime = !(pack && pack.seen.has(r.idx));
    if (pack) pack.seen.add(r.idx);
    const el = r.flip;
    const willShiny = r.shiny || (r.data && r.data.is_shiny && tier < 5); // les L shiny se retournent au clic, gérées à part
    const fresh = isNew(r);

    // On remplace l'animation d'entrée du site (appliqué avant l'affichage : pas de flash)
    el.style.animation = 'none';

    // Carte déjà vue (retour en arrière) : simple retournement rapide
    if (!firstTime) {
      run(el, [{ opacity: 0, transform: 'perspective(900px) rotateY(-70deg)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' });
      return;
    }

    const rect = () => (r.wrap || el).getBoundingClientRect();
    const impact = (delay, fn) => later(delay, () => { if (cur.el === el) fn(rect()); });

    if (tier <= 1) {
      // Commune / Peu commune : retournement vif avec rebond
      run(el, [
        { opacity: 0, transform: 'perspective(900px) rotateY(110deg) scale(.88)' },
        { opacity: 1, transform: 'perspective(900px) rotateY(-10deg) scale(1.04)', offset: .7 },
        { opacity: 1, transform: 'none' }
      ], { duration: 460, easing: 'cubic-bezier(.2,.8,.3,1)' });
      impact(300, (rc) => { const c = center(rc); sparks(c.x, c.y, color, tier ? 16 : 8, tier ? 6 : 4.5, { size: 3 }); sfx.pop(tier); });
    } else if (tier === 2) {
      // Rare : chute en vrille puis onde de choc
      run(el, [
        { opacity: 0, transform: 'perspective(900px) translateY(-90px) rotateY(200deg) scale(.75)' },
        { opacity: 1, transform: 'perspective(900px) translateY(8px) rotateY(0deg) scale(1.03)', offset: .72 },
        { transform: 'perspective(900px) translateY(-3px) scale(.99)', offset: .86 },
        { opacity: 1, transform: 'none' }
      ], { duration: 700, easing: 'cubic-bezier(.3,.7,.3,1)' });
      impact(500, (rc) => { const c = center(rc); ring(c.x, c.y, color, rc.width * .9, 5, 650); sparks(c.x, c.y, color, 28, 8); sfx.chime(3); });
    } else if (tier === 3) {
      // Super Rare : silhouette qui se charge puis éclate
      const D = 1100;
      run(el, [
        { opacity: 0, transform: 'scale(.8)', filter: `brightness(0) drop-shadow(0 0 0 ${color})` },
        { opacity: 1, transform: 'scale(.94)', filter: `brightness(0) drop-shadow(0 0 22px ${color})`, offset: .45 },
        { transform: 'scale(.96) rotate(-1deg)', filter: `brightness(0) drop-shadow(0 0 30px ${color})`, offset: .6 },
        { transform: 'scale(1.1)', filter: `brightness(2.4) drop-shadow(0 0 40px ${color})`, offset: .7 },
        { opacity: 1, transform: 'none', filter: 'none' }
      ], { duration: D, easing: 'ease-out' });
      tone(300, 0, .6, 'sine', .04, 700);
      impact(D * .7, (rc) => {
        const c = center(rc);
        flash(rc, color, .55, 600); ring(c.x, c.y, color, rc.width, 7, 700);
        sparks(c.x, c.y, color, 60, 10); rays(rc, color, 1400, .35, 30); sfx.chime(4);
      });
    } else {
      // Ultra Rare et Légendaire : mise en scène complète
      const L = tier === 5;
      const D = L ? 2600 : 1800;
      const hit = L ? .7 : .66;
      const rc0 = rect();
      spotlight(rc0, L ? .88 : .7, D * hit, L ? 2600 : 1600);
      const jitter = [];
      const steps = 22;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * hit, k = (L ? 9 : 6) * Math.pow(i / steps, 2);
        jitter.push({ offset: t, opacity: Math.min(1, i / 4), transform: `translate(${rnd(-k, k)}px,${rnd(-k, k) - (L ? 26 : 14) * (i / steps)}px) scale(${.82 + .12 * (i / steps)})`,
          filter: `brightness(0) drop-shadow(0 0 ${8 + 34 * (i / steps)}px ${color})` });
      }
      run(el, [
        ...jitter,
        { offset: hit + .04, opacity: 1, transform: 'scale(1.16)', filter: `brightness(3) drop-shadow(0 0 60px ${color})` },
        { offset: hit + .16, opacity: 1, transform: 'scale(.98)', filter: `brightness(1.2) drop-shadow(0 0 26px ${color})` },
        { offset: 1, opacity: 1, transform: 'none', filter: 'none' }
      ], { duration: D, easing: 'linear' });

      const c0 = center(rc0);
      implode(c0.x, c0.y, color, L ? 140 : 80, D * hit);
      if (L) { sfx.heart(3, .55); later(D * hit * .45, () => rays(rect(), color, D * hit * .9, .25, 20)); }
      sfx.riser(D * hit / 1000);

      impact(D * hit, (rc) => {
        const c = center(rc);
        flash(rc, color, L ? 1 : .75, L ? 1100 : 800);
        ring(c.x, c.y, '#fff', rc.width * 1.4, 8, 800);
        later(120, () => ring(c.x, c.y, color, rc.width * 2, 5, 1000));
        rays(rc, color, L ? 3200 : 2200, L ? .7 : .5, L ? 80 : 50);
        sparks(c.x, c.y, color, L ? 180 : 110, L ? 15 : 12);
        if (L) confetti(c.x, rc.top, ['#ffe144', '#fa9931', '#fff', '#fff6d0', '#e9c15a'], 140);
        shake(L ? 16 : 9, L ? 600 : 420);
        banner(rc, L ? 'LÉGENDAIRE' : 'ULTRA RARE', r.data ? WM.cardName(r.data) : '', color, L ? 2400 : 1800);
        dust(rc, color, L ? 6000 : 3000, L ? 3 : 2);
        sfx.boom(); later(60, () => sfx.chime(L ? 7 : 5));
      });
    }

    const tImpact = [300, 300, 500, 770, 1190, 1820][tier];
    if (willShiny) later(tImpact + 150, () => { if (cur.el === el) shinyFx(rect(), tier); });
    if (fresh) later(tImpact + 80, () => { if (cur.el === el) newBadge(rect()); });
  }

  function shinyFx(rc, tier) {
    const c = center(rc);
    holo(rc);
    ring(c.x, c.y, '#fff', rc.width * 1.2, 4, 800);
    sparks(c.x, c.y, '#fff', 70 + tier * 10, 11, { rainbow: true });
    dust(rc, '#fff', 4000, 2, true);
    sfx.shiny();
    if (tier < 4) banner(rc, 'SHINY', '', '#e9c15a', 1500);
  }

  function onShinyFlip(r) {
    if (!settings.effects) return;
    const rc = (r.wrap || r.flip).getBoundingClientRect();
    const c = center(rc);
    flash(rc, '#e9c15a', .8, 900);
    rays(rc, '#e9c15a', 2600, .6, 70);
    confetti(c.x, rc.top, ['#ff4fa3', '#ffd84f', '#4fffc3', '#4fb8ff', '#b94fff', '#fff'], 120);
    shake(10, 450);
    shinyFx(rc, 5);
    banner(rc, 'SHINY', r.data ? WM.cardName(r.data) : '', '#e9c15a', 2200);
  }

  // Inclinaison 3D de la carte qui suit la souris
  document.addEventListener('pointermove', (e) => {
    if (!settings.effects || !cur.el || e.buttons) return;
    const wrap = cur.el.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const inside = e.clientX > r.left - 40 && e.clientX < r.right + 40 && e.clientY > r.top - 40 && e.clientY < r.bottom + 40;
    if (!inside) { if (wrap.style.transform) wrap.style.transform = ''; return; }
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    wrap.style.transition = 'transform .12s ease-out';
    wrap.style.transform = `perspective(1000px) rotateX(${(-y * 12).toFixed(2)}deg) rotateY(${(x * 14).toFixed(2)}deg)`;
  }, { passive: true });
  document.addEventListener('pointerdown', () => { if (cur.el && cur.el.parentElement) cur.el.parentElement.style.transform = ''; }, true);

  // =====================================================================
  //  Ouverture du paquet (sans rien révéler)
  // =====================================================================
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('main button');
    if (!btn || btn.textContent.trim() !== 'Ouvrir' || btn.disabled || !settings.effects) return;
    const img = btn.querySelector('img') || btn;
    const rc = img.getBoundingClientRect(), c = center(rc);
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#34d399';
    implode(c.x, c.y, acc, 60, 650);
    run(img, [
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(1.06) rotate(-2deg)', filter: `brightness(1.3) drop-shadow(0 0 20px ${acc})`, offset: .5 },
      { transform: 'scale(1.1) rotate(2deg)', filter: `brightness(1.8) drop-shadow(0 0 40px ${acc})` }
    ], { duration: 620, easing: 'ease-in' });
    tone(200, 0, .6, 'sawtooth', .02, 800);
    later(620, () => { flash(rc, acc, .7, 600); ring(c.x, c.y, '#fff', 260, 6, 600); sparks(c.x, c.y, acc, 50, 11); });
  }, true);

  // =====================================================================
  //  Réponses d'ouverture observées (aucun effet ici : pas de spoil)
  // =====================================================================
  // Relais cache (page -> extension)
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.__wmPlusCacheStats) chrome.storage.local.set({ cacheStats: { ...e.data.__wmPlusCacheStats, at: Date.now() } });
    if (e.data.__wmPlusFresh) freshPill();
  });
  setTimeout(() => window.postMessage({ __wmPlusCacheStatsReq: true }, location.origin), 1500);

  // Données fraîches différentes du cache : rechargement automatique, discret
  // (position de défilement conservée, jamais pendant une saisie, une fenêtre ouverte ou un révélé,
  //  et au plus une fois par minute et par page pour éviter toute boucle).
  let freshTimer = null;
  function freshPill() {
    if (!settings.cache) return;
    clearTimeout(freshTimer);
    freshTimer = setTimeout(tryReload, 500); // on attend que toutes les requêtes de la page soient revenues
  }
  function busy() {
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return true;
    if (document.querySelector('[role="dialog"],[aria-modal="true"],dialog[open]')) return true;
    if (revealActive || document.querySelector('main [class*="animate-card-flip"]')) return true;
    return false;
  }
  let waited = 0;
  function tryReload() {
    if (location.pathname.startsWith('/pulls')) return; // jamais sur la page des paquets
    let last = {};
    try { last = JSON.parse(sessionStorage.getItem('wmp_autoreload') || '{}'); } catch (_) {}
    const path = location.pathname + location.search;
    if (last[path] && Date.now() - last[path] < 60000) return;
    if (busy()) { if (++waited < 30) freshTimer = setTimeout(tryReload, 1000); return; }
    waited = 0;
    last[path] = Date.now();
    try {
      sessionStorage.setItem('wmp_autoreload', JSON.stringify(last));
      sessionStorage.setItem('wmp_scroll', JSON.stringify({ path, y: scrollY, t: Date.now() }));
    } catch (_) {}
    location.reload();
  }
  // Après un rechargement automatique : on remet la page où elle était
  try {
    const sc = JSON.parse(sessionStorage.getItem('wmp_scroll') || 'null');
    sessionStorage.removeItem('wmp_scroll');
    if (sc && sc.path === location.pathname + location.search && Date.now() - sc.t < 15000 && sc.y > 0) {
      let n = 0;
      const again = () => { window.scrollTo(0, sc.y); if (Math.abs(scrollY - sc.y) > 4 && ++n < 25) setTimeout(again, 120); };
      again();
    }
  } catch (_) {}

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__wmPlus !== true) return;
    const { endpoint, ok, data } = e.data;
    if (!ok || !data) return;

    if (typeof data.packs_remaining === 'number') {
      const regen = data.packs_last_regen_at ? new Date(data.packs_last_regen_at).getTime() : null;
      pushState({ n: data.packs_remaining, max: 10, nextAt: regen && !isNaN(regen) ? regen + period() : null });
    }
    if (endpoint.endsWith('pro-daily') && Array.isArray(data.cards)) send({ type: 'proClaimed', date: WM.today() });

    if (Array.isArray(data.cards) && data.cards.length) {
      const cards = data.cards;
      let owned = null;
      if (Array.isArray(data.owned_copies)) {
        owned = {};
        data.owned_copies.forEach((u) => { if (u && u.card_id != null) owned[u.card_id] = (owned[u.card_id] || 0) + 1; });
      }
      const record = {
        t: Date.now(), src: endpoint.split('/').pop(),
        cards: cards.map((c) => ({ id: c.id ?? null, name: WM.cardName(c), r: c.rarity || '?', s: !!c.is_shiny, o: owned ? (owned[c.id] ?? null) : null }))
      };
      pack = { cards, owned, seen: new Set(), recapShown: false, record, sinceL: null };
      send({ type: 'pull', record }, (res) => { if (res && typeof res.sinceL === 'number' && pack && pack.record === record) pack.sinceL = res.sinceL; });
    }
  });

  // Récap affiché seulement une fois toutes les cartes révélées
  let toastTimer = null;
  function onRevealEnd() {
    if (!pack || pack.recapShown || !settings.summary) return;
    pack.recapShown = true;
    const t = $('.toast');
    const items = pack.cards.map((c) => ({ c, o: pack.owned ? pack.owned[c.id] : undefined }))
      .sort((a, b) => (WM.RANK[a.c.rarity] ?? 9) - (WM.RANK[b.c.rarity] ?? 9));
    const nNew = items.filter(({ c, o }) => typeof o === 'number' && o <= pack.cards.filter((x) => x.id === c.id).length).length;
    t.innerHTML = `<h4>Récap du paquet <span title="Fermer">✕</span></h4>` + items.map(({ c, o }, i) => {
      const fresh = typeof o === 'number' && o <= pack.cards.filter((x) => x.id === c.id).length;
      return `<div class="row" style="animation-delay:${i * 60}ms">
        <span class="chip" style="background:${WM.COLORS[c.rarity] || '#9ca3af'}">${esc(c.rarity || '?')}</span>
        <span class="name">${esc(WM.cardName(c))}</span>${c.is_shiny ? '<span class="tag">shiny</span>' : ''}
        ${fresh ? '<span class="new">Nouvelle</span>' : (typeof o === 'number' ? `<span class="own" title="Exemplaires possédés">×${o}</span>` : '')}
      </div>`;
    }).join('') + `<div class="foot">${pack.owned ? `${nNew} nouvelle${nNew > 1 ? 's' : ''} carte${nNew > 1 ? 's' : ''} · ` : ''}${pack.sinceL != null ? `${pack.sinceL} paquet${pack.sinceL > 1 ? 's' : ''} depuis ta dernière L` : ''}</div>`;
    t.querySelector('h4 span').onclick = () => t.classList.remove('show');
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 8000);
    t.onmouseenter = () => clearTimeout(toastTimer);
    t.onmouseleave = () => { toastTimer = setTimeout(() => t.classList.remove('show'), 2500); };
  }

  // Détection synchrone (avant l'affichage) des changements de carte
  // Masque nos calques (étiquette, récap, particules) quand une fenêtre du site s'ouvre par-dessus
  function modalGuard() { const v = WM.siteModalOpen() ? 'hidden' : ''; if (host.style.visibility !== v) host.style.visibility = v; }
  new MutationObserver(() => { check(); modalGuard(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // =====================================================================
  //  Compteur de paquets, titre d'onglet
  // =====================================================================
  function pushState(s) {
    const st = { ...s, period: period(), observedAt: Date.now() };
    const key = st.n + '|' + Math.round((st.nextAt || 0) / 5000);
    if (key === lastSent) return;
    lastSent = key;
    packState = st;
    send({ type: 'packState', state: st });
  }

  function readDom() {
    const main = document.querySelector('main');
    if (!main) return;
    const txt = main.innerText || '';
    const m = txt.match(/(\d+)\s*\/\s*(\d+)\s*paquets? disponibles?/i);
    if (m) {
      const n = +m[1], max = +m[2];
      const c = txt.match(/Prochain dans\s+(?:(\d+)\s*h\s*)?(\d+):(\d{2})/i);
      let nextAt = null;
      if (c && n < max) {
        const secs = (+(c[1] || 0)) * 3600 + (+c[2]) * 60 + (+c[3]);
        nextAt = Date.now() + secs * 1000;
        if (secs > 185 && detectedPeriod !== 600000) { detectedPeriod = 600000; chrome.storage.local.set({ detectedPeriod }); }
      }
      if (!detectedPeriod && /Pack PRO du jour/i.test(txt) && /Déjà réclamé|Réclamer/i.test(txt)) {
        detectedPeriod = 180000; chrome.storage.local.set({ detectedPeriod });
      }
      pushState({ n, max, nextAt });
    }
    const rates = {};
    for (const r of txt.matchAll(/(?:^|\n)\s*(L|UR|SR|R|PC|C)\s*\n\s*([\d.,]+)\s*%/g)) rates[r[1]] = parseFloat(r[2].replace(',', '.'));
    if (Object.keys(rates).length >= 4) chrome.storage.local.set({ siteRates: rates });
    if (/Déjà réclamé aujourd/i.test(txt)) send({ type: 'proClaimed', date: WM.today() });
  }

  function updateTitle() {
    const base = document.title.replace(/^\(\d+\/\d+\)\s*/, '');
    if (!settings.tabTitle) { if (base !== document.title) document.title = base; return; }
    const p = WM.predict(packState);
    const want = p ? `(${p.n}/${p.max}) ${base}` : base;
    if (document.title !== want) document.title = want;
  }

  let lastRead = 0;
  setInterval(() => {
    if (location.pathname.startsWith('/pulls') && !revealActive && Date.now() - lastRead > 2000) { lastRead = Date.now(); readDom(); }
    updateTitle();
  }, 1000);

  // =====================================================================
  //  Espace : ouvre un paquet, ou passe à la carte suivante pendant le révélé
  // =====================================================================
  document.addEventListener('keydown', (e) => {
    if (!settings.spaceKey || e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const sp = document.getElementById('wmp-settings'); if (sp && sp.style.display !== 'none') return;
    if (!location.pathname.startsWith('/pulls')) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    let btn = null;
    if (revealActive && cur.el) {
      const col = cur.el.closest('.flex.flex-col') || cur.el.parentElement.parentElement;
      const round = [...col.querySelectorAll('button')].filter((b) => /\bw-12\b/.test(b.className));
      const next = round[round.length - 1];
      if (next && !next.disabled) btn = next;
      else btn = [...col.querySelectorAll('button')].find((b) => /\bpx-8\b/.test(b.className) && !b.disabled);
    } else {
      btn = [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Ouvrir' && !b.disabled);
    }
    if (btn) { e.preventDefault(); if (a && a.blur) a.blur(); btn.click(); }
  }, true);
})();
