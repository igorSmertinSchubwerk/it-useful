-- Spring Security's persistent remember-me tokens. One row per browser that
-- chose "Keep me signed in". The username column holds the account email, and
-- the token column holds only the SHA-256 hash of the cookie's token.
CREATE TABLE persistent_logins (
    series VARCHAR(64) PRIMARY KEY,
    username VARCHAR(254) NOT NULL,
    token VARCHAR(64) NOT NULL,
    last_used TIMESTAMP NOT NULL
);

CREATE INDEX persistent_logins_username_idx ON persistent_logins (username);
