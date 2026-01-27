# OPSX Proposal: JARVIS Visual Redesign (Phase 1)

## Change ID
`jarvis-visual-redesign`

## Status
`plan-complete`

---

## 1. Context

### 1.1 User Need
用户在 AI 识别交易后希望看到更直观的展示（类似超市小票的卡片），而非普通列表；用户希望打开 App 时直接看到财务健康状况（预算条）而非流水账。

### 1.2 Existing System Analysis

#### 1.2.1 Current Architecture
- **技术栈**: React Native 0.73.6 + Expo 50 + TypeScript
- **UI 库**: React Native Paper (MD3) + Victory Native (图表)
- **导航**: @react-navigation (Bottom Tabs + Native Stack)
- **状态**: @tanstack/react-query + Local SQLite

#### 1.2.2 Relevant Files
| File | Role |
|------|------|
| `mobile/src/components/AIInputModal.tsx` | AI 输入结果展示（当前使用 draftCard 样式） |
| `mobile/src/screens/dashboard/DashboardScreen.tsx` | 统计页面（非首页），已有 WealthCard + VictoryPie |
| `mobile/src/screens/transactions/TransactionListScreen.tsx` | 交易列表页（Tab 首页） |
| `mobile/src/screens/transactions/AddTransactionScreen.tsx` | 新增交易页面 |
| `mobile/src/components/WealthCard.tsx` | 统一卡片组件（elevated/flat/glass） |
| `mobile/src/components/ScreenContainer.tsx` | 屏幕容器（渐变头部 + 负边距重叠） |
| `mobile/src/theme.ts` | 设计系统（Fusion Design System） |
| `mobile/src/screens/budgets/BudgetListScreen.tsx` | 预算列表（已有进度条实现） |

#### 1.2.3 Design System Constraints (Fusion Design System)
| Token | Value | Note |
|-------|-------|------|
| `radii.lg` | 24 | 标准卡片圆角 |
| `radii.xl` | 32 | 头部圆角 |
| `shadows.small` | elevation: 2 | 卡片默认阴影 |
| `spacing.md` | 16 | 标准间距 |
| `colors.wealth.functional.expense` | #EF4444 | 支出红色 |
| `colors.wealth.functional.income` | #10B981 | 收入绿色 |
| `colors.surface` | #FFFFFF | 卡片背景 |
| `colors.textPrimary` | #1E293B | 主要文字 |
| `colors.textSecondary` | #64748B | 次要文字 |

---

## 2. Constraint Sets

### 2.1 Hard Constraints (Must NOT Violate)

| ID | Constraint | Rationale |
|----|------------|-----------|
| HC-01 | 必须使用现有 `WealthCard` 组件或扩展它，禁止新建平行卡片组件 | 保持组件一致性 |
| HC-02 | 颜色必须使用 `theme.colors.wealth.functional` 中定义的语义色 | 设计系统规范 |
| HC-03 | 动画必须使用 React Native 内置 `Animated` API（已在项目中使用） | 无 reanimated 依赖 |
| HC-04 | 圆角必须使用 `theme.radii` 中的 token（8/16/24/32） | 设计一致性 |
| HC-05 | 阴影必须使用 `theme.shadows` 中的 preset（small/medium/large/float） | 设计一致性 |
| HC-06 | Tab 导航结构不可变更（Transactions/Dashboard/Add/Budget/Settings） | 用户体验连贯性 |
| HC-07 | 必须保持 `ScreenContainer` 的渐变头部 + 负边距悬浮模式 | 现有 Fusion 布局约定 |
| HC-08 | 预算数据必须来自现有 `localDB` 中的 `budgets` 表和 `transactions` 聚合 | 数据层已定义 |

### 2.2 Soft Constraints (Strong Preferences)

