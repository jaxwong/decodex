SHELL := /bin/sh

API_DIRECTORY := services/luna-api

.DEFAULT_GOAL := api-test

.PHONY: api-sync api-format-check api-lint api-typecheck api-unit api-test api-dev api-capability-smoke

api-sync:
	cd $(API_DIRECTORY) && uv sync --frozen

api-format-check:
	cd $(API_DIRECTORY) && uv run --frozen ruff format --check .

api-lint:
	cd $(API_DIRECTORY) && uv run --frozen ruff check .

api-typecheck:
	cd $(API_DIRECTORY) && uv run --frozen mypy

api-unit:
	cd $(API_DIRECTORY) && uv run --frozen pytest -q

api-test: api-format-check api-lint api-typecheck api-unit

api-dev:
	cd $(API_DIRECTORY) && uv run --frozen uvicorn app.main:app --reload --port 8000

api-capability-smoke:
	set -eu; set -a; . ./.env; set +a; cd $(API_DIRECTORY); \
		uv run --frozen python -m app.openai.capability_smoke
