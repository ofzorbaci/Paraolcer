import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPct } from '@/lib/format';

export function Screen({ children, tabs = true }: { children: ReactNode; tabs?: boolean }) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: (tabs ? BottomTabInset : 0) + Spacing.five }]}>
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'smallBold' : 'small'}>{value}</ThemedText>
    </View>
  );
}

/** Green when purchasing power grew, red when it shrank. */
export function ReturnPill({ ratio }: { ratio: number | undefined }) {
  const theme = useTheme();
  if (ratio === undefined) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          fiyat yok
        </ThemedText>
      </View>
    );
  }
  const up = ratio >= 0;
  return (
    <View style={[styles.pill, { backgroundColor: up ? theme.positiveSoft : theme.negativeSoft }]}>
      <ThemedText type="smallBold" style={{ color: up ? theme.positive : theme.negative }}>
        {formatPct(ratio)}
      </ThemedText>
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const bg = kind === 'primary' ? theme.accent : kind === 'danger' ? theme.negativeSoft : theme.backgroundSelected;
  const fg = kind === 'primary' ? theme.background : kind === 'danger' ? theme.negative : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: fg }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: error ? theme.negative : theme.border },
        ]}
        {...input}
      />
      {error ? (
        <ThemedText type="small" style={{ color: theme.negative }}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.choices}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              { backgroundColor: on ? theme.accent : theme.background, borderColor: on ? theme.accent : theme.border },
            ]}>
            <ThemedText type="small" style={{ color: on ? theme.background : theme.text }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Disclaimer() {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
      Bilgi amaçlıdır, yatırım tavsiyesi değildir. Enflasyon verisi TÜİK (TCMB aracılığıyla), kurlar Avrupa Merkez
      Bankası referans kurlarıdır.
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  pill: { borderRadius: Spacing.three, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  button: { borderRadius: Spacing.three, paddingVertical: 12, paddingHorizontal: Spacing.three, alignItems: 'center' },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: Spacing.four, paddingHorizontal: 12, paddingVertical: 6 },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
});
