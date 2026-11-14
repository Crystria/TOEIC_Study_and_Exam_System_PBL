#!/usr/bin/env python3
"""Static guardrails for the agreed Feature-first dependency boundaries."""
from __future__ import annotations
import argparse
import re
from pathlib import Path, PurePosixPath

DIRECTIVE_RE = re.compile(r"^\s*(import|export|part)\s+([^;]+);", re.MULTILINE | re.DOTALL)
URI_RE = re.compile(r"['\"]([^'\"]+)['\"]")


def _uri_parts(uri: str) -> set[str]:
    if uri.startswith(("dart:", "package:flutter/", "package:provider/")):
        return set()
    if uri.startswith("package:toeic_mobile/"):
        uri = uri.removeprefix("package:toeic_mobile/")
    return set(PurePosixPath(uri.replace("\\", "/")).parts)


def validate(project: Path) -> list[str]:
    feature_root = project / "lib/features"
    errors: list[str] = []
    if not feature_root.is_dir():
        return [f"Feature source directory not found: {feature_root}"]

    for source in sorted(feature_root.rglob("*.dart")):
        parts = set(source.relative_to(feature_root).parts)
        text = source.read_text(encoding="utf-8")
        directives = []
        for directive, body in DIRECTIVE_RE.findall(text):
            if directive == "part" and body.lstrip().startswith("of "):
                continue
            directives.extend(URI_RE.findall(body))
        rel = source.relative_to(project).as_posix()

        if "screens" in parts:
            for uri in directives:
                uri_parts = _uri_parts(uri)
                forbidden = uri_parts & {
                    "repositories",
                    "data_sources",
                    "storage",
                    "test_data",
                    "mock_data",
                }
                if forbidden or "app_config.dart" in uri_parts:
                    errors.append(
                        f"Screen imports data/config layer ({', '.join(sorted(forbidden)) or 'AppConfig'}): {rel} -> {uri}"
                    )

        if "providers" in parts:
            if re.search(r"\b[A-Za-z_][A-Za-z0-9_]*Repository\s*\?", text):
                errors.append(f"Provider declares a nullable Repository dependency: {rel}")
            if re.search(r"\b(?:_?repository)\s*!?=\s*null", text):
                errors.append(f"Provider branches on a nullable Repository: {rel}")
            for uri in directives:
                uri_parts = _uri_parts(uri)
                forbidden = uri_parts & {
                    "data_sources",
                    "storage",
                    "test_data",
                    "mock_data",
                    "services",
                }
                if forbidden or "app_config.dart" in uri_parts:
                    errors.append(
                        f"Provider imports implementation detail ({', '.join(sorted(forbidden)) or 'AppConfig'}): {rel} -> {uri}"
                    )

        if "repositories" in parts:
            for uri in directives:
                uri_parts = _uri_parts(uri)
                forbidden = uri_parts & {"screens", "widgets"}
                if forbidden:
                    errors.append(
                        f"Repository imports presentation layer ({', '.join(sorted(forbidden))}): {rel} -> {uri}"
                    )

        for legacy_symbol in ("FakeAuthRepository", "MockTestDependencies"):
            if re.search(rf"\b{legacy_symbol}\b", text):
                errors.append(f"Legacy implementation remains in runtime source: {legacy_symbol} ({rel})")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[3])
    args = parser.parse_args()
    project = args.project_root.resolve()
    errors = validate(project)
    if errors:
        print("FAIL: Feature dependency boundary validation failed.")
        for error in errors:
            print(f" - {error}")
        return 1
    print("PASS: Screens depend on presentation contracts, not repositories/data sources/config.")
    print("PASS: Providers use non-null Repository dependencies and do not import Data Sources, Storage, services or environment config.")
    print("PASS: Repositories do not import Screens or UI widgets.")
    print("PASS: obsolete FakeAuthRepository and MockTestDependencies wrappers are absent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
