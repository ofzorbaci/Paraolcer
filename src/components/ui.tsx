import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, BrandFonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPct } from '@/lib/format';

export const Radius = { card: 24, inner: 16, pill: 999 } as const;

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

export function ScreenHeader({
  eyebrow,
  title,
  right,
  wordmark,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  /** set on the screen that shows the app name, which uses the logo typeface */
  wordmark?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        {eyebrow ? (
          <ThemedText type="small" themeColor="textSecondary">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText style={[styles.title, wordmark && styles.wordmark]}>{title}</ThemedText>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'smallBold' : 'small'}>{value}</ThemedText>
    </View>
  );
}

/** Blue for a gain in purchasing power, burnt orange for a loss. */
export function useReturnColor() {
  const theme = useTheme();
  return (ratio: number | undefined) =>
    ratio === undefined ? theme.textSecondary : ratio >= 0 ? theme.positive : theme.negative;
}

export function Pct({ ratio, size = 16, signed = true }: { ratio: number | undefined; size?: number; signed?: boolean }) {
  const color = useReturnColor()(ratio);
  return (
    <ThemedText style={{ color, fontSize: size, lineHeight: size * 1.25, fontWeight: 700 }}>
      {ratio === undefined ? '—' : formatPct(ratio, signed)}
    </ThemedText>
  );
}

/** The grey three-column box inside asset cards. */
export function StatStrip({ stats, negative }: { stats: { label: string; value: ReactNode }[]; negative?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.strip, { backgroundColor: negative ? theme.negativeSoft : theme.backgroundSelected }]}>
      {stats.map((s) => (
        <View key={s.label} style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            {s.label}
          </ThemedText>
          {typeof s.value === 'string' ? <ThemedText type="smallBold" style={styles.stat}>{s.value}</ThemedText> : s.value}
        </View>
      ))}
    </View>
  );
}

export function Icon({ name, size = 22, color }: { name: SymbolViewProps['name']; size?: number; color?: string }) {
  const theme = useTheme();
  return <SymbolView name={name} size={size} tintColor={color ?? theme.text} />;
}

export function IconButton({
  name,
  onPress,
  label,
  active,
}: {
  name: SymbolViewProps['name'];
  onPress: () => void;
  label: string;
  active?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.backgroundElement, borderColor: active ? theme.accent : theme.border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon name={name} color={active ? theme.accent : theme.text} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  icon,
  compact,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  icon?: SymbolViewProps['name'];
  compact?: boolean;
}) {
  const theme = useTheme();
  const bg = kind === 'primary' ? theme.accent : kind === 'danger' ? theme.negativeSoft : theme.backgroundElement;
  const fg = kind === 'primary' ? theme.onAccent : kind === 'danger' ? theme.negative : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: bg,
          borderColor: kind === 'secondary' ? theme.border : bg,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <ThemedText style={[styles.buttonText, { color: fg }]}>{title}</ThemedText>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  prefix,
  suffix,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string; prefix?: string; suffix?: string; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.field, style]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View
        style={[
          styles.inputBox,
          { backgroundColor: theme.backgroundElement, borderColor: error ? theme.negative : theme.border },
        ]}>
        {prefix ? <ThemedText style={styles.adornment}>{prefix}</ThemedText> : null}
        <TextInput placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} {...input} />
        {suffix ? (
          <ThemedText style={styles.adornment} themeColor="textSecondary">
            {suffix}
          </ThemedText>
        ) : null}
      </View>
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
              { backgroundColor: on ? theme.chip : theme.backgroundElement, borderColor: on ? theme.chip : theme.border },
            ]}>
            <ThemedText style={[styles.chipText, { color: on ? theme.onChip : theme.text }]}>{o.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InfoBanner({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: theme.info }]}>
      <Icon name={{ ios: 'info.circle', android: 'info', web: 'info' }} color={theme.accent} />
      <View style={styles.flex}>
        <ThemedText type="smallBold" style={{ color: theme.infoText }}>
          {title}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.infoText }}>
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

export function Disclaimer({ text = 'Bilgi amaçlıdır · Yatırım tavsiyesi değildir' }: { text?: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.one },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
  wordmark: { fontFamily: BrandFonts.wordmark, fontWeight: 'normal', letterSpacing: -0.5 },
  card: { borderRadius: Radius.card, borderWidth: 1, padding: 20, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  strip: { flexDirection: 'row', borderRadius: Radius.inner, padding: Spacing.three, gap: Spacing.two },
  stat: { fontSize: 16, lineHeight: 22 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Radius.inner,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { borderRadius: Radius.pill, paddingVertical: 10 },
  buttonText: { fontSize: 17, lineHeight: 22, fontWeight: 700 },
  field: { gap: 6 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.inner, paddingHorizontal: Spacing.three },
  input: { flex: 1, paddingVertical: 14, fontSize: 17, fontFamily: BrandFonts[400] },
  adornment: { fontSize: 17, marginHorizontal: 2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 10 },
  chipText: { fontSize: 16, fontWeight: 600 },
  banner: { flexDirection: 'row', gap: 12, borderRadius: 20, padding: Spacing.three, alignItems: 'flex-start' },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
});
