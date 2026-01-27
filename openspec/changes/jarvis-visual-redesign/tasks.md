# OPSX Tasks: jarvis-visual-redesign

## Status: `in-progress`

> Zero-Decision Implementation Plan
> All ambiguities resolved. Each task is mechanical execution.

---

## Phase 1.1: Receipt Card Component ✅

### Task 1.1.1: Extend WealthCard with 'receipt' variant ✅
**Files**: `mobile/src/components/WealthCard.tsx`

1. Add `'receipt'` to `WealthCardVariant` union type
2. Add optional props:
   ```typescript
   cutoutColor?: string;  // default: theme.colors.background
   cutoutRadius?: number; // default: theme.radii.sm (8)
   ```
3. In component body, when `variant === 'receipt'`:
   - Create outer container (applies shadow, NO overflow:hidden)
   - Create inner container (overflow:hidden, same borderRadius)
   - Add left cutout: `position: 'absolute', left: -cutoutRadius, top: '30%', width: cutoutRadius*2, height: cutoutRadius*2, borderRadius: cutoutRadius, backgroundColor: cutoutColor`
   - Add right cutout: same but `right: -cutoutRadius`
4. Preserve existing variants unchanged

**Inputs**: None (extension only)
**Outputs**: WealthCard supports `variant='receipt'`
**PBT**: PBT-01, PBT-02

---

### Task 1.1.2: Add dashed divider style to theme ✅
**Files**: `mobile/src/theme.ts` (if needed), or inline in WealthCard

1. If receipt variant needs a divider:
   ```typescript
   const dividerStyle = {
     borderBottomWidth: 1,
     borderStyle: 'dashed',
     borderColor: theme.colors.outline,
     marginVertical: theme.spacing.sm,
   };
   ```
2. Apply between detail section and total section in receipt content

**Inputs**: Design D3 decision
**Outputs**: Divider style available

---

### Task 1.1.3: Implement edit/delete interaction states in AIInputModal ✅
**Files**: `mobile/src/components/AIInputModal.tsx`

1. Replace `<View style={styles.draftCard}>` with `<WealthCard variant="receipt" cutoutColor={theme.colors.surface}>`
2. Edit mode:
   - Add `editingId: string | null` state (ID-based, not index-based)
   - On edit tap: `startEdit(draftId, draft)`
   - When editing: add `contentStyle={{ backgroundColor: theme.colors.surfaceVariant }}`
   - Cancel: restore original draft from snapshot, `setEditingId(null)`
3. Delete mode:
   - Wrap card in `Animated.View`
   - On delete tap: `Animated.timing(opacity, ...).start(({ finished }) => { if (finished) removeDraftById(draftId) })`
4. Preserve existing `updateDraftById`/`removeDraftById` logic (ID-based)

**Note**: Changed from index-based to ID-based tracking per multi-model review findings.

**Inputs**: Task 1.1.1 completed
**Outputs**: AIInputModal uses receipt cards with edit/delete
**PBT**: PBT-03, PBT-04

---

## Phase 1.2: HUD Dashboard ✅

### Task 1.2.1: Create BudgetProgressBar component ✅
**Files**: `mobile/src/components/BudgetProgressBar.tsx` (new)

1. Create component:
   ```typescript
   interface Props {
     percentage: number;  // 0-100+
     animated?: boolean;
     style?: ViewStyle;
   }
   ```
2. Implement color logic:
   ```typescript
   const getColor = (pct: number) => {
     if (pct < 50) return '#10B981';
     if (pct < 80) return '#F59E0B';
     return '#EF4444';
   };
   ```
3. Implement animation:
   - `const animValue = useRef(new Animated.Value(0)).current;`
   - `const clampedRatio = Math.min(Math.max(percentage / 100, 0), 1);`
   - Use `scaleX` transform: `transform: [{ scaleX: animValue }]`
   - Left anchor: `translateX: animValue.interpolate({ inputRange: [0,1], outputRange: [-barWidth/2, 0] })`
   - `Animated.spring(animValue, { toValue: clampedRatio, useNativeDriver: true, friction: 7, tension: 40 })`
