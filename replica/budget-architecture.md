# Architecture: Bütçe tab in Paraölçer

From `replica/recon.md` and `replica/features.csv`. Date: 2026-11-03. (`replica/architecture.md` is the original Paraölçer architecture and stays as is.)

## Stack

Paraölçer's own stack, nothing new:

| layer | choice | why |
| --- | --- | --- |
| app | Expo SDK 58, Expo Router, TypeScript, React Compiler | the app it lives in |
| state | a second `useSyncExternalStore` store, `src/state/budget.ts` | same pattern as `store.ts`, which is near its 500-line limit |
| storage | AsyncStorage key `gg.budget.v1`, plus the automatic snapshot and the encrypted backup | local-first, account-free, like holdings |
| logic | pure functions in `src/lib/budget/` with vitest tests | every number testable without React |
| FX | Paraölçer's live USD/EUR/GBP rates | multi-currency accounts total in TRY |
| notifications | existing `expo-notifications` helpers | due-date reminders (Premium) |

No server, no database, no auth. "Schema" below is TypeScript types; "API" is the store's actions.

## Schema (types)

Money is stored as **integer minor units** (kuruş, cent) in the account's own currency, so sums never drift.

```ts
type Currency = 'TRY' | 'usd' | 'eur' | 'gbp';
type AccountType = 'cash' | 'bank' | 'card' | 'investment' | 'wallet';

Account     { id, name, type, currency, opening /* minor */, createdAt }
Category    { id, name, icon, color, kind: 'expense' | 'income' }      // built-in defaults
Transaction { id, type: 'expense' | 'income' | 'transfer', amount /* minor, > 0 */,
              accountId, toAccountId?, toAmount? /* minor, cross-currency transfer */,
              categoryId?  /* none for transfers */, date /* 'YYYY-MM-DD' local */, note?,
              plannedId?   /* created by paying a planned payment */, createdAt }
Planned     { id, name, kind: 'bill' | 'subscription', amount /* minor */, currency,
              categoryId, accountId?, dueDate /* next due 'YYYY-MM-DD' */,
              repeat: 'none' | 'weekly' | 'monthly' | 'yearly', anchorDay /* 1..31 */, createdAt }
BudgetPrefs { weeklyLimit? /* minor TRY */, remindPayments? }
```

Constraints enforced in the store actions (there is no database to do it):

- `amount > 0`; transfers need `toAccountId !== accountId`; a cross-currency transfer needs `toAmount`.
- Deleting an account deletes its transactions after a confirmation that names the count; planned payments pointing at it lose `accountId`.
- Built-in categories cannot be deleted.
- Monthly repeats keep `anchorDay` so 31 Jan → 28 Feb → 31 Mar, not 28 Mar.

## "API" (store actions)

| action | what it does | flow |
| --- | --- | --- |
| `saveAccount(a)` / `deleteAccount(id)` | add, edit, remove | F05 |
| `saveTransaction(t)` / `deleteTransaction(id)` | add, edit, remove | F01 |
| `setWeeklyLimit(minor?)` | weekly spending limit | F02 |
| `savePlanned(p)` / `deletePlanned(id)` | bills and subscriptions | F03 |
| `payPlanned(id, accountId, date)` | records the expense, moves `dueDate` to the next occurrence (or removes a one-off) | F03 |
| `skipPlanned(id)` | moves to the next occurrence without a transaction | F03 |

Pure selectors in `src/lib/budget/`:

| function | output | screen |
| --- | --- | --- |
| `accountBalance(acc, txs)` | minor units in the account currency | S02 |
| `toTry(minor, currency, prices)` | TRY number | S01, S02 |
| `totals(txs, range, accounts, prices)` | income, expense (transfers excluded) | S01, S06 |
| `weekRange(today)` | Monday–Sunday | S01 |
| `periodRange(key, today)` | this week / this month / last month / last 3 months | S06 |
| `byCategory(...)`, `byAccount(...)` | rows with amount, share, count | S07 |
| `dailyHeat(month, ...)` | spend per day and level 0–4 | S06 |
| `occurrences(planned, from, to)` | due dates in a window | S03, S05 |
| `nextDue(planned, after)` | next due date with day clamping | F03 |

## Screens and routes

Tabs become **Özet · Varlıklar · Bütçe · Araçlar · Profil**; the Alım gücü cards move to the top of Araçlar (iOS shows at most five tabs).

| ID | route | content |
| --- | --- | --- |
| S01+S02 | `(tabs)/butce` | balance card, weekly spending + limit, upcoming payments (7 days), recent transactions, accounts by type, "Analizler" link, big "+" |
| S09 | `budget/transaction` | add/edit: type segment, amount, category grid, account, date, note; transfer variant |
| — | `budget/account` | add/edit account |
| S03–S05 | `budget/payments` | segments Yaklaşan / Üyelikler / Takvim, empty states, pay / skip |
| — | `budget/payment` | add/edit planned payment or subscription |
| S06–S07 | `budget/analysis` | period chips, totals with change, heat map, category and account breakdown (Premium beyond this month) |

## Premium

Free: transactions, accounts, weekly limit, planned payments, subscriptions, this month's category breakdown.
Premium (`budgetAnalysis`): other periods, daily heat map, account breakdown, period-over-period change; `budgetReminders`: due-date notifications.

## The parts that bite

- **Transfers:** never counted as income or expense; only balances move. Covered by tests (the original shipped this bug).
- **Dates:** stored as local `YYYY-MM-DD`; the week starts on Monday (Turkish convention); no time zones needed.
- **Multi-currency:** totals in TRY use today's rate; without a rate, a foreign account shows its own currency and is left out of the TRY total with a note.
- **Recurring payments:** day clamping; paying moves `dueDate`, so a second tap pays the next one.
- **Data safety:** budget data joins the automatic snapshot, the encrypted backup and "Tüm verilerimi sil".
- **Hide amounts:** every figure goes through the money helpers so the existing mask applies.

## Build order

1. **Vertical slice:** types, store, default categories, a "Nakit" account created on first use, add expense, Bütçe tab shows balance and the list.
2. **Must-haves:** accounts, edit/delete, transfers, weekly limit, this month's categories.
3. **Should-haves:** planned payments + subscriptions + calendar, pay/skip, period chips, heat map, multi-currency.
4. **Could-haves:** account breakdown, reminders, backup integration.
5. Tab move: Alım gücü into Araçlar.
