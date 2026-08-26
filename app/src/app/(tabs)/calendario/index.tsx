import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listAttendanceDatesForMonth, listSessaoDatesForMonth } from '@/api/workoutApi';
import { Card } from '@/components/card';
import { DayAgenda } from '@/components/day-agenda';
import { MonthCalendar } from '@/components/month-calendar';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { readJson, writeJson } from '@/offline/storage';
import { formatDateDisplay, getTodayDateString } from '@/utils/date';

const now = new Date();
const MODO_SIMPLES_KEY = 'calendario:modoSimples';

export default function CalendarioScreen() {
  const theme = useTheme();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [attendanceDates, setAttendanceDates] = useState<Set<string>>(new Set());
  const [modoSimples, setModoSimples] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [legendAnchor, setLegendAnchor] = useState<{ x: number; y: number; height: number } | null>(null);
  const legendButtonRef = useRef<View>(null);

  function handleOpenLegend() {
    legendButtonRef.current?.measureInWindow((x, y, _width, height) => {
      setLegendAnchor({ x, y, height });
    });
  }

  useEffect(() => {
    readJson(MODO_SIMPLES_KEY, false).then(setModoSimples);
  }, []);

  function toggleModoSimples(value: boolean) {
    setModoSimples(value);
    setCalendarOpen(false);
    void writeJson(MODO_SIMPLES_KEY, value);
  }

  const load = useCallback(async () => {
    const monthStr = String(month).padStart(2, '0');
    const [dates, attendance] = await Promise.all([
      listSessaoDatesForMonth(String(year), monthStr),
      listAttendanceDatesForMonth(String(year), monthStr),
    ]);
    setMarkedDates(new Set(dates));
    setAttendanceDates(new Set(attendance));
  }, [year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handlePrevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function handleSelectDate(date: string) {
    if (modoSimples) {
      setSelectedDate(date);
      setCalendarOpen(false);
      return;
    }
    router.push(`/(tabs)/calendario/${date}`);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <TabHeader title="Calendário" />

        <View style={styles.modeRow}>
          <Pressable
            ref={legendButtonRef}
            onPress={handleOpenLegend}
            style={[styles.legendButton, { borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Legenda
            </ThemedText>
          </Pressable>

          <View style={styles.switchGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              {modoSimples ? 'Modo simples' : 'Modo complexo'}
            </ThemedText>
            <Switch
              value={modoSimples}
              onValueChange={toggleModoSimples}
              trackColor={{ true: Brand.primary, false: Brand.primary }}
            />
          </View>
        </View>

        <Modal visible={legendAnchor !== null} transparent animationType="fade" onRequestClose={() => setLegendAnchor(null)}>
          <Pressable style={styles.legendBackdrop} onPress={() => setLegendAnchor(null)}>
            {legendAnchor && (
              <View
                style={[
                  styles.legendCard,
                  {
                    top: legendAnchor.y + legendAnchor.height + 6,
                    left: legendAnchor.x,
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: Brand.today }]} />
                  <ThemedText type="small">Hoje</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, styles.legendSwatchOutline, { borderColor: theme.border }]}>
                    <View style={styles.legendDot} />
                  </View>
                  <ThemedText type="small">Treino registrado</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendSwatch,
                      styles.legendSwatchOutline,
                      { borderColor: Brand.accent, borderWidth: 2 },
                    ]}
                  />
                  <ThemedText type="small">Presença</ThemedText>
                </View>
              </View>
            )}
          </Pressable>
        </Modal>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {modoSimples ? (
            <>
              <Card style={styles.dateCard}>
                <ThemedText type="subtitle" style={{ flex: 1 }}>
                  {formatDateDisplay(selectedDate)}
                </ThemedText>
                <Pressable
                  onPress={() => setCalendarOpen((v) => !v)}
                  hitSlop={12}
                  style={[styles.calendarButton, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="calendar-outline" size={20} color={theme.text} />
                </Pressable>
              </Card>

              {calendarOpen && (
                <Card>
                  <MonthCalendar
                    year={year}
                    month={month}
                    markedDates={markedDates}
                    attendanceDates={attendanceDates}
                    onSelectDate={handleSelectDate}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                  />
                </Card>
              )}

              <DayAgenda date={selectedDate} />
            </>
          ) : (
            <Card>
              <MonthCalendar
                year={year}
                month={month}
                markedDates={markedDates}
                attendanceDates={attendanceDates}
                onSelectDate={handleSelectDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
              />
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  legendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  legendBackdrop: { flex: 1 },
  legendCard: {
    position: 'absolute',
    gap: Spacing.two,
    minWidth: 170,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  legendSwatch: { width: 14, height: 14, borderRadius: 7 },
  legendSwatchOutline: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  legendDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.primary },
  switchGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 0 },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
