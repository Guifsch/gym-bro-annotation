# CLAUDE.md — Memória Viva do Projeto Gym Bro Annotation

> Atualizar ao adicionar features ou refatorar algo relevante.

---

## Stack

- **App**: Expo SDK 57, React Native 0.86.2, React 19, TypeScript, Expo Router (file-based, grupo `(tabs)` e `(auth)`), Zustand, Hermes, React Compiler ligado (`experiments.reactCompiler` no `app.json`).
- **API**: Express + MongoDB (Mongoose), migrando do Render pro Northflank (free tier sem hibernação — ver seção "Deploy e build").
- **Imagens**: Cloudflare R2 (S3-compatible), upload via `expo-file-system`'s `File` class (`new File(uri).upload(...)`) — **não usar axios+`fetch().blob()`**, quebra o upload binário no RN.
- **Repositório único**: `gym_bro_annotation/.git` na raiz — `api/`, `app/` e `web/` são só subpastas, não repos separados. `git add`/`commit` rodado de dentro de qualquer subpasta opera no repo inteiro.
- **`web/`**: companion desktop (Vite + Vue 3 + Vuetify 3, sem framework/SSR) que consome a mesma API — ver seção própria "Web (`web/`)" mais abaixo.

---

## Navegação (tabs)

3 tabs: **Calendário**, **Exercícios**, **Extras** (`(tabs)/_layout.tsx`). Nem toda funcionalidade é uma tab — landing pages dentro de uma tab (`TabHeader` + `LandingOption`) abrigam sub-seções que não precisam de aba própria:

- **Exercícios** (`exercicios/index.tsx`): Categorias, Exercícios, **Treinos** (`exercicios/treinos/*` — não é mais tab própria, virou botão aqui; rotas `/(tabs)/exercicios/treinos[...]`).
- **Extras** (`extras/index.tsx`): **Alimentação** (`extras/alimentacao/*`, rotas `/(tabs)/extras/alimentacao[...]`), **Timer** (`extras/timer.tsx` — UI completa do timer de descanso, ver seção própria) e **Relatórios** (`extras/relatorios.tsx` — estatísticas de presença, ver seção "Calendário") — pensado como "gaveta" pra seções que não são nem calendário/treino nem cadastro de exercício; qualquer feature nova desse tipo (não claramente "exercício" nem "calendário") entra aqui em vez de virar tab nova.

**Histórico**: Treinos já foi tab própria; Alimentação já morou dentro de Exercícios. Movidos quando o app cresceu o suficiente pra 3 tabs ficarem sobrecarregadas — ao mover uma tela de lugar, sempre `grep` o projeto inteiro por `router.push`/`router.replace`/`Redirect` com o caminho antigo (inclusive os redirects pós-login em `app/index.tsx`, `(auth)/login.tsx`, `(auth)/register-code.tsx`, que apontavam pra tab default) e por menções textuais tipo "crie na tab X" em `EmptyState`/mensagens — fácil esquecer essas por não serem erro de tipo. **Sempre regenerar `.expo/types/router.d.ts`** depois de mover/renomear arquivo de rota (rodar `npx expo start` até o arquivo atualizar, depois parar) — `tsc --noEmit` falha com erros de rota "não existe" usando o manifest antigo, mesmo com os arquivos já movidos corretamente.

---

## Autenticação

Token de acesso em memória + refresh token no `SecureStore` (expira em 30 dias **desde o último login real**, não renovado a cada uso — comportamento tipo navegador). Rate limiting: `authLimiter` (10/15min, rotas de credencial) e `apiLimiter` (300/15min, global). `app.set('trust proxy', 1)` necessário pro Render (atrás de proxy reverso).

Bootstrap de auth (`app/index.tsx`) dispara `bootstrap()` e mostra tela em branco enquanto checa `/auth/refresh`; uma vez resolvido, redireciona pra `/(tabs)/calendario` (autenticado) ou `/(auth)/login` (anônimo). `(tabs)/_layout.tsx` também mostra `LoadingView` — essa checagem pode demorar bastante se o Render estiver hibernando.

**Esconder a splash nativa tem que cobrir os dois desfechos, não só o autenticado** — bug real: `SplashScreen.hideAsync()` só estava em `(tabs)/_layout.tsx`, que **só monta quando `status === 'authenticated'`**. No caminho anônimo (instalação nova sem token salvo, ou token expirado), `app/index.tsx` redireciona direto pra `/(auth)/login` sem nunca montar `(tabs)/_layout.tsx` — a splash nativa ficava presa pra sempre, escondendo uma tela de login que na verdade já tinha carregado normalmente por baixo. Só não tinha sido percebido porque todo teste anterior já estava logado (sempre ia pelo caminho autenticado). Fix: o `useEffect` que chama `SplashScreen.hideAsync()` mora em `app/index.tsx` (o único lugar que observa **os dois** desfechos), não em `(tabs)/_layout.tsx`.

**Diagnosticando "trava carregando pra sempre" nesse fluxo**: sem log nenhum, uma trava aqui é invisível — nem erro no app nem no terminal da API. `api/src/app.ts` tem um middleware simples logando `method + path + ip` de toda request recebida (então dá pra ver se a requisição sequer chegou no servidor); `apiClient.ts` tem `timeout: 30_000` nas chamadas (bem generoso de propósito, pra não disparar durante um cold start real do Render — existe só pra uma conexão genuinamente quebrada falhar de forma visível em vez de girar pra sempre). Testando localmente (não Render): emulador usa `http://10.0.2.2:PORT` pra alcançar o host, **não** o IP da rede local — tráfego pra `10.0.2.2` passa pela NAT interna do próprio emulador (não passa pelo Firewall do Windows por perfil de rede); já `192.168.x.x` (celular físico real na mesma rede) passa pela interface de verdade e pode ser bloqueado se o perfil da rede estiver como "Pública" no Windows.

