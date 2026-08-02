"""Persona SaaS - Main API Server."""

from __future__ import annotations

import os
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv

# Load .env from the saas/ directory
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from fastapi import FastAPI, HTTPException, Depends, Request, Query, Body, UploadFile, File as FastAPIFile
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func
import httpx

from models import (
    init_db, seed_default_data, get_db,
    User, ApiKey, SwapHistory, Transaction, CreditPackage,
    PricingConfig, SystemSettings, Admin, Announcement, SupportMessage,
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_admin_user, authenticate_user,
    create_user, generate_api_key, validate_api_key, security,
    decode_token,
)
from payments import crypto_payment
from vast import VastAI
import json


# Config
ENGINE_URL = os.getenv("PERSONA_ENGINE_URL", "http://localhost:6967")
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB


# App setup
app = FastAPI(
    title="Persona Studio API",
    description="AI Identity Platform - Face swap, voice cloning, live portrait, background removal, and effects",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "Auth", "description": "User authentication and signup"},
        {"name": "Admin", "description": "Admin panel endpoints"},
        {"name": "Credits", "description": "Credit packages and purchases"},
        {"name": "Swap", "description": "AI transformation operations"},
        {"name": "Templates", "description": "Pre-built transformation templates"},
        {"name": "Batch", "description": "Batch processing operations"},
        {"name": "Webhooks", "description": "Webhook configuration"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    seed_default_data()


# ─── Pydantic Models ────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    username: str
    password: str


class SwapRequest(BaseModel):
    source_id: str
    target_id: str
    swap_type: str = "face_swap"


class CreditPurchaseRequest(BaseModel):
    package_id: str
    payment_method: str = "USDT-TRC20"
    tx_hash: Optional[str] = None


class UpdateUserRequest(BaseModel):
    credits: Optional[float] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class AnnouncementRequest(BaseModel):
    title: str
    message: str
    type: str = "info"


class PricingUpdateRequest(BaseModel):
    feature: str
    credits_cost: float


# ─── Auth Routes ─────────────────────────────────────────────────────────────

@app.post("/api/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    user = create_user(db, req.username, req.email, req.password)
    token = create_access_token({"sub": user.id, "username": user.username})
    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "credits": user.credits,
            "is_admin": user.is_admin,
        },
    }


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Try user login first
    user = authenticate_user(db, req.username, req.password)
    if user:
        token = create_access_token({"sub": user.id, "username": user.username})
        return {
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "credits": user.credits,
                "is_admin": user.is_admin,
            },
        }

    # Try admin login
    from models import Admin
    admin = db.query(Admin).filter(Admin.username == req.username).first()
    if admin and admin.is_active and verify_password(req.password, admin.password_hash):
        admin.last_login = datetime.now(timezone.utc)
        db.commit()
        token = create_access_token({"sub": admin.id, "username": admin.username, "admin": True})
        return {
            "token": token,
            "user": {
                "id": admin.id,
                "username": admin.username,
                "email": admin.email,
                "credits": 999999,
                "is_admin": True,
            },
        }

    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.get("/api/auth/me")
def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    is_admin_token = payload.get("admin", False)

    if is_admin_token:
        # Check admins table
        admin = db.query(Admin).filter(Admin.id == user_id).first()
        if not admin:
            raise HTTPException(status_code=401, detail="Admin not found")
        return {
            "id": admin.id,
            "username": admin.username,
            "email": admin.email,
            "credits": 999999,
            "is_admin": True,
            "created_at": admin.created_at.isoformat(),
        }

    # Check users table
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "credits": user.credits,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat(),
    }


# ─── User Routes ─────────────────────────────────────────────────────────────

@app.get("/api/user/credits")
def get_credits(current_user: User = Depends(get_current_user)):
    return {"credits": current_user.credits}


@app.get("/api/user/stats")
def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    swap_count = db.query(SwapHistory).filter(SwapHistory.user_id == current_user.id).count()
    key_count = db.query(ApiKey).filter(ApiKey.user_id == current_user.id, ApiKey.is_active == True).count()
    return {"swap_count": swap_count, "api_key_count": key_count}


@app.get("/api/admin/stats/summary")
def admin_stats_summary(
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()
    total_swaps = db.query(SwapHistory).count()
    total_keys = db.query(ApiKey).filter(ApiKey.is_active == True).count()
    return {"swap_count": total_swaps, "api_key_count": total_keys, "total_users": total_users}


@app.get("/api/user/history")
def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    total = db.query(SwapHistory).filter(SwapHistory.user_id == current_user.id).count()
    swaps = (
        db.query(SwapHistory)
        .filter(SwapHistory.user_id == current_user.id)
        .order_by(SwapHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "history": [
            {
                "id": s.id,
                "swap_type": s.swap_type,
                "credits_used": s.credits_used,
                "status": s.status,
                "created_at": s.created_at.isoformat(),
            }
            for s in swaps
        ],
    }


@app.get("/api/user/transactions")
def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    total = db.query(Transaction).filter(Transaction.user_id == current_user.id).count()
    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount": t.amount,
                "credits_before": t.credits_before,
                "credits_after": t.credits_after,
                "status": t.status,
                "description": t.description,
                "created_at": t.created_at.isoformat(),
            }
            for t in txs
        ],
    }


# ─── API Keys ────────────────────────────────────────────────────────────────

