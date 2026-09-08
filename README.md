# IT Useful

IT Useful is a local multilingual knowledge base for IT definitions. It provides
a searchable table and detail cards with Markdown explanations, examples, and
images in English, German, and Russian. Definitions and images can be created,
changed, and deleted from the browser.

The application uses Java 21 with Spring Boot, React with TypeScript and
Tailwind CSS, PostgreSQL with Flyway, and Docker Compose.

The current application version is 0.1.0. See [`CHANGELOG.md`](CHANGELOG.md)
for release notes and known limitations. The release procedure is documented in
[`docs/RELEASE.md`](docs/RELEASE.md).

## Prerequisites

Run project commands in Ubuntu on WSL, from the Linux filesystem:

```bash
cd ~/workspace/icebreaker/it-useful
```

Install or provide these tools:

- Git;
- Docker Desktop with Ubuntu WSL integration and Docker Compose;
- Java 21 JDK;
- Node.js 24 and npm through nvm.

The detailed installation instructions are in
[`docs/DEVELOPMENT_SETUP.md`](docs/DEVELOPMENT_SETUP.md). Verify everything with:

```bash
./scripts/verify-toolchain.sh
```

## Start the complete application

The recommended local start uses Docker for all three services:

```bash
./scripts/project.sh start
```

The first run creates `.env` from `.env.example`, builds the images, starts the
services, and waits for their health checks. Open <http://127.0.0.1:3000>.
PostgreSQL is exposed only on WSL loopback for database tools. The backend is
available only through the frontend's `/api` proxy.

Stop the application without deleting data:

```bash
./scripts/project.sh stop
```

## Root helper commands

Run `./scripts/project.sh help` to see the current command list.

| Command | Purpose |
| --- | --- |
| `./scripts/project.sh start` | Build and start the complete application |
| `./scripts/project.sh stop` | Stop services and preserve data |
| `./scripts/project.sh status` | Show service and health status |
| `./scripts/project.sh logs [service]` | Follow all logs or one service |
| `./scripts/project.sh build` | Build the backend and frontend images |
| `./scripts/project.sh test` | Run backend and frontend checks |
| `./scripts/project.sh test-full-stack` | Test the real local application workflow |
| `./scripts/project.sh test-compose` | Test the production-style images |
| `./scripts/project.sh test-acceptance` | Run clean-install, restart, persistence, and recovery acceptance |
| `./scripts/project.sh test-backup` | Validate backup creation with an isolated Compose project |
| `./scripts/project.sh audit-release` | Check tracked files for credentials and generated output |
| `./scripts/project.sh backup [directory]` | Back up PostgreSQL and uploaded images together |

The helper returns a nonzero status when a command or test fails. It can be run
from any directory because it resolves the repository root itself.

## Development mode

Development mode runs PostgreSQL in Docker and starts Spring and Vite directly
inside WSL. Start only PostgreSQL first:

```bash
cd ~/workspace/icebreaker/it-useful
docker compose up --detach --wait postgres
```

Then start the backend in one terminal. Disabling Spring's automatic Compose
integration prevents it from also starting the containerized backend and frontend:

```bash
cd ~/workspace/icebreaker/it-useful/backend
SPRING_DOCKER_COMPOSE_ENABLED=false ./mvnw spring-boot:run
```

The local Spring profile applies Flyway migrations and adds two example
definitions without duplicating them. The backend health endpoint is
<http://127.0.0.1:8080/actuator/health>.

Start the frontend in a second terminal:

