import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import {
  cloneExercicio,
  deleteExercicioCapa,
  deleteExercicioImagem,
  getSessao,
  listCategorias,
  listExercicios,
  updateExercicio,
  uploadExercicioCapa,
  uploadExercicioImagem,
  type UpdateExercicioParams,
  type UpsertEntryParams,
} from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ExercicioCoverPhoto } from '@/components/exercicio-cover-photo';
import { ExercicioHistoricoModal } from '@/components/exercicio-historico-modal';
import { ExercicioImageGallery } from '@/components/exercicio-image-gallery';
import { FIXED_BOTTOM_BAR_SPACE, FixedBottomBar } from '@/components/fixed-bottom-bar';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { LoadingView } from '@/components/loading-view';
import { PercentualTable } from '@/components/percentual-table';
import { SubstitutoPicker } from '@/components/substituto-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { VideoLinkGallery } from '@/components/video-link-gallery';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mergeSessaoEntry } from '@/offline/mergeSessaoEntry';
import { enqueueUpsertSessaoEntry } from '@/offline/queue';
import type { Categoria, Exercicio, LogFields, Sessao } from '@/types/workout';

export default function ExercicioDetalheScreen() {
  const theme = useTheme();
  const { date, sessaoId, exercicioId } = useLocalSearchParams<{ date: string; sessaoId: string; exercicioId: string }>();

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [exercicio, setExercicio] = useState<Exercicio | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cargaMaximaText, setCargaMaximaText] = useState('');
  const [setsText, setSetsText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [pesoText, setPesoText] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [substitutoIds, setSubstitutoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [historicoVisible, setHistoricoVisible] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [sessaoData, exerciciosData, categoriasData] = await Promise.all([
      getSessao(sessaoId),
      listExercicios(),
      listCategorias(),
    ]);
    const exercicioData = exerciciosData.find((e) => e._id === exercicioId) ?? null;
    if (!exercicioData) throw new Error('Exercício não encontrado');
    const entry = sessaoData.entries.find((e) => e.exercicioId === exercicioId);

    setSessao(sessaoData);
    setExercicios(exerciciosData);
    setCategorias(categoriasData);
    setExercicio(exercicioData);
    setNome(exercicioData.nome);
    setDescricao(exercicioData.descricao ?? '');
    setCargaMaximaText(exercicioData.cargaMaximaKg !== undefined ? String(exercicioData.cargaMaximaKg) : '');
    setSetsText(String(entry?.sets ?? exercicioData.sets));
    setRepsText(String(entry?.reps ?? exercicioData.reps));
    setPesoText(String(entry?.pesoKg ?? exercicioData.pesoKg));
    setCategoriaId(exercicioData.categoriaId);
    setSubstitutoIds(exercicioData.substitutoIds);
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

  const categoriaNomeById = useMemo(() => Object.fromEntries(categorias.map((c) => [c._id, c.nome])), [categorias]);

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

  function arraysEqualAsSets(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((id) => setB.has(id));
  }

  // Nome/Descrição/Carga máxima/Categoria/Substitutos/Sets/Reps/Peso all used to save individually
  // (some on blur, some the moment a chip/picker changed) — but blur also fires when a field loses
  // focus because the screen is navigating away (e.g. the hardware back button), and racing that
  // against unmount was the root cause of a real stuck-loading bug. One explicit button that saves
  // only whatever actually changed avoids that race entirely, same as the Exercícios tab's form.
  // Fotos/Vídeos/Capa stay immediate — they're file uploads, not something to stage locally.
  async function handleSave() {
    if (!exercicio || !sessao) return;

    const trimmedNome = nome.trim();
    if (!trimmedNome) return;

    const trimmedCarga = cargaMaximaText.trim();
    const parsedCarga = trimmedCarga ? Number(trimmedCarga.replace(',', '.')) : undefined;
    if (trimmedCarga && !Number.isFinite(parsedCarga)) return;

    const trimmedSets = setsText.trim();
    const parsedSets = trimmedSets ? Math.round(Number(trimmedSets)) : NaN;
    const trimmedReps = repsText.trim();
    const parsedReps = trimmedReps ? Math.round(Number(trimmedReps)) : NaN;
    const trimmedPeso = pesoText.trim();
    const parsedPeso = trimmedPeso ? Number(trimmedPeso.replace(',', '.')) : NaN;
    if (!Number.isFinite(parsedSets) || parsedSets <= 0) return;
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) return;
    if (!Number.isFinite(parsedPeso) || parsedPeso < 0) return;

    const exercicioUpdates: UpdateExercicioParams = {};
    if (trimmedNome !== exercicio.nome) exercicioUpdates.nome = trimmedNome;
    if (descricao.trim() !== (exercicio.descricao ?? '')) exercicioUpdates.descricao = descricao.trim();
    if (parsedCarga !== exercicio.cargaMaximaKg) exercicioUpdates.cargaMaximaKg = parsedCarga;
    if (categoriaId && categoriaId !== exercicio.categoriaId) exercicioUpdates.categoriaId = categoriaId;
    if (!arraysEqualAsSets(substitutoIds, exercicio.substitutoIds)) exercicioUpdates.substitutoIds = substitutoIds;

    const entry = sessao.entries.find((e) => e.exercicioId === exercicio._id);
    const sessaoFields: LogFields = {};
    if (parsedSets !== (entry?.sets ?? exercicio.sets)) sessaoFields.sets = parsedSets;
    if (parsedReps !== (entry?.reps ?? exercicio.reps)) sessaoFields.reps = parsedReps;
    if (parsedPeso !== (entry?.pesoKg ?? exercicio.pesoKg)) sessaoFields.pesoKg = parsedPeso;

    const hasExercicioUpdates = Object.keys(exercicioUpdates).length > 0;
    const hasSessaoFields = Object.keys(sessaoFields).length > 0;
    if (!hasExercicioUpdates && !hasSessaoFields) return;

    setSaving(true);
    try {
      let currentExercicio = exercicio;
      if (hasExercicioUpdates) {
        currentExercicio = await updateExercicio(exercicio._id, exercicioUpdates);
        setExercicio(currentExercicio);
      }
      if (hasSessaoFields) {
        const params: UpsertEntryParams = { sessaoId: sessao._id, exercicioId: exercicio._id, ...sessaoFields };
        setSessao((current) => (current ? mergeSessaoEntry(current, currentExercicio, params) : current));
        void enqueueUpsertSessaoEntry(params);
      }
      showToast('Salvo');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadCapa(uri: string, contentType: string) {
    if (!exercicio) return;
    try {
      const updated = await uploadExercicioCapa(exercicio._id, uri, contentType);
      setExercicio(updated);
      showToast('Capa salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteCapa() {
    if (!exercicio) return;
    try {
      const updated = await deleteExercicioCapa(exercicio._id);
      setExercicio(updated);
      showToast('Capa removida');
    } catch {
      Alert.alert('Não foi possível remover', 'Tente novamente em instantes.');
    }
  }

  async function handleAddVideo(url: string) {
    if (!exercicio) return;
    try {
      const videoUrls = [...exercicio.videoUrls, url];
      const updated = await updateExercicio(exercicio._id, { videoUrls });
      setExercicio(updated);
      showToast('Vídeo adicionado');
    } catch (err) {
      Alert.alert('Não foi possível adicionar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleRemoveVideo(url: string) {
    if (!exercicio) return;
    try {
      const videoUrls = exercicio.videoUrls.filter((v) => v !== url);
      const updated = await updateExercicio(exercicio._id, { videoUrls });
      setExercicio(updated);
      showToast('Vídeo removido');
    } catch (err) {
      Alert.alert('Não foi possível remover', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleUploadImagem(uri: string, contentType: string) {
    if (!exercicio) return;
    try {
      const updated = await uploadExercicioImagem(exercicio._id, uri, contentType);
      setExercicio(updated);
      showToast('Foto salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteImagem(key: string) {
    if (!exercicio) return;
    try {
      const updated = await deleteExercicioImagem(exercicio._id, key);
      setExercicio(updated);
      showToast('Foto removida');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  async function handleClone() {
    if (!exercicio) return;
    setCloning(true);
    try {
      await cloneExercicio(exercicio._id);
      showToast('Exercício clonado');
    } catch (err) {
      Alert.alert('Não foi possível clonar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCloning(false);
    }
  }

  if (loading || !sessao || !exercicio) {
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
          <ExercicioCoverPhoto capa={exercicio.capa} onUpload={handleUploadCapa} onDelete={handleDeleteCapa} />

          <Card style={styles.formCard}>
            <LabeledTextField label="Nome" value={nome} onChangeText={setNome} maxLength={50} />
            <LabeledTextField
              label="Descrição (opcional)"
              value={descricao}
              onChangeText={setDescricao}
              maxLength={200}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />

            <LabeledTextField
              label="Carga máxima (1RM, opcional)"
              value={cargaMaximaText}
              onChangeText={setCargaMaximaText}
              keyboardType="decimal-pad"
              maxLength={7}
            />
            {Number(cargaMaximaText.replace(',', '.')) > 0 && (
              <PercentualTable cargaMaximaKg={Number(cargaMaximaText.replace(',', '.'))} />
            )}

            <View style={styles.fieldsRow}>
              <View style={styles.field}>
                <LabeledTextField
                  label="Sets"
                  value={setsText}
                  onChangeText={setSetsText}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.field}>
                <LabeledTextField
                  label="Repetições"
                  value={repsText}
                  onChangeText={setRepsText}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.field}>
                <LabeledTextField
                  label="Peso (kg)"
                  value={pesoText}
                  onChangeText={setPesoText}
                  keyboardType="decimal-pad"
                  maxLength={7}
                />
              </View>
            </View>

            <View style={styles.photoSection}>
              <ThemedText type="small" themeColor="textSecondary">
                Fotos
              </ThemedText>
              <ExercicioImageGallery imagens={exercicio.imagens ?? []} onUpload={handleUploadImagem} onDelete={handleDeleteImagem} />
              <ThemedText type="small" themeColor="textSecondary">
                Vídeos
              </ThemedText>
              <VideoLinkGallery videos={exercicio.videoUrls} onAdd={handleAddVideo} onRemove={handleRemoveVideo} />
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Categoria
            </ThemedText>
            <View style={styles.chipRow}>
              {categorias.map((categoria) => {
                const selected = categoriaId === categoria._id;
                return (
                  <Pressable
                    key={categoria._id}
                    onPress={() => setCategoriaId(categoria._id)}
                    style={[
                      styles.chip,
                      { borderColor: selected ? Brand.primary : theme.border },
                      selected && { backgroundColor: Brand.primary },
                    ]}>
                    <ThemedText type="small" style={selected ? styles.chipTextActive : undefined}>
                      {categoria.nome}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Exercícios substitutos (opcional)
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Aparecem na listagem como alternativa caso o equipamento esteja ocupado.
            </ThemedText>
            <SubstitutoPicker
              exercicios={exercicios.filter((e) => e._id !== exercicio._id)}
              categoriaNomeById={categoriaNomeById}
              selectedIds={substitutoIds}
              onChange={setSubstitutoIds}
            />

            <View style={styles.secondaryRow}>
              <Pressable onPress={() => setHistoricoVisible(true)} hitSlop={8} style={styles.secondaryButton}>
                <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Histórico
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleClone} disabled={cloning} hitSlop={8} style={styles.secondaryButton}>
                <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Clonar
                </ThemedText>
              </Pressable>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>

      <FixedBottomBar>
        <GradientButton title="Salvar alterações" onPress={handleSave} loading={saving} />
      </FixedBottomBar>

      <ExercicioHistoricoModal
        visible={historicoVisible}
        exercicioId={exercicio._id}
        onClose={() => setHistoricoVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: FIXED_BOTTOM_BAR_SPACE },
  formCard: { gap: Spacing.two },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  photoSection: { gap: Spacing.two },
  fieldsRow: { flexDirection: 'row', gap: Spacing.two },
  field: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.five, marginTop: Spacing.one },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, padding: Spacing.one },
});
