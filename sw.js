/* Service worker do FitLab.
 * Estratégia: REDE PRIMEIRO para os arquivos do app (sempre pega a versão
 * publicada quando há internet) e CACHE como reserva para funcionar offline.
 * Troque VERSAO a cada publicação para forçar a atualização nos aparelhos. */
const VERSAO = '2026-10-05.1';
const CACHE = 'fitlab-' + VERSAO;
const ASSETS = ['./', './index.html', './styles.css', './data.js', './historico.js', './engine.js', './app.js', './ui-treino.js', './ui-dieta.js', './ui-corpo.js', './ui-mais.js', './export.js', './sync.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/badge-96.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o cache HTTP do navegador/CDN e baixa os arquivos novos
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const antigos = (await caches.keys()).filter((k) => k !== CACHE);
    await Promise.all(antigos.map((k) => caches.delete(k)));
    await self.clients.claim();
    // substituiu uma versão anterior: recarrega as telas abertas para já mostrar a nova
    if (antigos.length) {
      const janelas = await self.clients.matchAll({ type: 'window' });
      janelas.forEach((c) => { try { c.navigate(c.url); } catch (err) { /* navegador sem suporte */ } });
    }
  })());
});
self.addEventListener('message', (e) => {
  if (e.data === 'versao' && e.source) { e.source.postMessage({ versao: VERSAO }); return; }
  const d = e.data || {};
  // cronômetro de descanso: o waitUntil mantém o SW vivo até o fim do descanso (até ~5 min no Chrome)
  if (d.tipo === 'timer') { const gen = ++timerGen; e.waitUntil(rodarTimer(gen, d)); }
  if (d.tipo === 'timerParar') { timerGen++; e.waitUntil(fecharTimer()); }
});

/* ---------- Cronômetro de descanso em segundo plano ---------- */
const TTAG = 'fitlab-timer';
let timerGen = 0;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const hhmm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const appVisivel = async () => (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).some((c) => c.visibilityState === 'visible');
async function fecharTimer() { (await self.registration.getNotifications({ tag: TTAG })).forEach((n) => n.close()); }
async function rodarTimer(gen, d) {
  const base = { tag: TTAG, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url: d.url || './' }, lang: 'pt-BR' };
  while (gen === timerGen) {
    const rest = d.fim - Date.now();
    const visivel = await appVisivel();
    if (gen !== timerGen) return;
    if (rest <= 500) {
      if (visivel) return fecharTimer(); // o app aberto já toca o aviso
      return self.registration.showNotification('✅ Descanso encerrado', { ...base, body: d.prox || 'Hora da próxima série', renotify: true, silent: false, requireInteraction: true, vibrate: [300, 150, 300, 150, 300] });
    }
    if (visivel) await fecharTimer();
    else await self.registration.showNotification(`⏱ Descanso ${mmss(rest)}`, { ...base, body: `Termina às ${hhmm(d.fim)}${d.prox ? ' · ' + d.prox : ''}`, renotify: false, silent: true });
    // atualiza a contagem a cada 5 s e acorda exatamente no fim
    await espera(Math.min(5000, Math.max(250, rest - 400)));
  }
}
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const j = janelas[0];
    if (j) { await j.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API do GitHub e CDNs: direto na rede
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' }); // revalida com o servidor
      if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    }
  })());
});
