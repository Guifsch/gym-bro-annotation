# CLAUDE.md — Memória Viva do Projeto Gym Bro Annotation

> Atualizar ao adicionar features ou refatorar algo relevante.

---

## Stack

- **App**: Expo SDK 57, React Native 0.86.2, React 19, TypeScript, Expo Router (file-based, grupo `(tabs)` e `(auth)`), Zustand, Hermes, React Compiler ligado (`experiments.reactCompiler` no `app.json`).
- **API**: Express + MongoDB (Mongoose), deploy no Render (free tier — hiberna após inatividade, ver seção própria).
- **Imagens**: Cloudflare R2 (S3-compatible), upload via `expo-file-system`'s `File` class (`new File(uri).upload(...)`) — **não usar axios+`fetch().blob()`**, quebra o upload binário no RN.
- **Repositório único**: `gym_bro_annotation/.git` na raiz — `api/` e `app/` são só subpastas, não repos separados. `git add`/`commit` rodado de dentro de qualquer subpasta opera no repo inteiro.

---

## Autenticação

Token de acesso em memória + refresh token no `SecureStore` (expira em 30 dias **desde o último login real**, não renovado a cada uso — comportamento tipo navegador). Rate limiting: `authLimiter` (10/15min, rotas de credencial) e `apiLimiter` (300/15min, global). `app.set('trust proxy', 1)` necessário pro Render (atrás de proxy reverso).

Bootstrap de auth (`(tabs)/_layout.tsx`) mostra `LoadingView` (não branco/preto) enquanto checa `/auth/refresh` — essa checagem pode demorar bastante se o Render estiver hibernando.

