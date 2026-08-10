import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { LoadingView } from '@/components/loading-view';
import { showToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { mergeSessaoEntry } from '@/offline/mergeSessaoEntry';
import { enqueueUpsertSessaoEntry } from '@/offline/queue';
import type { Exercicio, Sessao } from '@/types/workout';

export default function ExercicioDetalheScreen() {
  const { date, sessaoId, exercicioId } = useLocalSearchParams<{ date: string; sessaoId: string; exercicioId: string }>();

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [exercicio, setExercicio] = useState<Exercicio | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploadingImagem, setUploadingImagem] = useState(false);

  const load = useCallback(async () => {
    const [sessaoData, exerciciosData] = await Promise.all([getSessao(sessaoId), listExercicios()]);
    const exercicioData = exerciciosData.find((e) => e._id === exercicioId) ?? null;
    if (!exercicioData) throw new Error('Exercício não encontrado');
    setSessao(sessaoData);
    setExercicio(exercicioData);
    setNome(exercicioData.nome);
    setDescricao(exercicioData.descricao ?? '');
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
        <SafeAreaView style={styles.safeArea}>
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

  async function handleTakePhoto() {
    if (!exercicio) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setUploadingImagem(true);
    try {
      const updated = await uploadExercicioImagem(exercicio._id, asset.uri, asset.mimeType ?? 'image/jpeg');
      setExercicio(updated);
      showToast('Foto salva');
    } finally {
      setUploadingImagem(false);
    }
  }

  async function handleDeleteImagem() {
    if (!exercicio) return;
    setUploadingImagem(true);
    try {
      const updated = await deleteExercicioImagem(exercicio._id);
      setExercicio(updated);
      showToast('Foto removida');
    } finally {
      setUploadingImagem(false);
    }
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
        <SafeAreaView style={styles.safeArea}>
          <LoadingView />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const entry = sessao.entries.find((e) => e.exercicioId === exercicio._id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackHeader title="Exercício" />

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
          </Card>

          <ExercicioEntryEditor
            key={entry?.updatedAt ?? 'default'}
            sets={entry?.sets ?? exercicio.sets}
            reps={entry?.reps ?? exercicio.reps}
            pesoKg={entry?.pesoKg ?? exercicio.pesoKg}
            onSaveFields={handleSaveFields}
          />

          <Card style={styles.photoCard}>
            <ThemedText type="smallBold">Foto do equipamento</ThemedText>
            {exercicio.imagemUrl ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: exercicio.imagemUrl }} style={styles.photo} />
                <Pressable onPress={handleDeleteImagem} disabled={uploadingImagem} style={styles.photoDelete}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <GradientButton
                title="Tirar foto"
                icon={<Ionicons name="camera-outline" size={20} color="#fff" />}
                onPress={handleTakePhoto}
                loading={uploadingImagem}
              />
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  nameCard: { gap: Spacing.two },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  photoCard: { gap: Spacing.two },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 220, borderRadius: Radius.md },
  photoDelete: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    padding: Spacing.two,
  },
});
