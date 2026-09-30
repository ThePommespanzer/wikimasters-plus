// Panneau WikiMasters+ intégré directement dans la page /pulls, sous le compteur de paquets.
(() => {
  let settings = { ...WM.DEFAULTS };
  let pulls = [];
  let packState = null;

  chrome.storage.local.get(['settings', 'pulls', 'packState'], (r) => {
    settings = { ...WM.DEFAULTS, ...(r.settings || {}) };
    pulls = r.pulls || [];
    packState = r.packState || null;
    render();
  });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.settings) settings = { ...WM.DEFAULTS, ...(ch.settings.newValue || {}) };
    if (ch.pulls) pulls = ch.pulls.newValue || [];
    if (ch.packState) packState = ch.packState.newValue || null;
    render();
  });

  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const chip = (r) => `<span class="chip" style="background:${WM.COLORS[r] || '#9ca3af'}">${esc(r)}</span>`;

  const host = document.createElement('div');
  host.id = 'wm-plus-panel';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
  <style>
    :host{all:initial;display:block;width:100%;--acc:#34d399}
    .box{background:rgba(19,22,21,.88);border:.8px solid rgba(200,208,203,.12);border-radius:16px;padding:12px 14px;
      color:#f2f4f3;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-sizing:border-box}
    .head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
    .title{font-weight:700;font-size:13px}
    .title b{color:var(--acc)}
    .sub{font-size:11px;color:rgba(242,244,243,.45)}
    .regen{display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:10px}
    .regen .bar{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}
    .regen .bar i{display:block;height:100%;background:var(--acc);border-radius:3px;transition:width .6s}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
    .cell{background:rgba(255,255,255,.035);border-radius:10px;padding:6px 8px;font-size:11px;color:rgba(242,244,243,.55)}
    .cell b{display:block;font-size:16px;color:#f2f4f3;font-variant-numeric:tabular-nums}
    .chip{display:inline-block;min-width:22px;text-align:center;font-weight:800;font-size:10px;padding:1px 4px;border-radius:5px;color:#111;vertical-align:1px}
    h5{margin:12px 0 6px;font-size:11px;color:rgba(242,244,243,.45);font-weight:600}
    .packs{display:flex;flex-direction:column;gap:4px}
    .pk{display:flex;align-items:center;gap:6px}
    .pk .dots{display:flex;gap:3px;flex:1}
    .pk .dots i{width:14px;height:14px;border-radius:4px}
    .pk .t,.it .t{font-size:11px;color:rgba(242,244,243,.4);flex:none}
    .it{display:flex;align-items:center;gap:6px;padding:2px 0}
    .it .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .empty{font-size:12px;color:rgba(242,244,243,.45)}
    .rates{display:flex;flex-direction:column;gap:4px;margin-bottom:4px}
    .rt{display:grid;grid-template-columns:26px 1fr 46px 30px;align-items:center;gap:6px;font-size:11px}
    .rt .tr{height:6px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}
    .rt .tr i{display:block;height:100%;border-radius:3px}
    .rt .pc{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
    .rt .nb{text-align:right;color:rgba(242,244,243,.4);font-variant-numeric:tabular-nums}
    .today{margin:2px 0 4px;padding:10px;border-radius:12px;background:rgba(255,255,255,.035);border:.8px solid rgba(200,208,203,.08)}
    .td-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
    .td-h .l{font-size:11px;font-weight:700;color:rgba(242,244,243,.5);text-transform:uppercase;letter-spacing:.08em}
    .td-h .n{font-size:12px;color:rgba(242,244,243,.55)}
    .td-h .n b{color:#f2f4f3;font-size:14px;font-variant-numeric:tabular-nums}
    .td-mix{display:flex;height:5px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.06);margin-bottom:8px}
    .td-mix i{display:block;height:100%}
    .td-best{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:8px 10px 9px;border-radius:9px;overflow:hidden;
      background:linear-gradient(90deg,color-mix(in srgb,var(--c) 22%,transparent),transparent 85%);border-left:3px solid var(--c)}
    .td-best .k{font-size:10px;color:rgba(242,244,243,.5);text-transform:uppercase;letter-spacing:.08em;flex:none}
    .td-best .nm{flex:1 0 100%;order:5;font-weight:700;font-size:14px;line-height:1.3;white-space:normal;overflow-wrap:anywhere;color:#f2f4f3}
    .td-best .sh{flex:none;margin-left:auto;font-size:10px;color:#e9c15a;border:.8px solid rgba(233,193,90,.5);border-radius:4px;padding:0 4px}
    .td-foot{display:flex;gap:10px;margin-top:7px;font-size:11px;color:rgba(242,244,243,.45)}
    .td-foot b{color:#34d399;font-weight:600}
  </style>
  <div class="box"></div>`;
  const box = root.querySelector('.box');

  function anchor() {
    const frame = [...document.querySelectorAll('main .card-frame')].find((f) => /paquets? disponibles?/i.test(f.textContent));
    return frame ? frame.parentElement : null;
  }

  function mount() {
    if (!settings.pagePanel || !location.pathname.startsWith('/pulls')) { host.remove(); return false; }
    const col = anchor();
    if (!col) return false;
    if (host.parentElement !== col || col.lastElementChild !== host) col.appendChild(host);
    // Aligne la largeur sur les autres blocs de la colonne
    const ref = [...col.children].filter((c) => c !== host).reduce((w, c) => Math.max(w, c.getBoundingClientRect().width), 0);
    host.style.width = Math.max(300, Math.round(ref)) + 'px';
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
    if (acc) host.style.setProperty('--acc', acc);
    return true;
  }

  function render() {
    if (!mount()) return;
    const p = WM.predict(packState);
    let regen = '';
    if (!settings.restyle && p && (p.n >= p.max || p.fullAt)) {
      const full = p.n >= p.max;
      const pctFull = full ? 100 : Math.round(((p.max - Math.max(0, p.fullAt - Date.now()) / p.period) / p.max) * 100);
      regen = `<div class="regen"><span>${full ? 'Plein, la régénération est en pause' : 'Plein dans <b>' + WM.fmtDuration(p.fullAt - Date.now()) + '</b>'}</span>
        <div class="bar"><i style="width:${Math.max(0, Math.min(100, pctFull))}%"></i></div></div>`;
    }

    const opens = pulls.filter((x) => x.src === 'open');
    const allCards = pulls.flatMap((x) => x.cards);
    const counts = Object.fromEntries(WM.RARITIES.map((r) => [r, 0]));
    allCards.forEach((c) => { if (c.r in counts) counts[c.r]++; });
    const maxShare = Math.max(...WM.RARITIES.map((r) => counts[r] / (allCards.length || 1)), 0.0001);
    const fmtPct = (x) => (x * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
    const rates = `<h5>Taux de drop <span style="float:right;text-transform:none;letter-spacing:0">${allCards.length} cartes ouvertes</span></h5>
      <div class="rates">${WM.RARITIES.map((r) => {
        const share = counts[r] / (allCards.length || 1);
        return `<div class="rt">${chip(r)}<span class="tr"><i style="width:${Math.max(share > 0 ? 3 : 0, share / maxShare * 100)}%;background:${WM.COLORS[r]}"></i></span>
          <span class="pc">${fmtPct(share)}</span><span class="nb">${counts[r]}</span></div>`;
      }).join('')}</div>`;
    const streaks = `<div class="grid">
      <div class="cell">Sans ${chip('L')}<b>${WM.since(pulls, (c) => c.r === 'L')}</b></div>
      <div class="cell">Sans ${chip('UR')}<b>${WM.since(pulls, (c) => c.r === 'UR')}</b></div>
      <div class="cell">Sans ${chip('SR')}<b>${WM.since(pulls, (c) => c.r === 'SR')}</b></div>
      <div class="cell">Sans shiny<b>${WM.since(pulls, (c) => c.s)}</b></div>
    </div>`;

    const last = pulls.slice(-5).reverse().map((x) => `<div class="pk"><span class="dots">${
      [...x.cards].sort((a, b) => (WM.RANK[a.r] ?? 9) - (WM.RANK[b.r] ?? 9)).map((c) =>
        `<i title="${esc(c.r + ' · ' + c.name)}" style="background:${WM.COLORS[c.r] || '#555'}${c.s ? ';box-shadow:0 0 0 2px #fff inset' : ''}"></i>`).join('')
    }</span><span class="t">${WM.ago(x.t)}</span></div>`).join('');

    const best = pulls.flatMap((x) => x.cards.map((c) => ({ ...c, t: x.t })))
      .filter((c) => (WM.RANK[c.r] ?? 9) <= 2 || c.s).slice(-4).reverse()
      .map((c) => `<div class="it">${chip(c.r)}<span class="n">${esc(c.name)}</span><span class="t">${WM.ago(c.t)}</span></div>`).join('');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayPulls = opens.filter((x) => x.t >= today.getTime());
    const todayCards = todayPulls.flatMap((x) => x.cards.map((c) => ({ ...c, t: x.t })));
    // meilleure rareté, puis shiny, puis la plus récente en cas d'égalité
    const todayBest = [...todayCards].sort((a, b) => ((WM.RANK[a.r] ?? 9) - (WM.RANK[b.r] ?? 9)) || (b.s - a.s) || (b.t - a.t))[0];
    const todayNew = todayCards.filter((c) => c.o === 1).length;
    const todayShiny = todayCards.filter((c) => c.s).length;
    const todayMix = WM.RARITIES.slice().reverse().map((r) => {
      const n = todayCards.filter((c) => c.r === r).length;
      return n ? `<i title="${r} : ${n}" style="width:${n / todayCards.length * 100}%;background:${WM.COLORS[r]}"></i>` : '';
    }).join('');
    const todayHtml = `<div class="today">
      <div class="td-h"><span class="l">Aujourd'hui</span><span class="n"><b>${todayPulls.length}</b> paquet${todayPulls.length > 1 ? 's' : ''} · <b>${todayCards.length}</b> cartes</span></div>
      ${todayCards.length ? `<div class="td-mix">${todayMix}</div>
      <div class="td-best" style="--c:${WM.COLORS[todayBest.r] || '#9ca3af'}"><span class="k">Meilleure</span>${chip(todayBest.r)}<span class="nm" title="${esc(todayBest.name)}">${esc(todayBest.name)}</span>${todayBest.s ? '<span class="sh">shiny</span>' : ''}</div>
      ${todayNew || todayShiny ? `<div class="td-foot">${todayNew ? `<span><b>${todayNew}</b> nouvelle${todayNew > 1 ? 's' : ''}</span>` : ''}${todayShiny ? `<span><b style="color:#e9c15a">${todayShiny}</b> shiny</span>` : ''}</div>` : ''}`
      : '<div class="td-h" style="margin:0"><span class="n">Pas encore de paquet ouvert aujourd\'hui.</span></div>'}
    </div>`;

    box.innerHTML = `
      <div class="head"><span class="title"><b>✦</b> WikiMasters+</span><span class="sub">${pulls.length} paquets · ${allCards.length} cartes</span></div>
      ${regen}
      ${pulls.length ? `${todayHtml}${rates}<h5>Séries en cours</h5>${streaks}
        <h5>Derniers paquets</h5><div class="packs">${last}</div>
        ${best ? `<h5>Dernières grosses cartes</h5>${best}` : ''}`
      : '<div class="empty">Ouvre un paquet pour commencer à suivre tes tirages.</div>'}`;
  }

  // Le site est une appli React : on se réinsère si la page est re-rendue ou si on change de route.
  setInterval(render, 5000);
  new MutationObserver(() => { if (settings.pagePanel && location.pathname.startsWith('/pulls') && !host.isConnected) render(); })
    .observe(document.body, { childList: true, subtree: true });
})();
