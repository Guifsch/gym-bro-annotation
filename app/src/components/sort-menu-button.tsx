import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SortOption<T extends string> {
  label: string;
  value: T;
}

interface SortMenuButtonProps<T extends string> {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
}

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Small icon button that opens a floating options card anchored below it — same
 * measure-then-Modal pattern as the calendar's "Legenda" button, but right-aligned to the button's
 * own right edge (not left) since this sits at the far right of the header and a left-anchored
 * card could overflow off-screen there. */
export function SortMenuButton<T extends string>({ value, options, onChange }: SortMenuButtonProps<T>) {
  const theme = useTheme();
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  function handleOpen() {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }

  function handleSelect(next: T) {
    onChange(next);
    setAnchor(null);
  }

  return (
    <>
      <Pressable ref={buttonRef} onPress={handleOpen} hitSlop={10} style={styles.button}>
        <Ionicons name="swap-vertical-outline" size={20} color={theme.text} />
      </Pressable>

      <Modal visible={anchor !== null} transparent animationType="fade" onRequestClose={() => setAnchor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAnchor(null)}>
          {anchor && (
            <View
              style={[
                styles.card,
                {
                  top: anchor.y + anchor.height + 6,
                  right: Dimensions.get('window').width - (anchor.x + anchor.width),
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}>
              {options.map((option) => (
                <Pressable key={option.value} onPress={() => handleSelect(option.value)} style={styles.option}>
                  <ThemedText type="small" style={option.value === value && styles.optionActive}>
                    {option.label}
                  </ThemedText>
                  {option.value === value && <Ionicons name="checkmark" size={16} color={Brand.primary} />}
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1 },
  card: {
    position: 'absolute',
    gap: Spacing.one,
    minWidth: 160,
    padding: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  optionActive: { color: Brand.primary, fontWeight: '700' },
});
