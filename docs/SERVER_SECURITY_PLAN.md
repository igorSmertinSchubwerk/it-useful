# Private single-user server security plan

## Decision

The first supported server deployment will be private and single-user. It will
remain unreachable from the public internet and will be usable only from the
owner's approved Tailscale devices. The application will also require GitHub
sign-in and will authorize one configured GitHub account as `OWNER`.

This is an implementation plan, not a statement that the current `0.1.0`
application is safe to deploy. The current release remains local-only until all
items in the deployment gate below pass against the assembled server.

## Why use two access layers

Tailscale provides the private network boundary and HTTPS endpoint. Spring
Security provides application identity and authorization. Keeping both layers
means that accidentally adding another tailnet member does not make that person
an application editor, and an application routing mistake does not expose a
service directly to the internet.

GitHub stores source code and release history. It does not store PostgreSQL
records or uploaded images. Once a server exists, server data will be backed up
as one database-and-upload set and copied to the trusted local computer. No
scheduled local backup is needed before the server exists and contains valuable
data.

## Target boundary

```text
Owner's approved device
        |
        | encrypted tailnet + HTTPS
        v
Tailscale Serve on the Linux server
        |
        | proxy to 127.0.0.1 only
        v
Frontend nginx :3000 ----> Spring backend :8080 ----> PostgreSQL :5432
        |                         |                         |
        |                         +----> upload volume      |
        +-- SPA and auth routes                             |

GitHub OAuth <---------- browser redirect / callback ------+
```

Only Tailscale Serve accepts remote application traffic. Frontend nginx stays
bound to server loopback; Spring and PostgreSQL have no host port. Router port
forwarding, a public reverse proxy, and Tailscale Funnel are explicitly excluded.

## Authentication and authorization design

- Add Spring Security OAuth2 Client and use GitHub's authorization-code login.
- Register one GitHub OAuth App with one exact HTTPS callback URL. Wildcard
  callbacks stay disabled.
- Allow access only when GitHub's numeric user ID equals
  `APP_OWNER_GITHUB_ID`. A username is display data and is not the authorization
  key because it can be renamed.
- Give that identity one application authority, `ROLE_OWNER`. Do not introduce a
  user table, passwords, registration, invitations, reader/editor roles, or an
  administration UI for a single-user deployment.
- Enforce authorization in Spring for every `/api/**` route and stored image.
  Frontend route guards improve the experience but never make the decision.
- Use a server-side browser session. Its cookie must be `Secure`, `HttpOnly`,
  `SameSite=Lax`, scoped to the application, and rotated after login.
- Keep Spring Security CSRF protection enabled. The SPA will obtain a CSRF token
  from a small session endpoint and send it on every state-changing request.
- Add explicit login, logout, current-session, access-denied, and expired-session
  states. Logout must be a CSRF-protected `POST`, not a link with side effects.
- Return `401` for unauthenticated API requests and `403` for authenticated but
  unauthorized requests. Browser navigation may redirect to a dedicated login
  page.
- Permit only the minimum unauthenticated endpoints needed for OAuth login and
  callback. Swagger and OpenAPI remain disabled in the server profile. Actuator
  health stays reachable only inside the Compose network.

## Configuration profiles

Local development remains convenient and loopback-only:

- `local` and the current local Compose workflow keep authentication disabled
  and retain their loopback boundary.
- A new `server` Spring profile enables authentication, trusted forwarded-header
  handling, secure cookies, and server-only restrictions.
- The server profile must fail during startup if the GitHub client ID, client
  secret, owner ID, or public base URL is absent. It must never silently fall
  back to local security.
- A separate server Compose override removes the PostgreSQL host port, keeps the
  frontend on `127.0.0.1`, enables `container,server`, and supplies secrets from
  files outside the repository.

The expected server-only values are:

| Setting | Purpose | Storage rule |
| --- | --- | --- |
| `APP_PUBLIC_BASE_URL` | Exact `https://…ts.net` origin | Non-secret server configuration |
| `APP_OWNER_GITHUB_ID` | Numeric ID of the sole owner | Non-secret server configuration |
| `GITHUB_CLIENT_ID` | OAuth application identifier | Root-readable server environment file |
| `GITHUB_CLIENT_SECRET` | OAuth application secret | Root-readable server secret file |
| `DB_PASSWORD` | Server database password | Root-readable server secret file |

The repository will contain names and examples only. Real values, `.env` files,
tokens, private keys, and backup archives must remain untracked.

## Reverse proxy and HTTPS rules

1. Install Tailscale on the server and the owner's client devices. Limit the
   tailnet policy to the owner and the application server.
2. Use `tailscale serve` to proxy HTTPS to `http://127.0.0.1:3000`. Never enable
   `tailscale funnel` for this deployment.
3. Keep the host firewall deny-by-default. No application, database, or SSH port
   is opened to the public internet. Administration should use Tailscale SSH or
   SSH restricted to the tailnet.
4. Add nginx proxy locations for the API plus Spring Security's OAuth login,
   callback, and logout routes. The SPA fallback must not swallow these routes.
