import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SafeMarkdown } from './SafeMarkdown'

test('renders CommonMark and remaps headings below the card title', () => {
  render(
    <SafeMarkdown>
      {
        '# Heading\n\n**Bold** and `code`\n\n- One\n- Two\n\n~~~js\nconst x = 1\n~~~'
      }
    </SafeMarkdown>,
  )
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText('const x = 1')).toBeVisible()
})
test('does not render raw HTML or unsafe links or load inline images', () => {
  const { container } = render(
    <SafeMarkdown>
      {
        '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[Unsafe](javascript:alert%281%29)\n\n[Data](data:text/html,test)\n\n![Diagram](https://untrusted.example/track.png)'
      }
    </SafeMarkdown>,
  )
  expect(container.querySelector('script,img,iframe')).toBeNull()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('Diagram')).toBeVisible()
})
test('retains safe links', () => {
  render(
    <SafeMarkdown>
      {'[Docs](https://example.com) and [Local](/elements/example-id)'}
    </SafeMarkdown>,
  )
  expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
    'href',
    'https://example.com',
  )
  expect(screen.getByRole('link', { name: 'Local' })).toHaveAttribute(
    'href',
    '/elements/example-id',
  )
})
