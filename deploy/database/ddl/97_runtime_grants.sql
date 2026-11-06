-- Precondition: DBA provisions bsmoss_svc as a non-owner, non-superuser role.
-- No credentials or role creation in product source.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bsmoss_svc' AND NOT rolsuper
    AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'unprivileged bsmoss_svc role required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database()
    AND pg_has_role('bsmoss_svc',datdba,'MEMBER')) THEN
    RAISE EXCEPTION 'bsmoss_svc must not own or inherit the database owner';
  END IF;
END $$;
REVOKE ALL ON SCHEMA bsmoss_resource,bsmoss_integration,bsmoss_catalog,bsmoss_metering,bsmoss_views,bsmoss_analysis FROM PUBLIC;
GRANT USAGE ON SCHEMA bsmoss_resource,bsmoss_integration,bsmoss_catalog,bsmoss_metering,bsmoss_views,bsmoss_analysis TO bsmoss_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA bsmoss_resource,bsmoss_integration,bsmoss_catalog,bsmoss_metering,bsmoss_views,bsmoss_analysis TO bsmoss_svc;
-- Master data, mappings, capability validation and metric publication use reviewed admin paths.
GRANT INSERT ON bsmoss_integration.raw_event,bsmoss_metering.measurement,bsmoss_metering.quality_decision,
  bsmoss_integration.source_intake_receipt,
  bsmoss_views.template_publication,bsmoss_views.template_selection_event,bsmoss_views.user_preference TO bsmoss_svc;
GRANT EXECUTE ON FUNCTION bsmoss_views.lock_analysis_selection(text) TO bsmoss_svc;
REVOKE ALL ON SCHEMA vx_provision,local_authz,local_usage FROM PUBLIC;
GRANT USAGE ON SCHEMA vx_provision,local_authz,local_usage TO bsmoss_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA vx_provision,local_authz,local_usage TO bsmoss_svc;
GRANT INSERT ON ALL TABLES IN SCHEMA vx_provision TO bsmoss_svc;

GRANT INSERT ON ALL TABLES IN SCHEMA bsmoss_analysis TO bsmoss_svc;
