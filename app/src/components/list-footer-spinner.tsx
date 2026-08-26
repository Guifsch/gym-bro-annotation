import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

/** `ListFooterComponent` for an infinite-scroll `FlatList`/`SectionList` — shown only while
 * fetching the next page (see `usePaginatedList`). Renders nothing once there's no more data, so
 * a fully-loaded list doesn't end in a permanent empty gap. */
export function ListFooterSpinner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.container}>
      <ActivityIndicator color={Brand.primary} size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: Spacing.four, alignItems: 'center' },
});
