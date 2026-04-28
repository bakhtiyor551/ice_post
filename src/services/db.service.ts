import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import {
  Account,
  AccountTransaction,
  Category,
  ConflictLog,
  Expense,
  ExpenseCategory,
  InventoryCheck,
  InventoryCheckItem,
  PayrollPeriod,
  Product,
  RecurringExpense,
  Recipe,
  SalarySettings,
  SalaryTransaction,
  Sale,
  SaleItem,
  Shift,
  StockItem,
  StockMovement,
  User
} from '../types/models';

type TableMap = {
  users: User[];
  categories: Category[];
  products: Product[];
  sales: Sale[];
  sale_items: SaleItem[];
  shifts: Shift[];
  expenses: Expense[];
  expense_categories: ExpenseCategory[];
  recurring_expenses: RecurringExpense[];
  stock_items: StockItem[];
  stock_movements: StockMovement[];
  recipes: Recipe[];
  inventory_checks: InventoryCheck[];
  inventory_check_items: InventoryCheckItem[];
  salary_settings: SalarySettings[];
  salary_transactions: SalaryTransaction[];
  payroll_periods: PayrollPeriod[];
  accounts: Account[];
  account_transactions: AccountTransaction[];
  conflict_logs: ConflictLog[];
};

type TableName = keyof TableMap;

const DB_STORAGE_KEY_V5 = 'ice_pos_db_v5';
const DB_STORAGE_KEY = 'ice_pos_db_v6';
const NOW = () => new Date().toISOString();

class DbService {
  private sqliteConnection?: SQLiteConnection;
  private sqliteDb?: SQLiteDBConnection;
  private initialized = false;
  /** Кэш полного сидa для подстановки отсутствующих таблиц в сохранённом JSON */
  private tableTemplate?: TableMap;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (Capacitor.getPlatform() !== 'web') {
      try {
        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
        this.sqliteDb = await this.sqliteConnection.createConnection('ice_pos_mobile', false, 'no-encryption', 1, false);
        await this.sqliteDb.open();
        await this.sqliteDb.execute(this.schemaSql);
      } catch {
        // Storage fallback remains available if native SQLite is not ready.
      }
    }

