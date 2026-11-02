#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "$script_dir/assert-stack-root.sh" "${STACK_ROOT:?set STACK_ROOT}"
umask 077
: "${CONFIG_KIND:?set app or stack}"
[[ $CONFIG_KIND == app || $CONFIG_KIND == stack ]] || exit 1
mkdir -p "$STACK_ROOT/etc"
target="$STACK_ROOT/etc/$CONFIG_KIND.env"
tmp="$(mktemp "$STACK_ROOT/etc/$CONFIG_KIND.env.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
cat >"$tmp"
[[ -s $tmp ]] || { echo 'Empty runtime configuration refused' >&2; exit 1; }
grep -Eq '^[A-Z][A-Z0-9_]*=.+' "$tmp" || { echo 'Configuration has no values' >&2; exit 1; }
if [[ $CONFIG_KIND == app ]] && grep -Eq '^(POSTGRES_PASSWORD|DATABASE_ADMIN_URL|POSTGRES_DB_OWNER)=' "$tmp"; then
  echo 'Database owner configuration is forbidden in app.env' >&2
  exit 1
fi
if [[ -f $target ]]; then cp "$target" "$target.previous"; fi
mv "$tmp" "$target"
echo 'Configuration saved; restart requires an explicit delivery.'
