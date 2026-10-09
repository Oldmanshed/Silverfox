@echo off
rem Builds the risk review page from every dated dump in ..\Dumps (newest 13)
rem and writes it to ..\Output\risk-dashboard.html.
rem Folder layout in the synced SharePoint library:
rem   Risk Review\Tool\    <- this file, src\, tools\
rem   Risk Review\Dumps\   <- CRS_Dump_YYYY-MM-DD.xlsx from Matik
rem   Risk Review\Output\  <- the page to upload to Site Pages

rem Account link formats (see README). Leave empty to show names without links.
set "GAINSIGHT_URL="
set "SALESFORCE_URL="

cd /d "%~dp0"
python tools\build.py html --dumps "..\Dumps" --keep 13 -o "..\Output\risk-dashboard.html" --gainsight-url "%GAINSIGHT_URL%" --salesforce-url "%SALESFORCE_URL%"
if errorlevel 1 (
  echo.
  echo Build failed - see the message above.
) else (
  echo.
  echo Done. Upload Output\risk-dashboard.html to the site's Site Pages library.
)
pause
