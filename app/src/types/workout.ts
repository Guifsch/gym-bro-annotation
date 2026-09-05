export interface Categoria {
  _id: string;
  nome: string;
}

export interface ExercicioImagem {
  url: string;
  key: string;
}

export interface Exercicio {
  _id: string;
  categoriaId: string;
  nome: string;
  descricao?: string;
  sets: number;
  reps: number;
  pesoKg: number;
  cargaMaximaKg?: number;
  substitutoIds: string[];
  capa?: ExercicioImagem;
  videoUrls: string[];
  imagens: ExercicioImagem[];
}

export interface ExercicioHistoricoEntry {
  _id: string;
  nome?: string;
  descricao?: string;
  sets?: number;
  reps?: number;
  pesoKg?: number;
  alteradoEm: string;
}

export interface Treino {
  _id: string;
  nome: string;
  exercicioIds: string[];
}

export type LogField = 'sets' | 'reps' | 'pesoKg';
export type LogFields = Partial<Record<LogField, number>>;

/** Marks that `treinoId` happened on `date` — no performance data of its own (see
 * `Exercicio.sets/reps/pesoKg` + `historico[]` for that, single source of truth since ago/2026). */
export interface Sessao {
  _id: string;
  treinoId: string;
  date: string;
}

export interface DiaTreino {
  _id: string;
  treinoId: string;
  treinoNome: string;
  date: string;
}

export interface RefeicaoItem {
  _id: string;
  nome: string;
}

export interface RefeicaoBloco {
  _id: string;
  nome: string;
  horario?: string;
  itens: RefeicaoItem[];
}

export interface Refeicao {
  _id: string;
  nome: string;
  dates: string[];
  blocos: RefeicaoBloco[];
  observacoes?: string;
}

export interface TimerPreset {
  _id: string;
  seconds: number;
}

export interface BodyMetricMedidas {
  cintura?: number;
  quadril?: number;
  peito?: number;
  pescoco?: number;
  bracoEsquerdo?: number;
  bracoDireito?: number;
  coxaEsquerda?: number;
  coxaDireita?: number;
}

export interface BodyMetricEntry {
  _id: string;
  date: string;
  pesoKg?: number;
  medidas?: BodyMetricMedidas;
  observacoes?: string;
}

export interface BodyGoal {
  _id: string;
  nome?: string;
  pesoMetaKg: number;
  createdAt: string;
}

/** What `GET /api/body-goals` returns — the base goal plus the most recent weight logged under
 * it (`null` if none yet), computed server-side so the list can show progress at a glance. */
export interface BodyGoalSummary extends BodyGoal {
  latestPesoKg: number | null;
}
