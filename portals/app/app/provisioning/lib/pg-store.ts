import type { Pool, PoolClient } from "pg";
import type { ProvisioningStore, DeliveryMeta, RecentDelivery } from "./store";

export class PgProvisioningStore implements ProvisioningStore {
  constructor(private readonly pool: Pool, private readonly tx?: PoolClient) {}
  async withWorkspaceLock<T>(workspace: string, product: string, run: (store: ProvisioningStore) => Promise<T>): Promise<T> {
    if (this.tx) throw new Error("nested_provision_transaction");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([workspace, product])]);
      const result = await run(new PgProvisioningStore(this.pool, client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  private get db() { return this.tx ?? this.pool; }
  private mutation() { if (!this.tx) throw new Error("provision_transaction_required"); return this.tx; }
  async isDelivered(id: string) { return Boolean((await this.db.query("SELECT 1 FROM vx_provision.webhook_delivery WHERE delivery_id=$1", [id])).rowCount); }
  async markDelivered(id: string, meta?: DeliveryMeta) {
    await this.mutation().query("INSERT INTO vx_provision.webhook_delivery(delivery_id,type,result) VALUES ($1,$2,$3)", [id, meta?.type ?? "unknown", meta?.result ?? "processed"]);
  }
  async getLastSeq(workspace: string, product: string) {
    const row = await this.db.query("SELECT last_seq FROM vx_provision.provision_seq WHERE workspace_id=$1 AND product_code=$2", [workspace, product]);
    return row.rowCount ? Number(row.rows[0].last_seq) : -1;
  }
  async setSeq(workspace: string, product: string, seq: number) {
    if (!Number.isSafeInteger(seq) || seq < 0) throw new Error("invalid_provision_seq");
    await this.mutation().query("INSERT INTO vx_provision.provision_seq(workspace_id,product_code,last_seq) VALUES($1,$2,$3) ON CONFLICT(workspace_id,product_code) DO UPDATE SET last_seq=EXCLUDED.last_seq,updated_at=now()", [workspace, product, seq]);
  }
  async upsertInstance(workspace: string, product: string, status: string) {
    const stage = process.env.DEPLOY_STAGE === "beta" ? "beta" : "prod";
    await this.mutation().query("INSERT INTO vx_provision.app_instance(workspace_id,product_code,status,env,provisioned_at) VALUES($1,$2,$3::varchar(32),$4,CASE WHEN $3::varchar(32)='provisioned' THEN now() END) ON CONFLICT(workspace_id,product_code) DO UPDATE SET status=EXCLUDED.status,updated_at=now(),provisioned_at=COALESCE(vx_provision.app_instance.provisioned_at,EXCLUDED.provisioned_at)", [workspace, product, status, stage]);
  }
  async recentDeliveries(limit: number): Promise<RecentDelivery[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid_delivery_limit");
    const rows = await this.db.query('SELECT delivery_id AS "deliveryId",type,result,created_at AS "receivedAt" FROM vx_provision.webhook_delivery ORDER BY created_at DESC LIMIT $1', [limit]);
    return rows.rows;
  }
}
