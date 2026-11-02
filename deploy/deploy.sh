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
"${compose[@]}" config --quiet
"${compose[@]}" pull app
previous="$(cat state/current-image 2>/dev/null || true)"
"${compose[@]}" up -d --wait --wait-timeout 120
port="$("${compose[@]}" port app 3000)"
if ! curl --fail --silent --max-time 10 "http://${port}/api/ready" >/dev/null; then
  echo 'Readiness failed; image state was not advanced. Inspect or roll back explicitly.' >&2
  exit 1
fi
if [[ -n $previous ]]; then printf '%s\n' "$previous" >state/previous-image; fi
printf '%s\n' "$IMAGE_REF" >state/current-image
echo 'Delivery passed readiness.'
