@echo off
REM Generate commune-labels.mbtiles from GeoJSON using Tippecanoe

echo ====================================================================
echo  Commune Labels MBTiles Generation
echo ====================================================================
echo.
echo This script generates commune-labels.mbtiles from commune-labels.geojson
echo using Tippecanoe.
echo.

REM Check if Tippecanoe is installed
where tippecanoe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Tippecanoe is not installed!
    echo.
    echo Tippecanoe Installation Options:
    echo.
    echo Option 1: WSL / Linux
    echo   sudo apt-get install tippecanoe
    echo   or build from source: https://github.com/felt/tippecanoe
    echo.
    echo Option 2: Docker ^(recommended for Windows^)
    echo   docker run --rm -v "%cd%:/data" ghcr.io/felt/tippecanoe:latest \
    echo     tippecanoe -o /data/data/commune-labels.mbtiles \
    echo       -Z0 -z14 --force \
    echo       --drop-densest-as-needed \
    echo       --coalesce-densest-as-needed \
    echo       --no-tile-compression \
    echo       --layer=commune_labels \
    echo       --promote-id=insee \
    echo       /data/tmp/commune-labels.geojson
    echo.
    echo Option 3: Manual installation
    echo   Download from: https://github.com/felt/tippecanoe/releases
    echo.
    exit /b 1
)

echo [INFO] Tippecanoe found: %where tippecanoe%
echo.
echo Running Tippecanoe...
echo Input:  tmp\commune-labels.geojson
echo Output: data\commune-labels.mbtiles
echo Zoom:   6-14
echo Layer:  commune_labels
echo.

cd /d "%~dp0"

tippecanoe ^
  -o data\commune-labels.mbtiles ^
  -Z0 -z14 ^
  --force ^
  --coalesce-densest-as-needed ^
  --no-tile-compression ^
  --layer=commune_labels ^
  --promote-id=insee ^
  tmp\commune-labels.geojson

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] MBTiles generated successfully!
    echo File: data\commune-labels.mbtiles
    echo.
    echo Next steps:
    echo 1. Add to data\config.json:
    echo    "commune_labels": { "mbtiles": "commune-labels.mbtiles" }
    echo 2. Restart tileserver Docker container
) else (
    echo.
    echo [ERROR] Tippecanoe failed with exit code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
