#!/bin/bash

# Script to run ngrok with a static domain
# Usage: ./run_ngrok.sh <your-static-domain>

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide your ngrok static domain${NC}"
    echo "Usage: ./run_ngrok.sh <your-static-domain>"
    echo "Example: ./run_ngrok.sh nannie-halogenous-tidily.ngrok-free.dev"
    exit 1
fi

NGROK_DOMAIN=$1

echo -e "${BLUE}=========================================="
echo "Starting ngrok tunnel"
echo "==========================================${NC}"
echo ""
echo -e "${GREEN}Static domain:${NC} $NGROK_DOMAIN"
echo -e "${GREEN}Forwarding to:${NC} http://localhost:8000"
echo ""
echo -e "${YELLOW}Make sure Django server is running on port 8000${NC}"
echo -e "${YELLOW}Don't forget to add the ngrok URL to ALLOWED_HOSTS in settings.py${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop ngrok${NC}"
echo ""

ngrok http 8000 --url "https://$NGROK_DOMAIN"
