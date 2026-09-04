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

The current page is a foundation preview, not connected to the backend.
React Router, TanStack Query, React Hook Form, Zod, the Hook Form resolver,
and React Markdown are installed for subsequent implementation groups.
Routing, the shared layout, and a standalone typed API client are implemented.
The pages do not call the client yet; forms and data-connected screens come later.

## API client

`src/api/elements.ts` provides `createElementsApi()` for list, detail, create,
update, delete, image upload, image metadata update, image deletion, and image
URLs. It performs no request until a method is called. Future feature hooks
will use it with TanStack Query.

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

API tests use MSW with Node's native Fetch/File/FormData implementations;
UI tests use jsdom. The transport suite checks methods, payloads, null values,
204 responses, uploads, validation/404/conflict errors, malformed bodies,
network failures, cancellation, and base URLs. These are mocked contract tests,
not a live backend integration test.

## Navigation preview

Routes: `/`, `/elements/new`, `/elements/:id`, `/elements/:id/edit`, and a
not-found page for other paths. For example, open `/elements/example-id` to
test the detail/edit navigation. This is not a saved example definition.
All element pages are placeholders and do not fetch or save data yet.
Use the interface-language selector in the header to switch between English,
German, and Russian. Navigation, placeholders, page titles, and accessibility
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

Interface messages are not definition translations. The existing three language
cards remain unchanged samples with their own `lang` attributes. Actual definition
translations remain backend data in PostgreSQL, with `EN`/`DE`/`RU` API codes;
the interface uses `en`/`de`/`ru`. No definition data or content-language preference
is written by the interface selector. Content selection will be implemented with
the data-connected list/detail pages, independently of this preference.

`localizeApiError(error, language)` maps API codes to interface messages without
changing the original error. Unknown errors use a translated fallback. Validation
field paths are preserved with a generic translated field prompt; detailed form
constraints will receive their own messages when the editor is implemented.
The helper is ready for future API-connected screens; placeholders do not trigger
API errors. Render these messages as text and handle cancellation separately.

The shell includes active navigation, a keyboard skip link, page titles, and
heading focus after client-side navigation. See [source structure](src/README.md)
for folder ownership and state-management conventions.

Vite supports direct links and refresh locally. A future production host must
serve `index.html` for frontend routes while excluding API and asset requests
from that fallback. Deployment configuration is outside this group.

## Testing

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

Playwright launches its own server on loopback port 4174 and stops it afterwards.
It refuses to reuse an existing server to avoid testing an unrelated app.
Stop another process using that port before running the test.
Browser tests check the three languages, direct links, refresh, history,
keyboard navigation, browser errors, and axe-core accessibility violations.
Automated accessibility checks do not replace manual
keyboard and assistive-technology testing.
HTML reports and failure traces are generated locally and ignored by Git.

Tailwind uses its Vite plugin and CSS-first theme in `src/index.css`.
The theme provides neutral surfaces, high-contrast text, blue accents,
system fonts (including Cyrillic fallback), and visible keyboard focus.
No external font or image requests are required.
