#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 {DEV|PROD}" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage

target=${1^^}

cd "$(dirname "$0")"

for base in .env .twiliodeployinfo .twilioserverlessrc; do
  src="${base}_${target}"
  if [[ ! -e $src ]]; then
    echo "missing $src" >&2
    exit 1
  fi
  ln -sfn "$src" "$base"
  echo "$base -> $src"
done

twilio profiles:use "$target"
