// Vue liste de toute la collection et « Mes doublons » (contexte de la page).
// Lecture seule, sauf la défausse d'un exemplaire, faite uniquement quand tu cliques et confirmes toi-même.
(() => {
  if (window.__wmPlusView) return;
  window.__wmPlusView = true;

  const RANKS = ['L', 'UR', 'SR', 'R', 'PC', 'C'];
  const RCOL = { L: '#ffe144', UR: '#fa9931', SR: '#ed6fa3', R: '#c6a7f2', PC: '#b1cff2', C: '#b8f2d5' };
  const RNAME = { L: 'Légendaire', UR: 'Ultra Rare', SR: 'Super Rare', R: 'Rare', PC: 'Peu Commune', C: 'Commune' };
  const RTEX = { L: 'legendaire', UR: 'ultra_rare', SR: 'super_rare', R: 'rare', PC: 'peu_commun', C: 'commun' };
  const BALANCE_EVENT = 'wikimasters:wikibidous-balance-refresh';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } };
  const direct = (u) => String(u || '').replace('//thumb.wikimedia.org/', '//upload.wikimedia.org/');
  const proxied = (u, w) => `/_next/image?url=${encodeURIComponent(direct(u))}&w=${w}&q=75`;
  const tex = (r) => proxied('/' + (RTEX[r] || 'commun') + '.png', 384).replace(encodeURIComponent('/'), '%2F');
  const rk = (r) => { const i = RANKS.indexOf(r); return i < 0 ? 9 : i; };
  const day = (t) => t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const ICON = {
    atk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>',
    def: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    lb: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="4" fill="#ff8000"/><circle cx="12" cy="12" r="4" fill="#00e054"/><circle cx="19" cy="12" r="4" fill="#40bcf4"/></svg>'
  };

  // ------------------------------------------------------------------
  //  État
  // ------------------------------------------------------------------
  const st = {
    tab: 'dups',
    mode: lsGet('wmp_view_mode', 'grid'), // grid | list
    q: '', rar: new Set(), sort: 'rarity',
    all: null, allInfo: null,         // cartes de toute la collection (regroupées par carte)
    loading: null, loadErr: null,
    analyzing: null
  };
  const imgs = {};    // id carte -> [image, url wikipédia, langue]
  const free = {};    // id carte -> image libre (Wikipédia / Commons)
  let host = null, root = null;
  const $ = (q) => root.querySelector(q);

  // Toute la collection : lignes compactes -> une entrée par carte
  function groupRows(rows) {
    const m = new Map();
    for (const r of rows) {
      const [id, cid, n, fl, o, t, rr, atk, def, cat] = r;
      let it = m.get(cid);
      if (!it) { it = { id: cid, t, r: rr, atk, def, cat, n: 0, copies: [], o: 0, shiny: false, star: false }; m.set(cid, it); }
      it.n += n;
      it.copies.push({ id, n, s: !!(fl & 1), st: !!(fl & 2), o });
      if (o > it.o) it.o = o;
      if (fl & 1) it.shiny = true;
      if (fl & 2) it.star = true;
      if (rk(rr) < rk(it.r)) { it.r = rr; it.atk = atk; it.def = def; }
    }
    return [...m.values()];
  }
  // Doublons : depuis l'analyse complète (ou la vue liste si elle est déjà chargée)
  function dupItems() {
    if (st.all) return st.all.filter((c) => c.n > 1);
    const counts = lsGet('wmp_owned_counts', null), info = lsGet('wmp_owned_cards', {});
    if (!counts) return [];
    return Object.keys(counts).filter((id) => counts[id] > 1).map((id) => {
      const i = info[id] || {};
      if (i.img !== undefined && !imgs[id]) imgs[id] = [i.img || '', i.u || '', i.lang || ''];
      const copies = (i.copies || []).map((c) => ({ ...c, o: c.o ? Date.parse(c.o) || 0 : 0 }));
      return { id, t: i.t || '(carte)', r: i.r || '', atk: i.atk || 0, def: i.def || 0, cat: i.cat || '', n: counts[id], copies,
        o: Math.max(0, ...copies.map((c) => c.o)), shiny: copies.some((c) => c.s), star: copies.some((c) => c.st) };
    });
  }
  const price = (id) => window.__wmpSales && window.__wmpSales.cached(id);

  // ------------------------------------------------------------------
  //  Chargement
  // ------------------------------------------------------------------
  function loadAll() {
    if (st.loading || !window.__wmpData) return;
    st.loadErr = null;
    st.loading = { n: 0, total: NaN };
    window.__wmpData.list((rows, meta) => {
      if (!meta.cached || !st.all) { st.all = groupRows(rows); }
      if (meta.n != null) st.loading = { n: meta.n, total: meta.total, bg: !!meta.cached };
      if (meta.done) { st.loading = null; st.all = groupRows(rows); }
      render();
    }).catch((e) => { st.loading = null; st.loadErr = e && e.message; render(); });
  }
  async function runAnalysis() {
    if (st.analyzing || !window.__wmpAnalyze) return;
    st.analyzing = 'Analyse de ta collection…'; render();
    const res = await window.__wmpAnalyze((p) => {
      st.analyzing = p.b ? `Détails des doublons… ${p.a}/${p.b}` : `Lecture de ta collection… ${fmt(p.n)}${Number.isFinite(p.total) ? ' / ' + fmt(p.total) : ''}`;
      render();
    });
    st.analyzing = res.ok ? null : { err: res.error };
    render();
  }

  // ------------------------------------------------------------------
  //  Interface
  // ------------------------------------------------------------------
  const CSS = `
  :host{all:initial}*{box-sizing:border-box}
  .bg{position:fixed;inset:0;background:rgba(5,6,5,.86)}
  .page{position:fixed;inset:max(14px,2.5vh) max(12px,calc(50vw - 700px));background:radial-gradient(1200px 500px at 20% -10%,rgba(52,211,153,.08),transparent 60%),#0d100f;
    border:.8px solid rgba(200,208,203,.14);border-radius:22px;display:flex;flex-direction:column;overflow:hidden;color:#f2f4f3;
    font:14px/1.4 var(--font-heading,system-ui),system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 30px 90px rgba(0,0,0,.6)}
  header{padding:14px 18px 10px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center}
  .h{margin:0;font-size:20px}
  .dall{all:unset;cursor:pointer;padding:8px 13px;border-radius:10px;font-weight:700;font-size:13px;background:rgba(248,113,113,.14);color:#fca5a5;border:.8px solid rgba(248,113,113,.3)}
  .dall:hover{background:rgba(248,113,113,.24)}.dall[disabled]{opacity:.4;cursor:not-allowed}
  .conf{position:fixed;inset:0;z-index:6;display:grid;place-items:center;background:rgba(3,4,3,.72);color:#f2f4f3;font:14px/1.45 var(--font-heading,system-ui),system-ui,sans-serif}
  .conf .box{width:min(460px,calc(100vw - 24px));background:#121614;border:.8px solid rgba(248,113,113,.3);border-radius:18px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .conf h2{margin:0 0 10px;font-size:19px}.conf p{margin:0 0 10px;color:rgba(242,244,243,.75)}.conf b{color:#f2f4f3}
  .conf .row2{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
  .conf button{all:unset;cursor:pointer;padding:9px 14px;border-radius:10px;font-weight:700;background:rgba(255,255,255,.08)}
  .conf button.go{background:#dc2626;color:#fff}.conf button[disabled]{opacity:.5;cursor:default}
  .conf .bar2{height:6px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden;margin:12px 0 4px}.conf .bar2 i{display:block;height:100%;width:0;background:#f87171;transition:width .3s}
  .conf .log{font-size:12px;color:rgba(242,244,243,.55)}
  .tabs button,.modes button{all:unset;cursor:pointer;padding:7px 12px;border-radius:9px;font-weight:700;font-size:13px;color:rgba(242,244,243,.6);display:flex;gap:6px;align-items:center}
  .tabs button.on,.modes button.on{background:#1f2624;color:#f2f4f3;box-shadow:0 1px 0 rgba(255,255,255,.06) inset}
  .modes{display:flex;gap:2px;background:rgba(255,255,255,.05);padding:3px;border-radius:10px}
  .modes button{padding:6px 8px}.modes svg{width:16px;height:16px}
  .sum{flex:1 1 220px;font-size:12px;color:rgba(242,244,243,.55)}
  .sum b{color:#f2f4f3}
  .x{all:unset;cursor:pointer;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.06)}
  .x:hover{background:rgba(255,255,255,.12)}
  .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:0 18px 12px;border-bottom:.8px solid rgba(200,208,203,.08)}
  input,select{background:#161b19;color:#f2f4f3;border:.8px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 11px;font:inherit;font-size:13px}
  input{flex:1 1 200px;min-width:0}
  .r{all:unset;cursor:pointer;padding:4px 9px;border-radius:7px;font:800 11px/1.4 system-ui;color:#111;opacity:.3;transition:opacity .15s}
  .r.on{opacity:1}
  .note{padding:9px 18px;font-size:12px;color:#fde68a;background:rgba(251,191,36,.07);border-bottom:.8px solid rgba(251,191,36,.18);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .note[hidden]{display:none}
  .note button{all:unset;cursor:pointer;padding:5px 10px;border-radius:8px;background:rgba(251,191,36,.2);font-weight:700}
  .prog{height:3px;background:rgba(255,255,255,.06)}.prog i{display:block;height:100%;background:#34d399;transition:width .3s}
  .scroll{flex:1 1 auto;min-height:0;overflow:auto;position:relative;overscroll-behavior:contain}
  .sizer{position:relative;width:100%}
  .empty{padding:50px 20px;text-align:center;color:rgba(242,244,243,.5)}

  /* Carte façon site */
  .card{position:absolute;border-radius:16px;overflow:hidden;cursor:pointer;background:#111 var(--tex) center/180% no-repeat;
    box-shadow:0 0 14px color-mix(in srgb,var(--c) 55%,transparent),0 0 2px color-mix(in srgb,var(--c) 80%,transparent);transition:transform .18s,box-shadow .18s;color:#101211}
  .card:hover{transform:translateY(-4px) scale(1.03);z-index:2;box-shadow:0 0 24px color-mix(in srgb,var(--c) 75%,transparent),0 10px 30px rgba(0,0,0,.5)}
  .card .art{position:absolute;top:0;left:0;right:0;height:45%;background:rgba(0,0,0,.25);overflow:hidden}
  .card .art img{width:100%;height:100%;object-fit:cover;display:block}
  .card .art img.logo{object-fit:contain;padding:10px;background:#fff}
  .card .art::after{content:'';position:absolute;left:0;right:0;bottom:0;height:40%;background:linear-gradient(to top,rgba(0,0,0,.45),transparent)}
  .card .ph{position:absolute;inset:0;display:grid;place-items:center;font:900 28px system-ui;color:rgba(255,255,255,.18)}
  .card .rb{position:absolute;top:7px;left:7px;z-index:3;padding:1px 7px;border-radius:6px;font:800 11px/1.5 system-ui;color:#111;background:var(--c);box-shadow:0 1px 4px rgba(0,0,0,.35)}
  .card .nb{position:absolute;top:7px;right:7px;z-index:3;padding:2px 8px;border-radius:999px;font:800 12px/1.35 system-ui;color:#0c0d0c;background:#fbbf24;box-shadow:0 2px 8px rgba(0,0,0,.4)}
  .card .sh{position:absolute;top:32px;left:7px;z-index:3;padding:1px 6px;border-radius:6px;font:800 10px/1.5 system-ui;color:#3b2a00;background:linear-gradient(135deg,#fff3b0,#e9c15a)}
  .card .body{position:absolute;top:45%;left:0;right:0;bottom:0;padding:9px 10px 8px;display:flex;flex-direction:column;gap:3px}
  .card .t{font:800 13px/1.18 var(--font-heading,system-ui),system-ui;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .card .d{font-size:10.5px;line-height:1.25;opacity:.72;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .card .s{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font:800 11px system-ui}
  .card .s span{display:flex;gap:3px;align-items:center}.card .s svg{width:12px;height:12px}
  .card .s .a svg{color:#dc2626}.card .s .df svg{color:#2563eb}
  .card .p{position:absolute;right:7px;top:calc(45% - 24px);z-index:3;padding:2px 7px;border-radius:999px;font:800 11px/1.35 system-ui;background:rgba(10,12,11,.82);color:#fde68a;border:.8px solid rgba(251,191,36,.4)}
  .card.big{position:relative;width:min(300px,70vw);aspect-ratio:5/7;cursor:default;transform-style:preserve-3d;transition:transform .12s}
  .card.big:hover{transform:none}
  .card.big .t{font-size:20px}.card.big .d{font-size:13px;-webkit-line-clamp:5}.card.big .s{font-size:14px}.card.big .s svg{width:16px;height:16px}
  .card .glare{position:absolute;inset:0;z-index:4;pointer-events:none;mix-blend-mode:soft-light}
  .card.shiny::before{content:'';position:absolute;inset:0;z-index:4;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 45%,rgba(255,220,120,.25) 52%,transparent 65%);background-size:250% 100%;animation:sh 3.5s linear infinite;mix-blend-mode:overlay}
  @keyframes sh{from{background-position:120% 0}to{background-position:-120% 0}}

  /* Ligne (vue liste) */
  .row{position:absolute;left:12px;right:12px;height:58px;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center;padding:5px 12px 5px 5px;border-radius:12px;cursor:pointer;
    background:linear-gradient(90deg,color-mix(in srgb,var(--c) 16%,transparent),rgba(255,255,255,.02) 40%);border:.8px solid rgba(255,255,255,.05)}
  .row:hover{background:linear-gradient(90deg,color-mix(in srgb,var(--c) 28%,transparent),rgba(255,255,255,.05) 50%)}
  .row .th{width:48px;height:48px;border-radius:9px;overflow:hidden;background:#111 var(--tex) center/300%;position:relative;box-shadow:0 0 8px color-mix(in srgb,var(--c) 50%,transparent)}
  .row .th img{width:100%;height:100%;object-fit:cover}
  .row .th img.logo{object-fit:contain;background:#fff;padding:4px}
  .row .th .ph{position:absolute;inset:0;display:grid;place-items:center;color:rgba(0,0,0,.35);font:900 16px system-ui}
  .row .mid{min-width:0}
  .row .t{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:7px;align-items:center}
  .row .t .rb{flex:none;padding:0 6px;border-radius:5px;font:800 10px/1.6 system-ui;color:#111;background:var(--c)}
  .row .t .sh{flex:none;font-size:11px;color:#e9c15a}
  .row .d{font-size:12px;color:rgba(242,244,243,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row .right{display:flex;gap:14px;align-items:center;font:700 12px system-ui;color:rgba(242,244,243,.75);white-space:nowrap}
  .row .right span{display:flex;gap:4px;align-items:center}.row .right svg{width:13px;height:13px}
  .row .right .a svg{color:#f87171}.row .right .df svg{color:#60a5fa}
  .row .nb{padding:2px 8px;border-radius:999px;background:#fbbf24;color:#0c0d0c;font-weight:800}
  .row .pr{color:#fde68a}
  .row .dt{color:rgba(242,244,243,.4);font-weight:600}
  @media (max-width:720px){.row .dt,.row .df,.row .a{display:none!important}}

  /* Fiche détaillée */
  .det{position:fixed;inset:0;z-index:5;display:grid;place-items:center;color:#f2f4f3;font:14px/1.4 var(--font-heading,system-ui),system-ui,-apple-system,"Segoe UI",sans-serif;background:rgba(3,4,3,.7);backdrop-filter:blur(6px);animation:fi .16s ease}
  @keyframes fi{from{opacity:0}to{opacity:1}}
  .det .box{position:relative;width:min(920px,calc(100vw - 24px));max-height:calc(100vh - 32px);overflow:auto;display:grid;grid-template-columns:auto minmax(0,1fr);gap:26px;padding:26px;
    background:#101413;border:.8px solid rgba(255,255,255,.1);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .det .stage{perspective:900px;display:grid;place-items:center}
  .det h2{margin:0 0 4px;font-size:24px;line-height:1.15}
  .det .cat{color:rgba(242,244,243,.6);margin:0 0 12px}
  .det .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
  .det .chip{padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,.07)}
  .det .chip.rar{background:var(--c);color:#111}
  .det .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}
  .det .stat{background:rgba(255,255,255,.04);border:.8px solid rgba(255,255,255,.07);border-radius:12px;padding:9px 11px}
  .det .stat small{display:block;font-size:11px;color:rgba(242,244,243,.5)}
  .det .stat b{font-size:18px}
  .det h3{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:rgba(242,244,243,.5);margin:14px 0 8px}
  .det .copies{display:flex;flex-direction:column;gap:6px}
  .det .cp{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:11px;background:rgba(255,255,255,.035);border:.8px solid rgba(255,255,255,.06);font-size:13px}
  .det .cp .l{flex:1;min-width:0}
  .det .cp .tag{font-size:11px;font-weight:700;padding:1px 6px;border-radius:6px;margin-left:6px}
  .det .cp .tag.s{background:linear-gradient(135deg,#fff3b0,#e9c15a);color:#3b2a00}
  .det .cp .tag.f{background:rgba(251,191,36,.18);color:#fde68a}
  .det .cp .tag.g{background:rgba(52,211,153,.15);color:#6ee7b7}
  .det .btn{all:unset;cursor:pointer;display:inline-flex;gap:6px;align-items:center;padding:7px 12px;border-radius:9px;font-weight:700;font-size:13px;background:rgba(255,255,255,.08)}
  .det .btn:hover{background:rgba(255,255,255,.14)}
  .det .btn svg{width:15px;height:15px}
  .det .btn.dis{background:rgba(248,113,113,.12);color:#fca5a5}
  .det .btn.dis:hover{background:rgba(248,113,113,.22)}
  .det .btn.dis.conf{background:#dc2626;color:#fff}
  .det .btn[disabled]{opacity:.45;cursor:not-allowed}
  .det .links{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
  .det .w{font:900 14px Georgia,serif}
  .det .close{position:absolute;top:12px;right:12px}
  .det .nav{position:absolute;top:50%;transform:translateY(-50%);all:unset;cursor:pointer;width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.08);font-size:20px}
  .det .price{font-size:13px;color:rgba(242,244,243,.75)}
  .det .price b{color:#fde68a;font-size:16px}
  .det .msg{margin-top:8px;font-size:12px}
  .det .msg.ok{color:#6ee7b7}.det .msg.err{color:#fca5a5}
  .det .hint{font-size:11.5px;color:rgba(242,244,243,.45);margin-top:6px}
  .toast{font:700 14px system-ui,sans-serif;position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9;padding:10px 16px;border-radius:12px;background:#065f46;color:#ecfdf5;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.4);animation:fi .15s}
  @media (max-width:720px){.page{inset:0;border-radius:0}.det .box{grid-template-columns:1fr;justify-items:center;padding:18px}.det .stats{grid-template-columns:repeat(3,1fr)}}
  `;

  function build() {
    host = document.createElement('div');
    host.id = 'wmp-view';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483200';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="bg"></div>
      <div class="page" role="dialog" aria-label="Ma collection">
        <header>
          <h1 class="h">Mes doublons</h1>
          <div class="sum"></div>
          <div class="modes"><button data-mode="grid" title="Cartes">${ICON.grid}</button><button data-mode="list" title="Liste">${ICON.list}</button></div>
          <button class="dall" title="Défausser tous les exemplaires en trop">Défausser les doublons</button>
          <button class="x" title="Fermer (Échap)">✕</button>
        </header>
        <div class="bar"><input class="q" placeholder="Rechercher un nom ou une description…"><span class="rs">${RANKS.map((r) => `<button class="r on" data-r="${r}" style="background:${RCOL[r]}">${r}</button>`).join(' ')}</span>
          <select class="so">
            <option value="rarity">Tri : rareté</option><option value="recent">Tri : obtenues récemment</option><option value="name">Tri : nom</option>
            <option value="atk">Tri : ATK</option><option value="def">Tri : DEF</option><option value="count">Tri : exemplaires</option><option value="price">Tri : prix estimé</option>
          </select></div>
        <div class="note" hidden></div>
        <div class="prog" hidden><i></i></div>
        <div class="scroll"><div class="sizer"></div></div>
      </div>`;
    document.documentElement.appendChild(host);
    root.querySelector('.bg').addEventListener('click', close);
    $('.x').addEventListener('click', close);
    $('.dall').addEventListener('click', discardAllAsk);
    $('.modes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.mode = b.dataset.mode; try { localStorage.setItem('wmp_view_mode', JSON.stringify(st.mode)); } catch (_) {} $('.scroll').scrollTop = 0; render(); });
    $('.q').addEventListener('input', (e) => { st.q = e.target.value; $('.scroll').scrollTop = 0; render(); });
    $('.so').addEventListener('change', (e) => { st.sort = e.target.value; $('.scroll').scrollTop = 0; render(); });
    $('.rs').addEventListener('click', (e) => {
      const b = e.target.closest('.r'); if (!b) return;
      const r = b.dataset.r; st.rar.has(r) ? st.rar.delete(r) : st.rar.add(r);
      b.classList.toggle('on', !st.rar.has(r)); $('.scroll').scrollTop = 0; render();
    });
    $('.scroll').addEventListener('scroll', () => requestAnimationFrame(paint), { passive: true });
    $('.scroll').addEventListener('click', (e) => { const el = e.target.closest('[data-i]'); if (el) openDetail(Number(el.dataset.i)); });
    new ResizeObserver(() => paint()).observe($('.scroll'));
    root.addEventListener('keydown', (e) => e.stopPropagation(), true);
  }
  function onKey(e) {
    if (!host || host.style.display === 'none') return;
    const det = root.querySelector('.det');
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); det ? closeDetail() : close(); }
    else if (det && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); stepDetail(e.key === 'ArrowRight' ? 1 : -1); }
  }
  function open(tab) {
    if (!host) build();
    host.style.display = '';
    addEventListener('keydown', onKey, true);
    document.documentElement.style.overflow = 'hidden';
    switchTab('dups');
  }
  function close() {
    if (!host) return;
    closeDetail();
    host.style.display = 'none';
    removeEventListener('keydown', onKey, true);
    document.documentElement.style.overflow = '';
  }
  function switchTab(tab) {
    st.tab = tab;
    root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('.scroll').scrollTop = 0;
    if (tab === 'all') loadAll();
    if (tab === 'dups') {
      if (!lsGet('wmp_owned_counts', null) || Date.now() - Number(lsGet('wmp_owned_full', 0)) > 30 * 60 * 1000) runAnalysis();
      estimateDups();
    }
    render();
  }

  // ------------------------------------------------------------------
  //  Liste filtrée et triée
  // ------------------------------------------------------------------
  let view = [];
  function computeView() {
    const src = st.tab === 'dups' ? dupItems() : (st.all || []);
    const q = st.q.trim().toLowerCase();
    let list = src.filter((c) => !st.rar.has(c.r) && (!q || String(c.t).toLowerCase().includes(q) || String(c.cat).toLowerCase().includes(q)));
    const pr = (c) => { const p = price(c.id); return p && p.m != null ? p.m : -1; };
    const by = {
      rarity: (a, b) => rk(a.r) - rk(b.r) || b.atk + b.def - a.atk - a.def,
      recent: (a, b) => b.o - a.o,
      name: (a, b) => String(a.t).localeCompare(String(b.t), 'fr'),
      atk: (a, b) => b.atk - a.atk, def: (a, b) => b.def - a.def,
      count: (a, b) => b.n - a.n || rk(a.r) - rk(b.r),
      price: (a, b) => pr(b) - pr(a) || rk(a.r) - rk(b.r)
    };
    list.sort(by[st.sort] || by.rarity);
    return { src, list };
  }
  function render() {
    if (!root || host.style.display === 'none') return;
    root.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === st.mode));
    const { src, list } = computeView();
    view = list;
    // résumé
    const sum = $('.sum');
    if (st.tab === 'all') {
      const copies = src.reduce((s, c) => s + c.n, 0);
      sum.innerHTML = src.length ? `<b>${fmt(src.length)}</b> cartes · <b>${fmt(copies)}</b> exemplaires${list.length !== src.length ? ` · ${fmt(list.length)} affichées` : ''}` : '';
    } else {
      const extra = src.reduce((s, c) => s + c.n - 1, 0);
      let val = 0, known = 0;
      src.forEach((c) => { const p = price(c.id); if (p && p.m != null) { val += p.m * (c.n - 1); known++; } });
      sum.innerHTML = `<b>${fmt(src.length)}</b> cartes en double · <b>${fmt(extra)}</b> exemplaires en trop` +
        (known ? ` · valeur estimée <b>≈ ${fmt(val)} W</b>${known < src.length ? ` (${known}/${src.length})` : ''}` : '') +
        (extra ? ` · défausse : <b>${fmt(extra)} W</b>` : '');
    }
    // bandeau
    const note = $('.note'), prog = $('.prog');
    note.hidden = true; prog.hidden = true;
    if (st.tab === 'all') {
      if (st.loadErr) { note.hidden = false; note.innerHTML = `<span>${st.loadErr === 'nosession' ? 'Session du site pas encore détectée : change de page une fois sur le site, puis réessaie.' : 'Le site n’a pas répondu. Réessaie dans quelques secondes.'}</span><button class="rt">Réessayer</button>`; note.querySelector('.rt').onclick = loadAll; }
      else if (st.loading && Number.isFinite(st.loading.total)) {
        prog.hidden = false; prog.firstChild.style.width = Math.min(100, st.loading.n / st.loading.total * 100) + '%';
        if (!st.all || !st.loading.bg) { note.hidden = false; note.innerHTML = `<span>Chargement de ta collection… ${fmt(st.loading.n)} / ${fmt(st.loading.total)}</span>`; }
      } else if (st.loading && !st.all) { note.hidden = false; note.innerHTML = '<span>Chargement de ta collection…</span>'; }
    } else {
      note.hidden = false;
      if (st.analyzing && st.analyzing.err) { note.innerHTML = `<span>${st.analyzing.err === 'nosession' ? 'Session du site pas encore détectée : change de page une fois sur le site, puis réessaie.' : 'Le site n’a pas répondu (il limite parfois les requêtes). Réessaie dans quelques secondes.'}</span><button class="rt">Réessayer</button>`; note.querySelector('.rt').onclick = () => { st.analyzing = null; runAnalysis(); }; }
      else if (st.analyzing) note.innerHTML = `<span>${esc(st.analyzing)}</span>`;
      else {
        const full = Number(lsGet('wmp_owned_full', 0));
        note.innerHTML = full ? `<span>Collection analysée le ${new Date(full).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}. Clique sur une carte pour voir ses exemplaires, son prix ou en défausser.</span><button class="rt">Réanalyser</button>`
          : '<span>Collection pas encore analysée.</span><button class="rt">Analyser</button>';
        note.querySelector('.rt').onclick = runAnalysis;
      }
    }
    paint(true);
  }

  // Rendu virtuel : seuls les éléments visibles existent dans la page (fluide même avec 15 000 cartes)
  let geo = null, lastKey = '';
  const nodes = new Map();
  function layout() {
    const sc = $('.scroll'); const W = sc.clientWidth;
    if (st.mode === 'list') return { cols: 1, cw: W, ch: 64, gap: 0, pad: 10, W };
    const gap = 16, pad = 18, min = W < 500 ? 140 : 158;
    const cols = Math.max(1, Math.floor((W - pad * 2 + gap) / (min + gap)));
    const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
    return { cols, cw, ch: cw * 1.4, gap, pad, W };
  }
  function paint(force) {
    if (!root || host.style.display === 'none') return;
    const sc = $('.scroll'), sizer = $('.sizer');
    geo = layout();
    const rows = Math.ceil(view.length / geo.cols);
    const rowH = geo.ch + geo.gap;
    sizer.style.height = (view.length ? rows * rowH + geo.pad * 2 : 0) + 'px';
    if (!view.length) {
      const empty = st.tab === 'dups' ? (st.analyzing ? '' : (dupItems().length ? 'Aucune carte ne correspond à ces filtres.' : 'Aucun doublon trouvé.')) : (st.loading || st.loadErr ? '' : (st.all && st.all.length ? 'Aucune carte ne correspond à ces filtres.' : ''));
      nodes.clear(); sizer.innerHTML = empty ? `<div class="empty">${empty}</div>` : ''; lastKey = ''; return;
    }
    const top = sc.scrollTop, h = sc.clientHeight;
    const r0 = Math.max(0, Math.floor((top - geo.pad) / rowH) - 2), r1 = Math.min(rows - 1, Math.ceil((top + h) / rowH) + 2);
    const i0 = r0 * geo.cols, i1 = Math.min(view.length - 1, (r1 + 1) * geo.cols - 1);
    // on ne crée que les éléments qui entrent dans la zone visible, les autres sont réutilisés
    const lay = [st.mode, geo.cols, Math.round(geo.cw), view.length, view[0] && view[0].id, view[view.length - 1] && view[view.length - 1].id].join(':');
    if (force || lay !== lastKey) { sizer.textContent = ''; nodes.clear(); lastKey = lay; }
    for (const [i, el] of nodes) if (i < i0 || i > i1) { el.remove(); nodes.delete(i); }
    const wantImg = [];
    let html = '', add = [];
    for (let i = i0; i <= i1; i++) {
      if (nodes.has(i)) continue;
      const c = view[i];
      const row = Math.floor(i / geo.cols), col = i % geo.cols;
      const x = geo.pad + col * (geo.cw + geo.gap), y = geo.pad + row * rowH;
      if (!imgs[c.id]) wantImg.push(c.id);
      html += st.mode === 'list' ? rowHtml(c, i, y) : cardHtml(c, i, x, y, geo.cw, geo.ch);
      add.push(i);
    }
    if (add.length) {
      const tpl = document.createElement('template'); tpl.innerHTML = html;
      [...tpl.content.children].forEach((el, k) => {
        nodes.set(add[k], el);
        el.querySelectorAll('img[data-direct]').forEach((im) => { im.onerror = () => { if (!im.dataset.fb) { im.dataset.fb = '1'; im.src = im.dataset.direct; } else im.remove(); }; });
      });
      sizer.appendChild(tpl.content);
    }
    if (wantImg.length) fetchImages(wantImg);
  }
  // redessine seulement les éléments visibles de ces cartes (image arrivée, prix…)
  function refreshNodes(ids) {
    const set = new Set(ids.map(String));
    for (const [i, el] of nodes) {
      const c = view[i]; if (!c || !set.has(String(c.id))) continue;
      const row = Math.floor(i / geo.cols), col = i % geo.cols, rowH = geo.ch + geo.gap;
      const x = geo.pad + col * (geo.cw + geo.gap), y = geo.pad + row * rowH;
      const tpl = document.createElement('template');
      tpl.innerHTML = st.mode === 'list' ? rowHtml(c, i, y) : cardHtml(c, i, x, y, geo.cw, geo.ch);
      const nw = tpl.content.firstElementChild;
      nw.querySelectorAll('img[data-direct]').forEach((im) => { im.onerror = () => { if (!im.dataset.fb) { im.dataset.fb = '1'; im.src = im.dataset.direct; } else im.remove(); }; });
      el.replaceWith(nw); nodes.set(i, nw);
    }
  }
  function artFor(c) {
    const i = imgs[c.id];
    if (i && i[0]) return { src: i[0] };
    const f = free[c.id];
    if (f && f.src) return { src: f.src, logo: f.logo };
    if (i && !i[0] && window.__wmpMeta && free[c.id] === undefined) {
      free[c.id] = null;
      window.__wmpMeta({ id: c.id, wikipedia_title: c.t, wikipedia_url: i[1], lang: i[2] }, (m) => { free[c.id] = m && m.img ? m.img : { src: '' }; if (m && m.img) refreshNodes([c.id]); });
    }
    return null;
  }
  function imgHtml(c, w) {
    const a = artFor(c);
    return a ? `<img src="${esc(proxied(a.src, w))}" data-direct="${esc(direct(a.src))}" class="${a.logo ? 'logo' : ''}" alt="" loading="lazy" decoding="async">` : '<div class="ph">W</div>';
  }
  function priceTxt(c) { const p = price(c.id); return p && p.m != null ? `≈ ${fmt(p.m)} W` : ''; }
  function cardInner(c, w) {
    const p = priceTxt(c);
    return `<div class="art">${imgHtml(c, w)}</div>
      <span class="rb">${esc(c.r || '?')}</span>${c.n > 1 ? `<span class="nb">×${c.n}</span>` : ''}${c.shiny ? '<span class="sh">✦ Shiny</span>' : ''}
      ${p ? `<span class="p">${p}</span>` : ''}
      <div class="body"><div class="t">${esc(c.t)}</div>${c.cat ? `<div class="d">${esc(c.cat)}</div>` : ''}
        <div class="s"><span class="a">${ICON.atk}${fmt(c.atk || 0)}</span><span class="df">${ICON.def}${fmt(c.def || 0)}</span></div></div>`;
  }
  function cardHtml(c, i, x, y, w, h) {
    return `<div class="card${c.shiny ? ' shiny' : ''}" data-i="${i}" style="--c:${RCOL[c.r] || '#9ca3af'};--tex:url('${tex(c.r)}');left:${x}px;top:${y}px;width:${w}px;height:${h}px" title="${esc(c.t)}">${cardInner(c, 384)}</div>`;
  }
  function rowHtml(c, i, y) {
    const p = priceTxt(c);
    return `<div class="row" data-i="${i}" style="--c:${RCOL[c.r] || '#9ca3af'};--tex:url('${tex(c.r)}');top:${y + 3}px">
      <div class="th">${imgHtml(c, 96)}</div>
      <div class="mid"><div class="t"><span class="rb">${esc(c.r || '?')}</span>${esc(c.t)}${c.shiny ? '<span class="sh">✦</span>' : ''}${c.star ? '<span class="sh">★</span>' : ''}</div><div class="d">${esc(c.cat)}</div></div>
      <div class="right">${p ? `<span class="pr">${p}</span>` : ''}<span class="a">${ICON.atk}${fmt(c.atk || 0)}</span><span class="df">${ICON.def}${fmt(c.def || 0)}</span>
        ${c.o ? `<span class="dt">${day(c.o)}</span>` : ''}${c.n > 1 ? `<span class="nb">×${c.n}</span>` : ''}</div></div>`;
  }
  let imgQ = new Set(), imgT = null, imgBusy = false;
  function fetchImages(ids) {
    ids.forEach((id) => imgQ.add(id));
    clearTimeout(imgT);
    imgT = setTimeout(async () => {
      if (imgBusy || !window.__wmpData) return;
      imgBusy = true;
      const batch = [...imgQ].slice(0, 200); batch.forEach((id) => imgQ.delete(id));
      try { const r = await window.__wmpData.images(batch); Object.assign(imgs, r); refreshNodes(batch); } catch (_) {}
      imgBusy = false;
      if (imgQ.size) fetchImages([]);
    }, 120);
  }

  // Prix des doublons : estimés un par un en arrière-plan (ventes récentes, gardées 24 h)
  let estQ = [], estActive = 0, estT = null;
  function estimateDups() {
    if (!window.__wmpSales) return;
    const ids = dupItems().map((c) => c.id).filter((id) => !price(id));
    estQ = [...new Set([...estQ, ...ids])];
    pumpEst();
  }
  function pumpEst() {
    while (estActive < 2 && estQ.length) {
      const id = estQ.shift(); estActive++;
      window.__wmpSales.get(id).catch(() => {}).finally(() => {
        estActive--; clearTimeout(estT); estT = setTimeout(render, 250);
        if (host && host.style.display !== 'none') pumpEst();
      });
    }
  }

  // ------------------------------------------------------------------
  //  Fiche détaillée
  // ------------------------------------------------------------------
  let detIdx = -1;
  function closeDetail() { const d = root && root.querySelector('.det'); if (d) d.remove(); detIdx = -1; }
  function stepDetail(k) { if (detIdx < 0 || !view.length) return; openDetail((detIdx + k + view.length) % view.length); }
  function openDetail(i) {
    const c = view[i]; if (!c) return;
    closeDetail(); detIdx = i;
    const d = document.createElement('div'); d.className = 'det';
    const im = imgs[c.id] || [];
    const wurl = im[1] || `https://${im[2] || 'fr'}.wikipedia.org/wiki/${encodeURIComponent(String(c.t).replace(/ /g, '_'))}`;
    d.innerHTML = `<div class="box" style="--c:${RCOL[c.r] || '#9ca3af'}">
      <button class="x close" title="Fermer (Échap)">✕</button>
      <div class="stage"><div class="card big${c.shiny ? ' shiny' : ''}" style="--c:${RCOL[c.r] || '#9ca3af'};--tex:url('${tex(c.r)}')">${cardInner(c, 640)}<div class="glare"></div></div></div>
      <div class="info">
        <h2>${esc(c.t)}</h2>${c.cat ? `<p class="cat">${esc(c.cat)}</p>` : ''}
        <div class="chips"><span class="chip rar">${esc(RNAME[c.r] || c.r || '?')}</span>${c.shiny ? '<span class="chip">✦ Shiny</span>' : ''}${c.star ? '<span class="chip">★ Favori</span>' : ''}</div>
        <div class="stats"><div class="stat"><small>ATK</small><b>${fmt(c.atk || 0)}</b></div><div class="stat"><small>DEF</small><b>${fmt(c.def || 0)}</b></div><div class="stat"><small>Exemplaires</small><b class="cnt">${c.n}</b></div></div>
        <div class="price">Prix du marché : <span class="pv">estimation…</span></div>
        <h3>Tes exemplaires</h3><div class="copies"></div>
        <div class="msg"></div>
        <div class="links">
          <a class="btn" href="${esc(wurl)}" target="_blank" rel="noopener"><span class="w">W</span>Wikipédia</a>
          <span class="lbx"></span>
        </div>
        <p class="hint">← → pour passer d'une carte à l'autre · Échap pour fermer</p>
      </div></div>`;
    root.appendChild(d);
    d.addEventListener('click', (e) => { if (e.target === d) closeDetail(); });
    d.querySelector('.close').addEventListener('click', closeDetail);
    d.querySelectorAll('img[data-direct]').forEach((x) => { x.onerror = () => { if (!x.dataset.fb) { x.dataset.fb = '1'; x.src = x.dataset.direct; } else x.remove(); }; });
    // inclinaison 3D et reflet
    const big = d.querySelector('.card.big'), glare = d.querySelector('.glare');
    big.addEventListener('pointermove', (e) => {
      const r = big.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      big.style.transform = `rotateY(${(x - .5) * 18}deg) rotateX(${(.5 - y) * 16}deg)`;
      glare.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,.55), transparent 50%)`;
    });
    big.addEventListener('pointerleave', () => { big.style.transform = ''; glare.style.background = ''; });
    renderCopies(d, c);
    // Letterboxd
    if (window.__wmpMeta) window.__wmpMeta({ id: c.id, wikipedia_title: c.t, wikipedia_url: im[1], lang: im[2] }, (m) => {
      if (m && m.lb && d.isConnected) d.querySelector('.lbx').innerHTML = `<a class="btn" href="${esc(m.lb)}" target="_blank" rel="noopener">${ICON.lb}Letterboxd</a>`;
    });
    // prix
    const pv = d.querySelector('.pv');
    const showPrice = (p) => {
      if (!d.isConnected) return;
      pv.innerHTML = p && p.m != null ? `<b>≈ ${fmt(p.m)} W</b> <span style="opacity:.6">(${p.n} vente${p.n > 1 ? 's' : ''})</span>${c.n > 1 ? ` · tes ${c.n - 1} en trop ≈ <b>${fmt(p.m * (c.n - 1))} W</b>` : ''}` : 'pas assez de ventes récentes';
    };
    const cached = price(c.id);
    if (cached) showPrice(cached);
    else if (window.__wmpSales) window.__wmpSales.get(c.id).then(showPrice, () => { if (d.isConnected) pv.textContent = 'indisponible'; });
  }
  function renderCopies(d, c) {
    const box = d.querySelector('.copies');
    const copies = [...(c.copies || [])];
    if (!copies.length) { box.innerHTML = '<div class="cp"><span class="l">Détails des exemplaires indisponibles, relance l’analyse.</span></div>'; return; }
    // exemplaire suggéré pour la défausse : ni shiny ni favori, le plus récent
    const score = (x) => (x.s ? 4 : 0) + (x.st ? 2 : 0);
    const sugg = c.n > 1 ? [...copies].sort((a, b) => score(a) - score(b) || b.o - a.o)[0] : null;
    copies.sort((a, b) => (a === sugg ? -1 : b === sugg ? 1 : a.o - b.o));
    box.innerHTML = copies.map((x, k) => `<div class="cp" data-k="${k}">
      <span class="l">${x.o ? 'Obtenu le ' + day(x.o) : 'Exemplaire'}${x.n > 1 ? ` (×${x.n})` : ''}${x.s ? '<span class="tag s">✦ Shiny</span>' : ''}${x.st ? '<span class="tag f">★ Favori</span>' : ''}${x === sugg ? '<span class="tag g">suggéré</span>' : ''}</span>
      <button class="btn dis" ${c.n > 1 ? '' : 'disabled title="Tu gardes toujours au moins un exemplaire"'}>Défausser · +1 W</button></div>`).join('');
    box.querySelectorAll('.cp').forEach((row) => {
      const x = copies[Number(row.dataset.k)]; const b = row.querySelector('.dis');
      let t = null;
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        if (!b.classList.contains('conf')) { // deux clics : on confirme toujours avant de défausser
          b.classList.add('conf'); b.textContent = 'Confirmer la défausse ?';
          t = setTimeout(() => { b.classList.remove('conf'); b.textContent = 'Défausser · +1 W'; }, 4000);
          return;
        }
        clearTimeout(t); b.disabled = true; b.textContent = 'Défausse…';
        const msg = d.querySelector('.msg'); msg.className = 'msg'; msg.textContent = '';
        try {
          await discardOne(c, x);
          window.dispatchEvent(new CustomEvent(BALANCE_EVENT));
          d.querySelector('.cnt').textContent = c.n;
          const big = d.querySelector('.card.big'); const gl = big.querySelector('.glare');
          big.innerHTML = cardInner(c, 640); big.appendChild(gl);
          toast(`Exemplaire défaussé · +1 wikibidou`);
          if (c.n <= 1) { msg.className = 'msg ok'; msg.textContent = 'Plus de doublon pour cette carte.'; }
          renderCopies(d, c);
          render();
        } catch (e) {
          msg.className = 'msg err'; msg.textContent = e.message || 'Erreur réseau';
          b.disabled = false; b.classList.remove('conf'); b.textContent = 'Défausser · +1 W';
        }
      });
    });
  }
  // Une défausse = le même appel que le bouton « Défausser » du site
  async function discardOne(c, x) {
    const r = await fetch(`/api/user-cards/${encodeURIComponent(x.id)}/discard`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || (r.status === 429 ? 'Le site demande de ralentir' : 'Impossible de défausser')); e.status = r.status; throw e; }
    if (x.n > 1) x.n--; else c.copies.splice(c.copies.indexOf(x), 1);
    c.n--;
    if (window.__wmpData) window.__wmpData.forget(x.id);
  }
  // Exemplaires à défausser pour garder une seule copie : jamais les shiny ni les favoris, on garde le plus ancien
  function discardPlan() {
    const plan = [];
    for (const c of dupItems()) {
      const copies = [...(c.copies || [])];
      if (!copies.length) continue;
      const prot = copies.filter((x) => x.s || x.st);
      const free = copies.filter((x) => !x.s && !x.st).sort((a, b) => a.o - b.o); // du plus ancien au plus récent
      free.forEach((x, k) => {
        const units = x.n - (!prot.length && k === 0 ? 1 : 0); // sans shiny ni favori, on garde le plus ancien
        for (let u = 0; u < units; u++) plan.push({ c, x });
      });
    }
    return plan;
  }
  function discardAllAsk() {
    const plan = discardPlan();
    const cards = new Set(plan.map((p) => p.c.id)).size;
    const d = document.createElement('div'); d.className = 'conf';
    d.innerHTML = plan.length ? `<div class="box"><h2>Défausser tous tes doublons ?</h2>
      <p><b>${fmt(plan.length)} exemplaire${plan.length > 1 ? 's' : ''}</b> en trop sur <b>${fmt(cards)} carte${cards > 1 ? 's' : ''}</b> seront défaussés, soit <b>+${fmt(plan.length)} wikibidou${plan.length > 1 ? 's' : ''}</b>.</p>
      <p>Tu gardes toujours un exemplaire de chaque carte, et tes cartes shiny et favorites ne sont jamais défaussées.</p>
      <p>C'est définitif. Les défausses sont faites une par une, à environ une par seconde, et tu peux arrêter à tout moment.</p>
      <div class="bar2" hidden><i></i></div><div class="log"></div>
      <div class="row2"><button class="no">Annuler</button><button class="go">Défausser ${fmt(plan.length)} exemplaire${plan.length > 1 ? 's' : ''}</button></div></div>`
      : `<div class="box"><h2>Rien à défausser</h2><p>Tu n'as aucun exemplaire en trop (hors shiny et favoris).</p><div class="row2"><button class="no">Fermer</button></div></div>`;
    root.appendChild(d);
    let stop = false, running = false;
    const no = d.querySelector('.no'), go = d.querySelector('.go');
    no.addEventListener('click', () => { if (running) { stop = true; no.textContent = 'Arrêt…'; no.disabled = true; } else d.remove(); });
    d.addEventListener('click', (e) => { if (e.target === d && !running) d.remove(); });
    if (!go) return;
    go.addEventListener('click', async () => {
      running = true; go.disabled = true; no.textContent = 'Arrêter';
      const bar = d.querySelector('.bar2'), log = d.querySelector('.log'); bar.hidden = false;
      let done = 0, err = null;
      for (const { c, x } of plan) {
        if (stop) break;
        if (!c.copies.includes(x) || c.n <= 1) continue; // déjà défaussé ailleurs
        try { await discardOne(c, x); done++; }
        catch (e) {
          if (e.status === 429) { log.textContent = 'Le site demande de ralentir, pause de 10 s…'; await new Promise((r) => setTimeout(r, 10000)); try { await discardOne(c, x); done++; continue; } catch (e2) { err = e2; break; } }
          err = e; break;
        }
        bar.firstChild.style.width = (done / plan.length * 100) + '%';
        log.textContent = `${done} / ${plan.length} défaussés · ${c.t}`;
        await new Promise((r) => setTimeout(r, 1000));
      }
      window.dispatchEvent(new CustomEvent(BALANCE_EVENT));
      running = false;
      log.textContent = err ? `Arrêté après ${done} défausse${done > 1 ? 's' : ''} : ${err.message}` : stop ? `Arrêté : ${done} défausse${done > 1 ? 's' : ''}, +${done} W.` : `Terminé : ${done} exemplaire${done > 1 ? 's' : ''} défaussé${done > 1 ? 's' : ''}, +${done} W.`;
      go.remove(); no.disabled = false; no.textContent = 'Fermer'; no.onclick = () => d.remove();
      render();
    });
  }
  function toast(t) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = t;
    root.appendChild(el); setTimeout(() => el.remove(), 2200);
  }

  // Données mises à jour ailleurs (analyse, défausse, nouvelle ouverture…)
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || !e.data.__wmPlusOwned) return;
    if (host && host.style.display !== 'none') { clearTimeout(window.__wmpViewT); window.__wmpViewT = setTimeout(render, 300); }
  });

  // ==================================================================
  //  Collection : défilement continu (toutes les pages à la suite) et prix par rareté
  // ==================================================================
  let SET = { compactToggle: true, collPrices: true };
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || !e.data.__wmPlusSettings) return;
    const x = e.data.__wmPlusSettings;
    SET = { compactToggle: x.compactToggle !== false, collPrices: x.collPrices !== false };
    tickColl();
  });
  const onColl = () => /^\/collection\/?$/.test(location.pathname);
  const fiberOf = (el) => { const k = Object.keys(el).find((x) => x.startsWith('__reactFiber')); return k ? el[k] : null; };
  // état React de la page Collection : la liste des cartes affichées (useState du site)
  function collHook() {
    const el = document.querySelector('main [data-wmp-id]') || [...document.querySelectorAll('main [class*="glow-"]')].find((x) => /\brounded-2xl\b/.test(String(x.className)));
    for (let f = el && fiberOf(el), d = 0; f && d < 40; f = f.return, d++) {
      for (let h = f.memoizedState, k = 0; h && typeof h === 'object' && 'next' in h && k < 6; h = h.next, k++) {
        const v = h.memoizedState;
        if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'card_id' in v[0] && 'card' in v[0] && h.queue && h.queue.dispatch) return h;
      }
    }
    return null;
  }
  function pagerEl() {
    const b = [...document.querySelectorAll('main button')].find((x) => /Suivant/.test(x.textContent));
    return b ? b.parentElement : null;
  }
  function pageInfo() {
    const p = pagerEl(); const m = p && p.textContent.match(/Page\s+(\d+)\s*\/\s*(\d+)/);
    return m ? { page: Number(m[1]), pages: Number(m[2]) } : null;
  }
  const inf = { on: lsGet('wmp_infinite', false), busy: false, next: 0, pages: 0, sig: '', len: 0, end: false, err: 0 };
  let infPill = null;
  function pill(txt) {
    if (!txt) { if (infPill) infPill.remove(); infPill = null; return; }
    if (!infPill) {
      infPill = document.createElement('div');
      infPill.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147481000;padding:8px 14px;border-radius:999px;background:rgba(15,18,17,.92);color:#e7ece9;font:600 12px system-ui,sans-serif;border:.8px solid rgba(52,211,153,.35);box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:none';
      document.body.appendChild(infPill);
    }
    if (infPill.textContent !== txt) infPill.textContent = txt;
  }
  // la page du site défile dans <main>, pas dans la fenêtre
  const scroller = () => { const m = document.querySelector('main'); return m && m.scrollHeight > m.clientHeight ? m : document.scrollingElement; };
  function tplUrl(page) {
    const base = window.__wmpCollUrl || '/api/my-collection?sort=rarity&page=0&stats=0';
    const u = new URL(base, location.origin); u.searchParams.set('page', String(page)); u.searchParams.set('stats', '0');
    return u.pathname + u.search;
  }
  function sigOf() { const u = new URL(window.__wmpCollUrl || '/api/my-collection', location.origin); u.searchParams.delete('page'); u.searchParams.delete('stats'); return u.search; }
  function tickColl() {
    const active = SET.compactToggle && onColl();
    fabButtons(active);
    const pg = pagerEl();
    if (!active || !inf.on) {
      delete document.documentElement.dataset.wmpInf;
      if (pg && pg.dataset.wmpHid) { pg.style.display = ''; delete pg.dataset.wmpHid; }
      pill(''); return;
    }
    const h = collHook(); if (!h) return;
    const arr = h.memoizedState;
    const sig = sigOf();
    // la page a rechargé sa liste (filtre, tri, recherche, autre page) : on repart de là
    const first = arr[0] && arr[0].id;
    if (sig !== inf.sig || first !== inf.first || arr.length < inf.len || !inf.len) {
      const pi = pageInfo();
      // même liste rechargée par le site (après un tag, par exemple) : on remet les pages déjà vues
      // et on revient là où tu étais, au lieu de tout reperdre
      const refill = sig === inf.sig && first === inf.first && arr.length < inf.len && inf.len > 50;
      inf.fill = refill ? inf.next : 0;
      inf.restore = refill ? inf.lastTop : 0;
      inf.sig = sig; inf.first = first; inf.end = false; inf.err = 0;
      inf.next = pi ? pi.page : 1; inf.pages = pi ? pi.pages : 0;
    }
    inf.len = arr.length; // longueur réellement affichée (nos ajouts ne font que l'allonger)
    if (arr.length > 50) document.documentElement.dataset.wmpInf = '1'; else delete document.documentElement.dataset.wmpInf;
    if (pg && !pg.dataset.wmpHid) { pg.dataset.wmpHid = '1'; pg.style.display = 'none'; }
    if (inf.pages && inf.next >= inf.pages) inf.end = true;
    if (inf.end) { pill(arr.length > 50 ? `Toute la sélection est affichée (${fmt(arr.length)} cartes)` : ''); if (arr.length > 50) setTimeout(() => { if (inf.end) pill(''); }, 2500); return; }
    const cards = document.querySelectorAll('main [class*="glow-"]');
    const last = cards[cards.length - 1];
    const sc = scroller();
    if (inf.restore && sc && sc.scrollHeight > inf.restore + sc.clientHeight) { sc.scrollTop = inf.restore; inf.restore = 0; }
    const near = !last || last.getBoundingClientRect().bottom < innerHeight + 1800 || inf.next < (inf.fill || 0);
    if (near && !inf.busy) loadMore(h);
    else if (!inf.busy) pill('');
  }
  async function loadMore(h) {
    inf.busy = true;
    const page = inf.next;
    pill(`Chargement… page ${page + 1}${inf.pages ? ' / ' + inf.pages : ''}`);
    try {
      const r = await fetch(tplUrl(page), { __wmp: true });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const items = (j && j.collection) || [];
      if (sigOf() !== inf.sig) return; // la page a changé entre-temps
      h.queue.dispatch((prev) => { const ids = new Set(prev.map((x) => x.id)); return prev.concat(items.filter((x) => !ids.has(x.id))); });
      inf.next = page + 1; inf.err = 0;
      if (items.length < 50) inf.end = true;
    } catch (e) {
      inf.err++;
      pill(inf.err > 3 ? 'Le site ne répond pas, réessaie en remontant un peu' : 'Le site demande de ralentir, nouvel essai…');
      await new Promise((r) => setTimeout(r, 1500 * inf.err));
    } finally {
      inf.busy = false;
      setTimeout(tickColl, 250);
    }
  }
  function setInfinite(on) {
    inf.on = on; try { localStorage.setItem('wmp_infinite', JSON.stringify(on)); } catch (_) {}
    if (!on) {
      // retour à la pagination : on revient à la page affichée seule
      const h = collHook(); if (h && h.memoizedState.length > 50) h.queue.dispatch((prev) => prev.slice(0, 50));
      inf.len = 0;
    }
    tickColl();
  }

  // ------------------------------------------------------------------
  //  Prix par rareté (à la demande) : ventes récentes de chacune de tes cartes de cette rareté
  // ------------------------------------------------------------------
  const pr = { run: null, done: 0, total: 0, stop: false };
  let panel = null, pRoot = null;
  async function priceRun(r) {
    if (pr.run || !window.__wmpSales) return;
    pr.run = r; pr.done = 0; pr.stop = false; paintPanel();
    const rows = await window.__wmpData.list();
    const ids = [...new Set(rows.filter((x) => x[6] === r).map((x) => x[1]))].filter((id) => !window.__wmpSales.cached(id));
    pr.total = ids.length; paintPanel();
    let i = 0, pause = 0;
    const worker = async () => {
      while (!pr.stop && i < ids.length) {
        const id = ids[i++];
        try { await window.__wmpSales.get(id); }
        catch (e) { if (e && e.status === 429) { i--; pause = Math.min(30000, (pause || 4000) * 1.5); await new Promise((x) => setTimeout(x, pause)); continue; } }
        pause = 0; pr.done++;
        if (pr.done % 4 === 0 || pr.done === pr.total) { window.postMessage({ __wmPlusPrices: true }, location.origin); paintPanel(); }
      }
    };
    await Promise.all([worker(), worker()]);
    window.postMessage({ __wmPlusPrices: true }, location.origin);
    pr.run = null; paintPanel();
  }
  function paintPanel() {
    const lbl = pbtn && pbtn.querySelector('span');
    if (lbl) lbl.textContent = pr.run ? `Prix ${pr.run} ${pr.done}/${pr.total || '…'}` : 'Prix';
    if (!pRoot || panel.style.display === 'none') return;
    const body = pRoot.querySelector('.bd');
    const rows = panelData;
    if (!rows) { body.innerHTML = '<p class="mu">Lecture de ta collection…</p>'; return; }
    body.innerHTML = RANKS.map((r) => {
      const d = rows[r] || { n: 0, todo: 0 };
      const running = pr.run === r;
      const mins = Math.max(1, Math.round(d.todo * 2.5 / 60));
      return `<div class="rr"><span class="rb" style="background:${RCOL[r]}">${r}</span>
        <span class="mid"><b>${RNAME[r]}</b><small>${fmt(d.n)} carte${d.n > 1 ? 's' : ''} · ${d.todo ? `${fmt(d.todo)} à estimer, ~${mins} min` : 'tout est estimé'}</small>
        ${running ? `<i class="pb"><i style="width:${pr.total ? pr.done / pr.total * 100 : 0}%"></i></i>` : ''}</span>
        ${running ? '<button class="st">Arrêter</button>' : `<button class="go" data-r="${r}" ${pr.run || !d.todo ? 'disabled' : ''}>Estimer</button>`}</div>`;
    }).join('');
  }
  let panelData = null;
  async function refreshPanelData() {
    try {
      const rows = await window.__wmpData.list();
      const by = {}; const seen = new Set();
      for (const x of rows) { if (seen.has(x[1])) continue; seen.add(x[1]); const d = by[x[6]] || (by[x[6]] = { n: 0, todo: 0 }); d.n++; if (!window.__wmpSales.cached(x[1])) d.todo++; }
      panelData = by;
    } catch (_) { panelData = {}; }
    paintPanel();
  }
  function openPanel() {
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'wmp-prices';
      panel.style.cssText = 'position:fixed;right:18px;bottom:70px;z-index:2147482500';
      pRoot = panel.attachShadow({ mode: 'open' });
      pRoot.innerHTML = `<style>
        :host{all:initial}*{box-sizing:border-box}
        .p{width:min(380px,calc(100vw - 24px));background:#0f1312;color:#f2f4f3;border:.8px solid rgba(200,208,203,.16);border-radius:18px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);font:13px/1.4 var(--font-heading,system-ui),system-ui,sans-serif}
        h3{margin:0 0 4px;font-size:16px;display:flex;justify-content:space-between;align-items:center}
        .x{all:unset;cursor:pointer;opacity:.6;font-size:16px}
        .mu{color:rgba(242,244,243,.55);margin:0 0 10px;font-size:12px}
        .rr{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:.8px solid rgba(255,255,255,.06)}
        .rb{padding:1px 7px;border-radius:6px;font:800 11px/1.6 system-ui;color:#111;min-width:30px;text-align:center}
        .mid{flex:1;min-width:0;display:flex;flex-direction:column}.mid small{color:rgba(242,244,243,.55)}
        button{all:unset;cursor:pointer;padding:6px 11px;border-radius:9px;font-weight:700;background:rgba(52,211,153,.16);color:#6ee7b7}
        button[disabled]{opacity:.35;cursor:default}.st{background:rgba(248,113,113,.16);color:#fca5a5}
        .pb{display:block;height:4px;border-radius:9px;background:rgba(255,255,255,.08);margin-top:5px;overflow:hidden}.pb i{display:block;height:100%;background:#34d399}
      </style><div class="p"><h3>Prix de ta collection <button class="x" title="Fermer">✕</button></h3>
      <p class="mu">Choisis une rareté : le prix médian des ventes récentes de chacune de tes cartes est calculé, puis affiché sur ta Collection. Les prix restent gardés 7 jours.</p><div class="bd"></div></div>`;
      document.body.appendChild(panel);
      pRoot.querySelector('.x').addEventListener('click', () => { panel.style.display = 'none'; });
      pRoot.querySelector('.bd').addEventListener('click', (e) => {
        const g = e.target.closest('.go'); if (g && !g.disabled) priceRun(g.dataset.r).then(refreshPanelData);
        if (e.target.closest('.st')) pr.stop = true;
      });
    } else panel.style.display = panel.style.display === 'none' ? '' : 'none';
    if (panel.style.display !== 'none') { paintPanel(); refreshPanelData(); }
  }

  // Boutons en bas à droite de la Collection
  let ibtn = null, pbtn = null;
  const IC_SCROLL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 16l5 5 5-5M7 8l5-5 5 5"/></svg>';
  const IC_PRICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
  function fabButtons(active) {
    const fab = document.querySelector('.wmp-fab');
    if (!active || !fab) { if (ibtn) ibtn.remove(); if (pbtn && !pr.run) pbtn.remove(); if (panel && !active) panel.style.display = 'none'; return; }
    if (!ibtn) {
      ibtn = document.createElement('button'); ibtn.className = 'wmp-compact-btn';
      ibtn.addEventListener('click', () => setInfinite(!inf.on));
    }
    const lab = inf.on ? 'Défilement continu : oui' : 'Défilement continu : non';
    if (ibtn.dataset.l !== lab) { ibtn.dataset.l = lab; ibtn.innerHTML = `${IC_SCROLL}<span>${lab}</span>`; ibtn.classList.toggle('done', inf.on); }
    if (ibtn.parentElement !== fab) fab.appendChild(ibtn);
    if (SET.collPrices) {
      if (!pbtn) { pbtn = document.createElement('button'); pbtn.className = 'wmp-compact-btn'; pbtn.innerHTML = `${IC_PRICE}<span>Prix</span>`; pbtn.addEventListener('click', openPanel); paintPanel(); }
      if (pbtn.parentElement !== fab) fab.insertBefore(pbtn, ibtn);
    } else if (pbtn) pbtn.remove();
  }
  document.addEventListener('scroll', (e) => {
    const sc = scroller(); if (sc && (e.target === sc || e.target === document) && sc.scrollTop > 0) inf.lastTop = sc.scrollTop;
  }, { capture: true, passive: true });
  document.addEventListener('scroll', () => { if (inf.on && !inf.busy) { clearTimeout(tickColl.t); tickColl.t = setTimeout(tickColl, 120); } }, true);
  setInterval(tickColl, 1500);
  setTimeout(tickColl, 800);
  window.__wmpOpenView = open;
})();
