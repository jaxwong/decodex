"""Explicit paid API smoke; excluded from normal pytest collection."""

import argparse
import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from eval.live import RequestBudget
from eval.smoke import run_smoke
from openai import AsyncOpenAI, DefaultAsyncHttpxClient

from app.evidence import OpenAIModelClient
from app.providers import MockCatalogProvider

ROOT = Path(__file__).resolve().parents[4]


async def smoke() -> dict[str, object]:
    budget = RequestBudget(limit=6)
    async with AsyncOpenAI(
        max_retries=0,
        timeout=30,
        http_client=DefaultAsyncHttpxClient(event_hooks={"request": [budget.track]}),
    ) as sdk:
        model = OpenAIModelClient(sdk)
        report = await run_smoke(MockCatalogProvider(), model)
        report["model"] = model.model
        report["attempted_requests"] = len(budget.attempts)
        report["usage_records"] = [o["usage"] for o in model.observations]
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live", action="store_true", required=True, help="Authorize actual OpenAI API requests"
    )
    parser.parse_args()
    load_dotenv(ROOT / ".env", override=False)
    if not os.environ.get("OPENAI_API_KEY"):
        parser.exit(2, "OPENAI_API_KEY missing: live smoke not executed.\n")
    report = asyncio.run(smoke())
    output = ROOT / "eval/live-smoke.json"
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "output": str(output),
                "status": report["status"],
                "attempted_requests": report["attempted_requests"],
            }
        )
    )
    if report["status"] != "passed":
        parser.exit(2, "Live smoke acceptance failed; report retained.\n")
