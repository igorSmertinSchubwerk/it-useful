import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export async function openAccountMenu() {
  await userEvent.click(await screen.findByRole('button', { name: 'Account' }))
  return within(screen.getByRole('region', { name: 'Account' }))
}

export async function chooseInterfaceLanguage(menuLabel: string, name: string) {
  await userEvent.click(screen.getByRole('button', { name: menuLabel }))
  await userEvent.click(
    within(screen.getByRole('region', { name: menuLabel })).getByRole(
      'button',
      { name },
    ),
  )
}
