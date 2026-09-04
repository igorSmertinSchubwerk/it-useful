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

`test:e2e` runs the existing mocked Chromium suite on port 4174. It exercises
UI behavior, failures, keyboard interaction and accessibility without a backend.

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

## Backend checks

Run `./scripts/test-backend.sh` from the root for Maven unit and disposable-database
integration tests. The full-stack runner is complementary and does not replace it.
