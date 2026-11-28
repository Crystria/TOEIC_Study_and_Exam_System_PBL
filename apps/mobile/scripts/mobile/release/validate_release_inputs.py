#!/usr/bin/env python3
"""Validate that the dedicated Production entry point cannot reach Test Data."""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path

FORBIDDEN_PATH_PARTS = (
    "/data_sources/test_data/",
    "/repositories/test_data/",
    "/mappers/test_data/",
    "/mock_data/",
)
FORBIDDEN_FILES = {
    "fake_auth_repository.dart",
    "test_data_analytics_repository.dart",
}
FORBIDDEN_SYMBOLS = (
    "FakeAuthRepository",
    "TestDataAuthRepository",
    "TestDataLearningRepository",
    "TestDataAnalyticsRepository",
    "TestDataMockTestRepository",
    "TestDataMockTestAttemptRepository",
    "TestDataAiChatRepository",
    "MockAnalyticsRepository",
    "AssetAiChatTestDataSource",
    "TestDataMockTestMapper",
)
DIRECTIVE_RE = re.compile(r"^\s*(import|export|part)\s+([^;]+);", re.MULTILINE | re.DOTALL)
URI_RE = re.compile(r"['\"]([^'\"]+)['\"]")


def resolve_import(source: Path, uri: str, project: Path) -> Path | None:
    if uri.startswith("package:toeic_mobile/"):
        return project / "lib" / uri.removeprefix("package:toeic_mobile/")
    if not uri.startswith(("dart:", "package:")) and not uri.startswith("/"):
        # All non-package Dart URIs (including bare names) are resolved against
        # the importing library's directory. From lib/main_release.dart this
        # naturally resolves `core/...` under lib/.
        return (source.parent / uri).resolve()
    return None


def scan_graph(project: Path, entry: Path) -> tuple[set[Path], list[str]]:
    visited: set[Path] = set()
    errors: list[str] = []
    pending = [entry.resolve()]
    while pending:
        current = pending.pop()
        if current in visited:
            continue
        visited.add(current)
        if not current.is_file():
            errors.append(f"Missing Release graph source: {current}")
            continue
        normalized = "/" + current.relative_to(project).as_posix()
        if any(part in normalized for part in FORBIDDEN_PATH_PARTS):
            errors.append(f"Forbidden Test Data path is reachable: {normalized}")
        if current.name in FORBIDDEN_FILES:
            errors.append(f"Forbidden Test Data implementation is reachable: {normalized}")
        text = current.read_text(encoding="utf-8")
        if re.search(r"(?:test_data|mock_data)[/\\]", text):
            errors.append(f"Test Data/mock-data path literal is reachable: {normalized}")
        for symbol in FORBIDDEN_SYMBOLS:
            if re.search(rf"\b{re.escape(symbol)}\b", text):
                errors.append(f"Forbidden Test Data symbol {symbol} in {normalized}")
        for directive, body in DIRECTIVE_RE.findall(text):
            # `part of` declares the owner of a part file; it is not a child
            # dependency and following it would create an artificial cycle.
            if directive == "part" and body.lstrip().startswith("of "):
                continue
            for uri in URI_RE.findall(body):
                resolved = resolve_import(current, uri, project)
                if resolved is None:
                    continue
                if not resolved.exists():
                    errors.append(f"Unresolved project directive {uri} from {normalized}")
                else:
                    pending.append(resolved.resolve())
    return visited, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[3])
    args = parser.parse_args()
    project = args.project_root.resolve()
    entry = project / "lib/main_release.dart"
    errors: list[str] = []

    visited, graph_errors = scan_graph(project, entry)
    errors.extend(graph_errors)

    release_source = entry.read_text(encoding="utf-8") if entry.exists() else ""
    if "ProductionFeatureDependencies.create" not in release_source:
        errors.append("main_release.dart does not use ProductionFeatureDependencies.")
    if "AppFeatureDependencies" in release_source:
        errors.append("main_release.dart references the Development composition root.")

    default_entry = project / "lib/main.dart"
    default_source = default_entry.read_text(encoding="utf-8") if default_entry.exists() else ""
    if "if (kReleaseMode)" not in default_source or "ProductionFeatureDependencies.create" not in default_source:
        errors.append("Default main.dart must route AOT Release builds to ProductionFeatureDependencies.")
    if "AppFeatureDependencies.create" not in default_source:
        errors.append("Default main.dart must preserve the Development composition branch.")

    production_deps = project / "lib/core/di/production_feature_dependencies.dart"
    if production_deps.exists():
        contents = production_deps.read_text(encoding="utf-8")
        if "UnavailableAiChatRepository" not in contents:
            errors.append("Production must use UnavailableAiChatRepository while AI security is blocked.")

    pubspec = project / "pubspec.yaml"
    if pubspec.exists():
        lines = pubspec.read_text(encoding="utf-8").splitlines()
        dev_assets = [line.strip()[2:].strip() for line in lines if re.match(r"^\s+-\s+test_data/", line)]
        allowed = {
            "test_data/learning/vocabulary_catalog_current_source.json",
            "test_data/learning/grammar_catalog_current_source.json",
            "test_data/exam/test_catalog.json",
            "test_data/exam/part_structure.json",
            "test_data/ai_chat/conversations_and_messages_current_source.json",
        }
        if set(dev_assets) != allowed:
            errors.append(
                "Development fixture asset allow-list changed. Review build_release.ps1 before updating it."
            )

    if errors:
        print("FAIL: Release Test Data isolation checks failed.")
        for error in errors:
            print(f" - {error}")
        return 1

    print("PASS: Release import graph contains no Test Data repositories, data sources, mappers or mock-data libraries.")
    print(f"PASS: inspected {len(visited)} Dart files reachable from lib/main_release.dart.")
    print("PASS: AI Chat uses the fail-closed unavailable repository in Production.")
    print("PASS: Development Test Data asset allow-list matches build_release.ps1 filtering policy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
