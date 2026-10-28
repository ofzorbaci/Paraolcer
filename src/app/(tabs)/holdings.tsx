import { router } from 'expo-router';

import { HoldingCard } from '@/components/holding-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Screen, ScreenHeader } from '@/components/ui';
import { usePortfolio } from '@/hooks/use-portfolio';
import { formatTL } from '@/lib/format';

export default function AssetsScreen() {
  const { items, total } = usePortfolio();
  return (
    <Screen>
      <ScreenHeader
        eyebrow={total ? `Toplam değer ${formatTL(total.value)}` : 'Henüz varlık yok'}
        title="Varlıklarım"
        right={
          <Button title="Ekle" compact icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/holding/edit')} />
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
      <Disclaimer />
    </Screen>
  );
}
