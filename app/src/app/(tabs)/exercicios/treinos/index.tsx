import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import { createTreino, deleteTreino, listTreinosPage } from '@/api/workoutApi';
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
import { Brand, Spacing } from '@/constants/theme';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import type { Treino } from '@/types/workout';

export default function TreinosListScreen() {
  const { items: treinos, setItems: setTreinos, loading, loadingMore, hasMore, reload, loadMore } =
    usePaginatedList(listTreinosPage);
  const [newNome, setNewNome] = useState('');
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function handleCreate() {
    const nome = newNome.trim();
    if (!nome) return;
    setCreating(true);
    try {
      const treino = await createTreino({ id: Crypto.randomUUID(), nome });
      setNewNome('');
      router.push(`/(tabs)/exercicios/treinos/${treino._id}`);
    } catch (err) {
      Alert.alert('Não foi possível criar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCreating(false);
    }
  }

  async function performDelete(treino: Treino) {
    try {
      await deleteTreino(treino._id);
      setTreinos((prev) => prev.filter((t) => t._id !== treino._id));
      showToast('Excluído');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  function handleDelete(treino: Treino) {
    Alert.alert('Excluir treino?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => performDelete(treino) },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Treinos" />

        <FlatList
          data={treinos}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
          onEndReachedThreshold={0.4}
          onEndReached={hasMore ? loadMore : undefined}
          ListHeaderComponent={
            <Card style={styles.formCard}>
              <LabeledTextField
                placeholder="Nome do novo treino"
                value={newNome}
                onChangeText={setNewNome}
                maxLength={50}
              />
              <GradientButton title="Criar treino" onPress={handleCreate} loading={creating} disabled={!newNome.trim()} />
            </Card>
          }
          ListHeaderComponentStyle={styles.formHeader}
          ListEmptyComponent={
            !loading ? <EmptyState icon="list-outline" title="Nenhum treino ainda. Crie o primeiro acima." /> : null
          }
          ListFooterComponent={<ListFooterSpinner visible={loadingMore} />}
          renderItem={({ item }) => (
            <SwipeableRow onDelete={() => handleDelete(item)}>
              <Pressable onPress={() => router.push(`/(tabs)/exercicios/treinos/${item._id}`)}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{item.nome}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.exercicioIds.length} {item.exercicioIds.length === 1 ? 'exercício' : 'exercícios'}
                    </ThemedText>
                  </View>
                  <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={18} color="#e53935" />
                  </Pressable>
                  <Ionicons name="chevron-forward" size={20} color={Brand.primary} />
                </Card>
              </Pressable>
            </SwipeableRow>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
});
