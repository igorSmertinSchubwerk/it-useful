# REST API contract

The Spring backend exposes JSON endpoints under `/api`. Development examples
below assume `http://127.0.0.1:8080`; the container frontend uses the same paths
through its same-origin `/api` proxy. There is no authentication in the local MVP.

## Common rules

- Resource identifiers are UUID strings.
- Timestamps are UTC ISO 8601 strings.
- JSON requests must use `Content-Type: application/json`.
- Unknown JSON properties are rejected.
- Create and update replace the complete definition text and require exactly one
  `EN`, one `DE`, and one `RU` translation.
- The API does not use `Accept-Language` and does not choose a fallback language.
  Clients select a translation from the returned language codes.
- Examples and explanation content are Markdown strings. Raw HTML is not part of
  the rendering contract.
- The element list is ordered by slug. It is not paginated in the local MVP.

## Element representation

A complete element response has this shape:

```json
{
  "id": "3d6ba55b-7cb0-4f22-92ad-eaa111cbbf76",
  "slug": "api",
  "translations": [
    {
      "languageCode": "EN",
      "title": "API",
      "content": "An **application programming interface**...",
      "examples": "A weather service can expose a REST API."
    },
    {
      "languageCode": "DE",
      "title": "API",
      "content": "Eine **Programmierschnittstelle**...",
      "examples": null
    },
    {
      "languageCode": "RU",
      "title": "API",
      "content": "**Программный интерфейс**...",
      "examples": null
    }
  ],
  "images": [],
  "createdAt": "2026-09-07T10:00:00Z",
  "updatedAt": "2026-09-07T10:00:00Z"
}
```

`slug` is 1–160 ASCII letters or numbers separated by single hyphens. The server
trims and lowercases it, and uniqueness is case-insensitive. Each title is
required and at most 255 UTF-16 code units. `content` is required and at most
50,000 UTF-16 code units. `examples` is optional and at most 50,000 UTF-16 code
units.

## Element endpoints

### List elements

`GET /api/elements` returns `200 OK` and a JSON array:

```json
[
  {
    "id": "3d6ba55b-7cb0-4f22-92ad-eaa111cbbf76",
    "slug": "api",
    "titles": {
      "EN": "API",
      "DE": "API",
      "RU": "API"
    },
    "updatedAt": "2026-09-07T10:00:00Z"
  }
]
```

### Read an element

`GET /api/elements/{id}` returns `200 OK` with the complete element response, or
`404` with code `element_not_found`.

### Create an element

`POST /api/elements` accepts the complete write request:

```json
{
  "slug": "load-balancer",
  "translations": [
    {
      "languageCode": "EN",
      "title": "Load balancer",
      "content": "Distributes requests across servers.",
      "examples": "Nginx can act as a load balancer."
    },
    {
      "languageCode": "DE",
      "title": "Lastverteiler",
      "content": "Verteilt Anfragen auf mehrere Server.",
      "examples": null
    },
    {
      "languageCode": "RU",
      "title": "Балансировщик нагрузки",
      "content": "Распределяет запросы между серверами.",
      "examples": null
    }
  ]
}
```

Success returns `201 Created`, a `Location` header ending in the new UUID, and
the complete element response. A case-insensitive slug collision returns `409`
with code `duplicate_slug`.

### Replace an element

`PUT /api/elements/{id}` accepts the same complete write request. It replaces the
slug and all three translations but does not change images. Success returns
`200 OK` with the complete element response.

There is no optimistic version field. Concurrent updates are last-write-wins.

### Delete an element

`DELETE /api/elements/{id}` returns `204 No Content`. It permanently deletes the
definition, translations, image metadata, and stored image files.

## Image endpoints

Images belong to an element but are shared across its translations. Their
metadata is returned in ascending `displayOrder`:

```json
{
  "id": "bd577664-87d6-41ec-a7c5-2e2aad6f19a5",
  "fileName": "diagram.png",
  "contentType": "image/png",
  "altText": "Request flow diagram",
  "displayOrder": 0,
  "createdAt": "2026-09-07T10:05:00Z"
}
```

`fileName` is display metadata. Internal storage paths are never returned.

### Upload an image

`POST /api/elements/{elementId}/images` uses `multipart/form-data` with:

| Part | Required | Contract |
| --- | --- | --- |
| `file` | yes | JPEG, PNG, or WebP with a matching signature; 10 MiB maximum by default |
| `altText` | no | Text up to 500 UTF-16 code units |
| `displayOrder` | no | Unique nonnegative integer for this element |

When `displayOrder` is omitted, the server uses the next position after the
current maximum. Success returns `201 Created`, the image metadata, and a
`Location` header for `/api/images/{id}`. Duplicate order returns `409` with
code `duplicate_image_order`.

### Read image bytes

`GET /api/images/{imageId}` returns `200 OK`, the stored image media type, and an
inline `Content-Disposition`. Missing metadata or storage returns an error.

### Update image metadata

`PATCH /api/images/{imageId}` accepts:

```json
{
  "altText": "Updated request flow diagram",
  "displayOrder": 1
}
```

`altText` may be `null` to clear it. The server treats an omitted `altText` as
`null`, so clients that only change order must resend the current alternative
text if they want to preserve it. `displayOrder` may be omitted to keep its
current value. Success returns `200 OK` with updated metadata.

### Delete an image

`DELETE /api/images/{imageId}` returns `204 No Content` and permanently removes
both the metadata and stored file.

## Error format

API errors use `application/problem+json`. Every problem has a stable `code` and
request `instance`; validation problems also have field-level `errors`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Validation failed",
  "instance": "/api/elements",
  "code": "validation_failed",
  "timestamp": "2026-09-07T10:10:00Z",
  "errors": [
    {
      "field": "slug",
      "message": "must contain only letters, numbers, and single hyphens"
    }
  ]
}
```

Stable codes currently include:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `validation_failed` | A validated field or parameter is invalid |
| 400 | `malformed_request` | JSON, multipart data, a UUID, or a required part is malformed |
| 400 | `invalid_image` | Image type, content, name, or signature is invalid |
| 404 | `element_not_found` | The element UUID does not exist |
| 404 | `image_not_found` | The image UUID does not exist |
| 409 | `duplicate_slug` | Another element has the slug |
| 409 | `duplicate_image_order` | The element already has an image at that order |
| 409 | `data_conflict` | A database constraint rejected the request |
| 413 | `upload_too_large` | The multipart upload exceeds the configured limit |
| 500 | `storage_error` | Image storage failed |
| 500 | `internal_error` | An unexpected server failure occurred |

Clients should branch on `code`, not on the human-readable `detail` text.

## OpenAPI

With the backend running in development mode, use:

- Swagger UI: <http://127.0.0.1:8080/swagger-ui.html>
- OpenAPI JSON: <http://127.0.0.1:8080/v3/api-docs>

These endpoints are disabled in the container profile. The handwritten contract
in this document also records client behavior and operational limits that are
not fully represented by generated endpoint schemas.
