// Doublons, liste de souhaits enrichie et comparateur d'échange (contexte de la page).
// Lecture seule : l'extension lit ce que le site affiche et les historiques de ventes publics du marché.
(() => {
  if (window.__wmPlusMarket) return;
  window.__wmPlusMarket = true;

  let S = { dupBadges: true, wishHighlight: true, tradeCompare: true, collPrices: true };
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.__wmPlusSettings) {
      const s = e.data.__wmPlusSettings;
      S = { dupBadges: s.dupBadges !== false, wishHighlight: s.wishHighlight !== false, tradeCompare: s.tradeCompare !== false, collPrices: s.collPrices !== false };
      schedule(true);
    }
    if (e.data.__wmPlusOwned || e.data.__wmPlusWish || e.data.__wmPlusPrices) schedule(true);
  });

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const RCOL = { L: '#ffe144', UR: '#fa9931', SR: '#ed6fa3', R: '#c6a7f2', PC: '#b1cff2', C: '#b8f2d5' };
  const RANKS = ['L', 'UR', 'SR', 'R', 'PC', 'C'];
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const fiberOf = (el) => { const k = Object.keys(el).find((x) => x.startsWith('__reactFiber')); return k ? el[k] : null; };
  function cardData(el, depth = 4) {
    let f = fiberOf(el);
    for (let i = 0; i < depth && f; i++, f = f.return) {
      const p = f.memoizedProps;
      if (p && p.card && typeof p.card === 'object' && 'wikipedia_title' in p.card) return p.card;
    }
    return null;
  }
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const path = () => location.pathname;

  // ------------------------------------------------------------------
  //  Styles
  // ------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
  .wmp-own{position:absolute;right:8px;top:38px;z-index:41;padding:2px 7px;border-radius:999px;font:800 11px/1.4 system-ui,sans-serif;
    color:#0c0d0c;background:#f2f4f3;box-shadow:0 2px 8px rgba(0,0,0,.4);pointer-events:none}
  .wmp-own.dup{background:#fbbf24}
  .wmp-own.have{background:#34d399}
  .wmp-mini .wmp-own{top:auto;bottom:calc(48% + 3px);right:3px;font-size:9px;padding:1px 5px}
  [class*="glow-"].wmp-wish,.wmp-mini.wmp-wish{outline:2px solid #f472b6;outline-offset:2px;box-shadow:0 0 18px rgba(244,114,182,.55)!important}
  .wmp-wish-tag{position:absolute;left:50%;top:4px;transform:translateX(-50%);z-index:42;padding:2px 8px;border-radius:999px;white-space:nowrap;
    font:800 10px/1.4 system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#f472b6,#db2777);box-shadow:0 2px 10px rgba(219,39,119,.5);pointer-events:none}
  .wmp-mini .wmp-wish-tag{font-size:8px;padding:1px 5px;top:19px;left:4px;transform:none}
  .wmp-pill{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147482000;padding:8px 14px;border-radius:999px;
    background:rgba(19,22,21,.95);border:.8px solid rgba(244,114,182,.6);color:#f2f4f3;font:600 13px/1 system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.45)}
  .wmp-price{position:absolute;right:3px;top:3px;z-index:3;padding:1px 5px;border-radius:5px;font:800 9px/1.35 system-ui,sans-serif;color:#0c0d0c;background:#fde68a}
.wmp-build{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:10px 16px;background:rgba(10,12,11,.6);
    border-bottom:.8px solid rgba(200,208,203,.1);font:13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f2f4f3}
  .wmp-build .side{display:flex;flex-direction:column;gap:2px}
  .wmp-build .side.r{text-align:right;align-items:flex-end}
  .wmp-build .lbl{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:rgba(242,244,243,.5)}
  .wmp-build b{font-size:18px;color:#fde68a;font-variant-numeric:tabular-nums}
  .wmp-build small{font-size:11px;color:rgba(242,244,243,.55)}
  .wmp-build .mid{font-weight:800;font-size:14px;text-align:center;color:rgba(242,244,243,.6);white-space:nowrap}
  .wmp-build .n{grid-column:1/-1;font-size:11px;color:rgba(242,244,243,.45);text-align:center}
  .wmp-build .spin{display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid rgba(255,255,255,.2);border-top-color:#fde68a;animation:wmpsp .8s linear infinite;vertical-align:-1px}
  @keyframes wmpsp{to{transform:rotate(360deg)}}
  .wmp-cprice{position:absolute;left:50%;top:calc(45% - 22px);transform:translateX(-50%);z-index:41;padding:2px 8px;border-radius:999px;white-space:nowrap;
    font:800 11px/1.4 system-ui,sans-serif;color:#0c0d0c;background:#fde68a;box-shadow:0 2px 8px rgba(0,0,0,.45);pointer-events:none}
  .wmp-cmp{margin-top:10px;border-radius:14px;border:.8px solid rgba(200,208,203,.14);background:rgba(10,12,11,.55);padding:12px 14px;cursor:default;
    font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f2f4f3}
  .wmp-cmp .cols{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start}
  .wmp-cmp h4{margin:0 0 6px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:rgba(242,244,243,.5)}
  .wmp-cmp .v{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
  .wmp-cmp .v small{font-size:12px;font-weight:600;color:rgba(242,244,243,.5)}
  .wmp-cmp .chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
  .wmp-cmp .chip{padding:1px 6px;border-radius:5px;font:800 10px/1.4 system-ui;color:#111}
  .wmp-cmp .st{font-size:12px;color:rgba(242,244,243,.6)}
  .wmp-cmp .mid{align-self:center;text-align:center;font-size:12px;color:rgba(242,244,243,.5)}
  .wmp-cmp .bal{height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;display:flex;margin-top:10px}
  .wmp-cmp .bal i{display:block;height:100%}
  .wmp-cmp .foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
  .wmp-cmp button{all:unset;cursor:pointer;padding:6px 11px;border-radius:8px;background:rgba(255,255,255,.08);border:.8px solid rgba(255,255,255,.16);font-weight:600;font-size:12px}
  .wmp-cmp button:hover{background:rgba(255,255,255,.14)}
  .wmp-cmp .warn{margin-top:8px;padding:7px 10px;border-radius:9px;background:rgba(251,191,36,.12);border:.8px solid rgba(251,191,36,.35);color:#fde68a;font-size:12px}
  .wmp-cmp .note{font-size:11px;color:rgba(242,244,243,.45)}
  .wmp-cmp .verdict{font-weight:700}
  `;
  (document.head || document.documentElement).appendChild(css);

  // ------------------------------------------------------------------
  //  Données : exemplaires possédés, liste de souhaits, client du site
  // ------------------------------------------------------------------
  // Lecture mémorisée : la collection peut peser plus d'1 Mo, on ne la relit que si elle a changé
  let ownMemo = null;
  function owned() {
    let stamp = ''; try { stamp = (localStorage.getItem('wmp_owned_t') || '') + ':' + (localStorage.getItem('wmp_owned_full') || ''); } catch (_) {}
    if (ownMemo && ownMemo.stamp === stamp) return ownMemo.m;
    const m = new Map();
    const counts = lsGet('wmp_owned_counts', null);
    if (counts) { for (const id in counts) m.set(id, counts[id]); }
    else {
      // pas encore d'analyse complète : exemplaires vus sur les pages ouvertes (listés un par un ou regroupés)
      const entries = lsGet('wmp_owned_entries', {});
      const cnt = new Map(), mx = new Map();
      for (const k in entries) {
        const [cid, n] = entries[k]; const id = String(cid);
        cnt.set(id, (cnt.get(id) || 0) + 1);
        mx.set(id, Math.max(mx.get(id) || 0, Number(n) || 1));
      }
      for (const [id, c] of cnt) m.set(id, Math.max(c, mx.get(id) || 1));
    }
    ownMemo = { stamp, m };
    return m;
  }
  const hasOwnedData = () => owned().size > 0;
  const wishlist = () => new Set(lsGet('wmp_wishlist', { ids: [] }).ids.map(String));

  let client = null;
  const isClient = (v) => v && typeof v === 'object' && typeof v.from === 'function' && v.auth;
  function findClient() {
    if (client) return client;
    const els = document.querySelectorAll('main *');
    for (let n = 0; n < els.length && n < 400; n += 7) {
      for (let f = fiberOf(els[n]), i = 0; f && i < 80; f = f.return, i++) {
        const mc = f.updateQueue && f.updateQueue.memoCache;
        if (mc && mc.data) for (const arr of mc.data) if (arr) for (const v of arr) if (isClient(v)) return (client = v);
        let h = f.memoizedState, k = 0;
        while (h && typeof h === 'object' && 'next' in h && k++ < 60) {
          const ms = h.memoizedState;
          if (isClient(ms)) return (client = ms);
          if (ms && typeof ms === 'object' && isClient(ms.current)) return (client = ms.current);
          h = h.next;
        }
      }
    }
    return null;
  }
  window.__wmpFindClient = findClient;
  let wishLoading = false;
  async function refreshWishlist() {
    if (wishLoading || !S.wishHighlight) return;
    const w = lsGet('wmp_wishlist', { ids: [], t: 0 });
    if (Date.now() - (w.t || 0) < 30 * 60 * 1000) return;
    const c = findClient(); if (!c) return;
    wishLoading = true;
    try {
      let uid = null; try { uid = localStorage.getItem('wmp_cache_uid'); } catch (_) {}
      if (!uid) { const { data } = await c.auth.getSession(); uid = data && data.session && data.session.user && data.session.user.id; }
      if (!uid) return;
      const { data, error } = await c.from('wishlist_items').select('card_id').eq('user_id', uid);
      if (!error && Array.isArray(data)) { lsSet('wmp_wishlist', { ids: data.map((r) => String(r.card_id)), t: Date.now() }); schedule(true); }
    } catch (_) {} finally { wishLoading = false; }
  }

  // ------------------------------------------------------------------
  //  Badges sur les cartes (doublons, possédées, souhaitées)
  // ------------------------------------------------------------------
  function ownBadge(el, n, mode) {
    let b = [...el.children].find((c) => c.classList && c.classList.contains('wmp-own'));
    const show = S.dupBadges && n != null && (mode === 'dup' ? n >= 2 : n >= 1);
    if (!show) { if (b) b.remove(); return; }
    const txt = mode === 'dup' ? `×${n}` : `✓ ×${n}`;
    if (!b) { b = document.createElement('span'); el.appendChild(b); }
    b.className = 'wmp-own ' + (mode === 'dup' ? 'dup' : 'have');
    b.title = mode === 'dup' ? `${n} exemplaires dans ta collection` : `Déjà dans ta collection (${n})`;
    if (b.textContent !== txt) b.textContent = txt;
  }
  // Prix estimé affiché sur les cartes de la Collection (quand tu l'as calculé)
  function collPrice(el, c) {
    const e = S.collPrices ? priceShow(String(c.id)) : null;
    let t = [...el.children].find((x) => x.classList && x.classList.contains('wmp-cprice'));
    if (!e || e.m == null) { if (t) t.remove(); return; }
    const txt = `≈ ${fmt(e.m)} W`;
    if (!t) { t = document.createElement('span'); t.className = 'wmp-cprice'; el.appendChild(t); }
    t.title = `Prix médian des ventes récentes (${e.n} vente${e.n > 1 ? 's' : ''})`;
    if (t.textContent !== txt) t.textContent = txt;
  }
  function wishMark(el, on) {
    el.classList.toggle('wmp-wish', on);
    let t = [...el.children].find((c) => c.classList && c.classList.contains('wmp-wish-tag'));
    if (on && !t) { t = document.createElement('span'); t.className = 'wmp-wish-tag'; t.textContent = '♥ Souhaitée'; el.appendChild(t); }
    if (!on && t) t.remove();
  }

  let pill = null;
  function wishPill(n) {
    if (!n || !S.wishHighlight || !/^\/marketplace/.test(path())) { if (pill) { pill.remove(); pill = null; } return; }
    if (!pill) { pill = document.createElement('div'); pill.className = 'wmp-pill'; document.body.appendChild(pill); setTimeout(() => { if (pill) { pill.remove(); pill = null; pillShown = path(); } }, 7000); }
    pill.textContent = `♥ ${n} carte${n > 1 ? 's' : ''} de ta liste de souhaits ${n > 1 ? 'sont' : 'est'} en vente ici`;
  }
  let pillShown = null;

  // ------------------------------------------------------------------
  //  « Mes doublons » : vue de toute la collection, chaque carte en double affichée une seule fois
  // ------------------------------------------------------------------
  let dupBtn = null;
  const proxied = (u, w) => `/_next/image?url=${encodeURIComponent(String(u).replace('//thumb.wikimedia.org/', '//upload.wikimedia.org/'))}&w=${w}&q=75`;
  function dupButton() {
    const on = S.dupBadges && /^\/collection(\/|$)/.test(path());
    document.documentElement.removeAttribute('data-wmp-dups');
    if (!on) { if (dupBtn) dupBtn.remove(); return; }
    if (!dupBtn) {
      dupBtn = document.createElement('button');
      dupBtn.className = 'wmp-compact-btn';
      dupBtn.innerHTML = '<span>Mes doublons</span>';
      dupBtn.addEventListener('click', () => window.__wmpOpenView && window.__wmpOpenView('dups'));
    }
    let fab = document.querySelector('.wmp-fab');
    if (!fab) { fab = document.createElement('div'); fab.className = 'wmp-fab'; fab.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147482000;display:flex;gap:8px'; document.body.appendChild(fab); }
    if (dupBtn.parentElement !== fab) fab.insertBefore(dupBtn, fab.firstChild);
  }
  // ------------------------------------------------------------------
  //  Prix du marché : historique des ventes (endpoint public du site), en cache 24 h
  // ------------------------------------------------------------------
  const SALES_TTL = 24 * 3600 * 1000;
  let salesMem = null;
  const salesCache = () => salesMem || (salesMem = lsGet('wmp_sales', {}));
  let salesSaveT = null;
  const salesSave = () => { clearTimeout(salesSaveT); salesSaveT = setTimeout(() => lsSet('wmp_sales', salesMem), 800); };
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  async function salesFor(id) {
    const cache = salesCache();
    const c = cache[id];
    if (c && Date.now() - c.t < SALES_TTL) return c;
    const r = await fetch(`/api/marketplace/cards/${encodeURIComponent(id)}/sales`);
    if (!r.ok) { const e = new Error('ventes indisponibles'); e.status = r.status; throw e; }
    const j = await r.json();
    const list = (j.recent && j.recent.length ? j.recent : j.sales || []).map((x) => Number(x.final_price)).filter((x) => x > 0);
    const entry = { m: median(list), n: (j.sales || []).length, t: Date.now() };
    const all = salesCache(); all[id] = entry;
    const keys = Object.keys(all); if (keys.length > 12000) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 11000).forEach((k) => delete all[k]);
    salesSave();
    return entry;
  }
  // Estimation de secours par rareté (médiane des prix connus pour cette rareté)
  function rarityFallback(cardsKnown) {
    const by = {};
    for (const { card, p } of cardsKnown) if (p != null) (by[card.rarity] = by[card.rarity] || []).push(p);
    const out = {}; for (const r in by) out[r] = median(by[r]); return out;
  }

  // ------------------------------------------------------------------
  //  Comparateur d'échange
  // ------------------------------------------------------------------
  function tradeInfo(el) {
    for (let f = fiberOf(el), i = 0; f && i < 30; f = f.return, i++) {
      const p = f.memoizedProps;
      if (p && p.trade && p.trade.items) return { trade: p.trade, me: p.currentUserId };
    }
    return null;
  }
  function sideCards(list) {
    return [...list.children].map((s) => { const f = fiberOf(s); return f && f.return && f.return.memoizedProps && f.return.memoizedProps.card; }).filter(Boolean);
  }
  function comparators() {
    if (!/^\/trades/.test(path())) return;
    // listes de cartes de chaque côté (celles que cards.js a remplacées ou les listes d'origine)
    const lists = [...document.querySelectorAll('main span')].map((s) => {
      const f = fiberOf(s); const p = f && f.return && f.return.memoizedProps;
      return p && p.card && 'wikipedia_title' in p.card ? s.parentElement : null;
    }).filter(Boolean);
    const groups = new Map(); // conteneur des deux côtés -> [listes]
    for (const l of new Set(lists)) {
      const side = l.closest('.flex-1') || l.parentElement;
      const box = side && side.parentElement;
      if (!box) continue;
      if (!groups.has(box)) groups.set(box, []);
      groups.get(box).push({ list: l, label: (side.querySelector('p') || {}).textContent || '' });
    }
    for (const [box, sides] of groups) {
      let cmp = box.nextElementSibling && box.nextElementSibling.classList.contains('wmp-cmp') ? box.nextElementSibling : null;
      if (!S.tradeCompare) { if (cmp) cmp.remove(); continue; }
      const mine = sides.find((x) => /^Vous offrez/i.test(x.label.trim()));
      const theirs = sides.find((x) => x !== mine);
      if (!mine && !theirs) continue;
      const give = mine ? sideCards(mine.list) : [];
      const get = theirs ? sideCards(theirs.list) : [];
      const key = give.map((c) => c.id).join(',') + '|' + get.map((c) => c.id).join(',');
      if (!cmp) {
        cmp = document.createElement('div'); cmp.className = 'wmp-cmp';
        ['click', 'pointerdown', 'mousedown'].forEach((t) => cmp.addEventListener(t, (e) => e.stopPropagation()));
        box.after(cmp);
      }
      if (cmp.dataset.key === key && !cmp.dataset.dirty) continue;
      cmp.dataset.key = key; delete cmp.dataset.dirty;
      const info = tradeInfo(box);
      let wbGive = 0, wbGet = 0;
      if (info && info.trade) {
        const t = info.trade, iAmInit = t.initiator_id === info.me;
        wbGive = Number(iAmInit ? t.initiator_wikibidous : t.recipient_wikibidous) || 0;
        wbGet = Number(iAmInit ? t.recipient_wikibidous : t.initiator_wikibidous) || 0;
      }
      renderCmp(cmp, give, get, wbGive, wbGet, theirs ? theirs.label.replace(/\s*offre\s*$/i, '') : 'L’autre joueur');
    }
  }

  function sumSide(cards) {
    const r = {}; let atk = 0, def = 0;
    for (const c of cards) { r[c.rarity] = (r[c.rarity] || 0) + 1; atk += Number(c.atk) || 0; def += Number(c.def) || 0; }
    return { r, atk, def, n: cards.length };
  }
  function renderCmp(cmp, give, get, wbGive, wbGet, other, prices) {
    const A = sumSide(give), B = sumSide(get);
    const chips = (r) => RANKS.filter((k) => r[k]).map((k) => `<span class="chip" style="background:${RCOL[k]}">${r[k]} ${k}</span>`).join('');
    const own = owned();
    const last = hasOwnedData() ? give.filter((c) => (own.get(String(c.id)) || 0) <= 1) : null;
    const wish = wishlist();
    const wished = get.filter((c) => wish.has(String(c.id)));
    let valGive = null, valGet = null, approx = 0, unknown = 0;
    if (prices) {
      const val = (cards) => cards.reduce((s, c) => { const p = prices.get(String(c.id)); if (p && p.unknown) unknown++; else if (p && p.approx) approx++; return s + (p && p.v != null ? p.v : 0); }, 0);
      valGive = val(give) + wbGive; valGet = val(get) + wbGet;
    }
    const col = (title, S2, cards, wb, v) => `<div>
      <h4>${esc(title)}</h4>
      <div class="v">${S2.n} <small>carte${S2.n > 1 ? 's' : ''}</small>${wb ? ` <small>+ ${fmt(wb)} W</small>` : ''}</div>
      <div class="chips">${chips(S2.r)}</div>
      <div class="st">ATK ${fmt(S2.atk)} · DEF ${fmt(S2.def)}</div>
      ${v != null ? `<div class="st" style="margin-top:4px">Valeur marché ≈ <b style="color:#fde68a">${fmt(v)} W</b></div>` : ''}
    </div>`;
    let verdict = '';
    if (valGive != null && valGet != null) {
      const tot = valGive + valGet || 1;
      const diff = valGet - valGive;
      const pct = valGive ? Math.round((diff / valGive) * 100) : 0;
      verdict = `<div class="bal"><i style="width:${(valGive / tot) * 100}%;background:#f87171"></i><i style="width:${(valGet / tot) * 100}%;background:#34d399"></i></div>
        <div class="foot"><span class="verdict" style="color:${diff >= 0 ? '#34d399' : '#f87171'}">${diff >= 0 ? 'Échange en ta faveur' : 'Échange en ta défaveur'} (${diff >= 0 ? '+' : ''}${fmt(diff)} W${valGive ? `, ${pct >= 0 ? '+' : ''}${pct} %` : ''})</span>
        ${approx ? `<span class="note">${approx} carte${approx > 1 ? 's' : ''} sans vente récente : estimation par rareté.</span>` : ''}${unknown ? `<span class="note">${unknown} carte${unknown > 1 ? 's' : ''} sans aucun prix connu (non comptée${unknown > 1 ? 's' : ''}).</span>` : ''}</div>`;
    }
    cmp.innerHTML = `<div class="cols">${col('Tu donnes', A, give, wbGive, valGive)}<div class="mid">⇄</div>${col(`${other} donne`, B, get, wbGet, valGet)}</div>
      ${verdict}
      ${!prices ? `<div class="foot"><button class="est">Estimer la valeur marché</button><span class="note">Basé sur les ventes récentes du marché (${give.length + get.length} cartes à analyser)</span></div>` : ''}
      ${last && last.length ? `<div class="warn">⚠ Tu donnes ta dernière copie de : ${last.slice(0, 8).map((c) => esc(c.wikipedia_title)).join(', ')}${last.length > 8 ? ` et ${last.length - 8} autre${last.length - 8 > 1 ? 's' : ''}` : ''}</div>` : ''}
      ${last == null ? '<div class="note" style="margin-top:8px">Astuce : ouvre ta Collection (ou « Tout mettre en cache ») pour repérer les cartes dont tu donnes ta dernière copie.</div>' : ''}
      ${wished.length ? `<div class="warn" style="background:rgba(244,114,182,.12);border-color:rgba(244,114,182,.4);color:#fbcfe8">♥ Tu reçois ${wished.length} carte${wished.length > 1 ? 's' : ''} de ta liste de souhaits : ${wished.slice(0, 6).map((c) => esc(c.wikipedia_title)).join(', ')}</div>` : ''}`;
    const btn = cmp.querySelector('.est');
    if (btn) btn.addEventListener('click', () => estimate(cmp, give, get, wbGive, wbGet, other, btn));
  }

  async function estimate(cmp, give, get, wbGive, wbGet, other, btn) {
    const all = [...give, ...get];
    const ids = [...new Set(all.map((c) => String(c.id)))];
    const res = new Map();
    let done = 0;
    btn.disabled = true;
    const queue = [...ids];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try { res.set(id, await salesFor(id)); } catch (_) { res.set(id, null); }
        done++; btn.textContent = `Analyse du marché… ${done}/${ids.length}`;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const known = all.map((c) => ({ card: c, p: res.get(String(c.id)) && res.get(String(c.id)).m }));
    const fb = rarityFallback(known.concat(Object.entries(salesCache()).map(([id, e]) => ({ card: all.find((c) => String(c.id) === id) || {}, p: e.m })).filter((x) => x.card.rarity)));
    const prices = new Map();
    for (const c of all) {
      const e = res.get(String(c.id));
      if (e && e.m != null) prices.set(String(c.id), { v: e.m, approx: false });
      else if (fb[c.rarity] != null) prices.set(String(c.id), { v: fb[c.rarity], approx: true });
      else prices.set(String(c.id), { v: null, approx: true, unknown: true });
    }
    renderCmp(cmp, give, get, wbGive, wbGet, other, prices);
    // prix sur chaque mini-carte
    document.querySelectorAll('.wmp-mini[data-id]').forEach((m) => {
      const p = prices.get(m.dataset.id);
      if (!p) return;
      let t = m.querySelector('.wmp-price'); if (!t) { t = document.createElement('span'); t.className = 'wmp-price'; m.appendChild(t); }
      t.textContent = p.v == null ? '? W' : `${p.approx ? '~' : ''}${fmt(p.v)} W`;
      t.title = p.v == null ? 'Aucune vente connue' : p.approx ? 'Pas de vente récente : estimation par rareté' : 'Prix médian des ventes récentes';
    });
  }

  // ------------------------------------------------------------------
  //  Création d'un échange : estimation en direct des cartes ajoutées
  // ------------------------------------------------------------------
  const itemMap = new Map(); // id d'exemplaire (user_card) -> { card, user_id }
  const pricing = new Set();
  let myUid = null; try { myUid = localStorage.getItem('wmp_cache_uid'); } catch (_) {}
  function builderFiber() {
    const lab = [...document.querySelectorAll('p,span,div,h3')].find((x) => x.children.length === 0 && /^Sélectionnées/.test(x.textContent.trim()));
    if (!lab) return null;
    for (let f = fiberOf(lab), i = 0; f && i < 20; f = f.return, i++) {
      const p = f.memoizedProps;
      if (p && typeof p === 'object' && 'friendUsername' in p && 'onClose' in p) return { f, lab, props: p };
    }
    return null;
  }
  function hooks(f) { const out = []; let h = f.memoizedState, n = 0; while (h && typeof h === 'object' && 'next' in h && n++ < 120) { out.push(h.memoizedState); h = h.next; } return out; }
  // pour l'affichage sur la Collection, un prix de moins de 7 jours reste montré
  const priceShow = (id) => { const e = salesCache()[id]; return e && Date.now() - e.t < 7 * 24 * 3600 * 1000 ? e : null; };
  window.__wmpSales = { get: (id) => salesFor(id), cached: (id) => priceOf(id), shown: priceShow };
  function priceOf(id) { const e = salesCache()[id]; return e && Date.now() - e.t < SALES_TTL ? e : null; }
  function valueSide(cards, fb) {
    let v = 0, approx = 0, unknown = 0, pending = 0;
    for (const c of cards) {
      const e = priceOf(String(c.id));
      if (!e) { pending++; continue; }
      if (e.m != null) v += e.m;
      else if (fb[c.rarity] != null) { v += fb[c.rarity]; approx++; }
      else unknown++;
    }
    return { v, approx, unknown, pending };
  }
  function builder() {
    const b = builderFiber();
    let panel = document.querySelector('.wmp-build');
    if (!b || !S.tradeCompare) { if (panel) panel.remove(); return; }
    const hs = hooks(b.f);
    // 1) mémorise tous les exemplaires vus (tes cartes et celles de l'autre joueur)
    for (const v of hs) if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && v[0].card && v[0].id != null)
      for (const it of v) itemMap.set(String(it.id), { card: it.card, user_id: it.user_id });
    // 2) sélections : tableaux d'identifiants d'exemplaires connus
    const mine = [], theirs = [];
    const seen = new Set();
    for (const v of hs) {
      if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === 'string' && itemMap.has(x))) continue;
      for (const id of v) {
        if (seen.has(id)) continue; seen.add(id);
        const it = itemMap.get(id);
        const peer = b.props.friendProfileId;
        const isTheirs = peer ? it.user_id === peer : (myUid && it.user_id && it.user_id !== myUid);
        (isTheirs ? theirs : mine).push(it.card);
      }
    }
    // 3) wikibidous affichés dans le résumé
    const bar = [...document.querySelectorAll('span')].find((x) => /^\s*Moi\s*:/.test(x.textContent) && x.textContent.length < 80);
    const barBox = bar && bar.parentElement;
    let wbMine = 0, wbTheirs = 0;
    if (barBox) {
      const parts = barBox.textContent.split(/⇄|↔|⟷|⇆/);
      const wb = (t) => { const m = String(t || '').match(/(\d[\d\s  ]*)\s*WB/i); return m ? Number(m[1].replace(/\D/g, '')) : 0; };
      wbMine = wb(parts[0]); wbTheirs = wb(parts[1]);
    }
    // 4) prix : on estime chaque nouvelle carte dès qu'elle est ajoutée
    const need = [...mine, ...theirs].map((c) => String(c.id)).filter((id) => !priceOf(id) && !pricing.has(id));
    need.forEach((id) => { pricing.add(id); queueSale(id); });
    // 5) affichage
    if (!barBox) return;
    if (!panel) {
      panel = document.createElement('div'); panel.className = 'wmp-build';
      ['click', 'pointerdown', 'mousedown'].forEach((t) => panel.addEventListener(t, (e) => e.stopPropagation()));
    }
    if (panel.previousElementSibling !== barBox) barBox.after(panel);
    const known = Object.entries(salesCache()).map(([id, e]) => ({ card: (itemMap.get(id) || {}).card || [...mine, ...theirs].find((c) => String(c.id) === id) || {}, p: e.m })).filter((x) => x.card.rarity);
    const fb = rarityFallback(known);
    const A = valueSide(mine, fb), B = valueSide(theirs, fb);
    const tA = A.v + wbMine, tB = B.v + wbTheirs;
    const other = (b.props.friendUsername || 'L’autre joueur');
    const pend = A.pending + B.pending;
    const diff = tB - tA;
    const html = `
      <div class="side"><span class="lbl">Tu donnes</span><b>≈ ${fmt(tA)} W</b><small>${mine.length} carte${mine.length > 1 ? 's' : ''}${wbMine ? ` + ${fmt(wbMine)} WB` : ''}</small></div>
      <div class="mid">${mine.length || theirs.length ? (pend ? `<span class="spin"></span> ${pend} en cours` : `<span style="color:${diff >= 0 ? '#34d399' : '#f87171'}">${diff >= 0 ? '+' : ''}${fmt(diff)} W</span>`) : '⇄'}</div>
      <div class="side r"><span class="lbl">${esc(other)} donne</span><b>≈ ${fmt(tB)} W</b><small>${theirs.length} carte${theirs.length > 1 ? 's' : ''}${wbTheirs ? ` + ${fmt(wbTheirs)} WB` : ''}</small></div>
      ${A.approx + B.approx + A.unknown + B.unknown ? `<div class="n">${[A.approx + B.approx ? `${A.approx + B.approx} sans vente récente (estimée${A.approx + B.approx > 1 ? 's' : ''} par rareté)` : '', A.unknown + B.unknown ? `${A.unknown + B.unknown} sans prix connu (non comptée${A.unknown + B.unknown > 1 ? 's' : ''})` : ''].filter(Boolean).join(' · ')}</div>` : ''}`;
    if (panel.dataset.h !== html) { panel.dataset.h = html; panel.innerHTML = html; }
    // prix sur les cartes sélectionnées affichées
    const selBox = b.lab.parentElement;
    selBox && selBox.querySelectorAll('[class*="glow-"]').forEach((el) => {
      if (!/\brounded-2xl\b/.test(String(el.className))) return;
      const c = cardData(el); if (!c) return;
      const e = priceOf(String(c.id));
      let t = [...el.children].find((x) => x.classList && x.classList.contains('wmp-cprice'));
      const txt = !e ? '…' : e.m != null ? `≈ ${fmt(e.m)} W` : fb[c.rarity] != null ? `~ ${fmt(fb[c.rarity])} W` : '? W';
      if (!t) { t = document.createElement('span'); t.className = 'wmp-cprice'; el.appendChild(t); }
      if (t.textContent !== txt) t.textContent = txt;
    });
  }
  // file d'attente des ventes (3 à la fois)
  const saleQueue = []; let saleActive = 0;
  function queueSale(id) { saleQueue.push(id); pumpSales(); }
  function pumpSales() {
    while (saleActive < 3 && saleQueue.length) {
      const id = saleQueue.shift(); saleActive++;
      salesFor(id).catch(() => {}).finally(() => { saleActive--; pricing.delete(id); schedule(); pumpSales(); });
    }
  }

  // ------------------------------------------------------------------
  //  Balayage
  // ------------------------------------------------------------------
  function scan() {
    const p = path();
    const own = owned(), wish = wishlist();
    const mode = /^\/collection/.test(p) ? 'dup' : (/^\/(global-collection|marketplace|trades)/.test(p) ? 'have' : null);
    const wishPage = S.wishHighlight && /^\/(marketplace|trades)/.test(p);
    let wishCount = 0;
    document.querySelectorAll('main [class*="glow-"]').forEach((el) => {
      if (!/\brounded-2xl\b/.test(String(el.className))) return;
      const c = cardData(el); if (!c) return;
      const n = own.has(String(c.id)) ? own.get(String(c.id)) : null;
      ownBadge(el, mode ? n : null, mode);
      const w = wishPage && wish.has(String(c.id));
      wishMark(el, w); if (w) wishCount++;
      const wrap = el.closest('.relative.isolate.group');
      if (wrap) wrap.classList.toggle('wmp-dupcard', (n || 0) >= 2);
      if (mode === 'dup') collPrice(el, c);
    });
    document.querySelectorAll('.wmp-mini[data-id]').forEach((m) => {
      const id = m.dataset.id;
      ownBadge(m, own.has(id) ? own.get(id) : null, 'have');
      const side = m.closest('.flex-1'); const mineSide = side && /^\s*Vous offrez/i.test((side.querySelector('p') || {}).textContent || '');
      wishMark(m, S.wishHighlight && !mineSide && wish.has(id));
    });
    if (pillShown !== p) wishPill(wishCount);
    dupButton();
    comparators();
    builder();
    if (S.wishHighlight && /^\/(marketplace|trades|global-collection)/.test(p)) refreshWishlist();
  }
  let t = null;
  function schedule(force) {
    if (force) document.querySelectorAll('.wmp-cmp').forEach((c) => { if (!c.querySelector('.wmp-price, .verdict')) c.dataset.dirty = '1'; });
    clearTimeout(t); t = setTimeout(scan, 250);
  }
  const ours = (n) => n && n.nodeType === 1 && (['wmp-own', 'wmp-wish-tag', 'wmp-cmp', 'wmp-price', 'wmp-build', 'wmp-cprice'].some((c) => n.classList.contains(c)) || (n.closest && n.closest('.wmp-cmp, .wmp-build')));
  new MutationObserver((muts) => {
    if (muts.every((m) => ours(m.target) || [...m.addedNodes].every(ours))) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scan, 4000);
  schedule();
})();
