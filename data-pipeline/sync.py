"""TEFAS fon verisi senkron betiği.

Paraölçer'in herkese açık fon dosyalarını üretir:

    <out>/funds/latest.json          tüm fonların son fiyatı ve getirileri
    <out>/funds/history/<KOD>.json   her fonun günlük fiyat geçmişi
    <out>/funds/meta.json            güncelleme zamanı, fon başına fiyat tarihi, kaynak, şema

Kaynak şu an TEFAS (pytefas üzerinden). Lisanslı bir sağlayıcıya geçince yalnızca
`fetch_rows` değişir; dosya şeması (SCHEMA_VERSION) aynı kalır.

Kullanım:
    python sync.py --out ../site-data              # ana çekim (ilk seferde 5 yıl)
    python sync.py --out ../site-data --mode topup # tamamlama: son günü yeniden çeker

Hata olursa çıkış kodu 1 olur ve <out> içindeki eski dosyalara dokunulmaz:
yeni dosyalar önce geçici klasöre yazılır, doğrulanır, sonra tek hamlede yerine konur.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Windows konsolu (cp1254) Türkçe karakterde ve okta takılmasın.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

SCHEMA_VERSION = 1
SOURCE = "TEFAS"
KINDS = ("YAT", "EMK", "BYF")
HISTORY_YEARS = 5
# En az bu kadar fon yoksa yanıt bozuk sayılır (TEFAS'ta ~2.400 fon var).
MIN_FUNDS = 500
KIND_LABEL = {"YAT": "Yatırım fonu", "EMK": "Emeklilik fonu", "BYF": "Borsa yatırım fonu"}


# --------------------------------------------------------------------------- kaynak


def fetch_rows(start: date, end: date) -> list[dict]:
    """[start, end] aralığında YAT, EMK, BYF fonlarının günlük satırları.

    Kaynağa özgü tek fonksiyon budur. pytefas TEFAS'ın dakikada 6 istek sınırını
    kendisi yönetir ve uzun aralıkları 28 günlük parçalara böler; ek istek atılmaz.
    """
    from pytefas import Crawler  # yalnızca gerçek çekimde gerekir

    crawler = Crawler(timeout=90, max_retry=6)
    rows: list[dict] = []
    for kind in KINDS:
        df = crawler.fetch(start.isoformat(), end.isoformat(), kind=kind, columns="info")
        if df.empty:
            continue
        for r in df.to_dict("records"):
            rows.append(
                {
                    "code": str(r.get("fund_code") or "").strip().upper(),
                    "name": str(r.get("fund_name") or "").strip(),
                    "kind": kind,
                    "date": str(r.get("date"))[:10],
                    "price": r.get("price"),
                    "aum": r.get("portfolio_size"),
                    "investors": r.get("investor_count"),
                }
            )
    return rows


# --------------------------------------------------------------------------- yardımcılar


def num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Küçük dosya: boşluksuz, Türkçe karakterler olduğu gibi. Pages zaten gzip'le sunar.
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def retry(action, attempts: int = 6, wait: float = 2.0):
    """Runs a file operation again when Windows briefly locks the path (PermissionError)."""
    import time

    for i in range(attempts):
        try:
            return action()
        except PermissionError:
            if i == attempts - 1:
                raise
            time.sleep(wait)


def price_at_or_before(prices: list[list], target: str) -> float | None:
    """prices: [["YYYY-MM-DD", fiyat], ...] eskiden yeniye. target gününde ya da öncesindeki son fiyat."""
    lo, hi, found = 0, len(prices) - 1, None
    while lo <= hi:
        mid = (lo + hi) // 2
        if prices[mid][0] <= target:
            found = prices[mid][1]
            lo = mid + 1
        else:
            hi = mid - 1
    return found


def shift_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 - months, 12)
    year, month = d.year + y, m + 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    return date(year, month, 28)


def returns(prices: list[list]) -> dict:
    """1 ay, 3 ay, 6 ay, yılbaşından beri ve 1 yıl getirisi (oran, ör. 0.042 = %4,2)."""
    if not prices:
        return {}
    last_date = date.fromisoformat(prices[-1][0])
    last = prices[-1][1]
    first_date = prices[0][0]
    targets = {
        "m1": shift_months(last_date, 1),
        "m3": shift_months(last_date, 3),
        "m6": shift_months(last_date, 6),
        # Yılbaşından beri: önceki yılın son kapanışına göre.
        "ytd": date(last_date.year - 1, 12, 31),
        "y1": shift_months(last_date, 12),
    }
    out = {}
    for key, t in targets.items():
        iso = t.isoformat()
        base = price_at_or_before(prices, iso) if iso >= first_date else None
        out[key] = round(last / base - 1, 5) if base and base > 0 else None
    return out


# --------------------------------------------------------------------------- senkron


def sync(out: Path, mode: str, today: date, fetch=fetch_rows, checkpoint_dir: Path | None = None) -> dict:
    """Yeni dosyaları geçici klasörde hazırlar, doğrular ve <out>/funds yerine koyar."""
    funds_dir = out / "funds"
    meta = read_json(funds_dir / "meta.json") or {}
    last_date = meta.get("lastDate")

    if not last_date:
        # TEFAS 5 yıldan eski başlangıcı reddeder; sınırın bir gün içinden başla.
        start = shift_months(today, 12 * HISTORY_YEARS) + timedelta(days=1)
        first_load = True
    else:
        last = date.fromisoformat(last_date)
        # Tamamlama turu son günü de yeniden çeker (geç gelen fiyatlar ve eksik fonlar için).
        start = last if mode == "topup" else last + timedelta(days=1)
        first_load = False

    if start > today:
        print("Yeni gün yok; değişiklik yapılmadı.")
        return {"changed": False}

    # A finished download is kept next to the output until the files are in place, so a failure
    # in the last step (e.g. Windows locking a folder) does not cost another 40-minute fetch.
    # In the temp folder, not in <out>: it must never be committed with the published data.
    checkpoint = (checkpoint_dir or Path(tempfile.gettempdir())) / f"paraolcer-tefas-{start}-{today}.json"
    cached = read_json(checkpoint)
    if cached is not None:
        print(f"Önceki çekim kullanılıyor: {checkpoint.name}")
        fetched = cached
    else:
        print(f"Çekiliyor: {start} - {today} ({'ilk yükleme' if first_load else mode})")
        fetched = fetch(start, today)
        checkpoint.write_text(json.dumps(fetched, ensure_ascii=False, default=str), encoding="utf-8")
    rows = [r for r in fetched if r["code"] and num(r["price"]) and num(r["price"]) > 0]
    if not rows:
        print("Kaynakta bu aralık için fiyat yok (hafta sonu/tatil olabilir); değişiklik yapılmadı.")
        return {"changed": False}

    by_code: dict[str, list[dict]] = {}
    for r in rows:
        by_code.setdefault(r["code"], []).append(r)
    if first_load and len(by_code) < MIN_FUNDS:
        raise RuntimeError(f"İlk yüklemede yalnızca {len(by_code)} fon geldi; yanıt eksik görünüyor.")

    staging = Path(tempfile.mkdtemp(prefix="funds-", dir=out if out.exists() else None))
    try:
        if funds_dir.exists():
            shutil.copytree(funds_dir, staging / "funds")
        history_dir = staging / "funds" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)

        info: dict[str, dict] = {f["code"]: f for f in (read_json(staging / "funds" / "latest.json") or {}).get("funds", [])}

        for code, fund_rows in by_code.items():
            path = history_dir / f"{code}.json"
            hist = read_json(path) or {}
            prices = {d: p for d, p in hist.get("prices", [])}
            for r in fund_rows:
                prices[r["date"]] = round(num(r["price"]), 6)
            ordered = sorted(prices.items())
            newest = max(fund_rows, key=lambda r: r["date"])
            write_json(
                path,
                {"schema": SCHEMA_VERSION, "source": SOURCE, "code": code, "name": newest["name"], "kind": newest["kind"], "prices": [[d, p] for d, p in ordered]},
            )
            prev = info.get(code, {})
            if not prev.get("date") or newest["date"] >= prev["date"]:
                info[code] = {
                    "code": code,
                    "name": newest["name"],
                    "kind": newest["kind"],
                    "price": round(num(newest["price"]), 6),
                    "date": newest["date"],
                    "aum": round(num(newest["aum"])) if num(newest["aum"]) is not None else None,
                    "investors": int(num(newest["investors"])) if num(newest["investors"]) is not None else None,
                    "returns": returns([[d, p] for d, p in ordered]),
                }

        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        funds = sorted(info.values(), key=lambda f: f["code"])
        latest_date = max(f["date"] for f in funds)
        write_json(staging / "funds" / "latest.json", {"schema": SCHEMA_VERSION, "source": SOURCE, "updatedAt": now, "funds": funds})
        write_json(
            staging / "funds" / "meta.json",
            {
                "schema": SCHEMA_VERSION,
                "source": SOURCE,
                "updatedAt": now,
                "lastDate": latest_date,
                "kinds": {k: KIND_LABEL[k] for k in KINDS},
                "fundCount": len(funds),
                "priceDates": {f["code"]: f["date"] for f in funds},
            },
        )

        # Doğrula: üç dosya da okunuyor ve fon sayısı makul.
        check = read_json(staging / "funds" / "latest.json")
        if not check or len(check["funds"]) < (MIN_FUNDS if first_load else 1):
            raise RuntimeError("latest.json doğrulanamadı")
        if not read_json(staging / "funds" / "meta.json"):
            raise RuntimeError("meta.json doğrulanamadı")

        # Tek hamlede yerine koy: önce eskiyi kenara al, yenisini taşı, eskiyi sil.
        backup = None
        if funds_dir.exists():
            backup = out / f".funds-old-{now[:19].replace(':', '')}"
            retry(lambda: funds_dir.rename(backup))
        try:
            retry(lambda: (staging / "funds").rename(funds_dir))
        except OSError:
            # Windows can keep a fresh folder locked (antivirus, indexer). Copy instead; the
            # staged files are complete and verified, only the swap is not a single step.
            shutil.copytree(staging / "funds", funds_dir)
        if backup:
            shutil.rmtree(backup, ignore_errors=True)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    checkpoint.unlink(missing_ok=True)

    print(f"Tamam: {len(by_code)} fonda yeni fiyat, toplam {len(funds)} fon, son fiyat tarihi {latest_date}")
    return {"changed": True, "funds": len(funds), "lastDate": latest_date}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--out", required=True, help="funds/ klasörünün yazılacağı yer (ör. fund-data dalının kopyası)")
    p.add_argument("--mode", choices=("main", "topup"), default="main")
    p.add_argument("--today", help="test için: YYYY-MM-DD (varsayılan: bugün, Türkiye saati)")
    args = p.parse_args(argv)
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    today = date.fromisoformat(args.today) if args.today else datetime.now(timezone(timedelta(hours=3))).date()
    try:
        sync(out, args.mode, today)
    except Exception as e:  # noqa: BLE001 — iş başarısız görünsün, eski veri yerinde kalsın
        print(f"HATA: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
