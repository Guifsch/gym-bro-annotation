import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';

interface SingleDatePickerModalProps {
  visible: boolean;
  date: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
  /** Days that already have a record — shown as a small red dot on the calendar (see legend). */
  dataDates?: Set<string>;
}

function parseYearMonth(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

/** Same base as `DatePickerModal`, but single-select — picking a day sets it and closes the modal
 * immediately, instead of `DatePickerModal`'s toggle-and-stay-open multi-select behavior. */
export function SingleDatePickerModal({ visible, date, onSelectDate, onClose, dataDates }: SingleDatePickerModalProps) {
  const [{ year, month }, setYearMonth] = useState(() => parseYearMonth(date));

  function handlePrevMonth() {
    setYearMonth((prev) =>
      prev.month === 1 ? { year: prev.year - 1, month: 12 } : { year: prev.year, month: prev.month - 1 }
    );
  }

  function handleNextMonth() {
    setYearMonth((prev) =>
      prev.month === 12 ? { year: prev.year + 1, month: 1 } : { year: prev.year, month: prev.month + 1 }
    );
  }

  function handleSelect(selected: string) {
    onSelectDate(selected);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onStartShouldSetResponder={() => true}>
          <Card style={styles.card}>
            <MonthCalendar
              year={year}
              month={month}
              markedDates={new Set([date])}
              onSelectDate={handleSelect}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              markedStyle="fill"
              markedColor={Brand.accent}
              dataDates={dataDates}
            />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatchCircle, { backgroundColor: Brand.today }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  Hoje
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatchCircle, { backgroundColor: Brand.accent }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  Selecionado
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendSwatchDot} />
                <ThemedText type="small" themeColor="textSecondary">
                  Tem registro
                </ThemedText>
              </View>
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  cardWrap: { width: '100%' },
  card: { gap: Spacing.two },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendSwatchCircle: { width: 10, height: 10, borderRadius: Radius.full },
  legendSwatchDot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: '#e53935' },
});