```bash
cd ~/workspace/icebreaker/it-useful
source "$HOME/.nvm/nvm.sh"
nvm use
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Vite sends `/api` requests to the local backend.
Use Ctrl+C in each terminal to stop the development servers. Stop PostgreSQL
with `docker compose stop postgres` when it is no longer needed.

## Configuration

`.env.example` contains safe local defaults. Copy it to the ignored `.env` file
before changing values manually. Docker Compose reads `.env`; direct Spring
development reads exported environment variables or the defaults below.

| Variable | Default | Meaning |
| --- | --- | --- |
| `DB_NAME` | `it_useful` | PostgreSQL database name |
| `DB_USER` | `it_useful` | PostgreSQL user |
| `DB_PASSWORD` | `it_useful_local` | Local PostgreSQL password |
| `DB_PORT` | `5432` | Loopback PostgreSQL port |
| `FRONTEND_PORT` | `3000` | Container frontend port on the host |
| `BACKEND_PORT` | `8080` | Direct Spring development port |
| `SERVER_ADDRESS` | `127.0.0.1` | Direct Spring bind address |
| `UPLOAD_DIR` | `../uploads` | Direct Spring upload directory |
| `MAX_FILE_SIZE` | `10MB` | Spring multipart file limit |
| `MAX_REQUEST_SIZE` | `12MB` | Spring multipart request limit |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Application upload limit in bytes |

If `DB_PORT`, `FRONTEND_PORT`, or `BACKEND_PORT` is already occupied, choose an
unused loopback port in `.env`. Do not commit `.env` or use production secrets in
this local-only project.

## Database and migrations

Flyway owns the database schema. Spring applies pending migrations at startup,
then Hibernate validates the result. Existing migration files under
`backend/src/main/resources/db/migration` are immutable after merge. Add schema
changes as a new versioned migration such as `V2__describe_change.sql`.

Compose stores PostgreSQL data in the `postgres_data` named volume. Normal
`start` and `stop` commands keep it. The local profile also uses the Compose
database, while integration tests create separate disposable PostgreSQL
containers on random ports.

The schema and relationships are documented in
[`docs/data-model.md`](docs/data-model.md).

## Uploads and persistent data

The Compose application stores uploaded files in the `upload_data` named volume.
Direct Spring development stores them under the configured `UPLOAD_DIR`, which
defaults to the repository's ignored `uploads/` directory. JPEG, PNG, and WebP
are accepted up to 10 MiB by default. Both declared MIME type and file signature
are checked.

Deleting an image removes its metadata and file. Deleting a definition removes
all its translations and images. Back up both the PostgreSQL data and upload
storage together if the local content matters.

Create a consistent backup in the default sibling directory with:

```bash
./scripts/project.sh backup
```

The command briefly stops the application services to prevent writes, captures
the database and upload volume, verifies the resulting archive, and restores the
previous service state. See [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md) for
the format, custom destinations, storage guidance, and current restore status.

## Tests

Docker must be running for backend integration and full-stack tests. Install the
Playwright browser once with `cd frontend && npx playwright install chromium`.

| Command | Coverage |
| --- | --- |
| `./scripts/project.sh test` | Backend unit/integration tests plus frontend quality and mocked browser tests |
| `./scripts/project.sh test-backend` | Maven unit and disposable PostgreSQL integration tests |
| `./scripts/project.sh test-frontend` | Formatting, lint, types, Vitest, build, and mocked Playwright tests |
| `./scripts/project.sh test-full-stack` | Real browser workflow through Spring and a disposable database |
| `./scripts/project.sh test-compose` | Clean image build and real workflow through the Compose stack |
| `./scripts/project.sh test-acceptance` | Clean checkout, restart persistence, and failure recovery acceptance |
| `./scripts/project.sh test-backup` | Backup manifest, checksums, database content, image bytes, and service-state recovery |
| `./scripts/project.sh audit-release` | Tracked-file, credential-signature, size, and file-mode audit |

Detailed isolation, cleanup, reports, and optional Playwright arguments are
documented in [`docs/TESTING.md`](docs/TESTING.md).

GitHub Actions runs the release audit, backend suite, frontend suite, and
dependency review for pull requests. The workflow design, local reproduction
commands, Dependabot schedule, and recommended branch protection are documented
in [`docs/CONTINUOUS_INTEGRATION.md`](docs/CONTINUOUS_INTEGRATION.md).

## API and application routes

The REST API is rooted at `/api`. The complete request, response, error, language,
and image contracts are in [`docs/api.md`](docs/api.md). In development mode:

- Swagger UI: <http://127.0.0.1:8080/swagger-ui.html>
- OpenAPI JSON: <http://127.0.0.1:8080/v3/api-docs>

Swagger and OpenAPI are disabled in the container profile. Browser routes are
`/`, `/elements/new`, `/elements/{id}`, and `/elements/{id}/edit`.

## Safe data reset

`./scripts/project.sh stop` and `docker compose down` preserve the named volumes.
There is no automatic clean or reset during normal development.

To permanently delete the Compose database and every uploaded image, use the
explicit confirmation phrase:

```bash
./scripts/project.sh reset-data delete-local-data
```

This operation cannot be undone. It affects Compose volumes, not files in a
custom direct-development `UPLOAD_DIR`.

## Troubleshooting

- **Docker is unavailable:** start Docker Desktop and enable integration for the
  Ubuntu WSL distribution. Confirm with `docker info`.
- **Wrong Java or Node version:** run `./scripts/verify-toolchain.sh`, then select
  Java 21 and run `nvm install && nvm use` from the repository root.
- **A port is already allocated:** change the corresponding port in `.env`, then
  run `./scripts/project.sh start` again.
- **A service is unhealthy:** run `./scripts/project.sh status`, followed by
  `./scripts/project.sh logs backend` or the affected service name.
- **Maven is not synchronized in IntelliJ:** reload the Maven project from
  `backend/pom.xml` and ensure the project SDK is Java 21.
- **Playwright cannot launch Chromium:** run
  `cd frontend && npx playwright install --with-deps chromium` in WSL.
- **The browser has stale frontend assets:** rebuild with
  `./scripts/project.sh start` and perform a hard refresh.

## Security and contribution workflow

IT Useful has no authentication and is intended for one trusted user on a local
machine. Do not publish, tunnel, or reverse-proxy it. Read
[`docs/security.md`](docs/security.md) before changing its exposure.

The implementation worksheet is in [`docs/WORKSHEET.csv`](docs/WORKSHEET.csv),
and the branch, pull-request, and review process is in
[`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md).
Future work is prioritized separately in the
[`post-MVP roadmap`](docs/roadmap.md) so it does not delay or change version 0.1.0.
