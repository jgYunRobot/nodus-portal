#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v npm >/dev/null 2>&1; then
    echo "error: npm command not found." >&2
    exit 127
fi

cd "${project_root}"

run_command=(npm run dev -- "$@")
printf '[run_app] command:'
printf ' %q' "${run_command[@]}"
printf '\n'
exec "${run_command[@]}"
