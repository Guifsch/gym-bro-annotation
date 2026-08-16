import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import { deleteRefeicao, getRefeicao, updateRefeicao } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { DatePickerModal } from '@/components/date-picker-modal';
import { EmptyState } from '@/components/empty-state';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { LoadingView } from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Refeicao } from '@/types/workout';
import { formatDateDisplay } from '@/utils/date';

export default function RefeicaoEditorScreen() {
  const { refeicaoId } = useLocalSearchParams<{ refeicaoId: string }>();
  const theme = useTheme();

  const [refeicao, setRefeicao] = useState<Refeicao | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nome, setNome] = useState('');
  const [savingNome, setSavingNome] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [novoItemNome, setNovoItemNome] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const load = useCallback(async () => {
    const data = await getRefeicao(refeicaoId);
    setRefeicao(data);
    setNome(data.nome);
    setObservacoes(data.observacoes ?? '');
  }, [refeicaoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setNotFound(false);
      load()
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function handleSaveNome() {
    const trimmed = nome.trim();
    if (!trimmed) return;
    setSavingNome(true);
    try {
      const updated = await updateRefeicao(refeicaoId, { nome: trimmed });
      setRefeicao(updated);
      showToast('Salvo');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setSavingNome(false);
    }
  }

  async function handleSaveObservacoes() {
    if (!refeicao) return;
    const trimmed = observacoes.trim();
    if (trimmed === (refeicao.observacoes ?? '')) return;
    const updated = await updateRefeicao(refeicaoId, { observacoes: trimmed });
    setRefeicao(updated);
    showToast('Salvo');
  }

  async function handleSelectDate(date: string) {
    const updated = await updateRefeicao(refeicaoId, { date });
    setRefeicao(updated);
    showToast('Dia vinculado');
  }

  async function handleClearDate() {
    const updated = await updateRefeicao(refeicaoId, { date: null });
    setRefeicao(updated);
    showToast('Dia removido');
  }

  async function handleAddItem() {
    const nomeItem = novoItemNome.trim();
    if (!refeicao || !nomeItem) return;
    setAddingItem(true);
    try {
      const itens = [...refeicao.itens.map((item) => ({ id: item._id, nome: item.nome })), { id: Crypto.randomUUID(), nome: nomeItem }];
      const updated = await updateRefeicao(refeicaoId, { itens });
      setRefeicao(updated);
      setNovoItemNome('');
    } catch (err) {
      Alert.alert('Não foi possível adicionar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setAddingItem(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!refeicao) return;
    const itens = refeicao.itens.filter((item) => item._id !== itemId).map((item) => ({ id: item._id, nome: item.nome }));
    const updated = await updateRefeicao(refeicaoId, { itens });
    setRefeicao(updated);
  }

  async function performDelete() {
    try {
      await deleteRefeicao(refeicaoId);
      router.replace('/(tabs)/exercicios/alimentacao');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  function handleDelete() {
    Alert.alert('Excluir refeição?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: performDelete },
    ]);
  }

  if (notFound) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <BackHeader title="Refeição removida" />
          <EmptyState
            icon="alert-circle-outline"
            title="Esta refeição não existe mais."
            actionLabel="Voltar"
            onAction={() => router.replace('/(tabs)/exercicios/alimentacao')}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loading || !refeicao) {
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
        <BackHeader title="Refeição" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <LabeledTextField label="Nome" value={nome} onChangeText={setNome} maxLength={120} />
            </View>
            <GradientButton title="Salvar" onPress={handleSaveNome} loading={savingNome} disabled={!nome.trim()} />
          </Card>

          <Card style={styles.dateCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Dia vinculado
            </ThemedText>
            <Pressable onPress={() => setDatePickerVisible(true)} style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={18} color={Brand.primary} />
              <ThemedText type="smallBold">{refeicao.date ? formatDateDisplay(refeicao.date) : 'Nenhum dia vinculado'}</ThemedText>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </Card>

          <ThemedText type="smallBold">Itens</ThemedText>
          {refeicao.itens.length === 0 ? (
            <EmptyState icon="fast-food-outline" title="Nenhum item ainda." />
          ) : (
            <View style={styles.list}>
              {refeicao.itens.map((item) => (
                <Card key={item._id} style={styles.itemRow}>
                  <ThemedText style={{ flex: 1 }}>{item.nome}</ThemedText>
                  <Pressable onPress={() => handleRemoveItem(item._id)} hitSlop={8} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={18} color="#e53935" />
                  </Pressable>
                </Card>
              ))}
            </View>
          )}

          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <LabeledTextField
                placeholder="Ex: 2 ovos mexidos"
                value={novoItemNome}
                onChangeText={setNovoItemNome}
                maxLength={200}
              />
            </View>
            <GradientButton title="Adicionar" onPress={handleAddItem} loading={addingItem} disabled={!novoItemNome.trim()} />
          </Card>

          <LabeledTextField
            label="Observações (opcional)"
            value={observacoes}
            onChangeText={setObservacoes}
            onBlur={handleSaveObservacoes}
            maxLength={500}
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />

          <Pressable onPress={handleDelete} style={styles.dangerLink}>
            <Ionicons name="trash-outline" size={16} color="#e53935" />
            <ThemedText style={styles.dangerText}>Excluir refeição</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <DatePickerModal
        visible={datePickerVisible}
        selectedDate={refeicao.date}
        onSelect={handleSelectDate}
        onClear={refeicao.date ? handleClearDate : undefined}
        onClose={() => setDatePickerVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  dateCard: { gap: Spacing.two },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  list: { gap: Spacing.two },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  dangerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  dangerText: { color: '#e53935' },
});
