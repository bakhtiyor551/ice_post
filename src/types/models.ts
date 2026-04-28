export type SyncStatus = 'pending' | 'synced' | 'failed';
export type Role = 'admin' | 'cashier';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed';
export type ShiftStatus = 'open' | 'closed';
export type StockMovementType = 'sale' | 'writeoff' | 'income' | 'correction' | 'inventory' | 'return';
export type SalaryTransactionType = 'daily_salary' | 'bonus' | 'penalty' | 'payout';
export type PayrollStatus = 'open' | 'partially_paid' | 'paid';
export type ExpenseType = 'variable' | 'fixed' | 'one_time';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';
export type StockUnit = 'шт' | 'кг' | 'г' | 'л' | 'мл' | 'пачка' | 'коробка';
export type StockCategory = 'Сырьё' | 'Упаковка' | 'Дополнительно';
export type AccountType = 'cash_register' | 'safe' | 'owner' | 'other';
export type AccountTransactionType = 'income' | 'expense' | 'transfer' | 'correction';
export type AccountTransactionDirection = 'in' | 'out';
export type AccountReferenceType = 'sale' | 'expense' | 'salary' | 'stock' | 'manual' | 'transfer' | 'correction' | 'shift_open';

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
  payment_breakdown?: { cash: number; card: number; transfer: number };
  /** Счёт(а) фиксируются в account_transactions; поле для быстрого UX (смена/касса) */
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
  /** Счёт кассы точки: наличные продажи и начальная касса */
  account_id: string;
  /** Деньги в ящике на начало смены (не доход, только для расчёта остатка) */
  start_cash: number;
  /** Комментарий при открытии (например, «деньги на сдачу») */
  open_comment?: string;
  /** Ожидаемый остаток наличных: start_cash + наличные продажи − наличные расходы (заполняется при закрытии) */
  expected_cash?: number;
  /** Фактический остаток наличных в кассе при закрытии */
  end_cash?: number;
  opened_at: string;
  closed_at?: string;
  status: ShiftStatus;
  cash_sales: number;
  card_sales: number;
  transfer_sales: number;
  cash_expenses: number;
  /** Разница: факт − ожидаемое (отрицательно = недостача) */
  difference: number;
  salary_amount: number;
}

export interface Expense extends BaseEntity {
  category_id: string;
  amount: number;
  payment_method: Exclude<PaymentMethod, 'mixed'>;
  /** Счёт списания обязателен для новых расходов */
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
  type: ExpenseType;
  is_active: boolean;
  created_at: string;
}

export interface RecurringExpense {
  id: string;
  category_id: string;
  amount: number;
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string;
  last_generated_at?: string;
  is_active: boolean;
}

export interface StockItem extends BaseEntity {
  name: string;
  category: StockCategory;
  unit: StockUnit;
  quantity: number;
  min_quantity: number;
  purchase_price: number;
  average_cost: number;
  supplier?: string;
  is_active: boolean;
}

export interface StockMovement extends BaseEntity {
  stock_item_id: string;
  type: StockMovementType;
  quantity: number;
  unit: StockUnit;
  amount: number;
  reason?: string;
  comment?: string;
  sale_id?: string;
  expense_id?: string;
  shift_id?: string;
  user_id?: string;
}

export interface Recipe extends BaseEntity {
  product_id: string;
  stock_item_id: string;
  quantity: number;
  unit: StockUnit;
}

export interface InventoryCheck extends BaseEntity {
  user_id: string;
  comment?: string;
}

export interface InventoryCheckItem {
  id: string;
  inventory_check_id: string;
  stock_item_id: string;
  system_quantity: number;
  actual_quantity: number;
  difference: number;
  unit: StockUnit;
  created_at: string;
}

export interface SalaryTransaction extends BaseEntity {
  user_id: string;
  shift_id?: string;
  type: SalaryTransactionType;
  amount: number;
  payment_method?: Exclude<PaymentMethod, 'mixed'>;
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
  status: PayrollStatus;
}

export interface ConflictLog {
  id: string;
  table_name: string;
  local_id: string;
  server_id?: string;
  reason: string;
  created_at: string;
}

export interface ActiveSession {
  user_id: string;
  logged_in_at: string;
}

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
