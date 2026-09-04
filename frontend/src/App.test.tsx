import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'
import { MemoryRouter } from 'react-router-dom'

test('shows the foundation and all three content languages', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'A home for your IT knowledge',
  )
  const languages = within(
    screen.getByRole('region', { name: 'Content languages' }),
  )
  for (const name of ['English', 'Deutsch', 'Русский']) {
    expect(languages.getByRole('heading', { name })).toBeVisible()
  }
  expect(screen.getByText(/Frontend foundation/)).toBeVisible()
})
