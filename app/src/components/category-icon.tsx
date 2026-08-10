import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

const KEYWORD_TO_ICON: [string, keyof typeof Ionicons.glyphMap][] = [
  ['peito', 'body-outline'],
  ['costas', 'body-outline'],
  ['perna', 'walk-outline'],
  ['ombro', 'body-outline'],
  ['bíceps', 'barbell-outline'],
  ['biceps', 'barbell-outline'],
  ['tríceps', 'barbell-outline'],
  ['triceps', 'barbell-outline'],
  ['antebraço', 'barbell-outline'],
  ['antebraco', 'barbell-outline'],
  ['abdom', 'fitness-outline'],
  ['glúteo', 'walk-outline'],
  ['gluteo', 'walk-outline'],
  ['cardio', 'heart-outline'],
];

function iconForCategoria(nome: string): keyof typeof Ionicons.glyphMap {
  const normalized = nome.trim().toLowerCase();
  const match = KEYWORD_TO_ICON.find(([keyword]) => normalized.includes(keyword));
  return match ? match[1] : 'barbell-outline';
}

interface CategoryIconProps {
  nome: string;
  size?: number;
}

export function CategoryIcon({ nome, size = 20 }: CategoryIconProps) {
  const badgeSize = size * 1.8;

  return (
    <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: Radius.full }]}>
      <Ionicons name={iconForCategoria(nome)} size={size} color={Brand.primary} />
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
