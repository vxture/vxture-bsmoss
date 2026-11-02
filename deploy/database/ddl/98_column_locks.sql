-- Append-only evidence/config/result revisions; only selection pointers can change.
REVOKE UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA bsmoss_resource,bsmoss_integration,bsmoss_catalog,bsmoss_metering,bsmoss_views,bsmoss_analysis FROM bsmoss_svc;
GRANT UPDATE (template_code,template_version,changed_by,changed_at) ON bsmoss_views.template_selection TO bsmoss_svc;
REVOKE UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA vx_provision,local_authz,local_usage FROM bsmoss_svc;
GRANT UPDATE(status,updated_at,provisioned_at) ON vx_provision.app_instance TO bsmoss_svc;
GRANT UPDATE(last_seq,updated_at) ON vx_provision.provision_seq TO bsmoss_svc;

GRANT UPDATE(current_revision) ON bsmoss_analysis.aggregate_series TO bsmoss_svc;
GRANT UPDATE(current_revision) ON bsmoss_analysis.report_series TO bsmoss_svc;
GRANT UPDATE(status,attempt,available_at,updated_at,artifact_sha256) ON bsmoss_analysis.report_export_job TO bsmoss_svc;
GRANT UPDATE(attempt,status,lease_token,lease_until,available_at,updated_at) ON bsmoss_analysis.refresh_job TO bsmoss_svc;
