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
      ${item('#/perfil', '👥', 'Perfis', `${st.perfis.length} perfil(is) cadastrado(s)`)}</div>
      <div class="section-title"><h2>Biblioteca</h2></div><div class="list">
      ${item('#/biblioteca/exercicios', '🏋️', 'Exercícios e aparelhos', `${A.exMap().size} exercícios · ${DB.aparelhos.length} aparelhos`)}
      ${item('#/biblioteca/metodos', '⚡', 'Metodologias de treino', `${DB.metodos.length} técnicas: drop-set, rest-pause, FST-7, cluster, 5/3/1…`)}
      ${item('#/biblioteca/periodizacao', '📅', 'Periodização e divisões', `${Object.keys(DB.fases).length} fases · ${DB.modelosMacro.length} modelos de macrociclo · ${DB.divisoes.length} divisões`)}
      ${item('#/dieta/alimentos', '🥦', 'Alimentos', `${A.alMap().size} alimentos com medidas caseiras`)}
      ${item('#/dieta/suplementos', '💊', 'Suplementos', `${DB.suplementos.length} no catálogo`)}</div>
      <div class="section-title"><h2>Dados e Privacidade</h2></div><div class="list">
      ${item('#/sync', '☁', 'Conta e sincronização em nuvem', window.FitSync && window.FitSync.contaAtiva && window.FitSync.contaAtiva() ? 'conectado (' + (window.FitSync.contaAtiva().email || window.FitSync.contaAtiva().provedor) + ')' : window.FitSync && window.FitSync.ativo() ? 'ativa neste aparelho (Gist)' : 'login Google/Apple ou GitHub Gist criptografado')}
      ${item('#/mais/backup', '💾', 'Backup e importação', 'exportar/importar JSON, modelos de referência')}
      ${item('#/lgpd', '🛡️', 'Privacidade e LGPD', A.temConsentimentoLgpd && A.temConsentimentoLgpd() ? 'consentimento ativo · portabilidade e exclusão' : 'termo de consentimento, portabilidade e exclusão de dados')}
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
    const exportar = () => JSON.stringify({ app: 'fitlab', versao: 1, schemaVersion: A.SCHEMA_VERSION || 2, exportadoEm: new Date().toISOString(), dados: st }, null, 1);
    A.on('bkBaixar', () => { const blob = new Blob([exportar()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fitlab-backup-${hoje()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); A.toast('Backup gerado'); });
    A.on('bkCopiar', () => { navigator.clipboard && navigator.clipboard.writeText(exportar()).then(() => A.toast('Copiado')); });
    A.on('bkCompartilhar', async () => { try { const file = new File([exportar()], `fitlab-backup-${hoje()}.json`, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Backup FitLab' }); else A.toast('Compartilhamento indisponível; use Baixar.'); } catch (e) { /* cancelado */ } });
    const COLS = ['avaliacoes', 'medidas', 'alimentosCustom', 'exerciciosCustom', 'dietas', 'diario', 'programas', 'ciclos', 'sessoes', 'aerobicos', 'suplementos', 'tomadas'];
    const sanitizarLista = (arr) => Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string' && x.id.trim()) : [];
    const sanitizarConfig = (cfg) => {
      const def = A.vazio().config;
      if (!cfg || typeof cfg !== 'object') return def;
      const mod = Number(cfg.updatedAt || cfg._mod) || 0;
      return {
        tema: ['auto', 'light', 'dark'].includes(cfg.tema) ? cfg.tema : def.tema,
        descansoPadrao: Number(cfg.descansoPadrao) > 0 ? Number(cfg.descansoPadrao) : def.descansoPadrao,
        escala: typeof cfg.escala === 'string' ? cfg.escala : def.escala,
        diasTreino: Array.isArray(cfg.diasTreino) ? cfg.diasTreino.map(Number).filter((n) => n >= 0 && n <= 6) : def.diasTreino,
        somTimer: typeof cfg.somTimer === 'boolean' ? cfg.somTimer : def.somTimer,
        aguaCopo: Number(cfg.aguaCopo) > 0 ? Number(cfg.aguaCopo) : def.aguaCopo,
        contaUid: typeof cfg.contaUid === 'string' && cfg.contaUid ? cfg.contaUid : def.contaUid,
        lgpd: cfg.lgpd && typeof cfg.lgpd === 'object' ? cfg.lgpd : def.lgpd,
        ...(mod ? { _mod: mod, updatedAt: mod } : {})
      };
    };
    const importar = (txt, modo) => {
      let obj; try { obj = JSON.parse(txt); } catch (e) { A.toast('JSON inválido'); return; }
      const dados = obj && typeof obj === 'object' ? (obj.dados || obj) : null;
      const perfisVal = dados ? sanitizarLista(dados.perfis).filter((p) => typeof p.nome === 'string' && p.nome.trim()) : [];
      if (!perfisVal.length) { A.toast('Arquivo não parece um backup válido do FitLab'); return; }
      if (modo === 'substituir') {
        const novo = A.vazio();
        novo.perfis = perfisVal;
        COLS.forEach((c) => { novo[c] = sanitizarLista(dados[c]); });
        novo.config = sanitizarConfig(dados.config);
        novo.perfilAtivo = typeof dados.perfilAtivo === 'string' ? dados.perfilAtivo : null;
        A.S = novo;
        if (window.FitSync && window.FitSync.limparBase) window.FitSync.limparBase();
      } else {
        const cur = S(); const ids = new Set(cur.perfis.map((p) => p.id));
        perfisVal.forEach((p) => { if (!ids.has(p.id)) cur.perfis.push(p); });
        COLS.forEach((c) => { const have = new Set((cur[c] || []).map((x) => x.id)); sanitizarLista(dados[c]).forEach((x) => { if (!have.has(x.id)) cur[c].push(x); }); });
        cur.config = sanitizarConfig(cur.config);
      }
      if (!A.S.perfilAtivo || !A.S.perfis.some((p) => p.id === A.S.perfilAtivo)) A.S.perfilAtivo = (A.S.perfis[0] || {}).id || null;
      A.save(); A.applyTheme(); A.toast('Backup importado'); A.go('inicio');
    };
    if (!window.FIT_HISTORICO) A.carregarHistorico().then((H) => { if (H && location.hash === '#/mais/backup') A.render(); });
    A.on('bkArquivo', (el) => { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => A.confirmar('Como importar?', () => importar(r.result, 'mesclar'), { title: 'Importar backup', ok: 'Mesclar com os dados atuais' }); r.readAsText(f); el.value = ''; });
    A.on('bkArquivoSub', (el) => { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => A.confirmar('Substituir TODOS os dados atuais pelo backup? Não pode ser desfeito.', () => importar(r.result, 'substituir'), { danger: true, ok: 'Substituir' }); r.readAsText(f); el.value = ''; });
    A.on('bkTexto', () => { const t = A.$('#bkTxt').value.trim(); if (!t) return; A.confirmar('Mesclar os dados colados com os atuais?', () => importar(t, 'mesclar'), { ok: 'Mesclar' }); });
    A.on('bkPlanilha', async () => { await A.carregarHistorico(); const n = A.importarHistorico(A.perfil().id); A.save(); A.toast(n ? `${n} itens importados` : 'Histórico já estava importado'); A.render(); });
    const syncAtivo = window.FitSync && window.FitSync.ativo();
    A.on('bkReset', () => A.confirmar('Apagar TODOS os dados do app neste aparelho? A sincronização será desconectada antes para preservar a nuvem e os outros aparelhos.', async () => { if (window.FitSync && window.FitSync.desativarLocal) await window.FitSync.desativarLocal(); if (A.limparBanco) await A.limparBanco(); else localStorage.removeItem(A.KEY); location.hash = '#/inicio'; location.reload(); }, { danger: true, ok: 'Apagar neste aparelho' }));
    A.on('bkResetNuvem', () => A.confirmar('Apagar TODOS os dados neste aparelho E TAMBÉM excluir seus dados sincronizados na nuvem? Esta ação não pode ser desfeita. Faça um backup antes.', async () => { if (window.FitSync && window.FitSync.excluirContaNuvem) await window.FitSync.excluirContaNuvem(); if (A.limparBanco) await A.limparBanco(); else localStorage.removeItem(A.KEY); location.hash = '#/inicio'; location.reload(); }, { danger: true, ok: 'Apagar aparelho e nuvem' }));
    return `<h2>Backup e importação</h2>
      <div class="card"><h3>Exportar</h3><p class="text-2">Os dados ficam neste aparelho (${tam} KB). Com a <a href="#/sync">sincronização</a> ativa, uma cópia criptografada vai para o seu GitHub. Exporte um backup de vez em quando.</p><div class="row"><button class="btn primary" data-act="bkBaixar">⬇️ Baixar JSON</button><button class="btn" data-act="bkCompartilhar">📤 Compartilhar</button><button class="btn ghost" data-act="bkCopiar">📋 Copiar</button></div></div>
      <div class="card mt"><h3>Importar</h3><p class="text-2">Mesclar adiciona o que não existe; substituir apaga tudo e restaura o arquivo.</p>
        <div class="row"><label class="btn">📂 Mesclar arquivo<input type="file" accept="application/json,.json" hidden data-act="bkArquivo" data-on="change"></label><label class="btn danger">📂 Substituir tudo<input type="file" accept="application/json,.json" hidden data-act="bkArquivoSub" data-on="change"></label></div>
        <div class="mt">${field('Ou cole o JSON', '<textarea id="bkTxt" placeholder="{ \"app\": \"fitlab\", ... }"></textarea>')}<button class="btn sm" data-act="bkTexto">Importar texto</button></div></div>
      <div class="card mt"><h3>Modelos de dietas e treinos</h3><p class="text-2">Importa para o perfil ativo (<b>${h(A.perfil().nome)}</b>) os modelos de dietas${window.FIT_HISTORICO ? ' (' + window.FIT_HISTORICO.dietas.length + ')' : ''} e programas de treino${window.FIT_HISTORICO ? ' (' + (window.FIT_HISTORICO.programas.length + (window.FIT_HISTORICO.programasFixos ? window.FIT_HISTORICO.programasFixos.length : 0)) + ')' : ''} de referência. Itens já importados não são duplicados.</p><button class="btn" data-act="bkPlanilha">📊 Importar modelos</button></div>
      <div class="card mt danger"><h3>Zona de perigo</h3><p class="text-2">Apagar os dados locais desconecta a sincronização antes para não apagar sua nuvem nem outros aparelhos.</p><div class="row"><button class="btn danger" data-act="bkReset">🗑️ Apagar dados deste aparelho</button>${syncAtivo ? '<button class="btn ghost danger" data-act="bkResetNuvem">☁️ Apagar aparelho e nuvem</button>' : ''}</div></div>`;
  });

  /* ================= Configurações ================= */
  A.route('mais/config', () => {
    A.setTitle('Configurações');
    const c = S().config;
    A.on('cfgSalvar', () => { const d = A.formData(A.$('#cfg')); Object.assign(c, { tema: d.tema, descansoPadrao: d.descansoPadrao || 90, somTimer: !!d.somTimer, aguaCopo: d.aguaCopo || 250 }); A.save(); A.applyTheme(); A.toast('Salvo'); });
    A.on('cfgDia', (el) => { const i = Number(el.dataset.id); c.diasTreino = c.diasTreino.includes(i) ? c.diasTreino.filter((x) => x !== i) : [...c.diasTreino, i].sort(); A.save(); el.classList.toggle('on'); });
    A.on('cfgAtualizar', () => { A.toast('Atualizando…'); A.forcarAtualizacao(); });
    A.on('__after', () => { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('versao'); });
    A.on('cfgTeste', () => { A.toast('Teste de som e vibração'); try { if (navigator.vibrate) navigator.vibrate(200); const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2; o.start(); o.stop(ctx.currentTime + 0.25); } catch (e) { /* */ } });
    return `<h2>Configurações</h2><div class="card" id="cfg"><div class="form-grid">${field('Tema', sel('tema', [['auto', 'Automático (sistema)'], ['light', 'Claro'], ['dark', 'Escuro']], c.tema))}${field('Descanso padrão (s)', num('descansoPadrao', c.descansoPadrao, 'step="5"'))}${field('Copo de água (ml)', num('aguaCopo', c.aguaCopo, 'step="50"'))}</div><label class="check"><input type="checkbox" name="somTimer" ${c.somTimer ? 'checked' : ''}> Som ao terminar o descanso</label><div class="lbl mt">Dias que costuma treinar</div>${A.chips(A.DIAS.map((d, i) => ({ id: i, nome: d, on: c.diasTreino.includes(i) })), null, 'cfgDia')}<div class="row mt"><button class="btn primary" data-act="cfgSalvar">Salvar</button><button class="btn ghost" data-act="cfgTeste">🔔 Testar som</button></div></div>
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

  /* ================= Privacidade e LGPD (Lei nº 13.709/2018) ================= */
  A.route('lgpd', () => {
    A.setTitle('Privacidade e LGPD');
    const st = S();
    const semPerfil = !A.perfil();
    const lgpd = (st.config && st.config.lgpd) || null;
    const consentiu = !!(lgpd && lgpd.consentimento);
    const conta = window.FitSync && window.FitSync.contaAtiva ? window.FitSync.contaAtiva() : null;
    const syncAtivo = window.FitSync && window.FitSync.ativo && window.FitSync.ativo();
    const uidAtual = (conta && conta.uid) || (st.config && st.config.contaUid) || null;

    const exportarPortabilidade = () => JSON.stringify({
      app: 'fitlab',
      tipo: 'portabilidade_lgpd_art18',
      versao: 1,
      schemaVersion: A.SCHEMA_VERSION || 2,
      exportadoEm: new Date().toISOString(),
      titular: {
        contaUid: uidAtual,
        email: (conta && conta.email) || null,
        provedor: (conta && conta.provedor) || null,
        consentimentoLgpd: lgpd
      },
      dados: st
    }, null, 2);

    A.on('lgpdAceitar', () => {
      if (A.registrarConsentimentoLgpd) A.registrarConsentimentoLgpd(syncAtivo ? 'local_e_nuvem' : 'local');
      A.save();
      A.toast('Consentimento LGPD registrado');
      A.render();
    });

    A.on('lgpdRevogar', () => A.confirmar(
      'Revogar o consentimento de tratamento de dados na nuvem? A sincronização será desconectada neste aparelho. Para remover também os dados locais ou da nuvem, use os botões de exclusão abaixo.',
      async () => {
        if (window.FitSync && window.FitSync.desativarLocal) await window.FitSync.desativarLocal();
        if (st.config) {
          st.config.lgpd = {
            consentimento: false,
            versaoTermo: A.VERSAO_TERMO_LGPD || '2026-10-24',
            revogadoEm: new Date().toISOString()
          };
        }
        A.save();
        A.toast('Consentimento revogado e sincronização desconectada');
        A.render();
      },
      { danger: true, title: 'Revogar consentimento (LGPD, Art. 18, IX)', ok: 'Revogar consentimento' }
    ));

    A.on('lgpdExportar', () => {
      const blob = new Blob([exportarPortabilidade()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fitlab-portabilidade-lgpd-${hoje()}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      A.toast('Arquivo de portabilidade LGPD gerado');
    });

    A.on('lgpdApagarLocal', () => A.confirmar(
      'Apagar definitivamente todos os dados armazenados neste aparelho (IndexedDB, cofre de chaves e armazenamento local)?',
      async () => {
        if (window.FitSync && window.FitSync.desativarLocal) await window.FitSync.desativarLocal();
        if (A.limparBanco) await A.limparBanco();
        else localStorage.removeItem(A.KEY);
        location.hash = '#/inicio';
        location.reload();
      },
      { danger: true, title: 'Apagar dados deste aparelho', ok: 'Apagar dados locais' }
    ));

    A.on('lgpdExcluirTudo', () => A.confirmar(
      'Excluir permanentemente sua conta conectada, todos os registros na nuvem (Firestore / Gist) e todos os dados deste aparelho (Direito ao Esquecimento — LGPD, Art. 18, VI)? Esta ação é irreversível.',
      async () => {
        A.toast('Excluindo dados na nuvem e neste aparelho…');
        if (window.FitSync && window.FitSync.excluirContaNuvem) await window.FitSync.excluirContaNuvem();
        if (A.limparBanco) await A.limparBanco();
        else localStorage.removeItem(A.KEY);
        location.hash = '#/inicio';
        location.reload();
      },
      { danger: true, title: 'Direito ao Esquecimento (LGPD)', ok: 'Excluir tudo permanentemente' }
    ));

    return `${semPerfil ? '<div class="row mb"><a class="btn sm ghost" href="#/inicio">‹ Voltar ao início</a></div>' : ''}
      <h2>🛡️ Privacidade e Proteção de Dados (LGPD)</h2>
      <div class="card accent">
        <div class="row between">
          <h3>Status do Consentimento</h3>
          ${consentiu ? badge('Consentimento ativo', 'ok') : badge('Pendente / Revogado', 'warn')}
        </div>
        <p class="text-2">
          ${consentiu
            ? `Aceito em <b>${h(new Date(lgpd.aceitoEm).toLocaleString('pt-BR'))}</b> · Versão do termo: <code>${h(lgpd.versaoTermo || '2026-10-24')}</code> · Escopo: <code>${h(lgpd.escopo || 'local')}</code>.`
            : 'Você ainda não registrou ou revogou o consentimento para tratamento dos dados de saúde.'}
        </p>
        ${uidAtual ? `<p class="tiny muted">Identificador único da conta (<code>contaUid</code>): <code>${h(uidAtual)}</code></p>` : '<p class="tiny muted">Modo 100% local (nenhuma conta em nuvem vinculada).</p>'}
        <div class="row mt">
          ${!consentiu ? '<button class="btn primary" data-act="lgpdAceitar">✓ Concordar e registrar consentimento</button>' : '<button class="btn ghost danger sm" data-act="lgpdRevogar">Revogar consentimento (Art. 18, IX)</button>'}
        </div>
      </div>

      <div class="card mt">
        <h3>1. Dados coletados e finalidade (Art. 11, I — LGPD)</h3>
        <p class="text-2">Para calcular sua taxa metabólica basal (TMB), percentual de gordura, metas de macronutrientes e progressão de cargas, o FitLab processa dados pessoais e <b>dados pessoais sensíveis relativos à saúde</b> (Lei nº 13.709/2018, Art. 5º, II e Art. 11):</p>
        <ul class="text-2">
          <li><b>Perfil e antropometria</b>: nome/apelido, sexo biológico, data de nascimento, altura, peso corporal, circunferências corporais, percentual de gordura e frequência cardíaca de repouso.</li>
          <li><b>Nutrição e suplementação</b>: planos alimentares, consumo diário de calorias/macronutrientes/água e registro de suplementos.</li>
          <li><b>Treinamento físico</b>: programas, cargas, repetições, RIR/RPE, ciclos de periodização e sessões de aeróbico.</li>
        </ul>
      </div>

      <div class="card mt">
        <h3>2. Armazenamento, segurança e isolamento por conta</h3>
        <ul class="text-2">
          <li><b>No aparelho (Offline-first)</b>: os dados ficam gravados localmente no banco <code>IndexedDB</code> (<code>fitlab.db</code>) do seu navegador. Nenhum dado é enviado a servidores de terceiros, redes de anúncios ou rastreadores (<i>analytics</i>).</li>
          <li><b>Sincronização opcional em nuvem</b>: se você ativar a sincronização em <a href="#/sync">Conta e Sincronização</a>, seus dados são vinculados exclusivamente ao identificador único da sua conta (<code>uid</code> no Cloud Firestore, protegido por regras de segurança por usuário) ou criptografados de ponta a ponta (AES-GCM 256 com PBKDF2-SHA256) no seu GitHub Gist.</li>
          <li><b>Chaves de acesso</b>: tokens e chaves criptográficas são protegidos no cofre do navegador (<code>CryptoKey</code> não-extraível no <code>IndexedDB</code>), nunca em texto puro no <code>localStorage</code>.</li>
        </ul>
      </div>

      <div class="card mt">
        <h3>3. Seus direitos como titular (Art. 18 da LGPD)</h3>
        <p class="text-2">Você pode, a qualquer momento e de forma imediata, exportar uma cópia integral estruturada de todos os seus dados (<b>Portabilidade — Art. 18, II e V</b>) ou eliminar definitivamente todos os seus registros locais e na nuvem (<b>Direito ao Esquecimento / Eliminação — Art. 18, IV e VI</b>):</p>
        <div class="row mt">
          <button class="btn primary" data-act="lgpdExportar">⬇️ Exportar meus dados (Portabilidade JSON)</button>
          <button class="btn danger" data-act="lgpdApagarLocal">🗑️ Excluir dados deste aparelho</button>
          <button class="btn danger" data-act="lgpdExcluirTudo">🔥 Excluir conta e apagar tudo (Aparelho + Nuvem)</button>
        </div>
      </div>`;
  });
})();
