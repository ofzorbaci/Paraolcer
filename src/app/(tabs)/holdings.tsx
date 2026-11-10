import { useMasked } from '@/hooks/use-masked';

import { ImportButtons } from '@/components/import-buttons';
import { HoldingCard } from '@/components/holding-card';
import { useAddHolding } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Screen, ScreenHeader } from '@/components/ui';
import { usePortfolio } from '@/hooks/use-portfolio';
import { formatTL } from '@/lib/format';
import { manualHoldings, staleHoldings } from '@/lib/stale';
import { router } from 'expo-router';

export default function AssetsScreen() {
  useMasked();
  const { items, total } = usePortfolio();
  const addHolding = useAddHolding();
  const own = items.map((i) => i.holding);
  const manual = manualHoldings(own).length;
  const stale = staleHoldings(own, new Date()).length;
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
      {manual > 0 && (
        <Button
          title={`Elle girilen fiyatları güncelle (${manual}${stale ? `, ${stale} eski` : ''})`}
          kind="secondary"
          icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
          onPress={() => router.push('/prices')}
        />
      )}
      {items.map((i) => (
        <HoldingCard key={i.holding.id} holding={i.holding} analysis={i.analysis} />
      ))}
      <ImportButtons />
      <Disclaimer />
    </Screen>
  );
}
