import type { User, UserRole } from '@/lib/schemas';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';

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

  async create(
    input: Omit<User, 'id'>,
    actorUserId = 'user-admin'
  ): Promise<User> {
    const db = await storage.readSnapshot();
    const newUser: User = {
      ...input,
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    db.users.push(newUser);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'user.create',
      entityType: 'user',
      entityId: newUser.id,
      summary: `Created manager/user ${newUser.name} (${newUser.role})`,
      summaryAr: `تم إنشاء حساب ${newUser.nameAr || newUser.name} (${newUser.role})`,
      before: null,
      after: { name: newUser.name, role: newUser.role, email: newUser.email },
    });

    return newUser;
  },

  async update(
    id: string,
    patch: Partial<Omit<User, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<User | null> {
    const db = await storage.readSnapshot();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;

    const before = { ...db.users[idx] };
    const updated: User = { ...db.users[idx], ...patch };
    db.users[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: before.role !== updated.role ? 'role.change' : 'user.update',
      entityType: 'user',
      entityId: id,
      summary: `Updated user ${updated.name} (role: ${updated.role})`,
      summaryAr: `تم تحديث المستخدم ${updated.nameAr || updated.name}`,
      before: { role: before.role, name: before.name },
      after: { role: updated.role, name: updated.name },
    });

    return updated;
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
    const target = db.users.find((u) => u.id === id);
    if (!target || id === 'user-admin') return false;

    db.users = db.users.filter((u) => u.id !== id);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'user.remove',
      entityType: 'user',
      entityId: id,
      summary: `Removed user ${target.name}`,
      summaryAr: `تم حذف المستخدم ${target.nameAr || target.name}`,
      before: { name: target.name, role: target.role },
      after: null,
    });

    return true;
  },
};
