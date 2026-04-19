STACK_DIR := /opt/stacks/opencode-dev
COMPOSE := docker compose -f $(STACK_DIR)/compose.yaml

.PHONY: up down logs attach ssh-key render-config auth-bootstrap backup-config validate-config

up:
	@docker network create traefik-network >/dev/null 2>&1 || true
	@mkdir -p $(STACK_DIR)/state/opencode/share $(STACK_DIR)/state/opencode/state $(STACK_DIR)/state/code-server $(STACK_DIR)/cache/opencode
	@bash $(STACK_DIR)/render-opencode-config.sh
	@$(COMPOSE) up -d --build

down:
	@$(COMPOSE) down

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
