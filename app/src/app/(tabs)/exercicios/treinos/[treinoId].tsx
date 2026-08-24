import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import { cloneTreino, deleteTreino, getTreino, listCategorias, listExercicios, updateTreino } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { CategoryJumpBar } from '@/components/category-jump-bar';
import { EmptyState } from '@/components/empty-state';
import { ExercicioThumbnail } from '@/components/exercicio-thumbnail';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { LoadingView } from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Categoria, Exercicio, Treino } from '@/types/workout';

interface CategoriaSection {
  categoriaId: string;
  nome: string;
  data: Exercicio[];
}

export default function TreinoEditorScreen() {
  const { treinoId } = useLocalSearchParams<{ treinoId: string }>();
  const theme = useTheme();

  const [treino, setTreino] = useState<Treino | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [savingNome, setSavingNome] = useState(false);
  const [cloning, setCloning] = useState(false);

  const load = useCallback(async () => {
    const [treinoData, exerciciosData, categoriasData] = await Promise.all([
      getTreino(treinoId),
      listExercicios(),
      listCategorias(),
    ]);
    setTreino(treinoData);
    setNome(treinoData.nome);
    setExercicios(exerciciosData);
    setCategorias(categoriasData);
  }, [treinoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const sectionListRef = useRef<SectionList<Exercicio, CategoriaSection>>(null);
  const headerRefs = useRef<Record<string, View | null>>({});

  const categoriaNomeById = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c._id, c.nome])),
    [categorias]
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

  const sections = useMemo<CategoriaSection[]>(
    () => gruposPorCategoria.map((grupo) => ({ categoriaId: grupo.categoriaId, nome: grupo.nome, data: grupo.exercicios })),
    [gruposPorCategoria]
  );

  // Same fix as the other two grouped listings: `scrollToLocation` throws when the target section
  // hasn't been measured yet (silent in release builds, so the jump bar just did nothing) —
  // measure the header directly instead, via the SectionList's underlying native scroll node.
  function scrollToCategory(categoriaId: string) {
    const node = headerRefs.current[categoriaId];
    const scrollResponder = sectionListRef.current?.getScrollResponder();
    const nativeScrollRef = scrollResponder?.getNativeScrollRef();
    if (!node || !scrollResponder || !nativeScrollRef) return;
    node.measureLayout(
      nativeScrollRef,
      (_x, y) => scrollResponder.scrollTo({ y: Math.max(0, y - 8), animated: true }),
      () => {}
    );
  }

  async function handleSaveNome() {
    setSavingNome(true);
    try {
      const updated = await updateTreino(treinoId, { nome: nome.trim() });
      setTreino(updated);
      showToast('Salvo');
    } finally {
      setSavingNome(false);
    }
  }

  async function handleToggleExercicio(exercicioId: string) {
    if (!treino) return;
    const isLinked = treino.exercicioIds.includes(exercicioId);
    const exercicioIds = isLinked
      ? treino.exercicioIds.filter((id) => id !== exercicioId)
      : [...treino.exercicioIds, exercicioId];

    setTreino({ ...treino, exercicioIds });
    const updated = await updateTreino(treinoId, { exercicioIds });
    setTreino(updated);
  }

  async function performDeleteTreino() {
    try {
      await deleteTreino(treinoId);
      router.replace('/(tabs)/exercicios/treinos');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  function handleDeleteTreino() {
    Alert.alert('Excluir treino?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: performDeleteTreino },
    ]);
  }

  async function handleCloneTreino() {
    setCloning(true);
    try {
      const clone = await cloneTreino(treinoId);
      showToast('Treino clonado');
      router.push(`/(tabs)/exercicios/treinos/${clone._id}`);
    } catch (err) {
      Alert.alert('Não foi possível clonar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCloning(false);
    }
  }

  if (loading || !treino) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <LoadingView />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Editar treino" />

        {gruposPorCategoria.length > 0 && (
          <CategoryJumpBar
            categorias={gruposPorCategoria.map((g) => ({ categoriaId: g.categoriaId, nome: g.nome }))}
            onSelect={scrollToCategory}
          />
        )}

        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item._id}
          stickySectionHeadersEnabled
          initialNumToRender={100}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <Card style={styles.row}>
                <View style={{ flex: 1 }}>
                  <LabeledTextField label="Nome do treino" value={nome} onChangeText={setNome} maxLength={50} />
                </View>
                <GradientButton title="Salvar" onPress={handleSaveNome} loading={savingNome} disabled={!nome.trim()} />
              </Card>

              <ThemedText type="smallBold">Exercícios</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Toque para vincular ou desvincular deste treino.
              </ThemedText>
            </>
          }
          ListHeaderComponentStyle={styles.listHeader}
          ListEmptyComponent={
            <EmptyState icon="barbell-outline" title="Nenhum exercício cadastrado ainda (crie na tab Exercícios)." />
          }
          renderSectionHeader={({ section }) => (
            <View
              ref={(el) => {
                headerRefs.current[section.categoriaId] = el;
              }}
              style={[styles.grupoHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
              <CategoryIcon nome={section.nome} size={18} />
              <ThemedText type="smallBold" style={styles.grupoTitle}>
                {section.nome.toUpperCase()}
              </ThemedText>
            </View>
          )}
          renderItem={({ item, index, section }) => {
            const linked = treino.exercicioIds.includes(item._id);
            const isLastInSection = index === section.data.length - 1;
            return (
              <Pressable
                onPress={() => handleToggleExercicio(item._id)}
                style={[styles.itemWrap, isLastInSection && styles.itemWrapLastInSection]}>
                <Card style={[styles.exercicioRow, linked && { borderColor: Brand.primary, borderWidth: 1 }]}>
                  <ExercicioThumbnail exercicio={item} categoriaNome={section.nome} size={30} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{item.nome}</ThemedText>
                  </View>
                  <View
                    style={[
                      styles.checkCircle,
                      { borderColor: linked ? Brand.primary : theme.border },
                      linked && { backgroundColor: Brand.primary },
                    ]}>
                    {linked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </Card>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <View style={styles.secondaryRow}>
              <Pressable onPress={handleCloneTreino} disabled={cloning} hitSlop={8} style={styles.secondaryButton}>
                <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Clonar
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleDeleteTreino} hitSlop={8} style={styles.secondaryButton}>
                <Ionicons name="trash-outline" size={16} color="#e53935" />
                <ThemedText type="small" style={styles.dangerText}>
                  Excluir treino
                </ThemedText>
              </Pressable>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { paddingBottom: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  listHeader: { gap: Spacing.three, marginBottom: Spacing.three },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  grupoTitle: { fontSize: 16, letterSpacing: 0.6, color: Brand.primary },
  itemWrap: { marginTop: Spacing.two },
  itemWrapLastInSection: { marginBottom: Spacing.four },
  exercicioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.five,
    marginTop: Spacing.four,
  },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, padding: Spacing.one },
  dangerText: { color: '#e53935' },
});
