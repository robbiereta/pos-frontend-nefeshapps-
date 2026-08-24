#!/usr/bin/env bash
# One-time installer for the npos deploy-agent on the Hetzner server.
# Run this ONCE via SSH. After it succeeds, no SSH is needed for
# deploys — the agent polls the Hetzner API and listens for label
# changes triggered by the GitHub Action.
#
# Usage:
#   scp deploy-agent.py deploy-agent.service this-install.sh root@204.168.163.106:/tmp/
#   ssh root@204.168.163.106
#   HETZNER_API_TOKEN=hcloud_xxx \
#   HETZNER_SERVER_ID=12345 \
#   S3_ENDPOINT=https://fsn1.your-objectstorage.com \
#   S3_BUCKET=npos-dist \
#   S3_ACCESS_KEY=... \
#   S3_SECRET_KEY=... \
#   CONTAINER_NAME=npos-frontend \
#   bash /tmp/this-install.sh
set -euo pipefail

: "${HETZNER_API_TOKEN:?HETZNER_API_TOKEN is required}"
: "${HETZNER_SERVER_ID:?HETZNER_SERVER_ID is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is required}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is required}"
: "${CONTAINER_NAME:=npos-frontend}"
: "${DEPLOY_LABEL:=npos.deploy.sha}"
: "${POLL_INTERVAL:=10}"

echo "→ Installing python3 + pip + boto3"
apt-get update -qq
apt-get install -y -qq python3 python3-pip >/dev/null
pip3 install --quiet --break-system-packages boto3

echo "→ Laying out directories"
mkdir -p /opt/npos /etc/npos /var/lib/npos

echo "→ Installing deploy-agent.py"
install -m 0755 /tmp/deploy-agent.py /opt/npos/deploy-agent.py

echo "→ Installing systemd unit"
install -m 0644 /tmp/deploy-agent.service /etc/systemd/system/deploy-agent.service

echo "→ Writing env file with restricted perms"
cat >/etc/npos/deploy-agent.env <<EOF
HETZNER_API_TOKEN=${HETZNER_API_TOKEN}
HETZNER_SERVER_ID=${HETZNER_SERVER_ID}
S3_ENDPOINT=${S3_ENDPOINT}
S3_BUCKET=${S3_BUCKET}
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
CONTAINER_NAME=${CONTAINER_NAME}
DEPLOY_LABEL=${DEPLOY_LABEL}
POLL_INTERVAL=${POLL_INTERVAL}
LOG_LEVEL=INFO
EOF
chmod 0600 /etc/npos/deploy-agent.env
chown root:root /etc/npos/deploy-agent.env

echo "→ Setting initial server label so the agent has a baseline"
curl -fsS -X POST \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"labels\":{\"${DEPLOY_LABEL}\":\"initial\"}}" \
  "https://api.hetzner.cloud/v1/servers/${HETZNER_SERVER_ID}/actions/change_labels" \
  | python3 -c "import sys,json; print('label set:', json.load(sys.stdin)['action']['command'])"

echo "→ Enabling + starting service"
systemctl daemon-reload
systemctl enable --now deploy-agent.service

echo "→ Verifying"
sleep 3
systemctl status deploy-agent.service --no-pager || true
journalctl -u deploy-agent.service -n 20 --no-pager || true

echo ""
echo "✓ Done. Next deploys are SSH-less."
echo "  Watch logs:    journalctl -u deploy-agent.service -f"
echo "  Trigger now:   update label ${DEPLOY_LABEL} via the Hetzner API"
echo "                 or push to master on the GitHub Action."
