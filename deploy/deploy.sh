#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "$script_dir/assert-stack-root.sh" "${STACK_ROOT:?set STACK_ROOT}"
[[ ${IMAGE_REF-} =~ ^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$ ]] || { echo 'Immutable IMAGE_REF required' >&2; exit 1; }
cd "$STACK_ROOT"
export APP_ENV_FILE="$STACK_ROOT/etc/app.env"
stack_env_file="$STACK_ROOT/etc/stack.env"
[[ -f $APP_ENV_FILE ]] || { echo 'Runtime configuration missing' >&2; exit 1; }
[[ -f $stack_env_file ]] || { echo 'Stack configuration missing' >&2; exit 1; }
mkdir -p state
exec 9>state/deploy.lock
flock -n 9 || { echo 'Another delivery is running' >&2; exit 1; }
compose=(docker compose --env-file "$stack_env_file" -f docker-compose.yml)
workers="${BSMOSS_DEPLOY_WORKERS:?explicitly select on or off}"
[[ $workers == on || $workers == off ]] || { echo 'Invalid worker selection' >&2; exit 1; }
services=(app)
export WORKER_ENV_FILE="$STACK_ROOT/etc/worker.env"
export AGGREGATE_WORKER_CONFIG_FILE="$STACK_ROOT/etc/aggregate-worker.json"
export REPORT_WORKER_CONFIG_FILE="$STACK_ROOT/etc/report-worker.json"
worker_compose=("${compose[@]}" -f docker-compose.workers.yml)
if [[ $workers == on ]]; then
  for config in "$WORKER_ENV_FILE" "$AGGREGATE_WORKER_CONFIG_FILE" "$REPORT_WORKER_CONFIG_FILE"; do
    [[ -s $config ]] || { echo 'Reviewed worker configuration missing' >&2; exit 1; }
  done
  compose+=(-f docker-compose.workers.yml)
  services+=(aggregate-worker report-worker)
fi
"${compose[@]}" config --quiet
# The approved GHCR image is public. Isolate its pull from stale host credentials.
pull_config="$(mktemp -d)"
trap 'rmdir "$pull_config"' EXIT
DOCKER_CONFIG="$pull_config" "${compose[@]}" pull "${services[@]}"
if [[ $workers == on ]]; then
  # Validate the exact image and mounted config before replacing current workers.
  for service in aggregate-worker report-worker; do
    "${compose[@]}" run --rm --no-deps "$service" node /app/worker/worker.cjs validate
  done
fi
previous="$(cat state/current-image 2>/dev/null || true)"
if [[ $workers == off ]]; then
  # Only the two named workers are drained and removed. No volume removal and
  # no project-wide orphan sweep; the Web and database services are untouched.
  "${worker_compose[@]}" stop -t 120 aggregate-worker report-worker
  "${worker_compose[@]}" rm -f aggregate-worker report-worker
fi
"${compose[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 240 "${services[@]}"
port="$("${compose[@]}" port app 3000)"
if ! curl --fail --silent --max-time 10 "http://${port}/api/ready" >/dev/null; then
  echo 'Readiness failed; image state was not advanced. Inspect or roll back explicitly.' >&2
  exit 1
fi
if [[ -n $previous ]]; then printf '%s\n' "$previous" >state/previous-image; fi
printf '%s\n' "$IMAGE_REF" >state/current-image
printf '%s\n' "$workers" >state/current-workers
echo 'Delivery passed readiness.'
