# Assembled server security verification

## Result

The repository-level security verification for the public server variant is
complete. The automated suites exercise the assembled Compose stack with dummy
settings and prove the controls that can be tested without a real server.

**Go-live status: open.** A disposable local stack cannot prove the host's
firewall, the public certificate and headers, real accounts, the co-hosted site,
or the off-host recovery path. Record the external evidence below on the staging
host before people use it.

## Automated evidence

| Boundary | Evidence | Expected result |
| --- | --- | --- |
| API authorization | `ServerSecurityIntegrationTests` runs every session, definition, and image operation as anonymous, confirmed `USER`, `ADMIN`, accepted, and disabled accounts | Anonymous receives `401`. A `USER` reads but every write returns `403`. An `ADMIN` completes every workflow. Accepted accounts cannot read |
| Account onboarding | The backend suite invites, accepts, confirms, and revokes, and tries used, revoked, expired, and unknown links. The assembled test runs the first-admin command, accepts its link, signs in, and runs the command again | Only token hashes are stored. Invalid links share one `400 invitation_invalid`. Accepted accounts get `403 confirmation_pending` until an admin confirms them. The first admin is confirmed, and a second command run is refused |
| Account administration | The backend suite changes passwords and roles, disables and enables accounts, and uses, replaces, and expires reset links | Password changes need the current password and end other sessions. Resets are single-use, expire after 24 hours, and end every session. Disabling ends sessions. The last confirmed admin stays |
| Browser writes | The backend suite submits every mutation with missing and invalid CSRF tokens, hostile and correct origins, logout, and an expired replacement session | Invalid requests fail without changing data; logout invalidates the session |
| Proxy identity | The assembled test supplies forged `Forwarded`, user, and Tailscale identity headers | Nginx replaces trusted forwarding values, strips identity headers, and Spring still returns `401` |
| Sign-in boundary | The backend suite tries wrong passwords, unknown emails, disabled accounts, and five failures in a row. The assembled test fetches a CSRF token, signs in with unknown credentials, and sends a sign-in burst | Every failure returns the same `401 sign_in_failed`. The fifth failure locks the account. The session id changes on sign-in. The cookie is `Secure`, `HttpOnly`, `SameSite=Lax`. The proxy returns `429` for the burst |
| Browser headers | The assembled test inspects the frontend response | CSP, HSTS, permissions, referrer, MIME-sniffing, and frame-denial headers match policy |
| Service exposure | Compose model, published ports, proxy paths, and internal health are inspected | Only frontend has an IPv4-loopback host port; backend and PostgreSQL have none; Actuator, Swagger, and OpenAPI are not proxied |
| Per-visitor limits | The assembled test sends a sign-in burst as one forwarded visitor, then one request as another | The first visitor gets `429`, the second does not |
| Public origin and pages | The validator rejects plain HTTP, paths, and ports. A real browser opens the legal notice and privacy policy without signing in | The public HTTPS origin passes. Both legal pages render without a session |
| Abuse limits | The assembled test sends an oversized body and a request burst | Nginx returns `413` above 12 MiB and `429` after the configured burst |
| Service restart | PostgreSQL, Spring, and nginx are restarted inside the disposable project | The migration state remains present and the authenticated boundary recovers |
| Regression | Backend, frontend, release audit, acceptance, backup/restore, and container scans run in CI | Existing local-development and release behavior remains green |

Run the repository-level evidence from WSL with Docker running:

```bash
./scripts/project.sh test-backend
./scripts/project.sh test-frontend
./scripts/project.sh test-acceptance
./scripts/project.sh test-server-security
./scripts/project.sh test-backup
./scripts/project.sh audit-release
```

The security test uses disposable containers, volumes, generated dummy values,
and a random loopback port. It contacts no external service and removes
its project after success or failure.

## External evidence still required

Record this evidence on the staging host. Do not substitute local Compose results
for it.

1. The host matches the baseline in the runbook, and the secrets file is outside
   Git with mode `600`.
2. Only ports 22, 80, and 443 answer from the internet, and the frontend port
   listens only on `127.0.0.1`.
3. HTTP redirects to HTTPS. The HTTPS response carries a valid certificate, HSTS,
   the CSP, and the other required headers, and `certbot renew --dry-run` passes.
4. The co-hosted site still answers as before, with its own certificate.
5. The first admin can sign in, and a confirmed `USER` cannot write.
6. After a host restart, definitions and images persist. A fresh encrypted
   backup restores in isolation and reaches the trusted local computer.

## Residual risk review

The accepted residual risks are listed in [`security.md`](security.md). The
automated checks are regression evidence, not a penetration test or a security
certification.
