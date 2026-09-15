# Assembled private-server security verification

## Result

The repository-level security verification for the private server variant is
complete. The automated suites exercise the assembled Compose stack with dummy
OAuth settings and prove the controls that can be tested without a real server.

**Deployment status: blocked.** A disposable local stack cannot prove the
selected host, real GitHub OAuth App, Tailscale policy, private HTTPS edge,
firewall, or off-host recovery path. Those checks remain deployment prerequisites
and must be completed after a Linux host is selected.

## Automated evidence

| Boundary | Evidence | Expected result |
| --- | --- | --- |
| API authorization | `ServerSecurityIntegrationTests` runs every session, definition, translation-bearing response, and image operation as anonymous, owner, and authenticated non-owner | Anonymous receives `401`; non-owner receives `403`; owner completes every API workflow |
| Browser writes | The backend suite submits every mutation with missing and invalid CSRF tokens, hostile and correct origins, logout, and an expired replacement session | Invalid requests fail without changing data; logout invalidates the session |
| Proxy identity | The assembled test supplies forged `Forwarded`, user, and Tailscale identity headers | Nginx replaces trusted forwarding values, strips identity headers, and Spring still returns `401` |
| OAuth boundary | The assembled test follows the authorization entry point with dummy settings | Spring emits the exact configured HTTPS callback and a `Secure`, `HttpOnly`, `SameSite=Lax` session cookie |
| Browser headers | The assembled test inspects the frontend response | CSP, HSTS, permissions, referrer, MIME-sniffing, and frame-denial headers match policy |
| Service exposure | Compose model, published ports, proxy paths, and internal health are inspected | Only frontend has an IPv4-loopback host port; backend and PostgreSQL have none; Actuator, Swagger, and OpenAPI are not proxied |
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
and a random loopback port. It does not contact GitHub or Tailscale and removes
its project after success or failure.

## External evidence still required

Record this evidence during server operations. Do not substitute local Compose
results for it.

1. Select the supported Linux host, filesystem, container runtime, patch policy,
   log retention, and recovery owner.
2. Register the exact GitHub OAuth callback, verify the owner's numeric GitHub
   ID out of band, and store real secrets outside Git with owner-only permissions.
3. Show that the Tailscale policy permits only the owner, `tailscale serve status`
   has the intended private HTTPS route, and Funnel is absent.
4. Inspect host sockets and firewall rules, then attempt access from one permitted
   tailnet device and one denied network path.
5. Inspect the final HTTPS response for callback matching, HSTS, cookie flags,
   CSP, and the other required headers. Complete a real owner login and confirm a
   different GitHub identity receives no private data.
6. Restart the host and confirm definition and image persistence, then restore a
   fresh encrypted backup in isolation and copy it to the trusted local computer.

## Residual risk review

The private design still depends on the security of the owner's device, GitHub
account, tailnet account, server root account, and backup encryption. Rate
limiting is intentionally simple and keyed to the proxy peer because this is a
single-user service; it is not a public abuse-control design. The automated
checks are regression evidence, not a penetration test or security
certification. A public or multi-user deployment requires a new threat model.
