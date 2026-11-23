# Testing

Run project commands inside WSL with Java 21 and the Node version in `.nvmrc`.
Install frontend packages with `npm ci` in `frontend`, and Chromium once with
`npx playwright install chromium`. Docker must be available for backend integration
and full-stack tests. Playwright may also require `npx playwright install-deps chromium`.

## Fast frontend checks

```bash
cd ~/workspace/icebreaker/it-useful
source "$HOME/.nvm/nvm.sh"
nvm use
cd frontend
npm run check
npm run test:e2e
```

`check` runs formatting, lint, TypeScript, Vitest and the production build.
Vitest covers HTTP contracts, schemas, Markdown, localization, routes, loading,
empty/error states, language filtering, create/edit submissions, validation,
duplicate-submit prevention and delete confirmation. HTTP is mocked with MSW.
The dialog shim in component tests only implements open/close; native focus and
inertness are verified in Chromium, not simulated as browser behavior in jsdom.

`test:e2e` first runs the local-mode mocked Chromium suite on port 4174, then a
server-authentication build on port 4175. The authentication suite covers
anonymous, denied, owner, expired, CSRF logout, safe post-login return, private
cache removal, and accessibility states without contacting GitHub or a backend.

## Full-stack browser test

From the repository root with Node selected and Docker running:

```bash
./scripts/test-full-stack.sh
```

The runner packages the backend (without running Maven tests), starts a fresh
PostgreSQL 18.6 container with an in-memory filesystem and random loopback port,
then starts the packaged Spring application on another random loopback port.
The explicit `e2e` profile disables local example seeding. Compose integration
is disabled; command-line datasource and upload settings override development
settings. It does not use the development Compose database or `uploads/` folder.

A separate Playwright configuration builds the frontend and starts a loopback
preview on port 4175, proxying `/api` only to that test backend. It refuses to
reuse an occupied preview port. `VITE_API_BASE_URL` is forced to `/api` during
the build. Do not set the internal `E2E_BACKEND_ORIGIN` yourself or invoke the
full-stack config against an existing application: the test writes and deletes
records. Use only the runner. Run suites sequentially; they share generated build
and report directories.

The browser test starts with an empty-catalogue assertion and uses no intercepted
API responses. It creates all three translations, switches languages, edits text,
uploads and displays a PNG, updates image alt text/order, reloads to verify stored
content, and deletes the definition. API reads confirm that the deleted definition
and its image return 404. This verifies reload persistence, not survival of a
backend/database restart or a production deployment.

The runner stops its Java process, removes its database container, and deletes its
own temporary upload directory on success, failure, or handled interruption.
Temporary test data is intentionally discarded and cannot be recovered.
On failure the backend log tail is printed before cleanup. Playwright traces and
the HTML report remain in ignored `frontend/test-results/fullstack/` and
`frontend/playwright-report/fullstack/`. A force-kill or host crash can prevent
cleanup; containers carry the label `it-useful.test=full-stack` for identification.
Never remove unrelated development containers or volumes to clean up a test.

Missing prerequisites, startup failure, no matching tests, and test failures
return a nonzero exit status. Optional Playwright arguments can follow the script,
for example `./scripts/test-full-stack.sh --headed` for an interactive WSL session.
First runs may download Maven dependencies and the PostgreSQL image.

## Container-stack browser test

Run the production-style images through an isolated Compose project:

```bash
./scripts/test-compose.sh
```

The runner builds the backend and frontend images; waits for PostgreSQL, Spring,
and Nginx health checks; verifies direct SPA navigation; and runs the same real
Playwright workflow through the Nginx `/api` proxy. Random loopback ports avoid
the development stack. The runner removes only its uniquely named Compose
project and disposable volumes afterward. On failure, it prints that project's
logs before cleanup. After a successful browser run, it also rejects `ERROR`,
`FATAL`, or `PANIC` entries from any service log. As with the full-stack runner,
do not invoke its Playwright configuration directly against an application
containing data.

## Assembled private-server security

Run the disposable server-profile topology suite with:

```bash
./scripts/project.sh test-server-security
```

The suite creates a mode-`600` environment file with dummy OAuth values, checks
unsafe permissions, missing secrets, and placeholders, validates the merged
Compose model, then builds and starts isolated server containers. It checks
loopback-only publication, forged proxy and identity headers, the exact callback,
session cookie attributes, CSP/HSTS and related headers, hidden management and
documentation endpoints, request size and rate limits, and recovery after each
service restarts. A real Chromium browser confirms that the server build loads
session state and hides private routes from an anonymous user. Backend integration
tests separately exercise every private route as anonymous, owner, and non-owner
and every mutation with missing and invalid CSRF tokens.

The suite never contacts GitHub and does not validate a real Tailscale edge. Its
containers, volumes, dummy environment file, and locally built images are removed
after the run, including on failure.

`test-server-topology` remains as a compatibility alias. The evidence boundary
and checks that must wait for a real host are documented in
[`SERVER_SECURITY_VERIFICATION.md`](SERVER_SECURITY_VERIFICATION.md).

## Backend checks

Run `./scripts/test-backend.sh` from the root for Maven unit and disposable-database
integration tests. The full-stack runner is complementary and does not replace it.

## Release acceptance

Run the destructive release workflow only through its isolated runner:

```bash
./scripts/project.sh test-acceptance
```

The runner archives committed `HEAD` into a new temporary directory, copies
`.env.example` to `.env`, and builds a uniquely named Compose project on random
loopback ports. Playwright then verifies required-form errors; EN, DE, and RU
content and examples; image rejection and upload; search; missing records;
duplicate slugs; a stopped-backend error; dependency recovery; persistence after
PostgreSQL and application-container restarts; editing; and cascading deletion.

The acceptance project never uses the normal development volumes. Its containers,
images, volumes, and temporary checkout are removed after success or failure; on
failure, service logs are printed first. Because the application-under-test comes
from committed `HEAD`, commit local product changes before relying on this command
as a release decision. Frontend dependencies and Chromium must already be
installed as described above.

## Release content audit

Before creating a release, inspect the tracked repository content:

```bash
./scripts/project.sh audit-release
```

The audit rejects tracked local environment files, generated build/test output,
runtime data, common credential file types, files over 5 MiB, unexpected executable
modes, high-confidence token/private-key signatures, merge-conflict markers, and
Git whitespace errors. The example environment files and `uploads/.gitkeep` are
intentional exceptions. This focused built-in scan does not replace organization
secret scanning or dependency/security analysis.
