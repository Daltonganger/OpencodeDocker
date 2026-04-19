#!/usr/bin/env bash
set -euo pipefail

EXTENSIONS=(
  "fedaykindev.openchamber"
  "kilocode.kilo-code"
  "bmewburn.vscode-intelephense-client"
  "GitHub.copilot"
  "GitHub.copilot-chat"
  "github.vscode-github-actions"
  "eamodio.gitlens"
  "esbenp.prettier-vscode"
  "editorconfig.editorconfig"
  "redhat.vscode-yaml"
  "xdebug.php-debug"
)

mkdir -p /home/coder/.local/share/code-server/extensions

install_extension() {
  local ext="$1"
  local attempt

  for attempt in 1 2 3; do
    if code-server --install-extension "$ext" --force; then
      return 0
    fi

    echo "Retrying code-server extension install for $ext ($attempt/3)" >&2
    sleep 2
  done

  echo "Failed to install code-server extension: $ext" >&2
  return 1
}

for ext in "${EXTENSIONS[@]}"; do
  if ! code-server --list-extensions | grep -Fxiq "$ext"; then
    echo "Installing code-server extension: $ext"
    install_extension "$ext"
  fi
done

SETTINGS_DIR=/home/coder/.local/share/code-server/User
SETTINGS_FILE="${SETTINGS_DIR}/settings.json"
DEFAULT_SETTINGS_FILE=/usr/local/share/code-server-settings.json
CONFIG_DIR=/home/coder/.config/code-server
CONFIG_FILE="${CONFIG_DIR}/config.yaml"

mkdir -p "$SETTINGS_DIR"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_FILE" <<'EOF'
bind-addr: 0.0.0.0:8080
auth: none
cert: false
EOF

if [ ! -f "$SETTINGS_FILE" ] && [ -f "$DEFAULT_SETTINGS_FILE" ]; then
  cp "$DEFAULT_SETTINGS_FILE" "$SETTINGS_FILE"
fi

SETTINGS_FILE="$SETTINGS_FILE" OPENCHAMBER_API_URL="http://opencode-extension-proxy:4096" perl <<'EOF'
use strict;
use warnings;
use JSON::PP;

my $settings_file = $ENV{SETTINGS_FILE};
my $api_url = $ENV{OPENCHAMBER_API_URL};
my $settings = {};

if (-e $settings_file) {
  local $/;
  open my $fh, '<', $settings_file or die "[code-server] Cannot read $settings_file: $!\n";
  my $content = <$fh>;
  close $fh;

  if (length $content) {
    eval {
      $settings = decode_json($content);
      1;
    } or do {
      my $error = $@ || 'unknown error';
      warn "[code-server] Skipping OpenChamber settings update for $settings_file: $error";
      exit 0;
    };
  }
}

if (($settings->{"openchamber.apiUrl"} // '') ne $api_url) {
  $settings->{"openchamber.apiUrl"} = $api_url;
  open my $fh, '>', $settings_file or die "[code-server] Cannot write $settings_file: $!\n";
  print {$fh} JSON::PP->new->ascii->pretty->canonical->encode($settings);
  close $fh;
}
EOF

exec code-server --auth none --bind-addr 0.0.0.0:8080 /home/coder/project
