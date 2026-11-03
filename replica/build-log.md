# Build log: Bütçe

| ID | date | status | missing / notes |
| --- | --- | --- | --- |
| S01+S02 Bütçe tab | 2026-11-03 | done | balance (TRY, foreign accounts at live rate), this month in/out, weekly spending + limit, due in 7 days with pay, this month by category, accounts by type, recent list, empty state |
| S09 İşlem ekle | 2026-11-03 | done | expense / income / transfer, cross-currency transfer amount, category grid, date, note, edit and delete |
| — Hesap | 2026-11-03 | done | type, name, currency (locked once used), opening balance (negative for card debt), delete with count |
| S03–S05 Ödemeler | 2026-11-03 | done | Yaklaşan, Üyelikler (monthly and yearly total), Takvim with due dots; paid / skip; reminders (Premium, native only) |
| — Ödeme planla | 2026-11-03 | done | bill or subscription, currency, due date, repeat with month-end clamping, category, optional account |
| S06–S07 Analizler | 2026-11-03 | done | period chips, totals, change vs previous period (Premium), daily heat map (Premium), by category (free), by account (Premium) |
| Tabs | 2026-11-03 | done | Özet · Varlıklar · Bütçe · Araçlar · Profil; Alım gücü cards moved to the top of Araçlar |

Harder than expected: iOS shows at most five tabs, so adding Bütçe meant moving Alım gücü. Transfers never count as income or expense (the original fixed exactly this bug in 1.0.4).

Not done: shared accounts, lessons and mascot (skip rows, by design); custom categories; Excel export of budget data (the encrypted backup and the automatic snapshot do include it).
Commits: left to the user's "push" after a phone test, not one per screen.