4. Track barWidth via `onLayout`

**Inputs**: Design D4, D5
**Outputs**: `<BudgetProgressBar percentage={75} animated />`
**PBT**: PBT-05, PBT-06, PBT-07

---

### Task 1.2.2: Create TodayExpenseDisplay component ✅
**Files**: `mobile/src/components/TodayExpenseDisplay.tsx` (new)

1. Create component:
   ```typescript
   interface Props {
     amount: number;
     animated?: boolean;
     style?: ViewStyle;
   }
   ```
2. Implement animated number:
   ```typescript
   const animValue = useRef(new Animated.Value(amount)).current;
   useEffect(() => {
     Animated.timing(animValue, { toValue: amount, duration: 300, useNativeDriver: false }).start();
   }, [amount]);
   ```
3. Display: `<AppText variant="hero" style={{ fontSize: 48 }}>¥{displayValue.toFixed(0)}</AppText>`
4. Use `animValue.addListener` to update displayValue state

**Inputs**: None
**Outputs**: `<TodayExpenseDisplay amount={1234} animated />`

---

### Task 1.2.3: Add getHudBudgetStatus to localDB ✅
**Files**: `mobile/src/storage/localDB.ts`

1. Add function:
   ```typescript
   export async function getHudBudgetStatus(userId: number): Promise<HudBudgetStatus> {
     const totalBudget = await queryFirst<BudgetRecord>(
       "SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = 'total' LIMIT 1",
       [userId]
     );
     if (!totalBudget) {
       return { hasBudget: false, period: 'monthly', limit: 0, spent: 0, percentage: 0, budgetId: null };
     }
     const period = totalBudget.period || 'monthly';
     const range = getPeriodRange(period); // Extract from BudgetListScreen
     const limit = getBudgetLimit(totalBudget);
     const spentRow = await queryFirst<{ total: number }>(
       `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE user_id = ? AND deleted_at IS NULL AND type = 'expense'
        AND DATE(date, 'localtime') >= ? AND DATE(date, 'localtime') <= ?`,
       [userId, range.start, range.end]
     );
     const spent = spentRow?.total || 0;
     return {
       hasBudget: true,
       period,
       limit,
       spent,
       percentage: limit > 0 ? (spent / limit) * 100 : 0,
       budgetId: totalBudget.id,
     };
   }
   ```
2. Extract `getPeriodRange` and `getBudgetLimit` to utils or inline

**Inputs**: Design D6
**Outputs**: `getHudBudgetStatus(userId)` function
**PBT**: PBT-11

---

### Task 1.2.4: Add event emitter to localDB ✅
**Files**: `mobile/src/storage/localDB.ts`

1. Add at top of file:
   ```typescript
   type DBEvent = 'transactionsChanged' | 'budgetsChanged' | 'syncApplied';
   const listeners = new Map<DBEvent, Set<(payload: any) => void>>();

   export function onDBEvent(event: DBEvent, handler: (payload: any) => void): () => void {
     if (!listeners.has(event)) listeners.set(event, new Set());
     listeners.get(event)!.add(handler);
     return () => listeners.get(event)?.delete(handler);
   }

   function emitDBEvent(event: DBEvent, payload: any): void {
     listeners.get(event)?.forEach(h => h(payload));
   }
   ```
2. Add `emitDBEvent('transactionsChanged', { type: 'create', tx })` after:
   - `createLocalTransaction` return
   - `createLocalTransactions` return
   - `updateLocalTransaction` return
   - `softDeleteLocalTransaction` return
3. Add `emitDBEvent('budgetsChanged', ...)` after budget mutations
4. Add `emitDBEvent('syncApplied', ...)` after `applyServerSync`

**Inputs**: Design D7
**Outputs**: Event subscription API
**PBT**: PBT-08, PBT-09, PBT-10

