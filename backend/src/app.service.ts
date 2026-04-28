import { Injectable } from '@nestjs/common';
import {
  Account,
  AccountTransaction,
  Category,
  Expense,
  ExpenseCategory,
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
  User
} from './types';

type SyncPushPayload = {
  sales?: Sale[];
  sale_items?: SaleItem[];
  expenses?: Expense[];
  shifts?: Shift[];
  stock_movements?: Array<Record<string, unknown>>;
  salary_transactions?: SalaryTransaction[];
  accounts?: Account[];
  account_transactions?: AccountTransaction[];
};

@Injectable()
export class AppService {
  private readonly now = () => new Date().toISOString();
  private readonly users: User[] = [];
  private readonly categories: Category[] = [];
  private readonly products: Product[] = [];
  private readonly sales: Sale[] = [];
  private readonly saleItems: SaleItem[] = [];
  private readonly shifts: Shift[] = [];
  private readonly expenses: Expense[] = [];
  private readonly expenseCategories: ExpenseCategory[] = [];
  private readonly recurringExpenses: RecurringExpense[] = [];
  private readonly stockItems: StockItem[] = [];
  private readonly recipes: Recipe[] = [];
  private readonly salarySettings: SalarySettings[] = [];
  private readonly salaryTransactions: SalaryTransaction[] = [];
  private readonly payrollPeriods: PayrollPeriod[] = [];
  private readonly accounts: Account[] = [];
  private readonly accountTransactions: AccountTransaction[] = [];

