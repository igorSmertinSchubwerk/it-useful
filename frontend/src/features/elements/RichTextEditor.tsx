import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Heading } from '@tiptap/extension-heading'
import { Markdown } from '@tiptap/markdown'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/messages'

export interface RichTextHandle {
  focus: () => void
}
type Tool = {
  label: MessageKey
  glyph: ReactNode
  active: (editor: Editor) => boolean
  run: (editor: Editor) => void
}
const tools: Tool[][] = [
  [
    {
      label: 'formatBold',
      glyph: <b>B</b>,
      active: (editor) => editor.isActive('bold'),
      run: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'formatItalic',
      glyph: <i className="font-serif">I</i>,
      active: (editor) => editor.isActive('italic'),
      run: (editor) => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'formatStrike',
      glyph: <s>S</s>,
      active: (editor) => editor.isActive('strike'),
      run: (editor) => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: 'formatCode',
      glyph: <span className="font-mono text-xs">{'</>'}</span>,
      active: (editor) => editor.isActive('code'),
      run: (editor) => editor.chain().focus().toggleCode().run(),
    },
  ],
  [
    {
      label: 'formatHeading',
      glyph: 'H',
      active: (editor) => editor.isActive('heading'),
      run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'formatBullet',
      glyph: '•',
      active: (editor) => editor.isActive('bulletList'),
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'formatNumbered',
      // Drawn by CSS, so the digit is not read as the button's visible name.
      glyph: <span className="text-xs before:content-['1.']" />,
      active: (editor) => editor.isActive('orderedList'),
      run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'formatQuote',
      glyph: '❝',
      active: (editor) => editor.isActive('blockquote'),
      run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'formatCodeBlock',
      glyph: <span className="font-mono text-xs">{'{ }'}</span>,
      active: (editor) => editor.isActive('codeBlock'),
      run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
  ],
]
// The page keeps its single h1 and an unbroken heading order, so every heading
// shows as h2 under it. The saved Markdown keeps the level it had.
const FlatHeading = Heading.extend({
  renderHTML({ HTMLAttributes }) {
    return ['h2', HTMLAttributes, 0]
  },
}).configure({ levels: [1, 2, 3] })
const toolClass =
  'grid h-9 min-w-9 place-items-center rounded-lg px-2 font-semibold hover:bg-brand/10 aria-pressed:bg-brand aria-pressed:text-on-brand'
// Mirrors SafeMarkdown, so a text looks the same while editing and reading.
const contentClass =
  'min-h-40 space-y-4 break-words p-4 leading-relaxed outline-none [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_code]:font-mono [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-canvas [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-6'

/** A visual text editor that reads and reports its content as Markdown. */
export function RichTextEditor({
  id,
  labelledBy,
  describedBy,
  lang,
  value,
  onChange,
  required = false,
  invalid = false,
  disabled = false,
  ref,
}: {
  id: string
  labelledBy: string
  describedBy?: string
  lang: string
  value: string
  onChange: (markdown: string) => void
  required?: boolean
  invalid?: boolean
  disabled?: boolean
  ref?: Ref<RichTextHandle>
}) {
  const { t } = useI18n()
  const reported = useRef(value)
  const [link, setLink] = useState<string | null>(null)
  const attributes = {
    id,
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-labelledby': labelledBy,
    'aria-required': String(required),
    'aria-invalid': String(invalid),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    lang,
    class: contentClass,
  }
  const editor = useEditor({
    extensions: [
      // Markdown has no underline. A trailing empty paragraph would change a
      // saved text on load and end every code block with blank lines.
      StarterKit.configure({
        underline: false,
        heading: false,
        trailingNode: false,
      }),
      FlatHeading,
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editable: !disabled,
    editorProps: { attributes },
    onUpdate: ({ editor }) => {
      reported.current = editor.isEmpty ? '' : editor.getMarkdown()
      onChange(reported.current)
    },
  })
  useImperativeHandle(ref, () => ({ focus: () => editor.commands.focus() }), [
    editor,
  ])
  useEffect(() => {
    editor.setOptions({ editorProps: { attributes } })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the attributes object is rebuilt from these.
  }, [editor, invalid, describedBy, required])
  useEffect(() => editor.setEditable(!disabled, false), [editor, disabled])
  useEffect(() => {
    if (value === reported.current) return
    reported.current = value
    editor.commands.setContent(value, {
      contentType: 'markdown',
      emitUpdate: false,
    })
  }, [editor, value])
  const pressed = useEditorState({
    editor,
    selector: ({ editor }) => [
      ...tools.flat().map((tool) => tool.active(editor)),
      editor.isActive('link'),
    ],
  })
  const names = tools.flat().map((tool) => tool.label)
  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl border bg-surface focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand ${invalid ? 'border-red-800' : 'border-control'} ${disabled ? 'opacity-70' : ''}`}
    >
      <div
        role="toolbar"
        aria-label={t.formatToolbar}
        aria-controls={id}
        className="flex flex-wrap items-center gap-1 border-b border-line bg-canvas p-1.5"
      >
        {tools.map((group, index) => (
          <div
            key={index}
            className="flex flex-wrap gap-1 border-r border-line pr-1 last:border-r-0"
          >
            {group.map((tool) => (
              <button
                key={tool.label}
                type="button"
                disabled={disabled}
                title={t[tool.label]}
                aria-label={t[tool.label]}
                aria-pressed={pressed[names.indexOf(tool.label)]}
                className={toolClass}
                onClick={() => tool.run(editor)}
              >
                <span aria-hidden="true">{tool.glyph}</span>
              </button>
            ))}
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          title={t.formatLink}
          aria-label={t.formatLink}
          aria-pressed={pressed[names.length]}
          aria-expanded={link !== null}
          className={toolClass}
          onClick={() =>
            setLink(
              link === null
                ? ((editor.getAttributes('link').href as string) ?? '')
                : null,
            )
          }
        >
          <span aria-hidden="true">🔗</span>
        </button>
      </div>
      {link !== null && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas p-2">
          <input
            type="url"
            autoFocus
            value={link}
            aria-label={t.linkAddress}
            placeholder="https://"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5"
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              }
            }}
          />
          <button type="button" className={toolClass} onClick={applyLink}>
            {t.linkApply}
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )

  function applyLink() {
    const chain = editor.chain().focus().extendMarkRange('link')
    if (link?.trim()) chain.setLink({ href: link.trim() }).run()
    else chain.unsetLink().run()
    setLink(null)
  }
}
