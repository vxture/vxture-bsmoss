import { getOidcConfig } from "../../auth/lib/config";
import { accessTokenFor } from "../../auth/lib/login-state";
import { verifyToken } from "../../auth/lib/oidc";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { TIERS } from "../../entitlement/types";
import { getPool } from "../../lib/db";
import { FIRST_METRICS } from "../catalog/first-metrics";
import { createAuthorizedReportPublication } from "./report-publication";
import { PgReportPublicationStore } from "../reports/pg-publication";
import { createAuthorizedReportExports } from "./report-exports";
import { PgReportExportStore } from "../reports/pg-exports";
import { PgMeasurementStore } from "../measurements/pg-store";
import { createAuthorizedMeasurements } from "./measurements";
import { createAuthorizedAggregates } from "./aggregates";
import { PgAggregateSnapshotReader } from "../aggregation/pg-snapshot";
import { PgAggregateStore } from "../aggregation/pg-store";
import type { AccessPorts, LocalGrant, VerifiedIdentity } from "./resolve";
import { readPgGrant } from "./pg-grants";
import { createAuthorizedAggregateQuery } from "./aggregate-query";
import { PgAggregateQueryReader } from "../aggregation/pg-query";
import { createAuthorizedObjectRollup } from "./object-rollup";
import { PgObjectRollupReader } from "../aggregation/pg-object-rollup";
import { createAuthorizedReports } from "./reports";
import { PgReportStore } from "../reports/pg-store";

// Only the opaque RP cookie is accepted. Identity and row scope are server-derived.
function sessionAccessPorts(rpsid: string): AccessPorts {
  const ports: AccessPorts = {
    async readVerifiedIdentity(): Promise<VerifiedIdentity | null> {
      const cfg = getOidcConfig();
      if (!cfg.enabled || !rpsid) return null;
      const token = await accessTokenFor(cfg, rpsid);
      if (!token) return null;
      const claims = await verifyToken(token, cfg);
      return {
        sub: claims.sub!, activeWorkspace: typeof claims.active_workspace === "string" ? claims.active_workspace : null,
        accountStatus: typeof claims.account_status === "string" ? claims.account_status : null,
        governanceRoles: Array.isArray(claims.roles) ? claims.roles : [], expiresAt: Number(claims.exp) * 1000,
      };
    },
    async readCoverage(workspaceId) {
      // A local archive is an immediate deny, even while C2 has an unexpired entry.
      const instance = await getPool().query("SELECT status FROM vx_provision.app_instance WHERE workspace_id=$1 AND product_code='bsmoss'", [workspaceId]);
      const ent = await getEntitlementResolver().resolve(workspaceId);
      const ready = instance.rows[0]?.status === "provisioned";
      return { workspaceId, product: "bsmoss", tier: ready ? ent.tier : null, bundled: ready && ent.bundled, expiresAt: Date.now() + 1000 };
    },
    async readLocalGrant({ workspaceId, sub }): Promise<LocalGrant | null> {
      return readPgGrant(getPool(), workspaceId, sub);
    },
    featuresFor(coverage, plane) {
      const covered = coverage.tier !== null && (TIERS as readonly string[]).includes(coverage.tier) || plane === "data" && coverage.bundled;
      return process.env.BSMOSS_METERING_ENABLED === "on" && covered ? ["metering"] : [];
    },
  };
  return ports;
}
export function measurementsForSession(rpsid: string) {
  return createAuthorizedMeasurements(sessionAccessPorts(rpsid), {
    create: scope => new PgMeasurementStore(getPool(), scope, FIRST_METRICS),
  }, "interactive");
}
export function aggregateQueryForSession(rpsid: string) {
  return createAuthorizedAggregateQuery(sessionAccessPorts(rpsid), {
    create: scope => new PgAggregateQueryReader(getPool(), scope),
  }, "interactive");
}
export function objectRollupForSession(rpsid: string) {
  return createAuthorizedObjectRollup(sessionAccessPorts(rpsid), {
    create: scope => new PgObjectRollupReader(getPool(), scope),
  }, "interactive");
}
// Interactive report commands share the same RP identity and finite scope as
// reads. HTTP origin validation is an additional boundary, not authorization.
export function reportsForSession(rpsid: string) {
  return createAuthorizedReports(sessionAccessPorts(rpsid), { create: scope => new PgReportStore(getPool(), scope) }, "interactive");
}
export function reportPublicationForSession(rpsid: string) {
  return createAuthorizedReportPublication(sessionAccessPorts(rpsid), { create: scope => new PgReportPublicationStore(getPool(), scope) }, "interactive");
}
export function reportExportsForSession(rpsid: string) {
  return createAuthorizedReportExports(sessionAccessPorts(rpsid), { create: scope => new PgReportExportStore(getPool(), scope) }, "interactive");
}
// Internal session composition only; no route or background identity is enabled.
export function aggregatesForSession(rpsid: string) {
  return createAuthorizedAggregates(sessionAccessPorts(rpsid), {
    reader: scope => new PgAggregateSnapshotReader(getPool(), scope),
    store: scope => new PgAggregateStore(getPool(), scope),
  }, "interactive");
}
