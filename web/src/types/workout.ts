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
