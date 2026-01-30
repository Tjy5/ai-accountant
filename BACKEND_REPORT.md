# AI Accountant Backend Report

本文件基于当前仓库 `D:\1something\ai-accountant` 的**后端代码**整理：包含已有功能、数据库结构概览、主要问题/风险点、优化方案（按优先级）、以及可新增功能建议。

---

## 1. 技术栈与运行方式

- 运行入口：`backend/server.js`
- Web 框架：Express 5（`express@^5.1.0`）
- 数据库：SQLite（`sqlite` + `sqlite3`）
- 数据文件：默认 `backend/database.sqlite`（本地文件，不提交到 git；删除即可重置数据）
- 迁移：自研迁移 runner `backend/migrate.js` + `backend/migrations/*`，启动时通过 `npm run migrate` 自动执行（本地会生成 `.migrate` 状态文件，不提交到 git）
- 中间件/基础能力：
  - CORS：`cors()`
  - 访问日志：`morgan('combined')`
  - 压缩：`compression()`（对 SSE / AI chat stream 做了跳过）
  - 请求体大小：默认 `10mb`，AI 路由可通过 `AI_JSON_LIMIT` 单独配置
  - 全局限流：`express-rate-limit`（15分钟 1000 次/每 IP）
  - 错误处理：`backend/middleware/errorHandler.js`
- 本地测试：`backend/package.json` 使用 `node --test`，已存在 `backend/tests/api.test.js`

---

## 2. 全局中间件与安全相关

- JWT 鉴权：`backend/middleware/auth.js`
  - 读取 `Authorization: Bearer <token>`，`utils/jwt.js` 校验并写入 `req.user`
- 错误返回：`backend/middleware/errorHandler.js`
  - 返回 `{ error }`，非生产环境附带 `stack/details`
- 限流：
  - server 全局 `express-rate-limit`（IP 粒度）
  - 登录/注册：自研内存限流 `backend/middleware/rateLimiter.js`
  - AI settings：单独更严格的 `express-rate-limit`（基于 userId，避免 DNS 校验被滥用）
- AI Base URL 防 SSRF：`backend/utils/urlValidator.js`
  - 支持 allowlist：环境变量 `AI_BASE_URL_ALLOWLIST`
  - 禁止 localhost、禁止解析到内网/保留 IP（含 DNS lookup 校验）

---

## 3. API 功能清单（按路由文件）

说明：除 `/api/auth/*` 外，`backend/server.js` 里对所有 `/api/*` 业务路由强制加了 `authMiddleware`。

### 3.1 认证 Auth（`backend/routes/auth.js`）

- `POST /api/auth/register` 注册（bcrypt hash + JWT）
- `POST /api/auth/login` 登录（bcrypt compare + JWT）
- `GET /api/auth/me` 获取当前用户（需要 JWT）

备注：当前 email 格式与密码强度校验在代码里被放开（偏 demo/开发模式）。

### 3.2 交易 Transactions（`backend/routes/transactions.js`）

- `GET /api/transactions`
  - 过滤：`type`、`category`（可多值）、`tag`（可多值，LIKE 查询）、`startDate/endDate`、`minAmount/maxAmount`、`keyword`（description/category LIKE）、`description`（description LIKE）
  - 分页：
    - `page/pageSize`（offset 分页）
    - 或 `cursor`（基于 `created_at + id` 的游标分页）
  - 返回：默认返回数组；若启用分页返回 `{ transactions, pageInfo }`
- `POST /api/transactions` 新增单条
- `POST /api/transactions/bulk` 批量新增（最多 200）
- `PUT /api/transactions/:id` 更新
- `DELETE /api/transactions/:id` 软删除（写 `deleted_at`）

### 3.3 分类 Categories（`backend/routes/categories.js`）

- `GET /api/categories` 获取分类列表（返回 `{ categories: [...] }`）
- `POST /api/categories` 新建分类
- `PUT /api/categories/:id` 更新分类
- `DELETE /api/categories/:id` 软删除（默认分类不可删）

### 3.4 预算 Budgets（`backend/routes/budgets.js`）

- `GET /api/budgets`
  - 返回预算层级结构（总预算 `total` + 子分类预算 `category`）
- `POST /api/budgets`
  - 支持创建 `budgetType=total|category`
  - 支持 period（monthly/quarterly/yearly）与 `budgetAmount` 自动换算到月额度
  - 支持自定义日期 `startDate/endDate`
  - 写入 `budget_history`
- `PUT /api/budgets/:id`
  - 更新 total：校验不能低于已分配给子分类预算的总额
  - 更新 category：校验更新后分类预算总和不超过 total
  - 写入 `budget_history`
- `DELETE /api/budgets/:id`
  - 软删除；删除 total 前需要先删除子分类预算
  - 写入 `budget_history`
- `GET /api/budget-status`
  - 计算当前 period 范围内总支出、各分类预算支出/剩余、已分配/未分配
- `GET /api/budget-history`
  - 预算变更历史（可按 `budgetId` 过滤，分页 `page/pageSize`）

