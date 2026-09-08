# Continuous integration

GitHub Actions verifies every pull request and every push to `main`. The same
project scripts remain the source of truth locally and in CI.

## Required checks

The `CI` workflow runs independent jobs so failures are easy to locate:

- **Release audit** checks tracked files for secrets, generated output, unsafe
  file modes, oversized files, merge markers, and Git whitespace errors.
- **Backend tests** use Java 21 and Docker to run Maven unit tests and isolated
  PostgreSQL Testcontainers integration tests.
- **Frontend checks** use Node.js 24 to run formatting, lint, TypeScript, Vitest,
  the production build, and mocked Chromium tests. A failed run retains the
  Playwright report and traces for seven days.
- **Compose acceptance** builds a clean archived checkout and verifies startup,
  the real three-language workflow, uploads, outages, recovery, restart
  persistence, editing, and deletion through the production-style containers.
- **Container scan (backend)** and **Container scan (frontend)** build the runtime
  images and use Trivy to reject fixable High or Critical operating-system and
  application-library vulnerabilities.

The separate `Dependency review` workflow rejects dependencies newly introduced
by a pull request when GitHub reports a vulnerability of moderate severity or
higher. It is available for this public repository.

Both workflows have read-only repository permissions. External actions are
pinned to immutable commit hashes, with their release version recorded in a
comment. This includes Trivy because a mutable-tag supply-chain incident affected
that project in March 2026. Concurrent runs for an outdated branch revision are
cancelled.

## Reproduce failures locally

Run these commands in Ubuntu on WSL from the repository root:

```bash
./scripts/project.sh audit-release
./scripts/project.sh test-backend
./scripts/project.sh test-frontend
./scripts/project.sh test-acceptance
```

Docker must be running. The frontend command requires Chromium; install it once
with `cd frontend && npx playwright install chromium`. More detail is available
in [`TESTING.md`](TESTING.md).

## Dependency updates

Dependabot checks GitHub Actions, Maven, npm, the Compose PostgreSQL image, and
both Dockerfiles every Monday morning in the Europe/Berlin time zone. Action,
Maven, and npm changes are grouped by ecosystem to limit pull-request noise.
Every update still has to pass review and CI before it is merged.

Maven, npm, Playwright browsers, and the backend/frontend BuildKit layers are
cached by ecosystem-specific keys. Caches contain reproducible dependencies and
build layers only; secrets, application data, uploads, and test databases are not
cached.

## Branch protection

After the workflows have run successfully on `main`, configure the repository's
`main` branch ruleset to require a pull request and these status checks:

- `Release audit`
- `Backend tests`
- `Frontend checks`
- `Compose acceptance`
- `Container scan (backend)`
- `Container scan (frontend)`
- `Dependency review`

Do not require administrator bypass restrictions until the rules have been
tested with an ordinary update pull request. GitHub repository settings are not
managed by source code in this project.

## Scan policy and maintenance

Container scans report High and Critical findings and fail when a fix is
available. Unfixed findings remain visible without permanently blocking all
changes. Do not add an ignore entry merely to make CI green: document the
advisory, affected component, exposure, compensating controls, owner, and review
date before granting a time-limited exception.

Review runtimes, cache use, false positives, and failure artifacts after the
first month or sooner if normal pull requests become unreliable. Image publishing
and deployment remain outside CI and require the continuous-deployment track.
