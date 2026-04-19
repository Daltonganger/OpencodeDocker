#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[%s] %s\n' "$(date -Iseconds)" "$*"
}

enabled="${OPENCODE_UPDATER_ENABLED:-false}"
enabled="${enabled,,}"
force="${OPENCODE_UPDATER_FORCE:-false}"
force="${force,,}"
repo_url="${OPENCODE_UPDATER_REPO_URL:-}"
branch="${OPENCODE_UPDATER_BRANCH:-main}"
repo_dir="${OPENCODE_UPDATER_REPO_DIR:-/var/lib/opencode-updater/repo}"
admin_target="${OPENCODE_UPDATER_ADMIN_TARGET:-/opt/stacks/opencode-admin}"
stack_target="${OPENCODE_UPDATER_STACK_TARGET:-/opt/stacks/opencode-dev}"
scope="${OPENCODE_UPDATER_SCOPE:-full}"
skip_repo_sync="${OPENCODE_UPDATER_SKIP_REPO_SYNC:-false}"
skip_repo_sync="${skip_repo_sync,,}"
lock_file="${OPENCODE_UPDATER_LOCK_FILE:-/var/lib/opencode-updater/update.lock}"
admin_services="${OPENCODE_UPDATER_ADMIN_SERVICES:-opencode-admin}"
stack_services="${OPENCODE_UPDATER_STACK_SERVICES:-opencode-backend opencode-dev opencode-github-copilot-auth opencode-google-auth opencode-qwen-auth openchamber code-server sftpgo ssh-dev}"

mkdir -p "$(dirname "$repo_dir")"
mkdir -p "$(dirname "$lock_file")"

exec 9>"$lock_file"
if ! flock -n 9; then
  log "another update is already running"
  exit 75
fi

if [ "$enabled" != "true" ] && [ "$force" != "true" ]; then
  log "auto updater disabled"
  exit 0
fi

if [ "$skip_repo_sync" != "true" ] && [ -z "$repo_url" ]; then
  log "OPENCODE_UPDATER_REPO_URL is empty"
  exit 0
fi

sync_admin=false
sync_stack=false
update_admin=false
update_stack=false
refresh_updater=false

case "$scope" in
  full)
    sync_admin=true
    sync_stack=true
    update_admin=true
    update_stack=true
    refresh_updater=true
    ;;
  admin)
    sync_admin=true
    update_admin=true
    refresh_updater=true
    ;;
  stack)
    sync_stack=true
    update_stack=true
    ;;
  *)
    log "invalid OPENCODE_UPDATER_SCOPE: $scope"
    exit 64
    ;;
esac

if [ "$skip_repo_sync" = "true" ]; then
  log "skipping repo sync; using current stack files on disk"
else
  if [ ! -d "$repo_dir/.git" ]; then
    log "cloning $repo_url#$branch"
    git clone --depth 1 --branch "$branch" "$repo_url" "$repo_dir"
  else
    log "fetching updates"
    git -C "$repo_dir" fetch --depth 1 origin "$branch"
    git -C "$repo_dir" checkout -B "$branch" "origin/$branch"
    git -C "$repo_dir" reset --hard "origin/$branch"
  fi
fi

sync_dir() {
  local src="$1"
  local dst="$2"
  shift 2
  mkdir -p "$dst"
  rsync -a --delete \
    "$@" \
    "$src/" "$dst/"
}

if [ "$sync_admin" = "true" ] && [ "$skip_repo_sync" != "true" ]; then
  log "syncing admin files"
  sync_dir "$repo_dir/opencode-admin" "$admin_target" \
    --exclude '.env' \
    --exclude 'node_modules/' \
    --exclude 'releases/' \
    --exclude 'backups/' \
    --exclude 'updater-data/'
fi

if [ "$sync_stack" = "true" ] && [ "$skip_repo_sync" != "true" ]; then
  log "syncing stack files"
  sync_dir "$repo_dir/generated/2631de/opencode-dev" "$stack_target" \
    --exclude '.env' \
    --exclude 'workspace/' \
    --exclude 'state/' \
    --exclude 'cache/' \
    --exclude 'config/ssh/authorized_keys'
fi

if [ "$sync_stack" = "true" ] && [ -x "$stack_target/render-opencode-config.sh" ]; then
  log "rendering stack config"
  bash "$stack_target/render-opencode-config.sh"
fi

if [ "$update_admin" = "true" ]; then
  log "updating admin services"
  docker compose -f "$admin_target/compose.yaml" up -d --build --pull always $admin_services
fi

if [ "$update_stack" = "true" ]; then
  log "updating stack services"
  docker compose -f "$stack_target/compose.yaml" up -d --build --pull always $stack_services
fi

if [ "$refresh_updater" = "true" ]; then
  log "refreshing auto-updater service"
  docker compose -f "$admin_target/compose.yaml" up -d --build --pull always opencode-auto-updater
fi

log "auto update complete"
