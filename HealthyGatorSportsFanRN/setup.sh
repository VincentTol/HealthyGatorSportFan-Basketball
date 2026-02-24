#!/bin/bash

# HealthyGatorSportsFan React Native Frontend Setup Script
# This script automates the initial setup of the React Native/Expo frontend

set -e  # Exit on error

echo "=========================================="
echo "HealthyGatorSportsFan Frontend Setup"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}Step 1: Checking Node.js and npm...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed!${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed!${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"
echo -e "${GREEN}✓ npm: $NPM_VERSION${NC}"

echo -e "${GREEN}Step 2: Installing dependencies...${NC}"
npm install

echo -e "${GREEN}Step 3: Installing additional Expo packages...${NC}"
npx expo install react-native-web
npx expo install expo-web-browser

echo -e "${GREEN}Step 4: Installing TypeScript types...${NC}"
npm install --save-dev @types/react @types/react-native

echo -e "${GREEN}Step 5: Checking AppUrls configuration...${NC}"
if [ -f "constants/AppUrls.ts" ]; then
    echo -e "${YELLOW}Current backend URL in AppUrls.ts:${NC}"
    grep -A 1 "url:" constants/AppUrls.ts || true
    echo ""
    echo -e "${YELLOW}⚠ Make sure the URL in constants/AppUrls.ts matches your backend:${NC}"
    echo -e "${YELLOW}  - For local development: http://localhost:8000${NC}"
    echo -e "${YELLOW}  - For ngrok: https://your-ngrok-domain.ngrok-free.app${NC}"
    echo -e "${YELLOW}  - Update it if needed before running the app${NC}"
else
    echo -e "${RED}Warning: constants/AppUrls.ts not found!${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Setup Complete! 🎉"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Update constants/AppUrls.ts with your backend URL"
echo "2. Make sure your Django backend is running"
echo "3. Run './run.sh' to start the Expo development server"
echo ""
echo "Or run manually:"
echo "  npx expo start"
