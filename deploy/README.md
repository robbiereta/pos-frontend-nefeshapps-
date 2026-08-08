# Deploy via Hetzner API + git pull (sin registry, sin SSH)

v3 del deploy. Sin Docker registry, sin webhook, sin SCP, sin SSH.
Solo la Hetzner Cloud API como señal, y el server se auto-deploya
desde git.

## Cómo funciona

```
git push a Staging
   └─→ CI workflow:
        PATCH /v1/servers/{id}  body: {"labels":{"deploy-sha":"abc1234"}}
        └─→ Hetzner Cloud API setea el label en el server
             └─→ server (systemd timer, cada 30s):
                  lee su propio label
                  └─ si cambió:
                       git pull origin Staging
                       docker compose up -d --build
                       (persiste el sha para no repetir)
```

El server es self-deploying. La CI solo le pasa la señal.

## Archivos

- `deploy-watcher.sh` — script bash que se ejecuta cada 30s vía
  systemd timer. Lee el label, hace `git pull` + `docker compose
  up -d --build` si cambió. Zero deps raras (usa `python3` para
  el JSON parse, viene en cualquier distro).
- `deploy-watcher.service` — unit systemd (Type=oneshot).
- `deploy-watcher.timer` — unit systemd (cada 30s).
- `deploy.env.example` — env file template (HCLOUD_TOKEN + paths).
- `deploy-staging-api.yml.template` — workflow que dispara el
  deploy (NO commiteado en `.github/workflows/`, ver nota en la PR).

## Setup en el server de Hetzner (una sola vez)

```bash
# 1. Clonar el repo
sudo mkdir -p /opt/app
sudo chown $USER:$USER /opt/app
git clone https://github.com/robbiereta/pos-frontend-nefeshapps-.git /opt/app/pos-frontend
cd /opt/app/pos-frontend
git checkout Staging

# 2. Subir los archivos de deploy/ al server
sudo mkdir -p /opt/deploy-watcher /etc/hetzner /var/lib/deploy
sudo cp deploy-watcher.sh /opt/deploy-watcher/watcher.sh
sudo chmod +x /opt/deploy-watcher/watcher.sh
sudo cp deploy-watcher.service /etc/systemd/system/
sudo cp deploy-watcher.timer    /etc/systemd/system/
sudo cp deploy.env.example      /etc/hetzner/deploy.env

# 3. Editar el env file con el API token
sudo $EDITOR /etc/hetzner/deploy.env
# Reemplazar __HCLOUD_TOKEN__ con tu token de Hetzner Cloud
# (formato hc_xxxxxxxxxxxxx)

# 4. Activar el timer
sudo systemctl daemon-reload
sudo systemctl enable --now deploy-watcher.timer
sudo systemctl list-timers deploy-watcher.timer
sudo journalctl -u deploy-watcher.service -f   # ver logs
```

## Setup en Hetzner Cloud (una sola vez)

1. **API token**: console.hetzner.cloud → Security → API Tokens →
   Generate. Anotar el valor (`hc_...`).
2. **Server ID**: console.hetzner.cloud → Servers → click en el
   server de staging → copiar el ID numérico.

## Setup en GitHub (una sola vez)

Repo → Settings → Secrets and variables → Actions:

| Secret               | Ejemplo                                  |
| -------------------- | ---------------------------------------- |
| `HCLOUD_TOKEN`       | `hc_xxxxxxxxxxxxxxxxxxxxx`               |
| `HCLOUD_SERVER_ID`   | `12345678` (ID numérico del server)      |

Después: crear `.github/workflows/deploy-staging-api.yml` con
el contenido de `deploy-staging-api.yml.template` (manual, el
bot no puede pushear a `.github/workflows/` por el scope del PAT).

## Primera vez / smoke test

```bash
# 1. Forzar una corrida del watcher
sudo systemctl start deploy-watcher.service
sudo journalctl -u deploy-watcher.service -n 20

# 2. Disparar desde la UI: Actions → "Deploy to Staging" →
#    "Run workflow". Esperar 30s y:
sudo systemctl start deploy-watcher.service
sudo journalctl -u deploy-watcher.service -n 20
tail -f /opt/app/pos-frontend/deploy.log 2>/dev/null || true
```

## Rollback

```bash
# En el server
cd /opt/app/pos-frontend
git log --oneline -5   # encontrar el sha bueno
git reset --hard <sha-bueno>
docker compose -f docker-compose.staging.yml up -d --build
```

Y borrás el label para que el watcher no intente volver a
desplegar el sha malo:
```bash
curl -X PATCH "https://api.hetzner.cloud/v1/servers/${SERVER_ID}" \
  -H "Authorization: Bearer ${HCLOUD_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"labels\":{\"deploy-sha\":\"\"}}"
echo "$(cat /var/lib/deploy/last-sha)" > /tmp/keep-this
echo "" > /var/lib/deploy/last-sha
```

## Por qué este enfoque (no registry)

| Opción              | Costo                                       | Veredicto |
| ------------------- | ------------------------------------------- | --------- |
| ghcr.io (v2)        | package público, sin auth en server         | OK pero suma una dependencia |
| HCR (v1)            | credenciales separadas, más setup           | Más fricción |
| **git pull (v3)**   | sin registry, sin auth, server self-deploy  | Más simple |
| hcloud server rebuild | downtime, server se recrea                 | Muy invasivo |

`git pull` + `docker compose up -d --build` es el deploy más
estándar que hay, y ya tenés git en el server. La señal de
cuándo-deployar viene de la API de Hetzner (un label). Sin
artifact hop, sin registry hop, sin SSH hop.

## Si en algún momento querés volver a un registry

Solo cambiás el workflow. El watcher puede ser reemplazado por
un `docker pull` desde el registry que prefieras. El label en
el server sigue siendo el trigger.
