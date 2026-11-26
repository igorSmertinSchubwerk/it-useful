#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $# -eq 1 ]] || { echo "Usage: $0 /absolute/path/to/server.env" >&2; exit 2; }
checks_api="${AUTO_DEPLOY_CHECKS_API:-https://api.github.com/repos/igorSmertinSchubwerk/it-useful/commits}"
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

# Prints "pending" until GitHub lists every check run as completed, then "passed" or "failed".
checks_verdict() {
  curl --fail --silent --show-error --max-time 30 "$checks_api/$1/check-runs" | python3 -I -c '
import json, sys
runs = json.load(sys.stdin)["check_runs"]
if not runs or any(run["status"] != "completed" for run in runs):
    print("pending")
elif all(run["conclusion"] in ("success", "skipped", "neutral") for run in runs):
    print("passed")
else:
    print("failed")'
}

# Bash reads a script while running it, and the merge below rewrites this file.
# Parsing everything as one function first keeps the old version consistent.
main() {
  checkout_git fetch --quiet origin main
  local target verdict
  target="$(checkout_git rev-parse FETCH_HEAD)"
  # Only a successful start records the commit, so a failed start is retried.
  [[ "$target" != "$(cat "$state_file" 2>/dev/null)" ]] || return 0
  checkout_git merge-base --is-ancestor HEAD "$target" || {
    echo "WARNING: the checkout has commits that $target lacks, so it stays undeployed." >&2
    return 0
  }
  verdict="$(checks_verdict "$target")"
  case "$verdict" in
    passed) ;;
    failed)
      echo "WARNING: CI failed for $target, so it stays undeployed." >&2
      return 0
      ;;
    *)
      echo "Waiting for CI on $target."
      return 0
      ;;
  esac
  checkout_git merge --ff-only --quiet "$target"
  echo "Deploying $target."
  "$project_root/scripts/project.sh" server-start "$1"
  echo "$target" >"$state_file"
}

main "$@"; exit
