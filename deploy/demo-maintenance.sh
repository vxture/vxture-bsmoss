#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "$script_dir/assert-stack-root.sh" "${STACK_ROOT:?set STACK_ROOT}"
[[ ${IMAGE_REF-} =~ ^ghcr\.io/[a-z0-9_-]+/bsmoss-app@sha256:[a-f0-9]{64}$ ]]
operation=${1:?select schema, seed, rollup, or activate}
cd "$STACK_ROOT"
export APP_ENV_FILE="$STACK_ROOT/etc/app.env"
stack_env="$STACK_ROOT/etc/stack.env"
[[ -s $APP_ENV_FILE && -s $stack_env ]]
mkdir -p state
exec 9>state/deploy.lock
flock -n 9 || { echo 'Another delivery is running' >&2; exit 1; }
compose=(docker compose --env-file "$stack_env" -f docker-compose.yml)
maintenance=("${compose[@]}" -f docker-compose.demo.yml)
db_id=$("${compose[@]}" ps -q db)
[[ $db_id =~ ^[a-f0-9]{12,64}$ ]]
if [[ $operation == schema ]]; then
  # Additive schema only; run inside the existing database container.
  {
    printf '%s\n' 'BEGIN;' "SELECT pg_advisory_xact_lock(hashtextextended('bsmoss-demo-schema-v1',0));"
    printf '%s\n' "DO \$\$ BEGIN IF to_regnamespace('bsmoss_resource') IS NULL THEN RAISE EXCEPTION 'BS-MOSS baseline required'; END IF; END \$\$;"
    printf '%s\n' "SELECT (to_regnamespace('bsmoss_demo') IS NULL) AS install_demo \gset" '\if :install_demo'
    cat deploy/database/ddl/90_demo.sql
    printf '%s\n' '\endif' 'SELECT count(*) FROM bsmoss_demo.dataset;' 'COMMIT;'
  } | "${compose[@]}" exec -T db sh -c 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  echo 'Demo schema verified. No demonstration data loaded.'
  exit 0
fi
case "$operation" in seed|rollup|activate) ;; *) exit 2 ;; esac
pull_config=$(mktemp -d)
trap 'rmdir "$pull_config"' EXIT
DOCKER_CONFIG="$pull_config" "${maintenance[@]}" pull demo-maintenance
owner_run() {
  # Owner credentials stay on worker02, in a pipe to the one-shot container.
  docker inspect --format '{{json .Config.Env}}' "$db_id" |
    "${maintenance[@]}" run --rm -T --no-deps demo-maintenance "$1"
}
case "$operation" in
  seed) owner_run seed; exit 0 ;;
  rollup) owner_run rollup; owner_run verify; exit 0 ;;
esac
current=$(cat state/current-image)
[[ $current =~ ^ghcr\.io/[a-z0-9_-]+/bsmoss-app@sha256:[a-f0-9]{64}$ ]]
[[ $(cat state/current-workers) == off ]] || { echo 'Drain reviewed workers before storage cutover' >&2; exit 1; }
verified=$(owner_run verify)
printf '%s\n' "$verified"
dataset=$(sed -n 's/^{"dataset":"\([a-f0-9]\{64\}\)","status":"verified".*/\1/p' <<< "$verified")
[[ $dataset =~ ^[a-f0-9]{64}$ ]]
backup=$(mktemp "$STACK_ROOT/etc/.app-env-backup.XXXXXX")
candidate=$(mktemp "$STACK_ROOT/etc/.app-env-candidate.XXXXXX")
cp "$APP_ENV_FILE" "$backup"
rollback=0
cleanup() {
  local status=$?
  if [[ $rollback == 1 ]]; then
    mv -f "$backup" "$APP_ENV_FILE"
    if IMAGE_REF="$current" "${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 240 app; then
      echo 'Restored previous BS-MOSS image and application configuration.' >&2
    else
      echo 'Automatic BS-MOSS rollback failed; inspect the app service.' >&2
    fi
  fi
  rm -f "$candidate" "$backup"
  rmdir "$pull_config"
  return "$status"
}
trap cleanup EXIT
awk '!/^[[:space:]]*(BSMOSS_DEMO_STORAGE|BSMOSS_DEMO_DATASET)[[:space:]]*=/' "$APP_ENV_FILE" > "$candidate"
printf 'BSMOSS_DEMO_STORAGE=postgres\nBSMOSS_DEMO_DATASET=%s\n' "$dataset" >> "$candidate"
APP_ENV_FILE="$candidate" "${compose[@]}" run --rm -T --no-deps app node /app/maintenance/demo.cjs runtime-check
rollback=1
mv -f "$candidate" "$APP_ENV_FILE"
"${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 240 app
port=$("${compose[@]}" port app 3000)
curl --fail --silent --max-time 10 "http://${port}/api/ready" >/dev/null
"${compose[@]}" exec -T app node /app/maintenance/demo.cjs runtime-check
printf '%s\n' "$current" >state/previous-image
printf '%s\n' "$IMAGE_REF" >state/current-image
mv -f "$backup" "$STACK_ROOT/etc/app.env.previous-demo"
rollback=0
echo "BS-MOSS is serving PostgreSQL demo dataset $dataset"
