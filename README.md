# 🏋️ FitLab — Treinos e Dietas

Gerenciador completo de treinos e dietas que substitui a planilha de consultoria (`PLANILHA_CONSULTORIA.xlsx`). Aplicação local (HTML + CSS + JS puros, sem servidor, sem build): roda no navegador do computador ou instalada no smartphone como um app (PWA), no mesmo padrão do Laboratório de Cafeteria, com sincronização opcional e criptografada entre aparelhos.

## O que faz

### Corpo e avaliação (a aba "Consulta" da planilha)
- **Múltiplos perfis** (sexo, nascimento, altura, nível de treino, FC de repouso), com dados totalmente separados.
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
- **Sessão ao vivo**: carga, reps e RIR por série, cargas pré-preenchidas da última sessão, **sugestão de progressão** (dupla progressão com RIR), cronômetro de descanso com som e vibração, detecção de **PR**, tonelagem e duração.
- **Histórico** por semana (sessões e tonelagem), detalhe por exercício com **1RM estimado** (Epley) e tabela de percentuais.
- **Aeróbico** separado: 18 atividades com kcal por MET, distância, FC média, zonas de FC (Tanaka/Karvonen) e minutos por semana.

### Dados e Privacidade (LGPD)
- **Persistência em `IndexedDB` (`fitlab.db`, `schemaVersion: 2`)**: cada coleção (`perfis`, `avaliacoes`, `medidas`, `dietas`, `diario`, `programas`, `ciclos`, `sessoes`, `aerobicos`, `suplementos`, `tomadas`) possui sua própria `objectStore` com escrita incremental por registro modificado, exclusão lógica (`deletedAt`) e migração automática sem perda a partir do `localStorage` legado (`fitlab.v1`).
- **Base de conhecimento versionada (`kb/*.json`)**: alimentos auditados pela **TACO 4ª ed.** com `tacoId` e `fonte` explícita (`kb/alimentos.json`), exercícios (`kb/exercicios.json`) e modelos de dietas e programas de treino anonimizados (`kb/modelos.json`, com fallback em `historico.js` para `file://`).
- **Login Social (Google e Apple) + Sincronização em Nuvem**:
  - **Modo Conta (Firebase Auth + Cloud Firestore)**: login com Google (`google.com`) ou Apple (`apple.com`) e sincronização por usuário (`/users/{uid}/{colecao}/{docId}`) protegida pelas regras em `firestore.rules`. Cada conta recebe um `uid` único (`contaUid`), impedindo colisão de perfis homônimos entre contas distintas.
  - **Modo GitHub Gist Criptografado (E2EE)**: sincronização por um Gist secreto da conta do GitHub, criptografado no aparelho (AES-GCM 256, chave derivada da senha com PBKDF2-SHA256, 310 mil iterações). Tokens e chaves ficam no cofre `IndexedDB` (`fitlab.keystore`) com `CryptoKey` não-extraível.
- **Adequação à LGPD (Lei nº 13.709/2018 — Art. 11 e Art. 18)**: consentimento explícito para dados sensíveis de saúde no onboarding e na sincronização, central dedicada em *Mais → Privacidade e LGPD* (`#/lgpd`), exportação completa para portabilidade em JSON e exclusão definitiva de dados locais e da conta na nuvem (*Direito ao Esquecimento*).
- **Backup** em JSON (baixar, compartilhar, copiar; mesclar ou substituir).
- **Atualizações**: o service worker busca a versão publicada sempre que há internet (com timeout de 2s para fallback offline) e usa o cache só offline. Em *Mais → Configurações* aparecem a versão instalada e o botão "Forçar atualização", que não apaga dados.

## Como rodar

### No computador
Abra `index.html` no navegador (duplo clique). Tudo funciona a partir de `file://`.

### No smartphone, "como um app"
Para instalar (ícone na tela inicial, tela cheia, offline), a pasta precisa ser servida por HTTP(S):

**A) GitHub Pages (recomendado)** — o workflow `.github/workflows/jekyll-gh-pages.yml` publica automaticamente a cada push na branch `main`. Abra a URL no celular e use "Instalar aplicativo" (Chrome/Android) ou *Compartilhar → Adicionar à Tela de Início* (Safari/iPhone). A cada publicação, troque `VERSAO` em `sw.js` para os aparelhos instalados recarregarem na versão nova.

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
| `data.js`, `kb/*.json` | Biblioteca versionada (`schemaVersion: 2`): grupos, aparelhos, exercícios, métodos, divisões, fases, modelos de macrociclo, alimentos (TACO 4ª ed.), suplementos, aeróbico |
| `historico.js` | Fallback `file://` para os modelos de dietas e programas de treino anonimizados (`kb/modelos.json`) |
| `engine.js` | Motor: avaliação física, calorias e macros, totais de dieta, parser de reps, volume, 1RM, progressão, geradores de programa, ciclo e dieta |
| `app.js` | Núcleo da interface: persistência `IndexedDB` (`fitlab.db`), roteador, componentes, gráficos SVG, início, registro rápido e consentimento LGPD |
| `ui-treino.js`, `ui-dieta.js`, `ui-corpo.js`, `ui-mais.js` | Telas de cada área, incluindo a central de Privacidade e LGPD (`#/lgpd`) |
| `sync.js`, `firestore.rules`, `firebase.json` | Login Social (Google / Apple via Firebase Auth + Cloud Firestore isolado por `uid`) e Sincronização E2EE via GitHub Gist |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalação como app e cache offline |

## Fórmulas e referências

- **% gordura (US Navy)** — homens: 86,010·log₁₀(cintura − pescoço) − 70,041·log₁₀(altura) + 36,76; mulheres: 163,205·log₁₀(cintura + quadril − pescoço) − 97,684·log₁₀(altura) − 78,387. A planilha usava o peso no lugar da altura na fórmula masculina; o app usa a fórmula correta.
- **TMB** — Mifflin-St Jeor (padrão), Harris-Benedict revisada, Katch-McArdle. **GET** = TMB × 1,2–1,9.
- **Calorias dos alimentos** = 4·C + 9·G + 4·P, como na planilha.
- **1RM** — Epley. **Aeróbico** — kcal = MET × 3,5 × peso / 200 × min; FC máx = 208 − 0,7 × idade.
- **Volume** — marcos MEV/MAV/MRV por grupo como referência; ajuste pela sua recuperação.

Os valores da biblioteca são referências; o histórico real sempre prevalece. O app não substitui acompanhamento profissional.
