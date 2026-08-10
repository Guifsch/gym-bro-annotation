import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

/** App emblem: a squircle badge (glossy top highlight + barbell) with a small energy-accent spark overlapping the corner. */
export function AuthBadge() {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[Brand.primary, Brand.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}>
        <LinearGradient
          colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.7 }}
          style={styles.shine}
        />
        <Ionicons name="barbell" size={32} color="#fff" />
      </LinearGradient>
      <View style={styles.spark}>
        <Ionicons name="flash" size={13} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 68,
    height: 68,
    alignSelf: 'center',
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Brand.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  spark: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
