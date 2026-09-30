// Barre de tags rapide pendant le révélé des cartes.
// Tourne dans le contexte de la page pour réutiliser le client Supabase du site
// (même session, mêmes requêtes que l'éditeur de tags du site). Aucune action sans clic ou touche de ta part.
(() => {
  if (window.__wmPlusTags) return;
  window.__wmPlusTags = true;

  let enabled = true;
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.__wmPlusSettings) {
      enabled = e.data.__wmPlusSettings.tagBar !== false;
      if (!enabled) hide();
    }
  });

  const isClient = (v) => v && typeof v === 'object' && typeof v.from === 'function' && v.auth;
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const PALETTE = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c'];
  function hex(c) {
    if (!c) return '#34d399';
    let t = String(c).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(t)) t = t.split('').map((x) => x + x).join('');
    return /^[0-9a-f]{6}$/i.test(t) ? '#' + t.toLowerCase() : '#34d399';
  }

  // ---------- Accès au composant de révélé du site ----------
  function revealFiber() {
    const el = document.querySelector('main [class*="animate-card-flip"]');
    if (!el) return null;
    const k = Object.keys(el).find((x) => x.startsWith('__reactFiber'));
    let f = k && el[k];
    for (let i = 0; i < 40 && f; i++, f = f.return) {
      const p = f.memoizedProps;
      if (p && Array.isArray(p.cards) && 'ownedCopies' in p) return f;
    }
    return null;
  }
  let client = null;
  function findClient(f) {
    if (client) return client;
    for (let g = f, i = 0; g && i < 60; g = g.return, i++) {
      const mc = g.updateQueue && g.updateQueue.memoCache;
      if (mc && mc.data) for (const arr of mc.data) if (arr) for (const v of arr) if (isClient(v)) return (client = v);
      let h = g.memoizedState, n = 0;
      while (h && typeof h === 'object' && 'next' in h && n++ < 100) {
        const ms = h.memoizedState;
        if (isClient(ms)) return (client = ms);
        if (ms && typeof ms === 'object' && isClient(ms.current)) return (client = ms.current);
        h = h.next;
      }
    }
    return null;
  }

  // ---------- Données ----------
  let uid = null;
  let tags = null;              // catalogue de tes tags
  let packKey = null;           // identifie le paquet en cours
  let copies = {};              // card_id -> { id, tagIds:Set }
  let loading = false, error = null;

  async function getUid(c) {
    if (uid) return uid;
    try { const { data } = await c.auth.getSession(); uid = data && data.session && data.session.user && data.session.user.id; } catch (_) {}
    if (!uid) { try { const { data } = await c.auth.getUser(); uid = data && data.user && data.user.id; } catch (_) {} }
    if (uid) window.postMessage({ __wmPlusUser: uid }, location.origin);
    return uid;
  }

  // Catalogue de tags gardé en cache local : affichage instantané, rafraîchi en arrière-plan
  const cacheKey = (me) => 'wmp_tags_' + me;
  function readCache(me) { try { const v = JSON.parse(localStorage.getItem(cacheKey(me)) || 'null'); return Array.isArray(v) ? v : null; } catch (_) { return null; } }
  function writeCache(me) { try { localStorage.setItem(cacheKey(me), JSON.stringify(tags || [])); } catch (_) {} }
  // Ordre personnalisé des tags (réglable par glisser-déposer ici ou dans l'onglet WikiMasters+ du site)
  const orderKey = (me) => 'wmp_tag_order_' + me;
  function readOrder() { try { const v = JSON.parse(localStorage.getItem(orderKey(uid)) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch (_) { return []; } }
  function saveOrder(ids) { try { localStorage.setItem(orderKey(uid), JSON.stringify(ids.map(String))); } catch (_) {} }
  const sortTags = (list) => {
    const ord = uid ? readOrder() : [];
    const pos = (t) => { const i = ord.indexOf(String(t.id)); return i < 0 ? 1e6 : i; };
    return list.sort((a, b) => (pos(a) - pos(b)) || String(a.name).localeCompare(String(b.name), 'fr'));
  };
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.__wmPlusTagOrder && tags) { sortTags(tags); render(); }
  });
  const tagIdsOf = (u) => new Set((u.user_card_tags || []).map((t) => t.tag_id ?? (t.tag && t.tag.id)).filter((x) => x != null));

  function pickCopies(cards, rows) {
    const out = {};
    for (const card of cards) {
      const mine = rows.filter((u) => u.card_id === card.id);
      // même règle que le site : la copie dont l'état shiny correspond à la carte tirée
      const u = mine.find((x) => !!x.is_shiny === !!card.is_shiny) || mine[0];
      if (u) out[card.id] = { id: u.id, tagIds: tagIdsOf(u) };
    }
    return out;
  }

  let tagsFresh = false;
  async function loadPack(c, cards, owned) {
    error = null;
    try {
      const me = await getUid(c); // lu localement, pas de requête réseau
      if (!me) throw new Error('session introuvable');
      if (!tags) { tags = readCache(me); if (tags) sortTags(tags); }

      // Les exemplaires (et leurs tags) sont déjà fournis par le site avec le paquet : aucune requête
      const haveOwned = Array.isArray(owned) && owned.length && owned.every((u) => u && 'user_card_tags' in u);
      copies = haveOwned ? pickCopies(cards, owned) : {};
      loading = !tags || !haveOwned;
      render();

      const jobs = [];
      if (!tagsFresh) jobs.push(c.from('tags').select('*').eq('user_id', me).then(({ data, error: e }) => {
        if (e) throw e;
        tags = sortTags(data || []); tagsFresh = true; writeCache(me);
      }));
      if (!haveOwned) {
        const ids = [...new Set(cards.map((x) => x.id))];
        jobs.push(c.from('user_cards').select('id, card_id, is_shiny, user_card_tags(tag_id)').eq('user_id', me).in('card_id', ids).then(({ data, error: e }) => {
          if (e) throw e;
          copies = pickCopies(cards, data || []);
        }));
      }
      if (jobs.length) { await Promise.all(jobs); }
    } catch (e) {
      if (!tags) error = 'Impossible de charger tes tags';
      console.warn('[WikiMasters+] tags', e);
    }
    loading = false; render();
  }

  async function toggle(tag) {
    if (!client || !cur) return;
    const copy = copies[cur.id];
    if (!copy) return;
    const on = copy.tagIds.has(tag.id);
    on ? copy.tagIds.delete(tag.id) : copy.tagIds.add(tag.id);
    render(tag.id);
    const q = on
      ? client.from('user_card_tags').delete().eq('user_card_id', copy.id).eq('tag_id', tag.id)
      : client.from('user_card_tags').insert({ user_card_id: copy.id, tag_id: tag.id });
    const { error: e } = await q;
    if (e) { on ? copy.tagIds.add(tag.id) : copy.tagIds.delete(tag.id); flashError('Échec, réessaie'); render(); }
  }

  async function createTag(name) {
    name = name.trim();
    if (!name || name.length > 48 || !client || !uid) return;
    const existing = (tags || []).find((t) => String(t.name).trim().toLowerCase() === name.toLowerCase());
    if (existing) { if (!copies[cur.id] || !copies[cur.id].tagIds.has(existing.id)) toggle(existing); return; }
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const { data, error: e } = await client.from('tags').insert({ user_id: uid, name, color }).select('*').single();
    if (e || !data) { flashError('Tag non créé'); return; }
    tags.push(data);
    sortTags(tags);
    writeCache(uid);
    toggle(data);
  }

  // ---------- Interface ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147482990;top:0;left:0;display:none';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
  <style>
    :host{all:initial}
    .p{width:250px;max-height:min(460px,calc(100vh - 32px));display:flex;flex-direction:column;box-sizing:border-box;
      background:linear-gradient(180deg,rgba(30,35,33,.86),rgba(15,18,17,.9));border:.8px solid rgba(200,208,203,.14);border-radius:16px;
      box-shadow:0 14px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(10px);
      color:#f2f4f3;font:13px/1.35 var(--font-heading,system-ui),system-ui,-apple-system,"Segoe UI",sans-serif;
      animation:in .25s cubic-bezier(.2,.9,.3,1.2)}
    @keyframes in{from{opacity:0;transform:translateX(-10px)}}
    .h{display:flex;justify-content:space-between;align-items:center;padding:11px 12px 8px}
    .h b{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(242,244,243,.6)}
    .h span{font-size:11px;color:rgba(242,244,243,.4);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .l{overflow:auto;padding:0 8px 6px;display:flex;flex-direction:column;gap:3px}
    .t .g{color:rgba(242,244,243,.25);font-size:11px;letter-spacing:-2px;cursor:grab;margin-right:-2px}
    .t:hover .g{color:rgba(242,244,243,.55)}
    .t.drag{opacity:.45}
    .t{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border-radius:9px;cursor:pointer;
      border:.8px solid transparent;transition:background .15s,border-color .15s,transform .1s}
    .t:hover{background:rgba(255,255,255,.05)}
    .t:active{transform:scale(.98)}
    .t .d{width:10px;height:10px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 22%,transparent);flex:none}
    .t .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .t .k{font:600 10px/1.5 ui-monospace,monospace;color:rgba(242,244,243,.35);border:.8px solid rgba(255,255,255,.12);border-radius:4px;padding:0 4px}
    .t .c{width:16px;height:16px;border-radius:5px;border:.8px solid rgba(255,255,255,.2);display:grid;place-items:center;font-size:11px;color:transparent;flex:none}
    .t.on{background:color-mix(in srgb,var(--c) 16%,transparent);border-color:color-mix(in srgb,var(--c) 45%,transparent)}
    .t.on .c{background:var(--c);border-color:transparent;color:#0c0d0c}
    .t.pop{animation:pop .3s}
    @keyframes pop{50%{transform:scale(1.04)}}
    .add{display:flex;gap:6px;padding:8px 10px 10px;border-top:.8px solid rgba(200,208,203,.08)}
    .add input{all:unset;flex:1;min-width:0;padding:6px 9px;border-radius:8px;background:rgba(255,255,255,.05);border:.8px solid rgba(255,255,255,.1);font-size:12px;color:#f2f4f3}
    .add input:focus{border-color:rgba(52,211,153,.6)}
    .msg{padding:6px 12px 12px;font-size:12px;color:rgba(242,244,243,.5)}
    .err{color:#fca5a5}
  </style>
  <div class="p"><div class="h"><b>Tags</b><span></span></div><div class="l"></div><div class="msg"></div>
  <div class="add"><input maxlength="48" placeholder="Nouveau tag + Entrée"></div></div>`;
  (document.body || document.documentElement).appendChild(host);
  const $ = (s) => root.querySelector(s);
  const input = $('.add input');
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // pour que Espace s'écrive dans le champ
    if (e.key === 'Enter') { createTag(input.value); input.value = ''; }
    if (e.key === 'Escape') input.blur();
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  let errTimer = null;
  function flashError(t) { const m = $('.msg'); m.textContent = t; m.className = 'msg err'; clearTimeout(errTimer); errTimer = setTimeout(render, 2000); }

  let cur = null;
  let dragging = null;
  function render(popId) {
    if (dragging) return;
    if (!cur) return;
    $('.h span').textContent = cur.wikipedia_title || '';
    const list = $('.l'), msg = $('.msg');
    msg.className = 'msg';
    if (loading) { list.innerHTML = ''; msg.textContent = 'Chargement…'; return; }
    if (error) { list.innerHTML = ''; msg.textContent = error; return; }
    const copy = copies[cur.id];
    if (!copy) { list.innerHTML = ''; msg.textContent = 'Copie introuvable pour cette carte'; return; }
    msg.textContent = tags && tags.length ? '' : 'Tu n’as pas encore de tags, crée le premier ci-dessous';
    list.innerHTML = (tags || []).map((t, i) => {
      const on = copy.tagIds.has(t.id);
      return `<button class="t${on ? ' on' : ''}${popId === t.id ? ' pop' : ''}" data-id="${esc(t.id)}" draggable="true" style="--c:${hex(t.color)}">
        <span class="g" title="Glisser pour réordonner">⋮⋮</span><span class="c">✓</span><span class="d"></span><span class="n">${esc(t.name)}</span>${i < 9 ? `<span class="k">${i + 1}</span>` : ''}</button>`;
    }).join('');
    list.querySelectorAll('.t').forEach((b) => {
      b.onclick = () => { if (dragging) return; const t = tags.find((x) => String(x.id) === b.dataset.id); if (t) toggle(t); };
      b.addEventListener('dragstart', (e) => { dragging = b; b.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', b.dataset.id); } catch (_) {} });
      b.addEventListener('dragend', () => {
        b.classList.remove('drag');
        const ids = [...list.querySelectorAll('.t')].map((x) => x.dataset.id);
        saveOrder(ids); sortTags(tags); writeCache(uid);
        setTimeout(() => { dragging = null; render(); }, 0);
      });
      b.addEventListener('dragover', (e) => {
        if (!dragging || dragging === b) return;
        e.preventDefault();
        const r = b.getBoundingClientRect();
        list.insertBefore(dragging, e.clientY < r.top + r.height / 2 ? b : b.nextSibling);
      });
    });
  }

  function hide() { host.style.display = 'none'; cur = null; }

  function place() {
    const flip = document.querySelector('main [class*="animate-card-flip"]');
    if (!flip) return;
    const r = (flip.parentElement || flip).getBoundingClientRect();
    const w = 250, gap = 48;
    let left = r.right + gap;
    if (left + w > innerWidth - 12) left = Math.max(12, r.left - gap - w);
    host.style.left = left + 'px';
    host.style.top = Math.max(16, Math.min(r.top, innerHeight - 16 - host.getBoundingClientRect().height)) + 'px';
  }

  // Boucle légère : suit la carte affichée
  setInterval(() => {
    if (!enabled) return;
    const f = revealFiber();
    if (!f) { if (cur) { hide(); packKey = null; } return; }
    const c = findClient(f);
    if (!c) return; // client pas trouvé : on n'affiche rien plutôt qu'une barre inutile
    const { cards, ownedCopies } = f.memoizedProps;
    const key = cards.map((x) => x.id).join('|');
    const counter = [...document.querySelectorAll('main span')].find((s) => s.previousElementSibling && s.previousElementSibling.textContent.trim() === 'Carte');
    const idx = counter ? parseInt(counter.textContent, 10) - 1 : 0;
    const card = cards[idx] || cards[0];
    // fenêtre du site ouverte par-dessus (détail de la carte) : on se cache
    const modal = [...document.body.children].some((el) => { const c = typeof el.className === 'string' ? el.className : ''; return /\bfixed\b/.test(c) && /\binset-0\b/.test(c) && el.getBoundingClientRect().width > 0; });
    host.style.display = modal ? 'none' : '';
    if (key !== packKey) { packKey = key; cur = card; loadPack(c, cards, ownedCopies); }
    else if (!cur || cur.id !== card.id) { cur = card; render(); }
    place();
  }, 150);

  // Raccourcis 1 à 9 pendant le révélé
  document.addEventListener('keydown', (e) => {
    if (!enabled || !cur || host.style.display === 'none' || e.ctrlKey || e.metaKey || e.altKey) return;
    const sp = document.getElementById('wmp-settings'); if (sp && sp.style.display !== 'none') return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && tags && tags[n - 1]) { e.preventDefault(); toggle(tags[n - 1]); }
  }, true);
})();
