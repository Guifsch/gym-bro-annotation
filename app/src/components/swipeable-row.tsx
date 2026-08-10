import { Ionicons } from '@expo/vector-icons';
import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
}

/** Swipe left reveals a delete action; the row itself is only removed when that action is tapped. */
export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  function handleDeletePress() {
    swipeableRef.current?.close();
    onDelete();
  }

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={handleDeletePress} style={styles.deleteAction}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <ThemedText style={styles.deleteText}>Excluir</ThemedText>
        </Pressable>
      )}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: '#e53935',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
    marginLeft: Spacing.two,
  },
  deleteText: { color: '#fff', fontWeight: '700' },
});