**Envio de e-mail (código de cadastro/reset de senha)** — `api/src/utils/email.ts` suporta dois provedores, escolhidos por `EMAIL_PROVIDER` no `.env` (`resend` | `gmail`, default `resend`): Resend (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`) e Gmail SMTP via `nodemailer` (`GMAIL_USER`/`GMAIL_APP_PASSWORD` — App Password de 16 caracteres, exige 2FA na conta Google, não é a senha normal). **Por quê dois**: o sender sandbox do Resend (`onboarding@resend.dev`, sem domínio verificado) só entrega pro e-mail do próprio dono da conta — não serve pra registrar usuários reais ainda. Gmail funciona pra qualquer destinatário desde já; trocar de volta pra `resend` quando tiver domínio verificado lá. Fallback de dev (log no console) ativa se as credenciais do provedor escolhido estiverem vazias.

---

## Categorias, Exercícios, Treinos

CRUD padrão nas 3 entidades, todas com **confirmação antes de excluir** (`Alert.alert` Cancelar/Excluir) — nenhuma exclusão é direta.

### Exercícios (`app/src/app/(tabs)/exercicios/lista.tsx`)

- **Criação vira botão**: formulário não fica sempre visível — aparece um botão "Criar exercício"; ao clicar (ou tocar num item pra editar), o formulário substitui o botão **e esconde a listagem** enquanto ativo.
- **Sets/reps aceitam 0** (`min(0)` no Zod e no Mongoose); categoria é obrigatória mas não trava o botão — mostra `Alert` explícito se tentar salvar sem escolher.
- **Ao salvar, não colapsa de volta pro botão**: editar continua editando; **criar** transiciona automaticamente pro modo editar do exercício recém-criado (permite já adicionar foto/ver histórico sem sair da tela).
- **Carga máxima (1RM)** — campo opcional `cargaMaximaKg`; quando preenchido, mostra `PercentualTable` (50–100% da carga, calculado no cliente).
- **Até 5 fotos por exercício** — `Exercicio.imagens: { url, key }[]` (migrado de `imagemUrl`/`imagemKey` singulares via script one-off, já removidos do schema). `ExercicioImageGallery` component: grade de miniaturas + modal de zoom, botão de adicionar (câmera **ou** galeria — `Alert.alert` com as duas opções, `expo-image-picker` cobre as duas) some com 5 fotos. Endpoints `POST/DELETE /api/exercicios/:id/imagens[/:key]`. Excluir imagem do exercício **já exclui do R2** também (`deleteImageFromR2`).
- **Vídeo do YouTube (opcional)** — `Exercicio.videoUrl` (string livre, limite 500 igual à `descricao`), campo `YoutubeVideoField` renderizado logo abaixo da galeria (tanto em `exercicios/lista.tsx` quanto na tela de exercício-dentro-de-sessão do calendário). Extrai o ID via regex (`utils/youtube.ts`, cobre `watch?v=`, `youtu.be/`, `/shorts/`); mostra thumbnail com botão de play (toca inline) **e** ícone de abrir externo (YouTube app/navegador) — usuário escolhe. Toque inline usa `react-native-youtube-iframe` (não WebView cru com HTML/iframe manual — isso batia em erros do player do YouTube tipo "Error 153"/"vídeo indisponível" por falta de origem/sessão válidas; a lib carrega a API oficial do player corretamente). Se o vídeo específico não permitir embed, `onError` mostra um `Alert` sugerindo abrir externo em vez de travar.
- **Histórico de edições** — cada `PATCH` bem-sucedido salva um snapshot (nome/descrição/sets/reps/peso + `alteradoEm`) em `Exercicio.historico[]` **antes** de aplicar a mudança (limite 50 via `$slice: -50`). Cada entrada tem `_id` próprio (`randomUUID()`) — permite excluir individualmente. **Não vem na listagem geral** (`GET /` usa `.select('-historico')`), só via `GET /:id/historico` (lazy, sob demanda). Exibido pelo componente compartilhado `ExercicioHistoricoModal` (usado tanto em `exercicios/lista.tsx` quanto na tela de exercício-dentro-de-sessão do calendário — não duplicar essa lógica).
- **Data do histórico em BRT manual**: `formatDateTimeDisplay` calcula UTC-3 manualmente (não usa `Intl`/fuso do aparelho) — evita mostrar hora americana se o timezone do dispositivo estiver errado.

---

## Alimentação (`Refeicao`)

Terceira opção na landing da tab Exercícios (`exercicios/index.tsx`), abaixo do card "Exercícios" — leva pra `exercicios/alimentacao/*`, uma área própria (lista + editor) desacoplada de treino/exercício.

- **Modelo simples e livre**: `Refeicao` tem `nome`, `date?` (YYYY-MM-DD, opcional), `itens: { _id, nome }[]` (linhas de texto livre, ex: "2 ovos mexidos"), `observacoes?`. Sem contagem de calorias/macros — é só uma lista organizável, por design (usuário não tinha um formato em mente, optei pelo mais flexível).
- **Sem limite de criação** (diferente de categorias/exercícios/treinos/timers): refeições são um log de uso (mais parecido com `Sessao`, que também não tem limite) e não um catálogo/definição — a natureza é acumular ao longo do tempo, um limite baixo inviabilizaria o uso real.
- **Vínculo com o calendário é opcional e bidirecional**: `alimentacao/[refeicaoId].tsx` deixa escolher o dia via `DatePickerModal` (reaproveita o `MonthCalendar` existente num modal, sem lib de date-picker nativa nova). `calendario/[date]/index.tsx` também mostra as refeições vinculadas àquele dia (filtro client-side sobre `listRefeicoes()`, sem endpoint de filtro por data no backend) e permite criar uma nova já com a data preenchida.
- **Itens da refeição**: array editado inteiro a cada mudança (`PATCH` manda a lista completa) — sem endpoint dedicado de add/remove item, mesmo padrão simples usado pra `exercicioIds` do Treino.
- **Limites de caracteres**: `nome` da refeição 120 (padrão igual a outros campos "nome"), item 200, `observacoes` 500 (padrão igual a `descricao`).

---

## Editor de sessão (`exercicio-entry-editor.tsx`)

Campos manuais (Sets/Reps/Peso) + "Rápido" (parser de linguagem natural tipo `"3s 10r 10k"`). **Um único botão "Salvar"** salva os 3 campos manuais de uma vez — não é mais salvamento automático por campo no `onBlur` (isso já foi um bug real: cada campo salvava sozinho ao perder foco, gerando saves redundantes). O "Rápido" mantém seu próprio botão de confirmação inline, já salvava em lote desde sempre.

---

## Calendário

- `calendario/index.tsx` — mês, sem timer (timer foi movido pra dentro da tela de exercício, ver abaixo).
- `[date]/index.tsx` — toggle de registrar/desregistrar um treino pro dia.
- `[sessaoId]/index.tsx` — exercícios do treino agrupados por categoria.
- `[exercicioId].tsx` — edição de nome/descrição/carga máxima, editor de sets/reps/peso, galeria de fotos, botão de histórico, e o **Timer de descanso** no final da tela.
- **Imóvel/sessão/exercício removido enquanto você via**: todas essas telas tratam 404 (registro apagado por outro lugar) com uma tela de "removido" + botão voltar, em vez de ficar travado em loading infinito.

---

## Timer de descanso (`app/src/components/rest-timer.tsx` + `app/src/notifications/timerAlarmService.ts`)

Usa **`@notifee/react-native`** (não `expo-notifications` — removido do projeto, não é mais usado em lugar nenhum). Motivo da troca: precisa vibrar/tocar continuamente mesmo com a tela desligada, o que exige um serviço em primeiro plano de verdade (fora do escopo do `expo-notifications`).

**Pontos não-óbvios:**
- **`AlarmType.SET_ALARM_CLOCK`** no trigger — é o mesmo mecanismo exato que despertadores nativos usam, imune ao Doze/economia de bateria do Android. Sem isso, a notificação pode atrasar minutos com a tela desligada.
- **Serviço em primeiro plano** (`notifee.registerForegroundService`, registrado em escopo de módulo, não dentro do componente) mantém `Vibration.vibrate(pattern, true)` rodando até o usuário tocar "Pausar" ou "+1 min" — pela notificação (`actions` com `pressAction.id`) ou dentro do app.
- **Canais Android são imutáveis após criados** — mudar `vibrationPattern`/`sound` de um canal já existente no aparelho não tem efeito nenhum aí; é preciso versionar o `channelId` (`CHANNEL_VERSION` em `timerAlarmService.ts`) pra forçar um canal novo.
- **`vibrationPattern` do notifee exige array só com valores positivos e quantidade par** — diferente da API `Vibration` pura do RN, que aceita um `0` inicial como "atraso". Não usar padrão com `0` líder aqui.
- **`sound: 'default'`** no canal do notifee **é** o valor certo pro som padrão do sistema (diferente do `expo-notifications`, onde isso quebrava — cuidado ao comparar as duas libs).
- **Setup de canal roda uma vez só por sessão** (`channelsReadyPromise` cacheado em `ensureChannels()`) — repetir isso a cada Play adicionava lentidão que abria brecha pra condição de corrida em cliques rápidos (Play/Pause/Play gerava notificações órfãs). Tem proteção por número de geração (`generationRef`) contra chamadas sobrepostas — qualquer mudança nesse arquivo deve preservar esse padrão.
- **`app.notifee:core` é um Maven repo local** dentro do próprio pacote (`node_modules/@notifee/react-native/android/libs`), não publicado remotamente — sem registrar isso em `android/build.gradle` (`allprojects.repositories`), o build falha com "no versions of app.notifee:core are available". O notifee **não** tem plugin de config do Expo, então isso não é automático.
- **Limite real**: só funciona com o app vivo (aberto ou em segundo plano) — se o Android matar o processo por completo, a notificação/vibração de conclusão ainda dispara (é nativo, independente do JS), mas as ações de pausar/snooze não têm como sincronizar o estado da tela do app (não tem UI pra sincronizar, já que o processo morreu).

---

## Toast (`app/src/components/toast.tsx`)

`showToast(mensagem, tipo?)` — `'success'` (verde, padrão) ou `'error'` (vermelho). Posição calculada dinamicamente: acima da tab bar (`64 + insets.bottom + gap`) nas telas com tabs (`/calendario`, `/exercicios`, `/treinos`), posição fixa mais baixa nas telas sem tab bar (auth, perfil) — sem isso, o toast ficava sobreposto às tabs.

## LoadingView (`app/src/components/loading-view.tsx`)

Logo do app (`AuthBadge`) pulsando sobre fundo com leve tom verde — usado na checagem de auth e em qualquer espera. Evitar `return null` puro em qualquer tela de carregamento — deixa a UI parecendo travada, principalmente durante o cold start do Render.

## Fundo nativo (`android/app/src/main/res/values/styles.xml`)

`AppTheme` tem `android:windowBackground` setado pra mesma cor da splash (`@color/splashscreen_background`) — sem isso, qualquer vão entre a splash sumir e o React desenhar algo mostra a cor padrão do Android (preto no tema escuro). Mudança nativa, só some do teste depois de rebuild completo (`expo run:android`), reload de JS não pega.

---

## Deploy e build

- **API no Render** (`https://gym-bro-native.onrender.com`) — plano free hiberna após inatividade, cold start pode levar dezenas de segundos. MongoDB Atlas precisa de `0.0.0.0/0` liberado em Network Access (Render não tem IP fixo).
- **`.env` do app fica gravado dentro do APK no build** — não é lido em runtime. Pra local: `http://10.0.2.2:4000` (só funciona no emulador). Pra produção: a URL do Render.
- **Gerar APK menor**: `gradle.properties` tem `android.enableMinifyInReleaseBuilds`/`enableShrinkResourcesInReleaseBuilds` ligados (só afeta `release`, não o `debug` do emulador). Pra instalar no celular físico, sempre usar `-PreactNativeArchitectures=arm64-v8a` (senão builda pra 4 arquiteturas, ~4x o tamanho — não mudar o padrão do `gradle.properties`, isso quebraria o emulador x86).
- **`--rerun-tasks` obrigatório** ao gerar o APK de release: o Gradle não rastreia o `.env` como input de task, então reaproveita o bundle JS antigo silenciosamente se só o `.env` mudou. Comando completo:
  ```powershell
  cd android
  .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --rerun-tasks
  ```
- **Nome do app**: `app.json` (`expo.name`) **e** `android/app/src/main/res/values/strings.xml` (`app_name`) — o segundo já foi gerado uma vez, só mudar o `app.json` não atualiza sozinho sem rodar prebuild/rebuild.

---

## Ambiente de desenvolvimento (Windows)

- **`nvm4w` reverte pra Node 16 sozinho** entre sessões — quebra `expo lint`/scripts que precisam de Node 18+. Rodar `nvm use 22.12.0` quando `Blob is not defined` ou erros parecidos aparecerem.
- **Build nativo (ninja/cmake) trava em caminhos longos/com espaço** — o projeto já foi movido de `E:\Projetos - Backup Google Drive\...` pra `E:\Projetos\...` justamente por isso (caminho mais curto resolveu builds que travavam com "manifest still dirty after 100 tries").
- **Emulador**: `Pixel_5_API_31` e `Pixel_7_API_35` já configurados — pode abrir direto via `emulator.exe -avd <nome>` sem precisar do Android Studio pra isso.
