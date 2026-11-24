# Server runbook

This runbook deploys the server variant on a shared Ubuntu host behind the
host's existing nginx, as specified in
[`PUBLIC_ACCOUNTS_SPEC.md`](PUBLIC_ACCOUNTS_SPEC.md). The deployment is ready
for people only after the go-live gate in that spec passes.

Every command below runs on the host from the checkout directory, unless a step
says otherwise. Log in once with `ssh` and run a step's commands in that session,
so `sudo` asks for the password only once.

## Boundary provided by this repository

| Component | Exposure |
| --- | --- |
| Host nginx | Public ports 80 and 443 for this domain, proxying to the loopback frontend |
| Frontend nginx (container) | `127.0.0.1:3000` by default |
| Spring backend | No host port |
| PostgreSQL | No host port |

The host nginx terminates TLS with a Let's Encrypt certificate and replaces
`X-Forwarded-For` with the visitor's address. The frontend nginx trusts that
header only from the Docker bridge, so its rate limits apply per visitor. It
replaces every other forwarding header and proxies API routes to Spring over the
private Compose network. Spring processes the forwarding headers only in the
`server` profile and trusts only a private Docker bridge peer.

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

On a host shared with another application, leave its web server sites,
certificates, SSH policy, and firewall rules unchanged. This stack adds exactly
one nginx site for its own domain.

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
| `APP_PUBLIC_BASE_URL` | Exact public HTTPS origin such as `https://it-useful.schubwerk.tech`, with no path or trailing slash |
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

## 2. Point the domain at the host

Create a DNS `A` record for the domain that points to the host's public IPv4
address. Confirm it from any machine:

```bash
dig +short it-useful.schubwerk.tech
```

## 3. Check the host firewall

Only ports 22, 80, and 443 may be reachable from the internet. Never open
`3000`, `8080`, or `5432`. On a shared host, ports 80 and 443 are usually open
already for the other site.

After starting the stack, inspect the host directly:

```bash
sudo ss -lntup
```

The frontend port must appear only on `127.0.0.1`. Spring and PostgreSQL must
not appear as host sockets.

## 4. Start the stack and the public proxy

Start the application from the checkout directory:

```bash
sudo ./scripts/project.sh server-start /etc/it-useful/server.env
sudo ./scripts/project.sh server-status /etc/it-useful/server.env
```

Install the nginx site from `deploy/nginx/it-useful.conf`, check the complete
nginx configuration, and reload:

```bash
sudo cp deploy/nginx/it-useful.conf /etc/nginx/sites-available/it-useful
sudo ln -s /etc/nginx/sites-available/it-useful /etc/nginx/sites-enabled/it-useful
sudo nginx -t
sudo systemctl reload nginx
```

Request the certificate. Certbot adds the TLS settings and the HTTP-to-HTTPS
redirect to this site only, and renews the certificate automatically:

```bash
sudo certbot --nginx -d it-useful.schubwerk.tech --redirect
```

Confirm the result and that the other site still works:

```bash
curl -sI http://it-useful.schubwerk.tech | head -n 3
curl -sI https://it-useful.schubwerk.tech | grep -iE '^(HTTP|strict-transport|content-security)'
```

The first command must show a redirect to HTTPS. The second must show `200`,
`strict-transport-security`, and `content-security-policy`.

Certbot edits the installed site file. To change the site later, edit
`/etc/nginx/sites-available/it-useful` in place with `sudoedit` instead of
copying the template again, then run `sudo nginx -t` and reload.

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

## 6. Update a running deployment

Pull the reviewed version and rebuild. Flyway applies new migrations at startup:

```bash
git pull --ff-only
sudo ./scripts/project.sh server-start /etc/it-useful/server.env
```

Back up first with `./scripts/project.sh backup` when the update contains a
database migration.

## 7. Pre-deployment evidence

Run the repository's assembled security test on a trusted development machine:

```bash
./scripts/project.sh test-server-security
```

It uses generated dummy credentials and disposable volumes. It proves that the
validator fails closed, only nginx publishes a loopback socket, sign-in and
first-admin routes reach Spring, forged forwarding headers are replaced, rate
limits apply per visitor, and the legal pages are public while private routes
stay hidden.

It cannot prove the host's firewall, the public certificate, or real accounts.
Record those checks in
[`SERVER_SECURITY_VERIFICATION.md`](SERVER_SECURITY_VERIFICATION.md) before the
go-live gate can close.

## References

- [Docker Compose merge rules](https://docs.docker.com/reference/compose-file/merge/)
