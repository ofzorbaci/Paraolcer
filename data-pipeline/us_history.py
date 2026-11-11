"""ABD hisse, ETF ve kripto fiyat geçmişi: uygulamadaki "alış günü fiyatı" için.

Her çalıştırmada:
  1. Veri akışının (feed.json) Finnhub'dan aldığı son kapanışları geçmişe ekler (ek istek yok).
  2. Geçmişi henüz yüklenmemiş sembollerden en fazla --budget kadarını Alpha Vantage'dan
     yükler (ücretsiz plan günde 25 istek; bu yüzden ilk yükleme birkaç günde tamamlanır).
  3. Değişen ayların dosyalarını yazar: <out>/us/daily/<YYYY-MM>.json

Dosyalar:
    <out>/us/history/<SEMBOL>.json  {"symbol", "type", "prices": [["YYYY-MM-DD", fiyat], ...]}
    <out>/us/daily/<YYYY-MM>.json   {"dates": [...], "stocks": {SEMBOL: [...]}, "crypto": {SEMBOL: [...]}}
    <out>/us/meta.json              hangi sembolün geçmişi nereden, ne kadar yüklendi

Fiyatlar dolar cinsinden kapanıştır. Alpha Vantage yanıt vermezse ya da günlük hakkı biterse
o sembol bir sonraki çalıştırmaya kalır; bu bir hata sayılmaz.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

SCHEMA_VERSION = 1
YEARS = 5
STABLE = {"USDT", "USDC", "DAI"}
AV_URL = "https://www.alphavantage.co/query"


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


# --------------------------------------------------------------------------- Alpha Vantage


class DailyLimit(Exception):
    """Alpha Vantage günlük ya da dakikalık hakkı bitti: kalan semboller sonraki çalıştırmaya."""


def av_get(params: dict, key: str) -> dict:
    url = AV_URL + "?" + urllib.parse.urlencode({**params, "apikey": key})
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def parse_av_stock(body: dict) -> list[list] | None:
    series = body.get("Time Series (Daily)")
    if not isinstance(series, dict):
        return None
    out = []
    for d, row in series.items():
        try:
            p = float(row["4. close"])
        except (KeyError, TypeError, ValueError):
            continue
        if p > 0:
            out.append([d, round(p, 6)])
    return sorted(out)


def parse_av_crypto(body: dict) -> list[list] | None:
    series = body.get("Time Series (Digital Currency Daily)")
    if not isinstance(series, dict):
        return None
    out = []
    for d, row in series.items():
        # Alan adı sürüme göre "4. close" ya da "4a. close (USD)".
        raw = row.get("4. close") or row.get("4a. close (USD)")
        try:
            p = float(raw)
        except (TypeError, ValueError):
            continue
        if p > 0:
            out.append([d[:10], round(p, 8)])
    return sorted(out)


def av_message(body: dict) -> str:
    return str(body.get("Information") or body.get("Note") or body.get("Error Message") or "")


def fetch_history(symbol: str, kind: str, key: str) -> tuple[list[list], str]:
    """(fiyatlar, kapsam) — kapsam 'full' ya da 'compact' (yalnızca son ~100 gün)."""
    if kind == "crypto":
        body = av_get({"function": "DIGITAL_CURRENCY_DAILY", "symbol": symbol, "market": "USD"}, key)
        prices = parse_av_crypto(body)
        if prices is None:
            raise DailyLimit(av_message(body)) if "rate limit" in av_message(body).lower() or "per day" in av_message(body).lower() else RuntimeError(av_message(body) or "yanıt boş")
        return prices, "full"
    av_symbol = symbol.replace(".", "-")  # BRK.B → BRK-B
    body = av_get({"function": "TIME_SERIES_DAILY", "symbol": av_symbol, "outputsize": "full"}, key)
    prices = parse_av_stock(body)
    if prices is not None:
        return prices, "full"
    msg = av_message(body)
    if "premium" in msg.lower():
        # Uzun geçmiş ücretli planda: son ~100 günle başla, gerisi her gün eklenir.
        time.sleep(13)
        body = av_get({"function": "TIME_SERIES_DAILY", "symbol": av_symbol, "outputsize": "compact"}, key)
        prices = parse_av_stock(body)
        if prices is not None:
            return prices, "compact"
        msg = av_message(body)
    if "rate limit" in msg.lower() or "per day" in msg.lower() or "requests per" in msg.lower():
        raise DailyLimit(msg)
    raise RuntimeError(msg or "yanıt boş")


# --------------------------------------------------------------------------- ay dosyaları


def write_months(out: Path, months: set[str] | None) -> int:
    """us/daily/<YYYY-MM>.json: her sembolün o aydaki her işlem günündeki kapanışı."""
    by_month: dict[str, dict[str, dict[str, dict[str, float]]]] = {}
    for path in (out / "us" / "history").glob("*.json"):
        h = read_json(path) or {}
        group = "crypto" if h.get("type") == "crypto" else "stocks"
        for d, p in h.get("prices", []):
            m = d[:7]
            if months is None or m in months:
                by_month.setdefault(m, {"stocks": {}, "crypto": {}})[group].setdefault(h["symbol"], {})[d] = p
    for m, groups in by_month.items():
        dates = sorted({d for g in groups.values() for prices in g.values() for d in prices})
        write_json(
            out / "us" / "daily" / f"{m}.json",
            {
                "schema": SCHEMA_VERSION,
                "source": "Alpha Vantage, Finnhub",
                "month": m,
                "dates": dates,
                **{g: {s: [prices.get(d) for d in dates] for s, prices in sorted(groups[g].items())} for g in ("stocks", "crypto")},
            },
        )
    return len(by_month)


# --------------------------------------------------------------------------- çalıştırma


def run(out: Path, universe: dict, feed: dict | None, key: str | None, budget: int, today: date, fetch=fetch_history, pause: float = 13) -> dict:
    hist_dir = out / "us" / "history"
    meta = read_json(out / "us" / "meta.json") or {"schema": SCHEMA_VERSION, "symbols": {}}
    symbols = {**{s: "stock" for s in universe.get("stocks", {})}, **{s: "etf" for s in universe.get("etfs", {})}, **{s: "crypto" for s in universe.get("crypto", {}) if s not in STABLE}}
    cutoff = (today - timedelta(days=365 * YEARS + 2)).isoformat()
    touched: set[str] = set()

    def merge(symbol: str, kind: str, rows: list[list]) -> int:
        path = hist_dir / f"{symbol}.json"
        h = read_json(path) or {"schema": SCHEMA_VERSION, "symbol": symbol, "type": kind, "prices": []}
        prices = {d: p for d, p in h["prices"]}
        added = 0
        for d, p in rows:
            if d >= cutoff and prices.get(d) != p:
                prices[d] = p
                touched.add(d[:7])
                added += 1
        if added:
            h["prices"] = [[d, p] for d, p in sorted(prices.items())]
            h["type"] = kind
            write_json(path, h)
        return added

    # 1) Finnhub kapanışları (veri akışında zaten var)
    appended = 0
    if feed and feed.get("usQuotes"):
        q = feed["usQuotes"]
        for group in ("stocks", "crypto"):
            for s, v in (q.get(group) or {}).items():
                if s in symbols and isinstance(v, dict) and v.get("price") and v.get("date"):
                    appended += merge(s, symbols[s], [[v["date"][:10], v["price"]]])

    # 2) Alpha Vantage geçmişi: önce hiç yüklenmemişler, sonra yalnızca ~100 gün yüklenebilenler değil
    pending = [s for s in symbols if s not in meta["symbols"]]
    loaded, stopped = [], None
    if key:
        for s in pending[:budget]:
            try:
                rows, coverage = fetch(s, symbols[s], key)
            except DailyLimit as e:
                stopped = f"Alpha Vantage hakkı bitti: {e}"[:200]
                break
            except Exception as e:  # noqa: BLE001 — bir sembol diğerlerini durdurmasın
                print(f"{s}: geçmiş alınamadı ({e})"[:200])
                meta["symbols"][s] = {"source": "Alpha Vantage", "coverage": "none", "at": today.isoformat(), "error": str(e)[:120]}
                continue
            merge(s, symbols[s], rows)
            meta["symbols"][s] = {"source": "Alpha Vantage", "coverage": coverage, "at": today.isoformat(), "from": rows[0][0] if rows else None}
            loaded.append(s)
            time.sleep(pause)

    # 3) Ay dosyaları
    daily_exists = (out / "us" / "daily").exists()
    months = write_months(out, None if not daily_exists else touched) if (touched or not daily_exists) else 0
    meta.update(
        {
            "schema": SCHEMA_VERSION,
            "source": "Alpha Vantage (geçmiş), Finnhub (günlük kapanış)",
            "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "remaining": [s for s in symbols if s not in meta["symbols"]],
        }
    )
    write_json(out / "us" / "meta.json", meta)
    summary = {"appended": appended, "loaded": loaded, "remaining": len(meta["remaining"]), "months": months, "stopped": stopped}
    print(json.dumps(summary, ensure_ascii=False))
    return summary


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--out", required=True, help="us/ klasörünün yazılacağı yer (fund-data dalının kopyası)")
    p.add_argument("--universe", required=True, help="feed/us-universe.json")
    p.add_argument("--feed", help="feed/public/feed.json (Finnhub kapanışları için)")
    p.add_argument("--budget", type=int, default=10, help="bu çalıştırmada en fazla kaç sembolün geçmişi yüklenecek")
    p.add_argument("--symbols", help="test için: yalnızca bu semboller (virgülle)")
    args = p.parse_args(argv)
    universe = read_json(Path(args.universe)) or {}
    if args.symbols:
        only = set(args.symbols.split(","))
        universe = {g: {s: n for s, n in (universe.get(g) or {}).items() if s in only} for g in ("stocks", "etfs", "crypto")}
        for s in only - {s for g in universe.values() for s in g}:
            universe["stocks"][s] = s
    feed = read_json(Path(args.feed)) if args.feed else None
    key = os.environ.get("ALPHAVANTAGE_API_KEY") or None
    if not key:
        print("ALPHAVANTAGE_API_KEY yok: yalnızca günlük kapanışlar eklenecek.")
    today = datetime.now(timezone(timedelta(hours=3))).date()
    try:
        run(Path(args.out).resolve(), universe, feed, key, args.budget, today)
    except Exception as e:  # noqa: BLE001
        print(f"HATA: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
