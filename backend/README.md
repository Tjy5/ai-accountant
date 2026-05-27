# AI Accountant Backend

This module is the Spring Boot backend for the AI Accountant project. Java is the only backend implementation in this repository.

## Stack

- Java 17 or newer
- Spring Boot 3.x
- Spring Web, Spring Security, Validation
- MyBatis Plus
- H2 file database for default local development
- Optional MySQL 8.x profile for production-like runs
- JWT Bearer authentication

Redis is intentionally excluded. If it is added later, it should support a concrete feature such as short-lived dashboard caching, not a broad decorative cache layer.

## Local Database

The default local runtime uses a file-backed H2 database. It does not require Docker Desktop, Docker Compose, or a separately installed MySQL server.

The default database file is created under `backend/data/` when the backend starts from the `backend` directory. To reset local development data, stop the backend and delete `backend/data/`.

## Configuration

Environment variables:

- `SERVER_PORT`: default `3002`
- `DATABASE_URL`: default `jdbc:h2:file:./data/ai-accountant;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE`
- `DATABASE_USER`: default `sa`
- `DATABASE_PASSWORD`: default empty
- `JWT_SECRET`: required for production; development has a fallback
- `JWT_EXPIRES_IN`: default `30d`
- `CORS_ALLOWED_ORIGINS`: comma-separated frontend origins
- `AI_ENABLED`: default `true`
- `AI_API_KEY`: required for AI recognition endpoints
- `AI_BASE_URL`: default `https://api.openai.com/v1`
- `AI_MODEL`: default `gpt-4o-mini`
- `AI_BASE_URL_ALLOWLIST`: optional comma-separated host allowlist

## Run

```powershell
.\mvnw.cmd spring-boot:run
```

On macOS/Linux, use `./mvnw spring-boot:run`.

## Optional MySQL

MySQL is still supported through the explicit `mysql` profile. Provision a MySQL 8.x database manually, then load `src/main/resources/db/mysql/schema.sql`.

```sql
CREATE DATABASE ai_accountant CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'ai_accountant'@'%' IDENTIFIED BY 'ai_accountant';
GRANT ALL PRIVILEGES ON ai_accountant.* TO 'ai_accountant'@'%';
FLUSH PRIVILEGES;
SOURCE src/main/resources/db/mysql/schema.sql;
```

Start the backend with the profile:

```powershell
$env:MYSQL_URL = "jdbc:mysql://localhost:3306/ai_accountant?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true"
$env:MYSQL_USER = "ai_accountant"
$env:MYSQL_PASSWORD = "ai_accountant"
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=mysql
```

On macOS/Linux, set the same environment variables and use `./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql`.

The retained public API surface is:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/ai/analyze`
- `POST /api/ai/analyze-image`
- `POST /api/ai/transactions/commit`
- `GET /api/transactions`
- `POST /api/transactions`
- `PATCH /api/transactions/{id}`
- `DELETE /api/transactions/{id}`
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/{id}`
- `DELETE /api/categories/{id}`
- `GET /api/budgets`
- `POST /api/budgets`
- `PATCH /api/budgets/{id}`
- `DELETE /api/budgets/{id}`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/charts`

Point the frontend API base URL or Vite proxy target at `http://127.0.0.1:3002`.

## Product Scope

The backend is centered on AI-assisted bookkeeping, transaction management, category management, monthly budgets, and dashboard reporting. Authentication isolates each user's data. Default categories are seeded internally for AI classification and dashboard grouping, and the Categories and Budgets modules expose protected CRUD for user-managed labels and spending caps.

Budget history, user preferences, public AI settings, generic chat, legacy text analysis, and standalone transcription endpoints are intentionally not exposed.

## Tests

```powershell
.\mvnw.cmd test
```

On macOS/Linux, use `./mvnw test`.

The test profile uses an in-memory H2 database in MySQL compatibility mode.

## Smoke Checks

Register and capture the returned token:

```powershell
$base = "http://localhost:3002"
$reg = Invoke-RestMethod "$base/api/auth/register" -Method Post -ContentType "application/json" -Body '{"email":"java.user@example.com","password":"password123","name":"Java User"}'
$token = $reg.token
$headers = @{ Authorization = "Bearer $token" }
```

Recognize text and commit confirmed drafts:

```powershell
Invoke-RestMethod "$base/api/ai/analyze" -Method Post -Headers $headers -ContentType "application/json" -Body '{"text":"餐饮 30 元"}'

$commitBody = @{
  drafts = @(
    @{
      confirmed = $true
      type = "expense"
      category = "餐饮"
      amount = 30
      description = "lunch"
      date = "2026-01-10"
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod "$base/api/ai/transactions/commit" -Method Post -Headers $headers -ContentType "application/json" -Body $commitBody
Invoke-RestMethod "$base/api/dashboard/summary?startDate=2026-01-01&endDate=2026-01-31" -Headers $headers
Invoke-RestMethod "$base/api/dashboard/charts?startDate=2026-01-01&endDate=2026-01-31" -Headers $headers
```
