import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type UpsertEntryParams, getSessao, getTreino, listCategorias, listExercicios } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { CategoryJumpBar } from '@/components/category-jump-bar';
import { EmptyState } from '@/components/empty-state';
import { ExercicioThumbnail } from '@/components/exercicio-thumbnail';
import { InlineLogEditor } from '@/components/inline-log-editor';
import { LoadingView } from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useCategoryScroll } from '@/hooks/useCategoryScroll';
import { mergeSessaoEntry } from '@/offline/mergeSessaoEntry';
import { enqueueUpsertSessaoEntry } from '@/offline/queue';
import type { Categoria, Exercicio, LogFields, Sessao, Treino } from '@/types/workout';
import { formatDateDisplay } from '@/utils/date';

export default function SessaoDetalheScreen() {
  const { date, sessaoId } = useLocalSearchParams<{ date: string; sessaoId: string }>();

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [treino, setTreino] = useState<Treino | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  const { scrollViewRef, setGroupRef, scrollToGroup } = useCategoryScroll();

  const gruposPorCategoria = useMemo(() => {
    if (!treino) return [];
    const map = new Map<string, Exercicio[]>();
    for (const exercicioId of treino.exercicioIds) {
      const exercicio = exercicioById[exercicioId];
      if (!exercicio) continue;
      const arr = map.get(exercicio.categoriaId) ?? [];
      arr.push(exercicio);
      map.set(exercicio.categoriaId, arr);
    }
    return Array.from(map.entries()).map(([categoriaId, exerciciosDaCategoria]) => ({
      categoriaId,
      nome: categoriaNomeById[categoriaId] ?? 'Categoria removida',
      exercicios: exerciciosDaCategoria,
    }));
  }, [treino, exercicioById, categoriaNomeById]);

  function handleSaveFields(exercicio: Exercicio, fields: LogFields) {
    if (!sessao || Object.keys(fields).length === 0) return;

    const params: UpsertEntryParams = { sessaoId: sessao._id, exercicioId: exercicio._id, ...fields };
    setSessao((current) => (current ? mergeSessaoEntry(current, exercicio, params) : current));
    void enqueueUpsertSessaoEntry(params);
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
        <BackHeader title={treino.nome} subtitle={formatDateDisplay(date)} />

        {gruposPorCategoria.length === 0 ? (
          <ThemedText type="small">
            Este treino não tem exercícios vinculados ainda (edite em Exercícios &gt; Treinos).
          </ThemedText>
        ) : (
          <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <CategoryJumpBar
              categorias={gruposPorCategoria.map((g) => ({ categoriaId: g.categoriaId, nome: g.nome }))}
              onSelect={scrollToGroup}
            />
            {gruposPorCategoria.map((grupo) => (
              <View key={grupo.categoriaId} ref={setGroupRef(grupo.categoriaId)} style={styles.grupo}>
                <View style={styles.grupoHeader}>
                  <CategoryIcon nome={grupo.nome} size={16} />
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.grupoTitle}>
                    {grupo.nome.toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.exerciciosList}>
                  {grupo.exercicios.map((exercicio) => {
                    const entry = sessao.entries.find((e) => e.exercicioId === exercicio._id);
                    const sets = entry?.sets ?? exercicio.sets;
                    const reps = entry?.reps ?? exercicio.reps;
                    const pesoKg = entry?.pesoKg ?? exercicio.pesoKg;
                    return (
                      <View key={exercicio._id} style={styles.exercicioWrap}>
                        <Pressable
                          onPress={() => router.push(`/(tabs)/calendario/${date}/${sessaoId}/${exercicio._id}`)}>
                          <Card style={styles.exercicioRow}>
                            <ExercicioThumbnail exercicio={exercicio} categoriaNome={grupo.nome} size={30} />
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
                          onSaveFields={(fields) => handleSaveFields(exercicio, fields)}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { paddingBottom: Spacing.five, gap: Spacing.four },
  grupo: { gap: Spacing.two },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingLeft: Spacing.one },
  grupoTitle: { letterSpacing: 0.5 },
  exerciciosList: { gap: Spacing.two },
  exercicioWrap: { gap: Spacing.one },
  exercicioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  exercicioText: { flex: 1, gap: 2 },
  substitutoList: { gap: 2, marginTop: 2 },
  substitutoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  substitutoText: { color: Brand.primary, textDecorationLine: 'underline' },
});
