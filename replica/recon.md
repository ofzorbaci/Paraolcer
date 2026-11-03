# Recon map: Para Takip – Bütçe ve Gider (iOS)

Scope: the budgeting slice — income/expense transactions, accounts, planned payments, subscriptions, a weekly spending limit and the analysis screens. Built as a "Bütçe" tab inside Paraölçer.
For: Paraölçer users who already track real returns and want their monthly cash flow in the same app (local-first, no account).
Date: 2026-11-03

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | App Store listing (TR) | https://apps.apple.com/tr/app/para-takip-b%C3%BCt%C3%A7e-ve-gider/id6760190421?l=tr | pitch, 7 features, release notes |
| 2 | App Store screenshots (8) | iTunes lookup API, `screenshotUrls` | saved as `replica/screens/S0n-store.jpg`, reference only |
| 3 | Release notes 1.0.4 | same listing | transfers between accounts, payment calendar |

No help center, pricing page, changelog or public API found. No account used. Free app, 4.9★ from 16 ratings, seller Berkay Koruyucu.

## Core loop

Record an income or expense against an account and a category, then see balance, weekly spending against a limit, and where the money went.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Ana Sayfa | tab 1 | total balance, weekly spending, recent transactions | balance card, weekly spending card with limit bar, "Harcama limiti ekle", recent list, date header, bell | filled |
| S02 | Cüzdan | tab 4 | accounts by type, weekly income/expense charts, goal | investment goal card with % ring, weekly balance / income / expense cards with sparkline, account groups (Banka, Kredi Kartı, Yatırım) with totals and counts, "Hesap Ekle", "Analizler" link, shared account card | filled |
| S03 | Ödemeler › Yaklaşan | tab 2, segment | planned payments | segmented control (Üyelikler / Yaklaşan / Takvim), category chips, "Ödemelerini Planla" empty state, "Ödeme Ekle" | empty |
| S04 | Ödemeler › Üyelikler | tab 2, segment | subscriptions | service chips (Disney+, HBO Max, Deezer…), "Üyeliklerini Yönet" empty state, "Üyelik Ekle" | empty |
| S05 | Ödemeler › Takvim | tab 2, segment | payments on a calendar | (not shown in screenshots) | — |
| S06 | Analizler (üst) | Cüzdan › Analizler | totals and daily heat map | period chips (Bu Hafta, Bu Ay, Geçen Ay, Son 3 Ay), total income/expense with % change, daily spending heat map, legend Düşük→Yüksek, month totals, spending donut | filled |
| S07 | Analizler (alt) | scroll | category and account breakdown | category rows (icon, amount, % bar, n işlem, expandable), account-based spending rows | filled |
| S08 | Finansal Okuryazarlık | home card | gamified lessons | level path, leagues, coins, streak | filled |
| S09 | İşlem ekle | center tab button | add income/expense/transfer | (not shown; inferred from the center "B" button) | — |

## Flows

```
F01 Record an expense
    S01 -> S09 (amount, category, account, date, note) -> S01 updated
    happy path clicks: 4 (open, amount, category, save)
    edge: no account yet, foreign-currency account, transfer between own accounts (must not double count)

F02 Set a weekly spending limit
    S01 "Harcama limiti ekle" -> amount -> S01 shows bar and %
    happy path clicks: 3
    edge: limit exceeded, week boundary (Monday)

F03 Plan a payment / add a subscription
    S03|S04 -> "Ödeme Ekle"/"Üyelik Ekle" -> name, amount, category, date, repeat -> list + calendar
    happy path clicks: 5
    edge: monthly repeat on the 31st, marking a payment as paid (becomes a transaction)

F04 See where money went
    S02 "Analizler" -> S06 period -> S07 categories
    happy path clicks: 2

F05 Add an account
    S02 "Hesap Ekle" -> type, name, opening balance, currency -> S02
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Summary card | balance (accent), spending (negative), income (positive), goal (info) | filled, with limit bar | S01, S02 |
| Segmented control | 3 options | selected | S03–S05 |
| Category chip | icon + label, colour per category | default | S03, S04 |
| Empty state | title, line, primary button | — | S03, S04 |
| Period chips | 4 options | selected | S06 |
| Heat-map calendar | 7 columns, intensity by spend, today highlighted | — | S06 |
| Donut / bar breakdown | category rows with % bar | expandable | S06, S07 |
| Account group row | icon, name, count, total, chevron | collapsed, expanded | S02 |
| FAB / center button | add transaction | — | all |

## Inferred data model

```
Account      id, name, type (cash | bank | card | investment | wallet), currency, openingBalance
             evidence: S02 groups and totals, "Hesap Ekle", feature "Çoklu Hesap", "Çoklu Para Birimi"
             confidence: high
Category     id, name, icon, colour, kind (expense | income)
             evidence: S03 chips (Yemek, Sağlık, Yatırım, Diğer, Alışveriş, Ulaşım, Faturalar, Maaş, Kira, Eğitim, Serbest Çalışma, Eğlence), S07
             confidence: high
Transaction  id, type (income | expense | transfer), amount, accountId, toAccountId?, categoryId, date, note
             evidence: S01 recent list, S06 totals, release note on transfers double counting
             confidence: high
PlannedPayment id, name, amount, categoryId, accountId?, dueDate, repeat (none | monthly | yearly), paidAt?
             evidence: S03, S05 "Takvim", release note "ödeme takvimi"
             confidence: medium
Subscription id, name (service), amount, cycle (monthly | yearly), nextDate, accountId?
             evidence: S04 service chips
             confidence: medium (may be PlannedPayment with repeat)
SpendingLimit weekly amount
             evidence: S01 "Harcama limiti ekle", "%0"
             confidence: high
Goal         name, target, current
             evidence: S02 "Yatırım Hedefi ₺18,800 / ₺50,000 %37"
             confidence: high
SharedAccount members
             evidence: S02 "Ortak Hesap berkay2, evrendu"
             confidence: medium (needs accounts and sync)
```

Relationships: Account 1-n Transaction, Category 1-n Transaction, PlannedPayment 0-1 Transaction (when paid), Subscription ⊂ PlannedPayment with a repeat.

## Feature matrix

See `features.csv`. Must: 9, should: 7, could: 3, skip: 4.

## Out of scope (cannot or should not be cloned)

- Their brand, mascot (seahorse), purple visual style, service logos — Paraölçer keeps its own navy/blue design.
- Ortak Hesaplar (shared accounts): needs user accounts and cloud sync; Paraölçer is account-free and local-first.
- Finansal Okuryazarlık lessons and leagues: their content; not part of a budget tool.
- Bank connections: not offered by the original either; Turkish open banking would need a licence.

## Size

Screens 7 (in one tab with sub-screens), flows 5, entities 7. Hard parts: transfers without double counting, recurring payments and the calendar, multi-currency totals (convert with Paraölçer's live rates). Size: M.

## Fit with Paraölçer

Budget data stays separate from investment holdings; the link is the "Yatırım" category and the goal card, which can point to Paraölçer's existing real-terms goal. Everything stays on the phone like the rest of the app.
