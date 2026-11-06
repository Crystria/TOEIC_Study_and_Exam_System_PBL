#!/usr/bin/env python3
"""Compatibility entry point. The maintained implementation lives at repository root."""
from pathlib import Path
import runpy

if __name__ == '__main__':
    script = Path(__file__).resolve().parents[2] / 'update-unit-test-reports.py'
    if not script.is_file():
        raise SystemExit(f'Missing root report updater: {script}')
    runpy.run_path(str(script), run_name='__main__')
