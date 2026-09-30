// Partagé entre content script, service worker et popup.
const WM = {
  RARITIES: ['L', 'UR', 'SR', 'R', 'PC', 'C'],
  RANK: { L: 0, UR: 1, SR: 2, R: 3, PC: 4, C: 5 },
  NAMES: { L: 'Légendaire', UR: 'Ultra Rare', SR: 'Super Rare', R: 'Rare', PC: 'Peu Commune', C: 'Commune' },
  // Couleurs reprises des glows du site
  COLORS: { L: '#ffe144', UR: '#fa9931', SR: '#ed6fa3', R: '#c6a7f2', PC: '#b1cff2', C: '#b8f2d5' },

  DEFAULTS: {
    effects: true,        // effets visuels à l'ouverture
    sound: true,          // petit jingle selon la rareté
    summary: true,        // récap du paquet en bas à droite
    pagePanel: true,      // panneau d'infos intégré à la page /pulls
    restyle: true,        // nouvelle interface d'ouverture et de révélé
    bigReveal: true,      // carte et commandes agrandies pendant le révélé (grands écrans)
    tagBar: true,         // barre de tags rapide pendant le révélé
    cache: true,          // cache local des données lentes (collection, tags, amis)
    fastReveal: false,    // révélé rapide pour C, PC et R
    dupBadges: true,      // badges de doublons / cartes possédées
    wishHighlight: true,  // liste de souhaits mise en avant (marché, échanges)
    tradeCompare: true,   // comparateur d'échange
    cardTools: true,      // boutons Wikipédia, Letterboxd, plein écran, copie
    freeImages: true,     // image libre Wikipédia pour les cartes sans image
    tradeCards: true,     // cartes visibles sur la page des échanges
    compactToggle: true,  // défilement continu (Collection) et vue compacte (Toutes les cartes)
    collPrices: true,     // prix estimés affichés sur la Collection
    tabTitle: true,       // (8/10) dans le titre de l'onglet
    spaceKey: true,       // Espace = ouvrir UN paquet
    notifyFull: true,     // notification quand le seuil est atteint
    threshold: 10,        // seuil de notification
    proReminder: true,    // rappel du pack PRO quotidien
    proHour: 12,          // heure du rappel
    regenMode: 'auto'     // auto | normal | pro
  },

  periodFor(mode, detected) {
    if (mode === 'pro') return 180000;
    if (mode === 'normal') return 600000;
    return detected || 600000;
  },

  // Estimation du nombre de paquets à un instant donné, sans interroger le site.
  predict(state, now = Date.now()) {
    if (!state || typeof state.n !== 'number') return null;
    const max = state.max || 10;
    const period = state.period || 600000;
    if (state.n >= max || !state.nextAt) {
      return { n: Math.min(state.n, max), max, nextAt: null, fullAt: null, period };
    }
    const fullAt = state.nextAt + (max - state.n - 1) * period;
    let n = state.n, nextAt = state.nextAt;
    if (now >= nextAt) {
      const k = 1 + Math.floor((now - nextAt) / period);
      n = Math.min(max, n + k);
      nextAt = n >= max ? null : nextAt + k * period;
    }
    return { n, max, nextAt, fullAt: n >= max ? null : fullAt, period };
  },

  thresholdAt(state, t) {
    if (!state || !state.nextAt || t <= state.n) return null;
    const max = state.max || 10;
    t = Math.min(t, max);
    return state.nextAt + (t - state.n - 1) * (state.period || 600000);
  },

  // Paquets ouverts depuis la dernière carte qui vérifie `test` (ouvertures normales uniquement)
  since(pulls, test) {
    const opens = pulls.filter((p) => p.src === 'open');
    for (let i = opens.length - 1; i >= 0; i--) if (opens[i].cards.some(test)) return String(opens.length - 1 - i);
    return opens.length ? '≥ ' + opens.length : '–';
  },

  ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return Math.round(s / 60) + ' min';
    if (s < 86400) return Math.round(s / 3600) + ' h';
    return Math.round(s / 86400) + ' j';
  },

  // Une fenêtre du site (détail de carte, confirmation…) est-elle ouverte par-dessus la page ?
  siteModalOpen() {
    if (typeof document === 'undefined') return false;
    for (const el of document.body ? document.body.children : []) {
      const c = typeof el.className === 'string' ? el.className : '';
      if (/\bfixed\b/.test(c) && /\binset-0\b/.test(c) && !/\bwmp-/.test(c) && el.getBoundingClientRect().width > 0) return true;
    }
    return !!document.querySelector('body > [role="dialog"], body > [aria-modal="true"]');
  },

  today() { return new Date().toLocaleDateString('sv'); },

  cardName(c) { return c.wikipedia_title || c.name || c.title || c.wiki_title || c.page_title || ('#' + (c.id ?? '?')); },

  fmtDuration(ms) {
    if (ms <= 0) return 'maintenant';
    const m = Math.ceil(ms / 60000);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
  }
};
if (typeof self !== 'undefined') self.WM = WM;
