# One image serves the API and both hosts from one origin (docs/decisions.md D-13).
FROM node:24-slim AS frontends
WORKDIR /build
COPY package.json package-lock.json ./
COPY shopee-compare-app/package.json shopee-compare-app/
COPY packages/luna-widget/package.json packages/luna-widget/
COPY apps/minimal-host/package.json apps/minimal-host/
RUN npm ci
COPY shopee-compare-app shopee-compare-app
COPY packages packages
COPY apps apps
RUN npm run build

FROM python:3.12-slim
RUN pip install --no-cache-dir uv==0.13.6
WORKDIR /srv/services/luna-api
COPY services/luna-api/pyproject.toml services/luna-api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY services/luna-api/app app
# The mock provider resolves data/ from the repository root, so the layout is kept.
COPY data /srv/data
COPY --from=frontends /build/shopee-compare-app/dist /srv/static
COPY --from=frontends /build/apps/minimal-host/dist /srv/static/minimal
ENV LUNA_STATIC_ROOT=/srv/static
RUN useradd --create-home luna
USER luna
# One process only: sessions live in memory, so a second worker would not see them.
CMD ["sh", "-c", "exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
