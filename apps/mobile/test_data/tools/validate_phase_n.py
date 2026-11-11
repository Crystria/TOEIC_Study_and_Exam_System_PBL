#!/usr/bin/env python3
"""Safe Phase N validator; never opens credential or tester-only files."""
from __future__ import annotations

import hashlib
import json
import re
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_NAMES = {
    "qa_accounts.json",
    "answer_key_TESTER_ONLY.json",
    "context_samples_TESTER_REFERENCE.json",
}
SKIP_PARTS = {"live", "auth", "exam", "appium"}
EXPECTED_RUNTIME_ASSETS = {
    "test_data/learning/vocabulary_catalog_current_source.json",
    "test_data/learning/grammar_catalog_current_source.json",
}
LOCAL_ID_PATTERNS = [
    re.compile(r"^mock[-_]", re.I),
    re.compile(r"^qa-history[-_]", re.I),
    re.compile(r"^demo[-_]", re.I),
    re.compile(r"^(?:t\d+-v\d+|g\d+|v\d+|office|marketing)$", re.I),
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def is_excluded(path: Path) -> bool:
    return path.name in SKIP_NAMES or path.name.lower().startswith(".env") or any(
        part in SKIP_PARTS for part in path.parts
    )


def walk_json(root: Path):
    for path in sorted(root.rglob("*.json")):
        if not is_excluded(path.relative_to(ROOT)) and path.name != "file_manifest.json":
            yield path


def collect_values(value, path="$", result=None):
    if result is None:
        result = []
    if isinstance(value, dict):
        for key, child in value.items():
            collect_values(child, f"{path}.{key}", result)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            collect_values(child, f"{path}[{index}]", result)
    else:
        result.append((path, value))
    return result


def validate_contract_examples(errors: list[str]) -> int:
    base = ROOT / "backend_qa" / "contract_examples"
    manifest_path = base / "fixture_manifest.json"
    if not manifest_path.is_file():
        errors.append("backend_qa/contract_examples/fixture_manifest.json is missing.")
        return 0
    manifest = load_json(manifest_path)
    if manifest.get("fixtureKind") != "synthetic_dto_contract_example":
        errors.append("Backend contract examples must be explicitly marked synthetic.")
    if manifest.get("liveBackendEvidence") is not False or manifest.get("seedEligible") is not False:
        errors.append("Synthetic contract fixtures must not claim live evidence or seed eligibility.")

    files = sorted(base.rglob("*.response.json"))
    expected = set(manifest.get("outputs", []))
    actual = {str(p.relative_to(base)).replace("\\", "/") for p in files}
    if expected != actual:
        errors.append("Contract fixture manifest outputs do not match files on disk.")

    parsed = 0
    for path in files:
        try:
            body = load_json(path)
            parsed += 1
        except Exception as exc:
            errors.append(f"{path.relative_to(ROOT)}: invalid JSON: {exc}")
            continue
        text = json.dumps(body, ensure_ascii=False)
        for forbidden in ("relativeAsOf", "relativeDaysAgo", "daysAgo", "runtime-now"):
            if forbidden in text:
                errors.append(f"{path.relative_to(ROOT)} still contains offline-relative field {forbidden}.")
        for item_path, value in collect_values(body):
            if not isinstance(value, str):
                continue
            is_identifier = bool(re.search(r"(?:^|\.)(?:[A-Za-z]*Id|[A-Za-z]*Ids)(?:\[|$)", item_path))
            if is_identifier and any(pattern.match(value) for pattern in LOCAL_ID_PATTERNS):
                errors.append(f"{path.relative_to(ROOT)} has offline pseudo-ID at {item_path}: {value}")
            is_uuid_field = item_path.endswith((".attemptId", ".testId", ".lessonId")) or ".usedAttemptIds[" in item_path
            if is_uuid_field:
                try:
                    uuid.UUID(value)
                except ValueError:
                    errors.append(f"{path.relative_to(ROOT)} has non-UUID entity ID at {item_path}.")
    return parsed


def validate_runtime_allowlist(errors: list[str]) -> None:
    pubspec = ROOT.parent / "pubspec.yaml"
    if not pubspec.is_file():
        errors.append("Project pubspec.yaml not found one level above test_data.")
        return
    content = pubspec.read_text(encoding="utf-8")
    found = set(re.findall(r"^\s*-\s+(test_data/[^\s#]+)", content, flags=re.M))
    if found != EXPECTED_RUNTIME_ASSETS:
        errors.append(
            "Flutter runtime asset allow-list changed unexpectedly: "
            + ", ".join(sorted(found))
        )
    if "backend_qa/" in content:
        errors.append("Backend QA data must never be declared as Flutter runtime assets.")


def validate_checksum_manifest(errors: list[str]) -> None:
    manifest_path = ROOT / "file_manifest.json"
    if not manifest_path.is_file():
        errors.append("Safe file_manifest.json is missing.")
        return
    try:
        manifest = load_json(manifest_path)
        entries = manifest.get("files", [])
        if manifest.get("fileCount") != len(entries):
            errors.append("file_manifest.json fileCount does not match entries.")
        for entry in entries:
            rel = Path(entry["path"])
            if rel.is_absolute() or ".." in rel.parts or any(part in SKIP_PARTS for part in rel.parts):
                errors.append(f"Unsafe/excluded path appears in file manifest: {entry.get('path')}.")
                continue
            target = ROOT / rel
            if not target.is_file():
                errors.append(f"File manifest target is missing: {entry['path']}.")
                continue
            content = target.read_bytes()
            if len(content) != entry.get("bytes"):
                errors.append(f"File manifest byte count mismatch: {entry['path']}.")
            if hashlib.sha256(content).hexdigest() != entry.get("sha256"):
                errors.append(f"File manifest SHA-256 mismatch: {entry['path']}.")
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        errors.append(f"Cannot validate safe file manifest: {exc}")


def validate_seed_registry_template(errors: list[str]) -> None:
    templates = ROOT / "backend_qa" / "templates"
    seed_path = templates / "seed_id_registry.template.json"
    api_path = templates / "api_id_registry.template.json"
    for path in (seed_path, api_path):
        if not path.is_file():
            errors.append(f"Backend QA registry template is missing: {path.name}.")
    if seed_path.is_file():
        template = load_json(seed_path)
        if template.get("status") != "AWAITING_BACKEND_QA_SEED":
            errors.append("Seed registry template must remain pending until real QA seed runs.")
        if template.get("testId") is not None:
            errors.append("Seed registry template must not contain a fabricated testId.")
    if api_path.is_file():
        template = load_json(api_path)
        if template.get("liveBackendEvidence") is not False:
            errors.append("API ID registry template must not claim live Backend evidence.")
        entities = template.get("entities", {})
        for name in ("testIds", "topicIds", "vocabularyIds", "lessonIds", "attemptIds", "questionIds", "groupIds"):
            if entities.get(name) != []:
                errors.append(f"API ID registry template must leave {name} empty until captured from API.")


def validate_contract_shapes(errors: list[str]) -> None:
    base = ROOT / "backend_qa" / "contract_examples"
    try:
        progress = load_json(base / "analytics" / "progress_last7Days.response.json")
        required = {"timeRange", "timezone", "asOf", "from", "lifetime", "inRange", "learningStreakDays", "longestStreak", "scoreTrend", "weakAreas", "dailyActivity"}
        if not required.issubset(progress):
            errors.append("Analytics progress contract example is missing required DTO fields.")
        if any("completedAt" not in item or "attemptId" not in item for item in progress.get("scoreTrend", [])):
            errors.append("Analytics scoreTrend examples require attemptId and completedAt.")
        if any("date" not in item for item in progress.get("dailyActivity", [])):
            errors.append("Analytics dailyActivity examples require absolute date fields.")

        for name, mode in (("history_full_scores.response.json", "FULL"), ("history_part_practices.response.json", "PART")):
            history = load_json(base / "analytics" / name)
            if history.get("items") and any(
                item.get("mode") != mode or not item.get("completedAt") or not item.get("attemptId")
                for item in history["items"]
            ):
                errors.append(f"{name} has invalid mode/date/attempt ID fields.")

        grammar = load_json(base / "learning" / "grammar_lessons_page_1.response.json")
        if grammar.get("total") != 8 or len(grammar.get("items", [])) != 8:
            errors.append("Grammar contract page must contain all eight source-aligned lessons.")
        for lesson in grammar.get("items", []):
            if not all(lesson.get(field) for field in ("lessonId", "lessonTitle", "category", "contentMarkdown", "status")):
                errors.append("Grammar API contract example has missing learner DTO fields.")
            if lesson.get("status") != "PUBLISHED":
                errors.append("Learner Grammar response examples must use PUBLISHED status.")
    except (OSError, json.JSONDecodeError, TypeError) as exc:
        errors.append(f"Cannot validate DTO contract shapes: {exc}")


def main() -> int:
    errors: list[str] = []
    parsed = 0
    for path in walk_json(ROOT):
        try:
            load_json(path)
            parsed += 1
        except Exception as exc:
            errors.append(f"{path.relative_to(ROOT)}: invalid JSON: {exc}")

    manifest = load_json(ROOT / "manifest.json")
    source = manifest.get("sourceBaseline", {})
    if source.get("libArchive") != "lib(4).zip":
        errors.append("sourceBaseline.libArchive must identify lib(4).zip.")
    if "TOEIC_Phase_L_Patch.zip" not in source.get("mobileOverlays", []):
        errors.append("sourceBaseline is missing the Phase L overlay.")
    if "TOEIC_Phase_M_Patch.zip" not in source.get("mobileOverlays", []):
        errors.append("sourceBaseline is missing the Phase M overlay.")
    expected_catalogs = {
        "learning/vocabulary_catalog_current_source.json",
        "learning/grammar_catalog_current_source.json",
    }
    if set(source.get("verifiedOfflineCatalogs", [])) != expected_catalogs:
        errors.append("sourceBaseline verifiedOfflineCatalogs does not match the two checked catalogs.")

    validate_runtime_allowlist(errors)
    validate_checksum_manifest(errors)
    validate_seed_registry_template(errors)
    validate_contract_shapes(errors)
    contract_count = validate_contract_examples(errors)

    if errors:
        print("PHASE N VALIDATION FAILED")
        for error in errors:
            print(f" - {error}")
        return 1

    print(
        f"OK: parsed {parsed} safe fixture JSON files; validated {contract_count} "
        "synthetic Backend DTO examples, UUID namespace isolation, source provenance, "
        "QA seed template and Flutter asset allow-list."
    )
    print("Restricted credential/tester-only files and backend_qa/live were not opened.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
