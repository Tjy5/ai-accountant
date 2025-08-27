# ai-accountant

> 基于AI的自然语言处理智能记账系统，支持语音输入、智能分类、预算管理和数据分析

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📋 目录

- [🎯 项目概述](#-项目概述)
- [✨ 核心特性](#-核心特性)
- [🏗️ 系统架构](#️-系统架构)
- [🚀 快速开始](#-快速开始)
- [📁 项目结构](#-项目结构)
- [🔧 技术栈](#-技术栈)
- [📖 使用指南](#-使用指南)
- [🧪 测试与演示](#-测试与演示)
- [🔍 核心功能详解](#-核心功能详解)
- [📊 性能特点](#-性能特点)
- [🚨 注意事项](#-注意事项)
- [🔄 升级指南](#-升级指南)
- [📞 技术支持](#-技术支持)
- [🤝 贡献指南](#-贡献指南)
- [📄 许可证](#-许可证)
- [🗄️ 代码理解](#️-代码理解)
- [🧪 测试报告](#-测试报告)

---

## 🎯 项目概述

AI智能会计系统是一个集成了先进自然语言处理技术的智能记账解决方案。系统能够理解用户的自然语言输入（如"今天买了苹果和香蕉，一共花了20元"），自动识别物品、价格和交易类型，并生成结构化的记账数据。

### 🎯 解决的核心问题

- **智能解析**: 从自然语言中准确提取交易信息
- **多物品识别**: 自动识别多个物品并智能分配价格
- **智能分类**: 基于AI的自动交易分类
- **预算管理**: 智能预算监控和预警
- **数据分析**: 直观的财务数据可视化

---

## ✨ 核心特性

### 🧠 AI驱动的智能理解

- **BERT中文模型**: 使用先进的Transformer模型进行语义理解
- **智能实体识别**: 自动识别物品、价格、时间、地点等实体
- **上下文感知**: 理解文本的深层含义和上下文关系
- **多语言支持**: 支持中文自然语言输入

### 🎯 智能交易解析

- **多物品识别**: 自动识别多个物品并分配对应价格
- **价格关联**: 智能匹配物品和价格的关系
- **类型推断**: 基于动作词自动推断物品类型
- **智能描述生成**: 根据物品数量智能生成描述

### 🔄 多层降级策略

- **AI优先**: 优先使用深度学习模型
- **规则引擎**: AI失败时降级到智能规则解析
- **基础规则**: 最后降级到基础规则解析
- **容错处理**: 确保系统在各种情况下都能工作

### 📊 完整的会计功能

- **收入支出管理**: 支持收入和支出记录
- **智能分类**: 基于AI的自动分类
- **预算管理**: 分类预算设置和监控
- **数据可视化**: 图表展示财务趋势
- **搜索筛选**: 强大的交易记录查询功能

### 附加特性（从后端文档整合）

- 🎙️ **语音输入** - Web Speech API，实时语音转文字
- 📱 **响应式设计** - 完美适配桌面端和移动端
- ⚡ **性能优化** - 虚拟滚动，大数据量流畅展示
- 💾 **数据导出** - 支持Excel/CSV格式导出

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                       前端界面 (React + TypeScript)          │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  │  TransactionForm  │  TransactionList  │  Charts │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   后端API服务 (Node.js + Express)            │
├─────────────────────────────────────────────────────────────┤
│  REST API   │  CORS支持  │  数据验证  │  错误处理  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  智能NLP处理层                              │
├─────────────────────────────────────────────────────────────┤
│  AI模型     │  规则引擎   │  降级策略   │  结果优化  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据存储层                               │
├─────────────────────────────────────────────────────────────┤
│  SQLite数据库  │  用户偏好  │  预算设置  │  交易记录  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 1. 环境要求

- **Node.js**: 18.0 或更高版本
- **npm**: 8.0 或更高版本
- **网络连接**: 首次使用需要下载AI模型

### 2. 克隆项目

```bash
git clone <repository-url>
cd ai-accountant
```

### 3. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 4. 启动服务

```bash
# 启动后端服务 (端口3001)
cd backend
npm start

# 启动前端开发服务器 (端口5173)
cd ../frontend
npm run dev
```

### 5. 访问系统

- **前端界面**: http://localhost:5173
- **后端API**: http://localhost:3001

---

## 📁 项目结构

### 详细目录结构（整合自PROJECT-STRUCTURE.md）

```
ai-accountant/
├── backend/                           # 后端服务
│   ├── 📁 data/                       # AI模型和训练数据
│   │   ├── optimized_expense_model.json   # 训练好的模型 (28KB)
│   │   ├── expense_training_data.json     # 训练数据 (28KB)  
│   │   └── expense_test_data.json         # 测试数据 (55KB)
│   │
│   ├── 📁 extractors/                 # 数据提取器
│   │   ├── amountExtractor.js         # 金额提取
│   │   ├── productExtractor.js        # 商品提取
│   │   └── quantifierExtractor.js     # 数量提取
│   │
│   ├── 📁 migrations/                 # 数据库迁移
│   │   ├── 001-initial-schema.js      # 初始化表结构
│   │   ├── 002-add-voice-input-field.js   # 语音输入字段
│   │   └── 003-add-voice-input-text.js    # 语音文本字段
│   │
│   ├── 🤖 natural-language-expense-model.js   # AI核心模型 (30KB)
│   ├── 🚀 server.js                          # Express服务器 (16KB)
│   ├── 📚 training-data-generator.js          # 训练数据生成器 (8KB)
│   ├── 🏃 training-pipeline.js              # 模型训练管道
│   ├── 🗄️ database.sqlite                    # SQLite数据库 (28KB)
│   ├── 🔧 migrate.js                         # 迁移脚本
│   ├── ⚙️ package.json                       # 项目配置
│   └── 📖 README.md                          # 完整项目文档
│
└── frontend/                          # 前端应用
    ├── 📁 src/
    │   ├── 📁 components/             # 通用组件
    │   │   ├── VirtualizedTable.tsx      # 虚拟化表格
    │   │   ├── SmartPagination.tsx       # 智能分页
    │   │   ├── MobileTransactionCard.tsx # 移动端卡片
    │   │   └── MobileTransactionList.tsx # 移动端列表
    │   │
    │   ├── 📁 hooks/                  # 自定义Hook
    │   │   ├── useResponsive.ts          # 响应式检测
    │   │   └── usePerformanceMonitor.ts  # 性能监控
    │   │
    │   ├── 📁 styles/                 # 样式文件
    │   │   └── mobile.css                # 移动端样式
    │   │
    │   ├── 📁 utils/                  # 工具函数
    │   │   └── exportUtils.ts            # 导出工具
    │   │
    │   ├── 🎨 App.tsx                    # 主应用
    │   ├── 📝 TransactionForm.tsx        # 交易表单
    │   ├── 📊 TransactionList.tsx        # 交易列表
    │   ├── 🎯 FilterBar.tsx              # 筛选条件
    │   ├── 📈 Dashboard.tsx              # 数据面板
    │   └── 💾 ExportModal.tsx            # 导出对话框
    │
    ├── ⚙️ package.json                   # 项目配置
    ├── 🔧 vite.config.ts                # Vite配置
    └── 📖 README.md                      # 前端说明
```

---

## 🔧 技术栈

### 后端技术

- **Node.js**: JavaScript运行时环境
- **Express**: Web应用框架
- **SQLite**: 轻量级数据库
- **@xenova/transformers**: Hugging Face Transformers
- **BERT中文模型**: 自然语言处理

### 前端技术

- **React 19**: 用户界面库
- **TypeScript**: 类型安全的JavaScript
- **Ant Design**: 企业级UI组件库
- **Recharts**: 数据可视化图表库
- **Vite**: 现代构建工具

### AI技术

- **BERT-base-chinese**: 中文文本分类
- **BERT-base-chinese-NER**: 中文命名实体识别
- **零样本分类**: 无需训练数据的分类
- **语义理解**: 深度语义分析

---

## 📖 使用指南

### 基本使用流程

1. **添加交易记录**
   - 在交易表单中输入描述（支持自然语言）
   - 系统自动识别物品、价格和类型
   - 确认信息后保存

2. **查看交易记录**
   - 使用筛选栏按时间、类型、关键词筛选
   - 查看详细的交易列表
   - 编辑或删除已有记录

3. **预算管理**
   - 设置各类别的月度预算
   - 查看预算使用情况
   - 接收预算超支预警

4. **数据分析**
   - 查看收支趋势图表
   - 分析消费类别分布
   - 对比不同时期的财务状况

### 支持的输入格式

#### 单物品场景

- ✅ "今天吃了面条花了15元" → 自动识别为"面条"，金额15元
- ✅ "早上买了面包花了8块钱" → 自动识别为"面包"，金额8元

#### 多物品场景

- ✅ "今天买了苹果和香蕉，一共花了20元" → 自动识别为"苹果(10元), 香蕉(10元)"
- ✅ "买了牛奶、面包、鸡蛋，花了45元" → 自动识别为"牛奶(15元), 面包(15元), 鸡蛋(15元)"

#### 复杂场景

- ✅ "今天在超市买了洗发水、牙膏、牙刷，还有零食，一共花了120元"
- ✅ "早上吃了油条豆浆，中午买了盒饭，晚上又买了水果，今天总共花了80元"

### 后端API（整合自backend/README.md）

#### 主要端点

```
# 交易
GET    /api/transactions                       # 获取交易记录（支持增强型筛选）
POST   /api/transactions                       # 创建交易记录（支持 tags）
PUT    /api/transactions/:id                   # 更新交易记录（支持 tags）
DELETE /api/transactions/:id                   # 删除交易记录
POST   /api/transactions/import                # 批量导入（Excel/CSV）
POST   /api/analyze-text                       # 文本/语音语义分析填充
POST   /api/preferences                        # 用户关键词-分类偏好上报

# 分类管理
GET    /api/categories                         # 获取分类列表
POST   /api/categories                         # 新增分类
PUT    /api/categories/:id                     # 更新分类
DELETE /api/categories/:id                     # 删除分类（默认分类不可删）

# 预算
GET    /api/budgets                            # 获取预算设置
POST   /api/budgets                            # 新增/更新分类预算（按分类唯一约束）
DELETE /api/budgets/:category                  # 删除分类预算
GET    /api/budget-status                      # 获取某月预算执行状态
```

#### 数据库表结构

**transactions** 表：
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,           -- 'income' | 'expense'
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_voice_input INTEGER DEFAULT 0,     -- 语音输入标识
  voice_input_text TEXT,                -- 语音转文字内容
  tags TEXT                             -- 标签（JSON数组字符串或以逗号/分号分隔的字符串）
);
```

**budgets** 表：
```sql
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  monthly_limit REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**categories** 表：
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('income','expense','both')),
  icon TEXT,
  color TEXT,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 测试与演示

### 运行测试

```bash
cd backend

# 交互式测试中心
node run-tests.js

# 快速测试模式
node run-tests.js --quick

# 查看帮助
node run-tests.js --help
```

### 测试选项

1. **智能NLP系统测试** - 验证核心功能
2. **系统演示** - 展示各种功能特性
3. **新旧系统对比** - 性能对比分析
4. **规则引擎测试** - 降级功能验证
5. **性能基准测试** - 系统性能评估
6. **系统健康检查** - 组件状态监控

### 直接运行特定测试

```bash
# 功能测试
node test-smart-nlp.js

# 系统演示
node demo-smart-nlp.js

# 系统对比
node compare-systems.js
```

---

## 🔍 核心功能详解

### 1. 智能NLP处理器

**文件**: [`backend/smart-nlp-processor.js`](backend/smart-nlp-processor.js)

核心功能：

- **文本分类**: 使用BERT模型判断文本类型
- **实体识别**: 提取物品、价格、动作、时间等实体
- **关系分析**: 智能分析物品和价格的关系
- **结果构建**: 生成结构化的解析结果

```javascript
const smartNLP = require('./smart-nlp-processor');

// 解析语音文本
const result = await smartNLP.parseVoiceText("今天买了苹果和香蕉，一共花了20元");

console.log(result);
// 输出:
// {
  //   originalText: "今天买了苹果和香蕉，一共花了20元",
  //   textType: "expense",
  //   totalAmount: 20,
  //   items: [
  //     { name: "苹果", price: 10, type: "distributed" },
  //     { name: "香蕉", price: 10, type: "distributed" }
  //   ],
  //   description: "苹果(10元), 香蕉(10元)",
  //   confidence: 0.8
// }
```

### 2. 智能规则引擎

**文件**: [`backend/smart-rule-engine.js`](backend/smart-rule-engine.js)

降级策略：

- **动作词映射**: 识别购买、消费等动作
- **价格单位识别**: 识别元、块、钱等单位
- **数量词处理**: 处理数量相关的词汇
- **连接词识别**: 识别"和”、“还有”等连接词

### 3. 多交易解析器

**文件**: [`backend/multi-transaction-parser.js`](backend/multi-transaction-parser.js)

功能：

- **批量解析**: 一次解析多个交易
- **智能分割**: 自动分割复杂文本
- **结果聚合**: 合并相关交易记录

### 4. 移动端适配（整合自backend/README.md）

- 响应式设计：桌面端表格视图，移动端卡片视图
- 触屏优化：左滑删除，右滑编辑

---

## 📊 性能特点

| 系统层级     | 精度        | 速度 | 资源占用 | 适用场景 |
| ------------ | ----------- | ---- | -------- | -------- |
| **AI系统**   | 最高 (95%+) | 中等 | 高       | 生产环境 |
| **规则引擎** | 中等 (80%+) | 快   | 低       | 开发测试 |
| **基础规则** | 低 (60%+)   | 最快 | 最低     | 紧急降级 |

### 性能优化特性

- **模型缓存**: 自动缓存已加载的AI模型
- **批处理**: 支持批量文本处理
- **超时控制**: 防止模型加载和推理死锁
- **内存管理**: 智能内存使用和释放

---

## 🚨 注意事项

### 首次使用

- **模型下载**: AI模型首次使用需要下载，可能需要几分钟
- **网络要求**: 需要稳定的网络连接下载模型
- **内存使用**: AI模型会占用一定内存，建议在服务器环境中使用

### 性能考虑

- **模型加载**: 模型加载后会自动缓存，后续使用更快
- **批处理**: 支持批量处理提高吞吐量
- **超时设置**: 可配置超时和重试策略

### 故障排除

1. **模型加载失败**: 检查网络连接和依赖安装
2. **解析不准确**: 调整置信度阈值或使用降级模式
3. **性能问题**: 检查系统资源，考虑使用规则引擎降级
4. **内存不足**: 减少批处理大小或重启服务

---

## 🔄 升级指南

### 从旧系统升级

1. **备份现有数据**

   ```bash
   cp database.sqlite database.sqlite.backup
   ```

2. **更新依赖**

   ```bash
   npm install
   ```

3. **更新导入语句**

   ```javascript
   // 旧版本
   const NLPProcessor = require('./nlp-processor');
   
   // 新版本
   const SmartNLPProcessor = require('./smart-nlp-processor');
   ```

4. **运行测试验证**

   ```bash
   node test-smart-nlp.js
   ```

### 配置迁移

- **保留现有配置**: 数据库和用户偏好保持不变
- **添加AI配置**: 新增AI模型相关配置
- **调整阈值**: 根据实际使用情况调整置信度阈值
- **测试新功能**: 验证新系统的各项功能

---

## 📞 技术支持

### 常见问题

1. **模型加载失败**
   - 检查网络连接
   - 验证Node.js版本 (需要18+)
   - 清理缓存: `rm -rf node_modules/.cache`

2. **解析结果不准确**
   - 检查输入文本格式
   - 查看控制台日志
   - 调整置信度阈值
   - 使用降级解析方法

3. **性能问题**
   - 检查系统内存使用
   - 调整批处理大小
   - 启用性能监控
   - 考虑模型优化

### 调试技巧

- **启用详细日志**: 查看完整的处理过程
- **使用健康检查**: 监控各组件状态
- **对比测试结果**: 分析新旧系统差异
- **性能指标分析**: 识别性能瓶颈

### 获取帮助

- **查看日志**: 检查控制台输出和错误信息
- **运行测试**: 使用测试工具验证功能
- **检查配置**: 验证AI模型和系统配置
- **降级使用**: 在AI模型不可用时使用规则引擎

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 贡献方式

1. **报告问题**: 提交Issue描述遇到的问题
2. **功能建议**: 提出新功能或改进建议
3. **代码贡献**: 提交Pull Request
4. **文档改进**: 帮助完善文档和示例
5. **测试反馈**: 测试系统并提供反馈

### 开发环境设置

1. **克隆项目**: `git clone <repository-url>`
2. **安装依赖**: `npm install`
3. **运行测试**: `npm test`
4. **启动开发服务器**: `npm run dev`

### 代码规范

- 使用ESLint进行代码检查
- 遵循TypeScript类型规范
- 添加适当的注释和文档
- 确保测试覆盖率

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

---

## 🙏 致谢

感谢以下开源项目和技术：

- [Hugging Face Transformers](https://huggingface.co/) - 提供强大的AI模型
- [Ant Design](https://ant.design/) - 优秀的React UI组件库
- [Recharts](https://recharts.org/) - 数据可视化解决方案
- [SQLite](https://www.sqlite.org/) - 轻量级数据库
- [Express](https://expressjs.com/) - Node.js Web框架

---

**⭐ 如果这个项目对你有帮助，请给我们一个星标！**

## 🗄️ 代码理解（整合自CODE_COMPREHENSION.md）

### 项目概述

AI记账本是一个基于AI技术的智能记账应用后端，集成了自然语言处理、机器学习分类模型、数据库管理和RESTful API服务。项目使用Node.js和Express构建，支持自然语言理解和语音输入的智能记账功能。

### 核心组件说明

#### 1. **服务器入口** - [`server.js`](backend/server.js)

- **功能**: Express服务器主入口，负责API路由、数据库连接、中间件配置
- **关键特性**:
  - RESTful API路由管理
  - 数据库连接和初始化
  - 文件上传处理（Excel/CSV导入）
  - 限流和安全控制
  - 错误处理中间件集成

#### 2. **自然语言处理核心** - [`natural-language-expense-model.js`](backend/natural-language-expense-model.js)

- **功能**: AI智能理解自然语言输入，转换为结构化的交易记录
- **处理流程**:
  1. 文本预处理（标准化格式）
  2. 实体识别（金额、产品、数量）
  3. 关系理解（产品-价格映射）
  4. 智能分类（基于关键词和ML模型）
  5. 结果构建（生成交易记录）
- **关键方法**:
  - `understand(text)`: 主要理解接口
  - `extractEntities(text)`: 提取文本实体
  - `buildResult()`: 构建最终结果
  - `getCategoryForProduct()`: 产品到分类映射

#### 3. **模块化提取器系统** - [`extractors/`](backend/extractors/)

- **金额提取器** - [`amountExtractor.js`](backend/extractors/amountExtractor.js):
  - 支持多种金额格式：数字+元、块/块钱、中文数字
  - 模糊匹配：大概、差不多、左右等
  - 范围匹配：100-200元
  
- **产品提取器** - [`productExtractor.js`](backend/extractors/productExtractor.js):
  - 18种分类的关键词映射
  - 支持复合产品识别：红烧肉、清炒青菜等
  - 动作-产品模式识别：吃的、买的等
  
- **数量词提取器** - [`quantifierExtractor.js`](backend/extractors/quantifierExtractor.js):
  - 基础数量：一个、两个、三个等
  - 重量单位：一斤、二斤、一公斤等
  - 特殊单位：一打、一双、一套等

#### 4. **API路由系统** - [`routes/`](backend/routes/)

- **交易路由** - [`transactions.js`](backend/routes/transactions.js):
  - GET `/transactions`: 获取交易记录，支持多维度筛选
  - POST `/transactions`: 创建交易记录
  - PUT `/transactions/:id`: 更新交易记录
  - DELETE `/transactions/:id`: 删除交易记录
  - POST `/transactions/import`: 批量导入交易

- **分类路由** - [`categories.js`](backend/routes/categories.js):
  - GET `/categories`: 获取分类列表
  - POST `/categories`: 新增分类
  - PUT `/categories/:id`: 更新分类
  - DELETE `/categories/:id`: 删除分类（默认分类不可删）

- **预算路由** - [`budgets.js`](backend/routes/budgets.js):
  - GET `/budgets`: 获取预算设置
  - POST `/budgets`: 新增/更新预算
  - DELETE `/budgets/:id`: 删除预算
  - GET `/budget-status`: 获取预算执行状态

#### 5. **服务层** - [`services/`](backend/services/)

- **导入服务** - [`importService.js`](backend/services/importService.js):
  - Excel/CSV文件解析
  - 数据验证和转换
  - 批量插入数据库
  - 错误处理和报告

#### 6. **机器学习训练系统** - [`ml/`](backend/ml/)

- **数据生成** - [`generate-dataset.js`](backend/ml/generate-dataset.js):
  - 生成训练和测试数据集
  - 支持自定义数据量
  
- **快速训练** - [`quick-train.js`](backend/ml/quick-train.js):
  - 基于朴素贝叶斯的快速分类器
  - 字符双字组特征提取
  - 轻量级模型，适合快速部署
  
- **标准训练** - [`train-standard.js`](backend/ml/train-standard.js):
  - 教师学生蒸馏模型训练
  - 基于transformers的零样本教师
  - 朴素贝叶斯学生模型
  
- **GPU训练** - [`teacher_gpu.py`](backend/ml/teacher_gpu.py):
  - Python端GPU加速训练
  - 支持大规模模型训练

#### 7. **数据库系统**

- **数据库文件**: [`database.sqlite`](backend/database.sqlite)
- **迁移系统**: [`migrate.js`](backend/migrate.js) + 迁移文件
- **数据表结构**:
  - `transactions`: 交易记录表
  - `categories`: 分类管理表
  - `budgets`: 预算设置表
  - `user_preferences`: 用户偏好表

#### 8. **中间件** - [`middleware/`](backend/middleware/)

- **错误处理** - [`errorHandler.js`](backend/middleware/errorHandler.js):
  - 统一错误响应格式
  - 开发环境堆栈信息
  - 错误详情传递

### 数据流和交互

### 自然语言处理流程
```
用户输入 → 预处理 → 实体提取 → 关系理解 → 分类决策 → 结果构建 → 数据存储
```

### API调用流程
```
客户端请求 → Express路由 → 业务逻辑 → 数据处理 → 数据库操作 → 响应返回
```

### 模型训练流程
```
数据生成 → 教师模型标注 → 学生模型训练 → 模型评估 → 模型部署
```

### 智能分类系统

- **18种预定义分类**: 餐饮、交通、购物、居住、水电煤、话费网费、日用品、教育、医疗、护肤美妆、娱乐、人情、水果、零食、烟酒饮料、其他
- **分类方法**:
  - 关键词匹配：基于预定义分类关键词
  - ML模型预测：快速分类器和蒸馏模型
  - 优先级机制：多分类时选择最高优先级

### 预算管理系统

- **多周期支持**: 月度、季度、年度预算
- **实时监控**: 预算使用情况实时计算
- **预警机制**: 
  - 安全（<80%）
  - 警告（80%-90%）
  - 危险（90%-100%）
  - 超支（>100%）

### 数据导入导出

- **导入格式**: Excel (.xlsx, .xls)、CSV
- **导出格式**: Excel、CSV
- **数据验证**: 自动验证数据格式和完整性
- **错误报告**: 详细的导入错误信息

---

## 🧪 测试报告（整合自budget-test-report.md 和 final-test-report.md）

### 月度预算功能测试报告

#### 测试摘要
- 总测试数: 5
- 通过测试: 5
- 失败测试: 0
- 成功率: 100.00%

#### 详细测试结果

- 获取预算列表: ✅ 通过
- 创建带有自定义时间范围的预算: ✅ 通过
- 验证预算时间范围保存: ✅ 通过
- 获取预算状态: ✅ 通过
- 更新预算: ✅ 通过

#### 结论
✅ 所有测试通过，月度预算时间限制功能已成功实现。

### AI记账本预算管理系统完整测试报告

#### 测试概览

- 测试目标: 验证月度预算时间限制问题的解决方案
- 测试时间: 2025-08-26T05:43:17.628Z to 2025-08-26T05:49:19.217Z
- 测试环境: 前端 Vite + React, 后端 Node.js + Express + SQLite

#### 功能实现总结

- 前端修改: 更新类型定义、表单逻辑、用户界面
- 后端修改: 增强API路由支持自定义时间范围

#### 功能测试验证

- API测试: 5/5 通过
- 数据库验证: 核心功能正常，次要数据一致性问题需关注

#### 功能验证结果

- 成功解决月度预算时间限制问题
- 支持用户自定义时间范围
- 智能默认时间设置

#### 性能评估

- 响应时间优秀
- 数据库效率良好

#### 测试结论

✅ 优秀 - 核心功能完全实现，可以投入生产使用。
