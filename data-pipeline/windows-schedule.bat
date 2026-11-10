@echo off
rem windows-sync.bat'i Gorev Zamanlayici'ya ekler: Pazartesi-Cuma 08:30 (ana) ve 10:00 (tamamlama).
rem Bilgisayarin saati Turkiye saatinde olmali. Kaldirmak icin:
rem   schtasks /Delete /TN "Paraolcer fon 0830" /F
rem   schtasks /Delete /TN "Paraolcer fon 1000" /F

set "BAT=%~dp0windows-sync.bat"
schtasks /Create /F /TN "Paraolcer fon 0830" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:30 /TR "\"%BAT%\" main"
schtasks /Create /F /TN "Paraolcer fon 1000" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 10:00 /TR "\"%BAT%\" topup"
echo Gorevler eklendi. Kontrol: schtasks /Query /TN "Paraolcer fon 0830"
