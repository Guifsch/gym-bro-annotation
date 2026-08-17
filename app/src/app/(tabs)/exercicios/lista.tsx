import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import {
  createExercicio,
  deleteExercicio,
  deleteExercicioCapa,
  deleteExercicioImagem,
  listCategorias,
  listExercicios,
  updateExercicio,
  uploadExercicioCapa,
  uploadExercicioImagem,
} from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { EmptyState } from '@/components/empty-state';
import { ExercicioCoverPhoto } from '@/components/exercicio-cover-photo';
import { ExercicioHistoricoModal } from '@/components/exercicio-historico-modal';
import { ExercicioImageGallery } from '@/components/exercicio-image-gallery';
import { ExercicioThumbnail } from '@/components/exercicio-thumbnail';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { PercentualTable } from '@/components/percentual-table';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { VideoLinkGallery } from '@/components/video-link-gallery';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Categoria, Exercicio } from '@/types/workout';

export default function ExerciciosListaScreen() {
  const theme = useTheme();
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historicoVisible, setHistoricoVisible] = useState(false);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setsText, setSetsText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [pesoText, setPesoText] = useState('');
  const [cargaMaximaText, setCargaMaximaText] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exerciciosData, categoriasData] = await Promise.all([listExercicios(), listCategorias()]);
      setExercicios(exerciciosData);
      setCategorias(categoriasData);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categoriaNomeById = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c._id, c.nome])),
    [categorias]
  );

  const editingExercicio = useMemo(() => exercicios.find((e) => e._id === editingId) ?? null, [exercicios, editingId]);

  const gruposPorCategoria = useMemo(() => {
    const map = new Map<string, Exercicio[]>();
    for (const exercicio of exercicios) {
      const arr = map.get(exercicio.categoriaId) ?? [];
      arr.push(exercicio);
      map.set(exercicio.categoriaId, arr);
    }
    return Array.from(map.entries())
      .map(([categoriaId, exerciciosDaCategoria]) => ({
        categoriaId,
        nome: categoriaNomeById[categoriaId] ?? 'Categoria removida',
        exercicios: exerciciosDaCategoria,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [exercicios, categoriaNomeById]);

  async function handleUploadImagem(uri: string, contentType: string) {
    if (!editingId) return;
    try {
      const updated = await uploadExercicioImagem(editingId, uri, contentType);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Foto salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteImagem(key: string) {
    if (!editingId) return;
    try {
      const updated = await deleteExercicioImagem(editingId, key);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Foto removida');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  async function handleUploadCapa(uri: string, contentType: string) {
    if (!editingId) return;
    try {
      const updated = await uploadExercicioCapa(editingId, uri, contentType);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Capa salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteCapa() {
    if (!editingId) return;
    try {
      const updated = await deleteExercicioCapa(editingId);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Capa removida');
    } catch {
      Alert.alert('Não foi possível remover', 'Tente novamente em instantes.');
    }
  }

  async function handleAddVideo(url: string) {
    if (!editingId || !editingExercicio) return;
    try {
      const videoUrls = [...editingExercicio.videoUrls, url];
      const updated = await updateExercicio(editingId, { videoUrls });
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Vídeo adicionado');
    } catch (err) {
      Alert.alert('Não foi possível adicionar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleRemoveVideo(url: string) {
    if (!editingId || !editingExercicio) return;
    try {
      const videoUrls = editingExercicio.videoUrls.filter((v) => v !== url);
      const updated = await updateExercicio(editingId, { videoUrls });
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Vídeo removido');
    } catch (err) {
      Alert.alert('Não foi possível remover', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  function resetForm() {
    setEditingId(null);
    setCreating(false);
    setNome('');
    setDescricao('');
    setSetsText('');
    setRepsText('');
    setPesoText('');
    setCargaMaximaText('');
    setCategoriaId(null);
  }

  function startEditing(exercicio: Exercicio) {
    setEditingId(exercicio._id);
    setNome(exercicio.nome);
    setDescricao(exercicio.descricao ?? '');
    setSetsText(String(exercicio.sets));
    setRepsText(String(exercicio.reps));
    setPesoText(String(exercicio.pesoKg));
    setCargaMaximaText(exercicio.cargaMaximaKg !== undefined ? String(exercicio.cargaMaximaKg) : '');
    setCategoriaId(exercicio.categoriaId);
  }

  async function handleSave() {
    const parsedSets = Math.round(Number(setsText));
    const parsedReps = Math.round(Number(repsText));
    const parsedPeso = Number(pesoText.replace(',', '.'));
    const parsedCargaMaxima = cargaMaximaText.trim() ? Number(cargaMaximaText.replace(',', '.')) : undefined;

    if (!nome.trim() || !Number.isFinite(parsedSets) || !Number.isFinite(parsedReps) || !Number.isFinite(parsedPeso)) {
      return;
    }

    if (!categoriaId) {
      Alert.alert('Selecione uma categoria', 'Escolha uma categoria antes de salvar.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateExercicio(editingId, {
          nome: nome.trim(),
          descricao: descricao.trim(),
          categoriaId,
          sets: parsedSets,
          reps: parsedReps,
          pesoKg: parsedPeso,
          cargaMaximaKg: parsedCargaMaxima,
        });
        setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      } else {
        const created = await createExercicio({
          id: Crypto.randomUUID(),
          nome: nome.trim(),
          descricao: descricao.trim(),
          categoriaId,
          sets: parsedSets,
          reps: parsedReps,
          pesoKg: parsedPeso,
          cargaMaximaKg: parsedCargaMaxima,
        });
        setExercicios((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
        setCreating(false);
        setEditingId(created._id);
      }
      showToast('Salvo');
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setSaving(false);
    }
  }

  async function performDelete(exercicio: Exercicio) {
    try {
      await deleteExercicio(exercicio._id);
      setExercicios((prev) => prev.filter((e) => e._id !== exercicio._id));
      showToast('Excluído');
      if (editingId === exercicio._id) resetForm();
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  function handleDelete(exercicio: Exercicio) {
    Alert.alert('Excluir exercício?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => performDelete(exercicio) },
    ]);
  }

  const canSave = Boolean(nome.trim() && setsText && repsText && pesoText);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Exercícios" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!creating && !editingId ? (
            <GradientButton
              title="Criar exercício"
              icon={<Ionicons name="add-circle-outline" size={20} color="#fff" />}
              onPress={() => setCreating(true)}
            />
          ) : (
          <>
          {editingExercicio && (
            <ExercicioCoverPhoto capa={editingExercicio.capa} onUpload={handleUploadCapa} onDelete={handleDeleteCapa} />
          )}
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

            {editingExercicio && (
              <View style={styles.photoSection}>
                <ThemedText type="small" themeColor="textSecondary">
                  Fotos
                </ThemedText>
                <ExercicioImageGallery
                  imagens={editingExercicio.imagens ?? []}
                  onUpload={handleUploadImagem}
                  onDelete={handleDeleteImagem}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  Vídeos
                </ThemedText>
                <VideoLinkGallery videos={editingExercicio.videoUrls} onAdd={handleAddVideo} onRemove={handleRemoveVideo} />
              </View>
            )}

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
              {categorias.length === 0 && (
                <ThemedText type="small">Nenhuma categoria ainda — crie uma primeiro.</ThemedText>
              )}
            </View>

            <View style={styles.actionsColumn}>
              <GradientButton
                title={editingId ? 'Salvar alterações' : 'Criar exercício'}
                onPress={handleSave}
                loading={saving}
                disabled={!canSave}
              />
              <View style={styles.secondaryRow}>
                {editingId && (
                  <Pressable onPress={() => setHistoricoVisible(true)} hitSlop={8} style={styles.secondaryButton}>
                    <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary">
                      Histórico
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable onPress={resetForm} hitSlop={8} style={styles.secondaryButton}>
                  <Ionicons name="close-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Cancelar
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Card>
          </>
          )}

          {!creating && !editingId && (
            <>
              {!loading && exercicios.length === 0 ? (
                <EmptyState icon="barbell-outline" title="Nenhum exercício ainda." />
              ) : (
                <View style={styles.groupsWrap}>
                  {gruposPorCategoria.map((grupo) => (
                    <View key={grupo.categoriaId} style={styles.grupo}>
                      <View style={styles.grupoHeader}>
                        <CategoryIcon nome={grupo.nome} size={16} />
                        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.grupoTitle}>
                          {grupo.nome.toUpperCase()}
                        </ThemedText>
                      </View>
                      <View style={styles.list}>
                        {grupo.exercicios.map((item) => (
                          <SwipeableRow key={item._id} onDelete={() => handleDelete(item)}>
                            <Pressable onPress={() => startEditing(item)}>
                              <Card style={styles.itemRow}>
                                <ExercicioThumbnail exercicio={item} categoriaNome={grupo.nome} />
                                <View style={{ flex: 1 }}>
                                  <ThemedText type="smallBold">{item.nome}</ThemedText>
                                  <ThemedText type="small" themeColor="textSecondary">
                                    {item.sets}x{item.reps} · {item.pesoKg}kg
                                  </ThemedText>
                                </View>
                                <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteButton}>
                                  <Ionicons name="trash-outline" size={18} color="#e53935" />
                                </Pressable>
                              </Card>
                            </Pressable>
                          </SwipeableRow>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <ExercicioHistoricoModal
        visible={historicoVisible}
        exercicioId={editingId}
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
  actionsColumn: { gap: Spacing.two, marginTop: Spacing.one },
  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.five },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, padding: Spacing.one },
  list: { gap: Spacing.two },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  deleteButton: { padding: Spacing.one },
  groupsWrap: { gap: Spacing.four },
  grupo: { gap: Spacing.two },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingLeft: Spacing.one },
  grupoTitle: { letterSpacing: 0.5 },
});
