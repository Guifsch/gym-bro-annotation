import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import {
  deleteBodyMetricEntry,
  getBodyGoal,
  listBodyMetricEntries,
  updateBodyGoal,
  upsertBodyMetricEntry,
} from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { BodyDiagram } from '@/components/body-diagram';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { LoadingView } from '@/components/loading-view';
import { SingleDatePickerModal } from '@/components/single-date-picker-modal';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { WeightTrendChart } from '@/components/weight-trend-chart';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BodyGoal, BodyMetricEntry, BodyMetricMedidas } from '@/types/workout';
import {
  MEDIDA_KEYS,
  computeGoalProgressPct,
  computeWeightDeltas,
  findPreviousFieldValue,
  getGoalDirection,
  getWeightEntries,
  isDeltaFavorable,
  parseMedidasText,
} from '@/utils/bodyMetrics';
import { formatDateDisplay, getTodayDateString } from '@/utils/date';

const MEDIDA_LABELS: Record<keyof BodyMetricMedidas, string> = {
  cintura: 'Cintura',
  quadril: 'Quadril',
  peito: 'Peito',
  pescoco: 'Pescoço',
  bracoEsquerdo: 'Braço E',
  bracoDireito: 'Braço D',
  coxaEsquerda: 'Coxa E',
  coxaDireita: 'Coxa D',
};

function emptyMedidasText(): Record<keyof BodyMetricMedidas, string> {
  return Object.fromEntries(MEDIDA_KEYS.map((key) => [key, ''])) as Record<keyof BodyMetricMedidas, string>;
}

