# Post-MVP roadmap

IT Useful 0.1.0 is a complete local, single-user application. This roadmap keeps
future work separate from the released MVP and orders it by risk, dependency, and
expected value. It is not a commitment to dates or to implementing every item.

## Prioritization rules

Choose the next item only when its trigger is real. Each item should have its own
worksheet or GitHub issue, implementation pull requests, tests, documentation,
and release notes.

1. Protect existing data and keep `main` reproducible.
2. Improve the current local workflow before adding deployment complexity.
3. Do not expose the application to other users or networks until the shared-use
   security gate is complete.
4. Keep Flyway migrations additive and preserve backward-compatible API behavior
   unless a versioned breaking change is approved.
5. Measure catalogue size and usage before adding scaling infrastructure.

## Recommended order

| Order | Track                        | Priority    | Start when                                                                         | Main outcome                                                    |
| ----- | ---------------------------- | ----------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | Continuous integration       | Now         | Immediately after 0.1.0                                                            | Every pull request runs repeatable quality and security checks. |
| 2     | Backup and restore           | Now         | Before important personal content accumulates                                      | Database records and image files can be restored together.      |
| 3     | Server search and pagination | Next        | The catalogue makes full-list loading or client filtering noticeably slow          | List requests return bounded, indexed, searchable pages.        |
| 4     | Authentication and roles     | Conditional | More than one trusted user or any non-loopback access is required                  | Every request has an identity and explicit authorization.       |
| 5     | Audit history                | Conditional | Shared editing, accountability, or recovery requires change history                | Important writes have searchable actor and change records.      |
| 6     | S3-compatible image storage  | Conditional | Multiple application instances, remote hosting, or storage portability is required | Image storage is durable and independent of one container host. |
| 7     | Continuous deployment        | Conditional | A supported shared environment exists                                              | Reviewed releases deploy predictably with rollback controls.    |
| 8     | Additional languages         | Later       | Users identify a specific language and translation ownership                       | Language support expands without weakening completeness checks. |

The private single-user server trigger is now real, so authentication and the
shared-use security gate are selected ahead of search/pagination. The approved
design and ordered implementation work are in
[`SERVER_SECURITY_PLAN.md`](SERVER_SECURITY_PLAN.md) and
[`SERVER_SECURITY_WORKSHEET.csv`](SERVER_SECURITY_WORKSHEET.csv). Search remains
deferred because the current catalogue has not demonstrated a scaling problem.

## 1. Continuous integration

Add GitHub Actions for pull requests and `main`. Keep deployment out of this
track.

Initial CI is implemented and documented in
[`CONTINUOUS_INTEGRATION.md`](CONTINUOUS_INTEGRATION.md): release audit, backend,
frontend, Compose acceptance, dependency review, dependency updates, container
scanning, and Maven/npm/Playwright/Docker caches now run automatically. Repository
branch protection requires pull requests, review, and all documented CI checks.

- Run the release-content audit.
- Run backend unit and Testcontainers integration tests.
- Run frontend formatting, lint, type checks, Vitest, and the production build.
- Run mocked Chromium tests. Add the isolated Compose acceptance suite when its
  runtime and GitHub Actions cost are acceptable.
- Add dependency and container-image scanning with reviewed failure policies.
- Cache Maven, npm, Playwright, and Docker layers without caching secrets or test
  data.

Done means branch protection can require stable checks, failures provide useful
logs, and the documented local commands remain the source of truth.

## 2. Backup and restore

Treat PostgreSQL and uploaded image bytes as one logical backup set.

Backup and restore are implemented and documented in
[`BACKUP_RESTORE.md`](BACKUP_RESTORE.md). They quiesce application writes, capture
both stores with a versioned manifest and checksums, validate archives before
replacement, create an automatic safety backup, and restore the previous service
state. CI runs the complete workflow against disposable Compose data.

- Add explicit backup and restore commands with a versioned manifest.
- Stop or quiesce writes so database metadata and image files represent the same
  point in time.
- Validate available disk space, archive integrity, schema version, and safe
  destination paths.
