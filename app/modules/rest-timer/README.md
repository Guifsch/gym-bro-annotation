# rest-timer (módulo Expo local, só Android)

Timer de descanso que continua rodando fora do app: notificação com contagem regressiva nativa,
botões de Pausar/Retomar/Zerar que funcionam com o JS morto, vibração de alarme aos 00:00 mesmo
com a tela bloqueada, e a bolinha flutuante por cima de outros apps.

- Autolinkado automaticamente (`expo-modules-autolinking` varre `./modules` por padrão) — não
  precisa de config plugin nem de mexer no `android/`, que é gerado/gitignored (CNG).
- **O wrapper JS não está aqui**, e sim em `src/native/rest-timer.ts`, para não precisar de um
  alias novo no `tsconfig.json` (`@/*` aponta só para `src/`).
- Ver a seção "Timer de descanso" no `CLAUDE.md` da raiz para o porquê de cada decisão.