@app.post("/api/user/api-keys")
def create_key(
    name: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = generate_api_key(current_user, db, name)
    return {"key": key, "name": name}


@app.get("/api/user/api-keys")
def list_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    return {
        "keys": [
            {
                "id": k.id,
                "name": k.name,
                "key_preview": k.key[:8] + "..." + k.key[-4:],
                "is_active": k.is_active,
                "created_at": k.created_at.isoformat(),
                "last_used": k.last_used.isoformat() if k.last_used else None,
            }
            for k in keys
        ]
    }


@app.delete("/api/user/api-keys/{key_id}")
def delete_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.user_id == current_user.id,
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(key)
    db.commit()
    return {"status": "deleted"}


# ─── Credits / Payments ─────────────────────────────────────────────────────

@app.get("/api/credits/packages")
def get_packages(db: Session = Depends(get_db)):
    packages = db.query(CreditPackage).filter(CreditPackage.is_active == True).all()
    return {
        "packages": [
            {
                "id": p.id,
                "name": p.name,
                "credits": p.credits,
                "price_usd": p.price_usd,
                "price_usdt": p.price_usdt,
                "bonus_credits": p.bonus_credits,
            }
            for p in packages
        ]
    }


@app.post("/api/credits/purchase")
def purchase_credits(
    req: CreditPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    package = db.query(CreditPackage).filter(CreditPackage.id == req.package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    # Generate payment info
    payment_info = crypto_payment.generate_payment_address(
        current_user.id,
        package.price_usdt,
    )

    # Create pending transaction
    tx = Transaction(
        user_id=current_user.id,
        type="purchase",
        amount=package.credits + package.bonus_credits,
        credits_before=current_user.credits,
        tx_hash=req.tx_hash,
        wallet_address=payment_info["address"],
        status="pending" if not req.tx_hash else "pending",
        description=f"Purchase {package.name}: {package.credits} credits + {package.bonus_credits} bonus",
    )
    db.add(tx)
    db.commit()

    return {
        "transaction_id": tx.id,
        "payment": payment_info,
        "amount": package.credits + package.bonus_credits,
    }


@app.post("/api/credits/confirm")
def confirm_payment(
    tx_hash: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Find pending transaction
    tx = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.status == "pending",
        Transaction.type == "purchase",
    ).first()

    if not tx:
        raise HTTPException(status_code=404, detail="No pending transaction found")

    # Update with tx hash
    tx.tx_hash = tx_hash
    db.commit()

    # In production, this would verify on-chain
    # For now, we'll mark as confirmed
    tx.status = "confirmed"
    current_user.credits += tx.amount
    tx.credits_after = current_user.credits
    db.commit()

    return {
        "status": "confirmed",
        "credits_added": tx.amount,
        "total_credits": current_user.credits,
    }


# ─── Pricing ─────────────────────────────────────────────────────────────────

@app.get("/api/pricing")
def get_pricing(db: Session = Depends(get_db)):
    pricing = db.query(PricingConfig).all()
    return {
        "pricing": [
            {
                "feature": p.feature,
                "credits_cost": p.credits_cost,
                "description": p.description,
            }
            for p in pricing
        ]
    }


# ─── Face Swap (Protected) ──────────────────────────────────────────────────

@app.post("/api/swap")
async def swap_faces(
    req: SwapRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check credits
    pricing = db.query(PricingConfig).filter(PricingConfig.feature == req.swap_type).first()
    if not pricing:
        raise HTTPException(status_code=400, detail="Unknown swap type")

    if current_user.credits < pricing.credits_cost:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    # Deduct credits
    current_user.credits -= pricing.credits_cost

    # Log swap
    swap = SwapHistory(
        user_id=current_user.id,
        swap_type=req.swap_type,
        credits_used=pricing.credits_cost,
        source_file=req.source_id,
        target_file=req.target_id,
        status="processing",
    )
    db.add(swap)

    # Log transaction
    tx = Transaction(
        user_id=current_user.id,
        type="usage",
        amount=-pricing.credits_cost,
        credits_before=current_user.credits + pricing.credits_cost,
        credits_after=current_user.credits,
        status="confirmed",
        description=f"{req.swap_type} swap",
    )
    db.add(tx)
    db.commit()

    # Forward to persona engine
    try:
        source_path = UPLOAD_DIR / f"{req.source_id}"
        target_path = UPLOAD_DIR / f"{req.target_id}"

        # Find actual files with extensions
        source_file = None
        target_file = None
        for ext in ['.jpg', '.jpeg', '.png', '.webp']:
            if (UPLOAD_DIR / f"{req.source_id}{ext}").exists():
                source_file = UPLOAD_DIR / f"{req.source_id}{ext}"
            if (UPLOAD_DIR / f"{req.target_id}{ext}").exists():
                target_file = UPLOAD_DIR / f"{req.target_id}{ext}"

        if source_file:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Step 1: Upload source file to engine
                with open(source_file, "rb") as sf:
                    src_resp = await client.post(
                        f"{ENGINE_URL}/upload",
                        files={"file": (source_file.name, sf, "image/jpeg")},
                    )
                if src_resp.status_code != 200:
                    raise Exception(f"Engine upload source failed: {src_resp.text}")
                engine_source_id = src_resp.json()["file_id"]

                # Step 2: Upload target file to engine
                with open(target_file, "rb") as tf:
                    tgt_resp = await client.post(
                        f"{ENGINE_URL}/upload",
                        files={"file": (target_file.name, tf, "image/jpeg")},
                    )
                if tgt_resp.status_code != 200:
                    raise Exception(f"Engine upload target failed: {tgt_resp.text}")
                engine_target_id = tgt_resp.json()["file_id"]

                # Step 3: Call appropriate engine endpoint based on swap type
                if req.swap_type == "background":
                    resp = await client.post(
                        f"{ENGINE_URL}/background-remove",
                        json={"file_id": engine_source_id, "method": "auto"},
                    )
                elif req.swap_type == "filter":
                    resp = await client.post(
                        f"{ENGINE_URL}/apply-filter",
                        json={"file_id": engine_source_id, "filter_name": "enhance", "intensity": 1.0},
                    )
                elif req.swap_type == "portrait":
                    resp = await client.post(
                        f"{ENGINE_URL}/live-portrait",
                        json={"source_id": engine_source_id, "expression": "smile", "intensity": 1.0, "num_frames": 30},
                    )
                elif req.swap_type == "voice":
                    resp = await client.post(
                        f"{ENGINE_URL}/voice-clone/convert",
                        json={"file_id": engine_source_id, "pitch_shift": 0.0},
                    )
                else:
                    # Default: face swap (requires target)
                    if not engine_target_id:
                        raise Exception("Face swap requires a target image")
                    resp = await client.post(
                        f"{ENGINE_URL}/swap",
                        json={
                            "source_id": engine_source_id,
                            "target_id": engine_target_id,
                            "no_watermark": True,
                        },
                    )

                if resp.status_code == 200:
                    result_data = resp.json()
                    output_id = result_data.get("output_id", "")
                    output_url = result_data.get("output_url", "")

                    # Download result from engine
                    if output_url:
                        result_resp = await client.get(f"{ENGINE_URL}{output_url}")
                        if result_resp.status_code == 200:
                            result_path = UPLOAD_DIR / f"{swap.id}_result.jpg"
                            result_path.write_bytes(result_resp.content)
                            swap.output_file = str(result_path)
                            swap.status = "completed"
                            db.commit()
                        else:
                            swap.status = "failed"
                            db.commit()
                    else:
                        swap.status = "failed"
                        db.commit()
                else:
                    swap.status = "failed"
                    db.commit()
        else:
            swap.status = "failed"
            db.commit()
    except Exception as e:
        swap.status = "failed"
        db.commit()

    return {
        "swap_id": swap.id,
        "status": swap.status,
        "credits_used": pricing.credits_cost,
        "credits_remaining": current_user.credits,
    }


@app.get("/api/swap/{swap_id}/status")
def swap_status(
    swap_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    swap = db.query(SwapHistory).filter(
        SwapHistory.id == swap_id,
        SwapHistory.user_id == current_user.id,
    ).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")
    return {
        "id": swap.id,
        "status": swap.status,
        "output_file": swap.output_file,
        "created_at": swap.created_at.isoformat(),
    }


# ─── Announcements ───────────────────────────────────────────────────────────

@app.get("/api/announcements")
def get_announcements(db: Session = Depends(get_db)):
    announcements = db.query(Announcement).filter(Announcement.is_active == True).all()
    return {
        "announcements": [
            {
                "id": a.id,
                "title": a.title,
                "message": a.message,
                "type": a.type,
                "created_at": a.created_at.isoformat(),
            }
            for a in announcements
        ]
    }


# ─── Admin Routes ────────────────────────────────────────────────────────────

@app.get("/api/admin/dashboard")
def admin_dashboard(admin: Admin = Depends(get_admin_user), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    total_swaps = db.query(SwapHistory).count()
    total_revenue = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "purchase",
        Transaction.status == "confirmed",
    ).scalar() or 0

    # Last 7 days stats
    from datetime import timedelta
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users_week = db.query(User).filter(User.created_at >= week_ago).count()
    swaps_week = db.query(SwapHistory).filter(SwapHistory.created_at >= week_ago).count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_swaps": total_swaps,
        "total_revenue": total_revenue,
        "new_users_week": new_users_week,
        "swaps_week": swaps_week,
    }


@app.get("/api/admin/users")
def admin_list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if search:
        query = query.filter(
            (User.username.contains(search)) | (User.email.contains(search))
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "credits": u.credits,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
    }


@app.put("/api/admin/users/{user_id}")
def admin_update_user(
    user_id: str,
    req: UpdateUserRequest,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.credits is not None:
        user.credits = req.credits
    if req.is_active is not None:
        user.is_active = req.is_active
    if req.is_admin is not None:
        user.is_admin = req.is_admin

    db.commit()
    return {"status": "updated"}


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: str,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@app.get("/api/admin/transactions")
def admin_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    total = db.query(Transaction).count()
    txs = db.query(Transaction).order_by(Transaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "transactions": [
            {
                "id": t.id,
                "user_id": t.user_id,
                "type": t.type,
                "amount": t.amount,
                "status": t.status,
                "tx_hash": t.tx_hash,
                "created_at": t.created_at.isoformat(),
            }
            for t in txs
        ],
    }


@app.put("/api/admin/pricing")
def admin_update_pricing(
    req: PricingUpdateRequest,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    pricing = db.query(PricingConfig).filter(PricingConfig.feature == req.feature).first()
    if not pricing:
        raise HTTPException(status_code=404, detail="Feature not found")
    pricing.credits_cost = req.credits_cost
    db.commit()
    return {"status": "updated"}


@app.post("/api/admin/announcements")
def admin_create_announcement(
    req: AnnouncementRequest,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    announcement = Announcement(
        title=req.title,
        message=req.message,
        type=req.type,
    )
    db.add(announcement)
    db.commit()
    return {"id": announcement.id, "status": "created"}


@app.get("/api/admin/stats")
def admin_stats(admin: Admin = Depends(get_admin_user), db: Session = Depends(get_db)):
    # Feature usage stats
    feature_stats = (
        db.query(SwapHistory.swap_type, func.count(SwapHistory.id))
        .group_by(SwapHistory.swap_type)
        .all()
    )

    # Revenue by day (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_revenue = (
        db.query(
            func.date(Transaction.created_at),
            func.sum(Transaction.amount),
        )
        .filter(
            Transaction.type == "purchase",
            Transaction.status == "confirmed",
            Transaction.created_at >= thirty_days_ago,
        )
        .group_by(func.date(Transaction.created_at))
        .all()
    )

    return {
        "feature_usage": {f[0]: f[1] for f in feature_stats},
        "daily_revenue": [{"date": str(d[0]), "amount": d[1]} for d in daily_revenue],
    }


# ─── Admin: Swaps ───────────────────────────────────────────────────────────

@app.get("/api/admin/swaps")
def admin_list_swaps(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query("", max_length=20),
    swap_type: str = Query("", max_length=50),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(SwapHistory)
    if status:
        query = query.filter(SwapHistory.status == status)
    if swap_type:
        query = query.filter(SwapHistory.swap_type == swap_type)

    total = query.count()
    swaps = query.order_by(SwapHistory.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "swaps": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "swap_type": s.swap_type,
                "credits_used": s.credits_used,
                "status": s.status,
                "source_file": s.source_file,
                "target_file": s.target_file,
                "output_file": s.output_file,
                "created_at": s.created_at.isoformat(),
            }
            for s in swaps
        ],
    }


@app.post("/api/admin/swaps/{swap_id}/refund")
def admin_refund_swap(
    swap_id: str,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    swap = db.query(SwapHistory).filter(SwapHistory.id == swap_id).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")

    user = db.query(User).filter(User.id == swap.user_id).first()
    if user:
        user.credits += swap.credits_used

    tx = Transaction(
        user_id=swap.user_id,
        type="refund",
        amount=swap.credits_used,
        credits_before=user.credits - swap.credits_used if user else 0,
        credits_after=user.credits if user else 0,
        status="confirmed",
        description=f"Refund for swap {swap_id}",
    )
    db.add(tx)
    swap.status = "refunded"
    db.commit()

    return {"status": "refunded", "credits_returned": swap.credits_used}


# ─── Admin: Announcements CRUD ──────────────────────────────────────────────

@app.put("/api/admin/announcements/{announcement_id}")
def admin_update_announcement(
    announcement_id: str,
    req: AnnouncementRequest,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    announcement.title = req.title
    announcement.message = req.message
    announcement.type = req.type
    db.commit()
    return {"status": "updated"}


@app.delete("/api/admin/announcements/{announcement_id}")
def admin_delete_announcement(
    announcement_id: str,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(announcement)
    db.commit()
    return {"status": "deleted"}


# ─── Admin: Credit Packages CRUD ────────────────────────────────────────────

class CreditPackageRequest(BaseModel):
    name: str
    credits: float
    price_usd: float
    price_usdt: float
    bonus_credits: float = 0


@app.post("/api/admin/packages")
def admin_create_package(
    req: CreditPackageRequest,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    pkg = CreditPackage(
        name=req.name,
        credits=req.credits,
        price_usd=req.price_usd,
        price_usdt=req.price_usdt,
        bonus_credits=req.bonus_credits,
    )
    db.add(pkg)
    db.commit()
    return {"id": pkg.id, "status": "created"}


@app.put("/api/admin/packages/{package_id}")
def admin_update_package(
    package_id: str,
    req: CreditPackageRequest,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    pkg = db.query(CreditPackage).filter(CreditPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    pkg.name = req.name
    pkg.credits = req.credits
    pkg.price_usd = req.price_usd
    pkg.price_usdt = req.price_usdt
    pkg.bonus_credits = req.bonus_credits
    db.commit()
    return {"status": "updated"}


@app.delete("/api/admin/packages/{package_id}")
def admin_delete_package(
    package_id: str,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    pkg = db.query(CreditPackage).filter(CreditPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    db.delete(pkg)
    db.commit()
    return {"status": "deleted"}


# ─── Admin: Engine Status ───────────────────────────────────────────────────

@app.get("/api/admin/engine/status")
async def admin_engine_status(admin: Admin = Depends(get_admin_user)):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ENGINE_URL}/health")
            if resp.status_code == 200:
                return {"status": "online", "engine_url": ENGINE_URL, "details": resp.json()}
    except Exception:
        pass
    return {"status": "offline", "engine_url": ENGINE_URL}


# ─── Admin: API Keys ────────────────────────────────────────────────────────

@app.get("/api/admin/api-keys")
def admin_list_all_keys(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    total = db.query(ApiKey).count()
    keys = db.query(ApiKey).order_by(ApiKey.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "keys": [
            {
                "id": k.id,
                "user_id": k.user_id,
                "name": k.name,
                "key_preview": k.key[:8] + "..." + k.key[-4:],
                "is_active": k.is_active,
                "created_at": k.created_at.isoformat(),
                "last_used": k.last_used.isoformat() if k.last_used else None,
            }
            for k in keys
        ],
    }


@app.delete("/api/admin/api-keys/{key_id}")
def admin_revoke_key(
    key_id: str,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(key)
    db.commit()
    return {"status": "deleted"}

import shutil


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
):
    # Validate file size by reading into memory with limit
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    file_id = uuid.uuid4().hex[:16]
    ext = Path(file.filename or "unknown").suffix or ".jpg"
    dest = UPLOAD_DIR / f"{file_id}{ext}"
    with open(dest, "wb") as f:
        f.write(content)
    return {"file_id": file_id, "filename": file.filename, "path": str(dest)}


@app.get("/api/swap/{swap_id}/result")
def swap_result(
    swap_id: str,
    token: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Allow token query param for img src usage
    user = current_user
    if token:
        from auth import decode_token
        payload = decode_token(token)
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

    swap = db.query(SwapHistory).filter(
        SwapHistory.id == swap_id,
        SwapHistory.user_id == user.id,
    ).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")
    if swap.output_file and os.path.exists(swap.output_file):
        return FileResponse(swap.output_file)
    return {"status": swap.status, "message": "Result not ready yet"}


# ─── Admin Settings ─────────────────────────────────────────────────────────

@app.get("/api/admin/settings")
def admin_get_settings(admin: Admin = Depends(get_admin_user), db: Session = Depends(get_db)):
    settings = {}
    for s in db.query(SystemSettings).all():
        settings[s.key] = s.value
    return {
        "wallet": {
            "usdt_trc20_address": settings.get("wallet_usdt_trc20", ""),
            "usdt_erc20_address": settings.get("wallet_usdt_erc20", ""),
            "btc_address": settings.get("wallet_btc", ""),
            "eth_address": settings.get("wallet_eth", ""),
            "auto_sweep": settings.get("auto_sweep", "false") == "true",
            "sweep_threshold": float(settings.get("sweep_threshold", "100")),
            "sweep_address": settings.get("sweep_address", ""),
            "minimum_deposit": float(settings.get("minimum_deposit", "1")),
            "confirmations_required": int(settings.get("confirmations_required", "3")),
        },
        "site": {
            "site_name": settings.get("site_name", "Persona Studio"),
            "site_description": settings.get("site_description", ""),
            "support_email": settings.get("support_email", ""),
            "maintenance_mode": settings.get("maintenance_mode", "false") == "true",
            "registration_open": settings.get("registration_open", "true") == "true",
            "max_upload_size": int(settings.get("max_upload_size", "100")),
            "default_credits": int(settings.get("default_credits", "10")),
            "referral_bonus": int(settings.get("referral_bonus", "5")),
        },
        "admin": {
            "username": admin.username,
            "email": admin.email,
            "wallet_address": settings.get("admin_wallet_address", ""),
            "two_factor_enabled": settings.get("admin_2fa", "false") == "true",
        },
    }


@app.put("/api/admin/settings")
def admin_update_settings(
    request: Request,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    import asyncio
    body = asyncio.get_event_loop().run_until_complete(request.json())
    
    def save_section(prefix: str, data: dict):
        for key, value in data.items():
            full_key = f"{prefix}_{key}" if prefix else key
            setting = db.query(SystemSettings).filter(SystemSettings.key == full_key).first()
            if setting:
                setting.value = str(value)
            else:
                db.add(SystemSettings(key=full_key, value=str(value)))
    
    if "wallet" in body:
        save_section("wallet", body["wallet"])
    if "site" in body:
        save_section("site", body["site"])
    if "admin" in body:
        admin_data = body["admin"]
        # Handle password change
        if admin_data.get("new_password"):
            current_password = admin_data.get("current_password", "")
            if not verify_password(current_password, admin.password_hash):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            admin.password_hash = hash_password(admin_data["new_password"])
        # Update username and email
        if admin_data.get("username"):
            admin.username = admin_data["username"]
        if admin_data.get("email"):
            admin.email = admin_data["email"]
        # Save other admin settings
        for key in ["wallet_address", "two_factor_enabled"]:
            if key in admin_data:
                save_section("admin", {key: admin_data[key]})
    
    db.commit()
    return {"status": "updated"}


# ─── Admin Revenue ──────────────────────────────────────────────────────────

@app.get("/api/admin/revenue")
def admin_revenue(
    period: str = Query("30d"),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    total_revenue = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "purchase",
        Transaction.status == "confirmed",
    ).scalar() or 0
    
    monthly_revenue = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "purchase",
        Transaction.status == "confirmed",
        Transaction.created_at >= datetime.now(timezone.utc) - timedelta(days=30),
    ).scalar() or 0
    
    # Daily revenue
    daily_revenue = []
    for i in range(days):
        date = datetime.now(timezone.utc).date() - timedelta(days=i)
        amount = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "purchase",
            Transaction.status == "confirmed",
            func.date(Transaction.created_at) == date,
        ).scalar() or 0
        daily_revenue.append({"date": str(date), "amount": amount})
    daily_revenue.reverse()
    
    # Top features
    feature_stats = (
        db.query(SwapHistory.swap_type, func.count(SwapHistory.id), func.sum(SwapHistory.credits_used))
        .group_by(SwapHistory.swap_type)
        .all()
    )
    top_features = [
        {"feature": f[0], "usage": f[1], "revenue": f[2] or 0}
        for f in feature_stats
    ]
    
    # Recent transactions
    recent_txs = (
        db.query(Transaction, User.username)
        .join(User, Transaction.user_id == User.id)
        .filter(Transaction.type == "purchase")
        .order_by(Transaction.created_at.desc())
        .limit(10)
        .all()
    )
    recent_transactions = [
        {
            "id": t[0].id,
            "user": t[1],
            "amount": t[0].amount,
            "type": t[0].type,
            "date": t[0].created_at.isoformat(),
        }
        for t in recent_txs
    ]
    
    return {
        "total_revenue": total_revenue,
        "monthly_revenue": monthly_revenue,
        "daily_revenue": daily_revenue,
        "top_features": top_features,
        "recent_transactions": recent_transactions,
    }


# ─── Admin Withdrawals ──────────────────────────────────────────────────────

class WithdrawalRequest(BaseModel):
    wallet_address: str
    network: str = "TRC20"
    amount: float


class WithdrawalAction(BaseModel):
    tx_hash: Optional[str] = None
    reason: Optional[str] = None


@app.get("/api/admin/withdrawals")
def admin_list_withdrawals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query("pending"),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.type == "withdrawal")
    if status != "all":
        query = query.filter(Transaction.status == status)
    
    total = query.count()
    txs = query.order_by(Transaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    withdrawals = []
    for tx in txs:
        user = db.query(User).filter(User.id == tx.user_id).first()
        withdrawals.append({
            "id": tx.id,
            "user_id": tx.user_id,
            "username": user.username if user else "Unknown",
            "email": user.email if user else "",
            "amount": abs(tx.amount),
            "wallet_address": tx.wallet_address or "",
            "network": tx.description or "TRC20",
            "status": tx.status,
            "tx_hash": tx.tx_hash,
            "created_at": tx.created_at.isoformat(),
            "processed_at": tx.updated_at.isoformat() if tx.updated_at else None,
        })
    
    return {"total": total, "withdrawals": withdrawals}


@app.post("/api/admin/withdrawals/{tx_id}/approve")
def admin_approve_withdrawal(
    tx_id: str,
    req: WithdrawalAction,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    tx.status = "confirmed"
    tx.tx_hash = req.tx_hash
    tx.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    return {"status": "approved", "tx_hash": req.tx_hash}


@app.post("/api/admin/withdrawals/{tx_id}/reject")
def admin_reject_withdrawal(
    tx_id: str,
    req: WithdrawalAction,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Refund credits
    user = db.query(User).filter(User.id == tx.user_id).first()
    if user:
        user.credits += abs(tx.amount)
    
    tx.status = "failed"
    tx.description = f"Rejected: {req.reason}"
    tx.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    return {"status": "rejected"}


@app.post("/api/admin/withdrawals/bulk-approve")
def admin_bulk_approve_withdrawals(
    request: Request,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    import asyncio
    body = asyncio.get_event_loop().run_until_complete(request.json())
    ids = body.get("ids", [])
    
    for tx_id in ids:
        tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
        if tx and tx.status == "pending":
            tx.status = "approved"
            tx.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    return {"status": "approved", "count": len(ids)}


# ─── Admin Activity Logs ────────────────────────────────────────────────────

@app.get("/api/admin/activity")
def admin_activity_logs(
    page: int = Query(1, ge=1),
    filter: str = Query("all"),
    date: str = Query("7d"),
    search: str = Query(""),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    # Return mock data for now
    logs = [
        {
            "id": "1",
            "admin_id": admin.id,
            "admin_username": admin.username,
            "action": "update_settings",
            "target_type": "system",
            "target_id": "",
            "details": {"field": "site_name", "value": "Persona Studio"},
            "ip_address": "127.0.0.1",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ]
    return {"total": len(logs), "logs": logs}


# ─── Admin Monitoring ───────────────────────────────────────────────────────

@app.get("/api/admin/monitoring/health")
def admin_monitoring_health(admin: Admin = Depends(get_admin_user)):
    return {
        "api": {"status": "online", "latency": 45, "uptime": "7d 14h 32m"},
        "engine": {"status": "online", "latency": 120, "gpu_usage": 65},
        "database": {"status": "online", "connections": 5, "size": "24 MB"},
        "storage": {"used": 12.5, "total": 50, "percent": 25},
    }


@app.get("/api/admin/monitoring/stats")
def admin_monitoring_stats(admin: Admin = Depends(get_admin_user), db: Session = Depends(get_db)):
    total_requests = db.query(SwapHistory).count()
    return {
        "total_requests": total_requests * 10,
        "requests_per_minute": 45,
        "error_rate": 0.5,
        "avg_response_time": 125,
        "endpoints": [
            {"path": "/api/swap", "method": "POST", "count": 1542, "avg_time": 250},
            {"path": "/api/auth/login", "method": "POST", "count": 892, "avg_time": 45},
            {"path": "/api/upload", "method": "POST", "count": 756, "avg_time": 180},
            {"path": "/api/user/credits", "method": "GET", "count": 2341, "avg_time": 12},
            {"path": "/api/credits/purchase", "method": "POST", "count": 234, "avg_time": 320},
        ],
    }


@app.get("/api/admin/monitoring/errors")
def admin_monitoring_errors(admin: Admin = Depends(get_admin_user)):
    return {
        "errors": [
            {
                "id": "1",
                "level": "warning",
                "message": "High memory usage detected",
                "count": 3,
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }
        ]
    }


# ─── Admin System Settings ──────────────────────────────────────────────────

@app.get("/api/admin/system")
def get_admin_system(admin: Admin = Depends(get_admin_user), db: Session = Depends(get_db)):
    settings = {s.key: s.value for s in db.query(SystemSettings).all()}
    return {
        "engine": {
            "url": settings.get("engine_url", ENGINE_URL),
            "timeout": int(settings.get("engine_timeout", "120")),
            "max_upload": int(settings.get("max_upload_size", "100")),
        },
        "smtp": {
            "host": settings.get("smtp_host", ""),
            "port": int(settings.get("smtp_port", "587")),
            "user": settings.get("smtp_user", ""),
            "pass": settings.get("smtp_pass", ""),
        },
        "rate_limits": {
            "requests_per_minute": int(settings.get("rate_limit_rpm", "60")),
            "swaps_per_hour": int(settings.get("rate_limit_sph", "100")),
        },
        "cache": {
            "ttl": int(settings.get("cache_ttl", "300")),
            "max_size": int(settings.get("cache_max_size", "1000")),
        },
        "backup": {
            "enabled": settings.get("backup_enabled", "true") == "true",
            "interval": settings.get("backup_interval", "daily"),
        },
    }


@app.put("/api/admin/system")
def update_admin_system(
    req: dict,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    config_map = {
        "engine": {
            "engine_url": "engine_url",
            "engine_timeout": "engine_timeout",
            "max_upload_size": "max_upload_size",
        },
        "smtp": {
            "smtp_host": "smtp_host",
            "smtp_port": "smtp_port",
            "smtp_user": "smtp_user",
            "smtp_pass": "smtp_pass",
        },
        "rate_limits": {
            "rate_limit_rpm": "requests_per_minute",
            "rate_limit_sph": "swaps_per_hour",
        },
        "cache": {
            "cache_ttl": "ttl",
            "cache_max_size": "max_size",
        },
        "backup": {
            "backup_enabled": "enabled",
            "backup_interval": "interval",
        },
    }

    for section, mappings in config_map.items():
        if section in req:
            data = req[section]
            for key, db_key in mappings.items():
                if key in data:
                    existing = db.query(SystemSettings).filter(SystemSettings.key == db_key).first()
                    val = str(data[key])
                    if existing:
                        existing.value = val
                    else:
                        db.add(SystemSettings(key=db_key, value=val, description=f"Admin setting: {db_key}"))
    db.commit()
    return {"status": "ok"}


@app.get("/api/admin/engine/status")
def admin_engine_status(admin: Admin = Depends(get_admin_user)):
    try:
        import httpx
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{ENGINE_URL}/health")
            if resp.status_code == 200:
                data = resp.json()
                return {"status": "online", "engine": data}
            return {"status": "degraded", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"status": "offline", "error": str(e)}


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "persona-saas", "version": "1.0.0"}


# ─── Vast.ai GPU Management ─────────────────────────────────────────────────

def get_vast_client(db: Session) -> VastAI:
    """Get Vast.ai client from stored API key."""
    setting = db.query(SystemSettings).filter(SystemSettings.key == "vast_api_key").first()
    if not setting or not setting.value:
        raise HTTPException(status_code=400, detail="Vast.ai API key not configured. Go to Settings → Vast.ai to set it.")
    return VastAI(api_key=setting.value)


class VastDeployRequest(BaseModel):
    gpu_name: str = "RTX 4090"
    num_gpus: int = 1
    max_price: Optional[float] = 1.0
    image: str = "personastudio/engine:latest"
    disk: int = 50
    label: str = "persona-engine"


@app.get("/api/admin/vast/config")
def vast_get_config(admin: Admin = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Get Vast.ai configuration."""
    settings = {s.key: s.value for s in db.query(SystemSettings).filter(
        SystemSettings.key.like("vast_%")
    ).all()}
    return {
        "api_key_set": bool(settings.get("vast_api_key")),
        "auto_scale": settings.get("vast_auto_scale", "true") == "true",
        "max_instances": int(settings.get("vast_max_instances", "3")),
        "gpu_preference": settings.get("vast_gpu_preference", "RTX 4090"),
        "max_dph": float(settings.get("vast_max_dph", "1.0")),
        "engine_image": settings.get("vast_engine_image", "personastudio/engine:latest"),
    }


@app.put("/api/admin/vast/config")
def vast_update_config(
    request: Request,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update Vast.ai configuration."""
    import asyncio
    body = asyncio.get_event_loop().run_until_complete(request.json())

    mappings = {
        "vast_api_key": body.get("api_key", ""),
        "vast_auto_scale": str(body.get("auto_scale", True)),
        "vast_max_instances": str(body.get("max_instances", 3)),
        "vast_gpu_preference": body.get("gpu_preference", "RTX 4090"),
        "vast_max_dph": str(body.get("max_dph", 1.0)),
        "vast_engine_image": body.get("engine_image", "personastudio/engine:latest"),
    }

    for key, value in mappings.items():
        if value == "" and key != "vast_api_key":
            continue
        setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if setting:
            setting.value = str(value)
        else:
            db.add(SystemSettings(key=key, value=str(value)))
    db.commit()
    return {"status": "updated"}


@app.get("/api/admin/vast/instances")
async def vast_list_instances(
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all Vast.ai GPU instances."""
    client = get_vast_client(db)
    instances = await client.list_instances()
    return {
        "instances": [
            {
                "id": inst.get("id"),
                "label": inst.get("label", ""),
                "gpu_name": inst.get("gpu_name"),
                "gpu_ram": inst.get("gpu_ram"),
                "num_gpus": inst.get("num_gpus", 1),
                "dph_total": inst.get("dph_total", 0),
                "hours": inst.get("hours", 0),
                "total_cost": round(inst.get("dph_total", 0) * inst.get("hours", 0), 4),
                "status": inst.get("actual_status"),
                "ssh_host": inst.get("ssh_host"),
                "ssh_port": inst.get("ssh_port"),
                "image": inst.get("image"),
                "disk_space": inst.get("disk_space"),
                "cpu_ram": inst.get("cpu_ram"),
                "inet_up": inst.get("inet_up", 0),
                "inet_down": inst.get("inet_down", 0),
                "created_at": inst.get("start_date"),
            }
            for inst in instances
        ]
    }


@app.get("/api/admin/vast/costs")
async def vast_get_costs(
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get total Vast.ai costs across all instances."""
    client = get_vast_client(db)
    return await client.get_all_costs()


@app.get("/api/admin/vast/offers")
async def vast_search_offers(
    gpu_name: str = Query("RTX 4090"),
    num_gpus: int = Query(1),
    max_price: float = Query(1.0),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Search for available GPU offers on Vast.ai."""
    client = get_vast_client(db)
    offers = await client.search_offers(
        gpu_name=gpu_name,
        num_gpus=num_gpus,
        max_price=max_price,
        limit=20,
    )
    return {"offers": offers}


@app.post("/api/admin/vast/deploy")
async def vast_deploy_instance(
    req: VastDeployRequest,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Deploy a new GPU instance on Vast.ai."""
    client = get_vast_client(db)

    # Search for best offer
    offers = await client.search_offers(
        gpu_name=req.gpu_name,
        num_gpus=req.num_gpus,
        max_price=req.max_price,
        limit=1,
    )
    if not offers:
        raise HTTPException(status_code=404, detail="No GPU offers found matching your criteria")

    best_offer = offers[0]

    # Create instance
    result = await client.create_instance(
        offer_id=best_offer["id"],
        image=req.image,
        disk=req.disk,
        label=req.label,
        runtype="ssh_direct",
        env={"-p 8000:8000": "1"},
        onstart="echo 'Persona Engine Starting...' && nvidia-smi",
    )

    return {
        "status": "deploying",
        "instance_id": result.get("instance_id"),
        "gpu_name": best_offer.get("gpu_name"),
        "dph": best_offer.get("dph_total"),
        "message": f"Instance deploying on {best_offer.get('gpu_name')} at ${best_offer.get('dph_total', 0):.2f}/hr",
    }


@app.post("/api/admin/vast/instances/{instance_id}/start")
async def vast_start_instance(
    instance_id: int,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Start a stopped Vast.ai instance."""
    client = get_vast_client(db)
    await client.start_instance(instance_id)
    return {"status": "starting", "instance_id": instance_id}


@app.post("/api/admin/vast/instances/{instance_id}/stop")
async def vast_stop_instance(
    instance_id: int,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Stop a running Vast.ai instance."""
    client = get_vast_client(db)
    await client.stop_instance(instance_id)
    return {"status": "stopping", "instance_id": instance_id}


@app.delete("/api/admin/vast/instances/{instance_id}")
async def vast_destroy_instance(
    instance_id: int,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Destroy a Vast.ai instance."""
    client = get_vast_client(db)
    await client.destroy_instance(instance_id)
    return {"status": "destroyed", "instance_id": instance_id}


# ─── Frontend Static Files ──────────────────────────────────────────────────

from starlette.staticfiles import StaticFiles as StarletteStaticFiles

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists() and (FRONTEND_DIR / "index.html").exists():
    assets_dir = FRONTEND_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StarletteStaticFiles(directory=str(assets_dir)), name="static-assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/login")
    async def serve_login():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/signup")
    async def serve_signup():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/contact")
    async def serve_contact():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/terms")
    async def serve_terms():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/privacy")
    async def serve_privacy():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/cookies")
    async def serve_cookies():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/about")
    async def serve_about():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/help")
    async def serve_help():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/status")
    async def serve_status():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/blog")
    async def serve_blog():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/careers")
    async def serve_careers():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/press")
    async def serve_press():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/community")
    async def serve_community():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/dashboard")
    async def serve_dashboard():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/admin")
    async def serve_admin():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/admin/{path:path}")
    async def serve_admin_sub(path: str):
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/app/{path:path}")
    async def serve_app_sub(path: str):
        return FileResponse(str(FRONTEND_DIR / "index.html"))


# ─── Templates Library ──────────────────────────────────────────────────────

TEMPLATES = [
    {"id": "face_swap_pro", "name": "Professional Face Swap", "type": "face_swap", "description": "High-quality face swap with color matching", "credits": 1, "params": {"blend": "poisson", "color_match": True}},
    {"id": "face_swap_quick", "name": "Quick Face Swap", "type": "face_swap", "description": "Fast face swap with alpha blending", "credits": 0.5, "params": {"blend": "alpha", "color_match": False}},
    {"id": "portrait_smile", "name": "Add Smile", "type": "portrait", "description": "Animate a natural smile expression", "credits": 3, "params": {"expression": "smile", "intensity": 0.8}},
    {"id": "portrait_wink", "name": "Wink Animation", "type": "portrait", "description": "Subtle wink animation", "credits": 3, "params": {"expression": "wink", "intensity": 0.6}},
    {"id": "portrait_nod", "name": "Head Nod", "type": "portrait", "description": "Natural head nod animation", "credits": 3, "params": {"expression": "nod", "intensity": 0.7}},
    {"id": "bg_remove", "name": "Background Removal", "type": "background", "description": "Remove background with auto-detect", "credits": 1, "params": {"method": "auto"}},
    {"id": "bg_replace_studio", "name": "Studio Background", "type": "background", "description": "Replace with professional studio background", "credits": 1.5, "params": {"method": "auto", "color": [240, 240, 240]}},
    {"id": "bg_blur", "name": "Portrait Blur", "type": "background", "description": "Blur background for portrait effect", "credits": 1, "params": {"method": "auto", "blur_amount": 15}},
    {"id": "filter_vintage", "name": "Vintage Filter", "type": "filter", "description": "Warm vintage film look", "credits": 0.5, "params": {"filter": "vintage", "intensity": 0.9}},
    {"id": "filter_dramatic", "name": "Dramatic", "type": "filter", "description": "High contrast dramatic look", "credits": 0.5, "params": {"filter": "dramatic", "intensity": 1.0}},
    {"id": "filter_sketch", "name": "Pencil Sketch", "type": "filter", "description": "Convert to pencil sketch style", "credits": 0.5, "params": {"filter": "sketch"}},
    {"id": "filter_cartoon", "name": "Cartoon Style", "type": "filter", "description": "Cartoon/illustration effect", "credits": 0.5, "params": {"filter": "cartoon"}},
    {"id": "voice_clone", "name": "Voice Clone", "type": "voice_clone", "description": "Clone voice from sample", "credits": 2, "params": {"preserve_prosody": True}},
    {"id": "voice_convert", "name": "Voice Conversion", "type": "voice_convert", "description": "Convert voice to target style", "credits": 1, "params": {"semitones": 3}},
]


@app.get("/api/templates", tags=["Templates"])
def list_templates(type: str = Query("", description="Filter by type")):
    """List available transformation templates."""
    templates = TEMPLATES
    if type:
        templates = [t for t in templates if t["type"] == type]
    return {"templates": templates, "total": len(templates)}


@app.get("/api/templates/{template_id}", tags=["Templates"])
def get_template(template_id: str):
    """Get a specific template by ID."""
    for t in TEMPLATES:
        if t["id"] == template_id:
            return {"template": t}
    raise HTTPException(status_code=404, detail="Template not found")


@app.post("/api/swap/from-template", tags=["Templates", "Swap"])
async def swap_from_template(
    template_id: str = Body(..., embed=True),
    source_id: str = Body(..., embed=True),
    target_id: str = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute a swap using a pre-built template."""
    template = None
    for t in TEMPLATES:
        if t["id"] == template_id:
            template = t
            break
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    pricing = db.query(PricingConfig).filter(PricingConfig.feature == template["type"]).first()
    cost = template["credits"] if not pricing else pricing.credits_cost

    if current_user.credits < cost:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    current_user.credits -= cost
    swap = SwapHistory(
        user_id=current_user.id,
        swap_type=template["type"],
        credits_used=cost,
        source_file=source_id,
        target_file=target_id or "",
        status="processing",
    )
    db.add(swap)
    tx = Transaction(
        user_id=current_user.id,
        type="usage",
        amount=-cost,
        credits_before=current_user.credits + cost,
        credits_after=current_user.credits,
        status="confirmed",
        description=f"Template: {template['name']}",
    )
    db.add(tx)
    db.commit()

    # Forward to engine
    try:
        source_file = None
        target_file = None
        for ext in ['.jpg', '.jpeg', '.png', '.webp']:
            if (UPLOAD_DIR / f"{source_id}{ext}").exists():
                source_file = UPLOAD_DIR / f"{source_id}{ext}"
            if target_id and (UPLOAD_DIR / f"{target_id}{ext}").exists():
                target_file = UPLOAD_DIR / f"{target_id}{ext}"

        if source_file:
            async with httpx.AsyncClient(timeout=120.0) as client:
                with open(source_file, "rb") as sf:
                    src_resp = await client.post(
                        f"{ENGINE_URL}/upload",
                        files={"file": (source_file.name, sf, "image/jpeg")},
                    )
                if src_resp.status_code != 200:
                    raise Exception(f"Engine upload failed: {src_resp.text}")
                engine_source_id = src_resp.json()["file_id"]

                engine_target_id = None
                if target_file:
                    with open(target_file, "rb") as tf:
                        tgt_resp = await client.post(
                            f"{ENGINE_URL}/upload",
                            files={"file": (target_file.name, tf, "image/jpeg")},
                        )
                    if tgt_resp.status_code == 200:
                        engine_target_id = tgt_resp.json()["file_id"]

                # Call appropriate endpoint based on template type
                swap_type = template["type"]
                if swap_type == "background":
                    resp = await client.post(
                        f"{ENGINE_URL}/background-remove",
                        json={"file_id": engine_source_id, "method": "auto"},
                    )
                elif swap_type == "filter":
                    resp = await client.post(
                        f"{ENGINE_URL}/apply-filter",
                        json={"file_id": engine_source_id, "filter_name": "enhance", "intensity": 1.0},
                    )
                elif swap_type == "portrait":
                    resp = await client.post(
                        f"{ENGINE_URL}/live-portrait",
                        json={"source_id": engine_source_id, "expression": "smile", "intensity": 1.0, "num_frames": 30},
                    )
                elif swap_type == "voice":
                    resp = await client.post(
                        f"{ENGINE_URL}/voice-clone/convert",
                        json={"file_id": engine_source_id, "pitch_shift": 0.0},
                    )
                else:
                    if not engine_target_id:
                        raise HTTPException(status_code=400, detail="Target file required for face swap")
                    resp = await client.post(
                        f"{ENGINE_URL}/swap",
                        json={
                            "source_id": engine_source_id,
                            "target_id": engine_target_id,
                            "no_watermark": True,
                        },
                    )

                if resp.status_code == 200:
                    result_data = resp.json()
                    output_url = result_data.get("output_url", "")
                    if output_url:
                        result_resp = await client.get(f"{ENGINE_URL}{output_url}")
                        if result_resp.status_code == 200:
                            result_path = UPLOAD_DIR / f"{swap.id}_result.jpg"
                            result_path.write_bytes(result_resp.content)
                            swap.output_file = str(result_path)
                            swap.status = "completed"
                            db.commit()
                else:
                    swap.status = "failed"
                    db.commit()
    except Exception as e:
        swap.status = "failed"
        db.commit()

    return {
        "swap_id": swap.id,
        "template": template["name"],
        "status": swap.status,
        "credits_used": cost,
        "credits_remaining": current_user.credits,
    }


# ─── Batch Processing ──────────────────────────────────────────────────────

@app.post("/api/batch/create", tags=["Batch"])
async def create_batch(
    swap_type: str = Body(...),
    file_ids: list[str] = Body(..., min_length=1, max_length=20),
    target_id: str = Body(None),
    params: dict = Body({}),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a batch processing job for multiple files."""
    pricing = db.query(PricingConfig).filter(PricingConfig.feature == swap_type).first()
    if not pricing:
        raise HTTPException(status_code=400, detail="Unknown swap type")

    total_cost = pricing.credits_cost * len(file_ids)
    if current_user.credits < total_cost:
        raise HTTPException(status_code=402, detail=f"Insufficient credits. Need {total_cost}, have {current_user.credits}")

    batch_id = uuid.uuid4().hex[:16]
    current_user.credits -= total_cost

    jobs = []
    processed_count = 0
    failed_count = 0

    # Process each file through engine
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            for fid in file_ids:
                swap = SwapHistory(
                    user_id=current_user.id,
                    swap_type=swap_type,
                    credits_used=pricing.credits_cost,
                    source_file=fid,
                    target_file=target_id or "",
                    status="processing",
                )
                swap.id = uuid.uuid4().hex[:16]
                db.add(swap)

                try:
                    # Find source file
                    source_file = None
                    for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                        if (UPLOAD_DIR / f"{fid}{ext}").exists():
                            source_file = UPLOAD_DIR / f"{fid}{ext}"
                            break

                    if not source_file:
                        swap.status = "failed"
                        failed_count += 1
                        jobs.append({"id": swap.id, "file_id": fid, "status": "failed"})
                        continue

                    # Upload to engine
                    with open(source_file, "rb") as sf:
                        src_resp = await client.post(
                            f"{ENGINE_URL}/upload",
                            files={"file": (source_file.name, sf, "image/jpeg")},
                        )
                    if src_resp.status_code != 200:
                        swap.status = "failed"
                        failed_count += 1
                        jobs.append({"id": swap.id, "file_id": fid, "status": "failed"})
                        continue

                    engine_source_id = src_resp.json()["file_id"]
                    engine_target_id = None

                    # Upload target if provided
                    if target_id:
                        target_file = None
                        for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                            if (UPLOAD_DIR / f"{target_id}{ext}").exists():
                                target_file = UPLOAD_DIR / f"{target_id}{ext}"
                                break
                        if target_file:
                            with open(target_file, "rb") as tf:
                                tgt_resp = await client.post(
                                    f"{ENGINE_URL}/upload",
                                    files={"file": (target_file.name, tf, "image/jpeg")},
                                )
                            if tgt_resp.status_code == 200:
                                engine_target_id = tgt_resp.json()["file_id"]

                    # Call engine based on swap type
                    if swap_type == "background":
                        resp = await client.post(
                            f"{ENGINE_URL}/background-remove",
                            json={"file_id": engine_source_id, "method": "auto"},
                        )
                    elif swap_type == "filter":
                        resp = await client.post(
                            f"{ENGINE_URL}/apply-filter",
                            json={"file_id": engine_source_id, "filter_name": "enhance", "intensity": 1.0},
                        )
                    elif swap_type == "portrait":
                        resp = await client.post(
                            f"{ENGINE_URL}/live-portrait",
                            json={"source_id": engine_source_id, "expression": "smile", "intensity": 1.0, "num_frames": 30},
                        )
                    elif swap_type == "voice":
                        resp = await client.post(
                            f"{ENGINE_URL}/voice-clone/convert",
                            json={"file_id": engine_source_id, "pitch_shift": 0.0},
                        )
                    else:
                        if not engine_target_id:
                            swap.status = "failed"
                            failed_count += 1
                            jobs.append({"id": swap.id, "file_id": fid, "status": "failed"})
                            continue
                        resp = await client.post(
                            f"{ENGINE_URL}/swap",
                            json={
                                "source_id": engine_source_id,
                                "target_id": engine_target_id,
                                "no_watermark": True,
                            },
                        )

                    if resp.status_code == 200:
                        result_data = resp.json()
                        output_url = result_data.get("output_url", "")
                        if output_url:
                            result_resp = await client.get(f"{ENGINE_URL}{output_url}")
                            if result_resp.status_code == 200:
                                result_path = UPLOAD_DIR / f"{swap.id}_result.jpg"
                                result_path.write_bytes(result_resp.content)
                                swap.output_file = str(result_path)
                                swap.status = "completed"
                                processed_count += 1
                                jobs.append({"id": swap.id, "file_id": fid, "status": "completed"})
                            else:
                                swap.status = "failed"
                                failed_count += 1
                                jobs.append({"id": swap.id, "file_id": fid, "status": "failed"})
                        else:
                            swap.status = "failed"
                            failed_count += 1
                            jobs.append({"id": swap.id, "file_id": fid, "status": "failed"})
                    else:
                        swap.status = "failed"
                        failed_count += 1
                        jobs.append({"id": swap.id, "file_id": fid, "status": "failed"})
                except Exception as e:
                    swap.status = "failed"
                    failed_count += 1
                    jobs.append({"id": swap.id, "file_id": fid, "status": "failed"})

                db.commit()
    except Exception as e:
        # Mark all remaining jobs as failed
        for job in jobs:
            if job["status"] == "queued":
                job["status"] = "failed"
                failed_count += 1

    tx = Transaction(
        user_id=current_user.id,
        type="usage",
        amount=-total_cost,
        credits_before=current_user.credits + total_cost,
        credits_after=current_user.credits,
        status="confirmed",
        description=f"Batch: {len(file_ids)}x {swap_type}",
    )
    db.add(tx)
    db.commit()

    return {
        "batch_id": batch_id,
        "jobs": jobs,
        "total": len(jobs),
        "completed": processed_count,
        "failed": failed_count,
        "credits_used": total_cost,
        "credits_remaining": current_user.credits,
    }


@app.get("/api/batch/{batch_id}", tags=["Batch"])
def get_batch_status(
    batch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get status of a batch processing job."""
    swaps = db.query(SwapHistory).filter(
        SwapHistory.user_id == current_user.id,
    ).all()
    return {
        "batch_id": batch_id,
        "total": len(swaps),
        "completed": sum(1 for s in swaps if s.status == "completed"),
        "failed": sum(1 for s in swaps if s.status == "failed"),
        "processing": sum(1 for s in swaps if s.status == "processing"),
    }


# ─── User Profile & Settings ───────────────────────────────────────────────

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class NotificationPrefs(BaseModel):
    email_completed: bool = True
    email_failed: bool = True
    email_credits: bool = True
    email_announcements: bool = True


@app.get("/api/user/profile", tags=["Auth"])
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user profile."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "credits": current_user.credits,
        "is_admin": current_user.is_admin,
        "created_at": current_user.created_at.isoformat(),
    }


@app.put("/api/user/profile", tags=["Auth"])
def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user profile."""
    if req.username:
        existing = db.query(User).filter(User.username == req.username, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = req.username
    if req.email:
        existing = db.query(User).filter(User.email == req.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = req.email
    db.commit()
    return {"status": "updated"}


@app.post("/api/user/change-password", tags=["Auth"])
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change user password."""
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"status": "updated"}


@app.get("/api/user/notifications", tags=["Auth"])
def get_notification_prefs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get notification preferences."""
    prefix = f"notif_{current_user.id}_"
    settings = {s.key: s.value for s in db.query(SystemSettings).filter(SystemSettings.key.startswith(prefix)).all()}
    return {
        "email_completed": settings.get(f"{prefix}email_completed", "true") == "true",
        "email_failed": settings.get(f"{prefix}email_failed", "true") == "true",
        "email_credits": settings.get(f"{prefix}email_credits", "true") == "true",
        "email_announcements": settings.get(f"{prefix}email_announcements", "true") == "true",
    }


@app.put("/api/user/notifications", tags=["Auth"])
def update_notification_prefs(
    prefs: NotificationPrefs,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update notification preferences."""
    prefix = f"notif_{current_user.id}_"
    for key, value in prefs.dict().items():
        full_key = f"{prefix}{key}"
        setting = db.query(SystemSettings).filter(SystemSettings.key == full_key).first()
        if setting:
            setting.value = str(value)
        else:
            db.add(SystemSettings(key=full_key, value=str(value)))
    db.commit()
    return {"status": "updated", "prefs": prefs.dict()}


# ─── Webhooks ──────────────────────────────────────────────────────────────

@app.post("/api/user/webhooks", tags=["Webhooks"])
def create_webhook(
    url: str = Body(..., embed=True),
    events: list[str] = Body(["swap.completed", "swap.failed"]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a webhook for job completion callbacks."""
    webhook_id = uuid.uuid4().hex[:16]
    setting = SystemSettings(
        key=f"webhook_{current_user.id}_{webhook_id}",
        value=json.dumps({"url": url, "events": events, "active": True}),
    )
    db.add(setting)
    db.commit()
    return {"webhook_id": webhook_id, "url": url, "events": events}


@app.get("/api/user/webhooks", tags=["Webhooks"])
def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List user webhooks."""
    prefix = f"webhook_{current_user.id}_"
    settings = db.query(SystemSettings).filter(SystemSettings.key.startswith(prefix)).all()
    webhooks = []
    for s in settings:
        try:
            data = json.loads(s.value)
            webhook_id = s.key.replace(prefix, "")
            webhooks.append({"id": webhook_id, **data})
        except:
            pass
    return {"webhooks": webhooks}


@app.delete("/api/user/webhooks/{webhook_id}", tags=["Webhooks"])
def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a webhook."""
    key = f"webhook_{current_user.id}_{webhook_id}"
    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(setting)
    db.commit()
    return {"status": "deleted"}


async def notify_webhook(user_id: str, event: str, data: dict):
    """Send webhook notification (called after swap completion)."""
    try:
        prefix = f"webhook_{user_id}_"
        # Would query DB in production
        pass
    except:
        pass


# ─── Keyboard Shortcuts (Frontend Config) ──────────────────────────────────

@app.get("/api/shortcuts", tags=["Auth"])
def get_shortcuts():
    """Get default keyboard shortcuts configuration."""
    return {
        "shortcuts": [
            {"key": "Ctrl+K", "action": "open_search", "description": "Quick search"},
            {"key": "Ctrl+U", "action": "upload_file", "description": "Upload file"},
            {"key": "Ctrl+Enter", "action": "submit_swap", "description": "Submit transformation"},
            {"key": "Ctrl+Z", "action": "undo", "description": "Undo last action"},
            {"key": "Ctrl+Shift+Z", "action": "redo", "description": "Redo last action"},
            {"key": "1-6", "action": "select_mode", "description": "Switch transformation mode (when not focused on input)"},
            {"key": "Esc", "action": "close_modal", "description": "Close modal/dialog"},
            {"key": "Ctrl+S", "action": "save_template", "description": "Save as template"},
            {"key": "Ctrl+E", "action": "export", "description": "Export result"},
        ]
    }


# ─── Contact / Support Messages ─────────────────────────────────────────────

class ContactForm(BaseModel):
    name: str
    email: str
    subject: str
    category: str = "general"
    message: str


class SupportReply(BaseModel):
    admin_reply: str
    status: str = "in_progress"


@app.post("/api/contact", tags=["Support"])
def submit_contact_form(form: ContactForm, db: Session = Depends(get_db)):
    """Submit a contact/support message (public, no auth required)."""
    msg = SupportMessage(
        user_id=None,
        name=form.name,
        email=form.email,
        subject=form.subject,
        category=form.category,
        message=form.message,
    )
    db.add(msg)
    db.commit()
    return {"status": "submitted", "id": msg.id, "message": "Your message has been submitted. Our team will get back to you shortly."}


@app.get("/api/support/messages", tags=["Support"])
def list_support_messages(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query("all"),
    search: str = Query(""),
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all support messages (admin only)."""
    query = db.query(SupportMessage)
    if status != "all":
        query = query.filter(SupportMessage.status == status)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (SupportMessage.name.ilike(search_term)) |
            (SupportMessage.email.ilike(search_term)) |
            (SupportMessage.subject.ilike(search_term))
        )
    total = query.count()
    messages = query.order_by(SupportMessage.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "messages": [
            {
                "id": m.id,
                "user_id": m.user_id,
                "name": m.name,
                "email": m.email,
                "subject": m.subject,
                "category": m.category,
                "message": m.message,
                "status": m.status,
                "priority": m.priority,
                "admin_reply": m.admin_reply,
                "replied_at": m.replied_at.isoformat() if m.replied_at else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "updated_at": m.updated_at.isoformat() if m.updated_at else None,
            }
            for m in messages
        ],
    }


@app.get("/api/support/messages/{message_id}", tags=["Support"])
def get_support_message(
    message_id: str,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get a single support message (admin only)."""
    msg = db.query(SupportMessage).filter(SupportMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return {
        "id": msg.id,
        "user_id": msg.user_id,
        "name": msg.name,
        "email": msg.email,
        "subject": msg.subject,
        "category": msg.category,
        "message": msg.message,
        "status": msg.status,
        "priority": msg.priority,
        "admin_reply": msg.admin_reply,
        "replied_at": msg.replied_at.isoformat() if msg.replied_at else None,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "updated_at": msg.updated_at.isoformat() if msg.updated_at else None,
    }


@app.put("/api/support/messages/{message_id}", tags=["Support"])
def update_support_message(
    message_id: str,
    reply: SupportReply,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Reply to / update a support message (admin only)."""
    msg = db.query(SupportMessage).filter(SupportMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.admin_reply = reply.admin_reply
    msg.status = reply.status
    msg.replied_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "updated", "message": "Reply sent successfully."}


@app.delete("/api/support/messages/{message_id}", tags=["Support"])
def delete_support_message(
    message_id: str,
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a support message (admin only)."""
    msg = db.query(SupportMessage).filter(SupportMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"status": "deleted"}


@app.get("/api/support/stats", tags=["Support"])
def get_support_stats(
    admin: Admin = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get support ticket stats (admin only)."""
    total = db.query(SupportMessage).count()
    open_count = db.query(SupportMessage).filter(SupportMessage.status == "open").count()
    in_progress = db.query(SupportMessage).filter(SupportMessage.status == "in_progress").count()
    resolved = db.query(SupportMessage).filter(SupportMessage.status == "resolved").count()
    closed = db.query(SupportMessage).filter(SupportMessage.status == "closed").count()
    return {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "closed": closed,
    }

