# Local Startup Runbook

This file is the shortest path for a new AI window or developer to start the app locally.

Project root:

```powershell
D:\1something\ai-accountant
```

## What Runs Where

- Frontend: React + Vite
- Frontend directory: `D:\1something\ai-accountant\frontend`
- Frontend URL: `http://127.0.0.1:5173/`
- Backend: Spring Boot Java app
- Backend directory: `D:\1something\ai-accountant\backend`
- Backend URL: `http://127.0.0.1:3002/`
- Backend health check: `http://127.0.0.1:3002/api/health`
- Frontend `/api` requests proxy to `http://127.0.0.1:3002`

Important: start the backend from the `backend` directory. The default H2 database path is relative:

```text
backend/data/ai-accountant
```

## Fast Start For AI Agents

Run these from the project root in PowerShell.

```powershell
Start-Process -FilePath 'D:\1something\ai-accountant\backend\mvnw.cmd' `
  -ArgumentList 'spring-boot:run' `
  -WorkingDirectory 'D:\1something\ai-accountant\backend' `
  -RedirectStandardOutput 'D:\1something\ai-accountant\backend\backend-dev.log' `
  -RedirectStandardError 'D:\1something\ai-accountant\backend\backend-dev.err.log' `
  -WindowStyle Hidden

Start-Process -FilePath npm.cmd `
  -ArgumentList 'run','dev','--','--host','127.0.0.1' `
  -WorkingDirectory 'D:\1something\ai-accountant\frontend' `
  -RedirectStandardOutput 'D:\1something\ai-accountant\frontend\frontend-dev.log' `
  -RedirectStandardError 'D:\1something\ai-accountant\frontend\frontend-dev.err.log' `
  -WindowStyle Hidden
```

Then open:

```powershell
Start-Process 'http://127.0.0.1:5173/'
```

## Manual Start In Two Terminals

Terminal 1, backend:

```powershell
cd D:\1something\ai-accountant\backend
.\mvnw.cmd spring-boot:run
```

Terminal 2, frontend:

```powershell
cd D:\1something\ai-accountant\frontend
npm run dev -- --host 127.0.0.1
```

Open:

```powershell
http://127.0.0.1:5173/
```

## Verify Startup

Check listening ports:

```powershell
Get-NetTCPConnection -LocalPort 3002,5173 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

Check backend health:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3002/api/health'
```

Check logs:

```powershell
Get-Content D:\1something\ai-accountant\backend\backend-dev.log -Tail 80
Get-Content D:\1something\ai-accountant\backend\backend-dev.err.log -Tail 80
Get-Content D:\1something\ai-accountant\frontend\frontend-dev.log -Tail 80
Get-Content D:\1something\ai-accountant\frontend\frontend-dev.err.log -Tail 80
```

Expected frontend log line:

```text
Local:   http://127.0.0.1:5173/
```

Expected backend log line:

```text
Tomcat started on port 3002
```

## First-Time Setup

If frontend dependencies are missing:

```powershell
cd D:\1something\ai-accountant\frontend
npm install
```

The backend uses Maven Wrapper. On first run it may download dependencies automatically:

```powershell
cd D:\1something\ai-accountant\backend
.\mvnw.cmd spring-boot:run
```

Java 17 or newer is required. This machine has been run successfully with Java 21.

## Test Login

The local test account currently exists in the H2 database:

```text
account: 1
password: 1
```

If the database is reset, recreate or verify it through the backend API:

```powershell
$body = @{ email = '1'; password = '1'; name = '1' } | ConvertTo-Json -Compress
Invoke-WebRequest 'http://127.0.0.1:3002/api/auth/register' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body `
  -SkipHttpErrorCheck

$login = @{ email = '1'; password = '1' } | ConvertTo-Json -Compress
Invoke-WebRequest 'http://127.0.0.1:3002/api/auth/login' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $login `
  -SkipHttpErrorCheck
```

HTTP `200` from login means the account works. HTTP `409` from register means the account already exists.

## Stop Servers

Find the owning process IDs:

```powershell
Get-NetTCPConnection -LocalPort 3002,5173 -ErrorAction SilentlyContinue |
  Select-Object LocalPort,State,OwningProcess
```

Stop by PID after confirming the process belongs to this app:

```powershell
Stop-Process -Id <PID>
```

## Notes

- Backend default port comes from `backend/src/main/resources/application.yml`.
- Frontend proxy target comes from `frontend/vite.config.ts`.
- Backend data is stored in `backend/data/`.
- Logs created by the background commands are ignored by git because `*.log` is ignored.
