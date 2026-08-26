import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Radius, Spacing } from '@/constants/theme';

interface LandingOptionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function LandingOption({ icon, title, subtitle, onPress }: LandingOptionProps) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.optionCard}>
        <View style={styles.iconBadge}>
          <Ionicons name={icon} size={26} color={Brand.primary} />
        </View>
        <View style={styles.optionText}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Brand.primary} />
      </Card>
    </Pressable>
  );
}

export default function ExtrasLandingScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <TabHeader title="Extras" />

        <LandingOption
          icon="restaurant-outline"
          title="Alimentação"
          subtitle="Organize suas refeições"
          onPress={() => router.push('/(tabs)/extras/alimentacao')}
        />
        <LandingOption
          icon="stats-chart-outline"
          title="Relatórios"
          subtitle="Estatísticas de frequência na academia"
          onPress={() => router.push('/(tabs)/extras/relatorios')}
        />
        <LandingOption
          icon="body-outline"
          title="Avaliação Física"
          subtitle="Acompanhe suas metas de peso e medidas"
          onPress={() => router.push('/(tabs)/extras/avaliacao-fisica')}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  optionText: { flex: 1, gap: 2 },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(21, 181, 128, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
