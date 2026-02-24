#!/bin/bash

# HealthyGatorSportsFan Django Setup Script
# This script automates the initial setup of the Django backend

set -e  # Exit on error

echo "=========================================="
echo "HealthyGatorSportsFan Django Setup"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}Step 1: Creating virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${YELLOW}✓ Virtual environment already exists${NC}"
fi

echo -e "${GREEN}Step 2: Activating virtual environment...${NC}"
source venv/bin/activate

echo -e "${GREEN}Step 3: Upgrading pip...${NC}"
pip install --upgrade pip

echo -e "${GREEN}Step 4: Installing requirements...${NC}"
pip install -r requirements.txt

echo -e "${GREEN}Step 5: Installing additional packages...${NC}"
pip install argon2-cffi

echo -e "${GREEN}Step 6: Generating SECRET_KEY...${NC}"
SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

echo -e "${GREEN}Step 7: Creating .env file...${NC}"
if [ ! -f ".env" ]; then
    cat > .env << EOF
SECRET_KEY=$SECRET_KEY
DEBUG=True
DATABASE_NAME=healthygatorsportsfan
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
DATABASE_HOST=localhost
DATABASE_PORT=5432
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠ Please update DATABASE_USER and DATABASE_PASSWORD in .env file${NC}"
else
    echo -e "${YELLOW}✓ .env file already exists${NC}"
fi

echo -e "${GREEN}Step 8: Running migrations...${NC}"
echo -e "${YELLOW}Attempting to connect to database...${NC}"

# Try to run migrations, but don't fail the script if database isn't available
set +e  # Don't exit on error
python manage.py makemigrations >/tmp/makemigrations.log 2>&1
MAKEMIGRATIONS_EXIT=$?

python manage.py migrate >/tmp/migrate.log 2>&1
MIGRATE_EXIT=$?
set -e  # Re-enable exit on error

if [ $MIGRATE_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations completed${NC}"
    MIGRATIONS_SUCCESS=true
elif grep -q "Connection refused\|OperationalError\|connection to server" /tmp/migrate.log 2>/dev/null; then
    echo -e "${YELLOW}⚠ Database connection failed. Skipping migrations.${NC}"
    echo -e "${YELLOW}  This is OK if PostgreSQL isn't set up yet.${NC}"
    echo -e "${YELLOW}  To complete setup later:${NC}"
    echo -e "${YELLOW}  1. Make sure PostgreSQL is running${NC}"
    echo -e "${YELLOW}  2. Update .env file with correct database credentials${NC}"
    echo -e "${YELLOW}  3. Run: python manage.py migrate${NC}"
    MIGRATIONS_SUCCESS=false
else
    echo -e "${YELLOW}⚠ Migration had issues. Check logs for details.${NC}"
    echo -e "${YELLOW}  Logs: /tmp/migrate.log${NC}"
    MIGRATIONS_SUCCESS=false
fi

echo -e "${GREEN}Step 9: Creating superuser (optional)...${NC}"
if [ "$MIGRATIONS_SUCCESS" = true ]; then
    read -p "Do you want to create a superuser now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        python manage.py createsuperuser
    else
        echo -e "${YELLOW}You can create a superuser later with: python manage.py createsuperuser${NC}"
    fi
else
    echo -e "${YELLOW}Skipping superuser creation (database not connected)${NC}"
    echo -e "${YELLOW}Create superuser after setting up database: python manage.py createsuperuser${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Setup Complete! 🎉"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Update .env file with your database credentials"
echo "2. Make sure PostgreSQL is running"
echo "3. Make sure Redis is running (for Celery)"
echo "4. Run './run.sh' to start all services"
echo ""
echo "Or run manually:"
echo "  source venv/bin/activate"
echo "  python manage.py runserver"
