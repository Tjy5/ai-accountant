# OPSX Specs: jarvis-visual-redesign

## Status: `plan-complete`

---

## Requirements

### REQ-1.1: Receipt-Style Result Card

**GIVEN** AI has recognized 1+ transactions
**WHEN** the result card is displayed in AIInputModal
**THEN**:
- Card uses `WealthCard` with `variant='receipt'`
- White background (`theme.colors.surface`)
- Left/right half-circle cutouts: radius = `theme.radii.sm` (8px), Y-offset = 30% from top
- Cutout color = configurable prop (default `theme.colors.background`)
- Shadow = `theme.shadows.small` (elevation 2)
- Amount: largest text (>24sp), red `#EF4444` for expense, green `#10B981` for income
- Category icon + name: second level
- Date + note: third level (gray `#64748B`)
- Dashed divider (`borderStyle: 'dashed'`) separating detail/total sections
- Dual-layer container: outer (shadow, no overflow:hidden) + inner (overflow:hidden for cutouts)

**Edit Mode**:
- Tap edit icon → text fields become editable TextInputs
- Background changes to `theme.colors.surfaceVariant`
- Cancel restores original draft values (round-trip: PBT-03)

**Delete Action**:
- Tap delete → card animates out (fade/slide)
- Draft removed from array
- Delete is idempotent (PBT-04)

### REQ-1.2: JARVIS HUD Dashboard

**GIVEN** user opens the App (TransactionListScreen as Tab home)
**WHEN** the screen loads
**THEN**:
- Top ~60% of screen height: HUD area (via ScreenContainer extended header)
- Budget progress bar (horizontal, thick):
  - Data: `getHudBudgetStatus(userId)` → {hasBudget, limit, spent, percentage}
  - Color: green `#10B981` if <50%, yellow `#F59E0B` if 50-80%, red `#EF4444` if ≥80% (PBT-06, PBT-07)
  - Animation: `Animated.spring()` with `useNativeDriver: true`, using `scaleX` + `translateX` (PBT-05)
  - No budget: show "未设置预算" + CTA to Budget Tab
- Today's total expense: large centered number
  - Data: `getDashboardStats(userId, todayYmd, todayYmd)` using `DATE(date, 'localtime')`
  - Animation: number "jumping" on update via `Animated.timing()` + interpolate
- Bottom ~40%: Transaction list (existing SectionList via ListHeaderComponent pattern)
- No Toast on successful transaction submission

**Real-time Update** (PBT-08, PBT-09, PBT-10):
- Event bus integrated in `localDB.ts`
- Events: `transactionsChanged`, `budgetsChanged`
- Emitted from: `createLocalTransaction`, `createLocalTransactions`, `updateLocalTransaction`, `softDeleteLocalTransaction`, `applyServerSync`
- HUD subscribes on mount, unsubscribes on unmount
- Debounce: 150-300ms coalescing
- Race protection: monotonic requestId ref

---

## PBT Properties

| ID | Requirement | Category | Invariant | Falsification |
|----|-------------|----------|-----------|---------------|
| PBT-01 | Receipt Card | bounds | cutoutRadius ∈ [0, h/2], no NaN/Infinity | Random (w,h,r) with edge values |
| PBT-02 | Receipt Card | invariant | Left/right cutouts symmetric (same radius, same Y) | Extract computed styles, compare |
| PBT-03 | Receipt Card | round-trip | Cancel edit → draft === original | Random draft + edits + cancel |
| PBT-04 | Receipt Card | idempotency | Repeated delete same ID → same result | Duplicate delete sequences |
| PBT-05 | Budget Bar | bounds | ratio ∈ [0,1], budgetLimit≤0 → 0 | NaN/Infinity/negative inputs |
| PBT-06 | Budget Bar | invariant | <50%=green, 50-80%=yellow, ≥80%=red | r = 0.5±ε, 0.8±ε boundary |
| PBT-07 | Budget Bar | monotonicity | spent↑ → color severity non-decreasing | Monotone spent sequences |
| PBT-08 | Event Bus | idempotency | Duplicate events don't double-count | Same txId repeated k times |
| PBT-09 | Event Bus | round-trip | Incremental HUD == full recompute | Random event sequences |
| PBT-10 | Event Bus | invariant | Unsubscribed listener gets no events | Random sub/unsub/emit |
| PBT-11 | Today Expense | invariant | Only local-date=today expense included | Midnight boundary timestamps |
| PBT-12 | Today Expense | monotonicity | Add today expense → total += amount | Random add/delete ops |
