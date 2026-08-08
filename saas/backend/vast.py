"""Vast.ai GPU integration for Persona Studio."""

from __future__ import annotations

import httpx
from typing import Optional, Dict, Any, List


VAST_API_BASE = "https://console.vast.ai/api/v0"


class VastAI:
    """Client for Vast.ai GPU rental API."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, data: dict = None) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                method,
                f"{VAST_API_BASE}{path}",
                headers=self.headers,
                json=data,
            )
            resp.raise_for_status()
            return resp.json()

    # ── SSH Key Management ───────────────────────────────────────────────

    async def register_ssh_key(self, ssh_pubkey: str) -> Dict:
        """Register an SSH public key with the Vast.ai account.

        Per the Vast.ai API docs, SSH keys must be registered BEFORE creating
        an instance. Duplicate keys are silently accepted by the API.
        """
        try:
            return await self._request("POST", "/ssh", {"ssh_key": ssh_pubkey})
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 400:
                body = e.response.json()
                if body.get("error") == "duplicate_key" or "already" in str(body.get("msg", "")).lower():
                    return {"success": True, "already_registered": True}
            raise

    async def list_ssh_keys(self) -> List[Dict]:
        """List SSH keys registered with the Vast.ai account."""
        result = await self._request("GET", "/ssh/")
        return result.get("keys", result.get("ssh_keys", []))

    # ── Instance Management ──────────────────────────────────────────────

    async def list_instances(self) -> List[Dict]:
        result = await self._request("GET", "/instances/")
        return result.get("instances", [])

    async def get_instance(self, instance_id: int) -> Dict:
        return await self._request("GET", f"/instances/{instance_id}/")

    async def start_instance(self, instance_id: int) -> Dict:
        return await self._request("PUT", f"/instances/{instance_id}/", {"state": "running"})

    async def stop_instance(self, instance_id: int) -> Dict:
        return await self._request("PUT", f"/instances/{instance_id}/", {"state": "stopped"})

    async def destroy_instance(self, instance_id: int) -> Dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(
                f"{VAST_API_BASE}/instances/{instance_id}/",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def label_instance(self, instance_id: int, label: str) -> Dict:
        return await self._request("PUT", f"/instances/{instance_id}/", {"label": label})

    # ── GPU Offers ───────────────────────────────────────────────────────

    async def search_offers(
        self,
        gpu_name: Optional[str] = None,
        num_gpus: int = 1,
        min_ram: Optional[int] = None,
        verified: bool = True,
        rentable: bool = True,
        max_price: Optional[float] = None,
        limit: int = 10,
    ) -> List[Dict]:
        """Search for available GPU offers."""
        filters: Dict[str, Any] = {
            "num_gpus": {"eq": num_gpus},
            "verified": {"eq": verified},
            "rentable": {"eq": rentable},
            "type": "on-demand",
            "limit": limit,
            "order": [["dph_total", "asc"]],
        }
        if gpu_name:
            filters["gpu_name"] = {"in": [gpu_name]}
        if min_ram:
            filters["gpu_ram"] = {"gte": min_ram}
        if max_price:
            filters["dph_total"] = {"lte": max_price}

        return await self._request("POST", "/bundles/", filters)

    async def create_instance(
        self,
        offer_id: int,
        image: str,
        disk: int = 50,
        runtype: str = "ssh_direct",
        env: Dict[str, str] = None,
        onstart: str = "",
        ssh_key: Optional[str] = None,
        label: str = "persona-engine",
    ) -> Dict:
        """Create (rent) a GPU instance from an offer.

        If ``ssh_key`` is provided, it is registered with Vast.ai via
        POST /api/v0/ssh BEFORE creating the instance (the API requires
        keys to be registered ahead of time, otherwise SSH fails with
        "Permission denied").
        """
        if ssh_key:
            await self.register_ssh_key(ssh_key)
        data = {
            "image": image,
            "disk": disk,
            "runtype": runtype,
            "label": label,
            "onstart": onstart,
            "env": env or {},
        }
        result = await self._request("PUT", f"/asks/{offer_id}/", data)
        return {"instance_id": result.get("new_contract"), **result}

    # ── Cost Tracking ────────────────────────────────────────────────────

    async def get_instance_cost(self, instance_id: int) -> Dict:
        """Get cost info for an instance."""
        info = await self.get_instance(instance_id)
        return {
            "instance_id": instance_id,
            "gpu_name": info.get("gpu_name"),
            "gpu_ram": info.get("gpu_ram"),
            "dph_total": info.get("dph_total", 0),
            "hours_run": info.get("hours", 0),
            "total_cost": round(info.get("dph_total", 0) * info.get("hours", 0), 4),
            "status": info.get("actual_status"),
        }

    async def get_all_costs(self) -> Dict:
        """Get total costs across all instances."""
        instances = await self.list_instances()
        total_dph = 0
        total_cost = 0
        instance_costs = []
        for inst in instances:
            dph = inst.get("dph_total", 0)
            hours = inst.get("hours", 0)
            cost = round(dph * hours, 4)
            total_dph += dph
            total_cost += cost
            instance_costs.append({
                "id": inst.get("id"),
                "label": inst.get("label", ""),
                "gpu_name": inst.get("gpu_name"),
                "dph": dph,
                "hours": hours,
                "cost": cost,
                "status": inst.get("actual_status"),
            })
        return {
            "total_dph": round(total_dph, 4),
            "total_cost": round(total_cost, 4),
            "instance_count": len(instances),
            "instances": instance_costs,
        }
