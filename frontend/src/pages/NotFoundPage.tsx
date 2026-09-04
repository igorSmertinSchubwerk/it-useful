import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="rounded-xl border border-line bg-surface p-8">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4 text-muted">
        This address does not match a page in IT Useful.
      </p>
      <Link to="/" className="mt-6 inline-block text-brand underline">
        Back to definitions
      </Link>
    </section>
  )
}
