# Vast.ai Deployment Guide

## Quick Deploy (Full Stack)

### Option 1: Build & Push Docker Image

```bash
# 1. Build and push to Docker Hub
./docker-build.sh your-dockerhub-username

# 2. Go to https://cloud.vast.ai
# 3. Search for GPU instances (RTX 4090 recommended)
# 4. Click "Rent" on an instance
# 5. In "Docker Options", enter:
#    Image: your-dockerhub/persona-studio:latest
#    Ports: 80/tcp, 443/tcp, 6967/tcp
# 6. In "Environment", set:
#    JWT_SECRET=<random-secret>
#    DOMAIN=<your-domain or *>
# 7. Deploy!
```

### Option 2: Deploy from GitHub

```bash
# 1. Push your code to GitHub
git add . && git commit -m "Deploy" && git push

# 2. On Vast.ai, use these settings:
#    Docker Image: (leave blank)
#    Dockerfile: saas/Dockerfile
#    Build Context: .
#    Ports: 80/tcp, 443/tcp, 6967/tcp
```

### Option 3: Using Vast.ai API

```bash
# Search for instances
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"limit":5,"num_gpus":{"eq":1},"gpu_ram":{"gte":16384},"order":[["dph_total","asc"]]} \
  "https://console.vast.ai/api/v0/bundles/"

# Create instance
curl -X PUT -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"image":"timmydon/persona-studio:latest","disk":50,"runtype":"ssh_direct","env":{"JWT_SECRET":"your-secret"}} \
  "https://console.vast.ai/api/v0/asks/<offer_id>/"
```

## Access Your Deployment

After the instance is running:

- **Frontend**: `http://<instance-ip>` (port 80, via Caddy)
- **Admin Panel**: `http://<instance-ip>/admin`
- **API Docs**: `http://<instance-ip>/docs`
- **Engine API**: `http://<instance-ip>:6967` (direct)
- **SSH Access**: `ssh root@<instance-ip> -p <ssh-port>`

## Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

**Change this immediately after first login!**

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT tokens | (required) |
| `PERSONA_ENGINE_URL` | Engine API URL | `http://localhost:6967` |
| `PERSONA_DEVICE` | Compute device | `cuda` |
| `DOMAIN` | Domain for Caddy HTTPS | `*` (HTTP only) |

## Architecture

```
Internet → Caddy (:80/:443) → SaaS Backend (:8000)
                            → Engine API (:6967)
```

- **Caddy**: Reverse proxy with automatic HTTPS (when domain provided)
- **SaaS Backend**: FastAPI + React frontend (port 8000, internal)
- **Engine**: Face swap + voice + video processing (port 6967, internal)

## Persistent Storage

Docker volumes preserve data across restarts:

- `persona-data`: SQLite database
- `persona-uploads`: User uploaded files
- `persona-db`: Backend configuration

## GPU Recommendations

| Use Case | GPU | VRAM | $/hr |
|----------|-----|------|------|
| Testing/Dev | RTX 3090 | 24GB | $0.06-0.15 |
| Production | RTX 4090 | 24GB | $0.10-0.35 |
| Heavy Workload | A100 40GB | 40GB | $0.29-2.00 |

## Troubleshooting

### Instance won't start
- Check Docker image exists on Docker Hub
- Ensure ports 80, 443, and 6967 are exposed
- Check Vast.ai instance logs

### Engine not responding
- SSH into instance: `ssh root@<ip> -p <port>`
- Check engine: `curl http://localhost:6967/health`
- Check logs: `docker logs <container-id>`

### Can't access from browser
- Ensure ports are exposed in Vast.ai settings
- Check firewall rules
- Try SSH tunnel: `ssh -L 80:localhost:80 root@<ip> -p <port>`

## Cost Optimization

1. **Use interruptible instances** for 50-70% savings
2. **Set max price** in GPU Management to prevent overspending
3. **Auto-scale** in admin panel to stop GPUs when idle
4. **Use RTX 3090** for development, RTX 4090 for production
