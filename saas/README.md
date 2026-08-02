# Persona Studio SaaS

A complete SaaS platform for AI-powered identity transformation with crypto payments.

## Features

### User Features
- **User Authentication** - Signup/login with JWT tokens
- **Credit System** - Buy credits with USDT/USDC
- **Face Swap** - Real-time face swap with AI
- **Video Swap** - Face swap in videos
- **Live Portrait** - Animate static portraits
- **Background Control** - Remove/replace backgrounds
- **Voice Clone** - Clone and convert voices
- **API Access** - Programmatic access with API keys

### Admin Features
- **Dashboard** - Platform statistics and analytics
- **User Management** - View, edit, disable users
- **Transaction History** - All payments and usage
- **Pricing Control** - Update credit costs
- **Announcements** - System-wide messages

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, JWT Auth
- **Frontend**: React, TypeScript, Tailwind CSS
- **Database**: SQLite (upgradeable to PostgreSQL)
- **Payments**: USDT/USDC (TRC20, ERC20, BEP20)
- **AI Engine**: PyTorch, InsightFace, RunPod GPU

## Quick Start

### Local Development

```bash
# Setup
cd saas
chmod +x setup.sh
./setup.sh

# Start server
source .venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Build frontend
cd frontend
npm install
npm run dev
```

### Docker Deployment

```bash
cd saas
docker-compose up -d
```

### RunPod Deployment

1. Push to GitHub
2. Create RunPod pod with GPU
3. Clone repo and run:
```bash
cd saas
pip install -r backend/requirements.txt
pip install -e ../packages/shared
pip install -e ../packages/persona-swap-core
pip install -e ../packages/sdk
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Default Credentials

**Admin Panel:**
- URL: http://localhost:8000/admin
- Username: `admin`
- Password: `admin123`

## API Endpoints

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Credits
- `GET /api/credits/packages` - List packages
- `POST /api/credits/purchase` - Buy credits
- `POST /api/credits/confirm` - Confirm payment

### Swap
- `POST /api/swap` - Perform face swap
- `GET /api/swap/{id}/status` - Check swap status

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/{id}` - Update user
- `GET /api/admin/transactions` - All transactions

## Credit Pricing

| Feature | Credits |
|---------|---------|
| Face Swap | 1 |
| Video Swap | 5 |
| Live Portrait | 3 |
| Background | 1 |
| Filter | 0.5 |
| Voice Clone | 2 |
| AI Translation | 2 |

## Environment Variables

```bash
JWT_SECRET=your-secret-key
CRYPTO_WALLET_ADDRESS=your-wallet
TRON_API_KEY=your-tron-key
ETH_API_KEY=your-eth-key
```

## License

MIT
