import { Image, StyleSheet } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Radius } from '@/constants/theme';
import type { Exercicio } from '@/types/workout';

interface ExercicioThumbnailProps {
  exercicio: Pick<Exercicio, 'capa'>;
  categoriaNome: string;
  size?: number;
}

/** Same circular footprint as `CategoryIcon` (drop-in replacement wherever a row represents one
 * specific exercise, not a category) — shows the exercise's cover photo when it has one, falling
 * back to the category icon otherwise. */
export function ExercicioThumbnail({ exercicio, categoriaNome, size = 20 }: ExercicioThumbnailProps) {
  if (!exercicio.capa) {
    return <CategoryIcon nome={categoriaNome} size={size} />;
  }

  const badgeSize = size * 1.8;
  return (
    <Image
      source={{ uri: exercicio.capa.url }}
      style={[styles.thumb, { width: badgeSize, height: badgeSize, borderRadius: Radius.full }]}
    />
  );
}

const styles = StyleSheet.create({
  thumb: { backgroundColor: '#000' },
});
