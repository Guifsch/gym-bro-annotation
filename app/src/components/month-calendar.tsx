import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getTodayDateString } from '@/utils/date';

interface MonthCalendarProps {
  year: number;
  month: number;
  markedDates: Set<string>;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** 'dot' (default) is a subtle indicator (e.g. "has a session logged"); 'fill' is a much more
   * visible solid circle, meant for contexts where marked = actively selected (e.g. a date picker). */
  markedStyle?: 'dot' | 'fill';
  /** Days the "fui na academia" checkbox was marked for — rendered as a ring around the day circle
   * instead of competing for the same dot/fill as `markedDates`, so both can show at once (a day
   * can have a session logged AND be marked as attended, or just one of the two). */
  attendanceDates?: Set<string>;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

interface DayCell {
  day: number;
  date: string;
}

export function MonthCalendar({
  year,
  month,
  markedDates,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  markedStyle = 'dot',
  attendanceDates,
}: MonthCalendarProps) {
  const theme = useTheme();
  const todayStr = getTodayDateString();

  const startWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, date: `${year}-${pad2(month)}-${pad2(day)}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onPrevMonth} hitSlop={12} style={[styles.navButton, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">
          {MONTH_LABELS[month - 1]} {year}
        </ThemedText>
        <Pressable onPress={onNextMonth} hitSlop={12} style={[styles.navButton, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="chevron-forward" size={18} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <ThemedText key={index} type="small" themeColor="textSecondary" style={styles.cell}>
            {label}
          </ThemedText>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.weekRow}>
          {row.map((cell, cellIndex) => {
            if (!cell) return <View key={cellIndex} style={styles.cell} />;

            const isToday = cell.date === todayStr;
            const isMarked = markedDates.has(cell.date);
            const hasAttendance = attendanceDates?.has(cell.date) ?? false;
            const ringStyle = hasAttendance ? styles.attendanceRing : undefined;

            return (
              <Pressable key={cellIndex} onPress={() => onSelectDate(cell.date)} style={styles.cell}>
                {isToday ? (
                  <LinearGradient colors={[Brand.primary, Brand.primaryDark]} style={[styles.dayCircle, ringStyle]}>
                    <ThemedText type="smallBold" style={styles.todayText}>
                      {cell.day}
                    </ThemedText>
                  </LinearGradient>
                ) : isMarked && markedStyle === 'fill' ? (
                  <View style={[styles.dayCircle, { backgroundColor: Brand.primary }, ringStyle]}>
                    <ThemedText type="smallBold" style={styles.todayText}>
                      {cell.day}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.dayCircle, ringStyle]}>
                    <ThemedText type="small">{cell.day}</ThemedText>
                    {isMarked && <View style={styles.dot} />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.one },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayText: { color: '#fff' },
  dot: { position: 'absolute', bottom: 1, width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.primary },
  attendanceRing: { borderWidth: 2, borderColor: Brand.accent },
});
