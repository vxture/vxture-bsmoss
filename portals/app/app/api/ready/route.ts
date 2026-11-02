import { getPool } from "../../lib/db";
import { checkSessionStore } from "../../auth/lib/session-store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getPool().query("SELECT 1 FROM vx_provision.app_instance LIMIT 0");
    await checkSessionStore();
    return Response.json({ status: "ready", product: "bsmoss" }, { headers: { "cache-control": "no-store" } });
  } catch { return Response.json({ status: "unavailable", product: "bsmoss" }, { status: 503, headers: { "cache-control": "no-store" } }); }
}
