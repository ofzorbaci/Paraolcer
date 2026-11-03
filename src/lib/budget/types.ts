// Budget data: accounts, transactions and planned payments. Kept apart from investment holdings.
// Amounts are integer minor units (kuruş, cent) in the account's own currency, so sums never drift.

export type BudgetCurrency = 'TRY' | 'usd' | 'eur' | 'gbp';

export type AccountType = 'cash' | 'bank' | 'card' | 'investment' | 'wallet';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: BudgetCurrency;
  /** balance when the account was added, minor units */
  opening: number;
  createdAt: string;
};

export type CategoryKind = 'expense' | 'income';

export type Category = { id: string; name: string; icon: string; color: string; kind: CategoryKind };

export type TxType = 'expense' | 'income' | 'transfer';

export type Transaction = {
  id: string;
  type: TxType;
  /** minor units in the source account's currency, always > 0 */
  amount: number;
  accountId: string;
  /** transfers only */
  toAccountId?: string;
  /** transfers between currencies: what arrived, in the target account's minor units */
  toAmount?: number;
  /** none for transfers */
  categoryId?: string;
  /** 'YYYY-MM-DD', local date */
  date: string;
  note?: string;
  /** set when the transaction paid a planned payment */
  plannedId?: string;
  createdAt: string;
};

export type Repeat = 'none' | 'weekly' | 'monthly' | 'yearly';

export type Planned = {
  id: string;
  name: string;
  kind: 'bill' | 'subscription';
  /** minor units in `currency` */
  amount: number;
  currency: BudgetCurrency;
  categoryId: string;
  accountId?: string;
  /** next due date, 'YYYY-MM-DD' */
  dueDate: string;
  repeat: Repeat;
  /** day of month the payment belongs to, so 31 Jan → 28 Feb → 31 Mar */
  anchorDay: number;
  createdAt: string;
};

export type BudgetPrefs = {
  /** weekly spending limit, minor TRY */
  weeklyLimit?: number;
  /** Premium: remind on due dates */
  remindPayments?: boolean;
};

export type BudgetData = {
  accounts: Account[];
  transactions: Transaction[];
  planned: Planned[];
  prefs: BudgetPrefs;
};

export const EMPTY_BUDGET: BudgetData = { accounts: [], transactions: [], planned: [], prefs: {} };

export const ACCOUNT_TYPES: { id: AccountType; label: string; icon: string }[] = [
  { id: 'cash', label: 'Nakit', icon: 'payments' },
  { id: 'bank', label: 'Banka', icon: 'account_balance' },
  { id: 'card', label: 'Kredi kartı', icon: 'credit_card' },
  { id: 'wallet', label: 'Dijital cüzdan', icon: 'account_balance_wallet' },
  { id: 'investment', label: 'Yatırım', icon: 'trending_up' },
];

export const CURRENCY_LABEL: Record<BudgetCurrency, string> = { TRY: '₺ TL', usd: '$ Dolar', eur: '€ Euro', gbp: '£ Sterlin' };
export const CURRENCY_SIGN: Record<BudgetCurrency, string> = { TRY: '₺', usd: '$', eur: '€', gbp: '£' };
