// Tourne dans le contexte de la page, avant les scripts du site.
// 1) Observe les réponses d'ouverture de paquets (lecture seule).
// 2) Cache local des données lentes et peu changeantes (collection, tags, cartes, amis) :
//    réponse immédiate depuis le cache puis mise à jour en arrière-plan.
//    Les échanges, le marché, les paquets, le profil et les messages ne sont JAMAIS mis en cache,
//    et toute écriture (POST, PATCH, DELETE…) vide le cache pour ne jamais afficher un état dépassé.
(() => {
  if (window.__wmPlusHooked) return;
  window.__wmPlusHooked = true;

  const WATCH = ['/api/packs/open', '/api/packs/special', '/api/packs/pro-daily', '/api/packs/grace'];
  const origFetch = window.fetch;
  const post = (msg) => { try { window.postMessage(msg, location.origin); } catch (_) {} };

  // ------------------------------------------------------------------
  //  Règles de cache
  // ------------------------------------------------------------------
  let cacheOn = true;
  // Durée de validité : longue pour la collection et les tags (le cache est vidé à chaque modification
  // et la page se met à jour d'elle-même si quelque chose a changé ailleurs), courte pour le reste.
  const AGE_LONG = 12 * 3600 * 1000, AGE_SHORT = 30 * 60 * 1000;
  const ageFor = (url) => /\/api\/my-collection|\/rest\/v1\/(tags|user_card_tags|cards)\b/.test(url) ? AGE_LONG : AGE_SHORT;
  const SITE_API = /^\/api\/(my-collection|friends)(\/|$)/;
  const SB_TABLES = /^(user_cards|tags|user_card_tags|cards|friend\w*)$/;
  // Profils : chargés avant chaque page (≈3 s). Mis en cache partout sauf sur la page des paquets
  // (compteur de paquets), et sans rechargement automatique (statuts en ligne qui changent souvent).
  const SB_QUIET = /^profiles$/;
  const NO_INVALIDATE = /\/rest\/v1\/rpc\/sync_profile_packs|\/api\/notifications/; // appels de service sans effet sur ces données

  function classify(url) {
    let u;
    try { u = new URL(url, location.href); } catch (_) { return null; }
    if (u.origin === location.origin) return SITE_API.test(u.pathname) ? 'site' : null;
    if (/\.supabase\.co$/.test(u.hostname)) {
      const m = u.pathname.match(/^\/rest\/v1\/([^/]+)$/);
      if (!m) return null;
      if (SB_TABLES.test(m[1])) return 'sb';
      if (SB_QUIET.test(m[1]) && !location.pathname.startsWith('/pulls')) return 'quiet';
    }
    return null;
  }
  function isApiWrite(url) {
    try {
      const u = new URL(url, location.href);
      if (NO_INVALIDATE.test(u.pathname)) return false;
      if (u.origin === location.origin) return true; // API du site et actions serveur Next
      return /\.supabase\.co$/.test(u.hostname) && u.pathname.startsWith('/rest/v1/');
    } catch (_) { return false; }
  }
  function headerVal(h, name) {
    if (!h) return '';
    if (h instanceof Headers) return h.get(name) || '';
    if (Array.isArray(h)) { const e = h.find(([k]) => k.toLowerCase() === name); return e ? e[1] : ''; }
    const k = Object.keys(h).find((x) => x.toLowerCase() === name);
    return k ? String(h[k]) : '';
  }

  // ------------------------------------------------------------------
  //  Stockage IndexedDB (dans l'origine du site, local à ton navigateur)
  // ------------------------------------------------------------------
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      try { indexedDB.deleteDatabase('wmplus-cache'); } catch (_) {} // ancienne version (clé incomplète)
      const r = indexedDB.open('wmplus-cache-v2', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('r');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }).catch(() => null);
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db(); if (!d) return null;
    return new Promise((res) => {
      try {
        const tx = d.transaction('r', mode); const st = tx.objectStore('r');
        const req = fn(st);
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = tx.onabort = () => res(null);
      } catch (_) { res(null); }
    });
  }
  const cget = (k) => idb('readonly', (s) => s.get(k));
  const cput = (k, v) => idb('readwrite', (s) => s.put(v, k));
  // vide le cache des réponses (les données de la vue liste, préfixées « wmp: », restent)
  async function cclear(reason) {
    await idb('readwrite', (s) => {
      if (reason === 'all') { listMem = null; imgMem = null; return s.clear(); }
      const req = s.openCursor();
      req.onsuccess = () => { const c = req.result; if (!c) return; if (!String(c.key).startsWith('wmp:')) c.delete(); c.continue(); };
      return req;
    });
    stats();
  }
  async function stats() {
    const all = await idb('readonly', (s) => s.getAll());
    const list = all || [];
    post({ __wmPlusCacheStats: { entries: list.length, bytes: list.reduce((n, e) => n + (e.body ? e.body.length : 0), 0) } });
  }

  const inflight = new Map();
  async function revalidate(key, input, init, cached, quiet) {
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      try {
        const res = await origFetch(input, init);
        await store(key, res.clone());
        if (cached) {
          const txt = await res.clone().text();
          if (txt !== cached.body && !quiet) post({ __wmPlusFresh: true });
        }
        return res;
      } finally { inflight.delete(key); }
    })();
    inflight.set(key, p);
    return p;
  }
  async function store(key, res) {
    if (!(res.status === 200 || res.status === 206)) return;
    const body = await res.text();
    if (body.length > 8 * 1024 * 1024) return;
    const headers = {};
    ['content-type', 'content-range', 'preference-applied'].forEach((h) => { const v = res.headers.get(h); if (v) headers[h] = v; });
    await cput(key, { t: Date.now(), status: res.status, headers, body });
  }

  // Réglages et commandes venant du content script
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.__wmPlusSettings) {
      cacheOn = e.data.__wmPlusSettings.cache !== false;
      if (!cacheOn) cclear();
    }
    if (e.data.__wmPlusCacheClear) cclear('all');
    if (e.data.__wmPlusCacheStatsReq) stats();
    if (e.data.__wmPlusUser) {
      const uid = String(e.data.__wmPlusUser);
      let prev = null; try { prev = localStorage.getItem('wmp_cache_uid'); localStorage.setItem('wmp_cache_uid', uid); } catch (_) {}
      if (prev && prev !== uid) { // autre compte : on repart de zéro
        cclear();
        try { ['wmp_owned_entries', 'wmp_owned_counts', 'wmp_owned_cards', 'wmp_owned_full', 'wmp_owned_t'].forEach((k) => localStorage.removeItem(k)); } catch (_) {}
      }
    }
  });

  // ------------------------------------------------------------------
  //  fetch enveloppé
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  //  Données utiles aux doublons et à la liste de souhaits
  // ------------------------------------------------------------------
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  // ------------------------------------------------------------------
  //  Analyse complète et rapide de la collection
  //  On réutilise les en-têtes que le site envoie lui-même à sa base (gardés en mémoire uniquement,
  //  jamais enregistrés) pour lire toute la collection en 1 ou 2 requêtes au lieu de 24 pages.
  // ------------------------------------------------------------------
  let sb = null; // { base, apikey, auth }
  function rememberSb(url, headers) {
    try {
      const u = new URL(url, location.href);
      if (!/\.supabase\.co$/.test(u.hostname) || !u.pathname.startsWith('/rest/v1/')) return;
      const apikey = headerVal(headers, 'apikey'), auth = headerVal(headers, 'authorization');
      if (apikey && /^Bearer\s+\S+/.test(auth)) sb = { base: u.origin, apikey, auth };
    } catch (_) {}
  }
  function uidFromAuth() {
    try {
      const tok = sb.auth.replace(/^Bearer\s+/, '').split('.')[1];
      return JSON.parse(atob(tok.replace(/-/g, '+').replace(/_/g, '/'))).sub || null;
    } catch (_) { return null; }
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Requête avec reprise : le site coupe parfois les requêtes rapprochées ou trop lourdes
  async function retry(fn, tries = 4) {
    let err;
    for (let i = 0; i < tries; i++) {
      try { return await fn(); } catch (e) { err = e; if (/^HTTP 40[13]$/.test(e.message)) break; await wait(1200 * (i + 1)); }
    }
    throw err;
  }
  async function sbGet(pathAndQuery, from, to) {
    const r = await origFetch(sb.base + '/rest/v1/' + pathAndQuery, {
      headers: { apikey: sb.apikey, Authorization: sb.auth, Accept: 'application/json', Range: `${from}-${to}`, 'Range-Unit': 'items', Prefer: 'count=exact' }
    });
    if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
    const total = Number(((r.headers.get('content-range') || '').split('/')[1]) || NaN);
    return { rows: await r.json(), total };
  }
  // Deux accès possibles : les en-têtes vus passer (en mémoire), ou le client du site lui-même
  async function backend() {
    if (sb) { const uid = uidFromAuth(); if (uid) return { uid, api: 'rest' }; }
    const c = typeof window.__wmpFindClient === 'function' && window.__wmpFindClient();
    if (c) {
      let uid = null; try { uid = localStorage.getItem('wmp_cache_uid'); } catch (_) {}
      if (!uid) { try { const { data } = await c.auth.getSession(); uid = data && data.session && data.session.user && data.session.user.id; } catch (_) {} }
      if (uid) return { uid, api: 'client', c };
    }
    throw new Error('nosession');
  }
  async function getRows(be, table, select, filter, from, to) {
    if (be.api === 'rest') {
      let q = '';
      if (filter.eq) q += `&${filter.eq[0]}=eq.${filter.eq[1]}`;
      if (filter.in) q += `&${filter.in[0]}=in.(${filter.in[1].join(',')})`;
      return sbGet(`${table}?select=${select}${q}${filter.order ? '&order=' + filter.order : ''}`, from, to);
    }
    let q = be.c.from(table).select(select, { count: 'exact' });
    if (filter.eq) q = q.eq(filter.eq[0], filter.eq[1]);
    if (filter.in) q = q.in(filter.in[0], filter.in[1]);
    if (filter.order) q = q.order(filter.order);
    const { data, error, count } = await q.range(from, to);
    if (error) throw new Error(error.message || 'erreur');
    return { rows: data || [], total: count ?? NaN };
  }
  const cardInfo = (c) => ({ t: c.wikipedia_title || '', r: c.rarity || '', img: c.hide_image ? null : (c.image_url || null), atk: c.atk || 0, def: c.def || 0, u: c.wikipedia_url || '', cat: c.category || '', lang: c.lang || '' });

  // Analyse complète : uniquement les identifiants de cartes (une seule requête légère, même pour
  // plus de 15 000 cartes), puis les détails des seules cartes en double.
  let analysis = null, lastFail = 0;
  function fullCollection(progress, auto) {
    if (analysis) return analysis;
    if (auto && Date.now() - lastFail < 5 * 60 * 1000) return Promise.reject(new Error('pause'));
    analysis = runFull(progress).catch((e) => { lastFail = Date.now(); throw e; }).finally(() => { analysis = null; });
    return analysis;
  }
  async function runFull(progress) {
    const be = await backend();
    const CHUNK = 20000;
    const counts = {};
    let rowsN = 0, copies = 0, total = NaN;
    for (let from = 0; from < 200000; ) {
      const res = await retry(() => getRows(be, 'user_cards', 'card_id,count', { eq: ['user_id', be.uid], order: 'id' }, from, from + CHUNK - 1));
      for (const r of res.rows) { const n = Math.max(1, Number(r.count) || 1); counts[r.card_id] = (counts[r.card_id] || 0) + n; copies += n; }
      rowsN += res.rows.length; total = res.total;
      progress && progress(rowsN, total);
      if (!res.rows.length || (Number.isFinite(total) ? rowsN >= total : res.rows.length < CHUNK)) break;
      from += res.rows.length;
    }
    // détails des seules cartes en double : fiche de la carte + chacun de tes exemplaires
    const dupIds = Object.keys(counts).filter((id) => counts[id] > 1);
    const info = {};
    const F = 'id,wikipedia_title,rarity,image_url,hide_image,atk,def,wikipedia_url,category,lang';
    const UC = 'id,card_id,count,starred,obtained_at,is_shiny';
    for (let i = 0; i < dupIds.length; i += 100) {
      const part = dupIds.slice(i, i + 100);
      const cs = await retry(() => getRows(be, 'cards', F, { in: ['id', part] }, 0, 999));
      cs.rows.forEach((c) => { info[String(c.id)] = { ...cardInfo(c), copies: [] }; });
      const us = await retry(() => getRows(be, 'user_cards', UC, { eq: ['user_id', be.uid], in: ['card_id', part] }, 0, 1999));
      us.rows.forEach((u) => {
        const it = info[String(u.card_id)] || (info[String(u.card_id)] = { t: '', r: '', copies: [] });
        it.copies.push({ id: u.id, n: Math.max(1, Number(u.count) || 1), s: !!u.is_shiny, st: !!u.starred, o: u.obtained_at || null });
      });
      progress && progress(rowsN, total, Math.min(i + part.length, dupIds.length), dupIds.length);
    }
    try { ['wmp_owned_entries', 'wmp_meta_v1'].forEach((k) => localStorage.removeItem(k)); } catch (_) {}
    lsSet('wmp_owned_counts', counts); lsSet('wmp_owned_cards', info);
    lsSet('wmp_owned_t', Date.now()); lsSet('wmp_owned_full', Date.now());
    post({ __wmPlusOwned: true });
    return { copies, cards: Object.keys(counts).length };
  }
  // ------------------------------------------------------------------
  //  Collection complète pour la vue liste (lecture seule), gardée dans IndexedDB
  //  Ligne compacte : [id exemplaire, id carte, nombre, drapeaux (1 shiny, 2 favori), obtenue (ms), titre, rareté, ATK, DEF, description]
  // ------------------------------------------------------------------
  let listMem = null, listLoading = null;
  const listKey = (uid) => 'wmp:list:' + uid, imgKey = (uid) => 'wmp:img:' + uid;
  let imgMem = null;
  async function listLoad(onChunk) {
    const be = await backend();
    if (!listMem || listMem.uid !== be.uid) {
      const hit = await cget(listKey(be.uid));
      listMem = hit && hit.rows ? { uid: be.uid, t: hit.t, rows: hit.rows } : { uid: be.uid, t: 0, rows: null };
    }
    if (listMem.rows) onChunk && onChunk(listMem.rows, { cached: true, done: false, t: listMem.t });
    if (listMem.rows && Date.now() - listMem.t < 10 * 60 * 1000) { onChunk && onChunk(listMem.rows, { done: true, t: listMem.t }); return listMem.rows; }
    if (!listLoading) listLoading = (async () => {
      const S = 'id,card_id,count,is_shiny,starred,obtained_at,snapshot_title,snapshot_rarity,snapshot_atk,snapshot_def,snapshot_category';
      const out = []; const CH = 5000; let total = NaN;
      for (let from = 0; from < 200000; ) {
        const res = await retry(() => getRows(be, 'user_cards', S, { eq: ['user_id', be.uid], order: 'id' }, from, from + CH - 1));
        for (const r of res.rows) out.push([r.id, String(r.card_id), Math.max(1, Number(r.count) || 1), (r.is_shiny ? 1 : 0) | (r.starred ? 2 : 0),
          r.obtained_at ? Date.parse(r.obtained_at) || 0 : 0, r.snapshot_title || '', r.snapshot_rarity || '', r.snapshot_atk || 0, r.snapshot_def || 0, r.snapshot_category || '']);
        total = res.total;
        if (!listMem.rows) onChunk && onChunk(out.slice(), { done: false, n: out.length, total });
        else onChunk && onChunk(listMem.rows, { cached: true, done: false, n: out.length, total });
        if (!res.rows.length || (Number.isFinite(total) ? out.length >= total : res.rows.length < CH)) break;
        from += res.rows.length;
      }
      listMem = { uid: be.uid, t: Date.now(), rows: out };
      cput(listKey(be.uid), { t: listMem.t, rows: out });
      return out;
    })().finally(() => { listLoading = null; });
    const rows = await listLoading;
    onChunk && onChunk(rows, { done: true, t: listMem.t });
    return rows;
  }
  // Images et liens des cartes, chargés seulement pour les cartes affichées
  async function listImages(ids) {
    const be = await backend();
    if (!imgMem || imgMem.uid !== be.uid) { const hit = await cget(imgKey(be.uid)); imgMem = { uid: be.uid, m: (hit && hit.m) || {} }; }
    const need = [...new Set(ids.map(String))].filter((id) => !imgMem.m[id]);
    for (let i = 0; i < need.length; i += 100) {
      const part = need.slice(i, i + 100);
      const res = await retry(() => getRows(be, 'cards', 'id,image_url,hide_image,wikipedia_url,lang', { in: ['id', part] }, 0, 999));
      res.rows.forEach((c) => { imgMem.m[String(c.id)] = [c.hide_image ? '' : (c.image_url || ''), c.wikipedia_url || '', c.lang || '']; });
      part.forEach((id) => { if (!imgMem.m[id]) imgMem.m[id] = ['', '', '']; });
    }
    if (need.length) { clearTimeout(listImages.t); listImages.t = setTimeout(() => cput(imgKey(be.uid), { m: imgMem.m }), 1500); }
    const out = {}; ids.forEach((id) => { out[id] = imgMem.m[String(id)]; });
    return out;
  }
  // Après une défausse : on retire l'exemplaire des données gardées
  function forgetCopy(ucId) {
    if (listMem && listMem.rows) {
      const i = listMem.rows.findIndex((r) => r[0] === ucId);
      if (i >= 0) { const r = listMem.rows[i]; if (r[2] > 1) r[2]--; else listMem.rows.splice(i, 1); cput(listKey(listMem.uid), { t: listMem.t, rows: listMem.rows }); }
    }
    const counts = lsGet('wmp_owned_counts', null), info = lsGet('wmp_owned_cards', {});
    for (const cid in info) {
      const cp = info[cid].copies || []; const j = cp.findIndex((c) => c.id === ucId);
      if (j < 0) continue;
      if (cp[j].n > 1) cp[j].n--; else cp.splice(j, 1);
      if (counts && counts[cid]) counts[cid]--;
      break;
    }
    if (counts) lsSet('wmp_owned_counts', counts);
    lsSet('wmp_owned_cards', info); lsSet('wmp_owned_t', Date.now());
    post({ __wmPlusOwned: true });
  }
  window.__wmpData = { list: listLoad, images: listImages, forget: forgetCopy };

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || !e.data.__wmPlusAnalyze) return;
    const id = e.data.__wmPlusAnalyze;
    try {
      const out = await fullCollection((n, total, a, b) => post({ __wmPlusAnalyzeProgress: id, n, total, a, b }));
      post({ __wmPlusAnalyzeDone: id, ok: true, ...out });
    } catch (err) {
      post({ __wmPlusAnalyzeDone: id, ok: false, error: String(err && err.message || err) });
    }
  });

  // Pages voisines de la collection préchargées en arrière-plan (une à la fois) pour une navigation instantanée
  let prefetching = false;
  function prefetchNeighbors(u) {
    if (prefetching || !cacheOn) return;
    const page = Number(u.searchParams.get('page'));
    if (!Number.isFinite(page)) return;
    const targets = [page + 1, page + 2, page - 1].filter((x) => x >= 0);
    prefetching = true;
    (async () => {
      for (const n of targets) {
        const v = new URL(u.href); v.searchParams.set('page', String(n));
        const url = v.pathname + v.search;
        const key = [url, '', '', '', ''].join('|');
        const hit = await cget(key);
        if (hit && Date.now() - hit.t < ageFor(url)) continue;
        await new Promise((r) => setTimeout(r, 800)); // on laisse passer les requêtes du site
        try { const r = await origFetch(url); if (r.status === 429) break; await store(key, r.clone()); } catch (_) { break; }
      }
      prefetching = false;
    })();
  }

  function observeData(url, method, init, p) {
    let u; try { u = new URL(url, location.href); } catch (_) { return; }
    // Collection : exemplaires possédés par carte
    if (method === 'GET' && u.origin === location.origin && u.pathname === '/api/my-collection') {
      if (!(init && init.__wmp)) window.__wmpCollUrl = u.pathname + u.search; // requête de la page (modèle pour le défilement continu)
      if (u.searchParams.get('stats') !== '1') setTimeout(() => prefetchNeighbors(u), 1500);
      p.then((res) => res.ok && res.clone().json()).then((j) => {
        if (!j || !Array.isArray(j.collection)) return;
        const full = Number(lsGet('wmp_owned_full', 0));
        if (full && localStorage.getItem('wmp_owned_counts')) {
          // analyse complète déjà faite : on la rafraîchit discrètement si elle date un peu (une requête légère)
          if (Date.now() - full > 2 * 3600 * 1000) fullCollection(null, true).catch(() => {});
          return;
        }
        // pas encore d'analyse complète : on compte les exemplaires vus sur les pages ouvertes
        const entries = lsGet('wmp_owned_entries', {});
        const cards = lsGet('wmp_owned_cards', {});
        for (const it of j.collection) if (it && it.id != null && it.card_id != null) entries[it.id] = [it.card_id, it.count ?? 1];
        const cnt = {};
        for (const k in entries) { const [cid, n] = entries[k]; cnt[cid] = Math.max((cnt[cid] || 0) + 1, Number(n) || 1); }
        for (const it of j.collection) if (it && it.card_id != null && cnt[it.card_id] > 1 && it.card) cards[it.card_id] = cardInfo(it.card);
        lsSet('wmp_owned_entries', entries);
        lsSet('wmp_owned_cards', cards);
        lsSet('wmp_owned_t', Date.now());
        post({ __wmPlusOwned: true });
        setTimeout(() => fullCollection(null, true).catch(() => {}), 2500); // première analyse complète, automatique
      }).catch(() => {});
    }
    // Liste de souhaits : lecture et modifications faites par le site
    if (/\.supabase\.co$/.test(u.hostname) && u.pathname === '/rest/v1/wishlist_items') {
      if (method === 'GET') {
        p.then((res) => res.ok && res.clone().json()).then((rows) => {
          if (!Array.isArray(rows) || !rows.length || !('card_id' in rows[0])) return;
          const all = !u.searchParams.has('card_id');
          const cur = new Set(all ? [] : lsGet('wmp_wishlist', { ids: [] }).ids);
          rows.forEach((r) => cur.add(String(r.card_id)));
          lsSet('wmp_wishlist', { ids: [...cur], t: all ? Date.now() : lsGet('wmp_wishlist', { t: 0 }).t });
          post({ __wmPlusWish: true });
        }).catch(() => {});
      } else {
        p.then((res) => {
          if (!res.ok) return;
          const w = lsGet('wmp_wishlist', { ids: [], t: 0 }); const ids = new Set(w.ids);
          if (method === 'DELETE') { const m = (u.searchParams.get('card_id') || '').replace(/^eq\./, ''); if (m) ids.delete(m); }
          if (method === 'POST') { try { const b = JSON.parse(init && init.body || '{}'); [].concat(b).forEach((x) => x && x.card_id && ids.add(String(x.card_id))); } catch (_) {} }
          lsSet('wmp_wishlist', { ids: [...ids], t: w.t }); post({ __wmPlusWish: true });
        }).catch(() => {});
      }
    }
  }

  window.fetch = function (input, init) {
    let url = '', method = 'GET', headers = null;
    try {
      url = String(input instanceof Request ? input.url : (input && input.href) || input || '');
      method = String((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      headers = (init && init.headers) || (input instanceof Request ? input.headers : null);
    } catch (_) {}

    // Toute écriture invalide le cache (avant même la réponse)
    if (method !== 'GET' && method !== 'HEAD' && isApiWrite(url)) cclear();

    let p;
    const kind = cacheOn && method === 'GET' && !(input instanceof Request) ? classify(url) : null;
    if (kind) {
      // l'en-tête Accept fait partie de la clé : .single() (objet) et une liste (tableau) ont la même URL
      const key = [url, headerVal(headers, 'accept'), headerVal(headers, 'range'), headerVal(headers, 'prefer'), headerVal(headers, 'accept-profile')].join('|');
      const self = this, args = arguments;
      p = (async () => {
        const own = !!(init && init.__wmp); // requête de l'extension (défilement continu, mise en cache)
        const cached = init && init.__wmpForce ? null : await cget(key);
        if (cached && Date.now() - cached.t < ageFor(url)) {
          if (!own) revalidate(key, input, init, cached, kind === 'quiet').catch(() => {});
          return new Response(cached.body, { status: cached.status, headers: { ...cached.headers, 'x-wmplus-cache': 'hit' } });
        }
        return revalidate(key, input, init, null).then((r) => r.clone());
      })().catch(() => origFetch.apply(self, args));
    } else {
      p = origFetch.apply(this, arguments);
    }

    // Observation (lecture seule) : exemplaires de ta collection et liste de souhaits
    try { observeData(url, method, init, p); } catch (_) {}
    try { if (method === 'GET') rememberSb(url, headers); } catch (_) {}

    try {
      const endpoint = WATCH.find((w) => url.includes(w));
      if (endpoint) {
        p.then((res) => {
          res.clone().json()
            .then((data) => post({ __wmPlus: true, endpoint, ok: res.ok, data }))
            .catch(() => {});
        }).catch(() => {});
      }
    } catch (_) {}
    return p;
  };
})();
