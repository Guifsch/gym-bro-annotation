import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessao, getTreino, listCategorias, listExercicios } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { EmptyState } from '@/components/empty-state';
import { LoadingView } from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Categoria, Exercicio, Sessao, Treino } from '@/types/workout';
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
            Este treino não tem exercícios vinculados ainda (edite na tab Treinos).
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {gruposPorCategoria.map((grupo) => (
              <View key={grupo.categoriaId} style={styles.grupo}>
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
                      <Pressable
                        key={exercicio._id}
                        onPress={() => router.push(`/(tabs)/calendario/${date}/${sessaoId}/${exercicio._id}`)}>
                        <Card style={styles.exercicioRow}>
                          <CategoryIcon nome={grupo.nome} size={18} />
                          <View style={styles.exercicioText}>
                            <ThemedText type="smallBold">{exercicio.nome}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {sets}x{reps} · {pesoKg}kg
                            </ThemedText>
                          </View>
                        </Card>
                      </Pressable>
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
  exercicioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  exercicioText: { flex: 1, gap: 2 },
});
