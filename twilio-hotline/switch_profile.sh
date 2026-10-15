#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

usage() {
  local names=(.env_*)
  echo "Usage: $0 PROFILE   (settings exist for: ${names[*]#.env_})" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage

target=${1^^}

# Check everything before changing anything, so a bad name can't leave the
# settings files pointing at one account and the Twilio CLI at another.
for base in .env .twiliodeployinfo .twilioserverlessrc; do
  if [[ ! -e ${base}_${target} ]]; then
    echo "missing ${base}_${target}" >&2
    exit 1
  fi
done

# Fails (and stops the script) if no Twilio CLI profile has this name.
twilio profiles:use "$target"

for base in .env .twiliodeployinfo .twilioserverlessrc; do
  src="${base}_${target}"
  ln -sfn "$src" "$base"
  echo "$base -> $src"
done
