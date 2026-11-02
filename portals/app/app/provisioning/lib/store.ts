// Adapted from the yucer engineering reference for product bsmoss.
export interface DeliveryMeta {
  type: string;
  result: string;
}

export interface RecentDelivery {
  deliveryId: string;
  type: string;
  result: string;
  receivedAt: Date;
}

export interface ProvisioningStore {

  withWorkspaceLock<T>(workspaceId: string, product: string, run: (store: ProvisioningStore) => Promise<T>): Promise<T>;
  isDelivered(deliveryId: string): Promise<boolean>;
  markDelivered(deliveryId: string, meta?: DeliveryMeta): Promise<void>;
  getLastSeq(workspaceId: string, product: string): Promise<number>;
  setSeq(workspaceId: string, product: string, seq: number): Promise<void>;
  upsertInstance(workspaceId: string, product: string, status: string): Promise<void>;

  recentDeliveries(limit: number): Promise<RecentDelivery[]>;
}

export class InMemoryProvisioningStore implements ProvisioningStore {
  private locks = new Map<string, Promise<void>>();

  async withWorkspaceLock<T>(workspaceId: string, product: string, run: (store: ProvisioningStore) => Promise<T>): Promise<T> {
    const key = this.seqKey(workspaceId, product);
    const prior = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(key, held);
    await prior;
    try { return await run(this); }
    finally { release(); if (this.locks.get(key) === held) this.locks.delete(key); }
  }

  private delivered = new Set<string>();
  private log: RecentDelivery[] = [];
  private seq = new Map<string, number>();
  private instances = new Map<string, string>();

  private seqKey(w: string, p: string) {
    return `${w}\0${p}`;
  }

  async isDelivered(id: string): Promise<boolean> {
    return this.delivered.has(id);
  }
  async markDelivered(id: string, meta?: DeliveryMeta): Promise<void> {
    this.delivered.add(id);
    this.log.push({ deliveryId: id, type: meta?.type ?? "unknown", result: meta?.result ?? "processed", receivedAt: new Date() });
    if (this.log.length > 100) this.log.shift(); // a ring, not a history
  }
  async recentDeliveries(limit: number): Promise<RecentDelivery[]> {
    return this.log.slice(-limit).reverse();
  }
  async getLastSeq(w: string, p: string): Promise<number> {
    return this.seq.get(this.seqKey(w, p)) ?? -1;
  }
  async setSeq(w: string, p: string, s: number): Promise<void> {
    this.seq.set(this.seqKey(w, p), s);
  }
  async upsertInstance(w: string, p: string, status: string): Promise<void> {
    this.instances.set(this.seqKey(w, p), status);
  }
}

