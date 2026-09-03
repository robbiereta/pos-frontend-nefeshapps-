#!/bin/bash
#
# deploy-watcher.sh
#
# Se ejecuta cada 30s vía systemd timer. Lee el label `deploy-sha` del
# server (seteado por la GitHub Action) y, si cambió desde la última
# corrida, hace `git pull` + `docker compose up -d --build` en
# $APP_DIR.
#
# Pure bash, sin Node.js, sin jq (usa python3 -c para el JSON parse).
# Pensado para correr como servicio oneshot en una instancia de
# Hetzner Cloud.
#
# Config (en /etc/hetzner/deploy.env):
#   HCLOUD_TOKEN    Hetzner Cloud API token (formato hc_...). El
#                   mismo valor está en GitHub como secret.
#   APP_DIR         directorio donde está clonado el repo
#                   (default /opt/app/pos-frontend)
#   BRANCH          rama a la que apuntar (default Staging)
#   COMPOSE_FILE    path al docker-compose de staging
#                   (default /opt/app/pos-frontend/docker-compose.staging.yml)
#   LAST_SHA_FILE   archivo donde persiste el último sha desplegado
#                   (default /var/lib/deploy/last-sha)
#
# Instalación:
#   1. sudo mkdir -p /opt/deploy-watcher /var/lib/deploy
#   2. sudo cp deploy-watcher.sh /opt/deploy-watcher/watcher.sh
#   3. sudo chmod +x /opt/deploy-watcher/watcher.sh
#   4. sudo cp deploy-watcher.service /etc/systemd/system/
#   5. sudo cp deploy-watcher.timer    /etc/systemd/system/
#   6. sudo cp deploy.env.example      /etc/hetzner/deploy.env
#      (editar HCLOUD_TOKEN con el valor real)
#   7. sudo systemctl daemon-reload
#      sudo systemctl enable --now deploy-watcher.timer

set -e

ENV_FILE="${ENV_FILE:-/etc/hetzner/deploy.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

: "${HCLOUD_TOKEN:?HCLOUD_TOKEN requerido en $ENV_FILE}"
: "${APP_DIR:=/opt/app/pos-frontend}"
: "${BRANCH:=Staging}"
: "${COMPOSE_FILE:=$APP_DIR/docker-compose.staging.yml}"
: "${LAST_SHA_FILE:=/var/lib/deploy/last-sha}"

LOG() { echo "[$(date -Iseconds)] $*"; }

# 1. Conseguir el instance ID via metadata service de Hetzner
INSTANCE_ID=$(curl -sS --max-time 5 \
  http://169.254.169.254/hetzner/v1/metadata/instance-id)
if [ -z "$INSTANCE_ID" ]; then
  LOG "⚠️  no se pudo leer instance-id del metadata service"
  exit 0
fi

# 2. Leer el label deploy-sha del server via Hetzner Cloud API
#    (usamos python3 porque jq no siempre está instalado)
CURRENT=$(curl -sS --max-time 10 \
  -H "Authorization: Bearer $HCLOUD_TOKEN" \
  "https://api.hetzner.cloud/v1/servers/$INSTANCE_ID" \
  | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get('server',{}).get('labels',{}).get('deploy-sha',''))
except Exception:
  print('')")

if [ -z "$CURRENT" ]; then
  # no hay sha seteado todavía, nada que hacer
  exit 0
fi

# 3. Comparar con el último deploy
LAST=""
if [ -f "$LAST_SHA_FILE" ]; then
  LAST=$(cat "$LAST_SHA_FILE")
fi

if [ "$CURRENT" = "$LAST" ]; then
  exit 0
fi

LOG "🚀 nuevo deploy-sha=$CURRENT (anterior: ${LAST:-ninguno})"

# 4. Pull + build + restart
if [ ! -d "$APP_DIR" ]; then
  LOG "❌ APP_DIR no existe: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"
git fetch origin "$BRANCH" --quiet
git reset --hard "origin/$BRANCH" --quiet
LOG "git reset --hard origin/$BRANCH OK"

if [ -f "$COMPOSE_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" up -d --build
  LOG "docker compose up OK"
else
  LOG "⚠️  no se encontró $COMPOSE_FILE, asumo que el build es externo"
fi

# 5. Persistir
echo "$CURRENT" > "$LAST_SHA_FILE"
LOG "✅ deploy $CURRENT completo"
