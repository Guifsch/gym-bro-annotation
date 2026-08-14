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

export interface SessaoEntry {
  _id: string;
  exercicioId: string;
  sets?: number;
  reps?: number;
  pesoKg?: number;
  updatedAt?: string;
}

export interface Sessao {
  _id: string;
  treinoId: string;
  date: string;
  entries: SessaoEntry[];
}

export interface DiaTreino {
  _id: string;
  treinoId: string;
  treinoNome: string;
  date: string;
}

export interface TimerPreset {
  _id: string;
  seconds: number;
}
