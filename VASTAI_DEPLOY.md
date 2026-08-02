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
#    Ports: 8000/tcp, 6967/tcp
# 6. In "Environment", set:
#    JWT_SECRET=<random-secret>
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
#    Ports: 8000/tcp, 6967/tcp
```

### Option 3: Using Vast.ai CLI

```bash
# Install CLI
pip install vastai

# Login
vastai set api-key YOUR_API_KEY

# Search for instances
vastai search offers gpu_name=RTX\ 4090 num_gpus=1 dph_total<0.50

# Create instance
vastai create instance <offer_id> \
    --image your-dockerhub/persona-studio:latest \
    --disk 50 \
    --ssh
```

## Access Your Deployment

After the instance is running:

- **Frontend**: `http://<instance-ip>:8000`
- **Admin Panel**: `http://<instance-ip>:8000/admin`
- **API Docs**: `http://<instance-ip>:8000/docs`
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

## GPU Recommendations

| Use Case | GPU | VRAM | $/hr |
|----------|-----|------|------|
| Testing/Dev | RTX 3090 | 24GB | $0.06-0.15 |
| Production | RTX 4090 | 24GB | $0.10-0.35 |
| Heavy Workload | A100 40GB | 40GB | $0.29-2.00 |

## Troubleshooting

### Instance won't start
- Check Docker image exists on Docker Hub
- Ensure ports 8000 and 6967 are exposed
- Check Vast.ai instance logs

### Engine not responding
- SSH into instance: `ssh root@<ip> -p <port>`
- Check engine: `curl http://localhost:6967/health`
- Check logs: `docker logs <container-id>`

### Can't access from browser
- Ensure ports are exposed in Vast.ai settings
- Check firewall rules
- Try SSH tunnel: `ssh -L 8000:localhost:8000 root@<ip> -p <port>`

## Cost Optimization

1. **Use interruptible instances** for 50-70% savings
2. **Set max price** in GPU Management to prevent overspending
3. **Auto-scale** in admin panel to stop GPUs when idle
4. **Use RTX 3090** for development, RTX 4090 for production
