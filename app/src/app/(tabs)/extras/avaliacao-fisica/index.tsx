import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import { createBodyGoal, deleteBodyGoal, listBodyGoalsPage } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { ListFooterSpinner } from '@/components/list-footer-spinner';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useTheme } from '@/hooks/use-theme';
import type { BodyGoalSummary } from '@/types/workout';
import { formatDateDisplay } from '@/utils/date';

export default function AvaliacaoFisicaListScreen() {
  const theme = useTheme();
  const {
    items: goals,
    setItems: setGoals,
    loading,
    loadingMore,
    hasMore,
    reload,
    loadMore,
  } = usePaginatedList(listBodyGoalsPage);
  const [newNome, setNewNome] = useState('');
  const [newMetaText, setNewMetaText] = useState('');
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function handleCreate() {
    const nome = newNome.trim();
    const pesoMetaKg = Number(newMetaText.replace(',', '.'));
    if (!Number.isFinite(pesoMetaKg) || pesoMetaKg <= 0) return;

    setCreating(true);
    try {
      const goal = await createBodyGoal({ id: Crypto.randomUUID(), nome: nome || undefined, pesoMetaKg });
      setNewNome('');
      setNewMetaText('');
      router.push(`/(tabs)/extras/avaliacao-fisica/${goal._id}`);
    } catch (err) {
      Alert.alert('Não foi possível criar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCreating(false);
    }
  }

  async function performDelete(goal: BodyGoalSummary) {
    try {
      await deleteBodyGoal(goal._id);
      setGoals((prev) => prev.filter((g) => g._id !== goal._id));
      showToast('Excluída');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  function handleDelete(goal: BodyGoalSummary) {
    Alert.alert(
      'Excluir meta?',
      'Essa ação não pode ser desfeita — todos os registros de peso e medidas dessa meta também serão excluídos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => performDelete(goal) },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Avaliação Física" />

        <FlatList
          data={goals}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={hasMore ? loadMore : undefined}
          ListHeaderComponent={
            <Card style={styles.formCard}>
              <ThemedText type="smallBold">Nova meta</ThemedText>
              <LabeledTextField
                label="Nome (opcional)"
                placeholder="Ex: Verão 2026"
                value={newNome}
                onChangeText={setNewNome}
                maxLength={50}
              />
              <LabeledTextField
                label="Meta de peso (kg)"
                value={newMetaText}
                onChangeText={setNewMetaText}
                keyboardType="decimal-pad"
                maxLength={3}
              />
              <GradientButton
                title="Criar meta"
                onPress={handleCreate}
                loading={creating}
                disabled={!newMetaText.trim()}
              />
            </Card>
          }
          ListHeaderComponentStyle={styles.formHeader}
          ListEmptyComponent={
            !loading ? <EmptyState icon="flag-outline" title="Nenhuma meta ainda. Crie a primeira acima." /> : null
          }
          ListFooterComponent={<ListFooterSpinner visible={loadingMore} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item: goal }) => (
            <SwipeableRow onDelete={() => handleDelete(goal)}>
              <Pressable onPress={() => router.push(`/(tabs)/extras/avaliacao-fisica/${goal._id}`)}>
                <Card style={styles.row}>
                  <View style={styles.iconBadge}>
                    <Ionicons name="flag-outline" size={22} color={Brand.primary} />
                  </View>

                  <View style={styles.rowContent}>
                    <ThemedText type="smallBold">{goal.nome || `Meta de ${goal.pesoMetaKg} kg`}</ThemedText>

                    <View style={styles.weightRow}>
                      {goal.latestPesoKg !== null && (
                        <>
                          <ThemedText type="small" themeColor="textSecondary">
                            {goal.latestPesoKg} kg
                          </ThemedText>
                          <Ionicons name="arrow-forward" size={12} color={theme.textSecondary} />
                        </>
                      )}
                      <View style={styles.targetPill}>
                        <ThemedText type="small" style={styles.targetPillText}>
                          {goal.pesoMetaKg} kg
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.createdAtRow}>
                      <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        Criada em {formatDateDisplay(goal.createdAt.slice(0, 10))}
                      </ThemedText>
                    </View>
                  </View>

                  <Pressable onPress={() => handleDelete(goal)} hitSlop={8} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={18} color="#e53935" />
                  </Pressable>
                  <Ionicons name="chevron-forward" size={20} color={Brand.primary} />
                </Card>
              </Pressable>
            </SwipeableRow>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { paddingBottom: Spacing.five },
  formCard: { gap: Spacing.two },
  formHeader: { marginBottom: Spacing.three },
  separator: { height: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(21, 181, 128, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1, minWidth: 0, overflow: 'hidden', gap: 4 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetPill: {
    backgroundColor: 'rgba(21, 181, 128, 0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  targetPillText: { color: Brand.primary, fontWeight: '600' },
  createdAtRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteButton: { padding: Spacing.one },
});
