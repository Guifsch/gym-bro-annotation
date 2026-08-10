export interface Categoria {
  _id: string;
  nome: string;
}

export interface Exercicio {
  _id: string;
  categoriaId: string;
  nome: string;
  descricao?: string;
  sets: number;
  reps: number;
  pesoKg: number;
  imagemUrl?: string;
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
