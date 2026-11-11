"""Ağsız testler: python -m pytest data-pipeline (ya da python data-pipeline/test_sync.py)."""

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

import sync


def fake_rows(days, codes=("AAK", "TTE"), base=10.0):
    rows = []
    for i, d in enumerate(days):
        for j, code in enumerate(codes):
            rows.append({"code": code, "name": f"{code} FONU", "kind": "YAT", "date": d, "price": base + j + i * 0.1, "aum": 1e6, "investors": 100})
    return rows


class SyncTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        sync.MIN_FUNDS = 1
        ck = self.tmp.parent / (self.tmp.name + "-ck")
        ck.mkdir()
        real = sync.sync
        self.addCleanup(setattr, sync, "sync", real)
        sync.sync = lambda out, mode, today, fetch, _r=real, _ck=ck: _r(out, mode, today, fetch, checkpoint_dir=_ck)

    def test_first_load_then_incremental(self):
        calls = []

        def fetch(start, end):
            calls.append((start, end))
            if len(calls) == 1:
                return fake_rows(["2025-11-10", "2026-10-30", "2026-11-09"])
            return fake_rows(["2026-11-10"])

        sync.sync(self.tmp, "main", date(2026, 11, 9), fetch)
        self.assertEqual(calls[0][1], date(2026, 11, 9))
        self.assertEqual(calls[0][0], date(2021, 11, 10))  # 5 yıllık ilk yükleme, TEFAS sınırının içinde

        sync.sync(self.tmp, "main", date(2026, 11, 10), fetch)
        self.assertEqual(calls[1], (date(2026, 11, 10), date(2026, 11, 10)))  # sadece yeni gün

        latest = json.loads((self.tmp / "funds/latest.json").read_text(encoding="utf-8"))
        aak = next(f for f in latest["funds"] if f["code"] == "AAK")
        self.assertEqual(latest["source"], "TEFAS")
        self.assertEqual(aak["date"], "2026-11-10")
        self.assertAlmostEqual(aak["price"], 10.0)
        hist = json.loads((self.tmp / "funds/history/AAK.json").read_text(encoding="utf-8"))
        self.assertEqual([p[0] for p in hist["prices"]], ["2025-11-10", "2026-10-30", "2026-11-09", "2026-11-10"])
        month = json.loads((self.tmp / "funds/daily/2026-11.json").read_text(encoding="utf-8"))
        self.assertEqual(month["dates"], ["2026-11-09", "2026-11-10"])
        self.assertEqual(month["prices"]["AAK"], [10.2, 10.0])  # sırası tarihlerle aynı
        self.assertTrue((self.tmp / "funds/daily/2025-11.json").exists())
        meta = json.loads((self.tmp / "funds/meta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["priceDates"]["TTE"], "2026-11-10")
        self.assertEqual(meta["schema"], sync.SCHEMA_VERSION)

    def test_topup_refetches_last_day(self):
        calls = []

        def fetch(start, end):
            calls.append((start, end))
            return fake_rows(["2026-11-10"])

        sync.sync(self.tmp, "main", date(2026, 11, 10), fetch)
        sync.sync(self.tmp, "topup", date(2026, 11, 10), fetch)
        self.assertEqual(calls[1], (date(2026, 11, 10), date(2026, 11, 10)))

    def test_failure_keeps_old_files(self):
        sync.sync(self.tmp, "main", date(2026, 11, 9), lambda s, e: fake_rows(["2026-11-09"]))
        before = (self.tmp / "funds/latest.json").read_text(encoding="utf-8")

        def broken(start, end):
            raise RuntimeError("TEFAS yanıt vermedi")

        with self.assertRaises(RuntimeError):
            sync.sync(self.tmp, "main", date(2026, 11, 10), broken)
        self.assertEqual((self.tmp / "funds/latest.json").read_text(encoding="utf-8"), before)
        self.assertEqual([p.name for p in self.tmp.iterdir()], ["funds"])  # geçici klasör kalmaz

    def test_returns(self):
        prices = [["2025-11-10", 100.0], ["2025-12-31", 110.0], ["2026-08-10", 120.0], ["2026-10-10", 125.0], ["2026-11-10", 132.0]]
        r = sync.returns(prices)
        self.assertAlmostEqual(r["m1"], 132 / 125 - 1, places=5)
        self.assertAlmostEqual(r["m3"], 132 / 120 - 1, places=5)
        self.assertAlmostEqual(r["ytd"], 132 / 110 - 1, places=5)
        self.assertAlmostEqual(r["y1"], 132 / 100 - 1, places=5)
        self.assertIsNone(sync.returns([["2026-11-01", 1.0], ["2026-11-10", 1.1]])["y1"])  # geçmiş yetmiyorsa boş


if __name__ == "__main__":
    unittest.main()
