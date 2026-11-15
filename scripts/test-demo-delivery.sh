#!/usr/bin/env bash
set -euo pipefail
repo=$PWD
test_root=$(mktemp -d /tmp/bsmoss-demo-test-XXXXXX)
cleanup() { case "$test_root" in /tmp/bsmoss-demo-test-*) rm -rf -- "$test_root" ;; *) exit 1 ;; esac; }
trap cleanup EXIT
mkdir -p "$test_root"/{bin,stack/etc,stack/state,stack/deploy/database/ddl}
cp deploy/assert-stack-root.sh deploy/demo-maintenance.sh "$test_root/stack/deploy/"
cp deploy/database/ddl/90_demo.sql "$test_root/stack/deploy/database/ddl/"
export STACK_ROOT="$test_root/stack" TEST_ROOT="$test_root"
export IMAGE_REF="ghcr.io/vxture/bsmoss-app@sha256:$(printf 'b%.0s' {1..64})"
old_image="ghcr.io/vxture/bsmoss-app@sha256:$(printf 'a%.0s' {1..64})"
export old_image
cat >"$test_root/bin/docker" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [[ $1 == inspect ]]; then printf '%s\n' '["POSTGRES_USER=owner","POSTGRES_DB=bsmoss","POSTGRES_PASSWORD=fixture-only"]'; exit; fi
printf '%s|%s\n' "$IMAGE_REF" "$*" >>"$TEST_ROOT/operations"
case " $* " in
 *' ps -q db '*) printf 'a%.0s' {1..64}; echo ;;
 *' exec -T db '*) cat >"$TEST_ROOT/schema.sql" ;;
 *' pull demo-maintenance '*) ;;
 *' run --rm -T --no-deps demo-maintenance '* )
   input=$(cat); [[ $input == *POSTGRES_PASSWORD* ]]
   status=${!#}; [[ $status != verify ]] || status=verified
   printf '{"dataset":"%s","status":"%s"}\n' "$(printf 'c%.0s' {1..64})" "$status" ;;
 *' run --rm -T --no-deps app '* )
   grep -q '^BSMOSS_DEMO_STORAGE=postgres$' "$APP_ENV_FILE"
   grep -q '^BSMOSS_DEMO_DATASET=' "$APP_ENV_FILE" ;;
 *' up -d '* )
   count=$(cat "$TEST_ROOT/up-count" 2>/dev/null || echo 0); echo $((count+1)) >"$TEST_ROOT/up-count"
   if [[ ${FAIL_UP:-0} == 1 && $count == 0 ]]; then exit 1; fi ;;
 *' port app 3000 '*) echo '127.0.0.1:9999' ;;
 *' exec -T app '* ) ;;
 *) echo 'unexpected docker operation' >&2; exit 2 ;;
esac
STUB
printf '#!/usr/bin/env bash\nexit 0\n' >"$test_root/bin/curl"
printf '#!/usr/bin/env bash\nexit 0\n' >"$test_root/bin/flock"
chmod +x "$test_root/bin/"*
export PATH="$test_root/bin:$PATH"
initialize() {
 printf 'DATABASE_URL=fixture-service\nUNCHANGED=yes\n' >"$STACK_ROOT/etc/app.env"
 printf 'PROJECT_NAME=bsmoss-demo-test\n' >"$STACK_ROOT/etc/stack.env"
 printf '%s\n' "$old_image" >"$STACK_ROOT/state/current-image"
 printf 'off\n' >"$STACK_ROOT/state/current-workers"
 : >"$TEST_ROOT/operations"
 rm -f "$TEST_ROOT/up-count"
}
initialize
bash "$STACK_ROOT/deploy/demo-maintenance.sh" schema
grep -q 'CREATE TABLE bsmoss_demo.dataset' "$TEST_ROOT/schema.sql"
! grep -q '00_baseline' "$TEST_ROOT/schema.sql"
for stage in seed rollup; do
 bash "$STACK_ROOT/deploy/demo-maintenance.sh" "$stage"
 ! grep -q ' up -d ' "$TEST_ROOT/operations"
 ! grep -q 'fixture-only' "$TEST_ROOT/operations"
done
bash "$STACK_ROOT/deploy/demo-maintenance.sh" activate
[[ $(cat "$STACK_ROOT/state/current-image") == "$IMAGE_REF" ]]
grep -q '^UNCHANGED=yes$' "$STACK_ROOT/etc/app.env"
! grep -q '^BSMOSS_DEMO_STORAGE=' "$STACK_ROOT/etc/app.env.previous-demo"
initialize
if FAIL_UP=1 bash "$STACK_ROOT/deploy/demo-maintenance.sh" activate; then echo 'expected cutover failure' >&2; exit 1; fi
[[ $(cat "$STACK_ROOT/state/current-image") == "$old_image" ]]
! grep -q '^BSMOSS_DEMO_STORAGE=' "$STACK_ROOT/etc/app.env"
[[ $(cat "$TEST_ROOT/up-count") == 2 ]]
grep -Fq "$old_image|compose" "$TEST_ROOT/operations"
echo 'demo stages, credential pipe, activation and rollback verified'
