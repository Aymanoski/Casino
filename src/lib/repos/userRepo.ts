import type { User, UserRole } from '@/lib/schemas';
import { realtime } from '@/lib/realtime';
import { storage } from '@/lib/storage';
import { auditRepo } from './auditRepo';
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

  async create(
    input: Omit<User, 'id'>,
    actorUserId = 'user-admin'
  ): Promise<User> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'user.manage');

    const newUser: User = {
      ...input,
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() || input.name.trim(),
      email: input.email.trim().toLowerCase(),
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
      after: {
        name: newUser.name,
        nameAr: newUser.nameAr,
        role: newUser.role,
        email: newUser.email,
        titleEn: newUser.titleEn ?? null,
      },
    });

    realtime.publish('user.updated', { userId: newUser.id });
    return newUser;
  },

  async update(
    id: string,
    patch: Partial<Omit<User, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<User | null> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'user.manage');

    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;

    const before = { ...db.users[idx] };
    // Protect primary root admin account from losing superAdmin role
    const safePatch: Partial<Omit<User, 'id'>> =
      id === 'user-admin' && patch.role && patch.role !== 'superAdmin'
        ? { ...patch, role: 'superAdmin' }
        : patch;

    const updated: User = { ...before, ...safePatch };
    db.users[idx] = updated;
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: before.role !== updated.role ? 'role.change' : 'user.update',
      entityType: 'user',
      entityId: id,
      summary:
        before.role !== updated.role
          ? `Changed role for ${updated.name}: ${before.role} -> ${updated.role}`
          : `Updated manager ${updated.name} (${updated.role})`,
      summaryAr:
        before.role !== updated.role
          ? `تم تغيير صلاحية ${updated.nameAr || updated.name}: ${before.role} ← ${updated.role}`
          : `تم تحديث بيانات ${updated.nameAr || updated.name}`,
      before: {
        role: before.role,
        name: before.name,
        email: before.email,
        titleEn: before.titleEn ?? null,
      },
      after: {
        role: updated.role,
        name: updated.name,
        email: updated.email,
        titleEn: updated.titleEn ?? null,
      },
    });

    realtime.publish('user.updated', { userId: id });
    return updated;
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    const db = await storage.readSnapshot();
    assertRepoPermission(db, actorUserId, 'user.manage');

    const target = db.users.find((u) => u.id === id);
    if (!target || id === 'user-admin' || id === actorUserId) return false;

    // Never remove the last superAdmin
    if (target.role === 'superAdmin') {
      const superAdmins = db.users.filter((u) => u.role === 'superAdmin');
      if (superAdmins.length <= 1) return false;
    }

    db.users = db.users.filter((u) => u.id !== id);
    await storage.writeSnapshot(db);

    await auditRepo.record({
      actorUserId,
      action: 'user.remove',
      entityType: 'user',
      entityId: id,
      summary: `Removed user ${target.name} (${target.role})`,
      summaryAr: `تم حذف المستخدم ${target.nameAr || target.name}`,
      before: { name: target.name, role: target.role, email: target.email },
      after: null,
    });

    realtime.publish('user.updated', { userId: id });
    return true;
  },
};
