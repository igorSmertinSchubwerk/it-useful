import { Link, useParams } from 'react-router-dom'
import { elementPath } from '../utils/paths'

const titles = {
  create: 'New definition',
  detail: 'Definition details',
  edit: 'Edit definition',
}

export function ElementPage({ mode }: { mode: keyof typeof titles }) {
  const { id } = useParams()
  return (
    <article className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <p className="text-sm font-semibold text-muted">Navigation preview</p>
      <h1 className="mt-3 text-3xl font-bold">{titles[mode]}</h1>
      {id && (
        <p className="mt-4 break-all text-muted">
          Requested definition ID: {id}
        </p>
      )}
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        {mode === 'create'
          ? 'The creation form will be added in a later group. Nothing can be saved yet.'
          : 'Definition content is not loaded yet. This page does not confirm that the requested definition exists.'}{' '}
        Titles, text, images, and examples in English, German, and Russian will
        be connected later.
      </p>
      <div className="mt-6 flex flex-wrap gap-5">
        <Link to="/" className="text-brand underline">
          Back to definitions
        </Link>
        {id && (
          <Link
            to={elementPath(id, mode === 'detail')}
            className="text-brand underline"
          >
            {mode === 'detail' ? 'Open edit preview' : 'Open detail preview'}
          </Link>
        )}
      </div>
    </article>
  )
}
