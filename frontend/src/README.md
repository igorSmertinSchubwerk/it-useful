# Source structure

- `api/`: typed transport, response contracts, element/image endpoint methods,
  and common HTTP error handling. No React or UI state in this layer.
- `components/`: shared, domain-independent UI and application layout.
- `features/elements/`: definition-specific components and query/mutation hooks as CRUD is added.
- `hooks/`: cross-feature React hooks, including route accessibility.
- `pages/`: route-level screens. Current element screens are explicit placeholders.
- `routes/`: route definitions. BrowserRouter lives at the entry point so tests can use MemoryRouter.
- `schemas/`: shared validation schemas when forms are implemented.
- `types/`: shared types; keep feature-only types beside their feature.
- `utils/`: pure helpers, such as safe URL builders.
- `test/`: test setup and MSW server; colocate unit tests with their code.

`App` creates one stable TanStack Query client per mounted application. Future
server data belongs in query/mutation hooks, not a separate global state store.
Local UI state stays in components; form state will use React Hook Form.
Empty directories are intentional reserved locations, not implemented APIs.

The shared layout owns navigation and landmarks. On client-side path changes,
the route accessibility hook updates the document title and focuses the page
heading. Pages must render one descriptive `h1`. Initial page loads retain the
browser's normal focus order so the skip link is the first keyboard target.

The layout follows the [React Router accessibility guidance](https://reactrouter.com/how-to/accessibility).
