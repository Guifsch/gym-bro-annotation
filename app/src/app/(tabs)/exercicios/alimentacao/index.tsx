import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import { createRefeicao, deleteRefeicao, listRefeicoes } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Spacing } from '@/constants/theme';
import type { Refeicao } from '@/types/workout';
import { countRefeicaoItens, formatRefeicaoDates } from '@/utils/refeicao';

export default function AlimentacaoListScreen() {
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNome, setNewNome] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRefeicoes(await listRefeicoes());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleCreate() {
    const nome = newNome.trim();
    if (!nome) return;
    setCreating(true);
    try {
      const refeicao = await createRefeicao({ id: Crypto.randomUUID(), nome });
      setNewNome('');
      router.push(`/(tabs)/exercicios/alimentacao/${refeicao._id}`);
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

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
          <Card style={styles.formCard}>
            <LabeledTextField
              placeholder="Nome da refeição (ex: Café da manhã)"
              value={newNome}
              onChangeText={setNewNome}
              maxLength={120}
            />
            <GradientButton title="Nova refeição" onPress={handleCreate} loading={creating} disabled={!newNome.trim()} />
          </Card>

          {!loading && refeicoes.length === 0 ? (
            <EmptyState icon="restaurant-outline" title="Nenhuma refeição ainda. Crie a primeira acima." />
          ) : (
            <View style={styles.list}>
              {refeicoes.map((item) => (
                <SwipeableRow key={item._id} onDelete={() => handleDelete(item)}>
                  <Pressable onPress={() => router.push(`/(tabs)/exercicios/alimentacao/${item._id}`)}>
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
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  formCard: { gap: Spacing.two },
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
});
