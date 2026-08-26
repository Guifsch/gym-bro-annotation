export interface Categoria {
  _id: string
  nome: string
  descricao?: string
  ordem?: number
}

export interface ExercicioImagem {
  url: string
  key: string
}

export interface ExercicioHistoricoEntry {
  _id: string
  nome?: string
  descricao?: string
  sets?: number
  reps?: number
  pesoKg?: number
  alteradoEm: string
}

export interface Exercicio {
  _id: string
  categoriaId: string
  nome: string
  descricao?: string
  sets: number
  reps: number
  pesoKg: number
  cargaMaximaKg?: number
  ordem?: number
  substitutoIds: string[]
  capa?: ExercicioImagem
  videoUrls: string[]
  imagens: ExercicioImagem[]
}

export interface Treino {
  _id: string
  nome: string
  exercicioIds: string[]
  createdAt?: string
}

export interface SessaoEntry {
  _id: string
  exercicioId: string
  sets?: number
  reps?: number
  pesoKg?: number
  updatedAt?: string
}

export interface Sessao {
  _id: string
  treinoId: string
  date: string
  entries: SessaoEntry[]
}

export interface RefeicaoItem {
  _id: string
  nome: string
}

export interface RefeicaoBloco {
  _id: string
  nome: string
  horario?: string
  itens: RefeicaoItem[]
}

export interface Refeicao {
  _id: string
  nome: string
  dates: string[]
  blocos: RefeicaoBloco[]
  observacoes?: string
}

export interface AttendanceSummary {
  year: string
  total: number
  perMonth: number[]
}

export interface BodyMetricMedidas {
  cintura?: number
  quadril?: number
  peito?: number
  pescoco?: number
  bracoEsquerdo?: number
  bracoDireito?: number
  coxaEsquerda?: number
  coxaDireita?: number
}

export interface BodyMetricEntry {
  _id: string
  date: string
  pesoKg?: number
  medidas?: BodyMetricMedidas
  observacoes?: string
}

export interface BodyGoal {
  _id: string
  nome?: string
  pesoMetaKg: number
  createdAt: string
}

export interface BodyGoalSummary extends BodyGoal {
  latestPesoKg: number | null
}
