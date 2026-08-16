import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createRefeicao, deleteSessao, listRefeicoes, listSessoesForDay, listTreinos, logTreinoForDay } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiaTreino, Refeicao, Treino } from '@/types/workout';
import { formatDateDisplay } from '@/utils/date';
import { countRefeicaoItens } from '@/utils/refeicao';

export default function CalendarioDiaScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const theme = useTheme();
  const [sessoes, setSessoes] = useState<DiaTreino[]>([]);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState<string | null>(null);
  const [addingRefeicao, setAddingRefeicao] = useState(false);

  const load = useCallback(async () => {
    const [sessoesData, treinosData, refeicoesData] = await Promise.all([
      listSessoesForDay(date),
      listTreinos(),
      listRefeicoes(),
    ]);
    setSessoes(sessoesData);
    setTreinos(treinosData);
    setRefeicoes(refeicoesData.filter((r) => r.dates.includes(date)));
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function handleToggleTreino(treino: Treino) {
    const existing = sessoes.find((s) => s.treinoId === treino._id);
    setLogging(treino._id);
    try {
      if (existing) {
        await deleteSessao(existing._id);
        setSessoes((prev) => prev.filter((s) => s._id !== existing._id));
        showToast('Removido do dia');
      } else {
        const sessao = await logTreinoForDay({ treinoId: treino._id, date });
        setSessoes((prev) =>
          prev.some((s) => s._id === sessao._id)
            ? prev
            : [...prev, { _id: sessao._id, treinoId: sessao.treinoId, treinoNome: treino.nome, date: sessao.date }]
        );
        showToast('Treino registrado');
      }
    } finally {
      setLogging(null);
    }
  }

  async function handleAddRefeicao() {
    setAddingRefeicao(true);
    try {
      const refeicao = await createRefeicao({ id: Crypto.randomUUID(), nome: 'Nova refeição', dates: [date] });
      router.push(`/(tabs)/extras/alimentacao/${refeicao._id}`);
    } finally {
      setAddingRefeicao(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title={formatDateDisplay(date)} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {sessoes.length > 0 && (
            <>
              <ThemedText type="smallBold">Registrado hoje</ThemedText>
              <View style={styles.tileWrap}>
                {sessoes.map((sessao) => (
                  <Pressable key={sessao._id} onPress={() => router.push(`/(tabs)/calendario/${date}/${sessao._id}`)}>
                    <LinearGradient colors={[Brand.primary, Brand.primaryDark]} style={styles.tile}>
                      <View style={styles.tileIcon}>
                        <Ionicons name="barbell" size={22} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold" style={styles.tileText}>
                          {sessao.treinoNome}
                        </ThemedText>
                        <ThemedText type="small" style={styles.tileSubtext}>
                          Toque para editar os exercícios
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={22} color="#fff" />
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <ThemedText type="smallBold">Registrar treino</ThemedText>
          {!loading && treinos.length === 0 ? (
            <EmptyState icon="barbell-outline" title="Nenhum treino cadastrado ainda (crie em Exercícios > Treinos)." />
          ) : (
            <View style={styles.list}>
              {treinos.map((item) => {
                const registrado = sessoes.some((s) => s.treinoId === item._id);
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => handleToggleTreino(item)}
                    disabled={logging === item._id}>
                    <Card style={[styles.row, registrado && { borderColor: Brand.primary, borderWidth: 2 }]}>
                      <ThemedText>{item.nome}</ThemedText>
                      {registrado ? (
                        <View style={[styles.checkCircle, { backgroundColor: Brand.primary }]}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                      ) : (
                        <View style={[styles.checkCircle, { borderColor: theme.border, borderWidth: 2 }]} />
                      )}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.sectionHeaderRow}>
            <ThemedText type="smallBold">Refeições</ThemedText>
            <Pressable onPress={handleAddRefeicao} disabled={addingRefeicao} hitSlop={8} style={styles.addRefeicaoButton}>
              <Ionicons name="add-circle-outline" size={20} color={Brand.primary} />
            </Pressable>
          </View>
          {refeicoes.length === 0 ? (
            <EmptyState icon="restaurant-outline" title="Nenhuma refeição vinculada a este dia ainda." />
          ) : (
            <View style={styles.list}>
              {refeicoes.map((refeicao) => (
                <Pressable key={refeicao._id} onPress={() => router.push(`/(tabs)/extras/alimentacao/${refeicao._id}`)}>
                  <Card style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">{refeicao.nome}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {countRefeicaoItens(refeicao) === 1 ? '1 item' : `${countRefeicaoItens(refeicao)} itens`}
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Brand.primary} />
                  </Card>
                </Pressable>
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addRefeicaoButton: { padding: Spacing.one },
  tileWrap: { gap: Spacing.two },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    borderRadius: Radius.lg,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { color: '#fff', fontSize: 18 },
  tileSubtext: { color: 'rgba(255,255,255,0.85)' },
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