- Keep backups outside the repository and never include secrets in them.
- Test restoration into a disposable Compose project and verify definitions,
  translations, image order, and image bytes.
- Document retention, encryption, and recovery steps.

Done means a clean machine can restore a verified backup without editing files or
database rows manually.

## 3. Server search and pagination

Implement this only after collecting a representative large catalogue and a
performance baseline.

- Define page size, maximum size, stable sort order, search semantics, and response
  metadata in the API contract.
- Add PostgreSQL indexes supported by query-plan measurements.
- Preserve EN, DE, and RU language filtering and deterministic navigation.
- Update the frontend to retain search, sort, language, and page state in the URL.
- Test empty pages, invalid parameters, concurrent changes, Unicode search, and
  large datasets.

Done means list responses are bounded and measured interaction time remains
acceptable at the agreed catalogue size.

## Shared-use security gate

The remaining infrastructure tracks do not authorize public deployment. Before
any non-loopback or multi-user use, complete the requirements in
[`security.md`](security.md), including HTTPS, secret management, hardened proxy
headers, rate limits, monitoring, and upload-abuse controls.

For the approved private single-user target, completion also requires every item
in the deployment gate of
[`SERVER_SECURITY_PLAN.md`](SERVER_SECURITY_PLAN.md). Planning the gate does not
complete it; the current release remains local-only.

## 4. Authentication and roles

- Choose a maintained identity provider and one browser credential model.
- Define at least reader and editor permissions, including image access and
  destructive operations.
- Add Spring Security with default-deny authorization and CSRF protection where
  applicable.
- Protect or disable Swagger and operational endpoints.
- Test anonymous access, expired credentials, privilege escalation, record access,
  and every write endpoint.

Done means identity and authorization are enforced in the backend and verified
through the assembled deployment. Frontend route guards alone do not satisfy this
requirement.

## 5. Audit history

Start after identity is stable so records contain meaningful actors.

- Record create, update, image, and delete events with actor, timestamp, target,
  request correlation ID, and a safe change summary.
- Avoid passwords, tokens, full uploaded files, and unnecessary personal data.
- Define retention, access permissions, export, and tamper-resistance requirements.
- Keep application audit history separate from diagnostic logs.

Done means an authorized reviewer can explain who changed a record and when,
without exposing secrets or relying on container logs.

## 6. S3-compatible image storage

- Introduce a storage interface while keeping the local filesystem implementation.
- Add an S3-compatible implementation with private objects, generated keys,
  content validation, bounded downloads, and explicit deletion behavior.
- Define how database transactions and object writes recover from partial failure.
- Add migration, backup, restore, lifecycle, quota, and orphan-cleanup procedures.
- Test against a disposable compatible service before enabling remote storage.

Done means switching storage backends is configuration-driven and failure tests
do not leave inaccessible metadata or untracked objects.

## 7. Continuous deployment

Build this only for a defined environment after the shared-use security gate.

- Produce immutable, scanned images tied to a Git tag and source revision.
- Keep environment secrets outside Git and restrict deployment permissions.
- Apply database migrations once with a documented compatibility window.
- Add health-based rollout, rollback, backup-before-migration, and recovery drills.
- Verify HTTPS, security headers, monitoring, and alert ownership after deployment.

Done means a tagged release can be deployed and rolled back through an audited
process without manual server edits.

## 8. Additional languages

- Select languages from confirmed user demand and assign translation ownership.
- Replace the fixed language assumptions in database constraints, API validation,
  frontend types, routing, and completeness rules.
- Decide whether every definition must contain every enabled language or may have
  an explicit missing-translation state.
- Verify locale-aware sorting, text direction, fonts, input methods, search,
  accessibility pronunciation, and long-text layouts.

Done means a language can be added through a documented process and all interface
keys and definition rules are validated automatically.

## Review cadence

Review this roadmap after each release or when a trigger changes. Reorder work
using observed failures, data-loss risk, user demand, and measured performance.
Do not treat the numeric order as permission to expose the current local-only
application.
