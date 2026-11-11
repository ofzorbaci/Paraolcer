"""Ağsız testler: python -m unittest test_us_history"""

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

import us_history as us


class UsHistoryTest(unittest.TestCase):
    def setUp(self):
        self.out = Path(tempfile.mkdtemp())
        self.universe = {"stocks": {"AAPL": "Apple"}, "etfs": {"SPY": "SPDR"}, "crypto": {"BTC": "Bitcoin", "USDT": "Tether"}}

    def test_backfill_budget_and_daily_closes(self):
        calls = []

        def fetch(symbol, kind, key):
            calls.append((symbol, kind))
            return [["2025-10-09", 100.0], ["2025-10-10", 101.0], ["2025-11-03", 110.0]], "full"

        feed = {"usQuotes": {"stocks": {"AAPL": {"price": 120.0, "date": "2026-11-10"}}, "crypto": {"BTC": {"price": 70000.0, "date": "2026-11-10"}}}}
        r = us.run(self.out, self.universe, feed, "key", budget=2, today=date(2026, 11, 11), fetch=fetch, pause=0)
        self.assertEqual(calls, [("AAPL", "stock"), ("SPY", "etf")])  # bütçe: 2 sembol, stablecoin yok
        self.assertEqual(r["remaining"], 1)  # BTC sonraki çalıştırmaya
        self.assertEqual(r["appended"], 2)

        aapl = json.loads((self.out / "us/history/AAPL.json").read_text(encoding="utf-8"))
        self.assertEqual(aapl["prices"][-1], ["2026-11-10", 120.0])
        oct_ = json.loads((self.out / "us/daily/2025-10.json").read_text(encoding="utf-8"))
        self.assertEqual(oct_["dates"], ["2025-10-09", "2025-10-10"])
        self.assertEqual(oct_["stocks"]["SPY"], [100.0, 101.0])
        nov = json.loads((self.out / "us/daily/2026-11.json").read_text(encoding="utf-8"))
        self.assertEqual(nov["crypto"]["BTC"], [70000.0])

        # İkinci çalıştırma: kalan BTC yüklenir, AAPL tekrar istenmez.
        calls.clear()
        us.run(self.out, self.universe, None, "key", budget=5, today=date(2026, 11, 12), fetch=fetch, pause=0)
        self.assertEqual(calls, [("BTC", "crypto")])

    def test_daily_limit_stops_without_failing(self):
        def fetch(symbol, kind, key):
            raise us.DailyLimit("25 requests per day")

        r = us.run(self.out, self.universe, None, "key", budget=3, today=date(2026, 11, 11), fetch=fetch, pause=0)
        self.assertIn("hakkı bitti", r["stopped"])
        self.assertEqual(r["remaining"], 3)

    def test_parsers(self):
        stock = {"Time Series (Daily)": {"2026-11-10": {"4. close": "244.38"}, "2026-11-07": {"4. close": "240.00"}}}
        self.assertEqual(us.parse_av_stock(stock), [["2026-11-07", 240.0], ["2026-11-10", 244.38]])
        crypto = {"Time Series (Digital Currency Daily)": {"2026-11-11 00:00:00": {"4. close": "73000.5"}}}
        self.assertEqual(us.parse_av_crypto(crypto), [["2026-11-11", 73000.5]])
        self.assertIsNone(us.parse_av_stock({"Information": "rate limit"}))


if __name__ == "__main__":
    unittest.main()
