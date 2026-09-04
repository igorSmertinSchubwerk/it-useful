import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { elementFixture } from './elementFixture'

// UI tests start with an empty catalogue. Tests override it as needed.
// All other unexpected requests still fail the test.
export const server = setupServer(
  http.get('http://localhost/api/elements', () => HttpResponse.json([])),
  http.get('http://localhost/api/elements/:id', ({ params }) =>
    HttpResponse.json({ ...elementFixture, id: params.id }),
  ),
)
