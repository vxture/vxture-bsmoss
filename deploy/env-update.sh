#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "$script_dir/assert-stack-root.sh" "${STACK_ROOT:?set STACK_ROOT}"
umask 077
: "${CONFIG_KIND:?set app, stack, worker, aggregate-worker or report-worker}"
[[ $CONFIG_KIND == app || $CONFIG_KIND == stack || $CONFIG_KIND == worker || $CONFIG_KIND == aggregate-worker || $CONFIG_KIND == report-worker ]] || exit 1
mkdir -p "$STACK_ROOT/etc"
chmod 0700 "$STACK_ROOT/etc"
extension=env
[[ $CONFIG_KIND != aggregate-worker && $CONFIG_KIND != report-worker ]] || extension=json
target="$STACK_ROOT/etc/$CONFIG_KIND.$extension"
tmp="$(mktemp "$STACK_ROOT/etc/$CONFIG_KIND.$extension.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
cat >"$tmp"
[[ -s $tmp ]] || { echo 'Empty runtime configuration refused' >&2; exit 1; }
if [[ $CONFIG_KIND == stack ]] && grep -qx 'APP_BIND_HOST=tailnet' "$tmp"; then
  tailnet_ip="$(tailscale ip -4)"
  [[ $tailnet_ip =~ ^100\.([0-9]{1,3})\.[0-9]{1,3}\.[0-9]{1,3}$ ]] &&
    ((10#${BASH_REMATCH[1]} >= 64 && 10#${BASH_REMATCH[1]} <= 127)) || {
      echo 'A valid tailnet IPv4 address is required for the stack binding.' >&2
      exit 1
    }
  sed -i "s/^APP_BIND_HOST=tailnet$/APP_BIND_HOST=$tailnet_ip/" "$tmp"
fi
if [[ $extension == env ]]; then
  grep -Eq '^[A-Z][A-Z0-9_]*=.+' "$tmp" || { echo 'Configuration has no values' >&2; exit 1; }
else
  [[ $(wc -c <"$tmp") -le 32768 ]] || { echo 'Worker configuration exceeds limit' >&2; exit 1; }
  # Non-secret JSON must be readable by the non-root container through its
  # read-only bind mount. The enclosing etc directory remains private (0700).
  chmod 0644 "$tmp"
fi
if [[ $CONFIG_KIND == app || $CONFIG_KIND == worker ]] && grep -Eq '^(POSTGRES_PASSWORD|DATABASE_ADMIN_URL|POSTGRES_DB_OWNER)=' "$tmp"; then
  echo 'Database owner configuration is forbidden in runtime env' >&2
  exit 1
fi
if [[ -f $target ]]; then cp "$target" "$target.previous"; fi
mv "$tmp" "$target"
echo 'Configuration saved; restart requires an explicit delivery.'
