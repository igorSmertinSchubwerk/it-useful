# Data model

Flyway migrations `V1` to `V6` in `backend/src/main/resources/db/migration`
create the current schema.
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

## `account`

A person who can sign in to the server variant
([`PUBLIC_ACCOUNTS_SPEC.md`](PUBLIC_ACCOUNTS_SPEC.md)). Each row contains:

- `email`: stored lowercased, unique without regard to letter case
- `password_hash`: a bcrypt hash with its `{bcrypt}` algorithm prefix, never the password
- `role`: `USER` or `ADMIN`
- `status`: `ACCEPTED`, `CONFIRMED`, or `DISABLED`
- `created_at`: a UTC-aware timestamp
- `failed_sign_ins`, `failure_window_started_at`, `locked_until`: the sign-in
  lockout state (5 failures within 15 minutes lock the account for 15 minutes)
- `session_version`: recorded by each session at sign-in. A password change, a
  reset, or disabling the account increments it, which ends older sessions

Pending invitations are not accounts. An account row exists once an invitee has
set a password.

## `invitation`

A single-use link that lets one email address create an account. Each row
contains:

- `email` and `role`: the address and role the account will get
- `token_hash`: the SHA-256 hex hash of the link token, never the token itself
- `created_by`: the inviting admin's account id, or empty for the first-admin
  invitation created by `server-create-first-admin`
- `created_at` and `expires_at`: the link is valid for 7 days
- `accepted_at` and `revoked_at`: set when the link is used or withdrawn

An invitation is usable only while it is unexpired, unaccepted, unrevoked, and no
account exists for its address. A first-admin invitation is usable only while no
account exists at all.

## `password_reset`

A single-use link an admin creates so a person can choose a new password. Each
row contains:

- `account_id`: the account whose password the link sets
- `token_hash`: the SHA-256 hex hash of the link token, never the token itself
- `created_by`: the admin who created the link
- `created_at` and `expires_at`: the link is valid for 24 hours
- `used_at`: set when the link is used or replaced by a newer link for the
  same account

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
