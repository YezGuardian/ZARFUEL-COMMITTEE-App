import type { Database } from '@/integrations/supabase/types';

export type BudgetCategory = Database['public']['Tables']['budget_categories']['Row'];

export interface BudgetData {
  totalBudget: number;
  allocated: number;
  spent: number;
  categories: BudgetCategory[];
}
