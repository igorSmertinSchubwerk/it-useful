CREATE TABLE password_reset (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES account (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    created_by UUID NOT NULL REFERENCES account (id),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    CONSTRAINT password_reset_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT password_reset_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX password_reset_token_hash_unique_idx ON password_reset (token_hash);
CREATE INDEX password_reset_account_idx ON password_reset (account_id);
