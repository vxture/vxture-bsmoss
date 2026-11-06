import { mappingManagement } from "../management/mapping-service";
import { mappingPreflight } from "../management/preflight-service";
import { PgMappingPreflightReader } from "../management/preflight-reader";
import { PgMappingReader } from "../management/mapping-reader";
import { sourceManagement } from "../management/source-service";
import { PgSourceReader } from "../management/source-reader";
import { managementService } from "../management/service";
import { PgManagementReader } from "../management/pg-reader";
import { getOidcConfig } from "../../auth/lib/config";
import { accessTokenFor } from "../../auth/lib/login-state";
import { verifyToken } from "../../auth/lib/oidc";
import { getEntitlementResolver } from "../../entitlement/resolver";
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
import type { AccessPorts, VerifiedIdentity } from "./resolve";
import { productionAccessPorts } from "./production-ports";
import { createAuthorizedAggregateQuery } from "./aggregate-query";
import { PgAggregateQueryReader } from "../aggregation/pg-query";
import { createAuthorizedObjectRollup } from "./object-rollup";
import { PgObjectRollupReader } from "../aggregation/pg-object-rollup";
import { createAuthorizedReports } from "./reports";
import { PgReportStore } from "../reports/pg-store";
import { createAuthorizedAggregateJobs } from "./aggregate-jobs";
import { PgAggregateJobStore } from "../supervision/pg-jobs";
import { createAuthorizedReportJobs } from "./report-jobs";
import { PgReportJobStore } from "../supervision/pg-report-jobs";
import { createAuthorizedReportRecovery } from "./report-recovery";
import { createAuthorizedAnalysis } from "./analysis";
import { PgAnalysisStore } from "../views/pg-analysis";
import { createAuthorizedTemplates } from "./templates";
import { PgTemplateStore } from "../views/pg-templates";
import { receivedDataUpdates } from "../data-updates/pg-tasks";
import { sourceIntakeTaskSupervision } from "../integration/pg-intake-tasks";

// Only the opaque RP cookie is accepted. Identity and row scope are server-derived.
function sessionAccessPorts(rpsid: string): AccessPorts {
  return productionAccessPorts(async (): Promise<VerifiedIdentity | null> => {
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
  }, {
    pool: getPool, coverage: workspaceId => getEntitlementResolver().resolve(workspaceId),
    meteringEnabled: () => process.env.BSMOSS_METERING_ENABLED === "on",
  });
}
export function measurementsForSession(rpsid: string) {
  return createAuthorizedMeasurements(sessionAccessPorts(rpsid), {
    create: scope => new PgMeasurementStore(getPool(), scope, FIRST_METRICS),
  }, "interactive");
}
export function analysisForSession(rpsid: string) {
  return createAuthorizedAnalysis(sessionAccessPorts(rpsid), { create: (scope, subject) => new PgAnalysisStore(getPool(), scope, subject) }, "interactive");
}
export function templatesForSession(rpsid: string) {
  return createAuthorizedTemplates(sessionAccessPorts(rpsid), { create: (scope, subject) => new PgTemplateStore(getPool(), scope, subject) }, "interactive");
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
export function aggregateJobsForSession(rpsid: string) {
  return createAuthorizedAggregateJobs(sessionAccessPorts(rpsid), { create: scope => new PgAggregateJobStore(getPool(), scope) }, "interactive");
}
export function dataUpdatesForSession(rpsid: string) {
  return receivedDataUpdates(getPool(), sessionAccessPorts(rpsid));
}
export function intakeTasksForSession(rpsid: string) {
  return sourceIntakeTaskSupervision(getPool(), sessionAccessPorts(rpsid));
}
export function reportJobsForSession(rpsid: string) {
  return createAuthorizedReportJobs(sessionAccessPorts(rpsid), { create: scope => new PgReportJobStore(getPool(), scope) }, "interactive");
}
export function reportRecoveryForSession(rpsid: string) {
  return createAuthorizedReportRecovery(sessionAccessPorts(rpsid), { create: scope => new PgReportJobStore(getPool(), scope) }, "interactive");
}
// Internal session composition only; no route or background identity is enabled.
export function aggregatesForSession(rpsid: string) {
  return createAuthorizedAggregates(sessionAccessPorts(rpsid), {
    reader: scope => new PgAggregateSnapshotReader(getPool(), scope),
    store: scope => new PgAggregateStore(getPool(), scope),
  }, "interactive");
}

export function managementForSession(rpsid: string) {
  return managementService(sessionAccessPorts(rpsid), { create: scope => new PgManagementReader(getPool(), scope) });
}

export function sourceManagementForSession(rpsid:string){return sourceManagement(sessionAccessPorts(rpsid),{create:scope=>new PgSourceReader(getPool(),scope)});}

export function mappingManagementForSession(rpsid: string) { return mappingManagement(sessionAccessPorts(rpsid), { create: scope => new PgMappingReader(getPool(), scope) }); }
export function mappingPreflightForSession(rpsid: string) { return mappingPreflight(sessionAccessPorts(rpsid), { create: scope => new PgMappingPreflightReader(getPool(), scope) }); }
