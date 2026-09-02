import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CategoryJumpBarProps {
  categorias: { categoriaId: string; nome: string }[];
  onSelect: (categoriaId: string) => void;
}

/** Horizontal row of category chips — tapping one scrolls the page to that category's section.
 * Meant for long grouped-by-category lists (exercise listing, treino's exercise picker). */
export function CategoryJumpBar({ categorias, onSelect }: CategoryJumpBarProps) {
  const theme = useTheme();
  if (categorias.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.row}>
      {categorias.map((categoria) => (
        <Pressable
          key={categoria.categoriaId}
          onPress={() => onSelect(categoria.categoriaId)}
          style={[styles.chip, { borderColor: theme.border }]}>
          <ThemedText type="small">{categoria.nome}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Negative marginBottom pulls only the gap *after* this bar (between it and whatever list/section
  // header follows) — the screen's own `gap` (e.g. `safeArea`'s) applies uniformly before and after,
  // so this is the only way to shrink one side without touching the other.
  scrollView: { flexGrow: 0},
  row: { gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one},
});
