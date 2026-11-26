# Security and access policy

## Local mode: loopback-only, without authentication

In local mode, IT Useful is a single-user application for a trusted local computer.
There are no accounts, sessions, roles, API keys, or authorization checks. Every
client that can connect to the backend can read, create, change, and permanently
delete definitions and images. This is a deliberate MVP decision, not an
authentication mechanism and not a configuration suitable for public hosting.

The default exposure boundary is the loopback interface:

- Spring listens on `127.0.0.1` through `SERVER_ADDRESS`; the Vite development
  server already listens on `127.0.0.1`.
- Compose publishes the frontend and PostgreSQL only on `127.0.0.1`. The
  containerized backend listens on its private Compose network and has no host
  port mapping.
- No CORS origins are enabled. The frontend reaches Spring through Vite's
  same-origin `/api` proxy.
- Browser writes with a cross-site fetch signal or a non-loopback `Origin` are
  rejected. Loopback browser origins and clients without `Origin` (such as curl
  and the IDE) remain supported.

Origin/CORS checks protect a browser interaction boundary; they do not identify
or authorize a user. Another local process, browser extension, compromised local
application, or person using the same account may still change all data. Windows
and WSL localhost forwarding can also make a loopback service reachable from the
Windows side of the same computer. Keep the machine and user account trusted.

Do not change `SERVER_ADDRESS`, publish the database on a non-loopback address,
configure router port forwarding, create a public tunnel, or place this version
behind a remotely reachable proxy. The Swagger UI is convenient locally and is
also unauthenticated. Uploaded content and the PostgreSQL volume contain user
data; back them up and protect local filesystem access as appropriate.

## Baseline controls

- JSON parsing has explicit document, string, property-name, nesting, number,
  and token limits. Unknown JSON properties are rejected. DTO constraints still
  impose the narrower field limits used by the application.
- Multipart limits cap request/file sizes, field count, part count, and part
  header sizes. Upload storage accepts generated names only, strips control and
  formatting characters from display filenames, confines paths to the configured
  directory, checks JPEG/PNG/WebP signatures and declared MIME consistency, and
  removes partial or rolled-back files.
- API and image responses declare their media type and send `nosniff`, a
  restrictive API CSP, frame denial, no-referrer, limited browser permissions,
  and disabled legacy XSS filtering. Unexpected exceptions are logged server-side
  and return a generic problem response without stack traces or exception names.
- Raw Markdown HTML is disabled. Unsafe links are rejected by the renderer and
  Markdown images cannot trigger third-party requests; uploaded files render only
  through the typed image endpoint.
- Forwarded headers are ignored in this direct local configuration. HTTPS/HSTS
  are intentionally absent because the service is loopback HTTP.

These are defense-in-depth measures, not a claim that the application has passed
a penetration test or formal security certification. Dependency and container
scanning will be part of the later CI/release work.

## Requirements before any public or shared deployment

Stop and design the deployment boundary before exposing this application. At a
minimum, a future release must:

1. Authenticate every editor using a maintained identity provider or a carefully
   reviewed Spring Security design. Never invent password storage in this project.
2. Authorize all write operations and image access according to explicit roles
   and ownership rules. Default to denial and test horizontal/vertical access.
3. Serve only HTTPS through a hardened proxy, configure trusted forwarded headers
   explicitly, add HSTS at the HTTPS edge, and keep Spring/PostgreSQL private.
4. Choose one browser credential model. For cookies, use Secure/HttpOnly/SameSite
   settings plus CSRF protection. For bearer tokens, protect token storage and
   validate issuer, audience, expiry, and scopes. Do not mix models accidentally.
5. Replace the loopback-origin rule with an exact deployment allow-list and test
   preflight and non-preflight writes. CORS must never be treated as authorization.
6. Protect or disable Swagger and nonessential Actuator endpoints. Add rate/size
   limits at the edge, audit logging without secrets, secret management, backup
   and restore drills, dependency/image scanning, and incident-ready monitoring.
7. Define upload abuse controls for the public threat model, including decoding
   validation, decompression/pixel limits, malware policy, storage quotas, and
   response caching/download behavior.
