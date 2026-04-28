import { dbService } from './db.service';
import { Expense, StockItem } from '../types/models';

export interface DailyReport {
  totalSales: number;
  cogs: number;
  totalExpenses: number;
  totalSalary: number;
  grossProfit: number;
  netProfit: number;
  payments: { cash: number; card: number; transfer: number };
  checksCount: number;
  avgCheck: number;
}

export interface ProductReportRow {
  product_id: string;
  name: string;
  quantity: number;
  sales: number;
  cogs: number;
  profit: number;
}

export interface ExpenseReport {
  rows: Expense[];
  byCategory: Array<{ category_id: string; amount: number }>;
}

export interface StockReport {
  items: StockItem[];
  low: StockItem[];
}

export interface LossReportRow {
  stock_item_id: string;
  name: string;
  quantity: number;
  unit: string;
  reason: string;
  amount: number;
}

export interface ReportAlert {
  type: 'sales_drop' | 'low_stock' | 'high_expenses' | 'low_profit';
  message: string;
}

class ReportService {
  private dayCache: Map<string, DailyReport> = new Map();

  private salaryCost(transactions: Array<{ type: string; amount: number }>): number {
    return transactions.reduce((sum, tx) => {
      if (tx.type === 'daily_salary' || tx.type === 'bonus') return sum + Math.abs(tx.amount);
      if (tx.type === 'penalty') return sum - Math.abs(tx.amount);
      return sum;
    }, 0);
  }

