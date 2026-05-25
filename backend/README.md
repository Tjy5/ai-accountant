# AI Accountant Backend

This module is the Spring Boot backend for the AI Accountant project. Java is the only backend implementation in this repository.

## Stack

- Java 17 or newer
- Spring Boot 3.x
- Spring Web, Spring Security, Validation
- MyBatis Plus
- MySQL 8.x
- JWT Bearer authentication

Redis is intentionally excluded. If it is added later, it should support a concrete feature such as short-lived dashboard caching, not a broad decorative cache layer.

## Local MySQL

From `backend`:

```powershell
docker compose up -d mysql
```

The compose file starts MySQL on port `3306` and loads `src/main/resources/db/mysql/schema.sql` for a fresh database.

Equivalent manual setup:

```sql
CREATE DATABASE ai_accountant CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'ai_accountant'@'%' IDENTIFIED BY 'ai_accountant';
GRANT ALL PRIVILEGES ON ai_accountant.* TO 'ai_accountant'@'%';
FLUSH PRIVILEGES;
SOURCE src/main/resources/db/mysql/schema.sql;
```

## Configuration

Environment variables:

- `SERVER_PORT`: default `3002`
- `MYSQL_URL`: default `jdbc:mysql://localhost:3306/ai_accountant?...`
- `MYSQL_USER`: default `ai_accountant`
- `MYSQL_PASSWORD`: default `ai_accountant`
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

The retained public API surface is:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/ai/analyze`
- `POST /api/ai/analyze-image`
- `POST /api/ai/transactions/commit`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/charts`

Point the frontend API base URL at `http://localhost:3002`.

## Product Scope

The backend is centered on AI-assisted bookkeeping and dashboard reporting. Authentication isolates each user's data. Default categories are seeded internally for AI classification and dashboard grouping, but category management is not a public product module.

Budgets, budget history, user preferences, public category CRUD, broad transaction CRUD, public AI settings, generic chat, legacy text analysis, and standalone transcription endpoints are intentionally not exposed.

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
