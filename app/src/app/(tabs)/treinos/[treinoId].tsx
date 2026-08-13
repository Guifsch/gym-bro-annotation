import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteTreino, getTreino, listCategorias, listExercicios, updateTreino } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { EmptyState } from '@/components/empty-state';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { LoadingView } from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Categoria, Exercicio, Treino } from '@/types/workout';

export default function TreinoEditorScreen() {
  const { treinoId } = useLocalSearchParams<{ treinoId: string }>();
  const theme = useTheme();

  const [treino, setTreino] = useState<Treino | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [savingNome, setSavingNome] = useState(false);

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

  const categoriaNomeById = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c._id, c.nome])),
    [categorias]
  );

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
      router.replace('/(tabs)/treinos');
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

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <LabeledTextField label="Nome do treino" value={nome} onChangeText={setNome} maxLength={120} />
            </View>
            <GradientButton title="Salvar" onPress={handleSaveNome} loading={savingNome} disabled={!nome.trim()} />
          </Card>

          <ThemedText type="smallBold">Exercícios</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Toque para vincular ou desvincular deste treino.
          </ThemedText>

          {exercicios.length === 0 ? (
            <EmptyState icon="barbell-outline" title="Nenhum exercício cadastrado ainda (crie na tab Exercícios)." />
          ) : (
            <View style={styles.list}>
              {exercicios.map((item) => {
                const linked = treino.exercicioIds.includes(item._id);
                const categoriaNome = categoriaNomeById[item.categoriaId] ?? 'Categoria';
                return (
                  <Pressable key={item._id} onPress={() => handleToggleExercicio(item._id)}>
                    <Card style={[styles.exercicioRow, linked && { borderColor: Brand.primary, borderWidth: 2 }]}>
                      <CategoryIcon nome={categoriaNome} />
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold">{item.nome}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {categoriaNome}
                        </ThemedText>
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
              })}
            </View>
          )}

          <Pressable onPress={handleDeleteTreino} style={styles.dangerLink}>
            <Ionicons name="trash-outline" size={16} color="#e53935" />
            <ThemedText style={styles.dangerText}>Excluir treino</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  list: { gap: Spacing.two },
  exercicioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  dangerText: { color: '#e53935' },
});