**Envio de e-mail (código de cadastro/reset de senha)** — `api/src/utils/email.ts` suporta dois provedores, escolhidos por `EMAIL_PROVIDER` no `.env` (`resend` | `gmail`, default `resend`): Resend (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`) e Gmail SMTP via `nodemailer` (`GMAIL_USER`/`GMAIL_APP_PASSWORD` — App Password de 16 caracteres, exige 2FA na conta Google, não é a senha normal). **Por quê dois**: o sender sandbox do Resend (`onboarding@resend.dev`, sem domínio verificado) só entrega pro e-mail do próprio dono da conta — não serve pra registrar usuários reais ainda. Gmail funciona pra qualquer destinatário desde já; trocar de volta pra `resend` quando tiver domínio verificado lá. Fallback de dev (log no console) ativa se as credenciais do provedor escolhido estiverem vazias.

---

## Categorias, Exercícios, Treinos

CRUD padrão nas 3 entidades, todas com **confirmação antes de excluir** (`Alert.alert` Cancelar/Excluir) — nenhuma exclusão é direta.

### Exercícios (`app/src/app/(tabs)/exercicios/lista.tsx`)

- **Criação vira botão**: formulário não fica sempre visível — aparece um botão "Criar exercício"; ao clicar (ou tocar num item pra editar), o formulário substitui o botão **e esconde a listagem** enquanto ativo.
- **Sets/reps aceitam 0** (`min(0)` no Zod e no Mongoose); categoria é obrigatória mas não trava o botão — mostra `Alert` explícito se tentar salvar sem escolher.
- **Ao salvar, não colapsa de volta pro botão**: editar continua editando; **criar** transiciona automaticamente pro modo editar do exercício recém-criado (permite já adicionar foto/ver histórico sem sair da tela).
- **Ordem do formulário**: Nome → Descrição → **Carga máxima** (+ `PercentualTable` se preenchida) → Sets/Reps/Peso → Fotos → Vídeos → Categoria. Carga máxima fica **antes** de Sets/Reps/Peso de propósito (pedido explícito do usuário — "faz mais sentido" ali do que depois).
- **Foto de capa (opcional, uma só)** — `Exercicio.capa?: { url, key }`, separado da galeria de detalhe abaixo. `ExercicioCoverPhoto` (`components/exercicio-cover-photo.tsx`) renderiza **acima** do card de Nome/Descrição (fora dele, não dentro) — foto grande (`aspectRatio 16/9`), tocar nela troca (mesma escolha câmera/galeria da galeria normal), badge de lixeira remove. Endpoints dedicados `POST/DELETE /api/exercicios/:id/capa` (não é array, então delete não precisa de `:key` — só um por exercício, substituir apaga o antigo do R2 automaticamente).
  - **`components/exercicio-thumbnail.tsx`** (`ExercicioThumbnail`) — mesmo formato circular do `CategoryIcon` (`size`/`size*1.8` de badge), mas mostra a foto de capa em miniatura quando o exercício tem uma, caindo pro ícone de categoria normal quando não tem. Substitui `CategoryIcon` em **toda** listagem que representa um exercício específico (não confundir com cabeçalho de grupo/categoria, que continua usando `CategoryIcon` puro): `exercicios/lista.tsx`, sub-lista de exercícios em `exercicios/categorias.tsx`, `exercicios/treinos/[treinoId].tsx` (toggle de vincular exercício ao treino) e `calendario/[date]/[sessaoId]/index.tsx` (exercícios da sessão, acessado pelo calendário). Um componente só, reusado nos 4 lugares — ao adicionar uma nova listagem de exercícios no futuro, usar este em vez de `CategoryIcon` direto.
- **Até 5 fotos de detalhe por exercício** — `Exercicio.imagens: { url, key }[]` (migrado de `imagemUrl`/`imagemKey` singulares via script one-off, já removidos do schema; **não confundir com `capa`**, que é a foto de destaque única). `ExercicioImageGallery` component: grade de miniaturas + modal de zoom, botão de adicionar (câmera **ou** galeria — `Alert.alert` com as duas opções, `expo-image-picker` cobre as duas) some com 5 fotos. Endpoints `POST/DELETE /api/exercicios/:id/imagens[/:key]`. Excluir imagem do exercício **já exclui do R2** também (`deleteImageFromR2`).
- **Até 5 vídeos do YouTube ou Instagram (opcional)** — `Exercicio.videoUrls: string[]` (era campo único `videoUrl`, virou array — mesmo limite de 5 da galeria de fotos, por pedido explícito). Renderizado logo abaixo da galeria de fotos (tanto em `exercicios/lista.tsx` quanto na tela de exercício-dentro-de-sessão do calendário). Cada vídeo é persistido imediatamente ao adicionar/remover (`PATCH` mandando o array `videoUrls` inteiro, mesmo padrão dos `itens`/`blocos` da Refeição) — **não** passa pelo botão "Salvar" geral do formulário, igual às fotos.
  - **`components/video-preview.tsx`** (`VideoPreview`, prop só `url`) — detecção + exibição pura de UM vídeo, sem campo de texto; extraído do antigo `VideoLinkField` (removido) quando o campo único virou galeria, pra poder ser reaproveitado por item da lista.
    - **YouTube**: extrai o ID via regex (`utils/youtube.ts`, cobre `watch?v=`, `youtu.be/`, `/shorts/`); mostra thumbnail (`img.youtube.com/vi/{id}/hqdefault.jpg`) com botão de play (toca inline) **e** ícone de abrir externo. Toque inline usa `react-native-youtube-iframe` (não WebView cru com HTML/iframe manual — isso batia em erros do player do YouTube tipo "Error 153"/"vídeo indisponível" por falta de origem/sessão válidas; a lib carrega a API oficial do player corretamente). Se o vídeo específico não permitir embed, `onError` mostra um `Alert` sugerindo abrir externo em vez de travar.
    - **Instagram**: extrai tipo+shortcode via regex (`utils/instagram.ts`, cobre `/reel/`, `/p/`, `/tv/`). Sem thumbnail própria (Instagram não tem endpoint público de thumbnail sem autenticação/app review) — mostra um card com ícone do Instagram + "Vídeo do Instagram" em vez de imagem. Toque inline carrega `https://www.instagram.com/{tipo}/{shortcode}/embed/` (o embed público oficial do Instagram, feito pra ser carregado por qualquer terceiro) dentro de um `WebView` cru, envolto em HTML com `baseUrl: 'https://www.instagram.com'` — mesmo truque de origem usado no YouTube antes de trocar pra lib, aplicado por precaução aqui já que não existe um "react-native-instagram-iframe" equivalente. Container do player tem altura fixa maior (480, não 16:9) porque o embed do Instagram é o card do post inteiro (cabeçalho + mídia + legenda), não só o vídeo cru.
    - Detecção é mutuamente exclusiva (checa YouTube primeiro); se não bater com nenhum dos dois mas tiver texto, cai no fallback genérico "Abrir link".
  - **`components/video-link-gallery.tsx`** (`VideoLinkGallery`) — lista de `VideoPreview` (um por vídeo já salvo, com botão de excluir ao lado — **não** sobreposto, já que o preview varia muito de formato entre YouTube/Instagram/link genérico pra um badge posicionado em absoluto funcionar bem em todos) + campo de adicionar novo link (some com 5 vídeos).
- **Histórico de edições** — `PATCH /:id` salva um snapshot (nome/descrição/sets/reps/peso + `alteradoEm`) em `Exercicio.historico[]` **antes** de aplicar a mudança (limite 50 via `$slice: -50`), mas **só quando `sets`, `reps` ou `pesoKg` realmente mudam de valor** (`setsRepsPesoChanged` em `api/src/routes/exercicios.ts`) — editar só nome/descrição/categoria/carga máxima/substitutos, ou resalvar os mesmos 3 números, não empurra uma entrada redundante. Cada entrada tem `_id` próprio (`randomUUID()`) — permite excluir individualmente. **Não vem na listagem geral** (`GET /` usa `.select('-historico')`), só via `GET /:id/historico` (lazy, sob demanda). Exibido pelo componente compartilhado `ExercicioHistoricoModal` (usado tanto em `exercicios/lista.tsx` quanto na tela de exercício-dentro-de-sessão do calendário — não duplicar essa lógica). Mesma API serve o app nativo e o export web (Expo Router + `react-native-web`) — corrigir aqui corrige os dois de uma vez, não há lógica de histórico duplicada no cliente.
- **Data do histórico em BRT manual**: `formatDateTimeDisplay` calcula UTC-3 manualmente (não usa `Intl`/fuso do aparelho) — evita mostrar hora americana se o timezone do dispositivo estiver errado.
- **Clonar** — botão "Clonar" (junto do "Histórico") em `exercicios/lista.tsx` (form de edição) e em `exercicios/treinos/[treinoId].tsx`. Endpoints `POST /api/exercicios/:id/clone` e `POST /api/treinos/:id/clone`; nome da cópia recebe sufixo `" (cópia)"` (truncando a base se precisar pra caber no limite de caracteres). **Capa/imagens do exercício não são clonadas** (exigiria re-upload de arquivo pro R2 sob uma key nova, fora de escopo) — só os dados. Clone de treino copia `exercicioIds` (trivial, sem arquivo envolvido).
- **Exercícios substitutos** (`Exercicio.substitutoIds: string[]`) — pra quando o equipamento/máquina está ocupado na academia. **Relacionamento mútuo, sincronizado no backend**: ao salvar `substitutoIds` de A (POST de criação ou PATCH), `syncReciprocalSubstitutos()` (`api/src/routes/exercicios.ts`) faz o diff contra o array anterior e propaga pro outro lado — id adicionado em A vira `$addToSet` do id de A no array de B; id removido de A vira `$pull` do id de A no array de B. Ou seja o dado já nasce bidirecional no banco, não só na exibição — mas a listagem (`substitutosDisplayById`, memo local em `lista.tsx` e em `calendario/.../index.tsx`, mesma lógica duplicada nos dois arquivos de propósito, pequena demais pra justificar extrair) ainda funde os dois sentidos ao exibir, como rede de segurança pra dado legado que só tinha um lado gravado antes dessa mudança. Cada nome é uma linha própria (ícone + nome, clicável — leva pro exercício), **não** texto corrido separado por vírgula (tentativa inicial, usuário achou "extenso" e pediu pra empilhar). Editor: `components/substituto-picker.tsx` (`SubstitutoPicker`) — fechado mostra só os já selecionados como chips removíveis + botão "Adicionar"; abre um modal com a lista completa agrupada por categoria (mesmo padrão do "vincular exercícios ao treino"). Endpoint valida ownership + anti-autorreferência (`resolveSubstitutoIds`); excluir um exercício limpa (`$pull`) a referência de quem apontava pra ele.
- **`CategoryIcon` é sempre um halter** — tinha um mapeamento de ícone por palavra-chave da categoria (peito/costas/perna/etc.), removido a pedido do usuário ("deixe todos halteres", achava o mix inconsistente/como ruído visual). Usado tanto como cabeçalho de grupo/categoria quanto fallback do `ExercicioThumbnail` quando o exercício não tem foto de capa.
- **`components/category-jump-bar.tsx` (`CategoryJumpBar`)** — barrinha de categorias no topo de toda listagem agrupada (aba Exercícios, treino do calendário, sessão do calendário, tela de editar treino), clicar pula pro início daquele grupo. **Fica fixa acima da lista** (sibling, não dentro do conteúdo rolável) — pedido explícito do usuário, facilita quando a lista é longa. **`hooks/useCategoryScroll.ts` foi removido** — as três telas que agrupam por categoria (`exercicios/lista.tsx`, `calendario/[date]/[sessaoId]/index.tsx`, `exercicios/treinos/[treinoId].tsx`) usam `SectionList` (não `ScrollView` + `View`s agrupadas) com `stickySectionHeadersEnabled`, pra que o cabeçalho da categoria (ícone + nome, cor `Brand.primary` e maior que o texto normal — pedido explícito do usuário, "demoro pra perceber que é o nome da categoria") **grude no topo** enquanto rola pelos exercícios daquela categoria, sendo substituído pelo cabeçalho da próxima categoria ao cruzar a fronteira. Cabeçalho sticky precisa de `backgroundColor: theme.background` explícito (senão fica transparente e o conteúdo rolando por baixo aparece através dele) + `borderBottomColor: theme.border` pra separação visual.
  - Conteúdo que não é a lista agrupada (botão "Criar exercício" em `lista.tsx`; campo de nome do treino + título "Exercícios" + botões Clonar/Excluir em `treinos/[treinoId].tsx`) vira `ListHeaderComponent`/`ListFooterComponent` do `SectionList` — rola normal, não gruda. Estado vazio usa `ListEmptyComponent` quando o header/footer não dependem do modo da tela (`treinos/[treinoId].tsx`); quando dependem (`lista.tsx`, que também tem um modo "criar/editar" sem categorias nenhumas), a tela branch antes de montar o `SectionList` em vez de usar `ListEmptyComponent`.
  - Em `lista.tsx`, o formulário de criar/editar (sem categorias, sem sticky) usa uma `ScrollView` própria e separada, só montada quando `creating || editingId` — as duas (form vs. lista) trocam de componente dependendo do modo, nunca tentam misturar form + `SectionList` num só scroll. Pular pra um exercício substituto que abre a edição usa um ref **separado** (`formScrollViewRef`, na `ScrollView` do formulário) pra rolar ao topo — não dá pra reusar `sectionListRef`/`headerRefs` porque a troca de modo desmonta o `SectionList` e monta a `ScrollView`.
  - **Bug real corrigido — espaçamento entre seções**: não pode ser `marginTop` no cabeçalho — quando esse cabeçalho é o que está fixado no topo, a margem gruda junto com ele, sobrando um vão vazio acima só nas seções depois da primeira (a primeira, sem margem, ficava colada certinho — foi assim que o bug apareceu: só a partir da 2ª categoria). Fix: o espaçamento entre seções vira `marginBottom` no **último item** da seção anterior (`index === section.data.length - 1` em `renderItem`), não `marginTop` no próximo cabeçalho — cabeçalho sempre com margem zero, gruda sem vão em qualquer seção.
  - **Bug real corrigido — pular categoria pela barra horizontal não fazia nada**: `sectionListRef.current.scrollToLocation({ sectionIndex, itemIndex: 0 })` (tentativa inicial) dispara um `invariant` do RN ("scrollToIndex should be used in conjunction with getItemLayout or onScrollToIndexFailed") sempre que a seção alvo ainda não foi medida — sem `getItemLayout` nem `onScrollToIndexFailed`, isso **lança um erro** dentro do handler de toque; em build de release (sem redbox) o erro é engolido silenciosamente, então o toque parecia não fazer nada. Fix (replicado nas três telas): medir o cabeçalho diretamente via `measureLayout` — mesmo princípio do antigo `useCategoryScroll`, adaptado pro `SectionList`: `sectionListRef.current.getScrollResponder()` retorna o `ScrollView` interno do `SectionList`, chama `.getNativeScrollRef()` nele (mesma exigência do Fabric — `measureLayout` só aceita ref de componente nativo de verdade, não um handle de `ScrollView` composto nem `findNodeHandle`) e `node.measureLayout(nativeScrollRef, ...)` a partir de um `ref` guardado por categoria (`headerRefs`, populado no `renderSectionHeader`). `initialNumToRender={100}` continua útil pra não depender de virtualização em listas curtas, mas não é mais o que resolve o scroll-to-categoria.
- **Botão de voltar do topo respeita o modo de edição** (`exercicios/lista.tsx`) — `BackHeader` recebe `onBack={creating || editingId ? resetForm : undefined}`. Sem isso, tocar a seta enquanto o formulário de criar/editar está aberto saía **direto da aba** (voltava pra `exercicios/index.tsx`) em vez de só fechar o formulário e mostrar a listagem de novo — o botão físico/gesto do Android já tinha esse comportamento certo (`BackHandler`), só a seta do topo (`BackHeader`) ainda não seguia a mesma regra.

---

## Alimentação (`Refeicao`)

Opção na landing da tab Extras (`extras/index.tsx`) — leva pra `extras/alimentacao/*`, uma área própria (lista + editor) desacoplada de treino/exercício. (Já morou dentro da tab Exercícios — ver seção "Navegação (tabs)" acima.)

- **Modelo simples e livre**: `Refeicao` tem `nome` (o "plano"/container, ex: "Plano de terça", "Refeição A"), `dates: string[]` (YYYY-MM-DD, zero ou mais), `blocos: { _id, nome, horario?, itens: {_id,nome}[] }[]` (subcategorias dentro da refeição, ex: blocos "Café da manhã · 8:00" e "Almoço · 12:00", cada um com sua própria lista de itens), `observacoes?`. Sem contagem de calorias/macros — é só uma lista organizável, por design (usuário não tinha um formato em mente, optei pelo mais flexível). `horario` é texto livre (sem picker nativo, sem validação de formato) — mesma filosofia de flexibilidade do resto da feature. **Não existe conceito de "item avulso" fora de um bloco** — existiu numa iteração anterior e foi removido a pedido do usuário ("criar subcategoria com nome e horário é o padrão mesmo"); bloco é sempre o único jeito de agrupar itens.
- **Limite de criação: 200** (pedido explícito do usuário, "só por segurança" — bem mais alto que categorias/exercícios/treinos, já que refeição é mais um log de uso do que um catálogo/definição, acumula com o tempo). Mesmo padrão dos outros limites: checa existência por `_id` antes de contar, pra reenvio idempotente de uma refeição já existente nunca ser bloqueado, só criação genuinamente nova. Limites defensivos de array continuam existindo também (`dates` até 60, `blocos` até 20, `itens` até 30 por bloco).
- **Vínculo com o calendário é N:N e bidirecional**: `alimentacao/[refeicaoId].tsx` deixa marcar/desmarcar vários dias via `DatePickerModal` (multi-seleção — toca num dia pra alternar, sem fechar o modal a cada toque; reaproveita o `MonthCalendar` existente, sem lib de date-picker nativa nova) — pensado pra planos recorrentes (ex: "Plano de terça" vinculado a várias terças-feiras de uma vez, sem repetir o cadastro). `calendario/[date]/index.tsx` mostra as refeições vinculadas àquele dia (filtro client-side com `dates.includes(date)`, sem endpoint de filtro por data no backend) e permite criar uma nova já vinculada ali.
- **Itens de bloco**: cada `PATCH` manda o array `blocos` inteiro — sem endpoints dedicados de add/remove, mesmo padrão simples usado pra `exercicioIds` do Treino. Editar item de um bloco = reconstruir o array `blocos` inteiro no cliente (`toBlocoParams`/`toItemParams` em `[refeicaoId].tsx`) mudando só o bloco afetado.
- **UI: separação visual entre o que já existe e o campo de adicionar** — bug real corrigido: a primeira versão tinha uma lista de "itens avulsos" (removida depois, ver acima) cujo card de "adicionar novo" era visualmente idêntico aos itens já salvos, confundindo o usuário. Padrão adotado desde então: todo bloco de input novo tem um rótulo próprio acima ("Novo bloco", "Adicionar item a este bloco") pra nunca ficar ambíguo o que é entrada vs. o que é conteúdo já salvo.
- **Observações usa botão "Salvar" explícito, não `onBlur`** — bug real corrigido: campo multilinha só salvava ao perder o foco, mas apertar voltar sem tocar antes em outro lugar da tela nunca dispara o blur, perdendo o texto silenciosamente. Mesmo padrão do Nome (`LabeledTextField` + `GradientButton` ao lado/abaixo).
- **`DatePickerModal` — cuidado com `width: '100%'` dentro de `Pressable` sem largura própria**: bug real corrigido — o wrapper interno (usado só pra absorver o toque e não fechar o modal ao tocar no calendário) não tinha estilo nenhum; sem uma largura explícita nele, o `Card` com `width:'100%'` fica sem referência de tamanho e o RN colapsa pro mínimo, espremendo as colunas do `MonthCalendar`. Sempre dar `width:'100%'` (ou `alignSelf:'stretch'`) explícito ao wrapper, não só ao conteúdo.
- **`MonthCalendar` tem `markedStyle?: 'dot' | 'fill'`** (default `'dot'`) — o dot sutil (usado em `calendario/index.tsx` pra "tem sessão registrada nesse dia") não era claro o suficiente num contexto de seleção ativa; `'fill'` (círculo cheio, usado pelo `DatePickerModal`) deixa visualmente óbvio quais dias estão marcados/selecionados. Reaproveitar esse prop em vez de criar um componente de calendário novo pra qualquer necessidade futura de "selecionar dias".
- **`LabeledTextField` tem `onClear?: () => void`** — opcional, só renderiza o "×" quando há valor E a prop foi passada (zero mudança visual/comportamental em quem não usa). Adicionado pro `VideoLinkField`, mas disponível pra qualquer campo do app que precise de botão de limpar.
- **Limites de caracteres**: `nome` da refeição e do bloco 120 (padrão igual a outros campos "nome"), item de bloco 200, `horario` 20, `observacoes` 500 (padrão igual a `descricao`).

---

## Edição de Sets/Reps/Peso

**`components/inline-log-editor.tsx`** (`InlineLogEditor`) — versão compacta usada **dentro da listagem** (uma por linha, tanto em `exercicios/lista.tsx` quanto em `calendario/[date]/[sessaoId]/index.tsx`): 3 campos pequenos (Sets/Reps/Kg) + campo "Rápido" (parser `"3s 10r 10k"`, `parser/quickEntryParser.ts`), **sem nenhum botão de salvar**. Cada grupo (manual e rápido) commita sozinho quando: o campo perde foco (toca fora), o app vai pra segundo plano (`AppState`), ou a linha desmonta (navegou pra outra tela) — só envia os campos que o usuário realmente tocou (`dirty` ref por campo), então passar o dedo pelos campos sem editar nunca dispara um save à toa. Sem ícone de raio (removido a pedido do usuário — achava que sobrecarregava visualmente a listagem).

`LogField`/`LogFields` (tipos compartilhados) moraram em `components/exercicio-entry-editor.tsx` (componente antigo, **removido** — ver abaixo) e foram realocados pra `types/workout.ts`, já que não são mais exclusivos de um componente de edição.

**Formulário completo** (criar/editar exercício) — usado em **dois lugares agora com a mesma estrutura/ordem de campos**: `exercicios/lista.tsx` (padrão do exercício) e `calendario/.../[exercicioId].tsx` (dentro de uma sessão, mesma tela, mas Sets/Reps/Peso ali gravam na **sessão do dia**, não no padrão do exercício — ver distinção em "Categorias, Exercícios, Treinos"). O componente antigo e mais pesado (`ExercicioEntryEditor`, com "Atual: ...", `GradientButton` de salvar e o parser "Rápido" dentro do próprio formulário) foi **removido** — a versão dentro do calendário foi reescrita pra usar campos simples com auto-save no `onBlur`, igual Nome/Descrição/Carga máxima já faziam ali, unificando o comportamento entre as duas telas (o usuário reclamou explicitamente de estarem "diferentes demais").

---

## Calendário

- `calendario/index.tsx` — mês. **Timer não mora mais aqui** (virou global, ver seção própria abaixo).
- `[date]/index.tsx` — toggle de registrar/desregistrar um treino pro dia + `DayAgenda` (ver abaixo).
- `[sessaoId]/index.tsx` — exercícios do treino agrupados por categoria, `CategoryJumpBar` fixo no topo.
- `[exercicioId].tsx` — mesma estrutura de formulário de `exercicios/lista.tsx` (ver seção acima), com Sets/Reps/Peso gravando na sessão em vez do padrão do exercício.
- **Imóvel/sessão/exercício removido enquanto você via**: todas essas telas tratam 404 (registro apagado por outro lugar) com uma tela de "removido" + botão voltar, em vez de ficar travado em loading infinito.

### Modo simples/complexo (`calendario/index.tsx`)

Switch nativo (`Switch`, não um botão-toggle customizado — tentativa inicial foi um chip/pill, usuário pediu pra voltar pro comportamento de switch de verdade) persistido via AsyncStorage (`calendario:modoSimples`). Rótulo mostra o **modo atual** (não o modo pra onde vai trocar) — foi implementado ao contrário na primeira tentativa e corrigido. `trackColor={{true, false}}` os dois apontando pro verde da marca, pra ficar verde nos dois estados (só a bolinha desliza).

- **Modo complexo** (padrão): calendário do mês inteiro sempre visível, tocar num dia navega pra `[date]/index.tsx`.
- **Modo simples**: mostra a data selecionada (hoje por padrão) num card compacto + botão de calendário ao lado; tocar abre o `MonthCalendar` completo logo abaixo (fecha ao selecionar um dia); a agenda daquele dia (`DayAgenda`) aparece direto embaixo, **sem navegar de tela**.

**`components/day-agenda.tsx` (`DayAgenda`)** — extraído de `[date]/index.tsx` pra ser compartilhado entre a tela dedicada e o modo simples (que embute inline em vez de navegar) — evita duplicar a lógica de "Registrado neste dia" + "Vincular a este dia". Contém também o checkbox de presença (ver abaixo).

### Presença ("fui na academia") + Relatórios

Checkbox no topo do `DayAgenda` ("Fui na academia neste dia") — modelo `Attendance` (`api/src/models/Attendance.ts`): **um documento por dia marcado**, existência é o sinal (não tem campo booleano pra virar false, desmarcar = deletar o documento). Índice único `{userId, date}`.

- `GET/PUT /api/attendance/:date` (dia único, usado pelo checkbox), `GET /api/attendance/month?year=&month=` (lista de dias marcados no mês, usado pra marcar no `MonthCalendar`), `GET /api/attendance/summary/:year` (contagem por mês do ano, usado nos Relatórios). Rotas `/month` e `/summary/:year` registradas **antes** de `/:date` — senão o wildcard de um segmento (`:date`) engole essas rotas mais específicas.
- **`MonthCalendar` ganhou `attendanceDates?: Set<string>`** — renderiza um **anel laranja** (`Brand.accent`, não verde) ao redor do círculo do dia, separado do "hoje" (círculo verde cheio) e da bolinha de treino (`markedDates`/`dot`) — os três podem aparecer juntos no mesmo dia sem conflitar (anel é borda, não some com o preenchimento).
- **Legenda**: botão "Legenda" (não fica sempre visível — testado assim primeiro, ficava "socado"/apertado) que mede a própria posição (`measureInWindow`) e abre um card flutuante num `Modal` transparente logo abaixo, com fundo **`theme.background`** (não `theme.backgroundElement`, que é a mesma cor do card do calendário por baixo e fazia a legenda "sumir" atrás dele).
- **Extras > Relatórios** (`extras/relatorios.tsx`) — tiles "Este mês"/"Este ano" (sempre fixos no ano/mês reais, não afetados pelo seletor abaixo) + gráfico de barras horizontais por mês, navegável por ano. Barras num único tom (`Brand.primary`/`Brand.primaryDark` pro mês atual) — é uma série só (contagem), não precisa de paleta categórica.

---

## Timer de descanso — global (`stores/timerStore.ts` + `notifications/timerAlarmService.ts`)

**Não é mais um componente local de tela** — virou um store Zustand global (`useTimerStore`), porque o timer precisa continuar contando/tocando/ser visível **independente de qual tela está aberta**. Acessível em **Extras > Timer** (`extras/timer.tsx`, UI completa: `components/rest-timer.tsx`) e, quando ativado, também como uma **barra fixa acima das abas** (`components/mini-timer-bar.tsx`, montada em `(tabs)/_layout.tsx`).

Usa **`@notifee/react-native`** (não `expo-notifications` — removido do projeto). Motivo: precisa vibrar continuamente mesmo com a tela desligada/app minimizado, o que exige um serviço em primeiro plano de verdade.

### Barra fixa (`MiniTimerBar`)

Switch em Extras > Timer ("Barra fixa") liga/desliga; junto dele, um seletor do preset padrão que a barra assume quando ativada. A barra fica **colada acima da tab bar de verdade** (não é um overlay flutuante por cima do conteúdo): `(tabs)/_layout.tsx` aumenta a altura do `tabBarStyle` (soma `MINI_TIMER_BAR_HEIGHT`) e usa `paddingTop` igual a essa altura — isso empurra os ícones das abas pra baixo, sobrando o espaço de cima livre pra barra, e o React Navigation **encolhe a área de conteúdo de toda tela sob as abas automaticamente** (não precisa mexer em cada tela individualmente pra abrir espaço).

### Notificação "em andamento" + notificação de conclusão (duas notificações separadas)

- **`RUNNING_NOTIFICATION_ID`** — exibida assim que o timer começa (`showRunningNotification`), com `showChronometer: true` + `chronometerDirection: 'down'` (cronômetro nativo do Android, contando sozinho, sem JS mantendo ela atualizada). Canal próprio, baixa importância, **sem som/vibração** (`RUNNING_CHANNEL_ID`) — só um indicador visual "ainda rodando".
- **`TIMER_NOTIFICATION_ID`** — o alarme de verdade, um `createTriggerNotification` com `AlarmType.SET_ALARM_CLOCK` (mesmo mecanismo de despertador nativo, imune ao Doze) e `asForegroundService: true`. Quando dispara, o serviço em primeiro plano (`notifee.registerForegroundService`, registrado em escopo de módulo) cancela a notificação "em andamento" e começa a vibrar.
- **Vibração limitada a 30s** (`MAX_VIBRATION_MS`) — `Vibration.vibrate(pattern, true)` não tem limite embutido; sem o `setTimeout` cancelando sozinho, vibra pra sempre até o usuário interagir.
- **Rede de segurança no JS** (`timerStore.ts`, dentro de `tick()`) — se por algum motivo o alarme nativo nunca disparar de verdade (permissão de alarme exato negada, processo morto, etc.), o app, ao perceber localmente (via `AppState` ao reabrir) que o tempo já passou, cancela a notificação "em andamento" sozinho — sem isso, o cronômetro nativo continua contando pra números negativos pra sempre, já que nada mais o avisa pra parar.

### Permissão de "Alarmes e lembretes" (`SCHEDULE_EXACT_ALARM`, Android 12+)

Diferente de `POST_NOTIFICATIONS`, não tem popup simples — só uma tela de Configurações que o usuário ativa manualmente por app. `ensureAlarmPermission()` verifica via `notifee.getNotificationSettings()` (`settings.android.alarm`) e chama `notifee.openAlarmPermissionSettings()` se não estiver `ENABLED`, antes de todo `scheduleTimerAlarm`. Sem essa permissão, o Android tende a **adiar a entrega do alarme** até o app voltar ao primeiro plano — sintoma: "só vibra quando eu abro o app de novo".

### Canais Android — imutáveis, versionados, e **precisam ser limpos manualmente**

- Mudar `vibrationPattern`/`sound`/`importance` de um canal já criado no aparelho não tem efeito nenhum ali — é preciso versionar o `channelId` (`CHANNEL_VERSION`) pra forçar um canal novo.
- **Bug real corrigido**: cada bump de `CHANNEL_VERSION` cria canais novos mas **nunca apaga os antigos** (canal Android sobrevive a rebuild/update do app, só some com desinstalação completa) — usuário viu ~9 "Timer de descanso" duplicados na tela de notificações do celular depois de várias reinstalações ao longo da sessão. Fix: `pruneOldChannels()` roda dentro de `ensureChannels()` a cada `scheduleTimerAlarm`, lista todos os canais existentes (`notifee.getChannels()`) e apaga (`notifee.deleteChannel()`) qualquer um com prefixo `timer-alarm-`/`timer-running-` que não seja um dos IDs da versão atual.
- **`vibrationPattern` do notifee exige array só com valores positivos e quantidade par** — diferente da `Vibration` pura do RN, que aceita `0` inicial como "atraso".
- **Setup de canal roda uma vez só por sessão** (`channelsReadyPromise` cacheado) — protegido por número de geração (`generation`, em `timerStore.ts`) contra condição de corrida em cliques rápidos de Play/Pause.

### Ícone de notificação

**Bug real corrigido**: notificação aparecia com uma caixinha preta em vez de ícone. Notificação Android precisa de um ícone **monocromático** (silhueta branca, fundo transparente) — o sistema mascara qualquer cor, e sem um ícone dedicado ele tenta usar o ícone colorido do app (launcher), que vira essa caixa preta. Ícone gerado (mesmo halter do `AuthBadge`, branco) em `assets/images/notification-icon.png`, copiado pro recurso Android via plugin (`withNotificationIcon.js`, ver abaixo) e referenciado como `smallIcon: 'ic_notification'` nas duas notificações.

### Bug real corrigido — funciona em debug (Android Studio), quebra no APK de release

Build de **release** roda R8/minificação (debug não roda por padrão) — como nada no código do app referencia as classes do notifee pelo nome (só o `AndroidManifest.xml`, via `<service android:name="app.notifee.core.ForegroundService">`), o R8 pode remover/renomear essas classes sem perceber que são necessárias, quebrando o serviço em primeiro plano **silenciosamente**, só em release. Fix: regras `-keep class app.notifee.core.** { *; }` e `-keep class io.invertase.notifee.** { *; }` em `android/app/proguard-rules.pro` (durável via plugin `withNotifeeProguardRules.js`, já que `android/` é gerado/descartável).

### `android/` é descartável (gitignored) — mudanças nativas do notifee viram plugins de config

Como a pasta `android/` não é versionada (Continuous Native Generation — `npx expo prebuild --clean` recria do zero), qualquer ajuste nativo precisa ser um **plugin de Expo config** em `plugins/`, referenciado em `app.json > plugins`, senão some no próximo prebuild. Quatro plugins criados pra esse recurso, nenhum tem plugin oficial do notifee equivalente:
- **`withNotifeeMavenRepo.js`** — `app.notifee:core` só existe num Maven repo **local**, empacotado dentro do próprio `node_modules` (não está no Google Maven/Maven Central/JitPack). O próprio `build.gradle` do notifee tenta se registrar via `rootProject.allprojects{repositories{...}}`, mas isso roda tarde demais quando o Gradle usa `--configure-on-demand` (flag que `expo run:android` sempre passa) — bug antigo, nunca corrigido upstream (o notifee está arquivado/descontinuado). Fix: registra o repo local diretamente no `build.gradle` raiz.
- **`withNotifeeForegroundService.js`** — declara `<service android:name="app.notifee.core.ForegroundService" android:foregroundServiceType="systemExempted">` no manifest (obrigatório a partir do Android 14; `systemExempted` é o tipo recomendado pra apps de alarme/timer que seguram `SCHEDULE_EXACT_ALARM`).
- **`withNotificationIcon.js`** — copia `assets/images/notification-icon.png` pra `android/app/src/main/res/drawable/ic_notification.png` a cada prebuild.
- **`withNotifeeProguardRules.js`** — injeta as regras de `-keep` (ver bug de release acima) em `android/app/proguard-rules.pro`.

### Permissões necessárias (`app.json > android.permissions`)

`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`.

### Restrições específicas de fabricante (MIUI/Xiaomi e similares)

Mesmo com tudo acima correto, fabricantes como Xiaomi têm restrições **próprias**, além das do Android puro, que podem impedir o serviço em segundo plano de funcionar: "Início automático" (Autostart) desativado pro app, e economia de bateria "restrita" em vez de "sem restrições". Não tem como contornar isso via código — é o usuário quem precisa liberar manualmente nas Configurações do aparelho.

---

## Toast (`app/src/components/toast.tsx`)

`showToast(mensagem, tipo?)` — `'success'` (verde, padrão) ou `'error'` (vermelho). **Ancorado no topo da tela** (`insets.top + gap`), não mais acima da tab bar — mudou depois que a barra fixa do timer passou a ocupar esse espaço (ver seção do Timer); embaixo ficava fácil de esconder atrás da `MiniTimerBar` ou das próprias abas.

## LoadingView (`app/src/components/loading-view.tsx`)

Logo do app (`AuthBadge`) pulsando sobre fundo com leve tom verde — usado na checagem de auth e em qualquer espera. Evitar `return null` puro em qualquer tela de carregamento — deixa a UI parecendo travada, principalmente durante o cold start do Render.

## Fundo nativo (`android/app/src/main/res/values/styles.xml`)

`AppTheme` tem `android:windowBackground` setado pra mesma cor da splash (`@color/splashscreen_background`) — sem isso, qualquer vão entre a splash sumir e o React desenhar algo mostra a cor padrão do Android (preto no tema escuro). Mudança nativa, só some do teste depois de rebuild completo (`expo run:android`), reload de JS não pega.

## Fonte (Poppins) e identidade visual

- **`@expo-google-fonts/poppins`** carregado via `useFonts` em `app/_layout.tsx` (splash nativa só libera quando tema **e** fonte estiverem prontos — evita flash trocando de fonte na tela). `constants/theme.ts` exporta `FontFamily` (`regular`/`medium`/`semibold`/`bold`/`extrabold`) mapeado nos estilos de `ThemedText`.
- **Cada peso do Poppins é um arquivo/família separado** (não é fonte variável) — `ThemedText` seta `fontFamily` direto por `type`, **sem** `fontWeight` junto. Texto que força negrito via `fontWeight` inline (fora do `type` do `ThemedText`) não pega o peso certo de forma confiável, principalmente no Android — poucos lugares assim ainda existem no app (ex: número do timer), aceito como imperfeição cosmética menor.
- **Ícone do app e splash** — antes eram o ícone padrão de template do Expo (símbolo azul), nunca customizados. Agora replicam o `AuthBadge` (badge verde em gradiente + halter branco + faísca laranja), gerados como PNG a partir de um SVG desenhado à mão (halter = 3 retângulos arredondados, sem depender de fonte de ícone). Cor de fundo da splash e do ícone adaptativo do Android trocada de azul (`#208AEF`)/azul claro (`#E6F4FE`) pro verde da marca (`#15b580`). `assets/expo.icon` (bundle de ícone multi-aparência do iOS 18, também nunca customizado) foi removido — iOS usa o `icon.png` geral agora.

---

## Deploy e build

- **API migrando do Render pro Northflank** — motivo: plano free do Render hiberna após inatividade (cold start de dezenas de segundos); Northflank tem um plano grátis ("Developer Sandbox") que fica **sempre ligado**, sem hibernar. MongoDB continua o mesmo (Atlas, `0.0.0.0/0` liberado em Network Access) — só o host da API muda, o banco não se move.
  - **Deployment target**: "Northflank Cloud" (não "Bring Your Own Cloud" — essa exige conta própria em AWS/GCP/etc., sem tier grátis).
  - **Build**: usar **Buildpack (Heroku)**, não Dockerfile (a API não tem um). Buildpacks só rodam o passo de build TypeScript automaticamente se existir um script `heroku-postbuild` — `api/package.json` ganhou `"heroku-postbuild": "tsc"` só por causa disso (idêntico ao `build` já existente, é uma convenção de nome que o buildpack procura).
  - **Root directory do build**: apontar pra `api` (o repo tem `app/` e `api/` juntos).
  - **Porta**: não colar `PORT=4000` nas environment variables do Northflank — a plataforma injeta `PORT` sozinha com o valor configurado na aba Networking (ex: 8080), e o código já lê de `process.env.PORT` (`api/src/utils/env.ts`). Colar um `PORT` manual por cima conflita com o que o Networking configurou.
  - **Environment variables**: recriar todas as do `.env` (Mongo, JWT, Resend, R2, Gmail, `CORS_ORIGIN`) — não dependem de qual host roda a API.
  - URL fica no formato `https://site--<projeto>--<hash>.code.run` — testar `/api/health` antes de trocar o `EXPO_PUBLIC_API_URL` do app.
- **`.env` do app fica gravado dentro do APK no build** — não é lido em runtime. Pra local: `http://10.0.2.2:4000` (só funciona no emulador). Pra produção: a URL da API hospedada (Render ou Northflank).
- **Gerar APK menor**: `gradle.properties` tem `android.enableMinifyInReleaseBuilds`/`enableShrinkResourcesInReleaseBuilds` ligados (só afeta `release`, não o `debug` do emulador). Pra instalar no celular físico, sempre usar `-PreactNativeArchitectures=arm64-v8a` (senão builda pra 4 arquiteturas, ~4x o tamanho — não mudar o padrão do `gradle.properties`, isso quebraria o emulador x86).
- **Minificação de release pode quebrar módulo nativo silenciosamente** (ver bug do notifee na seção do Timer) — se algo funciona no `expo run:android`/Android Studio (debug, sem minificação) mas falha só no APK instalado (release, minificado), suspeitar de regra de ProGuard faltando antes de qualquer outra coisa.
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

---

## Web (`web/`)

Companion desktop do app RN — mesma API, mesmo banco, sem timer de descanso (não faz sentido fora do celular). Stack: Vite + Vue 3 + Vuetify 3, **sem** Nuxt/SSR (SPA pura, `vue-router` com `createWebHistory`, Pinia só pra auth). Layout de dashboard com sidebar fixa (verde, gradiente, mesma cor da marca `#15b580`) em vez do layout de abas do RN — funcionalidade replicada, visual não.

### Autenticação — dual-mode na mesma API Express

O app RN usa Bearer token no body/header (token de acesso em memória, refresh no `SecureStore`) — isso **não podia quebrar**. Em vez de criar um servidor proxy/BFF separado (chegou a ser tentado numa sessão anterior com Nuxt, descartado), a própria API Express (`api/src`) ganhou suporte a cookies httpOnly **além** do Bearer existente:

- `utils/cookies.ts` — `setAuthCookies`/`clearAuthCookies` (`access_token`/`refresh_token`, `httpOnly`, `sameSite: 'lax'`, `secure` via `AUTH_COOKIE_SECURE` no `.env`).
- `middleware/requireAuth.ts` — aceita `Authorization: Bearer` (RN, como sempre) **ou**, se ausente, o cookie (web). Header tem prioridade.
- `routes/auth.ts` — `login`/`register` setam os cookies **além de** devolver os tokens no corpo (RN inalterado). `POST /refresh` aceita `refreshToken` do body (RN) **ou** do cookie (web, sem precisar mandar body nenhum). `logout` limpa os cookies.
- `app.ts` — `cors({ origin: env.corsOrigin, credentials: true })` — com `credentials: true` o pacote `cors` não aceita `origin: '*'`; `CORS_ORIGIN` no `.env` precisa ser a URL exata do `web/` (dev: `http://localhost:5173`).

O client HTTP do `web/` (`src/api/client.ts`) nunca guarda token nenhum em JS — `fetch` sempre com `credentials: 'include'`, um 401 dispara `POST /auth/refresh` (cookie viaja sozinho) e reexecuta a chamada original uma vez.

### Campos adicionados aos modelos Mongo (não-destrutivos)

Pra suportar reordenação por drag-and-drop no `web/`, `Exercicio` e `Categoria` ganharam `ordem: { type: Number, default: () => Date.now() }` — `GET /` de ambos passou a ordenar por `ordem, nome` em vez de só `nome`. Documentos existentes (criados antes do campo existir) ficam com `ordem` ausente/`0` até serem arrastados pela primeira vez, aí recebem um valor novo — sem migração necessária. `Categoria` também ganhou `descricao` opcional (mesmo padrão do `Exercicio.descricao`). RN não usa nenhum dos dois campos — não quebra, só reordena por algo que não é mais estritamente alfabético.

### Padrão de drag-and-drop — handle-only, não a linha inteira

**Bug real corrigido**: a linha inteira (`VListItem`/row) começava com `draggable="true"`, então qualquer gesto de clique com um mínimo de movimento em cima de um filho (chip de substituto, botão de editar/excluir, link do nome) podia ser sequestrado pelo `dragstart` do HTML5 DnD nativo em vez de disparar o clique normal. Fix aplicado em `ExerciciosPage.vue`, `CategoriasPage.vue` e `RefeicaoEditorPage.vue` (blocos): a linha usa `:draggable="dragHandleId === item.id"` (falso por padrão) e só o ícone de grip (`mdi-drag-vertical`) liga isso via `@mousedown`/`@mouseup` — o resto da linha volta a ser clicável normalmente. Reordenar calcula um `ordem` fracionário (média entre os vizinhos novos, ou ±1 na ponta) e persiste só o item movido via `PATCH` — não reescreve a lista inteira.

### `PageHeader.vue` + `usePageTitle` — título mora na topbar, não inline na página

Diferente do RN (cabeçalho dentro de cada tela), o `web/` tem uma `VAppBar` fixa (`layouts/AppShell.vue`) mostrando título/subtítulo da página atual. Cada página usa `<PageHeader title="..." subtitle="..." back="..." />`, que **não renderiza o título** — só registra o texto no composable `usePageTitle` (estado reativo module-level) via `watch(..., { immediate: true })`, e opcionalmente renderiza inline o botão de voltar e um slot de `#actions` (botões específicos da página, tipo "Nova categoria"). A topbar em si é só identidade + menu do usuário (Conta/Sair) — sem ações de página.

### Convenções visuais dos formulários

- **Label acima do campo, não label flutuante** — `VTextField`/`VSelect` sem prop `label`, com um `<label class="field-label">` próprio acima e `placeholder` dentro do campo. Padrão usado em `ExercicioForm.vue`, `RefeicaoEditorPage.vue`, `TreinoEditorPage.vue`, `ContaPage.vue`, `CategoriasPage.vue` — reaproveitar em telas novas em vez de voltar pro label flutuante padrão do Vuetify.
- **Badge circular colorido antes do título de cada `VCardTitle`** — `<span class="section-icon"><VIcon .../></span>`, 26-40px, fundo `rgba(var(--v-theme-primary), 0.14)`. Não usar ícone específico por categoria/grupo muscular (nome de categoria é texto livre, mapear pra ícone certo é frágil e já foi tentado e rejeitado no RN — ver `CategoryIcon` acima); usar sempre o mesmo ícone genérico.
- **Tema claro/escuro** — `useThemeMode` (`localStorage` key `gymbro-theme-mode`), tema inicial lido de forma síncrona em `plugins/vuetify.ts` (não depois do mount) pra não ter flash de tema errado. Verde permanece o `primary` nos dois temas; só background/surface mudam.
