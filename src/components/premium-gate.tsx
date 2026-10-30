import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Icon } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PREMIUM_FEATURES, type PremiumFeature } from '@/lib/entitlements';
import { useStore } from '@/state/store';

export function usePremium(): boolean {
  return useStore((s) => s.premium.active);
}

export function openPaywall(feature?: PremiumFeature) {
  router.push({ pathname: '/paywall', params: feature ? { feature } : {} });
}

/** Opens the add form. Every holding is free; kept as one entry point for all "Ekle" buttons. */
export function useAddHolding(): () => void {
  return () => router.push('/holding/edit');
}

/** Shows `children` to Premium users and a short invitation in their place to everyone else. */
export function PremiumGate({ feature, pitch, children }: { feature: PremiumFeature; pitch: string; children: ReactNode }) {
  const theme = useTheme();
  const premium = usePremium();
  if (premium) return <>{children}</>;
  const f = PREMIUM_FEATURES.find((x) => x.id === feature)!;
  return (
    <Card>
      <View style={styles.head}>
        <Icon name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={18} color={theme.accent} />
        <ThemedText style={styles.title}>{f.title}</ThemedText>
        <View style={[styles.badge, { backgroundColor: theme.info }]}>
          <ThemedText style={[styles.badgeText, { color: theme.infoText }]}>PREMIUM</ThemedText>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {pitch}
      </ThemedText>
      <Button title="Premium’u keşfet" kind="secondary" onPress={() => openPaywall(feature)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700, flex: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: 800, letterSpacing: 0.5 },
});
