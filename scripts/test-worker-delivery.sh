#!/usr/bin/env bash
set -euo pipefail
# Synthetic command adapters only; this script never invokes a real Docker/SSH.
repo="$(pwd)"
sandbox="$(mktemp -d /tmp/bsmoss-delivery-XXXXXXXX)"
cleanup() { [[ $sandbox == /tmp/bsmoss-delivery-* && $sandbox != /tmp ]] && rm -rf -- "$sandbox"; }
trap cleanup EXIT
mkdir -p "$sandbox/bin" "$sandbox/etc" "$sandbox/state"
export STACK_ROOT="$sandbox" CALLS="$sandbox/calls" IMAGE_REF="ghcr.io/fixture/bsmoss-app@sha256:$(printf 'a%.0s' {1..64})"
export PATH="$sandbox/bin:$PATH"
cat >"$sandbox/bin/docker" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CALLS"
if [[ $* == *' port app 3000'* ]]; then printf '%s\n' '127.0.0.1:12345'; fi
if [[ ${MOCK_VALIDATE_FAIL-} == on && $* == *'worker.cjs validate'* ]]; then exit 1; fi
if [[ ${MOCK_UP_FAIL-} == on && $* == *' up -d '* ]]; then exit 1; fi
MOCK
for name in curl flock; do printf '#!/usr/bin/env bash\nexit 0\n' >"$sandbox/bin/$name"; done
chmod +x "$sandbox/bin/"*
cp "$repo/docker-compose.yml" "$repo/docker-compose.workers.yml" "$sandbox/"
printf 'DATABASE_URL=fixture\n' >"$sandbox/etc/app.env"
printf 'PROJECT_NAME=fixture\n' >"$sandbox/etc/stack.env"
printf 'S2S_CLIENT_SECRET=fixture\n' >"$sandbox/etc/worker.env"
printf '{}\n' >"$sandbox/etc/aggregate-worker.json"
printf '{}\n' >"$sandbox/etc/report-worker.json"
export BSMOSS_DEPLOY_WORKERS=on
bash "$repo/deploy/deploy.sh" >/dev/null
[[ $(cat "$sandbox/state/current-image") == "$IMAGE_REF" && $(cat "$sandbox/state/current-workers") == on ]]
[[ $(grep -c 'worker.cjs validate' "$CALLS") == 2 ]]
grep -q 'pull app aggregate-worker report-worker' "$CALLS"
grep -q 'up -d --no-deps --force-recreate --wait --wait-timeout 240 app aggregate-worker report-worker' "$CALLS"
! grep -q 'stop -t' "$CALLS"
printf 'old-image\n' >"$sandbox/state/current-image"
export MOCK_VALIDATE_FAIL=on
if bash "$repo/deploy/deploy.sh" >/dev/null 2>&1; then exit 1; fi
[[ $(cat "$sandbox/state/current-image") == old-image ]]
unset MOCK_VALIDATE_FAIL
export MOCK_UP_FAIL=on
if bash "$repo/deploy/deploy.sh" >/dev/null 2>&1; then exit 1; fi
[[ $(cat "$sandbox/state/current-image") == old-image && $(cat "$sandbox/state/current-workers") == on ]]
unset MOCK_UP_FAIL
export BSMOSS_DEPLOY_WORKERS=off
: >"$CALLS"
bash "$repo/deploy/deploy.sh" >/dev/null
grep -q 'stop -t 120 aggregate-worker report-worker' "$CALLS"
grep -q 'rm -f aggregate-worker report-worker' "$CALLS"
grep -q 'up -d --no-deps --force-recreate --wait --wait-timeout 240 app' "$CALLS"
! grep -Eq 'remove-orphans|down|rm -v' "$CALLS"
[[ $(cat "$sandbox/state/current-workers") == off ]]
unset BSMOSS_DEPLOY_WORKERS
if bash "$repo/deploy/deploy.sh" >/dev/null 2>&1; then exit 1; fi
export CONFIG_KIND=worker
if printf 'POSTGRES_PASSWORD=fixture\n' | bash "$repo/deploy/env-update.sh" >/dev/null 2>&1; then exit 1; fi
grep -q '^S2S_CLIENT_SECRET=fixture$' "$sandbox/etc/worker.env"
printf 'S2S_CLIENT_SECRET=replacement-fixture\n' | bash "$repo/deploy/env-update.sh" >/dev/null
grep -q '^S2S_CLIENT_SECRET=fixture$' "$sandbox/etc/worker.env.previous"
for kind in aggregate-worker report-worker; do
  export CONFIG_KIND="$kind"
  printf '{"fixture":true}\n' | bash "$repo/deploy/env-update.sh" >/dev/null
  grep -q 'fixture' "$sandbox/etc/$kind.json"
done
echo '[worker-delivery] opt-in, exact-image validation, named-worker drain, failure state and private config boundaries passed (synthetic adapters only)'
