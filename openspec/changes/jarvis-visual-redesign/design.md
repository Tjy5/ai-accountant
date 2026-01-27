# OPSX Design: jarvis-visual-redesign

## Status: `plan-complete`

---

## 1. Technical Decisions (Confirmed)

### D1: HUD Screen Location
**Decision**: Modify `TransactionListScreen` (Tab: 明细) as new home
- Use `ListHeaderComponent` pattern for HUD area
- Keep existing SectionList for transaction list
- No navigation structure change (HC-06 compliant)

### D2: Receipt Card Edge Style
**Decision**: Left/right half-circle cutouts
- Radius: `theme.radii.sm` (8px)
- Y-offset: 30% from top (vertically centered upper area)
- Implementation: Absolute positioned View circles matching background color
- Dual container: outer (shadow) + inner (overflow:hidden)

### D3: Receipt Card Divider
**Decision**: Dashed border line
- `borderStyle: 'dashed'`, `borderBottomWidth: 1`, `borderColor: theme.colors.outline`
- Fallback: solid line if inconsistent rendering

### D4: Budget Progress Bar Color Thresholds
**Decision**: HUD-specific thresholds
- Green `#10B981`: < 50%
- Yellow `#F59E0B`: 50% - 80%
- Red `#EF4444`: ≥ 80%
- NOTE: Different from existing BudgetListScreen (70/90/100) - intentional per-context variation

### D5: Progress Bar Animation
**Decision**: Transform-based with useNativeDriver
- Use `scaleX` instead of width (allows native driver)
- Left-anchor via `translateX = -(1 - scale) * barWidth / 2`
- Spring config: `{ friction: 7, tension: 40 }`

### D6: Today's Expense Query
**Decision**: Extend `getDashboardStats` with today shortcut
- Add optional `today?: boolean` parameter
- When true: use `DATE(date, 'localtime') = DATE('now', 'localtime')`
- Preserves existing API compatibility

### D7: Real-time Event Mechanism
**Decision**: Integrated in `localDB.ts`
- Simple EventEmitter pattern (no external dependency)
- Events: `transactionsChanged`, `budgetsChanged`, `syncApplied`
- Emit from mutation functions after successful DB write
- Debounce in consumers: 200ms

### D8: HUD Layout Implementation
**Decision**: Extend `ScreenContainer` with dynamic header
- Add `headerHeightPercent?: number` prop
- Or new `headerType: 'jumbo'` with `height: '60%'`
- Preserve gradient + negative margin overlap pattern

---

## 2. Architecture

```
TransactionListScreen (Tab: 明细)
├── ScreenContainer (headerType='jumbo' | headerHeightPercent=0.6)
│   └── Header (60% viewport)
│       ├── BudgetProgressBar
│       │   ├── AnimatedBackground (scaleX + translateX)
│       │   └── ColorLogic (getProgressColor)
│       └── TodayExpenseDisplay
│           └── AnimatedNumber (timing + interpolate)
└── Content (40% viewport)
    └── SectionList (existing transaction list)
        ├── ListHeaderComponent = null (HUD is in header)
        └── renderSectionHeader / renderItem (existing)

AIInputModal
└── Batch Results
    └── FlatList
        └── WealthCard (variant='receipt')
            ├── ShadowContainer (no overflow:hidden)
            │   └── ClipContainer (overflow:hidden)
            │       ├── ReceiptContent
            │       ├── LeftCutout (absolute, radius=8)
            │       └── RightCutout (absolute, radius=8)
            └── DashedDivider
```

---

## 3. Data Flow

```
[Transaction Created/Deleted]
        │
        ▼
localDB.createLocalTransaction()
        │
        ├── INSERT INTO transactions
        │
        └── emit('transactionsChanged', { type: 'create', tx })
                │
                ▼
        [HUD Subscription Handler]
                │
                ├── debounce(200ms)
                │
                └── reload() → Promise.all([
                      getDashboardStats(today=true),
                      getHudBudgetStatus()
                    ])
                        │
                        ▼
                [Animated Update]
                ├── spring(progressValue, newRatio)
                └── timing(expenseValue, newTotal)
```

---

## 4. New/Modified Functions

### localDB.ts

```typescript
// New: Budget HUD status
export interface HudBudgetStatus {
  hasBudget: boolean;
  period: 'monthly' | 'quarterly' | 'yearly';
  limit: number;
  spent: number;
  percentage: number; // 0-Infinity, consumer clamps
  budgetId: number | null;
}

export async function getHudBudgetStatus(userId: number): Promise<HudBudgetStatus>;

// Modified: getDashboardStats with today shortcut
export async function getDashboardStats(
  userId: number,
  startDate: string,
  endDate: string,
  options?: { useLocalTime?: boolean }
): Promise<{ income: number; expense: number; count: number }>;

// New: Event emitter
type DBEvent = 'transactionsChanged' | 'budgetsChanged' | 'syncApplied';
export function onDBEvent(event: DBEvent, handler: (payload: any) => void): () => void;
function emitDBEvent(event: DBEvent, payload: any): void;
```

### WealthCard.tsx

```typescript
// Extended variant type
export type WealthCardVariant = 'elevated' | 'flat' | 'glass' | 'receipt';

// New receipt-specific props
export interface WealthCardProps {
  // ... existing
  variant?: WealthCardVariant;
  // Receipt-specific
  cutoutColor?: string;  // Override background color for cutouts
  cutoutRadius?: number; // Default: theme.radii.sm (8)
}
```

### New Components

```typescript
// mobile/src/components/BudgetProgressBar.tsx
interface BudgetProgressBarProps {
  percentage: number;  // 0-100+
  animated?: boolean;
  style?: ViewStyle;
}

// mobile/src/components/TodayExpenseDisplay.tsx
interface TodayExpenseDisplayProps {
  amount: number;
  animated?: boolean;
  style?: ViewStyle;
}
```

---

## 5. Risk Mitigations

| Risk | Mitigation | Verification |
|------|------------|--------------|
| iOS shadow clipping | Dual container (outer shadow + inner clip) | Manual iOS test |
| Cutout background mismatch | `cutoutColor` prop with default to theme.colors.background | Visual test in Modal vs Screen |
| Animation jank | useNativeDriver + scaleX transform | Performance profiler |
| Timezone boundary | `DATE(date, 'localtime')` in SQL | PBT-11 test at midnight |
| Rapid events | Debounce + requestId race protection | PBT-08, PBT-09 tests |
| ScreenContainer 60% conflict | New headerType='jumbo' or headerHeightPercent prop | Layout inspector |
