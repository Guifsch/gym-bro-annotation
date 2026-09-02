import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import { createRefeicao, deleteRefeicao, listRefeicoesPage } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { GradientButton } from '@/components/gradient-button';
import { HeaderSearchField } from '@/components/header-search-field';
import { LabeledTextField } from '@/components/labeled-text-field';
import { ListFooterSpinner } from '@/components/list-footer-spinner';
import { SortMenuButton } from '@/components/sort-menu-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Spacing } from '@/constants/theme';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useTheme } from '@/hooks/use-theme';
import type { Refeicao } from '@/types/workout';
import { countRefeicaoItens, formatRefeicaoDates } from '@/utils/refeicao';
import { LIST_SORT_OPTIONS, matchesSearch, sortByNome, type ListSortBy } from '@/utils/listSort';

export default function AlimentacaoListScreen() {
  const theme = useTheme();
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
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<ListSortBy>('ordem');

  const filteredSortedRefeicoes = useMemo(() => {
    const filtered = refeicoes.filter((r) => matchesSearch(r.nome, search));
    return sortByNome(filtered, sortBy, (r) => r.nome);
  }, [refeicoes, search, sortBy]);

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
        <BackHeader
          title="Alimentação"
          titleSlot={
            searchOpen ? (
              <HeaderSearchField value={search} onChangeText={setSearch} placeholder="Buscar refeição..." />
            ) : undefined
          }
          rightActions={
            refeicoes.length === 0 ? undefined : searchOpen ? (
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

        <FlatList
          data={filteredSortedRefeicoes}
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
            loading ? null : refeicoes.length === 0 ? (
              <EmptyState icon="restaurant-outline" title="Nenhuma refeição ainda. Crie a primeira acima." />
            ) : (
              <EmptyState icon="search-outline" title="Nenhuma refeição encontrada." />
            )
          }
          ListFooterComponent={<ListFooterSpinner visible={loadingMore} />}
          renderItem={({ item }) => (
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
  headerActionsRow: { flexDirection: 'row', alignItems: 'center' },
  headerIconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
});
