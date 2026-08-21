import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Exercicio } from '@/types/workout';

interface SubstitutoPickerProps {
  exercicios: Exercicio[];
  categoriaNomeById: Record<string, string>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/** Multi-select for "exercícios substitutos" — a closed trigger showing selected exercises as
 * removable chips (pinned there as soon as picked, instead of buried in a scroll of everything),
 * and a modal with the full grouped-by-category list to pick more from. Listing every exercise
 * inline in the form got messy fast, hence the modal. */
export function SubstitutoPicker({ exercicios, categoriaNomeById, selectedIds, onChange }: SubstitutoPickerProps) {
  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selected = useMemo(
    () => exercicios.filter((e) => selectedIds.includes(e._id)),
    [exercicios, selectedIds]
  );

  const gruposPorCategoria = useMemo(() => {
    const map = new Map<string, Exercicio[]>();
    for (const exercicio of exercicios) {
      const arr = map.get(exercicio.categoriaId) ?? [];
      arr.push(exercicio);
      map.set(exercicio.categoriaId, arr);
    }
    return Array.from(map.entries())
      .map(([categoriaId, exerciciosDaCategoria]) => ({
        categoriaId,
        nome: categoriaNomeById[categoriaId] ?? 'Categoria removida',
        exercicios: exerciciosDaCategoria,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [exercicios, categoriaNomeById]);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
  }

  return (
    <>
      <View style={styles.chipRow}>
        {selected.map((exercicio) => (
          <View key={exercicio._id} style={[styles.chip, styles.chipSelected]}>
            <ThemedText type="small" style={styles.chipTextActive} numberOfLines={1}>
              {exercicio.nome}
            </ThemedText>
            <Pressable onPress={() => toggle(exercicio._id)} hitSlop={8}>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setModalVisible(true)} style={[styles.chip, styles.addChip, { borderColor: theme.border }]}>
          <Ionicons name="add" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {selected.length === 0 ? 'Adicionar substituto' : 'Adicionar'}
          </ThemedText>
        </Pressable>
      </View>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <ThemedView style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Exercícios substitutos</ThemedText>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selected.length > 0 && (
              <View style={styles.chipRow}>
                {selected.map((exercicio) => (
                  <View key={exercicio._id} style={[styles.chip, styles.chipSelected]}>
                    <ThemedText type="small" style={styles.chipTextActive} numberOfLines={1}>
                      {exercicio.nome}
                    </ThemedText>
                    <Pressable onPress={() => toggle(exercicio._id)} hitSlop={8}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {gruposPorCategoria.map((grupo) => (
                <View key={grupo.categoriaId} style={styles.grupo}>
                  <View style={styles.grupoHeader}>
                    <CategoryIcon nome={grupo.nome} size={16} />
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.grupoTitle}>
                      {grupo.nome.toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={styles.list}>
                    {grupo.exercicios.map((exercicio) => {
                      const isSelected = selectedIds.includes(exercicio._id);
                      return (
                        <Pressable key={exercicio._id} onPress={() => toggle(exercicio._id)}>
                          <View style={[styles.optionRow, { borderColor: isSelected ? Brand.primary : theme.border }]}>
                            <ThemedText style={{ flex: 1 }}>{exercicio.nome}</ThemedText>
                            {isSelected ? (
                              <View style={[styles.checkCircle, { backgroundColor: Brand.primary }]}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              </View>
                            ) : (
                              <View style={[styles.checkCircle, { borderColor: theme.border, borderWidth: 2 }]} />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    maxWidth: 200,
  },
  chipSelected: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipTextActive: { color: '#fff', fontWeight: '700', flexShrink: 1 },
  addChip: { paddingHorizontal: Spacing.two },
  modalContainer: { flex: 1 },
  modalSafeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalScrollContent: { gap: Spacing.four, paddingBottom: Spacing.five },
  grupo: { gap: Spacing.two },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingLeft: Spacing.one },
  grupoTitle: { letterSpacing: 0.5 },
  list: { gap: Spacing.two },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
