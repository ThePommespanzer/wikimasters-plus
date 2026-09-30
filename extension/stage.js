// Nouvelle interface pour l'écran d'ouverture et l'écran de révélé.
// On ne déplace ni ne supprime aucun élément du site (c'est une appli React) :
// on les restyle, on masque visuellement ceux qu'on remplace et on ajoute nos propres blocs.
(() => {
  let settings = { ...WM.DEFAULTS };
  let packState = null;
  let detectedPeriod = null;
  chrome.storage.local.get(['settings', 'packState', 'detectedPeriod'], (r) => {
    settings = { ...WM.DEFAULTS, ...(r.settings || {}) };
    packState = r.packState || null;
    detectedPeriod = r.detectedPeriod || null;
    tick();
  });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.settings) settings = { ...WM.DEFAULTS, ...(ch.settings.newValue || {}) };
    if (ch.packState) packState = ch.packState.newValue || null;
    if (ch.detectedPeriod) detectedPeriod = ch.detectedPeriod.newValue || null;
    tick();
  });

  const css = document.createElement('style');
  css.id = 'wmp-stage-css';
  css.textContent = `
  [data-wmp-stage]{position:relative;isolation:isolate}
  .wmp-bg{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;
    -webkit-mask:linear-gradient(to bottom,transparent,#000 5%,#000 90%,transparent);mask:linear-gradient(to bottom,transparent,#000 5%,#000 90%,transparent)}
  /* Nappes de couleur */
  .wmp-bg .blob{position:absolute;border-radius:50%;filter:blur(100px);opacity:.2;transition:background 1.2s ease}
  .wmp-bg .b1{width:50vmax;height:50vmax;left:-14vmax;top:-20vmax;background:var(--wmp-t1,#34d399);animation:wmp-drift1 26s ease-in-out infinite alternate}
  .wmp-bg .b2{width:42vmax;height:42vmax;right:-12vmax;top:8vmax;background:var(--wmp-t2,#fa9931);opacity:.16;animation:wmp-drift2 32s ease-in-out infinite alternate}
  .wmp-bg .b3{width:38vmax;height:38vmax;left:22%;bottom:-22vmax;background:var(--wmp-t3,#8b5cf6);opacity:.16;animation:wmp-drift1 38s ease-in-out infinite alternate-reverse}
  /* Étoiles : deux couches en parallaxe + scintillement */
  .wmp-bg .stars,.wmp-bg .stars2{position:absolute;inset:-100% 0 0 0;
    background-image:radial-gradient(1.2px 1.2px at 20px 30px,#fff,transparent),radial-gradient(1px 1px at 140px 90px,#fff,transparent),
      radial-gradient(1.5px 1.5px at 260px 160px,#fff,transparent),radial-gradient(1px 1px at 80px 220px,#fff,transparent),
      radial-gradient(1.3px 1.3px at 330px 40px,#fff,transparent),radial-gradient(1px 1px at 200px 280px,#fff,transparent);
    background-size:360px 320px;opacity:.5;animation:wmp-rise 110s linear infinite,wmp-twinkle 5s ease-in-out infinite alternate}
  .wmp-bg .stars2{background-size:540px 480px;opacity:.3;animation-duration:170s,7s;animation-delay:0s,-3s}
  /* Grain léger + vignette pour un rendu moins "numérique" */
  .wmp-bg .grain{position:absolute;inset:0;opacity:.06;mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  .wmp-bg .vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,transparent 45%,rgba(0,0,0,.45) 100%)}
  /* Halo + rayons derrière le paquet ou la carte */
  .wmp-halo{position:absolute;width:760px;height:760px;margin:-380px 0 0 -380px;pointer-events:none;transition:opacity .5s}
  .wmp-halo::before{content:"";position:absolute;inset:0;border-radius:50%;
    background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.075) 0deg 3deg,transparent 3deg 12deg);
    -webkit-mask:radial-gradient(circle,transparent 0 12%,#000 20%,transparent 62%);mask:radial-gradient(circle,transparent 0 12%,#000 20%,transparent 62%);
    animation:wmp-spin 80s linear infinite}
  .wmp-halo::after{content:"";position:absolute;inset:20%;border-radius:50%;background:radial-gradient(circle,var(--wmp-t1,#34d399) 0,transparent 66%);
    opacity:.26;transition:background 1.2s ease;animation:wmp-breathe 5s ease-in-out infinite}
  @keyframes wmp-drift1{to{transform:translate(8vmax,6vmax) scale(1.15)}}
  @keyframes wmp-drift2{to{transform:translate(-10vmax,-4vmax) scale(.9)}}
  @keyframes wmp-rise{to{transform:translateY(50%)}}
  @keyframes wmp-twinkle{to{filter:brightness(.55)}}
  @keyframes wmp-spin{to{transform:rotate(360deg)}}
  @keyframes wmp-breathe{50%{opacity:.4;transform:scale(1.07)}}
  @keyframes wmp-float{0%,100%{transform:translateY(0) rotate(-1.2deg)}50%{transform:translateY(-12px) rotate(1.2deg)}}
  @keyframes wmp-shadow{0%,100%{transform:translateX(-50%) scale(1);opacity:.55}50%{transform:translateX(-50%) scale(.82);opacity:.35}}
  @keyframes wmp-sheen{0%,60%{transform:translateX(-130%) skewX(-18deg)}88%,100%{transform:translateX(130%) skewX(-18deg)}}
  @keyframes wmp-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--color-accent,#34d399) 50%,transparent),0 6px 24px color-mix(in srgb,var(--color-accent,#34d399) 30%,transparent),inset 0 1px 0 rgba(255,255,255,.45)}
    50%{box-shadow:0 0 0 9px transparent,0 6px 34px color-mix(in srgb,var(--color-accent,#34d399) 50%,transparent),inset 0 1px 0 rgba(255,255,255,.45)}}

  /* ---------- Écran d'ouverture ---------- */
  [data-wmp-stage="idle"] > .text-center h1{font-family:var(--font-heading,system-ui);font-weight:800;font-size:clamp(34px,5vw,54px)!important;letter-spacing:-.02em;
    background:linear-gradient(100deg,#fff 25%,var(--color-accent,#34d399) 55%,#ffe144 85%);
    -webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 14px rgba(0,0,0,.5))}
  [data-wmp-stage="idle"] > .text-center{order:-3}
  [data-wmp-stage="idle"] > .wmp-open-btn{order:-2;overflow:visible}
  [data-wmp-stage="idle"] > .wmp-hud{order:-1}
  .wmp-open-btn::before{content:"";position:absolute;left:50%;top:calc(var(--wmp-iy) + var(--wmp-ih) - 6px);width:calc(var(--wmp-iw) * .55);height:18px;border-radius:50%;
    background:radial-gradient(ellipse,rgba(0,0,0,.7),transparent 70%);filter:blur(4px);animation:wmp-shadow 4.5s ease-in-out infinite;pointer-events:none}
  .wmp-open-btn img{animation:wmp-float 4.5s ease-in-out infinite;
    filter:drop-shadow(0 0 22px color-mix(in srgb,var(--color-accent,#34d399) 45%,transparent)) drop-shadow(0 16px 26px rgba(0,0,0,.5))!important}
  .wmp-open-btn .wmp-sheen-wrap{position:absolute;left:var(--wmp-ix);top:var(--wmp-iy);width:var(--wmp-iw);height:var(--wmp-ih);pointer-events:none;overflow:hidden;
    -webkit-mask:var(--wmp-img) center/contain no-repeat;mask:var(--wmp-img) center/contain no-repeat;animation:wmp-float 4.5s ease-in-out infinite}
  .wmp-open-btn .wmp-sheen-wrap::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.7) 50%,transparent 70%);
    animation:wmp-sheen 5.5s ease-in-out infinite;mix-blend-mode:overlay}
  .wmp-open-btn > span{margin-top:8px;padding:12px 42px;border-radius:999px;font-family:var(--font-heading,system-ui);font-weight:800!important;letter-spacing:.16em;text-transform:uppercase;
    font-size:15px!important;color:#06140e!important;background:linear-gradient(180deg,#7ff3c8,var(--color-accent,#34d399) 55%,#16b383);
    border:.8px solid rgba(255,255,255,.35);animation:wmp-pulse 2.6s ease-in-out infinite;transition:transform .15s}
  .wmp-open-btn:not(:disabled):active > span{transform:translateY(1px) scale(.98)}
  .wmp-open-btn:disabled img{filter:grayscale(1) brightness(.55) drop-shadow(0 16px 26px rgba(0,0,0,.5))!important;animation:none}
  .wmp-open-btn:disabled::before{animation:none}
  .wmp-open-btn:disabled > span{background:#232826;border-color:transparent;color:rgba(242,244,243,.45)!important;animation:none}
  .wmp-open-btn:disabled .wmp-sheen-wrap{display:none}
  .wmp-hidden{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;opacity:0!important;pointer-events:none!important}

  .wmp-hud{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 22px 12px;border-radius:18px;min-width:300px;
    background:linear-gradient(180deg,rgba(30,35,33,.78),rgba(15,18,17,.82));border:.8px solid rgba(200,208,203,.14);
    box-shadow:0 12px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(10px);font-family:var(--font-heading,system-ui),system-ui,sans-serif;color:#f2f4f3}
  .wmp-hud .cnt{display:flex;align-items:baseline;gap:6px}
  .wmp-hud .cnt b{font-size:32px;line-height:1;font-weight:800;color:var(--color-accent,#34d399);font-variant-numeric:tabular-nums;
    text-shadow:0 0 16px color-mix(in srgb,var(--color-accent,#34d399) 45%,transparent)}
  .wmp-hud .cnt span{font-size:17px;color:rgba(242,244,243,.4);font-weight:700}
  .wmp-hud .cnt em{font-style:normal;font-size:11px;color:rgba(242,244,243,.5);margin-left:4px;text-transform:uppercase;letter-spacing:.14em}
  .wmp-hud .pips{display:flex;gap:5px}
  .wmp-hud .pip{position:relative;width:17px;height:23px;border-radius:5px;background:rgba(255,255,255,.05);border:.8px solid rgba(255,255,255,.08);overflow:hidden;
    transition:background .4s,box-shadow .4s}
  .wmp-hud .pip.on{background:linear-gradient(160deg,#9af7d3,var(--color-accent,#34d399) 55%,#0e9f6e);border-color:rgba(255,255,255,.25);
    box-shadow:0 0 9px color-mix(in srgb,var(--color-accent,#34d399) 50%,transparent),inset 0 1px 0 rgba(255,255,255,.5)}
  .wmp-hud .pip.fill::after{content:"";position:absolute;left:0;right:0;bottom:0;height:var(--p,0%);
    background:linear-gradient(0deg,color-mix(in srgb,var(--color-accent,#34d399) 65%,transparent),color-mix(in srgb,var(--color-accent,#34d399) 25%,transparent));transition:height 1s linear}
  .wmp-hud .meta{font-size:12px;color:rgba(242,244,243,.55);font-family:system-ui,sans-serif}
  .wmp-hud .meta b{color:#f2f4f3;font-weight:600;font-variant-numeric:tabular-nums}
  .wmp-hud .wmp-fast{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:6px 10px 6px 12px;border-radius:999px;font:600 12px/1 system-ui,sans-serif;
    color:rgba(242,244,243,.7);background:rgba(255,255,255,.05);border:.8px solid rgba(255,255,255,.12);transition:background .15s,color .15s}
  .wmp-hud .wmp-fast:hover{background:rgba(255,255,255,.1)}
  .wmp-hud .wmp-fast .ic{filter:grayscale(1);opacity:.6}
  .wmp-hud .wmp-fast .sw{width:28px;height:16px;border-radius:99px;background:rgba(255,255,255,.15);position:relative;transition:background .15s}
  .wmp-hud .wmp-fast .sw::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:transform .15s}
  .wmp-hud .wmp-fast.on{color:#fde68a;border-color:rgba(253,230,138,.4)}
  .wmp-hud .wmp-fast.on .ic{filter:none;opacity:1}
  .wmp-hud .wmp-fast.on .sw{background:#f59e0b}
  .wmp-hud .wmp-fast.on .sw::after{transform:translateX(12px)}
  .wmp-hud .hint{font-size:11px;color:rgba(242,244,243,.42);font-family:system-ui,sans-serif;padding-top:9px;border-top:.8px solid rgba(200,208,203,.08);width:100%;text-align:center}
  .wmp-kbd{display:inline-block;padding:1px 8px;margin-right:5px;border-radius:6px;font:700 10px/1.6 ui-monospace,SFMono-Regular,monospace;color:#f2f4f3;letter-spacing:.04em;
    background:linear-gradient(#2e3432,#1b1f1e);border:.8px solid rgba(255,255,255,.18);box-shadow:0 2px 0 rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08)}

  /* ---------- Écran de révélé ---------- */
  [data-wmp-stage="reveal"] .wmp-counter{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:999px;
    background:rgba(20,24,23,.72);border:.8px solid rgba(200,208,203,.14);backdrop-filter:blur(8px);color:rgba(242,244,243,.6)!important;
    font-family:var(--font-heading,system-ui);letter-spacing:.08em;text-transform:uppercase;font-size:11px!important}
  [data-wmp-stage="reveal"] .wmp-counter > span:nth-child(2){font-size:19px!important;color:var(--wmp-t1,#34d399)!important;
    text-shadow:0 0 12px color-mix(in srgb,var(--wmp-t1,#34d399) 70%,transparent);transition:color .6s}
  [data-wmp-stage="reveal"] .wmp-nav button.w-12{background:rgba(24,28,27,.72)!important;backdrop-filter:blur(8px);border-color:rgba(255,255,255,.14)!important;transition:transform .15s,box-shadow .2s,border-color .2s}
  [data-wmp-stage="reveal"] .wmp-nav button.w-12:not(:disabled):hover{transform:scale(1.08);border-color:rgba(255,255,255,.3)!important;
    box-shadow:0 0 18px color-mix(in srgb,var(--wmp-t1,#34d399) 60%,transparent)}
  [data-wmp-stage="reveal"] .wmp-nav button.w-3{box-shadow:0 0 0 1px rgba(255,255,255,.1)}
  [data-wmp-stage="reveal"] .wmp-nav button.w-3.scale-125{background:var(--wmp-t1,#34d399)!important;box-shadow:0 0 10px var(--wmp-t1,#34d399)}
  [data-wmp-stage="reveal"] .wmp-reveal-hint{font-size:11px;color:rgba(242,244,243,.42);font-family:system-ui,sans-serif}
  `;
  (document.head || document.documentElement).appendChild(css);

  function mk(cls, html) { const d = document.createElement('div'); d.className = cls; if (html) d.innerHTML = html; return d; }
  const bg = mk('wmp-bg', '<div class="stars"></div><div class="stars2"></div><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="wmp-halo"></div><div class="grain"></div><div class="vignette"></div>');
  const halo = bg.querySelector('.wmp-halo');
  const hud = mk('wmp-hud', `<div class="cnt"><b>–</b><span>/ 10</span><em>paquets</em></div><div class="pips"></div>
    <div class="meta"></div><div class="hint"><span class="wmp-kbd">Espace</span> pour ouvrir un paquet</div>
    <button class="wmp-fast" type="button" title="Animations éclair pour les cartes C, PC et R. Les SR, UR, L et shiny gardent leur mise en scène."><span class="ic">⚡</span>Révélé rapide<span class="sw"></span></button>`);
  hud.querySelector('.wmp-fast').addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const { settings: cur } = await chrome.storage.local.get('settings');
    const next = { ...WM.DEFAULTS, ...(cur || {}) }; next.fastReveal = !next.fastReveal;
    await chrome.storage.local.set({ settings: next });
  });
  const revealHint = mk('wmp-reveal-hint', '<span class="wmp-kbd">Espace</span> carte suivante');
  const sheen = mk('wmp-sheen-wrap');

  let stageEl = null;

  // Le fond couvre toute la zone de la page (pas seulement le bloc du paquet ou des cartes)
  function fitBg(main) {
    const r = main.getBoundingClientRect();
    const top = Math.max(0, r.top), h = Math.min(innerHeight, r.bottom) - top;
    const want = { position: 'fixed', left: r.left + 'px', top: top + 'px', width: r.width + 'px', height: h + 'px', right: 'auto', bottom: 'auto' };
    for (const k in want) if (bg.style[k] !== want[k]) bg.style[k] = want[k];
    // si un parent transformé décale la position « fixe », on corrige l'écart
    const b = bg.getBoundingClientRect();
    const dx = r.left - b.left, dy = top - b.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { bg.style.left = (parseFloat(bg.style.left) + dx) + 'px'; bg.style.top = (parseFloat(bg.style.top) + dy) + 'px'; }
  }
  // Révélé agrandi : la carte et ses commandes prennent toute la hauteur disponible
  let zoomed = null;
  function scaleReveal(col, main, stage) {
    if (settings.bigReveal === false) { unscale(); delete document.documentElement.dataset.wmpZoom; return; }
    const cur = parseFloat(col.style.zoom) || 1;
    const r = col.getBoundingClientRect();
    const w = r.width / cur, h = r.height / cur;
    if (!w || !h) return;
    const reserve = settings.tagBar ? 620 : 80; // place pour la barre de tags à droite (et l'équilibre à gauche)
    const z = Math.max(1, Math.min(1.7, (main.clientHeight - 48) / h, (main.clientWidth - reserve) / w));
    if (Math.abs(z - cur) > 0.03) col.style.zoom = z.toFixed(3);
    const zz = (parseFloat(col.style.zoom) || 1).toFixed(3);
    if (document.documentElement.dataset.wmpZoom !== zz) document.documentElement.dataset.wmpZoom = zz; // partagé avec la barre de tags et « Nouvelle »
    const mh = main.clientHeight + 'px';
    if (stage.style.minHeight !== mh) stage.style.minHeight = mh;
    zoomed = { col, stage };
  }
  function unscale() {
    if (!zoomed) return;
    zoomed.col.style.zoom = ''; zoomed.stage.style.minHeight = '';
    delete document.documentElement.dataset.wmpZoom;
    zoomed = null;
  }
  function cleanup() {
    unscale();
    [bg, hud, revealHint, sheen].forEach((n) => n.remove());
    document.querySelectorAll('[data-wmp-stage]').forEach((e) => e.removeAttribute('data-wmp-stage'));
    document.querySelectorAll('.wmp-hidden,.wmp-open-btn,.wmp-counter,.wmp-nav').forEach((e) => e.classList.remove('wmp-hidden', 'wmp-open-btn', 'wmp-counter', 'wmp-nav'));
    stageEl = null;
  }

  function setTint(r) {
    const c = WM.COLORS[r] || null;
    const s = stageEl && stageEl.style;
    if (!s) return;
    if (c) { s.setProperty('--wmp-t1', c); s.setProperty('--wmp-t2', c); s.setProperty('--wmp-t3', '#8b5cf6'); }
    else { s.removeProperty('--wmp-t1'); s.removeProperty('--wmp-t2'); s.removeProperty('--wmp-t3'); }
  }

  function parseFrame(frame) {
    const t = frame.textContent || '';
    const m = t.match(/(\d+)\s*\/\s*(\d+)/);
    const c = t.match(/(\d+):(\d{2})/);
    return m ? { n: +m[1], max: +m[2], secs: c ? (+c[1]) * 60 + (+c[2]) : null } : null;
  }

  function renderHud(frameData) {
    const per = WM.periodFor(settings.regenMode, detectedPeriod);
    const p = WM.predict(packState);
    const n = frameData ? frameData.n : (p ? p.n : null);
    const max = frameData ? frameData.max : (p ? p.max : 10);
    const secs = frameData && frameData.secs != null ? frameData.secs : (p && p.nextAt ? Math.max(0, Math.round((p.nextAt - Date.now()) / 1000)) : null);
    const setText = (el, v) => { v = String(v); if (el.textContent !== v) el.textContent = v; };
    setText(hud.querySelector('.cnt b'), n ?? '–');
    setText(hud.querySelector('.cnt span'), '/ ' + max);
    const pips = hud.querySelector('.pips');
    if (pips.children.length !== max) pips.innerHTML = '<i class="pip"></i>'.repeat(max);
    [...pips.children].forEach((el, i) => {
      el.classList.toggle('on', n != null && i < n);
      const filling = n != null && i === n && secs != null;
      el.classList.toggle('fill', filling);
      if (filling) el.style.setProperty('--p', Math.max(0, Math.min(100, (1 - secs * 1000 / per) * 100)) + '%');
    });
    let meta = '';
    if (n != null && n >= max) meta = 'Réserve pleine, la régénération est en pause';
    else if (secs != null) {
      const full = secs * 1000 + (max - n - 1) * per;
      meta = `Prochain dans <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b> · plein dans <b>${WM.fmtDuration(full)}</b>`;
    }
    const metaEl = hud.querySelector('.meta');
    if (metaEl.innerHTML !== meta) metaEl.innerHTML = meta;
    hud.querySelector('.hint').style.display = settings.spaceKey ? '' : 'none';
    hud.querySelector('.wmp-fast').classList.toggle('on', !!settings.fastReveal);
  }

  function placeHalo(target) {
    if (!stageEl || !target) { halo.style.opacity = '0'; return; }
    const s = stageEl.getBoundingClientRect(), r = target.getBoundingClientRect();
    halo.style.opacity = '1';
    halo.style.left = (r.left - s.left + r.width / 2) + 'px';
    halo.style.top = (r.top - s.top + r.height / 2) + 'px';
  }

  // n'écrit la classe que si elle manque (sinon l'observateur se relancerait en boucle)
  const addCls = (el, c) => { if (!el.classList.contains(c)) el.classList.add(c); };

  function tick() {
    if (!settings.restyle || !location.pathname.startsWith('/pulls')) { if (stageEl) cleanup(); return; }
    const main = document.querySelector('main');
    const flip = main && main.querySelector('[class*="animate-card-flip"]');
    // Le bouton du paquet : reconnu aussi pendant l'animation d'ouverture (« Ouverture... »)
    const openBtn = main && [...main.querySelectorAll('button')].find((b) => {
      const im = b.querySelector('img');
      return im && (/card_pack|Ouvrir un paquet/i.test((im.getAttribute('src') || '') + ' ' + (im.alt || '')) || /Ouv(rir|erture)/.test(b.textContent));
    });
    const mode = flip ? 'reveal' : openBtn ? 'idle' : null;
    const stage = mode === 'reveal' ? (main.firstElementChild || null) : openBtn ? openBtn.parentElement : null;
    if (!stage) { if (stageEl) cleanup(); return; }
    if (stage !== stageEl || stage.getAttribute('data-wmp-stage') !== mode) { cleanup(); stageEl = stage; stage.setAttribute('data-wmp-stage', mode); }
    if (bg.parentElement !== stage) stage.appendChild(bg);
    fitBg(main);

    if (mode === 'idle') {
      setTint(null);
      addCls(openBtn, 'wmp-open-btn');
      const frame = [...stage.querySelectorAll('.card-frame')].find((f) => /paquets? disponibles?/i.test(f.textContent));
      if (frame) addCls(frame, 'wmp-hidden');
      if (hud.parentElement !== stage) stage.appendChild(hud);
      renderHud(frame ? parseFrame(frame) : null);
      const img = openBtn.querySelector('img');
      if (img) {
        const br = openBtn.getBoundingClientRect(), ir = img.getBoundingClientRect();
        openBtn.style.setProperty('--wmp-ix', (ir.left - br.left) + 'px');
        openBtn.style.setProperty('--wmp-iy', (ir.top - br.top) + 'px');
        openBtn.style.setProperty('--wmp-iw', ir.width + 'px');
        openBtn.style.setProperty('--wmp-ih', ir.height + 'px');
        const src = img.currentSrc || img.src;
        if (src) openBtn.style.setProperty('--wmp-img', `url("${src.replace(/"/g, '%22')}")`);
        if (sheen.parentElement !== openBtn) openBtn.appendChild(sheen);
      }
      placeHalo(img || openBtn);
    } else {
      const col = flip.closest('.flex.flex-col');
      if (col) {
        const counter = [...col.children].find((c) => /^\s*Carte/.test(c.textContent));
        if (counter) addCls(counter, 'wmp-counter');
        const nav = [...col.children].find((c) => c.querySelector('button.w-12'));
        if (nav) addCls(nav, 'wmp-nav');
        if (settings.spaceKey && revealHint.parentElement !== col) col.appendChild(revealHint);
        if (!settings.spaceKey) revealHint.remove();
      }
      if (col) scaleReveal(col, main, stage);
      const card = flip.querySelector('[class*="glow-"]');
      const m = card && String(card.className).match(/\bglow-(c|pc|r|sr|ur|l|shiny)\b/);
      setTint(m ? (m[1] === 'shiny' ? 'L' : m[1].toUpperCase()) : null);
      placeHalo(flip);
    }
  }

  setInterval(tick, 500);
  window.addEventListener('resize', tick);
  // Réappliqué immédiatement (avant l'affichage) quand le site change d'écran, pour ne jamais voir l'ancienne interface.
  const ours = (n) => n && (hud.contains(n) || bg.contains(n) || sheen.contains(n) || revealHint.contains(n));
  new MutationObserver((muts) => {
    if (!settings.restyle || !location.pathname.startsWith('/pulls')) { if (stageEl) tick(); return; }
    if (muts.every((m) => ours(m.target))) return;
    tick();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();
