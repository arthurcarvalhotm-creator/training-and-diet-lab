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

  /* ================= Estado (IndexedDB + fallback localStorage) ================= */
  const SCHEMA_VERSION = 2;
  const DB_NAME = 'fitlab.db';
  const DB_VER = 2;
  const COLECOES = ['perfis', 'avaliacoes', 'medidas', 'alimentosCustom', 'exerciciosCustom', 'dietas', 'diario', 'programas', 'ciclos', 'sessoes', 'aerobicos', 'suplementos', 'tomadas'];
  const EXPIRA_LAPIDE = 90 * 86400 * 1000;

  const ORIGEM_LEGADO = {
    'PLANO ALIMENTAR ALUNOS': 'modelo-plano-inicial',
    'PLANO ALIMENTAR - JAN 2': 'modelo-base-equilibrada',
    'TESTE - JAN 24 a MAR 24': 'modelo-bulking-adaptacao',
    'ABR 24': 'modelo-bulking-moderado',
    'ABR 24 - CARBO ALTO': 'modelo-bulking-carbo-alto',
    'JUN 24': 'modelo-bulking-intermediario',
    'NOV 24': 'modelo-bulking-evolucao',
    'JAN 25': 'modelo-bulking-avancado',
    'SET 25': 'modelo-bulking-intenso',
    'VIDA (LOW)': 'modelo-cutting-low',
    'VIDA (NORMAL)': 'modelo-manutencao-normal',
    'VIDA (SUGESTÃO)': 'modelo-manutencao-sugestao',
    'SET 24': 'modelo-recomposicao',
    'VIAGEM': 'modelo-viagem',
    'TREINO - JAN, FEV e MAR 24': 'treino-abcdef-adaptacao-6x',
    'TREINO - ABR 24': 'treino-abcde-base-5x',
    'TREINO - NOV 24 6x': 'treino-abcdef-volume-6x',
    'TREINO - SET 25 5x': 'treino-abcde-5x',
    'TREINO - JUN 24 5x': 'treino-abcde-hipertrofia-5x',
    'TREINO - SET 24 6x': 'treino-abcdef-intensidade-6x',
    'TREINO - OUT 24 4x': 'treino-abcd-4x',
    'TREINO - NOV 24 3x': 'treino-abc-3x',
    'TREINO - SET 26 5x': 'treino-abcde-periodizado-5x'
  };
  const normOrigem = (o) => o ? (ORIGEM_LEGADO[o] || o) : null;

  const vazio = () => ({
    versao: SCHEMA_VERSION, schemaVersion: SCHEMA_VERSION, perfilAtivo: null, perfis: [], avaliacoes: [], medidas: [], alimentosCustom: [], exerciciosCustom: [], dietas: [], diario: [],
    programas: [], ciclos: [], sessoes: [], aerobicos: [], suplementos: [], tomadas: [],
    config: { tema: 'auto', descansoPadrao: 90, escala: 'rir', diasTreino: [1, 2, 3, 4, 5], somTimer: true, aguaCopo: 250, contaUid: null, lgpd: null }
  });
  const VERSAO_TERMO_LGPD = '2026-10-24';
  let S = vazio();
  const apagadosDB = Object.fromEntries(COLECOES.map((c) => [c, {}]));
  const snap = { cols: Object.fromEntries(COLECOES.map((c) => [c, new Map()])), metaSig: '' };
  let idbConn = null;

  function temConsentimentoLgpd() {
    return !!(S && S.config && S.config.lgpd && S.config.lgpd.consentimento);
  }
  function registrarConsentimentoLgpd(escopo) {
    if (!S.config) S.config = vazio().config;
    S.config.lgpd = {
      consentimento: true,
      versaoTermo: VERSAO_TERMO_LGPD,
      aceitoEm: (S.config.lgpd && S.config.lgpd.aceitoEm) || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      escopo: escopo || 'local_e_nuvem'
    };
    return S.config.lgpd;
  }

  function sigReg(r) {
    if (!r || typeof r !== 'object') return '';
    const o = {};
    const ks = Object.keys(r);
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      if (k !== '_mod' && k !== '_unif' && k !== 'updatedAt' && k !== 'deletedAt' && k !== 'schemaVersion') o[k] = r[k];
    }
    return JSON.stringify(o);
  }
  function carimbar(r, t) {
    if (!r || typeof r !== 'object') return r;
    const mod = Number(t || r.updatedAt || r._mod) || Date.now();
    r.schemaVersion = SCHEMA_VERSION;
    r.updatedAt = mod;
    r._mod = mod;
    if (r.deletedAt === undefined) r.deletedAt = null;
    if (S && S.config && S.config.contaUid && !r.contaUid) r.contaUid = S.config.contaUid;
    return r;
  }
  function tirarSnap() {
    COLECOES.forEach((col) => {
      const m = new Map();
      (S[col] || []).forEach((r) => {
        if (!r || !r.id) return;
        carimbar(r);
        m.set(r.id, { sig: sigReg(r), perfilId: r.perfilId || null });
      });
      snap.cols[col] = m;
    });
    snap.metaSig = JSON.stringify({ perfilAtivo: S.perfilAtivo, config: S.config });
  }

  function abrirIDB() {
    if (idbConn) return Promise.resolve(idbConn);
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
          COLECOES.forEach((c) => { if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' }); });
        };
        req.onsuccess = () => { idbConn = req.result; resolve(idbConn); };
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        S = Object.assign(vazio(), parsed);
        S.schemaVersion = SCHEMA_VERSION;
        COLECOES.forEach((col) => { (S[col] || []).forEach((r) => carimbar(r)); });
      }
    } catch (e) { console.warn('estado inválido', e); }
    S.config = Object.assign(vazio().config, S.config || {});
    tirarSnap();
  }

  async function carregarBanco() {
    const db = await abrirIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['meta', ...COLECOES], 'readonly');
        const metaReq = tx.objectStore('meta').get('state');
        const colReqs = Object.fromEntries(COLECOES.map((c) => [c, tx.objectStore(c).getAll()]));
        tx.oncomplete = () => {
          const meta = metaReq.result;
          const agora = Date.now();
          if (!meta || !meta.schemaVersion) {
            // Migração automática sem perda do localStorage (fitlab.v1) para IndexedDB
            COLECOES.forEach((col) => { (S[col] || []).forEach((r) => carimbar(r, r.updatedAt || r._mod || agora)); });
            tirarSnap();
            try {
              const wtx = db.transaction(['meta', ...COLECOES], 'readwrite');
              wtx.objectStore('meta').put({ schemaVersion: SCHEMA_VERSION, perfilAtivo: S.perfilAtivo, config: S.config, migradoEm: agora }, 'state');
              COLECOES.forEach((col) => {
                const st = wtx.objectStore(col);
                (S[col] || []).forEach((r) => st.put(r));
              });
              wtx.oncomplete = () => {
                try { localStorage.removeItem(KEY); } catch (e) { /* */ }
                resolve(true);
              };
              wtx.onerror = () => resolve(false);
            } catch (e) { resolve(false); }
            return;
          }
          // Carrega estado do IndexedDB filtrando registros com exclusão lógica (deletedAt)
          const novo = vazio();
          novo.perfilAtivo = meta.perfilAtivo || null;
          novo.config = Object.assign(vazio().config, meta.config || {});
          const expurgos = [];
          COLECOES.forEach((col) => {
            const todos = colReqs[col].result || [];
            const ativos = [];
            apagadosDB[col] = {};
            todos.forEach((r) => {
              if (!r || !r.id) return;
              if (r.deletedAt) {
                if (agora - r.deletedAt > EXPIRA_LAPIDE) expurgos.push([col, r.id]);
                else apagadosDB[col][r.id] = r.deletedAt;
              } else {
                ativos.push(carimbar(r));
              }
            });
            novo[col] = ativos;
          });
          // Caso algum dado legado tenha sido gravado em fitlab.v1 antes do boot, preserva sem perda
          try {
            const raw = localStorage.getItem(KEY);
            if (raw) {
              const leg = JSON.parse(raw);
              COLECOES.forEach((col) => {
                const ids = new Set(novo[col].map((x) => x.id));
                (leg[col] || []).forEach((r) => {
                  if (r && r.id && !ids.has(r.id) && !apagadosDB[col][r.id]) novo[col].push(carimbar(r));
                });
              });
              if (!novo.perfilAtivo && leg.perfilAtivo) novo.perfilAtivo = leg.perfilAtivo;
              localStorage.removeItem(KEY);
            }
          } catch (e) { /* */ }
          S = novo;
          tirarSnap();
          if (expurgos.length) {
            try {
              const ptx = db.transaction(COLECOES, 'readwrite');
              expurgos.forEach(([c, id]) => ptx.objectStore(c).delete(id));
            } catch (e) { /* */ }
          }
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  let saveT = null;
  const hooks = { salvo: [], boot: [] };
  function saveNow(opts) {
    clearTimeout(saveT); saveT = null;
    const preservarMod = !!(opts && opts.preservarMod);
    const agora = Date.now();
    S.schemaVersion = SCHEMA_VERSION;
    const ops = [];
    COLECOES.forEach((col) => {
      const prevMap = snap.cols[col] || new Map();
      const curMap = new Map();
      const lista = S[col] || [];
      for (let i = 0; i < lista.length; i++) {
        const r = lista[i];
        if (!r || !r.id) continue;
        const sig = sigReg(r);
        const prev = prevMap.get(r.id);
        if (!prev || prev.sig !== sig) {
          const t = preservarMod ? (Number(r.updatedAt || r._mod) || agora) : agora;
          carimbar(r, t);
          r.deletedAt = null;
          ops.push({ col, item: r });
        } else {
          carimbar(r, r.updatedAt || r._mod || agora);
          r.deletedAt = null;
        }
        delete apagadosDB[col][r.id];
        curMap.set(r.id, { sig, perfilId: r.perfilId || null });
      }
      prevMap.forEach((prev, id) => {
        if (!curMap.has(id)) {
          const lapTs = apagadosDB[col][id] || agora;
          apagadosDB[col][id] = lapTs;
          ops.push({ col, item: { id, perfilId: prev.perfilId || null, schemaVersion: SCHEMA_VERSION, updatedAt: lapTs, _mod: lapTs, deletedAt: lapTs } });
        }
      });
      snap.cols[col] = curMap;
    });
    const metaSig = JSON.stringify({ perfilAtivo: S.perfilAtivo, config: S.config });
    const metaMudou = metaSig !== snap.metaSig;
    snap.metaSig = metaSig;

    if (typeof indexedDB === 'undefined') {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Falha ao salvar: ' + e.message); }
      return;
    }
    abrirIDB().then((db) => {
      if (!db) {
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Falha ao salvar: ' + e.message); }
        return;
      }
      if (!ops.length && !metaMudou) return;
      try {
        const stores = new Set(ops.map((o) => o.col));
        if (metaMudou) stores.add('meta');
        const tx = db.transaction([...stores], 'readwrite');
        if (metaMudou) tx.objectStore('meta').put({ schemaVersion: SCHEMA_VERSION, perfilAtivo: S.perfilAtivo, config: S.config, atualizadoEm: agora }, 'state');
        ops.forEach(({ col, item }) => tx.objectStore(col).put(item));
      } catch (e) {
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (err) { toast('Falha ao salvar: ' + err.message); }
      }
    });
  }
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { saveNow(); hooks.salvo.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } }); }, 50); }
  function sincronizarApagados(remotoApagados) {
    if (!remotoApagados) return;
    const ops = [];
    COLECOES.forEach((col) => {
      const lap = remotoApagados[col] || {};
      apagadosDB[col] = Object.assign({}, lap);
      Object.entries(lap).forEach(([id, ts]) => {
        ops.push({ col, item: { id, schemaVersion: SCHEMA_VERSION, updatedAt: ts, _mod: ts, deletedAt: ts } });
      });
    });
    if (!ops.length || typeof indexedDB === 'undefined') return;
    abrirIDB().then((db) => {
      if (!db) return;
      try {
        const stores = [...new Set(ops.map((o) => o.col))];
        const tx = db.transaction(stores, 'readwrite');
        ops.forEach(({ col, item }) => tx.objectStore(col).put(item));
      } catch (e) { /* */ }
    });
  }
  async function limparBanco() {
    clearTimeout(saveT); saveT = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* */ }
    COLECOES.forEach((c) => { apagadosDB[c] = {}; snap.cols[c] = new Map(); });
    snap.metaSig = '';
    const db = await abrirIDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['meta', ...COLECOES], 'readwrite');
        tx.objectStore('meta').clear();
        COLECOES.forEach((c) => tx.objectStore(c).clear());
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }
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
  const go = (hash, replace) => {
    const hsh = hash.startsWith('#') ? hash : '#/' + hash;
    if (replace) {
      if (stack.length && stack[stack.length - 1] === location.hash) stack.pop();
      location.replace(hsh);
    } else {
      location.hash = hsh;
    }
  };
  const back = () => { if (stack.length > 1) { stack.pop(); const prev = stack.pop(); location.hash = prev; } else go('inicio'); };
  const ROOTS = ['inicio', 'treino', 'registrar', 'dieta', 'mais'];
  let acts = {};
  const on = (name, fn) => { acts[name] = fn; };
  function render() {
    const { parts, query } = parseHash();
    const view = $('#view');
    acts = {};
    closeModal();
    if (!perfil() && parts[0] !== 'sync' && parts[0] !== 'lgpd') { onboarding(); return; }
    const m = match(parts);
    const cur = location.hash;
    if (stack[stack.length - 1] !== cur) stack.push(cur); if (stack.length > 40) stack.shift();
    const root = parts[0];
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.route === root || (root === 'programa' || root === 'sessao' || root === 'ciclo' || root === 'exercicio' || root === 'aerobico' || root === 'gerar-programa' || root === 'gerar-ciclo' ? a.dataset.route === 'treino' : (root === 'plano' || root === 'alimento' || root === 'gerar-dieta' || root === 'suplementos' || root === 'alimentos') ? a.dataset.route === 'dieta' : (root === 'corpo' || root === 'avaliacao' || root === 'biblioteca' || root === 'perfil' || root === 'sync' || root === 'lgpd') ? a.dataset.route === 'mais' : false)));
    $('#btnBack').hidden = ROOTS.includes(root);
    $('#btnPerfil').textContent = '👤 ' + ((perfil() || {}).nome || '').split(' ')[0];
    if (!m) { view.innerHTML = '<div class="empty"><div class="big">🤷</div>Página não encontrada.</div>'; return; }
    setTitle('FitLab');
    const out = m.handler(m.params, query);
    if (typeof out === 'string') view.innerHTML = out;
    window.scrollTo(0, 0);
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
  const badge = (txt, cls) => `<span class="badge ${h(cls || '')}">${h(txt)}</span>`;
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
    const p = existente || { id: uid(), criadoEm: hoje(), contaUid: (S.config && S.config.contaUid) || null };
    Object.assign(p, { nome: d.nome.trim(), sexo: d.sexo, nascimento: d.nascimento || '', altura: d.altura, nivel: Number(d.nivel) || 1, fcRepouso: d.fcRepouso });
    if (S.config && S.config.contaUid && !p.contaUid) p.contaUid = S.config.contaUid;
    if (!existente) S.perfis.push(p);
    save(); return p;
  }
  function onboarding() {
    const jaConsentiu = temConsentimentoLgpd();
    $('#view').innerHTML = `<div class="card accent stack" style="max-width:640px;margin:20px auto">
      <div><h1>Bem-vindo ao FitLab 🏋️</h1><p class="text-2">Seu gerenciador de treinos e dietas, com os dados guardados no seu aparelho. Crie seu perfil para começar. Você pode adicionar outras pessoas depois.</p></div>
      <div id="obForm">${perfilForm({})}</div>
      <label class="check"><input type="checkbox" name="importar"> Importar modelos de dietas e programas de treino de exemplo</label>
      <label class="check"><input type="checkbox" name="consentimentoLgpd" ${jaConsentiu ? 'checked' : ''} required> <span>Concordo com o tratamento dos meus dados corporais, nutricionais e de treino (dados sensíveis de saúde — LGPD, Art. 11) para cálculo de metas e acompanhamento no FitLab. <a href="#/lgpd">Política de Privacidade e LGPD</a>.</span></label>
      <button class="btn primary block" data-act="obOk">Criar perfil e entrar</button>
    </div>
    <div class="card" style="max-width:640px;margin:0 auto 20px"><h3>☁ Já uso o FitLab em outro aparelho</h3><p class="text-2">Entre com a sua conta do Google antes de criar o perfil: seus perfis, dietas, treinos e registros chegam da nuvem.</p><a class="btn block" href="#/sync">🔵 Fazer login com o Google</a></div>`;
    $('#btnBack').hidden = true;
    acts.obOk = async () => {
      const chkLgpd = $('[name=consentimentoLgpd]');
      if (!chkLgpd || !chkLgpd.checked) { toast('Para continuar, marque o consentimento de tratamento de dados (LGPD).'); return; }
      const root = $('#obForm'); const p = salvarPerfilForm(root); if (!p) return;
      registrarConsentimentoLgpd('local');
      S.perfilAtivo = p.id;
      if ($('[name=importar]').checked) { await carregarHistorico(); importarHistorico(p.id); }
      save(); toast('Perfil criado!'); go('inicio'); render();
    };
  }
  function trocarPerfil() {
    const body = `<div class="list">${S.perfis.map((p) => `<div class="item ${p.id === S.perfilAtivo ? 'on' : ''}" data-act="pSel" data-id="${h(p.id)}"><div class="ico">${p.sexo === 'F' ? '👩' : '👨'}</div><div><div class="t">${h(p.nome)}</div><div class="s">${p.sexo === 'F' ? 'Feminino' : 'Masculino'} · ${idade(p) || '?'} anos · ${h(p.altura)} cm</div></div><div class="right">${p.id === S.perfilAtivo ? '✓' : ''}</div></div>`).join('')}</div>
      <div class="inline-actions"><button class="btn" data-act="pNovo">＋ Novo perfil</button><a class="btn ghost" href="#/perfil" data-act="__modalClose">Editar perfis</a></div>`;
    modal({ title: 'Perfis', body });
    acts.pSel = (el) => { S.perfilAtivo = el.dataset.id; save(); closeModal(); render(); toast('Perfil: ' + perfil().nome); };
    acts.pNovo = () => {
      modal({ title: 'Novo perfil', body: `<div id="pf">${perfilForm({})}</div>`, foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="pSalvar">Criar</button>` });
      acts.pSalvar = () => { const p = salvarPerfilForm($('#pf')); if (!p) return; S.perfilAtivo = p.id; save(); closeModal(); render(); toast('Perfil criado'); };
    };
  }

  /* ================= Importar modelos de dietas e treinos ================= */
  let histProm = null;
  function carregarHistorico() {
    if (window.FIT_HISTORICO) return Promise.resolve(window.FIT_HISTORICO);
    if (histProm) return histProm;
    const viaScript = () => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'historico.js';
      s.onload = () => resolve(window.FIT_HISTORICO || null);
      s.onerror = () => { histProm = null; resolve(null); };
      document.head.appendChild(s);
    });
    if (typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      histProm = fetch('kb/modelos.json')
        .then((r) => r.ok ? r.json() : null)
        .then((j) => {
          if (j && (j.dietas || j.programas)) { window.FIT_HISTORICO = j; return j; }
          return viaScript();
        })
        .catch(() => viaScript());
    } else {
      histProm = viaScript();
    }
    return histProm;
  }
  function importarHistorico(perfilId) {
    const H = window.FIT_HISTORICO; if (!H) return 0;
    const p = S.perfis.find((x) => x.id === perfilId); if (!p) return 0;
    let n = 0;
    const jaTem = (col, origem) => S[col].some((x) => x.perfilId === perfilId && normOrigem(x.origem) === normOrigem(origem));
    (H.dietas || []).forEach((d) => {
      if (jaTem('dietas', d.origem)) return;
      S.dietas.push({ id: uid(), perfilId, origem: normOrigem(d.origem), nome: d.nome, tipo: /viagem/i.test(d.nome) ? 'viagem' : /low/i.test(d.nome) ? 'low' : 'treino', meta: d.meta || null, ativo: false, criadoEm: hoje(),
        refeicoes: d.refeicoes.map((r) => ({ id: uid(), nome: r.nome, hora: r.hora, substituicao: /substitui/i.test(r.nome), itens: r.itens.map((i) => ({ alimentoId: i.alimentoId, qtd: i.qtd })) })) });
      n++;
    });
    n += importarProgramasFixos(perfilId);
    (H.programas || []).forEach((pr) => {
      if (jaTem('programas', pr.origem)) return;
      S.programas.push({ id: uid(), perfilId, origem: normOrigem(pr.origem), nome: pr.nome, frequencia: pr.frequencia, fase: pr.fase || 'hipertrofia', ativo: false, criadoEm: hoje(), importado: true,
        fichas: pr.fichas.map((f) => ({ id: uid(), letra: f.letra, nome: f.nome, exercicios: f.exercicios.map((e) => ({ id: uid(), exercicioId: e.exercicioId, series: e.series, reps: e.reps, metodoId: e.metodoId, obs: e.obs, descanso: e.descanso || S.config.descansoPadrao || 75, rir: e.rir ?? 1.5 })) })) });
      n++;
    });
    save(); return n;
  }
  /* Modelos adicionais com ids fixos para não duplicar entre aparelhos. */
  function importarProgramasFixos(perfilId) {
    const H = window.FIT_HISTORICO; if (!H || !H.programasFixos) return 0;
    let n = 0;
    H.programasFixos.forEach((pr) => {
      if (S.programas.some((x) => x.perfilId === perfilId && (normOrigem(x.origem) === normOrigem(pr.origem) || x.id === pr.id || x.id === pr.id + '-' + perfilId))) return;
      const idUsado = S.programas.some((x) => x.id === pr.id);
      const suf = idUsado ? '-' + perfilId : '';
      const novo = { id: pr.id + suf, perfilId, origem: normOrigem(pr.origem), nome: pr.nome, frequencia: pr.frequencia, fase: pr.fase || 'hipertrofia', ativo: false, criadoEm: pr.criadoEm || hoje(), importado: false,
        fichas: pr.fichas.map((f) => ({ id: f.id + suf, letra: f.letra, nome: f.nome, exercicios: f.exercicios.map((e) => ({ ...e, id: e.id + suf })) })) };
      if (pr.ativar && !S.programas.some((x) => x.perfilId === perfilId && x.ativo)) novo.ativo = true;
      S.programas.push(novo); n++;
    });
    return n;
  }
  function migrarProgramasFixos() {
    // Mantido apenas por compatibilidade; modelos agora são opcionais via importação
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
  function semanaAtualInfo() { const c = cicloAtivo(); if (!c) return null; const w = E.semanaAtual(c); return w ? { ciclo: c, ...w } : { ciclo: c, fim: true }; }
  function inicioSemana(iso) { const d = new Date((iso || hoje()) + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

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
    return `<h1>O que você quer registrar?</h1>
      <div class="btn-grid mt">
        ${prog && prox ? `<a class="btn treino" href="#/sessao/nova?ficha=${prox.id}"><span class="i">🏋️</span>Treino de hoje<small>Ficha ${h(prox.letra)}</small></a>` : `<a class="btn" href="#/treino/programas"><span class="i">🏋️</span>Treino<small>escolher ficha</small></a>`}
        <a class="btn" href="#/sessao/nova"><span class="i">📋</span>Treino avulso<small>outra ficha</small></a>
        <a class="btn dieta" href="#/dieta/diario"><span class="i">🥗</span>Refeições<small>${dieta ? h(dieta.nome) : 'diário'}</small></a>
        <button class="btn" data-act="pesoRapido"><span class="i">⚖️</span>Peso e medidas</button>
        <a class="btn" href="#/aerobico/novo"><span class="i">🏃</span>Aeróbico</a>
        <a class="btn" href="#/suplementos"><span class="i">💊</span>Suplementos</a>
        <a class="btn" href="#/avaliacao/nova"><span class="i">📏</span>Avaliação física</a>
        <a class="btn" href="#/dieta/diario?extra=1"><span class="i">🍔</span>Alimento fora do plano</a>
      </div>`;
  });

  /* ================= Início do app ================= */
  async function start() {
    load(); applyTheme(); delegate();
    $('#btnBack').addEventListener('click', back);
    $('#btnTheme').addEventListener('click', toggleTheme);
    $('#btnPerfil').addEventListener('click', trocarPerfil);
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/inicio';
    await carregarBanco();
    if (DB.carregarKB) DB.carregarKB().then((ok) => { if (ok) render(); });
    applyTheme();
    migrarProgramasFixos();
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);

  return {
    get S() { return S; }, set S(v) { S = v; }, get swVersao() { return swVersao; }, get apagados() { return apagadosDB; },
    SCHEMA_VERSION, VERSAO_TERMO_LGPD, temConsentimentoLgpd, registrarConsentimentoLgpd, normOrigem, carregarBanco, sincronizarApagados, limparBanco,
    hooks, saveNow, forcarAtualizacao, carregarHistorico, importarProgramasFixos, DB, E, KEY, $, $$, h, n0, n1, DIAS, MESES, fmtData, fmtDataLonga, hoje, uid, save, load, vazio,
    perfil, mine, idade, ultimaAvaliacao, ultimoPeso, dietaAtiva, programaAtivo, cicloAtivo, exMap, alMap, metodo, grupoNome, aparelhoNome,
    route, go, back, render, on, setTitle, toast, modal, closeModal, confirmar, formData, field, inp, num, sel, chips, badge, empty, tabs, progBar, macroRow,
    lineChart, barChart, dataX, labelsData, applyTheme, perfilForm, salvarPerfilForm, trocarPerfil, importarHistorico, calcularAvaliacao,
    proximaFicha, semanaAtualInfo, inicioSemana, pesoSerie, registrarPeso, start
  };
})();
