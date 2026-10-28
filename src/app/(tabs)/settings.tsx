import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Disclaimer, Field, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatMonth, formatPct, parseAmount } from '@/lib/format';
import type { InflationSource } from '@/lib/types';
import { refreshCpi, refreshFx, updateSettings, useStore } from '@/state/store';

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const cpi = useStore((s) => s.cpi);
  const fx = useStore((s) => s.fx);
  const fxError = useStore((s) => s.fxError);
  const [rate, setRate] = useState(settings.customAnnualRate ? String(settings.customAnnualRate) : '');
  const [status, setStatus] = useState<string>();
  const last = cpi.rows[cpi.rows.length - 1];

  const onRefresh = async () => {
    setStatus('Güncelleniyor…');
    const [ok] = await Promise.all([refreshCpi(), refreshFx()]);
    setStatus(ok ? 'TÜFE verisi güncellendi.' : 'TCMB’ye ulaşılamadı; mevcut veri kullanılıyor.');
  };

  return (
    <Screen>
      <ThemedText type="subtitle">Ayarlar</ThemedText>

      <Card>
        <ThemedText type="smallBold">Enflasyon kaynağı</ThemedText>
        <Choice<InflationSource>
          options={[
            { value: 'tuik', label: 'TÜİK (resmi TÜFE)' },
            { value: 'custom', label: 'ENAG / kendi oranım' },
          ]}
          value={settings.inflationSource}
          onChange={(inflationSource) => updateSettings({ inflationSource })}
        />
        {settings.inflationSource === 'custom' && (
          <Field
            label="Yıllık enflasyon (%)"
            keyboardType="decimal-pad"
            placeholder="ör. 60"
            value={rate}
            onChangeText={(t) => {
              setRate(t);
              const n = parseAmount(t);
              if (n !== undefined && n < 1000) updateSettings({ customAnnualRate: n });
            }}
            hint="ENAG’ın açıkladığı veya kendi hissettiğin yıllık oranı gir. Her yatırımın süresine göre bileşik uygulanır."
          />
        )}
      </Card>

      <Card>
        <ThemedText type="smallBold">Veri durumu</ThemedText>
        <Row label="Son TÜFE verisi" value={formatMonth(last.month)} />
        <Row label="Yıllık TÜFE" value={formatPct(last.yoy / 100, false)} />
        <Row label="Aylık TÜFE" value={formatPct(last.mom / 100, false)} />
        <Row label="Kaynak" value={cpi.live ? 'TCMB (canlı)' : 'Uygulama içi veri'} />
        <Row label="USD/TRY" value={fx.usd ? fx.usd.toFixed(4) : '—'} />
        <Row label="EUR/TRY" value={fx.eur ? fx.eur.toFixed(4) : '—'} />
        {fxError && (
          <ThemedText type="small" themeColor="textSecondary">
            Kur alınamadı: {fxError}
          </ThemedText>
        )}
        <View style={styles.gap} />
        <Button title="Verileri güncelle" kind="secondary" onPress={onRefresh} />
        {status && (
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText type="smallBold">Gizlilik</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Yatırım bilgilerin yalnızca bu cihazda saklanır. Hesap açman gerekmez, hiçbir sunucuya gönderilmez.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="smallBold">Nasıl hesaplıyoruz?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Reel getiri = (1 + nominal getiri) ÷ (1 + enflasyon) − 1. Enflasyon, alış ayının TÜFE endeksinden son açıklanan
          aya kadar ölçülür (TÜİK hesaplayıcısıyla aynı yöntem). Portföy toplamında her varlık kendi tarihinden itibaren
          enflasyonla düzeltilir.
        </ThemedText>
      </Card>

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: Spacing.one },
});
