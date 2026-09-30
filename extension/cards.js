// Outils sur les cartes (contexte de la page, pour lire les données des cartes du site) :
//  - boutons Wikipédia, Letterboxd, plein écran, copie dans le presse-papier
//  - image libre de Wikipédia (avec crédit) pour les cartes qui n'en ont pas
//  - cartes visibles directement sur la page des échanges
//  - vue compacte sur Collection et Toutes les cartes
// Uniquement des lectures publiques (Wikipédia, Wikidata) ; rien n'est modifié sur ton compte.
(() => {
  if (window.__wmPlusCards) return;
  window.__wmPlusCards = true;

  let S = { cardTools: true, freeImages: true, tradeCards: true, compactToggle: true, cache: true };
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.__wmPlusSettings) {
      const s = e.data.__wmPlusSettings;
      S = { cardTools: s.cardTools !== false, freeImages: s.freeImages !== false, tradeCards: s.tradeCards !== false, compactToggle: s.compactToggle !== false, cache: s.cache !== false };
      schedule();
    }
  });

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const RCOL = { L: '#ffe144', UR: '#fa9931', SR: '#ed6fa3', R: '#c6a7f2', PC: '#b1cff2', C: '#b8f2d5' };

  // ------------------------------------------------------------------
  //  Styles
  // ------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
  .wmp-tools{position:absolute;left:6px;top:34px;z-index:40;display:flex;gap:4px;opacity:0;transform:translateY(4px);
    transition:opacity .18s,transform .18s;pointer-events:none}
  .group:hover .wmp-tools,[class*="glow-"]:hover > .wmp-tools,.wmp-tools.wmp-always{opacity:1;transform:none;pointer-events:auto}
  @media (hover:none){.wmp-tools{opacity:1;transform:none;pointer-events:auto}}
  .wmp-tools button,.wmp-tools a{all:unset;box-sizing:border-box;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;cursor:pointer;
    background:rgba(12,13,12,.72);backdrop-filter:blur(6px);border:.8px solid rgba(255,255,255,.18);color:#f2f4f3;
    box-shadow:0 2px 8px rgba(0,0,0,.35);transition:transform .12s,background .12s}
  .wmp-tools button:hover,.wmp-tools a:hover{transform:translateY(-1px) scale(1.08);background:rgba(30,34,32,.9)}
  .wmp-tools svg{width:13px;height:13px}
  .wmp-tools .wmp-w{font:700 12px/1 Georgia,"Times New Roman",serif}
  .wmp-tools .wmp-ok{background:#16a34a!important;border-color:transparent}
  .wmp-freeimg{position:absolute;inset:0;z-index:5;overflow:hidden;background:#111}
  .wmp-freeimg img{width:100%;height:100%;object-fit:cover;display:block}
  .wmp-freeimg.wmp-logo{background:radial-gradient(circle at 50% 45%,#ffffff,#dfe4e1 80%)}
  .wmp-freeimg.wmp-logo img{object-fit:contain;padding:10% 12% 16%;box-sizing:border-box;}
  .wmp-credit{position:absolute;left:0;right:0;bottom:0;padding:10px 6px 3px;font:500 8px/1.2 system-ui,sans-serif;color:rgba(255,255,255,.85);
    background:linear-gradient(transparent,rgba(0,0,0,.7));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none;cursor:pointer}
  .wmp-credit:hover{color:#fff;text-decoration:underline}
  .wmp-trade-hidden{display:none!important}
  .wmp-trade-grid{display:flex;flex-wrap:wrap;gap:6px}
  .wmp-mini{position:relative;width:82px;height:114px;border-radius:9px;overflow:hidden;background:#1b1f1d;border:.8px solid rgba(255,255,255,.08);
    box-shadow:0 0 8px color-mix(in srgb,var(--c) 35%,transparent);flex:none}
  .wmp-mini .im{position:absolute;left:0;right:0;top:0;height:52%;width:100%;object-fit:cover;background:#101211;display:block}
  .wmp-mini .ph{position:absolute;left:0;right:0;top:0;height:52%;display:grid;place-items:center;color:rgba(255,255,255,.2);font:800 18px/1 system-ui}
  .wmp-mini .rb{position:absolute;top:4px;left:4px;padding:1px 4px;border-radius:4px;font:800 9px/1.3 system-ui;color:#111;background:var(--c)}
  .wmp-mini .sh{position:absolute;top:4px;right:4px;font-size:10px;color:#e9c15a;text-shadow:0 0 4px #000}
  .wmp-mini .tt{position:absolute;left:0;right:0;top:52%;bottom:0;padding:5px 6px;font:700 10px/1.2 system-ui,sans-serif;color:#0c0d0c;
    background:color-mix(in srgb,var(--c) 70%,#fff);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
  html[data-wmp-compact] main .relative.isolate.group{zoom:.62}
  html[data-wmp-compact] main .flex.flex-wrap.justify-center{gap:10px!important}
  html[data-wmp-compact] main .relative.isolate.group .wmp-tools{zoom:1.4}
  .wmp-fab{position:fixed;right:18px;bottom:18px;z-index:2147482000;display:flex;gap:8px;align-items:center}
  .wmp-compact-btn{display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;cursor:pointer;
    background:rgba(19,22,21,.92);border:.8px solid rgba(200,208,203,.18);color:#f2f4f3;font:600 12px/1 system-ui,sans-serif;
    box-shadow:0 8px 26px rgba(0,0,0,.45);backdrop-filter:blur(8px);transition:border-color .15s,transform .15s}
  .wmp-compact-btn:hover{transform:translateY(-1px);border-color:rgba(52,211,153,.6)}
  .wmp-compact-btn svg{width:14px;height:14px}
  .wmp-compact-btn.busy{cursor:progress;color:#34d399}
  .wmp-compact-btn.done{border-color:rgba(52,211,153,.7);color:#34d399}
  html[data-wmp-compact] .wmp-compact-btn{border-color:rgba(52,211,153,.7);color:#34d399}
  .wmp-fs{position:fixed;inset:0;z-index:2147483100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
    background:radial-gradient(ellipse at 50% 45%,color-mix(in srgb,var(--c) 16%,rgba(8,9,8,.94)) 0,rgba(5,6,5,.96) 60%);backdrop-filter:blur(8px);
    animation:wmpfs .2s ease-out;font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f2f4f3}
  .wmp-fs.out{opacity:0;transition:opacity .18s}
  .wmp-fs .stage{perspective:1400px;display:grid;place-items:center;width:100%;flex:1;min-height:0;cursor:zoom-out}
  .wmp-fs .tilt{position:relative;transition:transform .15s ease-out;transform-style:preserve-3d;cursor:default}
  .wmp-fs .pic{display:block;max-height:min(84vh,calc(100vh - 110px));max-width:88vw;opacity:0;transform:scale(.94);transition:opacity .3s,transform .4s cubic-bezier(.2,.9,.3,1.1);
    filter:drop-shadow(0 0 28px color-mix(in srgb,var(--c) 55%,transparent)) drop-shadow(0 30px 50px rgba(0,0,0,.6))}
  .wmp-fs.ready .pic{opacity:1;transform:none}
  .wmp-fs .shine{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay}
  .wmp-fs .spin{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:var(--c);animation:wmpspin .8s linear infinite}
  .wmp-fs.ready .spin{display:none}
  @keyframes wmpspin{to{transform:rotate(360deg)}}
  .wmp-fs .bar{display:flex;gap:8px;padding:0 16px 22px;flex-wrap:wrap;justify-content:center}
  .wmp-fs .b{all:unset;display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:10px;cursor:pointer;background:rgba(255,255,255,.07);
    border:.8px solid rgba(255,255,255,.14);color:#f2f4f3;font:600 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;transition:background .15s,transform .12s}
  .wmp-fs .b:hover{background:rgba(255,255,255,.13);transform:translateY(-1px)}
  .wmp-fs .b svg{width:15px;height:15px}
  .wmp-fs .b .wmp-w{font:700 14px/1 Georgia,"Times New Roman",serif}
  .wmp-fs .b kbd{font:600 10px/1.5 ui-monospace,monospace;padding:0 5px;border-radius:4px;border:.8px solid rgba(255,255,255,.2);color:rgba(242,244,243,.6)}
  .wmp-fs .b.wmp-ok{background:#16a34a;border-color:transparent}
  @keyframes wmpfs{from{opacity:0}}
  .wmp-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483200;padding:9px 16px;border-radius:999px;background:rgba(19,22,21,.95);
    color:#f2f4f3;border:.8px solid rgba(52,211,153,.5);font:600 13px/1 system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.45);animation:wmpfs .2s}
  `;
  (document.head || document.documentElement).appendChild(css);

  const ICON = {
    lb: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="4" fill="#ff8000"/><circle cx="12" cy="12" r="4" fill="#00e054" fill-opacity=".9"/><circle cx="19" cy="12" r="4" fill="#40bcf4" fill-opacity=".9"/></svg>',
    fs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'
  };

  function toast(t) {
    const d = document.createElement('div'); d.className = 'wmp-toast'; d.textContent = t;
    document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
  }

  // ------------------------------------------------------------------
  //  Lecture des données de carte via React
  // ------------------------------------------------------------------
  // Images servies par le proxy d'images du site (rapide, même origine, pas de limite de débit Wikimedia),
  // avec repli sur l'adresse directe en cas d'échec.
  const direct = (u) => String(u || '').replace('//thumb.wikimedia.org/', '//upload.wikimedia.org/');
  const proxied = (u, w) => `/_next/image?url=${encodeURIComponent(direct(u))}&w=${w}&q=75`;
  function imgTag(u, w, cls, extra = '') {
    return `<img class="${cls}" src="${esc(proxied(u, w))}" data-direct="${esc(direct(u))}" alt="" loading="lazy" decoding="async" ${extra}>`;
  }
  document.addEventListener('error', (e) => {
    const im = e.target;
    if (im && im.tagName === 'IMG' && im.dataset && im.dataset.direct && !im.dataset.fallback) { im.dataset.fallback = '1'; im.src = im.dataset.direct; }
    else if (im && im.tagName === 'IMG' && im.dataset && im.dataset.fallback && im.closest('.wmp-freeimg')) im.closest('.wmp-freeimg').remove();
  }, true);

  const fiberOf = (el) => { const k = Object.keys(el).find((x) => x.startsWith('__reactFiber')); return k ? el[k] : null; };
  function cardData(el, depth = 4) {
    let f = fiberOf(el);
    for (let i = 0; i < depth && f; i++, f = f.return) {
      const p = f.memoizedProps;
      if (p && p.card && typeof p.card === 'object' && 'wikipedia_title' in p.card) return p.card;
    }
    return null;
  }
  function wikiRef(card) {
    try {
      const u = new URL(card.wikipedia_url);
      const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ');
      return { host: u.host, title, url: card.wikipedia_url };
    } catch (_) {
      const lang = card.lang || 'fr';
      return { host: lang + '.wikipedia.org', title: card.wikipedia_title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(card.wikipedia_title).replace(/ /g, '_'))}` };
    }
  }

  // ------------------------------------------------------------------
  //  Métadonnées (Wikipédia + Wikidata), en lots et en cache local
  // ------------------------------------------------------------------
  const META_KEY = 'wmp_meta_v2';
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch (_) {}
  let saveT = null;
  function saveMeta() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const keys = Object.keys(meta);
      if (keys.length > 6000) keys.sort((a, b) => meta[a].t - meta[b].t).slice(0, keys.length - 5000).forEach((k) => delete meta[k]);
      try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (_) {}
    }, 800);
  }
  const TTL = 7 * 24 * 3600 * 1000;
  const listeners = new Map(); // card id -> [fn]
  const pending = new Map();   // card id -> card
  let batchT = null;
  function need(card, fn) {
    const m = meta[card.id];
    if (m && Date.now() - m.t < TTL) { fn(m); return; }
    if (!listeners.has(card.id)) listeners.set(card.id, []);
    listeners.get(card.id).push(fn);
    pending.set(card.id, card);
    clearTimeout(batchT); batchT = setTimeout(runBatch, 250);
  }
  const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

  async function runBatch() {
    const cards = [...pending.values()]; pending.clear();
    const byHost = {};
    cards.forEach((c) => { const r = wikiRef(c); (byHost[r.host] = byHost[r.host] || []).push({ c, r }); });
    const results = {}; // id -> {q, img}
    for (const host of Object.keys(byHost)) {
      for (const part of chunk(byHost[host], 40)) {
        try {
          const titles = part.map((x) => x.r.title);
          const url = `https://${host}/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageprops|pageimages&ppprop=wikibase_item` +
            `&piprop=thumbnail|name&pithumbsize=640&pilicense=free&titles=${encodeURIComponent(titles.join('|'))}`;
          const j = await fetch(url).then((r) => r.json());
          const map = {}; titles.forEach((t) => (map[t] = t));
          (j.query.normalized || []).forEach((n) => Object.keys(map).forEach((k) => { if (map[k] === n.from) map[k] = n.to; }));
          (j.query.redirects || []).forEach((n) => Object.keys(map).forEach((k) => { if (map[k] === n.from) map[k] = n.to; }));
          const pages = {}; Object.values(j.query.pages || {}).forEach((p) => (pages[p.title] = p));
          const needCredit = [];
          for (const { c, r } of part) {
            const p = pages[map[r.title]];
            const res = { q: p && p.pageprops && p.pageprops.wikibase_item || null, img: null };
            if (p && p.thumbnail && p.pageimage) { res.img = { src: p.thumbnail.source, file: p.pageimage }; needCredit.push(res.img); }
            results[c.id] = res;
          }
          // Crédits et licence des images libres
          for (const grp of chunk(needCredit, 40)) {
            const u2 = `https://${host}/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata|url&iiextmetadatafilter=Artist|LicenseShortName|UsageTerms&titles=${encodeURIComponent(grp.map((g) => 'File:' + g.file).join('|'))}`;
            const j2 = await fetch(u2).then((r) => r.json());
            const byName = {};
            Object.values(j2.query.pages || {}).forEach((p) => { byName[String(p.title).replace(/^[^:]+:/, '').replace(/ /g, '_')] = p; });
            grp.forEach((g) => {
              const p = byName[String(g.file).replace(/ /g, '_')];
              const ii = p && p.imageinfo && p.imageinfo[0];
              const em = ii && ii.extmetadata || {};
              const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
              g.artist = strip(em.Artist && em.Artist.value) || 'Auteur inconnu';
              g.license = strip(em.LicenseShortName && em.LicenseShortName.value) || strip(em.UsageTerms && em.UsageTerms.value) || 'Licence libre';
              g.page = ii && ii.descriptionurl || `https://${host}/wiki/File:${encodeURIComponent(g.file)}`;
            });
          }
        } catch (e) { console.warn('[WikiMasters+] wikipedia', e); }
      }
    }
    // Letterboxd via Wikidata (une seule requête SPARQL pour tout le lot)
    const qids = [...new Set(Object.values(results).map((r) => r.q).filter(Boolean))];
    const lb = {};
    const wdImg = {};
    for (const part of chunk(qids, 60)) {
      try {
        const q = `SELECT ?item ?film ?actor ?director ?isFilm ?isCine ?image ?poster ?logo WHERE {
          VALUES ?item { ${part.map((x) => 'wd:' + x).join(' ')} }
          OPTIONAL { ?item wdt:P6127 ?film } OPTIONAL { ?item wdt:P6119 ?actor } OPTIONAL { ?item wdt:P12383 ?director }
          OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?item wdt:P3383 ?poster } OPTIONAL { ?item wdt:P154 ?logo }
          BIND(EXISTS { ?item wdt:P31 ?t . VALUES ?t { wd:Q11424 wd:Q24862 wd:Q202866 wd:Q506240 wd:Q226730 wd:Q17123180 wd:Q93204 wd:Q24869 } } AS ?isFilm)
          BIND(EXISTS { ?item wdt:P106 ?o . VALUES ?o { wd:Q33999 wd:Q10800557 wd:Q10798782 wd:Q2405480 wd:Q2526255 wd:Q3455803 wd:Q2259451 } } AS ?isCine)
        }`;
        const j = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { Accept: 'application/sparql-results+json' } }).then((r) => r.json());
        for (const b of j.results.bindings) {
          const id = b.item.value.split('/').pop();
          const v = (k) => b[k] && b[k].value;
          let url = null;
          if (v('film')) url = `https://letterboxd.com/film/${v('film')}/`;
          else if (v('director')) url = `https://letterboxd.com/director/${v('director')}/`;
          else if (v('actor')) url = `https://letterboxd.com/actor/${v('actor')}/`;
          else if (v('isFilm') === 'true' || v('isCine') === 'true') url = 'search';
          if (url && !lb[id]) lb[id] = url;
          // image Wikidata (hébergée sur Commons, donc sous licence libre) : photo, puis affiche, puis logo
          const f = v('image') || v('poster') || v('logo');
          if (f && !wdImg[id]) wdImg[id] = { name: decodeURIComponent(f.split('/Special:FilePath/').pop()), logo: !v('image') && !v('poster') };
        }
      } catch (e) { console.warn('[WikiMasters+] wikidata', e); }
    }
    // Cartes sans image de page Wikipédia : on prend l'image Wikidata (Commons) avec son crédit
    const missing = cards.map((c) => results[c.id]).filter((r) => r && !r.img && r.q && wdImg[r.q]);
    for (const grp of chunk(missing, 40)) {
      try {
        const names = [...new Set(grp.map((r) => wdImg[r.q].name))];
        const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=640` +
          `&iiextmetadatafilter=Artist|LicenseShortName|UsageTerms&titles=${encodeURIComponent(names.map((n) => 'File:' + n).join('|'))}`;
        const j = await fetch(u).then((x) => x.json());
        const byName = {};
        const norm = (n) => String(n).replace(/^[^:]+:/, '').replace(/_/g, ' ').trim();
        (j.query.normalized || []).forEach((n) => { byName['from:' + norm(n.from)] = norm(n.to); });
        Object.values(j.query.pages || {}).forEach((p) => { byName[norm(p.title)] = p; });
        const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        for (const r of grp) {
          const n = norm(wdImg[r.q].name);
          const p = byName[n] || byName[byName['from:' + n]];
          const ii = p && p.imageinfo && p.imageinfo[0];
          if (!ii || !(ii.thumburl || ii.url)) continue;
          const em = ii.extmetadata || {};
          r.img = {
            src: ii.thumburl || ii.url, file: n, logo: wdImg[r.q].logo,
            artist: strip(em.Artist && em.Artist.value) || 'Auteur inconnu',
            license: strip(em.LicenseShortName && em.LicenseShortName.value) || strip(em.UsageTerms && em.UsageTerms.value) || 'Licence libre',
            page: ii.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(n)}`
          };
        }
      } catch (e) { console.warn('[WikiMasters+] commons', e); }
    }

    for (const c of cards) {
      const r = results[c.id] || { q: null, img: null };
      let lbu = r.q ? lb[r.q] || null : null;
      if (lbu === 'search') lbu = `https://letterboxd.com/search/${encodeURIComponent(c.wikipedia_title)}/`;
      const m = { t: Date.now(), q: r.q, lb: lbu, img: r.img };
      if (!results[c.id]) m.t = Date.now() - TTL + 3600 * 1000; // échec réseau : on réessaiera dans une heure
      meta[c.id] = m;
      (listeners.get(c.id) || []).forEach((fn) => { try { fn(m); } catch (_) {} });
      listeners.delete(c.id);
    }
    saveMeta();
  }

  // ------------------------------------------------------------------
  //  Boutons sur les cartes
  // ------------------------------------------------------------------
  const stop = (e) => { e.stopPropagation(); };
  function toolbar(el, card) {
    let tb = [...el.children].find((c) => c.classList && c.classList.contains('wmp-tools'));
    if (tb) return tb;
    tb = document.createElement('div');
    tb.className = 'wmp-tools';
    const big = el.getBoundingClientRect().width > 220;
    if (big || el.closest('[class*="animate-card-flip"]')) tb.classList.add('wmp-always');
    const w = wikiRef(card);
    tb.innerHTML = `<a class="wmp-w" href="${esc(w.url)}" target="_blank" rel="noopener" title="Ouvrir sur Wikipédia">W</a>
      <button class="wmp-fsb" title="Plein écran">${ICON.fs}</button>
      <button class="wmp-cp" title="Copier l'image de la carte">${ICON.copy}</button>`;
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach((t) => tb.addEventListener(t, stop));
    tb.querySelector('.wmp-fsb').addEventListener('click', (e) => { e.preventDefault(); fullscreen(el, card); });
    tb.querySelector('.wmp-cp').addEventListener('click', (e) => { e.preventDefault(); copyCard(el, e.currentTarget); });
    el.appendChild(tb);
    return tb;
  }
  function addLetterboxd(tb, url) {
    if (!url || tb.querySelector('.wmp-lb')) return;
    const a = document.createElement('a');
    a.className = 'wmp-lb'; a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Voir sur Letterboxd'; a.innerHTML = ICON.lb;
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach((t) => a.addEventListener(t, stop));
    tb.querySelector('.wmp-w').after(a);
  }

  function addFreeImage(el, img) {
    if (!img || el.querySelector('.wmp-freeimg')) return;
    const area = [...el.children].find((c) => /\bh-\[45%\]/.test(String(c.className)));
    if (!area) return;
    const d = document.createElement('div');
    d.className = 'wmp-freeimg' + (img.logo ? ' wmp-logo' : '');
    const credit = `${img.artist || ''} · ${img.license || ''}`;
    d.innerHTML = `${imgTag(img.src, 640, '')}
      <a class="wmp-credit" href="${esc(img.page)}" target="_blank" rel="noopener" title="${esc(credit)} (Wikimedia)">${esc(credit)}</a>`;
    const cr = d.querySelector('.wmp-credit');
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach((t) => cr.addEventListener(t, stop));
    area.appendChild(d);
  }

  // Plein écran : copie visuelle de la carte, agrandie
  // ------------------------------------------------------------------
  //  Rendu de la carte en image nette (partagé par le plein écran et la copie)
  // ------------------------------------------------------------------
  // Remplace temporairement les images de la carte par des versions haute définition, le temps du rendu.
  async function withHiRes(el, fn) {
    const saved = [];
    el.querySelectorAll('img').forEach((im) => {
      if (im.closest('.wmp-tools')) return;
      const src = im.getAttribute('src') || '';
      let hi = null;
      if (src.startsWith('/_next/image')) hi = src.replace(/([?&])w=\d+/, '$11080');
      else if (/(upload|thumb)\.wikimedia\.org\/.+\/\d+px-[^/?]+(\?.*)?$/.test(src) && !/\/(9\d\d|1\d{3})px-/.test(src)) hi = src.replace(/\/\d+px-([^/?]+)(\?.*)?$/, '/960px-$1');
      if (!hi || hi === src) return;
      saved.push([im, src, im.getAttribute('srcset'), im.getAttribute('sizes')]);
      im.removeAttribute('srcset'); im.removeAttribute('sizes'); im.src = hi;
    });
    // si la version HD ne charge pas, on remet l'originale avant le rendu
    await Promise.all(saved.map(([im, src]) => new Promise((res) => {
      const done = () => { clearTimeout(t); res(); };
      const fail = () => { clearTimeout(t); im.src = src; if (im.complete) res(); else { im.addEventListener('load', res, { once: true }); im.addEventListener('error', res, { once: true }); setTimeout(res, 1500); } };
      const t = setTimeout(fail, 2500);
      if (im.complete && im.naturalWidth) return done();
      im.addEventListener('load', done, { once: true }); im.addEventListener('error', fail, { once: true });
    })));
    try { return await fn(); }
    finally {
      saved.forEach(([im, src, srcset, sizes]) => { im.src = src; if (srcset) im.setAttribute('srcset', srcset); if (sizes) im.setAttribute('sizes', sizes); });
    }
  }
  function renderCard(el, ratio) {
    const lib = window.htmlToImage;
    if (!lib) return Promise.reject(new Error('rendu indisponible'));
    return withHiRes(el, () => lib.toBlob(el, {
      pixelRatio: ratio, cacheBust: false,
      filter: (n) => !(n.classList && (n.classList.contains('wmp-tools'))),
      style: { transform: 'none', margin: '0', zoom: '1' }
    })).then((b) => { if (!b) throw new Error('rendu vide'); return b; });
  }
  const rarityOf = (card) => (card && card.rarity) || 'C';

  // ------------------------------------------------------------------
  //  Plein écran
  // ------------------------------------------------------------------
  function fullscreen(el, card) {
    const col = card && card.is_shiny ? '#e9c15a' : (RCOL[rarityOf(card)] || '#b8f2d5');
    const w = wikiRef(card || {});
    const m = card && meta[card.id];
    const ov = document.createElement('div');
    ov.className = 'wmp-fs';
    ov.style.setProperty('--c', col);
    ov.innerHTML = `
      <div class="stage"><div class="tilt"><div class="spin"></div><img class="pic" alt=""><div class="shine"></div></div></div>
      <div class="bar">
        <button class="b cp">${ICON.copy}<span>Copier</span></button>
        <a class="b" href="${esc(w.url)}" target="_blank" rel="noopener"><span class="wmp-w">W</span><span>Wikipédia</span></a>
        ${m && m.lb ? `<a class="b" href="${esc(m.lb)}" target="_blank" rel="noopener">${ICON.lb}<span>Letterboxd</span></a>` : ''}
        <button class="b x"><span>Fermer</span><kbd>Échap</kbd></button>
      </div>`;
    const pic = ov.querySelector('.pic'), tilt = ov.querySelector('.tilt'), shine = ov.querySelector('.shine');
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    let url = null;
    function close() {
      removeEventListener('keydown', onKey, true);
      if (document.fullscreenElement === ov) document.exitFullscreen().catch(() => {});
      ov.classList.add('out'); setTimeout(() => { ov.remove(); if (url) URL.revokeObjectURL(url); }, 180);
    }
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.classList.contains('stage')) close(); });
    ov.querySelector('.x').addEventListener('click', close);
    ov.querySelector('.cp').addEventListener('click', (e) => copyCard(el, e.currentTarget, true));
    addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', function fc() {
      if (!document.fullscreenElement && ov.isConnected && !ov.classList.contains('out')) close();
      if (!ov.isConnected) document.removeEventListener('fullscreenchange', fc);
    });
    // Inclinaison 3D + reflet qui suit la souris
    ov.addEventListener('pointermove', (e) => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const cx = Math.max(-.6, Math.min(.6, x - .5)), cy = Math.max(-.6, Math.min(.6, y - .5));
      tilt.style.transform = `rotateY(${cx * 16}deg) rotateX(${-cy * 14}deg)`;
      shine.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,.28), transparent 45%)`;
    });
    ov.addEventListener('pointerleave', () => { tilt.style.transform = ''; shine.style.background = ''; });
    document.body.appendChild(ov);
    if (ov.requestFullscreen) ov.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});

    const target = Math.max(screen.height, innerHeight) * .86 * (devicePixelRatio || 1);
    const ratio = Math.min(6, Math.max(2, target / (el.offsetHeight || 224)));
    renderCard(el, ratio).then((blob) => {
      url = URL.createObjectURL(blob);
      pic.onload = () => {
        ov.classList.add('ready');
        const mask = `url("${url}") center/contain no-repeat`;
        shine.style.webkitMask = mask; shine.style.mask = mask;
      };
      pic.src = url;
    }).catch((e) => { console.warn('[WikiMasters+] plein écran', e); toast('Impossible d’afficher cette carte en grand'); close(); });
  }

  // Copie de la carte en image PNG dans le presse-papier
  async function copyCard(el, btn, inOverlay) {
    if (!window.htmlToImage || !navigator.clipboard || !window.ClipboardItem) { toast('Copie non disponible dans ce navigateur'); return; }
    const old = btn.innerHTML;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderCard(el, 3) })]);
      btn.innerHTML = inOverlay ? `${ICON.ok}<span>Copiée</span>` : ICON.ok; btn.classList.add('wmp-ok');
      toast('Carte copiée dans le presse-papier');
    } catch (e) {
      console.warn('[WikiMasters+] copie', e);
      toast('Impossible de copier cette carte');
    }
    setTimeout(() => { btn.innerHTML = old; btn.classList.remove('wmp-ok'); }, 1500);
  }

  // ------------------------------------------------------------------
  //  Page des échanges : cartes au lieu du texte
  // ------------------------------------------------------------------
  function tradeLists() {
    if (!location.pathname.startsWith('/trades')) return;
    const spans = [...document.querySelectorAll('main span')].filter((s) => !s.closest('.wmp-trade-grid'));
    const lists = new Set();
    for (const s of spans) {
      const f = fiberOf(s);
      const p = f && f.return && f.return.memoizedProps;
      if (p && p.card && 'wikipedia_title' in p.card && s.parentElement) lists.add(s.parentElement);
    }
    for (const list of lists) {
      if (list.classList.contains('wmp-trade-hidden') && list.nextElementSibling && list.nextElementSibling.classList.contains('wmp-trade-grid')) continue;
      const cards = [...list.children].map((s) => { const f = fiberOf(s); return f && f.return && f.return.memoizedProps && f.return.memoizedProps.card; }).filter(Boolean);
      if (!cards.length) continue;
      const g = document.createElement('div');
      g.className = 'wmp-trade-grid';
      g.innerHTML = cards.map((c) => {
        const col = RCOL[c.rarity] || '#9ca3af';
        const img = c.image_url && !c.hide_image ? c.image_url : null;
        return `<div class="wmp-mini" style="--c:${col}" title="${esc(c.rarity + ' · ' + c.wikipedia_title)}" data-id="${esc(c.id)}">
          ${img ? imgTag(img, 256, 'im') : '<div class="ph">W</div>'}
          <span class="rb">${esc(c.rarity)}</span>${c.is_shiny ? '<span class="sh">✦</span>' : ''}
          <div class="tt">${esc(c.wikipedia_title)}</div></div>`;
      }).join('');
      list.classList.add('wmp-trade-hidden');
      list.after(g);
      // Image libre pour les mini-cartes sans image
      if (S.freeImages) cards.forEach((c) => {
        if (c.image_url) return;
        need(c, (m) => {
          if (!m.img) return;
          const el = g.querySelector(`.wmp-mini[data-id="${CSS.escape(String(c.id))}"]`);
          if (el && el.querySelector('.ph')) el.querySelector('.ph').outerHTML = imgTag(m.img.src, 256, 'im', `title="${esc(m.img.artist + ' · ' + m.img.license)}"${m.img.logo ? ' style="object-fit:contain;background:#eef1ef;padding:8px;box-sizing:border-box"' : ''}`);
        });
      });
    }
  }
  function undoTrades() {
    document.querySelectorAll('.wmp-trade-grid').forEach((g) => g.remove());
    document.querySelectorAll('.wmp-trade-hidden').forEach((l) => l.classList.remove('wmp-trade-hidden'));
  }

  // ------------------------------------------------------------------
  //  Vue compacte
  // ------------------------------------------------------------------
  let cbtn = null, kbtn = null;
  const fab = document.createElement('div'); fab.className = 'wmp-fab';
  const compactPage = () => /^\/(collection|global-collection)(\/|$)/.test(location.pathname);
  const ckey = () => 'wmp_compact_' + location.pathname.split('/')[1];
  function compact() {
    const on = S.compactToggle && compactPage();
    if (!on) { cbtn && cbtn.remove(); document.documentElement.removeAttribute('data-wmp-compact'); }
    else {
      let state = false; try { state = localStorage.getItem(ckey()) === '1'; } catch (_) {}
      document.documentElement.toggleAttribute('data-wmp-compact', state);
      if (!cbtn) {
        cbtn = document.createElement('button');
        cbtn.className = 'wmp-compact-btn';
        cbtn.addEventListener('click', () => {
          const now = !document.documentElement.hasAttribute('data-wmp-compact');
          try { localStorage.setItem(ckey(), now ? '1' : '0'); } catch (_) {}
          compact();
        });
      }
      const label = state ? 'Vue normale' : 'Vue compacte';
      if (cbtn.dataset.label !== label) { cbtn.dataset.label = label; cbtn.innerHTML = `${ICON.grid}<span>${label}</span>`; }
      if (cbtn.parentElement !== fab) fab.appendChild(cbtn);
    }
    cacheButton();
    if (fab.children.length && !fab.isConnected) document.body.appendChild(fab);
    if (!fab.children.length) fab.remove();
  }

  // ------------------------------------------------------------------
  //  « Tout mettre en cache » : précharge toutes les pages de ta collection
  // ------------------------------------------------------------------
  let caching = false;
  function cacheButton() {
    const on = S.cache && /^\/collection(\/|$)/.test(location.pathname);
    if (!on) { if (kbtn && !caching) kbtn.remove(); return; }
    if (!kbtn) {
      kbtn = document.createElement('button');
      kbtn.className = 'wmp-compact-btn';
      kbtn.innerHTML = `${ICON.dl}<span>Tout mettre en cache</span>`;
      kbtn.addEventListener('click', cacheAll);
    }
    if (kbtn.parentElement !== fab) fab.insertBefore(kbtn, fab.firstChild);
  }
  function collectionTemplate() {
    const e = performance.getEntriesByType('resource').filter((x) => /\/api\/my-collection\?/.test(x.name)).pop();
    if (e) return new URL(e.name);
    const u = new URL('/api/my-collection', location.origin);
    u.searchParams.set('sort', 'rarity'); u.searchParams.set('page', '0'); u.searchParams.set('stats', '0');
    return u;
  }
  async function cacheAll() {
    if (caching) return;
    caching = true;
    const label = kbtn.querySelector('span');
    kbtn.classList.remove('done'); kbtn.classList.add('busy');
    const tpl = collectionTemplate();
    const url = (page, stats) => {
      const u = new URL(tpl.href);
      u.searchParams.set('page', String(page));
      if (stats != null && u.searchParams.has('stats')) u.searchParams.set('stats', stats);
      return u.pathname + u.search;
    };
    let cards = 0, page = 0, end = false, errors = 0;
    try {
      // statistiques et première page avec les deux variantes utilisées par le site
      const sort = tpl.searchParams.get('sort') || 'rarity';
      await Promise.all([
        fetch(`/api/my-collection/stats?sort=${encodeURIComponent(sort)}`).catch(() => {}),
        fetch(url(0, '1')).catch(() => {})
      ]);
      while (!end && page < 400) {
        const batch = [page, page + 1, page + 2];
        const res = await Promise.all(batch.map((p) => fetch(url(p, '0')).then((r) => r.ok ? r.json() : null).catch(() => null)));
        for (const j of res) {
          if (!j || !Array.isArray(j.collection)) { errors++; end = errors > 3 || end; continue; }
          cards += j.collection.length;
          if (j.collection.length < 50) end = true;
        }
        page += 3;
        label.textContent = `Mise en cache… ${cards} cartes`;
      }
      label.textContent = `Collection en cache (${cards.toLocaleString('fr-FR')} cartes)`;
      kbtn.classList.add('done');
    } catch (e) {
      console.warn('[WikiMasters+] cache collection', e);
      label.textContent = 'Échec, réessaie';
    }
    kbtn.classList.remove('busy');
    caching = false;
    setTimeout(() => { if (!caching && kbtn) { kbtn.querySelector('span').textContent = 'Tout mettre en cache'; kbtn.classList.remove('done'); } }, 6000);
  }

  // ------------------------------------------------------------------
  //  Balayage
  // ------------------------------------------------------------------
  function scan() {
    compact();
    if (S.tradeCards) tradeLists(); else undoTrades();
    const els = document.querySelectorAll('main [class*="glow-"]');
    for (const el of els) {
      if (!/\brounded-2xl\b/.test(String(el.className))) continue;
      const card = cardData(el);
      if (!card) continue;
      if (el.dataset.wmpId && el.dataset.wmpId !== String(card.id)) {
        el.querySelectorAll('.wmp-tools,.wmp-freeimg').forEach((x) => x.remove());
      }
      el.dataset.wmpId = card.id;
      let tb = null;
      if (S.cardTools) tb = toolbar(el, card); else el.querySelectorAll('.wmp-tools').forEach((x) => x.remove());
      const wantImg = S.freeImages && !card.image_url && !card.hide_image;
      if (!wantImg) el.querySelectorAll('.wmp-freeimg').forEach((x) => x.remove());
      if (tb || wantImg) need(card, (m) => {
        if (el.dataset.wmpId !== String(card.id)) return;
        if (tb && S.cardTools) addLetterboxd(tb, m.lb);
        if (wantImg) addFreeImage(el, m.img);
      });
    }
  }
  let t = null;
  function schedule() { clearTimeout(t); t = setTimeout(scan, 200); }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scan, 3000);
  schedule();
})();
