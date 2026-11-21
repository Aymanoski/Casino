import type { Segment } from '@/lib/schemas';
import { commands } from '@/lib/commands';
import { storage } from '@/lib/storage';

export const segmentRepo = {
  async list(): Promise<Segment[]> {
    const db = await storage.readSnapshot();
    return [...db.segments].sort((a, b) => a.order - b.order);
  },

  async get(id: string): Promise<Segment | null> {
    const db = await storage.readSnapshot();
    return db.segments.find((s) => s.id === id) ?? null;
  },

  async create(
    input: Omit<Segment, 'id' | 'order'> & { order?: number },
    actorUserId = 'user-admin'
  ): Promise<Segment> {
    return commands.createSegment({ ...input, actorUserId });
  },

  async update(
    id: string,
    patch: Partial<Omit<Segment, 'id'>>,
    actorUserId = 'user-admin'
  ): Promise<Segment | null> {
    return commands.updateSegment({ segmentId: id, patch, actorUserId });
  },

  async reorder(
    orderedIds: string[],
    actorUserId = 'user-admin'
  ): Promise<Segment[]> {
    return commands.reorderSegments({ orderedIds, actorUserId });
  },

  async remove(id: string, actorUserId = 'user-admin'): Promise<boolean> {
    return commands.removeSegment({ segmentId: id, actorUserId });
  },
};
