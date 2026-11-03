import type { Category } from './types';

// Built-in categories. Colours are the app's chart palette; icons are Material Symbols names
// (Android/web) mapped to SF Symbols on iOS in the category chip.
export const CATEGORIES: Category[] = [
  { id: 'market', name: 'Market', icon: 'shopping_cart', color: '#16A34A', kind: 'expense' },
  { id: 'rent', name: 'Kira', icon: 'home', color: '#C2410C', kind: 'expense' },
  { id: 'bills', name: 'Faturalar', icon: 'bolt', color: '#CA8A04', kind: 'expense' },
  { id: 'food', name: 'Yemek', icon: 'restaurant', color: '#E11D48', kind: 'expense' },
  { id: 'transport', name: 'Ulaşım', icon: 'directions_car', color: '#2563EB', kind: 'expense' },
  { id: 'shopping', name: 'Alışveriş', icon: 'shopping_bag', color: '#DB2777', kind: 'expense' },
  { id: 'health', name: 'Sağlık', icon: 'medical_services', color: '#0D9488', kind: 'expense' },
  { id: 'education', name: 'Eğitim', icon: 'school', color: '#7C3AED', kind: 'expense' },
  { id: 'fun', name: 'Eğlence', icon: 'movie', color: '#9333EA', kind: 'expense' },
  { id: 'subscriptions', name: 'Üyelikler', icon: 'subscriptions', color: '#4F46E5', kind: 'expense' },
  { id: 'credit', name: 'Kredi / borç', icon: 'credit_score', color: '#B91C1C', kind: 'expense' },
  { id: 'invest-out', name: 'Yatırıma', icon: 'trending_up', color: '#1D4ED8', kind: 'expense' },
  { id: 'other-out', name: 'Diğer', icon: 'more_horiz', color: '#64748B', kind: 'expense' },
  { id: 'salary', name: 'Maaş', icon: 'work', color: '#15803D', kind: 'income' },
  { id: 'freelance', name: 'Serbest çalışma', icon: 'laptop', color: '#0891B2', kind: 'income' },
  { id: 'rent-in', name: 'Kira geliri', icon: 'home_work', color: '#65A30D', kind: 'income' },
  { id: 'invest-in', name: 'Yatırım getirisi', icon: 'savings', color: '#1D4ED8', kind: 'income' },
  { id: 'other-in', name: 'Diğer gelir', icon: 'more_horiz', color: '#64748B', kind: 'income' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function category(id: string | undefined): Category {
  return (id && BY_ID.get(id)) || BY_ID.get('other-out')!;
}

export function categoriesFor(kind: 'expense' | 'income'): Category[] {
  return CATEGORIES.filter((c) => c.kind === kind);
}
