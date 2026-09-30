// Chrome (service worker) : charge common.js. Firefox : déjà chargé via background.scripts.
if (typeof WM === 'undefined' && typeof importScripts === 'function') importScripts('common.js');

const MAX_PULLS = 20000;

async function getAll() {
  const r = await chrome.storage.local.get(['settings', 'packState', 'pulls', 'proClaimedDate', 'notifiedFor']);
  return { ...r, settings: { ...WM.DEFAULTS, ...(r.settings || {}) }, pulls: r.pulls || [] };
}

function packsSince(pulls, rarity) {
  for (let i = pulls.length - 1; i >= 0; i--) {
    if (pulls[i].src === 'open' && pulls[i].cards.some((c) => c.r === rarity)) return pulls.length - 1 - i;
  }
  return null;
}

// Écritures sérialisées pour ne perdre aucun tirage si deux arrivent en même temps
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'pull') {
    serial(async () => {
      const { pulls } = await chrome.storage.local.get('pulls');
      const list = pulls || [];
      list.push(msg.record);
      if (list.length > MAX_PULLS) list.splice(0, list.length - MAX_PULLS);
      await chrome.storage.local.set({ pulls: list });
      reply({ sinceL: packsSince(list.filter((p) => p.src === 'open'), 'L') });
    });
    return true;
  }
  if (msg.type === 'packState') {
    serial(async () => { await chrome.storage.local.set({ packState: msg.state }); await schedule(); });
  }
  if (msg.type === 'proClaimed') {
    serial(async () => {
      const { proClaimedDate } = await chrome.storage.local.get('proClaimedDate');
      if (proClaimedDate !== msg.date) await chrome.storage.local.set({ proClaimedDate: msg.date });
    });
  }
  if (msg.type === 'reschedule') serial(schedule);
});

async function schedule() {
  const { settings, packState } = await getAll();
  await chrome.alarms.clear('full');
  const p = WM.predict(packState);
  if (settings.notifyFull && p && p.n < settings.threshold) {
    const when = WM.thresholdAt(packState, settings.threshold);
    if (when) chrome.alarms.create('full', { when: Math.max(when, Date.now() + 30000) });
  }
  // Rappel PRO quotidien
  const next = new Date(); next.setHours(settings.proHour, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  const cur = await chrome.alarms.get('pro');
  if (!cur || Math.abs(cur.scheduledTime - next.getTime()) > 60000) {
    chrome.alarms.create('pro', { when: next.getTime(), periodInMinutes: 1440 });
  }
  await updateBadge();
}

async function updateBadge() {
  const { packState } = await chrome.storage.local.get('packState');
  const p = WM.predict(packState);
  if (!p) { chrome.action.setBadgeText({ text: '' }); return; }
  chrome.action.setBadgeText({ text: String(p.n) });
  chrome.action.setBadgeBackgroundColor({ color: p.n >= p.max ? '#16a34a' : '#4b5563' });
  chrome.action.setTitle({ title: `WikiMasters+ : ~${p.n}/${p.max} paquets` + (p.fullAt ? `, plein dans ${WM.fmtDuration(p.fullAt - Date.now())}` : '') });
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === 'tick') return updateBadge();
  const { settings, packState, proClaimedDate, notifiedFor } = await getAll();
  if (a.name === 'full') {
    const p = WM.predict(packState);
    const cycle = packState && packState.nextAt + ':' + packState.n;
    if (!settings.notifyFull || !p || p.n < settings.threshold || notifiedFor === cycle) return updateBadge();
    await chrome.storage.local.set({ notifiedFor: cycle });
    chrome.notifications.create('wm-full', {
      type: 'basic', iconUrl: 'icons/128.png', priority: 2,
      title: p.n >= p.max ? 'Paquets pleins !' : `${p.n} paquets disponibles`,
      message: p.n >= p.max ? `Tu as ${p.max}/${p.max} paquets, la régénération est en pause.` : 'Ton seuil est atteint.'
    });
    updateBadge();
  }
  if (a.name === 'pro') {
    const isPro = (packState && packState.period === 180000) || settings.regenMode === 'pro';
    if (settings.proReminder && isPro && proClaimedDate !== WM.today()) {
      chrome.notifications.create('wm-pro', {
        type: 'basic', iconUrl: 'icons/128.png', title: 'Pack PRO du jour',
        message: "Tu n'as pas encore réclamé ton pack PRO aujourd'hui."
      });
    }
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  const tabs = await chrome.tabs.query({ url: ['https://www.wiki-masters.com/*', 'https://wiki-masters.com/*'] });
  const t = tabs.find((x) => x.url.includes('/pulls')) || tabs[0];
  if (t) {
    const upd = { active: true };
    if (!t.url.includes('/pulls')) upd.url = 'https://www.wiki-masters.com/pulls';
    chrome.tabs.update(t.id, upd);
    chrome.windows.update(t.windowId, { focused: true });
  }
  else chrome.tabs.create({ url: 'https://www.wiki-masters.com/pulls' });
});

chrome.storage.onChanged.addListener((ch) => { if (ch.settings) serial(schedule); });

function init() { chrome.alarms.create('tick', { periodInMinutes: 1 }); serial(schedule); }
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
