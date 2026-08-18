# ----- Stage 1: Build Frontend -----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ----- Stage 2: Runtime -----
FROM python:3.12-slim

# System deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Install Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy backend code
COPY backend/ backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Create data directory for SQLite + search results
RUN mkdir -p /app/data && chown -R appuser:appuser /app/data

# Switch to non-root user
USER appuser

# Data volume
VOLUME ["/app/data"]

EXPOSE 8000

ENTRYPOINT ["tini", "--"]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
