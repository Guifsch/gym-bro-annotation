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
  type UpsertEntryParams,
} from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ExercicioCoverPhoto } from '@/components/exercicio-cover-photo';
import { ExercicioHistoricoModal } from '@/components/exercicio-historico-modal';
import { ExercicioImageGallery } from '@/components/exercicio-image-gallery';
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

  async function handleSaveNome() {
    const trimmed = nome.trim();
    if (!trimmed || !exercicio || trimmed === exercicio.nome) return;
    try {
      const updated = await updateExercicio(exercicio._id, { nome: trimmed });
      setExercicio(updated);
      showToast('Nome atualizado');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleSaveDescricao() {
    const trimmed = descricao.trim();
    if (!exercicio || trimmed === (exercicio.descricao ?? '')) return;
    try {
      const updated = await updateExercicio(exercicio._id, { descricao: trimmed });
      setExercicio(updated);
      showToast('Descrição atualizada');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleSaveCargaMaxima() {
    if (!exercicio) return;
    const trimmed = cargaMaximaText.trim();
    const parsed = trimmed ? Number(trimmed.replace(',', '.')) : undefined;
    if (trimmed && !Number.isFinite(parsed)) return;
    if (parsed === exercicio.cargaMaximaKg) return;
    try {
      const updated = await updateExercicio(exercicio._id, { cargaMaximaKg: parsed });
      setExercicio(updated);
      showToast('Carga máxima atualizada');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  function handleSaveFields(fields: LogFields) {
    if (!sessao || !exercicio || Object.keys(fields).length === 0) return;

    const params: UpsertEntryParams = { sessaoId: sessao._id, exercicioId: exercicio._id, ...fields };
    setSessao((current) => (current ? mergeSessaoEntry(current, exercicio, params) : current));
    void enqueueUpsertSessaoEntry(params);
    showToast('Salvo');
  }

  function handleSaveSets() {
    if (!exercicio || !sessao) return;
    const trimmed = setsText.trim();
    const parsed = trimmed ? Math.round(Number(trimmed)) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const entry = sessao.entries.find((e) => e.exercicioId === exercicio._id);
    if (parsed === (entry?.sets ?? exercicio.sets)) return;
    handleSaveFields({ sets: parsed });
  }

  function handleSaveReps() {
    if (!exercicio || !sessao) return;
    const trimmed = repsText.trim();
    const parsed = trimmed ? Math.round(Number(trimmed)) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const entry = sessao.entries.find((e) => e.exercicioId === exercicio._id);
    if (parsed === (entry?.reps ?? exercicio.reps)) return;
    handleSaveFields({ reps: parsed });
  }

  function handleSavePeso() {
    if (!exercicio || !sessao) return;
    const trimmed = pesoText.trim();
    const parsed = trimmed ? Number(trimmed.replace(',', '.')) : NaN;
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const entry = sessao.entries.find((e) => e.exercicioId === exercicio._id);
    if (parsed === (entry?.pesoKg ?? exercicio.pesoKg)) return;
    handleSaveFields({ pesoKg: parsed });
  }

  async function handleChangeCategoria(newCategoriaId: string) {
    if (!exercicio || newCategoriaId === categoriaId) return;
    const previous = categoriaId;
    setCategoriaId(newCategoriaId);
    try {
      const updated = await updateExercicio(exercicio._id, { categoriaId: newCategoriaId });
      setExercicio(updated);
      showToast('Categoria atualizada');
    } catch (err) {
      setCategoriaId(previous);
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleChangeSubstitutos(ids: string[]) {
    if (!exercicio) return;
    const previous = substitutoIds;
    setSubstitutoIds(ids);
    try {
      const updated = await updateExercicio(exercicio._id, { substitutoIds: ids });
      setExercicio(updated);
      showToast('Substitutos atualizados');
    } catch (err) {
      setSubstitutoIds(previous);
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
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
            <LabeledTextField label="Nome" value={nome} onChangeText={setNome} onBlur={handleSaveNome} maxLength={50} />
            <LabeledTextField
              label="Descrição (opcional)"
              value={descricao}
              onChangeText={setDescricao}
              onBlur={handleSaveDescricao}
              maxLength={200}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />

            <LabeledTextField
              label="Carga máxima (1RM, opcional)"
              value={cargaMaximaText}
              onChangeText={setCargaMaximaText}
              onBlur={handleSaveCargaMaxima}
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
                  onBlur={handleSaveSets}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.field}>
                <LabeledTextField
                  label="Repetições"
                  value={repsText}
                  onChangeText={setRepsText}
                  onBlur={handleSaveReps}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.field}>
                <LabeledTextField
                  label="Peso (kg)"
                  value={pesoText}
                  onChangeText={setPesoText}
                  onBlur={handleSavePeso}
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
                    onPress={() => handleChangeCategoria(categoria._id)}
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
              onChange={handleChangeSubstitutos}
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
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
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
