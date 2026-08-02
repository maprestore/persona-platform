"""Crypto payment module for USDT/USDC."""

from __future__ import annotations

import os
import time
import hashlib
import secrets
from typing import Optional
from decimal import Decimal

import httpx
from sqlalchemy.orm import Session

from models import User, Transaction, CreditPackage, get_db


# Crypto wallet configuration (TRC20 for USDT, ERC20 for USDC)
WALLET_ADDRESS = os.getenv("CRYPTO_WALLET_ADDRESS", "")
TRON_API_KEY = os.getenv("TRON_API_KEY", "")
ETH_API_KEY = os.getenv("ETH_API_KEY", "")


# Network configs
NETWORKS = {
    "USDT": {
        "trc20": {
            "contract": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "decimals": 6,
            "explorer": "https://tronscan.org/#/transaction/",
            "api": "https://api.trongrid.io/v1",
        },
        "erc20": {
            "contract": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            "decimals": 6,
            "explorer": "https://etherscan.io/tx/",
            "api": "https://api.etherscan.io/api",
        },
        "bep20": {
            "contract": "0x55d398326f99059fF775485246999027B3197955",
            "decimals": 18,
            "explorer": "https://bscscan.com/tx/",
            "api": "https://api.bscscan.com/api",
        },
    },
    "USDC": {
        "erc20": {
            "contract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "decimals": 6,
            "explorer": "https://etherscan.io/tx/",
            "api": "https://api.etherscan.io/api",
        },
        "bep20": {
            "contract": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
            "decimals": 18,
            "explorer": "https://bscscan.com/tx/",
            "api": "https://api.bscscan.com/api",
        },
    },
}


class CryptoPayment:
    """Handle crypto payments for credits."""

    def __init__(self):
        self.wallet = WALLET_ADDRESS
        self.tron_key = TRON_API_KEY
        self.eth_key = ETH_API_KEY

    def generate_payment_address(self, user_id: str, amount_usd: float) -> dict:
        """Generate a unique payment address for this transaction."""
        # In production, use a HD wallet to generate unique addresses per user
        # For now, use the main wallet with a unique memo
        memo = secrets.token_hex(8)

        return {
            "address": self.wallet,
            "memo": memo,
            "amount_usd": amount_usd,
            "networks": ["USDT-TRC20", "USDT-ERC20", "USDT-BEP20", "USDC-ERC20", "USDC-BEP20"],
            "expires_in": 1800,  # 30 minutes
            "instructions": [
                f"Send exactly ${amount_usd:.2f} in USDT or USDC",
                f"Include memo: {memo}",
                "Payment will be confirmed after network confirmations",
            ],
        }

    async def verify_trc20_payment(self, tx_hash: str, expected_amount: float) -> bool:
        """Verify TRC20 (TRON) USDT transaction."""
        if not self.tron_key:
            return False

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{NETWORKS['USDT']['trc20']['api']}/transactions/{tx_hash}",
                headers={"TRON-PRO-API-KEY": self.tron_key},
            )
            if resp.status_code != 200:
                return False

            data = resp.json()
            # Check if transaction is confirmed and amount matches
            if data.get("ret", [{}])[0].get("contractRet") != "SUCCESS":
                return False

            # Parse amount from contract data
            contract = data.get("raw_data", {}).get("contract", [{}])[0]
            if contract.get("type") == "TransferContract":
                amount = contract.get("value", 0) / 1e6  # USDT has 6 decimals
                return abs(amount - expected_amount) < 0.01

        return False

    async def verify_erc20_payment(self, tx_hash: str, expected_amount: float, token: str = "USDT") -> bool:
        """Verify ERC20 (ETH/BSC) transaction."""
        network = NETWORKS[token]["erc20"]
        api_key = self.eth_key

        if not api_key:
            return False

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                network["api"],
                params={
                    "module": "proxy",
                    "action": "eth_getTransactionByHash",
                    "txhash": tx_hash,
                    "apikey": api_key,
                },
            )
            if resp.status_code != 200:
                return False

            data = resp.json().get("result", {})
            if not data:
                return False

            # Check if to address matches our wallet
            to = data.get("to", "").lower()
            if to != self.wallet.lower():
                return False

            return True  # Additional amount verification needed in production

        return False

    async def check_pending_payments(self, db: Session) -> list[dict]:
        """Check for pending crypto payments."""
        pending = db.query(Transaction).filter(
            Transaction.status == "pending",
            Transaction.type == "purchase",
        ).all()

        confirmed = []
        for tx in pending:
            if tx.tx_hash:
                verified = False
                if tx.wallet_address and "TRC20" in (tx.description or ""):
                    verified = await self.verify_trc20_payment(tx.tx_hash, tx.amount)
                elif tx.wallet_address and "ERC20" in (tx.description or ""):
                    verified = await self.verify_erc20_payment(tx.tx_hash, tx.amount)

                if verified:
                    tx.status = "confirmed"
                    user = db.query(User).filter(User.id == tx.user_id).first()
                    if user:
                        user.credits += tx.amount
                        tx.credits_after = user.credits
                    db.commit()
                    confirmed.append({"transaction_id": tx.id, "amount": tx.amount})

        return confirmed


crypto_payment = CryptoPayment()
