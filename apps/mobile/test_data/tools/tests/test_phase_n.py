from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1]
ROOT = TOOLS.parent
SPEC = importlib.util.spec_from_file_location(
    "build_backend_qa_contract_fixtures",
    TOOLS / "build_backend_qa_contract_fixtures.py",
)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class PhaseNContractFixtureTests(unittest.TestCase):
    def setUp(self):
        self.as_of = datetime(2026, 11, 11, 9, 10, tzinfo=timezone.utc)

    def test_analytics_progress_has_absolute_api_dates_and_uuid_attempts(self):
        source = json.loads((ROOT / "analytics/progress_last7Days.json").read_text(encoding="utf-8"))
        result = BUILDER.to_progress(source, self.as_of)
        self.assertEqual(result["timeRange"], "LAST_7_DAYS")
        self.assertIn("T", result["asOf"])
        self.assertNotIn("relativeAsOf", result)
        self.assertTrue(result["scoreTrend"][0]["attemptId"].count("-") == 4)
        self.assertIn("completedAt", result["scoreTrend"][0])
        self.assertRegex(result["dailyActivity"][0]["date"], r"^\d{4}-\d{2}-\d{2}$")

    def test_history_uses_uppercase_mode_and_uuid_ids(self):
        source = json.loads((ROOT / "analytics/history_part_practices.json").read_text(encoding="utf-8"))
        result = BUILDER.to_history_page(source, self.as_of, "PART")
        self.assertEqual(result["items"][0]["mode"], "PART")
        self.assertEqual(result["items"][0]["attemptId"].count("-"), 4)
        self.assertEqual(result["items"][0]["testId"].count("-"), 4)
        self.assertIn("completedAt", result["items"][0])
        self.assertNotIn("daysAgo", result["items"][0])

    def test_grammar_adapter_emits_backend_markdown_contract(self):
        source = json.loads((ROOT / "learning/grammar_catalog_current_source.json").read_text(encoding="utf-8"))
        result = BUILDER.to_grammar_page(source)
        self.assertEqual(result["total"], 8)
        lesson = result["items"][0]
        self.assertEqual(lesson["status"], "PUBLISHED")
        self.assertIn("lessonId", lesson)
        self.assertIn("contentMarkdown", lesson)
        self.assertIn("## IN", lesson["contentMarkdown"])
        self.assertNotIn("sections", lesson)

    def test_synthetic_ids_are_stable_and_uuid_formatted(self):
        first = BUILDER.fixture_uuid("lesson", "g1")
        second = BUILDER.fixture_uuid("lesson", "g1")
        self.assertEqual(first, second)
        self.assertEqual(first.count("-"), 4)
        self.assertNotEqual(first, "g1")

    def test_seed_capture_writes_only_allowlisted_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            seed = root / "seed.json"
            output = root / "live" / "registry.json"
            seed.write_text(
                json.dumps({
                    "fixture": {
                        "testId": "123e4567-e89b-42d3-a456-426614174000",
                        "accounts": [
                            {"email": "qa-a@example.test", "password": "do-not-copy", "accessToken": "do-not-copy"},
                            {"email": "qa-b@example.test", "refreshToken": "do-not-copy"},
                        ],
                    }
                }),
                encoding="utf-8",
            )
            subprocess.run(
                [sys.executable, str(TOOLS / "capture_backend_qa_seed_id.py"), str(seed), "--output", str(output)],
                check=True,
                capture_output=True,
                text=True,
            )
            written = output.read_text(encoding="utf-8")
            registry = json.loads(written)
            self.assertEqual(registry["testId"], "123e4567-e89b-42d3-a456-426614174000")
            self.assertEqual(registry["seededAccountCount"], 2)
            for forbidden_value in ("qa-a@example.test", "qa-b@example.test", "do-not-copy"):
                self.assertNotIn(forbidden_value, written)
            self.assertFalse({"email", "password", "accessToken", "refreshToken"} & set(registry))


if __name__ == "__main__":
    unittest.main(verbosity=2)
