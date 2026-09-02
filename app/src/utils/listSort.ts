export type ListSortBy = 'ordem' | 'nome-asc' | 'nome-desc';

export const LIST_SORT_OPTIONS: { label: string; value: ListSortBy }[] = [
  { label: 'Padrão', value: 'ordem' },
  { label: 'Nome A-Z', value: 'nome-asc' },
  { label: 'Nome Z-A', value: 'nome-desc' },
];

/** `'ordem'` is a no-op — the caller's list is expected to already be in its natural/default order
 * (e.g. the server's own sort, or a treino's `exercicioIds` array order). `getNome` is an accessor
 * rather than assuming `item.nome` because some list items don't have a plain required `nome`
 * (e.g. a `BodyGoal`'s `nome` is optional — the caller supplies its own fallback display string). */
export function sortByNome<T>(list: T[], sortBy: ListSortBy, getNome: (item: T) => string): T[] {
  if (sortBy === 'ordem') return list;
  const sorted = [...list].sort((a, b) => getNome(a).localeCompare(getNome(b)));
  return sortBy === 'nome-desc' ? sorted.reverse() : sorted;
}

export function matchesSearch(nome: string, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return nome.toLowerCase().includes(term);
}
