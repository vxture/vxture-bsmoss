#!/usr/bin/env bash
set -euo pipefail
# An explicit, non-root POSIX directory; reject MSYS conversion and shell syntax.
[[ ${1-} =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid STACK_ROOT' >&2; exit 1; }
case "$1" in /etc|/usr|/var|/home|/root|/srv|/opt|/tmp) echo 'Dedicated product directory required' >&2; exit 1;; esac
