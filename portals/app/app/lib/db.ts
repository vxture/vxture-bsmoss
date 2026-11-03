import { Pool } from "pg";

let pool: Pool | undefined;
// A dedicated worker host calls this only after its current lane has settled.
export async function closePool(): Promise<void> {
  const current = pool; pool = undefined;
  await current?.end();
}
export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("database_unconfigured");
  const url = new URL(connectionString);
  if (decodeURIComponent(url.username) !== "bsmoss_svc") throw new Error("database_service_role_required");
  pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  return pool;
}
