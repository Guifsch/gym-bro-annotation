import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listSessaoDatesForMonth } from '@/api/workoutApi';
import { Card } from '@/components/card';
import { MonthCalendar } from '@/components/month-calendar';
import { TabHeader } from '@/components/tab-header';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const now = new Date();

export default function CalendarioScreen() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const monthStr = String(month).padStart(2, '0');
    const dates = await listSessaoDatesForMonth(String(year), monthStr);
    setMarkedDates(new Set(dates));
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <TabHeader title="Calendário" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card>
            <MonthCalendar
              year={year}
              month={month}
              markedDates={markedDates}
              onSelectDate={(date) => router.push(`/(tabs)/calendario/${date}`)}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
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
});