### 3.5 看板 Dashboard（`backend/routes/dashboard.js`）

- `GET /api/dashboard/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - 汇总：收入/支出/净额/笔数
  - 内存 TTL cache（短 TTL，提升重复请求性能）
- `GET /api/dashboard/charts?startDate=...&endDate=...&topN=...`
  - 月度趋势 + 分类占比
  - 内存 TTL cache

### 3.6 偏好 Preferences（`backend/routes/preferences.js`）

- 记账偏好（keyword -> category）
  - `GET /api/preferences` 列表
  - `POST /api/preferences` upsert（同 keyword 覆盖 category，支持“删除后恢复”通过 `deleted_at = NULL`）

### 3.7 AI 设置与 AI 记账（`backend/routes/aiSettings.js`, `backend/routes/ai.js`）

AI 设置（支持 OpenAI 兼容接口）：
- `GET /api/ai/settings` 获取配置（apiKey 只返回 `********` 占位）
- `PUT /api/ai/settings` 更新配置
  - apiBaseUrl：走 `assertValidAiBaseUrl`（含 SSRF 防护）
  - apiKey：`AES-256-GCM` 加密存储（`backend/utils/encryption.js`，依赖 `ENCRYPTION_KEY`）
  - model/temperature/maxTokens/enabled：参数校验
- `DELETE /api/ai/settings` 清空/禁用 AI（软删式：写 `deleted_at`，并清空加密 key）

AI 记账/对话：
- `POST /api/ai/analyze`（兼容 `POST /api/analyze-text`）
  - 输入 `text`，调用 `/chat/completions`，解析 JSON 输出 `transactions/ignored/warnings`
  - 对 AI 给的 category 做“智能匹配”（模糊匹配 + 编辑距离），细节见 `backend/routes/ai.js`
- `POST /api/ai/chat`
  - 多轮对话，要求模型严格输出 JSON：`reply/intent/drafts/needsClarification/...`
  - 支持 SSE 流式输出（`?stream=1`），并在服务端尝试提取 JSON 字段 `reply` 的增量
  - 支持 `pendingDrafts`（客户端草稿）用于修正
- `POST /api/ai/transcribe`
  - base64 音频 -> Whisper 转写（`/audio/transcriptions`）
- `POST /api/ai/analyze-image`
  - base64 图片 -> vision 解析（同样输出交易 JSON）

---

## 4. 数据库结构概览（基于迁移文件）

核心表（最终形态，省略部分非关键字段）：

- `users`: email/password_hash/name/created_at/updated_at
- `transactions`：
  - user_id, type(income|expense), category(text), amount, description
  - date/created_at/updated_at/deleted_at
  - is_voice_input/voice_input_text
  - tags(text，常存 JSON 字符串)
- `categories`：
  - user_id, name, type(income|expense|both), icon/color/description
  - is_default/usage_count
  - created_at/updated_at/deleted_at
- `budgets`：
  - user_id, budget_type(total|category), category/category_id
  - monthly_limit/quarterly_limit/yearly_limit/period
  - start_date/end_date/alert_threshold/is_active/description
  - parent_id（支持层级）
  - created_at/updated_at/deleted_at
- `budget_history`：
  - user_id, budget_id, action, old_value/new_value, reason
  - created_at/updated_at/deleted_at
- `user_preferences`（keyword -> category）：
  - user_id, keyword, category, created_at/updated_at/deleted_at
- `user_ai_settings`：
  - user_id(unique), api_base_url, api_key_encrypted, model, temperature, max_tokens, enabled
  - created_at/updated_at/deleted_at

主要索引（部分）：
- transactions：`idx_transactions_user_deleted_created_id`、`idx_transactions_user_deleted_date` 等（用于列表/游标分页）
- categories：`idx_categories_user_name`（保证每用户分类名唯一）

---

## 5. 已存在但未接入/疑似未使用的模块

- 交易导入服务（已写好但未见路由接入）：
  - `backend/services/importService.js`（xlsx/csv 解析 + 事务插入）
  - `backend/services/importConstants.js`
- 抽取器（未搜索到引用）：
  - `backend/extractors/amountExtractor.js`
  - `backend/extractors/productExtractor.js`
  - `backend/extractors/quantifierExtractor.js`
- `backend/ml/requirements.txt`（transformers/numpy）目前未见与 Node 后端集成

---

## 6. 主要问题/风险点（按优先级）

### P0（强烈建议尽快修）

- 默认分类可能对新用户不可用：
  - 迁移 `004-add-categories-table.js` 插入的默认分类没有 `user_id`
  - 但接口按 `user_id = ?` 查（`routes/categories.js`、AI 分类列表等）
  - 结果：新用户可能“看不到分类/AI 分类难以工作”

### P1（安全/可靠性）

- 认证策略偏 demo：
  - `routes/auth.js` 里 email/password 强度校验直接放开
  - `utils/jwt.js` 存在 fallback secret（生产环境风险大）
- 本地可能存在 `backend/.env`（若包含 `ENCRYPTION_KEY` 等敏感信息，请勿提交到 git）
- `server.js` 强制设置 `Content-Type: application/json`：
  - 对 SSE/未来文件下载不友好（虽然 compression filter 已跳过 SSE，但 Content-Type 仍可能不匹配）
- SQLite PRAGMA 未在 server 启动时显式设置（foreign_keys/WAL/busy_timeout 等）

### P2（性能/工程化）

- `GET /budget-status` 存在 N+1 查询（分类预算多时明显变慢）
- 输入校验不统一（各路由手写校验，策略不一致）
  - 例：transactions 更新对 amount 未强制 >0；tags 可能无法显式清空（COALESCE 逻辑）
- 迁移写法不统一：
  - 部分 migration 自行打开固定路径 DB（`../backend/database.sqlite`）
  - 部分 migration 由 runner 传入 db
  - 这会导致 `DATABASE_FILE` 场景下不一致
- 错误返回结构简单（只有 `{error}`），不利于客户端区分与排障
- 测试覆盖有限（仅 api.test.js 覆盖部分路由）

---

## 7. 优化方案（建议落地顺序）

### 7.1 P0：数据与多端一致性

- 默认分类初始化（建议二选一）：
  - A：在 `POST /api/auth/register` 成功后，为该 user seed 一份默认分类（建议包含“其他”）
  - B：提供 `POST /api/categories/seed-defaults`（仅管理员/首次安装）并在初始化阶段触发

### 7.2 P1：安全/配置与稳定性

- 强制生产环境配置：
  - `JWT_SECRET`：生产必须设置（移除 fallback 或仅 dev 生效）
  - `ENCRYPTION_KEY`：生产必须设置；不要提交到 git
- 恢复/增强 auth 校验：email 格式、密码强度、注册频率、登录失败策略（可加渐进惩罚）
- `server.js` Content-Type 中间件调整：
  - 移除强制设置，或仅对非 SSE 场景设置；SSE 明确 `text/event-stream`
- SQLite 启动 PRAGMA（建议）：
  - `PRAGMA foreign_keys = ON;`
  - `PRAGMA journal_mode = WAL;`
  - `PRAGMA synchronous = NORMAL;`
  - `PRAGMA busy_timeout = 5000;`

### 7.3 P2：性能与工程化

- `GET /budget-status` 聚合优化：
  - 使用单条/少量 SQL 完成分组聚合（GROUP BY），避免每个 categoryBudget 一次查询
- 校验与错误标准化：
  - 引入统一校验库（zod/joi）+ 统一错误结构（code/requestId/details）
  - 统一分页风格：尽量都支持 cursor（避免 offset 大页性能差）
- 迁移体系统一：
  - 所有 migrations 只使用 runner 传入的 db（避免硬编码路径）
  - `DATABASE_FILE`/多环境一致
- 测试补齐（按关键路径）：
  - auth（register/login/me）
  - budgets（创建/更新/删除/历史/status）
  - aiSettings（urlValidator/encryption 边界）
  - ai（禁用/缺 key/JSON 解析失败降级/stream）

---

## 8. 可新增的后端功能建议（基于现有代码可快速扩展）

- 交易导入/导出
  - 直接复用 `backend/services/importService.js`
  - 建议新增：
    - `POST /api/transactions/import`（multer 上传 csv/xlsx + 预览校验 + 批量入库）
    - `GET /api/transactions/export`（csv/xlsx 导出）
- 预算告警
  - 加定时任务（node-cron/agenda/bullmq）：超阈值提醒、日报/周报
- 标签体系完善
  - `GET /api/tags`（聚合统计、热度）
  - tags 规范化存储（JSON/独立表/索引），支持精确查询而非 LIKE
- 搜索与报表增强
  - SQLite FTS5：description/category 全文检索
  - dashboard 增强：Top 商户/分类趋势、同比/环比、预算命中率
- AI 闭环增强
  - 草稿持久化：新增 `draft_transactions` 表 + `POST /api/ai/apply-drafts` 一键落账
  - 用户纠正自动写入 `user_preferences`，形成长期“个性化映射”闭环
- 备份/恢复
  - `GET /api/backup`（导出 sqlite 或逻辑导出 JSON）
  - `POST /api/restore`（本地/管理员模式）

---

## 9. 相关文件索引（快速定位）

- 启动与中间件：`backend/server.js`
- 认证：`backend/routes/auth.js`、`backend/middleware/auth.js`、`backend/utils/jwt.js`
- 交易：`backend/routes/transactions.js`
- 分类：`backend/routes/categories.js`
- 预算：`backend/routes/budgets.js`
- 看板：`backend/routes/dashboard.js`
- 偏好：`backend/routes/preferences.js`
- AI：`backend/routes/ai.js`、`backend/routes/aiSettings.js`、`backend/utils/encryption.js`、`backend/utils/urlValidator.js`
- 迁移：`backend/migrate.js`、`backend/migrations/*`
- 测试：`backend/tests/api.test.js`
