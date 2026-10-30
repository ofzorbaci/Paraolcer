import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { BrandFonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { unlock } from '@/lib/lock';
import { useStore } from '@/state/store';

/** Leaving the app for longer than this locks it again. */
const RELOCK_AFTER_MS = 30_000;

/** Covers the app until the user unlocks it with Face ID, fingerprint or the phone passcode. */
export function AppLock({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const enabled = useStore((s) => s.settings.appLock ?? false);
  const [locked, setLocked] = useState(enabled);
  const leftAt = useRef<number | undefined>(undefined);

  const tryUnlock = useCallback(async () => {
    if (await unlock()) setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') leftAt.current = Date.now();
      if (next === 'active' && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  // Ask right away when the app opens locked; the button is there if the user cancels.
  useEffect(() => {
    if (!enabled || !locked) return;
    let cancelled = false;
    unlock().then((ok) => {
      if (ok && !cancelled) setLocked(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, locked]);

  if (!enabled || !locked) return <>{children}</>;
  return (
    <View style={[styles.cover, { backgroundColor: theme.hero }]}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <ThemedText style={styles.brand}>Paraölçer</ThemedText>
      <ThemedText type="small" style={{ color: theme.heroMuted }}>
        Birikimlerin kilitli.
      </ThemedText>
      <View style={styles.button}>
        <Button title="Kilidi aç" onPress={tryUnlock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  logo: { width: 88, height: 88, borderRadius: 22 },
  brand: { fontFamily: BrandFonts.wordmark, fontWeight: 'normal', fontSize: 28, lineHeight: 34, color: '#FFFFFF' },
  button: { alignSelf: 'stretch', marginTop: Spacing.three },
});
