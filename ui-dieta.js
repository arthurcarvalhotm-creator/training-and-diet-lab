/* =====================================================================
 * FitLab — Interface de dieta
 * Planos alimentares (editor com metas e totais), gerador de dieta,
 * diário alimentar com aderência e água, biblioteca de alimentos
 * (com equivalentes e alimentos personalizados) e suplementação.
 * ===================================================================== */
(function () {
  'use strict';
  const A = window.App, DB = A.DB, E = A.E;
  const { h, n0, n1, field, inp, num, sel, badge, empty, tabs, fmtData, hoje, uid } = A;
  const S = () => A.S;
  const TABS = (cur) => tabs([
    { id: 'planos', nome: '🍽️ Planos', href: '#/dieta/planos' }, { id: 'diario', nome: '📆 Diário', href: '#/dieta/diario' },
    { id: 'alimentos', nome: '🥦 Alimentos', href: '#/dieta/alimentos' }, { id: 'suplementos', nome: '💊 Suplementos', href: '#/dieta/suplementos' }
  ], cur);
  const TIPOS = [['treino', 'Dia de treino'], ['descanso', 'Dia de descanso'], ['low', 'Low carb'], ['alto-carbo', 'Carbo alto / refeed'], ['viagem', 'Viagem'], ['vida', 'Vida real / flexível'], ['outro', 'Outro']];
  const metaPadrao = () => { const av = A.ultimaAvaliacao(); return av ? { kcal: av.resultado.alvo, c: av.resultado.macros.c.g, g: av.resultado.macros.g.g, p: av.resultado.macros.p.g } : null; };
  const metaDe = (d) => d.meta && d.meta.kcal ? d.meta : metaPadrao();
  const fmtQtd = (item, al) => { const a = al.get(item.alimentoId); const u = a && a.liquido ? 'ml' : 'g'; if (item.medida && a && a.medidas[item.medida]) { const n = item.qtd / a.medidas[item.medida]; return `${n1(n)} × ${h(item.medida)} (${n0(item.qtd)} ${u})`; } return `${n0(item.qtd)} ${u}`; };

  A.route('dieta', () => { A.go('dieta/planos'); return ''; });
  A.route('dieta/:tab', (p, q) => {
    A.setTitle('Dieta');
    const fn = { planos: viewPlanos, diario: viewDiario, alimentos: viewAlimentos, suplementos: viewSuplementos }[p.tab];
    return TABS(p.tab) + (fn ? fn(q) : empty('🤷', 'Aba desconhecida'));
  });
  A.route('suplementos', () => { A.go('dieta/suplementos'); return ''; });
  A.route('alimentos', () => { A.go('dieta/alimentos'); return ''; });

  /* ================= Planos ================= */
  function viewPlanos() {
    const al = A.alMap();
    const ds = A.mine('dietas').sort((a, b) => (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0) || (a.criadoEm < b.criadoEm ? 1 : -1));
    const meta = metaPadrao();
    A.on('planoNovo', () => {
      A.modal({ title: 'Novo plano em branco', body: `<div id="pf">${field('Nome', inp('nome', '', 'placeholder="Ex.: Set 26 — treino"'))}<div class="form-grid">${field('Tipo', sel('tipo', TIPOS, 'treino'))}${field('Nº de refeições', num('n', 5, 'step="1" min="1" max="8"'))}</div></div>`, foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="planoCriar">Criar</button>` });
      A.on('planoCriar', () => { const d = A.formData(A.$('#pf')); if (!d.nome) { A.toast('Dê um nome.'); return; } const horas = ['07:30', '10:00', '12:30', '16:00', '19:30', '22:00', '', '']; const pl = { id: uid(), perfilId: A.perfil().id, nome: d.nome, tipo: d.tipo, meta: meta ? { ...meta } : null, ativo: false, criadoEm: hoje(), refeicoes: [] }; for (let i = 0; i < (d.n || 5); i++) pl.refeicoes.push({ id: uid(), nome: 'Refeição ' + (i + 1), hora: horas[i] || '', itens: [] }); S().dietas.push(pl); A.save(); A.closeModal(); A.go('plano/' + pl.id); });
    });
    return `<div class="row between"><h2>Planos alimentares</h2><div class="row"><a class="btn primary sm" href="#/gerar-dieta">✨ Gerar</a><button class="btn sm" data-act="planoNovo">＋ Em branco</button></div></div>
      ${meta ? `<div class="help mb">Meta atual (avaliação): <b>${n0(meta.kcal)} kcal</b> · C ${meta.c} g · G ${meta.g} g · P ${meta.p} g</div>` : '<div class="help mb">Faça uma <a href="#/avaliacao/nova">avaliação</a> para definir metas automáticas.</div>'}
      <div class="list">${ds.length ? ds.map((d) => { const t = E.totaisDieta(d, al); const m = metaDe(d); return `<a class="item" href="#/plano/${d.id}"><div class="ico">${d.ativo ? '⭐' : '🍽️'}</div><div><div class="t">${h(d.nome)} ${d.ativo ? badge('ativo', 'ok') : ''}</div><div class="s">${(TIPOS.find((x) => x[0] === d.tipo) || ['', ''])[1]} · ${d.refeicoes.filter((r) => !r.substituicao).length} refeições · C ${n0(t.c)} · G ${n0(t.g)} · P ${n0(t.p)}${d.origem ? ' · planilha' : ''}</div></div><div class="right"><div class="big">${n0(t.kcal)}</div><div class="tiny muted">${m ? 'de ' + n0(m.kcal) : 'kcal'}</div></div></a>`; }).join('') : empty('🍽️', 'Nenhum plano ainda.', '<a class="btn primary" href="#/gerar-dieta">✨ Gerar meu primeiro plano</a>')}</div>`;
  }

  A.route('plano/:id', (p) => {
    const d = S().dietas.find((x) => x.id === p.id); if (!d) return empty('🤷', 'Plano não encontrado');
    A.setTitle(d.nome);
    const al = A.alMap(); const t = E.totaisDieta(d, al); const meta = metaDe(d);
    A.on('planoAtivar', () => { S().dietas.forEach((x) => { if (x.perfilId === d.perfilId) x.ativo = x.id === d.id; }); A.save(); A.render(); A.toast('Plano ativo'); });
    A.on('planoEditar', () => {
      const av = metaPadrao();
      A.modal({ title: 'Editar plano', body: `<div id="pf">${field('Nome', inp('nome', d.nome))}${field('Tipo', sel('tipo', TIPOS, d.tipo))}<div class="lbl">Metas ${av ? `(<a href="#" data-act="metaAv">usar da avaliação: ${n0(av.kcal)} kcal</a>)` : ''}</div><div class="form-grid tight">${field('kcal', num('kcal', d.meta ? d.meta.kcal : '', 'step="1"'))}${field('Carbo (g)', num('c', d.meta ? d.meta.c : '', 'step="1"'))}${field('Gordura (g)', num('g', d.meta ? d.meta.g : '', 'step="1"'))}${field('Proteína (g)', num('p', d.meta ? d.meta.p : '', 'step="1"'))}</div>${field('Observações', `<textarea name="obs">${h(d.obs || '')}</textarea>`)}</div>`,
        foot: `<button class="btn danger" data-act="planoExcluir">Excluir</button><span class="grow"></span><button class="btn primary" data-act="planoSalvar">Salvar</button>` });
      A.on('metaAv', (el, ev) => { ev.preventDefault(); ['kcal', 'c', 'g', 'p'].forEach((k) => { A.$(`#pf [name=${k}]`).value = av[k]; }); });
      A.on('planoSalvar', () => { const f = A.formData(A.$('#pf')); d.nome = f.nome; d.tipo = f.tipo; d.obs = f.obs; d.meta = f.kcal ? { kcal: f.kcal, c: f.c || 0, g: f.g || 0, p: f.p || 0 } : null; A.save(); A.closeModal(); A.render(); });
      A.on('planoExcluir', () => A.confirmar(`Excluir o plano "${d.nome}"?`, () => { S().dietas = S().dietas.filter((x) => x.id !== d.id); A.save(); A.go('dieta/planos'); }, { danger: true, ok: 'Excluir' }));
    });
    A.on('planoDuplicar', () => { const c = JSON.parse(JSON.stringify(d)); c.id = uid(); c.nome = d.nome + ' (cópia)'; c.ativo = false; c.origem = null; c.criadoEm = hoje(); c.refeicoes.forEach((r) => { r.id = uid(); }); S().dietas.push(c); A.save(); A.go('plano/' + c.id); });
    A.on('planoImg', () => A.exportarImagem({ dieta: d }));
    A.on('planoCopiar', () => { navigator.clipboard && navigator.clipboard.writeText(planoTexto(d, al)).then(() => A.toast('Copiado')); });
    A.on('planoAjustar', () => {
      if (!meta) { A.toast('Defina as metas primeiro.'); return; }
      A.confirmar('Ajustar automaticamente as quantidades das fontes de carboidrato, proteína e gordura para bater as metas? Os demais itens ficam como estão.', () => { marcarFlex(d, al); d.meta = d.meta && d.meta.kcal ? d.meta : { ...meta }; E.ajustarDieta(d, al); A.save(); A.render(); A.toast('Quantidades ajustadas'); }, { ok: 'Ajustar' });
    });
    A.on('refNova', () => { d.refeicoes.push({ id: uid(), nome: 'Refeição ' + (d.refeicoes.length + 1), hora: '', itens: [] }); A.save(); A.render(); });
    A.on('refEditar', (el) => {
      const r = d.refeicoes.find((x) => x.id === el.dataset.id);
      A.modal({ title: 'Refeição', body: `<div id="pf"><div class="form-grid">${field('Nome', inp('nome', r.nome))}${field('Horário', inp('hora', r.hora, 'type="time"'))}</div><label class="check"><input type="checkbox" name="substituicao" ${r.substituicao ? 'checked' : ''}> Refeição de substituição (não soma no total)</label>${field('Observação', inp('obs', r.obs, 'placeholder="Ex.: pode trocar arroz por batata"'))}</div>`,
        foot: `<button class="btn danger" data-act="refExcluir">Excluir</button><button class="btn" data-act="refUp">▲</button><button class="btn" data-act="refDown">▼</button><span class="grow"></span><button class="btn primary" data-act="refSalvar">Salvar</button>` });
      A.on('refSalvar', () => { Object.assign(r, A.formData(A.$('#pf'))); A.save(); A.closeModal(); A.render(); });
      A.on('refExcluir', () => { d.refeicoes = d.refeicoes.filter((x) => x.id !== r.id); A.save(); A.closeModal(); A.render(); });
      A.on('refUp', () => { const i = d.refeicoes.indexOf(r); if (i > 0) { [d.refeicoes[i - 1], d.refeicoes[i]] = [d.refeicoes[i], d.refeicoes[i - 1]]; A.save(); A.closeModal(); A.render(); } });
      A.on('refDown', () => { const i = d.refeicoes.indexOf(r); if (i < d.refeicoes.length - 1) { [d.refeicoes[i + 1], d.refeicoes[i]] = [d.refeicoes[i], d.refeicoes[i + 1]]; A.save(); A.closeModal(); A.render(); } });
    });
    A.on('itemAdd', (el) => { const r = d.refeicoes.find((x) => x.id === el.dataset.id); escolherAlimento((a) => itemForm(r, { alimentoId: a.id, qtd: a.medidas && Object.values(a.medidas)[0] || 100 }, true, () => { A.save(); A.render(); })); });
    A.on('itemEdit', (el) => { const r = d.refeicoes.find((x) => x.id === el.dataset.r); const it = r.itens[+el.dataset.i]; itemForm(r, it, false, () => { A.save(); A.render(); }); });
    const m = meta;
    return `<div class="card dieta"><div class="row between"><div><h2>${h(d.nome)} ${d.ativo ? badge('ativo', 'ok') : ''}</h2><div class="muted">${(TIPOS.find((x) => x[0] === d.tipo) || ['', ''])[1]}${d.obs ? ' · ' + h(d.obs) : ''}</div></div></div>
      <div class="stats mt"><div class="stat kcal"><div class="lbl">Calorias</div><div class="v">${n0(t.kcal)}</div><div class="tiny muted">${m ? (t.kcal - m.kcal >= 0 ? '+' : '') + n0(t.kcal - m.kcal) + ' vs ' + n0(m.kcal) : 'kcal'}</div></div><div class="stat carb"><div class="lbl">Carbo</div><div class="v">${n0(t.c)}<small> g</small></div><div class="tiny muted">${m ? 'meta ' + n0(m.c) : ''}</div></div><div class="stat gord"><div class="lbl">Gordura</div><div class="v">${n0(t.g)}<small> g</small></div><div class="tiny muted">${m ? 'meta ' + n0(m.g) : ''}</div></div><div class="stat prot"><div class="lbl">Proteína</div><div class="v">${n0(t.p)}<small> g</small></div><div class="tiny muted">${m ? 'meta ' + n0(m.p) : ''}</div></div><div class="stat fib"><div class="lbl">Fibras</div><div class="v">${n0(t.fib)}<small> g</small></div><div class="tiny muted">≥ 25 g</div></div></div>
      ${m ? `<div class="mt">${A.macroRow('kcal', t.kcal, m.kcal, '', 'kcal')}${A.macroRow('Carbo', t.c, m.c, 'carb')}${A.macroRow('Gordura', t.g, m.g, 'gord')}${A.macroRow('Proteína', t.p, m.p, 'prot')}</div>` : ''}
      <div class="inline-actions">${!d.ativo ? '<button class="btn primary sm" data-act="planoAtivar">⭐ Tornar ativo</button>' : ''}<button class="btn sm" data-act="planoEditar">✏️ Editar / metas</button><button class="btn sm" data-act="planoAjustar">🎯 Ajustar às metas</button><button class="btn sm" data-act="planoDuplicar">⧉ Duplicar</button><button class="btn sm" data-act="planoImg">🖼️ Exportar imagem</button><button class="btn sm ghost" data-act="planoCopiar">📋 Copiar</button></div></div>
      <div class="section-title"><h2>Refeições</h2><button class="btn sm" data-act="refNova">＋ Refeição</button></div>
      ${d.refeicoes.map((r, ri) => { const tr = t.refeicoes[ri]; return `<div class="meal ${r.substituicao ? 'soft' : ''}"><div class="head" data-act="refEditar" data-id="${r.id}"><span class="t">${h(r.nome)} ${r.hora ? `<span class="muted">${h(r.hora)}</span>` : ''} ${r.substituicao ? badge('substituição') : ''}</span><span class="kc">${n0(tr.kcal)} kcal · C ${n0(tr.c)} G ${n0(tr.g)} P ${n0(tr.p)}</span></div>
        ${r.obs ? `<div class="tiny muted">${h(r.obs)}</div>` : ''}
        ${r.itens.map((it, i) => { const v = E.calcItem(it, al); return `<div class="food" data-act="itemEdit" data-r="${r.id}" data-i="${i}" style="cursor:pointer"><span>${h(v.nome)}${v.faltando ? ' ' + badge('não encontrado', 'danger') : ''}</span><span class="q">${fmtQtd(it, al)}</span><span class="q">${n0(v.kcal)} kcal</span></div>`; }).join('')}
        <div class="row mt-s"><button class="btn xs" data-act="itemAdd" data-id="${r.id}">＋ Alimento</button></div></div>`; }).join('')}`;
  });
  function marcarFlex(d, al) {
    d.refeicoes.forEach((r) => r.itens.forEach((it) => {
      if (it.flex) return;
      for (const k of Object.keys(DB.papelAlimento)) if (DB.papelAlimento[k].includes(it.alimentoId)) { it.flex = k; return; }
      const a = al.get(it.alimentoId); if (!a) return;
      if (a.categoria === 'proteinas' || (a.categoria === 'suplementos' && a.p > 50)) it.flex = 'proteina';
      else if (a.categoria === 'cereais' || (a.categoria === 'suplementos' && a.c > 50)) it.flex = 'carbo';
      else if (a.categoria === 'gorduras') it.flex = 'gordura';
    }));
  }
  function planoTexto(d, al) {
    const t = E.totaisDieta(d, al);
    return `${d.nome}\nMeta: ${d.meta ? `${d.meta.kcal} kcal · C ${d.meta.c} · G ${d.meta.g} · P ${d.meta.p}` : '—'}\nTotal: ${n0(t.kcal)} kcal · C ${n0(t.c)} · G ${n0(t.g)} · P ${n0(t.p)}\n\n` + d.refeicoes.map((r, i) => `${r.nome}${r.hora ? ' (' + r.hora + ')' : ''}\n` + r.itens.map((it) => `  - ${E.calcItem(it, al).nome}: ${fmtQtd(it, al).replace(/<[^>]+>/g, '')}`).join('\n') + `\n  = ${n0(t.refeicoes[i].kcal)} kcal`).join('\n\n');
  }
  /* Formulário de item (quantidade + medida caseira) */
  function itemForm(r, it, novo, cb) {
    const al = A.alMap(); const a = al.get(it.alimentoId); if (!a) return;
    const medidas = Object.entries(a.medidas || {});
    const calc = () => { const q = Number(A.$('#pf [name=qtd]').value) || 0; const v = E.calcItem({ alimentoId: a.id, qtd: q }, al); A.$('#itemTot').innerHTML = `<b>${n0(v.kcal)} kcal</b> · C ${n1(v.c)} · G ${n1(v.g)} · P ${n1(v.p)} · fibras ${n1(v.fib)}`; };
    A.modal({ title: a.nome, body: `<div id="pf"><div class="tiny muted mb">Por 100 ${a.liquido ? 'ml' : 'g'}: ${a.kcal} kcal · C ${a.c} · G ${a.g} · P ${a.p}</div><div class="form-grid tight">${field('Quantidade (' + (a.liquido ? 'ml' : 'g') + ')', num('qtd', it.qtd, 'step="1" inputmode="decimal" autofocus'))}${medidas.length ? field('Medida caseira', `<select name="medida"><option value="">— gramas —</option>${medidas.map(([nome, g]) => `<option value="${h(nome)}" ${it.medida === nome ? 'selected' : ''}>${h(nome)} (${g} ${a.liquido ? 'ml' : 'g'})</option>`).join('')}</select>`) : ''}${medidas.length ? field('Nº de medidas', num('nMed', it.medida && a.medidas[it.medida] ? n1(it.qtd / a.medidas[it.medida]) : '', 'step="0.5" inputmode="decimal"')) : ''}</div><div id="itemTot" class="mb"></div>
      <details class="lib"><summary>Substituições equivalentes</summary><div class="body" id="itemEq"></div></details></div>`,
      foot: `${novo ? '' : '<button class="btn danger" data-act="itemRm">Remover</button><span class="grow"></span>'}<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="itemOk">Salvar</button>` });
    const qEl = A.$('#pf [name=qtd]'), mEl = A.$('#pf [name=medida]'), nEl = A.$('#pf [name=nMed]');
    const eq = () => { const q = Number(qEl.value) || 0; const list = E.equivalentes(a.id, q, al); A.$('#itemEq').innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl">${list.map((x) => `<tr><td>${h(x.alimento.nome)}</td><td class="n">${x.qtd} g</td><td class="n">${x.kcal} kcal</td><td><button class="btn xs" data-act="itemEqUse" data-id="${x.alimento.id}" data-q="${x.qtd}">usar</button></td></tr>`).join('')}</table></div>` : '<span class="muted">Sem equivalentes cadastrados.</span>'; };
    qEl.addEventListener('input', () => { if (mEl && mEl.value && nEl) nEl.value = n1(Number(qEl.value) / a.medidas[mEl.value]); calc(); eq(); });
    if (mEl) { mEl.addEventListener('change', () => { if (mEl.value) { if (!nEl.value) nEl.value = 1; qEl.value = Math.round(Number(nEl.value) * a.medidas[mEl.value]); } calc(); eq(); }); nEl.addEventListener('input', () => { if (mEl.value) { qEl.value = Math.round((Number(nEl.value) || 0) * a.medidas[mEl.value]); calc(); eq(); } }); }
    calc(); eq();
    A.on('itemEqUse', (el) => { it.alimentoId = el.dataset.id; it.qtd = Number(el.dataset.q); it.medida = ''; if (novo) r.itens.push(it); A.closeModal(); cb(); });
    A.on('itemOk', () => { it.qtd = Number(qEl.value) || 0; it.medida = mEl ? mEl.value : ''; if (novo) r.itens.push(it); A.closeModal(); cb(); });
    A.on('itemRm', () => { r.itens = r.itens.filter((x) => x !== it); A.closeModal(); cb(); });
  }
  /* Seletor de alimento */
  function escolherAlimento(cb) {
    let cat = '', busca = '';
    const lista = () => { const q = busca.toLowerCase(); const al = A.alMap(); const items = [...al.values()].filter((a) => (!cat || a.categoria === cat) && (!q || a.nome.toLowerCase().includes(q))).slice(0, 80); return items.length ? items.map((a) => `<div class="item" data-act="alPick" data-id="${a.id}"><div class="ico">${icone(a.categoria)}</div><div><div class="t">${h(a.nome)}</div><div class="s">${a.kcal} kcal · C ${a.c} · G ${a.g} · P ${a.p} / 100 ${a.liquido ? 'ml' : 'g'}</div></div><div class="right muted">＋</div></div>`).join('') : empty('🔍', 'Nada encontrado.', '<button class="btn sm" data-act="alCustom">Criar alimento</button>'); };
    const draw = () => { A.$('#alLista').innerHTML = lista(); A.$('#alChips').innerHTML = A.chips([{ id: '', nome: 'Todos', on: !cat }, ...Object.entries(DB.categoriasAlimento).map(([id, nome]) => ({ id, nome, on: cat === id }))], null, 'alCat'); };
    A.modal({ title: 'Escolher alimento', body: `<input type="search" class="search" id="alBusca" placeholder="Buscar alimento…"><div id="alChips" class="mb"></div><div class="row mb"><button class="btn sm" data-act="alCustom">＋ Alimento personalizado</button></div><div class="list" id="alLista"></div>` });
    draw();
    A.$('#alBusca').addEventListener('input', (ev) => { busca = ev.target.value; A.$('#alLista').innerHTML = lista(); });
    A.on('alCat', (el) => { cat = el.dataset.id; draw(); });
    A.on('alPick', (el) => { const a = A.alMap().get(el.dataset.id); A.closeModal(); cb(a); });
    A.on('alCustom', () => alimentoCustomForm(null, (a) => { A.closeModal(); cb(a); }));
  }
  const icone = (cat) => ({ cereais: '🍚', leguminosas: '🫘', proteinas: '🍗', laticinios: '🥛', frutas: '🍌', vegetais: '🥦', gorduras: '🥑', doces: '🍫', molhos: '🧂', bebidas: '🥤', suplementos: '🥤', preparos: '🍽️', custom: '⭐' }[cat] || '🍽️');
  function alimentoCustomForm(existente, cb) {
    const a = existente || {};
    A.modal({ title: existente ? 'Editar alimento' : 'Alimento personalizado', body: `<div id="pf">${field('Nome', inp('nome', a.nome, 'required placeholder="Ex.: Pão de queijo da vó"'))}<div class="lbl">Valores por 100 g (ou 100 ml)</div><div class="form-grid tight">${field('Carbo (g)', num('c', a.c, 'step="0.1" inputmode="decimal"'))}${field('Gordura (g)', num('g', a.g, 'step="0.1" inputmode="decimal"'))}${field('Proteína (g)', num('p', a.p, 'step="0.1" inputmode="decimal"'))}${field('Fibras (g)', num('fib', a.fib, 'step="0.1" inputmode="decimal"'))}</div><div class="form-grid">${field('Categoria', sel('categoria', Object.entries(DB.categoriasAlimento), a.categoria || 'custom'))}${field('Medida caseira (nome)', inp('medNome', a.medidas ? Object.keys(a.medidas)[0] || '' : '', 'placeholder="unidade, fatia, colher…"'))}${field('Medida caseira (gramas)', num('medG', a.medidas ? Object.values(a.medidas)[0] || '' : '', 'step="1"'))}</div><label class="check"><input type="checkbox" name="liquido" ${a.liquido ? 'checked' : ''}> É líquido (ml)</label><div class="help">Dica: pegue os valores do rótulo e converta para 100 g. As calorias são calculadas (4/9/4).</div></div>`,
      foot: `<button class="btn" data-act="__modalClose">Cancelar</button><button class="btn primary" data-act="alSalvar">Salvar</button>` });
    A.on('alSalvar', () => {
      const d = A.formData(A.$('#pf')); if (!d.nome) { A.toast('Dê um nome.'); return; }
      const obj = existente || { id: 'custom-' + DB.slug(d.nome) + '-' + uid().slice(-4), custom: true };
      Object.assign(obj, { nome: d.nome, categoria: d.categoria, c: d.c || 0, g: d.g || 0, p: d.p || 0, fib: d.fib || 0, liquido: !!d.liquido, medidas: d.medNome && d.medG ? { [d.medNome]: d.medG } : {} });
      obj.kcal = Math.round((obj.c * 4 + obj.g * 9 + obj.p * 4) * 10) / 10;
      if (!existente) S().alimentosCustom.push(obj);
      A.save(); if (cb) cb(obj); else { A.closeModal(); A.render(); }
    });
  }
  A.escolherAlimento = escolherAlimento; A.alimentoCustomForm = alimentoCustomForm;

  /* ================= Gerador de dieta ================= */
  A.route('gerar-dieta', () => {
    A.setTitle('Gerar dieta');
    const meta = metaPadrao(); const av = A.ultimaAvaliacao();
    const st = { kcal: meta ? meta.kcal : 2000, c: meta ? meta.c : 250, g: meta ? meta.g : 60, p: meta ? meta.p : 150, n: 5, estilo: 'salgado', excluir: [], nome: '', seed: 1, preview: null, tipo: 'treino' };
    const al = A.alMap();
    const excluiveis = [...new Set(Object.values(DB.papelAlimento).flat())].map((id) => al.get(id)).filter(Boolean);
    const draw = () => {
      A.$('#gdForm').innerHTML = `<div class="form-grid tight">${field('kcal', num('kcal', st.kcal, 'step="10"'))}${field('Carbo (g)', num('c', st.c, 'step="5"'))}${field('Gordura (g)', num('g', st.g, 'step="5"'))}${field('Proteína (g)', num('p', st.p, 'step="5"'))}</div>
        ${av ? `<div class="help mb">Metas da avaliação de ${fmtData(av.data, true)}. <a href="#/corpo">Alterar objetivo</a>.</div>` : '<div class="help mb">Sem avaliação: informe as metas manualmente.</div>'}
        <div class="form-grid">${field('Refeições por dia', sel('n', [[3, '3'], [4, '4'], [5, '5 (com pré e pós-treino)'], [6, '6'], [7, '7 (com ceia)']], st.n))}${field('Café da manhã', sel('estilo', [['salgado', 'Salgado (ovos e pão)'], ['doce', 'Doce (iogurte, aveia e frutas)']], st.estilo))}${field('Tipo do plano', sel('tipo', TIPOS, st.tipo))}${field('Nome', inp('nome', st.nome, 'placeholder="Ex.: Set 26 — treino"'))}</div>
        <div class="lbl">Não gosto / não como</div>${A.chips(excluiveis.map((a) => ({ id: a.id, nome: a.nome, on: st.excluir.includes(a.id) })), null, 'gdExcl')}`;
    };
    const ler = () => { const d = A.formData(A.$('#gdForm')); st.kcal = d.kcal; st.c = d.c; st.g = d.g; st.p = d.p; st.n = Number(d.n); st.estilo = d.estilo; st.tipo = d.tipo; st.nome = d.nome; };
    const gerar = () => {
      st.preview = E.gerarDieta({ metaKcal: st.kcal, metaC: st.c, metaG: st.g, metaP: st.p, nRefeicoes: st.n, estilo: st.estilo, excluir: st.excluir, nome: st.nome || 'Plano gerado', mapa: al, seed: st.seed });
      const d = st.preview; const t = E.totaisDieta(d, al);
      A.$('#gdPreview').innerHTML = `<div class="section-title"><h2>Prévia</h2><button class="btn sm" data-act="gdNovo">🎲 Gerar outra</button></div>
        <div class="card mb"><div class="stats"><div class="stat kcal"><div class="lbl">kcal</div><div class="v">${n0(t.kcal)}</div><div class="tiny muted">meta ${n0(st.kcal)}</div></div><div class="stat carb"><div class="lbl">Carbo</div><div class="v">${n0(t.c)}</div><div class="tiny muted">meta ${n0(st.c)}</div></div><div class="stat gord"><div class="lbl">Gordura</div><div class="v">${n0(t.g)}</div><div class="tiny muted">meta ${n0(st.g)}</div></div><div class="stat prot"><div class="lbl">Proteína</div><div class="v">${n0(t.p)}</div><div class="tiny muted">meta ${n0(st.p)}</div></div><div class="stat fib"><div class="lbl">Fibras</div><div class="v">${n0(t.fib)}</div></div></div></div>
        ${d.refeicoes.map((r, i) => `<div class="meal"><div class="head"><span class="t">${h(r.nome)} <span class="muted">${h(r.hora)}</span></span><span class="kc">${n0(t.refeicoes[i].kcal)} kcal</span></div>${r.itens.map((it) => { const v = E.calcItem(it, al); return `<div class="food"><span>${h(v.nome)}</span><span class="q">${fmtQtd(it, al)}</span><span class="q">${n0(v.kcal)} kcal</span></div>`; }).join('')}</div>`).join('')}
        <button class="btn primary block mt" data-act="gdSalvar">💾 Salvar plano</button><p class="help">Depois de salvar você pode trocar alimentos, ajustar quantidades e ver substituições equivalentes em cada item.</p>`;
      window.scrollTo({ top: A.$('#gdPreview').offsetTop - 60, behavior: 'smooth' });
    };
    A.on('gdExcl', (el) => { ler(); const id = el.dataset.id; st.excluir = st.excluir.includes(id) ? st.excluir.filter((x) => x !== id) : [...st.excluir, id]; draw(); });
    A.on('gdGerar', () => { ler(); st.seed = Date.now() % 100000; gerar(); });
    A.on('gdNovo', () => { ler(); st.seed = Date.now() % 100000; gerar(); });
    A.on('gdSalvar', () => { const d = st.preview; d.perfilId = A.perfil().id; d.tipo = st.tipo; d.criadoEm = hoje(); d.ativo = !S().dietas.some((x) => x.perfilId === d.perfilId && x.ativo); S().dietas.push(d); A.save(); A.toast('Plano salvo' + (d.ativo ? ' e ativado' : '')); A.go('plano/' + d.id); });
    A.on('__after', draw);
    return `<div class="card dieta"><h2>✨ Gerar plano alimentar</h2><p class="text-2">Monta as refeições com alimentos do dia a dia brasileiro e ajusta as quantidades das fontes de carboidrato, proteína e gordura para bater as metas.</p><div id="gdForm"></div><button class="btn primary block mt" data-act="gdGerar">Gerar prévia</button></div><div id="gdPreview"></div>`;
  });

  /* ================= Diário alimentar ================= */
  function viewDiario(q) {
    const data = (q && q.data) || hoje();
    const dieta = A.dietaAtiva(); const al = A.alMap();
    let reg = A.mine('diario').find((d) => d.data === data);
    const garantir = () => { if (!reg) { reg = { id: uid(), perfilId: A.perfil().id, data, refeicoes: {}, extras: [], agua: 0 }; S().diario.push(reg); } return reg; };
    const meta = dieta ? metaDe(dieta) : metaPadrao();
    const cons = { kcal: 0, c: 0, g: 0, p: 0, fib: 0 };
    const add = (t) => { cons.kcal += t.kcal; cons.c += t.c; cons.g += t.g; cons.p += t.p; cons.fib += t.fib; };
    if (dieta && reg) dieta.refeicoes.forEach((r) => { if (reg.refeicoes[r.id]) add(E.totaisRefeicao(r, al)); });
    if (reg) (reg.extras || []).forEach((it) => add(E.calcItem(it, al)));
    const copo = S().config.aguaCopo || 250; const aguaMeta = E.aguaDiaria((A.ultimoPeso() || { peso: 70 }).peso, true);
    A.on('diaRef', (el) => { garantir(); reg.refeicoes[el.dataset.id] = !reg.refeicoes[el.dataset.id]; A.save(); A.render(); });
    A.on('diaExtra', () => escolherAlimento((a) => { garantir(); itemForm({ itens: reg.extras }, { alimentoId: a.id, qtd: a.medidas && Object.values(a.medidas)[0] || 100 }, true, () => { A.save(); A.render(); }); }));
    A.on('diaExtraEdit', (el) => { itemForm({ itens: reg.extras }, reg.extras[+el.dataset.i], false, () => { A.save(); A.render(); }); });
    A.on('diaAgua', (el) => { garantir(); const n = Number(el.dataset.n); reg.agua = reg.agua === n * copo ? (n - 1) * copo : n * copo; A.save(); A.render(); });
    A.on('diaObs', (el) => { garantir(); reg.obs = el.value; A.save(); });
    A.on('diaTodas', () => { garantir(); dieta.refeicoes.forEach((r) => { if (!r.substituicao) reg.refeicoes[r.id] = true; }); A.save(); A.render(); });
    if (q && q.extra === '1') setTimeout(() => A.acts && A.$('[data-act=diaExtra]') && A.$('[data-act=diaExtra]').click(), 50);
    const dias = []; for (let i = 13; i >= 0; i--) { const d = E.addDias(hoje(), -i); const r = A.mine('diario').find((x) => x.data === d); const tot = dieta ? dieta.refeicoes.filter((x) => !x.substituicao).length : 0; const feitas = r && dieta ? dieta.refeicoes.filter((x) => !x.substituicao && r.refeicoes[x.id]).length : 0; dias.push({ label: fmtData(d).slice(0, 5), v: tot ? Math.round(feitas / tot * 100) : 0 }); }
    return `<div class="row between"><div class="row nowrap"><a class="btn sm ghost" href="#/dieta/diario?data=${E.addDias(data, -1)}">‹</a><b>${A.fmtDataLonga(data)}</b><a class="btn sm ghost" href="#/dieta/diario?data=${E.addDias(data, 1)}">›</a></div>${data !== hoje() ? '<a class="btn xs" href="#/dieta/diario">hoje</a>' : ''}</div>
      <div class="card dieta mt">${meta ? `${A.macroRow('kcal', cons.kcal, meta.kcal, '', 'kcal')}${A.macroRow('Carbo', cons.c, meta.c, 'carb')}${A.macroRow('Gordura', cons.g, meta.g, 'gord')}${A.macroRow('Proteína', cons.p, meta.p, 'prot')}<div class="tiny muted mt-s">Fibras ${n0(cons.fib)} g · restam ${n0(Math.max(0, meta.kcal - cons.kcal))} kcal</div>` : `<div class="text-2">Consumido: <b>${n0(cons.kcal)} kcal</b> · C ${n0(cons.c)} · G ${n0(cons.g)} · P ${n0(cons.p)}</div>`}
        <div class="row between mt"><span class="lbl" style="margin:0">💧 Água: ${n0(reg ? reg.agua : 0)} / ${n0(aguaMeta)} ml</span></div><div class="water mt-s">${Array.from({ length: Math.ceil(aguaMeta / copo) }, (_, i) => `<button class="cup ${reg && reg.agua >= (i + 1) * copo ? 'on' : ''}" data-act="diaAgua" data-n="${i + 1}" title="${(i + 1) * copo} ml">💧</button>`).join('')}</div></div>
      <div class="section-title"><h2>Refeições do plano</h2>${dieta ? `<div class="row"><a class="tiny" href="#/plano/${dieta.id}">${h(dieta.nome)}</a><button class="btn xs" data-act="diaTodas">✓ todas</button></div>` : ''}</div>
      ${dieta ? dieta.refeicoes.filter((r) => !r.substituicao).map((r) => { const t = E.totaisRefeicao(r, al); const ok = reg && reg.refeicoes[r.id]; return `<div class="meal ${ok ? 'done' : ''}"><div class="head"><label class="row nowrap grow" style="cursor:pointer"><input type="checkbox" class="chk" data-act="diaRef" data-on="change" data-id="${r.id}" ${ok ? 'checked' : ''}><span class="t">${h(r.nome)} <span class="muted">${h(r.hora || '')}</span></span></label><span class="kc">${n0(t.kcal)} kcal</span></div><details><summary class="tiny muted" style="cursor:pointer">${r.itens.length} itens · C ${n0(t.c)} G ${n0(t.g)} P ${n0(t.p)}</summary>${r.itens.map((it) => { const v = E.calcItem(it, al); return `<div class="food"><span>${h(v.nome)}</span><span class="q">${fmtQtd(it, al)}</span><span class="q">${n0(v.kcal)}</span></div>`; }).join('')}</details></div>`; }).join('') : `<div class="card"><p class="text-2">Nenhum plano ativo. <a href="#/dieta/planos">Ative um plano</a> para marcar as refeições, ou registre alimentos avulsos abaixo.</p></div>`}
      <div class="section-title"><h2>Fora do plano / extras</h2><button class="btn sm" data-act="diaExtra">＋ Alimento</button></div>
      <div class="meal">${reg && reg.extras.length ? reg.extras.map((it, i) => { const v = E.calcItem(it, al); return `<div class="food" data-act="diaExtraEdit" data-i="${i}" style="cursor:pointer"><span>${h(v.nome)}</span><span class="q">${fmtQtd(it, al)}</span><span class="q">${n0(v.kcal)} kcal</span></div>`; }).join('') : '<div class="tiny muted">Nada registrado fora do plano.</div>'}</div>
      ${A.field('Observações do dia', `<textarea data-act="diaObs" data-on="input" placeholder="Fome, digestão, treino, sono…">${h(reg ? reg.obs || '' : '')}</textarea>`)}
      ${dieta ? `<div class="card mt"><h4>Aderência (últimos 14 dias, % das refeições do plano)</h4>${A.barChart({ valores: dias, height: 130, cls: 'c' })}</div>` : ''}`;
  }

  /* ================= Alimentos ================= */
  function viewAlimentos() {
    let cat = '', busca = '';
    const lista = () => { const q = busca.toLowerCase(); const al = A.alMap(); const items = [...al.values()].filter((a) => (!cat || a.categoria === cat) && (!q || a.nome.toLowerCase().includes(q))); return items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Alimento</th><th class="n">kcal</th><th class="n">C</th><th class="n">G</th><th class="n">P</th></tr></thead><tbody>${items.map((a) => `<tr data-act="alAbrir" data-id="${a.id}" style="cursor:pointer"><td>${icone(a.categoria)} ${h(a.nome)}${a.custom ? ' ' + badge('meu') : ''}</td><td class="n">${a.kcal}</td><td class="n">${a.c}</td><td class="n">${a.g}</td><td class="n">${a.p}</td></tr>`).join('')}</tbody></table></div><div class="help">Valores por 100 g / 100 ml. Referência TACO e rótulos.</div>` : empty('🔍', 'Nada encontrado.'); };
    A.on('__after', () => { const draw = () => { A.$('#alLista').innerHTML = lista(); A.$('#alChips').innerHTML = A.chips([{ id: '', nome: 'Todos', on: !cat }, ...Object.entries(DB.categoriasAlimento).map(([id, nome]) => ({ id, nome, on: cat === id }))], null, 'alCatB'); }; A.on('alCatB', (el) => { cat = el.dataset.id; draw(); }); A.$('#alBusca').addEventListener('input', (ev) => { busca = ev.target.value; A.$('#alLista').innerHTML = lista(); }); draw(); });
    A.on('alAbrir', (el) => A.go('alimento/' + el.dataset.id));
    A.on('alNovo', () => alimentoCustomForm(null));
    return `<div class="row between"><h2>Alimentos</h2><button class="btn sm" data-act="alNovo">＋ Personalizado</button></div><p class="help">${A.alMap().size} alimentos da alimentação fitness brasileira, com medidas caseiras e equivalentes.</p><input type="search" class="search" id="alBusca" placeholder="Buscar alimento…"><div id="alChips" class="mb"></div><div id="alLista"></div>`;
  }
  A.route('alimento/:id', (p) => {
    const al = A.alMap(); const a = al.get(p.id); if (!a) return empty('🤷', 'Alimento não encontrado');
    A.setTitle(a.nome);
    const eq = E.equivalentes(a.id, 100, al);
    A.on('alEdit', () => alimentoCustomForm(a));
    A.on('alRm', () => A.confirmar('Excluir este alimento personalizado?', () => { S().alimentosCustom = S().alimentosCustom.filter((x) => x.id !== a.id); A.save(); A.go('dieta/alimentos'); }, { danger: true, ok: 'Excluir' }));
    return `<div class="card dieta"><h2>${icone(a.categoria)} ${h(a.nome)}</h2><div class="muted">${h(DB.categoriasAlimento[a.categoria] || a.categoria)}</div>
      <div class="stats mt"><div class="stat kcal"><div class="lbl">kcal</div><div class="v">${a.kcal}</div></div><div class="stat carb"><div class="lbl">Carbo</div><div class="v">${a.c}<small> g</small></div></div><div class="stat gord"><div class="lbl">Gordura</div><div class="v">${a.g}<small> g</small></div></div><div class="stat prot"><div class="lbl">Proteína</div><div class="v">${a.p}<small> g</small></div></div><div class="stat fib"><div class="lbl">Fibras</div><div class="v">${a.fib || 0}<small> g</small></div></div></div><div class="tiny muted mt-s">por 100 ${a.liquido ? 'ml' : 'g'}</div>
      ${a.custom ? `<div class="inline-actions"><button class="btn sm" data-act="alEdit">✏️ Editar</button><button class="btn sm danger" data-act="alRm">Excluir</button></div>` : ''}</div>
      ${Object.keys(a.medidas || {}).length ? `<div class="card mt"><h3>Medidas caseiras</h3><div class="tbl-wrap"><table class="tbl">${Object.entries(a.medidas).map(([n, g]) => `<tr><td>1 ${h(n)}</td><td class="n">${g} ${a.liquido ? 'ml' : 'g'}</td><td class="n">${n0(a.kcal * g / 100)} kcal</td></tr>`).join('')}</table></div></div>` : ''}
      ${eq.length ? `<div class="card mt"><h3>Equivalentes a 100 g</h3><p class="help">Mesma quantidade do macronutriente principal.</p><div class="tbl-wrap"><table class="tbl">${eq.map((x) => `<tr><td><a href="#/alimento/${x.alimento.id}">${h(x.alimento.nome)}</a></td><td class="n">${x.qtd} g</td><td class="n">${x.kcal} kcal</td></tr>`).join('')}</table></div></div>` : ''}`;
  });

  /* ================= Suplementos ================= */
  function viewSuplementos() {
    const meus = A.mine('suplementos'); const hj = hoje(); const dow = new Date().getDay();
    const hojeLista = meus.filter((s) => s.ativo !== false && (!s.dias || !s.dias.length || s.dias.includes(dow)));
    const tomadas = A.mine('tomadas').filter((t) => t.data === hj);
    A.on('supTomar', (el) => { const id = el.dataset.id; const t = tomadas.find((x) => x.suplementoId === id); if (t) S().tomadas = S().tomadas.filter((x) => x.id !== t.id); else S().tomadas.push({ id: uid(), perfilId: A.perfil().id, data: hj, suplementoId: id }); A.save(); A.render(); });
    A.on('supAdd', (el) => supForm(null, el.dataset.cat));
    A.on('supEdit', (el) => supForm(meus.find((x) => x.id === el.dataset.id)));
    const catalogo = DB.suplementos.filter((c) => !meus.some((m) => m.catalogoId === c.id));
    return `<div class="row between"><h2>Suplementação</h2><button class="btn sm" data-act="supAdd">＋ Personalizado</button></div>
      <div class="card dieta"><h3>Hoje ${badge(`${tomadas.length}/${hojeLista.length}`, tomadas.length >= hojeLista.length && hojeLista.length ? 'ok' : '')}</h3>${hojeLista.length ? hojeLista.map((s) => { const ok = tomadas.some((t) => t.suplementoId === s.id); return `<label class="check"><input type="checkbox" ${ok ? 'checked' : ''} data-act="supTomar" data-on="change" data-id="${s.id}"><span><b>${h(s.nome)}</b> <span class="muted">${h(s.dose)} · ${h(s.momento)}</span></span></label>`; }).join('') : '<p class="text-2">Nenhum suplemento programado para hoje.</p>'}</div>
      <div class="section-title"><h2>Meu protocolo</h2></div>
      <div class="list">${meus.length ? meus.map((s) => `<div class="item" data-act="supEdit" data-id="${s.id}"><div class="ico">💊</div><div><div class="t">${h(s.nome)} ${s.ativo === false ? badge('pausado') : ''}</div><div class="s">${h(s.dose)} · ${h(s.momento)} · ${!s.dias || s.dias.length === 7 || !s.dias.length ? 'todos os dias' : s.dias.map((d) => A.DIAS[d]).join(', ')}</div></div><div class="right muted">›</div></div>`).join('') : '<div class="empty">Nenhum suplemento no protocolo.</div>'}</div>
      <div class="section-title"><h2>Catálogo</h2><span class="tiny muted">toque para adicionar</span></div>
      ${catalogo.map((c) => `<details class="lib"><summary>${h(c.nome)} <span class="tiny muted">${h(c.dose)}</span></summary><div class="body"><p>${h(c.desc)}</p><p><b>Quando:</b> ${h(c.momento)}</p><button class="btn sm primary" data-act="supAdd" data-cat="${c.id}">＋ Adicionar ao protocolo</button></div></details>`).join('')}`;
  }
  function supForm(s, catId) {
    const c = catId ? DB.suplementos.find((x) => x.id === catId) : null;
    const v = s || { nome: c ? c.nome : '', dose: c ? c.dose : '', momento: c ? c.momento : '', dias: [], ativo: true, catalogoId: catId || null };
    A.modal({ title: s ? 'Editar suplemento' : 'Adicionar suplemento', body: `<div id="pf">${field('Nome', inp('nome', v.nome))}<div class="form-grid">${field('Dose', inp('dose', v.dose, 'placeholder="Ex.: 5 g"'))}${field('Momento', inp('momento', v.momento, 'placeholder="Ex.: pós-treino"'))}</div><div class="lbl">Dias (vazio = todos)</div>${A.chips(A.DIAS.map((d, i) => ({ id: i, nome: d, on: (v.dias || []).includes(i) })), null, 'supDia')}<label class="check mt"><input type="checkbox" name="ativo" ${v.ativo !== false ? 'checked' : ''}> Ativo</label>${field('Observações', inp('obs', v.obs))}</div>`,
      foot: `${s ? '<button class="btn danger" data-act="supRm">Excluir</button><span class="grow"></span>' : ''}<button class="btn primary" data-act="supSalvar">Salvar</button>` });
    let dias = (v.dias || []).slice();
    A.on('supDia', (el) => { const i = Number(el.dataset.id); dias = dias.includes(i) ? dias.filter((x) => x !== i) : [...dias, i]; el.classList.toggle('on'); });
    A.on('supSalvar', () => { const d = A.formData(A.$('#pf')); if (!d.nome) { A.toast('Dê um nome.'); return; } const obj = s || { id: uid(), perfilId: A.perfil().id, catalogoId: v.catalogoId }; Object.assign(obj, { nome: d.nome, dose: d.dose, momento: d.momento, dias: dias.sort(), ativo: d.ativo, obs: d.obs }); if (!s) S().suplementos.push(obj); A.save(); A.closeModal(); A.render(); });
    A.on('supRm', () => { S().suplementos = S().suplementos.filter((x) => x.id !== s.id); A.save(); A.closeModal(); A.render(); });
  }
})();
