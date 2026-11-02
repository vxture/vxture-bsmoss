import type { UsageRecord } from "../shared/model.ts";
export interface UsageStore {
  // Atomic insert-if-absent; conflicting replay must fail, never overwrite evidence.
  append(record: UsageRecord): Promise<"inserted" | "duplicate">;
  list(workspaceId: string): Promise<readonly UsageRecord[]>;
}
export class MemoryUsageStore implements UsageStore {
  private records = new Map<string, UsageRecord>();
  async append(record: UsageRecord): Promise<"inserted" | "duplicate"> {
    const key = JSON.stringify([record.workspaceId, record.sourceId, record.sourceEventId]);
    const previous = this.records.get(key);
    if (previous) {
      if (Object.keys(record).some(k => record[k as keyof UsageRecord] !== previous[k as keyof UsageRecord])) throw new Error("conflicting_replay");
      return "duplicate";
    }
    this.records.set(key, { ...record }); return "inserted";
  }
  async list(workspaceId: string) { return [...this.records.values()].filter(r => r.workspaceId === workspaceId).map(r => ({ ...r })); }
}
