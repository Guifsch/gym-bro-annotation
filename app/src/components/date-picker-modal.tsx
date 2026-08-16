import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface DatePickerModalProps {
  visible: boolean;
  selectedDates: string[];
  onToggleDate: (date: string) => void;
  onClose: () => void;
}

function parseYearMonth(dates: string[]): { year: number; month: number } {
  const reference = dates[0];
  if (reference) {
    const [year, month] = reference.split('-').map(Number);
    return { year, month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function DatePickerModal({ visible, selectedDates, onToggleDate, onClose }: DatePickerModalProps) {
  const [{ year, month }, setYearMonth] = useState(() => parseYearMonth(selectedDates));

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onStartShouldSetResponder={() => true}>
          <Card style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              Toque nos dias para vincular ou desvincular. Pode escolher vários.
            </ThemedText>
            <MonthCalendar
              year={year}
              month={month}
              markedDates={new Set(selectedDates)}
              onSelectDate={onToggleDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              markedStyle="fill"
            />
            <GradientButton title="Concluir" onPress={onClose} />
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
});
