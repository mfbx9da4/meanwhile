#!/bin/bash
# Setup local development secrets from macOS keychain
# Run: npm run setup-secrets

set -e

KEYCHAIN_SERVICE="meanwhile-config-editor"

# Function to get or set keychain value
get_or_set_secret() {
    local name=$1
    local prompt=$2

    # Try to get from keychain
    value=$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$name" -w 2>/dev/null || true)

    if [ -z "$value" ]; then
        echo -n "$prompt: "
        read -s value
        echo
        # Store in keychain
        security add-generic-password -s "$KEYCHAIN_SERVICE" -a "$name" -w "$value" 2>/dev/null || \
        security add-generic-password -U -s "$KEYCHAIN_SERVICE" -a "$name" -w "$value"
        echo "✓ Saved $name to keychain"
    else
        echo "✓ Found $name in keychain"
    fi

    echo "$value"
}

echo "Setting up .dev.vars for local development..."
echo

PIN=$(get_or_set_secret "PIN" "Enter PIN (4-digit)")
MISTRAL_API_KEY=$(get_or_set_secret "MISTRAL_API_KEY" "Enter Mistral API key")
GITHUB_TOKEN=$(get_or_set_secret "GITHUB_TOKEN" "Enter GitHub token")

cat > .dev.vars << EOF
PIN=$PIN
MISTRAL_API_KEY=$MISTRAL_API_KEY
GITHUB_TOKEN=$GITHUB_TOKEN
EOF

echo
echo "✓ Created .dev.vars"
echo "Run 'npm run dev' to start local development"
