import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { RestTimer } from '@/components/rest-timer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTimerStore } from '@/stores/timerStore';
import { formatSeconds } from '@/utils/time';

export default function TimerScreen() {
  const theme = useTheme();
  const presets = useTimerStore((s) => s.presets);
  const miniBarEnabled = useTimerStore((s) => s.miniBarEnabled);
  const defaultPresetId = useTimerStore((s) => s.defaultPresetId);
  const setMiniBarEnabled = useTimerStore((s) => s.setMiniBarEnabled);
  const setDefaultPresetId = useTimerStore((s) => s.setDefaultPresetId);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackHeader title="Timer" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <RestTimer />

          <Card style={styles.barCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">Barra fixa</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Mostra um timer compacto acima das abas, em qualquer tela do app.
                </ThemedText>
              </View>
              <Switch value={miniBarEnabled} onValueChange={setMiniBarEnabled} trackColor={{ true: Brand.primary }} />
            </View>

            {miniBarEnabled && (
              <View style={styles.defaultPresetSection}>
                <ThemedText type="small" themeColor="textSecondary">
                  Timer padrão da barra
                </ThemedText>
                {presets.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Salve um timer acima para poder escolher um padrão.
                  </ThemedText>
                ) : (
                  <View style={styles.presetRow}>
                    {presets.map((preset) => {
                      const selected = defaultPresetId === preset._id;
                      return (
                        <Pressable
                          key={preset._id}
                          onPress={() => setDefaultPresetId(selected ? null : preset._id)}
                          style={[
                            styles.presetChip,
                            { borderColor: theme.border },
                            selected && { borderColor: Brand.primary, backgroundColor: 'rgba(21, 181, 128, 0.12)' },
                          ]}>
                          {selected && <Ionicons name="checkmark" size={14} color={Brand.primary} />}
                          <ThemedText>{formatSeconds(preset.seconds)}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  barCard: { gap: Spacing.three },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  defaultPresetSection: { gap: Spacing.two },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
