# -*- coding: utf-8 -*-
"""Dedup-hash invariants for the raw/offer layers (TZ §4.1, §5.3).

content_hash drives raw_records dedup (audit layer); offer_hash drives
service_offers dedup (working layer). The two must stay stable and must change
exactly when a price-relevant field changes.
"""
from __future__ import annotations

from app.parsers.base import RawClinic, RawServiceRecord


def _rec(
    clinic="KDL Olymp",
    city="Алматы",
    name="Глюкоза крови",
    price=1500.0,
    currency="KZT",
):
    return RawServiceRecord(
        clinic=RawClinic(name=clinic, city=city),
        service_name_raw=name,
        price=price,
        currency=currency,
    )


def test_content_hash_is_deterministic():
    assert _rec().content_hash() == _rec().content_hash()


def test_offer_hash_is_deterministic():
    assert _rec().offer_hash() == _rec().offer_hash()


def test_hashes_are_sha256_hex():
    h = _rec().content_hash()
    assert len(h) == 64
    assert all(c in "0123456789abcdef" for c in h)


def test_price_change_changes_both_hashes():
    a, b = _rec(price=1500.0), _rec(price=1600.0)
    assert a.content_hash() != b.content_hash()
    assert a.offer_hash() != b.offer_hash()


def test_service_name_change_changes_hashes():
    a, b = _rec(name="Глюкоза крови"), _rec(name="Глюкоза венозная")
    assert a.content_hash() != b.content_hash()
    assert a.offer_hash() != b.offer_hash()


def test_currency_distinguishes_content_hash():
    # currency is part of the audit identity (content_hash) per TZ §4.1...
    assert _rec(currency="KZT").content_hash() != _rec(currency="USD").content_hash()


def test_offer_hash_ignores_currency_per_spec():
    # ...but offer_hash is sha256(clinic + service_name_raw + price) only (TZ §5.3),
    # so the same priced line is one offer regardless of the currency label.
    assert _rec(currency="KZT").offer_hash() == _rec(currency="USD").offer_hash()


def test_different_clinic_is_a_different_offer():
    a, b = _rec(clinic="KDL Olymp"), _rec(clinic="Invitro")
    assert a.offer_hash() != b.offer_hash()
