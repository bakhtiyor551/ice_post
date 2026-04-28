CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  daily_salary_rate REAL DEFAULT 45,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  price REAL NOT NULL,
  cost_price REAL NOT NULL,
  image TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  user_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  total_amount REAL NOT NULL,
  discount REAL DEFAULT 0,
  payment_method TEXT NOT NULL,
  primary_account_id TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  total REAL NOT NULL,
  cost_total REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  start_cash REAL DEFAULT 0,
  open_comment TEXT,
  expected_cash REAL,
  end_cash REAL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  status TEXT DEFAULT 'open',
  cash_sales REAL DEFAULT 0,
  card_sales REAL DEFAULT 0,
  transfer_sales REAL DEFAULT 0,
  cash_expenses REAL DEFAULT 0,
  difference REAL DEFAULT 0,
  salary_amount REAL DEFAULT 0,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  account_id TEXT,
  comment TEXT,
  image TEXT,
  user_id TEXT NOT NULL,
  shift_id TEXT,
  expense_date TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated_at TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stock_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  min_quantity REAL DEFAULT 0,
  purchase_price REAL DEFAULT 0,
  average_cost REAL DEFAULT 0,
  supplier TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  stock_item_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  amount REAL DEFAULT 0,
  reason TEXT,
  comment TEXT,
  sale_id TEXT,
  expense_id TEXT,
  shift_id TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  stock_item_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS inventory_checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS inventory_check_items (
  id TEXT PRIMARY KEY,
  inventory_check_id TEXT NOT NULL,
  stock_item_id TEXT NOT NULL,
  system_quantity REAL NOT NULL,
  actual_quantity REAL NOT NULL,
  difference REAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS salary_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shift_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  comment TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS salary_settings (
  id TEXT PRIMARY KEY,
  daily_rate REAL NOT NULL DEFAULT 45,
  allow_double_shift_payment INTEGER DEFAULT 0,
  create_expense_on_payout INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  worked_days REAL DEFAULT 0,
  base_salary REAL DEFAULT 0,
  bonus_total REAL DEFAULT 0,
  penalty_total REAL DEFAULT 0,
  payout_total REAL DEFAULT 0,
  final_salary REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS conflict_logs (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  local_id TEXT NOT NULL,
  server_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS account_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  direction TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  from_account_id TEXT,
  to_account_id TEXT,
  shift_id TEXT,
  user_id TEXT,
  comment TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
);
