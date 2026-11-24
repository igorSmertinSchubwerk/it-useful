ALTER TABLE account
    ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT account_session_version_nonnegative CHECK (session_version >= 0);
