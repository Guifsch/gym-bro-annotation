import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteExercicioHistoricoEntry, getExercicioHistorico } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import type { ExercicioHistoricoEntry } from '@/types/workout';
import { formatDateTimeDisplay } from '@/utils/date';

interface ExercicioHistoricoModalProps {
  visible: boolean;
  exercicioId: string | null;
  onClose: () => void;
}

export function ExercicioHistoricoModal({ visible, exercicioId, onClose }: ExercicioHistoricoModalProps) {
  const [entries, setEntries] = useState<ExercicioHistoricoEntry[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !exercicioId) return;
    getExercicioHistorico(exercicioId).then((data) => {
      setEntries(data);
      setLoadedFor(exercicioId);
    });
  }, [visible, exercicioId]);

  const loading = visible && loadedFor !== exercicioId;

  async function performDelete(entryId: string) {
    if (!exercicioId) return;
    const historico = await deleteExercicioHistoricoEntry(exercicioId, entryId);
    setEntries(historico);
    showToast('Removido');
  }

  function handleDelete(entryId: string) {
    Alert.alert('Excluir este registro do histórico?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => performDelete(entryId) },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <BackHeader title="Histórico de edições" onBack={onClose} />
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {!loading && entries.length === 0 ? (
              <EmptyState icon="time-outline" title="Nenhuma edição anterior ainda." />
            ) : (
              <View style={styles.list}>
                {entries.map((entry, index) => (
                  <Card key={entry._id ?? `${entry.alteradoEm}-${index}`} style={styles.historicoRow}>
                    <View style={styles.historicoHeader}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatDateTimeDisplay(entry.alteradoEm)}
                      </ThemedText>
                      {entry._id && (
                        <Pressable onPress={() => handleDelete(entry._id)} hitSlop={8} style={styles.deleteButton}>
                          <Ionicons name="trash-outline" size={16} color="#e53935" />
                        </Pressable>
                      )}
                    </View>
                    <ThemedText type="smallBold">{entry.nome}</ThemedText>
                    {entry.descricao ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {entry.descricao}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="small" themeColor="textSecondary">
                      {entry.sets}x{entry.reps} · {entry.pesoKg}kg
                    </ThemedText>
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  list: { gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
  historicoRow: { gap: Spacing.half },
  historicoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
