#!/bin/bash

# HealthyGatorSportsFan React Native Frontend Run Script
# This script starts the Expo development server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}=========================================="
echo "HealthyGatorSportsFan Frontend"
echo "==========================================${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ Dependencies not installed. Running setup...${NC}"
    ./setup.sh
fi

echo -e "${GREEN}Starting Expo development server...${NC}"
echo ""
echo -e "${YELLOW}Make sure your Django backend is running!${NC}"
echo -e "${YELLOW}Backend should be at: http://127.0.0.1:8000${NC}"
echo -e "${YELLOW}Or your ngrok URL if using ngrok${NC}"
echo ""
echo -e "${GREEN}Press 'a' to open Android emulator${NC}"
echo -e "${GREEN}Press 'i' to open iOS simulator${NC}"
echo -e "${GREEN}Press 'w' to open in web browser${NC}"
echo -e "${GREEN}Press 'r' to reload${NC}"
echo -e "${GREEN}Press Ctrl+C to stop${NC}"
echo ""

npx expo start
