/* =====================================================================
 * FitLab — Exportar fichas, programas e dietas como imagem (PNG/JPEG)
 * Desenha direto num <canvas> (sem bibliotecas, funciona offline), em
 * 1080 px de largura, bom para WhatsApp, galeria e impressão. Sempre no
 * tema claro para ficar legível em qualquer lugar.
 * ===================================================================== */
(function () {
  'use strict';
  const A = window.App, DB = A.DB, E = A.E;
  const W = 1080, PAD = 48;
  const C = {
    bg: '#f4f6f3', card: '#ffffff', text: '#1c2420', text2: '#4f5d55', muted: '#7d8a82', border: '#d9e0d6', zebra: '#f7f9f6',
    accent: '#1f7a5c', treino: '#2f6fb3', treinoSoft: '#e3edf9', dieta: '#c7701f', dietaSoft: '#fbeedc',
    carb: '#d9822b', gord: '#b8921a', prot: '#2f6fb3', fib: '#5e8f30', kcal: '#1f7a5c'
  };
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const f = (size, weight, italic) => `${italic ? 'italic ' : ''}${weight || 400} ${size}px ${FONT}`;
  const n0 = A.n0, n1 = A.n1;

  /* ---------- primitivas de desenho ---------- */
  function linhas(ctx, texto, maxW) {
    const out = [];
    String(texto == null ? '' : texto).split('\n').forEach((par) => {
      let atual = '';
      par.split(/\s+/).filter(Boolean).forEach((pal) => {
        const tenta = atual ? atual + ' ' + pal : pal;
        if (ctx.measureText(tenta).width <= maxW) { atual = tenta; return; }
        if (atual) out.push(atual);
        // palavra maior que a coluna: quebra por caracteres
        let pedaco = '';
        for (const ch of pal) { if (ctx.measureText(pedaco + ch).width > maxW && pedaco) { out.push(pedaco); pedaco = ch; } else pedaco += ch; }
        atual = pedaco;
      });
      out.push(atual);
    });
    return out;
  }
  /* Escreve (com quebra de linha) e devolve a altura usada */
  function txt(ctx, texto, x, y, o) {
    o = o || {};
    const size = o.size || 24, lh = o.lh || Math.round(size * 1.3);
    ctx.font = f(size, o.weight, o.italic);
    const ls = o.maxW ? linhas(ctx, texto, o.maxW) : [String(texto == null ? '' : texto)];
    if (ctx.pinta) {
      ctx.fillStyle = o.color || C.text; ctx.textBaseline = 'top'; ctx.textAlign = o.align || 'left';
      ls.forEach((l, i) => ctx.fillText(l, x, y + i * lh + Math.round((lh - size) / 2)));
      ctx.textAlign = 'left';
    }
    return ls.length * lh;
  }
  function caixa(ctx, x, y, w, h, r, cor, borda) {
    if (!ctx.pinta) return;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    if (cor) { ctx.fillStyle = cor; ctx.fill(); }
    if (borda) { ctx.strokeStyle = borda; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function linhaH(ctx, x1, x2, y, cor) { if (!ctx.pinta) return; ctx.strokeStyle = cor || C.border; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }
  /* Selo arredondado; devolve { w, h } */
  function selo(ctx, texto, x, y, cor, fundo, maxW) {
    ctx.font = f(20, 700);
    const ls = linhas(ctx, texto, (maxW || 600) - 28);
    const w = Math.min(maxW || 600, Math.max(...ls.map((l) => ctx.measureText(l).width)) + 28), h = ls.length * 26 + 10;
    caixa(ctx, x, y, w, h, 16, fundo);
    txt(ctx, ls.join('\n'), x + 14, y + 5, { size: 20, weight: 700, color: cor, lh: 26 });
    return { w, h };
  }
  function cabecalho(ctx, y, rotulo, cor, titulo, sub) {
    txt(ctx, 'FITLAB · ' + rotulo.toUpperCase(), PAD, y, { size: 20, weight: 700, color: cor });
    y += 34;
    y += txt(ctx, titulo, PAD, y, { size: 46, weight: 800, maxW: W - PAD * 2, lh: 54 });
    y += 6;
    if (sub) y += txt(ctx, sub, PAD, y, { size: 24, color: C.text2, maxW: W - PAD * 2 });
    return y + 24;
  }
  function rodape(ctx, y) {
    const d = new Date();
    linhaH(ctx, PAD, W - PAD, y, C.border);
    txt(ctx, `Gerado pelo FitLab em ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, W / 2, y + 18, { size: 20, color: C.muted, align: 'center' });
    return y + 60;
  }
  /* Executa um trecho só medindo (sem pintar) e devolve o que ele retornar */
  function medir(ctx, fn) { const p = ctx.pinta; ctx.pinta = false; try { return fn(ctx); } finally { ctx.pinta = p; } }
  /* Mede com uma passada "fantasma" e depois pinta num canvas do tamanho exato */
  function renderizar(desenhar, fundo) {
    const medir = document.createElement('canvas').getContext('2d'); medir.pinta = false;
    const altura = Math.ceil(desenhar(medir));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Math.min(altura, 30000);
    const ctx = cv.getContext('2d'); ctx.pinta = true;
    ctx.fillStyle = fundo || C.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    desenhar(ctx);
    return cv;
  }

  /* ---------- treino ---------- */
  const COL = { n: PAD + 24, ex: PAD + 70, presc: 640, desc: 850, rir: 960, fim: W - PAD - 24 };
  function fichaBloco(ctx, y, ficha, exMap) {
    const x0 = PAD, w = W - PAD * 2;
    const series = ficha.exercicios.reduce((t, e) => t + (Number(e.series) || 0), 0);
    const corpo = (c, yy) => {
      // faixa do título
      const cab = (cc) => {
        caixa(cc, x0 + 24, yy + 18, 60, 60, 14, C.treino);
        txt(cc, ficha.letra, x0 + 54, yy + 26, { size: 34, weight: 800, color: '#fff', align: 'center' });
        const hNome = txt(cc, ficha.nome || 'Ficha ' + ficha.letra, x0 + 104, yy + 14, { size: 30, weight: 800, maxW: w - 130, lh: 36 });
        txt(cc, `${ficha.exercicios.length} exercícios · ${series} séries`, x0 + 104, yy + 14 + hNome + 2, { size: 20, color: C.text2 });
        return Math.max(96, hNome + 58);
      };
      const hCab = medir(c, cab);
      caixa(c, x0, yy, w, hCab, [18, 18, 0, 0], C.treinoSoft);
      cab(c);
      yy += hCab;
      // cabeçalho das colunas
      yy += 14;
      [['#', COL.n], ['EXERCÍCIO', COL.ex], ['SÉRIES × REPS', COL.presc], ['DESCANSO', COL.desc], ['RIR', COL.rir]].forEach(([t, x]) => txt(c, t, x, yy, { size: 17, weight: 700, color: C.muted }));
      yy += 34;
      linhaH(c, x0 + 16, x0 + w - 16, yy, C.border);
      ficha.exercicios.forEach((e, i) => {
        const ex = exMap.get(e.exercicioId) || { nome: e.exercicioId, grupo: '', aparelho: '' };
        const m = A.metodo(e.metodoId);
        const linha = (cc, y1) => {
          let yl = y1 + 16;
          const yTop = yl;
          yl += txt(cc, ex.nome, COL.ex, yl, { size: 26, weight: 700, maxW: COL.presc - COL.ex - 20, lh: 32 });
          yl += txt(cc, [A.grupoNome(ex.grupo), A.aparelhoNome(ex.aparelho)].filter(Boolean).join(' · '), COL.ex, yl + 2, { size: 19, color: C.text2, maxW: COL.presc - COL.ex - 20 }) + 4;
          if (e.metodoId && e.metodoId !== 'normal') { yl += 6; yl += selo(cc, m.nome, COL.ex, yl, C.treino, C.treinoSoft, COL.presc - COL.ex - 20).h; }
          if (e.obs) { yl += 6; yl += txt(cc, e.obs, COL.ex, yl, { size: 19, italic: true, color: C.text2, maxW: COL.fim - COL.ex }); }
          const reps = E.parseReps(e.reps, e.series);
          const presc = `${e.series} × ${reps.texto || e.reps || '—'}`;
          const hPresc = txt(cc, presc, COL.presc, yTop, { size: 26, weight: 800, maxW: COL.desc - COL.presc - 16, lh: 32 });
          txt(cc, i + 1, COL.n, yTop, { size: 24, weight: 800, color: C.muted });
          txt(cc, e.descanso ? `${e.descanso} s` : '—', COL.desc, yTop, { size: 24, color: C.text });
          txt(cc, e.rir != null && e.rir !== '' ? n1(e.rir) : '—', COL.rir, yTop, { size: 24, color: C.text });
          return Math.max(yl, yTop + hPresc) + 16 - y1;
        };
        const h = linha({ pinta: false, measureText: c.measureText.bind(c), set font(v) { c.font = v; }, get font() { return c.font; } }, yy);
        if (i % 2 === 1) caixa(c, x0 + 2, yy + 1, w - 4, h - 1, 0, C.zebra);
        linha(c, yy);
        yy += h;
        if (i < ficha.exercicios.length - 1) linhaH(c, x0 + 16, x0 + w - 16, yy, C.border);
      });
      return yy + 12;
    };
    const fim = corpo({ pinta: false, measureText: ctx.measureText.bind(ctx), set font(v) { ctx.font = v; }, get font() { return ctx.font; } }, y);
    caixa(ctx, x0, y, w, fim - y, 18, C.card, C.border);
    corpo(ctx, y);
    return fim;
  }
  function imagemTreino(pr, fichaId) {
    const exMap = A.exMap();
    const perfil = A.S.perfis.find((p) => p.id === pr.perfilId) || {};
    const fichas = fichaId ? pr.fichas.filter((x) => x.id === fichaId) : pr.fichas;
    const fase = (DB.fases[pr.fase] || {}).nome;
    return renderizar((ctx) => {
      let y = PAD;
      if (fichaId && fichas[0]) y = cabecalho(ctx, y, 'Ficha de treino', C.treino, `Ficha ${fichas[0].letra} — ${fichas[0].nome || ''}`, [pr.nome, perfil.nome].filter(Boolean).join(' · '));
      else y = cabecalho(ctx, y, 'Programa de treino', C.treino, pr.nome, [`${pr.fichas.length} fichas`, `${pr.frequencia}×/semana`, fase, perfil.nome].filter(Boolean).join(' · '));
      if (!fichaId && pr.obs) y += txt(ctx, pr.obs, PAD, y, { size: 22, color: C.text2, maxW: W - PAD * 2 }) + 16;
      fichas.forEach((fi) => { y = fichaBloco(ctx, y, fi, exMap) + 24; });
      y += txt(ctx, 'RIR = repetições na reserva ao fim da série (0 = até a falha).', PAD, y, { size: 19, color: C.muted, maxW: W - PAD * 2 }) + 16;
      return rodape(ctx, y);
    });
  }

  /* ---------- dieta ---------- */
  function qtdTexto(item, a) {
    const u = a && a.liquido ? 'ml' : 'g';
    if (item.medida && a && a.medidas && a.medidas[item.medida]) return `${n1(item.qtd / a.medidas[item.medida])} × ${item.medida} (${n0(item.qtd)} ${u})`;
    return `${n0(item.qtd)} ${u}`;
  }
  // alimento/quantidade: início da coluna; kcal/C/G/P: borda direita (alinhados à direita)
  const DC = { al: PAD + 24, q: 470, kcal: 770, c: 850, g: 930, p: W - PAD - 24 };
  function refeicaoBloco(ctx, y, r, tr, al) {
    const x0 = PAD, w = W - PAD * 2;
    const corpo = (c, yy) => {
      const titulo = r.nome + (r.hora ? '  ·  ' + r.hora : '');
      const cab = (cc) => {
        let hT = txt(cc, titulo, x0 + 24, yy + 20, { size: 28, weight: 800, maxW: 560, lh: 34 });
        if (r.substituicao) hT += 8 + selo(cc, 'Substituição (não soma no total)', x0 + 24, yy + 20 + hT + 8, C.dieta, '#fff', 560).h;
        txt(cc, `${n0(tr.kcal)} kcal`, x0 + w - 24, yy + 16, { size: 28, weight: 800, color: C.dieta, align: 'right' });
        txt(cc, `C ${n0(tr.c)} · G ${n0(tr.g)} · P ${n0(tr.p)}`, x0 + w - 24, yy + 50, { size: 19, color: C.text2, align: 'right' });
        return Math.max(84, hT + 40);
      };
      const hCab = medir(c, cab);
      caixa(c, x0, yy, w, hCab, [18, 18, 0, 0], C.dietaSoft);
      cab(c);
      yy += hCab;
      yy += 12;
      [['ALIMENTO', DC.al, 'left'], ['QUANTIDADE', DC.q, 'left'], ['KCAL', DC.kcal, 'right'], ['C', DC.c, 'right'], ['G', DC.g, 'right'], ['P', DC.p, 'right']].forEach(([t, x, al2]) => txt(c, t, x, yy, { size: 17, weight: 700, color: C.muted, align: al2 }));
      yy += 32;
      linhaH(c, x0 + 16, x0 + w - 16, yy, C.border);
      if (!r.itens.length) { yy += 14; yy += txt(c, 'Sem alimentos cadastrados.', DC.al, yy, { size: 22, color: C.muted }) + 14; }
      r.itens.forEach((it, i) => {
        const v = E.calcItem(it, al);
        const linha = (cc, y1) => {
          const yt = y1 + 14;
          const h1 = txt(cc, v.nome, DC.al, yt, { size: 24, weight: 600, maxW: DC.q - DC.al - 20, lh: 30 });
          const h2 = txt(cc, qtdTexto(it, v.alimento), DC.q, yt, { size: 22, color: C.text2, maxW: DC.kcal - DC.q - 90, lh: 30 });
          txt(cc, n0(v.kcal), DC.kcal, yt, { size: 22, weight: 700, align: 'right' });
          txt(cc, n0(v.c), DC.c, yt, { size: 22, color: C.carb, align: 'right' });
          txt(cc, n0(v.g), DC.g, yt, { size: 22, color: C.gord, align: 'right' });
          txt(cc, n0(v.p), DC.p, yt, { size: 22, color: C.prot, align: 'right' });
          return Math.max(h1, h2) + 28;
        };
        const h = linha({ pinta: false, measureText: c.measureText.bind(c), set font(val) { c.font = val; }, get font() { return c.font; } }, yy);
        if (i % 2 === 1) caixa(c, x0 + 2, yy + 1, w - 4, h - 1, 0, C.zebra);
        linha(c, yy);
        yy += h;
        if (i < r.itens.length - 1) linhaH(c, x0 + 16, x0 + w - 16, yy, C.border);
      });
      if (r.obs) { yy += 8; yy += txt(c, r.obs, DC.al, yy, { size: 20, italic: true, color: C.text2, maxW: w - 48 }) + 8; }
      return yy + 10;
    };
    const fake = { pinta: false, measureText: ctx.measureText.bind(ctx), set font(v) { ctx.font = v; }, get font() { return ctx.font; } };
    const fim = corpo(fake, y);
    caixa(ctx, x0, y, w, fim - y, 18, C.card, C.border);
    corpo(ctx, y);
    return fim;
  }
  function imagemDieta(d) {
    const al = A.alMap();
    const t = E.totaisDieta(d, al);
    const perfil = A.S.perfis.find((p) => p.id === d.perfilId) || {};
    const meta = d.meta && d.meta.kcal ? d.meta : null;
    const TIPOS = { treino: 'Dia de treino', descanso: 'Dia de descanso', low: 'Low carb', 'alto-carbo': 'Carbo alto / refeed', viagem: 'Viagem', vida: 'Vida real / flexível', outro: 'Outro' };
    return renderizar((ctx) => {
      let y = cabecalho(ctx, PAD, 'Plano alimentar', C.dieta, d.nome, [TIPOS[d.tipo], `${d.refeicoes.filter((r) => !r.substituicao).length} refeições`, perfil.nome].filter(Boolean).join(' · '));
      // totais
      const stats = [['Calorias', n0(t.kcal), 'kcal', meta && meta.kcal, C.kcal], ['Carboidrato', n0(t.c), 'g', meta && meta.c, C.carb], ['Gordura', n0(t.g), 'g', meta && meta.g, C.gord], ['Proteína', n0(t.p), 'g', meta && meta.p, C.prot], ['Fibras', n0(t.fib), 'g', null, C.fib]];
      const gap = 14, bw = (W - PAD * 2 - gap * 4) / 5, bh = 132;
      stats.forEach(([rot, v, u, m, cor], i) => {
        const x = PAD + i * (bw + gap);
        caixa(ctx, x, y, bw, bh, 16, C.card, C.border);
        caixa(ctx, x, y, bw, 8, [16, 16, 0, 0], cor);
        txt(ctx, rot, x + 16, y + 22, { size: 19, weight: 700, color: C.text2 });
        ctx.font = f(38, 800); const vw = ctx.measureText(v).width;
        txt(ctx, v, x + 16, y + 50, { size: 38, weight: 800 });
        txt(ctx, u, x + 22 + vw, y + 64, { size: 20, color: C.muted });
        txt(ctx, m ? `meta ${n0(m)}` : rot === 'Fibras' ? 'ideal ≥ 25' : ' ', x + 16, y + 98, { size: 18, color: C.muted });
      });
      y += bh + 28;
      if (d.obs) y += txt(ctx, d.obs, PAD, y, { size: 22, color: C.text2, maxW: W - PAD * 2 }) + 18;
      d.refeicoes.forEach((r, i) => { y = refeicaoBloco(ctx, y, r, t.refeicoes[i], al) + 22; });
      y += txt(ctx, 'Valores por item: calorias e gramas de carboidrato (C), gordura (G) e proteína (P).', PAD, y, { size: 19, color: C.muted, maxW: W - PAD * 2 }) + 16;
      return rodape(ctx, y);
    });
  }

  /* ---------- janela de exportação ---------- */
  const slug = (s) => DB.slug(s || 'fitlab').slice(0, 50) || 'fitlab';
  let urlAtual = null;
  function exportar(opts) {
    let escopo = opts.fichaId || 'todo', formato = 'png', blob = null, nome = '';
    const pr = opts.programa, d = opts.dieta;
    const opcoes = pr ? `<label class="field"><span class="lbl">O que exportar</span><select id="imgEscopo"><option value="todo">Programa completo (${pr.fichas.length} fichas)</option>${pr.fichas.map((fi) => `<option value="${fi.id}" ${fi.id === escopo ? 'selected' : ''}>Ficha ${A.h(fi.letra)} — ${A.h(fi.nome || '')}</option>`).join('')}</select></label>` : '';
    const podeCompartilhar = !!(navigator.canShare && window.File);
    A.modal({ title: pr ? 'Exportar treino como imagem' : 'Exportar dieta como imagem', wide: true,
      body: `${opcoes}<div class="row mb"><span class="lbl" style="margin:0">Formato</span><div class="seg" id="imgFmt"><button type="button" class="on" data-f="png">PNG</button><button type="button" data-f="jpeg">JPEG</button></div><span class="tiny muted" id="imgInfo"></span></div>
        <div class="img-prev"><img id="imgPrev" alt="Prévia da imagem"></div>
        <p class="help mt-s">PNG tem nitidez máxima; JPEG gera arquivo menor, bom para mensagens. No celular, você também pode tocar e segurar a prévia para salvar.</p>`,
      foot: `<button class="btn" data-act="__modalClose">Fechar</button>${podeCompartilhar ? '<button class="btn" data-act="imgShare">📤 Compartilhar</button>' : ''}<button class="btn primary" data-act="imgBaixar">⬇️ Baixar</button>`,
      onClose: () => { if (urlAtual) { URL.revokeObjectURL(urlAtual); urlAtual = null; } } });
    const gerar = () => {
      const cv = pr ? imagemTreino(pr, escopo === 'todo' ? null : escopo) : imagemDieta(d);
      const tipo = formato === 'jpeg' ? 'image/jpeg' : 'image/png';
      const fi = pr && escopo !== 'todo' ? pr.fichas.find((x) => x.id === escopo) : null;
      nome = `fitlab-${slug(pr ? pr.nome + (fi ? '-ficha-' + fi.letra : '') : d.nome)}-${A.hoje()}.${formato === 'jpeg' ? 'jpg' : 'png'}`;
      cv.toBlob((b) => {
        blob = b; if (!b) { A.toast('Não foi possível gerar a imagem'); return; }
        if (urlAtual) URL.revokeObjectURL(urlAtual);
        urlAtual = URL.createObjectURL(b);
        const img = A.$('#imgPrev'); if (img) img.src = urlAtual;
        const info = A.$('#imgInfo'); if (info) info.textContent = `${cv.width} × ${cv.height} px · ${Math.max(1, Math.round(b.size / 1024))} KB`;
      }, tipo, 0.92);
    };
    gerar();
    const esc = A.$('#imgEscopo'); if (esc) esc.addEventListener('change', () => { escopo = esc.value; gerar(); });
    A.$$('#imgFmt button').forEach((bt) => bt.addEventListener('click', () => { formato = bt.dataset.f; A.$$('#imgFmt button').forEach((x) => x.classList.toggle('on', x === bt)); gerar(); }));
    A.on('imgBaixar', () => {
      if (!blob) return;
      const a = document.createElement('a'); a.href = urlAtual; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      A.toast('Imagem salva: ' + nome, 2500);
    });
    A.on('imgShare', async () => {
      if (!blob) return;
      const file = new File([blob], nome, { type: blob.type });
      if (!navigator.canShare({ files: [file] })) { A.toast('Este aparelho não compartilha imagens; use Baixar.'); return; }
      try { await navigator.share({ files: [file], title: nome }); } catch (e) { /* cancelado */ }
    });
  }

  A.exportarImagem = exportar;
  A.imagemTreino = imagemTreino; A.imagemDieta = imagemDieta;
})();
