# 最终架构方案：父子预算模型

## 1. 核心理念

本方案旨在构建一个逻辑严谨、功能强大的预算管理系统。核心是将“总预算”作为唯一的父级容器，所有“分类预算”作为其子项，并在额度上进行强关联。

## 2. 后端架构规划

### 2.1 数据库 (`budgets` 表)

为了建立预算之间的层级关系，`budgets` 表需要进行修改。

**迁移计划:**

-   **文件名**: `backend/migrations/009-add-parent-id-to-budgets.js`
-   **操作**: 向 `budgets` 表中添加一个新字段 `parent_id`。
-   **字段定义**:
    -   `parent_id`: `INTEGER`
    -   **约束**: `REFERENCES budgets(id) ON DELETE CASCADE`
        -   `REFERENCES budgets(id)`: 将此字段设置为一个外键，指向同一张表的 `id` 字段。
        -   `ON DELETE CASCADE`: 这是一个关键约束。当父预算（即总预算）被删除时，所有与之关联的子预算（分类预算）将自动被一并删除，确保数据的一致性。
-   **SQL 语句 (up)**: `ALTER TABLE budgets ADD COLUMN parent_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE;`
-   **SQL 语句 (down)**: (由于 SQLite 的限制，降级操作较为复杂，将暂时省略，但在生产环境中需要一个完整的回滚策略)。

---
*下一步将规划 API 逻辑。*

### 2.2 API 路由 (`/routes/budgets.js`)

所有相关的 API 端点都需要重构以支持父子预算逻辑。

#### `GET /budgets`

-   **功能**: 获取所有预算，并以层级结构返回。
-   **逻辑**:
    1.  从数据库中查询所有预算。
    2.  找到唯一的总预算（`budget_type = 'total'`）。
    3.  将所有分类预算（`budget_type = 'category'`）作为子项（`children` 数组）附加到总预算对象上。
    4.  如果不存在总预算，则返回一个空数组或一个表示需要初始化总预算的结构。
-   **返回结构示例**:
    ```json
    {
      "id": 1,
      "budgetType": "total",
      "limit": 8000,
      "children": [
        { "id": 2, "budgetType": "category", "categoryId": "6", "limit": 3000, "parentId": 1 },
        { "id": 3, "budgetType": "category", "categoryId": "7", "limit": 1000, "parentId": 1 }
      ]
    }
    ```

#### `POST /budgets`

-   **功能**: 创建总预算或分类预算。
-   **逻辑**:
    1.  **创建总预算** (`budgetType: 'total'`)
        -   检查是否已存在总预算。如果存在，应返回 409 Conflict 错误。
        -   正常插入数据库，`parent_id` 为 `NULL`。
    2.  **创建分类预算** (`budgetType: 'category'`)
        -   首先，必须检查是否存在总预算。如果不存在，返回 400 Bad Request，提示“请先设置总预算”。
        -   获取总预算的 `id` 和 `limit`。
        -   查询所有已存在的分类预算，计算它们的 `limit` 之和 (`allocated_sum`)。
        -   **核心验证**: 检查 `allocated_sum + new_category_budget.limit <= total_budget.limit`。
        -   如果验证失败，返回 400 Bad Request，提示“分类预算总和已超出总预算上限”。
        -   如果验证通过，插入新的分类预算，并将其 `parent_id` 设置为总预算的 `id`。

#### `PUT /budgets/:id`

-   **功能**: 更新总预算或分类预算。
-   **逻辑**:
    1.  **更新总预算**
        -   获取所有分类预算的 `limit` 之和 (`allocated_sum`)。
        -   **核心验证**: 检查新的总预算 `limit` 是否**大于等于** `allocated_sum`。
        -   如果验证失败，返回 400 Bad Request，提示“总预算不能低于已分配的分类预算总和”。
        -   验证通过则更新。
    2.  **更新分类预算**
        -   获取总预算的 `limit`。
        -   获取**除当前正在编辑的预算外**的所有其他分类预算的 `limit` 之和 (`other_allocated_sum`)。
        -   **核心验证**: 检查 `other_allocated_sum + updated_category_budget.limit <= total_budget.limit`。
        -   验证失败则返回 400 Bad Request。
        -   验证通过则更新。

#### `GET /budget-status`

-   **功能**: 获取所有预算的当前使用状态。
-   **逻辑**:
    1.  获取总预算和所有分类预算。
    2.  计算**所有**支出的总和 (`total_spent`)。
    3.  为每个分类预算，计算其对应分类的支出总和 (`category_spent`)。
    4.  构造返回对象：
        -   **总预算状态**: `limit` 为总预算限额，`spent` 为 `total_spent`。
        -   **分类预算状态**: `limit` 为各自分类预算限额，`spent` 为各自的 `category_spent`。

---
*下一步将规划前端 UI/UX。*

## 3. 前端架构规划

### 3.1 核心数据流 (`useBudget.ts`)

-   `useBudget` hook 将获取并处理层级预算数据。
-   它会维护一个 `totalBudget` 对象和一个 `categoryBudgets` 数组。
-   新增计算属性：
    -   `allocatedAmount`: 所有分类预算的限额之和。
    -   `unallocatedAmount`: `totalBudget.limit - allocatedAmount`。
    -   `totalSpent`: 所有交易的总支出。

### 3.2 UI/UX 改造 (`BudgetManager.tsx`)

页面将重构为两个主要部分：总预算区和分类预算区。

-   **总预算区 (Top Section)**:
    -   如果 `totalBudget` 不存在，此区域将显示一个醒目的 "设置总预算" 按钮，引导用户进行初始化。
    -   如果 `totalBudget` 已存在，此区域将以 `Card` 或类似组件的形式展示：
        -   **总预算金额**: `formatCurrency(totalBudget.limit)`。
        -   **使用进度条**: `totalSpent / totalBudget.limit`。
        -   **统计信息**:
            -   **已分配**: `formatCurrency(allocatedAmount)` (以及占总预算的百分比)。
            -   **未分配**: `formatCurrency(unallocatedAmount)` (以及占总预算的百分比)。
            -   **已使用**: `formatCurrency(totalSpent)`。
            -   **总剩余**: `formatCurrency(totalBudget.limit - totalSpent)`。
        -   提供 "编辑总预算" 的入口。

-   **分类预算区 (Bottom Section)**:
    -   如果 `totalBudget` 不存在，此区域将被禁用或隐藏，并提示“请先设置总预算”。
    -   此区域将以列表形式展示所有的 `categoryBudgets`。
    -   列表头部有一个 "新增分类预算" 按钮。
    -   每一项分类预算都会清晰地展示其 `limit`, `spent`, `remaining` 和使用进度。

### 3.3 表单逻辑 (`useBudgetForm.ts`)

-   **新增总预算**:
    -   打开一个只包含 `budgetAmount`, `period`, `description` 等核心字段的简化表单。`budgetType` 固定为 `'total'`。
-   **新增分类预算**:
    -   表单中，`budgetAmount` 输入框需要进行**实时验证**。
    -   输入框下方需要有一个提示：`可用额度: formatCurrency(unallocatedAmount)`。
    -   `InputNumber` 组件的 `max` 属性应被动态设置为 `unallocatedAmount` + (如果是编辑模式下) `editingBudget.limit`。
-   **编辑总预算**:
    -   表单中，`budgetAmount` 的 `min` 属性应被动态设置为 `allocatedAmount`，以防止总预算被缩减到低于已分配的额度。