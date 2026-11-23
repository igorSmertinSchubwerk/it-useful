CREATE TABLE account (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT account_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT account_password_hash_not_blank CHECK (length(trim(password_hash)) > 0),
    CONSTRAINT account_role_check CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT account_status_check CHECK (status IN ('ACCEPTED', 'CONFIRMED', 'DISABLED'))
);

CREATE UNIQUE INDEX account_email_lower_unique_idx ON account (lower(email));
