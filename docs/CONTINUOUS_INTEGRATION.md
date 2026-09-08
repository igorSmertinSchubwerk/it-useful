# Continuous integration

GitHub Actions verifies every pull request and every push to `main`. The same
project scripts remain the source of truth locally and in CI.

## Required checks

The `CI` workflow runs three independent jobs so failures are easy to locate:

- **Release audit** checks tracked files for secrets, generated output, unsafe
  file modes, oversized files, merge markers, and Git whitespace errors.
- **Backend tests** use Java 21 and Docker to run Maven unit tests and isolated
  PostgreSQL Testcontainers integration tests.
- **Frontend checks** use Node.js 24 to run formatting, lint, TypeScript, Vitest,
  the production build, and mocked Chromium tests. A failed run retains the
  Playwright report and traces for seven days.

The separate `Dependency review` workflow rejects dependencies newly introduced
by a pull request when GitHub reports a vulnerability of moderate severity or
higher. It is available for this public repository.

Both workflows have read-only repository permissions. External actions are
pinned to immutable commit hashes, with their release version recorded in a
comment. Concurrent runs for an outdated branch revision are cancelled.

## Reproduce failures locally

Run these commands in Ubuntu on WSL from the repository root:

```bash
./scripts/project.sh audit-release
./scripts/project.sh test-backend
./scripts/project.sh test-frontend
```

Docker must be running. The frontend command requires Chromium; install it once
with `cd frontend && npx playwright install chromium`. More detail is available
in [`TESTING.md`](TESTING.md).

## Dependency updates

Dependabot checks GitHub Actions, Maven, npm, the Compose PostgreSQL image, and
both Dockerfiles every Monday morning in the Europe/Berlin time zone. Action,
Maven, and npm changes are grouped by ecosystem to limit pull-request noise.
Every update still has to pass review and CI before it is merged.

## Branch protection

After the workflows have run successfully on `main`, configure the repository's
`main` branch ruleset to require a pull request and these status checks:

- `Release audit`
- `Backend tests`
- `Frontend checks`
- `Dependency review`

Do not require administrator bypass restrictions until the rules have been
tested with an ordinary update pull request. GitHub repository settings are not
managed by source code in this project.

## Deferred CI hardening

The production-style Compose acceptance suite and container-image vulnerability
scanning remain separate follow-up work. They require a deliberate runtime,
cache, reporting, and failure-policy decision before becoming required checks.
