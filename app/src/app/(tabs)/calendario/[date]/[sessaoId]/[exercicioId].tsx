import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteExercicioImagem,
  getSessao,
  listExercicios,
  updateExercicio,
  uploadExercicioImagem,
  type UpsertEntryParams,
} from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ExercicioEntryEditor, type LogFields } from '@/components/exercicio-entry-editor';
import { ExercicioHistoricoModal } from '@/components/exercicio-historico-modal';
import { ExercicioImageGallery } from '@/components/exercicio-image-gallery';
import { LabeledTextField } from '@/components/labeled-text-field';
import { LoadingView } from '@/components/loading-view';
import { PercentualTable } from '@/components/percentual-table';
import { RestTimer } from '@/components/rest-timer';
import { showToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VideoLinkField } from '@/components/video-link-field';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { mergeSessaoEntry } from '@/offline/mergeSessaoEntry';
import { enqueueUpsertSessaoEntry } from '@/offline/queue';
import type { Exercicio, Sessao } from '@/types/workout';

export default function ExercicioDetalheScreen() {
  const theme = useTheme();
  const { date, sessaoId, exercicioId } = useLocalSearchParams<{ date: string; sessaoId: string; exercicioId: string }>();

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [exercicio, setExercicio] = useState<Exercicio | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cargaMaximaText, setCargaMaximaText] = useState('');
  const [videoUrlText, setVideoUrlText] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [historicoVisible, setHistoricoVisible] = useState(false);

  const load = useCallback(async () => {
    const [sessaoData, exerciciosData] = await Promise.all([getSessao(sessaoId), listExercicios()]);
    const exercicioData = exerciciosData.find((e) => e._id === exercicioId) ?? null;
    if (!exercicioData) throw new Error('Exercício não encontrado');
    setSessao(sessaoData);
    setExercicio(exercicioData);
    setNome(exercicioData.nome);
    setDescricao(exercicioData.descricao ?? '');
    setCargaMaximaText(exercicioData.cargaMaximaKg !== undefined ? String(exercicioData.cargaMaximaKg) : '');
    setVideoUrlText(exercicioData.videoUrl ?? '');
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
    const updated = await updateExercicio(exercicio._id, { nome: trimmed });
    setExercicio(updated);
    showToast('Nome atualizado');
  }

  async function handleSaveDescricao() {
    const trimmed = descricao.trim();
    if (!exercicio || trimmed === (exercicio.descricao ?? '')) return;
    const updated = await updateExercicio(exercicio._id, { descricao: trimmed });
    setExercicio(updated);
    showToast('Descrição atualizada');
  }

  async function handleSaveCargaMaxima() {
    if (!exercicio) return;
    const trimmed = cargaMaximaText.trim();
    const parsed = trimmed ? Number(trimmed.replace(',', '.')) : undefined;
    if (trimmed && !Number.isFinite(parsed)) return;
    if (parsed === exercicio.cargaMaximaKg) return;
    const updated = await updateExercicio(exercicio._id, { cargaMaximaKg: parsed });
    setExercicio(updated);
    showToast('Carga máxima atualizada');
  }

  async function handleSaveVideoUrl() {
    if (!exercicio) return;
    const trimmed = videoUrlText.trim();
    if (trimmed === (exercicio.videoUrl ?? '')) return;
    const updated = await updateExercicio(exercicio._id, { videoUrl: trimmed });
    setExercicio(updated);
    showToast('Vídeo atualizado');
  }

  async function handleUploadImagem(uri: string, contentType: string) {
    if (!exercicio) return;
    const updated = await uploadExercicioImagem(exercicio._id, uri, contentType);
    setExercicio(updated);
    showToast('Foto salva');
  }

  async function handleDeleteImagem(key: string) {
    if (!exercicio) return;
    const updated = await deleteExercicioImagem(exercicio._id, key);
    setExercicio(updated);
    showToast('Foto removida');
  }

  function handleSaveFields(fields: LogFields) {
    if (!sessao || !exercicio || Object.keys(fields).length === 0) return;

    const params: UpsertEntryParams = { sessaoId: sessao._id, exercicioId: exercicio._id, ...fields };
    setSessao((current) => (current ? mergeSessaoEntry(current, exercicio, params) : current));
    void enqueueUpsertSessaoEntry(params);
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

  const entry = sessao.entries.find((e) => e.exercicioId === exercicio._id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <BackHeader title="Exercício" />
          </View>
          <Pressable onPress={() => setHistoricoVisible(true)} hitSlop={8} style={styles.historicoButton}>
            <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Histórico
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.nameCard}>
            <LabeledTextField label="Nome" value={nome} onChangeText={setNome} onBlur={handleSaveNome} maxLength={120} />
            <LabeledTextField
              label="Descrição (opcional)"
              value={descricao}
              onChangeText={setDescricao}
              onBlur={handleSaveDescricao}
              maxLength={500}
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
          </Card>

          <ExercicioEntryEditor
            key={entry?.updatedAt ?? 'default'}
            sets={entry?.sets ?? exercicio.sets}
            reps={entry?.reps ?? exercicio.reps}
            pesoKg={entry?.pesoKg ?? exercicio.pesoKg}
            onSaveFields={handleSaveFields}
          />

          <Card style={styles.photoCard}>
            <ThemedText type="smallBold">Fotos do equipamento</ThemedText>
            <ExercicioImageGallery imagens={exercicio.imagens ?? []} onUpload={handleUploadImagem} onDelete={handleDeleteImagem} />
            <VideoLinkField value={videoUrlText} onChangeText={setVideoUrlText} onBlur={handleSaveVideoUrl} />
          </Card>

          <RestTimer />
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
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  historicoButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, padding: Spacing.one },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  nameCard: { gap: Spacing.two },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  photoCard: { gap: Spacing.two },
});
