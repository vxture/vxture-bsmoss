#!/usr/bin/env bash
set -euo pipefail
# Explicit digest selection permits review of exactly what will run.
exec bash "$(dirname "$0")/deploy.sh"
