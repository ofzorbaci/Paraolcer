import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { quoteLabel } from '@/components/source-line';
import { ThemedText } from '@/components/themed-text';
import { Card, Disclaimer, IconButton, Row, Screen } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import examples from '@/data/deposit-examples.json';
import { termInterest } from '@/lib/deposit';
import { currentPolicyRate } from '@/lib/feed';
import { formatDate, formatMonth, formatRate, formatStamp, formatTL } from '@/lib/format';
import { useStore } from '@/state/store';

function Formula({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" style={styles.formula}>
      {children}
    </ThemedText>
  );
}

/** Every number's formula, source and date in one place — the answer to "nasıl hesaplandı?". */
export default function MethodScreen() {
  const feed = useStore((s) => s.feed);
  const cpi = useStore((s) => s.cpi);
  const book = useStore((s) => s.priceBook);
  const settings = useStore((s) => s.calcSettings);
  const last = cpi.rows[cpi.rows.length - 1];
  const policy = currentPolicyRate(feed);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <ThemedText style={styles.title}>Nasıl hesaplıyoruz?</ThemedText>
      </View>

      <Card>
        <ThemedText style={styles.h}>Reel getiri</ThemedText>
        <Formula>reel = (1 + nominal getiri) ÷ (1 + enflasyon) − 1</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          Fisher denklemi. Paranın TL olarak artışını, aynı dönemde fiyatların artışına bölüyoruz; çıkan sayı alım
          gücündeki değişim. Örnek: %50 kazanç, %40 enflasyon → reel +%7,1.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText style={styles.h}>Enflasyon</ThemedText>
        <Formula>enflasyon = TÜFE(son ay) ÷ TÜFE(alış ayı) − 1</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          TÜİK’in kendi hesaplayıcısıyla aynı yöntem. Endeks, TCMB’nin yayımladığı aylık değişimlerin zincirlenmesiyle
          kurulur. Son ayın verisi açıklanmadıysa hesap son açıklanan aya kadar yapılır.
        </ThemedText>
        <Row label="Son TÜFE" value={`${formatMonth(last.month)} · yıllık ${formatRate(last.yoy)}`} />
        {settings.inflationSource === 'custom' && (
          <ThemedText type="small" themeColor="textSecondary">
            Şu an kendi oranını (yıllık {formatRate(settings.customAnnualRate)}) kullanıyorsun: (1 + oran)^(gün ÷ 365).
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText style={styles.h}>Mevduat</ThemedText>
        <Formula>net faiz = brüt faiz × (1 − stopaj)</Formula>
        <Formula>değer = anapara × (1 + net × vade ÷ 365) ^ (gün ÷ vade)</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          Her vade sonunda faiz anaparaya eklenir. Stopaj, vadeye göre otomatik seçilir; değiştirebilirsin.
        </ThemedText>
        {feed.withholding.tiers.map((t, i) => (
          <Row
            key={i}
            label={t.maxDays === null ? `${feed.withholding.tiers[i - 1]?.maxDays ?? 0} günden uzun` : `${t.maxDays} güne kadar`}
            value={formatRate(t.rate)}
          />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(feed.withholding.validUntil)} tarihine kadar geçerli · {feed.withholding.source}
        </ThemedText>
      </Card>

      <Card>
        <ThemedText style={styles.h}>Örnek mevduat hesapları</ThemedText>
        <Formula>brüt faiz = anapara × faiz × gün ÷ 36500 · net = brüt − stopaj</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          Bankanın vade sonunda yazdığı tutarla karşılaştırabilmen için tek vade, kuruşa yuvarlanmış.
        </ThemedText>
        {examples.examples.map((e, i) => {
          const r = termInterest(e.principal, e.grossRate, e.termDays, e.withholding);
          return (
            <View key={i} style={styles.example}>
              <ThemedText type="smallBold">
                {formatTL(e.principal)} · %{String(e.grossRate).replace('.', ',')} · {e.termDays} gün · %
                {String(e.withholding).replace('.', ',')} stopaj
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Brüt {formatTL(r.gross, true)} − stopaj {formatTL(r.tax, true)} = net {formatTL(r.net, true)}
                {e.statementNet !== null && e.statementNet === r.net ? ' · banka ekstresiyle aynı ✓' : ''}
              </ThemedText>
            </View>
          );
        })}
      </Card>

      <Card>
        <ThemedText style={styles.h}>Vade günü: ileriye dönük hesap</ThemedText>
        <Formula>yıllık getiri = (1 + net × vade ÷ 365) ^ (365 ÷ vade) − 1</Formula>
        <Formula>beklenen reel = (1 + yıllık getiri) ÷ (1 + beklenen enflasyon) − 1</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          Faiz, her vadede aynı oranla yenilenmiş sayılır; beklenen enflasyon TCMB Piyasa Katılımcıları Anketi’nin 12 ay
          sonrası beklentisidir. Ortalama faiz, bankaların yeni açılan TL mevduatlara uyguladığı ağırlıklı ortalamadır
          (TCMB EVDS). Bu bir beklenti hesabıdır, öneri değildir.
        </ThemedText>
        <Row label="Beklenen enflasyon" value={`${formatRate(feed.expectations.next12m.market)} · ${formatMonth(feed.expectations.month)}`} />
        <Row
          label="Ortalama mevduat faizi"
          value={feed.depositRates ? `${formatDate(feed.depositRates.date)} haftası` : 'veri bekleniyor'}
        />
      </Card>

      <Card>
        <ThemedText style={styles.h}>Dolar bazında reel getiri</ThemedText>
        <Formula>reel ($) = (bugünkü değer ÷ dolar kuru) ÷ (maliyet ÷ alış ayı kuru) ÷ (ABD TÜFE oranı) − 1</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          Varlığın dolar olarak değişimi, ABD enflasyonuyla düzeltilir; yastık altındaki dolar da burada değer kaybeder.
          Dolar varlıklarında maliyet, girdiğin dolar miktarıdır.
        </ThemedText>
        {feed.usCpi && (
          <Row label="ABD TÜFE" value={`${formatMonth(feed.usCpi.rows[feed.usCpi.rows.length - 1].month)} · BLS (FRED)`} />
        )}
      </Card>

      <Card>
        <ThemedText style={styles.h}>Döviz ve altın</ThemedText>
        <Formula>gram altın = ons fiyatı ÷ 31,1035 × USD/TRY</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          Çeyrek, yarım, tam ve Cumhuriyet altını içindeki saf altından (22 ayar) fiyatlanır; kuyumcu fiyatına işçilik
          eklendiği için biraz düşük görünebilir. Kurlar Avrupa Merkez Bankası’nın günlük referans kurudur; ulaşılamazsa
          TCMB kuru kullanılır.
        </ThemedText>
        {book.usd && <Row label="Dolar" value={quoteLabel(book.usd)} />}
        {book.gold && <Row label="Altın" value={quoteLabel(book.gold)} />}
      </Card>

      <Card>
        <ThemedText style={styles.h}>Portföy toplamı</ThemedText>
        <Formula>reel = Σ bugünkü değer ÷ Σ (maliyet × kendi dönemindeki enflasyon) − 1</Formula>
        <ThemedText type="small" themeColor="textSecondary">
          Her varlık kendi alış tarihinden itibaren enflasyonla düzeltilir; böylece farklı tarihlerde alınanlar doğru
          toplanır.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText style={styles.h}>Kıyaslar ve “Yenilesem mi?”</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Aynı paranın aynı tarihlerde dolarda, gram altında ya da aynı koşullu mevduatta tutulsaydı ne olacağı, aynı
          enflasyonla kıyaslanır. Geçmiş dolar kuru ECB’nin ay sonu kuru, geçmiş altın Dünya Bankası’nın aylık ortalama
          fiyatıdır. Bu hesaplar geçmişi gösterir; gelecek için öneri değildir.
        </ThemedText>
        {feed.markets && <Row label="Piyasa geçmişi" value={feed.markets.source} />}
      </Card>

      <Card>
        <ThemedText style={styles.h}>Veri kaynakları</ThemedText>
        <Row label="TÜFE" value={`TÜİK, TCMB aracılığıyla · ${formatMonth(last.month)}`} />
        <Row label="Politika faizi" value={`TCMB · ${formatRate(policy.rate)} (${formatDate(policy.from)})`} />
        <Row label="Beklentiler" value={`TCMB anketi · ${formatMonth(feed.expectations.month)}`} />
        <Row label="Veri akışı" value={`son derleme ${formatStamp(feed.generatedAt)}`} />
      </Card>

      <Disclaimer text="Paraölçer bir hesaplama aracıdır; yatırım tavsiyesi vermez." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  h: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  example: { gap: 2 },
  formula: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 19, opacity: 0.9 },
});
