import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { RichTextEditor } from './RichTextEditor'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <I18nProvider>
      <span id="body-label">Body</span>
      <RichTextEditor
        id="body"
        labelledBy="body-label"
        lang="en"
        value={value}
        onChange={setValue}
      />
      <output data-testid="markdown">{value}</output>
      <button type="button" onClick={() => setValue('1. one\n2. two')}>
        replace
      </button>
    </I18nProvider>
  )
}

test('RichTextEditor shows saved Markdown as formatted text', () => {
  render(<Harness initial={'A **request** and\n\n- Client\n- Server'} />)
  const editor = screen.getByRole('textbox', { name: 'Body' })
  expect(editor.querySelector('strong')).toHaveTextContent('request')
  expect(editor.querySelectorAll('li')).toHaveLength(2)
  expect(editor).not.toHaveTextContent('**')
})

// jsdom cannot type into the editor. The browser tests cover typing.
test('RichTextEditor reports pasted text as Markdown', async () => {
  render(<Harness />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('textbox', { name: 'Body' }))
  await user.paste('Hello')
  await waitFor(() =>
    expect(screen.getByTestId('markdown')).toHaveTextContent('Hello'),
  )
})

test('RichTextEditor formats with the toolbar and saves Markdown syntax', async () => {
  render(<Harness initial="plain" />)
  const user = userEvent.setup()
  const bullet = screen.getByRole('button', { name: 'Bullet list' })
  expect(bullet).toHaveAttribute('aria-pressed', 'false')
  await user.click(bullet)
  await waitFor(() =>
    expect(screen.getByTestId('markdown')).toHaveTextContent('- plain'),
  )
  expect(bullet).toHaveAttribute('aria-pressed', 'true')
})

test('RichTextEditor follows a value set from outside', async () => {
  render(<Harness initial="old" />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'replace' }))
  const editor = screen.getByRole('textbox', { name: 'Body' })
  await waitFor(() => expect(editor.querySelectorAll('ol li')).toHaveLength(2))
  expect(editor).not.toHaveTextContent('old')
})

test('RichTextEditor reports an emptied document as an empty string', async () => {
  render(<Harness initial="x" />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('textbox', { name: 'Body' }))
  await user.keyboard('{Control>}a{/Control}{Backspace}')
  await waitFor(() =>
    expect(screen.getByTestId('markdown')).toBeEmptyDOMElement(),
  )
})

test('RichTextEditor shows every heading as h2 and keeps its saved level', async () => {
  render(<Harness initial={'# How it works\n\nText'} />)
  const editor = screen.getByRole('textbox', { name: 'Body' })
  expect(editor.querySelector('h2')).toHaveTextContent('How it works')
  expect(editor.querySelector('h1')).toBeNull()
  const user = userEvent.setup()
  await user.click(editor)
  await user.paste('more')
  await waitFor(() =>
    // The caret sits at the start, so the pasted text joins the heading.
    expect(screen.getByTestId('markdown')).toHaveTextContent(
      /^# moreHow it works/,
    ),
  )
})

test('RichTextEditor does not report a change when it only loads saved text', async () => {
  const saved = '# Title\n\n~~~http\nGET / HTTP/1.1\n~~~'
  render(<Harness initial={saved} />)
  await screen.findByText('GET / HTTP/1.1', { selector: 'code' })
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByTestId('markdown').textContent).toBe(saved)
})

test('RichTextEditor saves a code block without trailing blank lines', async () => {
  render(<Harness initial="x" />)
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Code block' }))
  await waitFor(() =>
    expect(screen.getByTestId('markdown').textContent).toBe('```\nx\n```'),
  )
})
