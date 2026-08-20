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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
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
  row: { gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
});
