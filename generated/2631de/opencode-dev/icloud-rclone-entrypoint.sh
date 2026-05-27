#!/bin/sh
set -eu

: "${ICLOUD_RCLONE_REMOTE:=icloud:}"
: "${ICLOUD_RCLONE_VFS_CACHE_MAX_SIZE:=20G}"
: "${ICLOUD_RCLONE_VFS_CACHE_MAX_AGE:=168h}"
: "${PUID:=1000}"
: "${PGID:=1000}"
: "${UMASK:=002}"
: "${RCLONE_CONFIG:=/config/rclone/rclone.conf}"

if [ ! -e /dev/fuse ]; then
  echo "ERROR: /dev/fuse is not available in the container." >&2
  echo "Check compose devices and host package fuse3." >&2
  exit 1
fi

if [ ! -s "$RCLONE_CONFIG" ]; then
  echo "ERROR: rclone config not found at $RCLONE_CONFIG." >&2
  echo "Run: make icloud-config" >&2
  exit 1
fi

mkdir -p /mnt/icloud /cache /logs /config/rclone
touch /logs/icloud-rclone.log

if ! grep -q '^user_allow_other' /etc/fuse.conf 2>/dev/null; then
  echo user_allow_other >> /etc/fuse.conf
fi

echo "Starting rclone mount: ${ICLOUD_RCLONE_REMOTE} -> /mnt/icloud"

exec rclone mount "$ICLOUD_RCLONE_REMOTE" /mnt/icloud \
  --allow-other \
  --allow-non-empty \
  --vfs-cache-mode=full \
  --vfs-cache-max-size="$ICLOUD_RCLONE_VFS_CACHE_MAX_SIZE" \
  --vfs-cache-max-age="$ICLOUD_RCLONE_VFS_CACHE_MAX_AGE" \
  --dir-cache-time=1h \
  --poll-interval=1m \
  --uid="$PUID" \
  --gid="$PGID" \
  --umask="$UMASK" \
  --cache-dir=/cache \
  --log-file=/logs/icloud-rclone.log \
  --log-level=INFO
