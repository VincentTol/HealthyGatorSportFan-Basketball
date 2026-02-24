#!/bin/bash

# HealthyGatorSportsFan Django Run Script
# This script starts all necessary services

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
echo "HealthyGatorSportsFan Django Services"
echo "==========================================${NC}"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}Error: Virtual environment not found!${NC}"
    echo "Please run ./setup.sh first"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found!${NC}"
    echo "Please create .env file or run ./setup.sh"
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Check if Redis is running
echo -e "${GREEN}Checking Redis...${NC}"
if check_port 6379; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠ Redis is not running on port 6379${NC}"
    echo "Please start Redis: redis-server"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if port 8000 is available
if check_port 8000; then
    echo -e "${YELLOW}⚠ Port 8000 is already in use${NC}"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}Starting services...${NC}"
echo ""
echo -e "${GREEN}1. Django Server${NC}"
echo "   Running on: http://127.0.0.1:8000"
echo ""
echo -e "${GREEN}2. Celery Worker${NC}"
echo "   Processing background tasks"
echo ""
echo -e "${GREEN}3. Celery Beat${NC}"
echo "   Scheduling periodic tasks"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Create a function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    kill $DJANGO_PID $CELERY_WORKER_PID $CELERY_BEAT_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Start Django server in background
echo -e "${GREEN}Starting Django server...${NC}"
python manage.py runserver > /tmp/django_server.log 2>&1 &
DJANGO_PID=$!

# Wait a moment for Django to start
sleep 2

# Start Celery worker in background
echo -e "${GREEN}Starting Celery worker...${NC}"
celery -A project worker --pool=solo -l info > /tmp/celery_worker.log 2>&1 &
CELERY_WORKER_PID=$!

# Start Celery beat in background
echo -e "${GREEN}Starting Celery beat...${NC}"
celery -A project beat --loglevel=info > /tmp/celery_beat.log 2>&1 &
CELERY_BEAT_PID=$!

echo ""
echo -e "${GREEN}=========================================="
echo "All services started! 🚀"
echo "==========================================${NC}"
echo ""
echo "Django Server: http://127.0.0.1:8000"
echo "Admin Panel: http://127.0.0.1:8000/admin"
echo ""
echo "Logs:"
echo "  Django: /tmp/django_server.log"
echo "  Celery Worker: /tmp/celery_worker.log"
echo "  Celery Beat: /tmp/celery_beat.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all processes
wait