---

### Task 1.2.5: Extend ScreenContainer for HUD layout ✅
**Files**: `mobile/src/components/ScreenContainer.tsx`

1. Add to `HeaderType`: `'jumbo'`
2. Update `HEADER_HEIGHTS`:
   ```typescript
   const HEADER_HEIGHTS = {
     large: 280,
     standard: 180,
     mini: 120,
     hidden: 0,
     jumbo: Dimensions.get('window').height * 0.6,
   };
   ```
3. Alternatively, add `headerHeightPercent?: number` prop:
   ```typescript
   const headerHeight = headerHeightPercent
     ? Dimensions.get('window').height * headerHeightPercent
     : HEADER_HEIGHTS[headerType];
   ```

**Inputs**: Design D8
**Outputs**: ScreenContainer supports 60% header

---

### Task 1.2.6: Refactor TransactionListScreen to HUD layout ✅
**Files**: `mobile/src/screens/transactions/TransactionListScreen.tsx`

1. Import new components:
   ```typescript
   import { BudgetProgressBar } from '../../components/BudgetProgressBar';
   import { TodayExpenseDisplay } from '../../components/TodayExpenseDisplay';
   import { onDBEvent, getHudBudgetStatus, getDashboardStats } from '../../storage/localDB';
   ```
2. Add state:
   ```typescript
   const [budgetStatus, setBudgetStatus] = useState<HudBudgetStatus | null>(null);
   const [todayExpense, setTodayExpense] = useState(0);
   ```
3. Add HUD data loader:
   ```typescript
   const loadHUD = useCallback(async () => {
     if (!user) return;
     const today = toYmd(new Date());
     const [budget, stats] = await Promise.all([
       getHudBudgetStatus(user.id),
       getDashboardStats(user.id, today, today),
     ]);
     setBudgetStatus(budget);
     setTodayExpense(stats.expense);
   }, [user]);
   ```
4. Add event subscription with debounce:
   ```typescript
   useEffect(() => {
     let timeoutId: NodeJS.Timeout;
     const unsub = onDBEvent('transactionsChanged', () => {
       clearTimeout(timeoutId);
       timeoutId = setTimeout(loadHUD, 200);
     });
     return () => { unsub(); clearTimeout(timeoutId); };
   }, [loadHUD]);
   ```
5. Update ScreenContainer:
   ```typescript
   <ScreenContainer
     headerType="jumbo"
     headerContent={
       <View style={styles.hud}>
         {budgetStatus?.hasBudget ? (
           <BudgetProgressBar percentage={budgetStatus.percentage} animated />
         ) : (
           <NoBudgetPrompt onPress={() => navigation.navigate('Budget')} />
         )}
         <TodayExpenseDisplay amount={todayExpense} animated />
       </View>
     }
   >
   ```
6. Remove Toast on transaction success (if any exists in this file)

**Inputs**: Tasks 1.2.1-1.2.5 completed
**Outputs**: HUD dashboard functional
**PBT**: All HUD-related PBTs

---

## Verification Checklist

| ID | Criterion | Verification |
|----|-----------|--------------|
| ✅ | Receipt card has edge cutouts | Visual: left/right circles visible |
| ✅ | Amount text > 24sp | Inspect fontSize in styles |
| ✅ | Expense red / Income green | Color picker on rendered card |
| ✅ | Edit mode gray background | Tap edit, verify surfaceVariant |
| ✅ | Delete animates out | Screen record tap delete |
| ✅ | HUD ~60% screen | Layout inspector |
| ✅ | Progress bar color thresholds | Test at 49%, 50%, 79%, 80% |
| ✅ | Progress bar spring animation | Screen record at 0.5x |
| ✅ | No Toast on submit | Manual test transaction add |
| ✅ | HUD updates in real-time | Add transaction, observe HUD |
| ✅ | Timezone correct | Add tx at 23:59, check next day |
