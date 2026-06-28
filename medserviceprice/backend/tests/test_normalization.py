# -*- coding: utf-8 -*-
"""Unit tests for the catalog normalization core (TZ §6.1).

These cover the explainable matching contract:
  - exact match (name_norm / synonym / ё→е) -> auto-attach, score 100
  - fuzzy superset variant within both thresholds -> auto-attach
  - dual threshold: token_set_ratio >= 88 AND token_sort_ratio >= 60
      * a multi-test panel can hit token_set_ratio == 100 yet be rejected by the
        token_sort_ratio floor (this is the whole reason the second threshold exists)
  - suggest-but-don't-attach band (SUGGEST_FLOOR <= score < AUTO) -> service_id set, matched False
  - below SUGGEST_FLOOR -> no suggestion (service_id None)
  - empty input -> no match

Runs under pytest, and also as a plain script via `python run_tests.py`.
"""
from __future__ import annotations

import uuid

from app.services.normalization import (
    AUTO_MATCH_THRESHOLD,
    SORT_FLOOR,
    SUGGEST_FLOOR,
    CatalogEntry,
    Normalizer,
    normalize_string,
)


def _catalog() -> list[CatalogEntry]:
    return [
        CatalogEntry(
            uuid.uuid4(), "глюкоза крови", "laboratory", ["глюкоза", "сахар крови"]
        ),
        CatalogEntry(
            uuid.uuid4(), "витамин d", "laboratory", ["25-он витамин d", "витамин д"]
        ),
        CatalogEntry(
            uuid.uuid4(),
            "общий анализ крови",
            "laboratory",
            ["оак", "клинический анализ крови"],
        ),
        CatalogEntry(uuid.uuid4(), "ёжик тест", "laboratory", []),
    ]


def _by_norm(cat: list[CatalogEntry], name: str) -> CatalogEntry:
    return next(e for e in cat if e.name_norm == name)


# --- normalize_string ----------------------------------------------------

def test_normalize_lowercases_strips_punct_and_collapses_ws():
    assert normalize_string("  Глюкоза (Сахар)  КРОВИ* ") == "глюкоза сахар крови"


def test_normalize_maps_yo_to_ye():
    assert normalize_string("Ёжик") == "ежик"


# --- exact matching ------------------------------------------------------

def test_exact_name_match_auto_attaches_with_full_score():
    cat = _catalog()
    n = Normalizer(cat)
    res = n.match("Глюкоза крови")
    assert res.matched is True
    assert res.service_id == _by_norm(cat, "глюкоза крови").id
    assert res.category == "laboratory"
    assert res.score == 100.0


def test_exact_synonym_match_auto_attaches():
    cat = _catalog()
    n = Normalizer(cat)
    res = n.match("ОАК")  # synonym of "общий анализ крови"
    assert res.matched is True
    assert res.service_id == _by_norm(cat, "общий анализ крови").id


def test_yo_normalization_enables_exact_match():
    cat = _catalog()
    n = Normalizer(cat)
    # raw uses "е", catalog uses "ё" — normalize_string collapses both to "е"
    res = n.match("ежик тест")
    assert res.matched is True
    assert res.service_id == _by_norm(cat, "ёжик тест").id


# --- fuzzy: true variant attaches ---------------------------------------

def test_parenthetical_superset_variant_auto_attaches():
    cat = _catalog()
    n = Normalizer(cat)
    # "глюкоза (сахар) крови*" -> "глюкоза сахар крови": superset of "глюкоза крови"
    res = n.match("глюкоза (сахар) крови*")
    assert res.matched is True
    assert res.service_id == _by_norm(cat, "глюкоза крови").id
    assert res.score >= AUTO_MATCH_THRESHOLD


# --- dual threshold: the headline behaviour ------------------------------

def test_panel_rejected_by_sort_floor_despite_perfect_set_ratio():
    """A multi-test panel fully contains a catalog name, so token_set_ratio == 100,
    but token_sort_ratio is far below the floor -> must NOT auto-attach. This is the
    exact failure the second threshold prevents (panels collapsing into one test)."""
    cat = _catalog()
    n = Normalizer(cat)
    raw = "витамин d a e k комплекс жирорастворимых витаминов профиль расширенный"
    res = n.match(raw)
    assert res.matched is False
    # set ratio cleared the AUTO bar on its own...
    assert res.score >= AUTO_MATCH_THRESHOLD
    # ...so the rejection came from the token_sort_ratio floor, and the catalog
    # entry is still surfaced as a *suggestion* for the analyst queue.
    assert res.service_id == _by_norm(cat, "витамин d").id


def test_partial_panel_in_suggest_band_is_suggested_not_attached():
    cat = _catalog()
    n = Normalizer(cat)
    res = n.match("Витамины A, Е, D, К")  # ~72 set ratio: suggest, don't attach
    assert res.matched is False
    assert SUGGEST_FLOOR <= res.score < AUTO_MATCH_THRESHOLD
    assert res.service_id == _by_norm(cat, "витамин d").id


# --- below suggest floor / empty ----------------------------------------

def test_unrelated_name_is_not_even_suggested():
    cat = _catalog()
    n = Normalizer(cat)
    res = n.match("МРТ головного мозга")
    assert res.matched is False
    assert res.service_id is None
    assert res.score < SUGGEST_FLOOR


def test_empty_input_returns_no_match():
    cat = _catalog()
    n = Normalizer(cat)
    res = n.match("   ***   ")
    assert res.matched is False
    assert res.service_id is None
    assert res.score == 0.0


def test_thresholds_are_ordered_sanely():
    assert SUGGEST_FLOOR <= AUTO_MATCH_THRESHOLD
    assert 0 < SORT_FLOOR <= 100
