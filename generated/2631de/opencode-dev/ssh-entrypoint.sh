#!/usr/bin/env bash
set -euo pipefail

mkdir -p /var/run/sshd /root/.ssh /etc/ssh/sshd_config.d
chmod 700 /root/.ssh

echo "Waiting for /shared/tmux.sock..."
until [[ -S /shared/tmux.sock ]]; do
  sleep 2
done

cat > /etc/ssh/sshd_config.d/force-tmux.conf <<'EOF'
Port 22
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
PermitEmptyPasswords no
PrintMotd no
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitTunnel no
UsePAM no
AuthorizedKeysFile /root/.ssh/authorized_keys
ForceCommand tmux -S /shared/tmux.sock new-session -A -s opencode
EOF

exec /usr/sbin/sshd -D -e
