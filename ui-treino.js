/* =====================================================================
 * FitLab — Interface de treino
 * Programas e fichas, gerador de programa, periodização (ciclos),
 * sessão ao vivo com cronômetro de descanso, histórico, exercícios
 * (detalhe/1RM) e aeróbico.
 * ===================================================================== */
(function () {
  'use strict';
  const A = window.App, DB = A.DB, E = A.E;
  const { h, n0, n1, field, inp, num, sel, badge, empty, tabs, fmtData, hoje, uid } = A;
  const S = () => A.S;

  const TABS = (cur) => tabs([
    { id: 'programas', nome: '📋 Programas', href: '#/treino/programas' }, { id: 'ciclos', nome: '📅 Ciclos', href: '#/treino/ciclos' },
    { id: 'historico', nome: '🕓 Histórico', href: '#/treino/historico' }, { id: 'aerobico', nome: '🏃 Aeróbico', href: '#/treino/aerobico' },
    { id: 'exercicios', nome: '📚 Exercícios', href: '#/biblioteca/exercicios' }
  ], cur);
  const exNome = (id) => { const e = A.exMap().get(id); return e ? e.nome : id; };
  const fmtPresc = (e) => `${e.series} × ${h(E.parseReps(e.reps, e.series).texto || e.reps || '—')}`;

  A.route('treino', () => { A.go('treino/programas'); return ''; });
  A.route('treino/:tab', (p) => {
    A.setTitle('Treino');
    const fn = { programas: viewProgramas, ciclos: viewCiclos, historico: viewHistorico, aerobico: viewAerobico }[p.tab];
    return TABS(p.tab) + (fn ? fn() : empty('🤷', 'Aba desconhecida'));
  });

  /* ================= Programas ================= */
  function viewProgramas() {
    const progs = A.mine('programas').sort((a, b) => (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0) || (a.criadoEm < b.criadoEm ? 1 : -1));
    A.on('progNovo', () => {
      A.modal({ title: 'Novo programa em branco', body: `<div id="pf">${field('Nome', inp('nome', '', 'placeholder="Ex.: ABC hipertrofia"'))}<div class="form-grid">${field('Frequência (dias/semana)', num('frequencia', 4, 'step="1" min="1" max="7"'))}${field('Nº de fichas', num('nFichas', 3, 'step="1" min="1" max="7"'))}${field('Fase', sel('fase', Object.entries(DB.fases).map(([k, v]) => [k, v.nome]), 'hipertrofia'))}</div></div>`,
        foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="progCriar">Criar</button>` });
      A.on('progCriar', () => {
        const d = A.formData(A.$('#pf')); if (!d.nome) { A.toast('Dê um nome.'); return; }
        const pr = { id: uid(), perfilId: A.perfil().id, nome: d.nome, frequencia: d.frequencia || 3, fase: d.fase, ativo: false, criadoEm: hoje(), fichas: [] };
        for (let i = 0; i < (d.nFichas || 3); i++) pr.fichas.push({ id: uid(), letra: String.fromCharCode(65 + i), nome: '', exercicios: [] });
        S().programas.push(pr); A.save(); A.closeModal(); A.go('programa/' + pr.id);
      });
    });
    return `<div class="row between"><h2>Programas de treino</h2><div class="row"><a class="btn primary sm" href="#/gerar-programa">✨ Gerar</a><button class="btn sm" data-act="progNovo">＋ Em branco</button></div></div>
      <div class="list mt">${progs.length ? progs.map((p) => `<a class="item" href="#/programa/${p.id}"><div class="ico">${p.ativo ? '⭐' : '📋'}</div><div><div class="t">${h(p.nome)} ${p.ativo ? badge('ativo', 'ok') : ''}</div><div class="s">${p.fichas.length} fichas · ${p.frequencia}×/semana · ${(DB.fases[p.fase] || {}).nome || ''}${p.importado ? ' · planilha' : ''}</div></div><div class="right muted">›</div></a>`).join('') : empty('📋', 'Nenhum programa ainda.', '<a class="btn primary" href="#/gerar-programa">✨ Gerar meu primeiro programa</a>')}</div>
      ${A.mine('sessoes').length === 0 && progs.length ? '<p class="help mt">Toque em um programa e em "Iniciar treino" para registrar sua primeira sessão.</p>' : ''}`;
  }

  A.route('programa/:id', (p) => {
    const pr = S().programas.find((x) => x.id === p.id); if (!pr) return empty('🤷', 'Programa não encontrado');
    A.setTitle(pr.nome);
    const exMap = A.exMap();
    const vol = E.volumeSemanal({ fichas: pr.fichas.map((f) => ({ ...f, vezesSemana: pr.frequencia / Math.max(1, pr.fichas.length) })) }, exMap);
    const prox = A.proximaFicha(pr);
    A.on('progAtivar', () => { S().programas.forEach((x) => { if (x.perfilId === pr.perfilId) x.ativo = x.id === pr.id; }); A.save(); A.render(); A.toast('Programa ativo'); });
    A.on('progEditar', () => {
      A.modal({ title: 'Editar programa', body: `<div id="pf">${field('Nome', inp('nome', pr.nome))}<div class="form-grid">${field('Frequência (dias/semana)', num('frequencia', pr.frequencia, 'step="1" min="1" max="7"'))}${field('Fase', sel('fase', Object.entries(DB.fases).map(([k, v]) => [k, v.nome]), pr.fase))}</div>${field('Observações', `<textarea name="obs">${h(pr.obs || '')}</textarea>`)}</div>`,
        foot: `<button class="btn danger" data-act="progExcluir">Excluir</button><span class="grow"></span><button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="progSalvar">Salvar</button>` });
      A.on('progSalvar', () => { Object.assign(pr, A.formData(A.$('#pf'))); A.save(); A.closeModal(); A.render(); });
      A.on('progExcluir', () => A.confirmar(`Excluir o programa "${pr.nome}"? O histórico de sessões é mantido.`, () => { S().programas = S().programas.filter((x) => x.id !== pr.id); A.save(); A.go('treino/programas'); }, { danger: true, ok: 'Excluir' }));
    });
    A.on('progDuplicar', () => { const c = JSON.parse(JSON.stringify(pr)); c.id = uid(); c.nome = pr.nome + ' (cópia)'; c.ativo = false; c.criadoEm = hoje(); c.importado = false; c.origem = null; c.fichas.forEach((f) => { f.id = uid(); f.exercicios.forEach((e) => { e.id = uid(); }); }); S().programas.push(c); A.save(); A.go('programa/' + c.id); A.toast('Duplicado'); });
    A.on('fichaNova', () => { const f = { id: uid(), letra: String.fromCharCode(65 + pr.fichas.length), nome: '', exercicios: [] }; pr.fichas.push(f); A.save(); A.go(`programa/${pr.id}/ficha/${f.id}`); });
    A.on('progImg', () => A.exportarImagem({ programa: pr }));
    A.on('progCopiar', () => { navigator.clipboard && navigator.clipboard.writeText(programaTexto(pr, exMap)).then(() => A.toast('Copiado para a área de transferência')); });
    A.on('progCiclo', () => A.go('gerar-ciclo?programa=' + pr.id));
    A.on('progPassado', () => A.treinoPassado({ fichaId: (prox || pr.fichas[0] || {}).id }));
    A.on('progAntes', () => { if (!pr.fichas.length) { A.toast('Adicione fichas primeiro.'); return; } comeceiAntes(pr); });
    return `<div class="card treino"><div class="row between"><div><h2>${h(pr.nome)} ${pr.ativo ? badge('ativo', 'ok') : ''}</h2><div class="muted">${pr.fichas.length} fichas · ${pr.frequencia}×/semana · ${(DB.fases[pr.fase] || {}).nome || ''} ${pr.divisaoId ? '· ' + ((DB.divisoes.find((d) => d.id === pr.divisaoId) || {}).nome || '') : ''}</div></div></div>
      ${pr.obs ? `<p class="text-2 mt-s">${h(pr.obs)}</p>` : ''}
      <div class="inline-actions">${!pr.ativo ? '<button class="btn primary sm" data-act="progAtivar">⭐ Tornar ativo</button>' : prox ? `<a class="btn treino sm" href="#/sessao/nova?ficha=${prox.id}">▶ Iniciar ficha ${h(prox.letra)}</a>` : ''}<button class="btn sm" data-act="progEditar">✏️ Editar</button><button class="btn sm" data-act="progDuplicar">⧉ Duplicar</button><button class="btn sm" data-act="progPassado">🕓 Treino passado</button><button class="btn sm" data-act="progAntes">🗓️ Comecei antes</button><button class="btn sm" data-act="progCiclo">📅 Planejar ciclo</button><button class="btn sm" data-act="progImg">🖼️ Exportar imagem</button><button class="btn sm ghost" data-act="progCopiar">📋 Copiar texto</button></div></div>
      <div class="section-title"><h2>Fichas</h2><button class="btn sm" data-act="fichaNova">＋ Ficha</button></div>
      <div class="list">${pr.fichas.map((f) => `<a class="item" href="#/programa/${pr.id}/ficha/${f.id}"><div class="ico letra">${h(f.letra)}</div><div><div class="t">${h(f.nome || 'Ficha ' + f.letra)}</div><div class="s">${f.exercicios.length} exercícios · ${f.exercicios.reduce((t, e) => t + (Number(e.series) || 0), 0)} séries · ${[...new Set(f.exercicios.map((e) => (exMap.get(e.exercicioId) || {}).grupo))].filter(Boolean).map(A.grupoNome).join(', ')}</div></div><div class="right muted">›</div></a>`).join('')}</div>
      <div class="section-title"><h2>Volume semanal por grupo</h2><span class="tiny muted">séries diretas (+ indiretas)</span></div>
      <div class="card">${volumeHtml(vol)}<p class="help">Marcas: MEV (mínimo efetivo) e MRV (máximo recuperável) por grupo. Fichas repetem conforme a frequência (${pr.frequencia}× / ${pr.fichas.length} fichas).</p></div>`;
  });
  function volumeHtml(vol) {
    return vol.filter((v) => v.total > 0 || v.grupo.mev > 0).map((v) => {
      const max = Math.max(v.grupo.mrv * 1.2, v.total, 1);
      return `<div class="vol ${v.status}"><span>${h(v.grupo.nome)}</span><div class="barv"><i class="ind" style="width:${Math.min(100, v.total / max * 100)}%;--c:${v.grupo.cor}"></i><i style="width:${Math.min(100, v.direto / max * 100)}%;--c:${v.grupo.cor}"></i><span class="marks" style="left:${v.grupo.mev / max * 100}%"></span><span class="marks" style="left:${v.grupo.mrv / max * 100}%"></span></div><span class="n">${n1(v.direto)}${v.indireto ? ` <small class="muted">+${n1(v.indireto)}</small>` : ''}</span></div>`;
    }).join('');
  }
  function programaTexto(pr, exMap) {
    return `${pr.nome} (${pr.frequencia}x/semana)\n\n` + pr.fichas.map((f) => `FICHA ${f.letra} — ${f.nome}\n` + f.exercicios.map((e, i) => `${i + 1}. ${exNome(e.exercicioId)} — ${e.series}x${e.reps}${e.metodoId && e.metodoId !== 'normal' ? ' [' + A.metodo(e.metodoId).nome + ']' : ''}${e.obs ? ' · ' + e.obs : ''}`).join('\n')).join('\n\n');
  }

  /* ---------- Editor de ficha ---------- */
  A.route('programa/:id/ficha/:fid', (p) => {
    const pr = S().programas.find((x) => x.id === p.id); if (!pr) return empty('🤷', 'Programa não encontrado');
    const f = pr.fichas.find((x) => x.id === p.fid); if (!f) return empty('🤷', 'Ficha não encontrada');
    A.setTitle(`Ficha ${f.letra}`);
    const exMap = A.exMap();
    A.on('fichaEditar', () => {
      A.modal({ title: 'Editar ficha', body: `<div id="pf"><div class="form-grid">${field('Letra', inp('letra', f.letra, 'maxlength="2"'))}${field('Nome', inp('nome', f.nome, 'placeholder="Ex.: Peito, tríceps e ombro"'))}</div></div>`,
        foot: `<button class="btn danger" data-act="fichaExcluir">Excluir ficha</button><span class="grow"></span><button class="btn primary" data-act="fichaSalvar">Salvar</button>` });
      A.on('fichaSalvar', () => { Object.assign(f, A.formData(A.$('#pf'))); A.save(); A.closeModal(); A.render(); });
      A.on('fichaExcluir', () => A.confirmar('Excluir esta ficha?', () => { pr.fichas = pr.fichas.filter((x) => x.id !== f.id); A.save(); A.go('programa/' + pr.id); }, { danger: true, ok: 'Excluir' }));
    });
    A.on('fichaImg', () => A.exportarImagem({ programa: pr, fichaId: f.id }));
    A.on('fichaPassado', () => A.treinoPassado({ fichaId: f.id }));
    A.on('exAdd', () => escolherExercicio((ex) => { f.exercicios.push({ id: uid(), exercicioId: ex.id, series: 3, reps: '10-12', metodoId: 'normal', obs: '', descanso: S().config.descansoPadrao, rir: 2 }); A.save(); A.render(); editarExercicio(pr, f, f.exercicios[f.exercicios.length - 1]); }));
    A.on('exEdit', (el) => editarExercicio(pr, f, f.exercicios.find((x) => x.id === el.dataset.id)));
    A.on('exUp', (el) => { const i = f.exercicios.findIndex((x) => x.id === el.dataset.id); if (i > 0) { [f.exercicios[i - 1], f.exercicios[i]] = [f.exercicios[i], f.exercicios[i - 1]]; A.save(); A.render(); } });
    A.on('exDown', (el) => { const i = f.exercicios.findIndex((x) => x.id === el.dataset.id); if (i < f.exercicios.length - 1) { [f.exercicios[i + 1], f.exercicios[i]] = [f.exercicios[i], f.exercicios[i + 1]]; A.save(); A.render(); } });
    const sem = A.semanaAtualInfo();
    return `<div class="card treino"><div class="row between"><div><h2>Ficha ${h(f.letra)} — ${h(f.nome || '')}</h2><div class="muted">${h(pr.nome)} · ${f.exercicios.length} exercícios · ${f.exercicios.reduce((t, e) => t + (Number(e.series) || 0), 0)} séries</div></div></div>
      <div class="inline-actions"><a class="btn treino sm" href="#/sessao/nova?ficha=${f.id}">▶ Iniciar treino</a><button class="btn sm" data-act="fichaPassado">🕓 Treino passado</button><button class="btn sm" data-act="exAdd">＋ Exercício</button><button class="btn sm" data-act="fichaImg">🖼️ Imagem</button><button class="btn sm ghost" data-act="fichaEditar">✏️ Ficha</button></div></div>
      ${sem && sem.micro ? `<div class="help mt">Semana atual do ciclo: <b>${h(sem.micro.nome)}</b> — volume ×${sem.micro.volume}, RIR ${sem.micro.rir}. A prescrição ajustada aparece ao iniciar o treino.</div>` : ''}
      <div class="card mt">${f.exercicios.length ? f.exercicios.map((e, i) => { const ex = exMap.get(e.exercicioId) || { nome: e.exercicioId, grupo: '' }; const m = A.metodo(e.metodoId); return `<div class="ex-row"><div class="n">${i + 1}</div><div data-act="exEdit" data-id="${e.id}" style="cursor:pointer"><div class="t">${h(ex.nome)}</div><div class="s">${h(A.grupoNome(ex.grupo))} · <span class="presc">${fmtPresc(e)}</span>${e.metodoId && e.metodoId !== 'normal' ? ' · ' + badge(m.nome, 'treino') : ''}${e.descanso ? ` · ${e.descanso}s` : ''}</div>${e.obs ? `<div class="obs">${h(e.obs)}</div>` : ''}</div><div class="acts"><button class="btn xs ghost" data-act="exUp" data-id="${e.id}" title="Subir">▲</button><button class="btn xs ghost" data-act="exDown" data-id="${e.id}" title="Descer">▼</button></div></div>`; }).join('') : empty('🏋️', 'Ficha vazia. Adicione exercícios.')}</div>`;
  });
  function editarExercicio(pr, f, e) {
    if (!e) return;
    const ex = A.exMap().get(e.exercicioId) || { nome: e.exercicioId };
    A.modal({ title: ex.nome, body: `<div id="pf"><div class="form-grid tight">${field('Séries', num('series', e.series, 'step="1" min="1" max="12" inputmode="numeric"'))}${field('Repetições', inp('reps', e.reps, 'placeholder="12-15 ou 20x15x12"'))}${field('Descanso (s)', num('descanso', e.descanso, 'step="5" inputmode="numeric"'))}${field('RIR alvo', num('rir', e.rir, 'step="0.5" min="0" max="5"'))}</div>
      ${field('Método / técnica', sel('metodoId', DB.metodos.map((m) => [m.id, m.nome]), e.metodoId || 'normal'))}<div class="help" id="metodoHelp">${h(A.metodo(e.metodoId).desc)}</div>
      ${field('Observação', inp('obs', e.obs, 'placeholder="Ex.: 2 drops na última"'))}
      <div class="help">Formatos de reps: faixa <b>12-15</b>, sequência por série <b>20x15x12x12x12</b>, soma <b>10+5</b> (completas + parciais), fixo <b>8</b>, ou texto livre.</div></div>`,
      foot: `<button class="btn danger" data-act="exRemover">Remover</button><button class="btn" data-act="exTrocar">Trocar exercício</button><span class="grow"></span><button class="btn primary" data-act="exSalvar">Salvar</button>` });
    A.on('exSalvar', () => { const d = A.formData(A.$('#pf')); Object.assign(e, d); e.series = Number(d.series) || 1; A.save(); A.closeModal(); A.render(); });
    A.on('exRemover', () => { f.exercicios = f.exercicios.filter((x) => x.id !== e.id); A.save(); A.closeModal(); A.render(); });
    A.on('exTrocar', () => escolherExercicio((nx) => { e.exercicioId = nx.id; A.save(); A.render(); editarExercicio(pr, f, e); }, ex.grupo));
    const selMet = A.$('#pf [name=metodoId]'); selMet.addEventListener('change', () => { A.$('#metodoHelp').textContent = A.metodo(selMet.value).desc; const ex2 = A.metodo(selMet.value).ex; if (ex2 && /\d/.test(ex2) && !/×/.test(ex2)) A.$('#pf [name=reps]').placeholder = ex2; });
  }
  /* Seletor de exercício (busca + filtros) */
  function escolherExercicio(cb, grupoInicial) {
    let grupo = grupoInicial || '', busca = '', aparelho = '';
    const lista = () => {
      const q = busca.toLowerCase();
      const items = [...A.exMap().values()].filter((e) => (!grupo || e.grupo === grupo) && (!aparelho || e.aparelho === aparelho) && (!q || e.nome.toLowerCase().includes(q))).slice(0, 80);
      return items.length ? items.map((e) => `<div class="item" data-act="exPick" data-id="${e.id}"><div class="ico">${e.tipo === 'composto' ? '🔩' : '🎯'}</div><div><div class="t">${h(e.nome)}</div><div class="s">${h(A.grupoNome(e.grupo))} · ${h(A.aparelhoNome(e.aparelho))}${e.unilateral ? ' · unilateral' : ''}</div></div><div class="right muted">＋</div></div>`).join('') : empty('🔍', 'Nada encontrado.', '<button class="btn sm" data-act="exCustom">Criar exercício personalizado</button>');
    };
    const draw = () => {
      A.$('#exLista').innerHTML = lista();
      A.$('#exChips').innerHTML = A.chips([{ id: '', nome: 'Todos', on: !grupo }, ...DB.grupos.map((g) => ({ id: g.id, nome: g.nome, on: grupo === g.id }))], null, 'exGrupo');
    };
    A.modal({ title: 'Escolher exercício', body: `<input type="search" class="search" id="exBusca" placeholder="Buscar exercício…" value="${h(busca)}"><div id="exChips" class="mb"></div>
      <div class="row mb"><select id="exAparelho"><option value="">Qualquer aparelho</option>${DB.aparelhos.map((a) => `<option value="${a.id}">${h(a.nome)}</option>`).join('')}</select><button class="btn sm" data-act="exCustom">＋ Personalizado</button></div><div class="list" id="exLista"></div>` });
    draw();
    A.$('#exBusca').addEventListener('input', (ev) => { busca = ev.target.value; A.$('#exLista').innerHTML = lista(); });
    A.$('#exAparelho').addEventListener('change', (ev) => { aparelho = ev.target.value; A.$('#exLista').innerHTML = lista(); });
    A.on('exGrupo', (el) => { grupo = el.dataset.id; draw(); });
    A.on('exPick', (el) => { const e = A.exMap().get(el.dataset.id); A.closeModal(); cb(e); });
    A.on('exCustom', () => novoExercicioCustom((e) => { A.closeModal(); cb(e); }));
  }
  function novoExercicioCustom(cb, existente) {
    const e = existente || {};
    A.modal({ title: existente ? 'Editar exercício' : 'Exercício personalizado', body: `<div id="pf">${field('Nome', inp('nome', e.nome, 'required'))}<div class="form-grid">${field('Grupo muscular', sel('grupo', DB.grupos.map((g) => [g.id, g.nome]), e.grupo || 'peito'))}${field('Aparelho', sel('aparelho', DB.aparelhos.map((a) => [a.id, a.nome]), e.aparelho || 'maquina'))}${field('Tipo', sel('tipo', [['composto', 'Composto (multiarticular)'], ['isolado', 'Isolado']], e.tipo || 'isolado'))}${field('Unilateral', sel('unilateral', [['0', 'Não'], ['1', 'Sim']], e.unilateral ? '1' : '0'))}</div>${field('Dica de execução', inp('dica', e.dica))}</div>`,
      foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="exCustomSalvar">Salvar</button>` });
    A.on('exCustomSalvar', () => {
      const d = A.formData(A.$('#pf')); if (!d.nome) { A.toast('Dê um nome.'); return; }
      const obj = existente || { id: 'custom-' + DB.slug(d.nome) + '-' + uid().slice(-4), custom: true, nivel: 1, secundarios: [], padrao: 'isolado' };
      Object.assign(obj, { nome: d.nome, grupo: d.grupo, aparelho: d.aparelho, tipo: d.tipo, unilateral: d.unilateral === '1', dica: d.dica });
      if (!existente) S().exerciciosCustom.push(obj);
      A.save(); A.closeModal(); if (cb) cb(obj); else A.render();
    });
  }
  A.novoExercicioCustom = novoExercicioCustom;
  A.escolherExercicio = escolherExercicio;

  /* ---------- Gerador de programa ---------- */
  A.route('gerar-programa', () => {
    A.setTitle('Gerar programa');
    const p = A.perfil(); const av = A.ultimaAvaliacao();
    const st = { sexo: p.sexo, nivel: p.nivel || 1, divisaoId: p.sexo === 'F' ? 'gluteo-foco' : 'abcde', frequencia: 5, fase: 'hipertrofia', enfase: [], aparelhos: [], seed: 1, preview: null };
    if (av && av.objetivo === 'cutting') st.fase = 'hipertrofia-metabolica';
    const exMap = A.exMap();
    const draw = () => {
      const div = DB.divisoes.find((d) => d.id === st.divisaoId);
      A.$('#gpForm').innerHTML = `<div class="form-grid">
        ${field('Sexo', sel('sexo', [['M', 'Masculino'], ['F', 'Feminino']], st.sexo))}
        ${field('Nível', sel('nivel', [[1, 'Iniciante'], [2, 'Intermediário'], [3, 'Avançado']], st.nivel))}
        ${field('Divisão', sel('divisaoId', DB.divisoes.filter((d) => !d.sexo || d.sexo === st.sexo || d.id === st.divisaoId).map((d) => [d.id, d.nome]), st.divisaoId))}
        ${field('Frequência (dias/semana)', num('frequencia', st.frequencia, `step="1" min="${div.freq[0]}" max="7"`), `Divisão sugere ${div.freq[0]}–${div.freq[1]}×`)}
        ${field('Fase / objetivo do bloco', sel('fase', Object.entries(DB.fases).filter(([k]) => k !== 'deload').map(([k, v]) => [k, v.nome]), st.fase), h((DB.fases[st.fase] || {}).desc || ''))}
      </div>
      <div class="lbl">Ênfase (grupos prioritários)</div>${A.chips(DB.grupos.map((g) => ({ id: g.id, nome: g.nome, on: st.enfase.includes(g.id) })), null, 'gpEnfase')}
      <details class="lib mt"><summary>Aparelhos disponíveis (${st.aparelhos.length ? st.aparelhos.length + ' selecionados' : 'todos'})</summary><div class="body">${A.chips(DB.aparelhos.filter((a) => a.tipo !== 'cardio').map((a) => ({ id: a.id, nome: a.nome, on: st.aparelhos.includes(a.id) })), null, 'gpAparelho')}<div class="help">Sem seleção = qualquer aparelho. Selecione só o que a sua academia tem.</div></div></details>`;
    };
    const gerar = () => {
      st.preview = E.gerarPrograma({ ...st, seed: st.seed, exMap });
      const pv = st.preview;
      A.$('#gpPreview').innerHTML = `<div class="section-title"><h2>Prévia — ${h(pv.nome)}</h2><button class="btn sm" data-act="gpNovo">🎲 Gerar outra</button></div>
        ${pv.fichas.map((f) => `<div class="card mb"><h3>Ficha ${h(f.letra)} — ${h(f.nome)}</h3>${f.exercicios.map((e, i) => `<div class="ex-row"><div class="n">${i + 1}</div><div><div class="t">${h(exNome(e.exercicioId))}</div><div class="s"><span class="presc">${fmtPresc(e)}</span>${e.metodoId !== 'normal' ? ' · ' + badge(A.metodo(e.metodoId).nome, 'treino') : ''}</div>${e.obs ? `<div class="obs">${h(e.obs)}</div>` : ''}</div><div></div></div>`).join('')}</div>`).join('')}
        <div class="card">${volumeHtml(E.volumeSemanal({ fichas: pv.fichas.map((f) => ({ ...f, vezesSemana: pv.frequencia / pv.fichas.length })) }, exMap))}</div>
        <div class="row mt">${field('Nome do programa', inp('gpNome', pv.nome))}</div>
        <button class="btn primary block" data-act="gpSalvar">💾 Salvar programa</button>`;
      window.scrollTo({ top: A.$('#gpPreview').offsetTop - 60, behavior: 'smooth' });
    };
    A.on('gpEnfase', (el) => { const id = el.dataset.id; st.enfase = st.enfase.includes(id) ? st.enfase.filter((x) => x !== id) : [...st.enfase, id]; draw(); });
    A.on('gpAparelho', (el) => { const id = el.dataset.id; st.aparelhos = st.aparelhos.includes(id) ? st.aparelhos.filter((x) => x !== id) : [...st.aparelhos, id]; draw(); A.$$('details.lib')[0].open = true; });
    const lerForm = () => { const d = A.formData(A.$('#gpForm')); st.sexo = d.sexo; st.nivel = Number(d.nivel); st.divisaoId = d.divisaoId; st.frequencia = Number(d.frequencia) || 3; st.fase = d.fase; };
    A.on('gpGerar', () => { lerForm(); st.seed = Date.now() % 100000; gerar(); });
    A.on('gpNovo', () => { st.seed = Date.now() % 100000; gerar(); });
    A.on('gpSalvar', () => { const pv = st.preview; pv.nome = A.$('[name=gpNome]').value || pv.nome; pv.perfilId = A.perfil().id; pv.ativo = !S().programas.some((x) => x.perfilId === pv.perfilId && x.ativo); S().programas.push(pv); A.save(); A.toast('Programa salvo' + (pv.ativo ? ' e ativado' : '')); A.go('programa/' + pv.id); });
    A.on('__after', () => { draw(); A.$('#gpForm').addEventListener('change', (ev) => { if (ev.target.name === 'divisaoId' || ev.target.name === 'sexo') { lerForm(); if (ev.target.name === 'sexo') st.divisaoId = st.sexo === 'F' ? 'gluteo-foco' : 'abcde'; const div = DB.divisoes.find((x) => x.id === st.divisaoId); st.frequencia = E.clamp(st.frequencia || div.freq[0], div.freq[0], 7); draw(); } }); });
    return `<div class="card treino"><h2>✨ Gerar programa de treino</h2><p class="text-2">O gerador monta as fichas a partir da divisão, do nível e da fase, escolhendo exercícios da biblioteca (${A.exMap().size} opções) e aplicando as metodologias adequadas. Depois você edita tudo.</p><div id="gpForm"></div><button class="btn primary block mt" data-act="gpGerar">Gerar prévia</button></div><div id="gpPreview"></div>`;
  });

  /* ================= Ciclos (periodização) ================= */
  function viewCiclos() {
    const cs = A.mine('ciclos').sort((a, b) => (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0) || (a.inicio < b.inicio ? 1 : -1));
    return `<div class="row between"><h2>Macrociclos</h2><a class="btn primary sm" href="#/gerar-ciclo">✨ Planejar ciclo</a></div>
      <p class="help">Macrociclo = objetivo de meses; mesociclos = blocos de 3–6 semanas com uma fase; microciclos = semanas com progressão de volume, carga e RIR.</p>
      <div class="list">${cs.length ? cs.map((c) => { const w = E.semanaAtual(c); return `<a class="item" href="#/ciclo/${c.id}"><div class="ico">${c.ativo ? '⭐' : '📅'}</div><div><div class="t">${h(c.nome)} ${c.ativo ? badge('ativo', 'ok') : ''}</div><div class="s">${(DB.objetivos.find((o) => o.id === c.objetivo) || {}).nome || ''} · ${c.semanas} semanas · ${fmtData(c.inicio, true)} → ${fmtData(c.fim, true)}${w && w.micro ? ` · semana ${w.micro.semana}` : w && w.fim ? ' · encerrado' : ''}</div></div><div class="right muted">›</div></a>`; }).join('') : empty('📅', 'Nenhum ciclo planejado.', '<a class="btn primary" href="#/gerar-ciclo">Planejar meu primeiro macrociclo</a>')}</div>`;
  }
  A.route('gerar-ciclo', (p, q) => {
    A.setTitle('Planejar ciclo');
    const perfil = A.perfil(); const av = A.ultimaAvaliacao();
    const progs = A.mine('programas');
    const st = { objetivo: av ? av.objetivo : 'bulking', nivel: perfil.nivel || 2, modeloId: '', inicio: A.inicioSemana(), programaId: q.programa || (A.programaAtivo() || {}).id || '', custom: false, mesos: [], nome: '' };
    const modeloPadrao = () => (DB.modelosMacro.find((m) => m.objetivo === st.objetivo && m.nivel === st.nivel) || DB.modelosMacro.find((m) => m.objetivo === st.objetivo) || DB.modelosMacro[1]);
    st.modeloId = modeloPadrao().id; st.mesos = modeloPadrao().mesos.map((m) => m.slice());
    const draw = () => {
      const prev = E.gerarCiclo({ nome: st.nome, objetivo: st.objetivo, nivel: st.nivel, mesosCustom: st.mesos, inicio: st.inicio });
      A.$('#gcForm').innerHTML = `<div class="form-grid">
        ${field('Nome', inp('nome', st.nome, 'placeholder="Ex.: Bulking 2026"'))}
        ${field('Objetivo', sel('objetivo', DB.objetivos.map((o) => [o.id, o.nome]), st.objetivo))}
        ${field('Nível', sel('nivel', [[1, 'Iniciante'], [2, 'Intermediário'], [3, 'Avançado']], st.nivel))}
        ${field('Modelo', sel('modeloId', [...DB.modelosMacro.map((m) => [m.id, m.nome]), ['custom', 'Personalizado']], st.custom ? 'custom' : st.modeloId))}
        ${field('Início (segunda-feira)', inp('inicio', st.inicio, 'type="date"'))}
        ${field('Programa de treino vinculado', sel('programaId', [['', '— nenhum —'], ...progs.map((x) => [x.id, x.nome])], st.programaId))}
      </div>
      <div class="section-title"><h3>Mesociclos (${prev.semanas} semanas · até ${fmtData(prev.fim, true)})</h3><button class="btn xs" data-act="gcAddMeso">＋ Meso</button></div>
      ${st.mesos.map((m, i) => `<div class="row nowrap mb" style="gap:6px"><b class="muted" style="width:22px">${i + 1}</b><select data-act="gcMesoFase" data-on="change" data-i="${i}" class="grow">${Object.entries(DB.fases).map(([k, v]) => `<option value="${k}" ${k === m[0] ? 'selected' : ''}>${h(v.nome)}</option>`).join('')}</select><input type="number" data-act="gcMesoSem" data-on="change" data-i="${i}" value="${m[1]}" min="1" max="8" style="width:64px"> <span class="tiny muted">sem</span><button class="btn xs ghost" data-act="gcRmMeso" data-i="${i}">✕</button></div>`).join('')}
      <div class="timeline">${prev.mesos.flatMap((m) => m.micros.map((mi) => `<div class="wk ${mi.tipo}" title="Sem. ${mi.semana}: ${h(mi.nome)} (${h((DB.fases[mi.fase] || {}).nome)})"></div>`)).join('')}</div>
      <div class="legend"><span style="--c:var(--treino)">Carga</span><span style="--c:var(--danger)">Choque</span><span style="--c:var(--ok)">Deload</span></div>`;
    };
    const lerForm = () => { const d = A.formData(A.$('#gcForm')); st.nome = d.nome; st.objetivo = d.objetivo; st.nivel = Number(d.nivel); st.inicio = d.inicio || st.inicio; st.programaId = d.programaId; return d; };
    A.on('gcMesoFase', (el) => { lerForm(); st.mesos[+el.dataset.i][0] = el.value; st.custom = true; draw(); });
    A.on('gcMesoSem', (el) => { lerForm(); st.mesos[+el.dataset.i][1] = E.clamp(Number(el.value) || 1, 1, 8); st.custom = true; draw(); });
    A.on('gcRmMeso', (el) => { lerForm(); if (st.mesos.length > 1) st.mesos.splice(+el.dataset.i, 1); st.custom = true; draw(); });
    A.on('gcAddMeso', () => { lerForm(); st.mesos.push(['hipertrofia', 4]); st.custom = true; draw(); });
    A.on('gcSalvar', () => {
      lerForm();
      const c = E.gerarCiclo({ nome: st.nome || (DB.objetivos.find((o) => o.id === st.objetivo) || {}).nome + ' — ' + fmtData(st.inicio, true), objetivo: st.objetivo, nivel: st.nivel, mesosCustom: st.mesos, inicio: st.inicio, programaId: st.programaId || null });
      c.perfilId = A.perfil().id;
      S().ciclos.forEach((x) => { if (x.perfilId === c.perfilId) x.ativo = false; });
      S().ciclos.push(c); A.save(); A.toast('Ciclo planejado e ativado'); A.go('ciclo/' + c.id);
    });
    A.on('__after', () => {
      draw();
      A.$('#gcForm').addEventListener('change', (ev) => {
        const nm = ev.target.name; if (!nm) return;
        lerForm();
        if (nm === 'modeloId') { if (ev.target.value === 'custom') st.custom = true; else { st.custom = false; st.modeloId = ev.target.value; st.mesos = DB.modelosMacro.find((m) => m.id === st.modeloId).mesos.map((m) => m.slice()); } draw(); }
        else if (nm === 'objetivo' || nm === 'nivel') { if (!st.custom) { st.modeloId = modeloPadrao().id; st.mesos = modeloPadrao().mesos.map((m) => m.slice()); } draw(); }
        else if (nm === 'inicio') draw();
      });
    });
    return `<div class="card treino"><h2>📅 Planejar macrociclo</h2><p class="text-2">Escolha objetivo e nível para um modelo pronto, ou monte os mesociclos à mão. Cada semana recebe prescrição de volume, RIR e ajuste de carga aplicada automaticamente nos treinos.</p><div id="gcForm"></div><button class="btn primary block mt" data-act="gcSalvar">💾 Salvar e ativar ciclo</button></div>`;
  });
  A.route('ciclo/:id', (p) => {
    const c = S().ciclos.find((x) => x.id === p.id); if (!c) return empty('🤷', 'Ciclo não encontrado');
    A.setTitle(c.nome);
    const w = E.semanaAtual(c); const hj = hoje();
    const prog = S().programas.find((x) => x.id === c.programaId);
    A.on('cAtivar', () => { S().ciclos.forEach((x) => { if (x.perfilId === c.perfilId) x.ativo = x.id === c.id; }); A.save(); A.render(); });
    A.on('cExcluir', () => A.confirmar('Excluir este ciclo?', () => { S().ciclos = S().ciclos.filter((x) => x.id !== c.id); A.save(); A.go('treino/ciclos'); }, { danger: true, ok: 'Excluir' }));
    A.on('cEditar', () => {
      A.modal({ title: 'Editar ciclo', body: `<div id="pf">${field('Nome', inp('nome', c.nome))}${field('Programa vinculado', sel('programaId', [['', '— nenhum —'], ...A.mine('programas').map((x) => [x.id, x.nome])], c.programaId || ''))}</div>`, foot: `<button class="btn primary" data-act="cSalvar">Salvar</button>` });
      A.on('cSalvar', () => { const d = A.formData(A.$('#pf')); c.nome = d.nome; c.programaId = d.programaId || null; A.save(); A.closeModal(); A.render(); });
    });
    return `<div class="card treino"><div class="row between"><div><h2>${h(c.nome)} ${c.ativo ? badge('ativo', 'ok') : ''}</h2><div class="muted">${(DB.objetivos.find((o) => o.id === c.objetivo) || {}).nome || ''} · ${c.semanas} semanas · ${fmtData(c.inicio, true)} → ${fmtData(c.fim, true)}${prog ? ` · programa: <a href="#/programa/${prog.id}">${h(prog.nome)}</a>` : ''}</div></div></div>
      <div class="timeline">${c.mesos.flatMap((m) => m.micros.map((mi) => `<div class="wk ${mi.tipo} ${w && w.micro && w.micro.id === mi.id ? 'now' : ''} ${mi.fim < hj ? 'past' : ''}" title="Sem. ${mi.semana}"></div>`)).join('')}</div>
      ${w && w.micro ? `<div class="text-2">Agora: <b>${h(w.meso.nome)}</b>, semana ${w.micro.semanaMeso}/${w.meso.semanas} (${h(w.micro.nome)}) — ${w.progresso}% do ciclo.</div>` : w && w.fim ? '<div class="text-2">Ciclo encerrado.</div>' : `<div class="text-2">Começa em ${fmtData(c.inicio, true)}.</div>`}
      <div class="inline-actions">${!c.ativo ? '<button class="btn primary sm" data-act="cAtivar">⭐ Tornar ativo</button>' : ''}<button class="btn sm" data-act="cEditar">✏️ Editar</button><button class="btn sm danger" data-act="cExcluir">Excluir</button></div></div>
      ${c.mesos.map((m) => { const F = DB.fases[m.fase]; return `<div class="card mt meso-card ${m.fase}"><div class="row between"><h3>${h(m.nome)}</h3><span class="tiny muted">${fmtData(m.inicio)} → ${fmtData(m.fim)}</span></div><div class="tiny text-2">${h(F.desc)} Reps ${F.reps[0]}–${F.reps[1]} · descanso ~${F.descanso}s · ${F.intensidade[0]}–${F.intensidade[1]}% 1RM</div>
        ${m.micros.map((mi) => `<div class="micro-row ${w && w.micro && w.micro.id === mi.id ? 'now' : ''}"><span class="wk-n">S${mi.semana}</span><span><b>${h(mi.nome)}</b> <span class="muted">${fmtData(mi.inicio)}–${fmtData(mi.fim)}</span></span><span class="tiny">vol ×${mi.volume} · RIR ${mi.rir} · carga ${mi.carga > 0 ? '+' : ''}${mi.carga}%</span></div>`).join('')}</div>`; }).join('')}
      <div class="help mt">Como usar: o volume (×) multiplica as séries da ficha; o RIR indica quantas repetições deixar na reserva; a carga (%) é o ajuste sugerido sobre a semana 1 do mesociclo. Deloads cortam o volume pela metade.</div>`;
  });

  /* ================= Sessão de treino ================= */
  /* Cronômetro de descanso. O fim fica salvo (sobrevive a recarregar o app) e é
     repassado ao service worker, que mostra a contagem na barra de notificações
     e avisa ao terminar quando o app está em segundo plano. */
  const TKEY = 'fitlab.timer', TTAG = 'fitlab-timer';
  let timerT = null, timerFim = 0, timerInfo = {};
  const swAtivo = () => navigator.serviceWorker && navigator.serviceWorker.controller;
  const avisarSW = (msg) => { try { const c = swAtivo(); if (c) c.postMessage(msg); } catch (e) { /* sem SW */ } };
  const fecharNotificacoes = () => { try { if (navigator.serviceWorker) navigator.serviceWorker.ready.then((r) => r.getNotifications({ tag: TTAG })).then((ns) => ns.forEach((n) => n.close())).catch(() => {}); } catch (e) { /* */ } };
  function pedirPermissao() {
    if (!window.Notification || Notification.permission !== 'default' || S().config.notifPedida) return;
    S().config.notifPedida = true; A.save();
    try { Notification.requestPermission(); } catch (e) { /* navegador antigo */ }
  }
  const mmss = (seg) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
  function tickTimer() {
    const el = A.$('#timer'); const rest = Math.max(0, Math.round((timerFim - Date.now()) / 1000));
    el.innerHTML = `<div class="timer ${rest === 0 ? 'done' : ''}"><span>⏱ ${mmss(rest)}</span><button data-act-timer="-15">−15</button><button data-act-timer="+15">+15</button><button data-act-timer="x">✕</button></div>${rest > 0 && timerInfo.prox ? `<div class="timer-prox">${h(timerInfo.prox)}</div>` : ''}`;
    if (rest === 0) {
      const atraso = Date.now() - timerFim; stopTimer(true);
      if (atraso < 5000) beep();
      if (document.hidden && !swAtivo() && window.Notification && Notification.permission === 'granted') { try { new Notification('✅ Descanso encerrado', { body: timerInfo.prox || 'Hora da próxima série', tag: TTAG }); } catch (e) { /* */ } }
    }
  }
  function rodarTimer(fim, info) {
    clearInterval(timerT); timerFim = fim; timerInfo = info || {};
    try { localStorage.setItem(TKEY, JSON.stringify({ fim, info: timerInfo })); } catch (e) { /* */ }
    avisarSW({ tipo: 'timer', fim, prox: timerInfo.prox || '', url: timerInfo.url || location.href });
    tickTimer(); timerT = setInterval(tickTimer, 500);
    A.$('#timer').onclick = (ev) => {
      const b = ev.target.closest('[data-act-timer]'); if (!b) return; const v = b.dataset.actTimer;
      if (v === 'x') stopTimer(); else rodarTimer(Math.max(Date.now() + 1000, timerFim + Number(v) * 1000), timerInfo);
    };
  }
  function startTimer(seg, info) { pedirPermissao(); A.$('#toast').innerHTML = ''; rodarTimer(Date.now() + seg * 1000, { url: location.href, ...(info || {}) }); }
  /* keep = terminou sozinho (o aviso fica 4 s na tela); sem keep = cancelado */
  function stopTimer(keep) {
    const rodava = !!timerT; clearInterval(timerT); timerT = null;
    try { localStorage.removeItem(TKEY); } catch (e) { /* */ }
    if (!keep) { A.$('#timer').innerHTML = ''; if (rodava) { avisarSW({ tipo: 'timerParar' }); fecharNotificacoes(); } }
    else setTimeout(() => { if (!timerT) A.$('#timer').innerHTML = ''; }, 4000);
  }
  // volta ao app: atualiza na hora e limpa a notificação da contagem
  // saiu do app: o SW mostra a contagem na hora (sem esperar o próximo ciclo de 5 s)
  const reagendar = () => { if (timerT) avisarSW({ tipo: 'timer', fim: timerFim, prox: timerInfo.prox || '', url: timerInfo.url || location.href }); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') { reagendar(); return; } fecharNotificacoes(); if (timerT) tickTimer(); });
  window.addEventListener('pagehide', reagendar);
  // app recarregado no meio do descanso: retoma
  A.hooks.boot.push(() => {
    fecharNotificacoes();
    let t = null; try { t = JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) { /* */ }
    if (t && t.fim > Date.now()) rodarTimer(t.fim, t.info); else { try { localStorage.removeItem(TKEY); } catch (e) { /* */ } }
  });

  /* Exercícios conjugados: sequências da ficha com o mesmo método combinado
     (bi-set e super set em pares, tri-set em trios, giant set e circuito inteiros) */
  const COMBINADOS = { 'bi-set': 2, 'super-set': 2, 'tri-set': 3, 'giant-set': 99, 'circuito': 99 };
  function grupoDe(exs, idx) {
    const m = exs[idx].metodoId, tam = COMBINADOS[m]; if (!tam) return [idx];
    let ini = idx; while (ini > 0 && exs[ini - 1].metodoId === m) ini--;
    let fim = idx; while (fim < exs.length - 1 && exs[fim + 1].metodoId === m) fim++;
    const a = ini + Math.floor((idx - ini) / tam) * tam, b = Math.min(fim, a + tam - 1);
    const g = []; for (let j = a; j <= b; j++) g.push(j); return g;
  }
  /* O que vem depois de fechar a série i do grupo (texto para o cronômetro e a notificação) */
  function proximoPasso(exs, g, i, exMap) {
    const nome = (e) => (exMap.get(e.exercicioId) || { nome: e.exercicioId }).nome;
    const cont = g.map((j) => exs[j]).find((e) => e.series.length > i + 1 && !e.series[i + 1].ok);
    if (cont) return `Próxima: ${nome(cont)} — série ${i + 2}`;
    const pendente = (e) => e.series.some((x) => !x.ok);
    const depois = exs.slice(g[g.length - 1] + 1).find(pendente) || exs.slice(0, g[0]).find(pendente);
    return depois ? `Próximo exercício: ${nome(depois)}` : 'Última série do treino!';
  }

  function beep() {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); if (!S().config.somTimer) return; const ctx = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25, 0.5].forEach((t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); }); } catch (e) { /* sem áudio */ }
  }
  const agora = () => new Date().toTimeString().slice(0, 5);

  /* Séries da sessão a partir da prescrição, com cargas da última vez (até a data da sessão) */
  /* Série nova; métodos com blocos (drops, pausas, minis, parciais…) ganham "partes" */
  const repsBase = (se) => (se.presc && se.presc.repsBase) || (se.presc && se.presc.reps) || '';
  function novaSerie(se, i, n, base, alvoPadrao) {
    const b = E.blocosSerie(se.metodoId, repsBase(se), se.obs, i, n);
    const st = { carga: base ? Number(base.carga) || '' : '', reps: '', rir: '', ok: false, alvo: b && b.principal != null ? b.principal : alvoPadrao };
    if (b) {
      st.partes = b.partes.map((p, k) => { const ant = base && base.partes && base.partes[k]; return { rotulo: p.rotulo, alvo: p.alvo != null ? p.alvo : '', temCarga: p.temCarga, carga: p.temCarga && ant ? Number(ant.carga) || '' : '', reps: '' }; });
      if (b.rotuloPrincipal) st.rotulo = b.rotuloPrincipal;
    }
    return st;
  }
  function preencherSeries(se, sessoes) {
    const reps = E.parseReps(se.presc.reps, se.presc.series);
    const hist = E.historicoExercicio(sessoes, se.exercicioId);
    const ult = hist[hist.length - 1];
    se.series = [];
    for (let i = 0; i < se.presc.series; i++) {
      const base = ult && ult.series[Math.min(i, ult.series.length - 1)];
      se.series.push(novaSerie(se, i, se.presc.series, base, reps.porSerie[i] != null ? reps.porSerie[i] : (reps.max || '')));
    }
  }
  const temBlocos = (e) => !!E.blocosSerie(e.metodoId, repsBase(e), e.obs, 0, 1);
  const meioKg = (v) => Math.round(v * 2) / 2;
  /* Carga sugerida para um drop: ~20 % abaixo do bloco anterior */
  const sugestaoDrop = (st, k) => { let ant = Number(st.carga) || 0; for (let j = 0; j < k; j++) { const p = st.partes[j]; if (p.temCarga && Number(p.carga)) ant = Number(p.carga); else if (p.temCarga) ant = meioKg(ant * 0.8); } return ant ? meioKg(ant * 0.8) : ''; };
  const anterioresA = (data, excetoId) => A.mine('sessoes').filter((x) => x.id !== excetoId && x.fim && x.data <= data);
  /* Cria a sessão de uma ficha. modo: undefined = treino ao vivo (hoje);
     'completo' = registrado depois, com cargas; 'feito' = só marcado como feito */
  function criarSessao(prog, ficha, { data, inicio, modo } = {}) {
    data = data || hoje();
    const sem = A.semanaAtualInfo(data); const micro = sem && sem.micro ? sem.micro : null;
    const sessoes = anterioresA(data);
    const s = { id: uid(), perfilId: A.perfil().id, data, inicio: modo ? (inicio || '') : agora(), fim: null, programaId: prog.id, fichaId: ficha.id, fichaNome: `Ficha ${ficha.letra} — ${ficha.nome}`, fichaLetra: ficha.letra, microSemana: micro ? micro.semana : null, microNome: micro ? micro.nome : null, exercicios: [], obs: '' };
    if (modo) s.retro = true;
    ficha.exercicios.forEach((e) => {
      const presc = E.prescreverExercicio(e, micro);
      const se = { id: uid(), exercicioId: e.exercicioId, series: [], presc: { series: presc.series, reps: presc.reps, repsBase: e.reps, rir: presc.rir, descanso: presc.descanso || e.descanso || S().config.descansoPadrao, cargaDelta: presc.cargaDelta }, metodoId: e.metodoId, obs: e.obs };
      if (modo !== 'feito') preencherSeries(se, sessoes);
      s.exercicios.push(se);
    });
    if (modo === 'feito') { s.fim = s.inicio || '✓'; s.semDetalhes = true; }
    S().sessoes.push(s);
    return s;
  }
  const somaMin = (hm, min) => { const [hh, mm] = hm.split(':').map(Number); const t = (hh * 60 + mm + (Number(min) || 0)) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const horarioSessao = (s) => {
    if (s.retro) return [s.inicio, s.duracaoMin ? s.duracaoMin + ' min' : '', 'registrado depois'].filter(Boolean).join(' · ');
    return `${s.inicio}${s.fim ? '–' + s.fim + ' · ' + s.duracaoMin + ' min' : ''}`;
  };
  const opcoesFichas = (fichaId) => A.mine('programas').sort((a, b) => (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0))
    .map((pr) => `<optgroup label="${h(pr.nome)}">${pr.fichas.map((f) => `<option value="${f.id}" ${f.id === fichaId ? 'selected' : ''}>Ficha ${h(f.letra)}${f.nome ? ' — ' + h(f.nome) : ''}</option>`).join('')}</optgroup>`).join('');
  const acharFicha = (id) => { for (const pr of A.mine('programas')) { const f = pr.fichas.find((x) => x.id === id); if (f) return { prog: pr, ficha: f }; } return null; };

  /* Próxima ficha do programa considerando só os treinos anteriores à data */
  function proximaAte(prog, data) {
    if (!prog || !prog.fichas.length) return null;
    const ss = A.mine('sessoes').filter((s) => s.programaId === prog.id && s.data < data).sort((a, b) => (a.data + (a.inicio || '')) < (b.data + (b.inicio || '')) ? 1 : -1);
    const idx = ss.length ? prog.fichas.findIndex((f) => f.id === ss[0].fichaId) : -1;
    return prog.fichas[(idx + 1) % prog.fichas.length];
  }

  /* ---------- Registrar um treino já feito (data passada) ---------- */
  A.treinoPassado = function ({ fichaId, data } = {}) {
    if (!A.mine('programas').some((pr) => pr.fichas.length)) { A.toast('Crie um programa primeiro.'); return; }
    const hj = hoje();
    data = data || E.addDias(hj, -1);
    let escolhida = !!fichaId;
    const prog = fichaId ? (acharFicha(fichaId) || {}).prog : A.programaAtivo();
    fichaId = fichaId || (proximaAte(prog, data) || {}).id;
    A.modal({ title: 'Registrar treino passado', body: `<div id="tpf"><div class="form-grid">${field('Data do treino', inp('data', data, `type="date" max="${hj}" data-act="tpData" data-on="change"`))}${field('Horário (opcional)', inp('inicio', '', 'type="time"'))}</div>
      ${field('Ficha', `<select name="fichaId" data-act="tpFicha" data-on="change">${opcoesFichas(fichaId)}</select>`)}
      ${field('Como registrar', sel('modo', [['completo', 'Preencher cargas, reps e RIR'], ['feito', 'Só marcar como feito (sem cargas)']], 'completo'), 'Marcado como feito conta no histórico e na sequência das fichas, mas não entra na progressão de carga. Dá para completar depois em Editar.')}</div>`,
      foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="tpSalvar">Registrar</button>` });
    A.on('tpFicha', () => { escolhida = true; });
    A.on('tpData', (el) => { if (escolhida || !el.value) return; const f = proximaAte(prog, el.value); if (f) A.$('#tpf select[name=fichaId]').value = f.id; });
    A.on('tpSalvar', () => {
      const d = A.formData(A.$('#tpf'));
      if (!d.data || d.data > hj) { A.toast('Escolha uma data até hoje.'); return; }
      const alvo = acharFicha(d.fichaId); if (!alvo) { A.toast('Escolha a ficha.'); return; }
      const criar = () => {
        const s = criarSessao(alvo.prog, alvo.ficha, { data: d.data, inicio: d.inicio, modo: d.modo });
        A.save(); A.closeModal();
        if (d.modo === 'feito') { A.toast(`Ficha ${alvo.ficha.letra} marcada como feita em ${fmtData(d.data)}`); A.render(); }
        else A.go('sessao/' + s.id);
      };
      const ja = A.mine('sessoes').find((x) => x.fichaId === alvo.ficha.id && x.data === d.data);
      if (ja) A.confirmar(`Já existe um registro da Ficha ${alvo.ficha.letra} em ${fmtData(d.data)}. Registrar outro mesmo assim?`, criar, { ok: 'Registrar outro' });
      else criar();
    });
  };

  /* ---------- Assistente: comecei o programa numa data passada ---------- */
  function comeceiAntes(pr) {
    const hj = hoje(), ontem = E.addDias(hj, -1), minimo = E.addDias(hj, -60);
    const st = { inicio: E.addDias(hj, -7), fichaIni: pr.fichas[0].id, off: new Set(), ativar: !pr.ativo };
    const plano = () => {
      const n = pr.fichas.length; let idx = Math.max(0, pr.fichas.findIndex((f) => f.id === st.fichaIni));
      const doProg = A.mine('sessoes').filter((x) => x.programaId === pr.id);
      const dias = [];
      for (let d = st.inicio; d <= ontem; d = E.addDias(d, 1)) {
        const ja = doProg.filter((x) => x.data === d).sort((a, b) => ((a.inicio || '') < (b.inicio || '') ? -1 : 1));
        if (ja.length) { const i = pr.fichas.findIndex((f) => f.id === ja[ja.length - 1].fichaId); if (i >= 0) idx = i + 1; dias.push({ d, ja }); continue; }
        if (st.off.has(d)) { dias.push({ d }); continue; }
        dias.push({ d, ficha: pr.fichas[idx % n] }); idx++;
      }
      return { dias, prox: pr.fichas[idx % n], novos: dias.filter((x) => x.ficha).length };
    };
    const corpo = () => {
      const p = plano();
      return `<div class="list mt-s">${p.dias.map((x) => { const dt = new Date(x.d + 'T12:00:00'); const rot = `${A.DIAS[dt.getDay()]} ${fmtData(x.d)}`;
        if (x.ja) return `<div class="item static"><div class="ico">✔️</div><div><div class="t">${rot}</div><div class="s">já registrado: ${x.ja.map((s) => 'Ficha ' + h(s.fichaLetra)).join(', ')}</div></div></div>`;
        return `<label class="item static" style="cursor:pointer"><div class="ico"><input type="checkbox" class="chk" data-act="ccDia" data-on="change" data-d="${x.d}" ${x.ficha ? 'checked' : ''}></div><div><div class="t">${rot}</div><div class="s">${x.ficha ? `<b>Ficha ${h(x.ficha.letra)}</b>${x.ficha.nome ? ' — ' + h(x.ficha.nome) : ''}` : 'descanso'}</div></div></label>`; }).join('') || '<div class="empty">Escolha uma data anterior a hoje.</div>'}</div>
        <p class="mt"><b>${p.novos}</b> treino(s) serão marcados como feitos. Próxima ficha: <b>${p.prox ? 'Ficha ' + h(p.prox.letra) : '—'}</b>${p.prox && p.prox.nome ? ' — ' + h(p.prox.nome) : ''}.</p>`;
    };
    const pinta = () => { const el = A.$('#ccCorpo'); if (el) el.innerHTML = corpo(); };
    A.modal({ title: 'Comecei este programa antes', body: `<div id="ccf"><p class="text-2">Marque os dias em que você treinou. O app distribui as fichas em sequência e registra cada treino como feito, sem cargas. Para completar algum depois, abra-o no histórico e toque em Editar.</p>
      <div class="form-grid">${field('Comecei em', inp('inicio', st.inicio, `type="date" min="${minimo}" max="${ontem}" data-act="ccForm" data-on="change"`))}${field('Pela ficha', sel('fichaIni', pr.fichas.map((f) => [f.id, `Ficha ${f.letra}${f.nome ? ' — ' + f.nome : ''}`]), st.fichaIni, 'data-act="ccForm" data-on="change"'))}</div>
      ${!pr.ativo ? `<label class="check"><input type="checkbox" name="ativar" checked> Tornar este programa o ativo</label>` : ''}
      <div id="ccCorpo">${corpo()}</div></div>`,
      foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="ccSalvar">Registrar</button>` });
    A.on('ccForm', () => { const d = A.formData(A.$('#ccf')); if (d.inicio && d.inicio <= ontem) st.inicio = d.inicio < minimo ? minimo : d.inicio; st.fichaIni = d.fichaIni; pinta(); });
    A.on('ccDia', (el) => { if (el.checked) st.off.delete(el.dataset.d); else st.off.add(el.dataset.d); pinta(); });
    A.on('ccSalvar', () => {
      const p = plano(); const d = A.formData(A.$('#ccf'));
      if (!p.novos) { A.toast('Marque ao menos um dia.'); return; }
      p.dias.filter((x) => x.ficha).forEach((x) => criarSessao(pr, x.ficha, { data: x.d, modo: 'feito' }));
      if (d.ativar) S().programas.forEach((x) => { if (x.perfilId === pr.perfilId) x.ativo = x.id === pr.id; });
      A.save(); A.closeModal(); A.render();
      A.toast(`${p.novos} treino(s) registrados · próxima: Ficha ${A.proximaFicha(pr).letra}`, 3500);
    });
  }

  A.route('sessao/nova', (p, q) => {
    const progs = A.mine('programas');
    const alvo = q.ficha ? acharFicha(q.ficha) : null;
    if (!alvo) {
      A.setTitle('Escolher ficha');
      A.on('treinoPassado', () => A.treinoPassado());
      return `<h2>Qual ficha você vai treinar?</h2>${progs.length ? progs.map((pr) => `<div class="card mt"><h3>${h(pr.nome)}</h3><div class="list">${pr.fichas.map((f) => `<a class="item" href="#/sessao/nova?ficha=${f.id}"><div class="ico letra">${h(f.letra)}</div><div><div class="t">${h(f.nome || 'Ficha ' + f.letra)}</div><div class="s">${f.exercicios.length} exercícios</div></div><div class="right">▶</div></a>`).join('')}</div></div>`).join('') : empty('📋', 'Crie um programa primeiro.', '<a class="btn primary" href="#/gerar-programa">Gerar programa</a>')}
        ${progs.length ? '<div class="card mt"><h3>Treino que já fiz</h3><p class="text-2">Registre um treino de outro dia que ficou sem registro.</p><button class="btn" data-act="treinoPassado">🕓 Registrar treino passado</button></div>' : ''}
        <div class="card mt"><h3>Treino livre</h3><p class="text-2">Sessão sem ficha: adicione os exercícios na hora.</p><button class="btn" data-act="sessaoLivre">Começar treino livre</button></div>`;
    }
    const em = A.mine('sessoes').find((s) => s.fichaId === alvo.ficha.id && s.data === hoje() && !s.fim);
    if (em) { A.go('sessao/' + em.id); return ''; }
    const s = criarSessao(alvo.prog, alvo.ficha);
    A.save(); A.go('sessao/' + s.id); return '';
  });
  A.on('sessaoLivre', () => { const s = { id: uid(), perfilId: A.perfil().id, data: hoje(), inicio: agora(), fim: null, programaId: null, fichaId: null, fichaNome: 'Treino livre', fichaLetra: '·', exercicios: [], obs: '' }; S().sessoes.push(s); A.save(); A.go('sessao/' + s.id); });

  /* Linha dos blocos de uma série (abaixo de carga × reps × RIR) */
  function linhaBlocos(e, st, i, editavel) {
    const partes = st.partes || [];
    if (!editavel) {
      const feitos = partes.filter((p) => p.reps !== '' && p.reps != null);
      return feitos.length ? `<tr class="sub"><td></td><td colspan="4" class="tiny text-2">${feitos.map((p) => `${h(p.rotulo)}: ${p.temCarga && p.carga !== '' ? h(p.carga) + ' kg × ' : ''}${h(p.reps)}`).join(' · ')}</td></tr>` : '';
    }
    if (!partes.length && !temBlocos(e)) return '';
    const attrs = (k, p) => `data-act="parteChange" data-on="change" data-e="${e.id}" data-i="${i}" data-p="${p}" data-k="${k}"`;
    const nome = E.novaParte(e.metodoId, partes.length).rotulo.replace(/\s*\d+$/, '').toLowerCase();
    return `<tr class="sub"><td></td><td colspan="4"><div class="blocos">${st.rotulo ? `<span class="bl-ini">↑ ${h(st.rotulo)}</span>` : ''}${partes.map((p, k) => `<div class="bloco"><span class="bl-rot">${h(p.rotulo)}</span>${p.temCarga ? `<input type="number" step="0.5" inputmode="decimal" value="${h(p.carga)}" placeholder="${sugestaoDrop(st, k)}" ${attrs('carga', k)} aria-label="${h(p.rotulo)} carga"><span class="bl-x">kg ×</span>` : ''}<input type="number" step="1" inputmode="numeric" value="${h(p.reps)}" placeholder="${h(p.alvo || 'reps')}" ${attrs('reps', k)} aria-label="${h(p.rotulo)} reps"><span class="bl-x">reps</span></div>`).join('')}<button class="btn xs ghost" data-act="parteAdd" data-e="${e.id}" data-i="${i}">＋ ${h(nome)}</button>${partes.length ? `<button class="btn xs ghost" data-act="parteRm" data-e="${e.id}" data-i="${i}" aria-label="Remover bloco">−</button>` : ''}</div></td></tr>`;
  }

  A.route('sessao/:id', (p) => {
    const s = S().sessoes.find((x) => x.id === p.id); if (!s) return empty('🤷', 'Sessão não encontrada');
    A.setTitle(s.fichaNome || 'Sessão');
    const exMap = A.exMap(); const sessoes = anterioresA(s.data, s.id);
    const editavel = !s.fim || s._edit;
    const totalSeries = s.exercicios.reduce((t, e) => t + e.series.filter((x) => x.ok).length, 0);
    const tonelagem = s.exercicios.reduce((t, e) => t + e.series.reduce((tt, x) => tt + E.tonelagemSerie(x), 0), 0);
    A.on('setChange', (el) => { const e = s.exercicios.find((x) => x.id === el.dataset.e); const st = e.series[+el.dataset.i]; st[el.dataset.k] = el.value === '' ? '' : Number(el.value); A.save(); if (el.dataset.k === 'carga' && st.partes) sugerirDrops(e.id, el.dataset.i, st); });
    A.on('setOk', (el) => {
      const e = s.exercicios.find((x) => x.id === el.dataset.e); const i = +el.dataset.i; const st = e.series[i];
      st.ok = !st.ok;
      if (st.ok) {
        if (st.reps === '' && st.alvo) st.reps = Number(st.alvo); if (st.rir === '' && e.presc && e.presc.rir != null) st.rir = e.presc.rir; if (st.carga === '' && i > 0) st.carga = e.series[i - 1].carga;
        (st.partes || []).forEach((p, k) => { if (p.reps === '' && p.alvo) p.reps = Number(p.alvo); if (p.temCarga && p.carga === '' && p.reps !== '') p.carga = sugestaoDrop(st, k); });
        if (!s.retro) {
          // em bi-set, tri-set etc. o descanso só começa quando a série i de todos do grupo estiver feita
          const g = grupoDe(s.exercicios, s.exercicios.indexOf(e)); const membros = g.map((j) => s.exercicios[j]).filter((x) => x.series.length > i);
          const falta = membros.find((x) => !x.series[i].ok);
          if (falta) A.toast(`${A.metodo(e.metodoId).nome}: agora ${(exMap.get(falta.exercicioId) || { nome: '' }).nome}`, 2500);
          else startTimer(Math.max(...membros.map((x) => (x.presc && x.presc.descanso) || S().config.descansoPadrao)), { prox: proximoPasso(s.exercicios, g, i, exMap) });
        }
      }
      A.save(); A.render();
    });
    A.on('setAdd', (el) => { const e = s.exercicios.find((x) => x.id === el.dataset.e); const last = e.series[e.series.length - 1] || {}; const n = e.series.length; const st = novaSerie(e, n, n + 1, null, last.alvo || ''); st.carga = last.carga || ''; e.series.push(st); A.save(); A.render(); });
    // blocos dentro da série (drop, pausa, mini-série…)
    const parteDe = (el) => { const e = s.exercicios.find((x) => x.id === el.dataset.e); const st = e.series[+el.dataset.i]; return { e, st }; };
    // atualiza a carga sugerida dos drops sem redesenhar (não perde o foco do teclado)
    const sugerirDrops = (eId, i, st) => A.$$(`[data-act=parteChange][data-e="${eId}"][data-i="${i}"][data-k=carga]`).forEach((inp) => { inp.placeholder = sugestaoDrop(st, +inp.dataset.p); });
    A.on('parteChange', (el) => { const { st } = parteDe(el); const p = st.partes[+el.dataset.p]; p[el.dataset.k] = el.value === '' ? '' : Number(el.value); A.save(); if (el.dataset.k === 'carga') sugerirDrops(el.dataset.e, el.dataset.i, st); });
    A.on('parteAdd', (el) => { const { e, st } = parteDe(el); st.partes = st.partes || []; st.partes.push({ ...E.novaParte(e.metodoId, st.partes.length), alvo: '', carga: '', reps: '' }); A.save(); A.render(); });
    A.on('parteRm', (el) => { const { st } = parteDe(el); if (st.partes && st.partes.length) st.partes.pop(); A.save(); A.render(); });
    A.on('setRm', (el) => { const e = s.exercicios.find((x) => x.id === el.dataset.e); if (e.series.length > 1) e.series.pop(); A.save(); A.render(); });
    A.on('exSessaoAdd', () => escolherExercicio((ex) => { s.exercicios.push({ id: uid(), exercicioId: ex.id, series: [{ carga: '', reps: '', rir: '', ok: false, alvo: '' }, { carga: '', reps: '', rir: '', ok: false, alvo: '' }, { carga: '', reps: '', rir: '', ok: false, alvo: '' }], presc: { series: 3, reps: '', rir: 2, descanso: S().config.descansoPadrao }, metodoId: 'normal', obs: '' }); A.save(); A.render(); }));
    A.on('exSessaoRm', (el) => A.confirmar('Remover este exercício da sessão?', () => { s.exercicios = s.exercicios.filter((x) => x.id !== el.dataset.id); A.save(); A.render(); }));
    A.on('exSessaoTrocar', (el) => { const e = s.exercicios.find((x) => x.id === el.dataset.id); escolherExercicio((ex) => { e.exercicioId = ex.id; A.save(); A.render(); }, (exMap.get(e.exercicioId) || {}).grupo); });
    A.on('timerStart', (el) => startTimer(Number(el.dataset.s) || 90));
    A.on('sessaoFinalizar', () => {
      A.modal({ title: 'Finalizar treino', body: `<div id="pf"><div class="stats mb"><div class="stat"><div class="lbl">Séries feitas</div><div class="v">${totalSeries}</div></div><div class="stat"><div class="lbl">Tonelagem</div><div class="v">${n0(tonelagem)}<small> kg</small></div></div>${s.retro ? '' : `<div class="stat"><div class="lbl">Duração</div><div class="v">${s.fim ? s.duracaoMin || 0 : duracao(s)}<small> min</small></div></div>`}</div>${s.retro ? field('Duração (min, opcional)', num('duracao', s.duracaoMin || '', 'step="1" min="0" inputmode="numeric"')) : ''}${field('Como foi?', `<textarea name="obs" placeholder="Sensações, dores, ajustes para a próxima…">${h(s.obs || '')}</textarea>`)}${field('Sono / energia (1–5)', num('energia', s.energia || '', 'step="1" min="1" max="5"'))}</div>`,
        foot: `<button class="btn" data-act="__modalClose">Voltar</button><button class="btn primary" data-act="sessaoConcluir">✅ Concluir</button>` });
      A.on('sessaoConcluir', () => {
        const d = A.formData(A.$('#pf')); s.obs = d.obs; s.energia = d.energia; s._edit = false;
        if (s.retro) { s.duracaoMin = d.duracao || null; s.fim = s.inicio ? (s.duracaoMin ? somaMin(s.inicio, s.duracaoMin) : s.inicio) : '✓'; }
        else if (!s.fim) { s.fim = agora(); s.duracaoMin = duracao(s); }
        s.exercicios.forEach((e) => { e.series = e.series.filter((x) => x.ok || x.reps); e.series.forEach((x) => { if (x.partes) x.partes = x.partes.filter((p) => p.reps !== '' && p.reps != null); }); });
        if (s.exercicios.some((e) => e.series.length)) delete s.semDetalhes;
        A.save(); stopTimer(); A.closeModal(); A.toast('Treino concluído! 💪'); A.go('treino/historico'); });
    });
    A.on('sessaoEditar', () => { s.exercicios.forEach((e) => { if (!e.series.length && e.presc) preencherSeries(e, sessoes); }); s._edit = true; A.render(); });
    A.on('sessaoData', () => {
      const hj = hoje();
      A.modal({ title: 'Data do treino', body: `<div id="sdf"><div class="form-grid">${field('Data', inp('data', s.data, `type="date" max="${hj}"`))}${field('Horário de início', inp('inicio', s.inicio, 'type="time"'))}</div><p class="help">A semana do ciclo é recalculada pela nova data; a prescrição dos exercícios não muda.</p></div>`,
        foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="sdSalvar">Salvar</button>` });
      A.on('sdSalvar', () => {
        const d = A.formData(A.$('#sdf')); if (!d.data || d.data > hj) { A.toast('Escolha uma data até hoje.'); return; }
        if (d.data !== s.data || d.inicio !== s.inicio) {
          if (d.data !== hj || s.retro) s.retro = true;
          s.data = d.data; s.inicio = d.inicio || '';
          if (s.retro && s.fim) s.fim = s.inicio ? (s.duracaoMin ? somaMin(s.inicio, s.duracaoMin) : s.inicio) : '✓';
          const sem = A.semanaAtualInfo(s.data); const micro = sem && sem.micro ? sem.micro : null;
          s.microSemana = micro ? micro.semana : null; s.microNome = micro ? micro.nome : null;
          A.save();
        }
        A.closeModal(); A.render();
      });
    });
    A.on('sessaoExcluir', () => A.confirmar('Excluir esta sessão?', () => { S().sessoes = S().sessoes.filter((x) => x.id !== s.id); A.save(); stopTimer(); A.go('treino/historico'); }, { danger: true, ok: 'Excluir' }));
    A.on('sessaoDescartar', () => A.confirmar('Descartar este treino sem salvar?', () => { S().sessoes = S().sessoes.filter((x) => x.id !== s.id); A.save(); stopTimer(); A.go('inicio'); }, { danger: true, ok: 'Descartar' }));
    const prs = [];
    const html = s.exercicios.map((e, idx) => {
      const ex = exMap.get(e.exercicioId) || { nome: e.exercicioId, grupo: '' };
      const hist = E.historicoExercicio(sessoes, e.exercicioId);
      const ult = hist[hist.length - 1];
      const sug = editavel ? E.sugerirProgressao(hist, { reps: e.presc.reps, series: e.presc.series }, e.presc.rir) : null;
      const best = E.melhor1RM(sessoes, e.exercicioId);
      const rmAgora = Math.max(0, ...e.series.map((x) => x.carga && x.reps && x.reps <= 15 ? E.epley(+x.carga, +x.reps) : 0));
      const pr = best && rmAgora > best.rm; if (pr) prs.push(ex.nome);
      const m = A.metodo(e.metodoId);
      const g = grupoDe(s.exercicios, idx); const outros = g.filter((j) => j !== idx).map((j) => (exMap.get(s.exercicios[j].exercicioId) || { nome: '' }).nome);
      const conj = outros.length ? `<div class="tiny conj-info">🔗 ${h(m.nome)} com ${h(outros.join(' + '))}${editavel && !s.retro ? ' · descanso depois do grupo' : ''}</div>` : '';
      return `<div class="card mb ${outros.length ? 'conj' + (g[0] === idx ? ' conj-ini' : '') + (g[g.length - 1] === idx ? ' conj-fim' : '') : ''}"><div class="row between nowrap"><div class="grow"><h3><a href="#/exercicio/${e.exercicioId}">${idx + 1}. ${h(ex.nome)}</a> ${pr ? badge('PR! 🏆', 'ok') : ''}</h3><div class="tiny text-2">${h(A.grupoNome(ex.grupo))} · alvo <b>${e.presc.series} × ${h(E.parseReps(e.presc.reps, e.presc.series).texto || '—')}</b> · RIR ${e.presc.rir ?? '—'} · descanso ${e.presc.descanso}s${e.metodoId && e.metodoId !== 'normal' ? ' · ' + badge(m.nome, 'treino') : ''}${e.presc.cargaDelta ? ` · carga ${e.presc.cargaDelta > 0 ? '+' : ''}${e.presc.cargaDelta}% vs. sem. 1` : ''}</div>${conj}${e.obs ? `<div class="tiny muted"><i>${h(e.obs)}</i></div>` : ''}${ex.dica ? `<div class="tiny muted">💡 ${h(ex.dica)}</div>` : ''}</div>${editavel ? `<div class="row nowrap"><button class="btn xs ghost" data-act="exSessaoTrocar" data-id="${e.id}" title="Trocar">⇄</button><button class="btn xs ghost" data-act="exSessaoRm" data-id="${e.id}" title="Remover">✕</button></div>` : ''}</div>
        ${ult ? `<div class="tiny muted mt-s">Última vez (${fmtData(ult.data)}): ${ult.series.map((x) => E.textoSerie(x)).join(' · ')}</div>` : ''}
        ${sug ? `<div class="tiny mt-s" style="color:var(--${sug.tipo === 'subir' ? 'ok' : sug.tipo === 'reduzir' ? 'warn' : 'info'})">➜ ${h(sug.texto)}</div>` : ''}
        ${!e.series.length && !editavel ? '<div class="tiny muted mt-s">Sem séries registradas.</div>' : `<table class="set-table mt-s"><thead><tr><th>#</th><th>Carga (kg)</th><th>Reps</th><th>RIR</th><th></th></tr></thead><tbody>
        ${e.series.map((st, i) => `<tr><td class="n">${i + 1}${st.alvo ? `<div class="tiny muted">${st.alvo}</div>` : ''}</td><td><input type="number" step="0.5" inputmode="decimal" value="${h(st.carga)}" data-act="setChange" data-on="change" data-e="${e.id}" data-i="${i}" data-k="carga" ${editavel ? '' : 'disabled'}></td><td><input type="number" step="1" inputmode="numeric" value="${h(st.reps)}" placeholder="${st.alvo || ''}" data-act="setChange" data-on="change" data-e="${e.id}" data-i="${i}" data-k="reps" ${editavel ? '' : 'disabled'}></td><td><input type="number" step="0.5" inputmode="decimal" value="${h(st.rir)}" placeholder="${e.presc.rir ?? ''}" data-act="setChange" data-on="change" data-e="${e.id}" data-i="${i}" data-k="rir" ${editavel ? '' : 'disabled'}></td><td>${editavel ? `<button class="ok-btn ${st.ok ? 'on' : ''}" data-act="setOk" data-e="${e.id}" data-i="${i}">✓</button>` : (st.ok ? '✓' : '')}</td></tr>${linhaBlocos(e, st, i, editavel)}`).join('')}
        </tbody></table>`}
        ${editavel ? `<div class="row mt-s"><button class="btn xs" data-act="setAdd" data-e="${e.id}">＋ série</button><button class="btn xs ghost" data-act="setRm" data-e="${e.id}">− série</button><button class="btn xs ghost" data-act="timerStart" data-s="${e.presc.descanso}">⏱ ${e.presc.descanso}s</button></div>` : ''}
      </div>`;
    }).join('');
    return `<div class="card treino mb"><div class="row between"><div><h2>${h(s.fichaNome)}</h2><div class="muted">${A.fmtDataLonga(s.data)}${horarioSessao(s) ? ' · ' + horarioSessao(s) : ''}${s.microNome ? ' · sem. ' + s.microSemana + ' (' + h(s.microNome) + ')' : ''}</div><div class="chips mt-s">${badge(totalSeries + ' séries', 'treino')}${badge(n0(tonelagem) + ' kg levantados')}</div></div></div>
      ${s.obs ? `<p class="text-2 mt-s">${h(s.obs)}</p>` : ''}
      ${s.semDetalhes && !editavel ? '<p class="help mt-s">Treino marcado como feito, sem cargas. Toque em Editar para preencher as séries.</p>' : ''}
      <div class="inline-actions">${editavel ? `<button class="btn primary sm" data-act="sessaoFinalizar">✅ Finalizar</button><button class="btn sm" data-act="exSessaoAdd">＋ Exercício</button>${!s.fim ? '<button class="btn sm ghost danger" data-act="sessaoDescartar">Descartar</button>' : ''}<button class="btn sm ghost" data-act="sessaoData">📆 Data</button>` : `<button class="btn sm" data-act="sessaoEditar">✏️ Editar</button><button class="btn sm" data-act="sessaoData">📆 Data</button><button class="btn sm danger" data-act="sessaoExcluir">Excluir</button>`}</div></div>
      ${html || empty('🏋️', 'Adicione exercícios.')}`;
  });
  const duracao = (s) => { if (!s.inicio) return 0; const [h1, m1] = s.inicio.split(':').map(Number); const [h2, m2] = (s.fim || agora()).split(':').map(Number); return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1)); };

  /* ================= Histórico ================= */
  function viewHistorico() {
    const ss = A.mine('sessoes').sort((a, b) => (a.data + (a.inicio || '')) < (b.data + (b.inicio || '')) ? 1 : -1);
    const semanas = {};
    ss.forEach((s) => { const w = A.inicioSemana(s.data); semanas[w] = semanas[w] || { n: 0, ton: 0 }; semanas[w].n++; semanas[w].ton += s.exercicios.reduce((t, e) => t + e.series.reduce((tt, x) => tt + E.tonelagemSerie(x), 0), 0); });
    const ws = Object.keys(semanas).sort().slice(-10);
    return `<div class="row between"><h2>Histórico de treinos</h2><span class="muted">${ss.length} sessões</span></div>
      ${ws.length ? `<div class="card mb"><h4>Treinos por semana (últimas ${ws.length})</h4>${A.barChart({ valores: ws.map((w) => ({ label: fmtData(w), v: semanas[w].n })), height: 140, cls: 'b' })}<h4 class="mt">Tonelagem semanal (kg)</h4>${A.barChart({ valores: ws.map((w) => ({ label: fmtData(w), v: Math.round(semanas[w].ton) })), height: 140 })}</div>` : ''}
      <div class="list">${ss.length ? ss.map((s) => { const series = s.exercicios.reduce((t, e) => t + e.series.filter((x) => x.ok || x.reps).length, 0); const ton = s.exercicios.reduce((t, e) => t + e.series.reduce((tt, x) => tt + E.tonelagemSerie(x), 0), 0); return `<a class="item" href="#/sessao/${s.id}"><div class="ico letra">${h(s.fichaLetra || '·')}</div><div><div class="t">${h(s.fichaNome)} ${!s.fim ? badge('em andamento', 'warn') : ''}</div><div class="s">${A.fmtDataLonga(s.data)} · ${s.exercicios.length} exercícios · ${s.semDetalhes ? 'marcado como feito' : series + ' séries'}${s.duracaoMin ? ' · ' + s.duracaoMin + ' min' : ''}</div></div><div class="right"><div class="big">${n0(ton)}</div><div class="tiny muted">kg</div></div></a>`; }).join('') : empty('🕓', 'Nenhum treino registrado ainda.')}</div>`;
  }

  /* ================= Exercício (detalhe) ================= */
  A.route('exercicio/:id', (p) => {
    const ex = A.exMap().get(p.id); if (!ex) return empty('🤷', 'Exercício não encontrado');
    A.setTitle(ex.nome);
    const sessoes = A.mine('sessoes').filter((s) => s.fim);
    const hist = E.historicoExercicio(sessoes, ex.id);
    const best = E.melhor1RM(sessoes, ex.id);
    const pts = hist.map((x) => ({ x: A.dataX(x.data), y: x.topCarga, label: `${fmtData(x.data)}: ${x.topCarga} kg` }));
    const ptsRm = hist.map((x) => ({ x: A.dataX(x.data), y: x.rm, label: `${fmtData(x.data)}: 1RM ${x.rm} kg` }));
    const usos = A.mine('programas').flatMap((pr) => pr.fichas.filter((f) => f.exercicios.some((e) => e.exercicioId === ex.id)).map((f) => ({ pr, f })));
    A.on('exCustomEdit', () => novoExercicioCustom(null, ex));
    A.on('exCustomRm', () => A.confirmar('Excluir este exercício personalizado?', () => { S().exerciciosCustom = S().exerciciosCustom.filter((x) => x.id !== ex.id); A.save(); A.go('biblioteca/exercicios'); }, { danger: true, ok: 'Excluir' }));
    return `<div class="card treino"><h2>${h(ex.nome)}</h2><div class="chips mb">${badge(A.grupoNome(ex.grupo), 'treino')}${(ex.secundarios || []).map((g) => badge(A.grupoNome(g))).join('')}${badge(A.aparelhoNome(ex.aparelho))}${badge(ex.tipo === 'composto' ? 'Composto' : 'Isolado')}${ex.unilateral ? badge('Unilateral') : ''}${badge((DB.padroes[ex.padrao] || ex.padrao))}${badge('Nível ' + ex.nivel)}</div>
      ${ex.dica ? `<p class="text-2">💡 ${h(ex.dica)}</p>` : ''}
      ${ex.custom ? `<div class="inline-actions"><button class="btn sm" data-act="exCustomEdit">✏️ Editar</button><button class="btn sm danger" data-act="exCustomRm">Excluir</button></div>` : ''}</div>
      ${best ? `<div class="card mt"><div class="row between"><h3>1RM estimado</h3><span class="muted tiny">Epley · ${fmtData(best.data)}</span></div><div class="stats"><div class="stat"><div class="lbl">1RM</div><div class="v">${n1(best.rm)}<small> kg</small></div><div class="tiny muted">${best.carga} kg × ${best.reps}</div></div>${[90, 80, 70, 60].map((pct) => `<div class="stat"><div class="lbl">${pct}%</div><div class="v">${n1(E.pctRM(best.rm, pct))}<small> kg</small></div><div class="tiny muted">~${pct >= 90 ? '3–4' : pct >= 80 ? '6–8' : pct >= 70 ? '10–12' : '15–20'} reps</div></div>`).join('')}</div></div>` : ''}
      ${hist.length ? `<div class="card mt"><h3>Evolução</h3>${A.lineChart({ series: [{ pontos: pts, cls: 'b' }, { pontos: ptsRm, cls: 'mm', dots: false }], unidade: 'kg', labels: A.labelsData(pts) })}<div class="legend"><span style="--c:var(--treino)">Carga máxima da sessão</span><span style="--c:var(--muted)">1RM estimado</span></div>
        <div class="tbl-wrap mt"><table class="tbl"><thead><tr><th>Data</th><th>Séries</th><th class="n">Ton.</th><th class="n">1RM</th></tr></thead><tbody>${hist.slice().reverse().slice(0, 15).map((x) => `<tr><td>${fmtData(x.data, true)}</td><td>${x.series.map((s) => E.textoSerie(s)).join(' · ')}</td><td class="n">${n0(x.tonelagem)}</td><td class="n">${n1(x.rm)}</td></tr>`).join('')}</tbody></table></div></div>` : `<div class="card mt"><p class="muted">Sem histórico registrado para este exercício.</p></div>`}
      ${usos.length ? `<div class="card mt"><h3>Nas suas fichas</h3><div class="list">${usos.map((u) => `<a class="item" href="#/programa/${u.pr.id}/ficha/${u.f.id}"><div class="ico letra">${h(u.f.letra)}</div><div><div class="t">${h(u.pr.nome)}</div><div class="s">${h(u.f.nome)}</div></div><div class="right muted">›</div></a>`).join('')}</div></div>` : ''}`;
  });

  /* ================= Biblioteca de exercícios ================= */
  A.route('biblioteca/exercicios', () => {
    A.setTitle('Exercícios');
    let grupo = '', busca = '';
    const lista = () => {
      const q = busca.toLowerCase();
      const items = [...A.exMap().values()].filter((e) => (!grupo || e.grupo === grupo) && (!q || e.nome.toLowerCase().includes(q)));
      const porGrupo = {}; items.forEach((e) => { (porGrupo[e.grupo] = porGrupo[e.grupo] || []).push(e); });
      return Object.keys(porGrupo).map((g) => `<details class="lib" ${grupo || q ? 'open' : ''}><summary>${h(A.grupoNome(g))} <span class="badge">${porGrupo[g].length}</span></summary><div class="body"><div class="list">${porGrupo[g].map((e) => `<a class="item" href="#/exercicio/${e.id}"><div class="ico">${e.tipo === 'composto' ? '🔩' : '🎯'}</div><div><div class="t">${h(e.nome)}${e.custom ? ' ' + badge('meu') : ''}</div><div class="s">${h(A.aparelhoNome(e.aparelho))}${e.unilateral ? ' · unilateral' : ''} · nível ${e.nivel}</div></div><div class="right muted">›</div></a>`).join('')}</div></div></details>`).join('') || empty('🔍', 'Nada encontrado.');
    };
    A.on('__after', () => {
      const draw = () => { A.$('#exLista').innerHTML = lista(); A.$('#exChips').innerHTML = A.chips([{ id: '', nome: 'Todos', on: !grupo }, ...DB.grupos.map((g) => ({ id: g.id, nome: g.nome, on: grupo === g.id }))], null, 'bGrupo'); };
      A.on('bGrupo', (el) => { grupo = el.dataset.id; draw(); });
      A.$('#exBusca').addEventListener('input', (ev) => { busca = ev.target.value; A.$('#exLista').innerHTML = lista(); });
      draw();
    });
    A.on('exCustomNovo', () => novoExercicioCustom(() => A.render()));
    return TABS('exercicios') + `<div class="row between"><h2>Biblioteca de exercícios</h2><button class="btn sm" data-act="exCustomNovo">＋ Personalizado</button></div><p class="help">${A.exMap().size} exercícios · ${DB.aparelhos.length} aparelhos · ${DB.metodos.length} metodologias (<a href="#/biblioteca/metodos">ver métodos</a>)</p>
      <input type="search" class="search" id="exBusca" placeholder="Buscar exercício…"><div id="exChips" class="mb"></div><div id="exLista"></div>`;
  });

  /* ================= Aeróbico ================= */
  function viewAerobico() {
    const list = A.mine('aerobicos').sort((a, b) => a.data < b.data ? 1 : -1);
    const ini = A.inicioSemana();
    const semana = list.filter((a) => a.data >= ini);
    const semanas = {}; list.forEach((a) => { const w = A.inicioSemana(a.data); semanas[w] = (semanas[w] || 0) + (Number(a.minutos) || 0); });
    const ws = Object.keys(semanas).sort().slice(-10);
    const p = A.perfil(); const zonas = A.idade(p) ? E.zonasFC(A.idade(p), p.fcRepouso) : null;
    A.on('aerEdit', (el) => aerobicoForm(list.find((x) => x.id === el.dataset.id)));
    return `<div class="row between"><h2>Aeróbico</h2><a class="btn primary sm" href="#/aerobico/novo">＋ Registrar</a></div>
      <div class="stats mb"><div class="stat"><div class="lbl">Esta semana</div><div class="v">${semana.reduce((t, a) => t + (Number(a.minutos) || 0), 0)}<small> min</small></div></div><div class="stat"><div class="lbl">Sessões</div><div class="v">${semana.length}</div></div><div class="stat"><div class="lbl">kcal (est.)</div><div class="v">${n0(semana.reduce((t, a) => t + (Number(a.kcal) || 0), 0))}</div></div></div>
      ${ws.length > 1 ? `<div class="card mb"><h4>Minutos por semana</h4>${A.barChart({ valores: ws.map((w) => ({ label: fmtData(w), v: semanas[w] })), height: 140, cls: 'c' })}</div>` : ''}
      ${zonas ? `<details class="lib"><summary>Zonas de frequência cardíaca (FC máx ≈ ${zonas[0].fcMax} bpm)</summary><div class="body"><div class="tbl-wrap"><table class="tbl">${zonas.map((z) => `<tr><td>Z${z.z} ${h(z.nome)}</td><td class="n">${z.min}–${z.max} bpm</td></tr>`).join('')}</table></div><div class="help">Fórmula de Tanaka (208 − 0,7 × idade)${p.fcRepouso ? ' com reserva de FC (Karvonen)' : ''}. Cadastre a FC de repouso no perfil para usar Karvonen.</div></div></details>` : ''}
      <div class="list mt">${list.length ? list.slice(0, 60).map((a) => { const at = DB.aerobicos.find((x) => x.id === a.atividadeId) || { nome: a.atividadeId }; return `<div class="item" data-act="aerEdit" data-id="${a.id}"><div class="ico">🏃</div><div><div class="t">${h(at.nome)} <span class="badge">${h(a.intensidade)}</span></div><div class="s">${A.fmtDataLonga(a.data)} · ${a.minutos} min${a.distancia ? ' · ' + n1(a.distancia) + ' km' : ''}${a.fcMedia ? ' · FC ' + a.fcMedia : ''}${a.obs ? ' · ' + h(a.obs) : ''}</div></div><div class="right"><div class="big">${n0(a.kcal)}</div><div class="tiny muted">kcal</div></div></div>`; }).join('') : empty('🏃', 'Nenhum aeróbico registrado.')}</div>`;
  }
  A.route('aerobico/novo', () => { A.go('treino/aerobico'); setTimeout(() => aerobicoForm(null), 50); return ''; });
  function aerobicoForm(a) {
    const peso = (A.ultimoPeso() || {}).peso || 70;
    const ex = a || { data: hoje(), atividadeId: 'caminhada', intensidade: 'moderado', minutos: 30 };
    const calc = () => { const d = A.formData(A.$('#pf')); const k = E.kcalAerobico(d.atividadeId, d.intensidade, peso, Number(d.minutos) || 0); const el = A.$('#pf [name=kcal]'); if (el && !el.dataset.manual) el.value = k; };
    A.modal({ title: a ? 'Editar aeróbico' : 'Registrar aeróbico', body: `<div id="pf"><div class="form-grid">${field('Data', inp('data', ex.data, 'type="date"'))}${field('Atividade', sel('atividadeId', DB.aerobicos.map((x) => [x.id, x.nome]), ex.atividadeId))}${field('Intensidade', sel('intensidade', [['leve', 'Leve (Z1–Z2)'], ['moderado', 'Moderada (Z3)'], ['intenso', 'Intensa (Z4–Z5)']], ex.intensidade))}${field('Minutos', num('minutos', ex.minutos, 'step="1" inputmode="numeric"'))}${field('Distância (km)', num('distancia', ex.distancia, 'step="0.1" inputmode="decimal"'))}${field('FC média', num('fcMedia', ex.fcMedia, 'step="1"'))}${field('kcal (estimado por MET)', num('kcal', ex.kcal, 'step="1"'))}</div>${field('Observação', inp('obs', ex.obs))}</div>`,
      foot: `${a ? '<button class="btn danger" data-act="aerRm">Excluir</button><span class="grow"></span>' : ''}<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="aerSalvar">Salvar</button>` });
    ['atividadeId', 'intensidade', 'minutos'].forEach((k) => A.$(`#pf [name=${k}]`).addEventListener('input', calc));
    A.$('#pf [name=kcal]').addEventListener('input', (ev) => { ev.target.dataset.manual = '1'; });
    if (!a) calc();
    A.on('aerSalvar', () => { const d = A.formData(A.$('#pf')); if (!d.minutos) { A.toast('Informe os minutos.'); return; } if (a) Object.assign(a, d); else S().aerobicos.push({ id: uid(), perfilId: A.perfil().id, ...d }); A.save(); A.closeModal(); A.render(); A.toast('Aeróbico salvo'); });
    A.on('aerRm', () => { S().aerobicos = S().aerobicos.filter((x) => x.id !== a.id); A.save(); A.closeModal(); A.render(); });
  }
  A.aerobicoForm = aerobicoForm;
})();
