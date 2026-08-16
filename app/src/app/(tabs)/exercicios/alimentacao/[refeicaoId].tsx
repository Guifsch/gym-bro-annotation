import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import {
  deleteRefeicao,
  getRefeicao,
  updateRefeicao,
  type RefeicaoBlocoParams,
  type RefeicaoItemParams,
} from '@/api/workoutApi';
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
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Refeicao, RefeicaoBloco, RefeicaoItem } from '@/types/workout';
import { formatDateDisplay } from '@/utils/date';

function toItemParams(item: RefeicaoItem): RefeicaoItemParams {
  return { id: item._id, nome: item.nome };
}

function toBlocoParams(bloco: RefeicaoBloco): RefeicaoBlocoParams {
  return { id: bloco._id, nome: bloco.nome, horario: bloco.horario, itens: bloco.itens.map(toItemParams) };
}

export default function RefeicaoEditorScreen() {
  const { refeicaoId } = useLocalSearchParams<{ refeicaoId: string }>();
  const theme = useTheme();

  const [refeicao, setRefeicao] = useState<Refeicao | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nome, setNome] = useState('');
  const [savingNome, setSavingNome] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [savingObservacoes, setSavingObservacoes] = useState(false);
  const [novoItemNome, setNovoItemNome] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [novoBlocoNome, setNovoBlocoNome] = useState('');
  const [novoBlocoHorario, setNovoBlocoHorario] = useState('');
  const [creatingBloco, setCreatingBloco] = useState(false);
  const [novoItemPorBloco, setNovoItemPorBloco] = useState<Record<string, string>>({});
  const [addingItemBlocoId, setAddingItemBlocoId] = useState<string | null>(null);

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
    const trimmed = observacoes.trim();
    setSavingObservacoes(true);
    try {
      const updated = await updateRefeicao(refeicaoId, { observacoes: trimmed });
      setRefeicao(updated);
      showToast('Salvo');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setSavingObservacoes(false);
    }
  }

  async function handleToggleDate(date: string) {
    if (!refeicao) return;
    const dates = refeicao.dates.includes(date) ? refeicao.dates.filter((d) => d !== date) : [...refeicao.dates, date];
    const updated = await updateRefeicao(refeicaoId, { dates });
    setRefeicao(updated);
  }

  async function handleAddItem() {
    const nomeItem = novoItemNome.trim();
    if (!refeicao || !nomeItem) return;
    setAddingItem(true);
    try {
      const itens = [...refeicao.itens.map(toItemParams), { id: Crypto.randomUUID(), nome: nomeItem }];
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
    const itens = refeicao.itens.filter((item) => item._id !== itemId).map(toItemParams);
    const updated = await updateRefeicao(refeicaoId, { itens });
    setRefeicao(updated);
  }

  async function handleAddBloco() {
    const nomeBloco = novoBlocoNome.trim();
    if (!refeicao || !nomeBloco) return;
    setCreatingBloco(true);
    try {
      const blocos = [
        ...refeicao.blocos.map(toBlocoParams),
        { id: Crypto.randomUUID(), nome: nomeBloco, horario: novoBlocoHorario.trim() || undefined, itens: [] },
      ];
      const updated = await updateRefeicao(refeicaoId, { blocos });
      setRefeicao(updated);
      setNovoBlocoNome('');
      setNovoBlocoHorario('');
    } catch (err) {
      Alert.alert('Não foi possível criar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCreatingBloco(false);
    }
  }

  async function performRemoveBloco(blocoId: string) {
    if (!refeicao) return;
    const blocos = refeicao.blocos.filter((bloco) => bloco._id !== blocoId).map(toBlocoParams);
    const updated = await updateRefeicao(refeicaoId, { blocos });
    setRefeicao(updated);
  }

  function handleDeleteBloco(bloco: RefeicaoBloco) {
    Alert.alert('Excluir bloco?', `Isso remove "${bloco.nome}" e todos os itens dentro dele.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => performRemoveBloco(bloco._id) },
    ]);
  }

  async function handleAddItemToBloco(blocoId: string) {
    if (!refeicao) return;
    const nomeItem = (novoItemPorBloco[blocoId] ?? '').trim();
    if (!nomeItem) return;
    setAddingItemBlocoId(blocoId);
    try {
      const blocos = refeicao.blocos.map((bloco) =>
        bloco._id === blocoId
          ? { ...toBlocoParams(bloco), itens: [...bloco.itens.map(toItemParams), { id: Crypto.randomUUID(), nome: nomeItem }] }
          : toBlocoParams(bloco)
      );
      const updated = await updateRefeicao(refeicaoId, { blocos });
      setRefeicao(updated);
      setNovoItemPorBloco((prev) => ({ ...prev, [blocoId]: '' }));
    } catch (err) {
      Alert.alert('Não foi possível adicionar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setAddingItemBlocoId(null);
    }
  }

  async function handleRemoveItemFromBloco(blocoId: string, itemId: string) {
    if (!refeicao) return;
    const blocos = refeicao.blocos.map((bloco) =>
      bloco._id === blocoId
        ? { ...toBlocoParams(bloco), itens: bloco.itens.filter((item) => item._id !== itemId).map(toItemParams) }
        : toBlocoParams(bloco)
    );
    const updated = await updateRefeicao(refeicaoId, { blocos });
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
            <View style={styles.sectionHeaderRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Dias vinculados
              </ThemedText>
              <Pressable onPress={() => setDatePickerVisible(true)} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={20} color={Brand.primary} />
              </Pressable>
            </View>
            {refeicao.dates.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nenhum dia vinculado
              </ThemedText>
            ) : (
              <View style={styles.chipRow}>
                {refeicao.dates
                  .slice()
                  .sort()
                  .map((date) => (
                    <View key={date} style={[styles.dateChip, { borderColor: theme.border }]}>
                      <ThemedText type="small">{formatDateDisplay(date)}</ThemedText>
                      <Pressable onPress={() => handleToggleDate(date)} hitSlop={8}>
                        <Ionicons name="close" size={14} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  ))}
              </View>
            )}
          </Card>

          <ThemedText type="smallBold">Blocos (opcional)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Divida a refeição em partes com nome e horário, ex: “Café da manhã” às 8:00.
          </ThemedText>

          {refeicao.blocos.length > 0 && (
            <View style={styles.list}>
              {refeicao.blocos.map((bloco) => (
                <Card key={bloco._id} style={styles.blocoCard}>
                  <View style={styles.blocoHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">{bloco.nome}</ThemedText>
                      {bloco.horario ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {bloco.horario}
                        </ThemedText>
                      ) : null}
                    </View>
                    <Pressable onPress={() => handleDeleteBloco(bloco)} hitSlop={8} style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={18} color="#e53935" />
                    </Pressable>
                  </View>

                  {bloco.itens.length > 0 && (
                    <View style={styles.blocoItemList}>
                      {bloco.itens.map((item) => (
                        <View key={item._id} style={styles.blocoItemRow}>
                          <ThemedText type="small" style={{ flex: 1 }}>
                            {item.nome}
                          </ThemedText>
                          <Pressable
                            onPress={() => handleRemoveItemFromBloco(bloco._id, item._id)}
                            hitSlop={8}
                            style={styles.deleteButton}>
                            <Ionicons name="close" size={16} color={theme.textSecondary} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.blocoAddItemRow}>
                    <View style={{ flex: 1 }}>
                      <LabeledTextField
                        placeholder="Adicionar item a este bloco"
                        value={novoItemPorBloco[bloco._id] ?? ''}
                        onChangeText={(text) => setNovoItemPorBloco((prev) => ({ ...prev, [bloco._id]: text }))}
                        maxLength={200}
                      />
                    </View>
                    <Pressable
                      onPress={() => handleAddItemToBloco(bloco._id)}
                      disabled={addingItemBlocoId === bloco._id || !(novoItemPorBloco[bloco._id] ?? '').trim()}
                      style={[styles.blocoAddButton, { borderColor: theme.border }]}>
                      {addingItemBlocoId === bloco._id ? (
                        <ActivityIndicator size="small" color={Brand.primary} />
                      ) : (
                        <Ionicons name="add" size={20} color={Brand.primary} />
                      )}
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}

          <Card style={styles.novoBlocoCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Novo bloco
            </ThemedText>
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <LabeledTextField
                  placeholder="Nome (ex: Almoço)"
                  value={novoBlocoNome}
                  onChangeText={setNovoBlocoNome}
                  maxLength={120}
                />
              </View>
              <View style={{ flex: 1 }}>
                <LabeledTextField placeholder="Horário" value={novoBlocoHorario} onChangeText={setNovoBlocoHorario} maxLength={20} />
              </View>
            </View>
            <GradientButton title="Criar bloco" onPress={handleAddBloco} loading={creatingBloco} disabled={!novoBlocoNome.trim()} />
          </Card>

          <ThemedText type="smallBold">Itens avulsos já adicionados</ThemedText>
          {refeicao.itens.length === 0 ? (
            <EmptyState icon="fast-food-outline" title="Nenhum item avulso ainda." />
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

          <View style={[styles.addItemSection, { borderTopColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Adicionar item avulso novo (fora de qualquer bloco)
            </ThemedText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <LabeledTextField
                  placeholder="Ex: 2 ovos mexidos"
                  value={novoItemNome}
                  onChangeText={setNovoItemNome}
                  maxLength={200}
                />
              </View>
              <GradientButton title="Adicionar" onPress={handleAddItem} loading={addingItem} disabled={!novoItemNome.trim()} />
            </View>
          </View>

          <Card style={styles.observacoesCard}>
            <LabeledTextField
              label="Observações (opcional)"
              value={observacoes}
              onChangeText={setObservacoes}
              maxLength={500}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />
            <GradientButton title="Salvar observações" onPress={handleSaveObservacoes} loading={savingObservacoes} />
          </Card>

          <Pressable onPress={handleDelete} style={styles.dangerLink}>
            <Ionicons name="trash-outline" size={16} color="#e53935" />
            <ThemedText style={styles.dangerText}>Excluir refeição</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <DatePickerModal
        visible={datePickerVisible}
        selectedDates={refeicao.dates}
        onToggleDate={handleToggleDate}
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateCard: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  list: { gap: Spacing.two },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
  blocoCard: { gap: Spacing.two },
  blocoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  blocoItemList: { gap: Spacing.one },
  blocoItemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  blocoAddItemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  blocoAddButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoBlocoCard: { gap: Spacing.two },
  addItemSection: { gap: Spacing.two, borderTopWidth: 1, paddingTop: Spacing.three, marginTop: Spacing.one },
  observacoesCard: { gap: Spacing.two },
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
