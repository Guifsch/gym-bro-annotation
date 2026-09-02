import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { getApiErrorMessage } from '@/api/apiClient';
import {
  cloneExercicio,
  deleteExercicioCapa,
  deleteExercicioImagem,
  updateExercicio,
  uploadExercicioCapa,
  uploadExercicioImagem,
  type UpdateExercicioParams,
} from '@/api/workoutApi';
import { Card } from '@/components/card';
import { ExercicioCoverPhoto } from '@/components/exercicio-cover-photo';
import { ExercicioHistoricoModal } from '@/components/exercicio-historico-modal';
import { ExercicioImageGallery } from '@/components/exercicio-image-gallery';
import { LabeledTextField } from '@/components/labeled-text-field';
import { PercentualTable } from '@/components/percentual-table';
import { SubstitutoPicker } from '@/components/substituto-picker';
import { ThemedText } from '@/components/themed-text';
import { showToast } from '@/components/toast';
import { VideoLinkGallery } from '@/components/video-link-gallery';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { enqueueUpdateExercicio } from '@/offline/queue';
import type { Categoria, Exercicio } from '@/types/workout';

export interface ExercicioEditFormHandle {
  /** Imperative because the "Salvar alterações" button lives in the screen's own `FixedBottomBar`
   * — that has to be a sibling of the screen's `SafeAreaView`, not nested inside this form (see
   * `fixed-bottom-bar.tsx`), so the button and the save logic that reads this form's field state
   * can't share a normal prop-drilled `onPress` — they need a ref bridge instead. */
  save: () => void;
}

interface ExercicioEditFormProps {
  exercicio: Exercicio;
  categorias: Categoria[];
  /** Every other exercise (for the substitute picker) — this form excludes `exercicio` itself. */
  exercicios: Exercicio[];
  /** Fires after any change is actually applied locally (save, photo/video upload) — sync your
   * own list/state with it. Not called for a clone, since that creates a separate new exercício. */
  onExercicioChange: (updated: Exercicio) => void;
  /** Fires once a clone was created server-side — the clone itself, not this form's `exercicio`. */
  onCloned?: (clone: Exercicio) => void;
}

/**
 * The exercise-edit form shared by the Exercícios tab (`exercicios/lista.tsx`, in its inline edit
 * mode) and the calendar's exercise-inside-a-session screen — same fields, same single "Salvar
 * alterações" action, same histórico. Render this with `key={exercicio._id}` from both call sites:
 * internal field state is only initialized once per mount, and switching *which* exercício is being
 * edited (e.g. tapping a substitute) needs a fresh mount to pick up the new exercício's values —
 * this mirrors what the old inline form in `lista.tsx` did explicitly via `startEditing()`.
 */
