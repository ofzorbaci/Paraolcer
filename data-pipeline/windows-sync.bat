@echo off
rem ParaLens TEFAS yedek senkronu (GitHub sunuculari TEFAS'a erisemezse).
rem Ayni betigi bu bilgisayarda calistirir ve fund-data dalina push eder; push GitHub'daki
rem "Fon verisi" is akisini tetikler, o da sadece Pages'e yayinlar.
rem
rem Kullanim:  windows-sync.bat main     (08:30 ana cekim)
rem            windows-sync.bat topup    (10:00 tamamlama turu)
rem Gorev Zamanlayici kaydi icin: windows-schedule.bat (bir kez, yonetici gerekmez).

setlocal
chcp 65001 >nul
set "MODE=%~1"
if "%MODE%"=="" set "MODE=main"
set "HERE=%~dp0"
set "REPO=%HERE%.."
set "DATA=%HERE%fund-data"
set "LOG=%HERE%windows-sync.log"
set "PY=%HERE%.venv\Scripts\python.exe"

echo ==== %DATE% %TIME% mod=%MODE% ==== >> "%LOG%"

rem Python ortami (ilk seferde kurulur)
if not exist "%PY%" (
  python -m venv "%HERE%.venv" >> "%LOG%" 2>&1 || goto :fail
  "%PY%" -m pip install -q -r "%HERE%requirements.txt" >> "%LOG%" 2>&1 || goto :fail
)

rem fund-data dalinin yerel kopyasi
for /f "delims=" %%u in ('git -C "%REPO%" remote get-url origin') do set "ORIGIN=%%u"
if not exist "%DATA%\.git" (
  git clone -q --branch fund-data --single-branch "%ORIGIN%" "%DATA%" >> "%LOG%" 2>&1 || goto :fail
) else (
  git -C "%DATA%" fetch -q origin fund-data >> "%LOG%" 2>&1 || goto :fail
  git -C "%DATA%" reset -q --hard origin/fund-data >> "%LOG%" 2>&1 || goto :fail
)

rem Senkron: hata olursa cikis 1, eski dosyalar yerinde kalir
"%PY%" "%HERE%sync.py" --out "%DATA%" --mode %MODE% >> "%LOG%" 2>&1 || goto :fail

rem ABD hisse, ETF, kripto gecmisi (hata TEFAS yayinini durdurmaz; anahtar yoksa sadece gunluk kapanislar)
"%PY%" "%HERE%us_history.py" --out "%DATA%" --universe "%REPO%\feed\us-universe.json" --feed "%REPO%\feed\public\feed.json" --budget 10 >> "%LOG%" 2>&1

rem Degisiklik varsa tek commit olarak yeniden yaz ve push et
for /f %%s in ('git -C "%DATA%" status --porcelain') do goto :commit
echo Degisiklik yok. >> "%LOG%"
exit /b 0

:commit
git -C "%DATA%" checkout -q --orphan snapshot >> "%LOG%" 2>&1 || goto :fail
git -C "%DATA%" add -A >> "%LOG%" 2>&1 || goto :fail
git -C "%DATA%" -c user.name="fon-verisi (Windows)" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -q -m "Fon verisi (Windows yedegi): %DATE%" >> "%LOG%" 2>&1 || goto :fail
git -C "%DATA%" push -q -f origin snapshot:fund-data >> "%LOG%" 2>&1 || goto :fail
git -C "%DATA%" branch -q -f fund-data snapshot >> "%LOG%" 2>&1
git -C "%DATA%" checkout -q fund-data >> "%LOG%" 2>&1
git -C "%DATA%" branch -q -D snapshot >> "%LOG%" 2>&1
echo Yayinlandi. >> "%LOG%"
exit /b 0

:fail
echo HATA: senkron basarisiz, ayrintilar %LOG% >> "%LOG%"
echo HATA: ParaLens fon senkronu basarisiz. Ayrintilar: %LOG%
exit /b 1
