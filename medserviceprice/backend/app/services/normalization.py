"""Service-name normalization (TZ §6.1).

Pipeline per raw name:
  1. exact match on name_norm or a synonym (after string normalization)
  2. fuzzy match (rapidfuzz token_sort_ratio) over name_norm + synonyms
  3. below threshold -> caller routes to unmatched_queue with the best candidate
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from rapidfuzz import fuzz, process

AUTO_MATCH_THRESHOLD = 88.0  # token_set_ratio >= this -> candidate (TZ §6.1)
SORT_FLOOR = 60.0  # AND token_sort_ratio >= this -> auto-attach (rejects panels)
SUGGEST_FLOOR = 60.0  # below this we don't even suggest a candidate

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_WS_RE = re.compile(r"\s+")


def normalize_string(s: str) -> str:
    s = s.lower().strip()
    s = s.replace("ё", "е")
    s = _PUNCT_RE.sub(" ", s)  # drop asterisks/quotes/parens etc.
    s = _WS_RE.sub(" ", s)
    return s.strip()


@dataclass
class CatalogEntry:
    id: uuid.UUID
    name_norm: str
    category: str
    synonyms: list[str]

    def variants(self) -> list[str]:
        return [self.name_norm, *self.synonyms]


@dataclass
class MatchResult:
    service_id: uuid.UUID | None
    score: float
    category: str | None
    matched: bool  # True if score >= AUTO_MATCH_THRESHOLD


class Normalizer:
    """Builds a lookup index over the catalog and matches raw names against it."""

    def __init__(self, entries: list[CatalogEntry]) -> None:
        self.entries = entries
        # normalized variant -> entry (for exact + fuzzy keying)
        self._index: dict[str, CatalogEntry] = {}
        for e in entries:
            for v in e.variants():
                self._index[normalize_string(v)] = e
        self._choices = list(self._index.keys())

    def match(self, raw_name: str) -> MatchResult:
        norm = normalize_string(raw_name)
        if not norm:
            return MatchResult(None, 0.0, None, False)

        # 1) exact
        exact = self._index.get(norm)
        if exact is not None:
            return MatchResult(exact.id, 100.0, exact.category, True)

        # 2) fuzzy. token_set_ratio handles KDL's parenthetical clarifications
        # ("глюкоза сахар крови" ⊇ "глюкоза крови"), but on its own it over-merges
        # panels into single tests ("витамины a,е,d,к" ⊇ "витамин d"). So we also
        # require a token_sort_ratio floor (sensitive to length/order), which keeps
        # true variants and rejects multi-test panels.
        if not self._choices:
            return MatchResult(None, 0.0, None, False)
        best = process.extractOne(norm, self._choices, scorer=fuzz.token_set_ratio)
        if best is None:
            return MatchResult(None, 0.0, None, False)
        choice, set_score, _ = best
        entry = self._index[choice]
        sort_score = fuzz.token_sort_ratio(norm, choice)
        matched = set_score >= AUTO_MATCH_THRESHOLD and sort_score >= SORT_FLOOR
        if set_score >= SUGGEST_FLOOR:
            return MatchResult(entry.id, float(set_score), entry.category, matched)
        return MatchResult(None, float(set_score), None, False)
