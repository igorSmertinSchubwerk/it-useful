#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_dir="$(mktemp -d /tmp/it-useful-auto-deploy-test.XXXXXXXX)"
trap 'rm -rf -- "$test_dir"' EXIT

origin="$test_dir/origin.git"
checkout="$test_dir/checkout"
publisher="$test_dir/publisher"
deploy_log="$test_dir/deployments"
start_failure="$test_dir/start-fails"
export AUTO_DEPLOY_STATE="$test_dir/deployed-commit"

git_quiet() {
  git -c user.name=Test -c user.email=test@example.invalid "$@" >/dev/null 2>&1
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

git_quiet init --bare --initial-branch=main "$origin"
git_quiet clone "$origin" "$publisher"
mkdir "$publisher/scripts"
cp "$project_root/scripts/auto-deploy.sh" "$publisher/scripts/"
cat >"$publisher/scripts/project.sh" <<EOF
#!/usr/bin/env bash
[[ ! -e "$start_failure" ]] || exit 1
echo "\$*" >>"$deploy_log"
EOF
chmod +x "$publisher/scripts/project.sh"
git_quiet -C "$publisher" add .
git_quiet -C "$publisher" commit -m initial
git_quiet -C "$publisher" push origin main
git_quiet clone "$origin" "$checkout"

publish_commit() {
  git_quiet -C "$publisher" commit --allow-empty -m "$1"
  git_quiet -C "$publisher" push origin main
  git -C "$publisher" rev-parse HEAD
}

deploy() {
  "$checkout/scripts/auto-deploy.sh" /etc/it-useful/server.env
}

commit="$(publish_commit merged)"
deploy >/dev/null
[[ "$(git -C "$checkout" rev-parse HEAD)" == "$commit" ]] ||
  fail "a new commit was not checked out"
[[ "$(cat "$deploy_log")" == "server-start /etc/it-useful/server.env" ]] ||
  fail "a new commit was not started"

commit="$(publish_commit retried)"
touch "$start_failure"
if deploy >/dev/null 2>&1; then
  fail "a failed start did not fail the run"
fi
rm "$start_failure"
deploy >/dev/null
[[ "$(wc -l <"$deploy_log")" == 2 ]] || fail "a failed start was not retried on the next run"

deploy >/dev/null
[[ "$(wc -l <"$deploy_log")" == 2 ]] || fail "an up-to-date checkout was started again"

git_quiet -C "$checkout" commit --allow-empty -m "local hotfix"
commit="$(publish_commit diverged)"
warning="$(deploy 2>&1 >/dev/null)" || fail "a diverged checkout failed the run"
[[ "$(wc -l <"$deploy_log")" == 2 ]] || fail "a diverged checkout was started"
[[ "$warning" == *"$commit"* ]] || fail "a diverged checkout was skipped without a warning"

echo "Automatic deployment passed."
