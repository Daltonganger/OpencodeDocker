STACK_DIR := /opt/stacks/opencode-dev
ICLOUD_HOST_PATH_FROM_ENV := $(shell sed -n 's/^ICLOUD_HOST_PATH=//p' $(STACK_DIR)/.env 2>/dev/null | tail -1)
ICLOUD_HOST_PATH ?= $(if $(ICLOUD_HOST_PATH_FROM_ENV),$(ICLOUD_HOST_PATH_FROM_ENV),$(STACK_DIR)/icloud-drive)
COMPOSE := docker compose -f $(STACK_DIR)/compose.yaml
COMPOSE_ICLOUD := docker compose -f $(STACK_DIR)/compose.yaml -f $(STACK_DIR)/compose.icloud-drive.override.yaml

.PHONY: up up-icloud down down-icloud logs attach ssh-key render-config auth-bootstrap backup-config validate-config validate-config-icloud icloud-prepare icloud-config icloud-reconnect icloud-logs icloud-mount icloud-unmount icloud-status icloud-test

up:
	@docker network create traefik-network >/dev/null 2>&1 || true
	@mkdir -p $(STACK_DIR)/state/opencode/share $(STACK_DIR)/state/opencode/state $(STACK_DIR)/state/code-server $(STACK_DIR)/cache/opencode
	@bash $(STACK_DIR)/render-opencode-config.sh
	@$(COMPOSE) up -d --build

up-icloud:
	@docker network create traefik-network >/dev/null 2>&1 || true
	@$(MAKE) -s icloud-prepare
	@mkdir -p $(STACK_DIR)/state/opencode/share $(STACK_DIR)/state/opencode/state $(STACK_DIR)/state/code-server $(STACK_DIR)/cache/opencode
	@bash $(STACK_DIR)/render-opencode-config.sh
	@$(COMPOSE_ICLOUD) up -d --build

down:
	@$(COMPOSE) down

down-icloud:
	@$(COMPOSE_ICLOUD) down

logs:
	@$(COMPOSE) logs -f

attach:
	@$(COMPOSE) exec opencode-dev bash -lc 'tmux -S /shared/tmux.sock attach -t opencode'

ssh-key:
	@sed -n '1,120p' $(STACK_DIR)/config/ssh/authorized_keys

render-config:
	@bash $(STACK_DIR)/render-opencode-config.sh

auth-bootstrap:
	@bash $(STACK_DIR)/auth-bootstrap.sh

backup-config:
	@ts=$$(date +%Y%m%d-%H%M%S); \
	mkdir -p $(STACK_DIR)/backups/$$ts; \
	cp -a $(STACK_DIR)/config/opencode $(STACK_DIR)/config/sftpgo $(STACK_DIR)/config/ssh $(STACK_DIR)/backups/$$ts/

validate-config:
	@python3 -m json.tool $(STACK_DIR)/config/opencode/opencode.json >/dev/null
	@python3 -m json.tool $(STACK_DIR)/config/sftpgo/initial_data.json >/dev/null
	@$(COMPOSE) config --quiet

validate-config-icloud:
	@python3 -m json.tool $(STACK_DIR)/config/opencode/opencode.json >/dev/null
	@python3 -m json.tool $(STACK_DIR)/config/sftpgo/initial_data.json >/dev/null
	@$(COMPOSE_ICLOUD) config --quiet

icloud-prepare:
	@mkdir -p $(ICLOUD_HOST_PATH) $(STACK_DIR)/state/rclone $(STACK_DIR)/cache/rclone $(STACK_DIR)/logs
	@if [ "$$(uname -s)" = "Linux" ]; then \
		if [ ! -e /dev/fuse ]; then echo "ERROR: /dev/fuse ontbreekt. Installeer fuse3 op de host." >&2; exit 1; fi; \
		if ! mountpoint -q "$(ICLOUD_HOST_PATH)"; then mount --bind "$(ICLOUD_HOST_PATH)" "$(ICLOUD_HOST_PATH)"; fi; \
		mount --make-rshared "$(ICLOUD_HOST_PATH)"; \
		findmnt -no PROPAGATION "$(ICLOUD_HOST_PATH)" | grep -Eq 'shared|rshared' || { echo "ERROR: $(ICLOUD_HOST_PATH) is niet shared/rshared." >&2; exit 1; }; \
	else \
		echo "Skip Linux mount-propagation prep on $$(uname -s)"; \
	fi

icloud-config:
	@$(MAKE) -s icloud-prepare
	@$(COMPOSE_ICLOUD) run --rm --entrypoint rclone icloud-rclone config

icloud-reconnect:
	@remote=$$(grep -E '^ICLOUD_RCLONE_REMOTE=' $(STACK_DIR)/.env 2>/dev/null | tail -1 | cut -d= -f2-); \
	$(COMPOSE_ICLOUD) run --rm --entrypoint rclone icloud-rclone reconnect "$${remote:-icloud:}"

icloud-logs:
	@$(COMPOSE_ICLOUD) logs -f icloud-rclone

icloud-mount:
	@$(MAKE) -s icloud-prepare
	@$(COMPOSE_ICLOUD) up -d icloud-rclone

icloud-unmount:
	@$(COMPOSE_ICLOUD) stop icloud-rclone

icloud-status:
	@$(COMPOSE_ICLOUD) ps icloud-rclone
	@$(COMPOSE_ICLOUD) exec icloud-rclone sh -lc "grep -E ' /mnt/icloud (fuse|fuse\\.rclone|rclone) ' /proc/mounts || true"

icloud-test:
	@remote=$$(grep -E '^ICLOUD_RCLONE_REMOTE=' $(STACK_DIR)/.env 2>/dev/null | tail -1 | cut -d= -f2-); \
	$(COMPOSE_ICLOUD) exec icloud-rclone rclone lsd "$${remote:-icloud:}" >/dev/null
	@$(COMPOSE_ICLOUD) exec opencode-dev sh -lc 'test -d /home/app/workspace/icloud && ls -la /home/app/workspace/icloud | head'
