import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface DatePickerModalProps {
  visible: boolean;
  selectedDate?: string;
  onSelect: (date: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

function parseYearMonth(date?: string): { year: number; month: number } {
  if (date) {
    const [year, month] = date.split('-').map(Number);
    return { year, month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function DatePickerModal({ visible, selectedDate, onSelect, onClear, onClose }: DatePickerModalProps) {
  const [{ year, month }, setYearMonth] = useState(() => parseYearMonth(selectedDate));

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
        <Pressable onStartShouldSetResponder={() => true}>
          <Card style={styles.card}>
            <MonthCalendar
              year={year}
              month={month}
              markedDates={selectedDate ? new Set([selectedDate]) : new Set()}
              onSelectDate={(date) => {
                onSelect(date);
                onClose();
              }}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
            {selectedDate && onClear && (
              <Pressable
                onPress={() => {
                  onClear();
                  onClose();
                }}
                style={styles.clearButton}>
                <ThemedText type="small" themeColor="textSecondary">
                  Remover data
                </ThemedText>
              </Pressable>
            )}
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
  card: { width: '100%', gap: Spacing.two },
  clearButton: { alignItems: 'center', paddingVertical: Spacing.two },
});