8. Add the frontend server's CSP and security headers at the final serving layer,
   then run security tests against the assembled deployment.

The server variant below implements these requirements. Its residual risks list
the parts that remain open, and local mode must still never be published.

## Server variant: public with invited accounts

The server variant runs at a public domain behind the host's nginx, as specified
in [`PUBLIC_ACCOUNTS_SPEC.md`](PUBLIC_ACCOUNTS_SPEC.md). It replaces the earlier
private single-user plan in [`SERVER_SECURITY_PLAN.md`](SERVER_SECURITY_PLAN.md).
Deployment steps are in [`SERVER_RUNBOOK.md`](SERVER_RUNBOOK.md).

**Protected assets:** account credentials and sessions, the shared catalog of
definitions and images, admin powers, and personal data (email addresses and the
IP addresses in web server logs).

| Threat | Controls |
| --- | --- |
| Anonymous internet visitors | Every route except sign-in, invitation acceptance, password reset, and the legal pages requires a session. Swagger and OpenAPI are disabled, Actuator stays inside the Compose network, and Spring and PostgreSQL have no host port |
| Password guessing and credential stuffing | Passwords need 12 characters and must not be common or equal the email address. Hashes use bcrypt. Every sign-in failure gets the same answer. Five failures in 15 minutes lock an account for 15 minutes, and nginx allows 10 sign-in requests per minute per visitor |
| Self-registration and forwarded links | There is no sign-up. Invitation and reset links are single-use, expire after 7 days and 24 hours, carry their token in the URL fragment, and are stored only as hashes. An admin must confirm every new account |
| Stolen sessions | The cookie is `Secure`, `HttpOnly`, and `SameSite=Lax`, behind HTTPS with HSTS. Sessions expire after 60 idle minutes and get a new id at sign-in and password change. The optional 30-day sign-in cookie has the same flags, never rotates, expires 30 days after sign-in, and is stored only as a hash. A password change, a reset, or disabling the account ends every other session and every 30-day sign-in. Sign-out ends the account's 30-day sign-ins on every browser |
| Cross-site attacks | Every write and the sign-in need a CSRF token. Browser writes must come from the exact public origin. The CSP allows only same-origin content, and framing is denied |
| A malicious or compromised `USER` | The backend refuses every content write and every account-management call from a `USER` |
| Admin mistakes | The last confirmed admin cannot be disabled or demoted, and the security log records the acting admin's id |
| Leaked logs or database dumps | The database holds only password and token hashes. Logs name accounts by id, never by email address, password, or token |
| The co-hosted application | The stack binds only to loopback, runs under memory caps, and adds its own nginx site and certificate without touching the other site |

**Residual risks, accepted for staging:**

- There is no multi-factor authentication.
- Without SMTP settings, links reach people through whatever channel the admin
  uses. With SMTP, they travel as plain email, protected only by the transport
  encryption between the mail servers.
- Only admins can upload images, and uploads are checked for type and file
  signature. There are no pixel, decompression, or malware checks.
- Limits are per IP address. An attacker with many addresses gets more sign-in
  attempts, although the per-account lockout still applies.
- There is no automated monitoring or alerting. Logs are reviewed by hand.
- Encrypted off-host backups and a server restore drill (S23) are not in place yet.
- Root or Docker access on the shared host gives full access to this stack too.
- The last-admin check reads before it writes, so two admins demoting each other
  at the same moment could both succeed.

## Verification

Run `./scripts/test-backend.sh` with Docker to verify storage confinement, MIME
checks, safe problem responses, parser limits, headers, cross-origin write
rejection, and persistence behavior. Run `./scripts/test-full-stack.sh` to verify
that legitimate loopback frontend writes still complete through the real stack.
Run `./scripts/project.sh test-server-security` to build the server variant with
dummy credentials and verify its environment guards, authorization boundary,
published sockets, proxy routes, headers, limits, browser behavior, and service
restart recovery.

The header choices follow the OWASP
[HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
and [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
Request property names and defaults follow Spring Boot's
[application properties reference](https://docs.spring.io/spring-boot/appendix/application-properties/).
