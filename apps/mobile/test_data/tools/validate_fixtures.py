#!/usr/bin/env python3
"""Validate offline exam structure without opening tester-only answer data."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


catalog = load("exam/test_catalog.json")
parts = load("exam/part_structure.json")["parts"]
scores = load("exam/score_reference.json")

assert len(catalog["items"]) == 3, "Expected three offline test catalog entries."
assert sum(part["totalQuestions"] for part in parts) == 200
assert [part["part"] for part in parts] == list(range(1, 8))
assert len(scores["listening"]) == 101 and len(scores["reading"]) == 101
assert max(scores["listening"]) == 495 and max(scores["reading"]) == 495

print(
    "OK: offline catalogue, 7 Parts / 200-question structure and score tables are valid."
)
print(
    "NOTE: question index, answer key, answer sets and tester-only files were not opened."
)