function formatDelta(delta: number | null, unit: string): string {
  if (delta === null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} ${unit}`;
}

export default function AvaliacaoFisicaGoalScreen() {
  const theme = useTheme();
  const { goalId } = useLocalSearchParams<{ goalId: string }>();

  const [goal, setGoal] = useState<BodyGoal | null>(null);
  const [entries, setEntries] = useState<BodyMetricEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const [formDate, setFormDate] = useState(getTodayDateString());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [pesoText, setPesoText] = useState('');
  const [medidasExpanded, setMedidasExpanded] = useState(true);
  const [medidasText, setMedidasText] = useState(emptyMedidasText());
  const [observacoesText, setObservacoesText] = useState('');
  const [saving, setSaving] = useState(false);

  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyFilterDate, setHistoryFilterDate] = useState<string | null>(null);
  const [historyDatePickerVisible, setHistoryDatePickerVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const formCardRef = useRef<View>(null);

  // Same measureLayout approach used elsewhere in the app for "jump to a specific card" scrolling
  // — `getNativeScrollRef()` is required under Fabric, a composite ScrollView ref isn't enough.
  function scrollToForm() {
    const node = formCardRef.current;
    const scrollNode = scrollViewRef.current;
    if (!node || !scrollNode) return;
    const nativeScrollRef = scrollNode.getNativeScrollRef();
    if (!nativeScrollRef) return;
    node.measureLayout(
      nativeScrollRef,
      (_x, y) => scrollNode.scrollTo({ y: Math.max(0, y - 8), animated: true }),
      () => {}
    );
  }

  function loadDateIntoForm(date: string, list: BodyMetricEntry[]) {
    const existing = list.find((e) => e.date === date);
    setFormDate(date);
    setPesoText(existing?.pesoKg !== undefined ? String(existing.pesoKg) : '');
    const nextMedidasText = emptyMedidasText();
    for (const key of MEDIDA_KEYS) {
      const value = existing?.medidas?.[key];
      if (value !== undefined) nextMedidasText[key] = String(value);
    }
    setMedidasText(nextMedidasText);
    setObservacoesText(existing?.observacoes ?? '');
  }

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [entriesData, goalData] = await Promise.all([listBodyMetricEntries(goalId), getBodyGoal(goalId)]);
      setEntries(entriesData);
      setGoal(goalData);
      loadDateIntoForm(getTodayDateString(), entriesData);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sortedAscending = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const entryDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const weightEntries = useMemo(() => getWeightEntries(entries), [entries]);
  const deltas = useMemo(() => computeWeightDeltas(weightEntries), [weightEntries]);
  const currentWeight = weightEntries[weightEntries.length - 1]?.pesoKg;
  const startWeight = weightEntries[0]?.pesoKg;
  const pesoMetaKg = goal?.pesoMetaKg ?? null;

  const direction = pesoMetaKg !== null && startWeight !== undefined ? getGoalDirection(startWeight, pesoMetaKg) : null;
  const progressPct =
    pesoMetaKg !== null && startWeight !== undefined && currentWeight !== undefined
      ? computeGoalProgressPct(startWeight, currentWeight, pesoMetaKg)
      : null;

  function deltaColor(favorable: boolean | null): string {
    if (favorable === null) return theme.textSecondary;
    return favorable ? Brand.primary : '#e53935';
  }

  const historyRows = useMemo(
    () => sortedAscending.map((entry, index) => ({ entry, index })).reverse(),
    [sortedAscending]
  );

  const filteredHistoryRows = useMemo(() => {
    if (!historyFilterDate) return historyRows;
    return historyRows.filter(({ entry }) => entry.date === historyFilterDate);
  }, [historyRows, historyFilterDate]);

  const liveMedidas = useMemo(() => parseMedidasText(medidasText), [medidasText]);

  function handleEditFromHistory(entry: BodyMetricEntry) {
    loadDateIntoForm(entry.date, sortedAscending);
    scrollToForm();
  }

  function startEditGoal() {
    setGoalText(pesoMetaKg !== null ? String(pesoMetaKg) : '');
    setEditingGoal(true);
  }

  async function handleSaveGoal() {
    const trimmed = goalText.trim();
    const parsed = Number(trimmed.replace(',', '.'));
    if (!trimmed || !Number.isFinite(parsed) || parsed <= 0) return;
    setSavingGoal(true);
    try {
      const updated = await updateBodyGoal(goalId, { pesoMetaKg: parsed });
      setGoal(updated);
      setEditingGoal(false);
      showToast('Meta atualizada');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleSave() {
    const parsedPeso = pesoText.trim() ? Number(pesoText.replace(',', '.')) : null;
    if (pesoText.trim() && !Number.isFinite(parsedPeso)) return;

    const medidas = parseMedidasText(medidasText);

    if (parsedPeso === null && Object.keys(medidas).length === 0 && !observacoesText.trim()) {
      Alert.alert('Nada pra salvar', 'Preencha ao menos o peso, uma medida ou uma observação.');
      return;
    }

    setSaving(true);
    try {
      const updated = await upsertBodyMetricEntry(goalId, formDate, {
        pesoKg: parsedPeso,
        medidas,
        observacoes: observacoesText.trim() || null,
      });
      setEntries((prev) => [...prev.filter((e) => e.date !== formDate), updated]);
      showToast('Salvo');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setSaving(false);
    }
  }

  async function performDelete(entry: BodyMetricEntry) {
    try {
      await deleteBodyMetricEntry(goalId, entry.date);
      const remaining = entries.filter((e) => e._id !== entry._id);
      setEntries(remaining);
      showToast('Excluído');
      if (formDate === entry.date) loadDateIntoForm(entry.date, remaining);
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  function handleDelete(entry: BodyMetricEntry) {
    Alert.alert('Excluir registro?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => performDelete(entry) },
    ]);
  }

  if (notFound) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <BackHeader title="Meta removida" />
          <EmptyState
            icon="alert-circle-outline"
            title="Esta meta não existe mais."
            actionLabel="Voltar"
            onAction={() => router.replace('/(tabs)/extras/avaliacao-fisica')}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title={goal?.nome || 'Avaliação Física'} />

        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading && entries.length === 0 ? (
            <LoadingView />
          ) : (
            <>
              <Card style={styles.summaryCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  Peso atual
                </ThemedText>
                {currentWeight !== undefined ? (
                  <ThemedText type="title" style={styles.currentWeight}>
                    {currentWeight} kg
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Nenhum registro ainda
                  </ThemedText>
                )}

                {currentWeight !== undefined && (
                  <View style={styles.deltasRow}>
                    <View style={styles.deltaItem}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Desde o último
                      </ThemedText>
                      <ThemedText type="smallBold" style={{ color: deltaColor(isDeltaFavorable(deltas.sinceLast, direction)) }}>
                        {formatDelta(deltas.sinceLast, 'kg')}
                      </ThemedText>
                    </View>
                    <View style={styles.deltaItem}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Desde o início
                      </ThemedText>
                      <ThemedText
                        type="smallBold"
                        style={{ color: deltaColor(isDeltaFavorable(deltas.sinceFirst, direction)) }}>
                        {formatDelta(deltas.sinceFirst, 'kg')}
                      </ThemedText>
                    </View>
                  </View>
                )}

                <View style={styles.goalSection}>
                  {editingGoal ? (
                    <View style={styles.goalEditRow}>
                      <View style={{ flex: 1 }}>
                        <LabeledTextField
                          label="Meta de peso (kg)"
                          value={goalText}
                          onChangeText={setGoalText}
                          keyboardType="decimal-pad"
                          maxLength={3}
                        />
                      </View>
                      <Pressable onPress={handleSaveGoal} disabled={savingGoal} hitSlop={8}>
                        <Ionicons name="checkmark-circle" size={28} color={Brand.primary} />
                      </Pressable>
                      <Pressable onPress={() => setEditingGoal(false)} hitSlop={8}>
                        <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={startEditGoal} style={styles.goalRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Meta: {pesoMetaKg} kg
                      </ThemedText>
                      <Ionicons name="pencil" size={14} color={theme.textSecondary} />
                    </Pressable>
                  )}

                  {progressPct !== null && (
                    <View style={styles.progressWrap}>
                      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
                        <View style={[styles.progressFill, { width: `${Math.max(4, progressPct)}%` }]} />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {progressPct >= 100 ? 'Meta atingida' : `${Math.round(progressPct)}%`}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </Card>

              <Card style={styles.chartCard}>
                <ThemedText type="smallBold">Evolução</ThemedText>
                <WeightTrendChart entries={weightEntries} goalWeightKg={pesoMetaKg} />
              </Card>

              <View ref={formCardRef}>
              <Card style={styles.formCard}>
                <ThemedText type="smallBold">Novo registro</ThemedText>

                <Pressable
                  onPress={() => setDatePickerVisible(true)}
                  style={[styles.dateButton, { borderColor: theme.border }]}>
                  <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="small">{formatDateDisplay(formDate)}</ThemedText>
                </Pressable>

                <LabeledTextField
                  label="Peso (kg)"
                  value={pesoText}
                  onChangeText={setPesoText}
                  keyboardType="decimal-pad"
                  maxLength={3}
                />

                <Pressable onPress={() => setMedidasExpanded((v) => !v)} style={styles.expandRow}>
                  <ThemedText type="small" style={styles.expandLabel}>
                    {medidasExpanded ? 'Ocultar medidas' : '+ Mais medidas'}
                  </ThemedText>
                  <Ionicons name={medidasExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Brand.primary} />
                </Pressable>

                {medidasExpanded && (
                  <>
                    <BodyDiagram values={liveMedidas} />
                    <View style={styles.medidasGrid}>
                      {MEDIDA_KEYS.map((key) => (
                        <View key={key} style={styles.medidaField}>
                          <LabeledTextField
                            label={MEDIDA_LABELS[key]}
                            value={medidasText[key]}
                            onChangeText={(text) => setMedidasText((prev) => ({ ...prev, [key]: text }))}
                            keyboardType="decimal-pad"
                            maxLength={3}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <LabeledTextField
                  label="Observações (opcional)"
                  value={observacoesText}
                  onChangeText={setObservacoesText}
                  maxLength={300}
                  multiline
                  numberOfLines={2}
                  style={styles.multiline}
                />

                <GradientButton title="Salvar registro" onPress={handleSave} loading={saving} />
              </Card>
              </View>

              <Card style={styles.historyCard}>
                <Pressable onPress={() => setHistoryExpanded((v) => !v)} style={styles.expandRow}>
                  <ThemedText type="smallBold">Histórico</ThemedText>
                  <Ionicons
                    name={historyExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.textSecondary}
                  />
                </Pressable>

                {historyExpanded && (
                  <>
                    {sortedAscending.length > 0 && (
                      <View style={styles.historyFilterRow}>
                        <Pressable
                          onPress={() => setHistoryDatePickerVisible(true)}
                          style={[styles.dateButton, { borderColor: theme.border }]}>
                          <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                          <ThemedText type="small">
                            {historyFilterDate ? formatDateDisplay(historyFilterDate) : 'Filtrar por data'}
                          </ThemedText>
                        </Pressable>
                        {historyFilterDate && (
                          <Pressable onPress={() => setHistoryFilterDate(null)} hitSlop={8}>
                            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                          </Pressable>
                        )}
                      </View>
                    )}

                    {sortedAscending.length === 0 ? (
                      <EmptyState icon="body-outline" title="Nenhum registro ainda. Crie o primeiro acima." />
                    ) : filteredHistoryRows.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Nenhum registro encontrado pra essa data.
                      </ThemedText>
                    ) : (
                      <View style={styles.historyList}>
                        {filteredHistoryRows.map(({ entry, index }) => (
                          <SwipeableRow key={entry._id} onDelete={() => handleDelete(entry)}>
                            <Card style={styles.historyRow}>
                              <Pressable onPress={() => handleEditFromHistory(entry)} style={styles.historyContent}>
                                <View style={styles.historyHeader}>
                                  <ThemedText type="smallBold">{formatDateDisplay(entry.date)}</ThemedText>
                                  {entry.pesoKg !== undefined && (
                                    <ThemedText type="smallBold" style={styles.historyPeso}>
                                      {entry.pesoKg} kg
                                    </ThemedText>
                                  )}
                                </View>
                                {entry.medidas && (
                                  <View style={styles.historyMedidas}>
                                    {MEDIDA_KEYS.filter((key) => entry.medidas?.[key] !== undefined).map((key) => {
                                      const value = entry.medidas![key]!;
                                      const previous = findPreviousFieldValue(sortedAscending, index, key);
                                      const delta = previous !== undefined ? value - previous : null;
                                      return (
                                        <ThemedText key={key} type="small" themeColor="textSecondary">
                                          {MEDIDA_LABELS[key]} {value}cm
                                          {delta !== null && delta !== 0 ? ` (${formatDelta(delta, '')})` : ''}
                                        </ThemedText>
                                      );
                                    })}
                                  </View>
                                )}
                                {entry.observacoes && (
                                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                                    {entry.observacoes}
                                  </ThemedText>
                                )}
                              </Pressable>
                              <View style={styles.historyActions}>
                                <Pressable onPress={() => handleEditFromHistory(entry)} hitSlop={8}>
                                  <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} />
                                </Pressable>
                                <Pressable onPress={() => handleDelete(entry)} hitSlop={8}>
                                  <Ionicons name="trash-outline" size={16} color="#e53935" />
                                </Pressable>
                              </View>
                            </Card>
                          </SwipeableRow>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </Card>
            </>
          )}
        </ScrollView>

        <SingleDatePickerModal
          visible={datePickerVisible}
          date={formDate}
          onSelectDate={(date) => loadDateIntoForm(date, sortedAscending)}
          onClose={() => setDatePickerVisible(false)}
          dataDates={entryDates}
        />

        <SingleDatePickerModal
          visible={historyDatePickerVisible}
          date={historyFilterDate ?? getTodayDateString()}
          onSelectDate={setHistoryFilterDate}
          onClose={() => setHistoryDatePickerVisible(false)}
          dataDates={entryDates}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  summaryCard: { gap: Spacing.two },
  currentWeight: { color: Brand.primary },
  deltasRow: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
  deltaItem: { gap: 2 },
  goalSection: { gap: Spacing.two, marginTop: Spacing.two },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  goalEditRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  progressTrack: { flex: 1, height: 14, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full, backgroundColor: Brand.primary },
  chartCard: { gap: Spacing.two },
  formCard: { gap: Spacing.two },
  historyCard: { gap: Spacing.two },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignSelf: 'flex-start',
  },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  expandLabel: { color: Brand.primary },
  historyFilterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  medidasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  medidaField: { width: '47%' },
  multiline: { minHeight: 56, textAlignVertical: 'top' },
  historyList: { gap: Spacing.two },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  historyContent: { flex: 1, gap: 2 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyPeso: { color: Brand.primary },
  historyMedidas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  historyActions: { flexDirection: 'row', gap: Spacing.three },
});
