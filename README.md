# IT Useful

IT Useful is a multilingual knowledge base for IT definitions. It will provide a searchable start-page table and detail cards containing titles, Markdown text, examples, and images in English, German, and Russian.

## Planned stack

- Java 21 and Spring Boot REST API
- React, TypeScript, and Vite
- Tailwind CSS
- PostgreSQL with Flyway migrations
- Docker Compose for local services
- Local image storage for the first version

## Repository structure

```text
it-useful/
├── backend/       Spring Boot application
├── frontend/      React application
├── docs/          Project documentation and implementation worksheet
├── uploads/       Local runtime uploads; contents are not committed
└── README.md
```

## Project status

The repository and WSL toolchain are configured. The Spring Boot and PostgreSQL foundation is the current implementation phase.

Development is performed in Ubuntu on WSL. The Windows Codex desktop app and editor may access the repository through WSL integration, but project commands should run inside WSL.

## Planning and contribution workflow

- The implementation checklist is in [`docs/WORKSHEET.csv`](docs/WORKSHEET.csv).
- The approval, branch, pull-request, and reporting process is in [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md).
- WSL prerequisites and toolchain verification are in [`docs/DEVELOPMENT_SETUP.md`](docs/DEVELOPMENT_SETUP.md).
- IntelliJ IDEA setup is in [`docs/INTELLIJ_SETUP.md`](docs/INTELLIJ_SETUP.md).
- The initial PostgreSQL schema is described in [`docs/data-model.md`](docs/data-model.md).

## Backend development

Start PostgreSQL and run the backend test suite:

```bash
./scripts/test-backend.sh
```

Run the backend locally from another terminal:

```bash
cd backend
./mvnw spring-boot:run
```

The health endpoint is available at `http://localhost:8080/actuator/health`.

The default local profile adds two example definitions (`api` and
`database-index`) with English, German, and Russian content when they are
missing. Restarting the backend does not duplicate them.

The element REST API is available at `/api/elements`:

- `GET /api/elements` lists definitions and localized titles.
- `POST /api/elements` creates a definition.
- `GET /api/elements/{id}` returns complete content and image metadata.
- `PUT /api/elements/{id}` updates the slug and all translations.
- `DELETE /api/elements/{id}` deletes the definition.

Create and update requests must contain exactly one `EN`, `DE`, and `RU`
translation. API failures use `application/problem+json` and include a stable
`code`; validation failures also include field-level `errors`.

Images are managed separately from the translated element content:

- `POST /api/elements/{elementId}/images` uploads an image as multipart form data.
- `GET /api/images/{imageId}` returns the stored image.
- `PATCH /api/images/{imageId}` updates its alternative text and display order.
- `DELETE /api/images/{imageId}` removes both the stored file and its metadata.

Uploads accept JPEG, PNG, and WebP files. The backend validates the actual file
signature as well as the declared content type, generates the storage filename,
and rejects files larger than 10 MiB by default. Configure the location and
limits with `UPLOAD_DIR`, `MAX_FILE_SIZE`, `MAX_REQUEST_SIZE`, and
`MAX_FILE_SIZE_BYTES`; see [`.env.example`](.env.example) for the defaults.

Interactive API documentation is available while the backend is running:

- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## Definition of done for the MVP

- Definitions can be listed, created, viewed, edited, and deleted.
- Every definition has English, German, and Russian content.
- Detail pages support safe Markdown, examples, and ordered images.
- Backend, frontend, integration, and end-to-end quality checks pass.
- A clean WSL checkout can be started using only documented commands.