| ID | Constraint | Rationale |
|----|------------|-----------|
| SC-01 | 优先扩展 `AIInputModal` 的 `draftCard` 样式而非完全重写 | 减少改动范围 |
| SC-02 | 票据边缘效果优先使用 SVG 或 View + borderRadius 实现，避免图片 | 性能 + 可维护性 |
| SC-03 | 预算进度条动画优先使用 `Animated.spring()` 实现"回弹"效果 | 一致的动画风格 |
| SC-04 | HUD 数字更新动画优先使用 `Animated.timing()` + interpolate | 简单可控 |
| SC-05 | 优先在 `DashboardScreen` 现有布局基础上修改，而非重写 | 减少回归风险 |
| SC-06 | 票据卡片的编辑/删除交互应复用 `AIInputModal` 现有的 `updateDraft`/`removeDraft` 模式 | 行为一致性 |

### 2.3 Dependencies

| ID | Dependency | Impact |
|----|------------|--------|
| DEP-01 | 预算 HUD 依赖 `getDashboardStats()` 返回数据 | 需确认该函数能提供当月预算 vs 实际支出 |
| DEP-02 | 票据卡片需展示 `category` 字段对应的图标 | 需确认分类图标映射存在（当前 `IconPicker` 有 icon 列表） |
| DEP-03 | HUD 实时更新依赖交易提交后的回调机制 | 需确认 `AddTransactionScreen.onSave` 后如何通知 HUD 刷新 |

### 2.4 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| RISK-01 | 票据锯齿边缘可能在不同设备 DPI 下渲染不一致 | 使用半圆缺口方案作为 fallback |
| RISK-02 | 预算进度条动画可能在低端设备卡顿 | 使用 `useNativeDriver: true` 并限制动画复杂度 |
| RISK-03 | HUD 区域占 60% 可能在小屏幕上挤压内容 | 使用百分比布局并设置 minHeight |

---

## 3. Requirements (Derived from Constraints)

### Requirement 1.1: Receipt-Style Result Card

#### 3.1.1 Scenarios

**Scenario A: Single Transaction Display**
```gherkin
Given AI has recognized 1 transaction
When the result card is displayed
Then the card should have:
  - White background (#FFFFFF)
  - Half-circle cutouts on left/right edges OR zigzag bottom edge
  - Shadow with elevation: 2 / shadowOpacity: 0.1
  - Amount displayed largest (>24sp), red for expense (#EF4444), green for income (#10B981)
  - Category icon + name displayed second level
  - Date + note displayed third level (gray text)
```

**Scenario B: Edit Mode**
```gherkin
Given a receipt card is displayed
When user taps "edit" icon
Then the card text fields should become editable inputs
And the card background should become slightly gray (surfaceVariant)
```

**Scenario C: Delete Action**
```gherkin
Given a receipt card is displayed
When user taps "delete" icon
Then the card should animate out (slide left OR fade out)
And the transaction should be removed from drafts
```

#### 3.1.2 Success Criteria
- [ ] Card visual matches "receipt" metaphor with edge effects
- [ ] Amount color correctly reflects transaction type
- [ ] Edit/delete interactions are smooth and intuitive
- [ ] Card can be reused in `AIInputModal` batch results view

---

### Requirement 1.2: JARVIS HUD Dashboard

#### 3.2.1 Scenarios

**Scenario A: HUD Layout**
```gherkin
Given user opens the App (TransactionListScreen or new HUD screen)
When the screen loads
Then the top 60% should display:
  - Budget progress bar (horizontal, thick)
  - Today's total expense (large centered number)
And the bottom area should contain input/action buttons
```

**Scenario B: Budget Progress Bar Color Logic**
```gherkin
Given budget progress bar is displayed
When spent < 50% of budget
Then bar color should be green (#10B981)
When spent >= 50% AND < 80%
Then bar color should be yellow/amber (#F59E0B)
When spent >= 80%
Then bar color should be red (#EF4444)
```

**Scenario C: Progress Bar Animation**
```gherkin
Given budget value changes
When the progress bar updates
Then it should animate with spring/bounce effect
```

**Scenario D: Real-time Update**
```gherkin
Given HUD is displayed
When user submits a new transaction via bottom input
Then HUD numbers should update with "jumping" animation
And no Toast notification should be shown
```

