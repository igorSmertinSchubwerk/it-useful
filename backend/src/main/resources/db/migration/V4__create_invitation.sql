CREATE TABLE invitation (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    role VARCHAR(16) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    created_by UUID REFERENCES account (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT invitation_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT invitation_role_check CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT invitation_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT invitation_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX invitation_token_hash_unique_idx ON invitation (token_hash);
