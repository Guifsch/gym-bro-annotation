import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  deleteSessao,
  getAttendance,
  listRefeicoes,
  listSessoesForDay,
  listTreinos,
  logTreinoForDay,
  setAttendance,
  updateRefeicao,
} from '@/api/workoutApi';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { showToast } from '@/components/toast';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DiaTreino, Refeicao, Treino } from '@/types/workout';
import { countRefeicaoItens } from '@/utils/refeicao';

interface DayAgendaProps {
  date: string;
}

/** What's logged/linkable for a single day — the "Registrado neste dia" + "Vincular a este dia"
 * sections. Shared between the dedicated day screen (`calendario/[date]/index.tsx`) and the
 * calendar tab's "modo simples" (which embeds it inline below the date header instead of
 * navigating to that screen), so the two stay in sync instead of drifting apart. */
export function DayAgenda({ date }: DayAgendaProps) {
  const theme = useTheme();
  const [sessoes, setSessoes] = useState<DiaTreino[]>([]);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState<string | null>(null);
  const [linkingRefeicaoId, setLinkingRefeicaoId] = useState<string | null>(null);
  const [foiNaAcademia, setFoiNaAcademia] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const load = useCallback(async () => {
    const [sessoesData, treinosData, refeicoesData, attendanceChecked] = await Promise.all([
      listSessoesForDay(date),
      listTreinos(),
      listRefeicoes(),
      getAttendance(date),
    ]);
    setSessoes(sessoesData);
    setTreinos(treinosData);
    setRefeicoes(refeicoesData);
    setFoiNaAcademia(attendanceChecked);
  }, [date]);

  const refeicoesDoDia = refeicoes.filter((r) => r.dates.includes(date));
  const nadaRegistrado = sessoes.length === 0 && refeicoesDoDia.length === 0;

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

  async function handleToggleRefeicaoLink(refeicao: Refeicao) {
    const linked = refeicao.dates.includes(date);
    const dates = linked ? refeicao.dates.filter((d) => d !== date) : [...refeicao.dates, date];
    setLinkingRefeicaoId(refeicao._id);
    try {
      const updated = await updateRefeicao(refeicao._id, { dates });
      setRefeicoes((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } finally {
      setLinkingRefeicaoId(null);
    }
  }

  async function handleToggleAttendance() {
    const next = !foiNaAcademia;
    setFoiNaAcademia(next);
    setSavingAttendance(true);
    try {
      await setAttendance(date, next);
    } catch {
      setFoiNaAcademia(!next);
      Alert.alert('Não foi possível salvar', 'Tente novamente em instantes.');
    } finally {
      setSavingAttendance(false);
    }
  }

  return (
    <>
      <Pressable onPress={handleToggleAttendance} disabled={savingAttendance} style={styles.attendanceRow}>
        <View
          style={[
            styles.attendanceCheck,
            { borderColor: foiNaAcademia ? Brand.primary : theme.border },
            foiNaAcademia && { backgroundColor: Brand.primary },
          ]}>
          {foiNaAcademia && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <ThemedText type="small">Fui na academia neste dia</ThemedText>
      </Pressable>

      <ThemedText type="smallBold">Registrado neste dia</ThemedText>
      {nadaRegistrado ? (
        <EmptyState icon="calendar-outline" title="Nada vinculado a este dia ainda." />
      ) : (
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
          {refeicoesDoDia.map((refeicao) => (
            <Pressable key={refeicao._id} onPress={() => router.push(`/(tabs)/extras/alimentacao/${refeicao._id}`)}>
              <Card style={styles.agendaRow}>
                <View style={[styles.agendaIcon, { backgroundColor: 'rgba(255,122,69,0.15)' }]}>
                  <Ionicons name="restaurant" size={20} color={Brand.accent} />
                </View>
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

      <Card style={styles.linkCard}>
        <ThemedText type="smallBold">Vincular a este dia</ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Treinos
        </ThemedText>
        {!loading && treinos.length === 0 ? (
          <EmptyState icon="barbell-outline" title="Nenhum treino cadastrado ainda (crie em Exercícios > Treinos)." />
        ) : (
          <View style={styles.list}>
            {treinos.map((item) => {
              const registrado = sessoes.some((s) => s.treinoId === item._id);
              return (
                <Pressable key={item._id} onPress={() => handleToggleTreino(item)} disabled={logging === item._id}>
                  <View style={[styles.linkRow, { borderColor: registrado ? Brand.primary : theme.border }]}>
                    <ThemedText style={{ flex: 1 }}>{item.nome}</ThemedText>
                    {registrado ? (
                      <View style={[styles.checkCircle, { backgroundColor: Brand.primary }]}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.checkCircle, { borderColor: theme.border, borderWidth: 2 }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <ThemedText type="small" themeColor="textSecondary">
          Refeições
        </ThemedText>
        {!loading && refeicoes.length === 0 ? (
          <EmptyState icon="restaurant-outline" title="Nenhuma refeição cadastrada ainda (crie em Extras > Alimentação)." />
        ) : (
          <View style={styles.list}>
            {refeicoes.map((item) => {
              const linked = item.dates.includes(date);
              return (
                <Pressable
                  key={item._id}
                  onPress={() => handleToggleRefeicaoLink(item)}
                  disabled={linkingRefeicaoId === item._id}>
                  <View style={[styles.linkRow, { borderColor: linked ? Brand.primary : theme.border }]}>
                    <ThemedText style={{ flex: 1 }}>{item.nome}</ThemedText>
                    {linked ? (
                      <View style={[styles.checkCircle, { backgroundColor: Brand.primary }]}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.checkCircle, { borderColor: theme.border, borderWidth: 2 }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  attendanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  attendanceCheck: {
    width: 22,
    height: 22,
    borderRadius: Radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  agendaIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCard: { gap: Spacing.two },
  divider: { height: 1, marginVertical: Spacing.one },
  list: { gap: Spacing.two },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
