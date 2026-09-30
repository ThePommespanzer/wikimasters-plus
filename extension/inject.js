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
  async function cclear(reason) {
    await idb('readwrite', (s) => s.clear());
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
    if (e.data.__wmPlusCacheClear) cclear();
    if (e.data.__wmPlusCacheStatsReq) stats();
    if (e.data.__wmPlusUser) {
      const uid = String(e.data.__wmPlusUser);
      let prev = null; try { prev = localStorage.getItem('wmp_cache_uid'); localStorage.setItem('wmp_cache_uid', uid); } catch (_) {}
      if (prev && prev !== uid) cclear(); // autre compte : on repart de zéro
    }
  });

  // ------------------------------------------------------------------
  //  fetch enveloppé
  // ------------------------------------------------------------------
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
        const cached = await cget(key);
        if (cached && Date.now() - cached.t < ageFor(url)) {
          revalidate(key, input, init, cached, kind === 'quiet').catch(() => {});
          return new Response(cached.body, { status: cached.status, headers: { ...cached.headers, 'x-wmplus-cache': 'hit' } });
        }
        return revalidate(key, input, init, null).then((r) => r.clone());
      })().catch(() => origFetch.apply(self, args));
    } else {
      p = origFetch.apply(this, arguments);
    }

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