#### 3.2.2 Success Criteria
- [ ] HUD occupies ~60% of screen height
- [ ] Progress bar color correctly reflects budget percentage
- [ ] Animations are smooth (60fps target)
- [ ] No Toast appears on successful transaction submission
- [ ] Numbers update immediately after transaction save

---

## 4. Design Decisions (User Confirmed)

### D1: HUD Screen Location
**Decision**: 替换 `TransactionListScreen`（Tab: 明细）作为新首页
- 用户打开 App 直接看到 HUD
- 原有交易列表功能将集成到 HUD 下方或可滚动区域

### D2: Receipt Card Edge Style
**Decision**: 左右半圆缺口（模拟撕孔）
- 实现简单且视觉效果明确
- 使用 View 的 overflow + 负 margin 圆形实现

### D3: Today's Expense Data Source
**Decision**: 复用 `getDashboardStats()` 并添加 `today` 参数
- 最小改动，复用现有逻辑

### D4: Budget Data Availability
**Decision**: 显示"未设置预算"提示 + 引导创建按钮
- 清晰的引导比隐藏功能更好
- 点击引导可跳转到 Budget Tab

---

## 5. Implementation Sequence

```
Phase 1.1: Receipt Card Component
├── 1.1.1 Extend WealthCard with "receipt" variant
├── 1.1.2 Implement edge cutout effect (View + overflow)
├── 1.1.3 Add edit/delete interaction states
└── 1.1.4 Integrate into AIInputModal

Phase 1.2: HUD Dashboard
├── 1.2.1 Create BudgetProgressBar component
├── 1.2.2 Implement color logic + spring animation
├── 1.2.3 Create TodayExpenseDisplay component
├── 1.2.4 Refactor target screen layout (60/40 split)
└── 1.2.5 Connect real-time update mechanism
```

---

## 6. Verifiable Success Criteria Summary

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| VSC-01 | Receipt card has visible edge effects | Visual inspection |
| VSC-02 | Amount text size > 24sp | Style inspection |
| VSC-03 | Expense amount is #EF4444, income is #10B981 | Color picker tool |
| VSC-04 | Edit mode shows gray background | Visual inspection |
| VSC-05 | Delete animates card out | Screen recording |
| VSC-06 | HUD occupies ~60% screen | Layout debugger |
| VSC-07 | Progress bar green at <50%, yellow at 50-80%, red at >80% | Manual budget adjustment test |
| VSC-08 | Progress bar has bounce on update | Screen recording at 0.5x speed |
| VSC-09 | No Toast on transaction submit | Manual test |
| VSC-10 | HUD numbers animate on update | Screen recording |

---

## Appendix A: Codebase Exploration Summary

### A.1 UI Components Inventory
| Component | Location | Usage |
|-----------|----------|-------|
| `WealthCard` | `components/WealthCard.tsx` | 统一卡片（elevated/flat/glass） |
| `AppCard` | `components/AppCard.tsx` | 旧卡片（逐步弃用） |
| `ScreenContainer` | `components/ScreenContainer.tsx` | 渐变头部 + 悬浮布局 |
| `AppText` | `components/AppText.tsx` | 文字组件 |

### A.2 Animation Usage
- `AIInputModal.tsx`: `Animated.loop()` + `Animated.timing()` for recording pulse
- `BudgetListScreen.tsx`: No animation (static progress bar)
- No `react-native-reanimated` in dependencies

### A.3 Color Tokens Used
| Semantic | Value | Files |
|----------|-------|-------|
| Expense | `#EF4444` / `theme.colors.error` | TransactionList, AddTransaction |
| Income | `#10B981` / `#059669` | TransactionList, Dashboard |
| Primary | `#2563EB` / `theme.colors.primary` | All screens |

### A.4 Budget Progress Bar Reference
`BudgetListScreen.tsx:236-238`:
```tsx
<View style={styles.progressOuter}>
  <View style={[styles.progressInner, { width: `${widthPercent}%`, backgroundColor: barColor }]} />
</View>
```
Already has color logic: safe/warning/danger/over
