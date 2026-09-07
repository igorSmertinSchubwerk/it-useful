# Changelog

This file records user-visible changes and known limitations for each IT Useful
release.

## [0.1.0] - 2026-09-08

### Added

- A searchable and sortable definition table with create, edit, detail, and
  delete workflows.
- English, German, and Russian interface text and definition content.
- Definition detail cards with Markdown explanations, examples, and ordered
  image galleries.
- JPEG, PNG, and WebP upload validation, alternative text, image ordering, and
  image deletion.
- A Spring Boot REST API backed by PostgreSQL and versioned Flyway migrations.
- A React and TypeScript frontend styled with Tailwind CSS.
- Docker Compose startup with health checks and persistent database and upload
  volumes.
- Unit, integration, browser, full-stack, container, acceptance, accessibility,
  and tracked-content checks.
- WSL, IntelliJ IDEA, PhpStorm, development, testing, API, data-model, security,
  and release documentation.

### Known limitations

- The application has no authentication or authorization. It is designed for
  one trusted user on a local machine and must not be exposed publicly.
- PostgreSQL data and uploaded images use local Docker volumes. Automated backup,
  restore, and remote object storage are not included.
- English, German, and Russian are the only supported content and interface
  languages.
- Browser automation targets Chromium. Firefox, Safari, native mobile devices,
  browser zoom, screen readers, and OS high-contrast modes still need manual
  release checks.
- The accessibility review is not a WCAG conformance certification.
- Roles, audit history, server-side pagination, CI/CD, and production deployment
  configuration are outside this release.

[0.1.0]: https://github.com/igorSmertinSchubwerk/it-useful/releases/tag/v0.1.0
