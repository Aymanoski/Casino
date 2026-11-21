import type { User, UserRole } from '@/lib/schemas';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';
import { assertRepoPermission } from './permissions';

export const userRepo = {
  async list(options?: { role?: UserRole }): Promise<User[]> {
    const db = await storage.readSnapshot();
    if (options?.role) {
      return db.users.filter((u) => u.role === options.role);
    }
    return [...db.users];
  },

  async get(id: string): Promise<User | null> {
    const db = await storage.readSnapshot();
    return db.users.find((u) => u.id === id) ?? null;
  },

  async getByEmail(email: string): Promise<User | null> {
    const db = await storage.readSnapshot();
    return (
      db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ??
      null
    );
  },

  async getJudgeContactForActor(
    judgeUserId: string,
    actorUserId: string,
    matchId?: string
  ): Promise<{ name: string; nameAr: string; phone?: string; whatsapp?: string; email: string } | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'contact.viewJudge', {
      targetJudgeId: judgeUserId,
    });
    const judge = db.users.find((u) => u.id === judgeUserId);
    if (!judge) return null;
    await commands.logContactViewed({
      targetType: 'judge',
      targetId: judgeUserId,
      matchId,
      actorUserId,
    });
    return {
      name: judge.name,
      nameAr: judge.nameAr,
      phone: judge.phone,
      whatsapp: judge.whatsapp,
      email: judge.email,
    };
  },

  async create(
    input: Omit<User, 'id'>,
    actorUserId = 'user-admin'
  ): Promise<User> {
    return commands.createUser({ ...input, actorUserId });
  },

  async update(
    id: string,
    patch: Partial<Omit<User, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<User | null> {
    return commands.updateUser({ userId: id, patch, actorUserId });
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    return commands.removeUser({ userId: id, actorUserId });
  },
};
