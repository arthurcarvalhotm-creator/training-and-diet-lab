/* =====================================================================
 * FitLab — Mais: menu, biblioteca (métodos, periodização, divisões),
 * backup, configurações, importação da planilha e sobre.
 * ===================================================================== */
(function () {
  'use strict';
  const A = window.App, DB = A.DB, E = A.E;
  const { h, n0, field, inp, num, sel, badge, empty, fmtData, hoje } = A;
  const S = () => A.S;

  A.route('mais', () => {
    A.setTitle('Mais');
    const st = S();
    const item = (href, ico, t, s) => `<a class="item" href="${href}"><div class="ico">${ico}</div><div><div class="t">${t}</div><div class="s">${s}</div></div><div class="right muted">›</div></a>`;
    return `<div class="section-title"><h2>Você</h2></div><div class="list">
      ${item('#/corpo', '📏', 'Corpo e avaliações', 'peso, medidas, % gordura, TMB, metas')}
      ${item('#/perfil', '👥', 'Perfis', `${st.perfis.length} perfil(is) — você e até 3 pessoas`)}</div>
      <div class="section-title"><h2>Biblioteca</h2></div><div class="list">
      ${item('#/biblioteca/exercicios', '🏋️', 'Exercícios e aparelhos', `${A.exMap().size} exercícios · ${DB.aparelhos.length} aparelhos`)}
      ${item('#/biblioteca/metodos', '⚡', 'Metodologias de treino', `${DB.metodos.length} técnicas: drop-set, rest-pause, FST-7, cluster, 5/3/1…`)}
      ${item('#/biblioteca/periodizacao', '📅', 'Periodização e divisões', `${Object.keys(DB.fases).length} fases · ${DB.modelosMacro.length} modelos de macrociclo · ${DB.divisoes.length} divisões`)}
      ${item('#/dieta/alimentos', '🥦', 'Alimentos', `${A.alMap().size} alimentos com medidas caseiras`)}
      ${item('#/dieta/suplementos', '💊', 'Suplementos', `${DB.suplementos.length} no catálogo`)}</div>
      <div class="section-title"><h2>Dados</h2></div><div class="list">
      ${item('#/sync', '☁', 'Sincronização entre aparelhos', window.FitSync && window.FitSync.ativo() ? 'ativa neste aparelho' : 'celular, tablet e notebook com os mesmos dados')}
      ${item('#/mais/backup', '💾', 'Backup e importação', 'exportar/importar JSON, histórico da planilha')}
      ${item('#/mais/config', '⚙️', 'Configurações', 'descanso, som, água, tema, versão do app')}
      ${item('#/mais/sobre', 'ℹ️', 'Sobre o FitLab', 'como funciona, fórmulas e referências')}</div>`;
  });

  /* ================= Métodos ================= */
  A.route('biblioteca/metodos', () => {
    A.setTitle('Metodologias');
    const cats = { base: 'Base', intensidade: 'Técnicas de intensidade', volume: 'Volume', densidade: 'Densidade (sem descanso)', forca: 'Força', tecnica: 'Técnica de execução', ordem: 'Ordem dos exercícios', periodizacao: 'Periodização', condicionamento: 'Condicionamento' };
    return `<h2>Metodologias e técnicas de treino</h2><p class="help">Aplique em cada exercício da ficha (campo "Método"). O gerador de programas usa as técnicas adequadas à fase.</p>
      ${Object.entries(cats).map(([c, nome]) => { const ms = DB.metodos.filter((m) => m.cat === c); return ms.length ? `<div class="section-title"><h3>${nome}</h3></div>` + ms.map((m) => `<details class="lib"><summary>${h(m.nome)} <span class="badge">${h(m.ex)}</span></summary><div class="body"><p>${h(m.desc)}</p><p><b>Como aplicar:</b> ${h(m.como)}</p></div></details>`).join('') : ''; }).join('')}`;
  });

  /* ================= Periodização ================= */
  A.route('biblioteca/periodizacao', () => {
    A.setTitle('Periodização');
    return `<h2>Periodização</h2>
      <div class="card"><h3>Macro, meso e microciclo</h3><p class="text-2"><b>Macrociclo</b>: o objetivo de longo prazo (12–20 semanas: bulking, cutting, força). <b>Mesociclo</b>: bloco de 3–6 semanas com uma fase e ênfase (adaptação, hipertrofia, força, metabólico, deload). <b>Microciclo</b>: a semana, com progressão de volume (séries), intensidade (carga / RIR) e descanso. O app aplica a prescrição da semana atual automaticamente ao iniciar o treino.</p><a class="btn primary sm" href="#/gerar-ciclo">📅 Planejar um ciclo</a></div>
      <div class="section-title"><h3>Fases de mesociclo</h3></div>
      ${Object.entries(DB.fases).map(([k, f]) => `<details class="lib"><summary>${h(f.nome)} <span class="badge">${f.reps[0]}–${f.reps[1]} reps · RIR ${f.rir}</span></summary><div class="body"><p>${h(f.desc)}</p><p>Séries por exercício ~${f.series} · descanso ~${f.descanso}s · ${f.intensidade[0]}–${f.intensidade[1]}% do 1RM.</p></div></details>`).join('')}
      <div class="section-title"><h3>Modelos de macrociclo</h3></div>
      ${DB.modelosMacro.map((m) => `<details class="lib"><summary>${h(m.nome)} <span class="badge">${m.mesos.reduce((t, x) => t + x[1], 0)} sem.</span></summary><div class="body"><div class="timeline">${m.mesos.flatMap(([f, n]) => Array.from({ length: n }, () => `<div class="wk ${f === 'deload' ? 'deload' : 'carga'}" title="${h(DB.fases[f].nome)}"></div>`)).join('')}</div><p>${m.mesos.map(([f, n]) => `${DB.fases[f].nome} (${n} sem.)`).join(' → ')}</p></div></details>`).join('')}
      <div class="section-title"><h3>Progressão semanal (microciclos)</h3></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Semana</th><th>Nome</th><th class="n">Volume</th><th class="n">RIR</th><th class="n">Carga</th></tr></thead><tbody>${DB.progressaoMicro.padrao.map((p) => `<tr><td>${p.semana}</td><td>${h(p.nome)}</td><td class="n">×${p.volume}</td><td class="n">${p.rir > 0 ? '+' : ''}${p.rir}</td><td class="n">${p.carga > 0 ? '+' : ''}${p.carga}%</td></tr>`).join('')}<tr><td>—</td><td>Deload</td><td class="n">×0,5</td><td class="n">4</td><td class="n">−15%</td></tr></tbody></table></div><p class="help">RIR relativo à fase; a última semana de um meso de 3+ semanas vira "Choque". Depois de um deload, recomece a progressão.</p></div>
      <div class="section-title"><h3>Divisões de treino</h3></div>
      ${DB.divisoes.map((d) => `<details class="lib"><summary>${h(d.nome)} <span class="badge">${d.freq[0]}–${d.freq[1]}× · nível ${d.nivel}${d.sexo === 'F' ? ' · ♀' : ''}</span></summary><div class="body">${d.fichas.map((f) => `<p><b>${f.letra}</b> — ${h(f.nome)}: <span class="muted">${f.grupos.map(A.grupoNome).join(', ')}</span></p>`).join('')}</div></details>`).join('')}`;
  });

  /* ================= Backup ================= */
  A.route('mais/backup', () => {
    A.setTitle('Backup');
    const st = S();
    const tam = Math.round(JSON.stringify(st).length / 1024);
    const exportar = () => JSON.stringify({ app: 'fitlab', versao: 1, exportadoEm: new Date().toISOString(), dados: st }, null, 1);
    A.on('bkBaixar', () => { const blob = new Blob([exportar()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fitlab-backup-${hoje()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); A.toast('Backup gerado'); });
    A.on('bkCopiar', () => { navigator.clipboard && navigator.clipboard.writeText(exportar()).then(() => A.toast('Copiado')); });
    A.on('bkCompartilhar', async () => { try { const file = new File([exportar()], `fitlab-backup-${hoje()}.json`, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Backup FitLab' }); else A.toast('Compartilhamento indisponível; use Baixar.'); } catch (e) { /* cancelado */ } });
    const importar = (txt, modo) => {
      let obj; try { obj = JSON.parse(txt); } catch (e) { A.toast('JSON inválido'); return; }
      const dados = obj.dados || obj; if (!dados.perfis) { A.toast('Arquivo não parece um backup do FitLab'); return; }
      if (modo === 'substituir') { A.S = Object.assign(A.vazio(), dados); }
      else {
        const cur = S(); const ids = new Set(cur.perfis.map((p) => p.id));
        dados.perfis.forEach((p) => { if (!ids.has(p.id)) cur.perfis.push(p); });
        ['avaliacoes', 'medidas', 'alimentosCustom', 'exerciciosCustom', 'dietas', 'diario', 'programas', 'ciclos', 'sessoes', 'aerobicos', 'suplementos', 'tomadas'].forEach((c) => { const have = new Set((cur[c] || []).map((x) => x.id)); (dados[c] || []).forEach((x) => { if (!have.has(x.id)) cur[c].push(x); }); });
      }
      if (!A.S.perfilAtivo || !A.S.perfis.some((p) => p.id === A.S.perfilAtivo)) A.S.perfilAtivo = (A.S.perfis[0] || {}).id || null;
      A.save(); A.applyTheme(); A.toast('Backup importado'); A.go('inicio');
    };
    A.on('bkArquivo', (el) => { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => A.confirmar('Como importar?', () => importar(r.result, 'mesclar'), { title: 'Importar backup', ok: 'Mesclar com os dados atuais' }); r.readAsText(f); el.value = ''; });
    A.on('bkArquivoSub', (el) => { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => A.confirmar('Substituir TODOS os dados atuais pelo backup? Não pode ser desfeito.', () => importar(r.result, 'substituir'), { danger: true, ok: 'Substituir' }); r.readAsText(f); el.value = ''; });
    A.on('bkTexto', () => { const t = A.$('#bkTxt').value.trim(); if (!t) return; A.confirmar('Mesclar os dados colados com os atuais?', () => importar(t, 'mesclar'), { ok: 'Mesclar' }); });
    A.on('bkPlanilha', () => { const n = A.importarHistorico(A.perfil().id); A.save(); A.toast(n ? `${n} itens importados` : 'Histórico já estava importado'); A.render(); });
    A.on('bkReset', () => A.confirmar('Apagar TODOS os dados do app neste aparelho? Faça um backup antes.', () => { localStorage.removeItem(A.KEY); location.hash = '#/inicio'; location.reload(); }, { danger: true, ok: 'Apagar tudo' }));
    return `<h2>Backup e importação</h2>
      <div class="card"><h3>Exportar</h3><p class="text-2">Os dados ficam neste aparelho (${tam} KB). Com a <a href="#/sync">sincronização</a> ativa, uma cópia criptografada vai para o seu GitHub. Exporte um backup de vez em quando.</p><div class="row"><button class="btn primary" data-act="bkBaixar">⬇️ Baixar JSON</button><button class="btn" data-act="bkCompartilhar">📤 Compartilhar</button><button class="btn ghost" data-act="bkCopiar">📋 Copiar</button></div></div>
      <div class="card mt"><h3>Importar</h3><p class="text-2">Mesclar adiciona o que não existe; substituir apaga tudo e restaura o arquivo.</p>
        <div class="row"><label class="btn">📂 Mesclar arquivo<input type="file" accept="application/json,.json" hidden data-act="bkArquivo" data-on="change"></label><label class="btn danger">📂 Substituir tudo<input type="file" accept="application/json,.json" hidden data-act="bkArquivoSub" data-on="change"></label></div>
        <div class="mt">${field('Ou cole o JSON', '<textarea id="bkTxt" placeholder="{ \"app\": \"fitlab\", ... }"></textarea>')}<button class="btn sm" data-act="bkTexto">Importar texto</button></div></div>
      <div class="card mt"><h3>Histórico da planilha</h3><p class="text-2">Importa para o perfil ativo (<b>${h(A.perfil().nome)}</b>) as ${window.FIT_HISTORICO ? window.FIT_HISTORICO.dietas.length : 0} dietas e ${window.FIT_HISTORICO ? window.FIT_HISTORICO.programas.length : 0} programas de treino documentados na planilha de consultoria, além da avaliação de jan/2024 e dos programas criados depois dela${window.FIT_HISTORICO && window.FIT_HISTORICO.programasFixos ? ' (' + window.FIT_HISTORICO.programasFixos.map((p) => h(p.nome)).join(', ') + ')' : ''}. Itens já importados não são duplicados.</p><button class="btn" data-act="bkPlanilha">📊 Importar histórico da planilha</button></div>
      <div class="card mt danger"><h3>Zona de perigo</h3><button class="btn danger" data-act="bkReset">🗑️ Apagar todos os dados</button></div>`;
  });

  /* ================= Configurações ================= */
  A.route('mais/config', () => {
    A.setTitle('Configurações');
    const c = S().config;
    A.on('cfgSalvar', () => { const d = A.formData(A.$('#cfg')); Object.assign(c, { tema: d.tema, descansoPadrao: d.descansoPadrao || 90, somTimer: !!d.somTimer, aguaCopo: d.aguaCopo || 250 }); A.save(); A.applyTheme(); A.toast('Salvo'); });
    A.on('cfgDia', (el) => { const i = Number(el.dataset.id); c.diasTreino = c.diasTreino.includes(i) ? c.diasTreino.filter((x) => x !== i) : [...c.diasTreino, i].sort(); A.save(); el.classList.toggle('on'); });
    A.on('cfgNotif', () => { try { Notification.requestPermission().then(() => A.render()); } catch (e) { /* */ } });
    A.on('cfgAtualizar', () => { A.toast('Atualizando…'); A.forcarAtualizacao(); });
    A.on('__after', () => { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('versao'); });
    A.on('cfgTeste', () => { A.toast('Teste de som e vibração'); try { if (navigator.vibrate) navigator.vibrate(200); const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2; o.start(); o.stop(ctx.currentTime + 0.25); } catch (e) { /* */ } });
    return `<h2>Configurações</h2><div class="card" id="cfg"><div class="form-grid">${field('Tema', sel('tema', [['auto', 'Automático (sistema)'], ['light', 'Claro'], ['dark', 'Escuro']], c.tema))}${field('Descanso padrão (s)', num('descansoPadrao', c.descansoPadrao, 'step="5"'))}${field('Copo de água (ml)', num('aguaCopo', c.aguaCopo, 'step="50"'))}</div><label class="check"><input type="checkbox" name="somTimer" ${c.somTimer ? 'checked' : ''}> Som ao terminar o descanso</label><div class="lbl mt">Dias que costuma treinar</div>${A.chips(A.DIAS.map((d, i) => ({ id: i, nome: d, on: c.diasTreino.includes(i) })), null, 'cfgDia')}<div class="row mt"><button class="btn primary" data-act="cfgSalvar">Salvar</button><button class="btn ghost" data-act="cfgTeste">🔔 Testar som</button></div></div>
      <div class="card mt"><h3>Cronômetro em segundo plano</h3><p class="text-2">Com as notificações ativas, ao sair do app no meio do descanso a contagem aparece na barra de notificações e um alerta com som e vibração avisa quando o tempo acaba.</p><p>Status: <b>${!window.Notification ? 'não suportado neste navegador' : Notification.permission === 'granted' ? '✅ ativas' : Notification.permission === 'denied' ? '🚫 bloqueadas — libere em Configurações do celular → Apps → FitLab (ou Chrome) → Notificações' : 'ainda não ativadas'}</b></p>${window.Notification && Notification.permission === 'default' ? '<button class="btn" data-act="cfgNotif">🔔 Ativar notificações</button>' : ''}</div>
      <div class="card mt"><h3>Versão do app</h3><p class="text-2">Versão instalada: <b id="swVersao">${A.swVersao || (navigator.serviceWorker && navigator.serviceWorker.controller ? 'verificando…' : 'sem cache offline')}</b>. O app se atualiza sozinho quando abre com internet. Se alguma novidade não aparecer, force a atualização: seus dados não são apagados.</p><button class="btn" data-act="cfgAtualizar">🔄 Forçar atualização</button></div>
      <div class="card mt"><h3>Instalar como app</h3><p class="text-2">No Android (Chrome): menu ⋮ → <b>Instalar aplicativo</b>. No iPhone (Safari): Compartilhar → <b>Adicionar à Tela de Início</b>. Depois funciona offline.</p></div>`;
  });

  /* ================= Sobre ================= */
  A.route('mais/sobre', () => {
    A.setTitle('Sobre');
    return `<h2>Sobre o FitLab</h2>
      <div class="card"><p>Substituto completo da planilha de consultoria: avaliação física, planejamento calórico, planos alimentares, programas de treino com metodologias, periodização (macro/meso/micro) e registro diário. Tudo roda no navegador, sem servidor; os dados ficam no aparelho, com sincronização opcional e criptografada entre aparelhos, e podem ser exportados em JSON.</p></div>
      <div class="card mt"><h3>Fórmulas</h3><ul class="text-2"><li><b>% gordura</b>: Marinha dos EUA (US Navy). Homens: 86,010·log₁₀(cintura − pescoço) − 70,041·log₁₀(altura) + 36,76. Mulheres: 163,205·log₁₀(cintura + quadril − pescoço) − 97,684·log₁₀(altura) − 78,387. Sem medidas: Deurenberg (IMC e idade). <i>A planilha original usava o peso no lugar da altura na fórmula masculina, o que subestimava o valor.</i></li><li><b>TMB</b>: Mifflin-St Jeor (padrão), Harris-Benedict revisada e Katch-McArdle (massa magra).</li><li><b>GET</b>: TMB × fator de atividade (1,2 a 1,9).</li><li><b>Meta calórica</b>: como na planilha, +10 % (bulking) ou −15 % (cutting) sobre a dieta anterior ou sobre o GET; ajuste editável.</li><li><b>Macros</b>: percentuais da planilha (bulking 60/16/24, cutting 35/27/38) ou por g/kg. Calorias dos alimentos = 4·C + 9·G + 4·P.</li><li><b>1RM</b>: Epley (carga × (1 + reps/30)).</li><li><b>Aeróbico</b>: kcal = MET × 3,5 × peso / 200 × minutos. FC máx = 208 − 0,7 × idade (Tanaka).</li><li><b>Volume</b>: marcos MEV/MAV/MRV por grupo (séries semanais) como referência de literatura de hipertrofia.</li></ul></div>
      <div class="card mt"><h3>Referências dos alimentos</h3><p class="text-2">Tabela TACO (UNICAMP, 4ª ed.), rótulos de produtos comuns e USDA para itens ausentes. Valores por 100 g são aproximações; ajuste pelo rótulo do produto que você usa criando um alimento personalizado.</p></div>
      <div class="card mt"><p class="tiny muted">Este app não substitui acompanhamento profissional. Use as prescrições como ponto de partida e ajuste pela sua resposta.</p></div>`;
  });
})();
