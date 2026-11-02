#!/usr/bin/env bash
set -euo pipefail
# Empty database only. DBA supplies the unprivileged bsmoss_svc login beforehand.
ddl_dir="$(cd "$(dirname "$0")/ddl" && pwd)"
: "${DATABASE_ADMIN_URL:?set owner connection for explicit db-init only}"
psql "$DATABASE_ADMIN_URL" -X -v ON_ERROR_STOP=1 --single-transaction \
  -c "SELECT pg_advisory_xact_lock(hashtextextended('bsmoss-empty-init',0))" \
  -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('bsmoss_resource','vx_provision','local_authz','local_usage')) THEN RAISE EXCEPTION 'empty database required'; END IF; END \$\$;" \
  -f "$ddl_dir/00_baseline.sql" -f "$ddl_dir/97_runtime_grants.sql" -f "$ddl_dir/98_column_locks.sql"
