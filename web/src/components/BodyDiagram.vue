<script setup lang="ts">
import type { BodyMetricMedidas } from "../types/workout";
import bodyDiagramImg from "../assets/images/body-diagram.webp";

defineProps<{ values: BodyMetricMedidas }>();

const MEDIDA_LABELS: Record<keyof BodyMetricMedidas, string> = {
  pescoco: "Pescoço",
  peito: "Peito",
  cintura: "Cintura",
  quadril: "Quadril",
  bracoEsquerdo: "Braço E",
  bracoDireito: "Braço D",
  coxaEsquerda: "Coxa E",
  coxaDireita: "Coxa D",
};

interface MeasureZone {
  key: keyof BodyMetricMedidas;
  point: { x: number; y: number };
  labelY: number;
  side: "left" | "right";
}

// Design-space canvas matching the source illustration (`assets/images/body-diagram.webp`,
// 600×900, transparent, muscle groups already color-coded — same asset the React Native app
// uses). Side margins are reserved for the leader-line labels; anchor points below were sampled
// directly from the image's muscle-group color bands, same coordinates as the RN version so the
// lines land on the same spots on the figure.
const DESIGN_WIDTH = 380;
const DESIGN_HEIGHT = 310;
const IMAGE_LEFT_PCT = (92.5 / DESIGN_WIDTH) * 100;
const IMAGE_WIDTH_PCT = (195 / DESIGN_WIDTH) * 100;

// Ordered by each zone's actual height on its side (not by anatomical category) so leader lines
// stay short and don't cross each other. `labelY` slots are spaced 75 design units apart to fit
// two stacked lines (name + value).
const ZONES: MeasureZone[] = [
  { key: "pescoco", point: { x: 190, y: 50 }, labelY: 45, side: "left" },
  { key: "peito", point: { x: 190, y: 73 }, labelY: 120, side: "left" },
  {
    key: "bracoEsquerdo",
    point: { x: 153, y: 101 },
    labelY: 195,
    side: "left",
  },
  { key: "coxaEsquerda", point: { x: 172, y: 171 }, labelY: 270, side: "left" },
  { key: "bracoDireito", point: { x: 228, y: 101 }, labelY: 45, side: "right" },
  { key: "cintura", point: { x: 190, y: 113 }, labelY: 120, side: "right" },
  { key: "quadril", point: { x: 190, y: 149 }, labelY: 195, side: "right" },
  { key: "coxaDireita", point: { x: 210, y: 171 }, labelY: 270, side: "right" },
];

const LEFT_LINE_X = 84;
const RIGHT_LINE_X = 296;
const LABEL_GAP = 4;

function lineX(side: "left" | "right"): number {
  return side === "left" ? LEFT_LINE_X : RIGHT_LINE_X;
}

// Text sits a small fixed gap back from the point the line lands on, growing away from the
// figure on both sides — left-side text ends there (grows leftward, into its margin), right-side
// text starts there (grows rightward), so the gap between line and label reads the same on
// both sides instead of only appearing on one.
function textX(side: "left" | "right"): number {
  return side === "left" ? LEFT_LINE_X - LABEL_GAP : RIGHT_LINE_X + LABEL_GAP;
}

function textAnchor(side: "left" | "right"): "start" | "end" {
  return side === "left" ? "end" : "start";
}
</script>

<template>
  <div class="body-diagram">
    <img
      :src="bodyDiagramImg"
      alt=""
      class="body-diagram__image"
      :style="{ left: `${IMAGE_LEFT_PCT}%`, width: `${IMAGE_WIDTH_PCT}%` }"
    />
    <svg
      class="body-diagram__svg"
      :viewBox="`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <g v-for="zone in ZONES" :key="zone.key">
        <line
          :x1="zone.point.x"
          :y1="zone.point.y"
          :x2="lineX(zone.side)"
          :y2="zone.labelY"
          class="body-diagram__line"
          stroke-width="1"
          stroke-dasharray="3,3"
        />
        <text
          :x="textX(zone.side)"
          :y="zone.labelY + 6"
          font-size="16"
          :text-anchor="textAnchor(zone.side)"
          class="body-diagram__label"
        >
          {{ MEDIDA_LABELS[zone.key] }}
        </text>
        <text
          v-if="values[zone.key] !== undefined"
          :x="lineX(zone.side)"
          :y="zone.labelY + 26"
          font-size="16"
          font-weight="700"
          :text-anchor="textAnchor(zone.side)"
          class="body-diagram__value"
        >
          {{ values[zone.key] }}cm
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.body-diagram {
  position: relative;
  width: 100%;
  max-width: 450px;
  aspect-ratio: 380 / 310;
  margin: 0px auto 25px auto;
}

.body-diagram__image {
  position: absolute;
  top: 0;
  height: auto;
}

.body-diagram__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.body-diagram__line {
  stroke: rgba(var(--v-theme-on-surface), 0.4);
}

.body-diagram__label {
  fill: rgba(var(--v-theme-on-surface), 0.6);
}

.body-diagram__value {
  fill: rgb(var(--v-theme-primary));
}
</style>
