# Release process

Releases are created from the protected `main` branch after the release changes
have been reviewed and merged. A release tag must never point to an unmerged pull
request commit.

## Prepare version 0.1.0

The release-preparation change aligns these version markers:

- `backend/pom.xml`: `0.1.0`
- `frontend/package.json`: `0.1.0`
- `frontend/package-lock.json`: `0.1.0`
- `CHANGELOG.md`: `0.1.0`

Review the changelog and its known limitations before merging the preparation
pull request.

## Verify the merged release

From a clean, up-to-date `main` checkout in WSL, run:

```bash
git switch main
git pull --ff-only origin main
./scripts/project.sh audit-release
./scripts/project.sh test-acceptance
git status --short
```

The audit and acceptance suite must pass, and `git status --short` must print no
changes. The acceptance runner builds the committed application in an isolated
checkout, verifies the complete browser workflow and restart persistence, and
removes its temporary containers and volumes.

## Create and publish the tag

After verification, confirm that the tag does not already exist and create an
annotated tag on the checked-out `main` commit:

```bash
git tag --list v0.1.0
git tag -a v0.1.0 -m "IT Useful 0.1.0"
git push origin v0.1.0
```

The first command must print nothing. After pushing, confirm that the local tag,
remote tag, and `main` all resolve to the intended release commit. The changelog
is the release-note source for the GitHub release page.

Do not move or recreate a published version tag. If the release needs a correction,
prepare and publish a new patch version.
