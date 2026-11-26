#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $# -eq 1 && "$1" == /* ]] || {
  echo "Usage: sudo ./scripts/project.sh server-auto-deploy /absolute/path/to/server.env" >&2
  exit 2
}
[[ $EUID -eq 0 ]] || { echo "Run this command with sudo." >&2; exit 1; }
[[ "$project_root$1" != *[[:space:]]* ]] || {
  echo "The checkout and environment paths must not contain spaces." >&2
  exit 1
}

cat >/etc/systemd/system/it-useful-auto-deploy.service <<EOF
[Unit]
Description=Deploy IT Useful main once its CI passed
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
StateDirectory=it-useful
TimeoutStartSec=30min
ExecStart=$project_root/scripts/auto-deploy.sh $1
EOF

cat >/etc/systemd/system/it-useful-auto-deploy.timer <<'EOF'
[Unit]
Description=Check IT Useful main for a new deployable commit every two minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
"$project_root/scripts/project.sh" server-start "$1"
mkdir -p /var/lib/it-useful
runuser -u "$(stat -c %U "$project_root")" -- git -C "$project_root" rev-parse HEAD \
  >/var/lib/it-useful/deployed-commit
systemctl enable --now it-useful-auto-deploy.timer
echo "Automatic deployment is active. Follow it with: sudo journalctl -u it-useful-auto-deploy -f"
