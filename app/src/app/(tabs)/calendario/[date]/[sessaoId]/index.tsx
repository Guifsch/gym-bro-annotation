import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessao, getTreino, listCategorias, listExercicios } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { CategoryJumpBar } from '@/components/category-jump-bar';
import { EmptyState } from '@/components/empty-state';
import { ExercicioThumbnail } from '@/components/exercicio-thumbnail';
import { HeaderSearchField } from '@/components/header-search-field';
import { InlineLogEditor } from '@/components/inline-log-editor';
import { LoadingView } from '@/components/loading-view';
import { SortMenuButton } from '@/components/sort-menu-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { enqueueUpdateExercicio } from '@/offline/queue';
import type { Categoria, Exercicio, LogFields, Sessao, Treino } from '@/types/workout';
import { formatDateDisplay } from '@/utils/date';
import { LIST_SORT_OPTIONS, matchesSearch, sortByNome, type ListSortBy } from '@/utils/listSort';

const PAGE_SIZE = 30;

interface CategoriaSection {
  categoriaId: string;
  nome: string;
  data: Exercicio[];
}

export default function SessaoDetalheScreen() {
  const theme = useTheme();
  const { date, sessaoId } = useLocalSearchParams<{ date: string; sessaoId: string }>();

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [treino, setTreino] = useState<Treino | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // The treino's own exercicioIds are already fully fetched (bounded by MAX_EXERCICIOS, cheap) —
  // this just reveals them into the SectionList 30 at a time on scroll, matching the infinite-scroll
  // UX used elsewhere, instead of paginating a network call that isn't actually needed here.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<ListSortBy>('ordem');

  const load = useCallback(async () => {
    const sessaoData = await getSessao(sessaoId);
    const [treinoData, exerciciosData, categoriasData] = await Promise.all([
      getTreino(sessaoData.treinoId),
      listExercicios(),
      listCategorias(),
    ]);
    setSessao(sessaoData);
    setTreino(treinoData);
    setExercicios(exerciciosData);
    setCategorias(categoriasData);
  }, [sessaoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setNotFound(false);
      // Not resetting `visibleCount` here on purpose: this refetch also runs when returning from
      // viewing/editing an exercise (to pick up any change), and resetting it back to `PAGE_SIZE`
      // would cut the revealed list back down below however far the user had actually scrolled,
      // losing their scroll position. It still starts fresh at `PAGE_SIZE` on a genuine first visit
      // to a session, since that comes from the `useState` initializer, not from here.
      load()
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }, [load])
  );

  const exercicioById = useMemo(() => Object.fromEntries(exercicios.map((e) => [e._id, e])), [exercicios]);
  const categoriaNomeById = useMemo(() => Object.fromEntries(categorias.map((c) => [c._id, c.nome])), [categorias]);

  // Same one-directional-storage-shown-both-ways logic as exercicios/lista.tsx — kept in sync
  // manually since it's a small memo, not worth extracting for two call sites.
  const substitutosDisplayById = useMemo(() => {
    const exercicioNomeById = Object.fromEntries(exercicios.map((e) => [e._id, e.nome]));
    const map: Record<string, { id: string; nome: string }[]> = {};

    function add(exercicioId: string, substitutoId: string) {
      const nome = exercicioNomeById[substitutoId];
      if (!nome) return;
      const list = map[exercicioId] ?? (map[exercicioId] = []);
      if (!list.some((s) => s.id === substitutoId)) list.push({ id: substitutoId, nome });
    }

    for (const exercicio of exercicios) {
      for (const substitutoId of exercicio.substitutoIds) {
        add(exercicio._id, substitutoId);
        add(substitutoId, exercicio._id);
      }
    }
    return map;
  }, [exercicios]);

  function handleGoToSubstituto(id: string) {
    router.push(`/(tabs)/calendario/${date}/${sessaoId}/${id}`);
  }

  const sectionListRef = useRef<SectionList<Exercicio, CategoriaSection>>(null);
  const headerRefs = useRef<Record<string, View | null>>({});

  const filteredSortedExercicios = useMemo(() => {
    const resolved = (treino?.exercicioIds ?? [])
      .map((id) => exercicioById[id])
      .filter((e): e is Exercicio => Boolean(e))
      .filter((e) => matchesSearch(e.nome, search));
    return sortByNome(resolved, sortBy, (e) => e.nome);
  }, [treino, exercicioById, search, sortBy]);

  const visibleExercicios = useMemo(
    () => filteredSortedExercicios.slice(0, visibleCount),
    [filteredSortedExercicios, visibleCount]
  );
  const hasMore = filteredSortedExercicios.length > visibleExercicios.length;

  function loadMore() {
    setVisibleCount((count) => count + PAGE_SIZE);
  }

  const gruposPorCategoria = useMemo(() => {
    const map = new Map<string, Exercicio[]>();
    for (const exercicio of visibleExercicios) {
      const arr = map.get(exercicio.categoriaId) ?? [];
      arr.push(exercicio);
      map.set(exercicio.categoriaId, arr);
    }
    return Array.from(map.entries()).map(([categoriaId, exerciciosDaCategoria]) => ({
      categoriaId,
      nome: categoriaNomeById[categoriaId] ?? 'Categoria removida',
      exercicios: exerciciosDaCategoria,
    }));
  }, [visibleExercicios, categoriaNomeById]);

  const sections = useMemo<CategoriaSection[]>(
    () => gruposPorCategoria.map((grupo) => ({ categoriaId: grupo.categoriaId, nome: grupo.nome, data: grupo.exercicios })),
    [gruposPorCategoria]
  );

  // `scrollToLocation` alone throws ("scrollToIndex should be used in conjunction with
  // getItemLayout or onScrollToIndexFailed") whenever the target section hasn't been measured
  // yet — silent in a release build (no redbox), so tapping the jump bar just did nothing. Measure
  // the header directly instead: `measureLayout` against the SectionList's underlying native
  // scroll node (same fix applied in exercicios/lista.tsx and treinos/[treinoId].tsx).
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

  function handleQuickUpdate(exercicio: Exercicio, fields: LogFields) {
    if (Object.keys(fields).length === 0) return;
    setExercicios((prev) => prev.map((e) => (e._id === exercicio._id ? { ...e, ...fields } : e)));
    void enqueueUpdateExercicio({ exercicioId: exercicio._id, fields });
  }

  if (notFound) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <BackHeader title="Treino removido" />
          <EmptyState
            icon="alert-circle-outline"
            title="Este treino ou sessão não existe mais."
            actionLabel="Voltar ao calendário"
            onAction={() => router.replace(`/(tabs)/calendario/${date}`)}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loading || !sessao || !treino) {
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
        <BackHeader
          title={treino.nome}
          subtitle={formatDateDisplay(date)}
          titleSlot={
            searchOpen ? (
              <HeaderSearchField value={search} onChangeText={setSearch} placeholder="Buscar exercício..." />
            ) : undefined
          }
          rightActions={
            treino.exercicioIds.length === 0 ? undefined : searchOpen ? (
              <Pressable
                onPress={() => {
                  setSearchOpen(false);
                  setSearch('');
                }}
                hitSlop={10}
                style={styles.headerIconButton}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            ) : (
              <View style={styles.headerActionsRow}>
                <Pressable onPress={() => setSearchOpen(true)} hitSlop={10} style={styles.headerIconButton}>
                  <Ionicons name="search" size={20} color={theme.text} />
                </Pressable>
                <SortMenuButton value={sortBy} options={LIST_SORT_OPTIONS} onChange={setSortBy} />
              </View>
            )
          }
        />

        {treino.exercicioIds.length === 0 ? (
          <ThemedText type="small">
            Este treino não tem exercícios vinculados ainda (edite em Exercícios &gt; Treinos).
          </ThemedText>
        ) : gruposPorCategoria.length === 0 ? (
          <EmptyState icon="search-outline" title="Nenhum exercício encontrado." />
        ) : (
          <>
            <CategoryJumpBar
              categorias={gruposPorCategoria.map((g) => ({ categoriaId: g.categoriaId, nome: g.nome }))}
              onSelect={scrollToCategory}
            />
            <SectionList
              ref={sectionListRef}
              sections={sections}
              keyExtractor={(item) => item._id}
              stickySectionHeadersEnabled
              initialNumToRender={100}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              onEndReachedThreshold={0.4}
              onEndReached={hasMore ? loadMore : undefined}
              renderSectionHeader={({ section }) => (
                <View
                  ref={(el) => {
                    headerRefs.current[section.categoriaId] = el;
                  }}
                  style={[
                    styles.grupoHeader,
                    { backgroundColor: theme.background, borderBottomColor: theme.border },
                  ]}>
                  <CategoryIcon nome={section.nome} size={18} />
                  <ThemedText type="smallBold" style={styles.grupoTitle}>
                    {section.nome.toUpperCase()}
                  </ThemedText>
                </View>
              )}
              renderItem={({ item: exercicio, index, section }) => {
                const { sets, reps, pesoKg } = exercicio;
                const isLastInSection = index === section.data.length - 1;
                return (
                  <View style={[styles.exercicioWrap, isLastInSection && styles.exercicioWrapLastInSection]}>
                    <Pressable onPress={() => router.push(`/(tabs)/calendario/${date}/${sessaoId}/${exercicio._id}`)}>
                      <Card style={styles.exercicioRow}>
                        <ExercicioThumbnail exercicio={exercicio} categoriaNome={section.nome} size={30} />
                        <View style={styles.exercicioText}>
                          <ThemedText type="smallBold">{exercicio.nome}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {sets}x{reps} · {pesoKg}kg
                          </ThemedText>
                          {substitutosDisplayById[exercicio._id] && (
                            <View style={styles.substitutoList}>
                              {substitutosDisplayById[exercicio._id].map((s) => (
                                <Pressable
                                  key={s.id}
                                  onPress={() => handleGoToSubstituto(s.id)}
                                  style={styles.substitutoRow}>
                                  <Ionicons name="swap-horizontal-outline" size={12} color={Brand.primary} />
                                  <ThemedText type="small" style={styles.substitutoText} numberOfLines={1}>
                                    {s.nome}
                                  </ThemedText>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                      </Card>
                    </Pressable>
                    <InlineLogEditor
                      key={`${exercicio._id}-${sets}-${reps}-${pesoKg}`}
                      sets={sets}
                      reps={reps}
                      pesoKg={pesoKg}
                      onSaveFields={(fields) => handleQuickUpdate(exercicio, fields)}
                    />
                  </View>
                );
              }}
            />
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { paddingBottom: Spacing.five },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center' },
  headerIconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  grupoTitle: { fontSize: 16, letterSpacing: 0.6, color: Brand.primary },
  exercicioWrap: { gap: 2, marginTop: Spacing.one },
  exercicioWrapLastInSection: { marginBottom: Spacing.three },
  exercicioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  exercicioText: { flex: 1, gap: 2 },
  substitutoList: { gap: 2, marginTop: 2 },
  substitutoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  substitutoText: { color: Brand.primary, textDecorationLine: 'underline' },
});
