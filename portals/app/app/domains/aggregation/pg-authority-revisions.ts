import type { PoolClient } from "pg";

import { normalizeAuthorityRevisions, type AuthorityRef } from "./authority-revisions.ts";
export type { AuthorityRef } from "./authority-revisions.ts";
// Server-resolved references only. Keep authority generations in the same input
// snapshot so changing a policy back cannot revive an old completion proof.
export async function readAuthorityRevisions(client: PoolClient, workspaceId: string, refs: readonly AuthorityRef[]) {
  if (refs.length > 10010) throw Error("authority_bound_exceeded");
  const unique = [...new Map(refs.map(ref => [JSON.stringify(ref), ref])).values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const rows = (await client.query(`SELECT r.kind,r.id,h.revision FROM jsonb_to_recordset($2::jsonb) AS r(kind text,id text)
    LEFT JOIN LATERAL (SELECT revision FROM bsmoss_integration.authority_change WHERE workspace_id=$1
      AND entity_kind=r.kind AND entity_id=r.id ORDER BY revision DESC LIMIT 1) h ON true ORDER BY r.kind,r.id`, [workspaceId, JSON.stringify(unique)])).rows;
  if (rows.length !== unique.length || rows.some(row => !row.revision)) throw Error("authority_history_required");
  return normalizeAuthorityRevisions(rows.map(row => ({ kind: row.kind as AuthorityRef["kind"], id: row.id as string, revision: row.revision as string })));
}
