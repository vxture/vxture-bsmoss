#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "$script_dir/assert-stack-root.sh" "${STACK_ROOT:?set STACK_ROOT}"
cd "$STACK_ROOT"
export APP_ENV_FILE="$STACK_ROOT/etc/app.env"
: "${IMAGE_REF:?set image digest to resolve compose configuration}"
compose=(docker compose --env-file "$STACK_ROOT/etc/stack.env" -f docker-compose.yml)
"${compose[@]}" up -d --wait db redis
# The owner connection stays inside the DB container; no owner password is logged.
"${compose[@]}" exec -T db sh -c 'set -eu; tmp="$(mktemp /tmp/bsmoss-init.XXXXXX)"; trap "rm -f $tmp" EXIT; cat >"$tmp"; psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -v ON_ERROR_STOP=1 -f "$tmp"' < <(
  printf '%s\n' "BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('bsmoss-empty-init',0));"
  printf '%s\n' "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('bsmoss_resource','vx_provision','local_authz','local_usage')) THEN RAISE EXCEPTION 'empty database required'; END IF; END \$\$;"
  cat deploy/database/ddl/00_baseline.sql deploy/database/ddl/97_runtime_grants.sql deploy/database/ddl/98_column_locks.sql
  printf '%s\n' 'COMMIT;'
)
