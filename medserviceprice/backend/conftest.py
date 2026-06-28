# -*- coding: utf-8 -*-
"""Make the `app` package importable when pytest is invoked from backend/.

Keeps tests runnable both ways: `pytest` (CI) and `python run_tests.py` (local,
no pytest installed — matches the project's no-pytest-locally convention).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
