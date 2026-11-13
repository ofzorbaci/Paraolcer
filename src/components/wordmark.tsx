import { Text, type TextStyle } from 'react-native';

import { Brand, BrandFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The ParaLens wordmark in the logo's two tones: "Para" navy + "Lens" teal on light surfaces,
 * "Para" white + "Lens" gold on dark ones (the navy hero cards, the paywall, the lock screen).
 * `onDark` forces the dark-surface colours; otherwise they follow the app's colour scheme.
 */
export function Wordmark({ size = 28, onDark, suffix, style }: { size?: number; onDark?: boolean; suffix?: string; style?: TextStyle }) {
  const dark = useColorScheme() === 'dark';
  const light = !(onDark || dark);
  const para = light ? Brand.navy : '#FFFFFF';
  const lens = light ? Brand.teal : Brand.gold;
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={`ParaLens${suffix ?? ''}`}
      style={[{ fontFamily: BrandFonts.wordmark, fontSize: size, lineHeight: Math.round(size * 1.22), letterSpacing: -0.5, color: para }, style]}>
      Para<Text style={{ color: lens }}>Lens</Text>
      {suffix ? <Text style={{ color: para }}>{suffix}</Text> : null}
    </Text>
  );
}
