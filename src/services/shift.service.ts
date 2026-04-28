import { Shift } from '../types/models';
import { accountService } from './account.service';
import { dbService } from './db.service';

class ShiftService {
  async getCurrentShift(userId: string): Promise<Shift | null> {
    const shifts = await dbService.table('shifts');
    return shifts.find((s) => s.user_id === userId && s.status === 'open') ?? null;
  }

  async openShift(userId: string, startCash: number, accountId: string, openComment?: string): Promise<Shift> {
    const existing = await this.getCurrentShift(userId);
    if (existing) return existing;
    if (!accountId) throw new Error('Выберите счёт смены');

    const now = dbService.now();
    const commentTrim = openComment?.trim();
    const shift: Shift = {
      id: dbService.makeId('shift'),
      user_id: userId,
      account_id: accountId,
      start_cash: Number(Math.max(0, startCash).toFixed(2)),
      open_comment: commentTrim || undefined,
      opened_at: now,
      status: 'open',
      cash_sales: 0,
      card_sales: 0,
      transfer_sales: 0,
      cash_expenses: 0,
      difference: 0,
      salary_amount: 0,
      created_at: now,
      updated_at: now,
      sync_status: 'pending'
    };
    await dbService.insert('shifts', shift);
    if (shift.start_cash > 0) {
      await accountService.recordShiftOpenCash({
        accountId,
        amount: shift.start_cash,
        shiftId: shift.id,
        userId,
        openComment: commentTrim
      });
    }
    return shift;
  }

  async applyCashExpense(shiftId: string, amount: number): Promise<void> {
    const shifts = await dbService.table('shifts');
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    await dbService.update('shifts', shiftId, {
      cash_expenses: Number((shift.cash_expenses + amount).toFixed(2)),
      sync_status: 'pending'
    });
  }

  async applySaleTotals(shiftId: string, payment: 'cash' | 'card' | 'transfer', amount: number): Promise<void> {
    const shifts = await dbService.table('shifts');
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    const patch = {
      cash_sales: shift.cash_sales,
      card_sales: shift.card_sales,
      transfer_sales: shift.transfer_sales,
      sync_status: 'pending' as const
    };
    if (payment === 'cash') patch.cash_sales = Number((patch.cash_sales + amount).toFixed(2));
    if (payment === 'card') patch.card_sales = Number((patch.card_sales + amount).toFixed(2));
    if (payment === 'transfer') patch.transfer_sales = Number((patch.transfer_sales + amount).toFixed(2));
    await dbService.update('shifts', shiftId, patch);
  }

  async closeShift(shiftId: string, endCash: number): Promise<Shift | null> {
    const shifts = await dbService.table('shifts');
    const shift = shifts.find((s) => s.id === shiftId && s.status === 'open');
    if (!shift) return null;

    const shouldBe = shift.start_cash + shift.cash_sales - shift.cash_expenses;
    const expectedCash = Number(shouldBe.toFixed(2));
    const diff = Number((endCash - expectedCash).toFixed(2));

    await dbService.update('shifts', shift.id, {
      expected_cash: expectedCash,
      end_cash: endCash,
      closed_at: dbService.now(),
      status: 'closed',
      difference: diff,
      salary_amount: 45,
      sync_status: 'pending'
    });

    if (shift.account_id && diff !== 0) {
      await accountService.recordCorrection({
        accountId: shift.account_id,
        delta: diff,
        referenceId: shift.id,
        userId: shift.user_id,
        shiftId: shift.id,
        comment: diff < 0 ? 'Недостача по смене' : 'Излишек в кассе'
      });
    }

    const updated = (await dbService.table('shifts')).find((s) => s.id === shift.id) ?? null;
    return updated;
  }
}

export const shiftService = new ShiftService();
