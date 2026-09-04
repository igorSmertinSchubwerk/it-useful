# Initial data model

The first schema is created by Flyway migration `V1__create_initial_schema.sql`. Application code will use UUID identifiers and UTC timestamps.

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

## `element_translation`

Each row belongs to one element and contains:

- `language_code`: `EN`, `DE`, or `RU`;
- `title`: required localized title;
- `content`: required localized Markdown body;
- `examples`: optional localized Markdown examples.

The `(element_id, language_code)` constraint prevents duplicate translations.

## `element_image`

Each row belongs to one element and contains:

- the original/safe file name and server-generated storage path;
- the validated content type;
- optional alternative text;
- a nonnegative display order;
- a creation timestamp.

The `(element_id, display_order)` constraint produces a stable image order.
Storage paths are internal and are never returned by the REST API.

## Evolution rules

- Flyway migrations are immutable after they have been merged and used.
- Schema changes are introduced through new, versioned migration files.
- JPA schema generation is disabled; Hibernate validates mappings against Flyway's schema.
- Database constraints protect invariants even when data is written outside the API.
