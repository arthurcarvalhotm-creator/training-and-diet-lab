# 🏋️ FitLab — Treinos e Dietas

Gerenciador completo de treinos e dietas que substitui a planilha de consultoria (`PLANILHA_CONSULTORIA.xlsx`). Aplicação local (HTML + CSS + JS puros, sem servidor, sem build): roda no navegador do computador ou instalada no smartphone como um app (PWA), no mesmo padrão do Laboratório de Cafeteria, com sincronização opcional e criptografada entre aparelhos.

## O que faz

### Corpo e avaliação (a aba "Consulta" da planilha)
- **Perfis** para você e até 3 pessoas (sexo, nascimento, altura, nível de treino, FC de repouso), com dados totalmente separados.
- **Avaliação física**: peso, cintura, pescoço, quadril, braço, coxa, peito e panturrilha → **% de gordura** (US Navy, com fallback por IMC ou valor manual), **IMC**, massa magra, **TMB** por três fórmulas (Mifflin-St Jeor, Harris-Benedict, Katch-McArdle), **GET** por nível de atividade e **água diária**.
- **Planejamento calórico** igual ao da planilha: +10 % (bulking) ou −15 % (cutting) sobre a dieta anterior ou sobre o GET, com ajuste e meta manual.
- **Macros** por percentual (presets da planilha: bulking 60/16/24 e cutting 35/27/38, além de equilibrado, alto carbo, low carb, alta proteína) ou por **g/kg**. Tudo recalcula ao digitar; alertas de proteína e gordura baixas.
- **Evolução**: gráfico de peso com média móvel e tendência semanal, gráfico de medidas, registros rápidos de peso.

### Dieta (as abas de plano alimentar)
- **Biblioteca com 210 alimentos** da alimentação fitness brasileira (referência TACO e rótulos), com **medidas caseiras** (colher, escumadeira, fatia, unidade, scoop…) e **equivalentes** por macronutriente principal (troque 100 g de arroz por batata-doce, macarrão, tapioca…).
- **Planos alimentares** com refeições, horários, itens em gramas ou medidas caseiras, refeições de substituição, totais por refeição e do dia contra as metas (kcal, carbo, gordura, proteína, fibras), ajuste automático às metas, duplicar, copiar como texto e marcar como ativo.
- **Gerador de dieta**: 3 a 7 refeições, café salgado ou doce, exclusão de alimentos que você não come; escala as fontes de carbo, proteína e gordura para bater as metas.
- **Diário alimentar**: marca as refeições do plano ativo, registra alimentos fora do plano, água em copos, observações e aderência dos últimos 14 dias.
- **Suplementação** separada: protocolo com dose, momento e dias da semana, checklist diário e catálogo com 22 suplementos.
- **Alimentos personalizados** a partir do rótulo.

### Treino (as abas de treino)
- **241 exercícios** organizados por 14 grupos musculares e **39 aparelhos**, com padrão de movimento, tipo (composto/isolado), unilateral, nível e dica de execução — inclui todos os 131 da planilha mais glúteo, core, calistenia e variações. Exercícios personalizados.
- **38 metodologias**: progressão de carga (com 2 drops na última), pirâmides, drop-set, super drop-set, drop mecânico, rest-pause, myo-reps, cluster, bi-set, tri-set, super set antagonista, giant set, circuito, FST-7, GVT 10×10, 5×5, 5/3/1, até a falha, parciais, bíceps 21, pico de contração, isometria, excêntricas, cadência, 3 amplitudes, 3 inclinações, pré e pós-exaustão, aquecimento, back-off, ondulatório, EMOM, AMRAP, Tabata, densidade e ida e volta.
- **Programas e fichas** editáveis (séries, repetições em qualquer formato — `12-15`, `20x15x12x12x12`, `10+5` —, método, descanso, RIR, observação), com **volume semanal por grupo** contra os marcos MEV/MAV/MRV.
- **11 divisões**: Full Body, AB, Upper/Lower, ABC, Push/Pull/Legs, ABCD, ABCDE, ABCDEF, PPL+UL e duas com ênfase em glúteo e inferiores para mulheres.
- **Gerador de programa**: sexo, nível, divisão, frequência, fase, grupos de ênfase e aparelhos disponíveis → fichas completas com métodos adequados à fase. Gere quantas variações quiser antes de salvar.
- **Periodização**: macrociclo (8 modelos por objetivo e nível ou personalizado) → mesociclos com fase (adaptação, hipertrofia, hipertrofia metabólica, força, potência, resistência, intensificação, deload) → microciclos semanais com multiplicador de volume, RIR e ajuste de carga. A prescrição da semana é aplicada automaticamente ao iniciar o treino.
- **Treinos passados**: registre um treino de outro dia que ficou sem registro (*Registrar → Treino passado*, ou "🕓 Treino passado" no programa e na ficha), escolhendo data, horário opcional e ficha — com cargas, reps e RIR ou só marcado como feito. A ficha sugerida é a próxima da sequência naquela data e a semana do ciclo é a da data do treino. Para quem já começou um programa sem registrar, "🗓️ Comecei antes" pede a data de início, marca os dias treinados, distribui as fichas em sequência e deixa a próxima ficha certa para hoje. A data de qualquer treino pode ser corrigida em "📆 Data".
- **Sessão ao vivo**: carga, reps e RIR por série, cargas pré-preenchidas da última sessão, **sugestão de progressão** (dupla progressão com RIR), cronômetro de descanso com som e vibração que continua em segundo plano (contagem na barra de notificações e alerta ao terminar, com as notificações ativadas em *Mais → Configurações*), descanso de bi-set, tri-set, super set, giant set e circuito só depois da série do último exercício do grupo, tela que mantém a posição ao marcar séries, detecção de **PR**, tonelagem e duração.
- **Histórico** por semana (sessões e tonelagem), detalhe por exercício com **1RM estimado** (Epley) e tabela de percentuais.
- **Aeróbico** separado: 18 atividades com kcal por MET, distância, FC média, zonas de FC (Tanaka/Karvonen) e minutos por semana.

