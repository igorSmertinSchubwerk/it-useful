const languages = [
  {
    code: 'en',
    name: 'English',
    description:
      'Your reference for IT definitions, explanations, and examples.',
  },
  {
    code: 'de',
    name: 'Deutsch',
    description:
      'Dein Nachschlagewerk für IT-Begriffe, Erklärungen und Beispiele.',
  },
  {
    code: 'ru',
    name: 'Русский',
    description: 'Твой справочник ИТ-терминов, объяснений и примеров.',
  },
]

function ElementListPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-wide text-brand">
        IT Useful
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
        A home for your IT knowledge
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
        Definitions, explanations, images, and examples in English, German, and
        Russian.
      </p>
      <section
        aria-label="Content languages"
        className="mt-10 grid gap-4 md:grid-cols-3"
      >
        {languages.map(({ code, name, description }) => (
          <article
            key={code}
            lang={code}
            className="rounded-xl border border-line bg-surface p-6"
          >
            <h2 className="text-lg font-semibold">{name}</h2>
            <p className="mt-3 leading-relaxed text-muted">{description}</p>
          </article>
        ))}
      </section>
      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
        Frontend foundation. The definition list, editing forms, and backend
        connection will be added in the next development groups.
      </p>
    </div>
  )
}

export default ElementListPage
