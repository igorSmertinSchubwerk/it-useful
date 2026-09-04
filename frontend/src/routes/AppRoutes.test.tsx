import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from '../App'

test.each([
  ['/elements/new', 'New definition'],
  ['/elements/123', 'Definition details'],
  ['/elements/123/edit', 'Edit definition'],
  ['/does-not-exist', 'Page not found'],
])('renders %s with a shared shell', (path, heading) => {
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '*', element: <App /> }], {
        initialEntries: [path],
      })}
    />,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading)
  expect(
    screen.getByRole('navigation', { name: 'Main navigation' }),
  ).toBeVisible()
  expect(document.title).toBe(`${heading} | IT Useful`)
})
