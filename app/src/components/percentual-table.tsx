import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const PERCENTUAIS = [50, 60, 70, 75, 80, 85, 90, 95, 100];

interface PercentualTableProps {
  cargaMaximaKg: number;
}

export function PercentualTable({ cargaMaximaKg }: PercentualTableProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        Percentuais da carga máxima
      </ThemedText>
      <View style={styles.rows}>
        {PERCENTUAIS.map((pct) => (
          <View key={pct} style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              {pct}%
            </ThemedText>
            <ThemedText type="smallBold">{Math.round(cargaMaximaKg * (pct / 100) * 2) / 2}kg</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  rows: { gap: Spacing.half },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
