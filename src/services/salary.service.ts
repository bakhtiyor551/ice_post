import { PayrollPeriod, SalarySettings, SalaryTransaction, Shift, User } from '../types/models';
import { accountService } from './account.service';
import { dbService } from './db.service';
import { expenseService } from './expense.service';

class SalaryService {
  async getSettings(): Promise<SalarySettings> {
    const settings = await dbService.table('salary_settings');
    if (settings.length) return settings[0];
    const now = dbService.now();
    const created: SalarySettings = {
      id: 'salary_default',
      daily_rate: 45,
      allow_double_shift_payment: false,
      create_expense_on_payout: true,
      created_at: now,
      updated_at: now
    };
    await dbService.insert('salary_settings', created);
    return created;
  }

  async listCashiers(): Promise<User[]> {
    const users = await dbService.table('users');
    return users.filter((u) => u.role === 'cashier' && u.is_active);
  }

  async listTransactions(userId: string): Promise<SalaryTransaction[]> {
    const tx = await dbService.table('salary_transactions');
    return tx.filter((t) => t.user_id === userId);
  }

  async generateDailySalaryForShift(userId: string, shiftId: string, fallbackRate = 45): Promise<void> {
    const existing = (await dbService.table('salary_transactions')).find(
      (s) => s.shift_id === shiftId && s.type === 'daily_salary'
    );
    if (existing) return;

    const settings = await this.getSettings();
    const shifts = await dbService.table('shifts');
    const targetShift = shifts.find((s) => s.id === shiftId);
    if (!targetShift || targetShift.status !== 'closed') return;

    const shiftDay = (targetShift.closed_at ?? targetShift.opened_at).slice(0, 10);
    if (!settings.allow_double_shift_payment) {
      const paidShiftIds = new Set(
        (await dbService.table('salary_transactions'))
          .filter((s) => s.type === 'daily_salary' && s.user_id === userId && s.shift_id)
          .map((s) => s.shift_id as string)
      );
      const sameDayPaid = shifts.some(
        (s) =>
          paidShiftIds.has(s.id) &&
          s.user_id === userId &&
          s.status === 'closed' &&
          (s.closed_at ?? s.opened_at).slice(0, 10) === shiftDay
      );
      if (sameDayPaid) return;
    }

    const amount = settings.daily_rate || fallbackRate;
    await dbService.insert('salary_transactions', {
      id: dbService.makeId('sal'),
      user_id: userId,
      shift_id: shiftId,
      type: 'daily_salary',
      amount,
      created_at: dbService.now(),
      sync_status: 'pending'
    });
  }

  async addBonus(userId: string, amount: number, comment?: string): Promise<void> {
    await this.createTx(userId, 'bonus', Math.abs(amount), comment);
  }

  async addPenalty(userId: string, amount: number, comment?: string): Promise<void> {
    await this.createTx(userId, 'penalty', Math.abs(amount), comment);
  }

  async createPayout(input: {
    userId: string;
    periodStart: string;
    periodEnd: string;
    amount: number;
    paymentMethod: 'cash' | 'card' | 'transfer';
    accountId: string;
    comment?: string;
    adminUserId?: string;
    currentShiftId?: string;
  }): Promise<void> {
    if (!input.accountId) throw new Error('Счёт для выплаты обязателен');
    const txId = await this.createTxWithId(input.userId, 'payout', Math.abs(input.amount), input.comment, input.paymentMethod);
    const settings = await this.getSettings();
    const withExpense = settings.create_expense_on_payout && input.currentShiftId && input.adminUserId;
    if (withExpense) {
      await expenseService.createExpense({
        category_id: 'exp_salary',
        amount: Math.abs(input.amount),
        payment_method: input.paymentMethod,
        account_id: input.accountId,
        comment: `Выплата зарплаты: ${input.periodStart} - ${input.periodEnd}. ${input.comment ?? ''}`.trim(),
        user_id: input.adminUserId as string,
        shift_id: input.currentShiftId,
        expense_date: dbService.now().slice(0, 10)
      });
    } else {
      await accountService.recordExpense({
        accountId: input.accountId,
        amount: Math.abs(input.amount),
        referenceType: 'salary',
        referenceId: txId,
        userId: input.adminUserId,
        comment: input.comment ?? 'Выплата зарплаты'
      });
    }
  }

