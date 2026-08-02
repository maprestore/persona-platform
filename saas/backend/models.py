"""Database models for Persona SaaS platform."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


def generate_id() -> str:
    return uuid.uuid4().hex[:16]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(16), primary_key=True, default=generate_id)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    credits = Column(Float, default=0.0)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    swaps = relationship("SwapHistory", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    api_keys = relationship("ApiKey", back_populates="user")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(16), primary_key=True, default=generate_id)
    user_id = Column(String(16), ForeignKey("users.id"), nullable=False)
    key = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(100), default="default")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    last_used = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")


class SwapHistory(Base):
    __tablename__ = "swap_history"

    id = Column(String(16), primary_key=True, default=generate_id)
    user_id = Column(String(16), ForeignKey("users.id"), nullable=False)
    swap_type = Column(String(50), nullable=False)  # face_swap, video_swap, portrait, background, filter, voice
    credits_used = Column(Float, default=0.0)
    source_file = Column(String(255), nullable=True)
    target_file = Column(String(255), nullable=True)
    output_file = Column(String(255), nullable=True)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="swaps")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(16), primary_key=True, default=generate_id)
    user_id = Column(String(16), ForeignKey("users.id"), nullable=False)
    type = Column(String(20), nullable=False)  # purchase, usage, refund, bonus
    amount = Column(Float, nullable=False)
    credits_before = Column(Float, default=0.0)
    credits_after = Column(Float, default=0.0)
    tx_hash = Column(String(255), nullable=True)  # Crypto transaction hash
    wallet_address = Column(String(255), nullable=True)
    status = Column(String(20), default="pending")  # pending, confirmed, failed
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="transactions")


class CreditPackage(Base):
    __tablename__ = "credit_packages"

    id = Column(String(16), primary_key=True, default=generate_id)
    name = Column(String(100), nullable=False)
    credits = Column(Float, nullable=False)
    price_usd = Column(Float, nullable=False)
    price_usdt = Column(Float, nullable=False)
    bonus_credits = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class PricingConfig(Base):
    __tablename__ = "pricing_config"

    id = Column(String(16), primary_key=True, default=generate_id)
    feature = Column(String(50), unique=True, nullable=False)
    credits_cost = Column(Float, nullable=False)
    description = Column(Text, nullable=True)


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(String(16), primary_key=True, default=generate_id)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Admin(Base):
    __tablename__ = "admins"

    id = Column(String(16), primary_key=True, default=generate_id)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="admin")  # admin, superadmin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    last_login = Column(DateTime, nullable=True)


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String(16), primary_key=True, default=generate_id)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info")  # info, warning, maintenance
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(String(16), primary_key=True, default=generate_id)
    user_id = Column(String(16), ForeignKey("users.id"), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(200), nullable=False)
    category = Column(String(50), default="general")  # general, bug, feature, billing, other
    message = Column(Text, nullable=False)
    status = Column(String(20), default="open")  # open, in_progress, resolved, closed
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    admin_reply = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", backref="support_messages")


# Database setup
DATABASE_URL = "sqlite:///persona_saas.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


def seed_default_data():
    """Seed default credit packages, pricing, and admin account."""
    from auth import hash_password

    db = SessionLocal()
    try:
        # Seed default admin account if none exists
        if db.query(Admin).count() == 0:
            admin = Admin(
                username="admin",
                email="admin@personastudio.ai",
                password_hash=hash_password("admin123"),
                role="superadmin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("[SEED] Default admin created: admin / admin123")

        # Check if credit packages already seeded
        if db.query(CreditPackage).count() > 0:
            return

        # Default credit packages
        packages = [
            CreditPackage(name="Starter", credits=50, price_usd=5.0, price_usdt=5.0, bonus_credits=0),
            CreditPackage(name="Basic", credits=150, price_usd=15.0, price_usdt=15.0, bonus_credits=10),
            CreditPackage(name="Pro", credits=500, price_usd=50.0, price_usdt=50.0, bonus_credits=50),
            CreditPackage(name="Enterprise", credits=2000, price_usd=180.0, price_usdt=180.0, bonus_credits=200),
        ]
        db.add_all(packages)

        # Default pricing per feature
        pricing = [
            PricingConfig(feature="face_swap", credits_cost=1.0, description="Single face swap"),
            PricingConfig(feature="video_swap", credits_cost=5.0, description="Video face swap (per video)"),
            PricingConfig(feature="portrait", credits_cost=3.0, description="Live portrait animation"),
            PricingConfig(feature="background", credits_cost=1.0, description="Background removal/replacement"),
            PricingConfig(feature="filter", credits_cost=0.5, description="Apply image filter"),
            PricingConfig(feature="voice", credits_cost=2.0, description="Voice cloning"),
            PricingConfig(feature="voice_convert", credits_cost=1.0, description="Voice conversion"),
            PricingConfig(feature="translate", credits_cost=2.0, description="AI translation"),
        ]
        db.add_all(pricing)

        db.commit()
    finally:
        db.close()
