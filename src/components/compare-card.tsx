import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Card, Choice, Pct } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { COMPARE_LABELS, COMPARE_PERIODS, compareSeries, type CompareKey, type CompareLine } from '@/lib/compare';
import { formatMonth, formatTL, todayISO } from '@/lib/format';
import { useStore } from '@/state/store';

const HEIGHT = 200;
const PAD = { top: 12, bottom: 12, x: 6 };

function shortMonth(month: string): string {
  const [name, year] = formatMonth(month).split(' ');
  return `${name.slice(0, 3)} ${year}`;
}

/** The portfolio against dollar, gram gold, deposit and cash, in today's purchasing power. */
export function CompareCard() {
  const theme = useTheme();
  useMasked();
  const holdings = useStore((s) => s.holdings);
  const prices = useStore((s) => s.prices);
  const feed = useStore((s) => s.feed);
  const settings = useStore((s) => s.calcSettings);
  const index = useStore((s) => s.cpi.index);
  const [months, setMonths] = useState('12');
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const c = compareSeries({ holdings, months: Number(months), today: todayISO(), prices, feed, settings, index });
  const color: Record<CompareKey, string> = {
    portfolio: theme.accent,
    usd: theme.text,
    gold: theme.chartGold,
    deposit: theme.chartMuted,
    cash: theme.negative,
  };

  const values = c.lines.flatMap((l) => l.points.map((p) => p.value));
  const min = Math.min(100, ...values);
  const max = Math.max(100, ...values);
  const span = max - min || 1;
  const innerW = Math.max(1, width - PAD.x * 2);
  const count = c.lines[0]?.points.length ?? 1;
  const x = (i: number) => PAD.x + (count === 1 ? innerW : (i / (count - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (l: CompareLine) => l.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const sorted = [...c.lines].sort((a, b) => b.real - a.real);
  const tm = c.timeMachine;

  return (
    <Card>
      <ThemedText style={styles.title}>Kıyas: bugünün lirasıyla</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Hepsi 100’den başlar. 100’ün üstü enflasyonu yendi, altı alım gücü kaybetti.
      </ThemedText>
      <Choice options={COMPARE_PERIODS.map((p) => ({ value: String(p.months), label: p.label }))} value={months} onChange={setMonths} />

      <View onLayout={onLayout} style={{ height: HEIGHT }}>
        {width > 0 && count > 1 && (
          <Svg width={width} height={HEIGHT}>
            <Line x1={PAD.x} x2={width - PAD.x} y1={y(100)} y2={y(100)} stroke={theme.border} strokeDasharray="3 4" />
            {c.lines
              .filter((l) => l.key !== 'portfolio')
              .map((l) => (
                <Path
                  key={l.key}
                  d={path(l)}
                  stroke={color[l.key]}
                  strokeWidth={2}
                  strokeDasharray={l.key === 'cash' ? '6 5' : undefined}
                  fill="none"
                />
              ))}
            {c.lines
              .filter((l) => l.key === 'portfolio')
              .map((l) => (
                <Path key={l.key} d={path(l)} stroke={color.portfolio} strokeWidth={3.5} strokeLinejoin="round" fill="none" />
              ))}
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <ThemedText type="small" themeColor="textSecondary">
          {shortMonth(c.start)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Bugün
        </ThemedText>
      </View>

      <View style={styles.rows}>
        {sorted.map((l) => (
          <View key={l.key} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: color[l.key] }]} />
            <ThemedText style={[styles.rowLabel, l.key === 'portfolio' && styles.bold]}>{COMPARE_LABELS[l.key]}</ThemedText>
            <Pct ratio={l.real} size={16} />
          </View>
        ))}
      </View>

      {tm && (
        <View style={[styles.machine, { backgroundColor: theme.info }]}>
          <ThemedText type="smallBold" style={{ color: theme.infoText }}>
            Zaman makinesi
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.infoText }}>
            {formatMonth(tm.month)} sonunda birikimin {formatTL(tm.then)} idi. Bugünün fiyatlarıyla bu{' '}
            {formatTL(tm.thenToday)} eder. Bugün {formatTL(tm.now)}:{' '}
            {tm.now >= tm.thenToday
              ? `alım gücün ${formatTL(tm.now - tm.thenToday)} arttı.`
              : `alım gücün ${formatTL(tm.thenToday - tm.now)} eridi.`}
          </ThemedText>
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {!c.lines.some((l) => l.key === 'portfolio')
          ? 'Bu dönemin başında elinde olan bir varlık yok; birikimin çizgisi için daha kısa bir dönem seç. '
          : c.excluded > 0
            ? `Dönem içinde aldığın ${c.excluded} varlık, yeni para kazanç gibi görünmesin diye dışarıda. `
            : ''}
        Dolar ve altın ay sonu fiyatları (ECB, Dünya Bankası), mevduat o ayki politika faiziyle aylık yenileme ve stopaj
        varsayımıdır.{c.estimated ? ' Fiyat geçmişi olmayan varlıklarda ara aylar tahminidir.' : ''} Geçmiş, geleceği
        göstermez.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  rows: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowLabel: { flex: 1, fontSize: 15 },
  bold: { fontWeight: 700 },
  swatch: { width: 14, height: 4, borderRadius: 2 },
  machine: { borderRadius: 14, padding: Spacing.three, gap: 4 },
});