    if (!localStorage.getItem(DB_STORAGE_KEY)) {
      const legacy = localStorage.getItem(DB_STORAGE_KEY_V5);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy) as Partial<TableMap>;
          const template = this.seedData();
          const out = {} as TableMap;
          for (const k of Object.keys(template) as Array<keyof TableMap>) {
            const v = parsed[k];
            (out as Record<string, unknown>)[k] = Array.isArray(v) ? v : template[k];
          }
          out.shifts = (out.shifts as Shift[]).map((s) => {
            const expected =
              s.expected_cash ??
              (s.status === 'closed'
                ? Number((s.start_cash + s.cash_sales - s.cash_expenses).toFixed(2))
                : undefined);
            return { ...s, expected_cash: expected };
          });
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(out));
        } catch {
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(this.seedData()));
        }
      } else {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(this.seedData()));
      }
    }

    this.initialized = true;
  }

  private get schemaSql(): string {
    return `
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, pin_hash TEXT, role TEXT, daily_salary_rate REAL, is_active INTEGER, created_at TEXT, updated_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, created_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, category_id TEXT, price REAL, cost_price REAL, image TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, receipt_number TEXT, user_id TEXT, shift_id TEXT, total_amount REAL, discount REAL, payment_method TEXT, primary_account_id TEXT, created_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS sale_items (id TEXT PRIMARY KEY, sale_id TEXT, product_id TEXT, quantity REAL, price REAL, total REAL, cost_total REAL, created_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS shifts (id TEXT PRIMARY KEY, user_id TEXT, account_id TEXT, start_cash REAL, open_comment TEXT, expected_cash REAL, end_cash REAL, opened_at TEXT, closed_at TEXT, status TEXT, cash_sales REAL, card_sales REAL, transfer_sales REAL, cash_expenses REAL, difference REAL, salary_amount REAL, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, category_id TEXT, amount REAL, payment_method TEXT, account_id TEXT, comment TEXT, image TEXT, user_id TEXT, shift_id TEXT, expense_date TEXT, is_deleted INTEGER, created_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS expense_categories (id TEXT PRIMARY KEY, name TEXT, type TEXT, is_active INTEGER, created_at TEXT);
      CREATE TABLE IF NOT EXISTS recurring_expenses (id TEXT PRIMARY KEY, category_id TEXT, amount REAL, frequency TEXT, start_date TEXT, end_date TEXT, last_generated_at TEXT, is_active INTEGER);
      CREATE TABLE IF NOT EXISTS stock_items (id TEXT PRIMARY KEY, name TEXT, category TEXT, unit TEXT, quantity REAL, min_quantity REAL, purchase_price REAL, average_cost REAL, supplier TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, stock_item_id TEXT, type TEXT, quantity REAL, unit TEXT, amount REAL, reason TEXT, comment TEXT, sale_id TEXT, expense_id TEXT, shift_id TEXT, user_id TEXT, created_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY, product_id TEXT, stock_item_id TEXT, quantity REAL, unit TEXT, created_at TEXT, updated_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS inventory_checks (id TEXT PRIMARY KEY, user_id TEXT, comment TEXT, created_at TEXT, updated_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS inventory_check_items (id TEXT PRIMARY KEY, inventory_check_id TEXT, stock_item_id TEXT, system_quantity REAL, actual_quantity REAL, difference REAL, unit TEXT, created_at TEXT);
      CREATE TABLE IF NOT EXISTS salary_settings (id TEXT PRIMARY KEY, daily_rate REAL, allow_double_shift_payment INTEGER, create_expense_on_payout INTEGER, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS salary_transactions (id TEXT PRIMARY KEY, user_id TEXT, shift_id TEXT, type TEXT, amount REAL, payment_method TEXT, comment TEXT, created_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS payroll_periods (id TEXT PRIMARY KEY, user_id TEXT, period_start TEXT, period_end TEXT, worked_days REAL, base_salary REAL, bonus_total REAL, penalty_total REAL, payout_total REAL, final_salary REAL, balance REAL, status TEXT, created_at TEXT, updated_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance REAL, is_active INTEGER, created_at TEXT, updated_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS account_transactions (id TEXT PRIMARY KEY, account_id TEXT, type TEXT, amount REAL, direction TEXT, reference_type TEXT, reference_id TEXT, from_account_id TEXT, to_account_id TEXT, shift_id TEXT, user_id TEXT, comment TEXT, created_at TEXT, sync_status TEXT);
      CREATE TABLE IF NOT EXISTS conflict_logs (id TEXT PRIMARY KEY, table_name TEXT, local_id TEXT, server_id TEXT, reason TEXT, created_at TEXT);
    `;
  }

  private getTableTemplate(): TableMap {
    if (!this.tableTemplate) {
      this.tableTemplate = this.seedData();
    }
    return this.tableTemplate;
  }

  private read(): TableMap {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      return this.seedData();
    }
    const parsed = JSON.parse(raw) as Partial<TableMap>;
    const template = this.getTableTemplate();
    const out = {} as TableMap;
    for (const k of Object.keys(template) as Array<keyof TableMap>) {
      const v = parsed[k];
      (out as Record<string, unknown>)[k] = Array.isArray(v) ? v : template[k];
    }
    return out;
  }

  private write(db: TableMap): void {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  }

  async table<T extends TableName>(table: T): Promise<TableMap[T]> {
    await this.initialize();
    const rows = this.read()[table];
    const fallback = this.getTableTemplate()[table];
    return (Array.isArray(rows) ? rows : fallback) as TableMap[T];
  }

  async saveTable<T extends TableName>(table: T, rows: TableMap[T]): Promise<void> {
    await this.initialize();
    const db = this.read();
    db[table] = rows;
    this.write(db);
  }

  async insert<T extends TableName>(table: T, row: TableMap[T][number]): Promise<void> {
    const rows = (await this.table(table)) as Array<TableMap[T][number]>;
    rows.push(row);
    await this.saveTable(table, rows as TableMap[T]);
  }

  async upsert<T extends TableName>(table: T, row: TableMap[T][number] & { id: string }): Promise<void> {
    const rows = (await this.table(table)) as Array<TableMap[T][number] & { id: string }>;
    const idx = rows.findIndex((item: { id: string }) => item.id === row.id);
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    await this.saveTable(table, rows as TableMap[T]);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T][number]>): Promise<void> {
    const rows = (await this.table(table)) as Array<TableMap[T][number] & { id: string; updated_at?: string }>;
    const idx = rows.findIndex((item: { id: string }) => item.id === id);
    if (idx < 0) return;
    rows[idx] = {
      ...rows[idx],
      ...patch,
      updated_at: NOW()
    };
    await this.saveTable(table, rows as TableMap[T]);
  }

  makeId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  now(): string {
    return NOW();
  }

  private seedData(): TableMap {
    const createdAt = NOW();
    const categories: Category[] = [
      { id: 'cat_ice', name: 'Мороженое', created_at: createdAt, sync_status: 'synced' },
      { id: 'cat_top', name: 'Топпинги', created_at: createdAt, sync_status: 'synced' },
      { id: 'cat_drink', name: 'Напитки', created_at: createdAt, sync_status: 'synced' }
    ];

    const stockItems: StockItem[] = [
      { id: 'stock_milk', name: 'Молоко', category: 'Сырьё', unit: 'л', quantity: 0, min_quantity: 10, purchase_price: 6, average_cost: 5.8, supplier: 'Бозор', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_cream', name: 'Сливки', category: 'Сырьё', unit: 'л', quantity: 0, min_quantity: 5, purchase_price: 12, average_cost: 11.5, supplier: 'Бозор', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_sugar', name: 'Сахар', category: 'Сырьё', unit: 'кг', quantity: 0, min_quantity: 8, purchase_price: 7, average_cost: 6.8, supplier: 'Бозор', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_vmix', name: 'Готовая ванильная смесь', category: 'Сырьё', unit: 'л', quantity: 0, min_quantity: 1.5, purchase_price: 20, average_cost: 18.5, supplier: 'Цех', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_cmix', name: 'Готовая шоколадная смесь', category: 'Сырьё', unit: 'л', quantity: 0, min_quantity: 1.5, purchase_price: 22, average_cost: 20.5, supplier: 'Цех', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_cup', name: 'Стаканчики', category: 'Упаковка', unit: 'шт', quantity: 0, min_quantity: 120, purchase_price: 0.3, average_cost: 0.28, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_horn', name: 'Рожки', category: 'Упаковка', unit: 'шт', quantity: 0, min_quantity: 80, purchase_price: 0.5, average_cost: 0.48, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_spoon', name: 'Ложки', category: 'Упаковка', unit: 'шт', quantity: 0, min_quantity: 100, purchase_price: 0.1, average_cost: 0.09, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_napkin', name: 'Салфетки', category: 'Упаковка', unit: 'шт', quantity: 0, min_quantity: 100, purchase_price: 0.05, average_cost: 0.04, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_lid', name: 'Крышки', category: 'Упаковка', unit: 'шт', quantity: 0, min_quantity: 80, purchase_price: 0.2, average_cost: 0.18, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_bag', name: 'Пакеты', category: 'Упаковка', unit: 'шт', quantity: 0, min_quantity: 60, purchase_price: 0.15, average_cost: 0.14, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_topping', name: 'Топпинг', category: 'Дополнительно', unit: 'л', quantity: 0, min_quantity: 1, purchase_price: 15, average_cost: 14.2, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_syrup', name: 'Сироп', category: 'Дополнительно', unit: 'л', quantity: 0, min_quantity: 1, purchase_price: 14, average_cost: 13.5, supplier: 'Опт', is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' }
    ];

    const products: Product[] = [
      { id: 'prod_van', name: 'Ваниль', category_id: 'cat_ice', price: 5, cost_price: 2.4, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'prod_choc', name: 'Шоколад', category_id: 'cat_ice', price: 5, cost_price: 2.5, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'prod_mix', name: 'Микс', category_id: 'cat_ice', price: 6, cost_price: 2.7, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'prod_horn', name: 'Рожок', category_id: 'cat_top', price: 2, cost_price: 0.5, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'prod_topping', name: 'Топпинг', category_id: 'cat_top', price: 2, cost_price: 0.7, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'prod_drink', name: 'Напиток', category_id: 'cat_drink', price: 5, cost_price: 2, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' }
    ];

    const recipes: Recipe[] = [
      { id: 'rec_van_1', product_id: 'prod_van', stock_item_id: 'stock_vmix', quantity: 120, unit: 'мл', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_van_2', product_id: 'prod_van', stock_item_id: 'stock_cup', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_van_3', product_id: 'prod_van', stock_item_id: 'stock_spoon', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_van_4', product_id: 'prod_van', stock_item_id: 'stock_napkin', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_choc_1', product_id: 'prod_choc', stock_item_id: 'stock_cmix', quantity: 120, unit: 'мл', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_choc_2', product_id: 'prod_choc', stock_item_id: 'stock_cup', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_choc_3', product_id: 'prod_choc', stock_item_id: 'stock_spoon', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_choc_4', product_id: 'prod_choc', stock_item_id: 'stock_napkin', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_mix_1', product_id: 'prod_mix', stock_item_id: 'stock_vmix', quantity: 60, unit: 'мл', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_mix_2', product_id: 'prod_mix', stock_item_id: 'stock_cmix', quantity: 60, unit: 'мл', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_mix_3', product_id: 'prod_mix', stock_item_id: 'stock_cup', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_mix_4', product_id: 'prod_mix', stock_item_id: 'stock_spoon', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'rec_mix_5', product_id: 'prod_mix', stock_item_id: 'stock_napkin', quantity: 1, unit: 'шт', created_at: createdAt, updated_at: createdAt, sync_status: 'synced' }
    ];

    const users: User[] = [
      {
        id: 'user_admin',
        name: 'Админ',
        phone: '+992000000001',
        pin_hash: '1111',
        role: 'admin',
        daily_salary_rate: 45,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
        sync_status: 'synced'
      },
      {
        id: 'user_ali',
        name: 'Али',
        phone: '+992000000002',
        pin_hash: '1234',
        role: 'cashier',
        daily_salary_rate: 45,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
        sync_status: 'synced'
      }
    ];

    const expenseCategories: ExpenseCategory[] = [
      { id: 'exp_milk', name: 'Молоко', type: 'variable', is_active: true, created_at: createdAt },
      { id: 'exp_mix', name: 'Сухая смесь', type: 'variable', is_active: true, created_at: createdAt },
      { id: 'exp_cups', name: 'Стаканчики', type: 'variable', is_active: true, created_at: createdAt },
      { id: 'exp_salary', name: 'Зарплата', type: 'fixed', is_active: true, created_at: createdAt },
      { id: 'exp_rent', name: 'Аренда', type: 'fixed', is_active: true, created_at: createdAt },
      { id: 'exp_internet', name: 'Интернет', type: 'fixed', is_active: true, created_at: createdAt },
      { id: 'exp_ad', name: 'Реклама', type: 'one_time', is_active: true, created_at: createdAt },
      { id: 'exp_repair', name: 'Ремонт', type: 'one_time', is_active: true, created_at: createdAt }
    ];

    const recurringExpenses: RecurringExpense[] = [
      {
        id: 'rec_exp_rent',
        category_id: 'exp_rent',
        amount: 3000,
        frequency: 'monthly',
        start_date: createdAt.slice(0, 10),
        is_active: true,
        last_generated_at: createdAt.slice(0, 10)
      },
      {
        id: 'rec_exp_internet',
        category_id: 'exp_internet',
        amount: 150,
        frequency: 'monthly',
        start_date: createdAt.slice(0, 10),
        is_active: true,
        last_generated_at: createdAt.slice(0, 10)
      }
    ];

    const accounts: Account[] = [
      {
        id: 'acc_register_1',
        name: 'Касса точки №1',
        type: 'cash_register',
        balance: 0,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
        sync_status: 'synced'
      },
      {
        id: 'acc_safe',
        name: 'Сейф',
        type: 'safe',
        balance: 0,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
        sync_status: 'synced'
      },
      {
        id: 'acc_owner',
        name: 'Деньги у владельца',
        type: 'owner',
        balance: 0,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
        sync_status: 'synced'
      }
    ];

    return {
      users,
      categories,
      products,
      sales: [],
      sale_items: [],
      shifts: [],
      expenses: [],
      expense_categories: expenseCategories,
      recurring_expenses: recurringExpenses,
      stock_items: stockItems,
      stock_movements: [],
      recipes,
      inventory_checks: [],
      inventory_check_items: [],
      salary_settings: [
        {
          id: 'salary_default',
          daily_rate: 45,
          allow_double_shift_payment: false,
          create_expense_on_payout: true,
          created_at: createdAt,
          updated_at: createdAt
        }
      ],
      salary_transactions: [],
      payroll_periods: [],
      accounts,
      account_transactions: [],
      conflict_logs: []
    };
  }
}

export const dbService = new DbService();
