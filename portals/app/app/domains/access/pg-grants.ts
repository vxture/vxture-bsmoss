import type { Pool } from "pg";
import type { LocalGrant } from "./resolve";

export async function readPgGrant(pool: Pool, workspaceId: string, sub: string): Promise<LocalGrant | null> {
  const result = await pool.query(`SELECT m.status,s.scope,s.expires_at,
    ARRAY(SELECT p.perm_code FROM local_authz.member_role mr
      JOIN local_authz.role_permission rp ON rp.role_id=mr.role_id
      JOIN local_authz.permission p ON p.id=rp.permission_id WHERE mr.member_id=m.id) AS permissions
    FROM local_authz.member m JOIN local_authz.data_scope s ON s.member_id=m.id AND s.workspace_id=m.workspace_id
    WHERE m.workspace_id=$1 AND m.sub=$2`, [workspaceId, sub]);
  const row = result.rows[0];
  return row ? { workspaceId, sub, active: row.status === "active", permissions: row.permissions, scope: row.scope, expiresAt: new Date(row.expires_at).getTime() } : null;
}
