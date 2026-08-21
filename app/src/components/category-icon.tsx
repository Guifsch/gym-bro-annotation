import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

interface CategoryIconProps {
  nome: string;
  size?: number;
}

/** Generic placeholder badge for a category or an exercise without a cover photo — always a
 * dumbbell, regardless of the category's name (a per-muscle-group icon set was tried and dropped:
 * inconsistent enough across categories that it read as noise rather than as useful signal). */
export function CategoryIcon({ size = 20 }: CategoryIconProps) {
  const badgeSize = size * 1.8;

  return (
    <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: Radius.full }]}>
      <Ionicons name="barbell-outline" size={size} color={Brand.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(21, 181, 128, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
