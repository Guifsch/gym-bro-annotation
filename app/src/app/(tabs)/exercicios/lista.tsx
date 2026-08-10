import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createExercicio, deleteExercicio, listCategorias, listExercicios, updateExercicio } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { EmptyState } from '@/components/empty-state';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Categoria, Exercicio } from '@/types/workout';

export default function ExerciciosListaScreen() {
  const theme = useTheme();
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setsText, setSetsText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [pesoText, setPesoText] = useState('');
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

  function resetForm() {
    setEditingId(null);
    setNome('');
    setDescricao('');
    setSetsText('');
    setRepsText('');
    setPesoText('');
    setCategoriaId(null);
  }

  function startEditing(exercicio: Exercicio) {
    setEditingId(exercicio._id);
    setNome(exercicio.nome);
    setDescricao(exercicio.descricao ?? '');
    setSetsText(String(exercicio.sets));
    setRepsText(String(exercicio.reps));
    setPesoText(String(exercicio.pesoKg));
    setCategoriaId(exercicio.categoriaId);
  }

  async function handleSave() {
    const parsedSets = Math.round(Number(setsText));
    const parsedReps = Math.round(Number(repsText));
    const parsedPeso = Number(pesoText.replace(',', '.'));

    if (!nome.trim() || !categoriaId || !Number.isFinite(parsedSets) || !Number.isFinite(parsedReps) || !Number.isFinite(parsedPeso)) {
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
        });
        setExercicios((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
      }
      showToast('Salvo');
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exercicio: Exercicio) {
    try {
      await deleteExercicio(exercicio._id);
      setExercicios((prev) => prev.filter((e) => e._id !== exercicio._id));
      showToast('Excluído');
      if (editingId === exercicio._id) resetForm();
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  const canSave = Boolean(nome.trim() && categoriaId && setsText && repsText && pesoText);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackHeader title="Exercícios" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.formCard}>
            <LabeledTextField label="Nome" value={nome} onChangeText={setNome} maxLength={120} />
            <LabeledTextField
              label="Descrição (opcional)"
              value={descricao}
              onChangeText={setDescricao}
              maxLength={500}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />

            <View style={styles.fieldsRow}>
              <View style={styles.field}>
                <LabeledTextField
                  label="Sets"
                  value={setsText}
                  onChangeText={setSetsText}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.field}>
                <LabeledTextField
                  label="Repetições"
                  value={repsText}
                  onChangeText={setRepsText}
                  keyboardType="number-pad"
                  maxLength={4}
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

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <GradientButton
                  title={editingId ? 'Salvar alterações' : 'Criar exercício'}
                  onPress={handleSave}
                  loading={saving}
                  disabled={!canSave}
                />
              </View>
              {editingId && (
                <Pressable onPress={resetForm} hitSlop={8}>
                  <ThemedText type="small">cancelar</ThemedText>
                </Pressable>
              )}
            </View>
          </Card>

          {!loading && exercicios.length === 0 ? (
            <EmptyState icon="barbell-outline" title="Nenhum exercício ainda." />
          ) : (
            <View style={styles.list}>
              {exercicios.map((item) => (
                <SwipeableRow key={item._id} onDelete={() => handleDelete(item)}>
                  <Pressable onPress={() => startEditing(item)}>
                    <Card style={styles.itemRow}>
                      <CategoryIcon nome={categoriaNomeById[item.categoriaId] ?? ''} />
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold">{item.nome}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {categoriaNomeById[item.categoriaId] ?? 'Categoria'} · {item.sets}x{item.reps} ·{' '}
                          {item.pesoKg}kg
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
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  formCard: { gap: Spacing.two },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  fieldsRow: { flexDirection: 'row', gap: Spacing.two },
  field: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one },
  list: { gap: Spacing.two },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  deleteButton: { padding: Spacing.one },
});
