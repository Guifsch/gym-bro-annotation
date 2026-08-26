import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeightPoint } from '@/utils/bodyMetrics';

interface WeightTrendChartProps {
  /** Ascending by date, only entries that actually recorded a weight — see `getWeightEntries`. */
  entries: WeightPoint[];
  goalWeightKg?: number | null;
  height?: number;
}

const PADDING = 20;

export function WeightTrendChart({ entries, goalWeightKg, height = 160 }: WeightTrendChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  if (entries.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Registre seu peso pra ver a evolução aqui.
        </ThemedText>
      </View>
    );
  }

  if (entries.length === 1 || width === 0) {
    return (
      <View style={[styles.container, { height }]} onLayout={handleLayout}>
        {width > 0 && (
          <>
            <Svg width={width} height={height}>
              <Circle cx={width / 2} cy={height / 2} r={5} fill={Brand.primary} />
              <SvgText x={width / 2} y={height / 2 - 14} fontSize={13} fontWeight="600" fill={Brand.primary} textAnchor="middle">
                {`${entries[0].pesoKg} kg`}
              </SvgText>
            </Svg>
            <ThemedText type="small" themeColor="textSecondary" style={styles.singlePointCaption}>
              Registre mais um dia pra ver a evolução aqui.
            </ThemedText>
          </>
        )}
      </View>
    );
  }

  const values = entries.map((e) => e.pesoKg);
  const domainValues = goalWeightKg ? [...values, goalWeightKg] : values;
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  const margin = (rawMax - rawMin) * 0.05;
  const domainMin = rawMax === rawMin ? rawMin - 1 : rawMin - margin;
  const domainMax = rawMax === rawMin ? rawMax + 1 : rawMax + margin;

  function xFor(index: number): number {
    return PADDING + (index / (entries.length - 1)) * (width - 2 * PADDING);
  }

  function yFor(value: number): number {
    return PADDING + (1 - (value - domainMin) / (domainMax - domainMin)) * (height - 2 * PADDING);
  }

  const points = entries.map((entry, index) => ({ x: xFor(index), y: yFor(entry.pesoKg) }));
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${points[0].x},${height - PADDING} L${points.map((p) => `${p.x},${p.y}`).join(' L')} L${
    points[points.length - 1].x
  },${height - PADDING} Z`;
  const goalY = goalWeightKg ? yFor(goalWeightKg) : null;

  return (
    <View style={[styles.container, { height }]} onLayout={handleLayout}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="weightAreaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Brand.primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor={Brand.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {goalY !== null && (
          <>
            <Line
              x1={PADDING}
              y1={goalY}
              x2={width - PADDING}
              y2={goalY}
              stroke={theme.textSecondary}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <SvgText x={width - PADDING} y={goalY - 4} fontSize={10} fill={theme.textSecondary} textAnchor="end">
              Meta
            </SvgText>
          </>
        )}

        <Path d={areaPath} fill="url(#weightAreaFill)" />
        <Polyline points={polylinePoints} fill="none" stroke={Brand.primary} strokeWidth={2} />
        {points.map((p, index) => (
          <Circle
            key={entries[index].date}
            cx={p.x}
            cy={p.y}
            r={index === points.length - 1 ? 4 : 3}
            fill={Brand.primary}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  placeholder: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  singlePointCaption: { position: 'absolute', bottom: Spacing.one, alignSelf: 'center' },
});
