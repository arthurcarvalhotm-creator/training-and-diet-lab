/* =====================================================================
 * FitLab — Motor de cálculos e geradores
 * Avaliação física, planejamento calórico e de macros, totais de dieta,
 * parser de séries/repetições, volume semanal, 1RM, progressão,
 * gerador de programas de treino, periodização (macro/meso/micro)
 * e gerador de plano alimentar. Sem rede; determinístico.
 * ===================================================================== */
window.Engine = (function () {
  'use strict';
  const DB = window.FIT_DB;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r0 = (v) => Math.round(v);
  const r1 = (v) => Math.round(v * 10) / 10;
  const log10 = (v) => Math.log(v) / Math.LN10;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const hoje = () => new Date().toISOString().slice(0, 10);
  const addDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const diffDias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

  /* Gerador pseudo-aleatório com semente (para "gerar novamente" variar) */
  function rng(seed) {
    let s = (Number(seed) || 1) >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ================= Avaliação física ================= */
  function imc(peso, alturaCm) { const h = alturaCm / 100; return peso > 0 && h > 0 ? peso / (h * h) : 0; }
  function classImc(v) {
    if (!v) return '';
    if (v < 18.5) return 'Abaixo do peso'; if (v < 25) return 'Eutrófico'; if (v < 30) return 'Sobrepeso'; if (v < 35) return 'Obesidade I'; if (v < 40) return 'Obesidade II'; return 'Obesidade III';
  }

  /* Percentual de gordura — Marinha dos EUA (US Navy). Medidas em cm. */
  function bfNavy({ sexo, altura, cintura, pescoco, quadril }) {
    altura = Number(altura); cintura = Number(cintura); pescoco = Number(pescoco); quadril = Number(quadril);
    if (!(altura > 0 && cintura > 0 && pescoco > 0)) return null;
    let v;
    if (sexo === 'F') {
      if (!(quadril > 0) || cintura + quadril - pescoco <= 0) return null;
      v = 163.205 * log10(cintura + quadril - pescoco) - 97.684 * log10(altura) - 78.387;
    } else {
      if (cintura - pescoco <= 0) return null;
      v = 86.010 * log10(cintura - pescoco) - 70.041 * log10(altura) + 36.76;
    }
    return clamp(r1(v), 2, 60);
  }
  /* Deurenberg (a partir do IMC) — usado quando não há medidas */
  function bfDeurenberg({ sexo, peso, altura, idade }) {
    const i = imc(peso, altura); if (!i || !idade) return null;
    return clamp(r1(1.2 * i + 0.23 * idade - 10.8 * (sexo === 'F' ? 0 : 1) - 5.4), 2, 60);
  }
  function classBf(bf, sexo) {
    if (bf == null) return '';
    const t = sexo === 'F' ? [[13, 'Essencial'], [20, 'Atleta'], [24, 'Fitness'], [31, 'Aceitável'], [100, 'Acima']] : [[5, 'Essencial'], [13, 'Atleta'], [17, 'Fitness'], [24, 'Aceitável'], [100, 'Acima']];
    for (const [lim, n] of t) if (bf <= lim) return n; return '';
  }

  /* Taxa metabólica basal */
  function tmb({ formula, sexo, peso, altura, idade, bf }) {
    peso = Number(peso); altura = Number(altura); idade = Number(idade);
    if (!(peso > 0 && altura > 0 && idade > 0)) return 0;
    const F = sexo === 'F';
    if (formula === 'harris') return F ? 447.593 + 9.247 * peso + 3.098 * altura - 4.33 * idade : 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * idade;
    if (formula === 'katch' && bf != null && bf > 0) return 370 + 21.6 * (peso * (1 - bf / 100));
    return 10 * peso + 6.25 * altura - 5 * idade + (F ? -161 : 5); // Mifflin-St Jeor
  }
  function tmbTodas(p) {
    return { mifflin: r0(tmb({ ...p, formula: 'mifflin' })), harris: r0(tmb({ ...p, formula: 'harris' })), katch: p.bf ? r0(tmb({ ...p, formula: 'katch' })) : null };
  }
  const fatorAtividade = (id) => (DB.fatoresAtividade.find((f) => f.id === id) || DB.fatoresAtividade[2]).fator;

  /* Planejamento calórico
   * base: 'get' (gasto total) ou 'anterior' (dieta anterior, como na planilha)
   */
  function planoCalorico({ tmbValor, nivelAtividade, objetivo, ajustePct, base, dietaAnterior }) {
    const fator = fatorAtividade(nivelAtividade);
    const get = tmbValor * fator;
    const obj = DB.objetivos.find((o) => o.id === objetivo) || DB.objetivos[2];
    const pct = ajustePct == null || ajustePct === '' ? obj.ajuste : Number(ajustePct);
    const ref = base === 'anterior' && Number(dietaAnterior) > 0 ? Number(dietaAnterior) : get;
    const alvo = ref * (1 + pct / 100);
    return { fator, get: r0(get), referencia: r0(ref), pct, alvo: r0(alvo), delta: r0(alvo - ref), base: base === 'anterior' && Number(dietaAnterior) > 0 ? 'anterior' : 'get' };
  }

  /* Macros por percentual */
  function macrosPct(kcal, pct, peso) {
    const P = pct || { c: 45, g: 25, p: 30 };
    const soma = (P.c + P.g + P.p) || 100;
    const mk = (part, kcalG) => { const k = kcal * (part / soma); const g = k / kcalG; return { pct: r1(part / soma * 100), kcal: r0(k), g: r0(g), gkg: peso ? r1(g / peso) : null }; };
    return { c: mk(P.c, 4), g: mk(P.g, 9), p: mk(P.p, 4), kcal: r0(kcal) };
  }
  /* Macros por g/kg (proteína e gordura fixas; carboidrato completa) */
  function macrosGkg(kcal, peso, pGkg, gGkg) {
    const p = peso * pGkg, g = peso * gGkg;
    const c = Math.max(0, (kcal - p * 4 - g * 9) / 4);
    const tot = kcal || 1;
    return { p: { g: r0(p), kcal: r0(p * 4), pct: r1(p * 4 / tot * 100), gkg: r1(pGkg) }, g: { g: r0(g), kcal: r0(g * 9), pct: r1(g * 9 / tot * 100), gkg: r1(gGkg) }, c: { g: r0(c), kcal: r0(c * 4), pct: r1(c * 4 / tot * 100), gkg: peso ? r1(c / peso) : null }, kcal: r0(kcal) };
  }
  const aguaDiaria = (peso, treino) => r0(peso * 35 + (treino ? 500 : 0));

  /* ================= Dieta ================= */
  function mapaAlimentos(customs) {
    const m = new Map(DB.alimentos.map((a) => [a.id, a]));
    (customs || []).forEach((a) => m.set(a.id, a));
    return m;
  }
  function calcItem(item, mapa) {
    const a = mapa.get(item.alimentoId); const q = Number(item.qtd) || 0;
    if (!a) return { c: 0, g: 0, p: 0, fib: 0, kcal: 0, nome: item.alimentoId, faltando: true };
    const f = q / 100;
    const c = a.c * f, g = a.g * f, p = a.p * f, fib = (a.fib || 0) * f;
    return { c, g, p, fib, kcal: c * 4 + g * 9 + p * 4, nome: a.nome, alimento: a };
  }
  function totaisRefeicao(ref, mapa) {
    const t = { c: 0, g: 0, p: 0, fib: 0, kcal: 0 };
    (ref.itens || []).forEach((i) => { const v = calcItem(i, mapa); t.c += v.c; t.g += v.g; t.p += v.p; t.fib += v.fib; t.kcal += v.kcal; });
    return t;
  }
  function totaisDieta(dieta, mapa) {
    const t = { c: 0, g: 0, p: 0, fib: 0, kcal: 0, refeicoes: [] };
    (dieta.refeicoes || []).forEach((r) => {
      const v = totaisRefeicao(r, mapa); t.refeicoes.push(v);
      if (!r.substituicao) { t.c += v.c; t.g += v.g; t.p += v.p; t.fib += v.fib; t.kcal += v.kcal; }
    });
    return t;
  }
  /* Equivalentes: mesma quantidade do macro principal com outros alimentos do mesmo papel */
  function equivalentes(alimentoId, qtd, mapa) {
    const a = mapa.get(alimentoId); if (!a) return [];
    let papel = null;
    for (const k of Object.keys(DB.papelAlimento)) if (DB.papelAlimento[k].includes(alimentoId)) { papel = k; break; }
    if (!papel) papel = a.categoria === 'proteinas' || a.categoria === 'suplementos' ? 'proteina' : a.categoria === 'gorduras' ? 'gordura' : a.categoria === 'frutas' ? 'fruta' : 'carbo';
    const macro = papel === 'proteina' ? 'p' : papel === 'gordura' ? 'g' : 'c';
    const alvo = a[macro] * qtd / 100; if (!alvo) return [];
    const lista = DB.papelAlimento[papel] || [];
    return lista.filter((id) => id !== alimentoId).map((id) => mapa.get(id)).filter((b) => b && b[macro] > 0)
      .map((b) => ({ alimento: b, qtd: Math.round(alvo / b[macro] * 100 / 5) * 5, kcal: r0(alvo / b[macro] * 100 * b.kcal / 100) }));
  }

  /* Gerador de plano alimentar */
  function gerarDieta({ metaKcal, metaC, metaG, metaP, nRefeicoes, estilo, excluir, nome, mapa, seed }) {
    mapa = mapa || mapaAlimentos();
    const rnd = rng(seed || 1);
    const n = clamp(Number(nRefeicoes) || 5, 3, 7);
    let estrutura = DB.estruturasDieta[n].slice();
    if (estilo === 'doce' && estrutura[0] === 'cafe') estrutura[0] = 'cafe-doce';
    if (estilo === 'salgado' && estrutura[0] === 'cafe-doce') estrutura[0] = 'cafe';
    const excl = new Set(excluir || []);
    const substituto = (id) => {
      for (const k of Object.keys(DB.papelAlimento)) {
        const lista = DB.papelAlimento[k];
        if (lista.includes(id)) { const ops = lista.filter((x) => !excl.has(x)); return ops.length ? ops[Math.floor(rnd() * ops.length)] : null; }
      }
      return null;
    };
    const refeicoes = estrutura.map((k) => {
      const m = DB.modelosRefeicao[k];
      const itens = [];
      m.itens.forEach(([id, q]) => {
        let aid = id;
        if (excl.has(aid)) aid = substituto(aid);
        if (aid) itens.push({ alimentoId: aid, qtd: q, flex: Object.keys(m.flex).find((papel) => m.flex[papel] === id) || null });
      });
      return { id: uid(), nome: m.nome, hora: m.hora, itens };
    });
    const dieta = { id: uid(), nome: nome || 'Plano gerado', refeicoes, meta: { kcal: r0(metaKcal), c: r0(metaC), g: r0(metaG), p: r0(metaP) } };
    ajustarDieta(dieta, mapa);
    return dieta;
  }
  /* Escala os itens "flex" (fontes principais) para bater as metas. */
  function ajustarDieta(dieta, mapa) {
    const meta = dieta.meta;
    const flexDe = (papel) => { const out = []; dieta.refeicoes.forEach((r) => r.itens.forEach((i) => { if (i.flex === papel) out.push(i); })); return out; };
    const passo = (papel, macro, metaVal) => {
      const itens = flexDe(papel); if (!itens.length) return;
      const tot = totaisDieta(dieta, mapa)[macro];
      const contrib = itens.reduce((s, i) => s + calcItem(i, mapa)[macro], 0);
      if (contrib <= 0) return;
      const fator = clamp(1 + (metaVal - tot) / contrib, 0.35, 3);
      itens.forEach((i) => {
        const a = mapa.get(i.alimentoId);
        let q = i.qtd * fator;
        const unidade = a && a.id === 'ovo' ? 50 : a && (a.categoria === 'suplementos' || a.categoria === 'gorduras') ? 5 : 10;
        q = Math.round(q / unidade) * unidade;
        const max = a && a.categoria === 'gorduras' ? 40 : a && a.id === 'ovo' ? 250 : a && a.categoria === 'suplementos' ? 60 : 400;
        i.qtd = clamp(q, unidade, max);
      });
    };
    for (let k = 0; k < 5; k++) { passo('proteina', 'p', meta.p); passo('carbo', 'c', meta.c); passo('gordura', 'g', meta.g); passo('fruta', 'c', meta.c); }
    return dieta;
  }

  /* ================= Treino ================= */
  /* Parser de repetições: "12-15", "20x15x12x12x12", "10+5", "7x7x7", "AMRAP", "Até a falha" */
  function parseReps(str, series) {
    const s = String(str || '').trim().toLowerCase().replace(/\s+/g, '');
    const n = Number(series) || 0;
    if (!s) return { tipo: 'livre', porSerie: Array.from({ length: n }, () => null), min: null, max: null, texto: '' };
    let m;
    if ((m = s.match(/^(\d+)-(\d+)$/))) return { tipo: 'faixa', min: +m[1], max: +m[2], porSerie: Array.from({ length: n }, () => +m[2]), texto: `${m[1]}–${m[2]}` };
    if ((m = s.match(/^\d+([x.]\d+)+$/))) { const arr = s.split(/[x.]/).map(Number); return { tipo: 'sequencia', porSerie: arr, min: Math.min(...arr), max: Math.max(...arr), texto: arr.join(' × ') }; }
    if ((m = s.match(/^\d+(\+\d+)+$/))) { const arr = s.split('+').map(Number); const tot = arr.reduce((a, b) => a + b, 0); return { tipo: 'soma', porSerie: Array.from({ length: n }, () => tot), min: arr[0], max: tot, texto: arr.join(' + ') }; }
    if ((m = s.match(/^(\d+)$/))) return { tipo: 'fixo', min: +m[1], max: +m[1], porSerie: Array.from({ length: n }, () => +m[1]), texto: m[1] };
    // "10 cada perna", "12 + drop", "15 por lado": usa o número inicial como alvo e mantém o texto
    if ((m = String(str).trim().match(/^(\d+)\s*(?:-\s*(\d+))?\b/))) { const lo = +m[1], hi = m[2] ? +m[2] : lo; return { tipo: 'texto', min: lo, max: hi, porSerie: Array.from({ length: n }, () => hi), texto: String(str).trim() }; }
    return { tipo: 'livre', porSerie: Array.from({ length: n }, () => null), min: null, max: null, texto: str };
  }

  /* Séries com blocos (drop-set, rest-pause, cluster, myo-reps, parciais, 21…):
     a linha principal da série é o 1º bloco; os demais ficam em "partes".
     Devolve null para métodos de série única ou { principal, partes: [{ rotulo, alvo, temCarga }] }. */
  const BLOCOS = {
    'drop-set': { tipo: 'drop', onde: 'ultima', n: 1 }, 'progressao-drops': { tipo: 'drop', onde: 'ultima', n: 2 },
    'super-drop': { tipo: 'drop', onde: 'todas', n: 4, repsBlocos: true }, 'drop-mecanico': { tipo: 'variacao', onde: 'ultima', n: 2 },
    'rest-pause': { tipo: 'pausa', onde: 'rp' }, 'myo-reps': { tipo: 'mini', onde: 'todas', n: 4, alvo: 5 },
    cluster: { tipo: 'bloco', onde: 'todas', n: 2, repsBlocos: true }, parciais: { tipo: 'parciais', onde: 'todas', n: 1, repsBlocos: true },
    21: { tipo: 'rotulos', onde: 'todas', rotulos: ['Metade inferior', 'Metade superior', 'Completas'], repsBlocos: true },
    amplitudes: { tipo: 'rotulos', onde: 'todas', rotulos: ['Completa', 'Curta alta', 'Curta baixa', 'Completa'], repsBlocos: true },
    inclinacoes: { tipo: 'posicao', onde: 'todas', repsBlocos: true, soMultiplo: true }, isometria: { tipo: 'iso', onde: 'todas', n: 1 }
  };
  const ROTULO = { drop: 'Drop', variacao: 'Variação', pausa: 'Pausa', mini: 'Mini', bloco: 'Bloco', parciais: 'Parciais', posicao: 'Posição', iso: 'Isometria', rotulos: 'Bloco' };
  const COM_CARGA = { drop: true, variacao: true };
  const NUMERA_PRINCIPAL = { bloco: true, posicao: true };
  function rotuloParte(tipo, k) { return tipo === 'parciais' || tipo === 'iso' ? ROTULO[tipo] + (k > 1 ? ' ' + k : '') : (ROTULO[tipo] || 'Bloco') + ' ' + k; }
  function blocosSerie(metodoId, reps, obs, i, nSeries) {
    const cfg = BLOCOS[metodoId]; if (!cfg) return null;
    const txt = String(obs || '') + ' ' + String(reps || '');
    // números dos blocos quando as reps descrevem a série por dentro: 12+6, 7x7x7, 10x10x10x10x10, (2+2+2)
    const fonte = String(reps || '').includes('(') ? String(reps).slice(String(reps).indexOf('(')) : String(reps || '');
    const nums = cfg.repsBlocos ? (fonte.replace(/\s+/g, '').match(/\d+/g) || []).map(Number) : [];
    const multi = nums.length >= 2 && /[x+×]/i.test(fonte);
    if (cfg.soMultiplo && !multi) return null;
    let n = cfg.n || 0, principal = null, alvos = [];
    if (multi) { principal = nums[0]; alvos = nums.slice(1); n = alvos.length; }
    if (cfg.tipo === 'drop' || cfg.tipo === 'variacao') { const m = txt.match(/(\d+)\s*(?:drops?|quedas?|redu)/i); if (m && !multi) n = Number(m[1]); }
    if (cfg.tipo === 'iso') { const a = txt.match(/(\d+)\s*seguidas/i), b = txt.match(/\+\s*(\d+)/); if (a) principal = Number(a[1]); alvos = [b ? Number(b[1]) : null]; }
    if (cfg.tipo === 'mini') { const m = String(reps || '').match(/(\d+)\s*\+\s*(\d+)\s*[x×]\s*(\d+)/i); if (m) { principal = +m[1]; n = +m[3]; alvos = Array(n).fill(+m[2]); } else alvos = Array(n).fill(cfg.alvo); }
    const ultima = i === nSeries - 1;
    if (cfg.onde === 'ultima' && !ultima) return { principal, partes: [] };
    if (cfg.onde === 'rp') { const so = /últim|ultim/i.test(String(obs || '')); n = so ? (ultima ? 2 : 0) : (i === 0 ? 0 : ultima && nSeries > 2 ? 2 : 1); }
    const partes = [];
    // bloco e posição numeram a linha principal como 1; drops, pausas e minis contam a partir dela
    const desloc = NUMERA_PRINCIPAL[cfg.tipo] ? 2 : 1;
    for (let k = 0; k < n; k++) partes.push({ rotulo: cfg.rotulos ? (cfg.rotulos[k + 1] || rotuloParte('bloco', k + 2)) : rotuloParte(cfg.tipo, k + desloc), alvo: alvos[k] != null ? alvos[k] : null, temCarga: !!COM_CARGA[cfg.tipo] });
    return { principal, partes, rotuloPrincipal: cfg.rotulos ? cfg.rotulos[0] : NUMERA_PRINCIPAL[cfg.tipo] ? rotuloParte(cfg.tipo, 1) : null, tipo: cfg.tipo };
  }
  /* Parte extra adicionada à mão (k = quantas partes a série já tem) */
  const novaParte = (metodoId, k) => { const t = (BLOCOS[metodoId] || {}).tipo || 'bloco'; return { rotulo: t === 'rotulos' ? rotuloParte('bloco', k + 2) : rotuloParte(t, k + (NUMERA_PRINCIPAL[t] ? 2 : 1)), alvo: null, temCarga: !!COM_CARGA[t] }; };
  /* Tonelagem da série somando os blocos (pausas e parciais usam a carga da linha principal) */
  function tonelagemSerie(st) {
    const c0 = Number(st.carga) || 0;
    return c0 * (Number(st.reps) || 0) + (st.partes || []).reduce((t, p) => t + (p.temCarga && p.carga !== '' && p.carga != null ? Number(p.carga) || 0 : c0) * (Number(p.reps) || 0), 0);
  }
  const textoSerie = (st) => `${st.carga || 0}×${st.reps}${st.rir !== '' && st.rir != null ? '@' + st.rir : ''}${(st.partes || []).filter((p) => p.reps).map((p) => ' +' + (p.temCarga && p.carga ? p.carga + '×' : '') + p.reps).join('')}`;

  /* Volume semanal por grupo (séries diretas + 0,5 indireta por secundário) */
  function volumeSemanal(programa, exMap) {
    const direto = {}, indireto = {};
    DB.grupos.forEach((g) => { direto[g.id] = 0; indireto[g.id] = 0; });
    (programa.fichas || []).forEach((f) => {
      const vezes = f.vezesSemana || 1;
      (f.exercicios || []).forEach((e) => {
        const ex = exMap.get(e.exercicioId); if (!ex) return;
        const s = (Number(e.series) || 0) * vezes;
        direto[ex.grupo] += s;
        (ex.secundarios || []).forEach((g) => { if (indireto[g] != null) indireto[g] += s * 0.5; });
      });
    });
    return DB.grupos.map((g) => {
      const d = direto[g.id], t = d + indireto[g.id];
      let status = 'ok';
      if (d === 0 && t === 0) status = 'zero'; else if (d < g.mev && t < g.mev) status = 'baixo'; else if (d > g.mrv) status = 'alto';
      return { grupo: g, direto: r1(d), indireto: r1(indireto[g.id]), total: r1(t), status };
    });
  }

  /* 1RM estimado */
  const epley = (carga, reps) => reps <= 1 ? carga : carga * (1 + reps / 30);
  const brzycki = (carga, reps) => reps <= 1 ? carga : reps >= 37 ? 0 : carga * 36 / (37 - reps);
  const pctRM = (rm, pct) => Math.round(rm * pct / 100 / 2.5) * 2.5;
  function melhor1RM(sessoes, exercicioId) {
    let best = null;
    sessoes.forEach((s) => (s.exercicios || []).forEach((e) => {
      if (e.exercicioId !== exercicioId) return;
      (e.series || []).forEach((st) => {
        const c = Number(st.carga), r = Number(st.reps); if (!(c > 0 && r > 0) || r > 15) return;
        const rm = epley(c, r);
        if (!best || rm > best.rm) best = { rm: r1(rm), carga: c, reps: r, data: s.data };
      });
    }));
    return best;
  }
  function historicoExercicio(sessoes, exercicioId) {
    return sessoes.filter((s) => (s.exercicios || []).some((e) => e.exercicioId === exercicioId && (e.series || []).some((st) => st.carga || st.reps)))
      .sort((a, b) => a.data < b.data ? -1 : 1)
      .map((s) => {
        const e = s.exercicios.find((x) => x.exercicioId === exercicioId);
        const series = (e.series || []).filter((st) => st.reps);
        const topCarga = Math.max(0, ...series.map((st) => Number(st.carga) || 0));
        const tonelagem = series.reduce((t, st) => t + tonelagemSerie(st), 0);
        const rm = Math.max(0, ...series.map((st) => st.carga && st.reps ? epley(+st.carga, +st.reps) : 0));
        return { data: s.data, series, topCarga, tonelagem: r0(tonelagem), rm: r1(rm), rirMedio: series.length ? r1(series.reduce((t, st) => t + (Number(st.rir) || 0), 0) / series.length) : null };
      });
  }
  /* Sugestão de progressão (dupla progressão com RIR alvo) */
  function sugerirProgressao(hist, exPrescrito, rirAlvo) {
    if (!hist.length) return { tipo: 'inicio', texto: 'Sem histórico: escolha uma carga que deixe ' + (rirAlvo ?? 2) + ' reps na reserva na última série.' };
    const ult = hist[hist.length - 1];
    const reps = parseReps(exPrescrito.reps, exPrescrito.series);
    const alvo = rirAlvo ?? 2;
    const series = ult.series.filter((s) => s.carga && s.reps);
    if (!series.length) return { tipo: 'inicio', texto: 'Última sessão sem cargas registradas.' };
    const carga = series[0].carga;
    const todasNoTopo = reps.max ? series.every((s) => Number(s.reps) >= reps.max) : false;
    const rirMedio = ult.rirMedio;
    const passo = carga >= 60 ? 5 : carga >= 20 ? 2.5 : 1;
    if (todasNoTopo && (rirMedio == null || rirMedio >= alvo)) return { tipo: 'subir', carga: carga + passo, texto: `Todas as séries no topo da faixa com RIR ≥ ${alvo}: suba para ${carga + passo} kg.` };
    if (rirMedio != null && rirMedio > alvo + 1.5) return { tipo: 'subir', carga: carga + passo, texto: `RIR médio ${rirMedio} está folgado: suba para ${carga + passo} kg.` };
    if (rirMedio != null && rirMedio < 0) return { tipo: 'manter', carga, texto: 'Falhou em séries: mantenha a carga e busque mais reps limpas.' };
    if (reps.min && series.some((s) => Number(s.reps) < reps.min)) return { tipo: 'reduzir', carga: Math.max(0, carga - passo), texto: `Ficou abaixo da faixa mínima (${reps.min}): reduza para ${Math.max(0, carga - passo)} kg ou mantenha e recupere as reps.` };
    return { tipo: 'manter', carga, texto: `Mantenha ${carga} kg e tente mais 1–2 reps por série.` };
  }

  /* ---------- Gerador de programa ---------- */
  function gerarPrograma({ sexo, nivel, divisaoId, frequencia, aparelhos, fase, enfase, seed, exMap, nome }) {
    exMap = exMap || new Map(DB.exercicios.map((e) => [e.id, e]));
    const rnd = rng(seed || 7);
    nivel = clamp(Number(nivel) || 1, 1, 3);
    const div = DB.divisoes.find((d) => d.id === divisaoId) || DB.divisoes[3];
    const F = DB.fases[fase] || DB.fases.hipertrofia;
    const disponiveis = aparelhos && aparelhos.length ? new Set(aparelhos) : null;
    const usados = new Map(); // exercicioId -> vezes usado no programa
    const alvoPorFicha = nivel === 1 ? 6 : nivel === 2 ? 7 : 8;
    const enfases = new Set(enfase || []);
    if (sexo === 'F' && !enfases.size) enfases.add('gluteo');
    const pool = (grupo) => [...exMap.values()].filter((e) => e.grupo === grupo && e.nivel <= nivel + (nivel === 1 ? 0 : 1) && (!disponiveis || disponiveis.has(e.aparelho)));
    const escolher = (grupo, quantos, ficha) => {
      const cand = pool(grupo);
      const jaPadroes = new Set(ficha.exercicios.map((x) => (exMap.get(x.exercicioId) || {}).padrao));
      const score = (e) => {
        let s = rnd() * 2;
        if (e.tipo === 'composto') s += 3;
        s -= (usados.get(e.id) || 0) * 4;
        if (ficha.exercicios.some((x) => x.exercicioId === e.id)) s -= 100;
        if (jaPadroes.has(e.padrao) && e.padrao !== 'isolado') s -= 1.5;
        if (F === DB.fases.forca && e.tipo === 'isolado') s -= 2;
        if (F === DB.fases['hipertrofia-metabolica'] && ['maquina', 'polia', 'pulley', 'remada-baixa'].includes(e.aparelho)) s += 1;
        if (sexo === 'F' && grupo === 'gluteo' && ['ponte', 'isolado'].includes(e.padrao)) s += 1.5;
        if (nivel === 1 && ['maquina', 'smith', 'polia', 'pulley'].includes(e.aparelho)) s += 1.2;
        if (e.tipo === 'composto' && ['barra', 'halter', 'maquina', 'smith', 'pulley', 'leg-press', 'hack', 'remada-baixa', 'barra-fixa'].includes(e.aparelho)) s += 1;
        if (['corporal', 'trx', 'elastico', 'bola'].includes(e.aparelho)) s -= (F === DB.fases.forca ? 3 : 1);
        if (grupo === 'quadriceps' && e.padrao === 'agachar') s += 1.5;
        if (grupo === 'isquiotibiais' && e.padrao === 'dobradica') s += 1;
        if (grupo === 'gluteo' && e.padrao === 'ponte') s += 1.5;
        if (grupo === 'dorsal' && (e.padrao === 'puxar-v' || e.padrao === 'puxar-h')) s += 0.5;
        return s;
      };
      const out = [];
      const ordenado = cand.map((e) => [score(e), e]).sort((a, b) => b[0] - a[0]);
      let compostos = 0;
      for (const [, e] of ordenado) {
        if (out.length >= quantos) break;
        if (e.tipo === 'composto') { if (compostos >= Math.ceil(quantos / 2) && quantos > 1) continue; compostos++; }
        out.push(e);
      }
      // se faltou composto na primeira posição, reordena para composto primeiro
      out.sort((a, b) => (b.tipo === 'composto') - (a.tipo === 'composto'));
      return out;
    };
    const fichas = div.fichas.map((fd) => {
      const ficha = { id: uid(), letra: fd.letra, nome: fd.nome, exercicios: [] };
      const grupos = fd.grupos.slice();
      // alocação: quantos exercícios por grupo
      const aparicoes = (g) => div.fichas.filter((x) => x.grupos.includes(g)).length;
      const pesos = grupos.map((g, i) => (i === 0 ? 3 : i === 1 ? 2 : i === 2 ? 2 : 1) + (enfases.has(g) && aparicoes(g) <= 2 ? 1 : 0) + (['abdomen', 'panturrilha', 'antebraco', 'lombar', 'adutores'].includes(g) ? -0.5 : 0));
      const somaP = pesos.reduce((a, b) => a + b, 0);
      let aloc = pesos.map((p) => Math.max(1, Math.round(p / somaP * alvoPorFicha)));
      let dif = alvoPorFicha - aloc.reduce((a, b) => a + b, 0);
      for (let i = 0; dif !== 0 && i < 20; i++) { const idx = i % aloc.length; if (dif > 0) { aloc[idx]++; dif--; } else if (aloc[idx] > 1) { aloc[idx]--; dif++; } }
      grupos.forEach((g, i) => {
        escolher(g, aloc[i], ficha).forEach((e) => {
          usados.set(e.id, (usados.get(e.id) || 0) + 1);
          ficha.exercicios.push({ id: uid(), exercicioId: e.id, series: 3, reps: '', metodoId: 'normal', obs: '', descanso: 60 });
        });
      });
      // prescrição: séries, reps, métodos por posição
      const isForca = fase === 'forca' || fase === 'intensificacao' || fase === 'potencia';
      const isMet = fase === 'hipertrofia-metabolica' || fase === 'resistencia';
      let isoCount = 0, fstUsado = false;
      ficha.exercicios.forEach((x, i) => {
        const e = exMap.get(x.exercicioId);
        const composto = e.tipo === 'composto';
        const base = Math.round(F.series);
        if (i === 0 && composto) {
          if (isForca) { x.series = 5; x.reps = fase === 'potencia' ? '3' : '5'; x.metodoId = nivel >= 2 ? 'cluster' : '5x5'; x.obs = 'Aquecer bem antes'; }
          else if (fase === 'adaptacao') { x.series = 3; x.reps = '15-20'; x.metodoId = 'aquecimento'; x.obs = 'Foco em técnica'; }
          else if (isMet) { x.series = 4; x.reps = '15-20'; x.metodoId = 'drop-set'; x.obs = 'Drop na última'; }
          else { x.series = 5; x.reps = '20x15x12x12x12'; x.metodoId = nivel >= 2 ? 'progressao-drops' : 'progressao-carga'; x.obs = nivel >= 2 ? 'Progressão de carga com 2 drops na última' : 'Progressão de carga'; }
        } else if (composto) {
          x.series = isForca ? 4 : base; x.reps = isForca ? '6-8' : fase === 'adaptacao' ? '12-15' : isMet ? '12-15' : '8-12';
          x.metodoId = isForca ? 'back-off' : 'normal'; x.obs = isForca ? 'Última série leve com 12 reps' : '';
        } else {
          isoCount++;
          x.series = isForca ? 3 : Math.max(3, base - 1);
          x.reps = isForca ? '8-10' : e.grupo === 'abdomen' ? '15-20' : e.grupo === 'panturrilha' ? '12-20' : `${F.reps[0] + 2}-${F.reps[1]}`;
          const ultimoDoGrupo = !ficha.exercicios.slice(i + 1).some((y) => (exMap.get(y.exercicioId) || {}).grupo === e.grupo);
          if (isMet && ultimoDoGrupo && nivel >= 2 && !fstUsado && e.grupo === grupos[0]) { fstUsado = true; x.metodoId = 'fst-7'; x.series = 7; x.reps = '10-12'; x.obs = 'FST-7: 30–45 s de descanso'; x.descanso = 40; }
          else if (!isForca && fase !== 'adaptacao' && isoCount % 2 === 1) { x.metodoId = 'pico-contracao'; x.obs = 'Segurar 2 seg na contração'; }
          else if (!isForca && fase !== 'adaptacao' && ultimoDoGrupo && nivel >= 2) { x.metodoId = 'parciais'; x.reps = '10+5'; x.obs = '10 completas + 5 parciais'; }
          else if (e.grupo === 'panturrilha' && nivel >= 2) { x.metodoId = 'amplitudes'; x.reps = '10+5+5+5'; x.obs = 'Completa + curta alta + curta baixa + completa'; }
        }
        x.rir = F.rir;
      });
      return ficha;
    });
    const freq = clamp(Number(frequencia) || div.freq[0], div.freq[0], 7);
    return { id: uid(), nome: nome || `${div.nome} — ${F.nome}`, divisaoId: div.id, frequencia: freq, fase: fase || 'hipertrofia', sexo, nivel, fichas, criadoEm: hoje(), gerado: true };
  }

  /* Agenda semanal: em que dias cada ficha cai (frequência vs nº de fichas) */
  function agendaSemanal(programa, diasTreino) {
    const dias = diasTreino && diasTreino.length ? diasTreino : [1, 2, 3, 4, 5, 6, 0].slice(0, programa.frequencia);
    const fichas = programa.fichas || [];
    return dias.map((d, i) => ({ dia: d, ficha: fichas.length ? fichas[i % fichas.length] : null }));
  }

  /* ---------- Periodização ---------- */
  function gerarCiclo({ nome, objetivo, nivel, modeloId, mesosCustom, inicio, programaId, frequencia }) {
    nivel = clamp(Number(nivel) || 2, 1, 3);
    let seq;
    if (mesosCustom && mesosCustom.length) seq = mesosCustom;
    else {
      const mod = DB.modelosMacro.find((m) => m.id === modeloId) || DB.modelosMacro.find((m) => m.objetivo === objetivo && m.nivel === nivel) || DB.modelosMacro[1];
      seq = mod.mesos;
    }
    inicio = inicio || hoje();
    let cursor = inicio, semanaGlobal = 0;
    const mesos = seq.map(([faseId, semanas], idx) => {
      const F = DB.fases[faseId] || DB.fases.hipertrofia;
      const micros = [];
      for (let w = 0; w < semanas; w++) {
        const prog = faseId === 'deload' ? DB.progressaoMicro.deload[0] : DB.progressaoMicro.padrao[Math.min(w, DB.progressaoMicro.padrao.length - 1)];
        const ultima = w === semanas - 1 && faseId !== 'deload' && semanas >= 3;
        semanaGlobal++;
        micros.push({
          id: uid(), semana: semanaGlobal, semanaMeso: w + 1, inicio: cursor, fim: addDias(cursor, 6), nome: ultima ? 'Choque' : prog.nome,
          volume: ultima ? Math.max(prog.volume, 1.2) : prog.volume, rir: faseId === 'deload' ? 4 : clamp(F.rir + prog.rir - (ultima ? 0.5 : 0), 0, 4), carga: prog.carga,
          reps: F.reps, descanso: F.descanso, intensidade: F.intensidade, fase: faseId, tipo: faseId === 'deload' ? 'deload' : ultima ? 'choque' : 'carga'
        });
        cursor = addDias(cursor, 7);
      }
      return { id: uid(), ordem: idx + 1, fase: faseId, nome: `Meso ${idx + 1} — ${F.nome}`, semanas, inicio: micros[0].inicio, fim: micros[micros.length - 1].fim, micros };
    });
    return { id: uid(), nome: nome || 'Macrociclo', objetivo, nivel, inicio, fim: mesos[mesos.length - 1].fim, semanas: semanaGlobal, mesos, programaId: programaId || null, frequencia: frequencia || null, criadoEm: hoje(), ativo: true };
  }
  function semanaAtual(ciclo, data) {
    data = data || hoje();
    for (const m of ciclo.mesos) for (const mi of m.micros) if (data >= mi.inicio && data <= mi.fim) return { meso: m, micro: mi, progresso: r0(((mi.semana - 1) / ciclo.semanas) * 100) };
    if (data > ciclo.fim) return { fim: true, progresso: 100 };
    return null;
  }
  /* Aplica a prescrição do microciclo a um exercício da ficha */
  function prescreverExercicio(ex, micro) {
    if (!micro) return { series: ex.series, reps: ex.reps, rir: ex.rir, descanso: ex.descanso, cargaDelta: 0 };
    const reps = parseReps(ex.reps, ex.series);
    const series = reps.tipo === 'sequencia' && micro.volume >= 0.8 ? (Number(ex.series) || reps.porSerie.length) : Math.max(1, Math.round((Number(ex.series) || 3) * micro.volume));
    let repsTxt = ex.reps;
    if (micro.fase === 'forca' && reps.tipo !== 'sequencia') repsTxt = `${micro.reps[0]}-${micro.reps[1]}`;
    if (micro.fase === 'deload') repsTxt = reps.tipo === 'sequencia' ? ex.reps : `${micro.reps[0]}-${micro.reps[1]}`;
    return { series, reps: repsTxt, rir: micro.rir, descanso: ex.descanso || micro.descanso, cargaDelta: micro.carga, volume: micro.volume };
  }

  /* ================= Aeróbico ================= */
  function kcalAerobico(atividadeId, intensidade, peso, minutos) {
    const a = DB.aerobicos.find((x) => x.id === atividadeId); if (!a) return 0;
    const met = a.met[intensidade] || a.met.moderado;
    return r0(met * 3.5 * peso / 200 * minutos);
  }
  function zonasFC(idade, fcRepouso) {
    const fcMax = 208 - 0.7 * idade;
    return DB.zonasFC.map((z) => {
      const lo = fcRepouso ? fcRepouso + (fcMax - fcRepouso) * z.pct[0] / 100 : fcMax * z.pct[0] / 100;
      const hi = fcRepouso ? fcRepouso + (fcMax - fcRepouso) * z.pct[1] / 100 : fcMax * z.pct[1] / 100;
      return { ...z, min: r0(lo), max: r0(hi), fcMax: r0(fcMax) };
    });
  }

  /* ================= Evolução ================= */
  function tendencia(pontos) { // [{data, valor}] → variação por semana (regressão linear)
    const p = pontos.filter((x) => x.valor != null).sort((a, b) => a.data < b.data ? -1 : 1);
    if (p.length < 2) return null;
    const x0 = new Date(p[0].data).getTime();
    const xs = p.map((x) => (new Date(x.data).getTime() - x0) / 6048e5), ys = p.map((x) => Number(x.valor));
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    if (!den) return null;
    return { porSemana: r1(num / den * 100) / 100, total: r1(ys[n - 1] - ys[0]), semanas: r1(xs[n - 1]) };
  }
  function mediaMovel(pontos, n) {
    const p = pontos.slice().sort((a, b) => a.data < b.data ? -1 : 1);
    return p.map((x, i) => { const w = p.slice(Math.max(0, i - n + 1), i + 1); return { data: x.data, valor: r1(w.reduce((s, y) => s + Number(y.valor), 0) / w.length) }; });
  }

  return {
    uid, hoje, addDias, diffDias, clamp, r0, r1, rng,
    imc, classImc, bfNavy, bfDeurenberg, classBf, tmb, tmbTodas, fatorAtividade, planoCalorico, macrosPct, macrosGkg, aguaDiaria,
    mapaAlimentos, calcItem, totaisRefeicao, totaisDieta, equivalentes, gerarDieta, ajustarDieta,
    parseReps, blocosSerie, novaParte, tonelagemSerie, textoSerie, volumeSemanal, epley, brzycki, pctRM, melhor1RM, historicoExercicio, sugerirProgressao, gerarPrograma, agendaSemanal,
    gerarCiclo, semanaAtual, prescreverExercicio, kcalAerobico, zonasFC, tendencia, mediaMovel
  };
})();
