@echo off
setlocal

set "BASE_DIR=%~dp0"
set "WRAPPER_PROPERTIES=%BASE_DIR%.mvn\wrapper\maven-wrapper.properties"

if not exist "%WRAPPER_PROPERTIES%" (
  echo Missing Maven wrapper properties: %WRAPPER_PROPERTIES% 1>&2
  exit /b 1
)

set "DIST_URL="
for /f "usebackq tokens=1,* delims==" %%A in ("%WRAPPER_PROPERTIES%") do (
  if "%%A"=="distributionUrl" set "DIST_URL=%%B"
)

if "%DIST_URL%"=="" (
  echo distributionUrl is not set in %WRAPPER_PROPERTIES% 1>&2
  exit /b 1
)

for %%F in ("%DIST_URL%") do set "DIST_FILE=%%~nxF"
set "MAVEN_DIR=%DIST_FILE:-bin.zip=%"

if "%MAVEN_USER_HOME%"=="" (
  set "MAVEN_USER_HOME=%USERPROFILE%\.m2"
)

set "CACHE_DIR=%MAVEN_USER_HOME%\wrapper\dists\ai-accountant-backend"
set "ZIP_FILE=%CACHE_DIR%\%DIST_FILE%"
set "MAVEN_HOME=%CACHE_DIR%\%MAVEN_DIR%"

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'Stop';" ^
    "$cache = '%CACHE_DIR%';" ^
    "$zip = '%ZIP_FILE%';" ^
    "$url = '%DIST_URL%';" ^
    "New-Item -ItemType Directory -Force -Path $cache | Out-Null;" ^
    "if (!(Test-Path -LiteralPath $zip)) { Invoke-WebRequest -Uri $url -OutFile $zip; }" ^
    "Expand-Archive -LiteralPath $zip -DestinationPath $cache -Force;"
  if errorlevel 1 exit /b 1
)

call "%MAVEN_HOME%\bin\mvn.cmd" %*
exit /b %ERRORLEVEL%
