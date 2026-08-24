import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/apiClient';
import {
  cloneExercicio,
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
import { CategoryJumpBar } from '@/components/category-jump-bar';
import { EmptyState } from '@/components/empty-state';
import { ExercicioCoverPhoto } from '@/components/exercicio-cover-photo';
import { ExercicioHistoricoModal } from '@/components/exercicio-historico-modal';
import { ExercicioImageGallery } from '@/components/exercicio-image-gallery';
import { ExercicioThumbnail } from '@/components/exercicio-thumbnail';
import { GradientButton } from '@/components/gradient-button';
import { InlineLogEditor } from '@/components/inline-log-editor';
import { LabeledTextField } from '@/components/labeled-text-field';
import { PercentualTable } from '@/components/percentual-table';
import { SubstitutoPicker } from '@/components/substituto-picker';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { VideoLinkGallery } from '@/components/video-link-gallery';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Categoria, Exercicio, LogFields } from '@/types/workout';

interface CategoriaSection {
  categoriaId: string;
  nome: string;
  data: Exercicio[];
}

export default function ExerciciosListaScreen() {
  const theme = useTheme();
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [historicoVisible, setHistoricoVisible] = useState(false);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setsText, setSetsText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [pesoText, setPesoText] = useState('');
  const [cargaMaximaText, setCargaMaximaText] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [substitutoIds, setSubstitutoIds] = useState<string[]>([]);

  const [stagedCapa, setStagedCapa] = useState<{ uri: string; contentType: string } | null>(null);
  const [stagedImagens, setStagedImagens] = useState<{ uri: string; contentType: string }[]>([]);
  const [stagedVideoUrls, setStagedVideoUrls] = useState<string[]>([]);

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

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!creating && !editingId) return false;
        resetForm();
        return true;
      });
      return () => subscription.remove();
    }, [creating, editingId])
  );

  const categoriaNomeById = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c._id, c.nome])),
    [categorias]
  );

  const editingExercicio = useMemo(() => exercicios.find((e) => e._id === editingId) ?? null, [exercicios, editingId]);

  // Substitutes are stored one-directional (each exercise's own `substitutoIds` array), but shown
  // both ways in the listing: an exercise shows its own list PLUS any other exercise that names
  // *it* as a substitute — so the user only has to set the relationship from one side and it
  // still shows up when browsing either exercise.
  const substitutosDisplayById = useMemo(() => {
    const exercicioNomeById = Object.fromEntries(exercicios.map((e) => [e._id, e.nome]));
    const map: Record<string, { id: string; nome: string }[]> = {};

    function add(exercicioId: string, substitutoId: string) {
      const nome = exercicioNomeById[substitutoId];
      if (!nome) return;
      const list = map[exercicioId] ?? (map[exercicioId] = []);
      if (!list.some((s) => s.id === substitutoId)) list.push({ id: substitutoId, nome });
    }

    for (const exercicio of exercicios) {
      for (const substitutoId of exercicio.substitutoIds) {
        add(exercicio._id, substitutoId);
        add(substitutoId, exercicio._id);
      }
    }
    return map;
  }, [exercicios]);

  const sectionListRef = useRef<SectionList<Exercicio, CategoriaSection>>(null);
  const headerRefs = useRef<Record<string, View | null>>({});
  const formScrollViewRef = useRef<ScrollView>(null);

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

  const sections = useMemo<CategoriaSection[]>(
    () => gruposPorCategoria.map((grupo) => ({ categoriaId: grupo.categoriaId, nome: grupo.nome, data: grupo.exercicios })),
    [gruposPorCategoria]
  );

  // Same fix as the calendar's sessão screen: `scrollToLocation` throws when the target section
  // hasn't been measured yet (silent in release builds, so the jump bar just did nothing) —
  // measure the header directly instead, via the SectionList's underlying native scroll node.
  function scrollToCategory(categoriaId: string) {
    const node = headerRefs.current[categoriaId];
    const scrollResponder = sectionListRef.current?.getScrollResponder();
    const nativeScrollRef = scrollResponder?.getNativeScrollRef();
    if (!node || !scrollResponder || !nativeScrollRef) return;
    node.measureLayout(
      nativeScrollRef,
      (_x, y) => scrollResponder.scrollTo({ y: Math.max(0, y - 8), animated: true }),
      () => {}
    );
  }

  async function handleUploadImagem(uri: string, contentType: string) {
    if (!editingId) {
      setStagedImagens((prev) => (prev.length >= 5 ? prev : [...prev, { uri, contentType }]));
      return;
    }
    try {
      const updated = await uploadExercicioImagem(editingId, uri, contentType);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Foto salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteImagem(key: string) {
    if (!editingId) {
      setStagedImagens((prev) => prev.filter((s) => s.uri !== key));
      return;
    }
    try {
      const updated = await deleteExercicioImagem(editingId, key);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Foto removida');
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  async function handleUploadCapa(uri: string, contentType: string) {
    if (!editingId) {
      setStagedCapa({ uri, contentType });
      return;
    }
    try {
      const updated = await uploadExercicioCapa(editingId, uri, contentType);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Capa salva');
    } catch (err) {
      Alert.alert('Não foi possível enviar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  async function handleDeleteCapa() {
    if (!editingId) {
      setStagedCapa(null);
      return;
    }
    try {
      const updated = await deleteExercicioCapa(editingId);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      showToast('Capa removida');
    } catch {
      Alert.alert('Não foi possível remover', 'Tente novamente em instantes.');
    }
  }

  async function handleAddVideo(url: string) {
    if (!editingId) {
      setStagedVideoUrls((prev) => [...prev, url]);
      return;
    }
    if (!editingExercicio) return;
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
    if (!editingId) {
      setStagedVideoUrls((prev) => prev.filter((v) => v !== url));
      return;
    }
    if (!editingExercicio) return;
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
    setSubstitutoIds([]);
    setStagedCapa(null);
    setStagedImagens([]);
    setStagedVideoUrls([]);
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
    setSubstitutoIds(exercicio.substitutoIds);
  }

  function handleGoToSubstituto(id: string) {
    const target = exercicios.find((e) => e._id === id);
    if (!target) return;
    startEditing(target);
    formScrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function handleQuickUpdate(exercicio: Exercicio, fields: LogFields) {
    try {
      const updated = await updateExercicio(exercicio._id, fields);
      setExercicios((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
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
          substitutoIds,
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
          videoUrls: stagedVideoUrls.length ? stagedVideoUrls : undefined,
          substitutoIds,
        });
        setExercicios((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
        setCreating(false);
        setEditingId(created._id);

        let current = created;
        try {
          if (stagedCapa) {
            current = await uploadExercicioCapa(current._id, stagedCapa.uri, stagedCapa.contentType);
            setExercicios((prev) => prev.map((e) => (e._id === current._id ? current : e)));
          }
          for (const imagem of stagedImagens) {
            current = await uploadExercicioImagem(current._id, imagem.uri, imagem.contentType);
            setExercicios((prev) => prev.map((e) => (e._id === current._id ? current : e)));
          }
        } catch (err) {
          Alert.alert(
            'Exercício criado, mas houve um problema ao enviar as fotos',
            getApiErrorMessage(err, 'Tente enviar novamente na edição.')
          );
        }
        setStagedCapa(null);
        setStagedImagens([]);
        setStagedVideoUrls([]);
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

  async function handleClone() {
    if (!editingId) return;
    setCloning(true);
    try {
      const clone = await cloneExercicio(editingId);
      setExercicios((prev) => [...prev, clone].sort((a, b) => a.nome.localeCompare(b.nome)));
      startEditing(clone);
      showToast('Exercício clonado');
    } catch (err) {
      Alert.alert('Não foi possível clonar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    } finally {
      setCloning(false);
    }
  }

  const canSave = Boolean(nome.trim() && setsText && repsText && pesoText);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Exercícios" onBack={creating || editingId ? resetForm : undefined} />

        {!creating && !editingId && gruposPorCategoria.length > 0 && (
          <CategoryJumpBar
            categorias={gruposPorCategoria.map((g) => ({ categoriaId: g.categoriaId, nome: g.nome }))}
            onSelect={scrollToCategory}
          />
        )}

        {creating || editingId ? (
          <ScrollView
            ref={formScrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
          {(creating || editingExercicio) && (
            <ExercicioCoverPhoto
              capa={editingExercicio?.capa ?? (stagedCapa ? { url: stagedCapa.uri, key: 'staged-capa' } : undefined)}
              onUpload={handleUploadCapa}
              onDelete={handleDeleteCapa}
            />
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

            {(creating || editingExercicio) && (
              <View style={styles.photoSection}>
                <ThemedText type="small" themeColor="textSecondary">
                  Fotos
                </ThemedText>
                <ExercicioImageGallery
                  imagens={editingExercicio?.imagens ?? stagedImagens.map((s) => ({ url: s.uri, key: s.uri }))}
                  onUpload={handleUploadImagem}
                  onDelete={handleDeleteImagem}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  Vídeos
                </ThemedText>
                <VideoLinkGallery
                  videos={editingExercicio?.videoUrls ?? stagedVideoUrls}
                  onAdd={handleAddVideo}
                  onRemove={handleRemoveVideo}
                />
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

            <ThemedText type="small" themeColor="textSecondary">
              Exercícios substitutos (opcional)
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Aparecem na listagem como alternativa caso o equipamento esteja ocupado.
            </ThemedText>
            <SubstitutoPicker
              exercicios={exercicios.filter((e) => e._id !== editingId)}
              categoriaNomeById={categoriaNomeById}
              selectedIds={substitutoIds}
              onChange={setSubstitutoIds}
            />

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
                {editingId && (
                  <Pressable onPress={handleClone} disabled={cloning} hitSlop={8} style={styles.secondaryButton}>
                    <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary">
                      Clonar
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
          </ScrollView>
        ) : !loading && exercicios.length === 0 ? (
          <View style={styles.scrollContent}>
            <GradientButton
              title="Criar exercício"
              icon={<Ionicons name="add-circle-outline" size={20} color="#fff" />}
              onPress={() => setCreating(true)}
            />
            <EmptyState icon="barbell-outline" title="Nenhum exercício ainda." />
          </View>
        ) : (
          <SectionList
            ref={sectionListRef}
            sections={sections}
            keyExtractor={(item) => item._id}
            stickySectionHeadersEnabled
            initialNumToRender={100}
            contentContainerStyle={styles.sectionContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <GradientButton
                title="Criar exercício"
                icon={<Ionicons name="add-circle-outline" size={20} color="#fff" />}
                onPress={() => setCreating(true)}
              />
            }
            ListHeaderComponentStyle={styles.createButtonHeader}
            renderSectionHeader={({ section }) => (
              <View
                ref={(el) => {
                  headerRefs.current[section.categoriaId] = el;
                }}
                style={[styles.grupoHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
                <CategoryIcon nome={section.nome} size={18} />
                <ThemedText type="smallBold" style={styles.grupoTitle}>
                  {section.nome.toUpperCase()}
                </ThemedText>
              </View>
            )}
            renderItem={({ item, index, section }) => {
              const isLastInSection = index === section.data.length - 1;
              return (
                <SwipeableRow onDelete={() => handleDelete(item)}>
                  <View style={[styles.itemWrap, isLastInSection && styles.itemWrapLastInSection]}>
                    <Pressable onPress={() => startEditing(item)}>
                      <Card style={styles.itemRow}>
                        <ExercicioThumbnail exercicio={item} categoriaNome={section.nome} size={32} />
                        <View style={{ flex: 1 }}>
                          <ThemedText type="smallBold">{item.nome}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {item.sets}x{item.reps} · {item.pesoKg}kg
                          </ThemedText>
                          {substitutosDisplayById[item._id] && (
                            <View style={styles.substitutoList}>
                              {substitutosDisplayById[item._id].map((s) => (
                                <Pressable
                                  key={s.id}
                                  onPress={() => handleGoToSubstituto(s.id)}
                                  style={styles.substitutoRow}>
                                  <Ionicons name="swap-horizontal-outline" size={12} color={Brand.primary} />
                                  <ThemedText type="small" style={styles.substitutoText} numberOfLines={1}>
                                    {s.nome}
                                  </ThemedText>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                        <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteButton}>
                          <Ionicons name="trash-outline" size={18} color="#e53935" />
                        </Pressable>
                      </Card>
                    </Pressable>
                    <InlineLogEditor
                      key={`${item._id}-${item.sets}-${item.reps}-${item.pesoKg}`}
                      sets={item.sets}
                      reps={item.reps}
                      pesoKg={item.pesoKg}
                      onSaveFields={(fields) => handleQuickUpdate(item, fields)}
                    />
                  </View>
                </SwipeableRow>
              );
            }}
          />
        )}
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
  sectionContent: { paddingBottom: Spacing.five },
  createButtonHeader: { marginBottom: Spacing.three },
  itemWrap: { gap: 2, marginTop: Spacing.one },
  itemWrapLastInSection: { marginBottom: Spacing.three },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  substitutoList: { gap: 2, marginTop: 2 },
  substitutoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  substitutoText: { color: Brand.primary, textDecorationLine: 'underline' },
  deleteButton: { padding: Spacing.one },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  grupoTitle: { fontSize: 16, letterSpacing: 0.6, color: Brand.primary },
});
