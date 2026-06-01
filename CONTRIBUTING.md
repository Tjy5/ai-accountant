# 贡献指南

感谢你愿意参与 AI Accountant。这个项目目前是前后端分离应用，贡献时请尽量保持变更小而清晰，避免把无关重构和功能改动放在同一个 Pull Request 里。

## 开始之前

1. 先查看现有 Issue，确认是否已有相关讨论。
2. 对于较大的功能或行为变更，请先开 Issue 说明动机、方案和影响范围。
3. 不要提交真实密钥、生产配置、数据库文件、日志或个人财务数据。

## 本地开发

### 后端

```bash
cd backend
./mvnw test
./mvnw spring-boot:run
```

Windows PowerShell:

```powershell
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

### 前端

```bash
cd frontend
npm install
npm run lint
npm test
npm run build
```

## Pull Request 要求

- 说明变更动机和用户可见影响。
- 列出你运行过的验证命令。
- 如果改动涉及 UI，请附截图或录屏。
- 如果改动涉及 API、环境变量或数据结构，请同步更新 README 或相关文档。
- 保持提交中不包含 `.env`、`backend/data/`、`target/`、`dist/`、日志和临时文件。

## 代码风格

- 后端遵循现有 Spring Boot + MyBatis Plus 分层结构。
- 前端遵循现有 React、TypeScript、Zustand 和组件组织方式。
- 优先复用现有工具函数、类型和样式约定。
- 测试应覆盖新增行为和修复过的回归场景。

## 提交信息

推荐使用 Conventional Commits 风格：

```text
feat: add monthly budget summary
fix: handle empty ai response
docs: update deployment guide
test: cover transaction filters
chore: update ignore rules
```

## 安全问题

请不要在公开 Issue 中披露安全漏洞。请按照 [SECURITY.md](./SECURITY.md) 中的方式报告。