export const ExercicioEditForm = forwardRef<ExercicioEditFormHandle, ExercicioEditFormProps>(function ExercicioEditForm(
  { exercicio, categorias, exercicios, onExercicioChange, onCloned },
  ref
) {
  const theme = useTheme();
  const [nome, setNome] = useState(exercicio.nome);
  const [descricao, setDescricao] = useState(exercicio.descricao ?? '');
  const [cargaMaximaText, setCargaMaximaText] = useState(
    exercicio.cargaMaximaKg !== undefined ? String(exercicio.cargaMaximaKg) : ''
  );
  const [setsText, setSetsText] = useState(String(exercicio.sets));
  const [repsText, setRepsText] = useState(String(exercicio.reps));
  const [pesoText, setPesoText] = useState(String(exercicio.pesoKg));
  const [categoriaId, setCategoriaId] = useState(exercicio.categoriaId);
  const [substitutoIds, setSubstitutoIds] = useState(exercicio.substitutoIds);
  const [historicoVisible, setHistoricoVisible] = useState(false);
  const [cloning, setCloning] = useState(false);

  const categoriaNomeById = useMemo(() => Object.fromEntries(categorias.map((c) => [c._id, c.nome])), [categorias]);
  const outrosExercicios = useMemo(() => exercicios.filter((e) => e._id !== exercicio._id), [exercicios, exercicio._id]);

  function arraysEqualAsSets(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((id) => setB.has(id));
  }

  // Nome/Descrição/Carga máxima/Categoria/Substitutos/Sets/Reps/Peso all used to save individually
  // in different ways (some on blur, some the moment a chip/picker changed) — but blur also fires
  // when a field loses focus because the screen is navigating away (e.g. the hardware back
  // button), and racing that against unmount was the root cause of a real stuck-loading bug. One
  // explicit button that saves only whatever actually changed, as a single offline-queued
  // mutation, avoids that race entirely and keeps this resilient to bad gym wifi — the update
  // applies to the UI immediately and syncs whenever a connection actually shows up.
  function handleSave() {
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

    const fields: UpdateExercicioParams = {};
    if (trimmedNome !== exercicio.nome) fields.nome = trimmedNome;
    if (descricao.trim() !== (exercicio.descricao ?? '')) fields.descricao = descricao.trim();
    if (parsedCarga !== exercicio.cargaMaximaKg) fields.cargaMaximaKg = parsedCarga;
    if (categoriaId !== exercicio.categoriaId) fields.categoriaId = categoriaId;
    if (!arraysEqualAsSets(substitutoIds, exercicio.substitutoIds)) fields.substitutoIds = substitutoIds;
    if (parsedSets !== exercicio.sets) fields.sets = parsedSets;
    if (parsedReps !== exercicio.reps) fields.reps = parsedReps;
    if (parsedPeso !== exercicio.pesoKg) fields.pesoKg = parsedPeso;

    if (Object.keys(fields).length === 0) return;

    onExercicioChange({ ...exercicio, ...fields });
    void enqueueUpdateExercicio({ exercicioId: exercicio._id, fields });
    showToast('Salvo');
  }

  // No deps array — re-registers on every render, cheap and always correct (avoids the handle
  // ever closing over a stale `exercicio`/field snapshot).
  useImperativeHandle(ref, () => ({ save: handleSave }));

  async function handleUploadCapa(uri: string, contentType: string) {
    try {
      const updated = await uploadExercicioCapa(exercicio._id, uri, contentType);
      onExercicioChange(updated);
      showToast('Capa salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteCapa() {
    try {
      const updated = await deleteExercicioCapa(exercicio._id);
      onExercicioChange(updated);
      showToast('Capa removida');
    } catch {
      Alert.alert('Não foi possível remover', 'Tente novamente em instantes.');
    }
  }

  async function handleUploadImagem(uri: string, contentType: string) {
    try {
      const updated = await uploadExercicioImagem(exercicio._id, uri, contentType);
      onExercicioChange(updated);
      showToast('Foto salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteImagem(key: string) {
    try {
      const updated = await deleteExercicioImagem(exercicio._id, key);
      onExercicioChange(updated);
      showToast('Foto removida');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  async function handleAddVideo(url: string) {
    try {
      const videoUrls = [...exercicio.videoUrls, url];
      const updated = await updateExercicio(exercicio._id, { videoUrls });
      onExercicioChange(updated);
      showToast('Vídeo adicionado');
    } catch (err) {
      Alert.alert('Não foi possível adicionar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleRemoveVideo(url: string) {
    try {
      const videoUrls = exercicio.videoUrls.filter((v) => v !== url);
      const updated = await updateExercicio(exercicio._id, { videoUrls });
      onExercicioChange(updated);
      showToast('Vídeo removido');
    } catch (err) {
      Alert.alert('Não foi possível remover', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleClone() {
    setCloning(true);
    try {
      const clone = await cloneExercicio(exercicio._id);
      onCloned?.(clone);
      showToast('Exercício clonado');
    } catch (err) {
      Alert.alert('Não foi possível clonar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCloning(false);
    }
  }

  return (
    <>
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
            <LabeledTextField label="Sets" value={setsText} onChangeText={setSetsText} keyboardType="number-pad" maxLength={2} />
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
          exercicios={outrosExercicios}
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

      <ExercicioHistoricoModal
        visible={historicoVisible}
        exercicioId={exercicio._id}
        onClose={() => setHistoricoVisible(false)}
      />
    </>
  );
});

const styles = StyleSheet.create({
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
