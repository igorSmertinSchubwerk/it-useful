import Markdown from 'react-markdown'

// No HTML/plugins or user-controlled image requests. Uploaded images live in
// the API-backed gallery. Keep the library's safe default URL transform.
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 break-words leading-relaxed [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_code]:font-mono [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-canvas [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-6">
      <Markdown
        skipHtml
        components={{
          pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
          h1: 'h3',
          h2: 'h3',
          h3: 'h3',
          h4: 'h3',
          h5: 'h3',
          h6: 'h3',
          img: ({ alt }) => <span>{alt}</span>,
          a: ({ href, children }) =>
            href ? (
              <a href={href} rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}