  constructor() {
    const createdAt = this.now();
    this.users.push(
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
    );
    this.categories.push(
      { id: 'cat_ice', name: 'Мороженое', created_at: createdAt, sync_status: 'synced' },
      { id: 'cat_top', name: 'Топпинги', created_at: createdAt, sync_status: 'synced' },
      { id: 'cat_drink', name: 'Напитки', created_at: createdAt, sync_status: 'synced' }
    );
    this.expenseCategories.push(
      { id: 'exp_milk', name: 'Молоко', type: 'variable', is_active: true, created_at: createdAt },
      { id: 'exp_rent', name: 'Аренда', type: 'fixed', is_active: true, created_at: createdAt },
      { id: 'exp_salary', name: 'Зарплата', type: 'fixed', is_active: true, created_at: createdAt },
      { id: 'exp_repair', name: 'Ремонт', type: 'one_time', is_active: true, created_at: createdAt }
    );
    this.recurringExpenses.push(
      { id: 're_rent', category_id: 'exp_rent', amount: 3000, frequency: 'monthly', start_date: createdAt.slice(0, 10), is_active: true, last_generated_at: createdAt.slice(0, 10) }
    );
    this.products.push(
      { id: 'prod_van', name: 'Ваниль', category_id: 'cat_ice', price: 5, cost_price: 2.4, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'prod_choc', name: 'Шоколад', category_id: 'cat_ice', price: 5, cost_price: 2.5, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'prod_mix', name: 'Микс', category_id: 'cat_ice', price: 6, cost_price: 2.7, is_active: true, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' }
    );
    this.stockItems.push(
      { id: 'stock_vmix', name: 'Ванильная смесь', unit: 'мл', quantity: 0, min_quantity: 1500, purchase_price: 0.02, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' },
      { id: 'stock_cmix', name: 'Шоколадная смесь', unit: 'мл', quantity: 0, min_quantity: 1500, purchase_price: 0.023, created_at: createdAt, updated_at: createdAt, sync_status: 'synced' }
    );
    this.recipes.push(
      { id: 'rec_van_1', product_id: 'prod_van', stock_item_id: 'stock_vmix', quantity: 120, unit: 'мл', created_at: createdAt, sync_status: 'synced' },
      { id: 'rec_choc_1', product_id: 'prod_choc', stock_item_id: 'stock_cmix', quantity: 120, unit: 'мл', created_at: createdAt, sync_status: 'synced' }
    );
    this.salarySettings.push({
      id: 'salary_default',
      daily_rate: 45,
      allow_double_shift_payment: false,
      create_expense_on_payout: true,
      created_at: createdAt,
      updated_at: createdAt
    });
    this.accounts.push(
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
    );
  }

  getAccounts(): Account[] {
    return this.accounts;
  }

  createAccount(payload: Record<string, unknown>): Account {
    const now = this.now();
    const row: Account = {
      id: (payload.id as string | undefined) ?? `acc_${Math.random().toString(36).slice(2, 10)}`,
      name: String(payload.name ?? 'Счёт'),
      type: (payload.type as Account['type']) ?? 'other',
      balance: Number(payload.balance ?? 0),
      is_active: Boolean(payload.is_active ?? true),
      created_at: now,
      updated_at: now,
      sync_status: 'synced'
    };
    this.accounts.push(row);
    return row;
  }

  updateAccount(id: string, payload: Record<string, unknown>): Account | null {
    const row = this.accounts.find((a) => a.id === id);
    if (!row) return null;
    Object.assign(row, payload as Partial<Account>, { updated_at: this.now() });
    return row;
  }

  deleteAccount(id: string): { ok: boolean; error?: string } {
    if (this.accountTransactions.some((t) => t.account_id === id || t.from_account_id === id || t.to_account_id === id)) {
      return { ok: false, error: 'has_history' };
    }
    const idx = this.accounts.findIndex((a) => a.id === id);
    if (idx < 0) return { ok: false };
    this.accounts.splice(idx, 1);
    return { ok: true };
  }

  getAccountTransactions(): AccountTransaction[] {
    return this.accountTransactions;
  }

  appendAccountTransactions(rows: AccountTransaction[]): void {
    this.accountTransactions.push(...rows.map((r) => ({ ...r, sync_status: 'synced' as const })));
  }

  accountsSummary() {
    const totalBalance = this.accounts.reduce((s, a) => s + a.balance, 0);
    return { accounts: this.accounts, totalBalance };
  }

  accountHistory(accountId: string, query: Record<string, string | undefined>): AccountTransaction[] {
    let rows = this.accountTransactions.filter((t) => t.account_id === accountId);
    const from = query.from;
    const to = query.to;
    if (from) rows = rows.filter((t) => t.created_at.slice(0, 10) >= from);
    if (to) rows = rows.filter((t) => t.created_at.slice(0, 10) <= to);
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  loginByPin(userId: string, pin: string): User | null {
    return this.users.find((u) => u.id === userId && u.pin_hash === pin && u.is_active) ?? null;
  }

  me(userId: string): User | null {
    return this.users.find((u) => u.id === userId) ?? null;
  }

  getUsers(): User[] {
    return this.users;
  }

  createUser(payload: Record<string, unknown>): User {
    const now = this.now();
    const user: User = {
      id: (payload.id as string | undefined) ?? `user_${Math.random().toString(36).slice(2, 10)}`,
      name: (payload.name as string | undefined) ?? 'Новый',
      phone: (payload.phone as string | undefined) ?? '',
      pin_hash: (payload.pin_hash as string | undefined) ?? '0000',
      role: (payload.role as User['role'] | undefined) ?? 'cashier',
      daily_salary_rate: (payload.daily_salary_rate as number | undefined) ?? 45,
      is_active: (payload.is_active as boolean | undefined) ?? true,
      created_at: now,
      updated_at: now,
      sync_status: 'synced'
    };
    this.users.push(user);
    return user;
  }

  updateUser(id: string, payload: Record<string, unknown>): User | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, payload as Partial<User>, { updated_at: this.now() });
    return user;
  }

  deleteUser(id: string): { ok: boolean } {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx < 0) return { ok: false };
    this.users.splice(idx, 1);
    return { ok: true };
  }

  getProducts(): Product[] {
    return this.products;
  }

