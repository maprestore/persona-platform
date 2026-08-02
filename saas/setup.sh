#!/bin/bash
set -e

echo "========================================"
echo "   Persona Studio SaaS - Setup"
echo "========================================"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required"
    exit 1
fi

# Create virtual environment if not exists
if [ ! -d ".venv" ]; then
    echo "[1/4] Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# Install backend dependencies
echo "[2/4] Installing backend dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r backend/requirements.txt

# Install persona-platform packages
echo "[3/4] Installing persona-platform packages..."
pip install --quiet -e ../packages/shared
pip install --quiet -e ../packages/persona-swap-core
pip install --quiet -e ../packages/sdk
pip install --quiet -e ../packages/magiclip

# Initialize database
echo "[4/4] Initializing database..."
python3 -c "from backend.models import init_db, seed_default_data; init_db(); seed_default_data()"

# Create admin user with random password
python3 -c "
import secrets
from backend.models import SessionLocal, Admin
from backend.auth import hash_password
db = SessionLocal()
if not db.query(Admin).first():
    admin_password = secrets.token_urlsafe(12)
    admin = Admin(username='admin', email='admin@persona.studio', password_hash=hash_password(admin_password), role='superadmin')
    db.add(admin)
    db.commit()
    print(f'Admin user created: admin / {admin_password}')
    print('SAVE THIS PASSWORD - it will not be shown again!')
else:
    print('Admin user already exists')
db.close()
"

echo ""
echo "========================================"
echo "   Setup Complete!"
echo "========================================"
echo ""
echo "To start the server:"
echo "  source .venv/bin/activate"
echo "  uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "Access:"
echo "  Frontend: http://localhost:8000"
echo "  Admin:    http://localhost:8000/admin"
echo "  API:      http://localhost:8000/api/health"
echo ""
echo "Check the output above for the generated admin password."
echo ""
