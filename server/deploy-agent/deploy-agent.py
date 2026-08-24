#!/usr/bin/env python3
"""
npos deploy-agent — runs on the Hetzner server, polls the Hetzner
metadata API for the `npos.deploy.sha` server label, and when it
changes, syncs the new dist/ from Hetzner Object Storage and
reloads the running nginx container.

This is the "no-SSH" half of the deploy pipeline. The GitHub
Action side uses ONLY the Hetzner Cloud API + S3 API — no SSH
key ever enters GitHub Secrets.

Polling interval: 10s (configurable via env).
Requires: a Hetzner Object Storage bucket + access keys in
          /etc/npos/deploy-agent.env (chmod 600).
"""

import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error

# ─── Config (env) ───────────────────────────────────────────────
LOG_LEVEL       = os.environ.get("LOG_LEVEL", "INFO")
POLL_INTERVAL   = int(os.environ.get("POLL_INTERVAL", "10"))
CONTAINER_NAME  = os.environ.get("CONTAINER_NAME", "npos-frontend")
DEPLOY_LABEL    = os.environ.get("DEPLOY_LABEL", "npos.deploy.sha")
S3_ENDPOINT     = os.environ["S3_ENDPOINT"]          # https://fsn1.your-objectstorage.com
S3_BUCKET       = os.environ["S3_BUCKET"]            # npos-dist
S3_ACCESS_KEY   = os.environ["S3_ACCESS_KEY"]
S3_SECRET_KEY   = os.environ["S3_SECRET_KEY"]
S3_PREFIX       = os.environ.get("S3_PREFIX", "dist/")
STAGE_DIR       = Path(os.environ.get("STAGE_DIR", "/var/lib/npos/staging"))
HTML_DIR_IN_CTN = "/usr/share/nginx/html"

# Hetzner metadata endpoints
HETZNER_META    = "http://169.254.169.254/hetzner/v1/metadata"
HETZNER_API     = "https://api.hetzner.cloud/v1/servers"
HETZNER_TOKEN   = os.environ["HETZNER_API_TOKEN"]
SERVER_ID       = os.environ["HETZNER_SERVER_ID"]

# State
STATE_FILE      = Path(os.environ.get("STATE_FILE", "/var/lib/npos/last-sha"))

# ─── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("deploy-agent")


# ─── Hetzner metadata + API ─────────────────────────────────────
def get_label_from_metadata() -> str | None:
    """Read the deploy label from the Hetzner metadata service
    (no auth, available at the well-known link-local address)."""
    try:
        with urllib.request.urlopen(f"{HETZNER_META}/labels", timeout=3) as r:
            data = json.load(r)
        return (data.get("labels") or {}).get(DEPLOY_LABEL)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        log.warning("metadata fetch failed: %s", e)
        return None


def get_label_from_api() -> str | None:
    """Fallback: read the label via the Hetzner Cloud API
    (authenticated, hits the public endpoint)."""
    req = urllib.request.Request(
        f"{HETZNER_API}/{SERVER_ID}",
        headers={"Authorization": f"Bearer {HETZNER_TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.load(r)
        return (data.get("server", {}).get("labels") or {}).get(DEPLOY_LABEL)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        log.warning("api fetch failed: %s", e)
        return None


# ─── S3 sync (Hetzner Object Storage, S3-compatible) ────────────
def sync_from_s3() -> bool:
    """Pull S3_PREFIX/* from S3_BUCKET to STAGE_DIR, mirroring.
    Returns True on success, False on any error."""
    import boto3  # available via `pip install boto3` in install.sh
    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=os.environ.get("S3_REGION", "fsn1"),
    )

    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    # Wipe the staging dir so deletions in the bucket propagate
    for p in STAGE_DIR.iterdir():
        if p.is_dir():
            subprocess.run(["rm", "-rf", str(p)], check=True)
        else:
            p.unlink()

    paginator = s3.get_paginator("list_objects_v2")
    count = 0
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=S3_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key or key.endswith("/"):
                continue
            rel = key[len(S3_PREFIX):] if key.startswith(S3_PREFIX) else key
            dest = STAGE_DIR / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(S3_BUCKET, key, str(dest))
            count += 1
    log.info("synced %d files from s3://%s/%s", count, S3_BUCKET, S3_PREFIX)
    return True


# ─── Container swap ─────────────────────────────────────────────
def swap_into_container() -> bool:
    """Replace the nginx html dir inside the running container
    and reload nginx gracefully."""
    try:
        running = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", CONTAINER_NAME],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except subprocess.CalledProcessError as e:
        log.error("container %s not found: %s", CONTAINER_NAME, e.stderr)
        return False
    if running != "true":
        log.error("container %s is not running (state=%s)", CONTAINER_NAME, running)
        return False

    log.info("wiping %s:%s", CONTAINER_NAME, HTML_DIR_IN_CTN)
    subprocess.run(
        ["docker", "exec", CONTAINER_NAME, "sh", "-c",
         f"rm -rf {HTML_DIR_IN_CTN}/*"],
        check=True,
    )
    log.info("copying staged dist/ into container")
    subprocess.run(
        ["docker", "cp", f"{STAGE_DIR}/.", f"{CONTAINER_NAME}:{HTML_DIR_IN_CTN}"],
        check=True,
    )
    log.info("reloading nginx (graceful)")
    subprocess.run(
        ["docker", "exec", CONTAINER_NAME, "nginx", "-s", "reload"],
        check=True,
    )
    return True


# ─── State ──────────────────────────────────────────────────────
def get_last_sha() -> str | None:
    try:
        return STATE_FILE.read_text().strip() or None
    except FileNotFoundError:
        return None


def set_last_sha(sha: str) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(sha)


# ─── Main loop ──────────────────────────────────────────────────
def main() -> None:
    log.info("deploy-agent starting (poll=%ds, container=%s, label=%s)",
             POLL_INTERVAL, CONTAINER_NAME, DEPLOY_LABEL)

    # On startup, align state with the current label so we don't
    # immediately re-deploy the version that's already running.
    current = get_label_from_metadata() or get_label_from_api()
    if current:
        log.info("initial state: %s=%s (skipping initial deploy)", DEPLOY_LABEL, current)
        set_last_sha(current)

    while True:
        try:
            sha = get_label_from_metadata() or get_label_from_api()
            if not sha:
                log.debug("no label set yet")
            else:
                last = get_last_sha()
                if sha != last:
                    log.info("new deploy: %s -> %s", last, sha)
                    if sync_from_s3() and swap_into_container():
                        set_last_sha(sha)
                        log.info("deploy %s live", sha)
                    else:
                        log.error("deploy %s FAILED — will retry on next poll", sha)
                else:
                    log.debug("no change (sha=%s)", sha)
        except Exception as e:
            log.exception("poll cycle error: %s", e)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("shutting down")
        sys.exit(0)
