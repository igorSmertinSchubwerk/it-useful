# IT Useful frontend

React and TypeScript with Vite and Tailwind CSS. Run commands inside WSL
using the Node.js 24 version selected by the root `.nvmrc`.

```bash
cd ~/workspace/icebreaker/it-useful
source "$HOME/.nvm/nvm.sh"
nvm use
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Stop the server with Ctrl+C.
The server binds to loopback only and fails clearly if its port is occupied.

- `npm run build`: TypeScript check and production output in `dist/`.
- `npm run lint`: ESLint checks with zero warnings allowed.
- `npm run typecheck`: strict TypeScript checks, including test configurations.
- `npm run format` / `npm run format-check`: apply / verify Prettier formatting.
- `npm test` / `npm run test:watch`: Vitest once / watch mode.
- `npm run check`: formatting, lint, types, unit tests, and production build.
- `npm run test:e2e`: Chromium smoke test against a fresh production preview.
- `npm run preview`: serve the production build at http://localhost:4173.

The start page now loads definitions from the backend and supports confirmed
deletion. Start Spring and PostgreSQL using the root project instructions to
see your saved definitions. Without the backend, a localized error and Retry
button are shown. Detail, create, and edit pages are connected to the same API.

## Definition table

Choose the definition language independently of the interface language. The
table shows that translation's title, slug, and last-updated date. Missing
translations are clearly labelled; they are not replaced with another language.
Dates use the interface locale and browser time zone. Title links open detail
routes; edit/create links open the corresponding forms.

Search matches the selected-language title or slug, case-insensitively, with
leading/trailing whitespace ignored. Sort by localized title in either direction
or by update time. Missing titles stay last for title sorting; equal values use
slug and ID as deterministic tie-breakers. Clear resets search and sorting but
keeps the chosen content language.

The URL stores `language=EN|DE|RU`, `q`, and `sort=title-asc|title-desc|newest|oldest`.
Invalid options fall back to English content and title ascending. Filter selections
survive reload and Back/Forward; typing replaces the current history entry to
avoid one entry per keystroke. Interface preference remains separate in localStorage.

TanStack Query owns the server list (`elementKeys.list`), with a 30-second stale
time and explicit Retry on errors. Search/sort/language changes reuse the same
list rather than fetching separate translations. Refresh errors retain the cached
table with a warning. The table scrolls horizontally inside its labelled,
keyboard-focusable region on narrow screens.

Filtering and sorting are deliberately client-side while the catalogue is small.
Before lists grow to thousands of records, or measured payload/render times make
interaction slow, add server-side search, sorting, and pagination together. Do not
paginate first and then search only the downloaded page.

Delete opens a native modal showing the selected title and slug, with initial
focus on Cancel. Cancel/Escape preserve the record and restore trigger focus.
Confirmation permanently deletes all translations and images too. Duplicate
submissions and dismissal are blocked while the request is pending; writes are
never automatically retried. Errors stay in the dialog for explicit retry or
cancel. After success, in-flight list reads are cancelled, the deleted row is
removed from cache, its detail cache is cleared, and the list is refreshed.
Focus returns to the page heading. A failed refresh shows a warning without
undoing the confirmed deletion locally.

## Definition detail card

Title links preserve the list's content language, search, and sorting in the
URL. The detail content selector works independently of interface language,
supports refresh and browser history, and the Back link restores list filters.
The edit form and its Cancel link also preserve these parameters.

The card loads all translations with `elementKeys.detail(id)` and a 30-second
stale time. Missing translations never fall back silently. Missing titles,
blank explanations, absent examples, and an empty gallery have localized
messages. Loading, failed requests, Retry, and Refresh are supported. A failed
refresh preserves cached content with a warning, except HTTP 404, which hides
cached content and the edit action because the definition no longer exists.

Explanation and examples use the same `SafeMarkdown` component and the installed
`react-markdown` CommonMark renderer. Raw HTML is disabled, no HTML plugins are
enabled, and the library's safe URL transform remains active. Inline Markdown
images display their alt text only: image requests are restricted to the separate
API-backed gallery. This avoids automatic third-party image requests from saved
Markdown. Links remain ordinary same-tab links. Markdown headings render below
the card title; code blocks scroll within the card and are keyboard-focusable.
GitHub-specific tables and syntax highlighting are not enabled.

Images are shared across translations, ordered by `displayOrder` and then ID,
and served through the configured API base. Alt text falls back to the file name
when absent; neither metadata field is automatically translated. Images are
responsive and lazy-loaded. Failed images retain their caption and offer a
localized retry without reloading the whole definition.

## Creating and editing definitions

The shared `ElementForm` uses React Hook Form and `schemas/elementSchema.ts`.
It always sends exactly EN, DE, RU translations in that order. Slugs accept
1–160 ASCII letters/numbers separated by single hyphens. The backend lowercases
slugs on save. Each language requires a title (maximum 255 UTF-16 code units)
and explanation (maximum 50,000). Examples are optional, at most 50,000 units.
Java-compatible blank checks and length checks mirror the backend DTO rules,
including supplementary characters such as emoji. Markdown whitespace is
preserved; empty/null examples are represented by empty editor text.

Language tabs support arrow keys, Home/End, and preserve entered values. Tabs
with errors are labelled; validation selects and focuses the first affected
field, including server-reported fields in a hidden tab. Error codes are
translated rather than showing raw server messages. Unknown field paths remain
general errors. Interface-language changes do not reset the draft.

Save prevents duplicate submissions, disables editing while pending, and never
retries automatically. Failure retains the draft. A network/server or malformed
success response can leave the save outcome uncertain: check the list before
retrying, especially when creating a definition. On success the detail cache is
updated, the list invalidated, and navigation replaces the editor entry with the
saved detail in the active translation language.

Edit uses a fresh, separate query snapshot per visit; focus/reconnect refetches
are disabled so they cannot replace the draft. The backend currently has no
optimistic version check: concurrent editors use last-write-wins. Existing images
are not part of the text update payload. The separate image manager below the
form handles uploads, metadata, ordering, and deletion.

`MarkdownPreview` renders the active translation's explanation/examples with
the same `SafeMarkdown` component as detail. Rendering is deferred while typing.
Raw HTML and unsafe URLs cannot execute, and inline Markdown image requests
remain disabled under the existing gallery policy.

The browser entry point now uses `createBrowserRouter`/`RouterProvider`, keeping
the existing route layout. React Router's [navigation blocker](https://reactrouter.com/how-to/navigation-blocking)
protects dirty forms on Cancel, header links, and browser Back/Forward. A native
modal offers Keep editing or Discard and leave; discarding is disabled during
save. Reload/close uses the browser's own `beforeunload` warning, subject to
browser restrictions (not a guaranteed recovery mechanism, especially on mobile).
Drafts are not persisted and are lost if navigation is confirmed or the browser
is terminated. A successful save bypasses the warning. Clean forms navigate
normally. Editor tests must use a data router such as `createMemoryRouter`.

## Managing images

Save a new definition first, then open Edit to manage its shared images.
Image operations save immediately, independently of the translated text form:
cancelling text edits does not undo successful image changes.

Choose a JPEG, PNG, or WebP file up to 10 MiB and review its local preview.
Empty, unsupported, oversized, and undecodable files are rejected before upload;
the backend remains authoritative for file signatures and configured limits.
Alt text accepts at most 500 UTF-16 code units. Display positions are unique
integers from 0 through 2147483647; smaller numbers appear first. Gaps are allowed.
To swap occupied positions, first move one image to an unused position.
Save each image's metadata explicitly; deletion requires confirmation.

Upload progress reports bytes sent, then waits for the server's success response.
Pending operations disable competing image/text saves. Selected files and changed
metadata participate in the unsaved-navigation warning. Finish or discard image
drafts before saving text. Discard only clears local drafts; Refresh images reads
the server gallery without replacing unsaved text. After an uncertain network or
server failure, discard image drafts and refresh before deciding whether to retry:
the server may have completed the operation. Writes are never automatically retried.

## API client

`src/api/elements.ts` provides `createElementsApi()` for list, detail, create,
update, delete, image upload, image metadata update, image deletion, and image
URLs. It performs no request until a method is called. List/detail queries and
the delete mutation in `src/features/elements/` use it with TanStack Query.

The default `VITE_API_BASE_URL` is `/api`. Vite's local `/api` proxy forwards
requests to Spring at `http://127.0.0.1:8080`, without rewriting the path.
Start the backend using the existing project setup when testing live requests.
The browser tests and unit tests still do not require a running backend.

