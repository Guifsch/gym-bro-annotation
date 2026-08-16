import type { Refeicao } from '@/types/workout';
import { formatDateDisplay } from '@/utils/date';

export function countRefeicaoItens(refeicao: Refeicao): number {
  return refeicao.itens.length + refeicao.blocos.reduce((sum, bloco) => sum + bloco.itens.length, 0);
}

export function formatRefeicaoDates(dates: string[]): string {
  if (dates.length === 0) return 'Sem data';
  if (dates.length === 1) return formatDateDisplay(dates[0]);
  return `${dates.length} dias`;
}