5. Forward the original host, scheme, and client chain consistently. Spring will
   process forwarded headers only in the server profile and only because nginx is
   its sole network peer.
6. Set HSTS and the final frontend security headers at the HTTPS edge. Verify the
   assembled response rather than assuming container-level headers are retained.
7. Use the exact HTTPS origin for OAuth redirects, CSRF/origin checks, and CORS.
   Keep same-origin requests as the normal browser path; do not use CORS as
   authorization.

## Implementation groups

The detailed, checkable order is in
[`SERVER_SECURITY_WORKSHEET.csv`](SERVER_SECURITY_WORKSHEET.csv). Each group gets
its own branch, tests, pull request, review, and merge.

### Group 1: Spring identity foundation

Add dependencies, server-only configuration validation, GitHub principal
mapping, the numeric owner allowlist, default-deny authorization, session/CSRF
endpoints, and backend tests. The local profile must continue to work unchanged.

### Group 2: Frontend authenticated experience

Add current-session loading, login and logout controls, clear unauthorized and
expired-session states, and CSRF-aware mutations. Add component and mocked
browser tests for each state.

### Group 3: Private server topology

Add the server Compose override, nginx auth routing, forwarded-header rules,
secret templates, firewall/Tailscale instructions, and a configuration validator.
No real server secrets or machine-specific hostnames enter Git.

### Group 4: Assembled security verification

Exercise anonymous access, the owner, a different authenticated GitHub identity,
CSRF failures, forged proxy headers, direct-port access, cookie attributes,
OAuth callback matching, service restarts, headers, and rate/size limits against
the real stack. Record residual risks and close the deployment gate only when all
checks pass.

### Group 5: Server operations

After the target Linux host is chosen, pin the supported OS and container runtime,
deploy immutable release images, configure security updates and log retention,
run the first restore drill, and copy encrypted backups to the trusted local
computer. Continuous deployment remains a later, separately approved track.

## Required verification

At minimum, automated tests must prove:

1. The server profile refuses to start when any required security setting is
   missing or invalid.
2. Anonymous clients cannot read or change definitions, translations, or images.
3. The configured owner can complete every existing workflow.
4. Any other valid GitHub identity receives `403` and cannot infer private data.
5. Every mutating endpoint rejects a missing or invalid CSRF token.
6. Logout invalidates the session, and an expired session cannot be reused.
7. A forged identity or forwarded header cannot bypass Spring authorization.
8. Backend, PostgreSQL, Actuator, Swagger, and OpenAPI are not remotely exposed.
9. Cookies and HTTPS responses have the expected security attributes and headers.
10. Existing backend, frontend, Compose, backup/restore, and acceptance suites
    still pass for local development.

The assembled test should also inspect listening host sockets and attempt access
from both a tailnet-approved client and a non-tailnet network path.

## Deployment gate

The private server is supported only when every item is checked:

- [ ] Exact GitHub OAuth callback registered with wildcard matching disabled.
- [ ] Sole owner's numeric GitHub ID verified out of band.
- [ ] Server secrets exist outside Git with owner-only filesystem permissions.
- [ ] Server profile fails closed and all authorization/CSRF tests pass.
- [ ] Tailscale policy permits only the owner to reach the application server.
- [ ] `tailscale serve status` shows private Serve and no Funnel configuration.
- [ ] Host socket and firewall audit shows no public application/database ports.
- [ ] HTTPS, HSTS, cookie flags, CSP, and other response headers pass inspection.
- [ ] Swagger/OpenAPI are disabled and health is internal-only.
- [ ] Server data survives service and host restarts.
- [ ] A fresh server backup restores successfully in an isolated drill.
- [ ] An encrypted/off-host copy reaches the trusted local backup computer.
- [ ] Supported OS/runtime versions, update process, logs, and recovery owner are
      documented for the selected host.

Until then, use the application only through its documented local loopback URLs.

## Explicit non-goals

- Public or anonymous access, Tailscale Funnel, and router port forwarding.
- Multiple users, invitations, registration, granular roles, or shared editing.
- Application-managed passwords or a self-hosted identity provider.
- Kubernetes, S3-compatible storage, audit history, and automatic deployment.
- Search/pagination work before catalogue measurements show it is needed.

These can be reconsidered through a new threat model and plan if the usage model
changes.

## Residual risks

This design does not protect data after compromise of the owner device, GitHub
account, tailnet account, server root account, or unencrypted backup destination.
Use multi-factor authentication for GitHub and Tailscale, apply server security
updates, encrypt host storage where practical, and keep recovery codes offline.
The deployment verification is an engineering gate, not a penetration test or
security certification.

## Primary references

- [Tailscale: host a private website with Serve](https://tailscale.com/docs/features/tailscale-funnel/how-to/host-websites)
- [Tailscale: Funnel is public; use Serve for tailnet-only access](https://tailscale.com/docs/features/tailscale-funnel)
- [Spring Security OAuth 2.0 Login](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/index.html)
- [Spring Security CSRF protection](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [GitHub OAuth app authorization and callback URLs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub users API: durable user ID versus changeable login](https://docs.github.com/en/rest/users/users#get-a-user-using-their-id)
