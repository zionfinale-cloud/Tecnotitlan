#!/bin/sh
set -eu

cat > /usr/share/nginx/html/env.js <<EOF
window.__TECNOTITLAN_ENV__ = {
  REACT_APP_API_URL: "${REACT_APP_API_URL:-}",
  REACT_APP_STRIPE_PUBLISHABLE_KEY: "${REACT_APP_STRIPE_PUBLISHABLE_KEY:-}"
};
EOF
