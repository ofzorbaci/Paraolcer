import { useState } from 'react';

import { ImportButtons } from '@/components/import-buttons';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { exportWorkbook } from '@/lib/spreadsheet';
import { shareWorkbook } from '@/lib/spreadsheet-file';
import { deleteAllData, useStore } from '@/state/store';

/** "Tüm verimi sil": there is no account, so this removes everything kept on the phone. */
export function DataCard() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const holdings = useStore((s) => s.allHoldings);
  return (
    <Card>
      <ThemedText type="smallBold">Verilerim</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Verin senin: Excel’e istediğin zaman ücretsiz aktarabilir, başka bir uygulamadan ya da şablondan toplu ekleyebilirsin.
      </ThemedText>
      <Button
        title="Excel’e aktar"
        kind="secondary"
        disabled={holdings.length === 0}
        onPress={() => shareWorkbook(exportWorkbook(holdings), `paraolcer-${new Date().toISOString().slice(0, 10)}.xlsx`)}
      />
      <ImportButtons />
      <ThemedText type="small" themeColor="textSecondary">
        Hesap yok; bütün veriler bu telefonda. Silersen varlıkların, ayarların, otomatik yedeğin ve hatırlatmaların
        kalıcı olarak kaldırılır. Oluşturduğun şifreli yedek dosyaları ve mağaza aboneliğin etkilenmez.
      </ThemedText>
      {done ? (
        <ThemedText type="small" themeColor="textSecondary">
          Tüm verilerin silindi.
        </ThemedText>
      ) : (
        <Button
          title={confirming ? 'Emin misin? Hepsini kalıcı olarak sil' : 'Tüm verilerimi sil'}
          kind="danger"
          onPress={async () => {
            if (!confirming) return setConfirming(true);
            await deleteAllData();
            setDone(true);
          }}
        />
      )}
    </Card>
  );
}
