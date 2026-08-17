import type { ZodError, ZodIssue } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome',
  descricao: 'Descrição',
  categoriaId: 'Categoria',
  sets: 'Sets',
  reps: 'Repetições',
  pesoKg: 'Peso',
  cargaMaximaKg: 'Carga máxima',
  videoUrl: 'Vídeo',
  observacoes: 'Observações',
  horario: 'Horário',
  itens: 'Itens',
  blocos: 'Blocos',
  dates: 'Dias vinculados',
  email: 'E-mail',
  password: 'Senha',
  name: 'Nome',
  code: 'Código',
};

function formatIssue(issue: ZodIssue): string {
  const field = issue.path.length > 0 ? String(issue.path[issue.path.length - 1]) : null;
  const label = field ? (FIELD_LABELS[field] ?? field) : null;

  let detail = issue.message;
  if (issue.code === 'too_big') {
    detail = issue.type === 'string' ? `no máximo ${issue.maximum} caracteres` : `no máximo ${issue.maximum}`;
  } else if (issue.code === 'too_small') {
    detail = issue.type === 'string' ? `no mínimo ${issue.minimum} caracteres` : `no mínimo ${issue.minimum}`;
  }

  return label ? `${label}: ${detail}` : detail;
}

export function formatZodError(err: ZodError): string {
  const [first] = err.issues;
  return first ? formatIssue(first) : 'Dados inválidos';
}
