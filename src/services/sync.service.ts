import { Network } from '@capacitor/network';
import { dbService } from './db.service';
import { apiService } from './api.service';

class SyncService {
  private pushTables = [
    'sales',
    'sale_items',
    'expenses',
    'shifts',
    'stock_movements',
    'salary_transactions',
    'payroll_periods',
    'accounts',
    'account_transactions'
  ] as const;
  private pullTables = [
    'products',
    'categories',
    'users',
    'stock_items',
    'recipes',
    'salary_settings',
    'expense_categories',
    'recurring_expenses',
    'accounts'
  ] as const;

  async syncPending(): Promise<{ pushed: number; pulled: number; online: boolean }> {
    const status = await Network.getStatus();
    if (!status.connected) {
      return { pushed: 0, pulled: 0, online: false };
    }

    const payload: Record<string, unknown[]> = {};
    let pushed = 0;

    for (const table of this.pushTables) {
      const rows = await dbService.table(table);
      const pending = rows.filter((r) => r.sync_status === 'pending' || r.sync_status === 'failed');
      payload[table] = pending;
    }

    const pushResult = await apiService.post<{ accepted: number }>('/sync/push', payload);
    for (const table of this.pushTables) {
      const rows = await dbService.table(table);
      const pending = rows.filter((r) => r.sync_status === 'pending' || r.sync_status === 'failed');
      for (const row of pending) {
        await dbService.update(table, row.id, { sync_status: 'synced' });
      }
      pushed += pending.length;
    }

    const pulledPayload = await apiService.get<Record<string, unknown[]>>('/sync/pull');
    let pulled = 0;
    for (const table of this.pullTables) {
      const remoteRows = Array.isArray(pulledPayload[table]) ? pulledPayload[table] : [];
      if (!remoteRows.length) continue;
      for (const row of remoteRows as Array<{ id: string } & Record<string, unknown>>) {
        await dbService.upsert(table, { ...row, sync_status: 'synced' } as never);
      }
      pulled += remoteRows.length;
    }

    if (pushResult.accepted < pushed) {
      for (const table of this.pushTables) {
        const rows = await dbService.table(table);
        const syncedRows = rows.filter((r) => r.sync_status === 'synced');
        for (const row of syncedRows) {
          await dbService.update(table, row.id, { sync_status: 'failed' });
        }
      }
    }

    return { pushed, pulled, online: true };
  }
}

export const syncService = new SyncService();
