import { Preferences } from '@capacitor/preferences';
import { ActiveSession, User } from '../types/models';
import { dbService } from './db.service';

const SESSION_KEY = 'ice_pos_active_session';

class AuthService {
  async listCashiers(): Promise<User[]> {
    const users = await dbService.table('users');
    return users.filter((u) => u.is_active);
  }

  async loginByPin(userId: string, pin: string): Promise<User | null> {
    const users = await dbService.table('users');
    const user = users.find((u) => u.id === userId && u.pin_hash === pin && u.is_active);
    if (!user) return null;

    const session: ActiveSession = {
      user_id: user.id,
      logged_in_at: dbService.now()
    };
    await Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) });
    return user;
  }

  async logout(): Promise<void> {
    await Preferences.remove({ key: SESSION_KEY });
  }

  async getActiveUser(): Promise<User | null> {
    const stored = await Preferences.get({ key: SESSION_KEY });
    if (!stored.value) return null;
    const session = JSON.parse(stored.value) as ActiveSession;
    const users = await dbService.table('users');
    return users.find((u) => u.id === session.user_id) ?? null;
  }
}

export const authService = new AuthService();
