# Private server preparation runbook

This runbook prepares the server topology. It does not authorize a deployment
yet. The public-hosting changes in
[`PUBLIC_ACCOUNTS_SPEC.md`](PUBLIC_ACCOUNTS_SPEC.md) (phase 5) replace the
Tailscale steps below. Until then, the host, firewall, and assembled security
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
Funnel. The application authorizes from its own email and password accounts and
never from Tailscale identity headers.

The server Compose file caps memory at 768 MiB for Spring, 256 MiB for
PostgreSQL, and 64 MiB for nginx. Spring sizes its heap to 75% of its cap, so
the stack cannot starve other services on a shared host.

## 0. Prepare the host

The supported host baseline is:

| Item | Baseline |
| --- | --- |
| Operating system | Ubuntu 24.04 LTS, with security updates from `unattended-upgrades` |
| Container runtime | Ubuntu's `docker.io` and `docker-compose-v2` packages, patched with the OS |
| Container logs | Docker `local` log driver, which rotates logs per container |
| Memory | At least 1.5 GiB free for the stack, plus a swap file when the host has none |
| Storage | Named volumes `postgres_data` and `upload_data` under `/var/lib/docker` |
| Checkout | A directory owned by the deploying user that no web server serves |

Install the runtime, log rotation, and swap:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
echo '{"log-driver": "local"}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Skip the swap commands when `swapon --show` already lists swap. Skip the
`daemon.json` step when the file exists, and merge the setting instead.

Patch the host with `sudo apt update && sudo apt full-upgrade`. Docker restarts
the containers after an engine upgrade because every service uses
`restart: unless-stopped`.

On a host shared with another application, leave its web server sites, SSH
policy, and firewall rules unchanged. This stack needs no public port. If a host
web server already listens on `0.0.0.0:443`, confirm after step 4 that the
`ts.net` origin serves this application and not the other site.

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

## 2. Configure the tailnet boundary

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

## 3. Configure the host firewall

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

## 4. Start the loopback stack and private HTTPS edge

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

## 5. Create the first admin

With the stack running and no account in the database, print the first admin's
invitation link:

```bash
sudo ./scripts/project.sh server-create-first-admin /etc/it-useful/server.env admin@example.com
```

Open the link and choose a password. This first account is confirmed at once.
The command refuses to run once any account exists. Every later person gets an
invitation from the Accounts page, and an admin confirms the account after the
person has set a password. The same page changes roles, disables and enables
accounts, and creates one-time password reset links, which the admin passes on.

## 6. Pre-deployment evidence

Run the repository's automated topology test on a trusted development machine:

```bash
./scripts/project.sh test-server-topology
```

It uses generated dummy credentials and disposable volumes. It proves that the
validator fails closed, only nginx publishes a loopback socket, authentication
routes reach Spring, forged forwarding headers are replaced, and the server-mode
frontend does not mount private routes for an anonymous browser.

This test cannot prove the future host's firewall, tailnet membership, real
accounts, HTTPS headers, cookies, restart behavior, or access from approved
and denied devices. Those checks belong to the assembled security verification
group and must be recorded before the deployment gate can close.

## References

- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
- [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Tailscale grants](https://tailscale.com/docs/features/access-control/grants)
- [Tailscale access controls](https://tailscale.com/docs/features/access-control/acls)
- [Docker Compose merge rules](https://docs.docker.com/reference/compose-file/merge/)
