#!/usr/bin/env python3
"""Validate Mobile source-level release isolation from test fixtures."""
from __future__ import annotations
import re, sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
MOBILE_ROOT = PROJECT_ROOT / 'apps' / 'mobile'


def main() -> int:
    errors: list[str] = []
    lib_root = MOBILE_ROOT / 'lib'
    for path in lib_root.rglob('*.dart'):
        source = path.read_text(encoding='utf-8')
        if re.search(r'test_data[/\\]|OfflineFixtureLoader|OfflineLearningFixtures', source):
            errors.append(f'Runtime source depends on test fixture data: {path.relative_to(MOBILE_ROOT)}')
    pubspec = (MOBILE_ROOT / 'pubspec.yaml').read_text(encoding='utf-8')
    if re.search(r'^\s*-\s+test_data/', pubspec, flags=re.M):
        errors.append('pubspec.yaml still bundles test_data as Flutter assets.')
    if (MOBILE_ROOT / 'lib/core/testing/offline_fixture_loader.dart').exists():
        errors.append('Legacy runtime OfflineFixtureLoader still exists under lib/.')
    if (MOBILE_ROOT / 'lib/features/learning/repositories/offline_learning_fixtures.dart').exists():
        errors.append('Legacy runtime OfflineLearningFixtures still exists under lib/.')
    if errors:
        print('FAIL: Mobile release source isolation checks failed.')
        for error in errors: print(f' - {error}')
        return 1
    print('PASS: lib/ has no test_data fixture dependency; pubspec.yaml has no test_data assets.')
    print('NOTE: This validates source configuration only. Inspect the built APK/AAB in CI before publishing.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
