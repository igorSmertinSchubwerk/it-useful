# Data model

Flyway migration `V1__create_initial_schema.sql` creates the current schema.
Application code uses UUID identifiers and UTC timestamps. PostgreSQL is the
source of truth for element and image metadata; image bytes live in the configured
upload storage.

## Relationships

```text
element
├── element_translation (one per EN, DE, and RU)
└── element_image       (zero or more, ordered)
```

Deleting an element cascades to its translations and image metadata. The
application service also deletes associated files from local storage. Image
deletion through the REST API likewise removes both the file and its metadata.

## `element`

The language-independent record contains:

- `id`: UUID primary key;
- `slug`: required URL-safe identifier, unique without regard to letter case;
- `created_at` and `updated_at`: UTC-aware timestamps.

The API accepts slugs up to 160 characters containing ASCII letters or numbers
separated by single hyphens. It trims and lowercases them before persistence.
List responses are ordered by slug. `updated_at` changes when the element or its
translations are updated; image-only operations have their own timestamp and do
not update the parent element.

## `element_translation`

Each row belongs to one element and contains:

- `language_code`: `EN`, `DE`, or `RU`;
- `title`: required localized title, up to 255 UTF-16 code units;
- `content`: required localized Markdown body, up to 50,000 UTF-16 code units at
  the API;
- `examples`: optional localized Markdown examples, up to 50,000 UTF-16 code
  units at the API.

The `(element_id, language_code)` constraint prevents duplicate translations.
Every API create and update must send exactly one translation for each supported
language. The database constrains valid codes and uniqueness but does not by
itself require all three rows; services and import tools must preserve that
application invariant. Language selection and fallback are client concerns. The
API returns stored translations and never substitutes one language for another.

## `element_image`

Each row belongs to one element and contains:

- the original/safe file name and server-generated storage path;
- the validated content type;
- optional alternative text;
- a nonnegative display order;
- a creation timestamp.

The `(element_id, display_order)` constraint produces a stable image order.
Display positions may contain gaps but must be unique within one element. Images
are shared by all translations; alternative text is not translated. Storage
paths are internal and are never returned by the REST API.

## Persistence and deletion

- `element_translation.element_id` and `element_image.element_id` reference
  `element.id` with `ON DELETE CASCADE`.
- The application deletes stored image files before deleting their database
  records. Database cascade alone cannot remove files from upload storage.
- Compose persists PostgreSQL in `postgres_data` and image bytes in `upload_data`.
  A useful backup or restore must keep both stores consistent.
- Direct development uses the configured `UPLOAD_DIR` instead of `upload_data`.

The REST representations, write limits, and error codes are documented in
[`api.md`](api.md).

## Evolution rules

- Flyway migrations are immutable after they have been merged and used.
- Schema changes are introduced through new, versioned migration files.
- JPA schema generation is disabled; Hibernate validates mappings against Flyway's schema.
- Database constraints protect invariants even when data is written outside the API.
