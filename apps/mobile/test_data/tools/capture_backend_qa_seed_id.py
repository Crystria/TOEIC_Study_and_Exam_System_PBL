#!/usr/bin/env python3
"""Extract only the real QA testId from Backend artifacts/qa/seed.json.

The raw seed artifact is never copied into the mobile test_data package. This
script deliberately drops account details, emails, passwords, tokens and all
other seed payload values; only fixture.testId and an account count are kept.
"""
from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "seed_artifact",
        nargs="?",
        default="../../artifacts/qa/seed.json",
        help="Path to Backend QA seed output (default: ../../artifacts/qa/seed.json from apps/mobile)",
    )
    parser.add_argument(
        "--output",
        default="test_data/backend_qa/live/seed_id_registry.json",
        help="Sanitized output path inside the mobile repository",
    )
    parser.add_argument(
        "--min-accounts",
        type=int,
        default=2,
        help="Minimum QA accounts expected in the seed artifact (default: 2)",
    )
    args = parser.parse_args()

    source = Path(args.seed_artifact)
    if not source.is_file():
        raise SystemExit(f"Seed artifact not found: {source}")

    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Cannot parse seed artifact: {exc}") from exc

    fixture = payload.get("fixture") if isinstance(payload, dict) else None
    if not isinstance(fixture, dict):
        raise SystemExit("Seed artifact must contain an object at fixture.")

    test_id = fixture.get("testId")
    try:
        canonical_test_id = str(uuid.UUID(str(test_id)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise SystemExit("fixture.testId is missing or is not a UUID.") from exc

    accounts = fixture.get("accounts")
    if not isinstance(accounts, list) or len(accounts) < args.min_accounts:
        raise SystemExit(
            f"fixture.accounts must be a list with at least {args.min_accounts} entries."
        )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    safe_registry = {
        "schemaVersion": "1.0.0",
        "status": "CAPTURED_FROM_BACKEND_QA_SEED",
        "capturedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceArtifact": source.name,
        "testId": canonical_test_id,
        "seededAccountCount": len(accounts),
        "idSource": "Backend scripts/qa seed output; not a mobile/offline fixture ID.",
        "secretPolicy": "No email, password, access token, refresh token or raw seed payload is stored.",
    }
    output.write_text(
        json.dumps(safe_registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Captured one Backend-generated UUID into {output}")
    print("Account details and credentials were not copied to the registry.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
