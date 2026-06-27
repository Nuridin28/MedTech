"""Source registry (TZ §5.1) — add a new source by registering its adapter here.

Each entry is a zero-arg factory producing a configured BaseParser. KDL is split
per city so each city becomes its own isolated parse task / clinic.
"""
from __future__ import annotations

from collections.abc import Callable

from app.parsers.base import BaseParser
from app.parsers.invitro import INVITRO_CITIES, InvitroParser
from app.parsers.kdl import KDL_CITIES, KDLParser

# source_key -> factory. Adding a source = one BaseParser subclass + one line here.
SOURCES: dict[str, Callable[[], BaseParser]] = {
    **{f"kdl_{slug}": (lambda s=slug: KDLParser(city=s)) for slug in KDL_CITIES},
    **{f"invitro_{slug}": (lambda s=slug: InvitroParser(city=s)) for slug in INVITRO_CITIES},
}


def get_parser(source_key: str) -> BaseParser:
    if source_key not in SOURCES:
        raise KeyError(f"Unknown source_key: {source_key}")
    return SOURCES[source_key]()


def all_source_keys() -> list[str]:
    return list(SOURCES.keys())
