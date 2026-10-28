import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth, formatTL } from '@/lib/format';
import type { PowerPoint } from '@/lib/series';

const HEIGHT = 220;
const PAD = { top: 16, bottom: 24, x: 8 };

function shortMonth(month: string): string {
  const [name, year] = formatMonth(month).split(' ');
  return `${name.slice(0, 3)} ${year}`;
}

/** Dashed grey: what the account shows. Solid blue: what it buys in start-month prices. */
export function PowerChart({ points }: { points: PowerPoint[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = points.flatMap((p) => [p.nominal, p.real]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = Math.max(1, width - PAD.x * 2);
  const x = (i: number) => PAD.x + (points.length === 1 ? innerW : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (key: 'nominal' | 'real') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <View>
      <View onLayout={onLayout} style={{ height: HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Line
              x1={PAD.x}
              x2={width - PAD.x}
              y1={y(first.nominal)}
              y2={y(first.nominal)}
              stroke={theme.border}
              strokeDasharray="3 4"
            />
            <Path d={path('nominal')} stroke={theme.chartMuted} strokeWidth={3} strokeDasharray="8 7" fill="none" />
            <Path d={path('real')} stroke={theme.accent} strokeWidth={3.5} fill="none" strokeLinejoin="round" />
            <Circle cx={x(points.length - 1)} cy={y(last.nominal)} r={5} fill={theme.chartMuted} />
            <Circle cx={x(points.length - 1)} cy={y(last.real)} r={6} fill={theme.accent} />
            <Circle cx={x(0)} cy={y(first.nominal)} r={4} fill={theme.accent} />
          </Svg>
        )}
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={[styles.startLabel, { top: Math.min(HEIGHT - 22, y(first.nominal) + 6) }]}>
          Başlangıç {formatTL(first.nominal)}
        </ThemedText>
      </View>
      <View style={styles.axis}>
        <ThemedText type="small" themeColor="textSecondary">
          {shortMonth(first.month)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {shortMonth(last.month)}
        </ThemedText>
      </View>
      <View style={styles.legend}>
        <Legend color={theme.chartMuted} dashed label="Görünen değer" />
        <Legend color={theme.accent} label="Gerçek alım gücü" />
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={styles.swatchRow}>
        <View style={[styles.swatch, { backgroundColor: color, width: dashed ? 9 : 22 }]} />
        {dashed ? <View style={[styles.swatch, { backgroundColor: color, width: 9 }]} /> : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  startLabel: { position: 'absolute', left: PAD.x + 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one },
  legend: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.three, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  swatchRow: { flexDirection: 'row', gap: 4 },
  swatch: { height: 4, borderRadius: 2 },
});
