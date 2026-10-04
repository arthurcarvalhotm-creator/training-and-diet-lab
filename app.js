/* =====================================================================
 * FitLab — Núcleo da interface
 * Estado (localStorage), roteador, componentes, gráficos SVG, perfis,
 * início, registro rápido, tema e PWA. Os módulos ui-*.js registram
 * suas rotas em App.route().
 * ===================================================================== */
window.App = (function () {
  'use strict';
  const DB = window.FIT_DB, E = window.Engine;
  const KEY = 'fitlab.v1';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  const n1 = (v) => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const fmtData = (iso, comAno) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}${comAno ? '/' + y : ''}`; };
  const fmtDataLonga = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
  const hoje = E.hoje;

  /* ================= Estado ================= */
  const vazio = () => ({
    versao: 1, perfilAtivo: null, perfis: [], avaliacoes: [], medidas: [], alimentosCustom: [], exerciciosCustom: [], dietas: [], diario: [],
    programas: [], ciclos: [], sessoes: [], aerobicos: [], suplementos: [], tomadas: [],
    config: { tema: 'auto', descansoPadrao: 90, escala: 'rir', diasTreino: [1, 2, 3, 4, 5], somTimer: true, aguaCopo: 250 }
  });
  let S = vazio();
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(vazio(), JSON.parse(raw)); } catch (e) { console.warn('estado inválido', e); }
    S.config = Object.assign(vazio().config, S.config || {});
  }
  let saveT = null;
  const hooks = { salvo: [], boot: [] };
  function saveNow() { clearTimeout(saveT); saveT = null; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Falha ao salvar: ' + e.message); } }
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { saveNow(); hooks.salvo.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } }); }, 50); }
  const uid = E.uid;

  /* ---- Perfis ---- */
  const perfil = () => S.perfis.find((p) => p.id === S.perfilAtivo) || S.perfis[0] || null;
  const mine = (col) => (S[col] || []).filter((x) => x.perfilId === (perfil() || {}).id);
  function idade(p) {
    p = p || perfil(); if (!p) return null;
    if (p.nascimento) { const d = new Date(p.nascimento + 'T12:00:00'), t = new Date(); let a = t.getFullYear() - d.getFullYear(); if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }
    return Number(p.idade) || null;
  }
  const ultimaAvaliacao = () => mine('avaliacoes').sort((a, b) => a.data < b.data ? 1 : -1)[0] || null;
  const ultimoPeso = () => {
    const m = mine('medidas').filter((x) => x.peso).sort((a, b) => a.data < b.data ? 1 : -1)[0];
    const a = mine('avaliacoes').filter((x) => x.peso).sort((a, b) => a.data < b.data ? 1 : -1)[0];
    if (m && a) return m.data >= a.data ? m : a; return m || a || null;
  };
  const dietaAtiva = () => mine('dietas').find((d) => d.ativo) || null;
  const programaAtivo = () => mine('programas').find((p) => p.ativo) || null;
  const cicloAtivo = () => mine('ciclos').find((c) => c.ativo) || null;

  /* ---- Mapas de biblioteca (com customizados) ---- */
  const exMap = () => { const m = new Map(DB.exercicios.map((e) => [e.id, e])); S.exerciciosCustom.forEach((e) => m.set(e.id, e)); return m; };
  const alMap = () => E.mapaAlimentos(S.alimentosCustom);
  const metodo = (id) => DB.metodos.find((m) => m.id === id) || DB.metodos[0];
  const grupoNome = (id) => (DB.grupoMap[id] || {}).nome || id;
  const aparelhoNome = (id) => (DB.aparelhos.find((a) => a.id === id) || {}).nome || id;

  /* ================= Roteador ================= */
  const routes = [];
  function route(pattern, handler) { routes.push({ parts: pattern.split('/'), handler }); }
  let stack = [];
  function parseHash() {
    const raw = (location.hash || '#/inicio').slice(2);
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {}; (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { parts: parts.length ? parts : ['inicio'], query, path };
  }
  function match(parts) {
    for (const r of routes) {
      if (r.parts.length !== parts.length) continue;
      const params = {}; let ok = true;
      for (let i = 0; i < parts.length; i++) { if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = parts[i]; else if (r.parts[i] !== parts[i]) { ok = false; break; } }
      if (ok) return { handler: r.handler, params };
    }
    return null;
  }
  const go = (hash) => { location.hash = hash.startsWith('#') ? hash : '#/' + hash; };
  const back = () => { if (stack.length > 1) { stack.pop(); const prev = stack.pop(); location.hash = prev; } else go('inicio'); };
  const ROOTS = ['inicio', 'treino', 'registrar', 'dieta', 'mais'];
  let acts = {};
  const on = (name, fn) => { acts[name] = fn; };
  let ultimoHash = null;
  function render() {
    const { parts, query } = parseHash();
    const view = $('#view');
    acts = {};
    closeModal();
    if (!perfil() && parts[0] !== 'sync') { onboarding(); return; }
    const m = match(parts);
    const cur = location.hash;
    if (stack[stack.length - 1] !== cur) stack.push(cur); if (stack.length > 40) stack.shift();
    const root = parts[0];
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.route === root || (root === 'programa' || root === 'sessao' || root === 'ciclo' || root === 'exercicio' || root === 'aerobico' || root === 'gerar-programa' || root === 'gerar-ciclo' ? a.dataset.route === 'treino' : (root === 'plano' || root === 'alimento' || root === 'gerar-dieta' || root === 'suplementos' || root === 'alimentos') ? a.dataset.route === 'dieta' : (root === 'corpo' || root === 'avaliacao' || root === 'biblioteca' || root === 'perfil' || root === 'sync') ? a.dataset.route === 'mais' : false)));
    $('#btnBack').hidden = ROOTS.includes(root);
    $('#btnPerfil').textContent = '👤 ' + ((perfil() || {}).nome || '').split(' ')[0];
    if (!m) { view.innerHTML = '<div class="empty"><div class="big">🤷</div>Página não encontrada.</div>'; return; }
    setTitle('FitLab');
    // redesenho da mesma tela (marcar série, adicionar item…) mantém a posição; tela nova começa no topo
    const mesmaTela = cur === ultimoHash, y = window.scrollY;
    const out = m.handler(m.params, query);
    if (typeof out === 'string') view.innerHTML = out;
    window.scrollTo(0, mesmaTela ? y : 0);
    ultimoHash = cur;
    if (acts.__after) acts.__after();
  }
  const setTitle = (t) => { $('#title').textContent = t; document.title = t === 'FitLab' ? 'FitLab — Treinos e Dietas' : t + ' · FitLab'; };

  /* Delegação de eventos: data-act="nome" (click), data-on="change|input" */
  function delegate() {
    const view = $('#view'), modal = $('#modal');
    const handler = (evtName) => (ev) => {
      let el = ev.target.closest('[data-act]');
      while (el) {
        const evt = el.dataset.on || 'click';
        if (evt === evtName || (evtName === 'click' && evt === 'click')) {
          const fn = acts[el.dataset.act];
          if (fn) { if (el.tagName === 'A' && !el.getAttribute('href')) ev.preventDefault(); fn(el, ev); return; }
        }
        el = el.parentElement ? el.parentElement.closest('[data-act]') : null;
      }
    };
    [view, modal].forEach((root) => {
      root.addEventListener('click', handler('click'));
      root.addEventListener('change', handler('change'));
      root.addEventListener('input', handler('input'));
      root.addEventListener('submit', (ev) => { const f = ev.target.closest('form[data-act]'); if (f && acts[f.dataset.act]) { ev.preventDefault(); acts[f.dataset.act](f, ev); } });
    });
  }

  /* ================= Componentes ================= */
  function toast(msg, ms) {
    const t = $('#toast'); t.innerHTML = `<div class="toast">${h(msg)}</div>`;
    clearTimeout(t._t); t._t = setTimeout(() => { t.innerHTML = ''; }, ms || 2200);
  }
  function modal({ title, body, foot, wide, onClose }) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-bg" data-act="__modalBg"><div class="sheet" ${wide ? 'style="max-width:900px"' : ''}><div class="handle"></div>
      <div class="sheet-head"><h2>${h(title)}</h2><button class="btn sm ghost" data-act="__modalClose" aria-label="Fechar">✕</button></div>
      <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div></div>`;
    acts.__modalBg = (el, ev) => { if (ev && ev.target !== el) return; closeModal(); if (onClose) onClose(); };
    acts.__modalClose = () => { closeModal(); if (onClose) onClose(); };
    document.body.style.overflow = 'hidden';
    const first = m.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
    if (first && window.innerWidth > 720) setTimeout(() => first.focus(), 50);
    return m;
  }
  function closeModal() { const m = $('#modal'); if (m.innerHTML) { m.innerHTML = ''; document.body.style.overflow = ''; } }
  function confirmar(msg, onOk, opts) {
    modal({ title: (opts && opts.title) || 'Confirmar', body: `<p>${h(msg)}</p>`, foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn ${opts && opts.danger ? 'danger' : 'primary'}" data-act="__ok">${h((opts && opts.ok) || 'Confirmar')}</button>` });
    acts.__ok = () => { closeModal(); onOk(); };
  }
  /* Lê campos [name] de um container para um objeto */
  function formData(root) {
    const o = {};
    $$('[name]', root).forEach((el) => {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
      else o[el.name] = el.value;
    });
    return o;
  }
  const field = (label, input, help) => `<label class="field"><span class="lbl">${label}</span>${input}${help ? `<div class="help">${help}</div>` : ''}</label>`;
  const inp = (name, val, attrs) => `<input name="${name}" value="${h(val == null ? '' : val)}" ${attrs || ''}>`;
  const num = (name, val, attrs) => `<input type="number" name="${name}" value="${val == null || val === '' ? '' : h(val)}" ${attrs || 'step="any"'}>`;
  const sel = (name, opts, val, attrs) => `<select name="${name}" ${attrs || ''}>${opts.map((o) => `<option value="${h(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${h(o[1])}</option>`).join('')}</select>`;
  const chips = (items, onId, act, attr) => `<div class="chips">${items.map((i) => `<button type="button" class="chip ${i.on ? 'on' : ''}" data-act="${act}" data-${attr || 'id'}="${h(i.id)}">${h(i.nome)}</button>`).join('')}</div>`;
  const badge = (txt, cls) => `<span class="badge ${cls || ''}">${txt}</span>`;
  const empty = (ico, txt, extra) => `<div class="empty"><div class="big">${ico}</div>${txt}${extra ? `<div class="mt">${extra}</div>` : ''}</div>`;
  const tabs = (items, cur) => `<div class="tabs">${items.map((t) => `<a class="tab ${t.id === cur ? 'on' : ''}" href="${t.href}">${t.nome}</a>`).join('')}</div>`;
  const progBar = (v, max, cls) => { const p = max > 0 ? Math.min(100, v / max * 100) : 0; return `<div class="prog"><i class="${cls || ''} ${max > 0 && v > max * 1.1 ? 'over' : ''}" style="width:${p}%"></i></div>`; };
  const macroRow = (nome, v, meta, cls, unid) => `<div class="macro-row"><span>${nome}</span>${progBar(v, meta, cls)}<b>${n0(v)}${meta ? ' / ' + n0(meta) : ''} ${unid || 'g'}</b></div>`;

  /* ================= Gráficos SVG ================= */
  const larguraGrafico = () => Math.max(280, Math.min(840, Math.round((document.documentElement.clientWidth || window.innerWidth || 640) - 70)));
  function lineChart({ series, height, yMin, yMax, unidade, labels }) {
    const W = larguraGrafico(), H = height || 220, px = 40, py = 16, pb = 28;
    const all = series.flatMap((s) => s.pontos.map((p) => p.y)).filter((v) => v != null);
    if (!all.length) return '<div class="empty">Sem dados suficientes.</div>';
    let lo = yMin != null ? yMin : Math.min(...all), hi = yMax != null ? yMax : Math.max(...all);
    if (hi === lo) { hi += 1; lo -= 1; } const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const xs = series.flatMap((s) => s.pontos.map((p) => p.x));
    const xmin = Math.min(...xs), xmax = Math.max(...xs) || 1;
    const X = (x) => px + (xmax === xmin ? 0.5 : (x - xmin) / (xmax - xmin)) * (W - px - 10);
    const Y = (y) => py + (1 - (y - lo) / (hi - lo)) * (H - py - pb);
    let g = '<g class="grid">';
    for (let i = 0; i <= 4; i++) { const y = py + i * (H - py - pb) / 4; const v = hi - i * (hi - lo) / 4; g += `<line x1="${px}" x2="${W - 10}" y1="${y}" y2="${y}"/><text x="${px - 6}" y="${y + 4}" text-anchor="end">${n1(v)}</text>`; }
    g += '</g>';
    const lines = series.map((s) => {
      const pts = s.pontos.filter((p) => p.y != null).map((p) => [X(p.x), Y(p.y)]);
      if (!pts.length) return '';
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = s.area ? `<path class="area" d="${d} L${pts[pts.length - 1][0]} ${Y(lo)} L${pts[0][0]} ${Y(lo)} Z"/>` : '';
      const dots = s.dots === false ? '' : pts.map((p, i) => `<circle class="pt ${s.cls || ''}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5"><title>${h(s.pontos.filter((q) => q.y != null)[i].label || '')}</title></circle>`).join('');
      return area + `<path class="line ${s.cls || ''}" d="${d}"/>` + dots;
    }).join('');
    const lab = (labels || []).map((l) => `<text x="${X(l.x)}" y="${H - 8}" text-anchor="middle">${h(l.t)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}${lines}${lab}${unidade ? `<text x="${W - 10}" y="12" text-anchor="end">${h(unidade)}</text>` : ''}</svg>`;
  }
  function barChart({ valores, height, meta, cls }) { // valores: [{label, v, cls?}]
    const W = larguraGrafico(), H = height || 180, px = 36, py = 14, pb = 26;
    const bruto = Math.max(1, ...valores.map((v) => v.v), meta || 0) * 1.1;
    const max = bruto < 10 ? Math.ceil(bruto / 3) * 3 : bruto; // contagens pequenas: marcas inteiras
    const n = valores.length || 1, bw = (W - px - 10) / n;
    const passoRot = Math.max(1, Math.ceil(n * 38 / (W - px - 10))); // rótulos sem sobreposição
    const Y = (v) => py + (1 - v / max) * (H - py - pb);
    let g = '<g class="grid">';
    const fmtEixo = (v) => v >= 10000 ? n0(v / 1000) + 'k' : max < 10 ? n1(v) : n0(v);
    for (let i = 0; i <= 3; i++) { const y = py + i * (H - py - pb) / 3; g += `<line x1="${px}" x2="${W - 10}" y1="${y}" y2="${y}"/><text x="${px - 6}" y="${y + 4}" text-anchor="end">${fmtEixo(max - i * max / 3)}</text>`; }
    g += '</g>';
    const bars = valores.map((v, i) => `<rect class="bar ${v.cls || cls || ''}" x="${(px + i * bw + bw * 0.15).toFixed(1)}" y="${Y(v.v).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(Y(0) - Y(v.v)).toFixed(1)}" rx="3"><title>${h(v.label)}: ${n1(v.v)}</title></rect><text x="${(px + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${i % passoRot === 0 || i === n - 1 && n - 1 - i < passoRot ? h(v.label) : ''}</text>`).join('');
    const m = meta ? `<line x1="${px}" x2="${W - 10}" y1="${Y(meta)}" y2="${Y(meta)}" stroke="var(--danger)" stroke-dasharray="4 4"/>` : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}${bars}${m}</svg>`;
  }
  const dataX = (iso) => new Date(iso + 'T12:00:00').getTime() / 864e5;
  function labelsData(pontos) {
    if (!pontos.length) return [];
    const xs = pontos.map((p) => p.x); const a = Math.min(...xs), b = Math.max(...xs);
    const out = []; const n = Math.min(5, pontos.length);
    for (let i = 0; i < n; i++) { const x = a + (b - a) * (n === 1 ? 0 : i / (n - 1)); const d = new Date(x * 864e5); out.push({ x, t: `${d.getDate()}/${d.getMonth() + 1}` }); }
    return out;
  }

  /* ================= Tema / PWA ================= */
  function applyTheme() {
    const t = S.config.tema || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const cur = S.config.tema === 'auto' ? (dark ? 'dark' : 'light') : S.config.tema;
    S.config.tema = cur === 'dark' ? 'light' : 'dark'; save(); applyTheme();
  }

  /* ================= Perfis / onboarding ================= */
  function perfilForm(p) {
    p = p || {};
    return `<div class="form-grid">
      ${field('Nome', inp('nome', p.nome, 'required placeholder="Seu nome"'))}
      ${field('Sexo', sel('sexo', [['M', 'Masculino'], ['F', 'Feminino']], p.sexo || 'M'))}
      ${field('Data de nascimento', inp('nascimento', p.nascimento, 'type="date"'))}
      ${field('Altura (cm)', num('altura', p.altura, 'step="1" min="100" max="250" required'))}
      ${field('Nível de treino', sel('nivel', [[1, 'Iniciante (< 1 ano)'], [2, 'Intermediário (1–3 anos)'], [3, 'Avançado (3+ anos)']], p.nivel || 1))}
      ${field('FC de repouso (bpm)', num('fcRepouso', p.fcRepouso, 'step="1"'), 'Opcional, para zonas de FC')}
    </div>`;
  }
  function salvarPerfilForm(root, existente) {
    const d = formData(root);
    if (!d.nome || !d.altura) { toast('Preencha nome e altura.'); return null; }
    const p = existente || { id: uid(), criadoEm: hoje() };
    Object.assign(p, { nome: d.nome.trim(), sexo: d.sexo, nascimento: d.nascimento || '', altura: d.altura, nivel: Number(d.nivel) || 1, fcRepouso: d.fcRepouso });
    if (!existente) S.perfis.push(p);
    save(); return p;
  }
  function onboarding() {
    $('#view').innerHTML = `<div class="card accent stack" style="max-width:640px;margin:20px auto">
      <div><h1>Bem-vindo ao FitLab 🏋️</h1><p class="text-2">Seu gerenciador de treinos e dietas, com os dados guardados no seu aparelho. Crie seu perfil para começar. Você pode adicionar outras pessoas depois.</p></div>
      <div id="obForm">${perfilForm({})}</div>
      <label class="check"><input type="checkbox" name="importar" checked> Carregar o histórico da planilha (dietas e treinos de 2024–2025, avaliação de jan/24)</label>
      <button class="btn primary block" data-act="obOk">Criar perfil e entrar</button>
    </div>
    <div class="card" style="max-width:640px;margin:0 auto 20px"><h3>☁ Já uso o FitLab em outro aparelho</h3><p class="text-2">Conecte a sincronização antes de criar o perfil: seus perfis, dietas, treinos e registros chegam da nuvem.</p><a class="btn block" href="#/sync">Conectar a sincronização</a></div>`;
    $('#btnBack').hidden = true;
    acts.obOk = () => {
      const root = $('#obForm'); const p = salvarPerfilForm(root); if (!p) return;
      S.perfilAtivo = p.id;
      if ($('[name=importar]').checked) importarHistorico(p.id);
      save(); toast('Perfil criado!'); go('inicio'); render();
    };
  }
  function trocarPerfil() {
    const body = `<div class="list">${S.perfis.map((p) => `<div class="item ${p.id === S.perfilAtivo ? 'on' : ''}" data-act="pSel" data-id="${p.id}"><div class="ico">${p.sexo === 'F' ? '👩' : '👨'}</div><div><div class="t">${h(p.nome)}</div><div class="s">${p.sexo === 'F' ? 'Feminino' : 'Masculino'} · ${idade(p) || '?'} anos · ${p.altura} cm</div></div><div class="right">${p.id === S.perfilAtivo ? '✓' : ''}</div></div>`).join('')}</div>
      <div class="inline-actions"><button class="btn" data-act="pNovo">＋ Novo perfil</button><a class="btn ghost" href="#/perfil" data-act="__modalClose">Editar perfis</a></div>`;
    modal({ title: 'Perfis', body });
    acts.pSel = (el) => { S.perfilAtivo = el.dataset.id; save(); closeModal(); render(); toast('Perfil: ' + perfil().nome); };
    acts.pNovo = () => {
      modal({ title: 'Novo perfil', body: `<div id="pf">${perfilForm({})}</div>`, foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="pSalvar">Criar</button>` });
      acts.pSalvar = () => { const p = salvarPerfilForm($('#pf')); if (!p) return; S.perfilAtivo = p.id; save(); closeModal(); render(); toast('Perfil criado'); };
    };
  }

  /* ================= Importar histórico da planilha ================= */
  function importarHistorico(perfilId) {
    const H = window.FIT_HISTORICO; if (!H) return 0;
    const p = S.perfis.find((x) => x.id === perfilId); if (!p) return 0;
    let n = 0;
    const jaTem = (col, origem) => S[col].some((x) => x.perfilId === perfilId && x.origem === origem);
    if (!S.avaliacoes.some((a) => a.perfilId === perfilId && a.origem === 'planilha')) {
      const av = H.avaliacao;
      const a = { id: uid(), perfilId, origem: 'planilha', data: av.data, peso: av.peso, cintura: av.cintura, pescoco: av.pescoco, quadril: null, objetivo: av.objetivo, ajustePct: av.ajustePct, base: 'anterior', dietaAnterior: av.dietaAnterior,
        nivelAtividade: av.nivelAtividade, tmbFormula: 'mifflin', presetMacro: av.preset, modoMacro: 'pct', macros: { c: 60, g: 16, p: 24 }, tempoDias: av.tempoDias, obs: 'Importada da planilha (consulta de 09/01/2024).' };
      calcularAvaliacao(a, p); S.avaliacoes.push(a); n++;
    }
    H.dietas.forEach((d) => {
      if (jaTem('dietas', d.origem)) return;
      S.dietas.push({ id: uid(), perfilId, origem: d.origem, nome: d.nome, tipo: /viagem/i.test(d.nome) ? 'viagem' : /low/i.test(d.nome) ? 'low' : 'treino', meta: d.meta || null, ativo: false, criadoEm: hoje(),
        refeicoes: d.refeicoes.map((r) => ({ id: uid(), nome: r.nome, hora: r.hora, substituicao: /substitui/i.test(r.nome), itens: r.itens.map((i) => (i.medida ? { alimentoId: i.alimentoId, qtd: i.qtd, medida: i.medida } : { alimentoId: i.alimentoId, qtd: i.qtd })) })) });
      n++;
    });
    n += importarProgramasFixos(perfilId);
    H.programas.forEach((pr) => {
      if (jaTem('programas', pr.origem)) return;
      S.programas.push({ id: uid(), perfilId, origem: pr.origem, nome: pr.nome, frequencia: pr.frequencia, fase: 'hipertrofia', ativo: false, criadoEm: hoje(), importado: true,
        fichas: pr.fichas.map((f) => ({ id: uid(), letra: f.letra, nome: f.nome, exercicios: f.exercicios.map((e) => ({ id: uid(), exercicioId: e.exercicioId, series: e.series, reps: e.reps, metodoId: e.metodoId, obs: e.obs, descanso: 75, rir: 1.5 })) })) });
      n++;
    });
    const setPlan = S.dietas.filter((d) => d.perfilId === perfilId && d.origem === 'SET 25')[0];
    if (setPlan && !S.dietas.some((d) => d.perfilId === perfilId && d.ativo)) setPlan.ativo = true;
    const setProg = S.programas.filter((d) => d.perfilId === perfilId && d.origem === 'TREINO - SET 25 5x')[0];
    if (setProg && !S.programas.some((d) => d.perfilId === perfilId && d.ativo)) setProg.ativo = true;
    save(); return n;
  }
  /* Programas criados depois da planilha (ex.: Set 26), com ids fixos para não
   * duplicar entre aparelhos. Retorna quantos foram adicionados. */
  function importarProgramasFixos(perfilId) {
    const H = window.FIT_HISTORICO; if (!H || !H.programasFixos) return 0;
    let n = 0;
    H.programasFixos.forEach((pr) => {
      if (S.programas.some((x) => x.perfilId === perfilId && (x.origem === pr.origem || x.id === pr.id || x.id === pr.id + '-' + perfilId))) return;
      const idUsado = S.programas.some((x) => x.id === pr.id);
      const suf = idUsado ? '-' + perfilId : '';
      const novo = { id: pr.id + suf, perfilId, origem: pr.origem, nome: pr.nome, frequencia: pr.frequencia, fase: pr.fase, ativo: false, criadoEm: pr.criadoEm, importado: false,
        fichas: pr.fichas.map((f) => ({ id: f.id + suf, letra: f.letra, nome: f.nome, exercicios: f.exercicios.map((e) => ({ ...e, id: e.id + suf })) })) };
      if (pr.ativar) { S.programas.forEach((x) => { if (x.perfilId === perfilId) x.ativo = false; }); novo.ativo = true; }
      S.programas.push(novo); n++;
    });
    return n;
  }
  /* Uma vez por aparelho: leva os programas novos a quem já tem o histórico da planilha */
  function migrarProgramasFixos() {
    const FLAG = 'fitlab.seed.programasFixos';
    const H = window.FIT_HISTORICO; if (!H || !H.programasFixos) return;
    let feitos = []; try { feitos = JSON.parse(localStorage.getItem(FLAG) || '[]'); } catch (e) { feitos = []; }
    const pendentes = H.programasFixos.filter((pr) => !feitos.includes(pr.id));
    if (!pendentes.length) return;
    let n = 0;
    S.perfis.forEach((p) => { if (S.programas.some((x) => x.perfilId === p.id && /^TREINO - |^CAIO - /.test(x.origem || ''))) n += importarProgramasFixos(p.id); });
    try { localStorage.setItem(FLAG, JSON.stringify(H.programasFixos.map((x) => x.id))); } catch (e) { /* */ }
    if (n) { save(); setTimeout(() => toast('Novo programa importado: ' + pendentes.map((x) => x.nome).join(', '), 3500), 600); }
  }

  /* Na planilha o ovo era contado em unidades (2 = 2 ovos de 50 g); a primeira importação
   * tratou como gramas. Converte uma vez as dietas importadas da planilha. */
  function corrigirOvosPlanilha() {
    let n = 0;
    S.dietas.forEach((d) => { if (!d.origem) return; d.refeicoes.forEach((r) => r.itens.forEach((it) => { if (it.alimentoId === 'ovo' && Number(it.qtd) > 0 && Number(it.qtd) < 20 && !it.medida) { it.qtd = Number(it.qtd) * 50; it.medida = 'unidade'; n++; } })); });
    if (n) save();
    return n;
  }

  /* Calcula resultados de uma avaliação (usado por ui-corpo e importação) */
  function calcularAvaliacao(a, p) {
    p = p || perfil();
    const id = a.idade || idade(p) || 30;
    const bfNavy = E.bfNavy({ sexo: p.sexo, altura: p.altura, cintura: a.cintura, pescoco: a.pescoco, quadril: a.quadril });
    const bf = a.bfManual != null && a.bfManual !== '' ? Number(a.bfManual) : bfNavy != null ? bfNavy : E.bfDeurenberg({ sexo: p.sexo, peso: a.peso, altura: p.altura, idade: id });
    const tmbs = E.tmbTodas({ sexo: p.sexo, peso: a.peso, altura: p.altura, idade: id, bf });
    const tmbValor = a.tmbFormula === 'harris' ? tmbs.harris : a.tmbFormula === 'katch' && tmbs.katch ? tmbs.katch : tmbs.mifflin;
    const plano = E.planoCalorico({ tmbValor, nivelAtividade: a.nivelAtividade, objetivo: a.objetivo, ajustePct: a.ajustePct, base: a.base, dietaAnterior: a.dietaAnterior });
    const kcal = a.kcalManual ? Number(a.kcalManual) : plano.alvo;
    const macros = a.modoMacro === 'gkg' ? E.macrosGkg(kcal, a.peso, Number(a.pGkg) || 2, Number(a.gGkg) || 0.8) : E.macrosPct(kcal, a.macros, a.peso);
    a.resultado = { imc: E.r1(E.imc(a.peso, p.altura)), bf, bfNavy, tmbs, tmb: tmbValor, get: plano.get, fator: plano.fator, referencia: plano.referencia, alvo: kcal, delta: kcal - plano.referencia, pct: plano.pct, base: plano.base, macros, agua: E.aguaDiaria(a.peso, true), idade: id };
    return a;
  }

  /* ================= Início ================= */
  function proximaFicha(prog) {
    if (!prog || !prog.fichas.length) return null;
    const ss = mine('sessoes').filter((s) => s.programaId === prog.id).sort((a, b) => (a.data + (a.inicio || '')) < (b.data + (b.inicio || '')) ? 1 : -1);
    if (!ss.length) return prog.fichas[0];
    const idx = prog.fichas.findIndex((f) => f.id === ss[0].fichaId);
    return prog.fichas[(idx + 1) % prog.fichas.length];
  }
  function semanaAtualInfo(data) { const c = cicloAtivo(); if (!c) return null; const w = E.semanaAtual(c, data); return w ? { ciclo: c, ...w } : { ciclo: c, fim: true }; }
  function inicioSemana(iso) { const d = new Date((iso || hoje()) + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10); }

  route('inicio', () => {
    const p = perfil(); const av = ultimaAvaliacao(); const dieta = dietaAtiva(); const prog = programaAtivo(); const sem = semanaAtualInfo();
    const peso = ultimoPeso();
    const hj = hoje(); const ini = inicioSemana(hj);
    const sessoesSemana = mine('sessoes').filter((s) => s.data >= ini && s.data <= hj);
    const sessaoHoje = sessoesSemana.find((s) => s.data === hj);
    const prox = proximaFicha(prog);
    const aer = mine('aerobicos').filter((a) => a.data >= ini).reduce((t, a) => t + (Number(a.minutos) || 0), 0);
    const diarioHoje = mine('diario').find((d) => d.data === hj);
    const al = alMap();
    let consumido = { kcal: 0, c: 0, g: 0, p: 0 };
    if (dieta && diarioHoje) {
      dieta.refeicoes.forEach((r) => { if (diarioHoje.refeicoes && diarioHoje.refeicoes[r.id]) { const t = E.totaisRefeicao(r, al); consumido.kcal += t.kcal; consumido.c += t.c; consumido.g += t.g; consumido.p += t.p; } });
      (diarioHoje.extras || []).forEach((i) => { const t = E.calcItem(i, al); consumido.kcal += t.kcal; consumido.c += t.c; consumido.g += t.g; consumido.p += t.p; });
    }
    const meta = dieta && dieta.meta ? dieta.meta : av ? { kcal: av.resultado.alvo, c: av.resultado.macros.c.g, g: av.resultado.macros.g.g, p: av.resultado.macros.p.g } : null;
    const sups = mine('suplementos').filter((s) => s.ativo !== false && (!s.dias || !s.dias.length || s.dias.includes(new Date().getDay())));
    const tomadasHoje = mine('tomadas').filter((t) => t.data === hj).length;
    const objetivo = av ? (DB.objetivos.find((o) => o.id === av.objetivo) || {}).nome : null;
    const hora = new Date().getHours(); const sauda = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const semanaDias = [0, 1, 2, 3, 4, 5, 6].map((i) => { const d = E.addDias(ini, i); const s = mine('sessoes').find((x) => x.data === d); return { d, s }; });
    return `
      <div class="row between"><div><h1>${sauda}, ${h(p.nome.split(' ')[0])} 👋</h1><div class="muted">${fmtDataLonga(hj)}${objetivo ? ' · ' + badge(objetivo, 'accent') : ''}</div></div></div>
      ${!av ? `<div class="card warn mt"><b>Comece pela avaliação física.</b><p class="text-2">Peso, medidas e objetivo definem calorias e macros de todas as dietas.</p><a class="btn primary" href="#/avaliacao/nova">Fazer avaliação</a></div>` : ''}
      <div class="grid mt">
        <div class="card treino">
          <div class="row between"><h3>🏋️ Treino de hoje</h3>${sem && sem.micro ? badge(`Sem. ${sem.micro.semana}/${sem.ciclo.semanas} · ${sem.micro.nome}`, 'treino') : ''}</div>
          ${sessaoHoje ? `<p><b>${h(sessaoHoje.fichaNome || 'Sessão')}</b> ${sessaoHoje.fim ? badge('concluída', 'ok') : badge('em andamento', 'warn')}</p><a class="btn treino" href="#/sessao/${sessaoHoje.id}">${sessaoHoje.fim ? 'Ver sessão' : 'Continuar treino'}</a>`
        : prog && prox ? `<p><b>Ficha ${h(prox.letra)}</b> — ${h(prox.nome)}<br><span class="muted">${prox.exercicios.length} exercícios · ${h(prog.nome)}</span></p><div class="row"><a class="btn treino" href="#/sessao/nova?ficha=${prox.id}">▶ Iniciar treino</a><a class="btn ghost sm" href="#/programa/${prog.id}">Ver programa</a></div>`
        : `<p class="text-2">Nenhum programa ativo.</p><div class="row"><a class="btn treino" href="#/gerar-programa">✨ Gerar programa</a><a class="btn ghost sm" href="#/treino/programas">Meus programas</a></div>`}
          <div class="week mt">${semanaDias.map((x) => `<div class="d ${x.d === hj ? 'hoje' : ''} ${x.s ? 'feito' : ''}"><div class="dn">${DIAS[new Date(x.d + 'T12:00:00').getDay()]}</div><div class="letra">${x.s ? h(x.s.fichaLetra || '✓') : '·'}</div></div>`).join('')}</div>
          <div class="tiny muted mt-s">${sessoesSemana.length} treino(s) esta semana${prog ? ' de ' + prog.frequencia : ''} · ${aer} min de aeróbico</div>
        </div>
        <div class="card dieta">
          <div class="row between"><h3>🥗 Dieta de hoje</h3>${dieta ? badge(dieta.nome, 'dieta') : ''}</div>
          ${meta ? `${macroRow('Calorias', consumido.kcal, meta.kcal, '', 'kcal')}${macroRow('Carbo', consumido.c, meta.c, 'carb')}${macroRow('Gordura', consumido.g, meta.g, 'gord')}${macroRow('Proteína', consumido.p, meta.p, 'prot')}` : '<p class="text-2">Sem meta definida. Faça uma avaliação ou crie um plano.</p>'}
          <div class="row mt"><a class="btn dieta" href="#/dieta/diario">Diário alimentar</a>${dieta ? `<a class="btn ghost sm" href="#/plano/${dieta.id}">Ver plano</a>` : `<a class="btn ghost sm" href="#/gerar-dieta">✨ Gerar dieta</a>`}</div>
          ${sups.length ? `<div class="tiny muted mt-s">💊 Suplementos: ${tomadasHoje}/${sups.length} tomados hoje · <a href="#/suplementos">ver</a></div>` : ''}
        </div>
        <div class="card corpo">
          <div class="row between"><h3>📏 Corpo</h3>${av ? badge('Avaliação ' + fmtData(av.data, true), 'corpo') : ''}</div>
          <div class="stats">
            <div class="stat"><div class="lbl">Peso</div><div class="v">${peso ? n1(peso.peso) + '<small> kg</small>' : '—'}</div><div class="tiny muted">${peso ? fmtData(peso.data) : ''}</div></div>
            <div class="stat"><div class="lbl">% Gordura</div><div class="v">${av && av.resultado.bf != null ? n1(av.resultado.bf) + '<small> %</small>' : '—'}</div><div class="tiny muted">${av ? E.classBf(av.resultado.bf, p.sexo) : ''}</div></div>
            <div class="stat"><div class="lbl">Meta kcal</div><div class="v">${av ? n0(av.resultado.alvo) : '—'}</div><div class="tiny muted">${av ? 'TMB ' + n0(av.resultado.tmb) : ''}</div></div>
          </div>
          ${(() => { const lim = E.addDias(hj, -84); const pts = pesoSerie().filter((x) => x.data >= lim); const t = E.tendencia(pts.map((x) => ({ data: x.data, valor: x.peso }))); return t ? `<div class="tiny muted mt-s">Tendência: ${t.porSemana > 0 ? '+' : ''}${n1(t.porSemana)} kg/semana nas últimas ${n1(t.semanas)} semanas</div>` : ''; })()}
          <div class="row mt"><a class="btn" href="#/corpo">Evolução</a><button class="btn ghost sm" data-act="pesoRapido">＋ Peso de hoje</button></div>
        </div>
      </div>
      ${sem && sem.micro ? `<div class="card mt accent"><div class="row between"><h3>📅 ${h(sem.ciclo.nome)}</h3><a class="btn xs ghost" href="#/ciclo/${sem.ciclo.id}">Detalhes</a></div>
        <div class="text-2">${h(sem.meso.nome)} · semana ${sem.micro.semanaMeso}/${sem.meso.semanas} · <b>${h(sem.micro.nome)}</b> · RIR ${sem.micro.rir} · volume ×${sem.micro.volume} · carga ${sem.micro.carga > 0 ? '+' : ''}${sem.micro.carga}%</div>
        ${progBar(sem.progresso, 100)}<div class="prog-lbl"><span>${fmtData(sem.ciclo.inicio)}</span><span>${sem.progresso}%</span><span>${fmtData(sem.ciclo.fim)}</span></div></div>` : sem && sem.fim ? `<div class="card mt warn"><b>Macrociclo "${h(sem.ciclo.nome)}" terminou.</b> <a href="#/gerar-ciclo">Planejar o próximo</a>.</div>` : ''}
      `;
  });
  function pesoSerie() {
    const pts = [...mine('medidas').filter((m) => m.peso).map((m) => ({ data: m.data, peso: m.peso })), ...mine('avaliacoes').filter((a) => a.peso).map((a) => ({ data: a.data, peso: a.peso }))];
    const seen = {}; pts.sort((a, b) => a.data < b.data ? -1 : 1).forEach((x) => { seen[x.data] = x; });
    return Object.values(seen);
  }
  on('pesoRapido', () => registrarPeso());
  function registrarPeso() {
    const ult = ultimoPeso();
    modal({ title: 'Registrar peso e medidas', body: `<div id="pf"><div class="form-grid tight">
      ${field('Data', inp('data', hoje(), 'type="date"'))}${field('Peso (kg)', num('peso', ult ? ult.peso : '', 'step="0.1" inputmode="decimal" autofocus'))}
      ${field('Cintura (cm)', num('cintura', '', 'step="0.5"'))}${field('Quadril (cm)', num('quadril', '', 'step="0.5"'))}${field('Braço (cm)', num('braco', '', 'step="0.5"'))}${field('Coxa (cm)', num('coxa', '', 'step="0.5"'))}${field('Peito (cm)', num('peito', '', 'step="0.5"'))}${field('Pescoço (cm)', num('pescoco', '', 'step="0.5"'))}
      </div>${field('Observação', inp('obs', '', 'placeholder="Ex.: em jejum, pós-treino…"'))}</div>`,
      foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="pesoSalvar">Salvar</button>` });
    acts.pesoSalvar = () => {
      const d = formData($('#pf')); if (!d.peso && !d.cintura) { toast('Informe ao menos o peso.'); return; }
      S.medidas.push({ id: uid(), perfilId: perfil().id, ...d }); save(); closeModal(); render(); toast('Registrado!');
    };
  }

  /* ================= Registrar (ações rápidas) ================= */
  route('registrar', () => {
    setTitle('Registrar');
    const prog = programaAtivo(); const prox = proximaFicha(prog); const dieta = dietaAtiva();
    on('treinoPassado', () => window.App.treinoPassado());
    return `<h1>O que você quer registrar?</h1>
      <div class="btn-grid mt">
        ${prog && prox ? `<a class="btn treino" href="#/sessao/nova?ficha=${prox.id}"><span class="i">🏋️</span>Treino de hoje<small>Ficha ${h(prox.letra)}</small></a>` : `<a class="btn" href="#/treino/programas"><span class="i">🏋️</span>Treino<small>escolher ficha</small></a>`}
        <a class="btn" href="#/sessao/nova"><span class="i">📋</span>Treino avulso<small>outra ficha</small></a>
        <button class="btn" data-act="treinoPassado"><span class="i">🕓</span>Treino passado<small>já feito, sem registro</small></button>
        <a class="btn dieta" href="#/dieta/diario"><span class="i">🥗</span>Refeições<small>${dieta ? h(dieta.nome) : 'diário'}</small></a>
        <button class="btn" data-act="pesoRapido"><span class="i">⚖️</span>Peso e medidas</button>
        <a class="btn" href="#/aerobico/novo"><span class="i">🏃</span>Aeróbico</a>
        <a class="btn" href="#/suplementos"><span class="i">💊</span>Suplementos</a>
        <a class="btn" href="#/avaliacao/nova"><span class="i">📏</span>Avaliação física</a>
        <a class="btn" href="#/dieta/diario?extra=1"><span class="i">🍔</span>Alimento fora do plano</a>
      </div>`;
  });

  /* ================= Início do app ================= */
  function start() {
    load(); applyTheme(); delegate();
    $('#btnBack').addEventListener('click', back);
    $('#btnTheme').addEventListener('click', toggleTheme);
    $('#btnPerfil').addEventListener('click', trocarPerfil);
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/inicio';
    migrarProgramasFixos();
    corrigirOvosPlanilha();
    render();
    hooks.boot.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
    registrarSW();
  }

  /* ================= PWA: atualizações ================= */
  let swVersao = '';
  async function forcarAtualizacao() {
    try {
      if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); }
      if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
    } catch (e) { /* segue para o reload */ }
    location.replace(location.pathname + '?v=' + Date.now() + location.hash);
  }
  function registrarSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    // recarrega uma vez quando uma versão nova assume o controle
    let recarregou = false;
    const tinhaControle = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinhaControle && !recarregou) { recarregou = true; location.reload(); } });
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.versao) { swVersao = e.data.versao; const el = document.getElementById('swVersao'); if (el) el.textContent = swVersao; } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('versao');
    }).catch(() => { /* sem SW (ex.: http em rede local) */ });
  }

  return {
    get S() { return S; }, set S(v) { S = v; }, get swVersao() { return swVersao; }, hooks, saveNow, forcarAtualizacao, importarProgramasFixos, DB, E, KEY, $, $$, h, n0, n1, DIAS, MESES, fmtData, fmtDataLonga, hoje, uid, save, load, vazio,
    perfil, mine, idade, ultimaAvaliacao, ultimoPeso, dietaAtiva, programaAtivo, cicloAtivo, exMap, alMap, metodo, grupoNome, aparelhoNome,
    route, go, back, render, on, setTitle, toast, modal, closeModal, confirmar, formData, field, inp, num, sel, chips, badge, empty, tabs, progBar, macroRow,
    lineChart, barChart, dataX, labelsData, applyTheme, perfilForm, salvarPerfilForm, trocarPerfil, importarHistorico, calcularAvaliacao,
    proximaFicha, semanaAtualInfo, inicioSemana, pesoSerie, registrarPeso, start
  };
})();
