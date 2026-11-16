#!/usr/bin/env bash
# Sets up https://affiliate-products.local.dev-gutools.co.uk for local development:
# installs dev-nginx (with nginx and mkcert), creates a trusted certificate,
# writes the nginx config from nginx/nginx-mapping.yml and restarts nginx.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="affiliate-products.local.dev-gutools.co.uk"

YELLOW='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

step() { echo -e "\n${YELLOW}==> $1${NC}"; }
fail() { echo -e "${RED}$1${NC}" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || fail "This script only supports macOS."
command -v brew >/dev/null || fail "Homebrew is required: https://brew.sh"

step "Installing dev-nginx"
if command -v dev-nginx >/dev/null; then
	echo "Already installed"
else
	brew install guardian/devtools/dev-nginx
fi

step "Checking ${DOMAIN} resolves to 127.0.0.1"
if [[ "$(dig +short "${DOMAIN}" | tail -n1)" == "127.0.0.1" ]]; then
	echo "OK"
else
	dev-nginx add-to-hosts-file "${DOMAIN}"
fi

step "Creating certificate and nginx config (you may be asked for your password)"
dev-nginx setup-app "${ROOT_DIR}/nginx/nginx-mapping.yml"

# setup-app swallows nginx errors, so a bad config leaves the old nginx running
# and serving another app's certificate. Check and restart where errors show.
step "Restarting nginx"
sudo nginx -t
if pgrep -x nginx >/dev/null; then
	sudo nginx -s stop
	while pgrep -x nginx >/dev/null; do sleep 0.2; done
fi
sudo nginx

step "Checking the certificate"
if ! curl -sS -o /dev/null --max-time 5 "https://${DOMAIN}/"; then
	fail "https://${DOMAIN} failed. Run 'curl -v https://${DOMAIN}/' for detail."
fi
echo "OK"

echo -e "\n${GREEN}Done.${NC} Run ${YELLOW}npm run affiliate-products-dev${NC} and open https://${DOMAIN}"
