"""Authentication module for Persona SaaS."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt
import hashlib
import secrets as _secrets
from sqlalchemy.orm import Session

from models import User, ApiKey, get_db

# Config
SECRET_KEY = os.getenv("JWT_SECRET", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

security = HTTPBearer(auto_error=False)

PBKDF2_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-SHA256."""
    salt = _secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS)
    return f"pbkdf2:sha256:{PBKDF2_ITERATIONS}:{salt}:{dk.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against PBKDF2-SHA256 hash."""
    try:
        parts = hashed_password.split(":")
        if len(parts) == 5 and parts[0] == "pbkdf2":
            iterations = int(parts[2])
            salt = parts[3]
            stored_hex = parts[4]
            dk = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt.encode(), iterations)
            return dk.hex() == stored_hex
        # Legacy SHA256 fallback (for old hashes from setup)
        salt, h = hashed_password.split(":", 1)
        return hashlib.sha256(f"{salt}:{plain_password}".encode()).hexdigest() == h
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except pyjwt.exceptions.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    payload = decode_token(token)

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Check if this is an admin token
    if payload.get("admin", False):
        from models import Admin
        admin = db.query(Admin).filter(Admin.id == user_id).first()
        if admin is None:
            raise HTTPException(status_code=401, detail="Admin not found")
        if not admin.is_active:
            raise HTTPException(status_code=403, detail="Admin account disabled")
        # Return a User-like object for admin
        return User(
            id=admin.id,
            username=admin.username,
            email=admin.email,
            password_hash=admin.password_hash,
            credits=999999,
            is_admin=True,
            is_active=admin.is_active,
            created_at=admin.created_at,
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def get_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(
        (User.username == username) | (User.email == username)
    ).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_user(db: Session, username: str, email: str, password: str, is_admin: bool = False) -> User:
    existing = db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        is_admin=is_admin,
        credits=10.0 if not is_admin else 999999.0,  # Bonus credits for new users
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def generate_api_key(user: User, db: Session, name: str = "default") -> str:
    key = f"pk_{secrets.token_hex(32)}"
    api_key = ApiKey(
        user_id=user.id,
        key=key,
        name=name,
    )
    db.add(api_key)
    db.commit()
    return key


def validate_api_key(api_key: str, db: Session) -> Optional[User]:
    key_record = db.query(ApiKey).filter(
        ApiKey.key == api_key,
        ApiKey.is_active == True,
    ).first()
    if not key_record:
        return None

    user = db.query(User).filter(User.id == key_record.user_id).first()
    if not user or not user.is_active:
        return None

    # Update last used
    key_record.last_used = datetime.now(timezone.utc)
    db.commit()

    return user