  async getDayDetails(userId: string, periodStart: string, periodEnd: string) {
    const shifts = await this.closedShiftsInPeriod(userId, periodStart, periodEnd);
    const settings = await this.getSettings();
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const day = (shift.closed_at ?? shift.opened_at).slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(shift);
      map.set(day, arr);
    }
    const rows = Array.from(map.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([day, dayShifts]) => ({
        date: day,
        worked: dayShifts.length > 0,
        amount: dayShifts.length > 0 ? settings.daily_rate : 0,
        shifts: dayShifts.length
      }));
    return rows;
  }

  async generatePayroll(userId: string, periodStart: string, periodEnd: string): Promise<PayrollPeriod> {
    const settings = await this.getSettings();
    const shifts = await this.closedShiftsInPeriod(userId, periodStart, periodEnd);
    const workedDays = this.countWorkedDays(shifts, settings.allow_double_shift_payment);

    const transactions = await this.listTransactions(userId);
    const inRange = transactions.filter((t) => {
      const d = t.created_at.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });

    const bonusTotal = inRange.filter((t) => t.type === 'bonus').reduce((s, t) => s + Math.abs(t.amount), 0);
    const penaltyTotal = inRange.filter((t) => t.type === 'penalty').reduce((s, t) => s + Math.abs(t.amount), 0);
    const payoutTotal = inRange.filter((t) => t.type === 'payout').reduce((s, t) => s + Math.abs(t.amount), 0);

    const baseSalary = workedDays * settings.daily_rate;
    const finalSalary = baseSalary + bonusTotal - penaltyTotal;
    const balance = finalSalary - payoutTotal;

    const period: PayrollPeriod = {
      id: dbService.makeId('payroll'),
      user_id: userId,
      period_start: periodStart,
      period_end: periodEnd,
      worked_days: workedDays,
      base_salary: Number(baseSalary.toFixed(2)),
      bonus_total: Number(bonusTotal.toFixed(2)),
      penalty_total: Number(penaltyTotal.toFixed(2)),
      payout_total: Number(payoutTotal.toFixed(2)),
      final_salary: Number(finalSalary.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      status: balance <= 0 ? 'paid' : payoutTotal > 0 ? 'partially_paid' : 'open',
      created_at: dbService.now(),
      updated_at: dbService.now(),
      sync_status: 'pending'
    };

    await dbService.upsert('payroll_periods', period);
    return period;
  }

  async getLatestPayroll(userId: string, periodStart: string, periodEnd: string): Promise<PayrollPeriod> {
    const all = await dbService.table('payroll_periods');
    const found = all.find((p) => p.user_id === userId && p.period_start === periodStart && p.period_end === periodEnd);
    if (found) return found;
    return this.generatePayroll(userId, periodStart, periodEnd);
  }

  private async createTx(
    userId: string,
    type: SalaryTransaction['type'],
    amount: number,
    comment?: string,
    paymentMethod?: SalaryTransaction['payment_method']
  ) {
    await this.createTxWithId(userId, type, amount, comment, paymentMethod);
  }

  private async createTxWithId(
    userId: string,
    type: SalaryTransaction['type'],
    amount: number,
    comment?: string,
    paymentMethod?: SalaryTransaction['payment_method']
  ): Promise<string> {
    const id = dbService.makeId('sal');
    await dbService.insert('salary_transactions', {
      id,
      user_id: userId,
      type,
      amount,
      payment_method: paymentMethod,
      comment,
      created_at: dbService.now(),
      sync_status: 'pending'
    });
    return id;
  }

  private async closedShiftsInPeriod(userId: string, periodStart: string, periodEnd: string): Promise<Shift[]> {
    const shifts = await dbService.table('shifts');
    return shifts.filter((s) => {
      if (s.user_id !== userId || s.status !== 'closed') return false;
      const day = (s.closed_at ?? s.opened_at).slice(0, 10);
      return day >= periodStart && day <= periodEnd;
    });
  }

  private countWorkedDays(shifts: Shift[], allowDoubleShift: boolean): number {
    if (allowDoubleShift) return shifts.length;
    const uniqueDays = new Set(shifts.map((s) => (s.closed_at ?? s.opened_at).slice(0, 10)));
    return uniqueDays.size;
  }
}

export const salaryService = new SalaryService();
