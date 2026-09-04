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
Routing and the shared layout are implemented. API access and forms are not.

## Navigation preview

Routes: `/`, `/elements/new`, `/elements/:id`, `/elements/:id/edit`, and a
not-found page for other paths. For example, open `/elements/example-id` to
test the detail/edit navigation. This is not a saved example definition.
All element pages are placeholders and do not fetch or save data yet.
UI translation controls are planned in step 39; current navigation is English.

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
