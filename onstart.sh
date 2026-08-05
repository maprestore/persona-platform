#!/bin/bash
mkdir -p /root/.ssh
echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC9O30nMqYsA0kNHQxSTsMh9532FMUWtZkFoSSzEFuAo7CJeCbY+pGyaDaCpdNTyXNCUcLwHHSRxqAj+MPZ11bZjDMigBR2MLcgSuN6LTkkbDqs516Q3JcEBwAu5zXUbNa704QJN6WnlmpmFhPHZKgIhPnTfm4Y5dN9fHsCMtfEz9ipJzBOStr2MiKlcyiIGQjenNBzj0caAgdheOE/pg8gli0LpLT9RC/4HzhPqkioZI7mwUm0Haz53K31/HyG1o4VkyikbpkuDYkbvZrkhIZC7srydF8OIvUwucHmcHIPoji4FmfaUBLb7NLL1mxr9ltq/2lmGPQUU6by7/fsS9PGRw6skRjLdVcg9jEt7NeqmPAV0EfYAHQI7CpZHaLTizrWKz7jzH78CffyUQNxNO2eraGNrczVDG97vHHtnrPPZg6Q8vz/QjOLP4RmrzxsM3c9HXry5U1/P+bMqcSQqtLUVjxmzOc/voMpyn5Jvhw3AQzj2uuCXaFEpAHVZSCPq5QnF6hULIuXKsP/2kbXeocA0e2YCLhRvhxoCk0TBIMbieAzjhqbvjDFkPYMoa2A3paesDp5+znigznh035/LTPOYUXN5a3mkUcPpfs/BW8R2a7IclQm1ck/xmfE5pp28yxnxnt+DSEMW1GZXpixWedOXMTHv14nrl0PcT6diOo3RQ== u0_a344@localhost' >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
/usr/sbin/sshd 2>/dev/null || true
cd /app
python3 run_persona.py --port 6967 --skip-install &
sleep 10
python3 -m uvicorn saas.backend.main:app --host 0.0.0.0 --port 8000 &
sleep 5
echo 'Services started'
