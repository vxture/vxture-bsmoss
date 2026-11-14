#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "$script_dir/assert-stack-root.sh" "${STACK_ROOT:?set STACK_ROOT}"
cd "$STACK_ROOT"
export APP_ENV_FILE="$STACK_ROOT/etc/app.env"
: "${IMAGE_REF:?set immutable image digest}"
compose=(docker compose --env-file "$STACK_ROOT/etc/stack.env" -f docker-compose.yml)
"${compose[@]}" up -d --wait db redis >/dev/null
# DBA-reviewed role SQL arrives over stdin from a private environment secret.
# Never echo SQL or database errors that might contain a password literal.
if ! "${compose[@]}" exec -T db sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X --set=ON_ERROR_STOP=1 --single-transaction' >/dev/null 2>/dev/null; then
  echo 'Runtime role provisioning failed; schema initialization was not started.' >&2
  exit 1
fi
echo 'Runtime role provisioned; schema initialization remains a separate step.'
