import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import { createRefeicao, deleteRefeicao, listRefeicoesPage } from '@/api/workoutApi';
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
import type { Refeicao } from '@/types/workout';
import { countRefeicaoItens, formatRefeicaoDates } from '@/utils/refeicao';

export default function AlimentacaoListScreen() {
  const {
    items: refeicoes,
    setItems: setRefeicoes,
    loading,
    loadingMore,
    hasMore,
    reload,
    loadMore,
  } = usePaginatedList(listRefeicoesPage);
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
      const refeicao = await createRefeicao({ id: Crypto.randomUUID(), nome });
      setNewNome('');
      router.push(`/(tabs)/extras/alimentacao/${refeicao._id}`);
    } catch (err) {
      Alert.alert('Não foi possível criar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCreating(false);
    }
  }

  async function performDelete(refeicao: Refeicao) {
    try {
      await deleteRefeicao(refeicao._id);
      setRefeicoes((prev) => prev.filter((r) => r._id !== refeicao._id));
      showToast('Excluída');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  function handleDelete(refeicao: Refeicao) {
    Alert.alert('Excluir refeição?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => performDelete(refeicao) },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Alimentação" />

        <FlatList
          data={refeicoes}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
          onEndReachedThreshold={0.4}
          onEndReached={hasMore ? loadMore : undefined}
          ListHeaderComponent={
            <Card style={styles.formCard}>
              <LabeledTextField
                placeholder="Nome da refeição (ex: Plano de terça)"
                value={newNome}
                onChangeText={setNewNome}
                maxLength={120}
                style={styles.nomeInput}
              />
              <GradientButton title="Nova refeição" onPress={handleCreate} loading={creating} disabled={!newNome.trim()} />
            </Card>
          }
          ListHeaderComponentStyle={styles.formHeader}
          ListEmptyComponent={
            !loading ? (
              <EmptyState icon="restaurant-outline" title="Nenhuma refeição ainda. Crie a primeira acima." />
            ) : null
          }
          ListFooterComponent={<ListFooterSpinner visible={loadingMore} />}
          renderItem={({ item }) => (
            <SwipeableRow onDelete={() => handleDelete(item)}>
              <Pressable onPress={() => router.push(`/(tabs)/extras/alimentacao/${item._id}`)}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{item.nome}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatRefeicaoDates(item.dates)} ·{' '}
                      {countRefeicaoItens(item) === 1 ? '1 item' : `${countRefeicaoItens(item)} itens`}
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
  nomeInput: { minHeight: 56, paddingVertical: Spacing.four },
  separator: { height: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
});