To override the public API base, create `frontend/.env.local` using
`.env.example` as a reference and restart Vite (or rebuild production output).
Include the API prefix, for example `/api` or `https://api.example.com/api`.
Trailing slashes are normalized. Credentials, queries, fragments, and
non-HTTP(S) URLs are rejected. `VITE_` settings are visible in the browser:
never put passwords, tokens, or other secrets there.

An absolute cross-origin API URL requires backend CORS configuration, which
this group does not add. The Vite proxy is for local development/preview;
a production host must route `/api` separately from the frontend SPA fallback.
See [Vite environment variables](https://vite.dev/guide/env-and-mode.html) and
[proxy options](https://vite.dev/config/server-options#server-proxy).

Responses are checked with Zod against the backend DTO shapes. Language codes
are `EN`, `DE`, and `RU`; dates and IDs stay strings. Missing title translations
remain missing (no invented fallback). Optional examples and image alt text
can be null. Request types do not replace backend validation or future form
validation; creates/updates must contain all three translations.

`ApiError` exposes `status`, `code`, and `fieldErrors` (an array of field/message
pairs, retaining backend paths such as `translations[0].title`). HTTP status
comes from the response, not the error body. Network failures use a null status
and `network_error`; malformed success bodies use `invalid_response`. Non-JSON
HTTP errors get a safe fallback rather than exposing raw proxy HTML. Abort
signals are supported and cancellation is rethrown unchanged. The transport
does not retry writes automatically. Future UI code should translate error
codes and render messages as text, never HTML.

Uploads send `file`, optional `altText`, and optional `displayOrder` in FormData.
The browser supplies the multipart boundary. Image metadata updates require
an explicit `altText` (string or null), because the backend replaces it even
when only display order changes. Use `imageUrl(id)` for image display; it shares
the same API base as JSON requests.

Passing an upload-progress callback selects XMLHttpRequest with a 120-second
timeout, AbortSignal support, and the same response validation/error mapping as
the fetch transport. Without a callback, uploads use the existing fetch path.

API tests use MSW with Node's native Fetch/File/FormData implementations;
UI tests use jsdom. The transport suite checks methods, payloads, null values,
204 responses, uploads, validation/404/conflict errors, malformed bodies,
network failures, cancellation, and base URLs. These are mocked contract tests,
not a live backend integration test.

## Navigation

Routes: `/`, `/elements/new`, `/elements/:id`, `/elements/:id/edit`, and a
not-found page for other paths. Open a definition from the list to get its real
ID; `/elements/example-id` is not a seeded record and will show an API error.
The list, detail, create, and edit routes are connected.
Use the interface-language selector in the header to switch between English,
German, and Russian. Navigation, forms, page titles, and accessibility
labels follow the selected interface language.

## Interface and content languages

`src/i18n/messages.ts` is the typed interface-message catalogue. Every locale
must contain the same message keys. `useI18n()` exposes the current language,
its messages, and the language setter. No translation dependency is needed.

The preference is stored under `it-useful.ui-language` in localStorage for the
current browser origin. English is the default; invalid or inaccessible storage
also falls back to English. If saving is blocked, switching still works until
reload. Other open tabs pick up the saved setting on reload. Changing between
localhost and 127.0.0.1 uses a different storage origin.

The document's `lang` and title update with the interface. Switching language
keeps focus on the selector; navigating to another route focuses its heading.
The language names remain in their native spelling.

Interface messages are not definition translations. Definition translations
remain backend data in PostgreSQL, with `EN`/`DE`/`RU` API codes; the interface
uses `en`/`de`/`ru`. The table annotates titles with their content language.
No definition data or content-language preference is written by the interface
selector. The list's content selector only changes the URL/display, not records.

`localizeApiError(error, language)` maps API codes to interface messages without
changing the original error. Unknown errors use a translated fallback. Validation
field paths are preserved with a generic translated field prompt; detailed form
constraints will receive their own messages when the editor is implemented.
The list, detail, editor, and deletion dialog use this helper. Render these
messages as text and handle cancellation separately.

The shell includes active navigation, a keyboard skip link, page titles, and
heading focus after client-side navigation. See [source structure](src/README.md)
for folder ownership and state-management conventions.

Vite supports direct links and refresh locally. A future production host must
serve `index.html` for frontend routes while excluding API and asset requests
from that fallback. Deployment configuration is outside this group.

## Testing

The separate full-stack suite uses the actual Spring API and disposable PostgreSQL.
Run `./scripts/test-full-stack.sh` from the repository root; see
[testing instructions](../docs/TESTING.md) for prerequisites, isolation and cleanup.
The `npm run test:e2e` command below remains the fast mocked browser suite.

See the [accessibility and responsive review](../docs/UX_REVIEW.md) for the
three-language viewport matrix, keyboard checks, findings, and remaining manual
release checks. Run its focused regression with
`npx playwright test e2e/ux-quality.spec.ts`.

Install the Playwright Chromium browser once inside WSL:

```bash
npx playwright install chromium
npm run check
npm run test:e2e
```

If Playwright reports missing Linux system libraries, install them with
`npx playwright install-deps chromium` (this can require sudo).
Browser downloads require internet access.

Unit tests use jsdom, Testing Library, and user-event. MSW mocks only
test requests and rejects unhandled HTTP requests; it does not run in the app.
Unit tests verify page content, route matching, URL encoding, and interaction/HTTP tools.
The shared test server defaults the local list GET to an empty catalogue and
detail GETs to a test fixture; other unexpected requests still fail. Unit tests explicitly use the localhost
origin so relative API URLs match the mocks.

Playwright launches its own server on loopback port 4174 and stops it afterwards.
It refuses to reuse an existing server to avoid testing an unrelated app.
Stop another process using that port before running the test.
Browser tests check the three languages, direct links, refresh, history,
keyboard navigation, browser errors, and axe-core accessibility violations.
List tests intercept API traffic with test-only records and exercise filtering,
sorting, language independence, loading/empty/error states, safe deletion,
duplicate-submit prevention, focus restoration, and cache refresh. No real
records are deleted by these tests, and they do not replace live backend testing.
Detail tests cover translations, preserved navigation, loading/retry/404,
cached content after refresh failure, incomplete content, image order/retry,
safe Markdown, code overflow, and Russian mobile accessibility. Unit tests
also check Markdown HTML/script and unsafe-URL rejection.
Editor tests cover schema boundaries and backend field mapping, required fields,
hidden-tab errors, create/update requests, cached detail/list refresh, duplicate
submission prevention, failed-save drafts, unsaved navigation/reload warnings,
safe preview, and Russian mobile accessibility. All browser API writes are
intercepted test traffic, not a full-stack persistence test.
Image tests cover multipart uploads,
previews and validation, metadata ordering, confirmed deletion, duplicate requests,
pending-state guards, failure recovery, localized draft protection, and narrow-screen
accessibility. These use intercepted API responses, not live stored images.
Automated accessibility checks do not replace manual
keyboard and assistive-technology testing.
HTML reports and failure traces are generated locally and ignored by Git.

Tailwind uses its Vite plugin and CSS-first theme in `src/index.css`.
The theme provides neutral surfaces, high-contrast text, blue accents,
system fonts (including Cyrillic fallback), and visible keyboard focus.
No external font or image requests are required.
