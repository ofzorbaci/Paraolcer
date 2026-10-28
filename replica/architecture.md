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
| TÜİK TÜFE (aylık/yıllık %, 2005→) | TCMB "Tüketici Fiyatları" sayfası | `scripts/update-cpi.mjs` ile paketlenir, uygulama açılışta yeniler |
| USD/TRY, EUR/TRY (tarihsel) | Frankfurter API (ECB) | anahtarsız, canlı |
| ENAG / kişisel enflasyon | kullanıcı girer (yıllık %) | ENAG'ın makine okunur kaynağı yok |
| altın, BIST, TEFAS fon | kullanıcı güncel fiyatı girer | MVP; sonraki adım EVDS anahtarı ile otomatik |

## Veri modeli (cihazda JSON)

```ts
Holding {
  id: string
  kind: 'deposit' | 'usd' | 'eur' | 'gold' | 'stock' | 'fund' | 'other'
  name: string
  buyDate: 'YYYY-MM-DD'
  quantity: number        // adet / gram / döviz miktarı; mevduatta 1
  unitCost: number        // TL, alış birim fiyatı
  currentPrice?: number   // TL, elle girilen güncel birim fiyat
  priceUpdatedAt?: string
  depositRate?: number    // mevduat: yıllık net faiz (%)
}
Settings { inflationSource: 'tuik' | 'custom', customAnnualRate: number }
```

## Hesaplama

- Enflasyon çarpanı: alış ayının TÜFE endeksinden son yayımlanan aya.
  Endeks, aylık % değişimlerin zincirlenmesiyle kurulur (Ocak 2005 = 100).
- Reel getiri (Fisher): `(1 + nominal) / (1 + enflasyon) − 1`.
- Portföy: `Σ güncel değer / Σ (maliyet × çarpan) − 1`; reel kâr bugünün TL'si ile.
- Kıyas: aynı para alış günü USD/EUR'ya çevrilseydi bugün ne ederdi.

## Ekranlar

| id | ekran | rota |
| --- | --- | --- |
| S1 | Özet: "Enflasyonu yeniyor musun?" kartı, kıyas, varlık listesi | `/(tabs)/index` |
| S2 | Hesapla: tek seferlik reel getiri hesaplayıcı | `/(tabs)/calculator` |
| S3 | Ayarlar: enflasyon kaynağı, veri durumu, uyarı | `/(tabs)/settings` |
| S4 | Varlık ekle/düzenle (modal) | `/holding/edit` |
| S5 | Varlık detayı | `/holding/[id]` |

## Riskli kısımlar

1. TÜFE verisinin güncelliği: TCMB sayfa yapısı değişirse ayrıştırıcı kırılır;
   paketli veri yedek olarak kalır ve ekranda "son veri: AA.YYYY" yazar.
2. Son TÜFE ayından sonraki alımlarda enflasyon henüz yayımlanmamıştır; bu
   durumda çarpan 1 olur ve ekranda belirtilir.
3. Mevzuat: uygulama yatırım tavsiyesi vermez; her ekranda bilgi amaçlı uyarı.