### Dados
- **Histórico da planilha já embutido**: as 14 dietas (Jan/24 a Set/25, Vida, Viagem…) e os 8 programas de treino (3×, 4×, 5×, 6×) podem ser importados no primeiro acesso ou em *Mais → Backup*. O programa **Set 26 (5×)** também vem embutido e entra sozinho, como programa ativo, em quem já tem o histórico da planilha.
- **Sincronização entre aparelhos**: celular, tablet e notebook compartilham os mesmos perfis, dietas, treinos e registros por um Gist secreto da sua conta do GitHub. O arquivo é criptografado no aparelho (AES-GCM 256, chave derivada da sua senha com PBKDF2-SHA256, 310 mil iterações) antes de sair, então o GitHub só guarda texto cifrado. A mescla é por registro: novidades dos dois lados somam, a edição mais recente vence e exclusões não voltam. O mesmo perfil, a mesma dieta ou programa da planilha e o mesmo dia do diário criados em aparelhos diferentes são unificados. Na primeira conexão de um aparelho, a cópia da nuvem prevalece para o que existe nos dois lados. Configure em *Mais → Sincronização* (ou, num aparelho novo, direto na tela de boas-vindas), com o mesmo token e a mesma senha em cada aparelho. O token do Laboratório de Cafeteria serve aqui também.
- **Exportar como imagem (PNG ou JPEG)**: programa completo ou uma ficha, e a dieta completa, em 1080 px de largura, com prévia, download e compartilhamento direto (WhatsApp, galeria). Botão "🖼️ Exportar imagem" nas telas do programa, da ficha e do plano alimentar.
- **Backup** em JSON (baixar, compartilhar, copiar; mesclar ou substituir).
- **Atualizações**: o service worker busca a versão publicada sempre que há internet e usa o cache só offline. Em *Mais → Configurações* aparecem a versão instalada e o botão "Forçar atualização", que não apaga dados.

## Como rodar

### No computador
Abra `index.html` no navegador (duplo clique). Tudo funciona a partir de `file://`.

### No smartphone, "como um app"
Para instalar (ícone na tela inicial, tela cheia, offline), a pasta precisa ser servida por HTTP(S):

**A) GitHub Pages (recomendado)** — o workflow `.github/workflows/jekyll-gh-pages.yml` publica automaticamente a cada push na branch `main` e na branch de trabalho `claude/confident-fermi-jueml3` (a mesma usada nas sessões do Claude), então as mudanças chegam ao site sem precisar de merge. Abra a URL no celular e use "Instalar aplicativo" (Chrome/Android) ou *Compartilhar → Adicionar à Tela de Início* (Safari/iPhone). A cada publicação, troque `VERSAO` em `sw.js` para os aparelhos instalados recarregarem na versão nova.

**B) Servidor local na mesma rede Wi-Fi** — na pasta do projeto:

```bash
python3 -m http.server 8080
# ou: npx serve .
```

No celular acesse `http://IP-DO-COMPUTADOR:8080` e adicione à tela inicial.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Casca da aplicação e navegação |
| `styles.css` | Estilos, tema claro/escuro, layout mobile-first |
| `data.js` | Biblioteca: grupos, aparelhos, exercícios, métodos, divisões, fases, modelos de macrociclo, alimentos, suplementos, aeróbico |
| `historico.js` | Dietas, treinos e avaliação extraídos da planilha (gerado automaticamente) |
| `engine.js` | Motor: avaliação física, calorias e macros, totais de dieta, parser de reps, volume, 1RM, progressão, geradores de programa, ciclo e dieta |
| `app.js` | Núcleo da interface: estado, roteador, componentes, gráficos SVG, início, registro rápido |
| `ui-treino.js`, `ui-dieta.js`, `ui-corpo.js`, `ui-mais.js` | Telas de cada área |
| `sync.js` | Sincronização criptografada via GitHub Gist |
| `export.js` | Exportação de fichas, programas e dietas como imagem (canvas) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalação como app e cache offline |

## Fórmulas e referências

- **% gordura (US Navy)** — homens: 86,010·log₁₀(cintura − pescoço) − 70,041·log₁₀(altura) + 36,76; mulheres: 163,205·log₁₀(cintura + quadril − pescoço) − 97,684·log₁₀(altura) − 78,387. A planilha usava o peso no lugar da altura na fórmula masculina; o app usa a fórmula correta.
- **TMB** — Mifflin-St Jeor (padrão), Harris-Benedict revisada, Katch-McArdle. **GET** = TMB × 1,2–1,9.
- **Calorias dos alimentos** = 4·C + 9·G + 4·P, como na planilha.
- **1RM** — Epley. **Aeróbico** — kcal = MET × 3,5 × peso / 200 × min; FC máx = 208 − 0,7 × idade.
- **Volume** — marcos MEV/MAV/MRV por grupo como referência; ajuste pela sua recuperação.

Os valores da biblioteca são referências; o histórico real sempre prevalece. O app não substitui acompanhamento profissional.
