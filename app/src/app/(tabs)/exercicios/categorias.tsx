import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createCategoria, deleteCategoria, listCategorias, updateCategoria } from '@/api/workoutApi';
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
import { Spacing } from '@/constants/theme';
import type { Categoria } from '@/types/workout';

export default function CategoriasScreen() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategorias(await listCategorias());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleCreate() {
    const nome = novoNome.trim();
    if (!nome) return;
    setCreating(true);
    try {
      const categoria = await createCategoria({ id: Crypto.randomUUID(), nome });
      setCategorias((prev) => [...prev, categoria].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovoNome('');
      showToast('Categoria criada');
    } finally {
      setCreating(false);
    }
  }

  function startEditing(categoria: Categoria) {
    setEditingId(categoria._id);
    setEditingNome(categoria.nome);
  }

  async function handleSaveEdit() {
    if (!editingId || !editingNome.trim()) return;
    const updated = await updateCategoria(editingId, { nome: editingNome.trim() });
    setCategorias((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    setEditingId(null);
    showToast('Salvo');
  }

  async function performDelete(categoria: Categoria) {
    try {
      await deleteCategoria(categoria._id);
      setCategorias((prev) => prev.filter((c) => c._id !== categoria._id));
      showToast('Excluído');
    } catch {
      Alert.alert('Não foi possível excluir', 'Existem exercícios vinculados a esta categoria.');
    }
  }

  function handleDelete(categoria: Categoria) {
    Alert.alert('Excluir categoria?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => performDelete(categoria) },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Categorias" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
          <Card style={styles.formCard}>
            <LabeledTextField
              placeholder="Nova categoria"
              value={novoNome}
              onChangeText={setNovoNome}
              maxLength={120}
            />
            <GradientButton title="Adicionar" onPress={handleCreate} loading={creating} disabled={!novoNome.trim()} />
          </Card>

          {!loading && categorias.length === 0 ? (
            <EmptyState icon="pricetags-outline" title="Nenhuma categoria ainda." />
          ) : (
            <View style={styles.list}>
              {categorias.map((item) =>
                editingId === item._id ? (
                  <Card key={item._id} style={styles.editRow}>
                    <View style={{ flex: 1 }}>
                      <LabeledTextField value={editingNome} onChangeText={setEditingNome} autoFocus maxLength={120} />
                    </View>
                    <Pressable onPress={handleSaveEdit} hitSlop={8}>
                      <ThemedText type="linkPrimary">salvar</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => setEditingId(null)} hitSlop={8}>
                      <ThemedText type="small">cancelar</ThemedText>
                    </Pressable>
                  </Card>
                ) : (
                  <SwipeableRow key={item._id} onDelete={() => handleDelete(item)}>
                    <Pressable onPress={() => startEditing(item)}>
                      <Card style={styles.row}>
                        <CategoryIcon nome={item.nome} />
                        <ThemedText style={{ flex: 1 }}>{item.nome}</ThemedText>
                        <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteButton}>
                          <Ionicons name="trash-outline" size={18} color="#e53935" />
                        </Pressable>
                      </Card>
                    </Pressable>
                  </SwipeableRow>
                )
              )}
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
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  deleteButton: { padding: Spacing.one },
});
