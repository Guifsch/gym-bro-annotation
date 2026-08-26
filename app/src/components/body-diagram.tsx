import { useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Text as SvgText } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BodyMetricMedidas } from '@/types/workout';

interface BodyDiagramProps {
  /** Current values (typically parsed live from the form via `parseMedidasText`) — a field left
   * out just renders its label without a number. */
  values: BodyMetricMedidas;
}

// Design-space canvas: the AI-generated illustration (`assets/images/body-diagram.png`, 600×900,
// transparent background, muscle groups already color-coded) is drawn centered at native 2:3
// aspect ratio, with side margins reserved for the leader-line labels — same "wider canvas than
// the figure" trick as the earlier hand-drawn SVG version. Container width comes from the parent
// layout (fixed), so the only way to make the figure/labels render bigger in actual pixels is a
// taller design canvas (more height per unit of width) — widening/heightening both by the same
// factor cancels out and changes nothing.
const DESIGN_WIDTH = 380;
const DESIGN_HEIGHT = 310;
const IMAGE_LEFT = 92.5;
const IMAGE_WIDTH = 195; // height = 310 at the source's 2:3 ratio, fills the full canvas height
const RENDER_HEIGHT = 300;

const MEDIDA_LABELS: Record<keyof BodyMetricMedidas, string> = {
  pescoco: 'Pescoço',
  peito: 'Peito',
  cintura: 'Cintura',
  quadril: 'Quadril',
  bracoEsquerdo: 'Braço E',
  bracoDireito: 'Braço D',
  coxaEsquerda: 'Coxa E',
  coxaDireita: 'Coxa D',
};

interface MeasureZone {
  key: keyof BodyMetricMedidas;
  /** Anchor point on the illustration itself, measured directly from the source image's pixels
   * (sampled per muscle-group color band), not eyeballed. */
  point: { x: number; y: number };
  labelY: number;
  side: 'left' | 'right';
}

// Ordered by the zone's actual height on each side (not by anatomical category) so leader lines
// stay short and don't cross each other — same layout principle as the earlier SVG version.
// `labelY` slots are spaced generously (75 design units apart) because each label is now two
// lines (name + value, see render below) — tighter spacing let long values collide/clip.
const ZONES: MeasureZone[] = [
  { key: 'pescoco', point: { x: 190, y: 50 }, labelY: 45, side: 'left' },
  { key: 'peito', point: { x: 190, y: 73 }, labelY: 120, side: 'left' },
  { key: 'bracoEsquerdo', point: { x: 153, y: 101 }, labelY: 195, side: 'left' },
  { key: 'coxaEsquerda', point: { x: 172, y: 171 }, labelY: 270, side: 'left' },
  { key: 'bracoDireito', point: { x: 228, y: 101 }, labelY: 45, side: 'right' },
  { key: 'cintura', point: { x: 190, y: 113 }, labelY: 120, side: 'right' },
  { key: 'quadril', point: { x: 190, y: 149 }, labelY: 195, side: 'right' },
  { key: 'coxaDireita', point: { x: 210, y: 171 }, labelY: 270, side: 'right' },
];

// The leader line always lands close to the figure (safe: text sits entirely on the far side of
// this point from the incoming line, so the line never crosses through the glyphs). The text's
// own start position is decoupled from that — left-side text starts near the canvas edge and
// grows toward (but stops short of) the line's landing point, so both lines of a label share the
// same left edge, matching how the right side already reads (name and value visibly "paired").
const LEFT_LINE_X = 84;
const LEFT_TEXT_X = 10;
const RIGHT_LABEL_X = 296;

export function BodyDiagram({ values }: BodyDiagramProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const scale = width / DESIGN_WIDTH;
  const renderHeight = width > 0 ? DESIGN_HEIGHT * scale : RENDER_HEIGHT;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 && (
        <View style={{ width, height: renderHeight }}>
          <Image
            source={require('../../assets/images/body-diagram.png')}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: IMAGE_LEFT * scale,
              top: 0,
              width: IMAGE_WIDTH * scale,
              height: renderHeight,
            }}
          />
          <Svg style={StyleSheet.absoluteFill} width={width} height={renderHeight} viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}>
            {ZONES.map(({ key, point, labelY, side }) => {
              const value = values[key];
              const lineX = side === 'left' ? LEFT_LINE_X : RIGHT_LABEL_X;
              const textX = side === 'left' ? LEFT_TEXT_X : RIGHT_LABEL_X;
              const label = MEDIDA_LABELS[key];
              return (
                <G key={key}>
                  <Line
                    x1={point.x}
                    y1={point.y}
                    x2={lineX}
                    y2={labelY}
                    stroke={theme.textSecondary}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <SvgText x={textX} y={labelY} dy={5} fontSize={14} fill={theme.textSecondary} textAnchor="start">
                    {label}
                  </SvgText>
                  {value !== undefined && (
                    <SvgText x={textX} y={labelY + 17} dy={5} fontSize={14} fill={Brand.primary} textAnchor="start">
                      {value}cm
                    </SvgText>
                  )}
                </G>
              );
            })}
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: RENDER_HEIGHT },
});
