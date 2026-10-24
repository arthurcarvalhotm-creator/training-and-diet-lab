/* =====================================================================
 * FitLab — Corpo: avaliação física (consulta), medidas e evolução,
 * edição de perfis.
 * ===================================================================== */
(function () {
  'use strict';
  const A = window.App, DB = A.DB, E = A.E;
  const { h, n0, n1, field, inp, num, sel, badge, empty, fmtData, hoje, uid } = A;
  const S = () => A.S;
  const MED = [['cintura', 'Cintura'], ['quadril', 'Quadril'], ['pescoco', 'Pescoço'], ['braco', 'Braço'], ['coxa', 'Coxa'], ['peito', 'Peito'], ['panturrilha', 'Panturrilha']];

  /* ================= Evolução ================= */
  A.route('corpo', () => {
    A.setTitle('Corpo');
    const p = A.perfil();
    const avs = A.mine('avaliacoes').sort((a, b) => a.data < b.data ? 1 : -1);
    const meds = A.mine('medidas').sort((a, b) => a.data < b.data ? 1 : -1);
    const pesos = A.pesoSerie();
    const pts = pesos.map((x) => ({ x: A.dataX(x.data), y: x.peso, label: `${fmtData(x.data, true)}: ${x.peso} kg` }));
    const mm = E.mediaMovel(pesos.map((x) => ({ data: x.data, valor: x.peso })), 5).map((x) => ({ x: A.dataX(x.data), y: x.valor }));
    const tend = E.tendencia(pesos.map((x) => ({ data: x.data, valor: x.peso })));
    const todas = [...meds, ...avs].sort((a, b) => a.data < b.data ? -1 : 1);
    const serieMed = (k) => todas.filter((m) => m[k]).map((m) => ({ x: A.dataX(m.data), y: Number(m[k]), label: `${fmtData(m.data, true)}: ${m[k]} cm` }));
    const medSeries = MED.map(([k, nome], i) => ({ k, nome, pontos: serieMed(k), cls: ['', 'b', 'c', 'mm', '', 'b', 'c'][i] })).filter((s) => s.pontos.length > 1);
    const av = avs[0];
    A.on('medEdit', (el) => medidaForm(meds.find((m) => m.id === el.dataset.id)));
    A.on('pesoRapido', () => A.registrarPeso());
    return `<div class="card corpo"><div class="row between"><div><h2>${h(p.nome)}</h2><div class="muted">${p.sexo === 'F' ? 'Feminino' : 'Masculino'} · ${A.idade(p) || '?'} anos · ${h(p.altura)} cm · nível ${h(p.nivel || 1)}</div></div><a class="btn xs ghost" href="#/perfil">editar perfil</a></div>
      <div class="stats mt"><div class="stat"><div class="lbl">Peso atual</div><div class="v">${pesos.length ? n1(pesos[pesos.length - 1].peso) + '<small> kg</small>' : '—'}</div></div><div class="stat"><div class="lbl">Tendência</div><div class="v">${tend ? (tend.porSemana > 0 ? '+' : '') + n1(tend.porSemana) + '<small> kg/sem</small>' : '—'}</div></div><div class="stat"><div class="lbl">Variação total</div><div class="v">${tend ? (tend.total > 0 ? '+' : '') + n1(tend.total) + '<small> kg</small>' : '—'}</div></div><div class="stat"><div class="lbl">% Gordura</div><div class="v">${av && av.resultado.bf != null ? n1(av.resultado.bf) + '<small> %</small>' : '—'}</div></div></div>
      <div class="inline-actions"><a class="btn primary sm" href="#/avaliacao/nova">📏 Nova avaliação</a><button class="btn sm" data-act="pesoRapido">⚖️ Peso / medidas</button></div></div>
      ${pts.length > 1 ? `<div class="card mt"><h3>Peso</h3>${A.lineChart({ series: [{ pontos: pts, area: true }, { pontos: mm, cls: 'mm', dots: false }], unidade: 'kg', labels: A.labelsData(pts) })}<div class="legend"><span style="--c:var(--accent)">Peso</span><span style="--c:var(--muted)">Média móvel (5)</span></div>${tend && av ? `<div class="help">${av.objetivo === 'cutting' ? 'Cutting: alvo de −0,5 a −1 % do peso por semana.' : av.objetivo === 'bulking' ? 'Bulking: alvo de +0,25 a +0,5 % do peso por semana para limitar ganho de gordura.' : ''}</div>` : ''}</div>` : ''}
      ${medSeries.length ? `<div class="card mt"><h3>Medidas (cm)</h3>${A.lineChart({ series: medSeries.map((s) => ({ pontos: s.pontos, cls: s.cls })), unidade: 'cm', labels: A.labelsData(medSeries[0].pontos) })}<div class="legend">${medSeries.map((s) => `<span style="--c:var(--${s.cls === 'b' ? 'treino' : s.cls === 'c' ? 'dieta' : s.cls === 'mm' ? 'muted' : 'accent'})">${s.nome}</span>`).join('')}</div></div>` : ''}
      <div class="section-title"><h2>Avaliações</h2><a class="btn xs" href="#/avaliacao/nova">＋</a></div>
      <div class="list">${avs.length ? avs.map((a) => `<a class="item" href="#/avaliacao/${h(a.id)}"><div class="ico">📏</div><div><div class="t">${fmtData(a.data, true)} · ${(DB.objetivos.find((o) => o.id === a.objetivo) || {}).nome || ''}</div><div class="s">${h(a.peso)} kg · BF ${a.resultado && a.resultado.bf != null ? n1(a.resultado.bf) + '%' : '—'} · TMB ${n0(a.resultado.tmb)} · meta ${n0(a.resultado.alvo)} kcal</div></div><div class="right muted">›</div></a>`).join('') : '<div class="empty">Nenhuma avaliação.</div>'}</div>
      <div class="section-title"><h2>Registros de peso e medidas</h2></div>
      <div class="list">${meds.length ? meds.slice(0, 30).map((m) => `<div class="item" data-act="medEdit" data-id="${h(m.id)}"><div class="ico">⚖️</div><div><div class="t">${fmtData(m.data, true)}${m.peso ? ' · ' + n1(m.peso) + ' kg' : ''}</div><div class="s">${MED.filter(([k]) => m[k]).map(([k, n]) => `${n} ${h(m[k])}`).join(' · ') || ''}${m.obs ? ' · ' + h(m.obs) : ''}</div></div><div class="right muted">›</div></div>`).join('') : '<div class="empty">Registre o peso pelo botão "+ Registrar".</div>'}</div>`;
  });
  function medidaForm(m) {
    A.modal({ title: 'Editar registro', body: `<div id="pf"><div class="form-grid tight">${field('Data', inp('data', m.data, 'type="date"'))}${field('Peso (kg)', num('peso', m.peso, 'step="0.1"'))}${MED.map(([k, n]) => field(n + ' (cm)', num(k, m[k], 'step="0.5"'))).join('')}</div>${field('Observação', inp('obs', m.obs))}</div>`, foot: `<button class="btn danger" data-act="medRm">Excluir</button><span class="grow"></span><button class="btn primary" data-act="medSalvar">Salvar</button>` });
    A.on('medSalvar', () => { Object.assign(m, A.formData(A.$('#pf'))); A.save(); A.closeModal(); A.render(); });
    A.on('medRm', () => { S().medidas = S().medidas.filter((x) => x.id !== m.id); A.save(); A.closeModal(); A.render(); });
  }

  /* ================= Avaliação ================= */
  A.route('avaliacao/:id', (p) => {
    const perfil = A.perfil(); const nova = p.id === 'nova';
    const ant = A.ultimaAvaliacao();
    const a = nova ? { id: uid(), perfilId: perfil.id, data: hoje(), peso: (A.ultimoPeso() || {}).peso || (ant ? ant.peso : ''), cintura: ant ? ant.cintura : '', pescoco: ant ? ant.pescoco : '', quadril: ant ? ant.quadril : '', objetivo: ant ? ant.objetivo : 'bulking', nivelAtividade: ant ? ant.nivelAtividade : 'moderado', tmbFormula: ant ? ant.tmbFormula : 'mifflin', base: ant ? 'anterior' : 'get', dietaAnterior: ant ? ant.resultado.alvo : '', ajustePct: '', modoMacro: ant ? ant.modoMacro : 'pct', presetMacro: ant ? ant.presetMacro : (perfil.sexo === 'F' ? 'equilibrado' : 'planilha-bulking'), macros: ant ? { ...ant.macros } : { c: 60, g: 16, p: 24 }, pGkg: ant ? ant.pGkg || 2 : 2, gGkg: ant ? ant.gGkg || 0.8 : 0.8, tempoDias: 60, obs: '' } : S().avaliacoes.find((x) => x.id === p.id);
    if (!a) return empty('🤷', 'Avaliação não encontrada');
    A.setTitle(nova ? 'Nova avaliação' : 'Avaliação ' + fmtData(a.data, true));
    const ler = () => {
      const d = A.formData(A.$('#avForm'));
      Object.assign(a, d);
      a.macros = { c: Number(d.mc) || 0, g: Number(d.mg) || 0, p: Number(d.mp) || 0 };
      A.calcularAvaliacao(a, perfil);
      return a;
    };
    const resultado = () => {
      const r = a.resultado; if (!r) return '';
      const m = r.macros;
      const somaPct = a.modoMacro === 'pct' ? (a.macros.c + a.macros.g + a.macros.p) : 100;
      return `<h3>Resultados</h3>
        <div class="stats"><div class="stat"><div class="lbl">IMC</div><div class="v">${n1(r.imc)}</div><div class="tiny muted">${E.classImc(r.imc)}</div></div><div class="stat"><div class="lbl">% Gordura</div><div class="v">${r.bf != null ? n1(r.bf) : '—'}<small> %</small></div><div class="tiny muted">${r.bfNavy != null ? 'US Navy' : a.bfManual ? 'manual' : 'estimado (IMC)'} · ${E.classBf(r.bf, perfil.sexo)}</div></div><div class="stat"><div class="lbl">Massa magra</div><div class="v">${r.bf != null ? n1(a.peso * (1 - r.bf / 100)) : '—'}<small> kg</small></div></div><div class="stat"><div class="lbl">Água</div><div class="v">${n0(r.agua)}<small> ml</small></div></div></div>
        <div class="stats mt"><div class="stat"><div class="lbl">TMB (${a.tmbFormula === 'harris' ? 'Harris-Benedict' : a.tmbFormula === 'katch' ? 'Katch-McArdle' : 'Mifflin-St Jeor'})</div><div class="v">${n0(r.tmb)}</div><div class="tiny muted">Mifflin ${n0(r.tmbs.mifflin)} · Harris ${n0(r.tmbs.harris)}${r.tmbs.katch ? ' · Katch ' + n0(r.tmbs.katch) : ''}</div></div><div class="stat"><div class="lbl">Gasto total (GET)</div><div class="v">${n0(r.get)}</div><div class="tiny muted">× ${r.fator}</div></div><div class="stat kcal"><div class="lbl">Meta calórica</div><div class="v">${n0(r.alvo)}</div><div class="tiny muted">${r.delta >= 0 ? '+' : ''}${n0(r.delta)} kcal (${r.pct > 0 ? '+' : ''}${r.pct}%) sobre ${r.base === 'anterior' ? 'dieta anterior' : 'GET'}</div></div></div>
        <div class="tbl-wrap mt"><table class="tbl"><thead><tr><th>Macro</th><th class="n">%</th><th class="n">kcal</th><th class="n">g</th><th class="n">g/kg</th></tr></thead><tbody>
          <tr><td>Carboidrato</td><td class="n">${m.c.pct}</td><td class="n">${m.c.kcal}</td><td class="n"><b>${m.c.g}</b></td><td class="n">${m.c.gkg}</td></tr>
          <tr><td>Gordura</td><td class="n">${m.g.pct}</td><td class="n">${m.g.kcal}</td><td class="n"><b>${m.g.g}</b></td><td class="n">${m.g.gkg}</td></tr>
          <tr><td>Proteína</td><td class="n">${m.p.pct}</td><td class="n">${m.p.kcal}</td><td class="n"><b>${m.p.g}</b></td><td class="n">${m.p.gkg}</td></tr></tbody></table></div>
        ${somaPct !== 100 ? `<div class="help" style="color:var(--warn)">Os percentuais somam ${somaPct}% — foram normalizados para 100%.</div>` : ''}
        ${m.p.gkg < 1.6 ? '<div class="help" style="color:var(--warn)">Proteína abaixo de 1,6 g/kg: considere aumentar para preservar massa magra.</div>' : ''}${m.g.gkg < 0.5 ? '<div class="help" style="color:var(--warn)">Gordura abaixo de 0,5 g/kg pode prejudicar hormônios.</div>' : ''}`;
    };
    const draw = () => { A.$('#avRes').innerHTML = resultado(); };
    A.on('avPreset', (el) => { const pr = DB.presetsMacro.find((x) => x.id === el.value); if (pr) { A.$('#avForm [name=mc]').value = pr.c; A.$('#avForm [name=mg]').value = pr.g; A.$('#avForm [name=mp]').value = pr.p; } ler(); draw(); });
    A.on('avObjetivo', (el) => { const o = DB.objetivos.find((x) => x.id === el.value); if (o) { A.$('#avForm [name=ajustePct]').placeholder = (o.ajuste > 0 ? '+' : '') + o.ajuste + '%'; const pr = o.id === 'bulking' ? 'planilha-bulking' : o.id === 'cutting' ? 'planilha-cutting' : 'equilibrado'; A.$('#avForm [name=presetMacro]').value = pr; const P = DB.presetsMacro.find((x) => x.id === pr); A.$('#avForm [name=mc]').value = P.c; A.$('#avForm [name=mg]').value = P.g; A.$('#avForm [name=mp]').value = P.p; } ler(); draw(); });
    A.on('avSalvar', () => {
      ler(); if (!a.peso) { A.toast('Informe o peso.'); return; }
      if (nova) S().avaliacoes.push(a);
      A.save(); A.toast('Avaliação salva');
      if (nova) A.modal({ title: 'Avaliação salva ✅', body: `<p>Meta: <b>${n0(a.resultado.alvo)} kcal</b> · C ${a.resultado.macros.c.g} g · G ${a.resultado.macros.g.g} g · P ${a.resultado.macros.p.g} g.</p><p class="text-2">Quer gerar um plano alimentar com essas metas agora?</p>`, foot: `<a class="btn" href="#/corpo" data-act="__modalClose">Depois</a><a class="btn primary" href="#/gerar-dieta" data-act="__modalClose">✨ Gerar dieta</a>` });
      else A.go('corpo');
    });
    A.on('avExcluir', () => A.confirmar('Excluir esta avaliação?', () => { S().avaliacoes = S().avaliacoes.filter((x) => x.id !== a.id); A.save(); A.go('corpo'); }, { danger: true, ok: 'Excluir' }));
    A.on('avAplicar', () => { const d = A.dietaAtiva(); if (!d) { A.toast('Nenhum plano ativo.'); return; } d.meta = { kcal: a.resultado.alvo, c: a.resultado.macros.c.g, g: a.resultado.macros.g.g, p: a.resultado.macros.p.g }; A.save(); A.toast('Metas aplicadas ao plano ' + d.nome); });
    A.on('__after', () => { if (!a.resultado) A.calcularAvaliacao(a, perfil); draw(); A.$('#avForm').addEventListener('input', () => { ler(); draw(); }); A.$('#avForm').addEventListener('change', () => { ler(); draw(); }); });
    const obj = DB.objetivos.find((x) => x.id === a.objetivo) || DB.objetivos[0];
    return `<div class="card corpo"><h2>${nova ? '📏 Nova avaliação' : '📏 Avaliação de ' + fmtData(a.data, true)}</h2><p class="text-2 tiny">Mesmo fluxo da planilha (consulta): dados → % gordura e TMB → objetivo → calorias → macros. Tudo recalcula ao digitar.</p>
      <div id="avForm">
      <h4>Dados e medidas</h4><div class="form-grid tight">${field('Data', inp('data', a.data, 'type="date"'))}${field('Peso (kg)', num('peso', a.peso, 'step="0.1" inputmode="decimal"'))}${field('Cintura (cm)', num('cintura', a.cintura, 'step="0.5"'), 'na altura do umbigo')}${field('Pescoço (cm)', num('pescoco', a.pescoco, 'step="0.5"'), 'abaixo da laringe')}${perfil.sexo === 'F' ? field('Quadril (cm)', num('quadril', a.quadril, 'step="0.5"'), 'maior circunferência') : `<input type="hidden" name="quadril" value="${h(a.quadril || '')}">`}${field('% gordura manual', num('bfManual', a.bfManual, 'step="0.1"'), 'opcional (bioimpedância / adipômetro)')}${field('Braço (cm)', num('braco', a.braco, 'step="0.5"'))}${field('Coxa (cm)', num('coxa', a.coxa, 'step="0.5"'))}${field('Peito (cm)', num('peito', a.peito, 'step="0.5"'))}${field('Panturrilha (cm)', num('panturrilha', a.panturrilha, 'step="0.5"'))}</div>
      <h4>Metabolismo</h4><div class="form-grid">${field('Fórmula da TMB', sel('tmbFormula', [['mifflin', 'Mifflin-St Jeor (recomendada)'], ['harris', 'Harris-Benedict (planilha feminina)'], ['katch', 'Katch-McArdle (usa % gordura)']], a.tmbFormula))}${field('Nível de atividade', sel('nivelAtividade', DB.fatoresAtividade.map((f) => [f.id, f.nome]), a.nivelAtividade))}</div>
      <h4>Objetivo e calorias</h4><div class="form-grid">${field('Objetivo', sel('objetivo', DB.objetivos.map((o) => [o.id, o.nome]), a.objetivo, 'data-act="avObjetivo" data-on="change"'))}${field('Tempo do ciclo (dias)', num('tempoDias', a.tempoDias, 'step="1"'))}${field('Base do cálculo', sel('base', [['get', 'Gasto total (GET)'], ['anterior', 'Dieta anterior (como na planilha)']], a.base))}${field('Dieta anterior (kcal)', num('dietaAnterior', a.dietaAnterior, 'step="10"'), 'usada quando a base é "dieta anterior"')}${field('Ajuste (%)', num('ajustePct', a.ajustePct, `step="1" placeholder="${obj.ajuste > 0 ? '+' : ''}${obj.ajuste}%"`), 'vazio = padrão do objetivo (bulking +10, cutting −15)')}${field('Meta manual (kcal)', num('kcalManual', a.kcalManual, 'step="10"'), 'opcional: sobrescreve o cálculo')}</div>
      <h4>Distribuição de macros</h4><div class="form-grid">${field('Modo', sel('modoMacro', [['pct', 'Percentual (planilha)'], ['gkg', 'g/kg de peso (proteína e gordura fixas)']], a.modoMacro))}${field('Preset', sel('presetMacro', DB.presetsMacro.map((x) => [x.id, x.nome]), a.presetMacro, 'data-act="avPreset" data-on="change"'))}</div>
      <div class="form-grid tight">${field('Carbo %', num('mc', a.macros.c, 'step="1"'))}${field('Gordura %', num('mg', a.macros.g, 'step="1"'))}${field('Proteína %', num('mp', a.macros.p, 'step="1"'))}${field('Proteína g/kg', num('pGkg', a.pGkg, 'step="0.1"'))}${field('Gordura g/kg', num('gGkg', a.gGkg, 'step="0.1"'))}</div>
      ${field('Observações', `<textarea name="obs">${h(a.obs || '')}</textarea>`)}
      </div></div>
      <div class="card mt" id="avRes"></div>
      <div class="row mt"><button class="btn primary" data-act="avSalvar">💾 Salvar avaliação</button>${!nova ? '<button class="btn" data-act="avAplicar">Aplicar metas ao plano ativo</button><button class="btn danger ghost" data-act="avExcluir">Excluir</button>' : ''}</div>`;
  });

  /* ================= Perfis ================= */
  A.route('perfil', () => {
    A.setTitle('Perfis');
    A.on('pfEdit', (el) => {
      const p = S().perfis.find((x) => x.id === el.dataset.id);
      A.modal({ title: 'Editar perfil', body: `<div id="pf">${A.perfilForm(p)}</div>`, foot: `${S().perfis.length > 1 ? '<button class="btn danger" data-act="pfRm">Excluir perfil e dados</button><span class="grow"></span>' : ''}<button class="btn primary" data-act="pfSalvar">Salvar</button>` });
      A.on('pfSalvar', () => { if (A.salvarPerfilForm(A.$('#pf'), p)) { A.closeModal(); A.render(); } });
      A.on('pfRm', () => A.confirmar(`Excluir "${p.nome}" e TODOS os seus dados (avaliações, dietas, treinos)? Faça um backup antes.`, () => { ['avaliacoes', 'medidas', 'dietas', 'diario', 'programas', 'ciclos', 'sessoes', 'aerobicos', 'suplementos', 'tomadas'].forEach((c) => { S()[c] = S()[c].filter((x) => x.perfilId !== p.id); }); S().perfis = S().perfis.filter((x) => x.id !== p.id); if (S().perfilAtivo === p.id) S().perfilAtivo = S().perfis[0].id; A.save(); A.closeModal(); A.render(); }, { danger: true, ok: 'Excluir tudo' }));
    });
    A.on('pfNovo', () => A.trocarPerfil());
    A.on('pfUsar', (el) => { S().perfilAtivo = el.dataset.id; A.save(); A.render(); });
    return `<div class="row between"><h2>Perfis</h2><button class="btn sm" data-act="pfNovo">＋ Novo</button></div><p class="help">Cada perfil tem avaliações, dietas, treinos e histórico separados.</p>
      <div class="list">${S().perfis.map((p) => `<div class="item static ${p.id === S().perfilAtivo ? 'on' : ''}"><div class="ico">${p.sexo === 'F' ? '👩' : '👨'}</div><div><div class="t">${h(p.nome)} ${p.id === S().perfilAtivo ? badge('ativo', 'ok') : ''}</div><div class="s">${p.sexo === 'F' ? 'Feminino' : 'Masculino'} · ${A.idade(p) || '?'} anos · ${h(p.altura)} cm · ${A.S.sessoes.filter((s) => s.perfilId === p.id).length} treinos · ${A.S.dietas.filter((s) => s.perfilId === p.id).length} dietas</div></div><div class="row nowrap">${p.id !== S().perfilAtivo ? `<button class="btn xs" data-act="pfUsar" data-id="${h(p.id)}">usar</button>` : ''}<button class="btn xs" data-act="pfEdit" data-id="${h(p.id)}">✏️</button></div></div>`).join('')}</div>`;
  });
})();
