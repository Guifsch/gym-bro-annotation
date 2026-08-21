import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AttendanceSummary, getAttendanceSummary } from '@/api/workoutApi';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { LoadingView } from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH_INDEX = now.getMonth();

export default function RelatoriosScreen() {
  const theme = useTheme();
  // Pinned to the real current month/year regardless of which year the chart below is browsing,
  // so navigating the chart to a past year doesn't make the "Este mês"/"Este ano" tiles lie.
  const [thisYearSummary, setThisYearSummary] = useState<AttendanceSummary | null>(null);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [chartSummary, setChartSummary] = useState<AttendanceSummary | null>(null);

  useEffect(() => {
    getAttendanceSummary(String(CURRENT_YEAR)).then(setThisYearSummary);
  }, []);

  useEffect(() => {
    getAttendanceSummary(String(selectedYear)).then(setChartSummary);
  }, [selectedYear]);

  // Derived instead of a separate loading flag — setState directly in an effect body (vs. inside
  // its promise callback, as above) triggers cascading renders the lint rule flags.
  const loadingChart = !chartSummary || chartSummary.year !== String(selectedYear);

  const esteMes = thisYearSummary?.perMonth[CURRENT_MONTH_INDEX] ?? 0;
  const esteAno = thisYearSummary?.total ?? 0;
  const maxMes = chartSummary ? Math.max(1, ...chartSummary.perMonth) : 1;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Relatórios" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <Card style={styles.statTile}>
              <ThemedText type="small" themeColor="textSecondary">
                Este mês
              </ThemedText>
              <ThemedText type="title" style={styles.statValue}>
                {esteMes}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {esteMes === 1 ? 'dia na academia' : 'dias na academia'}
              </ThemedText>
            </Card>
            <Card style={styles.statTile}>
              <ThemedText type="small" themeColor="textSecondary">
                Este ano
              </ThemedText>
              <ThemedText type="title" style={styles.statValue}>
                {esteAno}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {esteAno === 1 ? 'dia na academia' : 'dias na academia'}
              </ThemedText>
            </Card>
          </View>

          <Card style={styles.chartCard}>
            <View style={styles.yearRow}>
              <Pressable
                onPress={() => setSelectedYear((y) => y - 1)}
                hitSlop={12}
                style={[styles.yearButton, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="chevron-back" size={18} color={theme.text} />
              </Pressable>
              <ThemedText type="smallBold">Frequência por mês — {selectedYear}</ThemedText>
              <Pressable
                onPress={() => setSelectedYear((y) => y + 1)}
                disabled={selectedYear >= CURRENT_YEAR}
                hitSlop={12}
                style={[
                  styles.yearButton,
                  { backgroundColor: theme.backgroundElement },
                  selectedYear >= CURRENT_YEAR && styles.yearButtonDisabled,
                ]}>
                <Ionicons name="chevron-forward" size={18} color={theme.text} />
              </Pressable>
            </View>

            {loadingChart || !chartSummary ? (
              <LoadingView />
            ) : (
              <View style={styles.bars}>
                {MONTH_LABELS.map((label, index) => {
                  const count = chartSummary.perMonth[index] ?? 0;
                  const isCurrentMonth = selectedYear === CURRENT_YEAR && index === CURRENT_MONTH_INDEX;
                  const widthPct = (count / maxMes) * 100;
                  return (
                    <View key={label} style={styles.barRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
                        {label}
                      </ThemedText>
                      <View style={[styles.barTrack, { backgroundColor: theme.backgroundElement }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${count > 0 ? Math.max(4, widthPct) : 0}%`,
                              backgroundColor: isCurrentMonth ? Brand.primary : Brand.primaryDark,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText type="small" style={styles.barCount}>
                        {count}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
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
  statsRow: { flexDirection: 'row', gap: Spacing.three },
  statTile: { flex: 1, alignItems: 'center', gap: Spacing.half },
  statValue: { color: Brand.primary },
  chartCard: { gap: Spacing.three },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonDisabled: { opacity: 0.4 },
  bars: { gap: Spacing.two },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barLabel: { width: 32 },
  barTrack: { flex: 1, height: 14, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.full },
  barCount: { width: 24, textAlign: 'right' },
});
