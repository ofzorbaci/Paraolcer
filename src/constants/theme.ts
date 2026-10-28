/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  // Paraölçer brand: navy, blue for gains, burnt orange for losses (no red/green, readable for colour-blind users).
  light: {
    text: '#0F1B2D',
    background: '#F4F6F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F1F4F8',
    textSecondary: '#5B6475',
    accent: '#1D4ED8',
    onAccent: '#FFFFFF',
    positive: '#1D4ED8',
    negative: '#C2410C',
    negativeSoft: '#FFF4EE',
    negativeBorder: '#F4C3A6',
    info: '#E8EEFD',
    infoText: '#1E3A8A',
    border: '#E2E8F0',
    hero: '#0F1B2D',
    heroText: '#FFFFFF',
    heroMuted: '#A8B3C7',
    heroAccent: '#8EAEFF',
    chip: '#0F1B2D',
    onChip: '#FFFFFF',
    chartMuted: '#8A93A6',
  },
  dark: {
    text: '#E6EBF4',
    background: '#0A101C',
    backgroundElement: '#131C2D',
    backgroundSelected: '#1B263A',
    textSecondary: '#94A3B8',
    accent: '#6E95FF',
    onAccent: '#0A101C',
    positive: '#7FA3FF',
    negative: '#FB8F5E',
    negativeSoft: '#2A1810',
    negativeBorder: '#5C3020',
    info: '#16223A',
    infoText: '#B9CBFF',
    border: '#23304A',
    hero: '#1A2843',
    heroText: '#FFFFFF',
    heroMuted: '#A8B3C7',
    heroAccent: '#9DB8FF',
    chip: '#E6EBF4',
    onChip: '#0A101C',
    chartMuted: '#7D879B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** Brand type: Inter for all app text, Sora (bold) only for the Paraölçer wordmark. */
export const BrandFonts = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
  wordmark: 'Sora_700Bold',
} as const;

/** Each Inter weight is its own font file, so the family is picked from the weight. */
export function interFor(weight: string | number | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : weight);
  if (w >= 800) return BrandFonts[800];
  if (w >= 700) return BrandFonts[700];
  if (w >= 600) return BrandFonts[600];
  if (w >= 500) return BrandFonts[500];
  return BrandFonts[400];
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 90 }) ?? 0;
export const MaxContentWidth = 800;
