import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessao, listCategorias, listExercicios } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { EmptyState } from '@/components/empty-state';
import { ExercicioEditForm, type ExercicioEditFormHandle } from '@/components/exercicio-edit-form';
import { FIXED_BOTTOM_BAR_SPACE, FixedBottomBar } from '@/components/fixed-bottom-bar';
import { GradientButton } from '@/components/gradient-button';
import { LoadingView } from '@/components/loading-view';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Categoria, Exercicio } from '@/types/workout';

export default function ExercicioDetalheScreen() {
  const { date, sessaoId, exercicioId } = useLocalSearchParams<{ date: string; sessaoId: string; exercicioId: string }>();

  const [exercicio, setExercicio] = useState<Exercicio | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const formRef = useRef<ExercicioEditFormHandle>(null);

  const load = useCallback(async () => {
    // `getSessao` is only an existence check here (a deleted session should 404 this whole
    // screen) — sets/reps/pesoKg live only on the exercício itself (see `ExercicioEditForm`).
    const [, exerciciosData, categoriasData] = await Promise.all([
      getSessao(sessaoId),
      listExercicios(),
      listCategorias(),
    ]);
    const exercicioData = exerciciosData.find((e) => e._id === exercicioId) ?? null;
    if (!exercicioData) throw new Error('Exercício não encontrado');

    setExercicios(exerciciosData);
    setCategorias(categoriasData);
    setExercicio(exercicioData);
  }, [sessaoId, exercicioId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setNotFound(false);
      load()
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }, [load])
  );

  if (notFound) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <BackHeader title="Exercício removido" />
          <EmptyState
            icon="alert-circle-outline"
            title="Este exercício ou sessão não existe mais."
            actionLabel="Voltar"
            onAction={() => router.replace(`/(tabs)/calendario/${date}/${sessaoId}`)}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loading || !exercicio) {
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
        <BackHeader title="Exercício" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ExercicioEditForm
            key={exercicio._id}
            ref={formRef}
            exercicio={exercicio}
            categorias={categorias}
            exercicios={exercicios}
            onExercicioChange={setExercicio}
          />
        </ScrollView>
      </SafeAreaView>

      <FixedBottomBar>
        <GradientButton title="Salvar alterações" onPress={() => formRef.current?.save()} />
      </FixedBottomBar>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: FIXED_BOTTOM_BAR_SPACE },
});
