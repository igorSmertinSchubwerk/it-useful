ALTER TABLE account
    ADD COLUMN failed_sign_ins INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN failure_window_started_at TIMESTAMPTZ,
    ADD COLUMN locked_until TIMESTAMPTZ,
    ADD CONSTRAINT account_failed_sign_ins_nonnegative CHECK (failed_sign_ins >= 0);
