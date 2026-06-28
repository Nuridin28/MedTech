# -*- coding: utf-8 -*-
"""Plain test runner — executes every `test_*` function under tests/ without
requiring pytest (the project's local convention; pytest is used in CI).

Usage:  python run_tests.py
Exit code is non-zero if any test fails (so it works as a CI/pre-commit gate too).
"""
from __future__ import annotations

import importlib
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TESTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests")


def _iter_test_callables():
    for fname in sorted(os.listdir(TESTS_DIR)):
        if not (fname.startswith("test_") and fname.endswith(".py")):
            continue
        mod = importlib.import_module(f"tests.{fname[:-3]}")
        for attr in sorted(dir(mod)):
            if attr.startswith("test_") and callable(getattr(mod, attr)):
                yield f"{fname[:-3]}.{attr}", getattr(mod, attr)


def main() -> int:
    passed = failed = 0
    failures: list[str] = []
    for name, fn in _iter_test_callables():
        try:
            fn()
            passed += 1
            print(f"  PASS  {name}")
        except Exception:  # noqa: BLE001 — report every failure, keep going
            failed += 1
            failures.append(name)
            print(f"  FAIL  {name}")
            traceback.print_exc()
    print(f"\n{passed} passed, {failed} failed")
    if failures:
        print("Failed:", ", ".join(failures))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
