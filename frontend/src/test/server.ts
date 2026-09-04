import { setupServer } from 'msw/node'

// Tests add only the handlers they need. Unexpected requests fail the test.
export const server = setupServer()
