# Gerçek Getiri — Mimari

## Problem

Yatırımcı nominal kârını görür ama paranın satın alma gücünü artırıp artırmadığını
bilmez. Mevcut portföy uygulamaları (Temettü, Cüzdan, İyi Gelir) enflasyon
düzeltmesi göstermiyor; BES Enflasyon yalnızca BES'e bakıyor; web hesaplayıcılar
(FVT, Paratic) tek seferlik ve portföy tutmuyor. Yurt dışında Sharesight ve Delta
kullanıcıları bu özelliği talep ediyor ama ürünlerde yok.

## Yığın

| katman | seçim | neden |
| --- | --- | --- |
| mobil | Expo SDK 58 + Expo Router | tek kod iOS/Android/web, Expo Go ile anında deneme |
| durum | `useSyncExternalStore` tabanlı küçük store | ek bağımlılık yok |
| kalıcılık | AsyncStorage (cihazda) | finansal veri cihazdan çıkmaz, hesap gerekmez |
| grafik | düz View çubukları | bağımlılık yok |
| test | vitest (sadece `src/lib`) | saf hesaplama mantığı hızlı test edilir |

Sunucu yok, kullanıcı hesabı yok. Bu bilinçli bir gizlilik kararı.

## Veri kaynakları

| veri | kaynak | durum |
| --- | --- | --- |
| TÜİK TÜFE (aylık/yıllık %, 2005→) | TCMB "Tüketici Fiyatları" sayfası | `scripts/update-cpi.mts` ile paketlenir, telefonda açılışta yenilenir |
| USD/TRY, EUR/TRY (günlük, tarihsel) | Frankfurter API (ECB) | anahtarsız, canlı |
| gram altın | gold-api.com ons × ECB USD/TRY ÷ 31,1035 | anahtarsız, canlı; Kapalıçarşı primi yok |
| enflasyon beklentileri | TCMB Piyasa Katılımcıları ve Sektörel Beklentiler anketi | `src/data/expectations.json`, aylık elle güncellenir |
| mevduat stopajı | 2025/66 ve 11444 sayılı Cumhurbaşkanı Kararları | %17,5 / %15 / %10, 31.12.2026'ya kadar |
| ENAG / kişisel enflasyon | kullanıcı girer (yıllık %) | ENAG'ın makine okunur kaynağı yok |
| BIST hisse, TEFAS fon | kullanıcı güncel fiyatı girer | TEFAS'ın açık API'si yok |

## Veri modeli (cihazda JSON)

```ts
Holding {
  id, kind: 'deposit' | 'usd' | 'eur' | 'gold' | 'stock' | 'fund' | 'other'
  name, buyDate: 'YYYY-MM-DD', quantity, unitCost
  currentPrice?, priceUpdatedAt?        // elle fiyatlananlar
  grossRate?, termDays?, withholding?   // mevduat: brüt faiz, vade, stopaj
  depositRate?                          // v1 mevduat kayıtları (net faiz)
}
Settings { inflationSource: 'tuik' | 'custom', customAnnualRate, notifyCpi }
```

## Hesaplama

- Enflasyon çarpanı: alış ayının TÜFE endeksinden son yayımlanan aya (TÜİK yöntemi).
  Endeks, aylık % değişimlerin zincirlenmesiyle kurulur.
- Reel getiri (Fisher): `(1 + nominal) / (1 + enflasyon) − 1`.
- Mevduat: net = brüt × (1 − stopaj); her vade sonunda bileşik.
- Portföy: `Σ güncel değer / Σ (maliyet × çarpan) − 1`; reel kâr bugünün TL'si ile.
- Alım gücü serisi: son 12 ay, ay sonu değerleri pencere başı fiyatlarına indirgenir;
  geçmiş fiyatı olmayan varlıklar doğrusal tahmin edilir ve ekranda belirtilir.
- Senaryo: kullanıcının mevduat koşullarıyla 12 ay sonra reel getiri, üç TÜFE varsayımıyla.
- Maaş: son zamdan beri TÜFE ile alım gücü kaybı ve gereken zam.

## Ekranlar ("Reel Getiri Pusulası" taslağı)

| ekran | rota |
| --- | --- |
| Özet: ana kart, "Kim koruyor, kim eritiyor?", TÜFE duyurusu, bildirim zili | `/(tabs)/index` |
| Varlıklarım: kartlar, brüt faiz / net / reel şeridi | `/(tabs)/holdings` |
| Alım gücün: grafik, senaryo, maaş hesabı | `/(tabs)/power` |
| Profil: enflasyon kaynağı, hatırlatma, veri durumu, stopaj, yöntem | `/(tabs)/profile` |
| Varlık ekle/düzenle + anlık hesap | `/holding/edit` |
| Varlık detayı | `/holding/[id]` |
| Hızlı reel getiri hesabı | `/tools/calculator` |

## Riskli kısımlar

1. TÜFE verisinin güncelliği: TCMB sayfa yapısı değişirse ayrıştırıcı kırılır;
   paketli veri yedek olarak kalır ve ekranda "son veri: AA.YYYY" yazar.
2. Son TÜFE ayından sonraki alımlarda enflasyon henüz yayımlanmamıştır; bu
   durumda çarpan 1 olur ve ekranda belirtilir.
3. Mevzuat: uygulama yatırım tavsiyesi vermez; her ekranda bilgi amaçlı uyarı.
4. Stopaj oranları 31.12.2026'da sona eriyor; yeni karar çıkınca `src/lib/deposit.ts` güncellenmeli.
5. Beklenti verisi elle güncelleniyor; eskidikçe senaryo kartındaki ay etiketi bunu gösterir.
