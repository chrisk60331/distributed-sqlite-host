# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: node-builder — npm install + next build (standalone output)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS node-builder
WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci --silent

COPY web/ ./

# /api/* is proxied by Next.js rewrites to the FastAPI backend on :8000.
# Using a relative prefix means the browser never hard-codes a hostname,
# so the same image runs locally and on App Runner without rebuild.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: python-builder — uv sync (no venv activation needed at build time)
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS python-builder

RUN pip install --no-cache-dir uv

WORKDIR /app/api
COPY api/pyproject.toml api/uv.lock ./
# --no-install-project: we run from source with uvicorn, no need to install the
# project package itself — just its declared dependencies.
RUN uv sync --frozen --no-dev --no-install-project

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3: runtime — Python 3.12-slim + Node.js 20
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Install Node.js 20 (to run `node server.js` for Next.js standalone) + curl
# (used in the entrypoint health-check loop for uvicorn readiness).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Python API ────────────────────────────────────────────────────────────────
WORKDIR /app/api
COPY api/ ./
COPY --from=python-builder /app/api/.venv ./.venv
ENV PATH="/app/api/.venv/bin:$PATH"

# ── CFN template (referenced by BYO bucket setup endpoint) ───────────────────
COPY infra/ /app/infra/

# ── Next.js standalone ────────────────────────────────────────────────────────
# next build --output standalone produces:
#   .next/standalone/          ← self-contained Node server
#   .next/static/              ← hashed static assets (must be copied separately)
#   public/                    ← static public dir (must be copied separately)
WORKDIR /app/web
COPY --from=node-builder /app/web/.next/standalone ./
COPY --from=node-builder /app/web/.next/static     ./.next/static
COPY --from=node-builder /app/web/public           ./public

# ── Entrypoint ────────────────────────────────────────────────────────────────
WORKDIR /app
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# App Runner (and local `docker run`) uses PORT to discover the listen port.
# Default 8080; override with -e PORT=<n> if needed.
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
