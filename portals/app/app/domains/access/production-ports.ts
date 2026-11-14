import type { Pool } from "pg";
import { TIERS } from "../../entitlement/types.ts";
import type { AccessPorts } from "./resolve.ts";
import { readPgGrant } from "./pg-grants.ts";

// Shared C2/C3 and product authorization policy, with lazy database acquisition.
export function productionAccessPorts(
  readVerifiedIdentity: AccessPorts["readVerifiedIdentity"],
  dependencies: {
    pool: () => Pool;
    coverage: (workspaceId: string) => Promise<{ tier: string | null; bundled: boolean }>;
    meteringEnabled: () => boolean;
    now?: () => number;
  },
): AccessPorts {
  const now = dependencies.now ?? Date.now;
  return {
    readVerifiedIdentity, now,
    async readCoverage(workspaceId) {
      const instance = await dependencies.pool().query("SELECT status FROM vx_provision.app_instance WHERE workspace_id=$1 AND product_code='bsmoss'", [workspaceId]);
      const ent = await dependencies.coverage(workspaceId), ready = instance.rows[0]?.status === "provisioned";
      return { workspaceId, product: "bsmoss", tier: ready ? ent.tier : null, bundled: ready && ent.bundled, expiresAt: now() + 1000 };
    },
    readLocalGrant: ({ workspaceId, sub }) => readPgGrant(dependencies.pool(), workspaceId, sub),
    featuresFor(coverage, plane) {
      const covered = coverage.tier !== null && (TIERS as readonly string[]).includes(coverage.tier) || plane === "data" && coverage.bundled;
      return dependencies.meteringEnabled() && covered ? ["metering"] : [];
    },
  };
}
