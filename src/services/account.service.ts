import {
  Account,
  AccountReferenceType,
  AccountTransaction,
  AccountTransactionDirection,
  AccountTransactionType,
  AccountType
} from '../types/models';
import { dbService } from './db.service';

export interface AccountHistoryFilters {
  from?: string;
  to?: string;
  type?: AccountTransactionType | '';
  userId?: string;
  shiftId?: string;
  minAmount?: number;
  maxAmount?: number;
}

class AccountService {
  async list(includeInactive = false): Promise<Account[]> {
    const rows = await dbService.table('accounts');
    return rows.filter((a) => includeInactive || a.is_active).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  async get(id: string): Promise<Account | null> {
    const rows = await dbService.table('accounts');
    return rows.find((a) => a.id === id) ?? null;
  }

  async getDefaultCashAccountId(): Promise<string | null> {
    const list = await this.list();
    const reg = list.find((a) => a.type === 'cash_register' && a.is_active);
    return reg?.id ?? list[0]?.id ?? null;
  }

  async createAccount(input: { name: string; type: AccountType }): Promise<Account> {
    const name = input.name.trim();
    if (!name) throw new Error('Название счёта обязательно');
    const now = dbService.now();
    const account: Account = {
      id: dbService.makeId('acc'),
      name,
      type: input.type,
      balance: 0,
      is_active: true,
      created_at: now,
      updated_at: now,
      sync_status: 'pending'
    };
    await dbService.insert('accounts', account);
    return account;
  }

  async updateAccount(id: string, patch: Partial<Pick<Account, 'name' | 'is_active' | 'type'>>): Promise<void> {
    await dbService.update('accounts', id, { ...patch, sync_status: 'pending' });
  }

  async deleteAccount(id: string): Promise<void> {
    const tx = await dbService.table('account_transactions');
    if (tx.some((t) => t.account_id === id || t.from_account_id === id || t.to_account_id === id)) {
      throw new Error('Нельзя удалить счёт с историей операций');
    }
    const rows = await dbService.table('accounts');
    const next = rows.filter((a) => a.id !== id);
    if (rows.length === next.length) return;
    await dbService.saveTable('accounts', next as never);
  }

  private async changeBalance(accountId: string, delta: number, allowNegative: boolean): Promise<void> {
    const acc = await this.get(accountId);
    if (!acc) throw new Error('Счёт не найден');
    if (!acc.is_active) throw new Error('Счёт неактивен');
    const next = Number((acc.balance + delta).toFixed(2));
    if (!allowNegative && next < -0.0001) {
      throw new Error('Недостаточно средств на счёте');
    }
    await dbService.update('accounts', accountId, { balance: next, sync_status: 'pending' });
  }

  private async insertTransaction(row: AccountTransaction, balanceDelta: number, allowNegativeBalance: boolean): Promise<void> {
    await dbService.insert('account_transactions', row);
    await this.changeBalance(row.account_id, balanceDelta, allowNegativeBalance);
  }

  private balanceDeltaFor(direction: AccountTransactionDirection, amount: number): number {
    return direction === 'in' ? amount : -amount;
  }

  async listTransactionsForAccount(accountId: string, filters?: AccountHistoryFilters): Promise<AccountTransaction[]> {
    const all = await dbService.table('account_transactions');
    return all
      .filter((t) => t.account_id === accountId)
      .filter((t) => {
        if (filters?.from && t.created_at.slice(0, 10) < filters.from) return false;
        if (filters?.to && t.created_at.slice(0, 10) > filters.to) return false;
        if (filters?.type && t.type !== filters.type) return false;
        if (filters?.userId && t.user_id !== filters.userId) return false;
        if (filters?.shiftId && t.shift_id !== filters.shiftId) return false;
        if (filters?.minAmount !== undefined && t.amount < filters.minAmount) return false;
        if (filters?.maxAmount !== undefined && t.amount > filters.maxAmount) return false;
        return true;
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async recordIncome(input: {
    accountId: string;
    amount: number;
    referenceType: AccountReferenceType;
    referenceId: string;
    userId?: string;
    shiftId?: string;
    comment?: string;
  }): Promise<AccountTransaction> {
    if (input.amount <= 0) throw new Error('Сумма должна быть больше 0');
    const now = dbService.now();
    const row: AccountTransaction = {
      id: dbService.makeId('atx'),
      account_id: input.accountId,
      type: 'income',
      amount: input.amount,
      direction: 'in',
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      shift_id: input.shiftId,
      user_id: input.userId,
      comment: input.comment,
      created_at: now,
      sync_status: 'pending'
    };
    await this.insertTransaction(row, this.balanceDeltaFor('in', input.amount), true);
    return row;
  }

  async recordExpense(input: {
    accountId: string;
    amount: number;
    referenceType: AccountReferenceType;
    referenceId: string;
    userId?: string;
    shiftId?: string;
    comment?: string;
  }): Promise<AccountTransaction> {
    if (input.amount <= 0) throw new Error('Сумма должна быть больше 0');
    const now = dbService.now();
    const row: AccountTransaction = {
      id: dbService.makeId('atx'),
      account_id: input.accountId,
      type: 'expense',
      amount: input.amount,
      direction: 'out',
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      shift_id: input.shiftId,
      user_id: input.userId,
      comment: input.comment,
      created_at: now,
      sync_status: 'pending'
    };
    await this.insertTransaction(row, this.balanceDeltaFor('out', input.amount), false);
    return row;
  }

  /** Доход от продажи: несколько строк по методам оплаты */
  async recordSaleIncome(input: {
    saleId: string;
    shiftId: string;
    userId: string;
    receiptLabel: string;
    portions: Array<{ accountId: string; amount: number; method: 'cash' | 'card' | 'transfer' }>;
  }): Promise<void> {
    for (const p of input.portions) {
      if (p.amount <= 0) continue;
      await this.recordIncome({
        accountId: p.accountId,
        amount: p.amount,
        referenceType: 'sale',
        referenceId: input.saleId,
        userId: input.userId,
        shiftId: input.shiftId,
        comment: `Продажа ${input.receiptLabel} (${p.method})`
      });
    }
  }

  async recordTransfer(input: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    userId?: string;
    shiftId?: string;
    comment?: string;
  }): Promise<void> {
    if (input.amount <= 0) throw new Error('Сумма должна быть больше 0');
    if (input.fromAccountId === input.toAccountId) {
      throw new Error('Нельзя перевести на тот же счёт');
    }
    const ref = dbService.makeId('trf');
    const now = dbService.now();

    const outRow: AccountTransaction = {
      id: dbService.makeId('atx'),
      account_id: input.fromAccountId,
      type: 'transfer',
      amount: input.amount,
      direction: 'out',
      reference_type: 'transfer',
      reference_id: ref,
      from_account_id: input.fromAccountId,
      to_account_id: input.toAccountId,
      shift_id: input.shiftId,
      user_id: input.userId,
      comment: input.comment,
      created_at: now,
      sync_status: 'pending'
    };
    await this.insertTransaction(outRow, this.balanceDeltaFor('out', input.amount), false);

    const inRow: AccountTransaction = {
      id: dbService.makeId('atx'),
      account_id: input.toAccountId,
      type: 'transfer',
      amount: input.amount,
      direction: 'in',
      reference_type: 'transfer',
      reference_id: ref,
      from_account_id: input.fromAccountId,
      to_account_id: input.toAccountId,
      shift_id: input.shiftId,
      user_id: input.userId,
      comment: input.comment,
      created_at: now,
      sync_status: 'pending'
    };
    await this.insertTransaction(inRow, this.balanceDeltaFor('in', input.amount), true);
  }

  /** delta > 0 — излишек (приход на счёт), delta < 0 — недостача (расход с счёта) */
  async recordCorrection(input: {
    accountId: string;
    delta: number;
    referenceId: string;
    userId?: string;
    shiftId?: string;
    comment?: string;
  }): Promise<void> {
    if (input.delta === 0) return;
    const amount = Math.abs(input.delta);
    const direction: AccountTransactionDirection = input.delta > 0 ? 'in' : 'out';
    const now = dbService.now();
    const row: AccountTransaction = {
      id: dbService.makeId('atx'),
      account_id: input.accountId,
      type: 'correction',
      amount,
      direction,
      reference_type: 'correction',
      reference_id: input.referenceId,
      shift_id: input.shiftId,
      user_id: input.userId,
      comment: input.comment,
      created_at: now,
      sync_status: 'pending'
    };
    await this.insertTransaction(row, this.balanceDeltaFor(direction, amount), true);
  }

  async recordShiftOpenCash(input: { accountId: string; amount: number; shiftId: string; userId: string; openComment?: string }): Promise<void> {
    if (input.amount <= 0) return;
    const extra = input.openComment?.trim();
    const comment = extra
      ? `Начальная касса в ящик (не доход) — ${extra}`
      : 'Начальная касса в ящик (не доход, для сдачи)';
    await this.recordIncome({
      accountId: input.accountId,
      amount: input.amount,
      referenceType: 'shift_open',
      referenceId: input.shiftId,
      userId: input.userId,
      shiftId: input.shiftId,
      comment
    });
  }

  /** Сторно расхода при удалении (вернуть деньги на счёт) */
  async reverseExpenseOnAccount(accountId: string, amount: number, expenseId: string, userId?: string): Promise<void> {
    if (amount <= 0) return;
    await this.recordIncome({
      accountId,
      amount,
      referenceType: 'correction',
      referenceId: expenseId,
      userId,
      comment: 'Сторно расхода'
    });
  }

  async summary(): Promise<{ accounts: Account[]; totalBalance: number }> {
    const accounts = await this.list(true);
    const totalBalance = Number(accounts.reduce((s, a) => s + a.balance, 0).toFixed(2));
    return { accounts, totalBalance };
  }
}

export const accountService = new AccountService();