  async daily(dateStr: string): Promise<DailyReport> {
    if (this.dayCache.has(dateStr)) return this.dayCache.get(dateStr)!;

    const sales = (await dbService.table('sales')).filter((s) => s.created_at.startsWith(dateStr));
    const saleItems = await dbService.table('sale_items');
    const expenses = (await dbService.table('expenses')).filter((e) => e.expense_date === dateStr && !e.is_deleted);
    const salaryTransactions = (await dbService.table('salary_transactions')).filter((t) => t.created_at.startsWith(dateStr));

    const saleIds = new Set(sales.map((s) => s.id));
    const items = saleItems.filter((i) => saleIds.has(i.sale_id));
    const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const cogs = items.reduce((sum, i) => sum + i.cost_total, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalSalary = this.salaryCost(salaryTransactions);
    const grossProfit = totalSales - cogs;
    const netProfit = totalSales - cogs - totalExpenses - totalSalary;

    const payments = sales.reduce(
      (acc, sale) => {
        if (sale.payment_method === 'mixed' && sale.payment_breakdown) {
          acc.cash += sale.payment_breakdown.cash || 0;
          acc.card += sale.payment_breakdown.card || 0;
          acc.transfer += sale.payment_breakdown.transfer || 0;
        } else if (sale.payment_method === 'cash') acc.cash += sale.total_amount;
        else if (sale.payment_method === 'card') acc.card += sale.total_amount;
        else if (sale.payment_method === 'transfer') acc.transfer += sale.total_amount;
        return acc;
      },
      { cash: 0, card: 0, transfer: 0 }
    );

    const checksCount = sales.length;
    const avgCheck = checksCount ? totalSales / checksCount : 0;

    const result = {
      totalSales,
      cogs,
      totalExpenses,
      totalSalary,
      grossProfit,
      netProfit,
      payments,
      checksCount,
      avgCheck
    };

    this.dayCache.set(dateStr, result);
    return result;
  }

  async period(periodStart: string, periodEnd: string): Promise<{ periodStart: string; periodEnd: string; totalSales: number; cogs: number; totalExpenses: number; totalSalary: number; netProfit: number }> {
    const sales = (await dbService.table('sales')).filter((s) => {
      const d = s.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    const saleIds = new Set(sales.map((s) => s.id));
    const saleItems = (await dbService.table('sale_items')).filter((i) => saleIds.has(i.sale_id));
    const expenses = (await dbService.table('expenses')).filter((e) => !e.is_deleted && e.expense_date >= periodStart && e.expense_date <= periodEnd);
    const salary = (await dbService.table('salary_transactions')).filter((t) => {
      const d = t.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });

    const totalSales = sales.reduce((s, r) => s + r.total_amount, 0);
    const cogs = saleItems.reduce((s, r) => s + r.cost_total, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
    const totalSalary = this.salaryCost(salary);
    const netProfit = totalSales - cogs - totalExpenses - totalSalary;

    return { periodStart, periodEnd, totalSales, cogs, totalExpenses, totalSalary, netProfit };
  }

  async products(periodStart: string, periodEnd: string): Promise<ProductReportRow[]> {
    const products = await dbService.table('products');
    const sales = (await dbService.table('sales')).filter((s) => {
      const d = s.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    const saleIds = new Set(sales.map((s) => s.id));
    const items = (await dbService.table('sale_items')).filter((i) => saleIds.has(i.sale_id));
    const map = new Map<string, { qty: number; revenue: number; cogs: number }>();
    for (const item of items) {
      const curr = map.get(item.product_id) ?? { qty: 0, revenue: 0, cogs: 0 };
      curr.qty += item.quantity;
      curr.revenue += item.total;
      curr.cogs += item.cost_total;
      map.set(item.product_id, curr);
    }
    return Array.from(map.entries()).map(([productId, row]) => ({
      product_id: productId,
      name: products.find((p) => p.id === productId)?.name ?? productId,
      quantity: row.qty,
      sales: row.revenue,
      cogs: row.cogs,
      profit: row.revenue - row.cogs
    }));
  }

  async payments(periodStart: string, periodEnd: string): Promise<{ cash: number; card: number; transfer: number }> {
    const sales = (await dbService.table('sales')).filter((s) => {
      const d = s.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    const totals = { cash: 0, card: 0, transfer: 0 };
    for (const sale of sales) {
      if (sale.payment_method === 'mixed' && sale.payment_breakdown) {
        totals.cash += sale.payment_breakdown.cash || 0;
        totals.card += sale.payment_breakdown.card || 0;
        totals.transfer += sale.payment_breakdown.transfer || 0;
      } else if (sale.payment_method === 'cash') totals.cash += sale.total_amount;
      else if (sale.payment_method === 'card') totals.card += sale.total_amount;
      else if (sale.payment_method === 'transfer') totals.transfer += sale.total_amount;
    }
    return totals;
  }

  async expenses(periodStart: string, periodEnd: string, categoryId?: string, userId?: string): Promise<ExpenseReport> {
    const expenses = (await dbService.table('expenses')).filter((e) => {
      if (e.is_deleted) return false;
      if (e.expense_date < periodStart || e.expense_date > periodEnd) return false;
      if (categoryId && e.category_id !== categoryId) return false;
      if (userId && e.user_id !== userId) return false;
      return true;
    });
    const grouped = new Map<string, number>();
    for (const exp of expenses) {
      grouped.set(exp.category_id, (grouped.get(exp.category_id) ?? 0) + exp.amount);
    }
    return {
      rows: expenses,
      byCategory: Array.from(grouped.entries()).map(([category_id, amount]) => ({ category_id, amount }))
    };
  }

  async stock(): Promise<StockReport> {
    const items = await dbService.table('stock_items');
    const low = items.filter((i) => i.quantity < i.min_quantity);
    return { items, low };
  }

  async losses(periodStart: string, periodEnd: string): Promise<LossReportRow[]> {
    const stockItems = await dbService.table('stock_items');
    const movements = (await dbService.table('stock_movements')).filter((m) => {
      const d = m.created_at.slice(0, 10);
      if (d < periodStart || d > periodEnd) return false;
      if (!['writeoff', 'correction', 'inventory'].includes(m.type)) return false;
      return m.quantity < 0 || m.type === 'writeoff';
    });
    return movements.map((m) => {
      const item = stockItems.find((s) => s.id === m.stock_item_id);
      const lossQty = Math.abs(m.quantity);
      const lossAmount = m.amount || lossQty * (item?.average_cost ?? 0);
      return {
        stock_item_id: m.stock_item_id,
        name: item?.name ?? m.stock_item_id,
        quantity: lossQty,
        unit: m.unit,
        reason: m.reason ?? m.type,
        amount: Number(lossAmount.toFixed(4))
      };
    });
  }

  async salary(periodStart: string, periodEnd: string) {
    const users = await dbService.table('users');
    const tx = (await dbService.table('salary_transactions')).filter((t) => {
      const d = t.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });
    const perUser = new Map<
      string,
      { daily: number; bonus: number; penalty: number; payout: number; workedDays: number }
    >();
    for (const row of tx) {
      const curr = perUser.get(row.user_id) ?? { daily: 0, bonus: 0, penalty: 0, payout: 0, workedDays: 0 };
      if (row.type === 'daily_salary') {
        curr.daily += Math.abs(row.amount);
        curr.workedDays += 1;
      } else if (row.type === 'bonus') curr.bonus += Math.abs(row.amount);
      else if (row.type === 'penalty') curr.penalty += Math.abs(row.amount);
      else if (row.type === 'payout') curr.payout += Math.abs(row.amount);
      perUser.set(row.user_id, curr);
    }
    return Array.from(perUser.entries()).map(([userId, row]) => {
      const final = row.daily + row.bonus - row.penalty;
      return {
        user_id: userId,
        user_name: users.find((u) => u.id === userId)?.name ?? userId,
        worked_days: row.workedDays,
        daily_salary_total: row.daily,
        bonus_total: row.bonus,
        penalty_total: row.penalty,
        payout_total: row.payout,
        final_salary: final,
        balance: final - row.payout
      };
    });
  }

  async cashiers(periodStart: string, periodEnd: string) {
    const users = await dbService.table('users');
    const sales = (await dbService.table('sales')).filter((s) => {
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
    return Array.from(grouped.entries()).map(([userId, row]) => ({
      user_id: userId,
      user_name: users.find((u) => u.id === userId)?.name ?? userId,
      sales: row.sales,
      checks: row.checks,
      avg_check: row.checks ? row.sales / row.checks : 0
    }));
  }

  async profit(periodStart: string, periodEnd: string) {
    const p = await this.period(periodStart, periodEnd);
    return {
      revenue: p.totalSales,
      cogs: p.cogs,
      expenses: p.totalExpenses,
      salary: p.totalSalary,
      net_profit: p.netProfit
    };
  }

  async alerts(periodStart: string, periodEnd: string): Promise<ReportAlert[]> {
    const result: ReportAlert[] = [];
    const today = periodEnd;
    const yesterday = new Date(new Date(periodEnd).getTime() - 86400000).toISOString().slice(0, 10);
    const todayDaily = await this.daily(today);
    const yesterdayDaily = await this.daily(yesterday);
    const stock = await this.stock();
    const period = await this.period(periodStart, periodEnd);

    if (yesterdayDaily.totalSales > 0 && todayDaily.totalSales < yesterdayDaily.totalSales * 0.7) {
      result.push({
        type: 'sales_drop',
        message: `Продажи упали: сегодня ${todayDaily.totalSales.toFixed(2)} смн, вчера ${yesterdayDaily.totalSales.toFixed(2)} смн`
      });
    }
    if (stock.low.length > 0) {
      result.push({
        type: 'low_stock',
        message: `Мало товара: ${stock.low.length} позиций ниже минимума`
      });
    }
    if (period.totalSales > 0 && period.totalExpenses > period.totalSales * 0.35) {
      result.push({
        type: 'high_expenses',
        message: `Большие расходы: ${period.totalExpenses.toFixed(2)} смн за период`
      });
    }
    const profitMargin = period.totalSales > 0 ? period.netProfit / period.totalSales : 0;
    if (period.totalSales > 0 && profitMargin < 0.15) {
      result.push({
        type: 'low_profit',
        message: `Низкая прибыль: ${period.netProfit.toFixed(2)} смн (${(profitMargin * 100).toFixed(1)}%)`
      });
    }
    return result;
  }
}

export const reportService = new ReportService();
