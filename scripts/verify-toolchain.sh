#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "${HOME}/.nvm/nvm.sh"
  nvm use --silent
fi

java_version="$(java --version 2>&1 | head -n 1)"
javac_version="$(javac --version 2>&1)"
node_version="$(node --version)"
npm_version="$(npm --version)"
node_path="$(command -v node)"

[[ "${java_version}" == *" 21."* ]] || {
  echo "Expected Java 21, received: ${java_version}" >&2
  exit 1
}

[[ "${javac_version}" == "javac 21."* ]] || {
  echo "Expected javac 21, received: ${javac_version}" >&2
  exit 1
}

[[ "${node_version}" == v24.* ]] || {
  echo "Expected Node.js 24, received: ${node_version}" >&2
  exit 1
}

[[ "${node_path}" != /mnt/c/* ]] || {
  echo "Node.js must be installed inside WSL, received: ${node_path}" >&2
  exit 1
}

docker --version
docker compose version
printf '%s\n' "${java_version}" "${javac_version}" "node ${node_version}" "npm ${npm_version}" "node path ${node_path}"
