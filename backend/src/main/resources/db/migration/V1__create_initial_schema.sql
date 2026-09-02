CREATE TABLE element (
    id UUID PRIMARY KEY,
    slug VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT element_slug_not_blank CHECK (length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX element_slug_lower_unique_idx ON element (lower(slug));

CREATE TABLE element_translation (
    id UUID PRIMARY KEY,
    element_id UUID NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    language_code VARCHAR(2) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    examples TEXT,
    CONSTRAINT element_translation_language_check
        CHECK (language_code IN ('EN', 'DE', 'RU')),
    CONSTRAINT element_translation_title_not_blank
        CHECK (length(trim(title)) > 0),
    CONSTRAINT element_translation_content_not_blank
        CHECK (length(trim(content)) > 0),
    CONSTRAINT element_translation_language_unique
        UNIQUE (element_id, language_code)
);

CREATE INDEX element_translation_element_idx
    ON element_translation (element_id);

CREATE TABLE element_image (
    id UUID PRIMARY KEY,
    element_id UUID NOT NULL REFERENCES element (id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    alt_text VARCHAR(500),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT element_image_file_name_not_blank
        CHECK (length(trim(file_name)) > 0),
    CONSTRAINT element_image_storage_path_not_blank
        CHECK (length(trim(storage_path)) > 0),
    CONSTRAINT element_image_display_order_nonnegative
        CHECK (display_order >= 0),
    CONSTRAINT element_image_order_unique
        UNIQUE (element_id, display_order)
);

CREATE INDEX element_image_element_idx ON element_image (element_id);
