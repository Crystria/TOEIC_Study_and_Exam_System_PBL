#!/usr/bin/env python3
"""Build deterministic API DTO examples from offline mock fixtures.

These outputs are parser/contract examples only. Their UUIDs are synthetic UUIDv5
values and MUST NOT be used as Backend database identifiers or seed records.
"""
from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "backend_qa" / "contract_examples"
NAMESPACE = uuid.UUID("cb267d5d-9aab-4a55-9df3-0f8fc1203d7a")
DEFAULT_AS_OF = "2026-11-11T16:10:00+07:00"


def read_json(relative: str) -> Any:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def write_json(relative: str, value: Any) -> None:
    path = OUTPUT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def fixture_uuid(kind: str, local_key: str) -> str:
    """Create a stable parser-example UUID, not a live Backend ID."""
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{local_key}"))


def as_iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def parse_as_of(raw: str) -> datetime:
    parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("--as-of must include a timezone offset, e.g. +07:00 or Z")
    return parsed.astimezone(timezone.utc)


def to_progress(source: dict[str, Any], as_of: datetime) -> dict[str, Any]:
    score_trend = []
    for item in source.get("scoreTrend", []):
        row = {
            key: value
            for key, value in item.items()
            if key not in {"daysAgo", "attemptId"}
        }
        attempt_id = fixture_uuid("attempt", str(item["attemptId"]))
        row["attemptId"] = attempt_id
        row["completedAt"] = as_iso(
            as_of - timedelta(days=int(item.get("daysAgo", 0)))
        )
        score_trend.append(row)

    activity = []
    # Use the app timezone, not the machine timezone, for date-only DTO fields.
    local_today = as_of.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    for item in source.get("dailyActivity", []):
        activity.append(
            {
                "date": (local_today - timedelta(days=int(item["relativeDaysAgo"]))).isoformat(),
                "count": int(item["count"]),
            }
        )

    weak_areas = []
    for item in source.get("weakAreas", []):
        row = dict(item)
        row["calculatedAt"] = as_iso(as_of)
        weak_areas.append(row)

    result = {
        "timeRange": source["timeRange"],
        "timezone": source["timezone"],
        "asOf": as_iso(as_of),
        "lifetime": source["lifetime"],
        "inRange": source["inRange"],
        "learningStreakDays": source["learningStreakDays"],
        "longestStreak": source["longestStreak"],
        "scoreTrend": score_trend,
        "scoreTrendNextCursor": None,
        "predictedToeicScore": source.get("predictedToeicScore"),
        "weakAreas": weak_areas,
        "dailyActivity": activity,
        "dailyActivityTruncated": bool(source.get("dailyActivityTruncated", False)),
        "updatedAt": as_iso(as_of),
    }
    if source["timeRange"] == "LAST_7_DAYS":
        result["from"] = as_iso(as_of - timedelta(days=6))
    elif source["timeRange"] == "LAST_30_DAYS":
        result["from"] = as_iso(as_of - timedelta(days=29))
    else:
        result["from"] = None
    return result


def to_history_page(source: dict[str, Any], as_of: datetime, mode: str) -> dict[str, Any]:
    items = []
    for item in source.get("items", []):
        local_key = str(item["attemptId"])
        row = {
            key: value
            for key, value in item.items()
            if key not in {"attemptId", "daysAgo", "mode"}
        }
        row["attemptId"] = fixture_uuid("attempt", local_key)
        row["testId"] = fixture_uuid("test", "qa-demo-200")
        row["mode"] = mode
        row["completedAt"] = as_iso(
            as_of - timedelta(days=int(item.get("daysAgo", 0)))
        )
        items.append(row)
    return {
        "items": items,
        "total": int(source["total"]),
        "page": int(source["page"]),
        "size": int(source["size"]),
        "totalPages": int(source["totalPages"]),
    }


