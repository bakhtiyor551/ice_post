import { Expense, ExpenseCategory, RecurringExpense } from '../types/models';
import { accountService } from './account.service';
import { dbService } from './db.service';
import { shiftService } from './shift.service';

interface CreateExpenseInput {
  category_id: string;
  amount: number;
  payment_method: Expense['payment_method'];
  account_id: string;
  comment?: string;
  user_id: string;
  shift_id?: string;
  expense_date: string;
}

class ExpenseService {
  async listCategories(): Promise<ExpenseCategory[]> {
    const rows = await dbService.table('expense_categories');
    return rows.filter((c) => c.is_active);
  }

  async createCategory(input: { name: string; type: ExpenseCategory['type'] }): Promise<ExpenseCategory> {
    const row: ExpenseCategory = {
      id: dbService.makeId('exp_cat'),
      name: input.name.trim(),
      type: input.type,
      is_active: true,
      created_at: dbService.now()
    };
    await dbService.insert('expense_categories', row);
    return row;
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    if (input.amount <= 0) {
      throw new Error('Сумма должна быть больше 0');
    }
    if (!input.category_id) {
      throw new Error('Категория обязательна');
    }
    if (!input.expense_date) {
      throw new Error('Дата обязательна');
    }
    if (!input.account_id) {
      throw new Error('Счёт обязателен');
    }

    const expense: Expense = {
      id: dbService.makeId('exp'),
      ...input,
      is_deleted: false,
      created_at: dbService.now(),
      sync_status: 'pending'
    };
    await dbService.insert('expenses', expense);
    await accountService.recordExpense({
      accountId: input.account_id,
      amount: input.amount,
      referenceType: 'expense',
      referenceId: expense.id,
      userId: input.user_id,
      shiftId: input.shift_id,
      comment: input.comment
    });
    if (input.payment_method === 'cash' && input.shift_id) {
      await shiftService.applyCashExpense(input.shift_id, input.amount);
    }
    return expense;
  }

  async listByDate(dateStr: string): Promise<Expense[]> {
    const expenses = await dbService.table('expenses');
    return expenses.filter((e) => e.expense_date === dateStr && !e.is_deleted);
  }

  async listExpenses(filters?: {
    from?: string;
    to?: string;
    categoryId?: string;
    userId?: string;
    shiftId?: string;
  }): Promise<Expense[]> {
    const expenses = await dbService.table('expenses');
    return expenses.filter((e) => {
      if (e.is_deleted) return false;
      if (filters?.from && e.expense_date < filters.from) return false;
      if (filters?.to && e.expense_date > filters.to) return false;
      if (filters?.categoryId && e.category_id !== filters.categoryId) return false;
      if (filters?.userId && e.user_id !== filters.userId) return false;
      if (filters?.shiftId && e.shift_id !== filters.shiftId) return false;
      return true;
    });
  }

  async updateExpense(id: string, patch: Partial<Omit<Expense, 'id' | 'created_at'>>): Promise<void> {
    const expenses = await dbService.table('expenses');
    const current = expenses.find((e) => e.id === id && !e.is_deleted);
    if (!current) return;
    const prevCash = current.payment_method === 'cash' ? current.amount : 0;
    const nextPaymentMethod = patch.payment_method ?? current.payment_method;
    const nextAmount = patch.amount ?? current.amount;
    const nextAccountId = patch.account_id ?? current.account_id;
    if (!nextAccountId) {
      throw new Error('Счёт обязателен');
    }
    const nextCash = nextPaymentMethod === 'cash' ? nextAmount : 0;
    const deltaCash = Number((nextCash - prevCash).toFixed(2));

    if (current.account_id && current.amount > 0) {
      await accountService.reverseExpenseOnAccount(current.account_id, current.amount, id, current.user_id);
    }

    await dbService.update('expenses', id, {
      ...patch,
      account_id: nextAccountId,
      sync_status: 'pending'
    });

    await accountService.recordExpense({
      accountId: nextAccountId,
      amount: nextAmount,
      referenceType: 'expense',
      referenceId: id,
      userId: current.user_id,
      shiftId: patch.shift_id ?? current.shift_id,
      comment: patch.comment ?? current.comment
    });

    if (current.shift_id && deltaCash !== 0) {
      await shiftService.applyCashExpense(current.shift_id, deltaCash);
    }
  }

  async softDeleteExpense(id: string): Promise<void> {
    const expenses = await dbService.table('expenses');
    const current = expenses.find((e) => e.id === id && !e.is_deleted);
    if (!current) return;
    if (current.account_id && current.amount > 0) {
      await accountService.reverseExpenseOnAccount(current.account_id, current.amount, id, current.user_id);
    }
    await dbService.update('expenses', id, {
      is_deleted: true,
      sync_status: 'pending'
    });
    if (current.shift_id && current.payment_method === 'cash') {
      await shiftService.applyCashExpense(current.shift_id, -current.amount);
    }
  }

  async listRecurring(): Promise<RecurringExpense[]> {
    return dbService.table('recurring_expenses');
  }

  async createRecurring(input: Omit<RecurringExpense, 'id' | 'last_generated_at'>): Promise<RecurringExpense> {
    const row: RecurringExpense = {
      ...input,
      id: dbService.makeId('rec_exp'),
      last_generated_at: undefined
    };
    await dbService.insert('recurring_expenses', row);
    return row;
  }

  async generateRecurringExpenses(targetDate: string, userId: string, shiftId?: string): Promise<number> {
    const recurring = (await dbService.table('recurring_expenses')).filter((r) => r.is_active);
    let count = 0;
    for (const rule of recurring) {
      if (rule.start_date > targetDate) continue;
      if (rule.end_date && rule.end_date < targetDate) continue;
      if (!this.shouldGenerate(rule, targetDate)) continue;

      const defaultAcc = await accountService.getDefaultCashAccountId();
      if (!defaultAcc) continue;

      await this.createExpense({
        category_id: rule.category_id,
        amount: rule.amount,
        payment_method: 'cash',
        account_id: defaultAcc,
        comment: `Авторасход (${rule.frequency})`,
        user_id: userId,
        shift_id: shiftId,
        expense_date: targetDate
      });
      await dbService.update('recurring_expenses', rule.id, {
        last_generated_at: targetDate
      });
      count += 1;
    }
    return count;
  }

  private shouldGenerate(rule: RecurringExpense, targetDate: string): boolean {
    if (rule.last_generated_at === targetDate) return false;
    if (!rule.last_generated_at) return true;
    const last = new Date(rule.last_generated_at).getTime();
    const target = new Date(targetDate).getTime();
    const diffDays = Math.floor((target - last) / 86400000);
    if (rule.frequency === 'daily') return diffDays >= 1;
    if (rule.frequency === 'weekly') return diffDays >= 7;
    return diffDays >= 28;
  }
}

export const expenseService = new ExpenseService();
