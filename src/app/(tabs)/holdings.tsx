import { HoldingCard } from '@/components/holding-card';
import { openPaywall, useAddHolding, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Screen, ScreenHeader } from '@/components/ui';
import { usePortfolio } from '@/hooks/use-portfolio';
import { FREE_HOLDING_LIMIT } from '@/lib/entitlements';
import { formatTL } from '@/lib/format';

export default function AssetsScreen() {
  const { items, total } = usePortfolio();
  const addHolding = useAddHolding();
  const premium = usePremium();
  return (
    <Screen>
      <ScreenHeader
        eyebrow={total ? `Toplam değer ${formatTL(total.value)}` : 'Henüz varlık yok'}
        title="Varlıklarım"
        right={
          <Button title="Ekle" compact icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={addHolding} />
        }
      />
      {items.length === 0 && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Mevduat, döviz, altın, fon ya da hisse ekleyerek başla. Verilerin yalnızca bu telefonda saklanır.
          </ThemedText>
        </Card>
      )}
      {items.map((i) => (
        <HoldingCard key={i.holding.id} holding={i.holding} analysis={i.analysis} />
      ))}
      {!premium && items.length >= FREE_HOLDING_LIMIT && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Ücretsiz sürümde {FREE_HOLDING_LIMIT} varlık takip edebilirsin. Premium ile sınırsız varlık ekle.
          </ThemedText>
          <Button title="Premium’u keşfet" kind="secondary" compact onPress={() => openPaywall('unlimitedHoldings')} />
        </Card>
      )}
      <Disclaimer />
    </Screen>
  );
}
