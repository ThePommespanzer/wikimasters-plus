// Onglet « WikiMasters+ » ajouté au menu du site : tous les réglages de l'extension,
// l'ordre des tags pour la barre du révélé, et la gestion des données.
(() => {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M12 8.5l1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z"/></svg>';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  // ------------------------------------------------------------------
  //  Lien dans le menu du site (barre latérale et menu mobile « Plus »)
  // ------------------------------------------------------------------
  function addLinks() {
    document.querySelectorAll('a[href="/settings"]').forEach((ref) => {
      const next = ref.nextElementSibling;
      if (next && next.classList.contains('wmp-nav-link')) return;
      const a = document.createElement('a');
      a.href = '#wikimasters-plus';
      a.className = ref.className + ' wmp-nav-link';
      const iconWrap = ref.firstElementChild && ref.firstElementChild.tagName === 'SPAN' ? ref.firstElementChild.cloneNode(false) : document.createElement('span');
      iconWrap.innerHTML = ICON;
      a.appendChild(iconWrap);
      a.appendChild(document.createTextNode('WikiMasters+'));
      a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(); });
      ref.after(a);
    });
  }
  new MutationObserver(() => { if (document.querySelector('a[href="/settings"]')) addLinks(); })
    .observe(document.documentElement, { childList: true, subtree: true });
  addLinks();

  // ------------------------------------------------------------------
  //  Page de réglages (Shadow DOM, par-dessus le site)
  // ------------------------------------------------------------------
  let host = null, root = null;
  const $ = (q) => root.querySelector(q);

  const SECTIONS = [
    ['Ouverture des paquets', [
      ['restyle', 'Nouvelle interface d’ouverture et de révélé'],
      ['effects', 'Effets visuels selon la rareté'],
      ['sound', 'Jingle sonore'],
      ['summary', 'Récap du paquet à la fin du révélé'],
      ['spaceKey', 'Touche Espace pour ouvrir et passer les cartes']
    ]],
    ['Cartes', [
      ['cardTools', 'Boutons Wikipédia, Letterboxd, plein écran et copie'],
      ['freeImages', 'Image libre pour les cartes sans image'],
      ['tradeCards', 'Cartes visibles dans les échanges'],
      ['compactToggle', 'Bouton vue compacte (Collection, Toutes les cartes)']
    ]],
    ['Page et onglet', [
      ['pagePanel', 'Panneau de statistiques sur la page des paquets'],
      ['tabTitle', 'Compteur de paquets dans le titre de l’onglet']
    ]]
  ];

  function build() {
    host = document.createElement('div');
    host.id = 'wmp-settings';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483300;display:none';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      .bg{position:fixed;inset:0;background:rgba(5,6,5,.72);backdrop-filter:blur(6px);animation:f .2s}
      @keyframes f{from{opacity:0}}
      .page{position:fixed;inset:max(16px,4vh) max(12px,calc(50vw - 480px));background:#0f1211;border:.8px solid rgba(200,208,203,.14);border-radius:20px;
        box-shadow:0 30px 90px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;color:#f2f4f3;
        font:14px/1.45 var(--font-heading,system-ui),system-ui,-apple-system,"Segoe UI",sans-serif;animation:u .25s cubic-bezier(.2,.9,.3,1.1)}
      @keyframes u{from{opacity:0;transform:translateY(12px)}}
      header{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:.8px solid rgba(200,208,203,.1)}
      header h1{margin:0;font-size:20px;font-weight:700;flex:1}
      header h1 small{display:block;font-size:12px;font-weight:400;color:rgba(242,244,243,.45)}
      .x{all:unset;cursor:pointer;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:rgba(242,244,243,.6);background:rgba(255,255,255,.05)}
      .x:hover{background:rgba(255,255,255,.1);color:#fff}
      .body{overflow:auto;padding:18px 22px 26px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-content:start}
      .card{background:rgba(255,255,255,.03);border:.8px solid rgba(200,208,203,.1);border-radius:14px;padding:14px 16px}
      h2{margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(242,244,243,.5)}
      label.sw{display:flex;align-items:center;gap:12px;padding:7px 0;cursor:pointer}
      label.sw span{flex:1}
      input[type=checkbox]{appearance:none;width:36px;height:20px;border-radius:99px;background:rgba(255,255,255,.12);position:relative;cursor:pointer;flex:none;transition:background .15s;margin:0}
      input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
      input[type=checkbox]:checked{background:#34d399}
      input[type=checkbox]:checked::after{transform:translateX(16px)}
      .row{display:flex;align-items:center;gap:8px;padding:7px 0;flex-wrap:wrap}
      .num,select{background:#171b1a;color:#f2f4f3;border:.8px solid rgba(255,255,255,.14);border-radius:8px;padding:4px 8px;font:inherit}
      .num{width:58px}
      .hint{font-size:12px;color:rgba(242,244,243,.45);margin:6px 0 0}
      .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .btn{all:unset;cursor:pointer;padding:8px 12px;border-radius:9px;background:rgba(255,255,255,.07);border:.8px solid rgba(255,255,255,.14);font-weight:600;font-size:13px}
      .btn:hover{background:rgba(255,255,255,.12)}
      .btn.danger{color:#fca5a5}
      .btn.ok{background:#16a34a;border-color:transparent;color:#fff}
      .tags{display:flex;flex-direction:column;gap:4px;margin-top:6px}
      .tag{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.04);border:.8px solid rgba(255,255,255,.06);cursor:grab;user-select:none}
      .tag.drag{opacity:.4}
      .tag .g{color:rgba(242,244,243,.3);letter-spacing:-2px}
      .tag .d{width:10px;height:10px;border-radius:50%;flex:none}
      .tag .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tag kbd{font:600 11px/1.5 ui-monospace,monospace;padding:0 6px;border-radius:5px;border:.8px solid rgba(255,255,255,.2);color:rgba(242,244,243,.7)}
      .tag .mv{all:unset;cursor:pointer;width:24px;height:24px;border-radius:6px;display:grid;place-items:center;color:rgba(242,244,243,.5)}
      .tag .mv:hover{background:rgba(255,255,255,.08);color:#fff}
      .empty{color:rgba(242,244,243,.45);font-size:13px;padding:6px 0}
      .span2{grid-column:1/-1}
      @media (max-width:640px){.page{inset:0;border-radius:0}.body{grid-template-columns:1fr}}
    </style>
    <div class="bg"></div>
    <div class="page" role="dialog" aria-label="Réglages WikiMasters+">
      <header><h1>WikiMasters+<small>Réglages de l’extension (extension non officielle)</small></h1><button class="x" title="Fermer">✕</button></header>
      <div class="body"></div>
    </div>`;
    document.documentElement.appendChild(host);
    $('.bg').addEventListener('click', close);
    $('.x').addEventListener('click', close);
    root.addEventListener('keydown', (e) => e.stopPropagation(), true);
  }

  let settings = { ...WM.DEFAULTS };
  async function render() {
    const d = await chrome.storage.local.get(['settings', 'cacheStats', 'pulls']);
    settings = { ...WM.DEFAULTS, ...(d.settings || {}) };
    const sw = (k, label) => `<label class="sw"><input type="checkbox" data-k="${k}" ${settings[k] ? 'checked' : ''}><span>${esc(label)}</span></label>`;
    const cs = d.cacheStats;
    const kb = cs ? cs.bytes / 1024 : 0;
    $('.body').innerHTML = `
      <div class="card span2">
        <h2>Ordre des tags pendant le révélé</h2>
        ${sw('tagBar', 'Afficher la barre de tags à côté de la carte')}
        <p class="hint">Glisse les tags pour les réordonner. Les 9 premiers ont un raccourci clavier (1 à 9) pendant le révélé.</p>
        <div class="tags"></div>
      </div>
      ${SECTIONS.map(([title, items]) => `<div class="card"><h2>${esc(title)}</h2>${items.map(([k, l]) => sw(k, l)).join('')}</div>`).join('')}
      <div class="card">
        <h2>Alertes</h2>
        <label class="sw"><input type="checkbox" data-k="notifyFull" ${settings.notifyFull ? 'checked' : ''}><span>Notifier à <input class="num" type="number" min="1" max="10" data-k="threshold" value="${settings.threshold}"> paquets</span></label>
        <label class="sw"><input type="checkbox" data-k="proReminder" ${settings.proReminder ? 'checked' : ''}><span>Rappel du pack PRO à <input class="num" type="number" min="0" max="23" data-k="proHour" value="${settings.proHour}"> h</span></label>
        <div class="row"><span style="flex:1">Régénération des paquets</span>
          <select data-k="regenMode">
            <option value="auto" ${settings.regenMode === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="normal" ${settings.regenMode === 'normal' ? 'selected' : ''}>Normal (10 min)</option>
            <option value="pro" ${settings.regenMode === 'pro' ? 'selected' : ''}>PRO (3 min)</option>
          </select></div>
      </div>
      <div class="card">
        <h2>Cache</h2>
        ${sw('cache', 'Cache local (collection, tags, cartes, amis, profils)')}
        <p class="hint">Affichage instantané, mise à jour automatique. Jamais pour les échanges, le marché ou les paquets. ${cs ? `Actuellement ${cs.entries} réponses, ${kb > 1024 ? (kb / 1024).toFixed(1) + ' Mo' : Math.round(kb) + ' Ko'}.` : ''}</p>
        <div class="btns"><button class="btn" data-a="clear">Vider le cache</button></div>
      </div>
      <div class="card">
        <h2>Données</h2>
        <p class="hint">${(d.pulls || []).length} paquets enregistrés dans ton navigateur.</p>
        <div class="btns"><button class="btn" data-a="csv">Exporter en CSV</button><button class="btn danger" data-a="reset">Réinitialiser les stats</button></div>
      </div>`;
    renderTags();
  }

  // ---------- Réglages ----------
  async function saveSetting(el) {
    const { settings: cur } = await chrome.storage.local.get('settings');
    const s = { ...WM.DEFAULTS, ...(cur || {}) };
    const k = el.dataset.k;
    if (el.type === 'checkbox') s[k] = el.checked;
    else if (el.type === 'number') s[k] = Math.min(+el.max, Math.max(+el.min, parseInt(el.value, 10) || +el.min));
    else s[k] = el.value;
    await chrome.storage.local.set({ settings: s });
  }

  // ---------- Ordre des tags ----------
  const uid = () => { try { return localStorage.getItem('wmp_cache_uid'); } catch (_) { return null; } };
  function tagData() {
    const u = uid(); if (!u) return null;
    let tags = null, order = [];
    try { tags = JSON.parse(localStorage.getItem('wmp_tags_' + u) || 'null'); } catch (_) {}
    try { order = JSON.parse(localStorage.getItem('wmp_tag_order_' + u) || '[]').map(String); } catch (_) {}
    if (!Array.isArray(tags)) return null;
    const pos = (t) => { const i = order.indexOf(String(t.id)); return i < 0 ? 1e6 : i; };
    tags.sort((a, b) => (pos(a) - pos(b)) || String(a.name).localeCompare(String(b.name), 'fr'));
    return { u, tags };
  }
  function color(c) {
    let t = String(c || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(t)) t = t.split('').map((x) => x + x).join('');
    return /^[0-9a-f]{6}$/i.test(t) ? '#' + t : '#34d399';
  }
  function saveOrder(u, ids) {
    try { localStorage.setItem('wmp_tag_order_' + u, JSON.stringify(ids)); } catch (_) {}
    window.postMessage({ __wmPlusTagOrder: true }, location.origin);
  }
  function renderTags() {
    const box = $('.tags');
    const td = tagData();
    if (!td) { box.innerHTML = '<div class="empty">Ouvre un paquet une fois pour que l’extension récupère ta liste de tags.</div>'; return; }
    if (!td.tags.length) { box.innerHTML = '<div class="empty">Tu n’as pas encore de tags.</div>'; return; }
    box.innerHTML = td.tags.map((t, i) => `<div class="tag" draggable="true" data-id="${esc(t.id)}">
      <span class="g">⋮⋮</span><span class="d" style="background:${color(t.color)}"></span><span class="n">${esc(t.name)}</span>
      ${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}
      <button class="mv" data-m="-1" title="Monter">▲</button><button class="mv" data-m="1" title="Descendre">▼</button></div>`).join('');
    const commit = () => { saveOrder(td.u, [...box.querySelectorAll('.tag')].map((x) => x.dataset.id)); renderTags(); };
    let drag = null;
    box.querySelectorAll('.tag').forEach((el) => {
      el.addEventListener('dragstart', (e) => { drag = el; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', el.dataset.id); } catch (_) {} });
      el.addEventListener('dragend', () => { el.classList.remove('drag'); drag = null; commit(); });
      el.addEventListener('dragover', (e) => {
        if (!drag || drag === el) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        box.insertBefore(drag, e.clientY < r.top + r.height / 2 ? el : el.nextSibling);
      });
      el.querySelectorAll('.mv').forEach((b) => b.addEventListener('click', () => {
        const dir = +b.dataset.m;
        if (dir < 0 && el.previousElementSibling) box.insertBefore(el, el.previousElementSibling);
        if (dir > 0 && el.nextElementSibling) box.insertBefore(el.nextElementSibling, el);
        commit();
      }));
    });
  }

  // ---------- Actions ----------
  async function action(a, btn) {
    if (a === 'clear') {
      await chrome.storage.local.set({ cacheClearReq: Date.now(), cacheStats: { entries: 0, bytes: 0, at: Date.now() } });
      btn.textContent = 'Cache vidé'; btn.classList.add('ok');
    }
    if (a === 'csv') {
      const { pulls = [] } = await chrome.storage.local.get('pulls');
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['date', 'source', 'id', 'nom', 'rarete', 'shiny', 'exemplaires']];
      pulls.forEach((p) => p.cards.forEach((c) => rows.push([new Date(p.t).toISOString(), p.src, c.id, c.name, c.r, c.s ? 1 : 0, c.o])));
      const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv' });
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `wikimasters-tirages-${WM.today()}.csv` });
      link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    }
    if (a === 'reset') {
      if (!confirm('Effacer tout l’historique de tirages enregistré par l’extension ?')) return;
      await chrome.storage.local.set({ pulls: [] });
      render();
    }
  }

  function open() {
    if (!host) {
      build();
      root.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.k) saveSetting(e.target); });
      root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-a]'); if (b) action(b.dataset.a, b); });
    }
    host.style.display = '';
    render();
    addEventListener('keydown', onKey, true);
  }
  function close() {
    if (host) host.style.display = 'none';
    removeEventListener('keydown', onKey, true);
    if (location.hash === '#wikimasters-plus') history.replaceState(null, '', location.pathname + location.search);
  }
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  if (location.hash === '#wikimasters-plus') setTimeout(open, 300);
})();
