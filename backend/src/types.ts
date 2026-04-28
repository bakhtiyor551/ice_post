export type SyncStatus = 'pending' | 'synced' | 'failed';
export type Role = 'admin' | 'cashier';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed';

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
  sync_status: SyncStatus;
}

export interface User extends BaseEntity {
  name: string;
  phone: string;
  pin_hash: string;
  role: Role;
  daily_salary_rate: number;
  is_active: boolean;
}

export interface Category extends BaseEntity {
  name: string;
}

export interface Product extends BaseEntity {
  name: string;
  category_id: string;
  price: number;
  cost_price: number;
  image?: string;
  is_active: boolean;
}

export interface Sale extends BaseEntity {
  receipt_number: string;
  user_id: string;
  shift_id: string;
  total_amount: number;
  discount: number;
  payment_method: PaymentMethod;
  primary_account_id?: string;
}

export interface SaleItem extends BaseEntity {
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  total: number;
  cost_total: number;
}

export interface Shift extends BaseEntity {
  user_id: string;
  account_id: string;
  start_cash: number;
  open_comment?: string;
  expected_cash?: number;
  end_cash?: number;
  opened_at: string;
  closed_at?: string;
  status: 'open' | 'closed';
  cash_sales: number;
  card_sales: number;
  transfer_sales: number;
  cash_expenses: number;
  difference: number;
  salary_amount: number;
}

export interface Expense extends BaseEntity {
  category_id: string;
  amount: number;
  payment_method: 'cash' | 'card' | 'transfer';
  account_id?: string;
  comment?: string;
  image?: string;
  user_id: string;
  shift_id?: string;
  expense_date: string;
  is_deleted: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  type: 'variable' | 'fixed' | 'one_time';
  is_active: boolean;
  created_at: string;
}

export interface RecurringExpense {
  id: string;
  category_id: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  start_date: string;
  end_date?: string;
  last_generated_at?: string;
  is_active: boolean;
}

export interface StockItem extends BaseEntity {
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  purchase_price: number;
}

export interface Recipe extends BaseEntity {
  product_id: string;
  stock_item_id: string;
  quantity: number;
  unit: string;
}

export interface SalaryTransaction extends BaseEntity {
  user_id: string;
  shift_id?: string;
  type: 'daily_salary' | 'bonus' | 'penalty' | 'payout';
  amount: number;
  payment_method?: 'cash' | 'card' | 'transfer';
  comment?: string;
}

export interface SalarySettings {
  id: string;
  daily_rate: number;
  allow_double_shift_payment: boolean;
  create_expense_on_payout: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollPeriod extends BaseEntity {
  user_id: string;
  period_start: string;
  period_end: string;
  worked_days: number;
  base_salary: number;
  bonus_total: number;
  penalty_total: number;
  payout_total: number;
  final_salary: number;
  balance: number;
  status: 'open' | 'partially_paid' | 'paid';
}

export type AccountType = 'cash_register' | 'safe' | 'owner' | 'other';
export type AccountTransactionType = 'income' | 'expense' | 'transfer' | 'correction';
export type AccountTransactionDirection = 'in' | 'out';
export type AccountReferenceType = 'sale' | 'expense' | 'salary' | 'stock' | 'manual' | 'transfer' | 'correction' | 'shift_open';

export interface Account extends BaseEntity {
  name: string;
  type: AccountType;
  balance: number;
  is_active: boolean;
}

export interface AccountTransaction extends BaseEntity {
  account_id: string;
  type: AccountTransactionType;
  amount: number;
  direction: AccountTransactionDirection;
  reference_type: AccountReferenceType;
  reference_id: string;
  from_account_id?: string;
  to_account_id?: string;
  shift_id?: string;
  user_id?: string;
  comment?: string;
}
