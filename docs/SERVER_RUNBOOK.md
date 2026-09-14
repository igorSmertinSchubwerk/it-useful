# Private server preparation runbook

This runbook prepares the approved private, single-user topology. It does not
authorize a deployment yet. The target Linux host, operating-system baseline,
real OAuth configuration, Tailscale policy, firewall, and assembled security
checks still need to pass the deployment gate in
[`SERVER_SECURITY_PLAN.md`](SERVER_SECURITY_PLAN.md).

## Boundary provided by this repository

Start the server stack with both Compose files through the project helper. The
resulting host sockets are intentionally limited:

| Service | Host exposure |
| --- | --- |
| Frontend nginx | `127.0.0.1:3000` by default |
| Spring backend | No host port |
| PostgreSQL | No host port |

Tailscale Serve is the only intended remote entry point. It terminates HTTPS and
proxies to the loopback frontend. Nginx proxies API and Spring Security routes to
the backend over the private Compose network. The server nginx variant replaces
incoming `Forwarded`, `X-Forwarded-*`, and Tailscale identity headers. Spring
processes the replacement headers only in the `server` profile and trusts only a
private Docker bridge peer.

Do not add router forwarding, a LAN bind, a public reverse proxy, or Tailscale
Funnel. The application uses GitHub OAuth as its application identity; it does
not authorize from Tailscale identity headers.

## 1. Prepare the external environment file

Copy the template to an absolute path outside the Git checkout. A root-owned
location such as `/etc/it-useful/server.env` is recommended on the future host:

```bash
sudo install -d -m 700 -o root -g root /etc/it-useful
sudo install -m 600 -o root -g root .env.server.example /etc/it-useful/server.env
sudoedit /etc/it-useful/server.env
```

Replace every placeholder. Generate the PostgreSQL password without copying it
into shell history:

```bash
openssl rand -hex 32
```

The settings are:

| Name | Required value |
| --- | --- |
| `APP_PUBLIC_BASE_URL` | Exact Tailscale HTTPS origin, with no path or trailing slash |
| `APP_OWNER_GITHUB_ID` | Positive numeric ID for the only authorized GitHub account |
| `GITHUB_CLIENT_ID` | Client ID from the dedicated GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | Secret from the dedicated GitHub OAuth App |
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL role name |
| `DB_PASSWORD` | Random value containing at least 24 supported characters |
| `FRONTEND_PORT` | Optional loopback port; defaults to `3000` |

Do not source this file. The validator parses data lines without executing shell
content. It rejects symbolic links, unknown or duplicate settings, missing
values, template placeholders, malformed values, and any mode other than `400`
or `600`. The file must be owned by root or the current user.

Validate both the file and merged Compose model:

```bash
sudo ./scripts/project.sh server-validate /etc/it-useful/server.env
```

The server helpers remove same-named exported variables before Compose reads the
validated file, so an old shell setting cannot silently override it. Docker
Compose 2.24.4 or newer is required for the explicit port reset and override.

## 2. Register the GitHub OAuth App

Create a dedicated OAuth App for this deployment. Use the exact values below,
substituting the chosen Tailscale device name and tailnet name:

```text
Homepage URL:
https://server.tailnet-name.ts.net

Authorization callback URL:
https://server.tailnet-name.ts.net/login/oauth2/code/github
```

The callback must exactly match `APP_PUBLIC_BASE_URL` plus
`/login/oauth2/code/github`. Do not use a wildcard. Verify the owner's numeric
GitHub user ID separately; the login name is not the authorization key.

## 3. Configure the tailnet boundary

Install Tailscale on the future Linux server and the owner's approved client
devices. Tag the non-human server as `tag:it-useful-server`. Replace the example
email below with the owner's actual Tailscale login and integrate the entries
into the existing tailnet policy instead of replacing unrelated policy:

```json
{
  "tagOwners": {
    "tag:it-useful-server": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["owner@example.com"],
      "dst": ["tag:it-useful-server"],
      "ip": ["tcp:443"]
    }
  ]
}
```

Tailscale recommends grants for new policies. A tailnet with no restrictive
policy may retain broad default access, so test the final policy from an approved
owner device and from a second, unapproved tailnet identity.

For administration, prefer Tailscale SSH with a separately reviewed SSH rule.
Do not include TCP port 22 in the application grant merely for convenience.

## 4. Configure the host firewall

Choose the firewall tool supported by the selected Linux distribution in the
server-operations group. Apply deny-by-default inbound policy before deployment.
Do not open ports `3000`, `8080`, or `5432` on a public or LAN interface. If
conventional SSH remains enabled, restrict it to the Tailscale interface or
Tailscale address range and verify lockout recovery before closing the current
administrative session.

After starting the stack, inspect the host directly:

```bash
sudo ss -lntup
docker compose --env-file /etc/it-useful/server.env \
  -f compose.yaml -f compose.server.yaml ps
```

Only the chosen frontend port may appear, and it must be bound to `127.0.0.1`.
Spring and PostgreSQL must not appear as published host sockets.

## 5. Start the loopback stack and private HTTPS edge

Start the application:

```bash
sudo ./scripts/project.sh server-start /etc/it-useful/server.env
sudo ./scripts/project.sh server-status /etc/it-useful/server.env
```

Then configure background Tailscale Serve for the loopback port:

```bash
sudo tailscale serve --bg http://127.0.0.1:3000
tailscale serve status
tailscale funnel status
```

The Serve status must show the exact private `https://…ts.net` origin forwarding
to `http://127.0.0.1:3000`. Funnel status must show no public listener. If the
frontend port changes, use the same value in `FRONTEND_PORT` and the Serve target.

To remove the private edge configuration:

```bash
sudo tailscale serve reset
```

Stop the application without deleting database or upload volumes:

```bash
sudo ./scripts/project.sh server-stop /etc/it-useful/server.env
```

## 6. Pre-deployment evidence

Run the repository's automated topology test on a trusted development machine:

```bash
./scripts/project.sh test-server-topology
```

It uses generated dummy credentials and disposable volumes. It proves that the
validator fails closed, only nginx publishes a loopback socket, authentication
routes reach Spring, forged forwarding headers are replaced, and the server-mode
frontend does not mount private routes for an anonymous browser.

This test cannot prove the future host's firewall, tailnet membership, OAuth App,
public callback, HTTPS headers, cookies, restart behavior, or access from approved
and denied devices. Those checks belong to the assembled security verification
group and must be recorded before the deployment gate can close.

## References

- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
- [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Tailscale grants](https://tailscale.com/docs/features/access-control/grants)
- [Tailscale access controls](https://tailscale.com/docs/features/access-control/acls)
- [Docker Compose merge rules](https://docs.docker.com/reference/compose-file/merge/)
