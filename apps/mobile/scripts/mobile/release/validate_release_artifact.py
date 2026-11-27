#!/usr/bin/env python3
"""Reject APK/AAB artifacts that contain Test Data fixture assets or markers."""
from __future__ import annotations
import argparse
import sys
import zipfile
from pathlib import Path

FORBIDDEN_ASSET_PREFIXES = (
    "assets/flutter_assets/test_data/",
    "base/assets/flutter_assets/test_data/",
)
FORBIDDEN_MARKERS = (
    b"test_data/learning/",
    b"test_data/exam/",
    b"test_data/ai_chat/",
    b"TestDataAuthRepository",
    b"TestDataAuthDataSource",
    b"TestDataLearningRepository",
    b"LearningTestDataSource",
    b"TestDataAnalyticsRepository",
    b"AnalyticsTestDataSource",
    b"TestDataMockTestRepository",
    b"TestDataMockTestAttemptRepository",
    b"MockTestTestDataSource",
    b"TestDataMockTestQuestionBankDataSource",
    b"TestDataAiChatRepository",
    b"AssetAiChatTestDataSource",
    b"TestDataMockTestMapper",
    b"FakeAuthRepository",
    b"MockTestDependencies",
    b"MockAnalyticsRepository",
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact", type=Path)
    args = parser.parse_args()
    artifact = args.artifact.resolve()
    if not artifact.is_file():
        print(f"FAIL: release artifact not found: {artifact}")
        return 1

    errors: list[str] = []
    try:
        with zipfile.ZipFile(artifact) as archive:
            names = archive.namelist()
            for name in names:
                normalized = name.replace("\\", "/")
                if any(normalized.startswith(prefix) for prefix in FORBIDDEN_ASSET_PREFIXES):
                    errors.append(f"Test Data asset is bundled: {normalized}")

            # Flutter's binary asset manifest and AOT binaries must not retain
            # the fixture paths or identifiers after the Release graph is shaken.
            manifests = [
                name for name in names
                if name.endswith(("AssetManifest.bin", "AssetManifest.json"))
            ]
            if not manifests:
                errors.append("Flutter AssetManifest was not found in the artifact; asset isolation cannot be verified.")

            candidates = [
                name for name in names
                if name.endswith(("AssetManifest.bin", "AssetManifest.json", ".so", ".dex"))
            ]
            for name in candidates:
                data = archive.read(name)
                for marker in FORBIDDEN_MARKERS:
                    if marker in data:
                        errors.append(f"Forbidden Test Data marker {marker.decode(errors='replace')} in {name}")
    except zipfile.BadZipFile:
        print("FAIL: artifact is not a valid APK/AAB ZIP container.")
        return 1

    if errors:
        print("FAIL: Release artifact contains Test Data.")
        for error in errors:
            print(f" - {error}")
        return 1

    print(f"PASS: {artifact.name} contains no Test Data fixture assets or known Test Data markers.")
    print("NOTE: This is an artifact-content scan, not a device/runtime security certification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