def to_grammar_page(source: dict[str, Any]) -> dict[str, Any]:
    items = []
    for lesson in source["items"]:
        sections = []
        for section in lesson.get("sections", []):
            block = [f"## {section['title']}", "", section["explanation"]]
            examples = section.get("examples", [])
            if examples:
                block.extend(["", "Examples:"])
                block.extend(f"- {example}" for example in examples)
            sections.append("\n".join(block))
        markdown = "\n\n".join(
            [f"# {lesson['title']}", lesson.get("summary", ""), *sections,
             f"## Key takeaway\n\n{lesson.get('keyTakeaway', '')}"]
        ).strip()
        items.append(
            {
                "lessonId": fixture_uuid("lesson", str(lesson["id"])),
                "lessonTitle": lesson["title"],
                "category": lesson["category"],
                "contentMarkdown": markdown,
                "contentHtml": "",
                # Learner GET only exposes PUBLISHED lessons.
                "status": "PUBLISHED",
            }
        )
    return {
        "items": items,
        "total": len(items),
        "page": 1,
        "size": 20,
        "totalPages": 1 if items else 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--as-of",
        default=DEFAULT_AS_OF,
        help=f"Timezone-aware reference timestamp (default: {DEFAULT_AS_OF})",
    )
    args = parser.parse_args()
    as_of = parse_as_of(args.as_of)

    analytics = {
        "progress_last7Days.response.json": "analytics/progress_last7Days.json",
        "progress_last30Days.response.json": "analytics/progress_last30Days.json",
        "progress_allTime.response.json": "analytics/progress_allTime.json",
    }
    for output_name, source_path in analytics.items():
        write_json(f"analytics/{output_name}", to_progress(read_json(source_path), as_of))

    full_history = read_json("analytics/history_full_scores.json")
    part_history = read_json("analytics/history_part_practices.json")
    write_json(
        "analytics/history_full_scores.response.json",
        to_history_page(full_history, as_of, "FULL"),
    )
    write_json(
        "analytics/history_part_practices.response.json",
        to_history_page(part_history, as_of, "PART"),
    )

    combined = read_json("analytics/streak_and_prediction.json")
    streak = dict(combined["streak"])
    last_activity = streak.pop("lastActivity", None)
    today = as_of.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    streak["lastActivityDate"] = (
        today.isoformat() if last_activity == "today" else last_activity
    )
    streak["asOf"] = as_iso(as_of)
    write_json("analytics/streak.response.json", streak)

    prediction = dict(combined["prediction"])
    prediction["usedAttemptIds"] = [
        fixture_uuid("attempt", str(value))
        for value in prediction["usedAttemptIds"]
    ]
    prediction["asOf"] = as_iso(as_of)
    write_json("analytics/prediction.response.json", prediction)

    weak = dict(combined["weakAreaSummary"])
    weak["asOf"] = as_iso(as_of)
    weak["items"] = [
        {**item, "calculatedAt": as_iso(as_of)}
        for item in weak["items"]
    ]
    write_json("analytics/weak_areas.response.json", weak)

    grammar = read_json("learning/grammar_catalog_current_source.json")
    page = to_grammar_page(grammar)
    write_json("learning/grammar_lessons_page_1.response.json", page)
    write_json("learning/grammar_lesson_detail.response.json", page["items"][0])

    generated = {
        "schemaVersion": "1.0.0",
        "fixtureKind": "synthetic_dto_contract_example",
        "generatedAt": as_iso(datetime.now(timezone.utc)),
        "referenceAsOf": as_iso(as_of),
        "idPolicy": "Stable synthetic UUIDv5 values; never valid Backend database references.",
        "sources": [
            "test_data/analytics/progress_last7Days.json",
            "test_data/analytics/progress_last30Days.json",
            "test_data/analytics/progress_allTime.json",
            "test_data/analytics/history_full_scores.json",
            "test_data/analytics/history_part_practices.json",
            "test_data/analytics/streak_and_prediction.json",
            "test_data/learning/grammar_catalog_current_source.json",
        ],
        "outputs": sorted(
            str(path.relative_to(OUTPUT)).replace("\\", "/")
            for path in OUTPUT.rglob("*.response.json")
        ),
        "liveBackendEvidence": False,
        "seedEligible": False,
    }
    write_json("fixture_manifest.json", generated)
    print(f"Generated {len(generated['outputs'])} contract examples in {OUTPUT}")
    print("NOTE: all generated IDs are synthetic UUIDv5 parser examples, not Backend IDs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
