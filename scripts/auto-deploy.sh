#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $# -eq 1 ]] || { echo "Usage: $0 /absolute/path/to/server.env" >&2; exit 2; }
state_file="${AUTO_DEPLOY_STATE:-/var/lib/it-useful/deployed-commit}"
owner="$(stat -c %U "$project_root")"

# The timer runs as root, but Git refuses a checkout owned by another user, and
# root-owned files inside it would break the owner's later manual pulls.
checkout_git() {
  if [[ $EUID -eq 0 && "$owner" != root ]]; then
    runuser -u "$owner" -- git -C "$project_root" "$@"
  else
    git -C "$project_root" "$@"
  fi
}

# Bash reads a script while running it, and the merge below rewrites this file.
# Parsing everything as one function first keeps the old version consistent.
main() {
  checkout_git fetch --quiet origin main
  local target
  target="$(checkout_git rev-parse FETCH_HEAD)"
  # Only a successful start records the commit, so a failed start is retried.
  [[ "$target" != "$(cat "$state_file" 2>/dev/null)" ]] || return 0
  checkout_git merge-base --is-ancestor HEAD "$target" || {
    echo "WARNING: the checkout has commits that $target lacks, so it stays undeployed." >&2
    return 0
  }
  checkout_git merge --ff-only --quiet "$target"
  echo "Deploying $target."
  "$project_root/scripts/project.sh" server-start "$1"
  echo "$target" >"$state_file"
}

main "$@"; exit
