import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from './server'

test('supports accessible user interactions', async () => {
  const onClick = vi.fn()
  render(<button onClick={onClick}>Test action</button>)
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Test action' }))
  expect(onClick).toHaveBeenCalledOnce()
})

test('intercepts test HTTP requests without needing the backend', async () => {
  server.use(
    http.get('http://localhost/api/test-example', () =>
      HttpResponse.json({ title: 'Example' }),
    ),
  )
  const response = await fetch('http://localhost/api/test-example')
  expect(await response.json()).toEqual({ title: 'Example' })
})
