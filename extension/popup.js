const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const chip = (r) => `<span class="chip" style="background:${WM.COLORS[r] || '#9ca3af'}">${esc(r)}</span>`;
const pct = (x) => (x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min';
  if (s < 86400) return Math.round(s / 3600) + ' h';
  return Math.round(s / 86400) + ' j';
};

// Onglets
document.querySelectorAll('nav button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('[data-panel]').forEach((p) => p.hidden = p.dataset.panel !== b.dataset.tab);
});

async function render() {
  const d = await chrome.storage.local.get(['pulls', 'packState', 'settings', 'siteRates']);
  const pulls = d.pulls || [];
  const settings = { ...WM.DEFAULTS, ...(d.settings || {}) };

  // Paquets
  const p = WM.predict(d.packState);
  $('#packs').innerHTML = p
    ? `<div class="big">${p.n}<small>/${p.max}</small></div>
       <div style="flex:1">
         <div class="pbar">${Array.from({ length: p.max }, (_, i) => `<i class="${i < p.n ? 'f' : ''}"></i>`).join('')}</div>
         <div class="sub" style="margin-top:6px">${p.n >= p.max ? 'Plein, la régénération est en pause' : `Prochain dans ${WM.fmtDuration(p.nextAt - Date.now())}, plein dans ${WM.fmtDuration(p.fullAt - Date.now())}`}</div>
       </div>`
    : `<div class="sub">Ouvre la page <b>Ouvrir un paquet</b> une fois pour que l'estimation démarre.</div>`;

  // Stats
  const opens = pulls.filter((x) => x.src === 'open');
  const cards = pulls.flatMap((x) => x.cards);
  const counts = Object.fromEntries(WM.RARITIES.map((r) => [r, 0]));
  cards.forEach((c) => { if (c.r in counts) counts[c.r]++; });
  const shiny = cards.filter((c) => c.s).length;

  $('#kpis').innerHTML = `
    <div class="kpi"><b>${pulls.length}</b><span>paquets suivis</span></div>
    <div class="kpi"><b>${cards.length}</b><span>cartes tirées</span></div>
    <div class="kpi"><b>${shiny}</b><span>shiny</span></div>`;

  const maxShare = Math.max(0.0001, ...WM.RARITIES.map((r) => counts[r] / (cards.length || 1)));
  $('#rarity').innerHTML = cards.length ? WM.RARITIES.map((r) => {
    const share = counts[r] / cards.length;
    const ref = d.siteRates && d.siteRates[r] != null ? d.siteRates[r] / 100 : null;
    const scale = Math.max(maxShare, ref || 0);
    return `<div class="rrow">${chip(r)}
      <div class="track"><div class="fill" style="width:${(share / scale) * 100}%;background:${WM.COLORS[r]}"></div>
      ${ref != null ? `<div class="ref" style="left:calc(${(ref / scale) * 100}% - 1px)" title="Collection : ${ref * 100} %"></div>` : ''}</div>
      <div class="val">${counts[r]} <small>${pct(share)}</small></div></div>`;
  }).join('') : '<div class="empty">Aucun tirage enregistré pour l’instant.</div>';

  const since = (r) => {
    for (let i = opens.length - 1; i >= 0; i--) if (opens[i].cards.some((c) => c.r === r)) return opens.length - 1 - i;
    return opens.length ? '≥ ' + opens.length : '–';
  };
  $('#streaks').innerHTML = ['L', 'UR', 'SR'].map((r) =>
    `<div>Sans ${chip(r)}<br><b>${since(r)}</b> paquets</div>`).join('') +
    `<div>Sans shiny<br><b>${(() => { for (let i = opens.length - 1; i >= 0; i--) if (opens[i].cards.some((c) => c.s)) return opens.length - 1 - i; return opens.length ? '≥ ' + opens.length : '–'; })()}</b> paquets</div>`;

  // Historique
  const best = pulls.flatMap((x) => x.cards.map((c) => ({ ...c, t: x.t })))
    .filter((c) => (WM.RANK[c.r] ?? 9) <= 2 || c.s)
    .sort((a, b) => b.t - a.t).slice(0, 25);
  $('#best').innerHTML = best.length ? best.map((c) =>
    `<li>${chip(c.r)}<span class="n">${esc(c.name)}</span><span class="d">${ago(c.t)}</span></li>`).join('')
    : '<li class="empty">Pas encore de SR, UR ou L.</li>';

  $('#recent').innerHTML = pulls.slice(-10).reverse().map((x) =>
    `<li><span class="dots">${[...x.cards].sort((a, b) => (WM.RANK[a.r] ?? 9) - (WM.RANK[b.r] ?? 9))
      .map((c) => `<i title="${esc(c.r + ' · ' + c.name)}" style="background:${WM.COLORS[c.r] || '#555'}${c.s ? ';outline:2px solid #fff' : ''}"></i>`).join('')}</span>
      <span class="d">${x.src !== 'open' ? esc(x.src) + ' · ' : ''}${ago(x.t)}</span></li>`).join('')
    || '<li class="empty">Aucun paquet.</li>';

  // Réglages
  document.querySelectorAll('[data-k]').forEach((el) => {
    const k = el.dataset.k;
    if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = settings[k];
  });
}

document.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('change', async () => {
  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...WM.DEFAULTS, ...(settings || {}) };
  const k = el.dataset.k;
  if (el.type === 'checkbox') s[k] = el.checked;
  else if (el.type === 'number') s[k] = Math.min(+el.max, Math.max(+el.min, parseInt(el.value, 10) || +el.min));
  else s[k] = el.value;
  await chrome.storage.local.set({ settings: s });
}));

$('#export').onclick = async () => {
  const { pulls = [] } = await chrome.storage.local.get('pulls');
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['date', 'source', 'id', 'nom', 'rarete', 'shiny', 'exemplaires']];
  pulls.forEach((p) => p.cards.forEach((c) => rows.push([new Date(p.t).toISOString(), p.src, c.id, c.name, c.r, c.s ? 1 : 0, c.o])));
  const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `wikimasters-tirages-${WM.today()}.csv` });
  a.click();
};

$('#reset').onclick = async () => {
  if (!confirm('Effacer tout l’historique de tirages enregistré par l’extension ?')) return;
  await chrome.storage.local.set({ pulls: [] });
  render();
};

$('#clearCache').onclick = async () => {
  await chrome.storage.local.set({ cacheClearReq: Date.now(), cacheStats: { entries: 0, bytes: 0, at: Date.now() } });
  $('#clearCache').textContent = 'Cache vidé ✓';
  setTimeout(() => { $('#clearCache').textContent = ''; renderCache(); }, 1500);
};
async function renderCache() {
  const { cacheStats } = await chrome.storage.local.get('cacheStats');
  const el = $('#clearCache');
  if (/^Cache vidé/.test(el.textContent)) return;
  if (!cacheStats) { el.textContent = 'Vider le cache'; return; }
  const kb = cacheStats.bytes / 1024;
  el.textContent = `Vider le cache (${cacheStats.entries} réponses, ${kb > 1024 ? (kb / 1024).toFixed(1) + ' Mo' : Math.round(kb) + ' Ko'})`;
}
renderCache();
chrome.storage.onChanged.addListener((ch) => { if (ch.cacheStats) renderCache(); });
chrome.storage.onChanged.addListener(render);
render();
setInterval(render, 15000);
