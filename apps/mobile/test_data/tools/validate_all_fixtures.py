#!/usr/bin/env python3
"""Compatibility entry point for the safe Phase N fixture validator.

Credential-bearing and tester-only namespaces are deliberately skipped.
"""
from pathlib import Path
import runpy
import sys

SCRIPT = Path(__file__).with_name("validate_phase_n.py")
runpy.run_path(str(SCRIPT), run_name="__main__")