  createProduct(payload: Record<string, unknown>): Product {
    const now = this.now();
    const product: Product = {
      id: (payload.id as string | undefined) ?? `prod_${Math.random().toString(36).slice(2, 10)}`,
      name: (payload.name as string | undefined) ?? 'Товар',
      category_id: (payload.category_id as string | undefined) ?? this.categories[0]?.id ?? 'cat_ice',
      price: (payload.price as number | undefined) ?? 0,
      cost_price: (payload.cost_price as number | undefined) ?? 0,
      image: payload.image as string | undefined,
      is_active: (payload.is_active as boolean | undefined) ?? true,
      created_at: now,
      updated_at: now,
      sync_status: 'synced'
    };
    this.products.push(product);
    return product;
  }

  updateProduct(id: string, payload: Record<string, unknown>): Product | null {
    const product = this.products.find((p) => p.id === id);
    if (!product) return null;
    Object.assign(product, payload as Partial<Product>, { updated_at: this.now() });
    return product;
  }

  deleteProduct(id: string): { ok: boolean } {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx < 0) return { ok: false };
    this.products.splice(idx, 1);
    return { ok: true };
  }

  getSales(): Sale[] {
    return this.sales;
  }

  getSaleById(id: string): { sale: Sale | null; items: SaleItem[] } {
    const sale = this.sales.find((s) => s.id === id) ?? null;
    const items = this.saleItems.filter((si) => si.sale_id === id);
    return { sale, items };
  }

  createSale(payload: { sale: Record<string, unknown>; items: Array<Record<string, unknown>> }): Sale {
    const sale = payload.sale as unknown as Sale;
    const items = payload.items as unknown as SaleItem[];
    this.sales.push({ ...sale, sync_status: 'synced' as const });
    this.saleItems.push(...items.map((i) => ({ ...i, sync_status: 'synced' as const })));
    return sale;
  }

  getCurrentShift(userId?: string): Shift | null {
    const open = this.shifts.find((s) => s.status === 'open' && (!userId || s.user_id === userId));
    return open ?? null;
  }

  getShifts(): Shift[] {
    return this.shifts;
  }

  openShift(payload: Record<string, unknown>): Shift {
    const shift = { ...(payload as unknown as Shift), sync_status: 'synced' as const };
    this.shifts.push(shift);
    return shift;
  }

  closeShift(payload: Record<string, unknown>): Shift {
    const shift = payload as unknown as Shift;
    const idx = this.shifts.findIndex((s) => s.id === shift.id);
    if (idx >= 0) this.shifts[idx] = { ...shift, sync_status: 'synced' as const };
    else this.shifts.push({ ...shift, sync_status: 'synced' as const });
    return shift;
  }

  getExpenses(): Expense[] {
    return this.expenses.filter((e) => !e.is_deleted);
  }

  createExpense(payload: Record<string, unknown>): Expense {
    const expense = { ...(payload as unknown as Expense), is_deleted: false, sync_status: 'synced' as const };
    this.expenses.push(expense);
    return expense;
  }

  updateExpense(id: string, payload: Record<string, unknown>): Expense | null {
    const expense = this.expenses.find((e) => e.id === id);
    if (!expense) return null;
    Object.assign(expense, payload as Partial<Expense>);
    return expense;
  }

  deleteExpense(id: string): { ok: boolean } {
    const row = this.expenses.find((e) => e.id === id);
    if (!row) return { ok: false };
    row.is_deleted = true;
    return { ok: true };
  }

  getExpenseCategories() {
    return this.expenseCategories.filter((c) => c.is_active);
  }

  createExpenseCategory(payload: Record<string, unknown>) {
    const row: ExpenseCategory = {
      id: `exp_cat_${Math.random().toString(36).slice(2, 10)}`,
      name: String(payload.name ?? 'Категория'),
      type: (payload.type as ExpenseCategory['type']) ?? 'variable',
      is_active: true,
      created_at: this.now()
    };
    this.expenseCategories.push(row);
    return row;
  }

  getRecurringExpenses() {
    return this.recurringExpenses;
  }

  createRecurringExpense(payload: Record<string, unknown>) {
    const row: RecurringExpense = {
      id: `rec_exp_${Math.random().toString(36).slice(2, 10)}`,
      category_id: String(payload.category_id ?? ''),
      amount: Number(payload.amount ?? 0),
      frequency: (payload.frequency as RecurringExpense['frequency']) ?? 'monthly',
      start_date: String(payload.start_date ?? this.now().slice(0, 10)),
      end_date: payload.end_date ? String(payload.end_date) : undefined,
      last_generated_at: payload.last_generated_at ? String(payload.last_generated_at) : undefined,
      is_active: Boolean(payload.is_active ?? true)
    };
    this.recurringExpenses.push(row);
    return row;
  }

  getStock() {
    return this.stockItems;
  }

  stockIncome(payload: { stock_item_id: string; quantity: number; amount: number }) {
    const item = this.stockItems.find((s) => s.id === payload.stock_item_id);
    if (!item) return null;
    item.quantity += payload.quantity;
    item.updated_at = this.now();
    return item;
  }

  stockWriteOff(payload: { stock_item_id: string; quantity: number }) {
    const item = this.stockItems.find((s) => s.id === payload.stock_item_id);
    if (!item) return null;
    item.quantity -= payload.quantity;
    item.updated_at = this.now();
    return item;
  }

  stockInventory(payload: { stock_item_id: string; quantity: number }) {
    const item = this.stockItems.find((s) => s.id === payload.stock_item_id);
    if (!item) return null;
    item.quantity = payload.quantity;
    item.updated_at = this.now();
    return item;
  }

  stockMovements() {
    return [];
  }

  getSalary(userId?: string, periodStart?: string, periodEnd?: string) {
    const base = userId ? this.salaryTransactions.filter((s) => s.user_id === userId) : this.salaryTransactions;
    if (!periodStart || !periodEnd) return base;
    return base.filter((s) => {
      const day = s.created_at.slice(0, 10);
      return day >= periodStart && day <= periodEnd;
    });
  }

  addSalaryTx(payload: Record<string, unknown>): SalaryTransaction {
    const tx = { ...(payload as unknown as SalaryTransaction), sync_status: 'synced' as const };
    this.salaryTransactions.push(tx);
    return tx;
  }

  getDailyReport(date: string) {
    const sales = this.sales.filter((s) => s.created_at.startsWith(date));
    const saleIds = new Set(sales.map((s) => s.id));
    const items = this.saleItems.filter((i) => saleIds.has(i.sale_id));
    const expenses = this.expenses.filter((e) => e.expense_date === date);
    const salary = this.salaryTransactions.filter((s) => s.created_at.startsWith(date));
    const revenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const cogs = items.reduce((sum, i) => sum + i.cost_total, 0);
    const exp = expenses.reduce((sum, e) => sum + e.amount, 0);
    const sal = salary.reduce((sum, s) => sum + s.amount, 0);
    return {
      date,
      sales: revenue,
      cogs,
      expenses: exp,
      salary: sal,
      net_profit: revenue - cogs - exp - sal
    };
  }

  getPeriodReport(periodStart: string, periodEnd: string) {
    const sales = this.sales.filter((s) => {
      const d = s.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    const saleIds = new Set(sales.map((s) => s.id));
    const items = this.saleItems.filter((i) => saleIds.has(i.sale_id));
    const expenses = this.expenses.filter((e) => e.expense_date >= periodStart && e.expense_date <= periodEnd);
    const salary = this.salaryTransactions.filter((s) => {
      const d = s.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    const totalSales = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const cogs = items.reduce((sum, i) => sum + i.cost_total, 0);
    const exp = expenses.reduce((sum, e) => sum + e.amount, 0);
    const sal = salary.reduce((sum, s) => {
      if (s.type === 'daily_salary' || s.type === 'bonus') return sum + Math.abs(s.amount);
      if (s.type === 'penalty') return sum - Math.abs(s.amount);
      return sum;
    }, 0);
    return { period_start: periodStart, period_end: periodEnd, sales: totalSales, cogs, expenses: exp, salary: sal, net_profit: totalSales - cogs - exp - sal };
  }

  getProductsReport() {
    const counters = new Map<string, { qty: number; revenue: number }>();
    for (const item of this.saleItems) {
      const current = counters.get(item.product_id) ?? { qty: 0, revenue: 0 };
      current.qty += item.quantity;
      current.revenue += item.total;
      counters.set(item.product_id, current);
    }
    return Array.from(counters.entries()).map(([product_id, value]) => ({ product_id, ...value }));
  }

  getExpensesReport() {
    return this.expenses;
  }

  getPaymentsReport(periodStart?: string, periodEnd?: string) {
    const sales = this.sales.filter((s) => {
      if (!periodStart || !periodEnd) return true;
      const d = s.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    return sales.reduce(
      (acc, s) => {
        if (s.payment_method === 'cash') acc.cash += s.total_amount;
        if (s.payment_method === 'card') acc.card += s.total_amount;
        if (s.payment_method === 'transfer') acc.transfer += s.total_amount;
        return acc;
      },
      { cash: 0, card: 0, transfer: 0 }
    );
  }

  getStockReport() {
    return this.stockItems;
  }

  getLossesReport() {
    return [];
  }

  getSalaryReport() {
    return this.salaryTransactions;
  }

  getCashiersReport(periodStart?: string, periodEnd?: string) {
    const sales = this.sales.filter((s) => {
      if (!periodStart || !periodEnd) return true;
      const d = s.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    const grouped = new Map<string, { sales: number; checks: number }>();
    for (const sale of sales) {
      const row = grouped.get(sale.user_id) ?? { sales: 0, checks: 0 };
      row.sales += sale.total_amount;
      row.checks += 1;
      grouped.set(sale.user_id, row);
    }
    return Array.from(grouped.entries()).map(([user_id, row]) => ({
      user_id,
      user_name: this.users.find((u) => u.id === user_id)?.name ?? user_id,
      sales: row.sales,
      checks: row.checks,
      avg_check: row.checks ? row.sales / row.checks : 0
    }));
  }

  getPayroll() {
    return this.payrollPeriods;
  }

  generatePayroll(payload: Record<string, unknown>) {
    const now = this.now();
    const userId = String(payload.user_id ?? '');
    const periodStart = String(payload.period_start ?? now.slice(0, 10));
    const periodEnd = String(payload.period_end ?? now.slice(0, 10));
    const tx = this.salaryTransactions.filter((s) => {
      if (s.user_id !== userId) return false;
      const day = s.created_at.slice(0, 10);
      return day >= periodStart && day <= periodEnd;
    });
    const baseSalary = tx.filter((s) => s.type === 'daily_salary').reduce((sum, s) => sum + Math.abs(s.amount), 0);
    const bonusTotal = tx.filter((s) => s.type === 'bonus').reduce((sum, s) => sum + Math.abs(s.amount), 0);
    const penaltyTotal = tx.filter((s) => s.type === 'penalty').reduce((sum, s) => sum + Math.abs(s.amount), 0);
    const payoutTotal = tx.filter((s) => s.type === 'payout').reduce((sum, s) => sum + Math.abs(s.amount), 0);
    const finalSalary = baseSalary + bonusTotal - penaltyTotal;
    const balance = finalSalary - payoutTotal;
    const workedDays = tx.filter((s) => s.type === 'daily_salary').length;

    const row: PayrollPeriod = {
      id: `payroll_${Math.random().toString(36).slice(2, 10)}`,
      user_id: userId,
      period_start: periodStart,
      period_end: periodEnd,
      worked_days: workedDays,
      base_salary: baseSalary,
      bonus_total: bonusTotal,
      penalty_total: penaltyTotal,
      payout_total: payoutTotal,
      final_salary: finalSalary,
      balance,
      status: balance <= 0 ? 'paid' : payoutTotal > 0 ? 'partially_paid' : 'open',
      created_at: now,
      updated_at: now,
      sync_status: 'synced'
    };
    this.payrollPeriods.push(row);
    return row;
  }

  payrollPay(payrollId: string, payload: Record<string, unknown>) {
    const row = this.payrollPeriods.find((p) => p.id === payrollId);
    if (!row) return null;
    const amount = Number(payload.amount ?? 0);
    this.salaryTransactions.push({
      id: `sal_${Math.random().toString(36).slice(2, 10)}`,
      user_id: row.user_id,
      type: 'payout',
      amount,
      payment_method: (payload.payment_method as 'cash' | 'card' | 'transfer') ?? 'cash',
      comment: String(payload.comment ?? ''),
      created_at: this.now(),
      sync_status: 'synced'
    });
    row.payout_total += Math.abs(amount);
    row.balance = row.final_salary - row.payout_total;
    row.status = row.balance <= 0 ? 'paid' : 'partially_paid';
    row.updated_at = this.now();
    return row;
  }

  getProfitReport() {
    const revenue = this.sales.reduce((s, r) => s + r.total_amount, 0);
    const cogs = this.saleItems.reduce((s, r) => s + r.cost_total, 0);
    const expenses = this.expenses.reduce((s, r) => s + r.amount, 0);
    const salary = this.salaryTransactions.reduce((s, r) => s + r.amount, 0);
    return { revenue, cogs, expenses, salary, net_profit: revenue - cogs - expenses - salary };
  }

  syncPush(payload: Record<string, unknown>) {
    const pushPayload = payload as SyncPushPayload;
    let accepted = 0;
    if (pushPayload.sales?.length) {
      this.sales.push(...pushPayload.sales.map((s) => ({ ...s, sync_status: 'synced' as const })));
      accepted += pushPayload.sales.length;
    }
    if (pushPayload.sale_items?.length) {
      this.saleItems.push(...pushPayload.sale_items.map((s) => ({ ...s, sync_status: 'synced' as const })));
      accepted += pushPayload.sale_items.length;
    }
    if (pushPayload.expenses?.length) {
      this.expenses.push(...pushPayload.expenses.map((s) => ({ ...s, sync_status: 'synced' as const })));
      accepted += pushPayload.expenses.length;
    }
    if (pushPayload.shifts?.length) {
      this.shifts.push(...pushPayload.shifts.map((s) => ({ ...s, sync_status: 'synced' as const })));
      accepted += pushPayload.shifts.length;
    }
    if (pushPayload.salary_transactions?.length) {
      this.salaryTransactions.push(...pushPayload.salary_transactions.map((s) => ({ ...s, sync_status: 'synced' as const })));
      accepted += pushPayload.salary_transactions.length;
    }
    if (pushPayload.accounts?.length) {
      for (const a of pushPayload.accounts) {
        const idx = this.accounts.findIndex((x) => x.id === a.id);
        if (idx >= 0) this.accounts[idx] = { ...a, sync_status: 'synced' as const };
        else this.accounts.push({ ...a, sync_status: 'synced' as const });
      }
      accepted += pushPayload.accounts.length;
    }
    if (pushPayload.account_transactions?.length) {
      this.accountTransactions.push(...pushPayload.account_transactions.map((t) => ({ ...t, sync_status: 'synced' as const })));
      accepted += pushPayload.account_transactions.length;
    }
    return { accepted };
  }

  syncPull() {
    return {
      products: this.products,
      categories: this.categories,
      users: this.users,
      stock_items: this.stockItems,
      recipes: this.recipes,
      salary_settings: this.salarySettings,
      expense_categories: this.expenseCategories,
      recurring_expenses: this.recurringExpenses,
      accounts: this.accounts,
      settings: { daily_salary_rate: 45 }
    };
  }

  syncFull(payload: Record<string, unknown>) {
    const pushed = this.syncPush(payload);
    const pulled = this.syncPull();
    return { pushed, pulled };
  }
}
